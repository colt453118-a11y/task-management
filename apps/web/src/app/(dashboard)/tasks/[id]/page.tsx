'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor, RichTextViewer } from '@/components/tasks/rich-text-editor';
import { TaskChecklist } from '@/components/tasks/task-checklist';
import { TaskActivityFeed } from '@/components/tasks/task-activity-feed';
import { TaskWatcherButton } from '@/components/tasks/task-watcher-button';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import {
  Loader2,
  ArrowLeft,
  MessageSquare,
  Paperclip,
  Trash2,
  Send,
  Calendar,
  User,
  Clock,
  Tag,
  AlertCircle,
  FileText,
  Upload,
  Link2,
  Plus,
  X,
  Edit3,
  Check,
  Play,
  StopCircle,
  Timer,
  History,
  Copy,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type Task = {
  id: string;
  title: string;
  description: string | null;
  taskIdDisplay: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  projectId: string | null;
  departmentId: string | null;
  teamId: string | null;
  createdBy: string;
  updatedBy: string | null;
  dueDate: string | null;
  startDate: string | null;
  estimatedHours: string | null;
  actualHours: string | null;
  labels: string[] | null;
  tags: string[] | null;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

type Comment = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  isInternalNote: boolean;
  parentId: string | null;
  isEdited: boolean;
  editedAt: string | null;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null } | null;
};

type Attachment = {
  id: string;
  taskId: string;
  userId: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  createdAt: string;
  user: { id: string; name: string | null } | null;
};

type TimeEntry = {
  id: string;
  taskId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  entryType: string;
  description: string | null;
  createdAt: string;
  user: { id: string; name: string | null; avatarUrl: string | null } | null;
};

type Dependency = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependencyType: string;
  createdAt: string;
  dependsOnTask?: { id: string; title: string; taskIdDisplay: string; status: string };
  blockingTask?: { id: string; title: string; taskIdDisplay: string; status: string };
};

// ─── Constants ──────────────────────────────────────────────

const statusColors: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default', open: 'primary', in_progress: 'warning', blocked: 'danger',
  under_review: 'info', on_hold: 'warning', completed: 'success', closed: 'primary',
  reopened: 'warning', cancelled: 'default', archived: 'default',
};

const statusOptions = [
  'draft', 'open', 'in_progress', 'blocked', 'under_review',
  'on_hold', 'completed', 'closed', 'reopened', 'cancelled', 'archived',
];

const priorityLabel: Record<string, string> = {
  none: 'None', low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent', critical: 'Critical',
};

const priorityOptions = ['none', 'low', 'medium', 'high', 'urgent', 'critical'];

// ─── Helpers ────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  const first = (parts[0] ?? '').charAt(0).toUpperCase();
  const last = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase();
  return first + last;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

// ─── Page Component ─────────────────────────────────────────

