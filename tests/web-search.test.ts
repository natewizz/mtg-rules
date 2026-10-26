import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPLETE_GENERATED_DOCUMENT } from '../src/data-profile.js';
import { packageRulesSource } from '../src/package-data.js';
import { parseRules } from '../src/parser.js';
import {
  getRule,
  searchGlossary,
  searchRules,
  validateTournamentDocument,
  validateViewerDocument,
} from '../web/search.mjs';

const fixturePath = fileURLToPath(new URL('./fixtures/synthetic-cr.txt', import.meta.url));
const fixture = await readFile(fixturePath, 'utf8');
const sourceUrl = 'https://media.wizards.com/2099/downloads/MagicCompRules.txt';

describe('static tester search helpers', () => {
  const packaged = packageRulesSource(fixture, {
    profile: COMPLETE_GENERATED_DOCUMENT,
    sourceUrl,
  });

  it('rejects unpackaged parse output and accepts packaged JSON', () => {
    expect(() => validateViewerDocument(parseRules(fixture))).toThrow(/packaged/);
    expect(validateViewerDocument(packaged).metadata.dataProfile).toBe(COMPLETE_GENERATED_DOCUMENT);
  });

  it('finds rules by exact ID, prefix, and text', () => {
    expect(getRule(packaged, '100.1a')?.id).toBe('100.1a');
    expect(searchRules(packaged, '100.1').map((rule) => rule.id)).toContain('100.1');
    expect(searchRules(packaged, 'lettered subrule').some((rule) => rule.id === '100.1a')).toBe(
      true,
    );
  });

  it('finds glossary terms', () => {
    expect(searchGlossary(packaged, 'ability')[0]?.term).toBe('Ability');
  });

  it('searches tournament sections by number, title, and text without crossing chapters', () => {
    const tournament = {
      metadata: {
        dataProfile: 'complete-generated-tournament-rules',
        notices: { unofficial: true, freeUseOnly: true, commercialUsePermitted: false },
      },
      rules: {
        '1.1': {
          id: '1.1',
          title: 'Tournament Types',
          text: 'rated and casual',
          examples: [],
        },
        '10.1': {
          id: '10.1',
          title: 'Participation Minimums',
          text: 'minimum players',
          examples: [],
        },
      },
    };

    expect(validateTournamentDocument(tournament).metadata.dataProfile).toBe(
      'complete-generated-tournament-rules',
    );
    expect(() => validateViewerDocument(tournament)).toThrow(/complete-generated-document/);
    expect(
      searchRules(tournament, '1', 50, { numericBoundary: true }).map((rule) => rule.id),
    ).toEqual(['1.1']);
    expect(searchRules(tournament, 'Participation').map((rule) => rule.id)).toEqual(['10.1']);
    expect(searchRules(tournament, 'casual').map((rule) => rule.id)).toEqual(['1.1']);
  });
});

const homepage = await readFile(new URL('../web/index.html', import.meta.url), 'utf8');
const tournamentPage = await readFile(new URL('../web/tournament.html', import.meta.url), 'utf8');

describe('homepage', () => {
  it('explains the project and offers a search box', () => {
    expect(homepage).toContain('id="search"');
    expect(homepage).toContain('Unofficial Fan Content');
    expect(homepage).toContain('free to use only');
    expect(homepage).toContain('does not judge card interactions');
  });

  it('switches between the Comprehensive Rules and Tournament Rules lookups', () => {
    expect(homepage).toContain('class="doc-nav"');
    expect(homepage).toContain('href="./tournament.html"');
    expect(homepage).toContain('aria-current="page">Rules');
    expect(tournamentPage).toContain('data-source="./mtr.json"');
    expect(tournamentPage).toContain('aria-current="page">Tournament rules');
    expect(tournamentPage).toContain('href="./"');
    expect(tournamentPage).toContain('placeholder="2.12 or proxy"');
  });
});
