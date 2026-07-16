# Role-Permission Matrix — Enterprise Work Management Platform

## Permission Philosophy

- **Granular, not monolithic** — Every action has its own permission code
- **Composable** — Permissions combine to form roles, but can be individually assigned
- **Auditable** — Every permission check is logged
- **Extensible** — New permissions can be added without schema changes

---

## Permission Codes

### Permission Format: `module:action`

| Module          | Actions                                                              |
| --------------- | -------------------------------------------------------------------- |
| `org`           | view, edit, settings                                                 |
| `user`          | view, create, edit, delete, manage, invite, import, export           |
| `role`          | view, create, edit, delete, assign                                   |
| `department`    | view, create, edit, delete, manage                                   |
| `team`          | view, create, edit, delete, manage                                   |
| `project`       | view, create, edit, delete, manage, archive                          |
| `milestone`     | view, create, edit, delete, complete                                 |
| `task`          | view, create, edit, delete, assign, approve, close, reopen, view_all |
| `task_template` | view, create, edit, delete                                           |
| `workflow`      | view, create, edit, delete                                           |
| `automation`    | view, create, edit, delete                                           |
| `report`        | view, create, edit, delete, schedule, export                         |
| `analytics`     | view                                                                 |
| `calendar`      | view, create, edit, delete                                           |
| `notification`  | view, manage                                                         |
| `file`          | view, upload, delete                                                 |
| `integration`   | view, create, edit, delete                                           |
| `settings`      | view, edit, security, billing                                        |
| `audit`         | view, export                                                         |

---

## Complete Permission List

