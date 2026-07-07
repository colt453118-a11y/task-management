'use client';

import { useEffect, useState } from 'react';
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
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'critical', label: 'Critical' },
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
        // Non-critical - dropdowns will just be empty
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

  // ── Render ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-surface-900 dark:text-surface-50">New Task</h1>
          <p className="text-sm text-surface-500 mt-0.5">Create a new task for your team</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-surface-400" />
              Task Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setFieldErrors((prev) => ({ ...prev, title: '' })); }}
                placeholder="Enter task title"
                className={`w-full rounded-md border bg-white px-3 py-2 text-sm shadow-sm transition-colors
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
                  dark:bg-surface-900 dark:text-surface-100
                  ${fieldErrors.title
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : 'border-surface-300 focus-visible:ring-brand-500 dark:border-surface-600'
                  }`}
                autoFocus
              />
              {fieldErrors.title && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Description
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what needs to be done..."
                className="min-h-[120px]"
              />
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  <Flag className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="h-9 w-full rounded-md border border-surface-300 bg-white px-3 text-sm shadow-sm
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                    dark:bg-surface-900 dark:text-surface-100 dark:border-surface-600"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-9 w-full rounded-md border border-surface-300 bg-white px-3 text-sm shadow-sm
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                    dark:bg-surface-900 dark:text-surface-100 dark:border-surface-600"
                />
              </div>
            </div>

            {/* Two-column row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assignee */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  <User className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Assignee
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="h-9 w-full rounded-md border border-surface-300 bg-white px-3 text-sm shadow-sm
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                    dark:bg-surface-900 dark:text-surface-100 dark:border-surface-600"
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name ?? u.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                  <FileText className="h-3.5 w-3.5 inline mr-1 -mt-0.5 text-surface-400" />
                  Project
                </label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="h-9 w-full rounded-md border border-surface-300 bg-white px-3 text-sm shadow-sm
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                    dark:bg-surface-900 dark:text-surface-100 dark:border-surface-600"
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
              <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:bg-red-900/20">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-200 dark:border-surface-700">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
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
