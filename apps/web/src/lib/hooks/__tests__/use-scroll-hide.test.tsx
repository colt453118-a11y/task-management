import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect, useRef, type FC } from 'react';
import {
  useScrollHide,
  type UseScrollHideOptions,
  type UseScrollHideReturn,
} from '@/lib/hooks/use-scroll-hide';

// ─── Framer-motion mock ─────────────────────────────────────────
// Keep real useMotionValue (simple get/set container), but make
// useSpring an identity pass-through so springs resolve instantly.
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    useSpring: (value: unknown) => value,
  };
});

// ─── RAF helpers ────────────────────────────────────────────────
// We capture the rAF callback and flush it synchronously in tests.
let capturedRAF: FrameRequestCallback | null = null;
let rafIdCounter = 0;

function flushRAF(): void {
  act(() => {
    if (capturedRAF) {
      capturedRAF(performance.now());
      capturedRAF = null;
    }
  });
}

function mockRAF(): void {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    capturedRAF = cb;
    return ++rafIdCounter;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    capturedRAF = null;
  });
}

// ─── matchMedia helpers ─────────────────────────────────────────
function mockMatchMedia(matches: boolean) {
  const handlerRef = { current: null as EventListener | null };
  const mql = {
    matches,
    addEventListener: vi.fn((_type: string, listener: EventListener) => {
      handlerRef.current = listener;
    }),
    removeEventListener: vi.fn(() => {
      handlerRef.current = null;
    }),
  };
  vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
  return { mql, handlerRef };
}

/** Fire the registered matchMedia change handler with the given matches value. */
function fireMqlChange(handlerRef: { current: EventListener | null }, matches: boolean): void {
  act(() => {
    if (handlerRef.current) {
      const event = new Event('change') as MediaQueryListEvent;
      Object.defineProperty(event, 'matches', { value: matches });
      handlerRef.current(event);
    }
  });
}

// ─── Test harness component ─────────────────────────────────────
// Renders a scrollable <main> element and exposes the hook values.
const TestComponent: FC<
  UseScrollHideOptions & {
    onValues: (values: UseScrollHideReturn) => void;
  }
> = ({ hideOffset, mobileOnly, onValues }) => {
  const values = useScrollHide({ hideOffset, mobileOnly });
  const onValuesRef = useRef(onValues);
  onValuesRef.current = onValues;

  useEffect(() => {
    onValuesRef.current(values);
  });

  return (
    <main style={{ height: '200px', overflow: 'auto' }}>
      <div style={{ height: '1000px' }} />
    </main>
  );
};

// ─── Helpers ────────────────────────────────────────────────────
function renderHook(options: UseScrollHideOptions) {
  let values!: UseScrollHideReturn;
  render(<TestComponent {...options} onValues={(v) => { values = v; }} />);
  return { getValues: () => values };
}

function scrollMain(scrollTop: number): void {
  const main = document.querySelector('main');
  if (!main) throw new Error('<main> element not found');
  act(() => {
    main.scrollTop = scrollTop;
    main.dispatchEvent(new Event('scroll'));
  });
  flushRAF();
}

// ─── Tests ──────────────────────────────────────────────────────

