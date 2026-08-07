import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Chip — the canonical tinted pill used for statuses, priorities, labels and
 * counts across the app (tables, kanban cards, detail headers, filters).
 *
 * Colors are token-driven: a `StatusChip`/`PriorityChip` resolves the matching
 * `--color-status-*` / `--color-priority-*` design token (dark-optimized in
 * `globals.css`) and tints the pill with `color-mix`, so every chip in the app
 * stays perfectly consistent from one source of truth. A raw `<Chip>` accepts
 * any CSS color for one-off accents.
 */

const chipSizes = {
  sm: 'px-2 py-0.5 text-[11px] gap-1',
  md: 'px-2.5 py-0.5 text-xs gap-1.5',
} as const;

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Any CSS color (hex, `var(--color-…)`, etc). Drives text, tint and ring. */
  color?: string;
  /** Show a leading solid dot in the chip color. */
  dot?: boolean;
  size?: keyof typeof chipSizes;
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ color = 'var(--color-surface-500)', dot = false, size = 'md', className, style, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full font-medium leading-none',
        chipSizes[size],
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 26%, transparent)`,
        ...style,
      }}
      {...props}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      )}
      {children}
    </span>
  ),
);
Chip.displayName = 'Chip';

/** snake_case / kebab-case enum value → Title Case label. */
function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** enum value → CSS custom-property name (e.g. `in_progress` → `--color-status-in-progress`). */
function tokenVar(kind: 'status' | 'priority', value: string): string {
  return `--color-${kind}-${value.toLowerCase().replace(/_/g, '-')}`;
}

export interface StatusChipProps extends Omit<ChipProps, 'color'> {
  status: string;
  /** Override the auto Title-Cased label. */
  label?: string;
}

export function StatusChip({ status, label, dot = true, ...props }: StatusChipProps) {
  return (
    <Chip color={`var(${tokenVar('status', status)}, var(--color-surface-500))`} dot={dot} {...props}>
      {label ?? titleCase(status)}
    </Chip>
  );
}

export interface PriorityChipProps extends Omit<ChipProps, 'color'> {
  priority: string;
  label?: string;
}

export function PriorityChip({ priority, label, dot = true, ...props }: PriorityChipProps) {
  return (
    <Chip color={`var(${tokenVar('priority', priority)}, var(--color-surface-500))`} dot={dot} {...props}>
      {label ?? titleCase(priority)}
    </Chip>
  );
}
