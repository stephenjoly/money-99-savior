// client/src/summary.ts
import type { ProcessedFile } from "./types";

export interface FileSummary {
  renamed: number;
  shortened: number;
  tagsStripped: number;
  headerRewritten: number;
  /** Transactions carrying at least one edit. */
  changedTransactions: number;
  /** Everything above, so the headline number matches the breakdown beneath it. */
  totalCorrections: number;
}

const HEADER_PATTERN_PREFIX = "<?xml version=";

export function summarize(file: ProcessedFile): FileSummary {
  let renamed = 0;
  let shortened = 0;
  let changedTransactions = 0;

  for (const transaction of file.transactions) {
    if (!transaction.edits?.length) continue;
    changedTransactions += 1;
    for (const edit of transaction.edits) {
      if (edit.kind === "renamed") renamed += 1;
      else shortened += 1;
    }
  }

  const tagsStripped = file.processingStats.removedTags.reduce(
    (total, tag) => total + tag.count,
    0
  );

  const headerRewritten = file.processingStats.replacements
    .filter((replacement) => replacement.pattern.startsWith(HEADER_PATTERN_PREFIX))
    .reduce((total, replacement) => total + replacement.count, 0);

  return {
    renamed,
    shortened,
    tagsStripped,
    headerRewritten,
    changedTransactions,
    totalCorrections: renamed + shortened + tagsStripped + headerRewritten,
  };
}

/** Format an OFX date (YYYYMMDD[HHMMSS]) as MM/DD. */
export function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  if (dateStr.length >= 8) {
    return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
  }
  return dateStr;
}

export function formatAmount(amount: number): string {
  const formatted = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? "−" : "+"}${formatted}`;
}
