import { describe, expect, it } from 'vitest';
import { lookupGlossaryTerm, lookupRule, searchDocument } from '../web/tools.mjs';
import { registerLookupTools } from '../web/webmcp.js';

const rules = {
  metadata: {
    dataProfile: 'complete-generated-document',
    effectiveDate: 'September 25, 2026',
    notices: { unofficial: true, freeUseOnly: true, commercialUsePermitted: false },
  },
  glossary: {
    Trample: { term: 'Trample', text: 'A keyword ability.' },
    Absorb: { term: 'Absorb', text: 'A keyword ability that prevents damage.' },
  },
  rules: {
    '702.19': { id: '702.19', text: 'Trample', examples: [] },
    '702.19a': {
      id: '702.19a',
      text: 'Trample is a static ability.',
      examples: ['Example damage.'],
    },
    '702.190': { id: '702.190', text: 'Sneak', examples: [] },
    '704.5f': {
      id: '704.5f',
      text: 'If a creature has toughness 0 or less, it is put into its owner’s graveyard.',
      examples: [],
    },
  },
};

const tournament = {
  metadata: {
    dataProfile: 'complete-generated-tournament-rules',
    effectiveDate: 'February 27, 2026',
    notices: { unofficial: true, freeUseOnly: true, commercialUsePermitted: false },
  },
  rules: {
    '1.1': { id: '1.1', title: 'Tournament Types', text: 'rated and casual', examples: [] },
    '10.1': { id: '10.1', title: 'Participation Minimums', text: 'minimum players', examples: [] },
    'Appendix C': {
      id: 'Appendix C',
      title: 'Tiebreakers',
      text: 'match-win percentage',
      examples: [],
    },
  },
};

describe('lookup tools', () => {
  it('returns a rule with its keyword subrules and the unofficial notice', () => {
    const result = lookupRule(rules, '702.19');
    expect(result).toMatchObject({
      document: 'comprehensive-rules',
      effectiveDate: 'September 25, 2026',
      unofficial: true,
      freeUseOnly: true,
      found: true,
    });
    expect(result.rule.subrules.map((rule) => rule.id)).toEqual(['702.19a']);
    expect(result.rule.subrules[0].examples).toEqual(['Example damage.']);
  });

  it('reports a missing rule without dropping the document notice', () => {
    expect(lookupRule(rules, '999.1')).toMatchObject({
      found: false,
      id: '999.1',
      unofficial: true,
    });
  });

  it('returns an exact glossary term and suggests nearby terms', () => {
    expect(lookupGlossaryTerm(rules, 'trample').entry).toEqual({
      term: 'Trample',
      text: 'A keyword ability.',
    });
    expect(lookupGlossaryTerm(rules, 'tram').suggestions).toEqual(['Trample']);
  });

  it('keeps a tournament chapter query inside that chapter', () => {
    expect(lookupRule(tournament, 'Appendix C')).toMatchObject({
      document: 'tournament-rules',
      effectiveDate: 'February 27, 2026',
      found: true,
      rule: { id: 'Appendix C', title: 'Tiebreakers' },
    });
    expect(
      searchDocument(tournament, '1', 20, { numericBoundary: true }).matches.map((rule) => rule.id),
    ).toEqual(['1.1']);
  });

  it('caps a search at 20 matches', () => {
    const many = {
      ...rules,
      rules: Object.fromEntries(
        Array.from({ length: 25 }, (_, index) => {
          const id = `100.${index + 1}`;
          return [id, { id, text: 'shared wording', examples: [] }];
        }),
      ),
    };
    expect(searchDocument(many, 'shared', 100).matches).toHaveLength(20);
  });
});

describe('WebMCP registration', () => {
  it('registers both documents and returns their official wording', async () => {
    const registered = [];
    const modelContext = {
      async registerTool(tool, options) {
        registered.push({ tool, options });
      },
    };
    const signal = new AbortController().signal;

    const names = await registerLookupTools(modelContext, {
      rulesDocument: rules,
      tournamentDocument: tournament,
      signal,
    });

    expect(names).toEqual([
      'lookup-rule',
      'search-rules',
      'lookup-glossary',
      'lookup-tournament-rule',
      'search-tournament-rules',
    ]);
    expect(registered[0].options.signal).toBe(signal);
    const lookup = registered.find((item) => item.tool.name === 'lookup-rule');
    await expect(lookup.tool.execute({ id: '704.5f' })).resolves.toMatchObject({
      found: true,
      rule: { id: '704.5f' },
    });
    const search = registered.find((item) => item.tool.name === 'search-tournament-rules');
    await expect(search.tool.execute({ query: '1' })).resolves.toMatchObject({
      matches: [{ id: '1.1', title: 'Tournament Types' }],
    });
  });

  it('does nothing when the browser has no model context', async () => {
    await expect(registerLookupTools(undefined, { rulesDocument: rules })).resolves.toEqual([]);
  });
});
