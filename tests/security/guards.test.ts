import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT_DIR = resolve(process.cwd());

function walkFiles(dir: string, exts = ['.ts', '.tsx', '.js', '.mjs', '.md']): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === 'coverage' ||
      entry.name === '.git'
    ) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function toPosixRel(filePath: string): string {
  return relative(ROOT_DIR, filePath).split('\\').join('/');
}

function scanLines(
  files: string[],
  predicate: (line: string, relPath: string) => string | null,
): string[] {
  const findings: string[] = [];
  for (const file of files) {
    const rel = toPosixRel(file);
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const reason = predicate(line, rel);
      if (reason) {
        findings.push(`${rel}:${idx + 1} - ${reason}: ${line.trim()}`);
      }
    });
  }
  return findings;
}

describe('Security Guard Checks (src/, tests/, docs/, root)', () => {
  const srcFiles = walkFiles(join(ROOT_DIR, 'src'));

  it('forbids dangerous DOM sinks and dynamic code evaluation in src/', () => {
    const pattern =
      /\b(dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|document\.write)\b|\beval\s*\(|\bnew\s+Function\s*\(/;
    const findings = scanLines(srcFiles, (line) =>
      pattern.test(line) ? 'Forbidden DOM sink or eval' : null,
    );
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids localStorage and sessionStorage outside src/store/safeStorage.ts', () => {
    const pattern = /\b(localStorage|sessionStorage)\b/;
    const findings = scanLines(srcFiles, (line, rel) => {
      if (rel === 'src/store/safeStorage.ts') return null;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return null;
      }
      return pattern.test(line) ? 'Direct storage access outside safeStorage.ts' : null;
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids process.env outside src/server/**, src/llm/factory.ts, and next.config.ts', () => {
    const pattern = /\bprocess\.env\b/;
    const findings = scanLines(srcFiles, (line, rel) => {
      if (
        rel.startsWith('src/server/') ||
        rel === 'src/llm/factory.ts' ||
        rel === 'next.config.ts'
      ) {
        return null;
      }
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return null;
      }
      return pattern.test(line) ? 'process.env used outside allowed server boundary' : null;
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids fetch( outside src/lib/apiClient.ts', () => {
    const pattern = /\bfetch\s*\(/;
    const findings = scanLines(srcFiles, (line, rel) => {
      if (rel === 'src/lib/apiClient.ts') return null;
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        return null;
      }
      return pattern.test(line) ? 'fetch( used outside src/lib/apiClient.ts' : null;
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids console.log in src/', () => {
    const pattern = /\bconsole\.log\b/;
    const findings = scanLines(srcFiles, (line) =>
      pattern.test(line) ? 'Forbidden console.log' : null,
    );
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids explicit any (: any, as any, <any>) in src/', () => {
    const pattern = /:\s*any\b|\bas\s+any\b|<any>/;
    const findings = scanLines(srcFiles, (line) =>
      pattern.test(line) ? 'Forbidden explicit any' : null,
    );
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids hardcoded API keys or secret tokens across src/, tests/, docs/, and root files', () => {
    const rootEntries = readdirSync(ROOT_DIR)
      .map((name) => join(ROOT_DIR, name))
      .filter((full) => {
        try {
          return (
            statSync(full).isFile() &&
            !full.endsWith('package-lock.json') &&
            !full.endsWith('.ico')
          );
        } catch {
          return false;
        }
      });
    const allFiles = [
      ...srcFiles,
      ...walkFiles(join(ROOT_DIR, 'tests')),
      ...walkFiles(join(ROOT_DIR, 'docs')),
      ...rootEntries,
    ];
    const aiKeyPattern = new RegExp('AIza' + '[A-Za-z0-9_\\-]{30,}');
    const assignedSecretPattern = new RegExp(
      '\\b[A-Za-z0-9_]*(?:key|secret|token)[A-Za-z0-9_]*\\s*[:=]\\s*[\'"`][A-Za-z0-9+/=_\\-]{32,}[\'"`]',
      'i',
    );

    const findings = scanLines(allFiles, (line) => {
      if (aiKeyPattern.test(line) || assignedSecretPattern.test(line)) {
        return 'Potential hardcoded API key or secret';
      }
      return null;
    });
    expect(findings, findings.join('\n')).toEqual([]);
  });

  it('forbids client code (src/components, src/store, src/lib, src/app non-api) from importing src/server or geminiProvider', () => {
    const clientFiles = srcFiles.filter((file) => {
      const rel = toPosixRel(file);
      if (rel.startsWith('src/components/')) return true;
      if (rel.startsWith('src/store/')) return true;
      if (rel.startsWith('src/lib/')) return true;
      if (rel.startsWith('src/app/') && !rel.startsWith('src/app/api/')) return true;
      return false;
    });

    const importRegex = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const forbiddenSpecifiers = [
      /(^|\/)server(\/|$)/,
      /(^|\/)geminiProvider(\/|$)/,
      /(^|\/)llm\/factory(\/|$)/,
    ];

    const findings = scanLines(clientFiles, (line) => {
      let match: RegExpExecArray | null;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(line)) !== null) {
        const spec = match[1] ?? match[2] ?? '';
        if (forbiddenSpecifiers.some((rx) => rx.test(spec))) {
          return `Forbidden server/LLM import specifier "${spec}" in client module`;
        }
      }
      return null;
    });

    expect(findings, findings.join('\n')).toEqual([]);
  });
});
