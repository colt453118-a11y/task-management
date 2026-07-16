'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronRight as ArrowRight } from 'lucide-react';

type Task = { id: string; title: string; dueDate: string | null; status: string; priority: string };

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const statusColors: Record<string, string> = {
  draft: '#6b7280',
  open: '#60a5fa',
  in_progress: '#fbbf24',
  blocked: '#f87171',
  under_review: '#22d3ee',
  completed: '#34d399',
  closed: '#818cf8',
  cancelled: '#9ca3af',
};

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const tasksByDate: Record<string, Task[]> = {};
  tasks.forEach((t) => {
    if (t.dueDate) {
      const key = new Date(t.dueDate).toDateString();
      if (!tasksByDate[key]) tasksByDate[key] = [];
      tasksByDate[key].push(t);
    }
  });

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="space-y-1">
          <div className="shimmer h-8 w-32 rounded-xl" />
          <div className="shimmer mt-2 h-4 w-48 rounded-lg" />
        </div>
        <div className="border-surface-300/20 bg-surface-100/80 rounded-2xl border p-5">
          <div className="shimmer h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-surface-900 text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="text-surface-500 mt-1 text-sm">Task deadlines and milestones</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={prevMonth}
                className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-xl p-2 transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Button variant="outline" size="sm" onClick={goToday}>
                Today
              </Button>
              <button
                onClick={nextMonth}
                className="text-surface-500 hover:bg-surface-200/70 hover:text-surface-600 rounded-xl p-2 transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-surface-900 text-base font-semibold">
              {MONTHS[month]} {year}
            </h2>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {DAYS.map((d) => (
              <div key={d} className="text-surface-500 py-2 text-center text-xs font-medium">
                {d}
              </div>
            ))}
          </div>

          <div className="border-surface-300/20 dark:border-surface-700/30 grid grid-cols-7 border-l border-t">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="border-surface-300/20 dark:border-surface-700/30 bg-surface-50/30 dark:bg-surface-950/30 min-h-[100px] border-b border-r p-1"
              />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const date = new Date(year, month, day);
              const isToday = date.getTime() === today.getTime();
              const dateKey = date.toDateString();
              const dayTasks = tasksByDate[dateKey] ?? [];

              return (
                <div
                  key={day}
                  className={`border-surface-300/20 dark:border-surface-700/30 hover:bg-surface-200/30 dark:hover:bg-surface-800/30 min-h-[100px] border-b border-r p-1.5 transition-all duration-150 ${isToday ? 'bg-brand-500/5 dark:bg-brand-500/10' : ''}`}
                >
                  <p
                    className={`mb-1 text-xs font-medium ${isToday ? 'text-brand-500 font-bold' : 'text-surface-500'}`}
                  >
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTask(selectedTask?.id === t.id ? null : t)}
                        className="flex w-full items-center gap-1 rounded-lg px-1.5 py-0.5 text-left transition-all hover:opacity-80"
                        style={{ backgroundColor: `${statusColors[t.status] ?? '#6b7280'}20` }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: statusColors[t.status] ?? '#6b7280' }}
                        />
                        <span className="text-surface-700 dark:text-surface-300 truncate text-[10px] leading-tight">
                          {t.title}
                        </span>
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-surface-500 px-1 text-[10px]">
                        +{dayTasks.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Task popover */}
      {selectedTask && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-surface-300/20 bg-surface-50/95 dark:bg-surface-900/95 dark:border-surface-700/30 rounded-2xl border p-4 shadow-lg backdrop-blur-xl"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-surface-900 text-sm font-semibold">{selectedTask.title}</h3>
              <div className="mt-1.5 flex items-center gap-2">
                <Badge variant="primary" size="sm">
                  {selectedTask.status.replace(/_/g, ' ')}
                </Badge>
                <span className="text-surface-500 text-xs capitalize">
                  {selectedTask.priority} priority
                </span>
                {selectedTask.dueDate && (
                  <span className="text-surface-500 text-xs">
                    Due: {new Date(selectedTask.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => (window.location.href = `/tasks/${selectedTask.id}`)}
                >
                  View Task
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