export default function TaskDetailPage() {
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Comment form
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Dependencies
  const [blockedBy, setBlockedBy] = useState<Dependency[]>([]);
  const [blocking, setBlocking] = useState<Dependency[]>([]);
  const [depTaskId, setDepTaskId] = useState('');
  const [addingDep, setAddingDep] = useState(false);
  const [depError, setDepError] = useState<string | null>(null);

  // Description editing
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [savingDescription, setSavingDescription] = useState(false);

  // Time tracking
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  const [manualSubmitting, setManualSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState('00:00:00');

  const runningTimer = timeEntries.find((e) => !e.endTime) ?? null;

  const secondsSince = (startTime: string): number => {
    return Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  };

  const formatElapsed = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDuration = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Toast
  const { toast } = useToast();

  // Duplicate task
  const [duplicating, setDuplicating] = useState(false);

  // Status / Priority editing
  const [updating, setUpdating] = useState<string | null>(null);

  // ── Fetch task data ─────────────────────────────────────

  const fetchTask = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch task');
      const data = await res.json();
      setTask(data.task);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load task');
    }
  }, [taskId]);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data.comments ?? []);
      }
    } catch {
      // Comments are non-critical
    }
  }, [taskId]);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments ?? []);
      }
    } catch {
      // Attachments are non-critical
    }
  }, [taskId]);

  const fetchDependencies = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`);
      if (res.ok) {
        const data = await res.json();
        setBlockedBy(data.blockedBy ?? []);
        setBlocking(data.blocking ?? []);
      }
    } catch {
      // Dependencies are non-critical
    }
  }, [taskId]);

  const fetchTimeEntries = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`);
      if (res.ok) {
        const data = await res.json();
        setTimeEntries(data.entries ?? []);
      }
    } catch {
      // Time entries are non-critical
    }
  }, [taskId]);

  useEffect(() => {
    startTransition(() => {
      Promise.all([fetchTask(), fetchComments(), fetchAttachments(), fetchDependencies(), fetchTimeEntries()])
        .finally(() => setLoading(false));
    });
  }, [fetchTask, fetchComments, fetchAttachments, fetchDependencies, fetchTimeEntries]);

  // ── Status / Priority update ────────────────────────────

  const updateField = async (field: string, value: string) => {
    setUpdating(field);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setTask(data.task);
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
    } finally {
      setUpdating(null);
    }
  };

  // ── Submit comment ──────────────────────────────────────

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() }),
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const data = await res.json();
      setComments((prev) => [data.comment, ...prev]);
      setCommentText('');
    } catch (err) {
      console.error('Failed to submit comment:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  // ── Submit attachment ───────────────────────────────────

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to upload attachment');
      }
      const data = await res.json();
      setAttachments((prev) => [data.attachment, ...prev]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
    }

    // Reset input
    e.target.value = '';
  };

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/attachments?attachmentId=${attachmentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete attachment');
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  // ── Timer interval ───────────────────────────────────

  useEffect(() => {
    if (!runningTimer) return;
    const interval = setInterval(() => {
      setElapsed(formatElapsed(secondsSince(runningTimer.startTime)));
    }, 1000);
    return () => clearInterval(interval);
  }, [runningTimer]);

  // ── Start timer ───────────────────────────────────────

  const startTimer = async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryType: 'timer' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to start timer');
      }
      fetchTimeEntries();
    } catch (err) {
      console.error('Failed to start timer:', err);
    }
  };

  // ── Stop timer ────────────────────────────────────────

  const stopTimer = async (entryId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries?entryId=${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error('Failed to stop timer');
      fetchTimeEntries();
    } catch (err) {
      console.error('Failed to stop timer:', err);
    }
  };

  // ── Delete time entry ─────────────────────────────────

  const deleteTimeEntry = async (entryId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries?entryId=${entryId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete time entry');
      setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    } catch (err) {
      console.error('Failed to delete time entry:', err);
    }
  };

  // ── Submit manual entry ───────────────────────────────

  const submitManualEntry = async () => {
    const minutes = parseInt(manualMinutes, 10);
    if (isNaN(minutes) || minutes < 1) return;
    setManualSubmitting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/time-entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entryType: 'manual',
          durationMinutes: minutes,
          description: manualDescription.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Failed to log time');
      fetchTimeEntries();
      setShowManualForm(false);
      setManualMinutes('');
      setManualDescription('');
    } catch (err) {
      console.error('Failed to log time:', err);
    } finally {
      setManualSubmitting(false);
    }
  };

  // ── Add dependency ────────────────────────────────────

  const addDependency = async () => {
    const targetId = depTaskId.trim();
    if (!targetId) return;
    setAddingDep(true);
    setDepError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependsOnTaskId: targetId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to add dependency');
      }
      setDepTaskId('');
      fetchDependencies();
    } catch (err) {
      setDepError(err instanceof Error ? err.message : 'Failed to add dependency');
    } finally {
      setAddingDep(false);
    }
  };

  // ── Remove dependency ──────────────────────────────────

  const removeDependency = async (dependencyId: string) => {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/dependencies?dependencyId=${dependencyId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to remove dependency');
      setBlockedBy((prev) => prev.filter((d) => d.id !== dependencyId));
      setBlocking((prev) => prev.filter((d) => d.id !== dependencyId));
    } catch (err) {
      console.error('Failed to remove dependency:', err);
    }
  };

  // ── Save description ──────────────────────────────────

  const saveDescription = async () => {
    if (!task) return;
    setSavingDescription(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: descriptionDraft === '<p></p>' || !descriptionDraft.trim()
            ? null
            : descriptionDraft,
        }),
      });
      if (!res.ok) throw new Error('Failed to save description');
      const data = await res.json();
      setTask(data.task);
      setEditingDescription(false);
    } catch (err) {
      console.error('Failed to save description:', err);
    } finally {
      setSavingDescription(false);
    }
  };

  // ── Delete comment ──────────────────────────────────────

  const deleteComment = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/tasks/${taskId}/comments?commentId=${commentId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Failed to delete comment');
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  // ── Render states ───────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shimmer rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-24 shimmer rounded-lg" />
            <div className="h-7 w-72 shimmer rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 shimmer rounded-xl" />
            <div className="h-64 shimmer rounded-xl" />
            <div className="h-40 shimmer rounded-xl" />
          </div>
          <div className="space-y-6">
            <div className="h-72 shimmer rounded-xl" />
            <div className="h-48 shimmer rounded-xl" />
            <div className="h-48 shimmer rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-surface-500 mb-4" />
        <h2 className="text-xl font-semibold text-surface-300">Task not found</h2>
        <p className="text-sm text-surface-500 mt-1">This task may have been deleted or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.href = '/tasks'}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to tasks
        </Button>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-error mb-4" />
        <h2 className="text-xl font-semibold text-surface-300">Failed to load task</h2>
        <p className="text-sm text-error mt-1">{error}</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => { setLoading(true); setError(null); fetchTask(); }}>
          Try again
        </Button>
      </motion.div>
    );
  }

  if (!task) return null;

  // ── Main render ─────────────────────────────────────────

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-300/20 bg-surface-100/80 text-surface-500 transition-all hover:bg-surface-200/70 hover:text-surface-600"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-surface-500">
              <span className="font-mono text-xs">{task.taskIdDisplay}</span>
              <Badge variant={statusColors[task.status] ?? 'default'}>
                {task.status.replace(/_/g, ' ')}
              </Badge>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                task.priority === 'critical' || task.priority === 'urgent' || task.priority === 'high'
                  ? 'bg-red-500/10 text-red-400'
                  : task.priority === 'medium'
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'bg-surface-200 text-surface-500'
              }`}>
                {priorityLabel[task.priority] ?? task.priority}
              </span>
            </div>
            <h1 className="text-xl font-semibold text-surface-900 mt-1">
              {task.title}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              if (!task || duplicating) return;
              setDuplicating(true);
              try {
                const res = await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: `${task.title} (copy)`,
                    description: task.description,
                    priority: task.priority,
                    projectId: task.projectId,
                    assignedTo: task.assignedTo,
                  }),
                });
                if (!res.ok) {
                  const data = await res.json().catch(() => ({}));
                  throw new Error(data.error?.message ?? 'Failed to duplicate task');
                }
                const data = await res.json();
                window.location.href = `/tasks/${data.task.id}`;
              } catch (err) {
                toast({ title: 'Failed to duplicate task', description: err instanceof Error ? err.message : 'An unexpected error occurred', variant: 'error' });
              } finally {
                setDuplicating(false);
              }
            }}
            disabled={duplicating}
            className="rounded-xl text-xs h-8"
            title="Duplicate this task"
          >
            {duplicating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5 mr-1" />
            )}
            Duplicate
          </Button>
          <TaskWatcherButton taskId={task.id} />
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <FileText className="h-4 w-4 text-surface-500" />
                Description
              </h2>
              {!editingDescription && (
                <button
                  onClick={() => {
                    setDescriptionDraft(task.description ?? '');
                    setEditingDescription(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-surface-500 transition-all hover:bg-surface-200 hover:text-surface-300"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
              )}
            </div>
            <div className="px-5 py-4">
              {editingDescription ? (
                <div className="space-y-3">
                  <RichTextEditor
                    content={descriptionDraft}
                    onChange={setDescriptionDraft}
                    placeholder="Describe the task in detail..."
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingDescription(false);
                        setDescriptionDraft(task.description ?? '');
                      }}
                      disabled={savingDescription}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveDescription}
                      disabled={savingDescription}
                      className="rounded-xl"
                    >
                      {savingDescription ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <Check className="h-3.5 w-3.5 mr-1" />
                      )}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <RichTextViewer content={task.description} />
              )}
            </div>
          </motion.div>

          {/* Checklist */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Check className="h-4 w-4 text-surface-500" />
                Checklist
              </h2>
            </div>
            <div className="px-5 py-4">
              <TaskChecklist taskId={task.id} taskStatus={task.status} />
            </div>
          </motion.div>

          {/* Comments */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <MessageSquare className="h-4 w-4 text-surface-500" />
                Comments
                <span className="text-xs font-normal text-surface-500 ml-1">({comments.length})</span>
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Comment input */}
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-medium text-white">
                  {getInitials('You')}
                </div>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Write a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[60px] rounded-xl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && !submittingComment) {
                        e.preventDefault();
                        submitComment();
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={submitComment}
                      disabled={!commentText.trim() || submittingComment}
                      className="rounded-xl"
                    >
                      {submittingComment ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Send className="h-3 w-3 mr-1" />
                      )}
                      Send
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comment list */}
              {comments.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-4">
                  No comments yet. Start the conversation.
                </p>
              ) : (
                <div className="space-y-4 pt-2">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3 group transition-all duration-200">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-medium text-white">
                        {getInitials(comment.user?.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-surface-900">
                            {comment.user?.name ?? 'Unknown user'}
                          </span>
                          <span className="text-xs text-surface-500">
                            {new Date(comment.createdAt).toLocaleString()}
                          </span>
                          {comment.isEdited && (
                            <span className="text-xs text-surface-500">(edited)</span>
                          )}
                        </div>
                        <p className="text-sm text-surface-300 mt-1 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => deleteComment(comment.id)}
                            className="text-xs text-surface-500 hover:text-error transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>              {/* Activity Feed */}
              <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
                <div className="px-5 py-4 border-b border-surface-300/10">
                  <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                    <History className="h-4 w-4 text-surface-500" />
                    Activity
                  </h2>
                </div>
                <div className="px-5 py-4">
                  <TaskActivityFeed taskId={task.id} />
                </div>
              </motion.div>

              {/* Attachments */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Paperclip className="h-4 w-4 text-surface-500" />
                Attachments
                <span className="text-xs font-normal text-surface-500 ml-1">({attachments.length})</span>
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Upload button */}
              {uploadError && (
                <p className="text-sm text-error bg-error/5 rounded-xl px-3 py-2">{uploadError}</p>
              )}
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-dashed border-surface-400/30 px-4 py-2 text-sm text-surface-500 hover:border-brand-500/40 hover:text-brand-500 transition-all duration-200">
                  <Upload className="h-4 w-4" />
                  Upload file
                  <input type="file" className="hidden" onChange={handleFileUpload} />
                </label>
              </div>

              {/* Attachment list */}
              {attachments.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-2">No attachments yet.</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map((att) => (
                    <div key={att.id} className="flex items-center justify-between rounded-xl border border-surface-300/10 bg-surface-200/30 px-3 py-2 transition-all hover:bg-surface-200/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <FileText className="h-4 w-4 shrink-0 text-surface-500" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 truncate">{att.fileName}</p>
                          <p className="text-xs text-surface-500">{formatFileSize(att.fileSize)} · {att.user?.name ?? 'Unknown'}</p>
                        </div>
                      </div>
                      <button onClick={() => deleteAttachment(att.id)} className="shrink-0 rounded-lg p-1 text-surface-500 hover:text-error hover:bg-error/5">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Sidebar - Task Properties */}
        <div className="space-y-6">
          {/* Properties card */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold text-surface-900">Properties</h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Status</label>
                <select
                  value={task.status}
                  onChange={(e) => updateField('status', e.target.value)}
                  disabled={updating === 'status'}
                  className="h-9 w-full rounded-xl border border-surface-300/20 bg-surface-200/50 px-3 text-sm transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:bg-surface-800/80"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Priority</label>
                <select
                  value={task.priority}
                  onChange={(e) => updateField('priority', e.target.value)}
                  disabled={updating === 'priority'}
                  className="h-9 w-full rounded-xl border border-surface-300/20 bg-surface-200/50 px-3 text-sm transition-all hover:border-surface-400/30 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:bg-surface-800/80"
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p}>{priorityLabel[p]}</option>
                  ))}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Due Date</label>
                <div className="flex items-center gap-2 text-sm text-surface-300">
                  <Calendar className="h-3.5 w-3.5 text-surface-500" />
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                    : <span className="text-surface-500">Not set</span>}
                </div>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Assignee</label>
                <div className="flex items-center gap-2 text-sm text-surface-300">
                  <User className="h-3.5 w-3.5 text-surface-500" />
                  {task.assignedTo ? (
                    <span className="font-mono text-xs">{task.assignedTo.substring(0, 12)}...</span>
                  ) : (
                    <span className="text-surface-500">Unassigned</span>
                  )}
                </div>
              </div>

              {/* Category */}
              {task.category && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Category</label>
                  <div className="flex items-center gap-2 text-sm text-surface-300">
                    <Tag className="h-3.5 w-3.5 text-surface-500" />
                    {task.category}
                  </div>
                </div>
              )}

              {/* Labels */}
              {task.labels && task.labels.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Labels</label>
                  <div className="flex flex-wrap gap-1">
                    {task.labels.map((label, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-400">
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Estimated Hours */}
              {task.estimatedHours && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Estimated Hours</label>
                  <div className="flex items-center gap-2 text-sm text-surface-300">
                    <Clock className="h-3.5 w-3.5 text-surface-500" />
                    {task.estimatedHours}h
                    {task.actualHours && (
                      <span className="text-surface-500">({task.actualHours}h logged)</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Dependencies */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Link2 className="h-4 w-4 text-surface-500" />
                Dependencies
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Blocked by */}
              {blockedBy.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-500 mb-2 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
                    Blocked by
                  </p>
                  <div className="space-y-1.5">
                    {blockedBy.map((dep) => (
                      <div key={dep.id} className="group flex items-center justify-between rounded-xl border border-surface-300/10 bg-amber-500/5 px-2.5 py-1.5">
                        <a href={`/tasks/${dep.dependsOnTaskId}`} className="min-w-0 text-sm text-surface-900 hover:text-brand-500 truncate">
                          <span className="font-mono text-xs text-surface-500">{dep.dependsOnTask?.taskIdDisplay ?? ''}</span>{' '}
                          {dep.dependsOnTask?.title ?? dep.dependsOnTaskId.substring(0, 8)}
                        </a>
                        <button onClick={() => removeDependency(dep.id)} className="shrink-0 ml-2 rounded p-0.5 text-surface-500 opacity-0 group-hover:opacity-100 hover:text-error transition-opacity">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocking */}
              {blocking.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-surface-500 mb-2 flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-full bg-error" />
                    Blocking
                  </p>
                  <div className="space-y-1.5">
                    {blocking.map((dep) => (
                      <div key={dep.id} className="group flex items-center justify-between rounded-xl border border-surface-300/10 bg-error/5 px-2.5 py-1.5">
                        <a href={`/tasks/${dep.taskId}`} className="min-w-0 text-sm text-surface-900 hover:text-brand-500 truncate">
                          <span className="font-mono text-xs text-surface-500">{dep.blockingTask?.taskIdDisplay ?? ''}</span>{' '}
                          {dep.blockingTask?.title ?? dep.taskId.substring(0, 8)}
                        </a>
                        <button onClick={() => removeDependency(dep.id)} className="shrink-0 ml-2 rounded p-0.5 text-surface-500 opacity-0 group-hover:opacity-100 hover:text-error transition-opacity">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {blockedBy.length === 0 && blocking.length === 0 && (
                <p className="text-sm text-surface-500 text-center py-2">No dependencies.</p>
              )}

              {/* Add dependency */}
              <div className="pt-1 border-t border-surface-300/20">
                {depError && <p className="text-xs text-error mb-2">{depError}</p>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste task UUID to link..."
                    value={depTaskId}
                    onChange={(e) => setDepTaskId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !addingDep) { e.preventDefault(); addDependency(); } }}
                    className="flex-1 rounded-xl border border-surface-300/20 bg-surface-200/50 px-2.5 py-1.5 text-xs placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800/80"
                  />
                  <Button size="sm" variant="outline" onClick={addDependency} disabled={!depTaskId.trim() || addingDep} className="shrink-0 rounded-xl">
                    {addingDep ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Time Tracking */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Timer className="h-4 w-4 text-surface-500" />
                Time Tracking
              </h2>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Current timer */}
              {runningTimer ? (
                <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 text-center">
                  <p className="text-2xl font-mono font-bold text-brand-400 tabular-nums">{elapsed}</p>
                  <p className="text-xs text-surface-500 mt-1">Started {new Date(runningTimer.startTime).toLocaleTimeString()}</p>
                  <Button size="sm" variant="outline" className="mt-3 border-error/30 text-error hover:bg-error/5 rounded-xl" onClick={() => stopTimer(runningTimer.id)}>
                    <StopCircle className="h-4 w-4 mr-1" />
                    Stop Timer
                  </Button>
                </div>
              ) : (
                <Button variant="outline" className="w-full border-brand-500/30 text-brand-400 hover:bg-brand-500/5 rounded-xl" onClick={startTimer}>
                  <Play className="h-4 w-4 mr-1.5" />
                  Start Timer
                </Button>
              )}

              {/* Manual log toggle */}
              {!showManualForm && !runningTimer && (
                <button onClick={() => setShowManualForm(true)} className="w-full text-xs text-surface-500 hover:text-surface-300 py-1 transition-colors">
                  + Log time manually
                </button>
              )}

              {/* Manual log form */}
              {showManualForm && (
                <div className="space-y-2 pt-1 border-t border-surface-300/20">
                  <p className="text-xs font-medium text-surface-500">Log time manually</p>
                  <div className="flex gap-2">
                    <input type="number" min="1" placeholder="Minutes" value={manualMinutes} onChange={(e) => setManualMinutes(e.target.value)}
                      className="w-24 rounded-xl border border-surface-300/30 bg-surface-200 px-2.5 py-1.5 text-sm placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                    <input type="text" placeholder="Description (optional)" value={manualDescription} onChange={(e) => setManualDescription(e.target.value)}
                      className="flex-1 rounded-xl border border-surface-300/30 bg-surface-200 px-2.5 py-1.5 text-sm placeholder:text-surface-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={submitManualEntry} disabled={!manualMinutes || manualSubmitting} className="rounded-xl">
                      {manualSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      Log
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setShowManualForm(false); setManualMinutes(''); setManualDescription(''); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Recent entries */}
              {timeEntries.length > 0 && (
                <div className="pt-1 border-t border-surface-300/20">
                  <p className="text-xs font-medium text-surface-500 mb-2">Recent entries <span className="font-normal ml-1">({timeEntries.length})</span></p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {timeEntries.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="group flex items-center justify-between rounded-xl border border-surface-300/10 bg-surface-200/30 px-2.5 py-1.5 text-sm transition-all hover:bg-surface-200/50">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {entry.endTime ? (
                              <span className="font-mono text-xs font-medium text-surface-900">
                                {entry.durationMinutes ? formatDuration(entry.durationMinutes) : '—'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-brand-400">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-brand-500 animate-pulse" />
                                Running
                              </span>
                            )}
                            <span className="text-xs text-surface-500">{new Date(entry.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          </div>
                          {entry.description && <p className="text-xs text-surface-500 truncate mt-0.5">{entry.description}</p>}
                        </div>
                        <button onClick={() => deleteTimeEntry(entry.id)} className="shrink-0 ml-2 rounded p-0.5 text-surface-500 opacity-0 group-hover:opacity-100 hover:text-error transition-opacity">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {timeEntries.length === 0 && <p className="text-xs text-surface-500 text-center py-2">No time logged yet.</p>}
            </div>
          </motion.div>

          {/* Metadata card */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold text-surface-900">Details</h2>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm text-surface-500">
              <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Created {new Date(task.createdAt).toLocaleDateString()}</div>
              <div className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Updated {new Date(task.updatedAt).toLocaleDateString()}</div>
              <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" /> Created by {(task.createdBy ?? '').substring(0, 12)}...</div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
