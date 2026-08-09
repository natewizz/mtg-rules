import type { RulesDocument } from './types.js';

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, sortValue(entry)]),
    );
  }
  return value;
}

export function stringifyRules(document: RulesDocument): string {
  return `${JSON.stringify(sortValue(document), null, 2)}\n`;
}
