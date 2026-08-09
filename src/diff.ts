import { compareRuleIds } from './rule-id.js';
import type { RulesDiff, RulesDocument, SourceProvenance } from './types.js';

function sortedIds(ids: Iterable<string>): string[] {
  return [...ids].sort(compareRuleIds);
}

function provenance(document: RulesDocument): SourceProvenance | undefined {
  return document.metadata.provenance;
}

export function diffRules(oldDocument: RulesDocument, newDocument: RulesDocument): RulesDiff {
  const oldIds = new Set(Object.keys(oldDocument.rules));
  const newIds = new Set(Object.keys(newDocument.rules));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const id of newIds) {
    if (!oldIds.has(id)) added.push(id);
    else if (oldDocument.rules[id]?.hash !== newDocument.rules[id]?.hash) changed.push(id);
    else unchanged.push(id);
  }
  for (const id of oldIds) if (!newIds.has(id)) removed.push(id);

  const result: RulesDiff = {
    added: sortedIds(added),
    removed: sortedIds(removed),
    changed: sortedIds(changed),
    unchanged: sortedIds(unchanged),
  };
  const oldSource = provenance(oldDocument);
  const newSource = provenance(newDocument);
  if (oldSource) result.oldSource = oldSource;
  if (newSource) result.newSource = newSource;
  return result;
}
