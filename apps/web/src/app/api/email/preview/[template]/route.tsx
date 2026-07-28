import { escapeHtml } from '@/lib/email/utils';
import { render } from '@react-email/components';
import { NextResponse } from 'next/server';
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

// ─── Sample data ──────────────────────────────────────────────

const SAMPLE_PROPS = {
  base: {
    title: 'Design system migration — Q3 planning',
    message:
      'A new task has been assigned to you. Please review the requirements and start planning the migration of our component library to the new design system.',
    link: 'https://app.workmanager.com/tasks/task-42',
    unsubscribeUrl: 'https://app.workmanager.com/settings/notifications',
  },
  deadline: {
    dueDate: new Date(Date.now() + 8 * 3600_000).toISOString(),
  },
};

// ─── Template registry ────────────────────────────────────────

interface TemplateInfo {
  name: string;
  subject: string;
  render: () => React.ReactElement;
}

const TEMPLATES: Record<string, TemplateInfo> = {
  'task-assigned': {
    name: 'Task Assigned',
    subject: "You've been assigned: Design system migration — Q3 planning",
    render: () => <TaskAssignedEmail {...SAMPLE_PROPS.base} />,
  },
  'task-comment': {
    name: 'Task Comment',
    subject: 'New comment on: Design system migration — Q3 planning',
    render: () => <TaskCommentEmail {...SAMPLE_PROPS.base} />,
  },
  'task-status-changed': {
    name: 'Task Status Changed',
    subject: 'Task status changed: Design system migration — Q3 planning',
    render: () => <TaskStatusChangedEmail {...SAMPLE_PROPS.base} />,
  },
  'task-completed': {
    name: 'Task Completed',
    subject: '✓ Task completed: Design system migration — Q3 planning',
    render: () => <TaskCompletedEmail {...SAMPLE_PROPS.base} />,
  },
  'task-closed': {
    name: 'Task Closed',
    subject: 'Task closed: Design system migration — Q3 planning',
    render: () => <TaskDeletedEmail {...SAMPLE_PROPS.base} />,
  },
  'task-reopened': {
    name: 'Task Reopened',
    subject: 'Task reopened: Design system migration — Q3 planning',
    render: () => <TaskStatusChangedEmail {...SAMPLE_PROPS.base} />,
  },
  'task-mention': {
    name: 'Task Mention',
    subject: 'You were mentioned in: Design system migration — Q3 planning',
    render: () => <TaskMentionEmail {...SAMPLE_PROPS.base} />,
  },
  'task-due-soon': {
    name: 'Task Due Soon',
    subject: '⏰ Due soon: Design system migration — Q3 planning',
    render: () => (
      <TaskDeadlineEmail
        {...SAMPLE_PROPS.base}
        deadlineType="due_soon"
        dueDate={SAMPLE_PROPS.deadline.dueDate}
      />
    ),
  },
  'task-overdue': {
    name: 'Task Overdue',
    subject: '⚠ Overdue: Design system migration — Q3 planning',
    render: () => (
      <TaskDeadlineEmail
        {...SAMPLE_PROPS.base}
        deadlineType="overdue"
        dueDate={SAMPLE_PROPS.deadline.dueDate}
      />
    ),
  },
  'task-escalated': {
    name: 'Task Escalated',
    subject: '🚨 Escalated: Design system migration — Q3 planning',
    render: () => (
      <TaskDeadlineEmail
        {...SAMPLE_PROPS.base}
        deadlineType="escalated"
        dueDate={SAMPLE_PROPS.deadline.dueDate}
      />
    ),
  },
  welcome: {
    name: 'Welcome',
    subject: 'Welcome to WorkManager, Jane!',
    render: () => (
      <WelcomeEmail
        userName="Jane Cooper"
        unsubscribeUrl="https://app.workmanager.com/settings/notifications"
      />
    ),
  },
};

// ─── Route handler ────────────────────────────────────────────

