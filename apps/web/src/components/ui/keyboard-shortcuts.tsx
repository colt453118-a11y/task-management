'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  Keyboard,
  Search,
  Plus,
  ArrowUpDown,
  Star,
  Trash2,
  Eye,
  Filter,
  CheckSquare,
  MessageSquare,
  Paperclip,
  Timer,
  Link2,
  Copy,
  Download,
  Columns3,
  LayoutList,
  Sparkles,
} from 'lucide-react';

// ─── Shortcut Groups ────────────────────────────────────────

interface Shortcut {
  keys: string[];
  description: string;
  icon?: React.ReactNode;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      {
        keys: ['⌘', 'K'],
        description: 'Open search command palette',
        icon: <Search className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', 'T'],
        description: 'Quick create task',
        icon: <Plus className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '1'],
        description: 'Go to Dashboard',
        icon: <LayoutList className="h-3.5 w-3.5" />,
      },
      { keys: ['⌘', '2'], description: 'Go to Tasks', icon: <Columns3 className="h-3.5 w-3.5" /> },
      { keys: ['⌘', '3'], description: 'Go to Projects', icon: <Star className="h-3.5 w-3.5" /> },
    ],
  },
  {
    title: 'Task Actions',
    shortcuts: [
      {
        keys: ['⌘', 'D'],
        description: 'Duplicate current task',
        icon: <Copy className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', 'W'],
        description: 'Toggle watching task',
        icon: <Eye className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'F'],
        description: 'Focus filter panel',
        icon: <Filter className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'E'],
        description: 'Export tasks to CSV',
        icon: <Download className="h-3.5 w-3.5" />,
      },
    ],
  },
  {
    title: 'Task Detail',
    shortcuts: [
      {
        keys: ['⌘', '⇧', 'C'],
        description: 'Focus comment input',
        icon: <MessageSquare className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'I'],
        description: 'Toggle checklist',
        icon: <CheckSquare className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'T'],
        description: 'Start/stop timer',
        icon: <Timer className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'A'],
        description: 'Upload attachment',
        icon: <Paperclip className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'L'],
        description: 'Add dependency link',
        icon: <Link2 className="h-3.5 w-3.5" />,
      },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      {
        keys: ['⌘', '⇧', 'P'],
        description: 'Toggle sidebar collapse',
        icon: <ArrowUpDown className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'Del'],
        description: 'Soft delete selected task',
        icon: <Trash2 className="h-3.5 w-3.5" />,
      },
      {
        keys: ['⌘', '⇧', 'Z'],
        description: 'Undo last action',
        icon: <Star className="h-3.5 w-3.5" />,
      },
      {
        keys: ['?'],
        description: 'Toggle this shortcuts modal',
        icon: <Keyboard className="h-3.5 w-3.5" />,
      },
    ],
  },
];

// ─── Props ──────────────────────────────────────────────────

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Reset search when modal closes
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setSearchQuery('');
    onOpenChange(nextOpen);
  };

  // Filter shortcuts by search
  const filteredGroups = shortcutGroups
    .map((group) => ({
      ...group,
      shortcuts: group.shortcuts.filter(
        (s) =>
          s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.keys.join(' ').toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter((group) => group.shortcuts.length > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="border-surface-300/20 top-[10%] max-w-lg translate-y-0 gap-0 overflow-hidden p-0 shadow-xl sm:rounded-2xl">
        {/* Search header */}
        <div className="border-surface-300/20 dark:border-surface-700/20 flex items-center gap-3 border-b px-5 py-4">
          <div className="from-brand-400 to-brand-600 flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br">
            <Keyboard className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-surface-900 dark:text-surface-100 text-sm font-semibold">
              Keyboard Shortcuts
            </h2>
            <p className="text-surface-500 text-[11px]">
              Press{' '}
              <kbd className="border-surface-300/20 bg-surface-100/80 dark:bg-surface-800/80 rounded border px-1 py-0.5 font-mono text-[10px]">
                ?
              </kbd>{' '}
              anytime to open this panel
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="px-5 pt-3">
          <div className="relative">
            <Search className="text-surface-400 absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="border-surface-300/20 bg-surface-100/80 placeholder:text-surface-400 focus:border-brand-500 focus:ring-brand-500/20 dark:bg-surface-800/80 h-9 w-full rounded-xl border pl-9 pr-3 text-xs transition-all duration-200 focus:outline-none focus:ring-2"
              autoFocus
            />
          </div>
        </div>

        {/* Shortcuts list */}
        <div className="scrollbar-thin max-h-[50vh] space-y-5 overflow-y-auto px-5 py-4">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Keyboard className="text-surface-400 mb-2 h-8 w-8" />
              <p className="text-surface-500 text-sm font-medium">No shortcuts found</p>
              <p className="text-surface-500 mt-0.5 text-xs">Try different search terms</p>
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.title}>
                <h3 className="text-surface-500 mb-2.5 text-[10px] font-semibold uppercase tracking-widest">
                  {group.title}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((shortcut) => (
                    <motion.div
                      key={shortcut.description}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="hover:bg-surface-200/50 dark:hover:bg-surface-800/50 flex items-center justify-between rounded-xl px-2.5 py-2 transition-colors"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="text-surface-400 shrink-0">{shortcut.icon}</span>
                        <span className="text-surface-600 dark:text-surface-400 truncate text-xs">
                          {shortcut.description}
                        </span>
                      </div>
                      <div className="ml-3 flex shrink-0 items-center gap-1">
                        {shortcut.keys.map((key, i) => (
                          <span key={i} className="flex items-center gap-0.5">
                            {i > 0 && <span className="text-surface-400 mx-0.5 text-[10px]"></span>}
                            <kbd
                              className={cn(
                                'inline-flex h-5 min-w-[22px] items-center justify-center rounded-md border px-1.5 font-mono text-[10px] font-medium',
                                'border-surface-300/20 bg-surface-100/80 text-surface-600 dark:bg-surface-800/80 dark:text-surface-400',
                                key.length > 1 && 'px-2',
                              )}
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-surface-300/20 dark:border-surface-700/20 bg-surface-100/40 dark:bg-surface-800/40 flex items-center gap-2 border-t px-5 py-3">
          <Sparkles className="text-brand-500 h-3 w-3" />
          <p className="text-surface-500 text-[10px]">
            Tip: Hold{' '}
            <kbd className="border-surface-300/20 bg-surface-100/80 dark:bg-surface-800/80 rounded border px-1 py-0.5 font-mono text-[9px]">
              ⌘
            </kbd>{' '}
            and press any number key for quick navigation
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Global Listener Hook ───────────────────────────────────

/**
 * Registers a global keydown listener for `?` to toggle the shortcuts modal.
 * Call this once from the topbar or a root layout.
 */
export function useKeyboardShortcuts(open: boolean, setOpen: (open: boolean) => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't trigger if typing in an input/textarea
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setOpen(!open);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, setOpen]);
}
