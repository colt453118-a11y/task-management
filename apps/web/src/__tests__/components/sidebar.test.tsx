import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Sidebar } from '@/components/layout/sidebar';

vi.mock('next/navigation', () => ({
  usePathname: () => '/tasks',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>{children as React.ReactNode}</a>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
    button: ({ children, ...props }: Record<string, unknown>) => <button {...props}>{children as React.ReactNode}</button>,
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
  },
  AnimatePresence: ({ children }: Record<string, unknown>) => <>{children as React.ReactNode}</>,
  useTransform: () => '0px 4px 12px rgba(99,102,241,0.25)',
}));

vi.mock('@/lib/hooks/use-scroll-shadow', () => ({
  useScrollShadow: () => ({ shadowSpring: { get: () => 0 }, spring: { get: () => 0 } }),
}));

// ─── Controllable notification store mock ──────────────────

let mockUnreadCount = 0;

vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: (selector: any) => {
    const state = { unreadCount: mockUnreadCount };
    return selector ? selector(state) : state;
  },
}));

describe('Sidebar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));
    mockUnreadCount = 0;
  });

  it('renders the logo and brand name', () => {
    render(<Sidebar />);
    expect(screen.getByText('WorkManager')).toBeInTheDocument();
  });

  it('renders main navigation items', () => {
    render(<Sidebar />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders the New Task button', () => {
    render(<Sidebar />);
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  it('has a collapse button', () => {
    render(<Sidebar />);
    const collapseBtn = screen.getByTitle('Collapse sidebar');
    expect(collapseBtn).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Notification Badge
  // ══════════════════════════════════════════════════════════

  it('shows unread badge on Notifications nav item when unreadCount > 0', () => {
    mockUnreadCount = 3;
    render(<Sidebar />);

    // The badge should show the count
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows 9+ badge when unreadCount is over 9', () => {
    mockUnreadCount = 15;
    render(<Sidebar />);

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('hides notification badge when unreadCount is 0', () => {
    mockUnreadCount = 0;
    render(<Sidebar />);

    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
    expect(screen.queryByText('9+')).not.toBeInTheDocument();
  });

  it('renders the Notifications nav item label', () => {
    render(<Sidebar />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  // ══════════════════════════════════════════════════════════
  //  Mobile Behavior
  // ══════════════════════════════════════════════════════════

  describe('mobile', () => {
    beforeEach(() => {
      // Set mobile viewport width
      Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });
      window.dispatchEvent(new Event('resize'));
    });

    it('renders mobile FAB button when viewport is narrow', () => {
      render(<Sidebar />);
      expect(screen.getByLabelText('Open menu')).toBeInTheDocument();
    });

    it('does not render desktop collapse button on mobile', () => {
      render(<Sidebar />);
      expect(screen.queryByTitle('Collapse sidebar')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Expand sidebar')).not.toBeInTheDocument();
    });

    it('hides notification badge when drawer is closed even if unreadCount > 0', () => {
      mockUnreadCount = 5;
      render(<Sidebar />);

      // Drawer is closed — badge should not be visible
      expect(screen.queryByText('5')).not.toBeInTheDocument();
      expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
    });

    it('shows drawer with notification badge when FAB is clicked and unreadCount > 0', async () => {
      mockUnreadCount = 3;
      render(<Sidebar />);

      // Click the mobile FAB to open the drawer
      screen.getByLabelText('Open menu').click();

      // Wait for drawer to open after state update
      expect(await screen.findByText('Notifications')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows 9+ badge inside drawer for counts over 9', async () => {
      mockUnreadCount = 15;
      render(<Sidebar />);

      // Open the drawer
      screen.getByLabelText('Open menu').click();

      expect(await screen.findByText('9+')).toBeInTheDocument();
    });

    it('hides notification badge inside drawer when unreadCount is 0', async () => {
      mockUnreadCount = 0;
      render(<Sidebar />);

      // Open the drawer
      screen.getByLabelText('Open menu').click();

      expect(await screen.findByText('Notifications')).toBeInTheDocument();
      expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
      expect(screen.queryByText('9+')).not.toBeInTheDocument();
    });

    it('closes drawer when close button is clicked', async () => {
      mockUnreadCount = 3;
      render(<Sidebar />);

      // Open the drawer
      screen.getByLabelText('Open menu').click();
      expect(await screen.findByText('Notifications')).toBeInTheDocument();

      // Find and click the close button (X icon in mobile header)
      const closeBtn = screen.getByRole('button', { name: 'Close menu' });
      closeBtn.click();

      // Wait for drawer to close after state update
      await waitFor(() => {
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument();
      });
    });
  });
});
