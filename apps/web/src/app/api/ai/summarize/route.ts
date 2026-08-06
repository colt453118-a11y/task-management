import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { withAuth } from '@/lib/auth/api-auth';
import { getDbModel, PROMPTS, AINotConfiguredError } from '@/lib/ai';
import type { ApiHandlerContext } from '@/lib/auth/api-auth';

export const runtime = 'nodejs';

// POST /api/ai/summarize - Generate an AI summary
export const POST = withAuth(
  async (request: NextRequest, { orgId }: ApiHandlerContext) => {
    try {
      const { type, data } = await request.json();

      if (!type || !data) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'type and data are required' } },
          { status: 400 },
        );
      }

      let prompt = '';

      switch (type) {
        case 'task':
          prompt = PROMPTS.taskSummary(data.title ?? 'Untitled', data.description ?? '');
          break;
        case 'eod_report':
          prompt = PROMPTS.eodReportSummary(data.tasksSummary ?? '');
          break;
        case 'writing_assist':
          prompt = PROMPTS.writingAssistant(data.text ?? '', data.instruction ?? 'improve clarity');
          break;
        default:
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: `Unknown summary type: ${type}` } },
            { status: 400 },
          );
      }

      const model = await getDbModel(orgId);

      const { text } = await generateText({
        model,
        prompt,
        temperature: 0.7,
      });

      return new NextResponse(text, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      if (error instanceof AINotConfiguredError) {
        return NextResponse.json(
          { error: { code: 'AI_NOT_CONFIGURED', message: 'AI features are not set up yet. Add an AI API key in Settings → AI.' } },
          { status: 503 },
        );
      }
      console.error('[ai] Summarize error:', error);
      return NextResponse.json(
        { error: { code: 'AI_ERROR', message: 'Failed to generate summary' } },
        { status: 500 },
      );
    }
  },
  { windowMs: 60_000, max: 30, namespace: 'ai:summarize' },
);
