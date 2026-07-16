# Testing Strategy — Enterprise Work Management Platform

## Testing Philosophy

- **Shift left** — Find bugs as early as possible (lint → typecheck → unit → integration → e2e)
- **Test the behavior, not the implementation** — Tests should validate outcomes, not internal details
- **Every PR is a quality gate** — No PR merges without passing all test levels
- **Automated > Manual** — Manual testing only for exploratory and UX validation

---

## Testing Pyramid

```
         ╱╲
        ╱  ╲           E2E Tests (Playwright)
       ╱    ╲          ─────────────────────
      ╱      ╲         Critical user journeys
     ╱────────╲
    ╱          ╲       Integration Tests (Vitest)
   ╱            ╲     ─────────────────────────
  ╱              ╲    API tests, DB queries, service layer
 ╱────────────────╲
╱                  ╲   Unit Tests (Vitest)
╱                    ╲ ─────────────────────
─────────────────────── Pure functions, utilities, Zod schemas
```

---

## 1. Unit Tests (Vitest)

### What to test

- Pure utility functions (date helpers, ID generation, permission checks)
- Zod validation schemas
- State management logic (Zustand stores)
- Domain service logic (task status transitions, workflow rules)

### What NOT to test

- Database queries (covered in integration)
- UI rendering (covered in component tests)
- Network requests (covered in integration)

### Example: Utility Test

```typescript
// __tests__/utils/date.test.ts
import { describe, it, expect } from 'vitest';
import { isOverdue, formatDueDate, getTaskAge } from '@/lib/utils/date';

describe('isOverdue', () => {
  it('returns true when due date is in the past', () => {
    const pastDate = new Date('2025-01-01');
    expect(isOverdue(pastDate)).toBe(true);
  });

  it('returns false when due date is in the future', () => {
    const futureDate = new Date('2027-01-01');
    expect(isOverdue(futureDate)).toBe(false);
  });

  it('returns false when task is completed', () => {
    const pastDate = new Date('2025-01-01');
    expect(isOverdue(pastDate, { status: 'completed' })).toBe(false);
  });
});
```

### Example: Schema Test

```typescript
// __tests__/validations/task.test.ts
import { createTaskSchema } from '@/lib/validations/task';

describe('createTaskSchema', () => {
  it('accepts valid task data', () => {
    const result = createTaskSchema.safeParse({
      title: 'Implement login page',
      priority: 'high',
      projectId: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createTaskSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority value', () => {
    const result = createTaskSchema.safeParse({
      title: 'Test',
      priority: 'super-urgent',
    });
    expect(result.success).toBe(false);
  });
});
```

---

## 2. Integration Tests

### Database Query Tests

```typescript
// __tests__/integration/task-queries.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/lib/db';
import { tasks } from '@/lib/db/schema';
import { createTestOrg, createTestUser } from '../helpers/test-factory';

describe('Task Queries', () => {
  let orgId: string;
  let userId: string;

  beforeAll(async () => {
    orgId = await createTestOrg();
    userId = await createTestUser(orgId);
  });

  afterAll(async () => {
    await cleanUpTestData(orgId);
  });

  it('creates a task with auto-generated display ID', async () => {
    const [task] = await db
      .insert(tasks)
      .values({
        title: 'Test task',
        organizationId: orgId,
        createdBy: userId,
      })
      .returning();

    expect(task.title).toBe('Test task');
    expect(task.taskIdDisplay).toMatch(/^TASK-\d+$/);
    expect(task.status).toBe('draft'); // Default status
  });

  it('returns paginated task list', async () => {
    // Insert 15 test tasks
    await insertTestTasks(orgId, userId, 15);

    const result = await getTaskList(orgId, { limit: 10 });
    expect(result.items).toHaveLength(10);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeDefined();
  });

  it('filters tasks by status', async () => {
    const openTasks = await getTaskList(orgId, { status: ['open'] });
    expect(openTasks.items.every((t) => t.status === 'open')).toBe(true);
  });
});
```

