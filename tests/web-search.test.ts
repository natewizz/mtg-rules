import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPLETE_GENERATED_DOCUMENT } from '../src/data-profile.js';
import { packageRulesSource } from '../src/package-data.js';
import { parseRules } from '../src/parser.js';
import { getRule, searchGlossary, searchRules, validateViewerDocument } from '../web/search.mjs';

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
});
