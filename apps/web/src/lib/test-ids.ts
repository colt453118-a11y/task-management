// ═══════════════════════════════════════════════════════════════
//  Dependency Graph Test IDs
//  Import these constants in both components and E2E tests
//  to prevent duplication and typos.
// ═══════════════════════════════════════════════════════════════

export const DEP_GRAPH = {
  /** Root container */
  root: 'dep-graph',
  /** Empty state container (no dependencies) */
  emptyState: 'dep-empty-state',
  /** "Add dependency" button in the empty state */
  addFromEmpty: 'dep-add-from-empty',

  // ── Header ─────────────────────────────────────────────
  /** View toggle container (Graph/List buttons) */
  viewToggle: 'dep-view-toggle',
  /** Graph view mode toggle button */
  toggleGraph: 'dep-toggle-graph',
  /** List view mode toggle button */
  toggleList: 'dep-toggle-list',
  /** Header "Add dependency" plus icon button */
  addBtn: 'dep-add-btn',
  /** Dependency count badge text */
  count: 'dep-count',

  // ── Graph View ─────────────────────────────────────────
  /** Graph view outer container */
  graphView: 'dep-graph-view',
  /** "Blocked by" upstream section */
  blockedBy: 'dep-blocked-by',
  /** "Blocking" downstream section */
  blocking: 'dep-blocking',
  /** Current task center node */
  currentTask: 'dep-current-task',

  // ── List View ──────────────────────────────────────────
  /** List view outer container */
  listView: 'dep-list-view',
  /** List view "Blocked by" section */
  listBlockedBy: 'dep-list-blocked-by',
  /** List view "Blocking" section */
  listBlocking: 'dep-list-blocking',

  // ── Add Dependency Dialog ──────────────────────────────
  /** Add dialog backdrop */
  addDialog: 'dep-add-dialog',
  /** Search input in add dialog */
  searchInput: 'dep-search-input',
  /** Search results container */
  searchResults: 'dep-search-results',
  /** Cancel button in add dialog */
  dialogCancel: 'dep-dialog-cancel',
  /** Error message in add dialog */
  addError: 'dep-add-error',

  // ── Dynamic Helpers ────────────────────────────────────
  /** Dependency item card (both GraphView and ListView) */
  item: (id: string) => `dep-item-${id}`,
  /** Remove dependency button (both GraphView and ListView) */
  remove: (id: string) => `dep-remove-${id}`,
  /** Search result item in add dialog */
  searchResult: (id: string) => `dep-search-result-${id}`,
} as const;

// ═══════════════════════════════════════════════════════════════
//  Kanban Board Test IDs
// ═══════════════════════════════════════════════════════════════

export const KANBAN = {
  /** The DndContext wrapper element */
  board: 'kanban-board',
  /** The flex container holding all columns */
  container: 'kanban-board-container',
  /** The DragOverlay showing a dragged card */
  dragOverlay: 'kanban-drag-overlay',

  // ── Dynamic Helpers ────────────────────────────────────
  /** Kanban column container (keyed by status, e.g. 'open', 'in_progress') */
  column: (status: string) => `kanban-column-${status}`,
  /** Kanban column header area */
  columnHeader: (status: string) => `kanban-column-header-${status}`,
  /** "Create task" button in column header */
  columnAddBtn: (status: string) => `kanban-column-add-${status}`,
  /** Empty state container in column */
  columnEmpty: (status: string) => `kanban-column-empty-${status}`,
  /** "Drop here" indicator shown when dragging over an empty column */
  dropHere: 'kanban-drop-here',
  /** Kanban card container (keyed by task id) */
  card: (id: string) => `kanban-card-${id}`,
  /** Kanban card title text */
  cardTitle: (id: string) => `kanban-card-title-${id}`,
} as const;

// ═══════════════════════════════════════════════════════════════
//  Task Checklist Test IDs
// ═══════════════════════════════════════════════════════════════

export const CHECKLIST = {
  /** Root container */
  root: 'checklist-root',
  /** Progress text ("X of Y done" or "No items") */
  progress: 'checklist-progress',
  /** Progress percentage text */
  percent: 'checklist-percent',
  /** Progress bar element */
  progressBar: 'checklist-progress-bar',
  /** Add item input field */
  addInput: 'checklist-add-input',
  /** Add item button */
  addBtn: 'checklist-add-btn',
  /** Items list container */
  items: 'checklist-items',
  /** Empty state message */
  empty: 'checklist-empty',
  /** Completion celebration ("All done!") */
  celebration: 'checklist-celebration',
  /** Drag overlay for reordering */
  dragOverlay: 'checklist-drag-overlay',

  // ── Dynamic Helpers ────────────────────────────────────
  /** Checklist item row container */
  item: (id: string) => `checklist-item-${id}`,
  /** Checklist item checkbox */
  checkbox: (id: string) => `checklist-checkbox-${id}`,
  /** Checklist item text (content) */
  text: (id: string) => `checklist-text-${id}`,
  /** Edit item button */
  editBtn: (id: string) => `checklist-edit-${id}`,
  /** Delete item button */
  deleteBtn: (id: string) => `checklist-delete-${id}`,
  /** Edit mode input field */
  editInput: (id: string) => `checklist-edit-input-${id}`,
  /** Save edit button */
  saveEditBtn: (id: string) => `checklist-save-edit-${id}`,
  /** Cancel edit button */
  cancelEditBtn: (id: string) => `checklist-cancel-edit-${id}`,
} as const;
