import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AIRiskBadge } from '@/components/ai/ai-risk-badge';

// Module-level mutable mock state
let mockPrediction: any = null;
const mockPredictRisk = vi.fn();

vi.mock('@/hooks/use-ai', () => ({
  useAIRiskPrediction: () => ({
    prediction: mockPrediction?.prediction ?? null,
    loading: mockPrediction?.loading ?? false,
    error: mockPrediction?.error ?? null,
    predictRisk: mockPredictRisk,
  }),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => <div data-testid="animate-presence">{children}</div>,
}));

const task = {
  id: 't1',
  title: 'Test Task',
  status: 'open',
  dueDate: '2024-12-31',
  estimatedHours: '8',
};

describe('AIRiskBadge', () => {
  it('renders AI Risk button initially', () => {
    render(<AIRiskBadge task={task} />);
    expect(screen.getByText('AI Risk')).toBeInTheDocument();
  });

  it('calls predictRisk on click', async () => {
    const user = userEvent.setup();
    render(<AIRiskBadge task={task} />);
    await user.click(screen.getByText('AI Risk'));
    expect(mockPredictRisk).toHaveBeenCalledWith(task);
  });

  it('shows low risk prediction and tooltip on click', async () => {
    const user = userEvent.setup();
    mockPrediction = {
      prediction: { riskLevel: 'low', riskScore: 20, reason: 'Task is on track' },
    };
    render(<AIRiskBadge task={task} />);
    expect(screen.getByText('Low Risk')).toBeInTheDocument();
    // Click to open tooltip
    await user.click(screen.getByText('Low Risk'));
    expect(screen.getByText('Task is on track')).toBeInTheDocument();
  });

  it('shows critical risk prediction tooltip', async () => {
    const user = userEvent.setup();
    mockPrediction = {
      prediction: { riskLevel: 'critical', riskScore: 95, reason: 'Overdue and blocked' },
    };
    render(<AIRiskBadge task={task} />);
    expect(screen.getByText('Critical Risk')).toBeInTheDocument();
    // Click to open tooltip
    await user.click(screen.getByText('Critical Risk'));
    expect(screen.getByText('95/100')).toBeInTheDocument();
  });

  it('shows error message', async () => {
    const user = userEvent.setup();
    mockPrediction = { error: 'API error' };
    render(<AIRiskBadge task={task} />);
    // Click to open tooltip so error is visible
    await user.click(screen.getByText('AI Risk'));
    expect(screen.getByText('API error')).toBeInTheDocument();
  });
});
