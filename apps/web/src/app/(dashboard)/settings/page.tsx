'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/state-display';
import {
  Loader2,
  Plus,
  Shield,
  Users,
  Edit3,
  Trash2,
  X,
  Check,
  AlertCircle,
  UserPlus,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

type Tab = 'general' | 'roles' | 'security' | 'notifications';

type Organization = {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  settings: Record<string, unknown>;
};

type Role = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  createdAt: string;
  permissionCount: number;
  userCount: number;
};

type Permission = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
};

type UserRole = {
  id: string;
  roleId: string;
  userId: string;
  assignedAt: string;
  role: { id: string; name: string; slug: string; description: string | null; isSystem: boolean };
};

type User = {
  id: string;
  name: string | null;
  email: string;
};

// ─── Permission modules with display info ───────────────────

const moduleLabels: Record<string, string> = {
  task: 'Tasks',
  project: 'Projects',
  team: 'Teams',
  role: 'Roles & Permissions',
  user: 'Users',
  report: 'Reports',
  settings: 'Settings',
  organization: 'Organization',
};

// ─── Helpers ────────────────────────────────────────────────

const moduleColors: Record<string, string> = {
  task: 'bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  project: 'bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  team: 'bg-green-50 text-green-700 dark:bg-green-900 dark:text-green-300',
  role: 'bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  user: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  report: 'bg-rose-50 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  settings: 'bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300',
  organization: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
};

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  const first = (parts[0] ?? '').charAt(0).toUpperCase();
  const last = (parts[parts.length - 1] ?? '').charAt(0).toUpperCase();
  return first + last;
}