```typescript
// Permissions that will be seeded into the database
export const PERMISSIONS = [
  // Organization
  { code: 'org:view', name: 'View Organization', module: 'org' },
  { code: 'org:edit', name: 'Edit Organization', module: 'org' },
  { code: 'org:settings', name: 'Manage Organization Settings', module: 'org' },

  // Users
  { code: 'user:view', name: 'View Users', module: 'user' },
  { code: 'user:create', name: 'Create Users', module: 'user' },
  { code: 'user:edit', name: 'Edit Users', module: 'user' },
  { code: 'user:delete', name: 'Delete Users', module: 'user' },
  { code: 'user:manage', name: 'Manage Users (suspend, archive, reset)', module: 'user' },
  { code: 'user:invite', name: 'Invite Users', module: 'user' },
  { code: 'user:import', name: 'Import Users', module: 'user' },
  { code: 'user:export', name: 'Export Users', module: 'user' },

  // Roles & Permissions
  { code: 'role:view', name: 'View Roles', module: 'role' },
  { code: 'role:create', name: 'Create Roles', module: 'role' },
  { code: 'role:edit', name: 'Edit Roles', module: 'role' },
  { code: 'role:delete', name: 'Delete Roles', module: 'role' },
  { code: 'role:assign', name: 'Assign Roles to Users', module: 'role' },

  // Departments
  { code: 'department:view', name: 'View Departments', module: 'department' },
  { code: 'department:create', name: 'Create Departments', module: 'department' },
  { code: 'department:edit', name: 'Edit Departments', module: 'department' },
  { code: 'department:delete', name: 'Delete Departments', module: 'department' },
  { code: 'department:manage', name: 'Manage Department Members', module: 'department' },

  // Teams
  { code: 'team:view', name: 'View Teams', module: 'team' },
  { code: 'team:create', name: 'Create Teams', module: 'team' },
  { code: 'team:edit', name: 'Edit Teams', module: 'team' },
  { code: 'team:delete', name: 'Delete Teams', module: 'team' },
  { code: 'team:manage', name: 'Manage Team Members', module: 'team' },

  // Projects
  { code: 'project:view', name: 'View Projects', module: 'project' },
  { code: 'project:create', name: 'Create Projects', module: 'project' },
  { code: 'project:edit', name: 'Edit Projects', module: 'project' },
  { code: 'project:delete', name: 'Delete Projects', module: 'project' },
  { code: 'project:manage', name: 'Manage Projects', module: 'project' },
  { code: 'project:archive', name: 'Archive Projects', module: 'project' },

  // Milestones
  { code: 'milestone:view', name: 'View Milestones', module: 'milestone' },
  { code: 'milestone:create', name: 'Create Milestones', module: 'milestone' },
  { code: 'milestone:edit', name: 'Edit Milestones', module: 'milestone' },
  { code: 'milestone:delete', name: 'Delete Milestones', module: 'milestone' },
  { code: 'milestone:complete', name: 'Complete Milestones', module: 'milestone' },

  // Tasks
  { code: 'task:view', name: 'View Own Tasks', module: 'task' },
  { code: 'task:view_all', name: 'View All Tasks', module: 'task' },
  { code: 'task:create', name: 'Create Tasks', module: 'task' },
  { code: 'task:edit', name: 'Edit Tasks', module: 'task' },
  { code: 'task:delete', name: 'Delete Tasks', module: 'task' },
  { code: 'task:assign', name: 'Assign Tasks to Others', module: 'task' },
  { code: 'task:approve', name: 'Approve Tasks', module: 'task' },
  { code: 'task:close', name: 'Close Tasks', module: 'task' },
  { code: 'task:reopen', name: 'Reopen Closed Tasks', module: 'task' },
  { code: 'task:export', name: 'Export Tasks', module: 'task' },

  // Task Templates
  { code: 'task_template:view', name: 'View Task Templates', module: 'task_template' },
  { code: 'task_template:create', name: 'Create Task Templates', module: 'task_template' },
  { code: 'task_template:edit', name: 'Edit Task Templates', module: 'task_template' },
  { code: 'task_template:delete', name: 'Delete Task Templates', module: 'task_template' },

  // Workflows
  { code: 'workflow:view', name: 'View Workflows', module: 'workflow' },
  { code: 'workflow:create', name: 'Create Workflows', module: 'workflow' },
  { code: 'workflow:edit', name: 'Edit Workflows', module: 'workflow' },
  { code: 'workflow:delete', name: 'Delete Workflows', module: 'workflow' },

  // Automation Rules
  { code: 'automation:view', name: 'View Automation Rules', module: 'automation' },
  { code: 'automation:create', name: 'Create Automation Rules', module: 'automation' },
  { code: 'automation:edit', name: 'Edit Automation Rules', module: 'automation' },
  { code: 'automation:delete', name: 'Delete Automation Rules', module: 'automation' },

  // Reports
  { code: 'report:view', name: 'View Reports', module: 'report' },
  { code: 'report:create', name: 'Create Reports', module: 'report' },
  { code: 'report:edit', name: 'Edit Reports', module: 'report' },
  { code: 'report:delete', name: 'Delete Reports', module: 'report' },
  { code: 'report:schedule', name: 'Schedule Reports', module: 'report' },
  { code: 'report:export', name: 'Export Reports', module: 'report' },

  // Analytics
  { code: 'analytics:view', name: 'View Analytics & Dashboards', module: 'analytics' },

  // Calendar
  { code: 'calendar:view', name: 'View Calendar', module: 'calendar' },
  { code: 'calendar:create', name: 'Create Calendar Events', module: 'calendar' },
  { code: 'calendar:edit', name: 'Edit Calendar Events', module: 'calendar' },
  { code: 'calendar:delete', name: 'Delete Calendar Events', module: 'calendar' },

  // Files
  { code: 'file:view', name: 'View Files', module: 'file' },
  { code: 'file:upload', name: 'Upload Files', module: 'file' },
  { code: 'file:delete', name: 'Delete Files', module: 'file' },

  // Integrations
  { code: 'integration:view', name: 'View Integrations', module: 'integration' },
  { code: 'integration:create', name: 'Create Integrations', module: 'integration' },
  { code: 'integration:edit', name: 'Edit Integrations', module: 'integration' },
  { code: 'integration:delete', name: 'Delete Integrations', module: 'integration' },

  // Settings
  { code: 'settings:view', name: 'View System Settings', module: 'settings' },
  { code: 'settings:edit', name: 'Edit System Settings', module: 'settings' },
  { code: 'settings:security', name: 'Manage Security Settings', module: 'settings' },

  // Audit Logs
  { code: 'audit:view', name: 'View Audit Logs', module: 'audit' },
  { code: 'audit:export', name: 'Export Audit Logs', module: 'audit' },

  // Notifications
  { code: 'notification:view', name: 'View Notifications', module: 'notification' },
  { code: 'notification:manage', name: 'Manage Notification Settings', module: 'notification' },
];
```

