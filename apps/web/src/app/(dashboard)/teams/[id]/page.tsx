'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Loader2,
  ArrowLeft,
  Users,
  Building2,
  User,
  Clock,
  ListTodo,
  AlertCircle,
  Plus,
  X,
  Briefcase,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type TeamMember = {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
    designation: string | null;
    isActive: boolean;
  } | null;
};

type TaskStat = { status: string; count: number };
type MemberTaskCount = { userId: string; count: number };

type TeamData = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  departmentId: string | null;
  leadUserId: string | null;
  isActive: boolean;
  createdAt: string;
  department: { id: string; name: string } | null;
  leadUser: { id: string; name: string | null; email: string } | null;
};

type TeamResponse = {
  team: TeamData;
  members: TeamMember[];
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    open: number;
    byStatus: TaskStat[];
    byMember: MemberTaskCount[];
  };
};

// ─── Helpers ────────────────────────────────────────────────

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  const first = (parts[0] ?? '').charAt(0).toUpperCase();
  const last = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase();
  return first + last;
}

const statusColors: Record<string, string> = {
  completed: 'text-green-400 bg-green-500/10',
  in_progress: 'text-blue-400 bg-blue-500/10',
  open: 'text-yellow-400 bg-yellow-500/10',
  draft: 'text-surface-500 bg-surface-200',
  default: 'text-surface-500 bg-surface-200',
};

const statusLabels: Record<string, string> = {
  completed: 'Completed', in_progress: 'In Progress', open: 'Open', draft: 'Draft',
  blocked: 'Blocked', under_review: 'Under Review', on_hold: 'On Hold', closed: 'Closed',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
};

