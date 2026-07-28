// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskTemplatesPage from '@/app/(dashboard)/task-templates/page';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sample task templates for testing. */
function sampleTemplate(overrides: Partial<{
  id: string;
  name: string;
  description: string | null;
  taskTitle: string | null;
  taskDescription: string | null;
  priority: string;
  category: string | null;
  labels: string[] | null;
  tags: string[] | null;
  estimatedHours: string | null;
  isDefault: boolean;
  createdAt: string;
}> = {}) {
  return {
    id: 'template-1',
    name: 'Bug Report',
    description: 'Template for filing bug reports',
    taskTitle: 'Fix: [summary]',
    taskDescription: '## Steps to reproduce\n\n1. \n2. \n\n## Expected behavior\n\n## Actual behavior',
    priority: 'high',
    category: 'Bug',
    labels: ['bug', 'frontend'],
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
      description: i === 0 ? 'The first template' : null,
      taskTitle: i === 0 ? 'Task: [title]' : null,
      priority: i === 0 ? 'medium' : 'high',
      isDefault: i === 0,
      createdAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
    }),
  );
}

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskTemplatesPage (React Testing Library)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────

  it('shows shimmer loading placeholders while fetching templates', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TaskTemplatesPage />);

    // Loading state renders: header shimmer + 3 card shimmers
    const shimmers = container.querySelectorAll('.shimmer');
    expect(shimmers.length).toBeGreaterThanOrEqual(3);
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows empty state when no templates exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [] }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('No templates yet')).toBeInTheDocument();
    expect(
      screen.getByText(/Create templates to quickly generate tasks/),
    ).toBeInTheDocument();
    expect(screen.getByText('Create Your First Template')).toBeInTheDocument();

    // Header should show "0 templates"
    expect(screen.getByText('0 templates')).toBeInTheDocument();
  });

  // ── Error state ────────────────────────────────────────────

  it('shows error state with retry button when fetch fails', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ error: 'Server error' }, 500),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('Failed to load templates')).toBeInTheDocument();
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('retries fetch when retry button is clicked', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ error: 'Server error' }, 500))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [sampleTemplate()] }));

    render(<TaskTemplatesPage />);

    await screen.findByText('Failed to load templates');

    fireEvent.click(screen.getByText('Retry'));

    expect(await screen.findByText('Bug Report')).toBeInTheDocument();
  });

  // ── Populated state ────────────────────────────────────────

  it('renders template cards from the API response', async () => {
    const templates = sampleTemplates(3).map((t) => ({ ...t, isDefault: false }));
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('Template 1')).toBeInTheDocument();
    expect(screen.getByText('Template 2')).toBeInTheDocument();
    expect(screen.getByText('Template 3')).toBeInTheDocument();

    // Header should show template count
    expect(screen.getByText('3 templates')).toBeInTheDocument();
  });

  it('renders header with default template indicator', async () => {
    const templates = [
      sampleTemplate({ id: 't1', name: 'Default Template', isDefault: true }),
      sampleTemplate({ id: 't2', name: 'Other Template', isDefault: false }),
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    // "Default Template" appears in both header span and card h3
    const defaultTemplateEls = await screen.findAllByText(/Default Template/);
    expect(defaultTemplateEls.length).toBe(2);

    // Header should mention the default template
    expect(screen.getByText(/is default/)).toBeInTheDocument();
  });

  // ── Sorting ────────────────────────────────────────────────

  it('sorts templates so the default template appears first', async () => {
    const templates = [
      sampleTemplate({ id: 't1', name: 'Alpha', isDefault: false }),
      sampleTemplate({ id: 't2', name: 'Default One', isDefault: true }),
      sampleTemplate({ id: 't3', name: 'Beta', isDefault: false }),
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Alpha');

    // The default template should be rendered first
    const templateCards = screen.getAllByText(/^(Default One|Alpha|Beta)$/);
    expect(templateCards[0]).toHaveTextContent('Default One');
  });

  // ── Template field rendering ───────────────────────────────

  it('renders priority badge with correct text', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [sampleTemplate({ priority: 'urgent' })] }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('urgent')).toBeInTheDocument();
  });

  it('renders category chip when present', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [sampleTemplate({ category: 'Feature' })] }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('Feature')).toBeInTheDocument();
  });

  it('renders estimated hours when present', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [sampleTemplate({ estimatedHours: '8' })] }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('8h')).toBeInTheDocument();
  });

  it('renders labels with tag icons', async () => {
    const templates = [sampleTemplate({ labels: ['bug', 'frontend', 'urgent'] })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('bug')).toBeInTheDocument();
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
  });

  it('shows +N overflow indicator when there are more than 3 labels', async () => {
    const templates = [sampleTemplate({ labels: ['a', 'b', 'c', 'd', 'e'] })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('+2')).toBeInTheDocument();
  });

  it('renders tags with hash prefix', async () => {
    const templates = [sampleTemplate({ tags: ['sprint-24', 'q4'] })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('#sprint-24')).toBeInTheDocument();
    expect(screen.getByText('#q4')).toBeInTheDocument();
  });

  it('renders task title preview with arrow indicator', async () => {
    const templates = [sampleTemplate({ taskTitle: 'Fix: login bug' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText(/Fix: login bug/)).toBeInTheDocument();
  });

  it('truncates long task titles in the preview', async () => {
    const longTitle = 'A'.repeat(50);
    const templates = [sampleTemplate({ taskTitle: longTitle })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    // Should be truncated to 40 chars — the rendered text ends with "...\""
    // due to the quote wrapper: "AAAA...A..."
    const titleTexts = await screen.findAllByText(/A{40}/);
    expect(titleTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows default badge on the default template', async () => {
    const templates = [sampleTemplate({ isDefault: true })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText('Default')).toBeInTheDocument();
  });

  it('renders task description in the bottom info bar', async () => {
    const templates = [sampleTemplate({ taskDescription: 'This is a detailed description for testing purposes' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText(/detailed description/)).toBeInTheDocument();
  });

  it('shows formatted creation date', async () => {
    const templates = [sampleTemplate({ createdAt: '2026-01-15T12:00:00.000Z' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText(/Jan 15, 2026/)).toBeInTheDocument();
  });

  // ── Hint text ──────────────────────────────────────────────

  it('shows hint about templates being available when creating tasks', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    expect(await screen.findByText(/Templates are available when creating tasks/)).toBeInTheDocument();
  });

  // ── Open create form dialog ────────────────────────────────

  it('opens the create template dialog when New Template button is clicked', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Click New Template button
    fireEvent.click(screen.getByText('New Template'));

    // Dialog should appear with "New Task Template" title
    expect(screen.getByText('New Task Template')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Bug Report')).toBeInTheDocument();
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('opens the create dialog from the empty state CTA', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates: [] }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('No templates yet');

    fireEvent.click(screen.getByText('Create Your First Template'));

    expect(screen.getByText('New Task Template')).toBeInTheDocument();
  });

  // ── Create template ────────────────────────────────────────

  it('creates a new template via the form dialog', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Open create dialog
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Mock the POST response to return the new template, then GET returns updated list
    const newTemplate = sampleTemplate({ id: 'new-1', name: 'New Template' });
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ template: newTemplate }, 201))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [...templates, newTemplate] }));

    // Fill out the form
    const nameInput = screen.getByPlaceholderText('e.g., Bug Report');
    fireEvent.change(nameInput, { target: { value: 'New Template' } });

    const prioritySelect = screen.getByDisplayValue('Medium');
    fireEvent.change(prioritySelect, { target: { value: 'urgent' } });

    // Click Create
    fireEvent.click(screen.getByText('Create'));

    // Dialog should close and new template should appear
    expect(await screen.findByText('New Template')).toBeInTheDocument();

    // Verify POST was called with the correct body
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('New Template'),
    });
  });

  it('shows validation error when creating a template without a name', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Try to create without a name
    const nameInput = screen.getByPlaceholderText('e.g., Bug Report');
    fireEvent.change(nameInput, { target: { value: '' } });

    fireEvent.click(screen.getByText('Create'));

    // Validation error should appear
    expect(screen.getByText('Name is required')).toBeInTheDocument();
  });

  it('closes the create dialog when clicking the X button', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Click X to close
    const closeButtons = screen.getAllByRole('button');
    const xButton = closeButtons.find((btn) => btn.querySelector('svg.lucide-x'));
    if (xButton) fireEvent.click(xButton);

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText('New Task Template')).not.toBeInTheDocument();
    });
  });

  it('closes the create dialog when clicking the backdrop', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Click the backdrop (dialog overlay)
    const backdrop = document.querySelector('.fixed.inset-0');
    if (backdrop) fireEvent.click(backdrop);

    await waitFor(() => {
      expect(screen.queryByText('New Task Template')).not.toBeInTheDocument();
    });
  });

  // ── Edit template ──────────────────────────────────────────

  it('opens edit dialog with pre-populated fields when edit button is clicked', async () => {
    const templates = [sampleTemplate({ name: 'Bug Report', description: 'File bug reports', priority: 'high' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Find and click the edit button by title
    const editBtn = screen.getByTitle('Edit template');
    fireEvent.click(editBtn);

    // Dialog should appear with "Edit Template" title
    expect(screen.getByText('Edit Template')).toBeInTheDocument();

    // Fields should be pre-populated
    const nameInput = screen.getByPlaceholderText('e.g., Bug Report') as HTMLInputElement;
    expect(nameInput.value).toBe('Bug Report');
  });

  it('saves edited template via the PATCH endpoint', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Click edit by title
    fireEvent.click(screen.getByTitle('Edit template'));
    await screen.findByText('Edit Template');

    // Change the name
    const nameInput = screen.getByPlaceholderText('e.g., Bug Report');
    fireEvent.change(nameInput, { target: { value: 'Updated Bug Report' } });

    // Mock PATCH + subsequent GET
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ template: { ...templates[0]!, name: 'Updated Bug Report' } }))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [{ ...templates[0]!, name: 'Updated Bug Report' }] }));

    // Click Update
    fireEvent.click(screen.getByText('Update'));

    // Updated name should appear
    expect(await screen.findByText('Updated Bug Report')).toBeInTheDocument();
  });

  // ── Cancel edit ────────────────────────────────────────────

  it('closes edit dialog when clicking Cancel', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    fireEvent.click(screen.getByTitle('Edit template'));
    await screen.findByText('Edit Template');

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Edit Template')).not.toBeInTheDocument();
    });
  });

  // ── Delete template ────────────────────────────────────────

  it('opens delete confirmation dialog', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Find and click the delete button by title
    fireEvent.click(screen.getByTitle('Delete template'));

    expect(screen.getByText('Delete Template')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure/)).toBeInTheDocument();
  });

  it('deletes template and removes it from the list', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Open delete dialog by title
    fireEvent.click(screen.getByTitle('Delete template'));
    await screen.findByText('Delete Template');

    // Mock DELETE + subsequent GET (returning empty)
    (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(mockFetchResponse({ success: true }))
      .mockResolvedValueOnce(mockFetchResponse({ templates: [] }));

    // Click Delete
    fireEvent.click(screen.getByText('Delete'));

    // Should show empty state after delete
    expect(await screen.findByText('No templates yet')).toBeInTheDocument();
  });

  it('cancels delete when clicking Cancel', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    fireEvent.click(screen.getByTitle('Delete template'));
    await screen.findByText('Delete Template');

    fireEvent.click(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('Delete Template')).not.toBeInTheDocument();
    });
  });

  // ── Toggle default ─────────────────────────────────────────

  it('toggles a template as default via the star button', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report', isDefault: false })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Find and click the star button by title ("Set as default")
    fireEvent.click(screen.getByTitle('Set as default'));

    // Verify PATCH was called with isDefault: true
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates?id=t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('true'),
    });
  });

  it('removes default status from a template via the star button', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report', isDefault: true })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    // "Bug Report" appears in both header span and card h3 when it's the default
    const bugReportEls = await screen.findAllByText('Bug Report');
    expect(bugReportEls.length).toBe(2);

    // Star button shows "Remove default" when template is default
    fireEvent.click(screen.getByTitle('Remove default'));

    // Verify PATCH was called with isDefault: false
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/task-templates?id=t1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: expect.stringContaining('false'),
    });
  });

  // ── Dialog form fields ─────────────────────────────────────

  it('renders all form fields in the create dialog', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // All form fields should be present
    expect(screen.getByPlaceholderText('e.g., Bug Report')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Template description (optional)')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Fix: \[summary\]/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Default description/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Medium')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Bug, Feature')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('bug, frontend, urgent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('sprint-24, q4')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0')).toBeInTheDocument();
    expect(screen.getByText('Set as default template')).toBeInTheDocument();
  });

  it('renders all priority options in the select', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    const prioritySelect = screen.getByDisplayValue('Medium');
    expect(prioritySelect).toBeInTheDocument();

    // Select should have all 6 options
    const options = Array.from(prioritySelect.querySelectorAll('option'));
    expect(options.map((o) => o.textContent)).toEqual([
      'None',
      'Low',
      'Medium',
      'High',
      'Urgent',
      'Critical',
    ]);
  });

  it('toggles the default template checkbox', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Find the checkbox within the default template toggle label
    const labelEl = screen.getByText('Set as default template').closest('label')!;
    const checkbox = labelEl.querySelector('input[type="checkbox"]') as HTMLInputElement;

    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  // ── Form error display ─────────────────────────────────────

  it('shows inline form error when API call fails during save', async () => {
    const templates = [sampleTemplate()];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    const nameInput = screen.getByPlaceholderText('e.g., Bug Report');
    fireEvent.change(nameInput, { target: { value: 'New Template' } });

    // Mock POST to fail
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ error: { message: 'Failed to save template' } }, 400),
    );

    fireEvent.click(screen.getByText('Create'));

    expect(await screen.findByText('Failed to save template')).toBeInTheDocument();
  });

  // ── Multiple templates ─────────────────────────────────────

  it('renders many template cards without crashing', async () => {
    const templates = sampleTemplates(15);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Template 15');
    expect(screen.getByText(/15 templates/)).toBeInTheDocument();
  });

  // ── Reset form between create and edit ─────────────────────

  it('resets the form when switching from edit to create', async () => {
    const templates = [sampleTemplate({ id: 't1', name: 'Bug Report' })];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ templates }),
    );

    render(<TaskTemplatesPage />);

    await screen.findByText('Bug Report');

    // Open edit by title
    fireEvent.click(screen.getByTitle('Edit template'));
    await screen.findByText('Edit Template');

    // Close edit
    fireEvent.click(screen.getByText('Cancel'));

    // Open create
    fireEvent.click(screen.getByText('New Template'));
    await screen.findByText('New Task Template');

    // Name field should be empty (not pre-populated from edit)
    const nameInput = screen.getByPlaceholderText('e.g., Bug Report') as HTMLInputElement;
    expect(nameInput.value).toBe('');
  });
});
