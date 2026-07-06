import type { TaskStatus, TaskPriority, ProjectStatus } from '../types';

// ─── Task Status ─────────────────────────────────────────────

export const TASK_STATUSES: TaskStatus[] = [
  'draft',
  'open',
  'assigned',
  'in_progress',
  'blocked',
  'on_hold',
  'under_review',
  'approved',
  'completed',
  'closed',
  'archived',
  'rejected',
  'cancelled',
  'reopened',
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  on_hold: 'On Hold',
  under_review: 'Under Review',
  approved: 'Approved',
  completed: 'Completed',
  closed: 'Closed',
  archived: 'Archived',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  reopened: 'Reopened',
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  draft: '#94a3b8',
  open: '#3b82f6',
  assigned: '#8b5cf6',
  in_progress: '#f59e0b',
  blocked: '#ef4444',
  on_hold: '#8b5cf6',
  under_review: '#06b6d4',
  approved: '#22c55e',
  completed: '#10b981',
  closed: '#6366f1',
  archived: '#6b7280',
  rejected: '#ef4444',
  cancelled: '#9ca3af',
  reopened: '#f97316',
};

// ─── Task Priority ───────────────────────────────────────────

export const TASK_PRIORITIES: TaskPriority[] = [
  'none',
  'low',
  'medium',
  'high',
  'urgent',
  'critical',
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
  critical: 'Critical',
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  none: '#9ca3af',
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  urgent: '#ef4444',
  critical: '#dc2626',
};

// ─── Project Status ──────────────────────────────────────────

export const PROJECT_STATUSES: ProjectStatus[] = [
  'draft',
  'active',
  'on_hold',
  'completed',
  'archived',
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

// ─── Default Workflow ────────────────────────────────────────

export const DEFAULT_WORKFLOW = [
  'draft',
  'open',
  'assigned',
  'in_progress',
  'blocked',
  'on_hold',
  'under_review',
  'approved',
  'completed',
  'closed',
  'archived',
] as const;

// ─── Pagination ──────────────────────────────────────────────

export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT = 100;
