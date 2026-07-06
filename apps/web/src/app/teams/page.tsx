'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, Loader2 } from 'lucide-react';

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

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Card><CardContent className="p-6 text-center text-sm text-red-500">{error}</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Teams</h1>
        <p className="text-sm text-surface-500 mt-1">{teams.length} team{teams.length !== 1 ? 's' : ''} · {departments.length} department{departments.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Departments */}
      {departments.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-surface-400" />
            <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Departments</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departments.map((dept) => (
              <Link key={dept.id} href={`/teams/departments/${dept.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-brand-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{dept.name}</CardTitle>
                        {dept.code && <p className="text-xs text-surface-400 font-mono mt-0.5">{dept.code}</p>}
                      </div>
                      <Badge variant={dept.isActive ? 'success' : 'default'}>{dept.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {dept.description && <p className="text-sm text-surface-500 mb-2">{dept.description}</p>}
                    {dept.headUserId && (
                      <p className="text-xs text-surface-400">Head: {dept.headUserId.substring(0, 8)}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Teams */}
      {teams.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-surface-400" />
            <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300">Teams</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <Link key={team.id} href={`/teams/${team.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer hover:border-brand-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <CardTitle className="text-base truncate">{team.name}</CardTitle>
                        {team.code && <p className="text-xs text-surface-400 font-mono mt-0.5">{team.code}</p>}
                      </div>
                      <Badge variant={team.isActive ? 'success' : 'default'}>{team.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {team.description && <p className="text-sm text-surface-500">{team.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-surface-400">
                      {team.leadUserId && <span>Lead: {team.leadUserId.substring(0, 8)}</span>}
                      {team.departmentId && <span>Dept: {team.departmentId.substring(0, 8)}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {teams.length === 0 && departments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-surface-400">
            <Users className="mx-auto h-8 w-8 mb-2 opacity-50" />
            No teams or departments configured yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
