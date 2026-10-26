import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseTournamentRules } from '../src/mtr-parser.js';

const extractPath = '.rules-source/mtr-2026-02-27.txt';
const hasExtract = existsSync(extractPath);

describe('February 27, 2026 tournament rules extract', () => {
  it.runIf(hasExtract)('parses every section with nothing left over', () => {
    const document = parseTournamentRules(readFileSync(extractPath, 'utf8'), {
      sourceSha256: 'a627fb8c8568d8fbb0d4bd6ffeaee460501c07b80b6928cf8c038d708ad0602e',
    });

    expect(document.metadata.effectiveDate).toBe('February 27, 2026');
    expect(document.metadata.dataProfile).toBe('complete-generated-tournament-rules');
    expect(document.classification.unclassified).toEqual([]);
    expect(Object.keys(document.sections)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
    expect(Object.keys(document.rules)).toHaveLength(93);
    expect(document.rules['1.10']?.title).toBe('Players');
    expect(document.rules['1.3']?.text).toContain('• Floor Judge\n');
    expect(document.rules['1.3']?.text).not.toContain('`');
    expect(document.rules['3.2']?.text).toContain('• Legacy\n\nLimited Formats');
    expect(document.rules['6.3']?.text).toContain('Vivi Ornitier');
    expect(document.rules['Appendix C']?.text).toContain(
      'This player’s opponents’ match-win percentage is 0.62.',
    );
    expect(document.rules['Appendix F']?.text).toContain('World Championship Professional');
    expect(document.credits[0]).toMatch(/^All trademarks are property of Wizards of the Coast/);
  });
});
