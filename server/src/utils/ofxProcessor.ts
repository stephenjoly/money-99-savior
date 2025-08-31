// server/src/utils/ofxProcessor.ts

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DOMParser } from 'xmldom'; 

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);


// Default replacements from the Python code
const replacements: Record<string, string> = {
  '<ACCTTYPE>CREDITLINE': '',
  '&': '',
  '<?xml version="1.0" standalone="no"?><OFX OFXHEADER="200" VERSION="202" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>':
    "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE",
  '<?xml version="1.0" standalone="no"?><?OFX OFXHEADER="200" VERSION="202" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>':
    "OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nSECURITY:NONE\nENCODING:USASCII\nCHARSET:1252\nCOMPRESSION:NONE\nOLDFILEUID:NONE\nNEWFILEUID:NONE",
};

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
  const hasNameClosingTag = content.includes('</NAME>');
  console.log("Format detection: has </NAME> closing tags =", hasNameClosingTag);
  return hasNameClosingTag;
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
  console.log("=== Starting NAME field truncation ===");
  
  const truncatedNames: { original: string; truncated: string }[] = [];
  let modifiedContent = content;
  const hasClosingTags = hasNameClosingTags(content);
  
  // Define a helper function to truncate a name value
  const performTruncation = (nameValue: string, maxLength: number = 32): string => {
    // // Log the exact character count
    // console.log(`Checking name: "${nameValue}" (length: ${nameValue.length})`);
    
    if (nameValue.length > maxLength) {
      const truncatedName = nameValue.substring(0, maxLength);
      console.log(`Truncating "${nameValue}" (length: ${nameValue.length})`);
      return truncatedName;
    }
    return nameValue;
  };
  
  // Handle format with closing tags
  if (hasClosingTags) {
    console.log("Processing using closing tag format rules");
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
    console.log("Processing using non-closing tag format rules");
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
  
  console.log(`Truncation complete. Modified ${truncatedNames.length} NAME fields.`);
  
  // Add a verification step
  console.log("Verifying truncation results...");
  const verifyRegex = hasClosingTags ? 
    /<NAME>(.*?)<\/NAME>/gi : 
    /<NAME>(.*?)(?=\n|<|$)/gmi;
  
  let longNamesAfter = 0;
  let match;
  while ((match = verifyRegex.exec(modifiedContent)) !== null) {
    const nameValue = match[1].trim();
    if (nameValue.length > 32) {
      longNamesAfter++;
      console.log(`WARNING: Found name still over 32 chars after truncation: "${nameValue}" (${nameValue.length})`);
    }
  }
  
  console.log(`Verification complete. Found ${longNamesAfter} names still over 32 characters.`);
  
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


// Process OFX file
export async function processOfxFile(fileBuffer: Buffer): Promise<{
  processedContent: string;
  transactions: any[];
  processingStats: ProcessingStats;
}> {

  console.log("=== Starting OFX processing ===");
  console.log("File size:", fileBuffer.length, "bytes");
  
  // Convert buffer to string
  let content = fileBuffer.toString('utf-8');
  console.log("File encoding detected as UTF-8");
  
  const processingStats: ProcessingStats = {
    replacements: [],
    truncatedNames: [],
    removedTags: []
  };
  
  // Apply replacements
  console.log("Applying standard replacements...");
  for (const [old, newVal] of Object.entries(replacements)) {
    const regex = new RegExp(old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const matches = content.match(regex);
    if (matches && matches.length > 0) {
      console.log(`Found ${matches.length} matches for pattern: ${old.substring(0, 30)}...`);
      processingStats.replacements.push({
        pattern: old,
        count: matches.length,
        examples: matches.slice(0, 3) // Keep up to 3 examples
      });
      content = content.replace(regex, newVal);
    }
  }
  
  // Apply regex patterns
  console.log("Applying regex pattern replacements...");
  for (const [pattern, replacement] of regexPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      console.log(`Found ${matches.length} matches for pattern: ${pattern.toString()}`);
      processingStats.replacements.push({
        pattern: pattern.toString(),
        count: matches.length,
        examples: matches.slice(0, 3) // Keep up to 3 examples
      });
      content = content.replace(pattern, replacement);
    }
  }
  
  // Truncate NAME fields
  console.log("Starting NAME field truncation...");
  const nameResult = truncateNameFields(content);
  content = nameResult.processedContent;
  if (nameResult.truncatedNames.length > 0) {
    console.log(`Truncated ${nameResult.truncatedNames.length} NAME fields`);
    processingStats.truncatedNames = nameResult.truncatedNames;
  } else {
    console.log("No NAME fields required truncation");
  }
  
  // Remove unwanted tags (SIC and CORRECTFITID)
  console.log("Removing unwanted tags...");
  const tagResult = removeUnwantedTags(content);
  content = tagResult.processedContent;
  processingStats.removedTags = tagResult.removedTags;
  
  // Extract transactions
  console.log("Extracting transactions...");
  const transactions = extractTransactions(content);
  console.log(`Extracted ${transactions.length} transactions`);
  
  console.log("=== OFX processing complete ===");
  
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