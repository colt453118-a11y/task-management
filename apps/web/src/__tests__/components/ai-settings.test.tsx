import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISettings } from '@/components/settings/ai-settings';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, className }: any) => (
    <button onClick={onClick} disabled={disabled} className={className}>{children}</button>
  ),
}));

describe('AISettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders provider cards after loading', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      settings: { provider: 'openai', model: 'gpt-4o-mini', hasKey: false, updatedAt: null },
    })));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('OpenAI')).toBeInTheDocument();
    });
    expect(screen.getByText('Anthropic')).toBeInTheDocument();
  });

  it('shows configured status when hasKey is true', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      settings: { provider: 'anthropic', model: 'claude-3-haiku-20240307', hasKey: true, updatedAt: '2024-06-15T10:00:00Z' },
    })));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('AI provider configured')).toBeInTheDocument();
    });
  });

  it('shows unconfigured status when hasKey is false', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      settings: { provider: 'openai', model: 'gpt-4o-mini', hasKey: false, updatedAt: null },
    })));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('No AI provider configured')).toBeInTheDocument();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders model input with suggested models', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      settings: { provider: 'openai', model: 'gpt-4o-mini', hasKey: false, updatedAt: null },
    })));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('gpt-4o')).toBeInTheDocument();
      expect(screen.getByText('gpt-4o-mini')).toBeInTheDocument();
      expect(screen.getByText('gpt-4-turbo')).toBeInTheDocument();
    });
  });

  it('renders API key field with show/hide toggle', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
      settings: { provider: 'openai', model: 'gpt-4o-mini', hasKey: true, updatedAt: null },
    })));
    render(<AISettings />);
    await waitFor(() => {
      expect(screen.getByText('Configured')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByPlaceholderText(/Leave blank to keep current key/i);
    expect(apiKeyInput).toBeInTheDocument();
    expect(apiKeyInput).toHaveAttribute('type', 'password');
  });

  it('shows success message on save', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        settings: { provider: 'openai', model: 'gpt-4o-mini', hasKey: false, updatedAt: null },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));

    render(<AISettings />);
    await waitFor(() => expect(screen.getByText('OpenAI')).toBeInTheDocument());
    const saveBtn = screen.getByText('Save AI Settings');
    const usr = userEvent.setup();
    await usr.click(saveBtn);
    await waitFor(() => {
      expect(screen.getByText('AI settings saved successfully')).toBeInTheDocument();
    });
  });
});
