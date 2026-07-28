import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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

describe('Sidebar', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, writable: true, configurable: true });
    window.dispatchEvent(new Event('resize'));
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
});
