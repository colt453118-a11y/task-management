import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIDuplicateDetector } from '@/components/ai/ai-duplicate-detector';

// Module-level mutable mock state
let mockDuplicates: any[] = [];
const mockCheckDuplicates = vi.fn();

vi.mock('@/hooks/use-ai', () => ({
  useAIDuplicateDetection: () => ({
    duplicates: mockDuplicates,
    loading: false,
    checkDuplicates: mockCheckDuplicates,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

const existingTitles = ['Setup CI/CD pipeline', 'Design database schema', 'Create API endpoints'];

describe('AIDuplicateDetector', () => {
  beforeEach(() => {
    mockDuplicates = [];
  });

  it('renders nothing when no duplicates found', () => {
    const { container } = render(
      <AIDuplicateDetector title="Unique task" existingTitles={existingTitles} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows duplicate warning when similar title detected', () => {
    mockDuplicates = [{ title: 'Setup CI pipeline', similarityScore: 85, reason: 'Similar wording' }];
    render(<AIDuplicateDetector title="Setup CI pipeline" existingTitles={existingTitles} />);
    expect(screen.getByText(/Potential Duplicate/i)).toBeInTheDocument();
    expect(screen.getByText('Setup CI pipeline')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('shows multiple duplicates', () => {
    mockDuplicates = [
      { title: 'Setup CI pipeline', similarityScore: 92, reason: 'Nearly identical' },
      { title: 'Design DB schema', similarityScore: 78, reason: 'Similar scope' },
    ];
    render(<AIDuplicateDetector title="Setup CI pipeline" existingTitles={existingTitles} />);
    expect(screen.getByText(/Potential Duplicates/i)).toBeInTheDocument();
  });

  it('dismisses on close button click', async () => {
    const user = userEvent.setup();
    mockDuplicates = [{ title: 'Setup CI pipeline', similarityScore: 85, reason: 'Similar' }];
    render(<AIDuplicateDetector title="Setup CI pipeline" existingTitles={existingTitles} />);
    expect(screen.getByText(/Potential Duplicate/i)).toBeInTheDocument();
    const closeBtn = screen.getByRole('button');
    await user.click(closeBtn);
    expect(screen.queryByText(/Potential Duplicate/i)).not.toBeInTheDocument();
  });

  it('does not show duplicates with low similarity', () => {
    mockDuplicates = [{ title: 'Some task', similarityScore: 45, reason: 'Low similarity' }];
    const { container } = render(
      <AIDuplicateDetector title="Setup CI pipeline" existingTitles={existingTitles} />,
    );
    expect(container.innerHTML).toBe('');
  });
});
