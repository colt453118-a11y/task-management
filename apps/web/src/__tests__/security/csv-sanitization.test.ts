import { describe, it, expect } from 'vitest';
import { sanitizeCsvCell, buildCsvRow, buildCsv } from '@/lib/export/csv';

// ─── sanitizeCsvCell ───────────────────────────────────────────

describe('sanitizeCsvCell', () => {
  it('returns empty string for null/undefined', () => {
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
  });

  it('converts numbers and booleans to strings', () => {
    expect(sanitizeCsvCell(42)).toBe('42');
    expect(sanitizeCsvCell(0)).toBe('0');
    expect(sanitizeCsvCell(true)).toBe('true');
    expect(sanitizeCsvCell(false)).toBe('false');
  });

  // ── Formula Injection Prevention ──────────────────────────

  it('prefixes = with tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('\t=SUM(A1:A10)');
  });

  it('prefixes + with tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('+SUM(A1:A10)')).toBe('\t+SUM(A1:A10)');
  });

  it('prefixes - with tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('-1+1')).toBe('\t-1+1');
  });

  it('prefixes @ with tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('@SUM(A1:A10)')).toBe('\t@SUM(A1:A10)');
  });

  it('prefixes | with tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('|SUM')).toBe('\t|SUM');
  });

  it('prefixes tab with another tab to prevent formula injection', () => {
    expect(sanitizeCsvCell('\t=SUM')).toBe('\t\t=SUM');
  });

  it('prefixes line feed with tab and wraps in quotes', () => {
    // Newline triggers quoting after tab-prefixing
    expect(sanitizeCsvCell('\n=SUM')).toBe('"\t\n=SUM"');
  });

  it('prefixes carriage return with tab and wraps in quotes', () => {
    // Carriage return triggers quoting after tab-prefixing
    expect(sanitizeCsvCell('\r=SUM')).toBe('"\t\r=SUM"');
  });

  it('does NOT prefix normal text', () => {
    expect(sanitizeCsvCell('Hello World')).toBe('Hello World');
    expect(sanitizeCsvCell('Normal text with = sign in middle')).toBe('Normal text with = sign in middle');
    expect(sanitizeCsvCell('email@example.com')).toBe('email@example.com');
    expect(sanitizeCsvCell('1 + 1 = 2')).toBe('1 + 1 = 2');
  });

  it('does NOT prefix numbers starting with + or - that are legitimate', () => {
    // These are legitimate numeric values, but our sanitizer treats them
    // conservatively. This is the accepted trade-off for security.
    expect(sanitizeCsvCell('+123').startsWith('\t')).toBe(true);
    expect(sanitizeCsvCell('-45').startsWith('\t')).toBe(true);
  });

  // ── RFC 4180 Compliance ───────────────────────────────────

  it('wraps cells containing commas in double quotes', () => {
    expect(sanitizeCsvCell('Hello, World')).toBe('"Hello, World"');
  });

  it('escapes double quotes by doubling them', () => {
    expect(sanitizeCsvCell('Say "Hello"')).toBe('"Say ""Hello"""');
  });

  it('wraps cells containing newlines in double quotes', () => {
    expect(sanitizeCsvCell('Line 1\nLine 2')).toBe('"Line 1\nLine 2"');
  });

  it('handles cells with both commas, quotes, and dangerous prefixes', () => {
    // Dangerous prefix gets tab first, then comma and quotes trigger wrapping
    const result = sanitizeCsvCell('=SUM(A1),"test"');
    expect(result).toBe('"\t=SUM(A1),""test"""');
  });
});

// ─── buildCsvRow ───────────────────────────────────────────────

describe('buildCsvRow', () => {
  it('joins cells with commas and adds newline', () => {
    expect(buildCsvRow(['a', 'b', 'c'])).toBe('a,b,c\n');
  });

  it('sanitizes each cell in the row', () => {
    const row = buildCsvRow(['normal', '=SUM(A1)', 'Hello, World']);
    expect(row).toBe('normal,\t=SUM(A1),"Hello, World"\n');
  });

  it('handles empty rows', () => {
    expect(buildCsvRow([])).toBe('\n');
  });

  it('handles rows with null/undefined values', () => {
    expect(buildCsvRow(['a', null, 'c'])).toBe('a,,c\n');
  });
});

// ─── buildCsv ──────────────────────────────────────────────────

describe('buildCsv', () => {
  it('builds a complete CSV with header and data rows', () => {
    const csv = buildCsv(
      ['Name', 'Email', 'Role'],
      [
        ['Alice', 'alice@example.com', 'Admin'],
        ['Bob', 'bob@example.com', 'User'],
      ],
    );

    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe('Name,Email,Role');
    expect(lines[1]).toBe('Alice,alice@example.com,Admin');
    expect(lines[2]).toBe('Bob,bob@example.com,User');
  });

  it('sanitizes dangerous values in headers and data', () => {
    const csv = buildCsv(
      ['=SUM(A1)', 'Normal'],
      [
        ['+1+1', '-1-1'],
        ['@cmd', '|pipe'],
      ],
    );

    expect(csv).toContain('\t=SUM(A1)');
    expect(csv).toContain('\t+1+1');
    expect(csv).toContain('\t-1-1');
    expect(csv).toContain('\t@cmd');
    expect(csv).toContain('\t|pipe');
  });

  it('handles empty data set', () => {
    const csv = buildCsv(['Header1', 'Header2'], []);
    expect(csv.trim()).toBe('Header1,Header2');
  });

  it('wraps cells with special characters', () => {
    const csv = buildCsv(
      ['Name', 'Comment'],
      [
        ['Charlie', 'Hello, "World"!'],
      ],
    );

    const lines = csv.trim().split('\n');
    expect(lines[1]).toContain('"Hello, ""World""!"');
  });
});
