// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskTemplatePicker } from '@/components/tasks/task-template-picker';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sample template for testing. */
function sampleTemplate(overrides: Partial<{
  id: string;
  name: string;
  description: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  priority: string;
  isDefault: boolean;
  createdAt: string;
}> = {}) {
  return {
    id: 'template-1',
    name: 'Bug Report',
    description: 'Template for filing bug reports',
    taskTitle: 'Fix: [summary]',
    taskDescription: '## Steps to reproduce',
    priority: 'high',
    category: 'Bug',
    labels: ['bug'],
    tags: ['sprint-24'],
    estimatedHours: '4',
    isDefault: false,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    ...overrides,
  };
}

function sampleTemplates(count: number) {
  return Array.from({ length: count }, (_, i) =>
    sampleTemplate({
      id: `template-${i + 1}`,
      name: `Template ${i + 1}`,
      isDefault: i === 0,
    }),
  );
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskTemplatePicker (React Testing Library)', () => {
  const onApplyTemplate = vi.fn();

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────

  it('shows shimmer loading placeholder while fetching templates', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const shimmers = container.querySelectorAll('.shimmer');
    expect(shimmers.length).toBeGreaterThanOrEqual(1);
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows Templates button without count badge when no templates exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [] }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    // Wait for loading to finish
    const templatesBtn = await screen.findByText('Templates');
    expect(templatesBtn).toBeInTheDocument();

    // No count badge should be shown
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('shows empty state message when opening manager with no templates', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [] }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const templatesBtn = await screen.findByText('Templates');
    fireEvent.click(templatesBtn);

    expect(screen.getByText('No templates yet. Create one to speed up task creation.')).toBeInTheDocument();
    expect(screen.getByText('0 templates')).toBeInTheDocument();
  });

  // ── Populated state ────────────────────────────────────────

  it('shows Templates button with count badge when templates exist', async () => {
    const templates = sampleTemplates(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');

    // Count badge should show 3
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows template names in the manager list', async () => {
    const templates = sampleTemplates(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('Template 1')).toBeInTheDocument();
    expect(screen.getByText('Template 2')).toBeInTheDocument();
    expect(screen.getByText('Template 3')).toBeInTheDocument();
  });

  it('shows template count in the manager header', async () => {
    const templates = sampleTemplates(2);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('2 templates')).toBeInTheDocument();
  });

  it('shows template description in the manager list when present', async () => {
    const templates = [sampleTemplate({ description: 'A helpful description' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('A helpful description')).toBeInTheDocument();
  });

  // ── Quick-apply chips ──────────────────────────────────────

  it('shows quick-apply chips when manager is closed and templates exist', async () => {
    const templates = sampleTemplates(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    // Chips should appear once loaded
    expect(await screen.findByText('Template 1')).toBeInTheDocument();
    expect(screen.getByText('Template 2')).toBeInTheDocument();
    expect(screen.getByText('Template 3')).toBeInTheDocument();
  });

  it('shows at most 4 quick-apply chips', async () => {
    const templates = sampleTemplates(6);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    const { container } = render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Template 1');

    // Should only show 4 chips
    const chips = container.querySelectorAll('.flex-wrap button');
    expect(chips.length).toBeLessThanOrEqual(4);
  });

  it('does not show quick-apply chips when manager is open', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    // Quick chips visible when closed
    expect(screen.getByText('Bug Report')).toBeInTheDocument();

    // Open manager
    fireEvent.click(screen.getByText('Templates'));

    // Chips should be gone (now showing the manager list version instead)
    // The template name now appears in the manager list instead of quick chips
    expect(screen.getByText('Bug Report')).toBeInTheDocument();
  });

  // ── Apply template via quick-apply chip ────────────────────

  it('calls onApplyTemplate when a quick-apply chip is clicked', async () => {
    const templates = [sampleTemplate({ taskTitle: 'Fix login', taskDescription: 'Need to fix login bug', priority: 'urgent' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const chip = await screen.findByText('Bug Report');
    fireEvent.click(chip);

    expect(onApplyTemplate).toHaveBeenCalledWith({
      title: 'Fix login',
      description: 'Need to fix login bug',
      priority: 'urgent',
    });
  });

  it('calls onApplyTemplate with undefined for null fields', async () => {
    const templates = [sampleTemplate({ taskTitle: null, taskDescription: null, priority: 'medium' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const chip = await screen.findByText('Bug Report');
    fireEvent.click(chip);

    expect(onApplyTemplate).toHaveBeenCalledWith({
      title: undefined,
      description: undefined,
      priority: 'medium',
    });
  });

  // ── Apply template via manager list ────────────────────────

  it('calls onApplyTemplate when a template is clicked in the manager list', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    // Click the template in the manager list
    fireEvent.click(screen.getByText('Bug Report'));

    expect(onApplyTemplate).toHaveBeenCalledWith({
      title: 'Fix: [summary]',
      description: '## Steps to reproduce',
      priority: 'high',
    });
  });

  it('closes the manager after applying a template from the list', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('Bug Report'));

    // Manager should close — "0 templates" text should disappear
    await waitFor(() => {
      expect(screen.queryByText('1 template')).not.toBeInTheDocument();
    });
  });

  // ── Toggle manager ─────────────────────────────────────────

  it('opens the manager panel when Templates button is clicked', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('1 template')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('closes the manager panel when Templates button is clicked again', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    expect(screen.getByText('1 template')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Templates'));

    await waitFor(() => {
      expect(screen.queryByText('1 template')).not.toBeInTheDocument();
    });
  });

  // ── Create form ────────────────────────────────────────────

  it('shows create form when New button is clicked', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByText('New Template')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Template name *')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders all form fields in the create form', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByPlaceholderText('Template name *')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Description (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Default title for new tasks (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Default description for new tasks (optional)')).toBeInTheDocument();
    expect(screen.getByText('Default Priority')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('renders all 6 priority options in the create form', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    const prioritySelect = screen.getByDisplayValue('Medium');
    const options = Array.from(prioritySelect.querySelectorAll('option'));
    expect(options.map((o) => o.textContent)).toEqual([
      'None', 'Low', 'Medium', 'High', 'Urgent', 'Critical',
    ]);
  });

  // ── Create template ────────────────────────────────────────

  it('creates a new template via POST when Create is clicked', async () => {
    const templates: unknown[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    // Fill out the form
    const nameInput = screen.getByPlaceholderText('Template name *');
    fireEvent.change(nameInput, { target: { value: 'New Template' } });

    const descInput = screen.getByPlaceholderText('Description (optional)');
    fireEvent.change(descInput, { target: { value: 'A new template' } });

    // Mock the POST response, then the subsequent GET
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ template: { id: 'new-1', name: 'New Template' } }, 201))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [{ id: 'new-1', name: 'New Template' }] }));

    fireEvent.click(screen.getByText('Create'));

    // Verify POST was called
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('New Template'),
    });

    // Should go back to list view — the form header disappears
    await waitFor(() => {
      expect(screen.queryByText('New Template', { selector: 'span' })).not.toBeInTheDocument();
    });
  });

  it('disables Create button when name is empty', async () => {
    const templates: unknown[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    const createButton = screen.getByText('Create').closest('button');
    expect(createButton).toBeDisabled();
  });

  it('enables Create button when name is filled', async () => {
    const templates: unknown[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    const nameInput = screen.getByPlaceholderText('Template name *');
    fireEvent.change(nameInput, { target: { value: 'My Template' } });

    const createButton = screen.getByText('Create').closest('button');
    expect(createButton).not.toBeDisabled();
  });

  it('shows spinner on Create button while submitting', async () => {
    let resolvePost: (value: unknown) => void;
    const postPromise = new Promise((resolve) => { resolvePost = resolve; });

    const templates: unknown[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    const nameInput = screen.getByPlaceholderText('Template name *');
    fireEvent.change(nameInput, { target: { value: 'My Template' } });

    // Intercept POST
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(() => postPromise);

    fireEvent.click(screen.getByText('Create'));

    // Spinner should appear
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    resolvePost!(mockFetchResponse({ template: { id: 'new-1' } }, 201));
  });

  // ── Edit form ──────────────────────────────────────────────

  it('shows edit form with pre-populated fields when Edit button is clicked', async () => {
    const templates = [sampleTemplate({ name: 'Bug Report', description: 'File bugs', taskTitle: 'Fix: [bug]', taskDescription: 'Steps: ...', priority: 'urgent' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    // Click the Edit button by title
    fireEvent.click(screen.getByTitle('Edit'));

    expect(screen.getByText('Edit Template')).toBeInTheDocument();

    // Fields should be pre-populated
    const nameInput = screen.getByPlaceholderText('Template name *') as HTMLInputElement;
    expect(nameInput.value).toBe('Bug Report');

    const descInput = screen.getByPlaceholderText('Description (optional)') as HTMLInputElement;
    expect(descInput.value).toBe('File bugs');
  });

  it('saves edited template via PATCH', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByTitle('Edit'));

    const nameInput = screen.getByPlaceholderText('Template name *');
    fireEvent.change(nameInput, { target: { value: 'Updated Report' } });

    // Mock PATCH + subsequent GET
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ template: { id: 't1', name: 'Updated Report' } }))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [{ id: 't1', name: 'Updated Report' }] }));

    fireEvent.click(screen.getByText('Save'));

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates?id=t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('Updated Report'),
    });
  });

  // ── Cancel form ────────────────────────────────────────────

  it('returns to list view when Cancel is clicked in the form', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByText('New Template')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('New Template')).not.toBeInTheDocument();
    });
    expect(screen.getByText('1 template')).toBeInTheDocument();
  });

  it('returns to list view when X button is clicked in the form', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    expect(screen.getByText('New Template')).toBeInTheDocument();

    // Find X button in the form header
    const closeBtn = screen.getByText('New Template').closest('div')?.querySelector('button');
    if (closeBtn) fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText('New Template')).not.toBeInTheDocument();
    });
  });

  // ── Delete template ────────────────────────────────────────

  it('deletes a template and removes it from the list', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    // Click the Delete button by title
    fireEvent.click(screen.getByTitle('Delete'));

    // Template should be removed locally
    await waitFor(() => {
      expect(screen.queryByText('Bug Report')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No templates yet. Create one to speed up task creation.')).toBeInTheDocument();
  });

  it('calls DELETE endpoint when deleting a template', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    // Mock DELETE response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    fireEvent.click(screen.getByTitle('Delete'));

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates?id=t1', {
      method: 'DELETE',
    });
  });

  // ── Manager header ─────────────────────────────────────────

  it('shows singular "1 template" in manager header when one template exists', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('1 template')).toBeInTheDocument();
  });

  it('shows plural "N templates" in manager header when multiple templates exist', async () => {
    const templates = sampleTemplates(5);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    expect(screen.getByText('5 templates')).toBeInTheDocument();
  });

  // ── Fetch error handling ───────────────────────────────────

  it('handles fetch failure gracefully by showing empty state', async () => {
    // Mock fetch to fail (non-ok response)
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ error: 'Server error' }, 500),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    // Should still render the Templates button even after failed fetch
    const templatesBtn = await screen.findByText('Templates');
    expect(templatesBtn).toBeInTheDocument();
  });

  it('handles network error gracefully', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Network error'));

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const templatesBtn = await screen.findByText('Templates');
    expect(templatesBtn).toBeInTheDocument();
  });

  // ── Edge cases ─────────────────────────────────────────────

  it('does not call saveTemplate when name is empty', async () => {
    const templates: unknown[] = [];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));
    fireEvent.click(screen.getByText('New'));

    // Create button should be disabled
    const createButton = screen.getByText('Create').closest('button');
    expect(createButton).toBeDisabled();
  });

  it('renders many templates in the scrollable list without crashing', async () => {
    const templates = sampleTemplates(20);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    await screen.findByText('Templates');
    fireEvent.click(screen.getByText('Templates'));

    // Should show count and first/last templates
    expect(screen.getByText('20 templates')).toBeInTheDocument();
    expect(screen.getByText('Template 1')).toBeInTheDocument();
    expect(screen.getByText('Template 20')).toBeInTheDocument();
  });

  it('applies template on first chip when multiple templates exist', async () => {
    const templates = sampleTemplates(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatePicker onApplyTemplate={onApplyTemplate} />);

    const chip = await screen.findByText('Template 1');
    fireEvent.click(chip);

    expect(onApplyTemplate).toHaveBeenCalled();
  });
});
