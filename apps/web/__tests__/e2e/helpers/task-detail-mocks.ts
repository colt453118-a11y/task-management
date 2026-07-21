import type { Page, Route } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════
//  Shared Test Data
//  Used by task-checklist-and-feed, task-watcher-button, and
//  future task-detail E2E tests.
// ═══════════════════════════════════════════════════════════════

export const TASK_ID = '550e8400-e29b-41d4-a716-446655440000';

export const MOCK_TASK = {
  id: TASK_ID,
  title: 'Implement user authentication',
  description: '<p>Build the login and registration flow</p>',
  taskIdDisplay: 'TASK-001',
  status: 'in_progress',
  priority: 'high',
  assignedTo: 'user-123',
  projectId: null,
  departmentId: null,
  teamId: null,
  createdBy: 'user-123',
  updatedBy: 'user-123',
  dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  startDate: new Date().toISOString(),
  estimatedHours: '8.00',
  actualHours: null,
  labels: ['frontend', 'auth'],
  tags: null,
  category: 'development',
  createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  updatedAt: new Date().toISOString(),
} as const;

export const CHECKLIST_ITEMS = [
  {
    id: 'cl-1',
    taskId: TASK_ID,
    content: 'Set up database schema',
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    sortOrder: 0,
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
  },
  {
    id: 'cl-2',
    taskId: TASK_ID,
    content: 'Create API endpoints',
    isChecked: true,
    checkedBy: 'user-123',
    checkedAt: new Date().toISOString(),
    sortOrder: 1,
    createdAt: new Date(Date.now() - 1800 * 1000).toISOString(),
  },
  {
    id: 'cl-3',
    taskId: TASK_ID,
    content: 'Write unit tests',
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    sortOrder: 2,
    createdAt: new Date().toISOString(),
  },
] as const;

export const HISTORY_ENTRIES = [
  {
    id: 'hist-1',
    taskId: TASK_ID,
    userId: 'user-123',
    field: 'status',
    oldValue: 'open',
    newValue: 'in_progress',
    changeType: 'status_change',
    description: 'Changed status from open to in_progress',
    createdAt: new Date(Date.now() - 600 * 1000).toISOString(),
    user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null },
  },
  {
    id: 'hist-2',
    taskId: TASK_ID,
    userId: 'user-456',
    field: 'assignedTo',
    oldValue: null,
    newValue: 'user-123',
    changeType: 'assignment',
    description: 'Assigned to Alice Johnson',
    createdAt: new Date(Date.now() - 1200 * 1000).toISOString(),
    user: { id: 'user-456', name: 'Bob Smith', avatarUrl: null },
  },
  {
    id: 'hist-3',
    taskId: TASK_ID,
    userId: 'user-123',
    field: 'title',
    oldValue: null,
    newValue: 'Implement user authentication',
    changeType: 'creation',
    description: 'Created this task',
    createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
    user: { id: 'user-123', name: 'Alice Johnson', avatarUrl: null },
  },
  {
    id: 'hist-4',
    taskId: TASK_ID,
    userId: 'system',
    field: 'priority',
    oldValue: 'medium',
    newValue: 'high',
    changeType: 'update',
    description: 'Changed priority from medium to high',
    createdAt: new Date(Date.now() - 2400 * 1000).toISOString(),
    user: null,
  },
] as const;

// ═══════════════════════════════════════════════════════════════
//  Shared Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Set a mock session cookie so the middleware allows access to
 * protected routes. The value just needs to be non-empty — all
 * API endpoints are mocked via route interception.
 */
export async function setSessionCookie(page: Page) {
  // Primary method: addCookies with explicit URL (more reliable than domain + path in CI)
  await page.context().addCookies([
    {
      name: 'better-auth.session_token',
      value: 'mock-session-token',
      url: 'http://localhost:3000',
    },
  ]);

  // Fallback: set cookie via addInitScript so it's available before any page JS runs.
  // Playwright's route interception handles API calls, but the middleware checks
  // the cookie synchronously on first load — addInitScript ensures it's present.
  await page.addInitScript(() => {
    document.cookie = 'better-auth.session_token=mock-session-token; path=/;';
  });
}

