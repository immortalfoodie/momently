import { describe, expect, it } from 'vitest';
import { neutralizeFormula, toCsv } from '@/lib/export/csv';

describe('Export: CSV & Formula Injection Neutralization', () => {
  it('quotes cells containing commas, double quotes, CR or LF per RFC 4180 and uses CRLF', () => {
    const csv = toCsv([
      ['Header 1', 'Header, 2', 'Header "3"'],
      ['Plain', 'Line 1\nLine 2', 'Carriage\rReturn'],
    ]);

    expect(csv).toBe(
      'Header 1,"Header, 2","Header ""3"""\r\nPlain,"Line 1\nLine 2","Carriage\rReturn"',
    );
  });

  it('prepends UTF-8 BOM only when bom option is true', () => {
    const withoutBom = toCsv([['A', 'B']]);
    const withBom = toCsv([['A', 'B']], { bom: true });

    expect(withoutBom.startsWith('\uFEFF')).toBe(false);
    expect(withBom.startsWith('\uFEFF')).toBe(true);
    expect(withBom.slice(1)).toBe(withoutBom);
  });

  it('neutralizes formula prefixes (= + - @ tab CR), including after leading spaces, in string cells only', () => {
    expect(neutralizeFormula('=SUM(A1:A5)')).toBe("'=SUM(A1:A5)");
    expect(neutralizeFormula('+100')).toBe("'+100");
    expect(neutralizeFormula('-50')).toBe("'-50");
    expect(neutralizeFormula('@cmd')).toBe("'@cmd");
    expect(neutralizeFormula('\t=1+1')).toBe("'\t=1+1");
    expect(neutralizeFormula('\r=1+1')).toBe("'\r=1+1");

    // Leading spaces before dangerous characters
    expect(neutralizeFormula('   =HYPERLINK("http://evil.tld")')).toBe(
      '\'   =HYPERLINK("http://evil.tld")',
    );
    expect(neutralizeFormula('  +cmd')).toBe("'  +cmd");
    expect(neutralizeFormula('  -cmd')).toBe("'  -cmd");
    expect(neutralizeFormula('  @cmd')).toBe("'  @cmd");
    expect(neutralizeFormula('  \tcmd')).toBe("'  \tcmd");
    expect(neutralizeFormula('  \rcmd')).toBe("'  \rcmd");

    // Safe strings untouched
    expect(neutralizeFormula('Safe text = + - @ inside')).toBe(
      'Safe text = + - @ inside',
    );
    expect(neutralizeFormula('')).toBe('');
  });

  it('leaves numeric cells untouched even when negative', () => {
    const csv = toCsv([
      ['Item', -250, 0, 150000],
      ['-250 as string', '=1+1', 42, 99],
    ]);

    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('Item,-250,0,150000');
    expect(lines[1]).toBe("'-250 as string,'=1+1,42,99");
  });

  it('preserves ₹ symbol and Devanagari text accurately', () => {
    const csv = toCsv(
      [
        ['शुभ विवाह', '₹1,50,000', 'संगीत संध्या'],
      ],
      { bom: true },
    );

    expect(csv).toBe('\uFEFFशुभ विवाह,"₹1,50,000",संगीत संध्या');
  });
});
