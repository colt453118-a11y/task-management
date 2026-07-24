import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { withAuth } from '@/lib/auth/api-auth';
import { getDbModel, PROMPTS } from '@/lib/ai';
import type { ApiHandlerContext } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';

// POST /api/ai/suggest-priority - Suggest task priority
export const POST = withAuth(
  async (request: NextRequest, { orgId }: ApiHandlerContext) => {
    try {
      const body = await request.json();
      const { title, description, dueDate, labels, estimatedHours } = body;

      if (!title) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Task title is required' } },
          { status: 400 },
        );
      }

      const model = await getDbModel(orgId);
      const prompt = PROMPTS.prioritySuggestion({
        title,
        description,
        dueDate,
        labels,
        estimatedHours,
      });

      const result = await streamText({
        model,
        prompt,
        temperature: 0.3,
      });

      return new NextResponse(result.stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      console.error('[ai] Priority suggestion error:', error);
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'Failed to suggest priority' } },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'ai:priority' },
);
