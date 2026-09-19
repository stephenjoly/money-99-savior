// client/src/ofx/processor.ts
import type {
  MerchantRule,
  ProcessingStats,
  Transaction,
  TransactionEdit,
} from "../types";

/**
 * The whole cleaner runs here, in the browser. The file is read with the File
 * API and only ever exists in memory on the visitor's machine — there is no
 * upload endpoint, and the server never sees statement data.
 *
 * This module is deliberately dependency-free (no Node APIs, no DOM APIs) so
 * the same code could run in a worker or in Node tests unchanged.
 */

// Plain-text substitutions applied to the whole file before anything else.
// Keys that start with "<" are structural (headers, account types); the rest can
// appear inside a transaction NAME and therefore show up as a per-transaction edit.
const replacements: Record<string, string> = {
  '<ACCTTYPE>CREDITLINE': '',
  '&': '',
  '<?xml version="1.0" standalone="no"?><OFX OFXHEADER="200" VERSION="202" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>':
    "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE",
  '<?xml version="1.0" standalone="no"?><?OFX OFXHEADER="200" VERSION="202" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>':
    "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE",
};

// Money 99 mangles any NAME longer than this.
export const MAX_NAME_LENGTH = 32;

// The file size the uploader accepts, kept here so the UI and the processor
// agree on what "too big" means.
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Tags Money 99 aborts on, removed unconditionally.
export const REMOVED_TAGS = ['SIC', 'CORRECTFITID'];

// Merchant rename rules. These are matched against NAME values only — never the
// rest of the file — so a rule like "DEBIT" cannot rewrite a TRNTYPE. They are
// the defaults; the rules page can replace them per browser.
export const DEFAULT_MERCHANT_RULES: MerchantRule[] = [
  { pattern: 'AMZN MKTP [A-Z0-9]+ WWWAMAZONC', replacement: 'AMAZON' },
  { pattern: 'PRESTO FARE[A-Z0-9]+ TORONTO', replacement: 'PRESTO' },
  { pattern: 'PRESTO APPL[A-Z0-9]+ TORONTO', replacement: 'PRESTO' },
  { pattern: 'PAYPAL ALIPAYCANAD \\d+', replacement: 'PAYPAL' },
  { pattern: 'COSTCO WHOLESALE W\\d+', replacement: 'COSTCO' },
  { pattern: 'LCBORAO \\d+ [A-Z]+ [A-Z]+', replacement: 'LCBO' },
  { pattern: 'SS LOBLAW [A-Z]+ [A-Z]+', replacement: 'LOBLAWS' },
  { pattern: 'AMAZON[A-Z0-9]+ AMAZONCA', replacement: 'AMAZON' }
];

export function getMerchantRules(): MerchantRule[] {
  return DEFAULT_MERCHANT_RULES.map((rule) => ({ ...rule }));
}

export const MAX_MERCHANT_RULES = 50;
export const MAX_RULE_PATTERN_LENGTH = 200;
export const MAX_RULE_REPLACEMENT_LENGTH = 200;

export const RULE_LIMITS = {
  maxRules: MAX_MERCHANT_RULES,
  maxPatternLength: MAX_RULE_PATTERN_LENGTH,
  maxReplacementLength: MAX_RULE_REPLACEMENT_LENGTH,
} as const;

// A single change made to one transaction's name, in the order it was applied.
export type { TransactionEdit };