/**
 * Register the checklist API route with GET returning items and
 * optional mutation handlers for POST/PATCH/DELETE.
 *
 * Every checklist test needs this — it removes ~15 lines of boilerplate
 * per test while keeping mutation handlers flexible.
 *
 * @example
 *   // Just items (GET only, others 405)
 *   await registerChecklistRoute(page, { items: CHECKLIST_ITEMS });
 *
 *   // With mutation handler
 *   await registerChecklistRoute(page, {
 *     items: [],
 *     onPost: { status: 201, body: { item: newItem } },
 *   });
 *
 *   // Function handler for custom logic
 *   await registerChecklistRoute(page, {
 *     items: CHECKLIST_ITEMS,
 *     onPatch: async (route) => {
 *       const url = route.request().url();
 *       if (url.includes('itemId=cl-1')) { ... }
 *     },
 *   });
 */
export async function registerChecklistRoute(
  page: Page,
  options: {
    items?: readonly Record<string, unknown>[];
    onPost?: { status?: number; body: Record<string, unknown> } | ((route: Route) => Promise<void>);
    onPatch?: { status?: number; body: Record<string, unknown> } | ((route: Route) => Promise<void>);
    onDelete?: { status?: number; body: Record<string, unknown> } | ((route: Route) => Promise<void>);
  } = {},
) {
  const { items = CHECKLIST_ITEMS as unknown as Record<string, unknown>[], onPost, onPatch, onDelete } = options;

  await page.route(`**/api/tasks/${TASK_ID}/checklist*`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items }),
      });
      return;
    }

    const handler = method === 'POST' ? onPost
      : method === 'PATCH' ? onPatch
      : method === 'DELETE' ? onDelete
      : undefined;

    if (!handler) {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
      return;
    }

    if (typeof handler === 'function') {
      await handler(route);
    } else {
      await route.fulfill({
        status: handler.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(handler.body),
      });
    }
  });
}

/**
 * Register the activity history API route with GET returning history
 * entries. Overrides mockPageApis's default empty-history route.
 *
 * @example
 *   // Empty history (default)
 *   await registerHistoryRoute(page);
 *
 *   // With entries
 *   await registerHistoryRoute(page, { entries: HISTORY_ENTRIES });
 *
 *   // Simulate fetch failure
 *   await registerHistoryRoute(page, { abort: true });
 */
export async function registerHistoryRoute(
  page: Page,
  options: {
    entries?: readonly Record<string, unknown>[];
    /** Abort the request with connectionrefused to simulate a fetch error. */
    abort?: boolean;
  } = {},
) {
  const { entries = [], abort: shouldAbort } = options;

  await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
    if (shouldAbort) {
      await route.abort('connectionrefused');
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ history: entries }),
      });
    }
  });
}

/**
 * Register the watchers API route with GET returning the given state
 * and optional mutation handlers for POST/DELETE, delay, or abort.
 *
 * Overrides mockPageApis's default watchers route.
 *
 * @example
 *   // Simple GET state
 *   await registerWatcherRoute(page, { state: { isWatching: true, watcherCount: 5 } });
 *
 *   // With POST handler for toggle
 *   await registerWatcherRoute(page, {
 *     state: { isWatching: false, watcherCount: 3 },
 *     onPost: async (route) => { ... },
 *   });
 *
 *   // Simulate delayed response (shimmer)
 *   await registerWatcherRoute(page, { state: { isWatching: false, watcherCount: 0 }, delay: 600 });
 *
 *   // Simulate fetch failure
 *   await registerWatcherRoute(page, { abort: true });
 */
export async function registerWatcherRoute(
  page: Page,
  options: {
    /** GET response state. Default: { isWatching: false, watcherCount: 0 }. */
    state?: { isWatching: boolean; watcherCount: number };
    /** Custom POST handler. If absent, POST returns 405. */
    onPost?: ((route: Route) => Promise<void>) | { success: boolean };
    /** Custom DELETE handler. If absent, DELETE returns 405. */
    onDelete?: ((route: Route) => Promise<void>) | { success: boolean };
    /** Delay (ms) before fulfilling the GET response (for shimmer test). */
    delay?: number;
    /** Abort GET instead of fulfilling (for error test). */
    abort?: boolean;
  } = {},
) {
  const {
    state = { isWatching: false, watcherCount: 0 },
    onPost,
    onDelete,
    delay,
    abort: shouldAbort,
  } = options;

  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      if (shouldAbort) {
        await route.abort('connectionrefused');
        return;
      }
      if (delay) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state),
      });
      return;
    }

    const handler = method === 'POST' ? onPost : method === 'DELETE' ? onDelete : undefined;

    if (!handler) {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
      return;
    }

    if (typeof handler === 'function') {
      await handler(route);
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(handler),
      });
    }
  });
}

