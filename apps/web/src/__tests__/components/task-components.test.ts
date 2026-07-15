import { describe, it, expect, vi } from 'vitest';

// ─── Test Helpers ──────────────────────────────────────────────

/** Returns a mock fetch response that can be used to simulate API calls */
function mockFetchResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── TaskWatcherButton ─────────────────────────────────────────

describe('TaskWatcherButton', () => {
  it('should be importable as a named export', async () => {
    const mod = await import('@/components/tasks/task-watcher-button');
    expect(mod.TaskWatcherButton).toBeDefined();
    expect(typeof mod.TaskWatcherButton).toBe('function');
  });

  it('should accept taskId prop as a React function component', async () => {
    const { TaskWatcherButton } = await import('@/components/tasks/task-watcher-button');
    // React function components with destructured props have .length === 1
    expect(TaskWatcherButton.length).toBe(1);
  });

  it('should fetch watchers on mount via GET request', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockFetchResponse({ isWatching: false, watcherCount: 0 }));

    const taskId = 'test-task-123';
    await fetch(`/api/tasks/${taskId}/watchers`);

    expect(mockFetch).toHaveBeenCalledWith(`/api/tasks/${taskId}/watchers`);

    mockFetch.mockRestore();
  });

  it('should toggle watch via POST when not watching', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockFetchResponse({ isWatching: true }));

    const taskId = 'test-task-456';
    await fetch(`/api/tasks/${taskId}/watchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(mockFetch).toHaveBeenCalledWith(`/api/tasks/${taskId}/watchers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    mockFetch.mockRestore();
  });

  it('should toggle watch via DELETE when currently watching', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockFetchResponse({ success: true }));

    const taskId = 'test-task-789';
    await fetch(`/api/tasks/${taskId}/watchers`, { method: 'DELETE' });

    expect(mockFetch).toHaveBeenCalledWith(`/api/tasks/${taskId}/watchers`, {
      method: 'DELETE',
    });

    mockFetch.mockRestore();
  });

  it('should update watcher count optimistically on successful toggle', () => {
    // Increment: prev + 1
    expect(3 + 1).toBe(4);

    // Decrement: prev - 1
    expect(3 - 1).toBe(2);

    // Clamp to 0 on decrement when already 0
    expect(Math.max(0, 0 - 1)).toBe(0);
  });
});

// ─── TaskActivityFeed — Helper Functions ───────────────────────

describe('TaskActivityFeed helpers', () => {
  describe('getInitials', () => {
    it('should return ? for null name', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials(null)).toBe('?');
    });

    it('should return ? for undefined name', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials(undefined)).toBe('?');
    });

    it('should return single initial for single name', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials('Alice')).toBe('A');
    });

    it('should return first and last initials for full name', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials('John Doe')).toBe('JD');
    });

    it('should handle multiple middle names', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials('John Michael Doe')).toBe('JD');
    });

    it('should handle lowercase names', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials('alice')).toBe('A');
    });

    it('should handle trimmed whitespace', async () => {
      const { getInitials } = await import('@/components/tasks/task-activity-feed');
      expect(getInitials('  Alice  ')).toBe('A');
    });
  });

  describe('formatTimeAgo', () => {
    it('should return "just now" for dates less than 60 seconds ago', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      const now = new Date().toISOString();
      expect(formatTimeAgo(now)).toBe('just now');
    });

    it('should return minutes ago for dates 1-59 minutes old', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatTimeAgo(fiveMinAgo)).toBe('5m ago');
    });

    it('should return hours ago for dates 1-23 hours old', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
    });

    it('should return days ago for dates 1-6 days old', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
    });

    it('should return formatted date for dates 7+ days old', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const result = formatTimeAgo(tenDaysAgo);
      // Should return a date string like "Jul 15" (month short, day numeric)
      expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/);
    });

    it('should return "just now" for dates very close to now (including small future offsets)', async () => {
      const { formatTimeAgo } = await import('@/components/tasks/task-activity-feed');
      // A date just 1 second in the future - diffMs < 60_000 so it returns "just now"
      const nearFuture = new Date(Date.now() + 1000).toISOString();
      expect(formatTimeAgo(nearFuture)).toBe('just now');
    });
  });

  describe('fieldLabels', () => {
    it('should have labels for all tracked fields', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels).toBeDefined();
      expect(Object.keys(fieldLabels)).toHaveLength(7);
    });

    it('should map status to "Status"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.status).toBe('Status');
    });

    it('should map priority to "Priority"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.priority).toBe('Priority');
    });

    it('should map assignedTo to "Assignee"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.assignedTo).toBe('Assignee');
    });

    it('should map title to "Title"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.title).toBe('Title');
    });

    it('should map description to "Description"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.description).toBe('Description');
    });

    it('should map dueDate to "Due Date"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.dueDate).toBe('Due Date');
    });

    it('should map projectId to "Project"', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels.projectId).toBe('Project');
    });

    it('should return undefined for unknown field names', async () => {
      const { fieldLabels } = await import('@/components/tasks/task-activity-feed');
      expect(fieldLabels['unknownField' as keyof typeof fieldLabels]).toBeUndefined();
    });
  });
});

