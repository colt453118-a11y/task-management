import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb, schema } from '../index';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { eq, and, inArray, isNull, sql } from 'drizzle-orm';
import path from 'path';
import crypto from 'crypto';

// ─── Conditional Execution ────────────────────────────────────
// Only run if a real Postgres connection is available (CI or local dev with DB)
const HAS_DB = !!process.env.DATABASE_URL;

// ─── Test Helpers ─────────────────────────────────────────────

function uniqueId(): string {
  return crypto.randomUUID();
}

function uniqueEmail(): string {
  return `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function expectOne<T>(promise: Promise<T[]>): Promise<T> {
  const rows = await promise;
  expect(rows.length).toBe(1);
  return rows[0]!;
}

// ─── Schema Setup ─────────────────────────────────────────────

let _migrated = false;

async function ensureSchema() {
  if (_migrated) return;
  const db = getDb();
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');
  await migrate(db, { migrationsFolder });
  _migrated = true;
}

// ─── Test Data IDs ────────────────────────────────────────────

const TEST_ORG_SLUG = `test-org-${Date.now()}`;
let orgId: string;
let userId: string;
let userId2: string;
let deptId: string;
let teamId: string;
let roleId: string;
let permId: string;
let projectId: string;
let taskId: string;

// ═══════════════════════════════════════════════════════════════
//  INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════

describe('Database Integration Tests', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    if (!HAS_DB) return;
    await ensureSchema();
  });

  // ─── HEALTH CHECK ─────────────────────────────────────────

  describe('database connection', () => {
    it.runIf(HAS_DB)('can connect and run a query', async () => {
      const db = getDb();
      const [result] = await db.execute(sql`SELECT 1 as value`);
      expect(result).toBeDefined();
    });

    it.runIf(HAS_DB)('has the expected tables', async () => {
      const db = getDb();
      const result = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      const names = Array.from(result).map(
        (r: Record<string, unknown>) => r.table_name,
      ) as string[];
      expect(names).toContain('organizations');
      expect(names).toContain('users');
      expect(names).toContain('departments');
      expect(names).toContain('teams');
      expect(names).toContain('projects');
      expect(names).toContain('tasks');
      expect(names).toContain('roles');
      expect(names).toContain('permissions');
      expect(names).toContain('audit_logs');
      expect(names).toContain('accounts');
      expect(names).toContain('sessions');
    });
  });

  // ─── ORGANIZATIONS CRUD ───────────────────────────────────

  describe('Organizations CRUD', () => {
    it.runIf(HAS_DB)('creates an organization', async () => {
      const db = getDb();
      const org = await expectOne(
        db
          .insert(schema.organizations)
          .values({ name: 'Test Organization', slug: TEST_ORG_SLUG, isActive: true })
          .returning(),
      );
      expect(org.name).toBe('Test Organization');
      expect(org.slug).toBe(TEST_ORG_SLUG);
      expect(org.isActive).toBe(true);
      expect(org.id).toBeDefined();
      expect(org.createdAt).toBeInstanceOf(Date);
      expect(org.updatedAt).toBeInstanceOf(Date);
      expect(org.settings).toEqual({});
      expect(org.metadata).toEqual({});
      orgId = org.id;
    });

    it.runIf(HAS_DB)('queries organization by slug', async () => {
      const db = getDb();
      const org = await expectOne(
        db
          .select()
          .from(schema.organizations)
          .where(eq(schema.organizations.slug, TEST_ORG_SLUG))
          .limit(1),
      );
      expect(org.id).toBe(orgId);
    });

    it.runIf(HAS_DB)('rejects duplicate slug', async () => {
      const db = getDb();
      await expect(
        db
          .insert(schema.organizations)
          .values({ name: 'Another Org', slug: TEST_ORG_SLUG, isActive: true })
          .returning(),
      ).rejects.toThrow();
    });

    it.runIf(HAS_DB)('updates an organization', async () => {
      const db = getDb();
      const updated = await expectOne(
        db
          .update(schema.organizations)
          .set({ name: 'Updated Org', domain: 'example.com' })
          .where(eq(schema.organizations.id, orgId))
          .returning(),
      );
      expect(updated.name).toBe('Updated Org');
      expect(updated.domain).toBe('example.com');
    });

    it.runIf(HAS_DB)('soft-deletes an organization', async () => {
      const db = getDb();
      await db
        .update(schema.organizations)
        .set({ deletedAt: new Date() })
        .where(eq(schema.organizations.id, orgId));

      // Query should not find it with deletedAt IS NULL
      const active = await db
        .select()
        .from(schema.organizations)
        .where(and(eq(schema.organizations.id, orgId), isNull(schema.organizations.deletedAt)))
        .limit(1);
      expect(active.length).toBe(0);

      // Restore for subsequent tests
      await db
        .update(schema.organizations)
        .set({ deletedAt: null })
        .where(eq(schema.organizations.id, orgId));
    });
  });

  // ─── USERS CRUD ───────────────────────────────────────────

  describe('Users CRUD', () => {
    it.runIf(HAS_DB)('creates a user with text ID (Better Auth pattern)', async () => {
      const db = getDb();
      const uid = uniqueId();
      const user = await expectOne(
        db
          .insert(schema.users)
          .values({
            id: uid,
            email: uniqueEmail(),
            name: 'Test User',
            organizationId: orgId,
            isActive: true,
            employmentStatus: 'active',
          })
          .returning(),
      );
      expect(user.id).toBe(uid);
      expect(user.name).toBe('Test User');
      expect(user.organizationId).toBe(orgId);
      expect(user.isActive).toBe(true);
      expect(user.preferences).toEqual({});
      expect(user.metadata).toEqual({});
      userId = user.id;
    });

    it.runIf(HAS_DB)('creates a second user for relationship tests', async () => {
      const db = getDb();
      const uid = uniqueId();
      const user = await expectOne(
        db
          .insert(schema.users)
          .values({ id: uid, email: uniqueEmail(), name: 'User Two', organizationId: orgId, isActive: true })
          .returning(),
      );
      userId2 = user.id;
    });

    it.runIf(HAS_DB)('rejects duplicate email', async () => {
      const db = getDb();
      const email = uniqueEmail();
      await db.insert(schema.users).values({ id: uniqueId(), email, name: 'First' }).returning();
      await expect(
        db.insert(schema.users).values({ id: uniqueId(), email, name: 'Duplicate' }).returning(),
      ).rejects.toThrow();
    });

    it.runIf(HAS_DB)('updates user preferences via jsonb', async () => {
      const db = getDb();
      const prefs = { notifications: { email: true, inApp: false } };
      await db
        .update(schema.users)
        .set({ preferences: prefs as Record<string, unknown> })
        .where(eq(schema.users.id, userId));

      const updated = await expectOne(
        db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1),
      );
      expect(updated.preferences).toEqual(prefs);
    });
  });

  // ─── DEPARTMENTS & TEAMS ──────────────────────────────────

  describe('Departments & Teams', () => {
    it.runIf(HAS_DB)('creates a department', async () => {
      const db = getDb();
      const dept = await expectOne(
        db
          .insert(schema.departments)
          .values({
            organizationId: orgId,
            name: 'Engineering',
            code: 'ENG',
            isActive: true,
            createdBy: userId,
          })
          .returning(),
      );
      expect(dept.name).toBe('Engineering');
      expect(dept.organizationId).toBe(orgId);
      deptId = dept.id;
    });

    it.runIf(HAS_DB)('rejects duplicate department name in same org', async () => {
      const db = getDb();
      await expect(
        db
          .insert(schema.departments)
          .values({ organizationId: orgId, name: 'Engineering', isActive: true })
          .returning(),
      ).rejects.toThrow();
    });

    it.runIf(HAS_DB)('creates a team under the department', async () => {
      const db = getDb();
      const team = await expectOne(
        db
          .insert(schema.teams)
          .values({
            organizationId: orgId,
            departmentId: deptId,
            name: 'Core Platform',
            code: 'CORE',
            isActive: true,
            createdBy: userId,
          })
          .returning(),
      );
      expect(team.name).toBe('Core Platform');
      expect(team.departmentId).toBe(deptId);
      teamId = team.id;
    });

    it.runIf(HAS_DB)('adds user to team via team_members', async () => {
      const db = getDb();
      const member = await expectOne(
        db
          .insert(schema.teamMembers)
          .values({ teamId, userId, role: 'lead' })
          .returning(),
      );
      expect(member.teamId).toBe(teamId);
      expect(member.userId).toBe(userId);
      expect(member.role).toBe('lead');
    });

    it.runIf(HAS_DB)('rejects duplicate team membership', async () => {
      const db = getDb();
      await expect(
        db.insert(schema.teamMembers).values({ teamId, userId }).returning(),
      ).rejects.toThrow();
    });
  });

  // ─── ROLES & PERMISSIONS (M:N) ────────────────────────────

  describe('Roles & Permissions', () => {
    it.runIf(HAS_DB)('creates a permission', async () => {
      const db = getDb();
      const perm = await expectOne(
        db
          .insert(schema.permissions)
          .values({ code: `test:${Date.now()}`, name: 'Test Permission', module: 'test' })
          .returning(),
      );
      permId = perm.id;
    });

    it.runIf(HAS_DB)('rejects duplicate permission code', async () => {
      const db = getDb();
      const code = `unique:${Date.now()}`;
      await db.insert(schema.permissions).values({ code, name: 'First', module: 'test' }).returning();
      await expect(
        db.insert(schema.permissions).values({ code, name: 'Second', module: 'test' }).returning(),
      ).rejects.toThrow();
    });

    it.runIf(HAS_DB)('creates a role', async () => {
      const db = getDb();
      const role = await expectOne(
        db
          .insert(schema.roles)
          .values({
            organizationId: orgId,
            name: 'Test Role',
            slug: `test-role-${Date.now()}`,
            isActive: true,
          })
          .returning(),
      );
      roleId = role.id;
    });

    it.runIf(HAS_DB)('assigns permission to role via role_permissions', async () => {
      const db = getDb();
      const rp = await expectOne(
        db
          .insert(schema.rolePermissions)
          .values({ roleId, permissionId: permId, allow: true })
          .returning(),
      );
      expect(rp.roleId).toBe(roleId);
      expect(rp.permissionId).toBe(permId);
    });

    it.runIf(HAS_DB)('rejects duplicate role-permission', async () => {
      const db = getDb();
      await expect(
        db.insert(schema.rolePermissions).values({ roleId, permissionId: permId }).returning(),
      ).rejects.toThrow();
    });

    it.runIf(HAS_DB)('assigns user to role via user_roles', async () => {
      const db = getDb();
      const ur = await expectOne(
        db
          .insert(schema.userRoles)
          .values({ userId, roleId, assignedBy: userId })
          .returning(),
      );
      expect(ur.userId).toBe(userId);
      expect(ur.roleId).toBe(roleId);
    });

    it.runIf(HAS_DB)('rejects duplicate user-role assignment', async () => {
      const db = getDb();
      await expect(
        db.insert(schema.userRoles).values({ userId, roleId }).returning(),
      ).rejects.toThrow();
    });
  });

  // ─── PROJECTS & MILESTONES ────────────────────────────────

  describe('Projects & Milestones', () => {
    it.runIf(HAS_DB)('creates a project', async () => {
      const db = getDb();
      const proj = await expectOne(
        db
          .insert(schema.projects)
          .values({
            organizationId: orgId,
            name: 'Test Project',
            ownerId: userId,
            createdBy: userId,
            isActive: true,
          })
          .returning(),
      );
      expect(proj.name).toBe('Test Project');
      expect(proj.organizationId).toBe(orgId);
      expect(proj.status).toBe('active');
      projectId = proj.id;
    });

    it.runIf(HAS_DB)('creates a milestone under the project', async () => {
      const db = getDb();
      const ms = await expectOne(
        db
          .insert(schema.milestones)
          .values({ projectId, name: 'Phase 1', status: 'pending' })
          .returning(),
      );
      expect(ms.name).toBe('Phase 1');
      expect(ms.projectId).toBe(projectId);
      // milestone stored as 'ms', no top-level reference needed
    });

    it.runIf(HAS_DB)('can query project with its milestone via join', async () => {
      const db = getDb();
      const rows = await db
        .select({
          projectId: schema.projects.id,
          projectName: schema.projects.name,
          milestoneName: schema.milestones.name,
        })
        .from(schema.projects)
        .innerJoin(schema.milestones, eq(schema.milestones.projectId, schema.projects.id))
        .where(eq(schema.projects.id, projectId));
      expect(rows.length).toBe(1);
      expect(rows[0]!.projectName).toBe('Test Project');
      expect(rows[0]!.milestoneName).toBe('Phase 1');
    });
  });

  // ─── TASKS CRUD ───────────────────────────────────────────

  describe('Tasks CRUD', () => {
    it.runIf(HAS_DB)('creates a task', async () => {
      const db = getDb();
      const task = await expectOne(
        db
          .insert(schema.tasks)
          .values({
            organizationId: orgId,
            title: 'My Test Task',
            taskIdDisplay: `TASK-${Date.now()}`,
            status: 'todo',
            createdBy: userId,
            assignedTo: userId,
            projectId,
          })
          .returning(),
      );
      expect(task.title).toBe('My Test Task');
      expect(task.status).toBe('todo');
      expect(task.assignedTo).toBe(userId);
      expect(task.projectId).toBe(projectId);
      taskId = task.id;
    });

    it.runIf(HAS_DB)('creates a comment on the task', async () => {
      const db = getDb();
      const comment = await expectOne(
        db
          .insert(schema.taskComments)
          .values({ taskId, userId, content: 'This is a comment' })
          .returning(),
      );
      expect(comment.content).toBe('This is a comment');
      expect(comment.taskId).toBe(taskId);
      expect(comment.isInternalNote).toBe(false);
    });

    it.runIf(HAS_DB)('creates a task history entry', async () => {
      const db = getDb();
      const entry = await expectOne(
        db
          .insert(schema.taskHistory)
          .values({
            taskId,
            userId,
            field: 'status',
            oldValue: 'todo',
            newValue: 'in_progress',
            changeType: 'status_change',
            description: 'Status changed from todo to in_progress',
          })
          .returning(),
      );
      expect(entry.field).toBe('status');
      expect(entry.changeType).toBe('status_change');
    });

    it.runIf(HAS_DB)('creates checklist items', async () => {
      const db = getDb();
      const item1 = await expectOne(
        db
          .insert(schema.taskChecklistItems)
          .values({ taskId, content: 'Check item 1', sortOrder: 1 })
          .returning(),
      );
      expect(item1.content).toBe('Check item 1');

      const item2 = await expectOne(
        db
          .insert(schema.taskChecklistItems)
          .values({ taskId, content: 'Check item 2', isChecked: true, sortOrder: 2 })
          .returning(),
      );
      expect(item2.isChecked).toBe(true);
    });

    it.runIf(HAS_DB)('creates a task dependency', async () => {
      const db = getDb();
      // Need a second task to depend on
      const depTask = await expectOne(
        db
          .insert(schema.tasks)
          .values({
            organizationId: orgId,
            title: 'Dependency Task',
            taskIdDisplay: `TASK-DEP-${Date.now()}`,
            status: 'completed',
            createdBy: userId,
          })
          .returning(),
      );
      const dep = await expectOne(
        db
          .insert(schema.taskDependencies)
          .values({ taskId, dependsOnTaskId: depTask.id, dependencyType: 'blocks' })
          .returning(),
      );
      expect(dep.taskId).toBe(taskId);
      expect(dep.dependsOnTaskId).toBe(depTask.id);
    });

    it.runIf(HAS_DB)('creates a time entry', async () => {
      const db = getDb();
      const entry = await expectOne(
        db
          .insert(schema.timeEntries)
          .values({
            taskId,
            userId,
            startTime: new Date('2024-01-01T09:00:00Z'),
            endTime: new Date('2024-01-01T10:30:00Z'),
            durationMinutes: 90,
            entryType: 'manual',
          })
          .returning(),
      );
      expect(entry.durationMinutes).toBe(90);
      expect(entry.taskId).toBe(taskId);
    });

    it.runIf(HAS_DB)('adds a task watcher', async () => {
      const db = getDb();
      const watcher = await expectOne(
        db
          .insert(schema.taskWatchers)
          .values({ taskId, userId: userId2, watchType: 'watching' })
          .returning(),
      );
      expect(watcher.userId).toBe(userId2);
    });

    it.runIf(HAS_DB)('updates task status', async () => {
      const db = getDb();
      const updated = await expectOne(
        db
          .update(schema.tasks)
          .set({ status: 'in_progress', updatedBy: userId, updatedAt: new Date() })
          .where(eq(schema.tasks.id, taskId))
          .returning(),
      );
      expect(updated.status).toBe('in_progress');
    });

    it.runIf(HAS_DB)('can query task with its relationships via join', async () => {
      const db = getDb();
      const rows = await db
        .select({
          taskTitle: schema.tasks.title,
          assigneeName: schema.users.name,
          projectName: schema.projects.name,
          commentCount: sql<number>`count(distinct ${schema.taskComments.id})`,
        })
        .from(schema.tasks)
        .leftJoin(schema.users, eq(schema.users.id, schema.tasks.assignedTo!))
        .leftJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId!))
        .leftJoin(schema.taskComments, eq(schema.taskComments.taskId, schema.tasks.id))
        .where(eq(schema.tasks.id, taskId))
        .groupBy(schema.tasks.title, schema.users.name, schema.projects.name)
        .limit(1);
      expect(rows.length).toBe(1);
      expect(rows[0]!.taskTitle).toBe('My Test Task');
      expect(rows[0]!.assigneeName).toBe('Test User');
      expect(rows[0]!.projectName).toBe('Test Project');
      expect(Number(rows[0]!.commentCount)).toBe(1);
    });
  });

  // ─── AUDIT LOGS ───────────────────────────────────────────

  describe('Audit Logs', () => {
    it.runIf(HAS_DB)('creates an audit log entry', async () => {
      const db = getDb();
      const entry = await expectOne(
        db
          .insert(schema.auditLogs)
          .values({
            organizationId: orgId,
            userId,
            action: 'task.created',
            entityType: 'task',
            entityId: taskId,
            newValues: { title: 'My Test Task' } as Record<string, unknown>,
          })
          .returning(),
      );
      expect(entry.action).toBe('task.created');
      expect(entry.newValues).toEqual({ title: 'My Test Task' });
    });
  });

  // ─── AUTH TABLES ──────────────────────────────────────────

  describe('Auth Tables', () => {
    it.runIf(HAS_DB)('creates a session', async () => {
      const db = getDb();
      const session = await expectOne(
        db
          .insert(schema.sessions)
          .values({
            id: uniqueId(),
            token: `sess_${crypto.randomBytes(16).toString('hex')}`,
            userId,
            expiresAt: new Date(Date.now() + 86400_000),
          })
          .returning(),
      );
      expect(session.userId).toBe(userId);
    });

    it.runIf(HAS_DB)('creates an account', async () => {
      const db = getDb();
      const account = await expectOne(
        db
          .insert(schema.accounts)
          .values({
            id: uniqueId(),
            userId,
            accountId: userId,
            providerId: 'email',
          })
          .returning(),
      );
      expect(account.providerId).toBe('email');
    });

    it.runIf(HAS_DB)('creates a verification token', async () => {
      const db = getDb();
      const vt = await expectOne(
        db
          .insert(schema.verificationTokens)
          .values({
            id: uniqueId(),
            identifier: uniqueEmail(),
            token: crypto.randomBytes(32).toString('hex'),
            expiresAt: new Date(Date.now() + 3600_000),
          })
          .returning(),
      );
      expect(vt.identifier).toBeDefined();
    });
  });

  // ─── LOGIN HISTORY ────────────────────────────────────────

  describe('Login History', () => {
    it.runIf(HAS_DB)('logs a login attempt', async () => {
      const db = getDb();
      const log = await expectOne(
        db
          .insert(schema.loginHistory)
          .values({
            userId,
            ipAddress: '127.0.0.1',
            success: true,
            loginMethod: 'email',
          })
          .returning(),
      );
      expect(log.success).toBe(true);
      expect(log.userId).toBe(userId);
    });
  });

  // ─── CASCADE DELETES ──────────────────────────────────────

  describe('Cascade Deletes', () => {
    it.runIf(HAS_DB)('cascades role_permissions when role is deleted', async () => {
      const db = getDb();
      const tempRole = await expectOne(
        db
          .insert(schema.roles)
          .values({
            organizationId: orgId,
            name: 'Cascade Test Role',
            slug: `cascade-role-${Date.now()}`,
          })
          .returning(),
      );
      await db.insert(schema.rolePermissions).values({ roleId: tempRole.id, permissionId: permId });

      // Delete the role (cascades to role_permissions)
      await db.delete(schema.roles).where(eq(schema.roles.id, tempRole.id));
      const rps = await db
        .select()
        .from(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, tempRole.id));
      expect(rps.length).toBe(0);
    });

    it.runIf(HAS_DB)('cascades user_roles when user is deleted', async () => {
      const db = getDb();
      const tempUser = await expectOne(
        db
          .insert(schema.users)
          .values({ id: uniqueId(), email: uniqueEmail(), name: 'Cascade User', organizationId: orgId })
          .returning(),
      );
      await db.insert(schema.userRoles).values({ userId: tempUser.id, roleId });

      // Delete the user (cascades to user_roles)
      await db.delete(schema.users).where(eq(schema.users.id, tempUser.id));
      const urs = await db
        .select()
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, tempUser.id));
      expect(urs.length).toBe(0);
    });

    it.runIf(HAS_DB)('cascades tasks when project is deleted', async () => {
      const db = getDb();
      // Create a temp project and task that cascade
      const tempProj = await expectOne(
        db
          .insert(schema.projects)
          .values({ organizationId: orgId, name: 'Cascade Project', ownerId: userId, createdBy: userId })
          .returning(),
      );
      const tempTask = await expectOne(
        db
          .insert(schema.tasks)
          .values({
            organizationId: orgId,
            title: 'Cascade Task',
            taskIdDisplay: `CASCADE-${Date.now()}`,
            status: 'todo',
            createdBy: userId,
            projectId: tempProj.id,
          })
          .returning(),
      );
      // Also add some sub-entities
      await db.insert(schema.taskComments).values({ taskId: tempTask.id, userId, content: 'Will cascade' });

      // Delete the project (cascades to tasks, then to comments)
      await db.delete(schema.projects).where(eq(schema.projects.id, tempProj.id));
      const tasks = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, tempTask.id));
      expect(tasks.length).toBe(0); // Task was also deleted
    });

    it.runIf(HAS_DB)('cascades sessions when user is deleted', async () => {
      const db = getDb();
      const tempUser = await expectOne(
        db
          .insert(schema.users)
          .values({ id: uniqueId(), email: uniqueEmail(), name: 'Sess Cascade', organizationId: orgId })
          .returning(),
      );
      await db.insert(schema.sessions).values({
        id: uniqueId(),
        token: `sess_${crypto.randomBytes(16).toString('hex')}`,
        userId: tempUser.id,
        expiresAt: new Date(Date.now() + 86400_000),
      });

      // Delete the user (cascades to sessions)
      await db.delete(schema.users).where(eq(schema.users.id, tempUser.id));
      const sessions = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.userId, tempUser.id));
      expect(sessions.length).toBe(0);
    });
  });

  // ─── SOFT DELETES ─────────────────────────────────────────

  describe('Soft Deletes', () => {
    it.runIf(HAS_DB)('soft-deletes a task and excludes it from queries', async () => {
      const db = getDb();
      const softTask = await expectOne(
        db
          .insert(schema.tasks)
          .values({
            organizationId: orgId,
            title: 'Soft Delete Task',
            taskIdDisplay: `SOFT-${Date.now()}`,
            status: 'todo',
            createdBy: userId,
          })
          .returning(),
      );

      // Soft delete
      await db
        .update(schema.tasks)
        .set({ deletedAt: new Date() })
        .where(eq(schema.tasks.id, softTask.id));

      // Excluded from active queries
      const active = await db
        .select()
        .from(schema.tasks)
        .where(and(eq(schema.tasks.id, softTask.id), isNull(schema.tasks.deletedAt)))
        .limit(1);
      expect(active.length).toBe(0);

      // Still visible to admin queries
      const all = await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.id, softTask.id))
        .limit(1);
      expect(all.length).toBe(1);
      expect(all[0]!.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ─── REPORT SNAPSHOTS ─────────────────────────────────────

  describe('Report Snapshots', () => {
    it.runIf(HAS_DB)('creates an immutable report snapshot', async () => {
      const db = getDb();
      const snapData = {
        tasks: { total: 5, byStatus: { todo: 3, completed: 2 }, overdue: 0, completedThisPeriod: 2, createdThisPeriod: 5, completionRate: 40 },
        projects: { total: 1, active: 1, byStatus: { active: 1 } },
        users: { total: 2, active: 2 },
        teams: { total: 1 },
      } as Record<string, unknown>;
      const snap = await expectOne(
        db
          .insert(schema.reportSnapshots)
          .values({
            organizationId: orgId,
            snapshotDate: '2024-01-15',
            snapshotType: 'eod',
            snapshotData: snapData,
            summary: { taskCount: 5 } as Record<string, unknown>,
            generatedBy: userId,
          })
          .returning(),
      );
      expect(snap.snapshotType).toBe('eod');
      expect(snap.snapshotData).toEqual(snapData);
    });
  });

  // ─── CLEANUP ──────────────────────────────────────────────

  afterAll(async () => {
    if (!HAS_DB || !orgId) return;
    const db = getDb();

    // Delete in reverse dependency order to respect FK constraints
    await db.delete(schema.reportSnapshots).where(eq(schema.reportSnapshots.organizationId, orgId));
    await db.delete(schema.loginHistory).where(eq(schema.loginHistory.userId, userId));
    await db.delete(schema.verificationTokens);
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, userId));
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    await db.delete(schema.timeEntries).where(eq(schema.timeEntries.taskId, taskId));
    await db.delete(schema.taskWatchers).where(eq(schema.taskWatchers.taskId, taskId));
    await db.delete(schema.taskDependencies).where(eq(schema.taskDependencies.taskId, taskId));
    await db.delete(schema.taskChecklistItems).where(eq(schema.taskChecklistItems.taskId, taskId));
    await db.delete(schema.taskHistory).where(eq(schema.taskHistory.taskId, taskId));
    await db.delete(schema.taskComments).where(eq(schema.taskComments.taskId, taskId));
    await db.delete(schema.taskAttachments).where(eq(schema.taskAttachments.taskId, taskId));
    await db.delete(schema.taskAssignees).where(eq(schema.taskAssignees.taskId, taskId));
    await db.delete(schema.tasks).where(eq(schema.tasks.organizationId, orgId));
    await db.delete(schema.milestones).where(eq(schema.milestones.projectId, projectId));
    await db.delete(schema.projects).where(eq(schema.projects.organizationId, orgId));
    await db.delete(schema.userRoles).where(eq(schema.userRoles.userId, userId));
    await db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.roleId, roleId));
    await db.delete(schema.roles).where(eq(schema.roles.organizationId, orgId));
    await db.delete(schema.teamMembers).where(eq(schema.teamMembers.teamId, teamId));
    await db.delete(schema.teams).where(eq(schema.teams.organizationId, orgId));
    await db.delete(schema.departments).where(eq(schema.departments.organizationId, orgId));
    await db.delete(schema.users).where(inArray(schema.users.id, [userId, userId2]));
    await db.delete(schema.organizations).where(eq(schema.organizations.id, orgId));
  });
});
