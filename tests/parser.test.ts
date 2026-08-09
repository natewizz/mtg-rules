import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getRule, parseRules } from '../src/parser.js';
import { validateRules } from '../src/validator.js';

const fixturePath = fileURLToPath(new URL('./fixtures/synthetic-cr.txt', import.meta.url));

const fixture = await readFile(fixturePath, 'utf8');

describe('parseRules', () => {
  it('parses sections, rules, examples, glossary, and credits', () => {
    const document = parseRules(fixture);

    expect(document.metadata.effectiveDate).toBe('January 1, 2099');
    expect(document.sections['1']).toEqual({ id: '1', title: 'Game Concepts' });
    expect(document.rules['100.1']?.text).toContain('numbered rule');
    expect(document.rules['100.1a']?.text).toContain('lettered subrule');
    expect(document.rules['100.1']?.examples).toEqual([
      'First example text.',
      'Second example text. This example continues on another source line.',
    ]);
    expect(document.rules['100.2']?.text).toContain('continuation is part');
    expect(document.glossary['Ability']?.text).toBe('A synthetic glossary definition.');
    expect(document.credits).toContain('Synthetic credit line.');
  });

  it('provides flat rule lookup and deterministic hashes', () => {
    const document = parseRules(fixture);
    expect(getRule(document, '100.1a')?.id).toBe('100.1a');
    expect(getRule(document, '999')).toBeUndefined();
    expect(document.rules['100.1']?.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(parseRules(fixture)).toEqual(document);
  });
});

describe('validateRules', () => {
  it('passes the valid synthetic fixture', () => {
    const report = validateRules(parseRules(fixture));
    expect(report.passed).toBe(true);
    expect(report.stats.unclassifiedMeaningfulLines).toBe(0);
  });

  it('reports unknown meaningful lines', () => {
    const report = validateRules(
      parseRules(fixture.replace('100.2. A multiline', 'not understood\n\n100.2. A multiline')),
    );
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'unclassified-line')).toBe(true);
  });

  it('reports orphan subrules', () => {
    const orphan = fixture.replace('100.1a A lettered', '100.9a An orphan');
    const report = validateRules(parseRules(orphan));
    expect(report.passed).toBe(false);
    expect(report.issues.some((issue) => issue.code === 'orphan-subrule')).toBe(true);
  });
});
