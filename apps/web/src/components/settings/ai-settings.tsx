'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Loader2,
  Check,
  AlertCircle,
  Save,
  Sparkles,
  Eye,
  EyeOff,
  Bot,
  Key,
  Globe,
  RefreshCw,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface AISettingsData {
  provider: 'openai' | 'anthropic';
  model: string;
  hasKey: boolean;
  updatedAt: string | null;
}

interface AISettingsForm {
  provider: 'openai' | 'anthropic';
  model: string;
  apiKey: string;
}

// ─── Constants ──────────────────────────────────────────────

const PROVIDERS = [
  {
    value: 'openai' as const,
    label: 'OpenAI',
    description: 'GPT-4o, GPT-4o-mini, and more',
    icon: Sparkles,
    defaultModel: 'gpt-4o-mini',
    models: [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo',
      'o1',
      'o1-mini',
    ],
  },
  {
    value: 'anthropic' as const,
    label: 'Anthropic',
    description: 'Claude 3.5 Sonnet, Haiku, and more',
    icon: Bot,
    defaultModel: 'claude-3-haiku-20240307',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
  },
];

// ─── Component ──────────────────────────────────────────────

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
} as const;

export function AISettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const [config, setConfig] = useState<AISettingsData | null>(null);
  const [form, setForm] = useState<AISettingsForm>({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
  });

  // ── Fetch current config ────────────────────────────────

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/settings/ai');
      if (!res.ok) throw new Error('Failed to load AI settings');
      const data = await res.json();
      setConfig(data.settings);
      setForm((prev) => ({
        ...prev,
        provider: data.settings.provider ?? 'openai',
        model: data.settings.model ?? 'gpt-4o-mini',
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
  }, [fetchConfig]);

  // ── Save config ─────────────────────────────────────────

  const saveConfig = async () => {
    if (!form.model.trim()) {
      setError('Model name is required');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        model: form.model.trim(),
      };

      // Only send apiKey if the user entered a new one
      if (form.apiKey.trim()) {
        body.apiKey = form.apiKey.trim();
      }

      const res = await fetch('/api/settings/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to save');
      }

      setSuccess('AI settings saved successfully');
      setForm((prev) => ({ ...prev, apiKey: '' }));
      fetchConfig();

      // Clear success after 3s
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  // ── Test connection ─────────────────────────────────────

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message,
      });
    } catch {
      setTestResult({
        success: false,
        message: 'Failed to test connection',
      });
    } finally {
      setTesting(false);
    }
  };

  // ── Handle provider change ─────────────────────────────

  const handleProviderChange = (provider: 'openai' | 'anthropic') => {
    const providerConfig = PROVIDERS.find((p) => p.value === provider);
    setForm((prev) => ({
      ...prev,
      provider,
      model: providerConfig?.defaultModel ?? prev.model,
    }));
  };

  // ── Loading state ──────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-8 w-48 rounded-xl" />
        <div className="shimmer h-12 w-full rounded-xl" />
        <div className="shimmer h-12 w-full rounded-xl" />
        <div className="shimmer h-12 w-full rounded-xl" />
      </div>
    );
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === form.provider) ?? PROVIDERS[0]!;

  return (
    <motion.div variants={itemVariants} className="space-y-6">
      {/* Status Banner */}
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
          config?.hasKey
            ? 'border-success/30 bg-success/5 text-success'
            : 'border-amber-500/30 bg-amber-500/5 text-amber-600 '
        }`}
      >
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            config?.hasKey ? 'bg-success/10' : 'bg-amber-500/10'
          }`}
        >
          {config?.hasKey ? (
            <Check className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">
            {config?.hasKey
              ? 'AI provider configured'
              : 'No AI provider configured'}
          </p>
          <p className="text-xs opacity-80">
            {config?.hasKey
              ? `Using ${config.provider} (${config.model})`
              : 'AI features require an API key. Configure below or set OPENAI_API_KEY in your .env file.'}
          </p>
        </div>
        {config?.updatedAt && (
          <span className="text-[10px] opacity-60">
            Updated {new Date(config.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Provider Selection */}
      <div>
        <label className="text-surface-500 mb-2 block text-xs font-semibold uppercase tracking-wider">
          <Globe className="-ml-0.5 mr-1 inline h-3 w-3" />
          AI Provider
        </label>
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  form.provider === p.value
                    ? 'border-brand-500 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-surface-300/20 bg-surface-100/50 hover:border-surface-300/40'
                }`}
              >
                <div
                  className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl ${
                    form.provider === p.value
                      ? 'bg-brand-500/20 text-brand-500'
                      : 'bg-surface-200/50 text-surface-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-surface-900 text-sm font-semibold">
                    {p.label}
                  </p>
                  <p className="text-surface-500 mt-0.5 text-xs">{p.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model */}
      <div>
        <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
          Model
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
              placeholder={selectedProvider.defaultModel}
              className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedProvider.models.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, model: m }))}
              className={`rounded-lg border px-2 py-1 text-[10px] font-medium transition-all ${
                form.model === m
                  ? 'border-brand-500 bg-brand-500/10 text-brand-500'
                  : 'border-surface-300/20 text-surface-500 hover:border-surface-300/40 hover:bg-surface-200/50 '
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="text-surface-400 mt-1 text-[10px]">
          Click a suggested model or type any model name.
        </p>
      </div>

      {/* API Key */}
      <div>
        <label className="text-surface-500 mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          <Key className="h-3 w-3" />
          API Key
          {config?.hasKey && (
            <span className="bg-success/10 text-success ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium normal-case">
              Configured
            </span>
          )}
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={
              config?.hasKey
                ? 'Leave blank to keep current key'
                : `sk-... or sk-ant-... (${selectedProvider.label} API key)`
            }
            className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 pr-10 text-sm transition-all focus:outline-none focus:ring-2"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="text-surface-500 hover:text-surface-700 absolute inset-y-0 right-0 flex items-center pr-3 transition-colors"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-surface-400 mt-1 text-[10px]">
          Key is stored encrypted at rest. It cannot be read back — only overwritten or cleared.
          {!config?.hasKey && (
            <>
              {' '}Set via <kbd className="bg-surface-200/50 rounded px-1 font-mono">OPENAI_API_KEY</kbd> env var as fallback.
            </>
          )}
        </p>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={testConnection}
          disabled={testing}
          className="h-8 rounded-lg px-3 text-xs"
        >
          {testing ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
          )}
          Test Connection
        </Button>
        {testResult && (
          <div
            className={`flex items-center gap-1.5 text-xs ${
              testResult.success ? 'text-success' : 'text-amber-500'
            }`}
          >
            {testResult.success ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5" />
            )}
            {testResult.message}
          </div>
        )}
      </div>

      {/* Error & Success Messages */}
      {error && (
        <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="bg-success/10 text-success flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
          <Check className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Save Button */}
      <div className="flex items-center justify-end gap-2 border-t border-surface-300/10 pt-4">
        <Button
          onClick={saveConfig}
          disabled={saving}
          className="h-8 rounded-lg px-3 text-xs"
        >
          {saving ? (
            <>
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-1 h-3.5 w-3.5" />
              Save AI Settings
            </>
          )}
        </Button>
      </div>

      {/* Security Note */}
      <div className="border-surface-300/20 bg-amber-500/5 flex items-start gap-2.5 rounded-xl border px-4 py-3">
        <Key className="text-amber-500 mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-surface-500 text-xs leading-relaxed">
          <p className="font-medium text-amber-600 ">Security Note</p>
          <p className="mt-0.5">
            API keys are encrypted at rest using AES-256-GCM before being stored in the database.
            The encryption key is derived from the <kbd className="bg-surface-200/50 rounded px-1 font-mono">ENCRYPTION_KEY</kbd> environment variable.
            Keys are never exposed in API responses — only their configured status is shown.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
