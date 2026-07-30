import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  playNotificationChime,
  isNotificationSoundSupported,
  __resetAudioCtx,
} from '@/lib/notification-sound';

// ─── Helpers ─────────────────────────────────────

function mockAudioContext() {
  const mockOscillator = {
    type: 'sine',
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };

  const mockGain = {
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  };

  const mockCtx = {
    currentTime: 0,
    state: 'running',
    createOscillator: vi.fn(() => mockOscillator),
    createGain: vi.fn(() => mockGain),
    resume: vi.fn(),
    close: vi.fn(),
    destination: 'mock-destination',
  };

  return { mockCtx, mockOscillator, mockGain };
}

describe('playNotificationChime', () => {
  beforeEach(() => {
    __resetAudioCtx();
    // Set up AudioContext as a mock constructor (vi.fn supports `new`)
    globalThis.AudioContext = vi.fn() as unknown as typeof AudioContext;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetAudioCtx();
    // @ts-expect-error — restore global
    delete globalThis.AudioContext;
  });

  it('no-ops gracefully when AudioContext is unavailable', () => {
    // @ts-expect-error — simulate unavailable AudioContext
    delete globalThis.AudioContext;

    expect(() => playNotificationChime()).not.toThrow();
  });

  it('creates an AudioContext and plays two tones', () => {
    const { mockCtx, mockOscillator, mockGain } = mockAudioContext();
    (globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockCtx,
    );
    __resetAudioCtx(); // Force fresh context creation

    playNotificationChime();

    // Should create two oscillators and two gain nodes
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(2);

    // Should connect oscillator → gain → destination
    expect(mockOscillator.connect).toHaveBeenCalledWith(mockGain);
    expect(mockGain.connect).toHaveBeenCalledWith('mock-destination');

    // Both oscillators should start and stop
    expect(mockOscillator.start).toHaveBeenCalledTimes(2);
    expect(mockOscillator.stop).toHaveBeenCalledTimes(2);
  });

  it('sets correct frequencies for C5 and E5', () => {
    const { mockCtx, mockOscillator } = mockAudioContext();
    (globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockCtx,
    );
    __resetAudioCtx();

    playNotificationChime();

    // Two oscillators are created — each has its frequency set once
    expect(mockOscillator.frequency.setValueAtTime).toHaveBeenCalledTimes(2);

    // Collect all call arguments
    const calls = mockOscillator.frequency.setValueAtTime.mock.calls as [number, number][];
    expect(calls).toContainEqual([523.25, 0]); // C5 at time 0
    expect(calls).toContainEqual([659.25, 0.08]); // E5 at time 0.08
  });

  it('resumes suspended AudioContext', () => {
    const { mockCtx } = mockAudioContext();
    mockCtx.state = 'suspended';
    (globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockCtx,
    );
    __resetAudioCtx();

    playNotificationChime();

    expect(mockCtx.resume).toHaveBeenCalledTimes(1);
  });

  it('does not resume running AudioContext', () => {
    const { mockCtx } = mockAudioContext();
    mockCtx.state = 'running';
    (globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => mockCtx,
    );
    __resetAudioCtx();

    playNotificationChime();

    expect(mockCtx.resume).not.toHaveBeenCalled();
  });

  it('reuses the same AudioContext on repeated calls', () => {
    const { mockCtx } = mockAudioContext();
    const constructor = vi.fn(() => mockCtx);
    (globalThis.AudioContext as unknown as ReturnType<typeof vi.fn>).mockImplementation(constructor);
    __resetAudioCtx();

    playNotificationChime();
    playNotificationChime();
    playNotificationChime();

    // AudioContext constructor should be called only once
    expect(constructor).toHaveBeenCalledTimes(1);
  });

  it('handles errors when creating AudioContext', () => {
    // Restore to undefined so getAudioContext returns null
    // @ts-expect-error — simulate constructor throwing
    delete globalThis.AudioContext;

    expect(() => playNotificationChime()).not.toThrow();
  });
});

describe('isNotificationSoundSupported', () => {
  afterEach(() => {
    // @ts-expect-error — cleanup global
    delete globalThis.AudioContext;
    delete (globalThis as unknown as Record<string, unknown>).webkitAudioContext;
  });

  it('returns true when AudioContext is available', () => {
    globalThis.AudioContext = vi.fn() as unknown as typeof AudioContext;
    expect(isNotificationSoundSupported()).toBe(true);
  });

  it('returns true when webkitAudioContext is available', () => {
    (globalThis as unknown as Record<string, unknown>).webkitAudioContext = vi.fn();
    expect(isNotificationSoundSupported()).toBe(true);
  });

  it('returns false when neither is available', () => {
    // @ts-expect-error — removing AudioContext
    delete globalThis.AudioContext;
    delete (globalThis as unknown as Record<string, unknown>).webkitAudioContext;
    expect(isNotificationSoundSupported()).toBe(false);
  });
});
