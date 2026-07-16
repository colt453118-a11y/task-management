'use client';

import { useCallback, useState } from 'react';
import { useGlobalShortcuts } from '@/lib/hooks/use-global-shortcuts';
import { KeyboardShortcutsModal } from './keyboard-shortcuts';

/**
 * Provider that wires up global keyboard shortcuts.
 * Renders the KeyboardShortcutsModal so it can be triggered from anywhere.
 */
export function ShortcutsProvider({ children }: { children: React.ReactNode }) {
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleSearch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-search'));
  }, []);

  const handleQuickCreate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('open-quick-create'));
  }, []);

  useGlobalShortcuts({
    openSearch: handleSearch,
    openQuickCreate: handleQuickCreate,
    openShortcuts: () => setShortcutsOpen(true),
  });

  return (
    <>
      {children}
      <KeyboardShortcutsModal open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
