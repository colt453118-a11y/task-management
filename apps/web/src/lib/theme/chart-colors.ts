/**
 * Chart color source of truth — mirrors the `--color-status-*` / `--color-priority-*`
 * CSS tokens in `globals.css`. Recharts (and any canvas/SVG chart) can't read CSS
 * custom properties as `fill`/`stroke` values, so this file re-exports the same
 * hex values as JS constants. Keep these in sync with `globals.css` (lines ~143-164).
 */

export const STATUS_CHART_COLORS: Record<string, string> = {
  draft: '#6b7280',
  open: '#60a5fa',
  in_progress: '#fbbf24',
  blocked: '#f87171',
  on_hold: '#a78bfa',
  under_review: '#22d3ee',
  approved: '#34d399',
  completed: '#34d399',
  closed: '#818cf8',
  archived: '#6b7280',
  rejected: '#f87171',
  cancelled: '#9ca3af',
  assigned: '#a78bfa',
  reopened: '#fb923c',
};

export const PRIORITY_CHART_COLORS: Record<string, string> = {
  none: '#6b7280',
  low: '#34d399',
  medium: '#fbbf24',
  high: '#fb923c',
  urgent: '#f87171',
  critical: '#ef4444',
};

const STATUS_FALLBACK = '#6b7280';

/** Resolve a status key to its chart hex, falling back to neutral grey. */
export function statusChartColor(status: string, fallback: string = STATUS_FALLBACK): string {
  return STATUS_CHART_COLORS[status] ?? fallback;
}

/** Resolve a priority key to its chart hex, falling back to neutral grey. */
export function priorityChartColor(priority: string, fallback: string = STATUS_FALLBACK): string {
  return PRIORITY_CHART_COLORS[priority] ?? fallback;
}
