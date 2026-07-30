import { generateText } from 'ai';
import { getDbModel, PROMPTS } from '@/lib/ai';
import type { SnapshotSummary } from '@/lib/reports/snapshots';

/**
 * Build a human-readable tasks summary string from snapshot metrics
 * that the AI can use to generate a concise EOD report.
 */
export function buildTasksSummaryString(summary: SnapshotSummary): string {
  return [
    `Total tasks: ${summary.totalTasks}`,
    `Completed: ${summary.completedCount}`,
    `Overdue: ${summary.overdueCount}`,
    `Completion rate: ${summary.completionRate}%`,
    `Active projects: ${summary.activeProjects}`,
    `Team members: ${summary.totalUsers}`,
  ].join('\n');
}

/**
 * Generate an AI-powered EOD report summary on the server side.
 *
 * Uses the organization's configured AI provider/key from the database
 * (falling back to environment variables) to produce a concise 3-5
 * bullet-point summary of the day's task activity.
 *
 * Returns the summary text, or null if the AI call fails or no API key
 * is configured.
 */
export async function generateEODAISummary(
  orgId: string | null,
  summary: SnapshotSummary,
): Promise<string | null> {
  try {
    const tasksSummary = buildTasksSummaryString(summary);
    const prompt = PROMPTS.eodReportSummary(tasksSummary);

    const model = await getDbModel(orgId);

    const result = await generateText({
      model,
      prompt,
      temperature: 0.7,
    });

    return result.text.trim() || null;
  } catch (error) {
    // AI failures are non-critical — log and return null so the snapshot
    // is still saved without the AI summary
    console.error('[eod-ai] Failed to generate EOD summary:', error instanceof Error ? error.message : error);
    return null;
  }
}
