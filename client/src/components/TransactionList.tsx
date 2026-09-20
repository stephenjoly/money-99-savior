// client/src/components/TransactionList.tsx
import React, { useState } from "react";
import type { Transaction } from "../types";
import { formatAmount, formatDate } from "../summary";
import { EASE_OUT, MOTION, useHasEntered, usePrefersReducedMotion } from "../motion";

interface TransactionListProps {
  transactions: Transaction[];
  changedCount: number;
}

const BADGE_STYLES: Record<string, string> = {
  renamed: "bg-amber-100 text-amber-800",
  shortened: "bg-orange-100 text-orange-800",
};

/** What the file said before anything was applied, and what it says now. */
function editTrail(transaction: Transaction) {
  const edits = transaction.edits ?? [];
  const kinds = [...new Set(edits.map((edit) => edit.kind))];
  const original = edits[0]?.from ?? transaction.name;
  const onlyShortened = kinds.length === 1 && kinds[0] === "shortened";
  const shortened = edits.find((edit) => edit.kind === "shortened");

  return {
    kinds,
    original,
    // When the only change was a trim, showing the discarded tail in place is
    // clearer than repeating the whole name struck through. Use the edit's own
    // `to` as the base rather than transaction.name — the extracted name is
    // trimmed, so a cut that lands on a space would otherwise lose it and the
    // two halves would no longer reconstruct the original.
    keptHead: onlyShortened && shortened ? shortened.to : null,
    trimmedTail:
      onlyShortened && shortened ? shortened.from.slice(shortened.to.length) : null,
  };
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  changedCount,
}) => {
  const [onlyChanged, setOnlyChanged] = useState(false);
  const entered = useHasEntered();
  const reduced = usePrefersReducedMotion();

  if (!transactions.length) {
    return (
      <div className="mt-6 bg-white border border-gray-200 rounded-xl px-5 py-8 text-center">
        <p className="text-[14px] font-medium text-gray-900">
          No transactions in this file
        </p>
        <p className="mt-1 text-[13px] text-gray-500">
          The file was still cleaned and is ready to download — it just has no{" "}
          <span className="font-mono">&lt;STMTTRN&gt;</span> blocks to show.
        </p>
      </div>
    );
  }

  const visible = onlyChanged
    ? transactions.filter((transaction) => transaction.edits?.length)
    : transactions;

  const rowStyle = (index: number): React.CSSProperties => {
    if (reduced) return { opacity: entered ? 1 : 0 };
    return {
      opacity: entered ? 1 : 0,
      transform: entered ? "translateY(0)" : "translateY(10px)",
      transition: `opacity 300ms ${EASE_OUT}, transform 300ms ${EASE_OUT}`,
      transitionDelay: `${Math.min(index, MOTION.rowStaggerCap) * MOTION.rowStaggerMs}ms`,
    };
  };

  return (
    <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-3">
        <h2 className="font-semibold text-[14px] text-gray-900">Transactions</h2>
        {changedCount > 0 && (
          <div className="ml-auto flex items-center gap-1 text-[12.5px] bg-gray-100 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setOnlyChanged(false)}
              aria-pressed={!onlyChanged}
              className={
                onlyChanged
                  ? "px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-900"
                  : "px-2.5 py-1 rounded-md bg-white shadow-sm font-medium text-gray-900"
              }
            >
              All {transactions.length}
            </button>
            <button
              type="button"
              onClick={() => setOnlyChanged(true)}
              aria-pressed={onlyChanged}
              className={
                onlyChanged
                  ? "px-2.5 py-1 rounded-md bg-white shadow-sm font-medium text-gray-900"
                  : "px-2.5 py-1 rounded-md text-gray-500 hover:text-gray-900"
              }
            >
              Changed {changedCount}
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 text-left">
              <th scope="col" className="font-medium px-5 py-2 w-20">
                Date
              </th>
              <th scope="col" className="font-medium px-3 py-2">
                Description
              </th>
              <th scope="col" className="font-medium px-3 py-2 w-28 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visible.map((transaction, index) => {
              const changed = Boolean(transaction.edits?.length);
              const { kinds, original, keptHead, trimmedTail } =
                editTrail(transaction);

              return (
                <tr
                  key={transaction.id || `${transaction.date}-${index}`}
                  style={rowStyle(index)}
                  className={changed ? "bg-amber-50/40" : undefined}
                >
                  <td className="px-5 py-2.5 text-gray-500 tabular-nums align-top whitespace-nowrap">
                    {formatDate(transaction.date)}
                  </td>
                  <td className="px-3 py-2.5 text-gray-900">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={changed ? "font-medium" : undefined}>
                        {transaction.name}
                      </span>
                      {kinds.map((kind) => (
                        <span
                          key={kind}
                          className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${BADGE_STYLES[kind]}`}
                        >
                          {kind}
                        </span>
                      ))}
                    </div>

                    {trimmedTail ? (
                      <div className="text-[12.5px] text-gray-400 font-mono mt-0.5 break-all whitespace-pre-wrap">
                        {keptHead}
                        <span className="bg-orange-100 text-orange-700 line-through">
                          {trimmedTail}
                        </span>
                      </div>
                    ) : (
                      changed && (
                        <div className="text-[12.5px] text-gray-400 font-mono line-through mt-0.5 break-all">
                          {original}
                        </div>
                      )
                    )}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums align-top whitespace-nowrap ${
                      transaction.amount < 0
                        ? "text-gray-900"
                        : "text-emerald-700 font-medium"
                    }`}
                  >
                    {formatAmount(transaction.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {onlyChanged && (
        <div className="px-5 py-3 border-t border-gray-200 text-[12.5px] text-gray-400">
          Showing {visible.length} changed of {transactions.length} ·{" "}
          <button
            type="button"
            onClick={() => setOnlyChanged(false)}
            className="text-blue-600 hover:underline"
          >
            show all
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;
