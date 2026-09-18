// server/src/utils/ofxProcessor.ts

import * as path from 'path';

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

// Regex patterns for transaction descriptions
const regexPatterns: [RegExp, string][] = [
  [/AMZN MKTP [A-Z0-9]+ WWWAMAZONC/g, 'AMAZON'],
  [/PRESTO FARE[A-Z0-9]+ TORONTO/g, 'PRESTO'],
  [/PRESTO APPL[A-Z0-9]+ TORONTO/g, 'PRESTO'],
  [/PAYPAL ALIPAYCANAD \d+/g, 'PAYPAL'],
  [/COSTCO WHOLESALE W\d+/g, 'COSTCO'],
  [/LCBORAO \d+ [A-Z]+ [A-Z]+/g, 'LCBO'],
  [/SS LOBLAW [A-Z]+ [A-Z]+/g, 'LOBLAWS'],
  [/AMAZON[A-Z0-9]+ AMAZONCA/g, 'AMAZON']
];

// The merchant rename rules, in a shape the client can render on the rules page.
export interface MerchantRule {
  pattern: string;
  replacement: string;
}

export function getMerchantRules(): MerchantRule[] {
  return regexPatterns.map(([pattern, replacement]) => ({
    pattern: pattern.source,
    replacement
  }));
}

// A single change made to one transaction's name, in the order it was applied.
export interface TransactionEdit {
  kind: 'renamed' | 'shortened';
  from: string;
  to: string;
  rule?: string;
}

// Replay the name pipeline against a single NAME value so each change can be
// attributed to the transaction it happened to. The order here must match the
// order processOfxFile applies them in: plain substitutions, merchant rules,
// then truncation.
export function computeNameEdits(originalName: string): {
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

  for (const [pattern, replacement] of regexPatterns) {
    // These are /g regexes; use replace rather than test so lastIndex is never
    // carried between calls.
    const next = name.replace(pattern, replacement);
    if (next !== name) {
      edits.push({ kind: 'renamed', from: name, to: next, rule: pattern.source });
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

// Update the ProcessingStats interface to include removed tags
interface ProcessingStats {
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
}


// Function to determine if the file is in XML format with closing tags

// Simple function to check if NAME elements have closing tags
function hasNameClosingTags(content: string): boolean {
  return content.includes('</NAME>');
}

// Extract transactions from XML format OFX
function extractTransactions(content: string): any[] {
  const transactions: any[] = [];
  
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
      const transaction: any = {};
      
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
      
      transactions.push(transaction);
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
  const tagsToRemove = ['SIC', 'CORRECTFITID'];
  const removedTags: { tagName: string; count: number }[] = [];
  let modifiedContent = content;
  
  // Process for closing tag format
  if (hasNameClosingTags(content)) {
    for (const tag of tagsToRemove) {
      const regex = new RegExp(`<${tag}>.*?<\/${tag}>\\s*`, 'g');
      
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


export interface ProcessedTransaction {
  type: string;
  date: string;
  amount: number;
  id: string;
  name: string;
  /** Present only when this transaction's name was changed. */
  edits?: TransactionEdit[];
}

// Process OFX file
export async function processOfxFile(fileBuffer: Buffer): Promise<{
  processedContent: string;
  transactions: ProcessedTransaction[];
  processingStats: ProcessingStats;
}> {

  // Convert buffer to string
  const originalContent = fileBuffer.toString('utf-8');
  let content = originalContent;

  // Read the transactions before anything is rewritten so each edit can be tied
  // back to the transaction it happened to. Processing never adds or removes a
  // STMTTRN block, so the two extractions line up by index.
  const originalTransactions = extractTransactions(originalContent);
  
  const processingStats: ProcessingStats = {
    replacements: [],
    truncatedNames: [],
    removedTags: []
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
  
  // Apply regex patterns
  for (const [pattern, replacement] of regexPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      processingStats.replacements.push({
        pattern: pattern.toString(),
        count: matches.length,
        examples: matches.slice(0, 3) // Keep up to 3 examples
      });
      content = content.replace(pattern, replacement);
    }
  }
  
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
  const transactions: ProcessedTransaction[] = extractTransactions(content);

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

    const { edits } = computeNameEdits(original.name);
    if (edits.length > 0) {
      transaction.edits = edits;
    }
  });

  return {
    processedContent: content,
    transactions,
    processingStats
  };
}

// Validate file type
export function validateFileType(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return ['.ofx', '.qfx', '.qbo'].includes(ext);
}
