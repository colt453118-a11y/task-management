'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-display';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Building2, GitBranch, AlertCircle, Plus, X, Loader2, Check } from 'lucide-react';

type Team = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  leadUserId: string | null;
  departmentId: string | null;
  isActive: boolean;
  createdAt: string;
};
type Department = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headUserId: string | null;
  isActive: boolean;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/teams');
        if (!res.ok) throw new Error('Failed to fetch teams');
        const data = await res.json();
        setTeams(data.teams ?? []);
        setDepartments(data.departments ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load teams');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const openCreate = () => {
    setForm({ name: '', code: '', description: '' });
    setCreateError(null);
    setShowCreate(true);
  };

  const createTeam = async () => {
    if (!form.name.trim()) {
      setCreateError('Team name is required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = { name: form.name.trim() };
      if (form.code.trim()) body.code = form.code.trim();
      if (form.description.trim()) body.description = form.description.trim();

      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to create team');
      }
      const data = await res.json();
      setTeams((prev) => [data.team, ...prev]);
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-32 rounded-lg" />
          <div className="shimmer mt-2 h-4 w-48 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-surface-300/30 bg-surface-100 rounded-xl border p-5">
              <div className="shimmer h-4 w-3/4 rounded-md" />
              <div className="shimmer mt-2 h-3 w-1/4 rounded-md" />
              <div className="shimmer mt-3 h-3 w-full rounded-md" />
              <div className="shimmer mt-4 h-3 w-1/2 rounded-md" />
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
            <h2 className="text-surface-900 text-lg font-semibold">Failed to load teams</h2>
            <p className="text-surface-500 mt-1 text-sm">{error}</p>
            <button
              onClick={() => {
                setLoading(true);
                setError(null);
              }}
              className="bg-brand-500 hover:bg-brand-400 mt-3 rounded-xl px-4 py-2 text-sm font-medium text-white"
            >
              Retry
            </button>
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
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-surface-900 text-2xl font-bold tracking-tight">Teams</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {teams.length} team{teams.length !== 1 ? 's' : ''} · {departments.length} department
            {departments.length !== 1 ? 's' : ''}
          </p>
        </div>{' '}
        <Button onClick={openCreate} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Create Team
        </Button>
      </motion.div>

      {departments.length > 0 && (
        <motion.section variants={itemVariants}>
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="text-surface-500 h-4 w-4" />
            <h2 className="text-surface-600 text-sm font-semibold">Departments</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => (
              <Link key={dept.id} href={`/teams/departments/${dept.id}`}>
                <motion.div
                  whileHover={{ y: -2 }}
                  className="border-surface-300/20 bg-surface-100/80 hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="from-brand-500 to-brand-400 absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60" />
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-surface-900 truncate font-semibold">{dept.name}</h3>
                    <Badge variant={dept.isActive ? 'success' : 'default'} size="sm">
                      {dept.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {dept.code && (
                    <p className="text-surface-500 mb-2 font-mono text-xs">{dept.code}</p>
                  )}
                  {dept.description && (
                    <p className="text-surface-500 line-clamp-2 text-sm">{dept.description}</p>
                  )}
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {teams.length > 0 && (
        <motion.section variants={itemVariants}>
          <div className="mb-3 flex items-center gap-2">
            <Users className="text-surface-500 h-4 w-4" />
            <h2 className="text-surface-600 text-sm font-semibold">Teams</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teams.map((team, i) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <motion.div
                  variants={itemVariants}
                  custom={i}
                  whileHover={{ y: -2 }}
                  className="border-surface-300/20 bg-surface-100/80 hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm"
                >
                  <div className="from-brand-500 to-brand-400 absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-60" />
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="text-surface-900 truncate font-semibold">{team.name}</h3>
                    <Badge variant={team.isActive ? 'success' : 'default'} size="sm">
                      {team.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {team.code && (
                    <p className="text-surface-500 mb-1 font-mono text-xs">{team.code}</p>
                  )}
                  {team.description && (
                    <p className="text-surface-500 mb-2 line-clamp-2 text-sm">{team.description}</p>
                  )}
                  <div className="text-surface-500 flex items-center gap-3 text-xs">
                    {team.leadUserId && <span>Lead: {team.leadUserId.substring(0, 8)}...</span>}
                    {team.departmentId && <span>Dept: {team.departmentId.substring(0, 8)}...</span>}
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {teams.length === 0 && departments.length === 0 && (
        <motion.div variants={itemVariants}>
          <EmptyState
            icon={<GitBranch className="text-surface-400 h-16 w-16" />}
            title="No teams or departments"
            message="Teams and departments will appear here once they are created."
            action={
              <Button onClick={openCreate} className="rounded-xl">
                <Plus className="mr-2 h-4 w-4" />
                Create Team
              </Button>
            }
          />
        </motion.div>
      )}

      {/* Create Team Modal */}
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
              className="border-surface-300/30 bg-surface-50/95 w-full max-w-md rounded-2xl border p-6 shadow-lg backdrop-blur-xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-surface-900 text-lg font-semibold">Create Team</h3>
                <button
                  onClick={() => setShowCreate(false)}
                  className="text-surface-500 hover:bg-surface-200 rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                    Name <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Engineering"
                    autoFocus
                    className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                    Code
                  </label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. ENG"
                    className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full resize-none rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                  />
                </div>
                {createError && (
                  <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreate(false)}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button onClick={createTeam} disabled={creating} className="rounded-xl">
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
