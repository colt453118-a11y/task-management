// Vitest global setup for @workmanagement/web
// This runs before each test file to configure the test environment.
import '@testing-library/jest-dom';

// ─── ResizeObserver polyfill ────────────────────────────────────
// The DependencyVisualizer uses ResizeObserver for container measurement.
// jsdom/happy-dom don't implement it, so we provide a stub.
/** @see https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver */
class ResizeObserverStub {
  private callback: ResizeObserverCallback;
  private observedElements: Set<Element>;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    this.observedElements = new Set();
  }

  observe(target: Element) {
    this.observedElements.add(target);
    // Fire an initial observation with 0 dimensions so components can render
    this.callback(
      [{ target, contentRect: { x: 0, y: 0, width: 600, height: 400, top: 0, right: 600, bottom: 400, left: 0 } } as ResizeObserverEntry],
      this,
    );
  }

  unobserve(target: Element) {
    this.observedElements.delete(target);
  }

  disconnect() {
    this.observedElements.clear();
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}
