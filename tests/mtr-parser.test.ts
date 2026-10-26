import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  getTournamentRule,
  parseTournamentRules,
  stringifyTournamentRules,
} from '../src/mtr-parser.js';

const fixturePath = fileURLToPath(new URL('./fixtures/synthetic-mtr.txt', import.meta.url));
const fixture = await readFile(fixturePath, 'utf8');

describe('parseTournamentRules', () => {
  it('parses chapters, sections, appendices, and credits', () => {
    const document = parseTournamentRules(fixture);

    expect(document.metadata.effectiveDate).toBe('January 1, 2099');
    expect(document.metadata.dataProfile).toBe('complete-generated-tournament-rules');
    expect(document.metadata.notices.unofficial).toBe(true);
    expect(document.metadata.notices.freeUseOnly).toBe(true);
    expect(document.sections['1']).toEqual({ id: '1', title: 'Sample Chapter' });
    expect(document.introduction).toEqual([
      'The synthetic tournament rules describe how a sample event is run across many tables.',
      'A second paragraph starts after that shorter line.',
    ]);
    expect(document.classification.unclassified).toEqual([]);

    const section = getTournamentRule(document, '1.1');
    expect(section?.title).toBe('Sample Section');
    expect(section?.section).toBe('1');
    expect(section?.text).toContain('Scorekeeper remains responsible for the record.');
    expect(section?.text).toContain('• First duty that continues in lowercase');
    expect(section?.text).toContain('• Floor Judge\n');
    expect(section?.text).not.toContain('`');
    expect(section?.text).toContain('1. If the match ends early');
    expect(section?.text).toContain('2. Then they leave the table.');
    expect(section?.text).toContain('located at https://example.com/rules.');
    expect(section?.hash).toMatch(/^[a-f0-9]{64}$/);

    expect(getTournamentRule(document, '1.2')?.text).toContain('Use 0.33 instead');
    expect(document.rules['0.33']).toBeUndefined();
    expect(getTournamentRule(document, 'Appendix A')?.text).toContain('1.1: Sample note added.');
    expect(document.credits).toEqual([
      'All trademarks are property of the sample publisher.',
      '© 2099 Sample Publisher.',
    ]);
  });

  it('restores figure text only for the matching tiebreaker example', () => {
    const withFigure = fixture.replace(
      '1.1: Sample note added.',
      'and 6–1–1, so her opponents’ match-win percentage is:',
    );
    const document = parseTournamentRules(withFigure);
    expect(getTournamentRule(document, 'Appendix A')?.text).toContain(
      'This player’s opponents’ match-win percentage is 0.62.',
    );
    expect(parseTournamentRules(fixture).rules['Appendix A']?.text).not.toContain('0.62');
  });

  it('serializes deterministically and records supplied links on Click here sections', () => {
    const withClick = fixture.replace(
      'See section 1.1 for the sample procedure.',
      'See section 1.1. Click here for the list.',
    );
    const document = parseTournamentRules(withClick, {
      sourceSha256: 'ab'.repeat(32),
      externalLinks: ['https://example.com/list'],
    });
    expect(document.metadata.sourceSha256).toBe('ab'.repeat(32));
    expect(document.metadata.externalLinks).toContain('https://example.com/rules');
    expect(document.metadata.externalLinks).toContain('https://example.com/list');
    expect(getTournamentRule(document, '1.2')?.links).toEqual(['https://example.com/list']);
    expect(stringifyTournamentRules(document)).toBe(stringifyTournamentRules(document));
  });
});
