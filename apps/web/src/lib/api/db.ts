import { getDb, schema } from '@workmanagement/database';
import { captureException } from '@/lib/sentry';

export { schema };

let _db: ReturnType<typeof getDb> | null = null;

export function db() {
  if (!_db) {
    _db = getDb();
  }
  return _db;
}

export function apiError(message: string, code = 'INTERNAL_ERROR', status = 500, originalError?: unknown) {
  if (originalError) {
    captureException(originalError, {
      'api.errorCode': code,
      'api.status': status,
    });
  }

  return {
    error: { code, message },
    status,
  };
}

/**
 * Convenience wrapper that logs the error, captures it to Sentry,
 * and returns the standard API error response.
 *
 * Use in catch blocks instead of console.error + apiError:
 *   catch (error) {
 *     return handleApiError(error, 'Failed to fetch tasks');
 *   }
 */
export function handleApiError(
  error: unknown,
  message: string,
  code = 'INTERNAL_ERROR',
  status = 500,
): { error: { code: string; message: string }; status: number } {
  console.error(message, error);
  captureException(error, { 'api.errorCode': code, 'api.status': status });
  return apiError(message, code, status);
}
