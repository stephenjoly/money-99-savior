// server/src/utils/ofxProcessor.ts

import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DOMParser } from 'xmldom'; // You'll need to install this package

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
function isXmlFormat(content: string): boolean {
  return content.includes('</') || content.includes('/>');
}

// Extract transactions from XML format OFX
function extractTransactionsFromXml(content: string): any[] {
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

// Extract transactions from SGML format OFX (no closing tags)
function extractTransactionsFromSgml(content: string): any[] {
  const transactions: any[] = [];
  const regex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|$)/g;
  
  let match;
  while ((match = regex.exec(content)) !== null) {
    const transactionBlock = match[1];
    const transaction: any = {};
    
    // Extract transaction details
    const typeMatch = /<TRNTYPE>(.*?)(?=\n|<|$)/m.exec(transactionBlock);
    const dateMatch = /<DTPOSTED>(.*?)(?=\n|<|$)/m.exec(transactionBlock);
    const amountMatch = /<TRNAMT>(.*?)(?=\n|<|$)/m.exec(transactionBlock);
    const idMatch = /<FITID>(.*?)(?=\n|<|$)/m.exec(transactionBlock);
    const nameMatch = /<NAME>(.*?)(?=\n|<|$)/m.exec(transactionBlock);
    
    if (typeMatch) transaction.type = typeMatch[1].trim();
    if (dateMatch) transaction.date = dateMatch[1].trim();
    if (amountMatch) transaction.amount = parseFloat(amountMatch[1].trim());
    if (idMatch) transaction.id = idMatch[1].trim();
    if (nameMatch) transaction.name = nameMatch[1].trim();
    
    transactions.push(transaction);
  }
  
  return transactions;
}

// Function to extract transactions from OFX content
function extractTransactions(content: string): any[] {
  // Determine which format we're dealing with
  if (isXmlFormat(content)) {
    return extractTransactionsFromXml(content);
  } else {
    return extractTransactionsFromSgml(content);
  }
}

// Function to truncate NAME fields in OFX content
function truncateNameFields(content: string): { 
  processedContent: string;
  truncatedNames: { original: string; truncated: string }[];
} {
  const truncatedNames: { original: string; truncated: string }[] = [];
  let modifiedContent = content;
  
  // Handle XML format with closing tags
  if (isXmlFormat(content)) {
    const nameRegex = /<NAME>(.*?)<\/NAME>/g;
    let match;
    
    while ((match = nameRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const nameValue = match[1].trim();
      
      if (nameValue.length > 33) {
        const truncatedName = nameValue.substring(0, 33);
        const newNameTag = `<NAME>${truncatedName}</NAME>`;
        
        // Replace in the modified content
        modifiedContent = modifiedContent.replace(fullMatch, newNameTag);
        
        truncatedNames.push({
          original: nameValue,
          truncated: truncatedName
        });
      }
    }
  } 
  // Handle SGML format without closing tags
  else {
    const nameRegex = /<NAME>(.*?)(?=\n|<|$)/gm;
    let match;
    
    while ((match = nameRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const nameValue = match[1].trim();
      
      if (nameValue.length > 33) {
        const truncatedName = nameValue.substring(0, 33);
        const newNameTag = `<NAME>${truncatedName}`;
        
        // Replace in the modified content
        modifiedContent = modifiedContent.replace(fullMatch, newNameTag);
        
        truncatedNames.push({
          original: nameValue,
          truncated: truncatedName
        });
      }
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
  
  // Process for XML format (with closing tags)
  if (isXmlFormat(content)) {
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
  // Process for SGML format (without closing tags)
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
  // Convert buffer to string
  let content = fileBuffer.toString('utf-8');
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
  const transactions = extractTransactions(content);
  
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