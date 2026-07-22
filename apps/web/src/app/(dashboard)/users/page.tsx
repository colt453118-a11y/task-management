'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/state-display';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Users as UsersIcon,
  AlertCircle,
  Plus,
  X,
  Loader2,
  Check,
  Mail,
} from 'lucide-react';

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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } },
} as const;

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDesignation, setInviteDesignation] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

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

  const openInvite = () => {
    setInviteEmail('');
    setInviteDesignation('');
    setInviteError(null);
    setInviteSuccess(false);
    setShowInvite(true);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim() || !inviteEmail.includes('@')) {
      setInviteError('Valid email is required');
      return;
    }
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          designation: inviteDesignation.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message ?? 'Failed to invite user');
      }
      const data = await res.json();
      if (data.user) setUsers((prev) => [data.user, ...prev]);
      setInviteSuccess(true);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setInviting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-32 rounded-lg" />
          <div className="shimmer mt-2 h-4 w-48 rounded-md" />
        </div>
        <div className="shimmer h-10 w-full max-w-md rounded-xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-surface-300/30 bg-surface-100 rounded-xl border p-5">
              <div className="flex items-center gap-3">
                <div className="shimmer h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="shimmer h-4 w-3/4 rounded-md" />
                  <div className="shimmer h-3 w-1/2 rounded-md" />
                </div>
              </div>
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
            <h2 className="text-surface-900 text-lg font-semibold">Failed to load users</h2>
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
          <h1 className="text-surface-900 text-2xl font-bold tracking-tight">People</h1>
          <p className="text-surface-500 mt-1 text-sm">
            {users.length} team member{users.length !== 1 ? 's' : ''}
          </p>
        </div>{' '}
        <Button onClick={openInvite} className="shadow-sm">
          <Plus className="mr-2 h-4 w-4" /> Invite Members
        </Button>
      </motion.div>

      <motion.div variants={itemVariants} className="relative max-w-md">
        <Search className="text-surface-500 absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search people..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-surface-300/30 bg-surface-100 placeholder:text-surface-500 hover:border-surface-400/30 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border py-2.5 pl-9 pr-3 text-sm transition-all duration-200 focus:outline-none focus:ring-2"
        />
      </motion.div>

      {filtered.length === 0 ? (
        search ? (
          <motion.div variants={itemVariants}>
            <Card className="neon-card">
              <CardContent className="py-12 text-center">
                <p className="text-surface-500 text-sm">No people match your search.</p>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div variants={itemVariants}>
            <EmptyState
              icon={<UsersIcon className="text-surface-400 h-16 w-16" />}
              title="No team members yet"
              message="Invite your team members to collaborate on tasks and projects."
              action={
                <Button onClick={openInvite} className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Invite Members
                </Button>
              }
            />
          </motion.div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((user, i) => (
            <motion.div key={user.id} variants={itemVariants} custom={i}>
              <motion.div
                whileHover={{ y: -2 }}
                className="border-surface-300/20 bg-surface-100/80 hover:border-brand-500/30 group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="from-brand-400 to-brand-600 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-medium text-white shadow-sm">
                    {(user.firstName?.[0] ?? user.name?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-surface-900 truncate font-medium">
                        {user.firstName && user.lastName
                          ? `${user.firstName} ${user.lastName}`
                          : (user.name ?? user.email)}
                      </p>
                      <Badge
                        variant={user.isActive ? 'success' : 'default'}
                        size="sm"
                        className="shrink-0"
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <p className="text-surface-500 mt-0.5 truncate text-xs">{user.email}</p>
                    {user.designation && (
                      <p className="text-surface-500 mt-1 text-xs">{user.designation}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Invite Member Modal */}
      <AnimatePresence>
        {showInvite && (
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
                <h3 className="text-surface-900 flex items-center gap-2 text-lg font-semibold">
                  <Mail className="h-4 w-4" /> Invite Member
                </h3>
                <button
                  onClick={() => setShowInvite(false)}
                  className="text-surface-500 hover:bg-surface-200 rounded-lg p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {inviteSuccess ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                    <Check className="h-6 w-6 text-green-400" />
                  </div>
                  <p className="text-surface-900 text-sm font-medium">Invitation sent!</p>
                  <p className="text-surface-500 mt-1 text-xs">{inviteEmail} has been invited.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                      Email <span className="text-error">*</span>
                    </label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      autoFocus
                      className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="text-surface-500 mb-1 block text-xs font-semibold uppercase tracking-wider">
                      Designation
                    </label>
                    <input
                      type="text"
                      value={inviteDesignation}
                      onChange={(e) => setInviteDesignation(e.target.value)}
                      placeholder="e.g. Frontend Developer"
                      className="border-surface-300/30 bg-surface-100 focus:border-brand-500 focus:ring-brand-500/20 w-full rounded-xl border px-3 py-2.5 text-sm transition-all focus:outline-none focus:ring-2"
                    />
                  </div>
                  {inviteError && (
                    <div className="bg-error/5 text-error flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      {inviteError}
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setShowInvite(false)}
                      className="rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button onClick={sendInvite} disabled={inviting} className="rounded-xl">
                      {inviting ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="mr-1 h-4 w-4" />
                      )}
                      Send Invite
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
