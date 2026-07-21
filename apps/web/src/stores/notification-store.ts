'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types ──────────────────────────────────────────────────

export type Notification = {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  isRead: boolean;
  isDismissed: boolean;
  readAt: string | null;
  createdAt: string;
};

// ─── Store Interface ────────────────────────────────────────

interface NotificationStore {
  notifications: Notification[];
  totalCount: number;
  unreadCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  fetchNotifications: (params?: { limit?: number; offset?: number; unreadOnly?: boolean }) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  addOptimistic: (notification: Notification) => void;
  removeOptimistic: (notificationId: string) => void;
}

// ─── Store ──────────────────────────────────────────────────

export const useNotificationStore = create<NotificationStore>()(
  devtools(
    (set, get) => ({
      notifications: [],
      totalCount: 0,
      unreadCount: 0,
      loading: false,
      error: null,

      fetchNotifications: async (params) => {
        set({ loading: true, error: null });
        try {
          const query = new URLSearchParams();
          if (params?.limit) query.set('limit', String(params.limit));
          if (params?.offset) query.set('offset', String(params.offset));
          if (params?.unreadOnly) query.set('unread', 'true');

          const res = await fetch(`/api/notifications?${query.toString()}`);
          if (!res.ok) throw new Error('Failed to fetch notifications');
          const data = await res.json();
          set({
            notifications: data.notifications ?? [],
            totalCount: data.total ?? 0,
            unreadCount: data.unreadCount ?? 0,
            loading: false,
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : 'Failed to fetch notifications',
            loading: false,
          });
        }
      },

      fetchUnreadCount: async () => {
        try {
          const res = await fetch('/api/notifications/unread');
          if (!res.ok) return;
          const data = await res.json();
          set({ unreadCount: data.unreadCount ?? 0 });
        } catch {
          // Silently fail — non-critical
        }
      },

      markAsRead: async (notificationId) => {
        // Optimistic update
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, isRead: true, readAt: new Date().toISOString() } : n,
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }));

        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_read', notificationId }),
          });
        } catch {
          // Revert on failure
          get().fetchNotifications();
        }
      },

      markAllAsRead: async () => {
        const prevUnread = get().unreadCount;
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.isRead ? n : { ...n, isRead: true, readAt: new Date().toISOString() },
          ),
          unreadCount: 0,
        }));

        try {
          await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'mark_all_read' }),
          });
        } catch {
          set({ unreadCount: prevUnread });
          get().fetchNotifications();
        }
      },

      dismiss: async (notificationId) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          totalCount: state.totalCount - 1,
          unreadCount: state.notifications.find((n) => n.id === notificationId)?.isRead
            ? state.unreadCount
            : Math.max(0, state.unreadCount - 1),
        }));

        try {
          await fetch(`/api/notifications?id=${notificationId}`, { method: 'DELETE' });
        } catch {
          get().fetchNotifications();
        }
      },

      addOptimistic: (notification) => {
        set((state) => ({
          notifications: [notification, ...state.notifications],
          totalCount: state.totalCount + 1,
          unreadCount: state.unreadCount + 1,
        }));
      },

      removeOptimistic: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== notificationId),
          totalCount: Math.max(0, state.totalCount - 1),
        }));
      },
    }),
    { name: 'notification-store' },
  ),
);
