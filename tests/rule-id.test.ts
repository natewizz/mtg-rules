import { describe, expect, it } from 'vitest';
import { compareRuleIds, isRuleId, parseRuleId, parentRuleId } from '../src/rule-id.js';

describe('rule ID utilities', () => {
  it('parses major, numbered, and lettered IDs', () => {
    expect(parseRuleId('704')).toEqual({ raw: '704', section: 704 });
    expect(parseRuleId('704.5')).toEqual({ raw: '704.5', section: 704, rule: 5 });
    expect(parseRuleId('704.5f')).toEqual({
      raw: '704.5f',
      section: 704,
      rule: 5,
      suffix: 'f',
      parent: '704.5',
    });
    expect(parseRuleId('903.10')).toEqual({ raw: '903.10', section: 903, rule: 10 });
  });

  it('validates IDs and computes parents', () => {
    expect(isRuleId('704')).toBe(true);
    expect(isRuleId('704.5')).toBe(true);
    expect(isRuleId('704.5f')).toBe(true);
    expect(isRuleId('704.')).toBe(false);
    expect(isRuleId('704.5.1')).toBe(false);
    expect(parentRuleId('704')).toBeUndefined();
    expect(parentRuleId('704.5')).toBeUndefined();
    expect(parentRuleId('704.5f')).toBe('704.5');
    expect(() => parseRuleId('not-a-rule')).toThrow('Invalid rule ID');
  });

  it('orders IDs canonically', () => {
    expect(['704.10', '704.5f', '704', '704.5'].sort(compareRuleIds)).toEqual([
      '704',
      '704.5',
      '704.5f',
      '704.10',
    ]);
  });
});
