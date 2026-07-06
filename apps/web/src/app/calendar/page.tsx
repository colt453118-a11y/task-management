'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

type Task = { id: string; title: string; dueDate: string | null; status: string; priority: string };



const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

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
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Calendar</h1>
          <p className="text-sm text-surface-500 mt-1">Task deadlines and milestones</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth} className="rounded-md p-2 hover:bg-surface-100">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold">{MONTHS[month]} {year}</h2>
            <button onClick={nextMonth} className="rounded-md p-2 hover:bg-surface-100">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-surface-400">{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 border-t border-l border-surface-200 dark:border-surface-700">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="border-r border-b border-surface-200 dark:border-surface-700 min-h-[90px] p-1 bg-surface-50/50 dark:bg-surface-900/50" />
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
                  className={`border-r border-b border-surface-200 dark:border-surface-700 min-h-[90px] p-1 transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/50 ${isToday ? 'bg-brand-50 dark:bg-brand-950/30' : ''}`}
                >
                  <p className={`text-xs font-medium mb-1 ${isToday ? 'text-brand-600' : 'text-surface-500'}`}>
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 rounded bg-brand-100 px-1.5 py-0.5 dark:bg-brand-900/50"
                      >
                        <span className="text-[10px] leading-tight truncate text-brand-700 dark:text-brand-300">
                          {t.title}
                        </span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <p className="text-[10px] text-surface-400 px-1">+{dayTasks.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
