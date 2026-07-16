'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface ShortcutActions {
  openSearch: () => void;
  openQuickCreate: () => void;
  openShortcuts: () => void;
  setSidebarCollapsed?: (collapsed: boolean) => void;
  currentCollapsed?: boolean;
}

/**
 * Global keyboard shortcut handler.
 * Wires up all documented shortcuts from the KeyboardShortcutsModal.
 *
 * Call this once from app/providers.tsx or a root layout.
 */
export function useGlobalShortcuts(actions: ShortcutActions) {
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;
      const shift = e.shiftKey;

      // ? — Toggle shortcuts modal (works everywhere)
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        actions.openShortcuts();
        return;
      }

      // Don't process meta shortcuts when typing
      if (isInput && meta) return;

      // ⌘K — Open search
      if (meta && e.key === 'k') {
        e.preventDefault();
        actions.openSearch();
        return;
      }

      // ⌘T — Quick create task
      if (meta && e.key === 't') {
        e.preventDefault();
        actions.openQuickCreate();
        return;
      }

      // ⌘1 — Go to Dashboard
      if (meta && !shift && e.key === '1') {
        e.preventDefault();
        router.push('/');
        return;
      }

      // ⌘2 — Go to Tasks
      if (meta && !shift && e.key === '2') {
        e.preventDefault();
        router.push('/tasks');
        return;
      }

      // ⌘3 — Go to Projects
      if (meta && !shift && e.key === '3') {
        e.preventDefault();
        router.push('/projects');
        return;
      }

      // ⌘⇧P — Toggle sidebar
      if (meta && shift && e.key === 'P') {
        e.preventDefault();
        if (actions.setSidebarCollapsed && actions.currentCollapsed !== undefined) {
          actions.setSidebarCollapsed(!actions.currentCollapsed);
        }
        return;
      }

      // ⌘⇧F — Focus filter (navigate to tasks page with filters open)
      if (meta && shift && e.key === 'F') {
        e.preventDefault();
        router.push('/tasks?focusFilters=true');
        return;
      }

      // ⌘⇧E — Export tasks to CSV (only on tasks page)
      // This is handled by the tasks page component
    },
    [router, actions],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
