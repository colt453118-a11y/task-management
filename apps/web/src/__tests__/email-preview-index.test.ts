import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration test for the email preview index route.
 *
 * We import the GET handler directly from the index route file and call it
 * with no arguments, matching the actual handler signature.
 * This validates the full page structure: title, subtitle, all 11 template cards
 * with correct slugs, names, descriptions, and links.
 */

// ─── The same 11 template definitions from the index route ──

const EXPECTED_TEMPLATES = [
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

describe('Email Preview Index — /api/email/preview', () => {
  let GET: () => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/email/preview/route');
    GET = mod.GET;
  });

  it('returns HTTP 200 with text/html content type', async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
  });

  it('has the correct page title and subtitle', async () => {
    const response = await GET();
    const html = await response.text();

    // Page title
    expect(html).toContain('<title>Email Template Preview — WorkManager</title>');

    // Heading
    expect(html).toContain('<h1>Email Templates</h1>');

    // Subtitle
    expect(html).toContain('Preview all notification email templates with sample data');
  });

  it('displays correct template count in the card header badge', async () => {
    const response = await GET();
    const html = await response.text();

    expect(html).toContain('<h2>Notification Templates</h2>');
    expect(html).toContain(`<span>${EXPECTED_TEMPLATES.length} total</span>`);
  });

  it('includes all 11 templates with correct slugs, names, and descriptions', async () => {
    const response = await GET();
    const html = await response.text();

    for (const t of EXPECTED_TEMPLATES) {
      // Each template has a link to its preview
      expect(html).toContain(`/api/email/preview/${t.slug}`);

      // Template name appears as a heading
      expect(html).toContain(t.name);

      // Template description appears
      expect(html).toContain(t.description);
    }
  });

  it('each template card is a clickable link with correct href', async () => {
    const response = await GET();
    const html = await response.text();

    for (const t of EXPECTED_TEMPLATES) {
      // Each link is an <a> with class template-link pointing to the preview
      expect(html).toContain(`href="/api/email/preview/${t.slug}"`);
      expect(html).toContain('class="template-link"');
    }

    // Count all template-link elements to verify no extras
    const linkCount = (html.match(/class="template-link"/g) || []).length;
    expect(linkCount).toBe(EXPECTED_TEMPLATES.length);
  });

  it('includes footer with guidance text', async () => {
    const response = await GET();
    const html = await response.text();

    expect(html).toContain('Open a template to view the rendered email HTML');
    expect(html).toContain('test in Gmail, Outlook, or Apple Mail');
  });

  it('includes dark mode CSS media query', async () => {
    const response = await GET();
    const html = await response.text();

    expect(html).toContain('@media (prefers-color-scheme: dark)');
    expect(html).toContain('background: #1c1917');
  });

  it('no template is duplicated or missing — total link count equals expected', async () => {
    const response = await GET();
    const html = await response.text();

    // Count ALL preview hrefs in the page to catch both missing and extra templates
    const allHrefs = (html.match(/href="\/api\/email\/preview\/[\w-]+"/g) || []);
    expect(allHrefs).toHaveLength(EXPECTED_TEMPLATES.length);

    // Each individual slug appears exactly once
    for (const t of EXPECTED_TEMPLATES) {
      const slugHref = `href="/api/email/preview/${t.slug}"`;
      const matches = html.match(new RegExp(slugHref, 'g'));
      expect(matches).toHaveLength(1);
    }
  });
});
