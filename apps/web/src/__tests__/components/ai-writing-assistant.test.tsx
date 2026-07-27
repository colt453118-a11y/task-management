import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIWritingAssistant } from '@/components/ai/ai-writing-assistant';

// Module-level mutable mock state
let mockResult: any = null;
const mockImprove = vi.fn();
const mockSetResult = vi.fn();

vi.mock('@/hooks/use-ai', () => ({
  useAIWritingAssistant: () => ({
    result: mockResult?.result ?? null,
    loading: mockResult?.loading ?? false,
    error: mockResult?.error ?? null,
    improve: mockImprove,
    setResult: mockSetResult,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

const onApply = vi.fn();

describe('AIWritingAssistant', () => {
  it('renders sparkle button', () => {
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    expect(screen.getByTitle('AI Writing Assistant')).toBeInTheDocument();
  });

  it('disables button when text is empty', () => {
    render(<AIWritingAssistant text="" onApply={onApply} />);
    expect(screen.getByTitle('AI Writing Assistant')).toBeDisabled();
  });

  it('shows instruction options on click', async () => {
    const user = userEvent.setup();
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    await user.click(screen.getByTitle('AI Writing Assistant'));
    expect(screen.getByText('Improve Clarity')).toBeInTheDocument();
    expect(screen.getByText('Make Concise')).toBeInTheDocument();
    expect(screen.getByText('Fix Grammar')).toBeInTheDocument();
    expect(screen.getByText('Professional Tone')).toBeInTheDocument();
    expect(screen.getByText('Friendly Tone')).toBeInTheDocument();
    expect(screen.getByText('Add Detail')).toBeInTheDocument();
  });

  it('calls improve with selected instruction', async () => {
    const user = userEvent.setup();
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    await user.click(screen.getByTitle('AI Writing Assistant'));
    await user.click(screen.getByText('Improve Clarity'));
    // Click the Improve Text button to trigger the improvement
    await user.click(screen.getByText('Improve Text'));
    expect(mockImprove).toHaveBeenCalledWith('Some text', 'improve clarity');
  });

  it('shows result preview with apply button', async () => {
    const user = userEvent.setup();
    mockResult = { result: 'Improved version of the text.' };
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    // Click to open panel
    await user.click(screen.getByTitle('AI Writing Assistant'));
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByText('Improved version of the text.')).toBeInTheDocument();
    expect(screen.getByText('Apply Changes')).toBeInTheDocument();
  });

  it('calls onApply with improved text', async () => {
    const user = userEvent.setup();
    mockResult = { result: 'Improved version.' };
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    // Click to open panel, then click Apply Changes
    await user.click(screen.getByTitle('AI Writing Assistant'));
    await user.click(screen.getByText('Apply Changes'));
    expect(onApply).toHaveBeenCalledWith('Improved version.');
  });

  it('shows error message', async () => {
    const user = userEvent.setup();
    mockResult = { error: 'Failed to improve text' };
    render(<AIWritingAssistant text="Some text" onApply={onApply} />);
    // Click to open panel
    await user.click(screen.getByTitle('AI Writing Assistant'));
    expect(screen.getByText('Failed to improve text')).toBeInTheDocument();
  });
});