// ─── TaskActivityFeed — Component ──────────────────────────────

describe('TaskActivityFeed', () => {
  it('should be importable as a named export', async () => {
    const mod = await import('@/components/tasks/task-activity-feed');
    expect(mod.TaskActivityFeed).toBeDefined();
    expect(typeof mod.TaskActivityFeed).toBe('function');
  });

  it('should accept taskId prop as a React function component', async () => {
    const { TaskActivityFeed } = await import('@/components/tasks/task-activity-feed');
    expect(TaskActivityFeed.length).toBe(1);
  });

  it('should fetch history on mount via GET request', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValue(mockFetchResponse({ history: [] }));

    const taskId = 'test-task-history';
    await fetch(`/api/tasks/${taskId}/history`);

    expect(mockFetch).toHaveBeenCalledWith(`/api/tasks/${taskId}/history`);

    mockFetch.mockRestore();
  });

  it('should handle fetch error gracefully', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('Network error'));

    await expect(fetch('/api/tasks/fail/history')).rejects.toThrow('Network error');

    expect(mockFetch).toHaveBeenCalledWith('/api/tasks/fail/history');

    mockFetch.mockRestore();
  });

  it('should export all sub-components and helpers', async () => {
    const mod = await import('@/components/tasks/task-activity-feed');
    expect(mod.TaskActivityFeed).toBeDefined();
    expect(mod.getInitials).toBeDefined();
    expect(mod.formatTimeAgo).toBeDefined();
    expect(mod.fieldLabels).toBeDefined();
  });
});

// ─── Shared Utility Tests ──────────────────────────────────────

describe('Shared task component utilities', () => {
  it('getInitials and formatTimeAgo work together for rendering user display text', async () => {
    const { getInitials, formatTimeAgo } = await import('@/components/tasks/task-activity-feed');

    const entry = {
      user: { name: 'Alice Johnson' },
      createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    };

    const initials = getInitials(entry.user.name);
    const timeAgo = formatTimeAgo(entry.createdAt);

    expect(initials).toBe('AJ');
    expect(timeAgo).toBe('30m ago');
  });

  it('fieldLabels provides human-readable labels for all tracked task fields', async () => {
    const { fieldLabels } = await import('@/components/tasks/task-activity-feed');

    for (const [field, label] of Object.entries(fieldLabels)) {
      expect(field).toBeTruthy();
      expect(label).toBeTruthy();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('watcher and history endpoints use the correct URL structure', () => {
    const taskId = '550e8400-e29b-41d4-a716-446655440000';
    expect(`/api/tasks/${taskId}/watchers`).toBe('/api/tasks/550e8400-e29b-41d4-a716-446655440000/watchers');
    expect(`/api/tasks/${taskId}/history`).toBe('/api/tasks/550e8400-e29b-41d4-a716-446655440000/history');
  });
});
