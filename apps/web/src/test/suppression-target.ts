// ─── Suppression Target Helpers ─────────────────────────────────
//
// Shared test utilities for verifying shortcut suppression logic.
// Uses Object.defineProperty instead of real DOM elements to avoid
// differences across DOM environments (jsdom vs happy-dom).
//
// The checked property in the hook code is:
//   target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
//
// Usage:
//   import { withSuppressionTarget } from '@/test/suppression-target';
//
//   withSuppressionTarget({ tagName: 'INPUT' }, (target) => {
//     dispatchKey('k', { metaKey: true, target });
//     expect(action).not.toHaveBeenCalled();
//   });

export interface SuppressionTargetProps {
  tagName?: string;
  isContentEditable?: boolean;
}

/**
 * Create a plain <div> with an overridden tagName and/or isContentEditable
 * to simulate the suppression check without relying on real DOM element
 * types or the contentEditable attribute (which behaves differently
 * across DOM environments like jsdom vs happy-dom).
 */
export function createSuppressionTarget(props: SuppressionTargetProps): HTMLElement {
  const el = document.createElement('div');
  if (props.tagName) {
    Object.defineProperty(el, 'tagName', { value: props.tagName, configurable: true });
  }
  if (props.isContentEditable !== undefined) {
    Object.defineProperty(el, 'isContentEditable', {
      value: props.isContentEditable,
      configurable: true,
    });
  }
  return el;
}

/**
 * Run a test block with a suppression target that auto-cleans up.
 * Appends the target to document.body, invokes fn, then removes it
 * in a finally block to prevent test pollution.
 */
export function withSuppressionTarget(
  props: SuppressionTargetProps,
  fn: (target: HTMLElement) => void,
): void {
  const target = createSuppressionTarget(props);
  target.setAttribute('data-test-suppression', 'true');
  document.body.appendChild(target);
  try {
    fn(target);
  } finally {
    target.remove();
  }
}

/**
 * Remove any orphaned suppression targets that weren't cleaned up
 * by try/finally (e.g. if a test assertion throws before finally runs).
 * Call this in beforeEach / afterEach.
 */
export function cleanupSuppressionTargets(): void {
  document.body.querySelectorAll('[data-test-suppression]').forEach((el) => el.remove());
}
