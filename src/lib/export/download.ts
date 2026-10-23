import { err, ok, type Result } from '@/lib/result';

export interface DownloadOptions {
  bom?: boolean;
}

/**
 * Triggers a local browser file download from an in-memory text string using a temporary Blob URL.
 *
 * PRIVACY & RESILIENCE (WHY):
 * Runs 100% locally in the browser with zero network requests. Always revokes the created object URL
 * in a `finally` block to prevent memory leaks and catches any DOM/Blob errors so it never throws.
 *
 * @param filename - Sanitized target filename.
 * @param mime - MIME type string (e.g. 'text/csv;charset=utf-8').
 * @param content - Text content to download.
 * @param options - Optional settings; `bom: true` prepends a UTF-8 BOM (`\uFEFF`) if not already present.
 * @returns Result containing `{ filename }` on success or `{ message }` on failure.
 */
export function downloadText(
  filename: string,
  mime: string,
  content: string,
  options?: DownloadOptions,
): Result<{ filename: string }, { message: string }> {
  try {
    if (
      typeof document === 'undefined' ||
      typeof Blob === 'undefined' ||
      typeof URL === 'undefined' ||
      typeof URL.createObjectURL !== 'function'
    ) {
      return err({ message: 'File downloads are not supported in this environment.' });
    }

    const finalContent =
      options?.bom && !content.startsWith('\uFEFF') ? `\uFEFF${content}` : content;

    const blob = new Blob([finalContent], { type: mime });
    const url = URL.createObjectURL(blob);

    try {
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      URL.revokeObjectURL(url);
    }

    return ok({ filename });
  } catch {
    return err({ message: 'Could not start the file download in this browser.' });
  }
}
