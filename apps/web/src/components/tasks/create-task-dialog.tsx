'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, AlertCircle, Calendar, User, Flag, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

type User = { id: string; name: string | null; email: string };

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Constants ──────────────────────────────────────────────

const priorityOptions = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
];

// ─── Component ───────────────────────────────────────────────

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');

  // ── Fetch users ────────────────────────────────────────────

  useEffect(() => {
    if (open) {
      fetch('/api/users?limit=50')
        .then((r) => r.json())
        .then((d) => setUsers(d.users ?? []))
        .catch(() => {});
    }
  }, [open]);

  // ── Submit ────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      setTitleError('Title is required');
      return;
    }
    setTitleError('');

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      };
      if (assignedTo) body.assignedTo = assignedTo;
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message ?? 'Failed to create task');
      }

      const data = await res.json();
      onOpenChange(false);
      router.push(`/tasks/${data.task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <Dialog key={open ? 'open' : 'closed'} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-surface-300/20 top-[10%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 shadow-xl sm:rounded-2xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="border-surface-300/20 dark:border-surface-700/20 flex items-center justify-between border-b px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="from-brand-400 to-brand-600 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-surface-900 dark:text-surface-100 text-sm font-semibold">
                  Quick Create Task
                </h2>
                <p className="text-surface-500 text-[11px]">
                  Press{' '}
                  <kbd className="border-surface-300/20 bg-surface-100/80 dark:bg-surface-800/80 rounded border px-1 py-0.5 font-mono text-[10px]">
                    Enter
                  </kbd>{' '}
                  to submit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="space-y-4 px-5 py-4">
            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleError('');
                }}
                placeholder="What needs to be done?"
                className={cn(
                  'bg-surface-100/80 placeholder:text-surface-400 dark:bg-surface-800/80 h-10 w-full rounded-xl border px-3 text-sm transition-all duration-200',
                  titleError
                    ? 'border-red-300 ring-1 ring-red-500/20'
                    : 'border-surface-300/30 hover:border-surface-400/40',
                  'focus:border-brand-500 focus:ring-brand-500/20 focus:outline-none focus:ring-2',
                )}
                autoFocus
              />
              {titleError && <p className="mt-1 text-xs font-medium text-red-500">{titleError}</p>}
            </div>

            {/* Description */}
            <div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)..."
                className="border-surface-300/30 dark:border-surface-600/30 focus:border-brand-500 focus:ring-brand-500/20 min-h-[80px] rounded-xl transition-all duration-200 focus:ring-2"
              />
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-surface-500 mb-1 block text-xs font-medium">
                  <Flag className="-mt-0.5 mr-1 inline h-3 w-3" />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="border-surface-300/20 bg-surface-100/80 hover:border-surface-400/30 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/80 h-9 w-full rounded-xl border px-2.5 text-xs transition-all focus:outline-none focus:ring-2"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-surface-500 mb-1 block text-xs font-medium">
                  <Calendar className="-mt-0.5 mr-1 inline h-3 w-3" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="border-surface-300/20 bg-surface-100/80 hover:border-surface-400/30 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/80 h-9 w-full rounded-xl border px-2.5 text-xs transition-all focus:outline-none focus:ring-2"
                />
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-surface-500 mb-1 block text-xs font-medium">
                <User className="-mt-0.5 mr-1 inline h-3 w-3" />
                Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="border-surface-300/20 bg-surface-100/80 hover:border-surface-400/30 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/80 h-9 w-full rounded-xl border px-2.5 text-xs transition-all focus:outline-none focus:ring-2"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name ?? u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="border-error/20 bg-error/5 text-error flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-surface-300/20 dark:border-surface-700/20 bg-surface-100/40 dark:bg-surface-800/40 flex items-center justify-between border-t px-5 py-3">
            <p className="text-surface-400 text-[10px]">
              You can also use{' '}
              <kbd className="border-surface-300/20 bg-surface-100/80 rounded border px-1 py-0.5 font-mono text-[10px]">
                ⌘T
              </kbd>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!title.trim() || submitting}
                className="h-8 rounded-xl text-xs"
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1 h-3.5 w-3.5" />
                )}
                Create
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
