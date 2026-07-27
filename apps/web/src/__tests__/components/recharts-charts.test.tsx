import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import RechartsCharts from '@/components/dashboard/recharts-charts';

// Recharts uses SVG and canvas - we just test that it renders without crashing
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: ({ fill }: any) => <span data-testid="cell" data-fill={fill} />,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  Bar: ({ children }: any) => <div data-testid="bar">{children}</div>,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>,
}));

describe('RechartsCharts', () => {
  const defaultData = {
    donutData: [
      { name: 'Open', value: 5 },
      { name: 'In Progress', value: 3 },
      { name: 'Completed', value: 10 },
    ],
    barData: [
      { name: 'Mon', value: 3, fill: '#6366f1' },
      { name: 'Tue', value: 5, fill: '#8b5cf6' },
    ],
    total: 18,
    pieColors: ['#6366f1', '#8b5cf6', '#34d399'],
  };

  it('renders chart cards with data', () => {
    render(<RechartsCharts {...defaultData} />);
    expect(screen.getByText('Task Distribution')).toBeInTheDocument();
    expect(screen.getByText('Task Overview')).toBeInTheDocument();
  });

  it('renders donut labels with percentages', () => {
    render(<RechartsCharts {...defaultData} />);
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // 5/18 = 28%, 3/18 = 17%, 10/18 = 56%
    expect(screen.getByText('(28%)')).toBeInTheDocument();
    expect(screen.getByText('(56%)')).toBeInTheDocument();
  });

  it('shows empty state when no donut data', () => {
    const emptyData = {
      donutData: [],
      barData: [
        { name: 'Mon', value: 3, fill: '#6366f1' },
      ],
      total: 0,
      pieColors: ['#6366f1'],
    };
    render(<RechartsCharts {...emptyData} />);
    expect(screen.getByText('No tasks to display')).toBeInTheDocument();
  });
});
