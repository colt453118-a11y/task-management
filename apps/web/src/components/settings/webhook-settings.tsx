'use client';

import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Loader2,
  Plus,
  X,
  Check,
  AlertCircle,
  Edit3,
  Trash2,
  Webhook,
  Link,
  History,
  Copy,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Send,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface WebhookSubscription {
  id: string;
  name: string;
  url: string;
  events: string[];
  headers: Record<string, string>;
  isActive: boolean;
  retryCount: number;
  retryIntervalMs: number;
  timeoutMs: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  hasSecret: boolean;
  createdAt: string;
}

interface DeliveryLog {
  id: string;
  eventType: string;
  responseStatusCode: number | null;
  durationMs: number | null;
  success: boolean;
  errorMessage: string | null;
  attempt: number;
  createdAt: string;
  responseBody: string | null;
  responseHeaders: Record<string, string> | null;
  payload: Record<string, unknown>;
}

interface TestResult {
  success: boolean;
  durationMs: number;
  statusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
}

type ViewMode = 'list' | 'logs' | 'create';

// ─── Constants ──────────────────────────────────────────────

const VALID_EVENTS = [
  { value: 'task.created', label: 'Task Created', description: 'When a new task is created' },
  { value: 'task.updated', label: 'Task Updated', description: 'When a task is updated' },
  { value: 'task.deleted', label: 'Task Deleted', description: 'When a task is deleted' },
  { value: 'task.status_changed', label: 'Status Changed', description: 'When task status changes' },
  { value: 'task.assigned', label: 'Task Assigned', description: 'When a task is assigned' },
  { value: 'task.comment_added', label: 'Comment Added', description: 'When a comment is posted' },
  { value: 'project.created', label: 'Project Created', description: 'When a new project is created' },
  { value: 'project.updated', label: 'Project Updated', description: 'When a project is updated' },
  { value: 'project.deleted', label: 'Project Deleted', description: 'When a project is deleted' },
];

const EMPTY_FORM = {
  name: '',
  url: '',
  events: [] as string[],
  headers: '' as string,
  retryCount: 3,
  retryIntervalMs: 5000,
  timeoutMs: 10000,
};

// ─── Animation variants ─────────────────────────────────────

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
} as const;

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStatusColor(code: number | null): string {
  if (!code) return 'text-surface-400';
  if (code < 300) return 'text-success';
  if (code < 500) return 'text-amber-500';
  return 'text-error';
}

// ═══════════════════════════════════════════════════════════════
//  WEBHOOK SETTINGS COMPONENT
// ═══════════════════════════════════════════════════════════════

