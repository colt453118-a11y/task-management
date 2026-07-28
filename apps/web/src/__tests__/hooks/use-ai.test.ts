import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useAISummary,
  useAIPriority,
  useAIRiskPrediction,
  useAIDuplicateDetection,
  useAIWritingAssistant,
  useAIEODSummary,
} from '@/hooks/use-ai';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

function mockStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('useAISummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('initializes with defaults', () => {
    const { result } = renderHook(() => useAISummary());
    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('generates a summary from streaming response', async () => {
    mockFetch.mockResolvedValueOnce(mockStreamResponse('This is a summary of the task.'));
    const { result } = renderHook(() => useAISummary());

    await act(async () => {
      await result.current.generateSummary('Task title', 'Task description');
    });

    expect(result.current.summary).toBe('This is a summary of the task.');
    expect(result.current.loading).toBe(false);
    expect(mockFetch).toHaveBeenCalledWith('/api/ai/summarize', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('Task title'),
    }));
  });

  it('handles fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API error'));
    const { result } = renderHook(() => useAISummary());

    await act(async () => {
      await result.current.generateSummary('Title', 'Desc');
    });

    expect(result.current.error).toContain('API error');
    expect(result.current.loading).toBe(false);
  });

  it('setSummary allows clearing the summary', () => {
    const { result } = renderHook(() => useAISummary());
    act(() => { result.current.setSummary('Some text'); });
    expect(result.current.summary).toBe('Some text');
    act(() => { result.current.setSummary(null); });
    expect(result.current.summary).toBeNull();
  });
});

describe('useAIPriority', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('suggests a priority from streaming JSON', async () => {
    const json = JSON.stringify({ priority: 'high', reason: 'Urgent deadline' });
    mockFetch.mockResolvedValueOnce(mockStreamResponse(json));
    const { result } = renderHook(() => useAIPriority());

    await act(async () => {
      await result.current.suggestPriority({ title: 'Fix bug', description: 'Critical' });
    });

    expect(result.current.suggestion?.priority).toBe('high');
    expect(result.current.suggestion?.reason).toBe('Urgent deadline');
  });

  it('falls back on invalid JSON response', async () => {
    mockFetch.mockResolvedValueOnce(mockStreamResponse('not json'));
    const { result } = renderHook(() => useAIPriority());

    await act(async () => {
      await result.current.suggestPriority({ title: 'Task' });
    });

    expect(result.current.suggestion?.priority).toBe('medium');
    expect(result.current.suggestion?.reason).toContain('Could not parse');
  });
});

describe('useAIRiskPrediction', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('predicts risk from streaming JSON', async () => {
    const json = JSON.stringify({ riskLevel: 'high', riskScore: 75, reason: 'Behind schedule' });
    mockFetch.mockResolvedValueOnce(mockStreamResponse(json));
    const { result } = renderHook(() => useAIRiskPrediction());

    await act(async () => {
      await result.current.predictRisk({ title: 'Task', status: 'in_progress' });
    });

    expect(result.current.prediction?.riskLevel).toBe('high');
    expect(result.current.prediction?.riskScore).toBe(75);
  });

  it('falls back on parse failure', async () => {
    mockFetch.mockResolvedValueOnce(mockStreamResponse('broken'));
    const { result } = renderHook(() => useAIRiskPrediction());

    await act(async () => {
      await result.current.predictRisk({ title: 'T', status: 'open' });
    });

    expect(result.current.prediction?.riskLevel).toBe('medium');
    expect(result.current.prediction?.riskScore).toBe(50);
  });
});

describe('useAIDuplicateDetection', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty when title is empty', async () => {
    const { result } = renderHook(() => useAIDuplicateDetection());
    await act(async () => {
      await result.current.checkDuplicates('', ['Test']);
    });
    expect(result.current.duplicates).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty when existing titles list is empty', async () => {
    const { result } = renderHook(() => useAIDuplicateDetection());
    await act(async () => {
      await result.current.checkDuplicates('Test', []);
    });
    expect(result.current.duplicates).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('detects duplicates from streaming JSON', async () => {
    const json = JSON.stringify({
      potentialDuplicates: [{ title: 'Duplicate', similarityScore: 0.9, reason: 'Similar title' }],
    });
    mockFetch.mockResolvedValueOnce(mockStreamResponse(json));
    const { result } = renderHook(() => useAIDuplicateDetection());

    await act(async () => {
      await result.current.checkDuplicates('New Task', ['Existing Task']);
    });

    expect(result.current.duplicates).toHaveLength(1);
    expect(result.current.duplicates[0]!.similarityScore).toBe(0.9);
  });
});

describe('useAIWritingAssistant', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('does nothing with empty input', async () => {
    const { result } = renderHook(() => useAIWritingAssistant());
    await act(async () => {
      await result.current.improve('', 'make it better');
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('improves text via streaming', async () => {
    mockFetch.mockResolvedValueOnce(mockStreamResponse('Improved text here'));
    const { result } = renderHook(() => useAIWritingAssistant());

    await act(async () => {
      await result.current.improve('Original text', 'Make it professional');
    });

    expect(result.current.result).toBe('Improved text here');
  });

  it('setResult allows clearing', () => {
    const { result } = renderHook(() => useAIWritingAssistant());
    act(() => { result.current.setResult('Hello'); });
    expect(result.current.result).toBe('Hello');
  });
});

describe('useAIEODSummary', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('generates EOD summary from streaming', async () => {
    mockFetch.mockResolvedValueOnce(mockStreamResponse('End of day report'));
    const { result } = renderHook(() => useAIEODSummary());

    await act(async () => {
      await result.current.generateEODSummary('Completed tasks...');
    });

    expect(result.current.summary).toBe('End of day report');
  });

  it('handles error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed'));
    const { result } = renderHook(() => useAIEODSummary());

    await act(async () => {
      await result.current.generateEODSummary('Tasks');
    });

    expect(result.current.error).toBeDefined();
  });
});
