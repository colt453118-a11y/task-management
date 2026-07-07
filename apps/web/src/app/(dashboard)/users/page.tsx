'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-display';
import { Search, Loader2, Plus, Users as UsersIcon } from 'lucide-react';

type UserRecord = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  designation: string | null;
  departmentId: string | null;
  teamId: string | null;
  employmentStatus: string;
  isActive: boolean;
  createdAt: string;
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/users');
        if (!res.ok) throw new Error('Failed to fetch users');
        const data = await res.json();
        setUsers(data.users ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = search
    ? users.filter((u) => {
        const q = search.toLowerCase();
        return (
          (u.firstName?.toLowerCase() ?? '').includes(q) ||
          (u.lastName?.toLowerCase() ?? '').includes(q) ||
          (u.email?.toLowerCase() ?? '').includes(q) ||
          (u.displayName?.toLowerCase() ?? '').includes(q)
        );
      })
    : users;

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
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">People</h1>
        <p className="text-sm text-surface-500 mt-1">{users.length} team member{users.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-surface-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900 dark:text-surface-100"
        />
      </div>

      {filtered.length === 0 ? (
        search ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-surface-400">
              No people match your search.
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<UsersIcon className="h-12 w-12 text-surface-300" />}
            title="No team members yet"
            message="Invite your team members to collaborate on tasks and projects."
            action={
              <Button disabled title="Coming soon">
                <Plus className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user) => (
            <Card key={user.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {(user.firstName?.[0] ?? user.name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-900 truncate dark:text-surface-100">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.name ?? user.email}
                    </p>
                    <p className="text-xs text-surface-500 truncate">{user.email}</p>
                    {user.designation && (
                      <p className="text-xs text-surface-400 mt-0.5">{user.designation}</p>
                    )}
                  </div>
                  <Badge variant={user.isActive ? 'success' : 'default'}>
                    {user.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