---

## Default Role Definitions

### 1. System Admin

```typescript
const ADMIN_ROLE = {
  name: 'System Admin',
  slug: 'admin',
  description: 'Full access to everything. Can manage organization, users, settings.',
  permissions: ALL_PERMISSIONS, // Every permission
};
```

### 2. Project Manager

```typescript
const PROJECT_MANAGER_ROLE = {
  name: 'Project Manager',
  slug: 'project_manager',
  description: 'Manages projects, tasks, teams. Cannot change system settings or manage billing.',
  permissions: [
    'org:view',
    'user:view',
    'department:view',
    'team:view',
    'team:create',
    'team:edit',
    'team:manage',
    'project:*', // All project permissions
    'milestone:*', // All milestone permissions
    'task:*', // All task permissions
    'task_template:*', // All task template permissions
    'workflow:*', // All workflow permissions
    'automation:*', // All automation permissions
    'report:*', // All report permissions
    'analytics:view',
    'calendar:*', // All calendar permissions
    'file:*', // All file permissions
    'notification:*', // All notification permissions
  ],
};
```

### 3. Team Lead

```typescript
const TEAM_LEAD_ROLE = {
  name: 'Team Lead',
  slug: 'team_lead',
  description: "Manages their team's tasks, reviews work, generates reports.",
  permissions: [
    'org:view',
    'user:view',
    'department:view',
    'team:view',
    'project:view',
    'project:create',
    'project:edit',
    'milestone:view',
    'milestone:create',
    'milestone:edit',
    'milestone:complete',
    'task:*', // All task permissions (including assign, approve, close)
    'task_template:view',
    'report:view',
    'report:create',
    'report:export',
    'analytics:view',
    'calendar:*',
    'file:view',
    'file:upload',
    'notification:*',
  ],
};
```

### 4. Team Member

```typescript
const TEAM_MEMBER_ROLE = {
  name: 'Team Member',
  slug: 'team_member',
  description: 'Works on assigned tasks, logs time, collaborates with team.',
  permissions: [
    'org:view',
    'user:view',
    'department:view',
    'team:view',
    'project:view',
    'milestone:view',
    'task:view',
    'task:create',
    'task:edit', // Can create/edit own tasks
    'task_template:view',
    'report:view',
    'analytics:view',
    'calendar:view',
    'calendar:create',
    'calendar:edit',
    'file:view',
    'file:upload',
    'notification:*',
  ],
};
```

### 5. Viewer (Read-Only)

```typescript
const VIEWER_ROLE = {
  name: 'Viewer',
  slug: 'viewer',
  description: 'Read-only access. Can view everything but cannot create or modify anything.',
  permissions: [
    'org:view',
    'user:view',
    'department:view',
    'team:view',
    'project:view',
    'milestone:view',
    'task:view',
    'task_template:view',
    'report:view',
    'analytics:view',
    'calendar:view',
    'notification:view',
  ],
};
```

---

## Permission Assignment Matrix

