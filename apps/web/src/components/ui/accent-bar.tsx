import { cn } from '@/lib/utils';

/**
 * AccentBar — the thin gradient bar pinned to the top edge of a card. Consolidates
 * the `absolute inset-x-0 top-0 h-0.5 …` bar that's copy-pasted across detail pages
 * and StatCard. The parent must be `relative`.
 *
 * - Omit `color` for the default brand gradient (electric violet).
 * - Pass `color` (hex or `var(--color-…)`) for a color→transparent gradient (StatCard).
 */
export interface AccentBarProps {
  /** Accent color (hex or CSS var). When set, renders a color→transparent gradient. */
  color?: string;
  className?: string;
}

export function AccentBar({ color, className }: AccentBarProps) {
  if (color) {
    return (
      <div
        aria-hidden
        className={cn('absolute inset-x-0 top-0 h-0.5 opacity-70', className)}
        style={{
          background: `linear-gradient(to right, ${color}, color-mix(in srgb, ${color} 35%, transparent))`,
        }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        'from-brand-500 to-brand-400 absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60',
        className,
      )}
    />
  );
}
