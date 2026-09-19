// client/src/types.ts

/** A single change made to one transaction's name, in the order it was applied. */
export interface TransactionEdit {
  kind: "renamed" | "shortened";
  from: string;
  to: string;
  rule?: string;
}

export interface Transaction {
  type: string;
  date: string;
  amount: number;
  id: string;
  name: string;
  /** Present only when this transaction's name was changed. */
  edits?: TransactionEdit[];
}

export interface ProcessingStats {
  replacements: {
    pattern: string;
    count: number;
    examples: string[];
  }[];
  truncatedNames: {
    original: string;
    truncated: string;
  }[];
  removedTags: {
    tagName: string;
    count: number;
  }[];
  /** Merchant rules that matched, with counts, so the rules page can show usage. */
  ruleStats: {
    pattern: string;
    count: number;
    examples: string[];
  }[];
}

export interface ProcessedFile {
  filename: string;
  transactions: Transaction[];
  processedContent: string;
  processingStats: ProcessingStats;
  isXmlFormat: boolean;
}

export interface MerchantRule {
  pattern: string;
  replacement: string;
}

export interface RuleLimits {
  maxRules: number;
  maxPatternLength: number;
  maxReplacementLength: number;
}

/** One rule's match count from the last processed file. */
export interface RuleUsageStat {
  pattern: string;
  count: number;
  examples: string[];
}

export interface RulesResponse {
  merchantRules: MerchantRule[];
  maxNameLength: number;
  removedTags: string[];
  limits: RuleLimits;
}
