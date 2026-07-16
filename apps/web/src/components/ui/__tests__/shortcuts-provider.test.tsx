import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ShortcutsProvider } from '../shortcuts-provider';

// ─── Mocks ──────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock KeyboardShortcutsModal to avoid radix Dialog portal issues in jsdom
vi.mock('../keyboard-shortcuts', () => ({
  KeyboardShortcutsModal: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div data-testid="shortcuts-modal" data-open={String(open)}>
      <button data-testid="modal-close" onClick={() => onOpenChange(false)}>
        Close modal
      </button>
    </div>
  ),
}));

// ─── Helpers ────────────────────────────────────────────────

function dispatchKey(
  key: string,
  opts: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
  } = {},
) {
  const event = new KeyboardEvent('keydown', {
    key,
    metaKey: opts.metaKey ?? false,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
}

// ═══════════════════════════════════════════════════════════════
// ─── Tests ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('ShortcutsProvider integration', () => {
  const searchHandler = vi.fn();
  const quickCreateHandler = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.addEventListener('open-search', searchHandler);
    window.addEventListener('open-quick-create', quickCreateHandler);
  });

  afterEach(() => {
    window.removeEventListener('open-search', searchHandler);
    window.removeEventListener('open-quick-create', quickCreateHandler);
  });

  function setup() {
    return render(
      <ShortcutsProvider>
        <div data-testid="child">content</div>
      </ShortcutsProvider>,
    );
  }

  describe('⌘K — dispatches open-search custom event', () => {
    it('should dispatch open-search on ⌘K', () => {
      setup();
      act(() => {
        dispatchKey('k', { metaKey: true });
      });
      expect(searchHandler).toHaveBeenCalledOnce();
      expect(quickCreateHandler).not.toHaveBeenCalled();
    });

    it('should dispatch open-search on Ctrl+K', () => {
      setup();
      act(() => {
        dispatchKey('k', { ctrlKey: true });
      });
      expect(searchHandler).toHaveBeenCalledOnce();
    });

    it('should not dispatch open-search on K alone', () => {
      setup();
      act(() => {
        dispatchKey('k');
      });
      expect(searchHandler).not.toHaveBeenCalled();
    });
  });

  describe('⌘T — dispatches open-quick-create custom event', () => {
    it('should dispatch open-quick-create on ⌘T', () => {
      setup();
      act(() => {
        dispatchKey('t', { metaKey: true });
      });
      expect(quickCreateHandler).toHaveBeenCalledOnce();
      expect(searchHandler).not.toHaveBeenCalled();
    });

    it('should dispatch open-quick-create on Ctrl+T', () => {
      setup();
      act(() => {
        dispatchKey('t', { ctrlKey: true });
      });
      expect(quickCreateHandler).toHaveBeenCalledOnce();
    });
  });

  describe('? — toggles shortcuts modal', () => {
    it('should open the modal on ? press', () => {
      const screen = setup();
      const modal = screen.getByTestId('shortcuts-modal');

      // Initially closed
      expect(modal.getAttribute('data-open')).toBe('false');

      act(() => {
        dispatchKey('?');
      });

      // Now open
      expect(modal.getAttribute('data-open')).toBe('true');
    });

    it('should close the modal via the close button', () => {
      const screen = setup();
      const modal = screen.getByTestId('shortcuts-modal');

      // Open via ?
      act(() => {
        dispatchKey('?');
      });
      expect(modal.getAttribute('data-open')).toBe('true');

      // Close via button
      act(() => {
        screen.getByTestId('modal-close').click();
      });
      expect(modal.getAttribute('data-open')).toBe('false');
    });

    it('should keep modal open on consecutive ? presses (always opens)', () => {
      // The provider always calls setShortcutsOpen(true) via openShortcuts.
      // It does not auto-close — the modal must be closed via onOpenChange.
      const screen = setup();
      const modal = screen.getByTestId('shortcuts-modal');

      act(() => {
        dispatchKey('?');
      });
      expect(modal.getAttribute('data-open')).toBe('true');

      // Second ? press still sets open=true (no-op since already true)
      act(() => {
        dispatchKey('?');
      });
      expect(modal.getAttribute('data-open')).toBe('true');
    });
  });

  describe('renders children', () => {
    it('should render child content', () => {
      const screen = setup();
      expect(screen.getByTestId('child').textContent).toBe('content');
    });
  });

  describe('no interference between shortcuts', () => {
    it('should only fire the correct event for each shortcut', () => {
      setup();

      act(() => {
        dispatchKey('k', { metaKey: true });
      });
      expect(searchHandler).toHaveBeenCalledTimes(1);
      expect(quickCreateHandler).not.toHaveBeenCalled();

      act(() => {
        dispatchKey('t', { metaKey: true });
      });
      expect(searchHandler).toHaveBeenCalledTimes(1);
      expect(quickCreateHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanup', () => {
    it('should remove event listeners on unmount', () => {
      // Set up spies before render
      const addSpy = vi.spyOn(document, 'addEventListener');
      const removeSpy = vi.spyOn(document, 'removeEventListener');

      const { unmount } = setup();

      // Hook registered a keydown listener
      expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

      unmount();

      // Listener removed
      expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('should not dispatch events after unmount', () => {
      const { unmount } = setup();
      unmount();

      act(() => {
        dispatchKey('k', { metaKey: true });
      });
      expect(searchHandler).not.toHaveBeenCalled();
    });
  });
});
