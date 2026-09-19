// client/src/ruleStore.ts
import type { MerchantRule, RuleLimits, RuleUsageStat } from "./types";

/**
 * Rules live in this browser, never on the server. localStorage is the store of
 * record; uploads carry a copy so processing stays stateless and a request
 * cannot see another visitor's rules.
 */
const RULES_KEY = "money99.merchantRules.v1";
const USAGE_KEY = "money99.ruleUsage.v1";

export const DEFAULT_LIMITS: RuleLimits = {
  maxRules: 50,
  maxPatternLength: 200,
  maxReplacementLength: 200,
};

export interface StoredRules {
  rules: MerchantRule[];
  /**
   * False until the user has actually changed something. While false the page
   * uses the server defaults, so a later deploy can improve them without the
   * visitor being pinned to a stale copy.
   */
  customized: boolean;
}

const EMPTY: StoredRules = { rules: [], customized: false };

// localStorage throws in private-mode Safari and when the quota is exhausted.
function readJSON<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A rules edit that cannot persist still applies for this session.
  }
}

export function loadStoredRules(): StoredRules {
  const stored = readJSON<StoredRules>(RULES_KEY);
  if (!stored || stored.customized !== true || !Array.isArray(stored.rules)) {
    return EMPTY;
  }
  return stored;
}

export function saveStoredRules(rules: MerchantRule[]): void {
  writeJSON(RULES_KEY, { rules, customized: true });
}

export function clearStoredRules(): void {
  try {
    window.localStorage.removeItem(RULES_KEY);
  } catch {
    // Nothing to do; the caller falls back to the defaults either way.
  }
}

/**
 * What an upload should send. Null means "no opinion" so the server applies its
 * own defaults rather than a stale copy of them.
 */
export function getRulesForUpload(): MerchantRule[] | null {
  const stored = loadStoredRules();
  return stored.customized ? stored.rules : null;
}

export function getRuleUsage(): Record<string, number> {
  return readJSON<Record<string, number>>(USAGE_KEY) ?? {};
}

export function recordRuleUsage(stats: RuleUsageStat[]): void {
  if (!stats.length) return;
  const usage = getRuleUsage();
  for (const stat of stats) {
    usage[stat.pattern] = (usage[stat.pattern] ?? 0) + stat.count;
  }
  writeJSON(USAGE_KEY, usage);
}

// Catastrophic backtracking needs a quantified group that itself contains a
// quantifier, e.g. (A+)+. The server re-checks everything; this is for instant
// feedback while typing.
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.)*[*+{](?:[^()\\]|\\.)*\)\s*[*+{]/;

/** Returns a user-facing error, or null when the rule is usable. */
export function validateRule(
  pattern: string,
  replacement: string,
  limits: RuleLimits = DEFAULT_LIMITS
): string | null {
  if (!pattern) return "Enter a pattern to match.";
  if (pattern.length > limits.maxPatternLength) {
    return `Patterns are limited to ${limits.maxPatternLength} characters.`;
  }
  if (replacement.length > limits.maxReplacementLength) {
    return `Replacements are limited to ${limits.maxReplacementLength} characters.`;
  }
  if (NESTED_QUANTIFIER.test(pattern)) {
    return "That pattern has nested repetition and could hang processing.";
  }
  try {
    new RegExp(pattern);
  } catch {
    return "That isn't a valid regular expression.";
  }
  return null;
}

export interface RulePreview {
  from: string;
  to: string;
}

/**
 * Show what a rule would do to names from the last file, without touching the
 * file. Returns null when the pattern cannot be compiled.
 */
export function previewRule(
  pattern: string,
  replacement: string,
  names: string[]
): RulePreview[] | null {
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "g");
  } catch {
    return null;
  }

  const previews: RulePreview[] = [];
  for (const name of names) {
    const to = name.replace(regex, replacement);
    if (to !== name) {
      previews.push({ from: name, to });
      if (previews.length === 3) break;
    }
  }
  return previews;
}

// Names from the most recently processed file, kept in memory only so rule
// previews can show real examples. Nothing here is persisted or sent anywhere.
let lastSeenNames: string[] = [];

export function rememberNames(names: string[]): void {
  lastSeenNames = names;
}

export function getRememberedNames(): string[] {
  return lastSeenNames;
}

/** Parse an exported rules file. Throws with a user-facing message. */export function parseImportedRules(
  text: string,
  limits: RuleLimits = DEFAULT_LIMITS
): MerchantRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array of rules.");
  }
  if (parsed.length > limits.maxRules) {
    throw new Error(`Too many rules (max ${limits.maxRules}).`);
  }

  return parsed.map((entry, index) => {
    const { pattern, replacement } = (entry ?? {}) as {
      pattern?: unknown;
      replacement?: unknown;
    };
    if (typeof pattern !== "string" || typeof replacement !== "string") {
      throw new Error(`Rule ${index + 1} needs a pattern and a replacement.`);
    }
    const error = validateRule(pattern, replacement, limits);
    if (error) {
      throw new Error(`Rule ${index + 1}: ${error}`);
    }
    return { pattern, replacement };
  });
}