// Replay the name pipeline against a single NAME value so each change can be
// attributed to the transaction it happened to. The order here must match the
// order processOfxContent applies them in: plain substitutions, merchant rules,
// then truncation.
export function computeNameEdits(
  originalName: string,
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): {
  edits: TransactionEdit[];
  finalName: string;
} {
  const edits: TransactionEdit[] = [];
  let name = originalName;

  for (const [needle, replacement] of Object.entries(replacements)) {
    if (needle.startsWith('<')) continue; // structural, never part of a NAME
    if (!name.includes(needle)) continue;
    const next = name.split(needle).join(replacement);
    if (next !== name) {
      edits.push({ kind: 'renamed', from: name, to: next, rule: needle });
      name = next;
    }
  }

  for (const { rule, regex } of compileMerchantRules(rules)) {
    // These are /g regexes; use replace rather than test so lastIndex is never
    // carried between calls.
    const next = name.replace(regex, rule.replacement);
    if (next !== name) {
      edits.push({ kind: 'renamed', from: name, to: next, rule: rule.pattern });
      name = next;
    }
  }

  if (name.length > MAX_NAME_LENGTH) {
    const truncated = name.substring(0, MAX_NAME_LENGTH);
    edits.push({ kind: 'shortened', from: name, to: truncated });
    name = truncated;
  }

  return { edits, finalName: name };
}

interface CompiledRule {
  rule: MerchantRule;
  regex: RegExp;
}

function compileMerchantRules(rules: MerchantRule[]): CompiledRule[] {
  return rules.map((rule) => ({ rule, regex: new RegExp(rule.pattern, 'g') }));
}

// Simple function to check if NAME elements have closing tags
function hasNameClosingTags(content: string): boolean {
  return content.includes('</NAME>');
}

// Extract transactions from XML format OFX
function extractTransactions(content: string): Transaction[] {
  const transactions: Transaction[] = [];

  try {
    // First, let's try to make the content more XML-like if it's not already
    // This is for handling hybrid formats
    let processedContent = content;

    // If the file starts with OFXHEADER: it's in the older SGML format
    // We'll need to add a root element for parsing
    if (processedContent.startsWith('OFXHEADER:')) {
      // Find where the OFX content actually begins
      const ofxStartIndex = processedContent.indexOf('<OFX>');
      if (ofxStartIndex !== -1) {
        processedContent = processedContent.substring(ofxStartIndex);
      } else {
        // If no <OFX> tag, wrap the whole content
        processedContent = `<OFX>${processedContent}</OFX>`;
      }
    }

    // Use regex to extract STMTTRN blocks
    const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
    let match;

    while ((match = stmtTrnRegex.exec(processedContent)) !== null) {
      const transactionBlock = match[1];
      const transaction: Partial<Transaction> = {};

      // Extract fields with potential closing tags
      const extractField = (fieldName: string): string | null => {
        // Try with closing tag first
        const closingTagRegex = new RegExp(`<${fieldName}>(.*?)<\\/${fieldName}>`, 's');

        const closingMatch = closingTagRegex.exec(transactionBlock);

        if (closingMatch) {
          return closingMatch[1].trim();
        }

        // Try without closing tag (SGML style)
        const sgmlRegex = new RegExp(`<${fieldName}>(.*?)(?=<|$)`, 's');
        const sgmlMatch = sgmlRegex.exec(transactionBlock);

        return sgmlMatch ? sgmlMatch[1].trim() : null;
      };

      // Extract common fields
      transaction.type = extractField('TRNTYPE') || '';
      transaction.date = extractField('DTPOSTED') || '';
      transaction.amount = parseFloat(extractField('TRNAMT') || '0');
      transaction.id = extractField('FITID') || '';
      transaction.name = extractField('NAME') || '';

      transactions.push(transaction as Transaction);
    }
  } catch (error) {
    console.error('Error parsing XML format:', error);
  }

  return transactions;
}

