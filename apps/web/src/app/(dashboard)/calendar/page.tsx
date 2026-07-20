'use client';

import { useEffect, useState, useCallback, useMemo, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRight,
  Calendar as CalendarIcon,
  ChevronDown,
  Plus,
  Diamond,
  Flag,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────

type Task = {
  id: string;
  title: string;
  dueDate: string | null;
  status: string;
  priority: string;
};

type Milestone = {
  id: string;
  projectId: string;
  projectName: string;
  name: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  completedDate: string | null;
};

type ViewMode = 'month' | 'week';

// ─── Constants ──────────────────────────────────────────────

const MILESTONE_COLORS = [
  '#8b5cf6',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#14b8a6',
  '#f97316',
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  draft:       { label: 'Draft',       color: '#6b7280', dot: 'bg-gray-500' },
  open:        { label: 'Open',        color: '#60a5fa', dot: 'bg-blue-400' },
  in_progress: { label: 'In Progress', color: '#fbbf24', dot: 'bg-amber-400' },
  blocked:     { label: 'Blocked',     color: '#f87171', dot: 'bg-red-400' },
  under_review:{ label: 'Under Review',color: '#22d3ee', dot: 'bg-cyan-400' },
  on_hold:     { label: 'On Hold',     color: '#a78bfa', dot: 'bg-violet-400' },
  completed:   { label: 'Completed',   color: '#34d399', dot: 'bg-emerald-400' },
  closed:      { label: 'Closed',      color: '#818cf8', dot: 'bg-indigo-400' },
  cancelled:   { label: 'Cancelled',   color: '#9ca3af', dot: 'bg-gray-400' },
  archived:    { label: 'Archived',    color: '#6b7280', dot: 'bg-gray-500' },
};

const milestoneStatusConfig: Record<string, { label: string; color: string }> = {
  pending:    { label: 'Pending',    color: '#9ca3af' },
  in_progress:{ label: 'In Progress',color: '#f59e0b' },
  completed:  { label: 'Completed',  color: '#34d399' },
  cancelled:  { label: 'Cancelled',  color: '#6b7280' },
};

const priorityConfig: Record<string, { label: string; ring: string }> = {
  none:     { label: 'None',    ring: 'ring-gray-400' },
  low:      { label: 'Low',     ring: 'ring-emerald-500' },
  medium:   { label: 'Medium',  ring: 'ring-amber-500' },
  high:     { label: 'High',    ring: 'ring-orange-500' },
  urgent:   { label: 'Urgent',  ring: 'ring-red-500' },
  critical: { label: 'Critical',ring: 'ring-red-600' },
};

// ─── Helpers ────────────────────────────────────────────────

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getWeekDays(date: Date): Date[] {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getMonthStartEnd(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return { firstDay, daysInMonth };
}

function getMilestoneColor(_milestone: Milestone, index: number): string {
  return MILESTONE_COLORS[index % MILESTONE_COLORS.length]!;
}

// ─── Animation Variants ─────────────────────────────────────

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 120 : -120,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 120 : -120,
    opacity: 0,
  }),
};

const popoverVariants = {
  hidden: { opacity: 0, scale: 0.95, y: -4 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24 },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -4,
    transition: { duration: 0.12 },
  },
};

// ─── Task Badge & Popover ───────────────────────────────────

function TaskBadge({ task }: { task: Task }) {
  const config = statusConfig[task.status] ?? statusConfig.draft!;
  const priority = priorityConfig[task.priority] ?? priorityConfig.none!;
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-all hover:opacity-80"
      style={{ backgroundColor: `${config.color}18` }}
    >
      <span
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', priority.ring)}
        style={{ backgroundColor: config.color }}
      />
      <span className="text-surface-700 dark:text-surface-300 truncate max-w-[120px]">
        {task.title}
      </span>
    </span>
  );
}

