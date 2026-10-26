export const COMPLETE_GENERATED_DOCUMENT = 'complete-generated-document';
export const COMPLETE_GENERATED_TOURNAMENT_RULES = 'complete-generated-tournament-rules';

function assertNotices(document) {
  const notices = document.metadata.notices;
  if (!notices?.unofficial || !notices.freeUseOnly || notices.commercialUsePermitted !== false) {
    throw new Error('This JSON is missing the required unofficial, free-use notices.');
  }
  return document;
}

function assertDocumentShape(document) {
  if (!document || typeof document !== 'object' || !document.metadata || !document.rules) {
    throw new Error('This file is not a generated mtg-rules document.');
  }
}

export function validateViewerDocument(document) {
  assertDocumentShape(document);
  if (document.metadata.dataProfile !== COMPLETE_GENERATED_DOCUMENT) {
    throw new Error('This JSON is not a packaged complete-generated-document artifact.');
  }
  return assertNotices(document);
}

export function validateTournamentDocument(document) {
  assertDocumentShape(document);
  if (document.metadata.dataProfile !== COMPLETE_GENERATED_TOURNAMENT_RULES) {
    throw new Error('This JSON is not a packaged tournament-rules artifact.');
  }
  return assertNotices(document);
}

export function getRule(document, id) {
  return document.rules[id];
}

function idMatches(id, needle, numericBoundary) {
  if (id === needle) return true;
  if (numericBoundary && /^\d+$/.test(needle)) return id.startsWith(`${needle}.`);
  return id.startsWith(needle);
}

export function searchRules(document, query, limit = 50, options = {}) {
  const raw = query.trim();
  if (!raw) return [];

  const exact = document.rules[raw];
  const needle = raw.toLowerCase();
  const numericBoundary = options.numericBoundary === true;
  const matches = [];
  if (exact) matches.push(exact);

  for (const rule of Object.values(document.rules)) {
    if (exact && rule.id === exact.id) continue;
    const id = rule.id.toLowerCase();
    const text = rule.text.toLowerCase();
    const title = (rule.title || '').toLowerCase();
    if (idMatches(id, needle, numericBoundary) || text.includes(needle) || title.includes(needle)) {
      matches.push(rule);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

export function searchGlossary(document, query, limit = 20) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const matches = [];
  for (const entry of Object.values(document.glossary ?? {})) {
    if (entry.term.toLowerCase().includes(needle) || entry.text.toLowerCase().includes(needle)) {
      matches.push(entry);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