| Feature            | Admin | Project Manager | Team Lead | Team Member | Viewer |
| ------------------ | ----- | --------------- | --------- | ----------- | ------ |
| **Organization**   |       |                 |           |             |        |
| View org details   | ✅    | ✅              | ✅        | ✅          | ✅     |
| Edit org settings  | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Users**          |       |                 |           |             |        |
| View users         | ✅    | ✅              | ✅        | ✅          | ✅     |
| Create users       | ✅    | ❌              | ❌        | ❌          | ❌     |
| Edit users         | ✅    | ❌              | ❌        | ❌          | ❌     |
| Delete/Deactivate  | ✅    | ❌              | ❌        | ❌          | ❌     |
| Invite users       | ✅    | ❌              | ❌        | ❌          | ❌     |
| Import/Export      | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Roles**          |       |                 |           |             |        |
| Manage roles       | ✅    | ❌              | ❌        | ❌          | ❌     |
| Assign roles       | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Departments**    |       |                 |           |             |        |
| View departments   | ✅    | ✅              | ✅        | ✅          | ✅     |
| Manage departments | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Teams**          |       |                 |           |             |        |
| View teams         | ✅    | ✅              | ✅        | ✅          | ✅     |
| Create/Edit teams  | ✅    | ✅              | ❌        | ❌          | ❌     |
| Manage members     | ✅    | ✅              | ✅ (own)  | ❌          | ❌     |
| **Projects**       |       |                 |           |             |        |
| View projects      | ✅    | ✅              | ✅        | ✅          | ✅     |
| Create projects    | ✅    | ✅              | ✅        | ❌          | ❌     |
| Edit projects      | ✅    | ✅              | ✅        | ❌          | ❌     |
| Delete projects    | ✅    | ✅              | ❌        | ❌          | ❌     |
| Archive projects   | ✅    | ✅              | ❌        | ❌          | ❌     |
| **Tasks**          |       |                 |           |             |        |
| View all tasks     | ✅    | ✅              | ✅        | ✅ (own)    | ✅     |
| Create tasks       | ✅    | ✅              | ✅        | ✅          | ❌     |
| Edit tasks         | ✅    | ✅              | ✅        | ✅ (own)    | ❌     |
| Delete tasks       | ✅    | ✅              | ✅        | ❌          | ❌     |
| Assign tasks       | ✅    | ✅              | ✅        | ❌          | ❌     |
| Approve tasks      | ✅    | ✅              | ✅        | ❌          | ❌     |
| Close tasks        | ✅    | ✅              | ✅        | ✅ (own)    | ❌     |
| Reopen tasks       | ✅    | ✅              | ✅        | ❌          | ❌     |
| Export tasks       | ✅    | ✅              | ✅        | ❌          | ❌     |
| **Workflows**      |       |                 |           |             |        |
| Manage workflows   | ✅    | ✅              | ❌        | ❌          | ❌     |
| **Automation**     |       |                 |           |             |        |
| Manage automation  | ✅    | ✅              | ❌        | ❌          | ❌     |
| **Reports**        |       |                 |           |             |        |
| View reports       | ✅    | ✅              | ✅        | ✅          | ✅     |
| Create reports     | ✅    | ✅              | ✅        | ❌          | ❌     |
| Schedule reports   | ✅    | ✅              | ❌        | ❌          | ❌     |
| Export reports     | ✅    | ✅              | ✅        | ❌          | ❌     |
| **Analytics**      | ✅    | ✅              | ✅        | ✅          | ✅     |
| **Settings**       |       |                 |           |             |        |
| View settings      | ✅    | ❌              | ❌        | ❌          | ❌     |
| Edit settings      | ✅    | ❌              | ❌        | ❌          | ❌     |
| Security settings  | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Audit Logs**     |       |                 |           |             |        |
| View audit logs    | ✅    | ❌              | ❌        | ❌          | ❌     |
| Export audit logs  | ✅    | ❌              | ❌        | ❌          | ❌     |
| **Integrations**   | ✅    | ❌              | ❌        | ❌          | ❌     |

---

## Custom Role Assignment

Any role can be customized. The admin can:

1. **Create a new role** from scratch with specific permissions
2. **Clone an existing role** and modify permissions
3. **Override permissions** for specific users (additional grants or restrictions)
4. **Temporary role assignments** with expiration (e.g., "Project Lead until March 2026")

---

## Permission Check Implementation

```typescript
// lib/auth/permissions.ts
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userRoles, rolePermissions, permissions } from '@/lib/db/schema';

export async function hasPermission(userId: string, permissionCode: string): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(permissions.code, permissionCode),
        eq(rolePermissions.allow, true),
      ),
    );

  return result[0].count > 0;
}

// Middleware-friendly version
export function requirePermission(permissionCode: string) {
  return async () => {
    const session = await getServerSession();
    if (!session) throw new AuthError('Not authenticated');

    const hasPerm = await hasPermission(session.userId, permissionCode);
    if (!hasPerm) {
      throw new PermissionError(`Missing permission: ${permissionCode}`);
    }
  };
}
```
