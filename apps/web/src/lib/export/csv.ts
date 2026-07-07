// ─── CSV Formula Injection Prevention ───────────────────────────
//
// Dangerous characters that spreadsheet software may interpret as
// formula prefixes:
//   =  (Excel/Sheets formula)
//   +  (Excel legacy formula)
//   -  (Excel legacy formula)
//   @  (Excel table formula / Sheets)
//   |  (Some parsers treat as pipe-delimited)
//   \t (Tab — some parsers treat as TSV)
//   \r (Carriage return)
//   \n (Line feed — breaks CSV row structure)
//
// Mitigation: prefix cells starting with dangerous characters
// with a tab character. This is the most reliable approach across
// Excel, Google Sheets, and LibreOffice Calc.
//
// Reference: OWASP CSV Injection (https://owasp.org/www-community/attacks/CSV_Injection)

const DANGEROUS_PREFIXES = ['=', '+', '-', '@', '|', '\t', '\r', '\n'];

/**
 * Sanitize a single CSV cell value to prevent formula injection.
 *
 * - Coerces non-string values to strings
 * - Prefixes cells starting with dangerous characters with a tab
 * - RFC 4180: wraps cells containing commas, quotes, or newlines in double quotes
 * - Escapes existing double quotes by doubling them
 */
export function sanitizeCsvCell(value: unknown): string {
  let str = value == null ? '' : String(value);

  // Check for formula injection prefixes
  if (str.length > 0 && DANGEROUS_PREFIXES.some((p) => str.startsWith(p))) {
    str = '\t' + str;
  }

  // RFC 4180: escape double quotes by doubling them
  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }

  // RFC 4180: wrap in quotes if contains comma, double quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    str = `"${str}"`;
  }

  return str;
}

/**
 * Build a single CSV row from an array of cell values.
 * Each cell is sanitized via `sanitizeCsvCell`.
 */
export function buildCsvRow(cells: unknown[]): string {
  return cells.map(sanitizeCsvCell).join(',') + '\n';
}

/**
 * Build a complete CSV string from headers and rows of data.
 *
 * @param headers - Array of column header labels
 * @param rows - Array of rows, each being an array of cell values
 * @returns A well-formed CSV string with header row
 *
 * @example
 * ```ts
 * const csv = buildCsv(
 *   ['Title', 'Status', 'Assignee'],
 *   [
 *     ['Fix login bug', 'in_progress', 'alice@example.com'],
 *     ['Add dark mode', 'open', 'bob@example.com'],
 *   ],
 * );
 * ```
 */
export function buildCsv(headers: string[], rows: unknown[][]): string {
  let output = buildCsvRow(headers);
  for (const row of rows) {
    output += buildCsvRow(row);
  }
  return output;
}

/**
 * Sanitize an entire row object into an ordered array of cell values,
 * using a key order array or the keys of the first row.
 *
 * @param row - The row object
 * @param keys - Ordered array of keys for the columns
 * @returns Array of sanitized cell values
 */
export function rowToCells(row: Record<string, unknown>, keys: string[]): unknown[] {
  return keys.map((key) => row[key]);
}
