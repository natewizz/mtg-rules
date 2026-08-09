export interface ParsedRuleId {
  raw: string;
  section: number;
  rule?: number;
  suffix?: string;
  parent?: string;
}

const RULE_ID = /^(\d+)(?:\.(\d+))?([a-z]+)?$/;

export function isRuleId(value: string): boolean {
  return RULE_ID.test(value);
}

export function parseRuleId(value: string): ParsedRuleId {
  const match = value.match(RULE_ID);
  if (!match) throw new Error(`Invalid rule ID: ${value}`);

  const section = Number(match[1]);
  const rule = match[2] === undefined ? undefined : Number(match[2]);
  const suffix = match[3];
  const parent = suffix ? `${section}.${rule}` : undefined;

  return {
    raw: value,
    section,
    ...(rule === undefined ? {} : { rule }),
    ...(suffix === undefined ? {} : { suffix }),
    ...(parent === undefined ? {} : { parent }),
  };
}

export function parentRuleId(value: string): string | undefined {
  return parseRuleId(value).parent;
}

function compareSuffix(left: string | undefined, right: string | undefined): number {
  if (left === undefined && right !== undefined) return -1;
  if (left !== undefined && right === undefined) return 1;
  if (left === undefined && right === undefined) return 0;
  if (left === undefined || right === undefined) return 0;

  const value = (suffix: string): number => {
    let result = 0;
    for (const character of suffix) result = result * 26 + character.charCodeAt(0) - 96;
    return result;
  };
  return value(left) - value(right);
}

export function compareRuleIds(a: string, b: string): number {
  const left = parseRuleId(a);
  const right = parseRuleId(b);

  if (left.section !== right.section) return left.section - right.section;
  if (left.rule === undefined && right.rule !== undefined) return -1;
  if (left.rule !== undefined && right.rule === undefined) return 1;
  if (left.rule !== right.rule) return (left.rule ?? 0) - (right.rule ?? 0);
  return compareSuffix(left.suffix, right.suffix);
}

export interface ParsedRuleLine {
  id: string;
  text: string;
}

/** Parse a source line that may contain a Wizards-style rule ID and text. */
export function parseRuleLine(line: string): ParsedRuleLine | undefined {
  const match = line.trim().match(/^(\S+?)(?:\.)?\s+(.+)$/);
  const token = match?.[1]?.replace(/\.$/, '');
  const text = match?.[2];
  if (!token || !text || !isRuleId(token) || !token.includes('.')) return undefined;
  return { id: token, text };
}
