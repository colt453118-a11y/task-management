import { getDb, schema } from '@workmanagement/database';
import { eq, and, isNotNull } from 'drizzle-orm';

export { schema };

let _db: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}

export function apiError(message: string, code = 'INTERNAL_ERROR', status = 500) {
  return {
    error: { code, message },
    status,
  };
}

/**
 * Convenience wrapper that logs the error then returns the standard API error response.
 *
 * Use in catch blocks instead of console.error + apiError:
 *
 *   // Before:
 *   catch (error) {
 *     console.error('Failed to X:', error);
 *     const { error: err, status } = apiError('Failed to X');
 *     return NextResponse.json(err, { status });
 *   }
 *
 *   // After:
 *   catch (error) {
 *     const { error: err, status } = handleApiError(error, 'Failed to X');
 *     return NextResponse.json(err, { status });
 *   }
 */
export function handleApiError(
  error: unknown,
  message: string,
  code = 'INTERNAL_ERROR',
  status = 500,
): { error: { code: string; message: string }; status: number } {
  console.error(message, error);
  return apiError(message, code, status);
}

/**
 * Recalculate a task's `actualHours` based on all its time entries.
 * Called after approving a time correction request.
 *
 * Returns the new total hours as a string, or `null` on failure.
 * Failures are silent — hours are recalculated on the next update.
 */
export async function recalcTaskHours(
  taskId: string,
): Promise<string | null> {
  try {
    const allEntries = await db()
      .select({ durationMinutes: schema.timeEntries.durationMinutes })
      .from(schema.timeEntries)
      .where(
        and(
          eq(schema.timeEntries.taskId, taskId),
          isNotNull(schema.timeEntries.durationMinutes),
        ),
      );

    const totalMinutes = allEntries.reduce(
      (sum, e) => sum + (e.durationMinutes ?? 0),
      0,
    );
    const totalHours = (totalMinutes / 60).toFixed(2);

    await db()
      .update(schema.tasks)
      .set({ actualHours: totalHours, updatedAt: new Date() })
      .where(eq(schema.tasks.id, taskId));

    return totalHours;
  } catch {
    return null;
  }
}
