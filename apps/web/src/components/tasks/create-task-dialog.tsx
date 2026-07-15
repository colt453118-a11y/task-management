'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Send,
  AlertCircle,
  Calendar,
  User,
  Flag,
  X,
  Sparkles,
} from 'lucide-react';
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
      <DialogContent className="top-[10%] max-w-lg translate-y-0 p-0 gap-0 overflow-hidden sm:rounded-2xl border-surface-300/20 shadow-xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300/20 dark:border-surface-700/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-surface-900 dark:text-surface-100">
                  Quick Create Task
                </h2>
                <p className="text-[11px] text-surface-500">
                  Press <kbd className="rounded border border-surface-300/20 bg-surface-100/80 px-1 py-0.5 text-[10px] font-mono dark:bg-surface-800/80">Enter</kbd> to submit
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1.5 text-surface-500 transition-all hover:bg-surface-200/70 hover:text-surface-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Title */}
            <div>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleError(''); }}
                placeholder="What needs to be done?"
                className={cn(
                  'h-10 w-full rounded-xl border bg-surface-100/80 px-3 text-sm placeholder:text-surface-400 transition-all duration-200 dark:bg-surface-800/80',
                  titleError
                    ? 'border-red-300 ring-1 ring-red-500/20'
                    : 'border-surface-300/30 hover:border-surface-400/40',
                  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
                )}
                autoFocus
              />
              {titleError && (
                <p className="mt-1 text-xs font-medium text-red-500">{titleError}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description (optional)..."
                className="min-h-[80px] rounded-xl border-surface-300/30 dark:border-surface-600/30 transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  <Flag className="h-3 w-3 inline mr-1 -mt-0.5" />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-9 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-2.5 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800/80"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  <Calendar className="h-3 w-3 inline mr-1 -mt-0.5" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-2.5 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800/80"
                />
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-medium text-surface-500 mb-1">
                <User className="h-3 w-3 inline mr-1 -mt-0.5" />
                Assignee
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-2.5 text-xs transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800/80"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                ))}
              </select>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-3 py-2.5 text-xs text-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-300/20 dark:border-surface-700/20 bg-surface-100/40 dark:bg-surface-800/40">
            <p className="text-[10px] text-surface-400">
              You can also use <kbd className="rounded border border-surface-300/20 bg-surface-100/80 px-1 py-0.5 text-[10px] font-mono">⌘T</kbd>
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="rounded-xl text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!title.trim() || submitting}
                className="rounded-xl text-xs h-8"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
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
