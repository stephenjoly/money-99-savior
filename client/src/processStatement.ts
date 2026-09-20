// client/src/processStatement.ts
import type { ProcessedFile } from "./types";
import { getEffectiveRules, recordRuleUsage, rememberNames } from "./ruleStore";
import { processOfxContent } from "./ofx/processor";

/**
 * Run the browser-side cleaner on already-read statement text and update the
 * local rule-usage / name-preview caches. Shared by the first upload and by
 * "Reapply rules" so both paths stay identical.
 */
export function processStatement(
  filename: string,
  content: string
): ProcessedFile {
  const result = processOfxContent(content, getEffectiveRules());
  const processed: ProcessedFile = {
    filename,
    ...result,
  };

  recordRuleUsage(processed.processingStats.ruleStats ?? []);
  // Prefer each transaction's original name so previews show what the raw
  // statement looked like, not an already-renamed result.
  rememberNames(
    processed.transactions.map(
      (transaction) => transaction.edits?.[0]?.from ?? transaction.name
    )
  );

  return processed;
}
