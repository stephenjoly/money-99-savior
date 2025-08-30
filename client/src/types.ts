// client/src/types.ts
export interface Transaction {
  type: string;
  date: string;
  amount: number;
  id: string;
  name: string;
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
}

export interface ProcessedFile {
  filename: string;
  transactions: Transaction[];
  processedContent: string;
  processingStats: ProcessingStats;
  isXmlFormat: boolean;
}