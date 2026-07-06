'use client';

import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Mock events
const events: Record<number, { title: string; type: 'task' | 'milestone' | 'meeting' }[]> = {
  5: [{ title: 'Sprint planning', type: 'meeting' }],
  8: [{ title: 'Design review', type: 'meeting' }],
  12: [{ title: 'API migration deadline', type: 'milestone' }],
  15: [{ title: 'Frontend deployment', type: 'task' }],
  18: [{ title: 'Team standup', type: 'meeting' }],
  22: [{ title: 'Release v2.1', type: 'milestone' }],
  28: [{ title: 'Security audit', type: 'task' }],
};

const typeColors = {
  task: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  milestone: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  meeting: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
};

export default function CalendarPage() {
  const [currentMonth] = useState('December 2025');
  // Mock: first day of month is Monday (index 1)
  const startDay = 1;
  const daysInMonth = 31;

  const days: (number | null)[] = [
    ...Array.from({ length: startDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold text-surface-900 dark:text-surface-50">Calendar</h1>
          <div className="flex items-center gap-1">
            <button className="rounded-md p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-surface-900 dark:text-surface-50">
              {currentMonth}
            </span>
            <button className="rounded-md p-1.5 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Event
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border border-surface-200 bg-white dark:border-surface-700 dark:bg-surface-900">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-surface-200 dark:border-surface-700">
          {daysOfWeek.map((day) => (
            <div key={day} className="px-3 py-2 text-center text-xs font-medium text-surface-500">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r border-surface-100 p-2 dark:border-surface-800 ${
                day ? 'bg-white dark:bg-surface-900' : 'bg-surface-50 dark:bg-surface-950'
              }`}
            >
              {day && (
                <>
                  <span className="text-sm font-medium text-surface-700 dark:text-surface-300">{day}</span>
                  <div className="mt-1 space-y-1">
                    {events[day]?.map((event, i) => (
                      <div
                        key={i}
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${typeColors[event.type]}`}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
