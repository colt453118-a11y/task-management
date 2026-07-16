'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/state-display';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, AlertCircle, X, Plus, Loader2, Check, Search } from 'lucide-react';

type Project = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  ownerId: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
};

const statusBadge: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'info'> = {
  active: 'success',
  on_hold: 'warning',
  completed: 'primary',
  archived: 'default',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    startDate: '',
    endDate: '',
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error('Failed to fetch projects');
        const data = await res.json();
        setProjects(data.projects ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load projects');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = search
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.code?.toLowerCase().includes(search.toLowerCase()),
      )
    : projects;

  const openCreate = () => {
    setForm({ name: '', code: '', description: '', startDate: '', endDate: '' });
    setCreateError(null);
    setShowCreate(true);
  };

  const createProject = async () => {
    if (!form.name.trim()) {
      setCreateError('Project name is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = { name: form.name.trim() };
      if (form.code.trim()) body.code = form.code.trim();
      if (form.description.trim()) body.description = form.description.trim();
      if (form.startDate) body.startDate = new Date(form.startDate).toISOString();
      if (form.endDate) body.endDate = new Date(form.endDate).toISOString();

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to create project');
      }
      const data = await res.json();
      setProjects((prev) => [data.project, ...prev]);
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-48 rounded-xl" />
          <div className="shimmer mt-2 h-4 w-32 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-5">
              <div className="shimmer h-4 w-3/4 rounded-lg" />
              <div className="shimmer mt-2 h-3 w-1/3 rounded-lg" />
              <div className="shimmer mt-4 h-3 w-full rounded-lg" />
              <div className="shimmer mt-2 h-3 w-2/3 rounded-lg" />
              <div className="shimmer mt-4 h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="border-error/20 w-full max-w-md">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <AlertCircle className="text-error mb-3 h-10 w-10" />
            <h2 className="text-surface-900 text-lg font-semibold">Failed to load projects</h2>
            <p className="text-surface-500 mt-1 text-sm">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setError(null);
              }}
              className="mt-3"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-surface-900 text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {projects.length} project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={openCreate} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </motion.div>

      {projects.length > 0 && (
        <motion.div variants={itemVariants}>
          <div className="relative max-w-md">
            <Search className="text-surface-400 absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </motion.div>
      )}

      {filtered.length === 0 && projects.length > 0 ? (
        <motion.div variants={itemVariants} className="py-12 text-center">
          <p className="text-surface-500 text-sm">No projects match your search.</p>
        </motion.div>
      ) : projects.length === 0 ? (
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={<FolderOpen className="text-surface-300 dark:text-surface-600 h-16 w-16" />}
            title="No projects yet"
            message="Organize your work into projects to track progress."
            action={
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            }
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project, i) => (
            <motion.div key={project.id} variants={itemVariants} custom={i}>
              <motion.div
                whileHover={{ y: -2 }}
                className="border-surface-300/20 bg-surface-100/80 hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm"
              >
                <div className="from-brand-500 to-brand-400 absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60" />
                <div className="mb-3 flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-surface-900 truncate font-semibold">{project.name}</h3>
                    {project.code && (
                      <p className="text-surface-500 mt-0.5 font-mono text-xs">{project.code}</p>
                    )}
                  </div>
                  <Badge variant={statusBadge[project.status] ?? 'default'} size="sm">
                    {project.status}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-surface-500 mb-3 line-clamp-2 text-sm leading-relaxed">
                    {project.description}
                  </p>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-surface-500">Progress</span>
                    <span className="text-surface-700 dark:text-surface-300 font-medium">
                      {project.progress}%
                    </span>
                  </div>
                  <div className="bg-surface-300/30 dark:bg-surface-700/30 h-1.5 overflow-hidden rounded-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="from-brand-500 to-brand-400 h-full rounded-full bg-gradient-to-r"
                    />
                  </div>
                </div>
                {(project.startDate || project.endDate) && (
                  <div className="text-surface-500 mt-3 flex items-center gap-3 text-xs">
                    {project.startDate && (
                      <span>Start: {new Date(project.startDate).toLocaleDateString()}</span>
                    )}
                    {project.endDate && (
                      <span>End: {new Date(project.endDate).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 w-full max-w-md rounded-2xl border p-6 shadow-xl backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-surface-900 text-lg font-semibold">New Project</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-lg p-1.5 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-surface-500 block text-xs font-semibold uppercase tracking-wider">
                    Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Q4 Product Launch"
                    autoFocus
                    className="border-surface-300/30 bg-surface-100/80 placeholder:text-surface-400 hover:border-surface-400/40 focus:border-brand-500 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:border-surface-600/30 w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-surface-500 block text-xs font-semibold uppercase tracking-wider">
                    Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. Q4-2026"
                    className="border-surface-300/30 bg-surface-100/80 placeholder:text-surface-400 hover:border-surface-400/40 focus:border-brand-500 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:border-surface-600/30 w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-surface-500 block text-xs font-semibold uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="border-surface-300/30 bg-surface-100/80 placeholder:text-surface-400 hover:border-surface-400/40 focus:border-brand-500 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:border-surface-600/30 w-full resize-none rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-surface-500 block text-xs font-semibold uppercase tracking-wider">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="border-surface-300/30 bg-surface-100/80 hover:border-surface-400/40 focus:border-brand-500 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:border-surface-600/30 w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-surface-500 block text-xs font-semibold uppercase tracking-wider">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="border-surface-300/30 bg-surface-100/80 hover:border-surface-400/40 focus:border-brand-500 focus:ring-brand-500/25 dark:bg-surface-900/80 dark:border-surface-600/30 w-full rounded-xl border px-3.5 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                    />
                  </div>
                </div>
                {createError && (
                  <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createProject} disabled={creating}>
                    {creating ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-1 h-4 w-4" />
                    )}
                    Create
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
