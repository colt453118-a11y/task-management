'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

type TaskStat = {
  status: string;
  count: number;
};

type MemberTaskCount = {
  userId: string;
  count: number;
};

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
  completed: 'text-green-600 bg-green-50 dark:bg-green-900/20',
  in_progress: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
  open: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
  draft: 'text-surface-600 bg-surface-50 dark:bg-surface-900/20',
  default: 'text-surface-500 bg-surface-50 dark:bg-surface-900/20',
};

const statusLabels: Record<string, string> = {
  completed: 'Completed',
  in_progress: 'In Progress',
  open: 'Open',
  draft: 'Draft',
  blocked: 'Blocked',
  under_review: 'Under Review',
  on_hold: 'On Hold',
  closed: 'Closed',
};

// ─── Page Component ─────────────────────────────────────────

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = params.id as string;

  const [data, setData] = useState<TeamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Member management
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // ── Fetch team data ────────────────────────────────────

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch team');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchAvailableUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=100');
      if (res.ok) {
        const json = await res.json();
        if (data) {
          const memberIds = new Set(data.members.map((m) => m.userId));
          setAvailableUsers(
            (json.users ?? []).filter((u: { id: string }) => !memberIds.has(u.id)),
          );
        }
      }
    } catch {
      // Non-critical
    }
  }, [data]);

  useEffect(() => { startTransition(() => { fetchTeam(); }); }, [fetchTeam]);

  useEffect(() => {
    if (showAddMember && data) {
      startTransition(() => {
        fetchAvailableUsers();
      });
    }
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
      if (res.ok) {
        setShowAddMember(false);
        setSelectedUserId('');
        fetchTeam();
      }
    } catch {
      // Silently handle
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId: string) => {
    try {
      const res = await fetch(`/api/teams/${teamId}/members?userId=${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) fetchTeam();
    } catch {
      // Silently handle
    }
  };

  const memberTaskCount = (userId: string): number => {
    return data?.taskStats.byMember.find((m) => m.userId === userId)?.count ?? 0;
  };

  // ── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-surface-300 mb-4" />
        <h2 className="text-xl font-semibold text-surface-700">Team not found</h2>
        <p className="text-sm text-surface-500 mt-1">This team may have been deleted or you don&apos;t have access.</p>
        <Button variant="outline" className="mt-4" onClick={() => window.location.href = '/teams'}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to teams
        </Button>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-surface-700">Failed to load team</h2>
        <p className="text-sm text-red-500 mt-1">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => { setLoading(true); setError(null); fetchTeam(); }}>
          Try again
        </Button>
      </div>
    );
  }

  const { team, members, taskStats } = data;

  // ── Main render ────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-surface-500">
              {team.code && <span className="font-mono text-xs">{team.code}</span>}
              <Badge variant={team.isActive ? 'success' : 'default'}>
                {team.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span className="text-xs">· {members.length} members</span>
            </div>
            <h1 className="text-xl font-semibold text-surface-900 dark:text-surface-50 mt-1">
              {team.name}
            </h1>
            {team.description && (
              <p className="text-sm text-surface-500 mt-1">{team.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Workload Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ListTodo className="h-4 w-4 text-surface-400" />
                Task Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                  <p className="text-xs text-surface-500">Total Tasks</p>
                  <p className="text-2xl font-semibold text-surface-900 dark:text-surface-50 mt-1">
                    {taskStats.total}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                  <p className="text-xs text-surface-500">In Progress</p>
                  <p className="text-2xl font-semibold text-blue-600 mt-1">
                    {taskStats.inProgress}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                  <p className="text-xs text-surface-500">Completed</p>
                  <p className="text-2xl font-semibold text-green-600 mt-1">
                    {taskStats.completed}
                  </p>
                </div>
                <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
                  <p className="text-xs text-surface-500">Open</p>
                  <p className="text-2xl font-semibold text-yellow-600 mt-1">
                    {taskStats.open}
                  </p>
                </div>
              </div>

              {/* Task breakdown by status */}
              {taskStats.byStatus.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-surface-500">Breakdown</p>
                  <div className="flex flex-wrap gap-2">
                    {taskStats.byStatus.map((stat) => (
                      <span
                        key={stat.status}
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          statusColors[stat.status] ?? statusColors.default
                        }`}
                      >
                        {statusLabels[stat.status] ?? stat.status.replace(/_/g, ' ')}
                        <span className="font-semibold">{stat.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {taskStats.total === 0 && (
                <p className="text-sm text-surface-400 text-center py-4">
                  No tasks assigned to this team yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Members */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-surface-400" />
                Members
                <span className="text-xs font-normal text-surface-400">({members.length})</span>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddMember(!showAddMember)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Member
              </Button>
            </CardHeader>
            <CardContent>
              {/* Add member form */}
              {showAddMember && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-surface-200 dark:border-surface-700">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-surface-300 bg-white px-3 text-sm dark:bg-surface-800 dark:text-surface-100"
                  >
                    <option value="">Select a user...</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name ?? u.email}
                      </option>
                    ))}
                  </select>
                  <Button
                    size="sm"
                    onClick={addMember}
                    disabled={!selectedUserId || addingMember}
                  >
                    {addingMember ? (
                      <Loader2 className="h-3 w-3 animate-spin mr-1" />
                    ) : (
                      <Plus className="h-3 w-3 mr-1" />
                    )}
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowAddMember(false)}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Member list */}
              {members.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-4">
                  No members in this team.
                </p>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between rounded-lg border border-surface-200 px-3 py-2.5 hover:bg-surface-50 transition-colors dark:border-surface-700 dark:hover:bg-surface-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {getInitials(member.user?.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">
                              {member.user?.name ?? 'Unknown'}
                            </span>
                            {member.userId === team.leadUserId && (
                              <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                                Lead
                              </Badge>
                            )}
                            {member.role !== 'member' && (
                              <span className="text-xs text-surface-400 capitalize">({member.role})</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-surface-400 mt-0.5">
                            {member.user?.designation && (
                              <span className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {member.user.designation}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs text-surface-400">
                          {memberTaskCount(member.userId)} tasks
                        </span>
                        {member.userId !== team.leadUserId && (
                          <button
                            onClick={() => removeMember(member.userId)}
                            className="rounded p-1 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Remove member"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Team Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Team Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {team.department && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Department</label>
                  <div className="flex items-center gap-2 text-surface-700 dark:text-surface-300">
                    <Building2 className="h-3.5 w-3.5 text-surface-400" />
                    {team.department.name}
                  </div>
                </div>
              )}

              {team.leadUser && (
                <div>
                  <label className="block text-xs font-medium text-surface-500 mb-1">Team Lead</label>
                  <div className="flex items-center gap-2 text-surface-700 dark:text-surface-300">
                    <User className="h-3.5 w-3.5 text-surface-400" />
                    {team.leadUser.name ?? team.leadUser.email}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Created</label>
                <div className="text-surface-700 dark:text-surface-300">
                  {new Date(team.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Code</label>
                <div className="font-mono text-xs text-surface-500">
                  {team.code ?? '—'}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Member Task Load */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-surface-400" />
                Workload
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-surface-400 text-center py-2">No members to track.</p>
              ) : (
                members.map((member) => {
                  const count = memberTaskCount(member.userId);
                  const maxCount = Math.max(
                    1,
                    ...data.taskStats.byMember.map((m) => m.count),
                  );
                  const percentage = Math.round((count / maxCount) * 100);

                  return (
                    <div key={member.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-surface-700 dark:text-surface-300 truncate">
                          {member.user?.name ?? 'Unknown'}
                        </span>
                        <span className="text-surface-400">{count} tasks</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-surface-100 dark:bg-surface-800">
                        <div
                          className="h-1.5 rounded-full bg-brand-500 transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
