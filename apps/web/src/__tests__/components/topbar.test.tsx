import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Topbar } from '@/components/layout/topbar';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
}));

vi.mock('@/lib/hooks/use-scroll-hide', () => ({
  useScrollHide: () => ({
    elementSpring: { get: () => 0 },
    shadowSpring: { get: () => 0 },
    shadowParallaxSpring: { get: () => 0 },
  }),
}));

vi.mock('@/lib/hooks/use-notification-sse', () => ({
  useNotificationSSE: () => {},
}));

vi.mock('@/lib/auth/client', () => ({
  authClient: { signOut: vi.fn() },
}));

vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: vi.fn((selector) => {
    const state = {
      notifications: [],
      unreadCount: 0,
      loading: false,
      fetchNotifications: vi.fn(),
      fetchUnreadCount: vi.fn(),
      markAsRead: vi.fn(),
      markAllAsRead: vi.fn(),
      dismiss: vi.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('@/components/layout/search-command', () => ({
  SearchCommand: ({ open }: any) => open ? <div data-testid="search-command" /> : null,
}));

vi.mock('@/components/tasks/create-task-dialog', () => ({
  CreateTaskDialog: ({ open }: any) => open ? <div data-testid="create-task-dialog" /> : null,
}));

vi.mock('@/components/ui/keyboard-shortcuts', () => ({
  KeyboardShortcutsModal: ({ open }: any) => open ? <div data-testid="shortcuts-modal" /> : null,
  useKeyboardShortcuts: () => {},
}));

describe('Topbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the search button with keyboard shortcut hint', () => {
    render(<Topbar />);
    expect(screen.getByText('Search tasks...')).toBeInTheDocument();
    expect(screen.getByText('⌘')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  it('renders the quick create button', () => {
    render(<Topbar />);
    expect(screen.getByText('Quick')).toBeInTheDocument();
    expect(screen.getByText('⌘T')).toBeInTheDocument();
  });

  it('renders theme toggle (light mode shows moon icon button)', () => {
    render(<Topbar />);
    const themeBtn = screen.getByTitle('Switch to dark mode');
    expect(themeBtn).toBeInTheDocument();
  });

  it('renders notification bell button with aria-label', () => {
    render(<Topbar />);
    const notifBtn = screen.getByRole('button', { name: /notifications/i });
    expect(notifBtn).toBeInTheDocument();
  });

  it('renders user avatar dropdown trigger with initial U', () => {
    render(<Topbar />);
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('renders keyboard shortcut hint for search', () => {
    render(<Topbar />);
    expect(screen.getByText('K')).toBeInTheDocument();
  });
});
