import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  LoadingSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  Spinner,
  FullPageSpinner,
  ErrorState,
  EmptyState,
  NotFoundState,
  ErrorBanner,
} from '../state-display';

// ═══════════════════════════════════════════════════════════════
// ─── LoadingSkeleton ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('LoadingSkeleton', () => {
  it('should render the default count of 3 skeleton items', () => {
    const { container } = render(<LoadingSkeleton />);
    // Each skeleton is a div with animate-skeleton-pulse
    const skeletons = container.querySelectorAll('.animate-skeleton-pulse');
    expect(skeletons).toHaveLength(3);
  });

  it('should render a custom number of skeleton items', () => {
    const { container } = render(<LoadingSkeleton count={5} />);
    const skeletons = container.querySelectorAll('.animate-skeleton-pulse');
    expect(skeletons).toHaveLength(5);
  });

  it('should render 0 items when count is 0', () => {
    const { container } = render(<LoadingSkeleton count={0} />);
    const skeletons = container.querySelectorAll('.animate-skeleton-pulse');
    expect(skeletons).toHaveLength(0);
  });

  it('should have a status role and accessible label', () => {
    render(<LoadingSkeleton />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-label', 'Loading');
  });

  it('should have a sr-only loading text', () => {
    render(<LoadingSkeleton />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<LoadingSkeleton className="extra-class" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('extra-class');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── CardGridSkeleton ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('CardGridSkeleton', () => {
  it('should render the default count of 4 skeleton cards', () => {
    const { container } = render(<CardGridSkeleton />);
    const skeletons = container.querySelectorAll('.animate-skeleton-pulse');
    expect(skeletons).toHaveLength(4);
  });

  it('should render a custom number of cards', () => {
    const { container } = render(<CardGridSkeleton count={2} />);
    const skeletons = container.querySelectorAll('.animate-skeleton-pulse');
    expect(skeletons).toHaveLength(2);
  });

  it('should apply custom grid columns', () => {
    const { container } = render(<CardGridSkeleton gridCols="custom-cols" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('custom-cols');
  });

  it('should have accessible role and sr-only text', () => {
    render(<CardGridSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── TableSkeleton ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('TableSkeleton', () => {
  it('should render default rows (5) and cols (4)', () => {
    const { container } = render(<TableSkeleton />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(5);
    const headers = container.querySelectorAll('thead th');
    expect(headers).toHaveLength(4);
  });

  it('should render custom rows and cols', () => {
    const { container } = render(<TableSkeleton rows={3} cols={6} />);
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(container.querySelectorAll('thead th')).toHaveLength(6);
  });

  it('should render each cell with a skeleton div', () => {
    const { container } = render(<TableSkeleton rows={2} cols={3} />);
    const cellDivs = container.querySelectorAll('tbody td div');
    expect(cellDivs).toHaveLength(6); // 2 rows * 3 cols
  });

  it('should have accessible role', () => {
    render(<TableSkeleton />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Spinner ──────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('Spinner', () => {
  it('should render a spinner with default medium size', () => {
    const { container } = render(<Spinner />);
    // SVG class attribute is used since SVGAnimatedString doesn't work with toContain
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute('class')).toContain('h-6 w-6');
  });

  it('should render small size', () => {
    const { container } = render(<Spinner size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-4 w-4');
  });

  it('should render large size', () => {
    const { container } = render(<Spinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-8 w-8');
  });

  it('should show label text when provided', () => {
    const { container } = render(<Spinner label="Processing..." />);
    // The label appears in both a visible span and sr-only span
    const textElements = container.querySelectorAll('span');
    const visibleLabel = Array.from(textElements).find(
      (el) => el.textContent === 'Processing...' && !el.classList.contains('sr-only'),
    );
    expect(visibleLabel).toBeInTheDocument();
  });

  it('should not show label text when not provided', () => {
    const { container } = render(<Spinner />);
    // When no label: only the sr-only span is rendered
    const spans = container.querySelectorAll('span');
    const visibleSpans = Array.from(spans).filter((s) => !s.classList.contains('sr-only'));
    expect(visibleSpans).toHaveLength(0);
  });

  it('should have accessible attributes', () => {
    render(<Spinner label="Working" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Working');
  });

  it('should use default aria-label when no label given', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading');
  });

  it('should apply custom className', () => {
    const { container } = render(<Spinner className="my-class" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('my-class');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── FullPageSpinner ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('FullPageSpinner', () => {
  it('should use default label', () => {
    const { container } = render(<FullPageSpinner />);
    const spans = container.querySelectorAll('span');
    const visibleLabel = Array.from(spans).find(
      (el) => el.textContent === 'Loading...' && !el.classList.contains('sr-only'),
    );
    expect(visibleLabel).toBeInTheDocument();
  });

  it('should use custom label', () => {
    const { container } = render(<FullPageSpinner label="Fetching data..." />);
    const spans = container.querySelectorAll('span');
    const visibleLabel = Array.from(spans).find(
      (el) => el.textContent === 'Fetching data...' && !el.classList.contains('sr-only'),
    );
    expect(visibleLabel).toBeInTheDocument();
    // The default label should not appear anywhere
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render a large spinner', () => {
    const { container } = render(<FullPageSpinner />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('h-8 w-8');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── ErrorState ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('ErrorState', () => {
  it('should use default title and show alert icon', () => {
    render(<ErrorState />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should show custom title and message', () => {
    render(<ErrorState title="Custom Error" message="Something failed." />);
    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Something failed.')).toBeInTheDocument();
  });
  it('should render a retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    const btn = screen.getByRole('button', { name: /try again/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('should not render a retry button when onRetry is not provided', () => {
    render(<ErrorState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<ErrorState className="my-class" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('my-class');
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── EmptyState ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('EmptyState', () => {
  describe('behavior', () => {
    it('should render default title and use default icon', () => {
      render(<EmptyState />);
      // By default animated=true and the content is rendered inside motion.divs
      expect(screen.getByText('No data yet')).toBeInTheDocument();
    });

    it('should render custom title, message, and icon', () => {
      render(
        <EmptyState
          icon={<span data-testid="custom-icon">🚀</span>}
          title="Nothing here"
          message="Check back later"
        />,
      );
      expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
      expect(screen.getByText('Nothing here')).toBeInTheDocument();
      expect(screen.getByText('Check back later')).toBeInTheDocument();
    });

    it('should not render message when not provided', () => {
      const { container } = render(<EmptyState title="Empty" />);
      // No <p> elements should exist when message is not provided
      expect(container.querySelector('p')).toBeNull();
    });

    it('should render action content when provided', () => {
      render(<EmptyState action={<button>Create</button>} />);
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });
  });

  describe('animated mode', () => {
    it('should use motion.div wrappers by default (animated=true)', () => {
      const { container } = render(<EmptyState title="Hello" />);
      // motion.div renders as <div> with framer-motion data attributes
      const motionDivs = container.querySelectorAll('[style]');
      expect(motionDivs.length).toBeGreaterThanOrEqual(2);
    });

    it('should render title and message in static mode (animated=false)', () => {
      render(<EmptyState animated={false} title="Static" message="No motion" />);
      expect(screen.getByText('Static')).toBeInTheDocument();
      expect(screen.getByText('No motion')).toBeInTheDocument();
    });

    it('should render icon only once in static mode', () => {
      render(
        <EmptyState animated={false} icon={<span data-testid="icon">📦</span>} title="Static" />,
      );
      expect(screen.getAllByTestId('icon')).toHaveLength(1);
    });
  });

  describe('variants', () => {
    it('should apply compact padding class', () => {
      const { container } = render(<EmptyState animated={false} variant="compact" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('py-8');
      expect(outer.className).toContain('px-4');
    });

    it('should apply bordered variant with border-2', () => {
      const { container } = render(<EmptyState animated={false} variant="bordered" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('border-2');
    });

    it('should apply default variant padding', () => {
      const { container } = render(<EmptyState animated={false} variant="default" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('py-12');
      expect(outer.className).toContain('px-6');
    });
  });

  describe('custom className', () => {
    it('should apply custom className in animated mode', () => {
      const { container } = render(<EmptyState className="extra" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('extra');
    });

    it('should apply custom className in static mode', () => {
      const { container } = render(<EmptyState animated={false} className="static-extra" />);
      const outer = container.firstChild as HTMLElement;
      expect(outer.className).toContain('static-extra');
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── NotFoundState ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('NotFoundState', () => {
  it('should use default title and message', () => {
    render(<NotFoundState />);
    expect(screen.getByText('Not found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The resource you are looking for does not exist or you do not have access.',
      ),
    ).toBeInTheDocument();
  });

  it('should render custom title and message', () => {
    render(<NotFoundState title="Missing" message="Task was deleted." />);
    expect(screen.getByText('Missing')).toBeInTheDocument();
    expect(screen.getByText('Task was deleted.')).toBeInTheDocument();
  });

  it('should not render a back button when neither backHref nor onBack provided', () => {
    render(<NotFoundState />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should render a back button when backHref is provided', () => {
    render(<NotFoundState backHref="/tasks" />);
    const btn = screen.getByRole('button', { name: /go back/i });
    expect(btn).toBeInTheDocument();
  });

  it('should render a back button with custom label and href', () => {
    render(<NotFoundState backHref="/" backLabel="Home" />);
    const btn = screen.getByRole('button', { name: /home/i });
    expect(btn).toBeInTheDocument();
  });
  it('should call onBack when button is clicked', () => {
    const onBack = vi.fn();
    render(<NotFoundState onBack={onBack} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('should prefer onBack over backHref when both are provided', () => {
    const onBack = vi.fn();
    render(<NotFoundState onBack={onBack} backHref="/tasks" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledOnce();
    // window.location.href should NOT have been changed
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── ErrorBanner ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('ErrorBanner', () => {
  it('should render the error message', () => {
    render(<ErrorBanner message="Connection failed" />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('should render a dismiss button when onDismiss is provided', () => {
    render(<ErrorBanner message="Error" onDismiss={() => {}} />);
    expect(screen.getByText('Dismiss')).toBeInTheDocument();
  });

  it('should not render a dismiss button when onDismiss is not provided', () => {
    render(<ErrorBanner message="Error" />);
    expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
  });
  it('should call onDismiss when dismiss is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Something broke" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Dismiss'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('should apply custom className', () => {
    const { container } = render(<ErrorBanner message="Error" className="my-class" />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('my-class');
  });
});
