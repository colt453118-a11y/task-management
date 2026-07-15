'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  ArrowLeft,
  Send,
  AlertCircle,
  Calendar,
  User,
  Flag,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TaskTemplatePicker } from '@/components/tasks/task-template-picker';

// ─── Types ──────────────────────────────────────────────────

type User = {
  id: string;
  name: string | null;
  email: string;
};

type Project = {
  id: string;
  name: string;
  code: string | null;
};

// ─── Constants ──────────────────────────────────────────────

const priorityOptions = [
  { value: 'none', label: 'None', color: 'bg-surface-100 text-surface-600' },
  { value: 'low', label: 'Low', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { value: 'critical', label: 'Critical', color: 'bg-red-200 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
];

// ─── Page Component ─────────────────────────────────────────

export default function NewTaskPage() {
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assignedTo, setAssignedTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── Template handler ────────────────────────────────────

  const handleApplyTemplate = useCallback((templateData: { title?: string; description?: string; priority?: string }) => {
    if (templateData.title) setTitle(templateData.title);
    if (templateData.description) setDescription(templateData.description);
    if (templateData.priority) setPriority(templateData.priority);
  }, []);

  // ── Fetch form data ────────────────────────────────────

  useEffect(() => {
    async function fetchFormData() {
      try {
        const [usersRes, projectsRes] = await Promise.all([
          fetch('/api/users?limit=100'),
          fetch('/api/projects?limit=100'),
        ]);
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users ?? []);
        }
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(data.projects ?? []);
        }
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    fetchFormData();
  }, []);

  // ── Validation ─────────────────────────────────────────

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!title.trim()) {
      errors.title = 'Title is required';
    } else if (title.trim().length > 500) {
      errors.title = 'Title must be 500 characters or less';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit ─────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setError(null);

    try {
      const body: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
      };

      if (assignedTo) body.assignedTo = assignedTo;
      if (projectId) body.projectId = projectId;
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
      router.push(`/tasks/${data.task.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  const getInputClasses = (fieldName: string, hasError = false) => cn(
    'h-10 w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm transition-all duration-200',
    'dark:bg-surface-900 dark:text-surface-100',
    focusedField === fieldName
      ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-glow'
      : hasError
        ? 'border-red-300 ring-1 ring-red-500/20'
        : 'border-surface-300 hover:border-surface-400 dark:border-surface-600 dark:hover:border-surface-500',
    'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
  );

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in max-w-2xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shimmer rounded-lg" />
          <div className="space-y-2">
            <div className="h-6 w-36 shimmer rounded-md" />
            <div className="h-4 w-56 shimmer rounded-md" />
          </div>
        </div>
        <div className="rounded-xl border border-surface-200 bg-white p-6 dark:border-surface-700 dark:bg-surface-900">
          <div className="space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 shimmer rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-300/20 bg-surface-100/80 text-surface-500 transition-all hover:bg-surface-200/70 hover:text-surface-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-surface-900 dark:text-surface-50">New Task</h1>
          <p className="text-sm text-surface-500 mt-0.5">Create a new task for your team</p>
        </div>
      </div>

      {/* Template Picker */}
      <TaskTemplatePicker onApplyTemplate={handleApplyTemplate} />

      <form onSubmit={handleSubmit}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-surface-300/10 pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-surface-400" />
              Task Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((prev) => ({ ...prev, title: '' })); }}
                onFocus={() => setFocusedField('title')}
                onBlur={() => setFocusedField(null)}
                placeholder="Enter task title"
                className={getInputClasses('title', !!fieldErrors.title)}
                autoFocus
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs font-medium text-red-500 animate-slide-up">{fieldErrors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs to be done..."
                className="min-h-[120px] rounded-xl border-surface-300/30 dark:border-surface-600/30 transition-all duration-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              />
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                  <Flag className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-10 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm shadow-sm transition-all duration-200 hover:border-surface-400/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:text-surface-100 dark:border-surface-600/30"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-10 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm shadow-sm transition-all duration-200 hover:border-surface-400/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:text-surface-100 dark:border-surface-600/30"
                />
              </div>
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                  <User className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Assignee
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="h-10 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm shadow-sm transition-all duration-200 hover:border-surface-400/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:text-surface-100 dark:border-surface-600/30"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">
                  <FileText className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-surface-300/20 bg-surface-100/80 px-3 text-sm shadow-sm transition-all duration-200 hover:border-surface-400/40 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:text-surface-100 dark:border-surface-600/30"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code ? `${p.code} — ${p.name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2.5 rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error animate-slide-up">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-300/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Create Task
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
