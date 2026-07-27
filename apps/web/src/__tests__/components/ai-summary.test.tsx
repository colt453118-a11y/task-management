import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISummary } from '@/components/ai/ai-summary';

// Module-level mutable mock state
let mockSummary: any = null;
const mockGenerateSummary = vi.fn();

vi.mock('@/hooks/use-ai', () => ({
  useAISummary: () => ({
    summary: mockSummary?.summary ?? null,
    loading: mockSummary?.loading ?? false,
    error: mockSummary?.error ?? null,
    generateSummary: mockGenerateSummary,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

describe('AISummary', () => {
  it('renders AI Summary button', () => {
    render(<AISummary title="Test Task" description="Test description" />);
    expect(screen.getByText('AI Summary')).toBeInTheDocument();
  });

  it('calls generateSummary on click', async () => {
    const user = userEvent.setup();
    render(<AISummary title="Test Task" description="Test description" />);
    await user.click(screen.getByText('AI Summary'));
    expect(mockGenerateSummary).toHaveBeenCalledWith('Test Task', 'Test description');
  });

  it('shows loading state', () => {
    mockSummary = { loading: true };
    render(<AISummary title="Test" description="Test" />);
    expect(screen.getByText('Summarizing...')).toBeInTheDocument();
  });

  it('shows summary when generated and toggles visibility on click', async () => {
    const user = userEvent.setup();
    mockSummary = { summary: 'This is an AI summary of the task.' };
    render(<AISummary title="Test" description="Test" />);
    expect(screen.getByText('Show AI Summary')).toBeInTheDocument();
    // Click to open summary panel
    await user.click(screen.getByText('Show AI Summary'));
    expect(screen.getByText('This is an AI summary of the task.')).toBeInTheDocument();
  });

  it('shows error message', async () => {
    const user = userEvent.setup();
    mockSummary = { error: 'Failed to generate summary' };
    render(<AISummary title="Test" description="Test" />);
    expect(screen.getByText('AI Summary')).toBeInTheDocument();
    await user.click(screen.getByText('AI Summary'));
    expect(screen.getByText('Failed to generate summary')).toBeInTheDocument();
  });
});
