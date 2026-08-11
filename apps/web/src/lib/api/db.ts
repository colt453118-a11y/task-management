import { getDb, schema } from '@workmanagement/database';
import { eq, sql } from 'drizzle-orm';

export { schema };

let _db: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}

function apiError(message: string, code = 'INTERNAL_ERROR', status = 500) {
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
  // Preserve auth/permission errors rather than masking them as a generic 500:
  // requireAuth → 401, and requirePermission / enforceOrgScope → 403. When these
  // are thrown inside a route's own try/catch they reach here instead of the
  // withAuth wrapper, so re-map them to their real status. Duck-typed on the
  // AuthError shape to avoid importing the auth layer (circular dependency).
  if (
    error instanceof Error &&
    error.name === 'AuthError' &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    const authErr = error as Error & { status: number; code?: string };
    return apiError(authErr.message, authErr.code ?? 'FORBIDDEN', authErr.status);
  }
  console.error(message, error);
  return apiError(message, code, status);
}

/**
 * Recalculate a task's `actualHours` from the SUM of all its time entries.
 * Called after a time entry is created/updated or a correction is approved.
 *
 * Done as a single atomic `UPDATE … SET actual_hours = (SELECT SUM …)` so a
 * concurrent recalc can't lost-update the total: the previous SELECT-then-
 * UPDATE could read fewer entries and then write its stale sum last (WM-014).
 * The SUM is re-read at UPDATE time, so the result always reflects committed
 * entries. Failures are silent — hours are recalculated on the next update.
 *
 * Returns the new total hours as a string, or `null` on failure.
 */
export async function recalcTaskHours(
  taskId: string,
): Promise<string | null> {
  try {
    const [row] = await db()
      .update(schema.tasks)
      .set({
        actualHours: sql`ROUND(COALESCE((
          SELECT SUM(${schema.timeEntries.durationMinutes})
          FROM ${schema.timeEntries}
          WHERE ${schema.timeEntries.taskId} = ${taskId}
            AND ${schema.timeEntries.durationMinutes} IS NOT NULL
        ), 0) / 60.0, 2)`,
        updatedAt: new Date(),
      })
      .where(eq(schema.tasks.id, taskId))
      .returning({ actualHours: schema.tasks.actualHours });

    return row?.actualHours ?? null;
  } catch {
    return null;
  }
}
