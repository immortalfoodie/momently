/**
 * Result structure returned by user text sanitization.
 * WHY: Informs callers if truncation occurred so warnings or telemetry can track input trimming.
 */
export interface SanitizedText {
  text: string;
  truncated: boolean;
}

/**
 * Strips non-printable control characters, normalizes Unicode, trims whitespace,
 * and enforces length limits on untrusted host inputs.
 * WHY: Defense-in-depth against terminal escapes, hidden Unicode homoglyphs, and prompt bloat.
 *
 * @param rawText - Raw input text from the client or user.
 * @param maxLength - Maximum allowed character length.
 * @returns Cleaned text and whether truncation occurred.
 */
export function sanitizeUserText(rawText: string, maxLength: number): SanitizedText {
  // 1. Unicode normalization (NFKC decomposes compatibility characters and composes standard glyphs)
  const normalized = rawText.normalize('NFKC');

  // 2. Strip control characters except newline (\n) and tab (\t)
  const withoutControls = normalized.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g,
    '',
  );

  // 3. Collapse 3 or more consecutive newlines into 2 (clean paragraph breaks)
  const collapsedNewlines = withoutControls.replace(/\n{3,}/g, '\n\n');

  // 4. Trim leading and trailing whitespace
  const trimmed = collapsedNewlines.trim();

  // 5. Enforce length cap
  if (trimmed.length > maxLength) {
    return {
      text: trimmed.slice(0, maxLength),
      truncated: true,
    };
  }

  return {
    text: trimmed,
    truncated: false,
  };
}

/**
 * Named heuristic regular expressions for flagging adversarial prompt injection attempts.
 * WHY: Allows defensive auditing and telemetry flags before passing text to LLM boundaries.
 */
export const INJECTION_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  {
    name: 'ignore_instructions',
    regex: /ignore\s+(all\s+|previous\s+|above\s+|prior\s+)?instructions/i,
  },
  {
    name: 'disregard_instructions',
    regex: /disregard\s+(all\s+|previous\s+|above\s+|prior\s+)?instructions/i,
  },
  {
    name: 'forget_instructions',
    regex: /forget\s+(all\s+|previous\s+|above\s+)?instructions/i,
  },
  {
    name: 'system_prompt',
    regex: /system\s+prompt/i,
  },
  {
    name: 'you_are_now',
    regex: /you\s+are\s+now\b/i,
  },
  {
    name: 'reveal_instructions',
    regex: /(reveal|show|output|print|repeat)\s+(your\s+)?(system\s+)?instructions/i,
  },
  {
    name: 'role_tag_xml',
    regex: /<\s*(system|assistant|admin|user|prompt)\s*>/i,
  },
  {
    name: 'role_tag_bracket',
    regex: /\[\s*(system|assistant|admin|developer)\s*\]/i,
  },
  {
    name: 'jailbreak_keywords',
    regex: /\b(jailbreak|dan\s+mode|do\s+anything\s+now)\b/i,
  },
];

/**
 * Flags whether an untrusted input contains patterns typical of prompt injection attacks.
 * WHY: Prompts treat all user text as data regardless, but this flag allows security auditing.
 *
 * @param text - Untrusted user text to inspect.
 * @returns True if any injection heuristics matched, false otherwise.
 */
export function detectInjectionAttempt(text: string): boolean {
  return INJECTION_PATTERNS.some(({ regex }) => regex.test(text));
}

/**
 * Encloses untrusted user input within <user_text> data boundary tags after escaping any internal tag occurrences.
 * WHY: Clearly separates instructions from user-supplied data in LLM prompts.
 *
 * @param text - Untrusted user input.
 * @returns Wrapped string safely demarcated within <user_text> boundaries.
 */
export function wrapUntrusted(text: string): string {
  const escaped = text
    .replace(/<\/user_text>/gi, '&lt;/user_text&gt;')
    .replace(/<user_text>/gi, '&lt;user_text&gt;');

  return `<user_text>\n${escaped}\n</user_text>`;
}