export function WebhookSettings() {
  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [logsViewId, setLogsViewId] = useState<string | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsLoading, setLogsLoading] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showHeaders, setShowHeaders] = useState(false);

  // ── Fetch webhooks ──────────────────────────────────────

  const fetchWebhooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/webhooks?limit=100');
      if (!res.ok) throw new Error('Failed to load webhooks');
      const data = await res.json();
      setSubscriptions(data.subscriptions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchWebhooks();
  }, [fetchWebhooks]);

  // ── Fetch delivery logs ─────────────────────────────────

  const fetchLogs = useCallback(async (subscriptionId: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/webhooks/${subscriptionId}/logs?limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs ?? []);
        setLogsTotal(data.total ?? 0);
      }
    } catch {
      // Ignore
    } finally {
      setLogsLoading(false);
    }
  }, []);

  // ── Open create form ────────────────────────────────────

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setCreatedSecret(null);
    setViewMode('create');
  };

  // ── Open edit form ──────────────────────────────────────

  const openEditForm = (sub: WebhookSubscription) => {
    setEditingId(sub.id);
    setForm({
      name: sub.name,
      url: sub.url,
      events: sub.events,
      headers: Object.entries(sub.headers || {})
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n'),
      retryCount: sub.retryCount,
      retryIntervalMs: sub.retryIntervalMs,
      timeoutMs: sub.timeoutMs,
    });
    setFormError(null);
    setCreatedSecret(null);
    setViewMode('create');
  };

  // ── Save webhook ────────────────────────────────────────

  const saveWebhook = async () => {
    if (!form.name.trim()) { setFormError('Name is required'); return; }
    if (!form.url.trim()) { setFormError('URL is required'); return; }
    try { new URL(form.url); } catch { setFormError('Invalid URL'); return; }
    if (form.events.length === 0) { setFormError('Select at least one event'); return; }

    // Parse headers
    const headers: Record<string, string> = {};
    if (form.headers.trim()) {
      for (const line of form.headers.split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
          headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      }
    }

    setSaving(true);
    setFormError(null);

    try {
      const url = editingId ? `/api/webhooks?id=${editingId}` : '/api/webhooks';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          events: form.events,
          headers,
          retryCount: form.retryCount,
          retryIntervalMs: form.retryIntervalMs,
          timeoutMs: form.timeoutMs,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to save');
      }

      const data = await res.json();

      // If creating, show the raw secret
      if (!editingId && data.subscription?.rawSecret) {
        setCreatedSecret(data.subscription.rawSecret);
      } else {
        setViewMode('list');
        fetchWebhooks();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save webhook');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete webhook ──────────────────────────────────────

  const deleteWebhook = async () => {
    if (!showDeleteConfirm) return;
    setDeletingId(showDeleteConfirm);
    try {
      const res = await fetch(`/api/webhooks?id=${showDeleteConfirm}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setShowDeleteConfirm(null);
      fetchWebhooks();
    } catch {
      setShowDeleteConfirm(null);
    } finally {
      setDeletingId(null);
    }
  };

  // ── Toggle webhook ──────────────────────────────────────

  const toggleWebhook = async (sub: WebhookSubscription) => {
    setToggleLoading(sub.id);
    try {
      const res = await fetch(`/api/webhooks?id=${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !sub.isActive }),
      });
      if (res.ok) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === sub.id ? { ...s, isActive: !s.isActive } : s)),
        );
      }
    } catch {
      // Ignore
    } finally {
      setToggleLoading(null);
    }
  };

  // ── Test webhook ────────────────────────────────────────

  const testWebhook = async (id: string) => {
    setTestingId(id);
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        const result: TestResult = await res.json();
        setTestResults((prev) => ({ ...prev, [id]: result }));
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: false, durationMs: 0, statusCode: null, responseBody: null, errorMessage: 'Request failed' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  // ── View logs ───────────────────────────────────────────

  const viewLogs = (id: string) => {
    setLogsViewId(id);
    setViewMode('logs');
    fetchLogs(id);
  };

  // ── Copy to clipboard ───────────────────────────────────

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      // Ignore
    }
  };

  // ── Finish creation (after showing secret) ──────────────

  const finishCreate = () => {
    setCreatedSecret(null);
    setViewMode('list');
    fetchWebhooks();
  };

  // ── Event toggle helper ─────────────────────────────────

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  // ── Render: List View ───────────────────────────────────

  const renderList = () => (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-surface-500 text-sm">
          Webhooks send real-time HTTP notifications when events occur in your workspace.
        </p>
        <Button size="sm" onClick={openCreateForm} className="h-8 rounded-lg px-3 text-xs">
          <Plus className="mr-1 h-3.5 w-3.5" />
          Create Webhook
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="shimmer h-28 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-12">
          <AlertCircle className="text-error mb-2 h-8 w-8" />
          <p className="text-error text-sm">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchWebhooks}>
            Retry
          </Button>
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="flex flex-col items-center py-16">
          <div className="border-surface-300/20 bg-surface-100/50 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border">
            <Webhook className="text-surface-400 h-7 w-7" />
          </div>
          <h3 className="text-surface-900 text-base font-semibold">
            No webhooks configured
          </h3>
          <p className="text-surface-500 mt-1.5 max-w-xs text-center text-sm">
            Create webhooks to send task and project events to external services.
          </p>
          <div className="mt-5">
            <Button onClick={openCreateForm} className="h-8 rounded-xl px-3 text-xs">
              <Plus className="mr-1 h-3.5 w-3.5" />
              Create Your First Webhook
            </Button>
          </div>
        </div>
      ) : (
        subscriptions.map((sub, idx) => {
          const testResult = testResults[sub.id];
          const isTesting = testingId === sub.id;

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={cn(
                'border-surface-300/20 bg-surface-100/80 relative overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-sm',
                !sub.isActive && 'opacity-60',
              )}
            >
              <div
                className={cn(
                  'absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r',
                  sub.isActive ? 'from-brand-400 to-brand-600' : 'from-surface-300 to-surface-400',
                )}
              />

              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        sub.isActive
                          ? 'bg-brand-500/10 text-brand-500'
                          : 'bg-surface-200/50 text-surface-400',
                      )}
                    >
                      <Webhook className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-surface-900 text-sm font-semibold">
                          {sub.name}
                        </h3>
                        <Badge
                          variant={sub.isActive ? 'success' : 'default'}
                          size="sm"
                          className="px-1.5 py-0 text-[9px]"
                        >
                          {sub.isActive ? 'Active' : 'Disabled'}
                        </Badge>
                        {sub.hasSecret && (
                          <Badge variant="primary" size="sm" className="px-1.5 py-0 text-[9px]">
                            Signed
                          </Badge>
                        )}
                      </div>
                      <p className="text-surface-500 mt-0.5 flex items-center gap-1 truncate text-xs font-mono">
                        <Link className="h-3 w-3 shrink-0" />
                        {sub.url}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {sub.events.slice(0, 4).map((event) => (
                          <span
                            key={event}
                            className="bg-surface-200/40 text-surface-500 inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[9px] font-medium"
                          >
                            {event}
                          </span>
                        ))}
                        {sub.events.length > 4 && (
                          <span className="text-surface-400 text-[9px] font-medium">
                            +{sub.events.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {/* Status indicators */}
                    {sub.lastSuccessAt && (
                      <span className="text-success text-[10px]" title={`Last success: ${formatDate(sub.lastSuccessAt)}`}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {sub.lastFailureAt && (
                      <span className="text-error text-[10px]" title={`Last failure: ${sub.lastFailureReason ?? formatDate(sub.lastFailureAt)}`}>
                        <AlertCircle className="h-3.5 w-3.5" />
                      </span>
                    )}

                    <button
                      onClick={() => testWebhook(sub.id)}
                      disabled={!!isTesting}
                      className="text-surface-500 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg p-1.5 transition-all"
                      title="Test webhook"
                    >
                      {isTesting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => viewLogs(sub.id)}
                      className="text-surface-500 hover:text-brand-500 hover:bg-brand-500/10 rounded-lg p-1.5 transition-all"
                      title="Delivery logs"
                    >
                      <History className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleWebhook(sub)}
                      disabled={toggleLoading === sub.id}
                      className={cn(
                        'rounded-lg p-1.5 transition-all',
                        sub.isActive
                          ? 'text-brand-500 hover:bg-brand-500/10'
                          : 'text-surface-400 hover:bg-surface-200/50 hover:text-surface-600',
                      )}
                      title={sub.isActive ? 'Disable' : 'Enable'}
                    >
                      {toggleLoading === sub.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : sub.isActive ? (
                        <ToggleRight className="h-3.5 w-3.5" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => openEditForm(sub)}
                      className="text-surface-500 hover:text-brand-500 hover:bg-surface-200/70 rounded-lg p-1.5 transition-all"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(sub.id)}
                      className="text-surface-500 hover:text-error hover:bg-error/5 rounded-lg p-1.5 transition-all"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Test result */}
                {testResult && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className={cn(
                      'mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs',
                      testResult.success
                        ? 'border-success/30 bg-success/5 text-success'
                        : 'border-error/30 bg-error/5 text-error',
                    )}
                  >
                    <div className="mt-0.5">
                      {testResult.success ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium">
                        {testResult.success ? 'Webhook test sent successfully' : 'Webhook test failed'}
                      </p>
                      <p className="mt-0.5 text-[10px] opacity-80">
                        {testResult.success
                          ? `Received ${testResult.statusCode} in ${formatDuration(testResult.durationMs)}`
                          : testResult.errorMessage ?? 'No response'}
                      </p>
                      {testResult.responseBody && (
                        <pre className="mt-1 max-h-20 overflow-auto rounded bg-black/5 p-1 text-[9px]">
                          {testResult.responseBody}
                        </pre>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Meta */}
                <div className="text-surface-400 mt-2 flex items-center gap-3 border-t border-surface-300/10 pt-2 text-[10px]">
                  <span>Created {formatDate(sub.createdAt)}</span>
                  <span>·</span>
                  <span>Retries: {sub.retryCount}</span>
                  <span>·</span>
                  <span>Timeout: {formatDuration(sub.timeoutMs)}</span>
                </div>
              </div>
            </motion.div>
          );
        })
      )}
    </div>
  );

  // ── Render: Create/Edit Form ────────────────────────────

  const renderForm = () => (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-surface-900 text-lg font-semibold">
            {editingId ? 'Edit Webhook' : 'Create Webhook'}
          </h3>
          <p className="text-surface-500 mt-0.5 text-sm">
            {editingId
              ? 'Update webhook settings and events.'
              : 'Configure a webhook to receive real-time events.'}
          </p>
        </div>
        <button
          onClick={() => setViewMode('list')}
          className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Show secret on creation */}
      {createdSecret && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-success/5 border-success/30 mb-6 rounded-xl border p-4"
        >
          <div className="flex items-start gap-3">
            <div className="bg-success/10 mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg">
              <Check className="text-success h-4 w-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-success text-sm font-semibold">Webhook Created</h4>
              <p className="success-500 mt-1 text-xs">
                Your webhook signing secret is shown below. <strong>Save it now — it will not be shown again.</strong>
              </p>
              <div className="bg-surface-100 mt-3 flex items-center gap-2 rounded-xl border p-2">
                <code className="flex-1 truncate text-xs font-mono">{createdSecret}</code>
                <button
                  onClick={() => copyToClipboard(createdSecret)}
                  className="text-surface-500 hover:text-brand-500 hover:bg-brand-500/10 shrink-0 rounded-lg p-1.5 transition-all"
                >
                  {copiedSecret ? (
                    <CheckCheck className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="text-surface-400 mt-2 text-[10px]">
                Use this secret to verify webhook payloads via HMAC-SHA256 signatures in the <code className="bg-surface-200/50 rounded px-1">X-Webhook-Signature</code> header.
              </p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={finishCreate} className="h-8 rounded-lg px-3 text-xs">
              Done
            </Button>
          </div>
        </motion.div>
      )}

      {!createdSecret && (
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g., Slack notifications"
              className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
            />
          </div>

          {/* URL */}
          <div>
            <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
              Endpoint URL
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://hooks.example.com/webhook"
              className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
            />
          </div>

          {/* Events */}
          <div>
            <label className="text-surface-500 mb-2 block text-xs font-semibold uppercase tracking-wider">
              Events
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {VALID_EVENTS.map((evt) => (
                <label
                  key={evt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-xl border p-2.5 transition-all',
                    form.events.includes(evt.value)
                      ? 'border-brand-500 bg-brand-500/10'
                      : 'border-surface-300/20 hover:border-surface-300/40 bg-surface-100/50 ',
                  )}
                >
                  <input
                    type="checkbox"
                    checked={form.events.includes(evt.value)}
                    onChange={() => toggleEvent(evt.value)}
                    className="border-surface-400 text-brand-500 focus:ring-brand-500 rounded"
                  />
                  <div>
                    <p className="text-surface-700 text-xs font-medium">{evt.label}</p>
                    <p className="text-surface-500 text-[9px]">{evt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Custom Headers */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                Custom Headers <span className="font-normal normal-case">(optional)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowHeaders(!showHeaders)}
                className="text-brand-500 hover:bg-brand-500/10 rounded-lg px-1.5 py-0.5 text-[10px] font-medium transition-colors"
              >
                {showHeaders ? 'Hide' : 'Show'}
              </button>
            </div>
            {showHeaders && (
              <textarea
                value={form.headers}
                onChange={(e) => setForm((p) => ({ ...p, headers: e.target.value }))}
                placeholder={'Authorization: Bearer xxx\nX-Custom-Header: value'}
                rows={3}
                className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-xs font-mono transition-all focus:outline-none focus:ring-2"
              />
            )}
          </div>

          {/* Retry & Timeout */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={form.retryCount}
                onChange={(e) => setForm((p) => ({ ...p, retryCount: Math.max(0, Number(e.target.value)) }))}
                className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                Interval (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={60000}
                step={1000}
                value={form.retryIntervalMs}
                onChange={(e) => setForm((p) => ({ ...p, retryIntervalMs: Math.max(1000, Number(e.target.value)) }))}
                className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                Timeout (ms)
              </label>
              <input
                type="number"
                min={1000}
                max={30000}
                step={1000}
                value={form.timeoutMs}
                onChange={(e) => setForm((p) => ({ ...p, timeoutMs: Math.max(1000, Number(e.target.value)) }))}
                className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
              />
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {formError}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-surface-300/10 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8 rounded-lg px-3 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={saveWebhook}
              disabled={saving}
              size="sm"
              className="h-8 rounded-lg px-3 text-xs"
            >
              {saving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="mr-1 h-3.5 w-3.5" />
              )}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // ── Render: Delivery Logs View ──────────────────────────

  const renderLogs = () => {
    const sub = subscriptions.find((s) => s.id === logsViewId);
    if (!sub) return null;

    return (
      <div>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-surface-900 text-lg font-semibold">
              Delivery Logs
            </h3>
            <p className="text-surface-500 mt-0.5 flex items-center gap-1.5 text-sm">
              <Webhook className="h-3.5 w-3.5" />
              {sub.name}
              <span className="text-surface-400">·</span>
              <code className="text-surface-400 text-xs">{sub.url}</code>
            </p>
          </div>
          <button
            onClick={() => setViewMode('list')}
            className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-surface-300/20 bg-surface-100/80 relative overflow-hidden rounded-2xl border">
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-surface-300 to-surface-400 opacity-40" />

          {logsLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="shimmer h-12 rounded-xl" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-10">
              <History className="text-surface-400 mb-2 h-8 w-8" />
              <p className="text-surface-500 text-sm">No delivery logs yet</p>
              <p className="text-surface-400 mt-1 text-xs">Logs appear after events are sent or you test the webhook.</p>
            </div>
          ) : (
            <div className="divide-surface-300/10 divide-y">
              {logs.map((log) => (
                <div key={log.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                        log.success ? 'bg-success/10 text-success' : 'bg-error/10 text-error',
                      )}
                    >
                      {log.success ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-surface-900 text-xs font-medium">
                          {log.eventType}
                        </span>
                        <span className={cn('text-xs font-mono font-medium', getStatusColor(log.responseStatusCode))}>
                          {log.responseStatusCode ?? '—'}
                        </span>
                        <Badge
                          variant={log.success ? 'success' : 'danger'}
                          size="sm"
                          className="px-1.5 py-0 text-[9px]"
                        >
                          {log.success ? 'Delivered' : 'Failed'}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[10px] text-surface-500">
                        <span>Attempt {log.attempt}</span>
                        <span>·</span>
                        <span>{formatDuration(log.durationMs)}</span>
                        <span>·</span>
                        <span>{formatDate(log.createdAt)}</span>
                      </div>
                      {log.errorMessage && (
                        <p className="text-error mt-1 text-[10px]">{log.errorMessage}</p>
                      )}
                      {log.responseBody && (
                        <details className="mt-1">
                          <summary className="text-surface-500 hover:text-surface-700 cursor-pointer text-[10px]">
                            View response
                          </summary>
                          <pre className="bg-surface-100 mt-1 max-h-32 overflow-auto rounded-lg p-2 text-[9px] font-mono">
                            {log.responseBody}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {logsTotal > logs.length && (
            <div className="border-surface-300/10 flex items-center justify-center border-t p-3">
              <span className="text-surface-500 text-[10px]">
                Showing {logs.length} of {logsTotal} logs
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 rounded-lg px-3 text-xs"
          >
            Back to Webhooks
          </Button>
        </div>
      </div>
    );
  };

  // ── Render ──────────────────────────────────────────────

  return (
    <motion.div variants={itemVariants}>
      {viewMode === 'list' && renderList()}
      {viewMode === 'create' && renderForm()}
      {viewMode === 'logs' && renderLogs()}

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="border-surface-300/30 bg-surface-50/95 w-full max-w-sm rounded-2xl border p-6 shadow-lg backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-error/10 flex h-10 w-10 items-center justify-center rounded-full">
                  <AlertCircle className="text-error h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-surface-900 text-lg font-semibold">Delete Webhook</h3>
                  <p className="text-surface-500 text-sm">Are you sure? This action cannot be undone.</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="rounded-lg">Cancel</Button>
                <Button
                  onClick={deleteWebhook}
                  disabled={deletingId === showDeleteConfirm}
                  className="rounded-lg bg-red-500 hover:bg-red-600 text-white"
                >
                  {deletingId === showDeleteConfirm ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
