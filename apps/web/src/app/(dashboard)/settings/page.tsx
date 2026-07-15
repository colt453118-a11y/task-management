'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/state-display';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Shield, Users, Edit3, Trash2, X, Check, AlertCircle, UserPlus, Settings as SettingsIcon } from 'lucide-react';

type Tab = 'general' | 'roles' | 'security' | 'notifications';
type Organization = { id: string; name: string; slug: string; domain: string | null; settings: Record<string, unknown>; };
type Role = { id: string; name: string; slug: string; description: string | null; isSystem: boolean; isActive: boolean; priority: number; createdAt: string; permissionCount: number; userCount: number; };
type Permission = { id: string; code: string; name: string; description: string | null; module: string; };
type UserRole = { id: string; roleId: string; userId: string; assignedAt: string; role: { id: string; name: string; slug: string; description: string | null; isSystem: boolean; }; };
type User = { id: string; name: string | null; email: string; };

const moduleLabels: Record<string, string> = { task: 'Tasks', project: 'Projects', team: 'Teams', role: 'Roles & Permissions', user: 'Users', report: 'Reports', settings: 'Settings', organization: 'Organization' };
const moduleColors: Record<string, string> = { task: 'bg-blue-500/10 text-blue-400', project: 'bg-purple-500/10 text-purple-400', team: 'bg-green-500/10 text-green-400', role: 'bg-amber-500/10 text-amber-400', user: 'bg-cyan-500/10 text-cyan-400', report: 'bg-rose-500/10 text-rose-400', settings: 'bg-slate-500/10 text-slate-400', organization: 'bg-indigo-500/10 text-indigo-400' };

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'; const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? '').charAt(0).toUpperCase();
  return ((parts[0] ?? '').charAt(0) + (parts[parts.length - 1] ?? '').charAt(0)).toUpperCase();
}

