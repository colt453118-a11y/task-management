import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-auth';
import { searchTasks } from '@/lib/search';
import { handleApiError } from '@/lib/api/db';

export const runtime = 'nodejs';

// GET /api/search?q=...&limit=20&offset=0&status=open&priority=high
// Searches tasks via Meilisearch. Falls back to a simple 501 if Meilisearch
// is not configured — the frontend should handle this gracefully.
export const GET = withAuth(
  async (request: NextRequest, { orgId }) => {
    try {
      const { searchParams } = new URL(request.url);
      const query = searchParams.get('q') ?? '';
      const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 20, 1), 100);
      const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
      const status = searchParams.get('status');
      const priority = searchParams.get('priority');
      const assignedTo = searchParams.get('assignedTo');
      const projectId = searchParams.get('projectId');

      // Build optional filters
      const filter: Record<string, string> = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (assignedTo) filter.assignedTo = assignedTo;
      if (projectId) filter.projectId = projectId;

      const result = await searchTasks({
        query,
        organizationId: orgId!,
        limit,
        offset,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      });

      return NextResponse.json(result);
    } catch (error) {
      // If Meilisearch is not configured, return a clear fallback
      if (error instanceof Error && error.message === 'MEILISEARCH_HOST is not configured') {
        return NextResponse.json(
          {
            hits: [],
            total: 0,
            estimatedTotal: 0,
            limit: 20,
            offset: 0,
            error: 'Search is not configured. Use the standard task list instead.',
            searchUnavailable: true,
          },
          { status: 200 },
        );
      }

      console.error('Search failed:', error);
      const { error: err, status } = handleApiError(error, 'Search failed');
      return NextResponse.json(err, { status });
    }
  },
  { windowMs: 60_000, max: 60, namespace: 'search:query' },
);
