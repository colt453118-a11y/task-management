import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/tasks',
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={href as string} {...props}>{children as React.ReactNode}</a>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    nav: ({ children, ...props }: Record<string, unknown>) => <nav {...props}>{children as React.ReactNode}</nav>,
    div: ({ children, ...props }: Record<string, unknown>) => <div {...props}>{children as React.ReactNode}</div>,
    span: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
  },
}));

vi.mock('@/lib/hooks/use-scroll-hide', () => ({
  useScrollHide: () => ({
    elementSpring: { get: () => 0 },
    shadowSpring: { get: () => 0 },
    shadowParallaxSpring: { get: () => 0 },
  }),
}));

// Dynamic mock for notification store - uses currentTestUnreadCount
let currentTestUnreadCount = 0;

vi.mock('@/stores/notification-store', () => ({
  useNotificationStore: (selector: any) => {
    const state = { unreadCount: currentTestUnreadCount };
    return selector ? selector(state) : state;
  },
}));

describe('MobileBottomNav', () => {
  beforeEach(() => {
    currentTestUnreadCount = 0;
  });

  it('shows notification badge when unread count is 3', () => {
    currentTestUnreadCount = 3;
    render(<MobileBottomNav />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not show notification badge for zero unread', () => {
    currentTestUnreadCount = 0;
    render(<MobileBottomNav />);
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('shows badge with 9+ for counts over 9', () => {
    currentTestUnreadCount = 10;
    render(<MobileBottomNav />);
    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders quick create button', () => {
    render(<MobileBottomNav />);
    expect(screen.getByLabelText('Quick create task')).toBeInTheDocument();
  });

  it('renders more button', () => {
    render(<MobileBottomNav />);
    expect(screen.getByLabelText('More')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(<MobileBottomNav />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThanOrEqual(3);
  });
});