// Function to truncate NAME fields in OFX content
function truncateNameFields(content: string): {
  processedContent: string;
  truncatedNames: { original: string; truncated: string }[];
} {
  const truncatedNames: { original: string; truncated: string }[] = [];
  let modifiedContent = content;
  const hasClosingTags = hasNameClosingTags(content);

  // Define a helper function to truncate a name value
  const performTruncation = (nameValue: string, maxLength: number = 32): string => {
    if (nameValue.length > maxLength) {
      return nameValue.substring(0, maxLength);
    }
    return nameValue;
  };

  // Handle format with closing tags
  if (hasClosingTags) {
    const nameTagRegex = /(<NAME>\s*)(.*?)(\s*<\/NAME>)/gi;
    let match;

    while ((match = nameTagRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const prefix = match[1];
      const nameValue = match[2].trim();
      const suffix = match[3];

      const truncatedName = performTruncation(nameValue, 32);

      if (truncatedName !== nameValue) {
        const newNameTag = `${prefix}${truncatedName}${suffix}`;
        // Use direct string replacement
        modifiedContent = modifiedContent.replace(fullMatch, newNameTag);

        truncatedNames.push({
          original: nameValue,
          truncated: truncatedName
        });
      }
    }
  }
  // Handle format without closing tags
  else {
    const nameTagRegex = /(<NAME>\s*)(.*?)(?=\n|<|$)/gmi;
    let match;

    while ((match = nameTagRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const prefix = match[1];
      const nameValue = match[2].trim();

      const truncatedName = performTruncation(nameValue, 32);

      if (truncatedName !== nameValue) {
        const newNameTag = `${prefix}${truncatedName}`;

        // Use direct string replacement
        modifiedContent = modifiedContent.replace(fullMatch, newNameTag);

        truncatedNames.push({
          original: nameValue,
          truncated: truncatedName
        });
      }
    }
  }

  // Verification step: warn if any NAME still exceeds the limit
  const verifyRegex = hasClosingTags ?
    /<NAME>(.*?)<\/NAME>/gi :
    /<NAME>(.*?)(?=\n|<|$)/gmi;

  let match;
  while ((match = verifyRegex.exec(modifiedContent)) !== null) {
    const nameValue = match[1].trim();
    if (nameValue.length > 32) {
      console.warn(`WARNING: Found name still over 32 chars after truncation: "${nameValue}" (${nameValue.length})`);
    }
  }

  return {
    processedContent: modifiedContent,
    truncatedNames
  };
}

// Add a function to remove specific tags from OFX content
function removeUnwantedTags(content: string): {
  processedContent: string;
  removedTags: {
    tagName: string;
    count: number;
  }[];
} {
  const tagsToRemove = REMOVED_TAGS;
  const removedTags: { tagName: string; count: number }[] = [];
  let modifiedContent = content;

  // Process for closing tag format
  if (hasNameClosingTags(content)) {
    for (const tag of tagsToRemove) {
      const regex = new RegExp(`<${tag}>.*?</${tag}>\\s*`, 'g');

      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        removedTags.push({
          tagName: tag,
          count: matches.length
        });

        modifiedContent = modifiedContent.replace(regex, '');
      }
    }
  }
  // Process for non-closing tag format
  else {
    for (const tag of tagsToRemove) {
      const regex = new RegExp(`<${tag}>.*?(?=\\n|<)\\s*`, 'g');
      const matches = content.match(regex);

      if (matches && matches.length > 0) {
        removedTags.push({
          tagName: tag,
          count: matches.length
        });

        modifiedContent = modifiedContent.replace(regex, '');
      }
    }
  }

  return {
    processedContent: modifiedContent,
    removedTags
  };
}

// Apply merchant rules to NAME values only. Returns per-rule usage counts so the
// rules page can show which rules did anything.
function applyMerchantRules(content: string, rules: MerchantRule[]): {
  processedContent: string;
  ruleStats: { pattern: string; count: number; examples: string[] }[];
} {
  const compiled = compileMerchantRules(rules);
  const stats = compiled.map(() => ({ count: 0, examples: [] as string[] }));
  const hasClosingTags = hasNameClosingTags(content);
  const nameTagRegex = hasClosingTags
    ? /(<NAME>\s*)(.*?)(\s*<\/NAME>)/gi
    : /(<NAME>\s*)(.*?)(?=\n|<|$)/gmi;

  const processedContent = content.replace(
    nameTagRegex,
    (fullMatch: string, prefix: string, rawValue: string, suffix: string) => {
      const nameValue = rawValue.trim();
      let next = nameValue;

      compiled.forEach(({ rule, regex }, index) => {
        const replaced = next.replace(regex, rule.replacement);
        if (replaced !== next) {
          stats[index].count += 1;
          if (stats[index].examples.length < 3) {
            stats[index].examples.push(nameValue);
          }
          next = replaced;
        }
      });

      if (next === nameValue) {
        return fullMatch;
      }
      return hasClosingTags ? `${prefix}${next}${suffix}` : `${prefix}${next}`;
    }
  );

  return {
    processedContent,
    ruleStats: compiled
      .map(({ rule }, index) => ({
        pattern: rule.pattern,
        count: stats[index].count,
        examples: stats[index].examples
      }))
      .filter((stat) => stat.count > 0)
  };
}

export interface ProcessedContent {
  processedContent: string;
  transactions: Transaction[];
  processingStats: ProcessingStats;
  isXmlFormat: boolean;
}

// Does this look like an OFX 2.x XML document rather than SGML? Matches the
// heuristic the server used before processing moved into the browser.
export function isXmlFormat(content: string): boolean {
  return content.includes('</') || content.includes('/>');
}

// Clean an OFX file held as text. Pure and synchronous; the caller owns the
// file bytes and nothing is sent anywhere.
export function processOfxContent(
  originalContent: string,
  merchantRules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): ProcessedContent {
  let content = originalContent;

  // Read the transactions before anything is rewritten so each edit can be tied
  // back to the transaction it happened to. Processing never adds or removes a
  // STMTTRN block, so the two extractions line up by index.
  const originalTransactions = extractTransactions(originalContent);

  const processingStats: ProcessingStats = {
    replacements: [],
    truncatedNames: [],
    removedTags: [],
    ruleStats: []
  };

  // Apply replacements
  for (const [old, newVal] of Object.entries(replacements)) {
    const regex = new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      processingStats.replacements.push({
        pattern: old,
        count: matches.length,
        examples: matches.slice(0, 3) // Keep up to 3 examples
      });
      content = content.replace(regex, newVal);
    }
  }

  // Apply merchant rules to NAME values, using the caller's list if given.
  const ruleResult = applyMerchantRules(content, merchantRules);
  content = ruleResult.processedContent;
  processingStats.ruleStats = ruleResult.ruleStats;

  // Truncate NAME fields
  const nameResult = truncateNameFields(content);
  content = nameResult.processedContent;
  if (nameResult.truncatedNames.length > 0) {
    processingStats.truncatedNames = nameResult.truncatedNames;
  }

  // Remove unwanted tags (SIC and CORRECTFITID)
  const tagResult = removeUnwantedTags(content);
  content = tagResult.processedContent;
  processingStats.removedTags = tagResult.removedTags;

  // Extract transactions
  const transactions: Transaction[] = extractTransactions(content);

  // Attach the per-transaction edit trail. If the two extractions disagree on
  // length something upstream changed the block count, so fall back to matching
  // on FITID and leave anything unmatched un-annotated rather than mislabel it.
  const alignedByIndex = originalTransactions.length === transactions.length;
  const originalById = new Map(
    originalTransactions.filter((t) => t.id).map((t) => [t.id, t])
  );

  transactions.forEach((transaction, index) => {
    const original = alignedByIndex
      ? originalTransactions[index]
      : originalById.get(transaction.id);

    if (!original || typeof original.name !== 'string') {
      return;
    }

    const { edits } = computeNameEdits(original.name, merchantRules);
    if (edits.length > 0) {
      transaction.edits = edits;
    }
  });

  return {
    processedContent: content,
    transactions,
    processingStats,
    isXmlFormat: isXmlFormat(originalContent)
  };
}

// Validate file type
export function validateFileType(filename: string): boolean {
  return /\.(ofx|qfx|qbo)$/i.test(filename);
}
