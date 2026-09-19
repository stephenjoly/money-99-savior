import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_LIMITS,
  parseImportedRules,
  previewRule,
  validateRule,
} from '../src/ruleStore';
import { DEFAULT_MERCHANT_RULES } from '../src/ofx/processor';
import {
  clearStoredRules,
  getEffectiveRules,
  loadStoredRules,
  saveStoredRules,
  getRuleUsage,
  recordRuleUsage,
} from '../src/ruleStore';

describe('validateRule', () => {
  it('accepts a well-formed rule', () => {
    expect(validateRule('AMZN MKTP US\\d+', 'AMAZON')).toBeNull();
  });

  it('rejects an empty pattern', () => {
    expect(validateRule('', 'X')).toMatch(/pattern/i);
  });

  it('rejects an invalid regular expression', () => {
    expect(validateRule('(unclosed', 'X')).toMatch(/valid regular expression/i);
  });

  it('rejects an over-long pattern', () => {
    expect(validateRule('A'.repeat(201), 'X')).toMatch(/too long|limited/i);
  });

  it('rejects nested repetition that could freeze the page', () => {
    expect(validateRule('(A+)+', 'X')).toMatch(/could freeze/i);
    expect(validateRule('(\\w*)*X', 'Y')).toMatch(/could freeze/i);
  });
});

describe('previewRule', () => {
  it('shows up to three names a rule would change', () => {
    const names = ['SQ *CAFE ONE', 'SQ *CAFE TWO', 'SQ *CAFE THREE', 'SQ *CAFE FOUR'];
    const previews = previewRule('^SQ \\*', 'SQUARE ', names);

    expect(previews).toHaveLength(3);
    expect(previews?.[0]).toEqual({ from: 'SQ *CAFE ONE', to: 'SQUARE CAFE ONE' });
  });

  it('returns an empty list when nothing matches', () => {
    expect(previewRule('NOPE', 'X', ['SQ *CAFE'])).toEqual([]);
  });

  it('returns null for an invalid pattern', () => {
    expect(previewRule('(unclosed', 'X', ['SQ *CAFE'])).toBeNull();
  });
});

describe('parseImportedRules', () => {
  it('parses a valid export', () => {
    const rules = parseImportedRules(
      JSON.stringify([{ pattern: '^SQ \\*', replacement: 'SQUARE ' }])
    );

    expect(rules).toEqual([{ pattern: '^SQ \\*', replacement: 'SQUARE ' }]);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseImportedRules('not json')).toThrow(/valid JSON/i);
  });

  it('rejects a non-array', () => {
    expect(() => parseImportedRules('{"pattern":"X","replacement":"Y"}')).toThrow(/array/i);
  });

  it('rejects an entry missing a field', () => {
    expect(() => parseImportedRules('[{"pattern":"X"}]')).toThrow(/pattern and a replacement/i);
  });

  it('rejects an invalid pattern inside the file', () => {
    expect(() => parseImportedRules('[{"pattern":"(unclosed","replacement":"X"}]')).toThrow(
      /Rule 1/
    );
  });

  it('rejects more rules than the limit', () => {
    const many = Array.from({ length: DEFAULT_LIMITS.maxRules + 1 }, () => ({
      pattern: 'X',
      replacement: 'Y',
    }));

    expect(() => parseImportedRules(JSON.stringify(many))).toThrow(/Too many/i);
  });
});

describe('stored rules', () => {
  beforeEach(() => {
    clearStoredRules();
  });

  it('starts uncustomized and falls back to the built-in rules', () => {
    expect(loadStoredRules().customized).toBe(false);
    expect(getEffectiveRules()).toEqual(DEFAULT_MERCHANT_RULES);
  });

  it('uses saved rules once customized', () => {
    const custom = [{ pattern: '^SQ \\*', replacement: 'SQUARE ' }];
    saveStoredRules(custom);

    expect(loadStoredRules().customized).toBe(true);
    expect(getEffectiveRules()).toEqual(custom);
  });

  it('records usage counts cumulatively', () => {
    recordRuleUsage([{ pattern: '^SQ \\*', count: 2 }]);
    recordRuleUsage([{ pattern: '^SQ \\*', count: 1 }]);

    expect(getRuleUsage()['^SQ \\*']).toBe(3);
  });
});
