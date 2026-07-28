'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring, type MotionValue } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────

export interface UseScrollHideOptions {
  /**
   * Y-offset (px) to translate the element when hidden.
   * Positive = translate down (e.g. 100 for a bottom nav).
   * Negative = translate up (e.g. -60 for a topbar that slides upward).
   */
  hideOffset: number;
  /**
   * If true, scroll-to-hide only activates on mobile screens
   * (max-width: 767px / md breakpoint). The element stays visible
   * on desktop and its position resets on resize. Defaults to false.
   */
  mobileOnly?: boolean;
}

export interface UseScrollHideReturn {
  /**
   * Spring-driven y value for the element.
   * Apply via `style={{ y: elementSpring }}` on the motion element.
   */
  elementSpring: MotionValue<number>;
  /**
   * Spring-driven opacity for the shadow overlay.
   * Ramps from 0 → 1 over the first 20px of scroll.
   */
  shadowSpring: MotionValue<number>;
  /**
   * Spring-driven y-offset for the shadow parallax effect.
   * Shifts ±3px based on scroll velocity for a depth-layer feel.
   */
  shadowParallaxSpring: MotionValue<number>;
}

// ─── Constants ──────────────────────────────────────────────────

/** Max scroll position (px) before the element can start hiding. */
const TOP_THRESHOLD = 60;

/** Min scroll delta (px) to trigger show/hide (prevents flickering). */
const DELTA_THRESHOLD = 8;

/** Scroll distance (px) over which shadow opacity ramps from 0 → 1. */
const SHADOW_RAMP_DISTANCE = 20;

/** Max parallax shift (px) applied to the shadow overlay. */
const MAX_PARALLAX = 3;

/** Velocity multiplier for computing parallax offset from scroll delta. */
const PARALLAX_VELOCITY_FACTOR = 0.12;

// ─── Hook ───────────────────────────────────────────────────────

/**
 * Adds scroll-to-hide behavior and scroll-driven shadow/parallax to
 * a fixed or sticky element (e.g. bottom nav, topbar).
 *
 * Tracks the `main` scroll container and returns spring-backed motion
 * values so the animation runs entirely on the compositor thread
 * without causing React re-renders during scroll.
 *
 * ## How it works
 *
 * - Listens for `scroll` events on the document's `<main>` element
 *   (assumes a single-column dashboard layout).
 * - Uses `requestAnimationFrame` throttling — the scroll handler
 *   only processes one frame at a time, discarding intermediate
 *   scroll events.
 * - Tracks the previous scroll position and computes a **delta** to
 *   determine scroll direction and velocity.
 * - When the user scrolls **down** past 60 px with a delta > 8 px,
 *   the element slides out of view (hidden).
 * - When the user scrolls **up** with a delta < -8 px, the element
 *   slides back into view (shown).
 * - The element is **always visible** within the first 60 px of
 *   the page (top-of-page threshold).
 * - Small deltas (≤ 8 px in either direction) are ignored to
 *   prevent flickering during slow or hesitant scrolling.
 *
 * ## Shadow & parallax
 *
 * In addition to hiding/showing the element, the hook provides two
 * values for a polished scroll-driven shadow overlay:
 *
 * - **`shadowSpring`** — ramps from 0 → 1 over the first 20 px of
 *   scroll, so the shadow fades in as content scrolls behind the
 *   element.
 * - **`shadowParallaxSpring`** — shifts the shadow up/down by up
 *   to ±3 px based on scroll velocity, giving a subtle depth-layer
 *   feel. Moves in the same direction as the scrolling content.
 *
 * ## Mobile-only mode
 *
 * When `mobileOnly: true`, the hook checks
 * `matchMedia('(max-width: 767px)')` and only activates the scroll
 * listener on mobile-width viewports. It also listens for viewport
 * resizes and resets the element position when switching to desktop.
 *
 * ## Performance
 *
 * All scroll-driven values are stored as framer-motion
 * `MotionValue` objects, which update via `useSpring` for smooth
 * interpolation. Because these are not React state, the component
 * does **not** re-render during scrolling — the animation runs
 * entirely on the compositor thread.
 *
 * ## Usage
 *
 * @example
 * // Bottom nav — slides down when hidden
 * function BottomNav() {
 *   const { elementSpring, shadowSpring, shadowParallaxSpring } =
 *     useScrollHide({ hideOffset: 100 });
 *
 *   return (
 *     <motion.nav style={{ y: elementSpring }}>
 *       <motion.div
 *         style={{
 *           opacity: shadowSpring,
 *           y: shadowParallaxSpring,
 *           background: 'linear-gradient(to top, rgba(0,0,0,0.12), transparent)',
 *         }}
 *       />
 *     </motion.nav>
 *   );
 * }
 *
 * @example
 * // Topbar — slides up when hidden, mobile-only
 * function Topbar() {
 *   const { elementSpring, shadowSpring, shadowParallaxSpring } =
 *     useScrollHide({ hideOffset: -60, mobileOnly: true });
 *
 *   return (
 *     <motion.header style={{ y: elementSpring }}>
 *       <motion.div
 *         style={{
 *           opacity: shadowSpring,
 *           y: shadowParallaxSpring,
 *           background: 'linear-gradient(to bottom, rgba(0,0,0,0.10), transparent)',
 *         }}
 *       />
 *     </motion.header>
 *   );
 * }
 */
export function useScrollHide({
  hideOffset,
  mobileOnly = false,
}: UseScrollHideOptions): UseScrollHideReturn {
  // ── Motion values (stable refs, no re-renders on update) ───
  const elementOffset = useMotionValue(0);
  const shadowOpacity = useMotionValue(0);
  const shadowParallax = useMotionValue(0);

  // Springs — smooth out the raw motion value changes
  const elementSpring = useSpring(elementOffset, {
    stiffness: 300,
    damping: 30,
    mass: 0.5,
  });
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
  const elementVisible = useRef(true);

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
        // Switched to desktop — reset position
        elementOffset.set(0);
        elementVisible.current = true;
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

        if (currentScrollY <= TOP_THRESHOLD) {
          // Always visible at top of page
          if (!elementVisible.current) {
            elementVisible.current = true;
            elementOffset.set(0);
          }
        } else if (delta > DELTA_THRESHOLD) {
          // Scrolling down — hide
          if (elementVisible.current) {
            elementVisible.current = false;
            elementOffset.set(hideOffset);
          }
        } else if (delta < -DELTA_THRESHOLD) {
          // Scrolling up — show
          if (!elementVisible.current) {
            elementVisible.current = true;
            elementOffset.set(0);
          }
        }

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
    // All dependencies are stable primitives or motion-value refs,
    // so this effect runs once on mount and cleans up on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { elementSpring, shadowSpring, shadowParallaxSpring };
}