// ─── Page Component ─────────────────────────────────────────

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.id as string;

  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // ── Fetch team data ────────────────────────────────────

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (!res.ok) throw new Error('Failed to fetch team');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally { setLoading(false); }
  }, [teamId]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=100');
      if (res.ok && data) {
        const json = await res.json();
        const memberIds = new Set(data.members.map((m) => m.userId));
        setAvailableUsers((json.users ?? []).filter((u: { id: string }) => !memberIds.has(u.id)));
      }
    } catch { /* */ }
  }, [data]);

  useEffect(() => { startTransition(() => { fetchTeam(); }); }, [fetchTeam]);

  useEffect(() => {
    if (showAddMember && data) startTransition(() => { fetchAvailableUsers(); });
  }, [showAddMember, data, fetchAvailableUsers]);

  // ── Member management ──────────────────────────────────

  const addMember = async () => {
    if (!selectedUserId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
      });
      if (res.ok) { setShowAddMember(false); setSelectedUserId(''); fetchTeam(); }
    } catch { /* */ } finally { setAddingMember(false); }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, { method: 'DELETE' });
      if (res.ok) fetchTeam();
    } catch { /* */ }
  };

  const memberTaskCount = (userId: string): number => {
    return data?.taskStats.byMember.find((m) => m.userId === userId)?.count ?? 0;
  };

  // ── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 shimmer rounded-xl" />
          <div className="space-y-2">
            <div className="h-5 w-24 shimmer rounded-lg" />
            <div className="h-7 w-56 shimmer rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-40 shimmer rounded-xl" />
            <div className="h-56 shimmer rounded-xl" />
          </div>
          <div className="space-y-6">
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
        <h2 className="text-xl font-semibold text-surface-300">Team not found</h2>
        <p className="text-sm text-surface-500 mt-1">This team may have been deleted or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.location.href = '/teams'}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to teams
        </Button>
      </motion.div>
    );
  }

  if (error || !data) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-error mb-4" />
        <h2 className="text-xl font-semibold text-surface-300">Failed to load team</h2>
        <p className="text-sm text-error mt-1">{error}</p>
        <Button variant="outline" className="mt-4 rounded-xl" onClick={() => { setLoading(true); setError(null); fetchTeam(); }}>Try again</Button>
      </motion.div>
    );
  }

  const { team, members, taskStats } = data;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => window.history.back()} className="flex h-9 w-9 items-center justify-center rounded-xl border border-surface-300/20 bg-surface-100/80 text-surface-500 transition-all hover:bg-surface-200/70 hover:text-surface-600">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 text-sm text-surface-500">
              {team.code && <span className="font-mono text-xs">{team.code}</span>}
              <Badge variant={team.isActive ? 'success' : 'default'}>{team.isActive ? 'Active' : 'Inactive'}</Badge>
              <span className="text-xs">· {members.length} members</span>
            </div>
            <h1 className="text-xl font-semibold text-surface-900 mt-1">{team.name}</h1>
            {team.description && <p className="text-sm text-surface-500 mt-1">{team.description}</p>}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workload Overview */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <ListTodo className="h-4 w-4 text-surface-500" />
                Task Overview
              </h2>
            </div>
            <div className="px-5 py-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-xl border border-surface-300/20 bg-surface-200/30 p-3">
                  <p className="text-xs text-surface-500">Total Tasks</p>
                  <p className="text-2xl font-semibold text-surface-900 mt-1">{taskStats.total}</p>
                </div>
                <div className="rounded-xl border border-surface-300/20 bg-surface-200/30 p-3">
                  <p className="text-xs text-surface-500">In Progress</p>
                  <p className="text-2xl font-semibold text-blue-400 mt-1">{taskStats.inProgress}</p>
                </div>
                <div className="rounded-xl border border-surface-300/20 bg-surface-200/30 p-3">
                  <p className="text-xs text-surface-500">Completed</p>
                  <p className="text-2xl font-semibold text-green-400 mt-1">{taskStats.completed}</p>
                </div>
                <div className="rounded-xl border border-surface-300/20 bg-surface-200/30 p-3">
                  <p className="text-xs text-surface-500">Open</p>
                  <p className="text-2xl font-semibold text-yellow-400 mt-1">{taskStats.open}</p>
                </div>
              </div>

              {taskStats.byStatus.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-surface-500">Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {taskStats.byStatus.map((stat) => (
                      <span key={stat.status} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[stat.status] ?? statusColors.default}`}>
                        {statusLabels[stat.status] ?? stat.status.replace(/_/g, ' ')}
                        <span className="font-semibold">{stat.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {taskStats.total === 0 && <p className="text-sm text-surface-500 text-center py-4">No tasks assigned to this team yet.</p>}
            </div>
          </motion.div>

          {/* Members */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10 flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Users className="h-4 w-4 text-surface-500" />
                Members
                <span className="text-xs font-normal text-surface-500">({members.length})</span>
              </h2>
              <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)} className="rounded-xl">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Member
              </Button>
            </div>
            <div className="px-5 py-4">
              {showAddMember && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-xl border border-surface-300/20 bg-surface-200/30">
                  <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="flex-1 h-9 rounded-xl border border-surface-300/30 bg-surface-200 px-3 text-sm">
                    <option value="">Select a user...</option>
                    {availableUsers.map((u) => (<option key={u.id} value={u.id}>{u.name ?? u.email}</option>))}
                  </select>
                  <Button size="sm" onClick={addMember} disabled={!selectedUserId || addingMember} className="rounded-xl">
                    {addingMember ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />} Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddMember(false)}>Cancel</Button>
                </div>
              )}

              {members.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-4">No members in this team.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between rounded-xl border border-surface-300/10 bg-surface-200/30 px-3 py-2.5 transition-all hover:bg-surface-200/50">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-medium text-white">
                          {getInitials(member.user?.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-surface-900 truncate">{member.user?.name ?? 'Unknown'}</span>
                            {member.userId === team.leadUserId && <Badge variant="primary" className="text-[10px] px-1.5 py-0">Lead</Badge>}
                            {member.role !== 'member' && <span className="text-xs text-surface-500 capitalize">({member.role})</span>}
                          </div>
                          {member.user?.designation && (
                            <div className="flex items-center gap-1 text-xs text-surface-500 mt-0.5">
                              <Briefcase className="h-3 w-3" /> {member.user.designation}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-surface-500">{memberTaskCount(member.userId)} tasks</span>
                        {member.userId !== team.leadUserId && (
                          <button onClick={() => removeMember(member.userId)} className="rounded-lg p-1 text-surface-500 hover:text-error hover:bg-error/5" title="Remove member">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Team Info */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold text-surface-900">Team Info</h2>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm">
              {team.department && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Department</label>
                  <div className="flex items-center gap-2 text-surface-300"><Building2 className="h-3.5 w-3.5 text-surface-500" />{team.department.name}</div>
                </div>
              )}
              {team.leadUser && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Team Lead</label>
                  <div className="flex items-center gap-2 text-surface-300"><User className="h-3.5 w-3.5 text-surface-500" />{team.leadUser.name ?? team.leadUser.email}</div>
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Created</label>
                <div className="text-surface-300">{new Date(team.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</div>
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Code</label>
                <div className="font-mono text-xs text-surface-500">{team.code ?? '—'}</div>
              </div>
            </div>
          </motion.div>

          {/* Member Task Load */}
          <motion.div variants={itemVariants} className="rounded-2xl border border-surface-300/20 bg-surface-100/80 overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-300/10">
              <h2 className="text-base font-semibold flex items-center gap-2 text-surface-900">
                <Clock className="h-4 w-4 text-surface-500" /> Workload
              </h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-surface-500 text-center py-2">No members to track.</p>
              ) : (
                members.map((member) => {
                  const count = memberTaskCount(member.userId);
                  const maxCount = Math.max(1, ...data.taskStats.byMember.map((m) => m.count));
                  const percentage = Math.round((count / maxCount) * 100);
                  return (
                    <div key={member.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-surface-300 truncate">{member.user?.name ?? 'Unknown'}</span>
                        <span className="text-surface-500">{count} tasks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-200">
                        <div className="h-1.5 rounded-full bg-brand-500 transition-all" style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
