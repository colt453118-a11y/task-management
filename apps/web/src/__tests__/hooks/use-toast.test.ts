import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, toast } from '@/hooks/use-toast';

/**
 * Toast tests — uses shared module-level state.
 * Each test isolates by checking relative behavior (newest toast)
 * rather than expecting absolute toast counts.
 */
describe('useToast', () => {
  it('starts with initial state', () => {
    const { result } = renderHook(() => useToast());
    expect(Array.isArray(result.current.toasts)).toBe(true);
  });

  it('adds a toast via the toast() function', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Hello', description: 'World' });
    });
    const found = result.current.toasts.find((t) => t.title === 'Hello');
    expect(found).toBeDefined();
    expect(found!.description).toBe('World');
    expect(found!.open).toBe(true);
    expect(found!.id).toBeDefined();
  });

  it('adds a toast with variant', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      toast({ title: 'Error', variant: 'error' });
    });
    const found = result.current.toasts.find((t) => t.title === 'Error');
    expect(found).toBeDefined();
    expect(found!.variant).toBe('error');
  });

  it('limits toasts to 5', () => {
    const { result } = renderHook(() => useToast());
    act(() => {
      for (let i = 0; i < 10; i++) {
        toast({ title: `Toast ${i}` });
      }
    });
    expect(result.current.toasts.length).toBeLessThanOrEqual(5);
    // Confirm newest is at the front
    expect(result.current.toasts[0]!.title).toBe('Toast 9');
  });

  it('returns dismiss and update functions', () => {
    renderHook(() => useToast());
    let res: ReturnType<typeof toast>;
    act(() => {
      res = toast({ title: 'Test' });
    });
    expect(res!).toBeDefined();
    expect(typeof res!.dismiss).toBe('function');
    expect(typeof res!.update).toBe('function');
    expect(res!.id).toBeDefined();
  });

  it('dismisses a toast', () => {
    const { result } = renderHook(() => useToast());
    let toastId: string;
    act(() => {
      const res = toast({ title: 'Test' });
      toastId = res.id;
    });
    const fresh = result.current.toasts.find((t) => t.title === 'Test');
    expect(fresh).toBeDefined();

    act(() => {
      result.current.dismiss(toastId!);
    });
    const dismissed = result.current.toasts.find((t) => t.id === toastId);
    expect(dismissed!.open).toBe(false);
  });

  it('updates a toast', () => {
    const { result } = renderHook(() => useToast());
    let res: ReturnType<typeof toast>;
    act(() => {
      res = toast({ title: 'Original' });
    });
    act(() => {
      res!.update({ title: 'Updated' } as any);
    });
    const updated = result.current.toasts.find((t) => t.id === res!.id);
    expect(updated!.title).toBe('Updated');
  });

  it('generates unique ids', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const res = toast({ title: `Toast ${i}` });
      ids.add(res.id);
    }
    expect(ids.size).toBe(100);
  });

  it('handles unmount gracefully', () => {
    const { unmount } = renderHook(() => useToast());
    unmount();
    expect(() => {
      act(() => toast({ title: 'After unmount' }));
    }).not.toThrow();
  });
});
