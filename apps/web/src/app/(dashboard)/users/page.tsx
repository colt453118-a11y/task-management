'use client';

import { useState } from 'react';
import { Search, Plus, Mail, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const users = [
  { id: '1', name: 'Alex Johnson', email: 'alex@company.com', role: 'Administrator', department: 'Engineering', status: 'active' as const, initials: 'AJ' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@company.com', role: 'Member', department: 'Design', status: 'active' as const, initials: 'SC' },
  { id: '3', name: 'Mike Torres', email: 'mike@company.com', role: 'Member', department: 'Engineering', status: 'active' as const, initials: 'MT' },
  { id: '4', name: 'Emma Wilson', email: 'emma@company.com', role: 'Member', department: 'Product', status: 'active' as const, initials: 'EW' },
  { id: '5', name: 'David Park', email: 'david@company.com', role: 'Member', department: 'Engineering', status: 'suspended' as const, initials: 'DP' },
];

const roleBadge: Record<string, 'primary' | 'default'> = {
  Administrator: 'primary',
  Member: 'default',
};

export default function UsersPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Users</h1>
          <p className="mt-1 text-sm text-surface-500">Manage team members and their access</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Mail className="mr-2 h-4 w-4" />
            Invite
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="search"
          placeholder="Search users by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-surface-200 bg-white py-1.5 pl-9 pr-3 text-sm placeholder:text-surface-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-surface-700 dark:bg-surface-900"
        />
      </div>

      {/* Users Table */}
      <div className="rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="px-4 py-3 text-left font-medium text-surface-500">User</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Role</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Department</th>
                <th className="px-4 py-3 text-left font-medium text-surface-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-surface-100 transition-colors hover:bg-surface-50 last:border-0 dark:border-surface-800 dark:hover:bg-surface-800"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{user.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-surface-900 dark:text-surface-50">{user.name}</p>
                        <p className="text-xs text-surface-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={roleBadge[user.role]}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{user.department}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                      user.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        user.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button className="rounded-md p-1.5 text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
