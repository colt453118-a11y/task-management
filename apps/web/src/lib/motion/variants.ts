import type { Variants } from 'framer-motion';

/**
 * Shared framer-motion variants for the app's page/list entrance animations.
 *
 * Most `(dashboard)` pages hand-roll a `containerVariants` (fade + `staggerChildren`)
 * and an `itemVariants` (fade + slide up) locally, with small per-page differences in
 * the stagger delay and the slide distance. These factories centralize the pattern
 * while preserving each page's exact timing: pass the same values the page used.
 *
 * Pages seeded by RSC pass `initial={hadInitialData ? false : 'hidden'}` on the
 * container so the server-rendered first paint skips the entrance animation.
 */

/** Container: fade the group in and stagger its children by `stagger` seconds. */
export function staggerContainer(stagger = 0.05): Variants {
  return {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: stagger } },
  };
}

/**
 * Item: fade + slide up by `y`px (spring). Pass `scale` for the dashboard-style
 * scale-in, or omit for a plain slide. Set `fade: false` for a slide-only entrance
 * (used where a missed variant-propagation must never hide content — see task detail).
 */
export function fadeUpItem({
  y = 20,
  scale,
  fade = true,
}: { y?: number; scale?: number; fade?: boolean } = {}): Variants {
  const hidden: Record<string, number> = { y };
  if (fade) hidden.opacity = 0;
  if (scale !== undefined) hidden.scale = scale;
  const visible: Record<string, number> = { y: 0 };
  if (fade) visible.opacity = 1;
  if (scale !== undefined) visible.scale = 1;
  return {
    hidden,
    visible: { ...visible, transition: { type: 'spring', stiffness: 100, damping: 15 } },
  };
}

/** The most common defaults (stagger 0.05, fade + slide up 20px). */
export const containerVariants: Variants = staggerContainer(0.05);
export const itemVariants: Variants = fadeUpItem({ y: 20 });
