export type AllowedExtension = 'csv' | 'ics' | 'json' | 'txt';

const ALLOWED_EXTENSIONS: ReadonlySet<string> = new Set([
  'csv',
  'ics',
  'json',
  'txt',
]);

const MAX_STEM_LENGTH = 50;
const FALLBACK_STEM = 'momently-event';

/**
 * Produces a strictly sanitized, path-traversal-safe ASCII filename with an allow-listed extension.
 *
 * SECURITY RATIONALE (WHY):
 * Event titles are user-controlled strings that may contain path separators (`../`, `/`, `\`),
 * shell metacharacters, control characters, or non-ASCII scripts. Replacing all characters outside
 * `[a-z0-9]` with hyphens and enforcing a strict extension allow-list prevents directory traversal
 * and unsafe file-type downloads across all operating systems.
 *
 * @param title - Raw event title or file stem.
 * @param extension - Target file extension from the allow-list ('csv' | 'ics' | 'json' | 'txt').
 * @returns Sanitized filename (e.g. "silver-jubilee-budget.csv").
 */
export function safeFilename(title: string, extension: AllowedExtension): string {
  const normalizedExt = String(extension).toLowerCase().trim();
  const safeExt = ALLOWED_EXTENSIONS.has(normalizedExt) ? normalizedExt : 'txt';

  const cleaned = String(title ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_STEM_LENGTH)
    .replace(/-+$/g, '');

  const stem = cleaned.length > 0 ? cleaned : FALLBACK_STEM;
  return `${stem}.${safeExt}`;
}
