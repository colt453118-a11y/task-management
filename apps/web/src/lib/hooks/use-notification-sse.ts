'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useNotificationStore } from '@/stores/notification-store';
import type { Notification } from '@/stores/notification-store';
import { triggerNotificationFeedback } from '@/lib/notification-media';

/**
 * Maximum consecutive failures before we give up on SSE reconnection.
 * This prevents endless retries when the user is truly offline or the
 * endpoint is down permanently.
 */
const MAX_RETRIES = 20;

/**
 * Base delay (ms) for exponential backoff between reconnection attempts.
 */
const BASE_RETRY_DELAY = 1_000;

/**
 * Maximum delay (ms) between reconnection attempts.
 */
const MAX_RETRY_DELAY = 30_000;

/**
 * React hook that opens an SSE connection to `/api/notifications/sse` and
 * dispatches incoming notification events directly into the Zustand
 * notification store.
 *
 * Call this once at the app root (e.g. in Providers or the dashboard layout).
 * The hook handles:
 *   - Initial connection and send of all unread notifications
 *   - Real-time delivery of new notifications as they are created server-side
 *   - Automatic reconnection with exponential backoff on connection loss
 *   - Clean teardown on unmount
 */
/** Singleton flag — only one SSE connection per page session. */
let sseConnected = false;

export function useNotificationSSE() {
  const addOptimistic = useNotificationStore((s) => s.addOptimistic);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const fetchUnreadCount = useNotificationStore((s) => s.fetchUnreadCount);

  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const es = new EventSource('/api/notifications/sse');
    eventSourceRef.current = es;

    // ── Connected ───────────────────────────────────────────
    es.addEventListener('connected', ((event: MessageEvent) => {
      retryCountRef.current = 0; // Reset retry count on successful connection
      const data = JSON.parse(event.data);
      if (data.userId) {
        // Connection established — do a fresh unread count sync
        fetchUnreadCount();
      }
    }) as EventListener);

    // ── New notification(s) ─────────────────────────────────
    es.addEventListener('notification', ((event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const notifications: Notification[] = data.notifications ?? [];
        for (const notif of notifications) {
          addOptimistic(notif);
        }
        // Trigger sound + haptic feedback for new notifications
        if (notifications.length > 0) {
          triggerNotificationFeedback();
        }
      } catch {
        // Ignore malformed events
      }
    }) as EventListener);

    // ── Unread count update ────────────────────────────────
    es.addEventListener('unread', ((event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (typeof data.count === 'number') {
          setUnreadCount(data.count);
        }
      } catch {
        // Ignore
      }
    }) as EventListener);

    // ── Heartbeat (no-op, just keeps connection alive) ──────
    es.addEventListener('heartbeat', (() => {
      // Heartbeat received — connection is healthy
    }) as EventListener);

    // ── Error / Connection lost ─────────────────────────────
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      // Exponential backoff with jitter
      retryCountRef.current += 1;
      if (retryCountRef.current > MAX_RETRIES) {
        // Give up after too many retries — fall back to polling via fetchUnreadCount
        const fallbackInterval = setInterval(() => {
          fetchUnreadCount();
        }, 30_000);
        // Store ref on window for cleanup
        (window as unknown as Record<string, unknown>).__notifFallbackInterval = fallbackInterval;
        return;
      }

      const delay = Math.min(
        BASE_RETRY_DELAY * 2 ** retryCountRef.current,
        MAX_RETRY_DELAY,
      );
      // Add random jitter (±20%)
      const jitteredDelay = delay * (0.8 + Math.random() * 0.4);

      reconnectTimeoutRef.current = setTimeout(() => {
        // eslint-disable-next-line react-hooks/immutability
        connect();
      }, jitteredDelay);
    };
  }, [addOptimistic, setUnreadCount, fetchUnreadCount]);

  useEffect(() => {
    // Guard: only one SSE connection per page session
    if (sseConnected) return;
    sseConnected = true;

    connect();

    return () => {
      sseConnected = false;
      // Clean up on unmount
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Clear fallback polling interval if it was set
      const fallbackInterval = (window as unknown as Record<string, unknown>).__notifFallbackInterval as ReturnType<typeof setInterval> | undefined;
      if (fallbackInterval) {
        clearInterval(fallbackInterval);
        (window as unknown as Record<string, unknown>).__notifFallbackInterval = undefined;
      }
    };
  }, [connect]);
}
