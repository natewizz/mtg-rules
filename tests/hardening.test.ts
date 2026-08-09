import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { diffRules } from '../src/diff.js';
import { parseRules } from '../src/parser.js';
import { discoverRulesUrlFromHtml } from '../src/source.js';
import { stringifyRules } from '../src/json.js';
import { validateRules } from '../src/validator.js';

const adversarialPath = fileURLToPath(new URL('./fixtures/adversarial-cr.txt', import.meta.url));
const adversarial = await readFile(adversarialPath, 'utf8');

function documentWithRules(
  rules: Record<string, { id: string; text: string; examples: string[]; hash: string }>,
) {
  const base = parseRules(adversarial);
  return { ...base, rules };
}

describe('parser hardening', () => {
  it('handles BOM, CRLF, missing final newline, tabs, and harmless spacing', () => {
    const lf = parseRules(adversarial.trimEnd());
    const crlf = parseRules(`\uFEFF${adversarial.trimEnd().replaceAll('\n', '\r\n')}`);
    const spaced = parseRules(adversarial.replace('100.2. A rule', '\n\n100.2. A rule'));
    const trailing = parseRules(adversarial.replace('100.2. A rule', '100.2. A rule   '));

    expect(crlf.rules).toEqual(lf.rules);
    expect(spaced.rules).toEqual(lf.rules);
    expect(trailing.rules).toEqual(lf.rules);
    expect(lf.rules['100.1']?.examples[0]).toContain('continues here');
    expect(lf.rules['100.1a']?.text).toContain('continues on another line');
  });

  it('fails loudly for duplicate and malformed structures', () => {
    const duplicate = validateRules(
      parseRules(adversarial.replace('100.2. A rule', '100.1. Duplicate')),
    );
    expect(duplicate.diagnostics.some((item) => item.code === 'DUPLICATE_RULE_ID')).toBe(true);

    const malformed = validateRules(
      parseRules(adversarial.replace('100.2. A rule', '100.x Broken')),
    );
    expect(malformed.diagnostics.some((item) => item.code === 'INVALID_RULE_ID')).toBe(true);

    const missingDate = validateRules(
      parseRules(adversarial.replace('These rules are effective as of January 1, 2099.', '')),
    );
    expect(missingDate.diagnostics.some((item) => item.code === 'MISSING_EFFECTIVE_DATE')).toBe(
      true,
    );
  });
});

describe('deterministic serialization and local diffs', () => {
  it('serializes the same parsed source byte-for-byte', () => {
    const first = stringifyRules(parseRules(adversarial));
    const second = stringifyRules(parseRules(adversarial));
    expect(first).toBe(second);
  });

  it('classifies added, removed, changed, and unchanged rules', () => {
    const oldDocument = documentWithRules({
      '100.1': { id: '100.1', text: 'old', examples: [], hash: 'a' },
      '100.2': { id: '100.2', text: 'same', examples: [], hash: 'b' },
      '100.3': { id: '100.3', text: 'removed', examples: [], hash: 'c' },
    });
    const newDocument = documentWithRules({
      '100.1': { id: '100.1', text: 'new', examples: [], hash: 'd' },
      '100.2': { id: '100.2', text: 'same', examples: [], hash: 'b' },
      '100.4': { id: '100.4', text: 'added', examples: [], hash: 'e' },
    });

    expect(diffRules(oldDocument, newDocument)).toMatchObject({
      added: ['100.4'],
      removed: ['100.3'],
      changed: ['100.1'],
      unchanged: ['100.2'],
    });
  });
});

describe('source discovery', () => {
  it('selects an official Comprehensive Rules TXT link only', () => {
    const html = `
      <a href="/rules.pdf">PDF</a>
      <a href="https://example.test/MagicCompRules.txt">unrelated</a>
      <a href="/downloads/MagicCompRules%2020990101.txt?x=1">TXT</a>
    `;
    expect(discoverRulesUrlFromHtml(html)).toBe(
      'https://magic.wizards.com/downloads/MagicCompRules%2020990101.txt?x=1',
    );
  });

  it('rejects missing or non-Wizards TXT links', () => {
    expect(() => discoverRulesUrlFromHtml('<a href="/rules.pdf">PDF</a>')).toThrow(
      'Could not find',
    );
    expect(() =>
      discoverRulesUrlFromHtml('<a href="https://example.test/MagicCompRules.txt">TXT</a>'),
    ).toThrow('Could not find');
  });
});
