import { describe, it, expect } from 'vitest';
import { render } from '@react-email/components';
import {
  TaskAssignedEmail,
  TaskCommentEmail,
  TaskStatusChangedEmail,
  TaskCompletedEmail,
  TaskDeletedEmail,
  TaskMentionEmail,
  TaskDeadlineEmail,
  WelcomeEmail,
} from '@/lib/email/components';

// ─── Sample props shared across templates ─────────────────────

const SAMPLE_BASE_PROPS = {
  title: 'Design system migration — Q3 planning',
  message:
    'A new task has been assigned to you. Please review the requirements and start planning the migration.',
  link: 'https://app.workmanager.com/tasks/task-42',
  unsubscribeUrl: 'https://app.workmanager.com/settings/notifications',
};

// ─── Smoke test: each component renders without error ─────────

describe('Email Template Components', () => {
  it('TaskAssignedEmail renders with task title', async () => {
    const html = await render(<TaskAssignedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
    expect(html).toContain('View Task');
    expect(html).toContain('WorkManager');
    expect(html).toContain('Unsubscribe from notifications');
  });

  it('TaskCommentEmail renders with comment context', async () => {
    const html = await render(<TaskCommentEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
    expect(html).toContain('View Comment');
  });

  it('TaskStatusChangedEmail renders with status change context', async () => {
    const html = await render(<TaskStatusChangedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
    expect(html).toContain('View Task');
  });

  it('TaskCompletedEmail renders with checkmark icon', async () => {
    const html = await render(<TaskCompletedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
    expect(html).toContain('✓');
  });

  it('TaskDeletedEmail renders with deleted context', async () => {
    const html = await render(<TaskDeletedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
  });

  it('TaskMentionEmail renders with at-mention icon', async () => {
    const html = await render(<TaskMentionEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Design system migration');
    expect(html).toContain('@');
  });

  it('TaskDeadlineEmail renders with deadline context (due_soon)', async () => {
    const html = await render(
      <TaskDeadlineEmail
        {...SAMPLE_BASE_PROPS}
        deadlineType="due_soon"
        dueDate={new Date(Date.now() + 8 * 3600_000).toISOString()}
      />,
    );
    expect(html).toContain('Design system migration');
    expect(html).toContain('⏰');
    expect(html).toContain('View Task');
  });

  it('TaskDeadlineEmail renders with overdue/escalted warning icon for overdue and escalated types', async () => {
    // Overdue
    const overdueHtml = await render(
      <TaskDeadlineEmail
        {...SAMPLE_BASE_PROPS}
        deadlineType="overdue"
        dueDate={new Date().toISOString()}
      />,
    );
    expect(overdueHtml).toContain('⚠');
    expect(overdueHtml).toContain('View Overdue Task');

    // Escalated
    const escalatedHtml = await render(
      <TaskDeadlineEmail
        {...SAMPLE_BASE_PROPS}
        deadlineType="escalated"
        dueDate={new Date().toISOString()}
      />,
    );
    expect(escalatedHtml).toContain('⚠');
    expect(escalatedHtml).toContain('View Overdue Task');
  });

  it('WelcomeEmail renders welcome message with user name', async () => {
    const html = await render(
      <WelcomeEmail
        userName="Jane Cooper"
        unsubscribeUrl="https://app.workmanager.com/settings/notifications"
      />,
    );
    expect(html).toContain('Welcome to WorkManager');
    expect(html).toContain('Jane Cooper');
    expect(html).toContain('Get Started');
  });
});

// ─── Structural checks ────────────────────────────────────────

describe('Email Template structural consistency', () => {
  it('includes dark mode meta tags in the output', async () => {
    const html = await render(<TaskAssignedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('color-scheme');
    expect(html).toContain('supported-color-schemes');
  });

  it('includes an unsubscribe link in the output', async () => {
    const html = await render(<TaskAssignedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html).toContain('Unsubscribe from notifications');
  });

  it('renders to a valid HTML document (non-empty, proper tags)', async () => {
    const html = await render(<TaskAssignedEmail {...SAMPLE_BASE_PROPS} />);
    expect(html.length).toBeGreaterThan(500);
    // DOCTYPE may be strict HTML5 or XHTML-style (React Email uses XHTML)
    expect(html).toMatch(/^<!DOCTYPE html/i);
    expect(html).toContain('</html>');
  });
});

// ─── Cross-template brand consistency ───────────────────────

describe('Cross-template brand consistency', () => {
  it('all base template components share brand elements: WorkManager name + task title', async () => {
    const baseComponents = [
      TaskAssignedEmail,
      TaskCommentEmail,
      TaskStatusChangedEmail,
      TaskCompletedEmail,
      TaskDeletedEmail,
      TaskMentionEmail,
    ];

    for (const Component of baseComponents) {
      const html = await render(<Component {...SAMPLE_BASE_PROPS} />);
      expect(html).toContain('WorkManager');
      expect(html).toContain('Design system migration');
    }
  });

  it('TaskDeadlineEmail renders brand elements for all three deadline types', async () => {
    const deadlineTypes = ['due_soon', 'overdue', 'escalated'] as const;
    for (const deadlineType of deadlineTypes) {
      const html = await render(
        <TaskDeadlineEmail
          {...SAMPLE_BASE_PROPS}
          deadlineType={deadlineType}
          dueDate={new Date().toISOString()}
        />,
      );
      expect(html).toContain('WorkManager');
      expect(html).toContain('Design system migration');
    }
  });

  it('WelcomeEmail renders brand elements', async () => {
    const html = await render(
      <WelcomeEmail
        userName="Jane Cooper"
        unsubscribeUrl="https://app.workmanager.com/settings/notifications"
      />,
    );
    expect(html).toContain('WorkManager');
    expect(html).toContain('Welcome');
  });
});
