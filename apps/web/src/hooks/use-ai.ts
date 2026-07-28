'use client';

import { useState, useCallback } from 'react';

// ─── Hook: AI Task Summary ─────────────────────────────────

export function useAISummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = useCallback(async (title: string, description: string) => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'task', data: { title, description } }),
      });

      if (!res.ok) throw new Error('Failed to generate summary');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      setSummary(text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, loading, error, generateSummary, setSummary };
}

// ─── Hook: AI Priority Suggestion ──────────────────────────

export interface PrioritySuggestion {
  priority: string;
  reason: string;
}

export function useAIPriority() {
  const [suggestion, setSuggestion] = useState<PrioritySuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestPriority = useCallback(
    async (task: { title: string; description?: string; dueDate?: string; labels?: string[]; estimatedHours?: string }) => {
      setLoading(true);
      setError(null);
      setSuggestion(null);

      try {
        const res = await fetch('/api/ai/suggest-priority', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });

        if (!res.ok) throw new Error('Failed to get suggestion');

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let text = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }

        try {
          const parsed = JSON.parse(text.trim());
          setSuggestion(parsed);
        } catch {
          // If streaming returned partial JSON, use what we have
          setSuggestion({ priority: 'medium', reason: 'Could not parse AI response' });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get priority suggestion');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { suggestion, loading, error, suggestPriority };
}

// ─── Hook: AI Deadline Risk ─────────────────────────────────

export interface RiskPrediction {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  reason: string;
}

export function useAIRiskPrediction() {
  const [prediction, setPrediction] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const predictRisk = useCallback(
    async (task: { title: string; dueDate?: string; status: string; estimatedHours?: string; description?: string }) => {
      setLoading(true);
      setError(null);
      setPrediction(null);

      try {
        const res = await fetch('/api/ai/predict-risk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task),
        });

        if (!res.ok) throw new Error('Failed to get risk prediction');

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let text = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
        }

        try {
          const parsed = JSON.parse(text.trim());
          setPrediction(parsed);
        } catch {
          setPrediction({ riskLevel: 'medium', riskScore: 50, reason: 'Could not parse AI response' });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to get risk prediction');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { prediction, loading, error, predictRisk };
}

// ─── Hook: AI Duplicate Detection ──────────────────────────

export interface DuplicateMatch {
  title: string;
  similarityScore: number;
  reason: string;
}

export function useAIDuplicateDetection() {
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkDuplicates = useCallback(async (title: string, existingTitles: string[]) => {
    if (!title.trim() || existingTitles.length === 0) {
      setDuplicates([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/detect-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, existingTitles }),
      });

      if (!res.ok) throw new Error('Failed to check duplicates');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      try {
        const parsed = JSON.parse(text.trim());
        setDuplicates(parsed.potentialDuplicates ?? []);
      } catch {
        setDuplicates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check duplicates');
    } finally {
      setLoading(false);
    }
  }, []);

  return { duplicates, loading, error, checkDuplicates };
}

// ─── Hook: AI Writing Assistant ────────────────────────────

export function useAIWritingAssistant() {
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const improve = useCallback(async (inputText: string, instruction: string) => {
    if (!inputText.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'writing_assist',
          data: { text: inputText, instruction },
        }),
      });

      if (!res.ok) throw new Error('Failed to improve text');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let resultText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resultText += decoder.decode(value, { stream: true });
      }

      setResult(resultText.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve text');
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, error, improve, setResult };
}

// ─── Hook: AI EOD Report Summary ───────────────────────────

export function useAIEODSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateEODSummary = useCallback(async (tasksSummary: string) => {
    setLoading(true);
    setError(null);
    setSummary(null);

    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'eod_report', data: { tasksSummary } }),
      });

      if (!res.ok) throw new Error('Failed to generate EOD summary');

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
      }

      setSummary(text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate EOD summary');
    } finally {
      setLoading(false);
    }
  }, []);

  return { summary, loading, error, generateEODSummary, setSummary };
}