### API Integration Tests

```typescript
// __tests__/integration/api/tasks.test.ts
import { createTestServer, createTestSession } from '../helpers/test-server';

describe('Tasks API', () => {
  const server = createTestServer();
  let session: TestSession;

  beforeAll(async () => {
    session = await createTestSession();
  });

  it('creates task via Server Action', async () => {
    const formData = new FormData();
    formData.set('title', 'API Test Task');
    formData.set('priority', 'high');

    const result = await server.action('task:create', formData, session);

    expect(result.success).toBe(true);
    expect(result.task.title).toBe('API Test Task');
  });

  it('rejects unauthorized task creation', async () => {
    const formData = new FormData();
    formData.set('title', 'Unauthorized Task');

    await expect(
      server.action('task:create', formData, null), // No session
    ).rejects.toThrow('Authentication required');
  });

  it('enforces permission checks', async () => {
    const viewerSession = await createTestSession({ permissions: ['task:view'] });

    await expect(server.action('task:create', new FormData(), viewerSession)).rejects.toThrow(
      'Permission denied: task:create',
    );
  });
});
```

---

## 3. End-to-End Tests (Playwright)

### Critical User Journeys

```typescript
// e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'admin@test.com');
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', 'wrong@test.com');
    await page.fill('[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toHaveURL('/login'); // Stay on login
  });
});
```

```typescript
// e2e/tasks/kanban.spec.ts
test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks/board');
    await expect(page.locator('[data-testid="kanban-board"]')).toBeVisible();
  });

  test('displays task columns with correct counts', async ({ page }) => {
    const columns = page.locator('[data-testid="kanban-column"]');
    await expect(columns).toHaveCount(4); // To Do, In Progress, Review, Done

    // Each column shows task count
    const counts = await columns.locator('[data-testid="column-count"]').allTextContents();
    counts.forEach((count) => {
      expect(Number(count)).toBeGreaterThanOrEqual(0);
    });
  });

  test('moves task between columns via drag and drop', async ({ page }) => {
    const firstCard = page.locator('[data-testid="task-card"]').first();
    const targetColumn = page.locator('[data-testid="kanban-column"]').nth(2);

    await firstCard.dragTo(targetColumn);

    // Task should now be in the target column
    await expect(targetColumn.locator('[data-testid="task-card"]')).toBeVisible();

    // Status should have been updated
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
  });

  test('creates new task from column button', async ({ page }) => {
    await page.locator('[data-testid="add-task-button"]').first().click();
    await expect(page.locator('[data-testid="create-task-dialog"]')).toBeVisible();

    await page.fill('[name="title"]', 'E2E Test Task');
    await page.click('[data-testid="submit-task"]');

    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });
});
```

```typescript
// e2e/reports/eod.spec.ts
test.describe('End-of-Day Reports', () => {
  test('generates and displays EOD report', async ({ page }) => {
    await page.goto('/reports/eod');
    await page.click('[data-testid="generate-eod"]');

    await expect(page.locator('[data-testid="eod-report"]')).toBeVisible();
    await expect(page.locator('[data-testid="eod-tasks-completed"]')).toBeVisible();
    await expect(page.locator('[data-testid="eod-hours-worked"]')).toBeVisible();
    await expect(page.locator('[data-testid="eod-productivity-score"]')).toBeVisible();

    // Verify AI summary is generated
    await expect(page.locator('[data-testid="ai-summary"]')).toBeVisible();
  });

  test('exports EOD report as PDF', async ({ page }) => {
    await page.goto('/reports/eod');
    await page.click('[data-testid="export-pdf"]');

    // Verify download started
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('eod-report');
  });
});
```

---

## 4. Security Testing

