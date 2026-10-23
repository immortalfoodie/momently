import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = resolve(process.cwd());

function findPrecedingNonBlankLine(lines: string[], fnLineIndex: number): number {
  let prev = fnLineIndex - 1;
  while (prev >= 0 && lines[prev]?.trim() === '') {
    prev--;
  }
  return prev;
}

function hasImmediatelyPrecedingJsDoc(lines: string[], fnLineIndex: number): boolean {
  const prev = findPrecedingNonBlankLine(lines, fnLineIndex);
  const endLine = lines[prev]?.trim() ?? '';
  if (!endLine.endsWith('*/')) {
    return false;
  }

  for (let start = prev; start >= 0; start--) {
    const trimmed = lines[start]?.trim() ?? '';
    if (trimmed.startsWith('/**')) return true;
    if (trimmed === '') return false;
  }
  return false;
}

function checkFileExportedFunctions(subDir: string, fileName: string, lines: string[]): string[] {
  const missing: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (!/^export\s+(async\s+)?function\s+([A-Za-z0-9_]+)/.test(line)) {
      continue;
    }
    if (!hasImmediatelyPrecedingJsDoc(lines, i)) {
      missing.push(`${subDir}/${fileName}:${i + 1} - ${line.trim()}`);
    }
  }
  return missing;
}

function checkTopLevelExportedFunctions(subDir: string): string[] {
  const dir = join(ROOT_DIR, subDir);
  const missing: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;
    const lines = readFileSync(join(dir, entry.name), 'utf8').split(/\r?\n/);
    missing.push(...checkFileExportedFunctions(subDir, entry.name, lines));
  }

  return missing;
}

describe('Quality Guard: Top-Level JSDoc Coverage', () => {
  it('requires every top-level exported function directly under src/engine to have a JSDoc block immediately above it', () => {
    const missing = checkTopLevelExportedFunctions('src/engine');
    expect(missing, missing.join('\n')).toEqual([]);
  });

  it('requires every top-level exported function directly under src/lib to have a JSDoc block immediately above it', () => {
    const missing = checkTopLevelExportedFunctions('src/lib');
    expect(missing, missing.join('\n')).toEqual([]);
  });
});