// ─── Page Component ─────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');

  // Roles state
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);

  // User-role assignment state
  const [users, setUsers] = useState<User[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, UserRole[]>>({});
  const [assigningUser, setAssigningUser] = useState<string | null>(null);

  // Role editor state
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', slug: '', description: '' });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  // Delete state
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Fetch org data ────────────────────────────────────

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch('/api/organization');
        if (!res.ok) throw new Error('Failed to fetch organization');
        const data = await res.json();
        setOrg(data.organization ?? null);
        setName(data.organization?.name ?? '');
      } catch {
        // Leave org as null; form fields stay empty
      } finally {
        setLoading(false);
      }
    }
    fetchOrg();
  }, []);

  // ── Fetch roles and permissions ───────────────────────

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/permissions'),
      ]);
      if (!rolesRes.ok) throw new Error('Failed to fetch roles');
      if (!permsRes.ok) throw new Error('Failed to fetch permissions');
      const rolesData = await rolesRes.json();
      const permsData = await permsRes.json();
      setRoles(rolesData.roles ?? []);
      setPermissions(permsData.permissions ?? []);
    } catch (err) {
      setRolesError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=100');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch {
      // Users are non-critical for roles page
    }
  }, []);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/roles`);
      if (res.ok) {
        const data = await res.json();
        setUserRolesMap((prev) => ({ ...prev, [userId]: data.userRoles ?? [] }));
      }
    } catch {
      // Silently handle
    }
  }, []);

  useEffect(() => {
    if (tab === 'roles') {
      fetchRoles();
      fetchUsers();
    }
  }, [tab, fetchRoles, fetchUsers]);

  // ── Role CRUD ─────────────────────────────────────────

  const openCreateDialog = () => {
    setEditingRole(null);
    setRoleForm({ name: '', slug: '', description: '' });
    setSelectedPermissionIds([]);
    setRoleError(null);
    setShowRoleDialog(true);
  };

  const openEditDialog = async (role: Role) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, slug: role.slug, description: role.description ?? '' });
    setRoleError(null);

    // Fetch role's permission IDs
    try {
      const res = await fetch(`/api/roles/${role.id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedPermissionIds(data.permissionIds ?? []);
      } else {
        setSelectedPermissionIds([]);
      }
    } catch {
      setSelectedPermissionIds([]);
    }

    setShowRoleDialog(true);
  };

  const saveRole = async () => {
    if (!roleForm.name.trim() || !roleForm.slug.trim()) {
      setRoleError('Name and slug are required');
      return;
    }

    setSavingRole(true);
    setRoleError(null);

    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...roleForm,
          permissionIds: selectedPermissionIds,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message ?? 'Failed to save role');
      }

      setShowRoleDialog(false);
      fetchRoles();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSavingRole(false);
    }
  };

  const confirmDeleteRole = (role: Role) => {
    setDeletingRoleId(role.id);
    setShowDeleteConfirm(true);
  };

  const deleteRole = async () => {
    if (!deletingRoleId) return;

    try {
      const res = await fetch(`/api/roles/${deletingRoleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete role');
      setShowDeleteConfirm(false);
      setDeletingRoleId(null);
      fetchRoles();
    } catch (err) {
      console.error('Failed to delete role:', err);
      setShowDeleteConfirm(false);
    }
  };

  // ── User role assignment ──────────────────────────────

  const assignRole = async (userId: string, roleId: string) => {
    if (!roleId) return;
    setAssigningUser(userId);
    try {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      if (res.ok) {
        fetchUserRoles(userId);
      }
    } catch {
      // Silently handle
    } finally {
      setAssigningUser(null);
    }
  };

  const removeRole = async (userId: string, roleId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}/roles?roleId=${roleId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchUserRoles(userId);
      }
    } catch {
      // Silently handle
    }
  };

  // ── Toggle permission ─────────────────────────────────

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  // ── Group permissions by module ───────────────────────

  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    if (!acc[perm.module]) acc[perm.module] = [];
    acc[perm.module]!.push(perm);
    return acc;
  }, {});

  // ── Render ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' },
    { id: 'roles', label: 'Roles & Permissions' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Settings</h1>
        <p className="text-sm text-surface-500 mt-1">Manage your workspace settings</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-surface-200 dark:border-surface-700 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── General Tab ─────────────────────────────────── */}
      {tab === 'general' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-md rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Slug
              </label>
              <input
                type="text"
                value={org?.slug ?? ''}
                disabled
                className="w-full max-w-md rounded-md border border-surface-200 bg-surface-50 px-3 py-2 text-sm text-surface-400 dark:bg-surface-800 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                Domain
              </label>
              <input
                type="text"
                value={org?.domain ?? ''}
                placeholder="your-company.com"
                className="w-full max-w-md rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-900 dark:text-surface-100"
              />
            </div>
            <div className="pt-2">
              <Button disabled title="Coming soon">Save Changes</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Roles & Permissions Tab ─────────────────────── */}
      {tab === 'roles' && (
        <div className="space-y-6">
          {/* Roles List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-surface-400" />
                Roles
              </CardTitle>
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                New Role
              </Button>
            </CardHeader>
            <CardContent>
              {rolesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
                </div>
              ) : rolesError ? (
                <div className="flex flex-col items-center py-8">
                  <AlertCircle className="h-8 w-8 text-red-400 mb-2" />
                  <p className="text-sm text-red-500">{rolesError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={fetchRoles}>
                    Retry
                  </Button>
                </div>
              ) : roles.length === 0 ? (
                <EmptyState
                  icon={<Shield className="h-12 w-12 text-surface-300" />}
                  title="No roles yet"
                  message="Create your first role to set up permissions."
                  action={
                    <Button size="sm" onClick={openCreateDialog}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Create Role
                    </Button>
                  }
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-200 dark:border-surface-700">
                        <th className="px-3 py-2.5 text-left font-medium text-surface-500">Name</th>
                        <th className="px-3 py-2.5 text-left font-medium text-surface-500">Slug</th>
                        <th className="px-3 py-2.5 text-left font-medium text-surface-500">Permissions</th>
                        <th className="px-3 py-2.5 text-left font-medium text-surface-500">Users</th>
                        <th className="px-3 py-2.5 text-left font-medium text-surface-500">Status</th>
                        <th className="px-3 py-2.5 w-20" />
                      </tr>
                    </thead>
                    <tbody>
                      {roles.map((role) => (
                        <tr
                          key={role.id}
                          className="border-b border-surface-100 hover:bg-surface-50 transition-colors dark:border-surface-800 dark:hover:bg-surface-800/50"
                        >
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-surface-900 dark:text-surface-50">
                              {role.name}
                            </span>
                            {role.isSystem && (
                              <Badge variant="primary" className="ml-2 text-[10px] px-1.5 py-0">
                                System
                              </Badge>
                            )}
                            {role.description && (
                              <p className="text-xs text-surface-400 mt-0.5">{role.description}</p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-surface-500">{role.slug}</td>
                          <td className="px-3 py-2.5">
                            <Badge variant="default">{role.permissionCount}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="default">{role.userCount}</Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={role.isActive ? 'success' : 'default'}>
                              {role.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => openEditDialog(role)}
                                className="rounded p-1.5 text-surface-400 hover:text-brand-600 hover:bg-surface-100 dark:hover:bg-surface-800"
                                title="Edit role"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              {!role.isSystem && (
                                <button
                                  onClick={() => confirmDeleteRole(role)}
                                  className="rounded p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                  title="Delete role"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Role Assignments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-surface-400" />
                User Role Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <EmptyState
                  icon={<UserPlus className="h-10 w-10 text-surface-300" />}
                  title="No users found"
                  message="Users will appear here once they join the workspace."
                />
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg border border-surface-200 px-4 py-3 dark:border-surface-700"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                          {getInitials(user.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-surface-900 dark:text-surface-50 truncate">
                            {user.name ?? 'Unnamed'}
                          </p>
                          <p className="text-xs text-surface-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Assigned role badges */}
                        {userRolesMap[user.id]?.map((ur) => (
                          <span
                            key={ur.roleId}
                            className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                          >
                            {ur.role.name}
                            <button
                              onClick={() => removeRole(user.id, ur.roleId)}
                              className="hover:text-red-500"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        )) ?? (
                          <span className="text-xs text-surface-400">No roles</span>
                        )}

                        {/* Assign role dropdown */}
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              assignRole(user.id, e.target.value);
                            }
                          }}
                          className="ml-2 h-7 rounded-md border border-surface-300 bg-white px-2 text-xs dark:bg-surface-800 dark:text-surface-100"
                        >
                          <option value="">
                            {assigningUser === user.id ? 'Assigning...' : '+ Add role'}
                          </option>
                          {roles
                            .filter((r) => !userRolesMap[user.id]?.some((ur) => ur.roleId === r.id))
                            .map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Security Tab ────────────────────────────────── */}
      {tab === 'security' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Security Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-500">Security settings coming soon.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Notifications Tab ───────────────────────────── */}
      {tab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-surface-500">Notification preferences coming soon.</p>
          </CardContent>
        </Card>
      )}

      {/* ── Role Create/Edit Dialog ─────────────────────── */}
      {showRoleDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-surface-200 bg-white p-6 shadow-lg dark:border-surface-700 dark:bg-surface-900">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                {editingRole ? 'Edit Role' : 'Create Role'}
              </h3>
              <button
                onClick={() => setShowRoleDialog(false)}
                className="rounded p-1 text-surface-400 hover:text-surface-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value, slug: editingRole ? roleForm.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="e.g. Project Manager"
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800 dark:text-surface-100"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Slug
                </label>
                <input
                  type="text"
                  value={roleForm.slug}
                  onChange={(e) => setRoleForm({ ...roleForm, slug: e.target.value })}
                  placeholder="e.g. project-manager"
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800 dark:text-surface-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-surface-800 dark:text-surface-100"
                />
              </div>

              {/* Permissions */}
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Permissions
                </label>
                <div className="max-h-64 overflow-y-auto space-y-3 rounded-md border border-surface-200 p-3 dark:border-surface-700">
                  {Object.entries(groupedPermissions).map(([module, perms]) => (
                    <div key={module}>
                      <p className={`text-xs font-semibold uppercase mb-1.5 inline-block rounded px-1.5 py-0.5 ${
                        moduleColors[module] ?? 'bg-surface-100 text-surface-600'
                      }`}>
                        {moduleLabels[module] ?? module}
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {perms.map((perm) => (
                          <label
                            key={perm.id}
                            className="flex items-center gap-2 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-surface-50 dark:hover:bg-surface-800"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.includes(perm.id)}
                              onChange={() => togglePermission(perm.id)}
                              className="rounded border-surface-300 text-brand-600 focus:ring-brand-500"
                            />
                            <span className="text-surface-700 dark:text-surface-300">{perm.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {permissions.length === 0 && (
                    <p className="text-sm text-surface-400 text-center py-4">No permissions defined.</p>
                  )}
                </div>
              </div>

              {/* Error */}
              {roleError && (
                <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {roleError}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={saveRole} disabled={savingRole}>
                  {savingRole ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Check className="h-4 w-4 mr-1" />
                  )}
                  {editingRole ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ──────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg border border-surface-200 bg-white p-6 shadow-lg dark:border-surface-700 dark:bg-surface-900">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-50">
                  Delete Role
                </h3>
                <p className="text-sm text-surface-500">
                  Are you sure? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={deleteRole}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