```typescript
// security/permissions.spec.ts
test.describe('Permission Testing', () => {
  test('user cannot view tasks from other organizations', async ({ request }) => {
    const response = await request.get('/api/v1/tasks', {
      headers: { Cookie: `session=${otherOrgSession}` },
    });
    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(403);
  });

  test('viewer cannot delete tasks', async ({ request }) => {
    const response = await request.delete(`/api/v1/tasks/${taskId}`, {
      headers: { Cookie: `session=${viewerSession}` },
    });
    expect(response.status()).toBe(403);
  });

  test('SQL injection is prevented', async ({ page }) => {
    await page.goto(`/tasks?search=' OR 1=1--`);
    // Should return no results or safe results, not all tasks
    const taskCount = await page.locator('[data-testid="task-card"]').count();
    expect(taskCount).toBeLessThanOrEqual(10); // No data leak
  });
});
```

---

## 5. Performance Testing (k6)

```javascript
// k6/task-list-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100
    { duration: '2m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95) < 500'], // 95% of requests under 500ms
    http_req_failed: ['rate < 0.01'], // Less than 1% failure rate
  },
};

export default function () {
  const res = http.get('http://localhost:3000/api/v1/tasks?limit=50');
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## 6. Test Data Factory

```typescript
// __tests__/helpers/test-factory.ts
export class TestFactory {
  private orgId: string;

  async createOrganization(name = 'Test Org'): Promise<Organization> {
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        slug: slugify(name),
      })
      .returning();
    this.orgId = org.id;
    return org;
  }

  async createUser(overrides = {}): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        organizationId: this.orgId,
        email: `user-${nanoid()}@test.com`,
        firstName: 'Test',
        lastName: 'User',
        ...overrides,
      })
      .returning();
    return user;
  }

  async createTask(overrides = {}): Promise<Task> {
    return await db
      .insert(tasks)
      .values({
        organizationId: this.orgId,
        title: 'Test Task',
        createdBy: this.userId,
        status: 'draft',
        ...overrides,
      })
      .returning();
  }

  async createBulkTasks(count: number): Promise<Task[]> {
    const batch = Array.from({ length: count }, (_, i) => ({
      organizationId: this.orgId,
      title: `Bulk Task ${i + 1}`,
      createdBy: this.userId,
      status: faker.helpers.arrayElement(['open', 'in_progress', 'completed']),
    }));
    return await db.insert(tasks).values(batch).returning();
  }
}
```

---

## 7. Test Execution Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./__tests__/setup.ts'],
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['apps/web/src/**/*.ts', 'packages/**/*.ts'],
      exclude: ['**/*.test.ts', '**/types.ts'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    testTimeout: 10000,
    hookTimeout: 15000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/web/src'),
    },
  },
});
```

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['json', { outputFile: 'playwright-report/results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 7'] } },
    { name: 'Mobile Safari', use: { ...devices['iPhone 15'] } },
  ],
});
```

---

## Test Commands

```bash
# Unit & Integration tests
pnpm test                    # Run all unit/integration tests
pnpm test:watch              # Watch mode
pnpm test:coverage           # With coverage report
pnpm test:ui                 # Vitest UI mode

# E2E tests
pnpm test:e2e                # Run all e2e tests
pnpm test:e2e:ui             # Playwright UI mode
pnpm test:e2e:debug          # Debug mode (slow mo)

# Security tests
pnpm test:security           # Permission & auth tests

# Performance tests
pnpm test:load               # k6 load tests

# All tests
pnpm test:all                # Run all test suites
```

---

## CI Integration

```yaml
# Quality gates in order:
1. pnpm lint              # Static analysis (no warnings)
2. pnpm typecheck         # TypeScript strict (no errors)
3. pnpm test              # Unit + Integration (80% coverage min)
4. pnpm build             # Build succeeds
5. pnpm test:e2e          # Critical user journeys pass
6. pnpm audit             # No high/critical vulnerabilities
```

Each step blocks the next. A failure at any gate prevents deployment.
