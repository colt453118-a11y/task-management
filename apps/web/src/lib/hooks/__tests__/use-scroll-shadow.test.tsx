import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect, useRef, type FC } from 'react';
import {
  useScrollShadow,
  type UseScrollShadowReturn,
} from '@/lib/hooks/use-scroll-shadow';

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

function fireMqlChange(
  handlerRef: { current: EventListener | null },
  matches: boolean,
): void {
  act(() => {
    if (handlerRef.current) {
      const event = new Event('change') as MediaQueryListEvent;
      Object.defineProperty(event, 'matches', { value: matches });
      handlerRef.current(event);
    }
  });
}

// ─── Test harness component ─────────────────────────────────────
const TestComponent: FC<{
  mobileOnly?: boolean;
  onValues: (values: UseScrollShadowReturn) => void;
}> = ({ mobileOnly, onValues }) => {
  const values = useScrollShadow({ mobileOnly });
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
function renderHook(mobileOnly = false) {
  let values!: UseScrollShadowReturn;
  render(<TestComponent mobileOnly={mobileOnly} onValues={(v) => { values = v; }} />);
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

describe('useScrollShadow — default mode (mobileOnly: false)', () => {
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
    const { getValues } = renderHook();
    const v = getValues();
    expect(v.shadowSpring.get()).toBe(0);
    expect(v.shadowParallaxSpring.get()).toBe(0);
  });

  // ── Shadow opacity ──────────────────────────────────────────

  it('ramps shadow opacity over the first 20px of scroll', () => {
    const { getValues } = renderHook();

    scrollMain(10);
    expect(getValues().shadowSpring.get()).toBeCloseTo(0.5, 2);

    scrollMain(20);
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);
  });

  it('caps shadow opacity at 1 beyond 20px', () => {
    const { getValues } = renderHook();

    scrollMain(200);
    expect(getValues().shadowSpring.get()).toBe(1);

    scrollMain(500);
    expect(getValues().shadowSpring.get()).toBe(1);
  });

  it('shadow returns to 0 when scrolling back to top', () => {
    const { getValues } = renderHook();

    scrollMain(30);
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);

    scrollMain(0);
    expect(getValues().shadowSpring.get()).toBe(0);
  });

  // ── Parallax ────────────────────────────────────────────────

  it('applies positive parallax when scrolling up (delta < 0)', () => {
    const { getValues } = renderHook();

    // Establish baseline
    scrollMain(200);

    // Scroll up: delta = -150 → parallax = -(-150)*0.12 = 18, clamped to 3
    scrollMain(50);
    expect(getValues().shadowParallaxSpring.get()).toBe(3);
  });

  it('applies negative parallax when scrolling down (delta > 0)', () => {
    const { getValues } = renderHook();

    // Establish baseline
    scrollMain(50);

    // Scroll down: delta = 150 → parallax = -(150)*0.12 = -18, clamped to -3
    scrollMain(200);
    expect(getValues().shadowParallaxSpring.get()).toBe(-3);
  });

  it('resets parallax to zero when scroll stops', () => {
    const { getValues } = renderHook();

    scrollMain(100);
    // parallax was -12 clamped to -3

    scrollMain(100);
    // delta = 0 → parallax should be 0
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(0, 5);
  });

  it('clamps parallax at ±3px for very large deltas', () => {
    const { getValues } = renderHook();

    // delta = 500 → parallax = -(500)*0.12 = -60, clamped to -3
    scrollMain(500);
    expect(getValues().shadowParallaxSpring.get()).toBe(-3);

    // delta = -500 → parallax = -(-500)*0.12 = 60, clamped to 3
    scrollMain(0);
    expect(getValues().shadowParallaxSpring.get()).toBe(3);
  });

  it('produces proportional parallax values for moderate deltas', () => {
    const { getValues } = renderHook();

    // delta = 20 → parallax = -(20)*0.12 = -2.4
    scrollMain(20);
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(-2.4, 2);

    // delta = -20 → parallax = -(-20)*0.12 = 2.4
    scrollMain(0);
    expect(getValues().shadowParallaxSpring.get()).toBeCloseTo(2.4, 2);
  });

  // ── Throttling ──────────────────────────────────────────────

  it('throttles multiple scroll events via rAF', () => {
    const { getValues } = renderHook();
    const main = document.querySelector('main')!;

    // Fire two scroll events before flushing rAF
    act(() => {
      main.scrollTop = 10;
      main.dispatchEvent(new Event('scroll')); // first call sets ticking=true
      // second call returns immediately because ticking=true
      main.scrollTop = 30;
      main.dispatchEvent(new Event('scroll'));
    });
    flushRAF();

    // The rAF callback runs once with the LAST scrollTop (30)
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);
  });

  // ── Cleanup ─────────────────────────────────────────────────

  it('removes scroll listener on unmount', () => {
    const removeSpy = vi.spyOn(window.HTMLElement.prototype, 'removeEventListener');
    const { unmount } = render(<TestComponent onValues={() => {}} />);

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('no-args call works (default options)', () => {
    // Just verify the default export path works without error
    expect(() => render(<TestComponent onValues={() => {}} />)).not.toThrow();
  });
});

// ─── Mobile-only tests ──────────────────────────────────────────

describe('useScrollShadow — mobileOnly mode', () => {
  beforeEach(() => {
    mockRAF();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    capturedRAF = null;
    rafIdCounter = 0;
    document.body.innerHTML = '';
  });

  it('updates shadow when viewport is mobile width (≤767px)', () => {
    mockMatchMedia(true);

    const { getValues } = renderHook(true);

    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    flushRAF();

    scrollMain(20);
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);
  });

  it('keeps shadow at zero when viewport is desktop width (>767px)', () => {
    mockMatchMedia(false);

    const { getValues } = renderHook(true);

    // Effect returns early — no scroll listener attached
    expect(getValues().shadowSpring.get()).toBe(0);

    // Try to scroll — should have no effect
    scrollMain(200);
    expect(getValues().shadowSpring.get()).toBe(0);
  });

  it('resets shadow values when resizing from mobile to desktop', () => {
    const { handlerRef } = mockMatchMedia(true);

    const { getValues } = renderHook(true);
    flushRAF();

    // Scroll down — shadow appears
    scrollMain(30);
    expect(getValues().shadowSpring.get()).toBeCloseTo(1, 2);

    // Simulate resize from mobile to desktop (matches: false)
    fireMqlChange(handlerRef, false);

    // Shadow should reset to 0
    expect(getValues().shadowSpring.get()).toBe(0);
    expect(getValues().shadowParallaxSpring.get()).toBe(0);
  });
});
