// ─── Permission Codes ────────────────────────────────────────
// Format: module:action

export const PERMISSIONS = {
  // Organization
  ORG_VIEW: 'org:view',
  ORG_EDIT: 'org:edit',
  ORG_SETTINGS: 'org:settings',

  // Users
  USER_VIEW: 'user:view',
  USER_CREATE: 'user:create',
  USER_EDIT: 'user:edit',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  USER_INVITE: 'user:invite',
  USER_IMPORT: 'user:import',
  USER_EXPORT: 'user:export',

  // Roles
  ROLE_VIEW: 'role:view',
  ROLE_CREATE: 'role:create',
  ROLE_EDIT: 'role:edit',
  ROLE_DELETE: 'role:delete',
  ROLE_ASSIGN: 'role:assign',

  // Departments
  DEPARTMENT_VIEW: 'department:view',
  DEPARTMENT_CREATE: 'department:create',
  DEPARTMENT_EDIT: 'department:edit',
  DEPARTMENT_DELETE: 'department:delete',
  DEPARTMENT_MANAGE: 'department:manage',

  // Teams
  TEAM_VIEW: 'team:view',
  TEAM_CREATE: 'team:create',
  TEAM_EDIT: 'team:edit',
  TEAM_DELETE: 'team:delete',
  TEAM_MANAGE: 'team:manage',

  // Projects
  PROJECT_VIEW: 'project:view',
  PROJECT_CREATE: 'project:create',
  PROJECT_EDIT: 'project:edit',
  PROJECT_DELETE: 'project:delete',
  PROJECT_MANAGE: 'project:manage',
  PROJECT_ARCHIVE: 'project:archive',

  // Milestones
  MILESTONE_VIEW: 'milestone:view',
  MILESTONE_CREATE: 'milestone:create',
  MILESTONE_EDIT: 'milestone:edit',
  MILESTONE_DELETE: 'milestone:delete',
  MILESTONE_COMPLETE: 'milestone:complete',

  // Tasks
  TASK_VIEW: 'task:view',
  TASK_VIEW_ALL: 'task:view_all',
  TASK_CREATE: 'task:create',
  TASK_EDIT: 'task:edit',
  TASK_DELETE: 'task:delete',
  TASK_ASSIGN: 'task:assign',
  TASK_APPROVE: 'task:approve',
  TASK_CLOSE: 'task:close',
  TASK_REOPEN: 'task:reopen',
  TASK_EXPORT: 'task:export',

  // Task Templates
  TASK_TEMPLATE_VIEW: 'task_template:view',
  TASK_TEMPLATE_CREATE: 'task_template:create',
  TASK_TEMPLATE_EDIT: 'task_template:edit',
  TASK_TEMPLATE_DELETE: 'task_template:delete',

  // Workflows
  WORKFLOW_VIEW: 'workflow:view',
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_EDIT: 'workflow:edit',
  WORKFLOW_DELETE: 'workflow:delete',

  // Automation
  AUTOMATION_VIEW: 'automation:view',
  AUTOMATION_CREATE: 'automation:create',
  AUTOMATION_EDIT: 'automation:edit',
  AUTOMATION_DELETE: 'automation:delete',

  // Reports
  REPORT_VIEW: 'report:view',
  REPORT_CREATE: 'report:create',
  REPORT_EDIT: 'report:edit',
  REPORT_DELETE: 'report:delete',
  REPORT_SCHEDULE: 'report:schedule',
  REPORT_EXPORT: 'report:export',

  // Analytics
  ANALYTICS_VIEW: 'analytics:view',

  // Calendar
  CALENDAR_VIEW: 'calendar:view',
  CALENDAR_CREATE: 'calendar:create',
  CALENDAR_EDIT: 'calendar:edit',
  CALENDAR_DELETE: 'calendar:delete',

  // Files
  FILE_VIEW: 'file:view',
  FILE_UPLOAD: 'file:upload',
  FILE_DELETE: 'file:delete',

  // Integrations
  INTEGRATION_VIEW: 'integration:view',
  INTEGRATION_CREATE: 'integration:create',
  INTEGRATION_EDIT: 'integration:edit',
  INTEGRATION_DELETE: 'integration:delete',

  // Settings
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_EDIT: 'settings:edit',
  SETTINGS_SECURITY: 'settings:security',

  // Audit
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',

  // Notifications
  NOTIFICATION_VIEW: 'notification:view',
  NOTIFICATION_MANAGE: 'notification:manage',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionCode[] = Object.values(PERMISSIONS);