const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const itemVariants = { hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } } };

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('general');
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [userRolesMap, setUserRolesMap] = useState<Record<string, UserRole[]>>({});
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', slug: '', description: '' });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch('/api/organization');
        if (!res.ok) throw new Error('Failed to fetch organization');
        const data = await res.json();
        setOrg(data.organization ?? null);
        setName(data.organization?.name ?? '');
      } catch { /* */ } finally { setLoading(false); }
    }
    fetchOrg();
  }, []);

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true); setRolesError(null);
    try {
      const [rolesRes, permsRes] = await Promise.all([fetch('/api/roles'), fetch('/api/permissions')]);
      if (!rolesRes.ok) throw new Error('Failed to fetch roles');
      if (!permsRes.ok) throw new Error('Failed to fetch permissions');
      setRoles((await rolesRes.json()).roles ?? []);
      setPermissions((await permsRes.json()).permissions ?? []);
    } catch (err) { setRolesError(err instanceof Error ? err.message : 'Failed to load roles'); }
    finally { setRolesLoading(false); }
  }, []);

  const fetchUsers = useCallback(async () => {
    try { const res = await fetch('/api/users?limit=100'); if (res.ok) setUsers((await res.json()).users ?? []); } catch { /* */ }
  }, []);

  const fetchUserRoles = useCallback(async (userId: string) => {
    try { const res = await fetch(`/api/users/${userId}/roles`); if (res.ok) { const data = await res.json(); setUserRolesMap((prev) => ({ ...prev, [userId]: data.userRoles ?? [] })); } } catch { /* */ }
  }, []);

  useEffect(() => { if (tab === 'roles') { startTransition(() => { fetchRoles(); fetchUsers(); }); } }, [tab, fetchRoles, fetchUsers]);

  const openCreateDialog = () => { setEditingRole(null); setRoleForm({ name: '', slug: '', description: '' }); setSelectedPermissionIds([]); setRoleError(null); setShowRoleDialog(true); };

  const openEditDialog = async (role: Role) => {
    setEditingRole(role); setRoleForm({ name: role.name, slug: role.slug, description: role.description ?? '' }); setRoleError(null);
    try { const res = await fetch(`/api/roles/${role.id}`); if (res.ok) setSelectedPermissionIds((await res.json()).permissionIds ?? []); else setSelectedPermissionIds([]); } catch { setSelectedPermissionIds([]); }
    setShowRoleDialog(true);
  };

  const saveRole = async () => {
    if (!roleForm.name.trim() || !roleForm.slug.trim()) { setRoleError('Name and slug are required'); return; }
    setSavingRole(true); setRoleError(null);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : '/api/roles';
      const method = editingRole ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...roleForm, permissionIds: selectedPermissionIds }) });
      if (!res.ok) { const errData = await res.json(); throw new Error(errData.error?.message ?? 'Failed to save role'); }
      setShowRoleDialog(false); fetchRoles();
    } catch (err) { setRoleError(err instanceof Error ? err.message : 'Failed to save role'); }
    finally { setSavingRole(false); }
  };

  const deleteRole = async () => {
    if (!deletingRoleId) return;
    try { const res = await fetch(`/api/roles/${deletingRoleId}`, { method: 'DELETE' }); if (!res.ok) throw new Error('Failed to delete role'); setShowDeleteConfirm(false); setDeletingRoleId(null); fetchRoles(); } catch { setShowDeleteConfirm(false); }
  };

  const assignRole = async (userId: string, roleId: string) => {
    if (!roleId) return; setAssigningUser(userId);
    try { const res = await fetch(`/api/users/${userId}/roles`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId }) }); if (res.ok) fetchUserRoles(userId); } catch { /* */ }
    finally { setAssigningUser(null); }
  };

  const removeRole = async (userId: string, roleId: string) => {
    try { const res = await fetch(`/api/users/${userId}/roles?roleId=${roleId}`, { method: 'DELETE' }); if (res.ok) fetchUserRoles(userId); } catch { /* */ }
  };

  const togglePermission = (permissionId: string) => {
    setSelectedPermissionIds((prev) => prev.includes(permissionId) ? prev.filter((id) => id !== permissionId) : [...prev, permissionId]);
  };

  const groupedPermissions = permissions.reduce<Record<string, Permission[]>>((acc, perm) => {
    const module = perm.module;
    if (!acc[module]) acc[module] = [];
    acc[module]!.push(perm);
    return acc;
  }, {});

  if (loading) {
    return (<div className="space-y-6 animate-fade-in"><div className="h-8 w-32 shimmer rounded-lg" /><div className="mt-2 h-4 w-48 shimmer rounded-md" /><div className="h-10 w-96 shimmer rounded-xl" /><div className="h-48 shimmer rounded-xl" /></div>);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'General' }, { id: 'roles', label: 'Roles & Permissions' },
    { id: 'security', label: 'Security' }, { id: 'notifications', label: 'Notifications' },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold tracking-tight text-surface-900">Settings</h1>
        <p className="text-sm text-surface-500 mt-1">Manage your workspace settings</p>
      </motion.div>

      <motion.div variants={itemVariants} className="flex gap-1 border-b border-surface-300/20 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all duration-200 ${
              tab === t.id ? 'border-brand-500 text-brand-500' : 'border-transparent text-surface-500 hover:text-surface-600 hover:border-surface-400/30 dark:hover:text-surface-300'
            }`}>{t.label}</button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === 'general' && (
          <motion.div key="general" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="neon-card">
              <CardHeader><CardTitle><SettingsIcon className="h-4 w-4 inline mr-2 text-surface-400" />General Settings</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Organization Name</label>
                  <input type="text" value={name} disabled className="w-full max-w-md rounded-xl border border-surface-300/20 bg-surface-200/50 px-3 py-2.5 text-sm text-surface-500 cursor-not-allowed" /></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Slug</label>
                  <input type="text" value={org?.slug ?? ''} disabled className="w-full max-w-md rounded-xl border border-surface-300/20 bg-surface-200/50 px-3 py-2.5 text-sm text-surface-500 cursor-not-allowed" /></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1.5">Domain</label>
                  <input type="text" value={org?.domain ?? ''} placeholder="your-company.com" disabled className="w-full max-w-md rounded-xl border border-surface-300/20 bg-surface-200/50 px-3 py-2.5 text-sm text-surface-500 cursor-not-allowed" /></div>
                <p className="text-xs text-surface-500">General settings cannot be edited yet.</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {tab === 'roles' && (
          <motion.div key="roles" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
            <Card className="neon-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-surface-500" />Roles</CardTitle>
                <Button size="sm" onClick={openCreateDialog}><Plus className="h-3.5 w-3.5 mr-1.5" />New Role</Button>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <div className="space-y-3">{[1, 2, 3].map((i) => (<div key={i} className="h-12 shimmer rounded-xl" />))}</div>
                ) : rolesError ? (
                  <div className="flex flex-col items-center py-8"><AlertCircle className="h-8 w-8 text-error mb-2" /><p className="text-sm text-error">{rolesError}</p>                  <Button variant="outline" size="sm" className="mt-3" onClick={fetchRoles}>Retry</Button></div>
                ) : roles.length === 0 ? (
                  <EmptyState icon={<Shield className="h-12 w-12 text-surface-400" />} title="No roles yet" message="Create your first role to set up permissions." action={<Button size="sm" onClick={openCreateDialog}><Plus className="h-4 w-4 mr-1.5" />Create Role</Button>} />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-surface-300/30">
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Name</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Slug</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Perms</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Users</th>
                          <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-surface-500">Status</th>
                          <th className="px-3 py-2.5 w-20" />
                        </tr>
                      </thead>
                      <tbody>
                        {roles.map((role) => (
                          <tr key={role.id} className="border-b border-surface-300/20 transition-colors hover:bg-surface-200/30">
                            <td className="px-3 py-2.5">
                              <span className="font-medium text-surface-900">{role.name}</span>
                              {role.isSystem && <Badge variant="primary" className="ml-2 text-[10px] px-1.5 py-0">System</Badge>}
                              {role.description && <p className="text-xs text-surface-500 mt-0.5">{role.description}</p>}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-xs text-surface-500">{role.slug}</td>
                            <td className="px-3 py-2.5"><Badge variant="default">{role.permissionCount}</Badge></td>
                            <td className="px-3 py-2.5"><Badge variant="default">{role.userCount}</Badge></td>
                            <td className="px-3 py-2.5">                          <Badge variant={role.isActive ? 'success' : 'default'} size="sm">{role.isActive ? 'Active' : 'Inactive'}</Badge></td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditDialog(role)} className="rounded-lg p-1.5 text-surface-500 transition-all hover:text-brand-500 hover:bg-surface-200"><Edit3 className="h-3.5 w-3.5" /></button>
                                {!role.isSystem && <button onClick={() => { setDeletingRoleId(role.id); setShowDeleteConfirm(true); }} className="rounded-lg p-1.5 text-surface-500 transition-all hover:text-error hover:bg-error/5"><Trash2 className="h-3.5 w-3.5" /></button>}
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

            <Card className="neon-card">
              <CardHeader><CardTitle><Users className="h-4 w-4 text-surface-400 mr-2" />User Role Assignments</CardTitle></CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <EmptyState icon={<UserPlus className="h-10 w-10 text-surface-400" />} title="No users found" message="Users will appear here once they join the workspace." />
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between rounded-xl border border-surface-300/30 bg-surface-100 px-4 py-3 transition-all hover:border-surface-400/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-medium text-white">{getInitials(user.name)}</div>
                          <div className="min-w-0"><p className="text-sm font-medium text-surface-900 truncate">{user.name ?? 'Unnamed'}</p><p className="text-xs text-surface-500 truncate">{user.email}</p></div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(userRolesMap[user.id] ?? []).map((ur) => (
                            <span key={ur.roleId} className="inline-flex items-center gap-1 rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-400">
                              {ur.role.name}
                              <button onClick={() => removeRole(user.id, ur.roleId)} className="hover:text-error"><X className="h-3 w-3" /></button>
                            </span>
                          ))}
                          {(userRolesMap[user.id] ?? []).length === 0 && <span className="text-xs text-surface-500">No roles</span>}
                          <select value="" onChange={(e) => { if (e.target.value) assignRole(user.id, e.target.value); }}
                            className="ml-2 h-7 rounded-lg border border-surface-300/30 bg-surface-100 px-2 text-xs transition-all hover:border-surface-400/30">
                            <option value="">{assigningUser === user.id ? 'Assigning...' : '+ Add role'}</option>
                            {roles.filter((r) => !(userRolesMap[user.id] ?? []).some((ur) => ur.roleId === r.id)).map((r) => (
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
          </motion.div>
        )}

        {tab === 'security' && (
          <motion.div key="security" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="neon-card">              <CardHeader><CardTitle>Security Settings</CardTitle></CardHeader><CardContent><p className="text-sm text-surface-500">Security settings coming soon.</p></CardContent></Card>
          </motion.div>
        )}

        {tab === 'notifications' && (
          <motion.div key="notifications" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="neon-card"><CardHeader><CardTitle className="text-base">Notification Preferences</CardTitle></CardHeader><CardContent><p className="text-sm text-surface-500">Notification preferences coming soon.</p></CardContent></Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Role Dialog */}
      <AnimatePresence>
        {showRoleDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-lg rounded-2xl border border-surface-300/30 bg-surface-50/95 backdrop-blur-xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-surface-900">{editingRole ? 'Edit Role' : 'Create Role'}</h3>
                <button onClick={() => setShowRoleDialog(false)} className="rounded-lg p-1.5 text-surface-500 transition-all hover:bg-surface-200/70 hover:text-surface-600"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Name</label>
                  <input type="text" value={roleForm.name} onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value, slug: editingRole ? roleForm.slug : e.target.value.toLowerCase().replace(/\s+/g, '-') })} placeholder="e.g. Project Manager"
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Slug</label>
                  <input type="text" value={roleForm.slug} onChange={(e) => setRoleForm({ ...roleForm, slug: e.target.value })} placeholder="e.g. project-manager"
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-1">Description</label>
                  <input type="text" value={roleForm.description} onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })} placeholder="Optional description"
                    className="w-full rounded-xl border border-surface-300/30 bg-surface-100 px-3 py-2.5 text-sm transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></div>
                <div><label className="block text-xs font-semibold uppercase tracking-wider text-surface-500 mb-2">Permissions</label>
                  <div className="max-h-64 overflow-y-auto space-y-3 rounded-xl border border-surface-300/30 p-3">
                    {Object.entries(groupedPermissions).map(([module, perms]) => (
                      <div key={module}>
                        <p className={`text-xs font-semibold uppercase mb-1.5 inline-block rounded-lg px-1.5 py-0.5 ${moduleColors[module] ?? 'bg-surface-200 text-surface-500'}`}>{moduleLabels[module] ?? module}</p>
                        <div className="grid grid-cols-2 gap-1">
                          {perms.map((perm) => (
                            <label key={perm.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer transition-colors hover:bg-surface-200">
                              <input type="checkbox" checked={selectedPermissionIds.includes(perm.id)} onChange={() => togglePermission(perm.id)} className="rounded border-surface-400 text-brand-500 focus:ring-brand-500" />
                              <span className="text-surface-600">{perm.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    {permissions.length === 0 && <p className="text-sm text-surface-500 text-center py-4">No permissions defined.</p>}
                  </div>
                </div>
                {roleError && <div className="flex items-center gap-2 rounded-xl bg-error/5 px-3 py-2 text-sm text-error"><AlertCircle className="h-4 w-4 shrink-0" />{roleError}</div>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setShowRoleDialog(false)} className="rounded-xl">Cancel</Button>
                  <Button onClick={saveRole} disabled={savingRole} className="rounded-xl">{savingRole ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}{editingRole ? 'Update' : 'Create'}</Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm rounded-2xl border border-surface-300/30 bg-surface-50/95 backdrop-blur-xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-error/10"><AlertCircle className="h-5 w-5 text-error" /></div>
                <div><h3 className="text-lg font-semibold text-surface-900">Delete Role</h3><p className="text-sm text-surface-500">Are you sure? This action cannot be undone.</p></div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="rounded-xl">Cancel</Button>
                <Button variant="destructive" onClick={deleteRole} className="rounded-xl"><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
