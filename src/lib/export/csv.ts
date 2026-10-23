export type CsvCell = string | number;

export interface CsvOptions {
  bom?: boolean;
}

/**
 * Neutralizes spreadsheet formula injection (CSV Injection / DDE Injection) on string cells.
 *
 * SECURITY RATIONALE (WHY):
 * Spreadsheet programs (Excel, Google Sheets, LibreOffice Calc) interpret cells beginning with
 * `=`, `+`, `-`, `@`, Tab (`\t`), or Carriage Return (`\r`)—even after leading spaces—as executable
 * formulas or Dynamic Data Exchange (DDE) commands. If a user pastes untrusted text into a plan note
 * or title and exports a CSV, opening that CSV could exfiltrate data or execute external links.
 * Prefixing a single apostrophe (`'`) forces spreadsheet engines to treat the cell as a literal string.
 * Numeric cells are serialized directly as plain numbers and are never passed through this function.
 *
 * @param text - Raw string cell value.
 * @returns Formula-neutralized string safe for spreadsheet import.
 */
export function neutralizeFormula(text: string): string {
  if (text.length === 0) return text;
  if (/^[ ]*[\t\r]/.test(text) || /^\s*[=+\-@]/.test(text)) {
    return `'${text}`;
  }
  return text;
}

function formatCell(cell: CsvCell): string {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) ? String(Math.round(cell)) : '0';
  }
  const safe = neutralizeFormula(cell);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Serializes a 2D array of cells into an RFC 4180 compliant CSV string with CRLF line endings.
 *
 * @param rows - Rows of string or integer cells.
 * @param options - Optional settings; `bom: true` prepends a UTF-8 BOM (`\uFEFF`) so Excel renders `₹` and Indic scripts properly.
 * @returns RFC 4180 formatted CSV text.
 */
export function toCsv(
  rows: readonly (readonly CsvCell[])[],
  options?: CsvOptions,
): string {
  const body = rows.map((row) => row.map(formatCell).join(',')).join('\r\n');
  return options?.bom ? `\uFEFF${body}` : body;
}
