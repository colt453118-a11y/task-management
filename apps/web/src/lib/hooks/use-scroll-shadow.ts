'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────

export interface UseScrollShadowOptions {
  /**
   * If true, only activates on mobile screens (max-width: 767px).
   * The shadow stays at 0 on desktop and resets on viewport resize.
   * Defaults to false.
   */
  mobileOnly?: boolean;
}

export interface UseScrollShadowReturn {
  /**
   * Spring-driven opacity for the shadow overlay.
   * Ramps from 0 → 1 over the first 20px of scroll.
   * Use in `style={{ opacity: shadowSpring }}` on a `motion.div`.
   */
  shadowSpring: MotionValue<number>;
  /**
   * Spring-driven y-offset for the shadow parallax effect.
   * Shifts ±3px based on scroll velocity for a depth-layer feel.
   * Use in `style={{ y: shadowParallaxSpring }}` on a `motion.div`.
   */
  shadowParallaxSpring: MotionValue<number>;
}

// ─── Constants ──────────────────────────────────────────────────

/** Scroll distance (px) over which shadow opacity ramps from 0 → 1. */
const SHADOW_RAMP_DISTANCE = 20;

/** Max parallax shift (px) applied to the shadow overlay. */
const MAX_PARALLAX = 3;

/** Velocity multiplier for computing parallax offset from scroll delta. */
const PARALLAX_VELOCITY_FACTOR = 0.12;

// ─── Hook ───────────────────────────────────────────────────────

/**
 * A lightweight hook that provides scroll-driven shadow opacity and
 * parallax values without element hide/show logic.
 *
 * Use this for elements that only need a shadow overlay as the user
 * scrolls — e.g. sticky headers, floating buttons, or static banners.
 * Avoids the overhead of creating element-offset motion values and
 * hide/show state that `useScrollHide` would set up with `hideOffset: 0`.
 *
 * Tracks the `main` scroll container and returns spring-backed motion
 * values so the animation runs entirely on the compositor thread
 * without causing React re-renders during scroll.
 *
 * @example
 * function StickyHeader() {
 *   const { shadowSpring, shadowParallaxSpring } = useScrollShadow();
 *
 *   return (
 *     <motion.div className="sticky top-0 relative">
 *       <motion.div
 *         className="pointer-events-none absolute top-full left-0 right-0 h-3"
 *         style={{
 *           opacity: shadowSpring,
 *           y: shadowParallaxSpring,
 *           background: 'linear-gradient(to bottom, rgba(0,0,0,0.06), transparent)',
 *         }}
 *       />
 *       <span>Sticky Header</span>
 *     </motion.div>
 *   );
 * }
 */
export function useScrollShadow(
  options: UseScrollShadowOptions = {},
): UseScrollShadowReturn {
  const { mobileOnly = false } = options;

  // ── Motion values (stable refs, no re-renders on update) ───
  const shadowOpacity = useMotionValue(0);
  const shadowParallax = useMotionValue(0);

  // Springs — smooth out raw motion value changes
  const shadowSpring = useSpring(shadowOpacity, {
    stiffness: 300,
    damping: 30,
  });
  const shadowParallaxSpring = useSpring(shadowParallax, {
    stiffness: 200,
    damping: 20,
  });

  // ── Refs (avoid React re-renders on every scroll frame) ────
  const lastScrollY = useRef(0);

  // ── Effect (mount once, stable deps) ───────────────────────
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('main');
    if (!main) return;

    // Optional mobile-only guard
    let mql: MediaQueryList | null = null;
    if (mobileOnly) {
      mql = window.matchMedia('(max-width: 767px)');
      if (!mql.matches) return;
    }

    const handleMqlChange = (e: MediaQueryListEvent) => {
      if (!e.matches) {
        // Switched to desktop — reset shadow
        shadowOpacity.set(0);
        shadowParallax.set(0);
      }
    };
    if (mql) {
      mql.addEventListener('change', handleMqlChange);
    }

    let ticking = false;

    const handleScroll = () => {
      if (ticking) return;

      window.requestAnimationFrame(() => {
        const currentScrollY = main.scrollTop;
        const delta = currentScrollY - lastScrollY.current;

        // Shadow — fades in as content scrolls behind the element
        shadowOpacity.set(Math.min(currentScrollY / SHADOW_RAMP_DISTANCE, 1));

        // Parallax — shadow shifts in the same direction as scrolling content
        const parallaxOffset = Math.max(
          -MAX_PARALLAX,
          Math.min(MAX_PARALLAX, -delta * PARALLAX_VELOCITY_FACTOR),
        );
        shadowParallax.set(parallaxOffset);

        lastScrollY.current = currentScrollY;
        ticking = false;
      });

      ticking = true;
    };

    main.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      main.removeEventListener('scroll', handleScroll);
      if (mql) {
        mql.removeEventListener('change', handleMqlChange);
      }
    };
    // All dependencies are stable primitive values or refs,
    // so this effect runs once on mount and cleans up on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { shadowSpring, shadowParallaxSpring };
}
