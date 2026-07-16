/**
 * Status and priority helper utilities.
 *
 * These replace the duplicated `statusColors`, `priorityLabel`, and
 * `statusLabels` inline maps that were copy-pasted across multiple
 * web app components (tasks/page, tasks/[id]/page, teams pages,
 * calendar, search-command, etc.).
 */

import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from '../constants';
import type { TaskStatus, TaskPriority } from '../types';

// ─── Badge Variants (UI-specific) ───────────────────────────

/**
 * UI badge variants derived from the shared task status constants.
 *
 * Maps each `TaskStatus` to a Badge variant string used by the
 * `<Badge>` component in the web app.
 */
const STATUS_BADGE_MAP: Record<
  TaskStatus,
  'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
> = {
  draft: 'default',
  open: 'primary',
  assigned: 'primary',
  in_progress: 'warning',
  blocked: 'danger',
  on_hold: 'warning',
  under_review: 'info',
  approved: 'success',
  completed: 'success',
  closed: 'primary',
  archived: 'default',
  rejected: 'danger',
  cancelled: 'default',
  reopened: 'warning',
};

/**
 * Returns the Badge variant string for a given task status.
 *
 * @example
 * getStatusBadgeVariant('in_progress')  // "warning"
 * getStatusBadgeVariant('completed')    // "success"
 */
export function getStatusBadgeVariant(
  status: TaskStatus,
): 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  return STATUS_BADGE_MAP[status] ?? 'default';
}

/**
 * Returns the human-readable label for a task status.
 * Uses the shared `TASK_STATUS_LABELS` constant.
 *
 * @example
 * getStatusLabel('in_progress')  // "In Progress"
 * getStatusLabel('under_review') // "Under Review"
 */
export function getStatusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status] ?? status.replace(/_/g, ' ');
}

/**
 * Returns the hex color for a task status.
 * Uses the shared `TASK_STATUS_COLORS` constant.
 *
 * @example
 * getStatusColor('in_progress')  // "#f59e0b"
 */
export function getStatusColor(status: TaskStatus): string {
  return TASK_STATUS_COLORS[status] ?? '#6b7280';
}

// ─── Priority Helpers ────────────────────────────────────────

/**
 * Returns the human-readable label for a task priority.
 * Uses the shared `TASK_PRIORITY_LABELS` constant.
 *
 * @example
 * getPriorityLabel('high')   // "High"
 * getPriorityLabel('urgent') // "Urgent"
 */
export function getPriorityLabel(priority: TaskPriority): string {
  return TASK_PRIORITY_LABELS[priority] ?? priority.replace(/_/g, ' ');
}

/**
 * Returns the hex color for a task priority.
 * Uses the shared `TASK_PRIORITY_COLORS` constant.
 *
 * @example
 * getPriorityColor('urgent')   // "#ef4444"
 * getPriorityColor('low')      // "#22c55e"
 */
export function getPriorityColor(priority: TaskPriority): string {
  return TASK_PRIORITY_COLORS[priority] ?? '#9ca3af';
}

/**
 * Returns a config object with label and className for priority badges.
 *
 * @example
 * getPriorityBadgeConfig('high')
 * // { label: 'High', severity: 'high', className: 'bg-red-500/10 text-red-400' }
 */
export type PrioritySeverity = 'critical' | 'high' | 'medium' | 'low';

export function getPriorityBadgeConfig(priority: TaskPriority): {
  label: string;
  severity: PrioritySeverity;
  className: string;
} {
  const severity: PrioritySeverity =
    priority === 'critical' || priority === 'urgent'
      ? 'critical'
      : priority === 'high'
        ? 'high'
        : priority === 'medium'
          ? 'medium'
          : 'low';

  const className =
    severity === 'critical'
      ? 'bg-red-500/10 text-red-400'
      : severity === 'high'
        ? 'bg-orange-500/10 text-orange-400'
        : severity === 'medium'
          ? 'bg-amber-500/10 text-amber-400'
          : 'bg-surface-200 text-surface-500';

  return { label: getPriorityLabel(priority), severity, className };
}

// ─── General Enum Formatters ─────────────────────────────────

/**
 * Converts a snake_case or kebab-case string to Title Case.
 *
 * @example
 * formatEnumValue('in_progress')   // "In Progress"
 * formatEnumValue('under_review')  // "Under Review"
 * formatEnumValue('on-hold')       // "On Hold"
 */
export function formatEnumValue(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Extracts initials from a person's name.
 *
 * @example
 * getInitials('John Doe')      // "JD"
 * getInitials('Alice')         // "A"
 * getInitials(null)            // "?"
 * getInitials('')              // "?"
 */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return (
    (parts[0] ?? '').charAt(0).toUpperCase() +
    (parts[parts.length - 1] ?? '').charAt(0).toUpperCase()
  );
}