/**
 * Register the comments API route with GET returning the given comments
 * and optional handlers for POST (add) and DELETE (delete).
 *
 * Uses `comments*` glob to match DELETE URLs with `?commentId=` query params.
 *
 * @example
 *   // Simple GET
 *   await registerCommentsRoute(page, { comments: [MOCK_COMMENT] });
 *
 *   // With POST handler
 *   await registerCommentsRoute(page, {
 *     comments: [],
 *     onPost: { status: 201, body: { comment: newComment } },
 *   });
 *
 *   // With DELETE handler
 *   await registerCommentsRoute(page, {
 *     comments: [MOCK_COMMENT],
 *     onDelete: { body: { success: true } },
 *   });
 */
export async function registerCommentsRoute(
  page: Page,
  options: {
    /** Comments returned by GET. Default: []. */
    comments?: readonly Record<string, unknown>[];
    /** Custom POST handler. If absent, POST returns 405. */
    onPost?: ((route: Route) => Promise<void>) | { status?: number; body: Record<string, unknown> };
    /** Custom DELETE handler. If absent, DELETE returns 405. */
    onDelete?: ((route: Route) => Promise<void>) | { status?: number; body: Record<string, unknown> };
  } = {},
) {
  const { comments = [], onPost, onDelete } = options;

  // Must use `comments*` to match DELETE URLs with ?commentId= query params
  await page.route(`**/api/tasks/${TASK_ID}/comments*`, async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ comments }),
      });
      return;
    }

    const handler = method === 'POST' ? onPost : method === 'DELETE' ? onDelete : undefined;

    if (!handler) {
      await route.fulfill({ status: 405, body: 'Method not allowed' });
      return;
    }

    if (typeof handler === 'function') {
      await handler(route);
    } else {
      await route.fulfill({
        status: handler.status ?? 200,
        contentType: 'application/json',
        body: JSON.stringify(handler.body),
      });
    }
  });
}

/**
 * Mock common API endpoints the task detail page calls so components
 * can render in isolation.
 *
 * Registers defaults for: task detail, comments (empty), attachments
 * (empty), dependencies (empty), time entries (empty), watchers
 * (not watching / 0 count), activity history (empty).
 *
 * Use the dedicated `register*Route` helpers to override specific
 * endpoints with custom data:
 *
 *   - `registerCommentsRoute(page, { comments: [...] })`
 *   - `registerChecklistRoute(page, { items: [...] })`
 *   - `registerHistoryRoute(page, { entries: [...] })`
 *   - `registerWatcherRoute(page, { state: {...} })`
 *
 * These helpers register AFTER mockPageApis, so they take precedence
 * via Playwright's last-registered-wins behavior.
 */
export async function mockPageApis(page: Page) {
  // Task detail
  await page.route(`**/api/tasks/${TASK_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ task: MOCK_TASK }),
    });
  });

  // Comments — empty
  await page.route(`**/api/tasks/${TASK_ID}/comments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ comments: [] }),
    });
  });

  // Attachments — empty
  await page.route(`**/api/tasks/${TASK_ID}/attachments`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ attachments: [] }),
    });
  });

  // Dependencies — empty
  await page.route(`**/api/tasks/${TASK_ID}/dependencies`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ blockedBy: [], blocking: [] }),
    });
  });

  // Time entries — empty
  await page.route(`**/api/tasks/${TASK_ID}/time-entries`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ entries: [] }),
    });
  });

  // Watchers — empty/default (overridable per-test)
  await page.route(`**/api/tasks/${TASK_ID}/watchers`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ isWatching: false, watcherCount: 0 }),
    });
  });

  // Activity history — empty (overridable per-test)
  await page.route(`**/api/tasks/${TASK_ID}/history`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ history: [] }),
    });
  });
}
