import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Integration test for the email preview API route.
 *
 * We import the GET handler directly and call it with a mock Request,
 * which validates the full route flow: template lookup → render → wrapper HTML.
 * No dev server needed — vitest runs these in-process.
 */

// ─── Helpers ──────────────────────────────────────────────────

function mockRequest(slug: string): Request {
  return new Request(`http://localhost/api/email/preview/${slug}`);
}

function mockParams(slug: string) {
  return { params: Promise.resolve({ template: slug }) };
}

// ─── All 11 templates with their expected content ────────────

interface TemplateExpectation {
  slug: string;
  name: string;
  subjectContains: string;
  emailContains: string[];
}

const ALL_TEMPLATES: TemplateExpectation[] = [
  {
    slug: 'task-assigned',
    name: 'Task Assigned',
    subjectContains: "You've been assigned",
    emailContains: ['Design system migration', 'WorkManager', 'View Task'],
  },
  {
    slug: 'task-comment',
    name: 'Task Comment',
    subjectContains: 'New comment on',
    emailContains: ['Design system migration', 'WorkManager', 'View Comment'],
  },
  {
    slug: 'task-status-changed',
    name: 'Task Status Changed',
    subjectContains: 'Task status changed',
    emailContains: ['Design system migration', 'WorkManager', 'View Task'],
  },
  {
    slug: 'task-completed',
    name: 'Task Completed',
    subjectContains: '✓ Task completed',
    emailContains: ['Design system migration', 'WorkManager', '✓'],
  },
  {
    slug: 'task-closed',
    name: 'Task Closed',
    subjectContains: 'Task closed',
    emailContains: ['Design system migration', 'WorkManager'],
  },
  {
    slug: 'task-reopened',
    name: 'Task Reopened',
    subjectContains: 'Task reopened',
    emailContains: ['Design system migration', 'WorkManager', 'View Task'],
  },
  {
    slug: 'task-mention',
    name: 'Task Mention',
    subjectContains: 'You were mentioned',
    emailContains: ['Design system migration', 'WorkManager', '@'],
  },
  {
    slug: 'task-due-soon',
    name: 'Task Due Soon',
    subjectContains: '⏰ Due soon',
    emailContains: ['Design system migration', 'WorkManager', '⏰', 'View Task'],
  },
  {
    slug: 'task-overdue',
    name: 'Task Overdue',
    subjectContains: '⚠ Overdue',
    emailContains: ['Design system migration', 'WorkManager', '⚠', 'View Overdue Task'],
  },
  {
    slug: 'task-escalated',
    name: 'Task Escalated',
    subjectContains: '🚨 Escalated',
    emailContains: ['Design system migration', 'WorkManager', '⚠', 'View Overdue Task'],
  },
  {
    slug: 'welcome',
    name: 'Welcome',
    subjectContains: 'Welcome to WorkManager',
    emailContains: ['Welcome to WorkManager', 'Jane Cooper', 'Get Started'],
  },
];

describe('Email Preview Route — /api/email/preview/[template]', () => {
  let GET: (req: Request, ctx: { params: Promise<{ template: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/email/preview/[template]/route');
    GET = mod.GET;
  });

  describe('all 11 templates return HTTP 200 with correct content', () => {
    for (const tmpl of ALL_TEMPLATES) {
      it(`${tmpl.slug} — ${tmpl.name}`, async () => {
        const response = await GET(mockRequest(tmpl.slug), mockParams(tmpl.slug));

        // Status
        expect(response.status).toBe(200);

        // Content-Type
        expect(response.headers.get('Content-Type')).toContain('text/html');

        const html = await response.text();

        // Page title
        expect(html).toContain(`Preview: ${tmpl.name}`);

        // Toolbar name
        expect(html).toContain(tmpl.name);
        expect(html).toContain('class="toolbar-name"');

        // Subject line in toolbar
        expect(html).toContain(tmpl.subjectContains);

        // Template-specific email content (inside the iframe / raw HTML panel)
        for (const expected of tmpl.emailContains) {
          expect(html).toContain(expected);
        }

        // Structural: toolbar is present
        expect(html).toContain('class="toolbar"');

        // Structural: info bar present
        expect(html).toContain('class="info-bar"');

        // Structural: rendered email iframe present
        expect(html).toContain('class="email-iframe-container"');

        // Structural: raw HTML panel with escaped email content
        expect(html).toContain('id="raw-html"');

        // Structural: download HTML button
        expect(html).toContain('Download .html');

        // Structural: bytes display (e.g., "Raw HTML — 2,345 bytes")
        // Locale-agnostic check — toLocaleString() uses different separators by locale
        expect(html).toContain('Raw HTML');
        expect(html).toContain('bytes');
        expect(html).toMatch(/Raw HTML.{0,5}—.{0,5}[\d. ,]{3,} bytes/);

        // Structural: unsubscribe link present in email
        expect(html).toContain('Unsubscribe from notifications');

        // Structural: dark mode meta tags present in email HTML
        expect(html).toContain('color-scheme');
        expect(html).toContain('supported-color-schemes');
      });
    }
  });

  describe('404 handling', () => {
    it('returns 404 for unknown template slug', async () => {
      const response = await GET(mockRequest('nonexistent-template'), mockParams('nonexistent-template'));

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('Template not found');
      expect(html).toContain('No template matches');
      expect(html).toContain('nonexistent-template');
      expect(html).toContain('Back to all templates');
    });
  });
});
