'use client';

import { useState, useCallback, useEffect, startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Trash2, Check, X, Edit3, LayoutTemplate, Sparkles } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface Template {
  id: string;
  name: string;
  description: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  priority: string;
  category: string | null;
  labels: string[] | null;
  tags: string[] | null;
  estimatedHours: string | null;
  isDefault: boolean;
  createdAt: string;
}

interface TaskTemplatePickerProps {
  onApplyTemplate: (template: { title?: string; description?: string; priority?: string }) => void;
}

// ─── Component ───────────────────────────────────────────────

export function TaskTemplatePicker({ onApplyTemplate }: TaskTemplatePickerProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showManager, setShowManager] = useState(false);

  // Manage dialog state
  const [manageMode, setManageMode] = useState<'list' | 'create' | 'edit'>('list');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTaskTitle, setFormTaskTitle] = useState('');
  const [formTaskDescription, setFormTaskDescription] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/task-templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates ?? []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    startTransition(() => {
      fetchTemplates();
    });
  }, [fetchTemplates]);

  // ── Apply template ────────────────────────────────────────

  const applyTemplate = (template: Template) => {
    onApplyTemplate({
      title: template.taskTitle ?? undefined,
      description: template.taskDescription ?? undefined,
      priority: template.priority,
    });
  };

  // ── Save template (create or update) ──────────────────────

  const saveTemplate = async () => {
    if (!formName.trim()) return;
    setFormSubmitting(true);

    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        taskTitle: formTaskTitle.trim() || null,
        taskDescription: formTaskDescription.trim() || null,
        priority: formPriority,
      };

      if (manageMode === 'create') {
        const res = await fetch('/api/task-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to create template');
      } else if (manageMode === 'edit' && editId) {
        const res = await fetch(`/api/task-templates?id=${editId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error('Failed to update template');
      }

      setManageMode('list');
      resetForm();
      fetchTemplates();
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ── Delete template ───────────────────────────────────────

  const deleteTemplate = async (id: string) => {
    try {
      const res = await fetch(`/api/task-templates?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  // ── Start editing ─────────────────────────────────────────

  const startEdit = (template: Template) => {
    setManageMode('edit');
    setEditId(template.id);
    setFormName(template.name);
    setFormDescription(template.description ?? '');
    setFormTaskTitle(template.taskTitle ?? '');
    setFormTaskDescription(template.taskDescription ?? '');
    setFormPriority(template.priority);
  };

  // ── Reset form ────────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormTaskTitle('');
    setFormTaskDescription('');
    setFormPriority('medium');
    setEditId(null);
  };

  // ── Loading state ─────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="shimmer h-8 w-24 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Toggle manage mode */}
      <div className="mb-2 flex items-center gap-1.5">
        <button
          onClick={() => setShowManager(!showManager)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all',
            showManager
              ? 'bg-brand-500/10 text-brand-500'
              : 'text-surface-500 hover:bg-surface-200/70 hover:text-surface-600',
          )}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Templates
          {templates.length > 0 && (
            <span className="bg-surface-200/70 text-surface-500 dark:bg-surface-700/50 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-medium">
              {templates.length}
            </span>
          )}
        </button>
      </div>

      {/* Template manager panel */}
      <AnimatePresence>
        {showManager && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="border-surface-300/20 bg-surface-100/80 dark:bg-surface-900/80 mb-4 overflow-hidden rounded-2xl border"
          >
            {manageMode === 'list' ? (
              /* Template list */
              <div className="space-y-2 p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                    {templates.length} template{templates.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => {
                      setManageMode('create');
                      resetForm();
                    }}
                    className="text-brand-500 hover:bg-brand-500/10 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all"
                  >
                    <Plus className="h-3 w-3" />
                    New
                  </button>
                </div>

                {templates.length === 0 ? (
                  <p className="text-surface-400 py-4 text-center text-xs">
                    No templates yet. Create one to speed up task creation.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        className="hover:bg-surface-200/50 dark:hover:bg-surface-800/50 group flex items-center justify-between rounded-xl px-2.5 py-2 transition-all"
                      >
                        <button
                          onClick={() => {
                            applyTemplate(template);
                            setShowManager(false);
                          }}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <Sparkles className="text-surface-400 h-3.5 w-3.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-surface-700 dark:text-surface-300 truncate text-sm font-medium">
                              {template.name}
                            </p>
                            {template.description && (
                              <p className="text-surface-500 truncate text-[11px]">
                                {template.description}
                              </p>
                            )}
                          </div>
                        </button>
                        <div className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => startEdit(template)}
                            className="text-surface-400 hover:text-surface-600 hover:bg-surface-200/70 rounded-lg p-1 transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => deleteTemplate(template.id)}
                            className="text-surface-400 hover:text-error hover:bg-error/5 rounded-lg p-1 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Create/Edit form */
              <div className="space-y-3 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 text-xs font-semibold uppercase tracking-wider">
                    {manageMode === 'create' ? 'New Template' : 'Edit Template'}
                  </span>
                  <button
                    onClick={() => {
                      setManageMode('list');
                      resetForm();
                    }}
                    className="text-surface-500 hover:bg-surface-200/70 rounded-lg p-1 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Template name *"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="border-surface-300/20 bg-surface-200/50 placeholder:text-surface-400 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/50 h-8 w-full rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="border-surface-300/20 bg-surface-200/50 placeholder:text-surface-400 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/50 h-8 w-full rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <input
                    type="text"
                    placeholder="Default title for new tasks (optional)"
                    value={formTaskTitle}
                    onChange={(e) => setFormTaskTitle(e.target.value)}
                    className="border-surface-300/20 bg-surface-200/50 placeholder:text-surface-400 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/50 h-8 w-full rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <textarea
                    placeholder="Default description for new tasks (optional)"
                    value={formTaskDescription}
                    onChange={(e) => setFormTaskDescription(e.target.value)}
                    className="border-surface-300/20 bg-surface-200/50 placeholder:text-surface-400 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/50 h-16 w-full resize-none rounded-lg border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1"
                  />
                </div>

                <div>
                  <label className="text-surface-500 mb-1 block text-[10px] font-medium">
                    Default Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="border-surface-300/20 bg-surface-200/50 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/50 h-8 w-full rounded-lg border px-2.5 text-xs focus:outline-none focus:ring-1"
                  >
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setManageMode('list');
                      resetForm();
                    }}
                    className="h-7 rounded-lg text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={saveTemplate}
                    disabled={!formName.trim() || formSubmitting}
                    className="h-7 rounded-lg text-xs"
                  >
                    {formSubmitting ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-3 w-3" />
                    )}
                    {manageMode === 'create' ? 'Create' : 'Save'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick apply template chips when manager is closed */}
      {!showManager && templates.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {templates.slice(0, 4).map((template) => (
            <button
              key={template.id}
              onClick={() => applyTemplate(template)}
              className="border-surface-300/20 text-surface-600 hover:border-brand-500/30 hover:text-brand-500 hover:bg-brand-500/5 dark:text-surface-400 inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all"
            >
              <Sparkles className="h-3 w-3" />
              {template.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
