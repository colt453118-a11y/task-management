'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Loader2,
  Check,
  AlertCircle,
  Save,
  Clock,
  Sparkles,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

export interface EODSettings {
  preferredTime: string;
  aiSummaryEnabled: boolean;
}

// ─── Constants ──────────────────────────────────────────────

const TIME_OPTIONS = [
  { value: '14:00', label: '2:00 PM' },
  { value: '15:00', label: '3:00 PM' },
  { value: '16:00', label: '4:00 PM' },
  { value: '17:00', label: '5:00 PM' },
  { value: '18:00', label: '6:00 PM' },
  { value: '19:00', label: '7:00 PM' },
  { value: '20:00', label: '8:00 PM' },
  { value: '21:00', label: '9:00 PM' },
  { value: '22:00', label: '10:00 PM' },
  { value: '23:00', label: '11:00 PM' },
  { value: '23:59', label: 'End of day (11:59 PM)' },
];

export const DEFAULT_EOD_SETTINGS: EODSettings = {
  preferredTime: '17:00',
  aiSummaryEnabled: true,
};

// ─── Toggle Component ───────────────────────────────────────

function Toggle({ enabled, onChange, disabled, ariaLabel }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:ring-offset-2 focus:ring-offset-surface-50 ${
        enabled ? 'bg-brand-500' : 'bg-surface-300/50 '
      } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      role="switch"
      aria-checked={enabled}
      aria-label={ariaLabel}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
          enabled ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Component ──────────────────────────────────────────────

export function EODScheduleSettings({
  initialSettings = null,
}: {
  initialSettings?: EODSettings | null;
} = {}) {
  // When the parent seeds the EOD settings from the server-rendered organization
  // payload, paint immediately (this card's description is the settings page's
  // LCP element) instead of showing a shimmer until a client fetch resolves.
  const [hadInitial] = useState(() => initialSettings != null);
  const [loading, setLoading] = useState(initialSettings == null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [settings, setSettings] = useState<EODSettings>(initialSettings ?? DEFAULT_EOD_SETTINGS);

  // ── Fetch current settings ─────────────────────────────
  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/organization');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      const org = data.organization;
      if (org?.settings?.eod) {
        const eod = org.settings.eod as EODSettings;
        setSettings({
          preferredTime: eod.preferredTime ?? DEFAULT_EOD_SETTINGS.preferredTime,
          aiSummaryEnabled: eod.aiSummaryEnabled ?? DEFAULT_EOD_SETTINGS.aiSummaryEnabled,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The server already seeded these settings — skip the redundant mount fetch.
    if (hadInitial) return;
    startTransition(() => {
      fetchSettings();
    });
  }, [fetchSettings, hadInitial]);

  // ── Save settings ──────────────────────────────────────
  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await fetch('/api/organization/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eod: {
            preferredTime: settings.preferredTime,
            aiSummaryEnabled: settings.aiSummaryEnabled,
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to save settings');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock className="text-surface-400 h-4 w-4" />
          <h2 className="text-surface-900 text-base font-semibold">
            EOD Report Schedule
          </h2>
        </div>
        <div className="space-y-4">
          <div className="shimmer h-12 w-full rounded-xl" />
          <div className="shimmer h-12 w-full rounded-xl" />
          <div className="shimmer h-10 w-24 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <h2 className="text-surface-900 mb-1 flex items-center gap-2 text-base font-semibold">
        <Clock className="text-surface-400 h-4 w-4" />
        EOD Report Schedule
      </h2>
      <p className="text-surface-500 mb-5 text-sm">
        Configure when the daily End-of-Day report snapshot is auto-generated
        and whether AI summaries are included.
      </p>

      <div className="space-y-5">
        {/* Preferred Time */}
        <div>
          <label className="text-surface-500 mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <Clock className="h-3 w-3" />
            Preferred Generation Time
          </label>
          <p className="text-surface-400 mb-2 text-[11px]">
            The cron job runs at this time to capture the day&apos;s task data.
          </p>
          <select
            aria-label="Preferred generation time"
            value={settings.preferredTime}
            onChange={(e) => setSettings((prev) => ({ ...prev, preferredTime: e.target.value }))}
            className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full max-w-xs rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
          >
            {TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* AI Summary Toggle */}
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          className="border-surface-300/20 hover:border-brand-500/20 hover:bg-surface-200/40 flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-200"
        >
          <div className="flex items-center gap-3">
            <div className={settings.aiSummaryEnabled ? 'text-brand-500' : 'text-surface-400'}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-surface-900 text-sm font-medium">
                AI Summary Generation
              </p>
              <p className="text-surface-500 text-xs">
                {settings.aiSummaryEnabled
                  ? 'AI summaries are generated for each EOD snapshot'
                  : 'Snapshots are captured without AI-generated summaries'}
              </p>
            </div>
          </div>
          <Toggle
            ariaLabel="AI summaries for EOD snapshots"
            enabled={settings.aiSummaryEnabled}
            onChange={(v) => setSettings((prev) => ({ ...prev, aiSummaryEnabled: v }))}
          />
        </motion.div>

        {/* Status + Save */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            {error && (
              <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
            {success && (
              <div className="bg-success/10 text-success flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                <Check className="h-4 w-4 shrink-0" />
                Settings saved
              </div>
            )}
          </div>
          <Button onClick={saveSettings} disabled={saving} className="h-8 rounded-lg px-3 text-xs">
            {saving ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1 h-3.5 w-3.5" />
            )}
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
