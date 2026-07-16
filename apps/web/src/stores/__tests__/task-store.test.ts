import { describe, it, expect, beforeEach } from 'vitest';
import { useTaskStore, defaultFilters } from '../task-store';
import type {
  Task,
  Comment,
  Attachment,
  TimeEntry,
  Dependency,
  ChecklistItem,
} from '../task-store';

// ─── Fixtures ───────────────────────────────────────────────

const mockTask: Task = {
  id: 'task-1',
  title: 'Test task',
  description: 'A test task description',
  taskIdDisplay: 'TASK-1',
  status: 'open',
  priority: 'medium',
  assignedTo: 'user-1',
  projectId: 'project-1',
  departmentId: null,
  teamId: null,
  createdBy: 'user-1',
  updatedBy: null,
  dueDate: '2026-08-01T00:00:00Z',
  startDate: null,
  estimatedHours: '8',
  actualHours: null,
  labels: ['bug', 'frontend'],
  tags: null,
  category: 'development',
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-15T00:00:00Z',
  deletedAt: null,
  updatedByName: null,
  sortOrder: '0',
};

const mockTask2: Task = {
  ...mockTask,
  id: 'task-2',
  title: 'Second task',
  taskIdDisplay: 'TASK-2',
  status: 'completed',
  priority: 'high',
};

const mockComment: Comment = {
  id: 'comment-1',
  taskId: 'task-1',
  userId: 'user-1',
  content: 'This is a comment',
  isInternalNote: false,
  parentId: null,
  isEdited: false,
  editedAt: null,
  createdAt: '2026-07-10T00:00:00Z',
  user: { id: 'user-1', name: 'Alice', avatarUrl: null },
};

const mockAttachment: Attachment = {
  id: 'attach-1',
  taskId: 'task-1',
  userId: 'user-1',
  fileName: 'document.pdf',
  fileSize: 102400,
  mimeType: 'application/pdf',
  createdAt: '2026-07-10T00:00:00Z',
  user: { id: 'user-1', name: 'Alice' },
};

const mockTimeEntry: TimeEntry = {
  id: 'time-1',
  taskId: 'task-1',
  userId: 'user-1',
  startTime: '2026-07-10T08:00:00Z',
  endTime: '2026-07-10T09:30:00Z',
  durationMinutes: 90,
  entryType: 'manual',
  description: 'Worked on feature',
  createdAt: '2026-07-10T09:30:00Z',
  user: { id: 'user-1', name: 'Alice', avatarUrl: null },
};

const mockDependency: Dependency = {
  id: 'dep-1',
  taskId: 'task-1',
  dependsOnTaskId: 'task-2',
  dependencyType: 'blocks',
  createdAt: '2026-07-05T00:00:00Z',
  dependsOnTask: {
    id: 'task-2',
    title: 'Second task',
    taskIdDisplay: 'TASK-2',
    status: 'completed',
  },
};

const mockBlockingDependency: Dependency = {
  id: 'dep-2',
  taskId: 'task-3',
  dependsOnTaskId: 'task-1',
  dependencyType: 'blocked_by',
  createdAt: '2026-07-06T00:00:00Z',
  blockingTask: { id: 'task-3', title: 'Third task', taskIdDisplay: 'TASK-3', status: 'open' },
};

const mockChecklistItem: ChecklistItem = {
  id: 'check-1',
  taskId: 'task-1',
  content: 'Checklist item 1',
  isChecked: false,
  checkedBy: null,
  checkedAt: null,
  sortOrder: 1,
  createdAt: '2026-07-01T00:00:00Z',
};