describe('useScrollHide — default mode (mobileOnly: false)', () => {
  beforeEach(() => {
    mockRAF();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capturedRAF = null;
    rafIdCounter = 0;
    document.body.innerHTML = '';
  });

  // ── Initial state ───────────────────────────────────────────

  it('returns initial motion values at zero', () => {
    const { getValues } = renderHook({ hideOffset: 100 });
    const v = getValues();
    expect(v.elementSpring.get()).toBe(0);
    expect(v.shadowSpring.get()).toBe(0);
    expect(v.shadowParallaxSpring.get()).toBe(0);
  });

  // ── Top-of-page behavior ────────────────────────────────────

  it('stays visible when scrolled within the top 60px', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // Scroll from 0 → 50 (within 60px threshold)
    scrollMain(50);
    expect(getValues().elementSpring.get()).toBe(0);

    // Scroll from 50 → 20 (scrolling up, still within 60px)
    scrollMain(20);
    expect(getValues().elementSpring.get()).toBe(0);
  });

  // ── Hide on scroll down ─────────────────────────────────────

  it('hides element when scrolling down past 60px with large delta', () => {
    const { getValues } = renderHook({ hideOffset: 150 });

    scrollMain(100);
    expect(getValues().elementSpring.get()).toBe(150);
  });

  it('does NOT hide when delta is small (≤8) even if past 60px', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // First scroll: 0 → 65 (delta=65 > 8, past 60px) → hides
    scrollMain(65);
    expect(getValues().elementSpring.get()).toBe(100);

    // Second scroll: 65 → 68 (delta=3 ≤ 8) → stays hidden
    scrollMain(68);
    expect(getValues().elementSpring.get()).toBe(100);
  });

  // ── Show on scroll up ───────────────────────────────────────

  it('shows element when scrolling up with large negative delta', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // Hide
    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Scroll up to top (delta=-150 < -8, scrollTop=50 ≤ 60)
    scrollMain(50);
    expect(getValues().elementSpring.get()).toBe(0);
  });

  it('shows element when scrolling upward from deep scroll', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Scroll up: 200 → 100 (delta=-100 < -8, scrollTop=100 > 60)
    scrollMain(100);
    expect(getValues().elementSpring.get()).toBe(0);
  });

  it('keeps hidden element hidden when slowly scrolling up (delta > -8)', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Tiny scroll up: 200 → 195 (delta=-5, not below -8)
    scrollMain(195);
    expect(getValues().elementSpring.get()).toBe(100);
  });

  // ── Shadow opacity ──────────────────────────────────────────

  it('ramps shadow opacity over the first 20px of scroll', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    scrollMain(10);
    expect(getValues().shadowSpring.get()).toBeCloseTo(0.5, 2);

    scrollMain(20);
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);
  });

  it('caps shadow opacity at 1 beyond 20px', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    scrollMain(200);
    expect(getValues().shadowSpring.get()).toBe(1);

    scrollMain(500);
    expect(getValues().shadowSpring.get()).toBe(1);
  });

  // ── Parallax ────────────────────────────────────────────────

  it('applies positive parallax when scrolling up (delta < 0)', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // Establish baseline
    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Scroll up: delta = -150 → parallax = -(-150)*0.12 = 18, clamped to 3
    scrollMain(50);
    expect(getValues().shadowParallaxSpring.get()).toBe(3);
  });

  it('applies negative parallax when scrolling down (delta > 0)', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // Establish baseline
    scrollMain(50);

    // Scroll down: delta = 150 → parallax = -(150)*0.12 = -18, clamped to -3
    scrollMain(200);
    expect(getValues().shadowParallaxSpring.get()).toBe(-3);
  });

  it('resets parallax to zero when scroll stops', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    scrollMain(100);
    // parallax was -12 clamped to -3

    scrollMain(100);
    // delta = 0 → parallax should be 0 (use toBeCloseTo to handle -0)
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(0, 5);
  });

  // ── Edge cases ──────────────────────────────────────────────

  it('shows element when navigating back to top from deep scroll', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // Scroll down
    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Scroll to top
    scrollMain(0);
    expect(getValues().elementSpring.get()).toBe(0);
  });

  it('multiple scroll events are throttled by rAF', () => {
    const { getValues } = renderHook({ hideOffset: 100 });
    const main = document.querySelector('main')!;

    // Fire two scroll events before flushing rAF
    act(() => {
      main.scrollTop = 30;
      main.dispatchEvent(new Event('scroll')); // first call sets ticking=true
      // second call returns immediately because ticking=true
      main.scrollTop = 100;
      main.dispatchEvent(new Event('scroll'));
    });
    flushRAF();

    // The rAF callback runs once with the LAST scrollTop (100)
    expect(getValues().elementSpring.get()).toBe(100);
  });

  it('supports different hideOffset values', () => {
    const { getValues } = renderHook({ hideOffset: -60 });

    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(-60);
  });

  it('removes scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window.HTMLElement.prototype, 'removeEventListener');
    const { unmount } = render(<TestComponent hideOffset={100} onValues={() => {}} />);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });
});

// ─── Mobile-only tests ──────────────────────────────────────────

describe('useScrollHide — mobileOnly mode', () => {
  beforeEach(() => {
    mockRAF();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capturedRAF = null;
    rafIdCounter = 0;
    document.body.innerHTML = '';
  });

  it('hides element on scroll when viewport is mobile width (≤767px)', () => {
    mockMatchMedia(true);

    const { getValues } = renderHook({ hideOffset: 100, mobileOnly: true });

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    flushRAF();

    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);
  });

  it('keeps element visible when viewport is desktop width (>767px)', () => {
    mockMatchMedia(false);

    const { getValues } = renderHook({ hideOffset: 100, mobileOnly: true });

    // Effect returns early — no scroll listener attached
    expect(getValues().elementSpring.get()).toBe(0);

    // Try to scroll — should have no effect
    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(0);
  });

  it('resets element position when resizing from mobile to desktop', () => {
    const { handlerRef } = mockMatchMedia(true);

    const { getValues } = renderHook({ hideOffset: 100, mobileOnly: true });
    flushRAF();

    // Scroll down — hides
    scrollMain(200);
    expect(getValues().elementSpring.get()).toBe(100);

    // Simulate resize from mobile to desktop (matches: false)
    fireMqlChange(handlerRef, false);

    // Element should snap back to visible
    expect(getValues().elementSpring.get()).toBe(0);
  });
});

// ─── Parallax edge cases ───────────────────────────────────────

describe('useScrollHide — parallax edge cases', () => {
  beforeEach(() => {
    mockRAF();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capturedRAF = null;
    rafIdCounter = 0;
    document.body.innerHTML = '';
  });

  it('clamps parallax at ±3px for very large deltas', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // delta = 500 → parallax = -(500)*0.12 = -60, clamped to -3
    scrollMain(500);
    expect(getValues().shadowParallaxSpring.get()).toBe(-3);

    // delta = -500 → parallax = -(-500)*0.12 = 60, clamped to 3
    scrollMain(0);
    expect(getValues().shadowParallaxSpring.get()).toBe(3);
  });

  it('produces proportional parallax values for moderate deltas', () => {
    const { getValues } = renderHook({ hideOffset: 100 });

    // delta = 20 → parallax = -(20)*0.12 = -2.4
    scrollMain(20);
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(-2.4, 2);

    // delta = -20 → parallax = -(-20)*0.12 = 2.4
    scrollMain(0);
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(2.4, 2);
  });
});
