function findBalancedObject(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (escape) {
      escape = false;
    } else if (char === '\\') {
      escape = true;
    } else if (char === '"') {
      inString = !inString;
    } else if (!inString) {
      if (char === '{') depth++;
      else if (char === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Extracts the first balanced JSON object from raw provider text, stripping markdown code blocks.
 * WHY: Robustly parses model output even if conversational preambles or code fences are emitted.
 */
export function extractJson(raw: string): string | null {
  const match = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(raw.trim());
  const text = (match?.[1] ?? raw).trim();
  const start = text.indexOf('{');
  return start === -1 ? null : findBalancedObject(text, start);
}
