// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskChecklist } from '@/components/tasks/task-checklist';

// ─── Helpers ────────────────────────────────────────────────────

/** Returns a mock fetch Response with JSON body and Content-Type header. */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Sample checklist items for testing. */
function sampleItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${i + 1}`,
    taskId: 'task-1',
    content: `Checklist item ${i + 1}`,
    isChecked: false,
    checkedBy: null,
    checkedAt: null,
    sortOrder: i,
    createdAt: new Date(Date.now() - i * 60 * 1000).toISOString(),
  }));
}

/** A single checked item. */
const checkedItem = {
  id: 'item-checked',
  taskId: 'task-1',
  content: 'Completed step',
  isChecked: true,
  checkedBy: 'user-1',
  checkedAt: new Date().toISOString(),
  sortOrder: 0,
  createdAt: new Date(Date.now() - 3600 * 1000).toISOString(),
};

// ─── Tests ──────────────────────────────────────────────────────

describe('TaskChecklist (React Testing Library)', () => {
  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────

  it('shows shimmer loading state while fetching items', () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockReturnValue(new Promise(() => {}));

    const { container } = render(<TaskChecklist taskId="task-loading" taskStatus="open" />);

    // Loading state renders: title shimmer + progress bar shimmer + 3 item shimmers
    const shimmers = container.querySelectorAll('.shimmer');
    expect(shimmers.length).toBeGreaterThanOrEqual(5);
  });

  // ── Empty state ────────────────────────────────────────────

  it('shows empty state when no checklist items exist', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-empty" taskStatus="open" />);

    expect(await screen.findByText('No items')).toBeInTheDocument();
    expect(screen.getByText('No checklist items yet. Add one below.')).toBeInTheDocument();
    // Add input should be visible when not read-only
    expect(screen.getByPlaceholderText('Add checklist item...')).toBeInTheDocument();
  });

  // ── Items rendering ───────────────────────────────────────

  it('renders checklist items with checkbox and content', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(3) }),
    );

    render(<TaskChecklist taskId="task-items" taskStatus="open" />);

    // Wait for items to render
    expect(await screen.findByText('Checklist item 1')).toBeInTheDocument();
    expect(screen.getByText('Checklist item 2')).toBeInTheDocument();
    expect(screen.getByText('Checklist item 3')).toBeInTheDocument();

    // Progress summary
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders checked items with line-through styling', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [checkedItem, ...sampleItems(2)] }),
    );

    render(<TaskChecklist taskId="task-checked" taskStatus="open" />);

    expect(await screen.findByText('Completed step')).toBeInTheDocument();
    expect(screen.getByText('Completed step')).toHaveClass('line-through');

    // Progress should reflect checked count
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument();
  });

  it('renders correct number of items from the API response', async () => {
    const items = sampleItems(5);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-count" taskStatus="open" />);

    await waitFor(() => {
      expect(screen.getAllByText(/Checklist item/)).toHaveLength(5);
    });
  });

  // ── Add item ──────────────────────────────────────────────

  it('adds a new item via the input and button', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-add" taskStatus="open" />);

    // Wait for empty state
    await screen.findByText('No checklist items yet. Add one below.');

    // Mock the POST response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: sampleItems(1)[0] }),
    );

    // Type into the input
    const input = screen.getByPlaceholderText('Add checklist item...');
    fireEvent.change(input, { target: { value: 'New item' } });

    // Click the add button (has empty accessible name since only a Plus icon)
    const addButton = screen.getByRole('button', { name: '' });
    fireEvent.click(addButton);

    // New item should appear
    expect(await screen.findByText('Checklist item 1')).toBeInTheDocument();

    // Verify POST was called
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-add/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'New item' }),
    });

    // Input should be cleared
    expect(input).toHaveValue('');
  });

  it('adds a new item via Enter key', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-add-enter" taskStatus="open" />);

    await screen.findByText('No checklist items yet. Add one below.');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: sampleItems(1)[0] }),
    );

    const input = screen.getByPlaceholderText('Add checklist item...');
    fireEvent.change(input, { target: { value: 'Enter item' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Checklist item 1')).toBeInTheDocument();

    // Verify Enter triggered POST with content
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/tasks/task-add-enter/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Enter item' }),
    });
  });

  it('does not add empty items', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-add-empty" taskStatus="open" />);

    await screen.findByText('No checklist items yet. Add one below.');

    // Add button should be disabled when input is empty/whitespace
    const addButton = screen.getByRole('button', { name: '' });
    expect(addButton).toBeDisabled();

    // Input should show placeholder
    const input = screen.getByPlaceholderText('Add checklist item...');
    fireEvent.change(input, { target: { value: '   ' } });
    expect(addButton).toBeDisabled();

    // Enter should not add empty items
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
    expect(screen.getByText('No checklist items yet. Add one below.')).toBeInTheDocument();
  });

  it('shows spinner on add button while adding', async () => {
    // Keep POST unresolved so we see the spinner
    let resolvePost: (value: unknown) => void;
    const postPromise = new Promise((resolve) => {
      resolvePost = resolve;
    });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [] }),
    );

    render(<TaskChecklist taskId="task-add-spinner" taskStatus="open" />);

    await screen.findByText('No checklist items yet. Add one below.');

    // Intercept the POST call
    const input = screen.getByPlaceholderText('Add checklist item...');
    fireEvent.change(input, { target: { value: 'Spinner test' } });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => postPromise,
    );

    fireEvent.click(screen.getByRole('button', { name: '' }));

    // Spinner should appear on the add button
    await waitFor(() => {
      expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    });

    // Resolve the POST
    resolvePost!(mockFetchResponse({ item: sampleItems(1)[0] }));
  });

  // ── Toggle checkbox ───────────────────────────────────────

  it('toggles a checkbox from unchecked to checked', async () => {
    const items = sampleItems(2);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-toggle-on" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Mock the PATCH response for toggling
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: { ...items[0]!, isChecked: true } }),
    );

    // Find and click the first checkbox
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).not.toBeChecked();

    fireEvent.click(checkboxes[0]!);

    // After optimistic update, checkbox should become checked
    await waitFor(() => {
      expect(checkboxes[0]).toBeChecked();
    });

    // Progress should update to 1 of 2
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument();
  });

  it('toggles a checkbox from checked to unchecked', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [checkedItem, ...sampleItems(1)] }),
    );

    render(<TaskChecklist taskId="task-toggle-off" taskStatus="open" />);

    await screen.findByText('Completed step');

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: { ...checkedItem, isChecked: false } }),
    );

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();

    fireEvent.click(checkboxes[0]!);

    await waitFor(() => {
      expect(checkboxes[0]).not.toBeChecked();
    });

    expect(screen.getByText('0 of 2 done')).toBeInTheDocument();
  });

  it('reverts checkbox state when toggle API fails', async () => {
    const items = sampleItems(2);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-toggle-fail" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Mock the PATCH to fail with 500
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ error: 'Server error' }, 500),
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]!);

    // Optimistically checked...
    await waitFor(() => {
      expect(checkboxes[0]).toBeChecked();
    });

    // Then reverted after failure
    await waitFor(() => {
      expect(checkboxes[0]).not.toBeChecked();
    });
  });

  // ── Edit item ─────────────────────────────────────────────

  it('enters edit mode when clicking edit button', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-edit-enter" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Find and click the edit button (Edit3 icon)
    const editButtons = screen.getAllByTitle('Edit item');
    expect(editButtons.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(editButtons[0]!);

    // An input should appear with the item's content pre-filled
    const editInput = screen.getByDisplayValue('Checklist item 1');
    expect(editInput).toBeInTheDocument();

    // Save and cancel buttons should appear
    expect(document.querySelector('[class*="text-green-500"]')).toBeInTheDocument();
    expect(document.querySelector('[class*="text-surface-500"]')).toBeInTheDocument();
  });

  it('saves edited content via the save button', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-edit-save" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Enter edit mode
    fireEvent.click(screen.getByTitle('Edit item'));

    const editInput = screen.getByDisplayValue('Checklist item 1');
    fireEvent.change(editInput, { target: { value: 'Updated item' } });

    // Mock the PATCH response for saving
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: { ...sampleItems(1)[0]!, content: 'Updated item' } }),
    );

    // Click the save button (green check icon)
    const saveButton = document.querySelector('[class*="text-green-500"]');
    expect(saveButton).toBeInTheDocument();
    fireEvent.click(saveButton!);

    // Updated content should appear
    expect(await screen.findByText('Updated item')).toBeInTheDocument();
    expect(screen.queryByText('Checklist item 1')).not.toBeInTheDocument();
  });

  it('saves edited content via Enter key', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-edit-enter-key" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    fireEvent.click(screen.getByTitle('Edit item'));

    const editInput = screen.getByDisplayValue('Checklist item 1');
    fireEvent.change(editInput, { target: { value: 'Enter saved' } });

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ item: { ...sampleItems(1)[0]!, content: 'Enter saved' } }),
    );

    fireEvent.keyDown(editInput, { key: 'Enter', code: 'Enter' });

    expect(await screen.findByText('Enter saved')).toBeInTheDocument();
  });

  it('cancels edit mode via Escape key', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-edit-escape" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    fireEvent.click(screen.getByTitle('Edit item'));

    const editInput = screen.getByDisplayValue('Checklist item 1');
    fireEvent.change(editInput, { target: { value: 'This will not save' } });

    // Press Escape
    fireEvent.keyDown(editInput, { key: 'Escape', code: 'Escape' });

    // Original content should still be there
    expect(screen.getByText('Checklist item 1')).toBeInTheDocument();
    expect(screen.queryByText('This will not save')).not.toBeInTheDocument();
  });

  it('cancels edit mode via the cancel button', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-edit-cancel-btn" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    fireEvent.click(screen.getByTitle('Edit item'));

    fireEvent.change(screen.getByDisplayValue('Checklist item 1'), {
      target: { value: 'Will not save' },
    });

    // Click the cancel button (X icon) — scope to button elements to avoid matching
    // the progress text element which also has text-surface-500
    const cancelButton = document.querySelector('button[class*="text-surface-500"]');
    expect(cancelButton).toBeInTheDocument();
    fireEvent.click(cancelButton!);

    // Original content should still be there
    expect(screen.getByText('Checklist item 1')).toBeInTheDocument();
    expect(screen.queryByText('Will not save')).not.toBeInTheDocument();
  });

  // ── Delete item ───────────────────────────────────────────

  it('deletes a checklist item', async () => {
    const items = sampleItems(3);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-delete" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Mock the DELETE response
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockFetchResponse({ success: true }),
    );

    // Click the delete button on the first item
    const deleteButtons = screen.getAllByTitle('Delete item');
    expect(deleteButtons.length).toBe(3);

    fireEvent.click(deleteButtons[0]!);

    // Verify DELETE was called
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/tasks/task-delete/checklist?itemId=item-1',
      { method: 'DELETE' },
    );

    // Item should be removed
    await waitFor(() => {
      expect(screen.queryByText('Checklist item 1')).not.toBeInTheDocument();
    });

    // Other items should remain
    expect(screen.getByText('Checklist item 2')).toBeInTheDocument();
    expect(screen.getByText('Checklist item 3')).toBeInTheDocument();
  });

  // ── Read-only mode ───────────────────────────────────────

  it('hides add input and action buttons when task is closed', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(2) }),
    );

    render(<TaskChecklist taskId="task-closed" taskStatus="closed" />);

    await screen.findByText('Checklist item 1');

    // Add input should not be rendered
    expect(screen.queryByPlaceholderText('Add checklist item...')).not.toBeInTheDocument();

    // Edit and delete buttons should not be visible
    expect(screen.queryByTitle('Edit item')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument();
  });

  it('hides add input and action buttons when task is archived', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-archived" taskStatus="archived" />);

    await screen.findByText('Checklist item 1');

    expect(screen.queryByPlaceholderText('Add checklist item...')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Edit item')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete item')).not.toBeInTheDocument();
  });

  it('allows interaction when task is open', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(1) }),
    );

    render(<TaskChecklist taskId="task-open" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Add input should be visible
    expect(screen.getByPlaceholderText('Add checklist item...')).toBeInTheDocument();

    // Edit and delete buttons should be visible on hover (rendered in DOM)
    expect(screen.getByTitle('Edit item')).toBeInTheDocument();
    expect(screen.getByTitle('Delete item')).toBeInTheDocument();
  });

  // ── Completion celebration ───────────────────────────────

  it('shows completion celebration when all items are checked', async () => {
    const items = [
      { ...sampleItems(1)[0]!, isChecked: true },
      { ...sampleItems(1)[0]!, id: 'item-done-2', content: 'Second item', isChecked: true },
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-celebrate" taskStatus="open" />);

    expect(await screen.findByText('✓ All done!')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('does not show completion celebration for a single checked item (requires >1 total)', async () => {
    // Component guard: totalCount > 0 && checkedCount === totalCount && totalCount > 1
    const item = { ...sampleItems(1)[0]!, isChecked: true, content: 'My single task' };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: [item] }),
    );

    render(<TaskChecklist taskId="task-single-done" taskStatus="open" />);

    // Wait for item to render
    await screen.findByText('My single task');

    // Single item does NOT trigger celebration (totalCount > 1 is false)
    expect(screen.queryByText('✓ All done!')).not.toBeInTheDocument();
  });

  // ── Drag handle ──────────────────────────────────────────

  it('renders drag handles for each item when not read-only', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(3) }),
    );

    const { container } = render(<TaskChecklist taskId="task-drag-handle" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Each item should have a drag handle button
    const dragHandles = container.querySelectorAll('[title="Drag to reorder"]');
    expect(dragHandles.length).toBe(3);
  });

  it('does not render drag handles when in read-only mode', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items: sampleItems(2) }),
    );

    const { container } = render(<TaskChecklist taskId="task-no-drag" taskStatus="closed" />);

    await screen.findByText('Checklist item 1');

    const dragHandles = container.querySelectorAll('[title="Drag to reorder"]');
    expect(dragHandles.length).toBe(0);
  });

  it('renders items in sortOrder from the API response', async () => {
    // DnD reorder testing in jsdom is limited (@dnd-kit sensors need
    // native pointer events). We verify initial sort order here.
    const items = sampleItems(2);
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockFetchResponse({ items }),
    );

    render(<TaskChecklist taskId="task-dnd" taskStatus="open" />);

    await screen.findByText('Checklist item 1');

    // Items should be in their sortOrder (item-1, then item-2)
    const itemTexts = screen.getAllByText(/Checklist item/);
    expect(itemTexts[0]).toHaveTextContent('Checklist item 1');
    expect(itemTexts[1]).toHaveTextContent('Checklist item 2');
  });
});
