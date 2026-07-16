'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  ArrowLeft,
  Users,
  ListTodo,
  AlertCircle,
  Briefcase,
  ChevronRight,
  Shield,
  Mail,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type Department = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  headUserId: string | null;
  isActive: boolean;
  parentId: string | null;
  sortOrder: number | null;
  createdAt: string;
  headUser: { id: string; name: string | null; email: string; designation: string | null } | null;
};

type SubTeam = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  leadUserId: string | null;
  isActive: boolean;
  memberCount: number;
};

type DeptMember = {
  id: string;
  name: string | null;
  email: string;
  designation: string | null;
  isActive: boolean;
  teamId: string | null;
};

type DeptResponse = {
  department: Department;
  teams: SubTeam[];
  members: DeptMember[];
  taskStats: {
    total: number;
    completed: number;
    byStatus: { status: string; count: number }[];
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

export default function DepartmentDetailPage() {
  const params = useParams();
  const deptId = params.id as string;

  const [data, setData] = useState<DeptResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // ── Fetch department data ──────────────────────────────

  const fetchDept = useCallback(async () => {
    try {
      const res = await fetch(`/api/departments/${deptId}`);
      if (res.status === 404) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch department');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load department');
    } finally {
      setLoading(false);
    }
  }, [deptId]);

  useEffect(() => {
    startTransition(() => {
      fetchDept();
    });
  }, [fetchDept]);

  // ── Render states ──────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="text-brand-500 h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="text-surface-300 mb-4 h-12 w-12" />
        <h2 className="text-surface-700 text-xl font-semibold">Department not found</h2>
        <p className="text-surface-500 mt-1 text-sm">
          This department may have been deleted or you don&apos;t have access.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => (window.location.href = '/teams')}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to teams
        </Button>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertCircle className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="text-surface-700 text-xl font-semibold">Failed to load department</h2>
        <p className="mt-1 text-sm text-red-500">{error}</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchDept();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  const { department: dept, teams, members, taskStats } = data;

  // ── Main render ────────────────────────────────────────

  return (
    <div className="animate-fade-in max-w-4xl space-y-6">
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
            <div className="text-surface-500 flex items-center gap-2 text-sm">
              {dept.code && <span className="font-mono text-xs">{dept.code}</span>}
              <Badge variant={dept.isActive ? 'success' : 'default'}>
                {dept.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <span className="text-xs">
                · {teams.length} teams · {members.length} members
              </span>
            </div>
            <h1 className="text-surface-900 dark:text-surface-50 mt-1 text-xl font-semibold">
              {dept.name}
            </h1>
            {dept.description && (
              <p className="text-surface-500 mt-1 text-sm">{dept.description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Task Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListTodo className="text-surface-400 h-4 w-4" />
                Task Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              {taskStats.total > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="border-surface-200 dark:border-surface-700 rounded-lg border p-3">
                      <p className="text-surface-500 text-xs">Total Tasks</p>
                      <p className="text-surface-900 dark:text-surface-50 mt-1 text-2xl font-semibold">
                        {taskStats.total}
                      </p>
                    </div>
                    <div className="border-surface-200 dark:border-surface-700 rounded-lg border p-3">
                      <p className="text-surface-500 text-xs">Completed</p>
                      <p className="mt-1 text-2xl font-semibold text-green-600">
                        {taskStats.completed}
                      </p>
                    </div>
                    <div className="border-surface-200 dark:border-surface-700 rounded-lg border p-3">
                      <p className="text-surface-500 text-xs">Completion Rate</p>
                      <p className="text-brand-600 mt-1 text-2xl font-semibold">
                        {taskStats.total > 0
                          ? Math.round((taskStats.completed / taskStats.total) * 100)
                          : 0}
                        %
                      </p>
                    </div>
                  </div>

                  {taskStats.byStatus.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-surface-500 text-xs font-medium">Breakdown</p>
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
                </>
              ) : (
                <p className="text-surface-400 py-4 text-center text-sm">
                  No tasks across teams in this department yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sub-Teams */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="text-surface-400 h-4 w-4" />
                Teams
                <span className="text-surface-400 text-xs font-normal">({teams.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {teams.length === 0 ? (
                <p className="text-surface-400 py-4 text-center text-sm">
                  No teams in this department yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="border-surface-200 hover:bg-surface-50 hover:border-brand-300 dark:border-surface-700 dark:hover:bg-surface-800 flex items-center justify-between rounded-lg border px-4 py-3 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-surface-900 dark:text-surface-50 text-sm font-medium">
                            {team.name}
                          </span>
                          {team.code && (
                            <span className="text-surface-400 font-mono text-xs">{team.code}</span>
                          )}
                          <Badge
                            variant={team.isActive ? 'success' : 'default'}
                            className="px-1.5 py-0 text-[10px]"
                          >
                            {team.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {team.description && (
                          <p className="text-surface-400 mt-0.5 text-xs">{team.description}</p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-surface-400 text-xs">{team.memberCount} members</span>
                        <ChevronRight className="text-surface-300 h-4 w-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Department Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="text-surface-400 h-4 w-4" />
                Members
                <span className="text-surface-400 text-xs font-normal">({members.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-surface-400 py-4 text-center text-sm">
                  No members in this department.
                </p>
              ) : (
                <div className="space-y-1">
                  {members.map((member) => (
                    <div
                      key={member.id}
                      className="hover:bg-surface-50 dark:hover:bg-surface-800 flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                          {getInitials(member.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-surface-900 dark:text-surface-50 truncate text-sm font-medium">
                              {member.name ?? 'Unnamed'}
                            </span>
                            {member.id === dept.headUserId && (
                              <Badge variant="primary" className="px-1.5 py-0 text-[10px]">
                                Head
                              </Badge>
                            )}
                          </div>
                          <div className="text-surface-400 mt-0.5 flex items-center gap-2 text-xs">
                            <Mail className="h-3 w-3" />
                            {member.email}
                            {member.designation && (
                              <>
                                <span>·</span>
                                <Briefcase className="h-3 w-3" />
                                {member.designation}
                              </>
                            )}
                          </div>
                        </div>
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
          {/* Department Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Department Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {dept.headUser ? (
                <div>
                  <label className="text-surface-500 mb-1 block text-xs font-medium">
                    Department Head
                  </label>
                  <div className="text-surface-700 dark:text-surface-300 flex items-center gap-2">
                    <div className="bg-brand-100 text-brand-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                      {getInitials(dept.headUser.name)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{dept.headUser.name ?? 'Unknown'}</p>
                      {dept.headUser.designation && (
                        <p className="text-surface-400 text-xs">{dept.headUser.designation}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-surface-500 mb-1 block text-xs font-medium">
                    Department Head
                  </label>
                  <p className="text-surface-400 text-sm">Not assigned</p>
                </div>
              )}

              <div>
                <label className="text-surface-500 mb-1 block text-xs font-medium">Code</label>
                <div className="text-surface-500 font-mono text-xs">{dept.code ?? '—'}</div>
              </div>

              <div>
                <label className="text-surface-500 mb-1 block text-xs font-medium">Created</label>
                <div className="text-surface-700 dark:text-surface-300">
                  {new Date(dept.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Shield className="text-surface-400 h-4 w-4" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-surface-600 dark:text-surface-400 text-sm">Teams</span>
                <span className="text-surface-900 dark:text-surface-50 text-sm font-semibold">
                  {teams.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-600 dark:text-surface-400 text-sm">Members</span>
                <span className="text-surface-900 dark:text-surface-50 text-sm font-semibold">
                  {members.length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-600 dark:text-surface-400 text-sm">Total Tasks</span>
                <span className="text-surface-900 dark:text-surface-50 text-sm font-semibold">
                  {taskStats.total}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-surface-600 dark:text-surface-400 text-sm">Completed</span>
                <span className="text-sm font-semibold text-green-600">{taskStats.completed}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
