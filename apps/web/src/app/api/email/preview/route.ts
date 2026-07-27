import { NextResponse } from 'next/server';

const TEMPLATES = [
  { slug: 'task-assigned', name: 'Task Assigned', description: 'When a task is assigned to you' },
  { slug: 'task-comment', name: 'Task Comment', description: 'When someone comments on your task' },
  { slug: 'task-status-changed', name: 'Task Status Changed', description: 'When your task status changes' },
  { slug: 'task-completed', name: 'Task Completed', description: 'When a task you are assigned is completed' },
  { slug: 'task-closed', name: 'Task Closed', description: 'When a task is closed' },
  { slug: 'task-reopened', name: 'Task Reopened', description: 'When a closed task is reopened' },
  { slug: 'task-mention', name: 'Task Mention', description: 'When you are mentioned in a comment' },
  { slug: 'task-due-soon', name: 'Task Due Soon', description: 'When a task is due within 24 hours' },
  { slug: 'task-overdue', name: 'Task Overdue', description: 'When a task becomes overdue' },
  { slug: 'task-escalated', name: 'Task Escalated', description: 'When a task is escalated' },
  { slug: 'welcome', name: 'Welcome', description: 'Welcome email for new users' },
] as const;

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Email Template Preview — WorkManager</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f4;
      color: #0c0a09;
      padding: 40px 24px;
      min-height: 100vh;
    }
    .container { max-width: 640px; margin: 0 auto; }
    h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    p.subtitle { color: #78716c; font-size: 14px; margin-bottom: 32px; }
    .card {
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
    }
    .card-header {
      padding: 20px 24px;
      border-bottom: 1px solid #e7e5e4;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card-header h2 { font-size: 16px; font-weight: 600; }
    .card-header span {
      background: #eef2ff;
      color: #6366f1;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
    }
    .card-body { padding: 8px 0; }
    a.template-link {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      text-decoration: none;
      color: inherit;
      transition: background-color 0.15s;
    }
    a.template-link:hover { background-color: #fafafa; }
    .template-name { font-size: 14px; font-weight: 500; }
    .template-desc { font-size: 12px; color: #78716c; margin-top: 2px; }
    .arrow { color: #a8a29e; font-size: 18px; }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .badge-new { background: #eef2ff; color: #6366f1; }
    .footer { margin-top: 24px; text-align: center; font-size: 12px; color: #a8a29e; }
    .footer a { color: #6366f1; text-decoration: none; }
    @media (prefers-color-scheme: dark) {
      body { background: #1c1917; color: #e7e5e4; }
      .card { background: #292524; }
      .card-header { border-bottom-color: #44403c; }
      a.template-link:hover { background-color: #33302e; }
      .card-header span { background: #3730a3; color: #a78bfa; }
      .template-desc { color: #a8a29e; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Email Templates</h1>
    <p class="subtitle">Preview all notification email templates with sample data</p>

    <div class="card">
      <div class="card-header">
        <h2>Notification Templates</h2>
        <span>${TEMPLATES.length} total</span>
      </div>
      <div class="card-body">
        ${TEMPLATES.map(
          (t) => `
        <a class="template-link" href="/api/email/preview/${t.slug}">
          <div>
            <div class="template-name">${t.name}</div>
            <div class="template-desc">${t.description}</div>
          </div>
          <span class="arrow">→</span>
        </a>`,
        ).join('')}
      </div>
    </div>

    <div class="footer">
      <p>Open a template to view the rendered email HTML in your browser.</p>
      <p style="margin-top: 4px;">Use these previews to test in Gmail, Outlook, or Apple Mail.</p>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
