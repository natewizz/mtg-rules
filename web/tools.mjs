import {
  COMPLETE_GENERATED_TOURNAMENT_RULES,
  getRule,
  glossaryEntry,
  keywordHeadingSubrules,
  searchGlossary,
  searchRules,
} from './search.mjs';

const DEFAULT_LIMIT = 20;

export function lookupRule(document, id) {
  const needle = String(id ?? '').trim();
  const rule = getRule(document, needle);
  if (!rule) return { ...describe(document), found: false, id: needle };
  return { ...describe(document), found: true, rule: publicRule(document, rule) };
}

export function searchDocument(document, query, limit = DEFAULT_LIMIT, options = {}) {
  const needle = String(query ?? '').trim();
  const matches = searchRules(document, needle, clampLimit(limit), options);
  return {
    ...describe(document),
    query: needle,
    matches: matches.map((rule) => ({
      id: rule.id,
      ...(rule.title ? { title: rule.title } : {}),
      excerpt: excerpt(rule),
    })),
  };
}

export function lookupGlossaryTerm(document, term) {
  const needle = String(term ?? '').trim();
  const entry = glossaryEntry(document, needle);
  if (!entry) {
    return {
      ...describe(document),
      found: false,
      term: needle,
      suggestions: searchGlossary(document, needle, 5).map((item) => item.term),
    };
  }
  return {
    ...describe(document),
    found: true,
    entry: { term: entry.term, text: entry.text },
  };
}

function describe(document) {
  const tournament = document?.metadata?.dataProfile === COMPLETE_GENERATED_TOURNAMENT_RULES;
  const notices = document?.metadata?.notices;
  return {
    document: tournament ? 'tournament-rules' : 'comprehensive-rules',
    effectiveDate: document?.metadata?.effectiveDate ?? '',
    unofficial: notices?.unofficial === true,
    freeUseOnly: notices?.freeUseOnly === true,
  };
}

function publicRule(document, rule) {
  const subrules = keywordHeadingSubrules(document, rule).map((item) => ({
    id: item.id,
    text: item.text,
    examples: item.examples ?? [],
  }));
  return {
    id: rule.id,
    ...(rule.title ? { title: rule.title } : {}),
    text: rule.text,
    examples: rule.examples ?? [],
    ...(Array.isArray(rule.links) && rule.links.length ? { links: rule.links } : {}),
    ...(subrules.length ? { subrules } : {}),
  };
}

function excerpt(rule) {
  const body = String(rule.text ?? '')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
  return rule.title ? `${rule.title}. ${body}` : body;
}

function clampLimit(limit) {
  const value = Number(limit);
  if (!Number.isInteger(value) || value < 1) return DEFAULT_LIMIT;
  return Math.min(value, DEFAULT_LIMIT);
}
