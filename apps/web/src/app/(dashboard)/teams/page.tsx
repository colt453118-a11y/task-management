'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-display';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Building2, GitBranch, AlertCircle, Plus, X, Loader2, Check } from 'lucide-react';

type Team = { id: string; name: string; code: string | null; description: string | null; leadUserId: string | null; departmentId: string | null; isActive: boolean; createdAt: string; };
type Department = { id: string; name: string; code: string | null; description: string | null; headUserId: string | null; isActive: boolean; };

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } } };

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
      } catch (err) { setError(err instanceof Error ? err.message : 'Failed to load teams'); }
      finally { setLoading(false); }
    }
    fetchData();
  }, []);

  const openCreate = () => {
    setForm({ name: '', code: '', description: '' });
    setCreateError(null);
    setShowCreate(true);
  };

  const createTeam = async () => {
    if (!form.name.trim()) { setCreateError('Team name is required'); return; }
    setCreating(true); setCreateError(null);
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
    } finally { setCreating(false); }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1"><div className="h-8 w-32 shimmer rounded-lg" /><div className="mt-2 h-4 w-48 shimmer rounded-md" /></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-xl border border-surface-300/30 bg-surface-100 p-5">
              <div className="h-4 w-3/4 shimmer rounded-md" /><div className="mt-2 h-3 w-1/4 shimmer rounded-md" />
              <div className="mt-3 h-3 w-full shimmer rounded-md" /><div className="mt-4 h-3 w-1/2 shimmer rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card className="w-full max-w-md border-error/20">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <AlertCircle className="h-10 w-10 text-error mb-3" /><h2 className="text-lg font-semibold text-surface-900">Failed to load teams</h2>
            <p className="mt-1 text-sm text-surface-500">{error}</p>
            <button onClick={() => { setLoading(true); setError(null); }} className="mt-3 rounded-xl bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-400">Retry</button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-surface-900">Teams</h1>
          <p className="text-sm text-surface-500 mt-1">{teams.length} team{teams.length !== 1 ? 's' : ''} · {departments.length} department{departments.length !== 1 ? 's' : ''}</p>
        </div>          <Button onClick={openCreate} className="shadow-sm">
          <Plus className="h-4 w-4 mr-2" /> Create Team
        </Button>
      </motion.div>

      {departments.length > 0 && (
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3"><Building2 className="h-4 w-4 text-surface-500" /><h2 className="text-sm font-semibold text-surface-600">Departments</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (                  <Link key={dept.id} href={`/teams/departments/${dept.id}`}>
                <motion.div whileHover={{ y: -2 }} className="group relative overflow-hidden rounded-2xl border border-surface-300/20 bg-surface-100/80 p-5 transition-all duration-200 hover:border-brand-500/30 hover:shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400 opacity-60" />
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-surface-900 truncate">{dept.name}</h3>
                    <Badge variant={dept.isActive ? 'success' : 'default'} size="sm">{dept.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  {dept.code && <p className="text-xs text-surface-500 font-mono mb-2">{dept.code}</p>}
                  {dept.description && <p className="text-sm text-surface-500 line-clamp-2">{dept.description}</p>}
                </motion.div>
              </Link>
            ))}
          </div>
        </motion.section>
      )}

      {teams.length > 0 && (
        <motion.section variants={itemVariants}>
          <div className="flex items-center gap-2 mb-3"><Users className="h-4 w-4 text-surface-500" /><h2 className="text-sm font-semibold text-surface-600">Teams</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team, i) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <motion.div variants={itemVariants} custom={i} whileHover={{ y: -2 }} className="group relative overflow-hidden rounded-2xl border border-surface-300/20 bg-surface-100/80 p-5 transition-all duration-200 hover:border-brand-500/30 hover:shadow-sm">
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-500 to-brand-400 opacity-60" />
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-surface-900 truncate">{team.name}</h3>
                    <Badge variant={team.isActive ? 'success' : 'default'} size="sm">{team.isActive ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  {team.code && <p className="text-xs text-surface-500 font-mono mb-1">{team.code}</p>}
                  {team.description && <p className="text-sm text-surface-500 line-clamp-2 mb-2">{team.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-surface-500">
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
          <EmptyState icon={<GitBranch className="h-16 w-16 text-surface-400" />} title="No teams or departments" message="Teams and departments will appear here once they are created."
            action={<Button onClick={openCreate} className="rounded-xl"><Plus className="h-4 w-4 mr-2" />Create Team</Button>}
          />
        </motion.div>
      )}

      {/* Create Team Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md rounded-2xl border border-surface-300/30 bg-surface-50/95 backdrop-blur-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900">Create Team</h3>
                <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-surface-500 hover:bg-surface-200"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Name <span className="text-error">*</span></label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Engineering" autoFocus
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Code</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. ENG"
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" rows={3}
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 resize-none" />
                </div>
                {createError && <div className="flex items-center gap-2 rounded-xl bg-error/5 px-3 py-2 text-sm text-error"><AlertCircle className="h-4 w-4 shrink-0" />{createError}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowCreate(false)} className="rounded-xl">Cancel</Button>
                  <Button onClick={createTeam} disabled={creating} className="rounded-xl">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
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
