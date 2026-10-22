import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Architecture Documentation Heading Hierarchy', () => {
  it('parses ARCHITECTURE.md and asserts all "## N." headings are sequential and unique', () => {
    const archPath = path.resolve(process.cwd(), 'docs/ARCHITECTURE.md');
    const content = fs.readFileSync(archPath, 'utf-8');
    const lines = content.split('\n');

    const numberedHeadings: Array<{ number: number; title: string; line: number }> = [];
    const headingRegex = /^##\s+(\d+)\.\s+(.*)$/;

    lines.forEach((line, index) => {
      const match = line.trim().match(headingRegex);
      if (match && match[1] && match[2]) {
        numberedHeadings.push({
          number: parseInt(match[1], 10),
          title: match[2].trim(),
          line: index + 1,
        });
      }
    });

    expect(numberedHeadings.length).toBeGreaterThan(0);

    const numbers = numberedHeadings.map((h) => h.number);
    const uniqueNumbers = new Set(numbers);

    // Assert uniqueness
    expect(uniqueNumbers.size).toBe(numbers.length);

    // Assert strictly sequential starting from 1
    numbers.forEach((num, index) => {
      expect(num).toBe(index + 1);
    });
  });
});