interface RouteParams {
  params: Promise<{ template: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { template: slug } = await params;
  const tmpl = TEMPLATES[slug];

  if (!tmpl) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Template not found</title></head>
<body style="font-family:sans-serif;padding:40px;background:#f5f5f4;">
  <h1 style="font-size:20px;color:#0c0a09;">Template not found</h1>
  <p style="color:#78716c;">No template matches "${slug}".</p>
  <a href="/api/email/preview" style="color:#6366f1;">← Back to all templates</a>
</body>
</html>`;
    return new NextResponse(html, {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const emailHtml = await render(tmpl.render());

  const wrapperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview: ${tmpl.name} — WorkManager</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f4;
      color: #0c0a09;
      min-height: 100vh;
    }
    .toolbar {
      background: #ffffff;
      border-bottom: 1px solid #e7e5e4;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .toolbar-left { display: flex; align-items: center; gap: 12px; }
    .toolbar-name { font-size: 14px; font-weight: 600; }
    .toolbar-subject { font-size: 12px; color: #78716c; }
    .toolbar-actions { display: flex; align-items: center; gap: 8px; }
    .toolbar a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      text-decoration: none;
      transition: background 0.15s;
    }
    .btn-back { color: #6366f1; }
    .btn-back:hover { background: #eef2ff; }
    .btn-download {
      background: #6366f1;
      color: #ffffff;
      border: none;
      cursor: pointer;
    }
    .btn-download:hover { background: #4f46e5; }
    .btn-raw { color: #78716c; }
    .btn-raw:hover { background: #f5f5f4; }
    .info-bar {
      background: #fffbeb;
      border-bottom: 1px solid #fde68a;
      padding: 8px 24px;
      font-size: 12px;
      color: #92400e;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .email-iframe-container {
      max-width: 660px;
      margin: 24px auto;
      background: #ffffff;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
      overflow: hidden;
    }
    .email-iframe-container iframe {
      width: 100%;
      border: none;
      display: block;
    }
    .raw-html-panel {
      display: none;
      max-width: 860px;
      margin: 24px auto;
      background: #1c1917;
      border-radius: 12px;
      overflow: hidden;
    }
    .raw-html-panel.visible { display: block; }
    .raw-header {
      padding: 12px 16px;
      background: #292524;
      border-bottom: 1px solid #44403c;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .raw-header span { color: #a8a29e; font-size: 12px; font-weight: 600; }
    .raw-header button {
      background: none;
      border: 1px solid #44403c;
      color: #e7e5e4;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      cursor: pointer;
    }
    .raw-header button:hover { background: #33302e; }
    .raw-html-panel pre {
      padding: 16px;
      font-size: 11px;
      line-height: 1.5;
      color: #e7e5e4;
      overflow-x: auto;
      max-height: 60vh;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #1c1917; }
      .toolbar { background: #292524; border-bottom-color: #44403c; }
      .toolbar-name { color: #e7e5e4; }
      .toolbar-subject { color: #a8a29e; }
      .btn-back { color: #a78bfa; }
      .btn-back:hover { background: #3730a3; }
      .info-bar { background: #422006; border-bottom-color: #78350f; color: #fde68a; }
      .email-iframe-container { background: #292524; }
    }
  </style>
  <script>
    function toggleRaw() {
      const panel = document.getElementById('raw-html');
      const btn = document.getElementById('raw-toggle');
      const isVisible = panel.classList.toggle('visible');
      btn.textContent = isVisible ? 'Hide HTML' : 'View HTML';
      if (isVisible) {
        setTimeout(() => {
          document.getElementById('raw-content').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
    function copyRaw() {
      const code = document.getElementById('raw-content');
      navigator.clipboard.writeText(code.textContent).then(() => {
        const btn = document.getElementById('copy-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
      });
    }
    function downloadHtml() {
      const html = document.getElementById('raw-content').textContent;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = '${slug}.email.html';
      a.click();
      URL.revokeObjectURL(url);
    }
    function autoResizeIframe(iframe) {
      iframe.style.height = '0';
      iframe.style.height = iframe.contentWindow.document.documentElement.scrollHeight + 'px';
    }
  </script>
</head>
<body>
  <!-- Toolbar -->
  <div class="toolbar">
    <div class="toolbar-left">
      <a href="/api/email/preview" class="btn-back">← Templates</a>
      <div>
        <div class="toolbar-name">${tmpl.name}</div>
        <div class="toolbar-subject">${tmpl.subject}</div>
      </div>
    </div>
    <div class="toolbar-actions">
      <a href="#" class="btn-raw" id="raw-toggle" onclick="toggleRaw();return false;">View HTML</a>
      <a href="#" class="btn-download" id="download-btn" onclick="downloadHtml();return false;">Download .html</a>
    </div>
  </div>

  <!-- Info bar -->
  <div class="info-bar">
    <span>📧</span>
    <span>This is a preview with sample data. Use these rendered emails to test responsive layout, dark mode, and email client compatibility.</span>
  </div>

  <!-- Rendered email -->
  <div class="email-iframe-container">
    <iframe
      srcdoc="${escapeHtml(emailHtml)}"
      title="${tmpl.name} preview"
      onload="autoResizeIframe(this)"
    ></iframe>
  </div>

  <!-- Raw HTML panel -->
  <div class="raw-html-panel" id="raw-html">
    <div class="raw-header">
      <span>Raw HTML — ${emailHtml.length.toLocaleString()} bytes</span>
      <div style="display:flex;gap:8px;">
        <button id="copy-btn" onclick="copyRaw()">Copy</button>
        <button onclick="downloadHtml()">Download</button>
      </div>
    </div>
    <pre><code id="raw-content">${escapeHtml(emailHtml)}</code></pre>
  </div>
</body>
</html>`;

  return new NextResponse(wrapperHtml, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// escapeHtml imported from @/lib/email/utils
