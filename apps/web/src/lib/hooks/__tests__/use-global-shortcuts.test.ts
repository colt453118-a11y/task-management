import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGlobalShortcuts } from '../use-global-shortcuts';
import { useKeyboardShortcuts } from '@/components/ui/keyboard-shortcuts';
import {
  withSuppressionTarget,
  cleanupSuppressionTargets,
} from '@/test/suppression-target';

// ─── Mock next/navigation useRouter ─────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// ─── Helpers ────────────────────────────────────────────────

/**
 * Dispatches a keydown event on the given target element (defaults to
 * document.body), allowing it to bubble up to `document` where the hook
 * listens. This ensures `event.target` reflects the real DOM target.
 */
function dispatchKey(
  key: string,
  opts: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    target?: HTMLElement;
  } = {},
) {
  const target = opts.target ?? document.body;
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });

  target.dispatchEvent(event);
  return event;
}



// ═══════════════════════════════════════════════════════════════
// ─── useGlobalShortcuts ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('useGlobalShortcuts', () => {
  const actions = {
    openSearch: vi.fn(),
    openQuickCreate: vi.fn(),
    openShortcuts: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    currentCollapsed: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cleanupSuppressionTargets();
  });

  afterEach(() => {
    cleanupSuppressionTargets();
  });

  function setup() {
    return renderHook(() => useGlobalShortcuts(actions));
  }

  // ── Meta shortcuts ──────────────────────────────────────

  describe('⌘K — open search', () => {
    it('should call openSearch on ⌘K', () => {
      setup();
      dispatchKey('k', { metaKey: true });
      expect(actions.openSearch).toHaveBeenCalledOnce();
    });

    it('should call openSearch on Ctrl+K', () => {
      setup();
      dispatchKey('k', { ctrlKey: true });
      expect(actions.openSearch).toHaveBeenCalledOnce();
    });

    it('should not call openSearch on K without modifier', () => {
      setup();
      dispatchKey('k');
      expect(actions.openSearch).not.toHaveBeenCalled();
    });
  });

  describe('⌘T — quick create', () => {
    it('should call openQuickCreate on ⌘T', () => {
      setup();
      dispatchKey('t', { metaKey: true });
      expect(actions.openQuickCreate).toHaveBeenCalledOnce();
    });

    it('should call openQuickCreate on Ctrl+T', () => {
      setup();
      dispatchKey('t', { ctrlKey: true });
      expect(actions.openQuickCreate).toHaveBeenCalledOnce();
    });
  });

  describe('⌘1/2/3 — navigation', () => {
    beforeEach(() => {
      mockPush.mockClear();
    });

    it('should navigate to / on ⌘1', () => {
      setup();
      dispatchKey('1', { metaKey: true });
      expect(mockPush).toHaveBeenCalledWith('/');
    });

    it('should navigate to /tasks on ⌘2', () => {
      setup();
      dispatchKey('2', { metaKey: true });
      expect(mockPush).toHaveBeenCalledWith('/tasks');
    });

    it('should navigate to /projects on ⌘3', () => {
      setup();
      dispatchKey('3', { metaKey: true });
      expect(mockPush).toHaveBeenCalledWith('/projects');
    });

    it('should not navigate on ⌘⇧1 (shift pressed)', () => {
      setup();
      dispatchKey('1', { metaKey: true, shiftKey: true });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('⌘⇧P — toggle sidebar', () => {
    it('should call setSidebarCollapsed with toggled value (false → true)', () => {
      setup();
      dispatchKey('P', { metaKey: true, shiftKey: true });
      expect(actions.setSidebarCollapsed).toHaveBeenCalledWith(true);
    });

    it('should toggle from collapsed=true to false', () => {
      renderHook(() =>
        useGlobalShortcuts({
          ...actions,
          currentCollapsed: true,
        }),
      );
      dispatchKey('P', { metaKey: true, shiftKey: true });
      expect(actions.setSidebarCollapsed).toHaveBeenCalledWith(false);
    });
  });

  describe('⌘⇧F — focus filters', () => {
    it('should navigate to /tasks?focusFilters=true', () => {
      setup();
      dispatchKey('F', { metaKey: true, shiftKey: true });
      expect(mockPush).toHaveBeenCalledWith('/tasks?focusFilters=true');
    });
  });

  describe('? — open shortcuts', () => {
    it('should call openShortcuts on ? when not in input', () => {
      setup();
      dispatchKey('?');
      expect(actions.openShortcuts).toHaveBeenCalledOnce();
    });

    it('should suppress ? key when typing in an input', () => {
      setup();
      withSuppressionTarget({ tagName: 'INPUT' }, (target) => {
        dispatchKey('?', { target });
        expect(actions.openShortcuts).not.toHaveBeenCalled();
      });
    });
  });

  // ── Input suppression ─────────────────────────────────────

  describe('input suppression', () => {
    it('should suppress meta shortcuts when typing in input', () => {
      setup();
      withSuppressionTarget({ tagName: 'INPUT' }, (target) => {
        dispatchKey('k', { metaKey: true, target });
        expect(actions.openSearch).not.toHaveBeenCalled();
      });
    });

    it('should suppress meta shortcuts when typing in textarea', () => {
      setup();
      withSuppressionTarget({ tagName: 'TEXTAREA' }, (target) => {
        dispatchKey('t', { metaKey: true, target });
        expect(actions.openQuickCreate).not.toHaveBeenCalled();
      });
    });

    it('should suppress meta shortcuts in contentEditable elements', () => {
      setup();
      withSuppressionTarget({ isContentEditable: true }, (target) => {
        dispatchKey('1', { metaKey: true, target });
        expect(mockPush).not.toHaveBeenCalled();
      });
    });

    it('should NOT suppress meta shortcuts when contentEditable is explicitly disabled (false)', () => {
      setup();
      // contentEditable="false" means isContentEditable returns false,
      // so shortcuts should fire normally.
      withSuppressionTarget({ isContentEditable: false }, (target) => {
        dispatchKey('1', { metaKey: true, target });
        expect(mockPush).toHaveBeenCalledWith('/');
      });
    });

    it('should suppress meta shortcuts on element with both INPUT tagName and contentEditable=true', () => {
      setup();
      // Both conditions in the isInput check are true — should still suppress.
      withSuppressionTarget({ tagName: 'INPUT', isContentEditable: true }, (target) => {
        dispatchKey('1', { metaKey: true, target });
        expect(mockPush).not.toHaveBeenCalled();
      });
    });
  });

  // ── Actions without callbacks ───────────────────────────

  describe('undefined callbacks', () => {
    it('should silently do nothing when setSidebarCollapsed is not provided', () => {
      // This matches how ShortcutsProvider uses the hook (no sidebar toggle)
      renderHook(() =>
        useGlobalShortcuts({
          openSearch: vi.fn(),
          openQuickCreate: vi.fn(),
          openShortcuts: vi.fn(),
        }),
      );

      expect(() => dispatchKey('P', { metaKey: true, shiftKey: true })).not.toThrow();
      // No other side effects should occur
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should silently do nothing when currentCollapsed is undefined', () => {
      renderHook(() =>
        useGlobalShortcuts({
          openSearch: vi.fn(),
          openQuickCreate: vi.fn(),
          openShortcuts: vi.fn(),
          setSidebarCollapsed: vi.fn(),
          // currentCollapsed is intentionally omitted
        }),
      );

      expect(() => dispatchKey('P', { metaKey: true, shiftKey: true })).not.toThrow();
    });
  });

  // ── Cleanup ─────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove the event listener on unmount', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = setup();
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  // ── No unintended side effects ──────────────────────────

  describe('no false positives', () => {
    it('should not fire any action on unrelated keys', () => {
      setup();
      dispatchKey('a');
      dispatchKey('Escape');
      dispatchKey('Enter');
      dispatchKey('ArrowDown');
      expect(actions.openSearch).not.toHaveBeenCalled();
      expect(actions.openQuickCreate).not.toHaveBeenCalled();
      expect(actions.openShortcuts).not.toHaveBeenCalled();
    });

    it('should not fire actions on shift+unrelated meta key', () => {
      setup();
      dispatchKey('X', { metaKey: true, shiftKey: true });
      expect(actions.openSearch).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── useKeyboardShortcuts (from keyboard-shortcuts.tsx) ──────
// ═══════════════════════════════════════════════════════════════

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanupSuppressionTargets();
  });

  afterEach(() => {
    cleanupSuppressionTargets();
  });

  it('should toggle setOpen(true) on ? when currently closed', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(false, setOpen));

    dispatchKey('?');
    expect(setOpen).toHaveBeenCalledWith(true);
  });

  it('should toggle setOpen(false) on ? when currently open', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(true, setOpen));

    dispatchKey('?');
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  it('should suppress ? when typing in an input', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(false, setOpen));

    withSuppressionTarget({ tagName: 'INPUT' }, (target) => {
      dispatchKey('?', { target });
      expect(setOpen).not.toHaveBeenCalled();
    });
  });

  it('should suppress ? in contentEditable elements', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(false, setOpen));

    withSuppressionTarget({ isContentEditable: true }, (target) => {
      dispatchKey('?', { target });
      expect(setOpen).not.toHaveBeenCalled();
    });
  });

  it('should NOT suppress ? when contentEditable is explicitly disabled (false)', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(false, setOpen));

    // contentEditable="false" means isContentEditable returns false,
    // so ? should trigger the shortcuts modal.
    withSuppressionTarget({ isContentEditable: false }, (target) => {
      dispatchKey('?', { target });
      expect(setOpen).toHaveBeenCalledWith(true);
    });
  });

  it('should suppress ? on element with both INPUT tagName and contentEditable=true', () => {
    const setOpen = vi.fn();
    renderHook(() => useKeyboardShortcuts(false, setOpen));

    // Both conditions in the isInput check are true — ? should be suppressed.
    withSuppressionTarget({ tagName: 'INPUT', isContentEditable: true }, (target) => {
      dispatchKey('?', { target });
      expect(setOpen).not.toHaveBeenCalled();
    });
  });

  it('should remove event listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const setOpen = vi.fn();

    const { unmount } = renderHook(() => useKeyboardShortcuts(false, setOpen));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
