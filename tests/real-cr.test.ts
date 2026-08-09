import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseRules } from '../src/parser.js';
import { fetchRules } from '../src/source.js';
import { validateRules } from '../src/validator.js';

const localSource = process.env.MTG_RULES_SOURCE;

const runIntegration = process.env.MTG_RULES_INTEGRATION === '1' || Boolean(localSource);

describe('current official Wizards CR integration', () => {
  it.runIf(runIntegration)('parses and validates the current source', async () => {
    const source =
      localSource && existsSync(localSource)
        ? { text: readFileSync(localSource, 'utf8') }
        : await fetchRules();
    const document = parseRules(source.text);
    const report = validateRules(document);

    expect(report.passed, JSON.stringify(report.issues.slice(0, 10), null, 2)).toBe(true);
    expect(report.stats.ruleCount).toBeGreaterThan(3000);
    expect(report.stats.glossaryCount).toBeGreaterThan(700);
  });
});