function MilestoneBadge({ milestone, index }: { milestone: Milestone; index: number }) {
  const color = getMilestoneColor(milestone, index);
  return (
    <span
      className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium leading-tight transition-all hover:opacity-80"
      style={{ backgroundColor: `${color}15` }}
    >
      <Diamond className="h-2.5 w-2.5 shrink-0" style={{ color }} />
      <span className="text-surface-700 dark:text-surface-300 truncate max-w-[120px]">
        {milestone.name}
      </span>
    </span>
  );
}

function TaskPopoverContent({ task, onClose }: { task: Task; onClose: () => void }) {
  const status = statusConfig[task.status] ?? statusConfig.draft!;
  const priority = priorityConfig[task.priority] ?? priorityConfig.none!;

  return (
    <motion.div
      variants={popoverVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-72"
    >
      <div
        className="absolute left-0 right-0 top-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: status.color }}
      />
      <div className="pt-3">
        <h4 className="text-surface-900 dark:text-surface-100 line-clamp-2 text-sm font-semibold leading-snug">
          {task.title}
        </h4>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={
              task.status === 'completed' || task.status === 'closed'
                ? 'success'
                : task.status === 'blocked'
                  ? 'danger'
                  : task.status === 'in_progress'
                    ? 'warning'
                    : 'default'
            }
            className="px-1.5 py-0 text-[10px]"
          >
            {status.label}
          </Badge>
          <span
            className={cn(
              'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              task.priority === 'critical' || task.priority === 'urgent'
                ? 'bg-red-500/10 text-red-500'
                : task.priority === 'high'
                  ? 'bg-orange-500/10 text-orange-500'
                  : task.priority === 'medium'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-surface-200/50 text-surface-500 dark:bg-surface-800/50',
            )}
          >
            {priority.label}
          </span>
        </div>
        {task.dueDate && (
          <div className="text-surface-500 mt-2 flex items-center gap-1.5 text-[11px]">
            <CalendarIcon className="h-3 w-3" />
            {new Date(task.dueDate).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <Link href={`/tasks/${task.id}`}>
            <Button size="sm" className="h-7 rounded-lg px-2.5 text-xs">
              View Task
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

function MilestonePopoverContent({ milestone, index, onClose }: { milestone: Milestone; index: number; onClose: () => void }) {
  const color = getMilestoneColor(milestone, index);
  const status = milestoneStatusConfig[milestone.status] ?? milestoneStatusConfig.pending!;

  return (
    <motion.div
      variants={popoverVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="w-72"
    >
      <div
        className="absolute left-0 right-0 top-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: color }}
      />
      <div className="pt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-surface-500 mb-1">
          <Flag className="h-3 w-3" />
          <span>Milestone</span>
          <span className="text-surface-300 dark:text-surface-600">·</span>
          <span className="truncate">{milestone.projectName}</span>
        </div>
        <h4 className="text-surface-900 dark:text-surface-100 line-clamp-2 text-sm font-semibold leading-snug">
          {milestone.name}
        </h4>
        {milestone.description && (
          <p className="text-surface-500 mt-1.5 line-clamp-3 text-xs leading-relaxed">
            {milestone.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant={
              milestone.status === 'completed'
                ? 'success'
                : milestone.status === 'in_progress'
                  ? 'warning'
                  : 'default'
            }
            className="px-1.5 py-0 text-[10px]"
          >
            {status.label}
          </Badge>
          {milestone.dueDate && (
            <span className="text-surface-500 flex items-center gap-1 text-[11px]">
              <CalendarIcon className="h-3 w-3" />
              {new Date(milestone.dueDate).toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Link href={`/projects/${milestone.projectId}`}>
            <Button size="sm" className="h-7 rounded-lg px-2.5 text-xs">
              View Project
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 rounded-lg px-2 text-xs"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Month Picker ───────────────────────────────────────────

function MonthPicker({
  year,
  month,
  onSelect,
  onClose,
}: {
  year: number;
  month: number;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const [selectedYear, setSelectedYear] = useState(year);

  return (
    <div className="w-56 p-2">
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={() => setSelectedYear((y) => y - 1)}
          className="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg p-1 transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-surface-700 dark:text-surface-300 text-sm font-semibold">
          {selectedYear}
        </span>
        <button
          onClick={() => setSelectedYear((y) => y + 1)}
          className="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 rounded-lg p-1 transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {MONTHS_SHORT.map((m, i) => {
          const isSelected = selectedYear === year && i === month;
          return (
            <button
              key={m}
              onClick={() => {
                onSelect(selectedYear, i);
                onClose();
              }}
              className={cn(
                'rounded-lg px-2 py-1.5 text-xs font-medium transition-all',
                isSelected
                  ? 'bg-brand-500 text-white'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-200/70 dark:hover:bg-surface-700/50 hover:text-surface-900 dark:hover:text-surface-200',
              )}
            >
              {m}
            </button>
          );
        })}
      </div>
      <button
        onClick={() => {
          const now = new Date();
          onSelect(now.getFullYear(), now.getMonth());
          onClose();
        }}
        className="text-brand-500 hover:bg-brand-500/5 mt-2 w-full rounded-lg px-2 py-1.5 text-xs font-medium transition-colors"
      >
        Go to today
      </button>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="border-surface-300/20 bg-surface-100/50 dark:bg-surface-800/30 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border">
        <CalendarIcon className="text-surface-400 h-7 w-7" />
      </div>
      <h3 className="text-surface-900 dark:text-surface-100 text-base font-semibold">
        No tasks or milestones with dates
      </h3>
      <p className="text-surface-500 mt-1.5 max-w-xs text-center text-sm">
        Tasks and milestones appear on the calendar when they have due dates assigned. Create a task or milestone to see it here.
      </p>
      <div className="mt-5 flex items-center gap-2">
        <Link href="/tasks/new">
          <Button className="h-8 rounded-xl px-3 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" />
            New Task
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Views ──────────────────────────────────────────────────

function MonthView({
  year,
  month,
  today,
  tasksByDate,
  milestonesByDate,
}: {
  year: number;
  month: number;
  today: Date;
  tasksByDate: Map<string, Task[]>;
  milestonesByDate: Map<string, Milestone[]>;
}) {
  const { firstDay, daysInMonth } = getMonthStartEnd(year, month);

  return (
    <div className="border-surface-300/20 dark:border-surface-700/30 grid grid-cols-7 border-l border-t">
      {DAYS.map((d) => (
        <div
          key={d}
          className="border-surface-300/20 dark:border-surface-700/30 bg-surface-50/50 dark:bg-surface-950/50 border-b border-r px-1.5 py-2"
        >
          <span className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
            {d}
          </span>
        </div>
      ))}
      {Array.from({ length: firstDay }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="border-surface-300/20 dark:border-surface-700/30 bg-surface-50/30 dark:bg-surface-950/30 min-h-[100px] border-b border-r p-1"
        />
      ))}
      {Array.from({ length: daysInMonth }).map((_, i) => {
        const day = i + 1;
        const date = new Date(year, month, day);
        const isToday = isSameDay(date, today);
        const dateKey = date.toDateString();
        const dayTasks = tasksByDate.get(dateKey) ?? [];
        const dayMilestones = milestonesByDate.get(dateKey) ?? [];
        const totalItems = dayTasks.length + dayMilestones.length;

        return (
          <div
            key={day}
            className={cn(
              'border-surface-300/20 dark:border-surface-700/30 group min-h-[110px] border-b border-r p-1.5 transition-all duration-150',
              isToday
                ? 'bg-brand-500/5 dark:bg-brand-500/10'
                : 'hover:bg-surface-100/40 dark:hover:bg-surface-800/30',
            )}
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday
                    ? 'bg-brand-500 text-white text-[11px]'
                    : 'text-surface-500',
                )}
              >
                {day}
              </span>
              {totalItems > 0 && (
                <span className="text-surface-400 text-[9px] font-medium">
                  {totalItems}
                </span>
              )}
            </div>
            <div className="space-y-0.5">
              {/* Milestones first */}
              {dayMilestones.map((m, idx) => (
                <Popover key={m.id}>
                  <PopoverTrigger asChild>
                    <button className="w-full text-left">
                      <MilestoneBadge milestone={m} index={idx} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={8}
                    className="overflow-visible border-0 bg-transparent p-0 shadow-none"
                  >
                    <MilestonePopoverContent
                      milestone={m}
                      index={idx}
                      onClose={() => {}}
                    />
                  </PopoverContent>
                </Popover>
              ))}
              {/* Tasks after milestones */}
              {(() => {
                const maxSlots = 3 - dayMilestones.length;
                const visibleTasks = dayTasks.slice(0, Math.max(0, maxSlots));
                const remaining = dayTasks.length - Math.max(0, maxSlots);
                return (
                  <>
                    {visibleTasks.map((t) => (
                      <Popover key={t.id}>
                        <PopoverTrigger asChild>
                          <button className="w-full text-left">
                            <TaskBadge task={t} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          side="right"
                          align="start"
                          sideOffset={8}
                          className="overflow-visible border-0 bg-transparent p-0 shadow-none"
                        >
                          <TaskPopoverContent
                            task={t}
                            onClose={() => {}}
                          />
                        </PopoverContent>
                      </Popover>
                    ))}
                    {remaining > 0 && (
                      <p className="text-surface-400 px-1 text-[9px] font-medium">
                        +{remaining} more
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeekView({
  weekDays,
  today,
  tasksByDate,
  milestonesByDate,
}: {
  weekDays: Date[];
  today: Date;
  tasksByDate: Map<string, Task[]>;
  milestonesByDate: Map<string, Milestone[]>;
}) {
  const maxItemsPerDay = useMemo(() => {
    let max = 0;
    weekDays.forEach((d) => {
      const key = d.toDateString();
      const tasks = tasksByDate.get(key) ?? [];
      const milestones = milestonesByDate.get(key) ?? [];
      max = Math.max(max, tasks.length + milestones.length);
    });
    return max;
  }, [weekDays, tasksByDate, milestonesByDate]);

  return (
    <div className="border-surface-300/20 dark:border-surface-700/30 grid grid-cols-7 border-l border-t">
      {weekDays.map((d, i) => {
        const isToday = isSameDay(d, today);
        return (
          <div
            key={i}
            className={cn(
              'border-surface-300/20 dark:border-surface-700/30 border-b border-r px-2 py-2.5',
              isToday ? 'bg-brand-500/5' : 'bg-surface-50/50 dark:bg-surface-950/50',
            )}
          >
            <div className="flex flex-col items-center">
              <span className="text-surface-500 text-[10px] font-semibold uppercase tracking-wider">
                {DAYS[i]}
              </span>
              <span
                className={cn(
                  'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                  isToday
                    ? 'bg-brand-500 text-white'
                    : 'text-surface-700 dark:text-surface-300',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          </div>
        );
      })}
      {Array.from({ length: Math.max(1, Math.min(maxItemsPerDay, 6)) }).map(
        (_, rowIdx) => (
          <Fragment key={rowIdx}>
            {weekDays.map((d, dayIdx) => {
              const key = d.toDateString();
              const tasks = tasksByDate.get(key) ?? [];
              const milestones = milestonesByDate.get(key) ?? [];
              const allItems = [...milestones, ...tasks];
              const item = allItems[rowIdx];
              return (
                <div
                  key={`${rowIdx}-${dayIdx}`}
                  className={cn(
                    'border-surface-300/20 dark:border-surface-700/30 min-h-[52px] border-b border-r p-1',
                    isSameDay(d, today)
                      ? 'bg-brand-500/[0.02]'
                      : 'hover:bg-surface-100/30 dark:hover:bg-surface-800/20',
                  )}
                >
                  {item && 'projectName' in item ? (
                    <Popover key={`ms-${rowIdx}-${dayIdx}-${item.id}`}>
                      <PopoverTrigger asChild>
                        <button className="w-full text-left">
                          <MilestoneBadge milestone={item as Milestone} index={rowIdx} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="overflow-visible border-0 bg-transparent p-0 shadow-none"
                      >
                        <MilestonePopoverContent
                          milestone={item as Milestone}
                          index={rowIdx}
                          onClose={() => {}}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : item ? (
                    <Popover key={`tk-${rowIdx}-${dayIdx}-${item.id}`}>
                      <PopoverTrigger asChild>
                        <button className="w-full text-left">
                          <TaskBadge task={item as Task} />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="overflow-visible border-0 bg-transparent p-0 shadow-none"
                      >
                        <TaskPopoverContent
                          task={item as Task}
                          onClose={() => {}}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ),
      )}
      {maxItemsPerDay === 0 && (
        <div className="col-span-7 flex items-center justify-center py-8">
          <p className="text-surface-400 text-xs">No items due this week</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [direction, setDirection] = useState(0);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/tasks').then((r) => r.json()),
      fetch('/api/milestones').then((r) => r.json()),
    ])
      .then(([tasksData, milestonesData]) => {
        setTasks(tasksData.tasks ?? []);
        setMilestones(milestonesData.milestones ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const navigate = useCallback(
    (dir: number) => {
      setDirection(dir);
      if (viewMode === 'month') {
        setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1));
      } else {
        setCurrentDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() + dir * 7);
          return d;
        });
      }
    },
    [viewMode],
  );

  const goToday = useCallback(() => {
    setDirection(0);
    setCurrentDate(new Date());
  }, []);

  const goToMonth = useCallback((y: number, m: number) => {
    setDirection(0);
    setCurrentDate(new Date(y, m, 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') navigate(-1);
      else if (e.key === 'ArrowRight') navigate(1);
      else if (e.key === 'T' || e.key === 't') goToday();
      else if (e.key === 'w' || e.key === 'W') setViewMode('week');
      else if (e.key === 'm' || e.key === 'M') setViewMode('month');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, goToday]);

  // Build date maps
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((t) => {
      if (t.dueDate) {
        const key = new Date(t.dueDate).toDateString();
        const existing = map.get(key) ?? [];
        existing.push(t);
        map.set(key, existing);
      }
    });
    return map;
  }, [tasks]);

  const milestonesByDate = useMemo(() => {
    const map = new Map<string, Milestone[]>();
    milestones.forEach((m) => {
      if (m.dueDate) {
        const key = new Date(m.dueDate).toDateString();
        const existing = map.get(key) ?? [];
        existing.push(m);
        map.set(key, existing);
      }
    });
    return map;
  }, [milestones]);

  const hasItemsOnCalendar = useMemo(
    () => tasks.some((t) => t.dueDate) || milestones.some((m) => m.dueDate),
    [tasks, milestones],
  );

  const milestoneCount = useMemo(
    () => milestones.filter((m) => m.dueDate).length,
    [milestones],
  );

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-32 rounded-xl" />
          <div className="shimmer mt-2 h-4 w-48 rounded-lg" />
        </div>
        <div className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-5">
          <div className="shimmer h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-surface-900 dark:text-surface-100 text-2xl font-bold tracking-tight">
            Calendar
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">
            Task deadlines and milestones
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            className="bg-surface-200/50 dark:bg-surface-800/50 flex items-center gap-0.5 rounded-xl p-0.5"
            role="tablist"
            aria-label="Calendar view mode"
          >
            <button
              role="tab"
              aria-selected={viewMode === 'month'}
              onClick={() => setViewMode('month')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === 'month'
                  ? 'bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
              )}
            >
              Month
            </button>
            <button
              role="tab"
              aria-selected={viewMode === 'week'}
              onClick={() => setViewMode('week')}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                viewMode === 'week'
                  ? 'bg-surface-50 dark:bg-surface-700 text-surface-900 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300',
              )}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          {/* Navigation bar */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigate(-1)}
                className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 dark:hover:bg-surface-700/50 dark:hover:text-surface-300 rounded-xl p-2 transition-all"
                aria-label={viewMode === 'month' ? 'Previous month' : 'Previous week'}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToday}
                className="h-8 rounded-lg px-2.5 text-xs"
              >
                Today
              </Button>
              <button
                onClick={() => navigate(1)}
                className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 dark:hover:bg-surface-700/50 dark:hover:text-surface-300 rounded-xl p-2 transition-all"
                aria-label={viewMode === 'month' ? 'Next month' : 'Next week'}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Month title with picker */}
            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <button className="text-surface-900 dark:text-surface-100 hover:bg-surface-200/50 dark:hover:bg-surface-700/50 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-base font-semibold transition-colors">
                  {viewMode === 'month' ? (
                    <>{MONTHS[month]} {year}</>
                  ) : (
                    <>
                      {MONTHS_SHORT[weekDays[0]!.getMonth()]} {weekDays[0]!.getDate()}
                      {' — '}
                      {MONTHS_SHORT[weekDays[6]!.getMonth()]} {weekDays[6]!.getDate()}, {weekDays[6]!.getFullYear()}
                    </>
                  )}
                  <ChevronDown className="text-surface-400 h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="bottom"
                align="center"
                sideOffset={6}
                className="w-auto border-0 bg-transparent p-0 shadow-none"
              >
                <MonthPicker
                  year={year}
                  month={month}
                  onSelect={goToMonth}
                  onClose={() => setMonthPickerOpen(false)}
                />
              </PopoverContent>
            </Popover>

            {/* Keyboard hints */}
            <div className="hidden items-center gap-2 md:flex">
              <kbd className="bg-surface-200/50 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400 rounded-md px-1.5 py-0.5 text-[10px] font-mono">←</kbd>
              <kbd className="bg-surface-200/50 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400 rounded-md px-1.5 py-0.5 text-[10px] font-mono">→</kbd>
              <span className="text-surface-400 text-[10px]">Navigate</span>
              <span className="text-surface-300 dark:text-surface-600 mx-1">·</span>
              <kbd className="bg-surface-200/50 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400 rounded-md px-1.5 py-0.5 text-[10px] font-mono">T</kbd>
              <span className="text-surface-400 text-[10px]">Today</span>
              <span className="text-surface-300 dark:text-surface-600 mx-1">·</span>
              <kbd className="bg-surface-200/50 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400 rounded-md px-1.5 py-0.5 text-[10px] font-mono">M</kbd>
              <span className="text-surface-400 text-[10px]">/</span>
              <kbd className="bg-surface-200/50 text-surface-500 dark:bg-surface-700/50 dark:text-surface-400 rounded-md px-1.5 py-0.5 text-[10px] font-mono">W</kbd>
              <span className="text-surface-400 text-[10px]">Views</span>
            </div>
          </div>

          {/* Calendar grid */}
          {!hasItemsOnCalendar ? (
            <EmptyState />
          ) : (
            <div className="overflow-hidden">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={
                    viewMode === 'month'
                      ? `month-${year}-${month}`
                      : `week-${weekDays[0]!.toDateString()}`
                  }
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    x: { type: 'spring', stiffness: 250, damping: 28 },
                    opacity: { duration: 0.15 },
                  }}
                >
                  {viewMode === 'month' ? (
                    <MonthView
                      year={year}
                      month={month}
                      today={today}
                      tasksByDate={tasksByDate}
                      milestonesByDate={milestonesByDate}
                    />
                  ) : (
                    <WeekView
                      weekDays={weekDays}
                      today={today}
                      tasksByDate={tasksByDate}
                      milestonesByDate={milestonesByDate}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {/* Legend */}
          {hasItemsOnCalendar && (
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-surface-300/10 dark:border-surface-700/30 pt-3">
              <span className="text-surface-500 text-[10px] font-medium uppercase tracking-wider">
                Status
              </span>
              {Object.entries(statusConfig).map(([key, config]) => (
                <span
                  key={key}
                  className="flex items-center gap-1.5 text-[10px] text-surface-500"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  {config.label}
                </span>
              ))}
              {milestoneCount > 0 && (
                <>
                  <span className="text-surface-300 dark:text-surface-600 text-[10px]">·</span>
                  <span className="flex items-center gap-1.5 text-[10px] text-violet-500 font-medium">
                    <Diamond className="h-2.5 w-2.5" />
                    {milestoneCount} milestone{milestoneCount !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