// Reset store to initial state before each test
beforeEach(() => {
  useTaskStore.setState({
    tasks: [],
    totalCount: 0,
    loading: false,
    error: null,
    currentTask: null,
    comments: [],
    attachments: [],
    timeEntries: [],
    blockedBy: [],
    blocking: [],
    checklistItems: [],
    loadingDetail: false,
    detailError: null,
    filters: { ...defaultFilters },
    ui: {
      view: 'list',
      page: 0,
      pageSize: 25,
      selectedIds: new Set(),
      allSelectedMode: false,
      allMatchingIds: [],
      showFilters: false,
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Task List Actions ───────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('Task List Actions', () => {
  describe('setTasks', () => {
    it('should set tasks and keep other state intact', () => {
      useTaskStore.getState().setTasks([mockTask]);
      const state = useTaskStore.getState();
      expect(state.tasks).toEqual([mockTask]);
      expect(state.loading).toBe(false);
    });

    it('should replace existing tasks', () => {
      useTaskStore.setState({ tasks: [mockTask] });
      useTaskStore.getState().setTasks([mockTask2]);
      const state = useTaskStore.getState();
      expect(state.tasks).toEqual([mockTask2]);
      expect(state.tasks).toHaveLength(1);
    });

    it('should accept an empty array', () => {
      useTaskStore.setState({ tasks: [mockTask] });
      useTaskStore.getState().setTasks([]);
      expect(useTaskStore.getState().tasks).toEqual([]);
    });
  });

  describe('setTotalCount', () => {
    it('should set total count', () => {
      useTaskStore.getState().setTotalCount(42);
      expect(useTaskStore.getState().totalCount).toBe(42);
    });

    it('should reset to 0', () => {
      useTaskStore.setState({ totalCount: 10 });
      useTaskStore.getState().setTotalCount(0);
      expect(useTaskStore.getState().totalCount).toBe(0);
    });
  });

  describe('setLoading', () => {
    it('should start loading', () => {
      useTaskStore.getState().setLoading(true);
      expect(useTaskStore.getState().loading).toBe(true);
    });

    it('should stop loading', () => {
      useTaskStore.setState({ loading: true });
      useTaskStore.getState().setLoading(false);
      expect(useTaskStore.getState().loading).toBe(false);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useTaskStore.getState().setError('Something went wrong');
      expect(useTaskStore.getState().error).toBe('Something went wrong');
    });

    it('should clear error with null', () => {
      useTaskStore.setState({ error: 'Old error' });
      useTaskStore.getState().setError(null);
      expect(useTaskStore.getState().error).toBeNull();
    });
  });

  describe('updateTaskInList', () => {
    it('should update specific fields of a task', () => {
      useTaskStore.setState({ tasks: [mockTask, mockTask2] });
      useTaskStore
        .getState()
        .updateTaskInList('task-1', { title: 'Updated title', status: 'in_progress' });
      const { tasks } = useTaskStore.getState();
      expect(tasks[0]!.title).toBe('Updated title');
      expect(tasks[0]!.status).toBe('in_progress');
      expect(tasks[1]!.title).toBe('Second task'); // Unchanged
    });

    it('should not change anything for non-existent task ID', () => {
      useTaskStore.setState({ tasks: [mockTask] });
      useTaskStore.getState().updateTaskInList('nonexistent', { title: 'Nope' });
      expect(useTaskStore.getState().tasks[0]!.title).toBe('Test task');
    });

    it('should work with empty task list', () => {
      useTaskStore.getState().updateTaskInList('task-1', { title: 'X' });
      expect(useTaskStore.getState().tasks).toEqual([]);
    });
  });

  describe('removeTaskFromList', () => {
    it('should remove the specified task', () => {
      useTaskStore.setState({ tasks: [mockTask, mockTask2] });
      useTaskStore.getState().removeTaskFromList('task-1');
      const { tasks } = useTaskStore.getState();
      expect(tasks).toHaveLength(1);
      expect(tasks[0]!.id).toBe('task-2');
    });

    it('should do nothing when task does not exist', () => {
      useTaskStore.setState({ tasks: [mockTask] });
      useTaskStore.getState().removeTaskFromList('nonexistent');
      expect(useTaskStore.getState().tasks).toHaveLength(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Task Detail Actions ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('Task Detail Actions', () => {
  describe('setCurrentTask', () => {
    it('should set the current task', () => {
      useTaskStore.getState().setCurrentTask(mockTask);
      expect(useTaskStore.getState().currentTask).toEqual(mockTask);
    });

    it('should clear the current task with null', () => {
      useTaskStore.setState({ currentTask: mockTask });
      useTaskStore.getState().setCurrentTask(null);
      expect(useTaskStore.getState().currentTask).toBeNull();
    });
  });

  describe('setComments', () => {
    it('should set comments array', () => {
      useTaskStore.getState().setComments([mockComment]);
      expect(useTaskStore.getState().comments).toEqual([mockComment]);
    });

    it('should override existing comments', () => {
      useTaskStore.setState({ comments: [mockComment] });
      useTaskStore.getState().setComments([]);
      expect(useTaskStore.getState().comments).toEqual([]);
    });
  });

  describe('addComment', () => {
    it('should prepend a comment to the list', () => {
      const existing: Comment = { ...mockComment, id: 'existing' };
      useTaskStore.setState({ comments: [existing] });
      const newComment: Comment = { ...mockComment, id: 'new-comment', content: 'New comment' };
      useTaskStore.getState().addComment(newComment);
      const { comments } = useTaskStore.getState();
      expect(comments).toHaveLength(2);
      expect(comments[0]!.id).toBe('new-comment'); // Prepend
      expect(comments[1]!.id).toBe('existing');
    });

    it('should add to empty comments', () => {
      useTaskStore.getState().addComment(mockComment);
      expect(useTaskStore.getState().comments).toHaveLength(1);
    });
  });

  describe('removeComment', () => {
    it('should remove a comment by ID', () => {
      useTaskStore.setState({ comments: [mockComment, { ...mockComment, id: 'other' }] });
      useTaskStore.getState().removeComment('comment-1');
      const { comments } = useTaskStore.getState();
      expect(comments).toHaveLength(1);
      expect(comments[0]!.id).toBe('other');
    });

    it('should do nothing for unknown ID', () => {
      useTaskStore.setState({ comments: [mockComment] });
      useTaskStore.getState().removeComment('unknown');
      expect(useTaskStore.getState().comments).toHaveLength(1);
    });
  });

  describe('setAttachments', () => {
    it('should set attachments array', () => {
      useTaskStore.getState().setAttachments([mockAttachment]);
      expect(useTaskStore.getState().attachments).toEqual([mockAttachment]);
    });
  });

  describe('addAttachment', () => {
    it('should prepend an attachment', () => {
      useTaskStore.getState().addAttachment(mockAttachment);
      expect(useTaskStore.getState().attachments).toHaveLength(1);
      expect(useTaskStore.getState().attachments[0]!.fileName).toBe('document.pdf');
    });
  });

  describe('removeAttachment', () => {
    it('should remove an attachment by ID', () => {
      useTaskStore.setState({ attachments: [mockAttachment] });
      useTaskStore.getState().removeAttachment('attach-1');
      expect(useTaskStore.getState().attachments).toHaveLength(0);
    });
  });

  describe('setTimeEntries', () => {
    it('should set time entries', () => {
      useTaskStore.getState().setTimeEntries([mockTimeEntry]);
      expect(useTaskStore.getState().timeEntries).toHaveLength(1);
    });

    it('should replace existing entries', () => {
      useTaskStore.setState({ timeEntries: [mockTimeEntry] });
      useTaskStore.getState().setTimeEntries([]);
      expect(useTaskStore.getState().timeEntries).toHaveLength(0);
    });
  });

  describe('addTimeEntry', () => {
    it('should append a time entry', () => {
      useTaskStore.getState().addTimeEntry(mockTimeEntry);
      const { timeEntries } = useTaskStore.getState();
      expect(timeEntries).toHaveLength(1);
      expect(timeEntries[0]!.id).toBe('time-1');
    });

    it('should append to existing entries (not prepend)', () => {
      const e1: TimeEntry = { ...mockTimeEntry, id: 'first' };
      useTaskStore.setState({ timeEntries: [e1] });
      const e2: TimeEntry = { ...mockTimeEntry, id: 'second' };
      useTaskStore.getState().addTimeEntry(e2);
      expect(useTaskStore.getState().timeEntries).toHaveLength(2);
      expect(useTaskStore.getState().timeEntries[1]!.id).toBe('second'); // Appended
    });
  });

  describe('removeTimeEntry', () => {
    it('should remove a time entry by ID', () => {
      useTaskStore.setState({ timeEntries: [mockTimeEntry] });
      useTaskStore.getState().removeTimeEntry('time-1');
      expect(useTaskStore.getState().timeEntries).toHaveLength(0);
    });
  });

  describe('setDependencies', () => {
    it('should set both blockedBy and blocking', () => {
      useTaskStore.getState().setDependencies([mockDependency], [mockBlockingDependency]);
      const state = useTaskStore.getState();
      expect(state.blockedBy).toEqual([mockDependency]);
      expect(state.blocking).toEqual([mockBlockingDependency]);
    });

    it('should clear both arrays', () => {
      useTaskStore.setState({ blockedBy: [mockDependency], blocking: [mockBlockingDependency] });
      useTaskStore.getState().setDependencies([], []);
      expect(useTaskStore.getState().blockedBy).toEqual([]);
      expect(useTaskStore.getState().blocking).toEqual([]);
    });
  });

  describe('addDependency', () => {
    it('should add a dependency to blockedBy', () => {
      useTaskStore.getState().addDependency(mockDependency);
      expect(useTaskStore.getState().blockedBy).toHaveLength(1);
      expect(useTaskStore.getState().blockedBy[0]!.id).toBe('dep-1');
    });
  });

  describe('removeDependency', () => {
    it('should remove dependency from both blockedBy and blocking', () => {
      useTaskStore.setState({
        blockedBy: [mockDependency],
        blocking: [mockBlockingDependency],
      });
      useTaskStore.getState().removeDependency('dep-1');
      expect(useTaskStore.getState().blockedBy).toEqual([]);
      expect(useTaskStore.getState().blocking).toEqual([mockBlockingDependency]); // Unchanged
    });
  });

  describe('checklist actions', () => {
    it('setChecklistItems should set items', () => {
      useTaskStore.getState().setChecklistItems([mockChecklistItem]);
      expect(useTaskStore.getState().checklistItems).toEqual([mockChecklistItem]);
    });

    it('addChecklistItem should add to list', () => {
      useTaskStore.getState().addChecklistItem(mockChecklistItem);
      expect(useTaskStore.getState().checklistItems).toHaveLength(1);
    });

    describe('updateChecklistItem', () => {
      it('should update partial fields of an item', () => {
        useTaskStore.setState({ checklistItems: [mockChecklistItem] });
        useTaskStore
          .getState()
          .updateChecklistItem('check-1', { isChecked: true, checkedBy: 'user-1' });
        const item = useTaskStore.getState().checklistItems[0]!;
        expect(item.isChecked).toBe(true);
        expect(item.checkedBy).toBe('user-1');
        expect(item.content).toBe('Checklist item 1'); // Unchanged
      });

      it('should not change anything for unknown item', () => {
        useTaskStore.setState({ checklistItems: [mockChecklistItem] });
        useTaskStore.getState().updateChecklistItem('unknown', { isChecked: true });
        expect(useTaskStore.getState().checklistItems[0]!.isChecked).toBe(false);
      });
    });

    describe('removeChecklistItem', () => {
      it('should remove an item by ID', () => {
        useTaskStore.setState({
          checklistItems: [mockChecklistItem, { ...mockChecklistItem, id: 'check-2' }],
        });
        useTaskStore.getState().removeChecklistItem('check-1');
        expect(useTaskStore.getState().checklistItems).toHaveLength(1);
        expect(useTaskStore.getState().checklistItems[0]!.id).toBe('check-2');
      });
    });
  });

  describe('loadingDetail / detailError', () => {
    it('setLoadingDetail should toggle loading', () => {
      useTaskStore.getState().setLoadingDetail(true);
      expect(useTaskStore.getState().loadingDetail).toBe(true);
      useTaskStore.getState().setLoadingDetail(false);
      expect(useTaskStore.getState().loadingDetail).toBe(false);
    });

    it('setDetailError should set and clear error', () => {
      useTaskStore.getState().setDetailError('Task not found');
      expect(useTaskStore.getState().detailError).toBe('Task not found');
      useTaskStore.getState().setDetailError(null);
      expect(useTaskStore.getState().detailError).toBeNull();
    });
  });

  describe('updateCurrentTask', () => {
    it('should update current task fields', () => {
      useTaskStore.setState({ currentTask: mockTask });
      useTaskStore.getState().updateCurrentTask({ title: 'Updated task title', priority: 'high' });
      const task = useTaskStore.getState().currentTask;
      expect(task?.title).toBe('Updated task title');
      expect(task?.priority).toBe('high');
      expect(task?.status).toBe('open'); // Unchanged
    });

    it('should do nothing when currentTask is null', () => {
      useTaskStore.getState().updateCurrentTask({ title: 'Nope' });
      expect(useTaskStore.getState().currentTask).toBeNull();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Filters & UI Actions ────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('Filters & UI Actions', () => {
  describe('setFilters', () => {
    it('should merge partial filter updates', () => {
      const initial = useTaskStore.getState().filters;
      expect(initial.search).toBe('');

      useTaskStore.getState().setFilters({ search: 'test query', priority: 'high' });
      const { filters } = useTaskStore.getState();
      expect(filters.search).toBe('test query');
      expect(filters.priority).toBe('high');
      expect(filters.status).toBe(''); // Unchanged
    });

    it('should keep filters that are not in the partial', () => {
      useTaskStore.getState().setFilters({ status: 'open' });
      const { filters } = useTaskStore.getState();
      expect(filters.status).toBe('open');
      expect(filters.search).toBe('');
      expect(filters.priority).toBe('');
    });
  });

  describe('resetFilters', () => {
    it('should reset all filters to defaults', () => {
      useTaskStore.getState().setFilters({ search: 'test', status: 'open', priority: 'high' });
      useTaskStore.getState().resetFilters();
      expect(useTaskStore.getState().filters).toEqual(defaultFilters);
    });
  });

  describe('setView', () => {
    it('should set view to board and reset page to 0', () => {
      useTaskStore.setState({ ui: { ...useTaskStore.getState().ui, page: 3 } });
      useTaskStore.getState().setView('board');
      const { ui } = useTaskStore.getState();
      expect(ui.view).toBe('board');
      expect(ui.page).toBe(0);
    });

    it('should set view to list', () => {
      useTaskStore.getState().setView('list');
      expect(useTaskStore.getState().ui.view).toBe('list');
    });
  });

  describe('setPage', () => {
    it('should set the page number', () => {
      useTaskStore.getState().setPage(5);
      expect(useTaskStore.getState().ui.page).toBe(5);
    });

    it('should set page to 0', () => {
      useTaskStore.setState({ ui: { ...useTaskStore.getState().ui, page: 10 } });
      useTaskStore.getState().setPage(0);
      expect(useTaskStore.getState().ui.page).toBe(0);
    });
  });

  describe('toggleSelect', () => {
    it('should add a task ID when not selected', () => {
      useTaskStore.getState().toggleSelect('task-1');
      expect(useTaskStore.getState().ui.selectedIds.has('task-1')).toBe(true);
      expect(useTaskStore.getState().ui.selectedIds.size).toBe(1);
    });

    it('should remove a task ID when already selected', () => {
      const ids = new Set(['task-1', 'task-2']);
      useTaskStore.setState({ ui: { ...useTaskStore.getState().ui, selectedIds: ids } });
      useTaskStore.getState().toggleSelect('task-1');
      expect(useTaskStore.getState().ui.selectedIds.has('task-1')).toBe(false);
      expect(useTaskStore.getState().ui.selectedIds.has('task-2')).toBe(true);
      expect(useTaskStore.getState().ui.selectedIds.size).toBe(1);
    });

    it('should toggle multiple IDs independently', () => {
      useTaskStore.getState().toggleSelect('a');
      useTaskStore.getState().toggleSelect('b');
      useTaskStore.getState().toggleSelect('a'); // Toggle off
      expect(useTaskStore.getState().ui.selectedIds.has('a')).toBe(false);
      expect(useTaskStore.getState().ui.selectedIds.has('b')).toBe(true);
      expect(useTaskStore.getState().ui.selectedIds.size).toBe(1);
    });

    it('should handle an empty initial set', () => {
      useTaskStore.getState().toggleSelect('task-1');
      expect(useTaskStore.getState().ui.selectedIds.size).toBe(1);
    });
  });

  describe('selectAll', () => {
    it('should select all task IDs', () => {
      useTaskStore.setState({ tasks: [mockTask, mockTask2] });
      useTaskStore.getState().selectAll();
      const selected = useTaskStore.getState().ui.selectedIds;
      expect(selected.has('task-1')).toBe(true);
      expect(selected.has('task-2')).toBe(true);
      expect(selected.size).toBe(2);
    });

    it('should work with empty task list', () => {
      useTaskStore.getState().selectAll();
      expect(useTaskStore.getState().ui.selectedIds.size).toBe(0);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selected IDs and reset selection mode', () => {
      const ids = new Set(['task-1', 'task-2']);
      useTaskStore.setState({
        tasks: [mockTask],
        ui: {
          view: 'list',
          page: 0,
          pageSize: 25,
          selectedIds: ids,
          allSelectedMode: true,
          allMatchingIds: ['task-1', 'task-2'],
          showFilters: true,
        },
      });
      useTaskStore.getState().clearSelection();
      const { ui } = useTaskStore.getState();
      expect(ui.selectedIds.size).toBe(0);
      expect(ui.allSelectedMode).toBe(false);
      expect(ui.allMatchingIds).toEqual([]);
      expect(ui.showFilters).toBe(true); // Unchanged
    });
  });

  describe('setShowFilters', () => {
    it('should toggle filters visibility', () => {
      useTaskStore.getState().setShowFilters(true);
      expect(useTaskStore.getState().ui.showFilters).toBe(true);
      useTaskStore.getState().setShowFilters(false);
      expect(useTaskStore.getState().ui.showFilters).toBe(false);
    });
  });

  describe('filter + UI interaction', () => {
    it('setFilters should not affect UI state', () => {
      useTaskStore.getState().setFilters({ search: 'hello' });
      expect(useTaskStore.getState().ui.view).toBe('list'); // Unchanged
      expect(useTaskStore.getState().ui.page).toBe(0);
    });

    it('setView should not affect filters', () => {
      useTaskStore.getState().setFilters({ status: 'open' });
      useTaskStore.getState().setView('board');
      expect(useTaskStore.getState().filters.status).toBe('open'); // Unchanged
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// ─── Initial State ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

describe('Initial State', () => {
  it('should have default filters', () => {
    const state = useTaskStore.getState();
    expect(state.filters).toEqual(defaultFilters);
  });

  it('should have empty arrays', () => {
    const state = useTaskStore.getState();
    expect(state.tasks).toEqual([]);
    expect(state.comments).toEqual([]);
    expect(state.attachments).toEqual([]);
    expect(state.timeEntries).toEqual([]);
    expect(state.blockedBy).toEqual([]);
    expect(state.blocking).toEqual([]);
    expect(state.checklistItems).toEqual([]);
  });

  it('should have null currentTask', () => {
    expect(useTaskStore.getState().currentTask).toBeNull();
  });

  it('should have default UI state', () => {
    const { ui } = useTaskStore.getState();
    expect(ui.view).toBe('list');
    expect(ui.page).toBe(0);
    expect(ui.pageSize).toBe(25);
    expect(ui.selectedIds.size).toBe(0);
    expect(ui.allSelectedMode).toBe(false);
    expect(ui.showFilters).toBe(false);
  });
});
