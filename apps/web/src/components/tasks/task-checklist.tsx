'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Loader2, Plus, Trash2, Check, X, Edit3, GripVertical } from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  taskId: string;
  content: string;
  isChecked: boolean;
  checkedBy: string | null;
  checkedAt: string | null;
  sortOrder: number;
  createdAt: string;
}

interface TaskChecklistProps {
  taskId: string;
  taskStatus: string;
}

// ─── Sortable Item ──────────────────────────────────────────

interface SortableItemProps {
  item: ChecklistItem;
  isReadonly: boolean;
  updating: string | null;
  editingId: string | null;
  editContent: string;
  deleting: string | null;
  onToggle: (item: ChecklistItem) => void;
  onStartEdit: (item: ChecklistItem) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onEditContentChange: (content: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

function SortableChecklistItem({
  item,
  isReadonly,
  updating,
  editingId,
  editContent,
  deleting,
  onToggle,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onEditContentChange,
  onEditKeyDown,
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { item },
    disabled: isReadonly,
  });

  const style = transform
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 rounded-xl px-1.5 py-2 transition-all duration-150',
        item.isChecked
          ? 'bg-green-500/5 dark:bg-green-500/10'
          : 'hover:bg-surface-200/30 dark:hover:bg-surface-800/30',
        isDragging && 'opacity-30 shadow-none z-50',
      )}
    >
      {/* Drag handle */}
      {!isReadonly && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing rounded-lg p-0.5 text-surface-400 opacity-0 group-hover:opacity-100 hover:text-surface-600 hover:bg-surface-200/70 dark:hover:bg-surface-700/70 transition-all duration-150"
          title="Drag to reorder"
          tabIndex={-1}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Checkbox */}
      <Checkbox
        checked={item.isChecked}
        onCheckedChange={() => onToggle(item)}
        disabled={!!updating || isReadonly}
        className={cn(
          'h-4 w-4 shrink-0 transition-all duration-200',
          item.isChecked && 'border-green-500 bg-green-500 text-white',
        )}
      />

      {/* Spinner while updating */}
      {updating === item.id ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-surface-400" />
      ) : editingId === item.id ? (
        /* Edit mode */
        <div className="flex flex-1 items-center gap-1.5">
          <Input
            type="text"
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            onKeyDown={onEditKeyDown}
            autoFocus
            className="h-7 flex-1 rounded-lg border-surface-300/30 bg-surface-100/80 px-2 text-xs focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 dark:bg-surface-800/80"
          />
          <button
            onClick={onSaveEdit}
            disabled={!editContent.trim() || updating === item.id}
            className="rounded-lg p-1 text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-40"
          >
            {updating === item.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={onCancelEdit}
            className="rounded-lg p-1 text-surface-500 hover:bg-surface-200/70 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* Display mode */
        <>
          <span
            className={cn(
              'flex-1 text-sm leading-snug transition-all duration-200',
              item.isChecked
                ? 'text-surface-400 line-through dark:text-surface-500'
                : 'text-surface-700 dark:text-surface-300',
            )}
          >
            {item.content}
          </span>

          {/* Actions - visible on hover */}
          {!isReadonly && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onStartEdit(item)}
                className="rounded-lg p-1 text-surface-400 hover:text-surface-600 hover:bg-surface-200/70 dark:hover:bg-surface-700/70 transition-colors"
                title="Edit item"
              >
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onDelete(item.id)}
                disabled={deleting === item.id}
                className="rounded-lg p-1 text-surface-400 hover:text-error hover:bg-error/5 transition-colors disabled:opacity-40"
                title="Delete item"
              >
                {deleting === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────

export function TaskChecklist({ taskId, taskStatus }: TaskChecklistProps) {
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItemContent, setNewItemContent] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<ChecklistItem | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  const isReadonly = taskStatus === 'closed' || taskStatus === 'archived';

  const checkedCount = items.filter((i) => i.isChecked).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  // ── DnD Sensors ──────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  // ── Item IDs for sortable context ─────────────────────────

  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  // ── Fetch items ──────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ── Add item ──────────────────────────────────────────────

  const addItem = async () => {
    const content = newItemContent.trim();
    if (!content) return;

    setAdding(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to add item');
      const data = await res.json();
      setItems((prev) => [...prev, data.item]);
      setNewItemContent('');
    } catch (err) {
      console.error('Failed to add checklist item:', err);
    } finally {
      setAdding(false);
    }
  };

  // ── Toggle item ──────────────────────────────────────────

  const toggleItem = async (item: ChecklistItem) => {
    const newChecked = !item.isChecked;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isChecked: newChecked } : i)),
    );
    setUpdating(item.id);

    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist?itemId=${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isChecked: newChecked }),
      });
      if (!res.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isChecked: !newChecked } : i)),
        );
        throw new Error('Failed to toggle item');
      }
      const data = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? data.item : i)),
      );
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
    } finally {
      setUpdating(null);
    }
  };

  // ── Start editing ────────────────────────────────────────

  const startEdit = (item: ChecklistItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  // ── Save edit ────────────────────────────────────────────

  const saveEdit = async () => {
    const content = editContent.trim();
    if (!content || !editingId) return;

    setUpdating(editingId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist?itemId=${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to update item');
      const data = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === editingId ? data.item : i)),
      );
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      console.error('Failed to update checklist item:', err);
    } finally {
      setUpdating(null);
    }
  };

  // ── Cancel editing ────────────────────────────────────────

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // ── Delete item ───────────────────────────────────────────

  const deleteItem = async (itemId: string) => {
    setDeleting(itemId);
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist?itemId=${itemId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete item');
      setItems((prev) => prev.filter((i) => i.id !== itemId));
    } catch (err) {
      console.error('Failed to delete checklist item:', err);
    } finally {
      setDeleting(null);
    }
  };

  // ── Keyboard handler for new item input ─────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !adding) {
      e.preventDefault();
      addItem();
    }
  };

  // ── Keyboard handler for edit input ─────────────────────

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !updating) {
      e.preventDefault();
      saveEdit();
    }
    if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  // ── Drag handlers ─────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const item = items.find((i) => i.id === event.active.id);
    if (item) setActiveDragItem(item);
  }, [items]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic reorder
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    // Persist the new sort orders
    setIsReordering(true);
    try {
      await Promise.all(
        reordered.map((item, idx) =>
          fetch(`/api/tasks/${taskId}/checklist?itemId=${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sortOrder: idx }),
          }),
        ),
      );
    } catch (err) {
      console.error('Failed to persist reorder:', err);
      // Refetch on failure to restore correct order
      fetchItems();
    } finally {
      setIsReordering(false);
    }
  }, [items, taskId, fetchItems]);

  // ── Loading state ───────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-24 shimmer rounded-lg" />
        <div className="h-2 w-full shimmer rounded-full" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 shimmer rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* Header with progress */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-surface-500">
          {totalCount > 0
            ? `${checkedCount} of ${totalCount} done`
            : 'No items'}
        </span>
        {totalCount > 0 && (
          <span className="text-xs font-semibold text-surface-500 tabular-nums">
            {progress}%
          </span>
        )}
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <Progress
          value={progress}
          className={cn(
            'h-1.5 bg-surface-200/60 dark:bg-surface-700/60',
            progress === 100 ? '[&>div]:bg-green-500' : '[&>div]:bg-brand-500',
          )}
        />
      )}

      {/* Items list with drag-and-drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-0.5">
            <AnimatePresence initial={false}>
              {items.length === 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-surface-400 text-center py-3"
                >
                  No checklist items yet. Add one below.
                </motion.p>
              )}

              {items.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <SortableChecklistItem
                    item={item}
                    isReadonly={isReadonly}
                    updating={updating}
                    editingId={editingId}
                    editContent={editContent}
                    deleting={deleting}
                    onToggle={toggleItem}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onCancelEdit={cancelEdit}
                    onDelete={deleteItem}
                    onEditContentChange={setEditContent}
                    onEditKeyDown={handleEditKeyDown}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeDragItem ? (
            <div className="rounded-xl border border-brand-500/30 bg-surface-50/95 backdrop-blur-sm shadow-lg dark:bg-surface-900/95 px-1.5 py-2 flex items-center gap-1">
              <GripVertical className="h-3.5 w-3.5 text-brand-500" />
              <Checkbox
                checked={activeDragItem.isChecked}
                className="h-4 w-4 shrink-0"
              />
              <span className={cn(
                'flex-1 text-sm leading-snug',
                activeDragItem.isChecked
                  ? 'text-surface-400 line-through'
                  : 'text-surface-700 dark:text-surface-300',
              )}>
                {activeDragItem.content}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Saving indicator */}
      {isReordering && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-[10px] text-surface-400"
        >
          Saving order...
        </motion.p>
      )}

      {/* Add new item input */}
      {!isReadonly && (
        <div className="flex items-center gap-2 pt-1">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Add checklist item..."
              value={newItemContent}
              onChange={(e) => setNewItemContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 w-full rounded-lg border border-dashed border-surface-400/30 bg-transparent px-2.5 pr-8 text-xs placeholder:text-surface-400 transition-all duration-200 hover:border-surface-400/50 focus:border-brand-500 focus:border-solid focus:bg-surface-100/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:focus:bg-surface-800/50"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={addItem}
            disabled={!newItemContent.trim() || adding}
            className="h-8 w-8 rounded-lg p-0 shrink-0"
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      )}

      {/* Completion celebration */}
      {totalCount > 0 && checkedCount === totalCount && totalCount > 1 && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-xs font-medium text-green-500 pt-1"
        >
          ✓ All done!
        </motion.p>
      )}
    </div>
  );
}
