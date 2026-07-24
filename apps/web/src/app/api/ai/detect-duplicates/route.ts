import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { withAuth } from '@/lib/auth/api-auth';
import { getDbModel, PROMPTS } from '@/lib/ai';
import type { ApiHandlerContext } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';

// POST /api/ai/detect-duplicates - Find potential duplicate tasks
export const POST = withAuth(
  async (request: NextRequest, { orgId }: ApiHandlerContext) => {
    try {
      const body = await request.json();
      const { title, existingTitles } = body;

      if (!title || !existingTitles || !Array.isArray(existingTitles)) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'title and existingTitles[] are required' } },
          { status: 400 },
        );
      }

      if (existingTitles.length === 0) {
        return NextResponse.json({ potentialDuplicates: [] });
      }

      // Limit to prevent excessive tokens
      const maxTitles = 50;
      const titles = existingTitles.slice(0, maxTitles);

      const model = await getDbModel(orgId);
      const prompt = PROMPTS.duplicateDetection(title, titles);

      const result = await streamText({
        model,
        prompt,
        temperature: 0.2,
      });

      return new NextResponse(result.stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      console.error('[ai] Duplicate detection error:', error);
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'Failed to detect duplicates' } },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 20, namespace: 'ai:duplicates' },
);
