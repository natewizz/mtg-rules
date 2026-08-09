import { compareRuleIds } from './rule-id.js';
import type { RulesDocument } from './types.js';

function sortValue(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => (parentKey === 'rules' ? compareRuleIds(a, b) : a.localeCompare(b)))
        .map(([key, entry]) => [key, sortValue(entry, key)]),
    );
  }
  return value;
}

export function stringifyRules(document: RulesDocument): string {
  return `${JSON.stringify(sortValue(document), null, 2)}\n`;
}
