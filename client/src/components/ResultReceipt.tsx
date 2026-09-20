// client/src/components/ResultReceipt.tsx
import React, { useEffect, useRef } from "react";
import type { ProcessedFile } from "../types";
import type { Route } from "../routes";
import { summarize } from "../summary";
import {
  EASE_IN,
  EASE_OUT,
  MOTION,
  useHasEntered,
  usePrefersReducedMotion,
} from "../motion";
import TransactionList from "./TransactionList";

interface ResultReceiptProps {
  file: ProcessedFile;
  exiting?: boolean;
  onClear: () => void;
  onNavigate: (route: Route) => void;
}

function downloadProcessed(file: ProcessedFile) {
  const blob = new Blob([file.processedContent], { type: "text/ofx" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  const baseName = file.filename.split(".")[0];
  anchor.href = url;
  anchor.download = `${baseName}_processed.ofx`;
  document.body.appendChild(anchor);
  anchor.click();

  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 0);
}

const ResultReceipt: React.FC<ResultReceiptProps> = ({
  file,
  exiting = false,
  onClear,
  onNavigate,
}) => {
  const summary = summarize(file);
  const entered = useHasEntered();
  const reduced = usePrefersReducedMotion();
  const headingRef = useRef<HTMLDivElement>(null);

  // The uploader that had focus is gone; put focus on the verdict so a keyboard
  // or screen-reader user lands on the answer rather than at the top of the page.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  const shellStyle: React.CSSProperties = (() => {
    if (exiting) {
      return reduced
        ? { opacity: 0, transition: "opacity 120ms linear" }
        : {
            opacity: 0,
            transform: "translateY(26px) scale(.90)",
            transformOrigin: "top center",
            transition: `opacity ${MOTION.exitMs}ms ${EASE_IN}, transform ${MOTION.exitMs}ms ${EASE_IN}`,
          };
    }
    return reduced
      ? { opacity: entered ? 1 : 0, transition: "opacity 120ms linear" }
      : {
          opacity: entered ? 1 : 0,
          transform: entered ? "scale(1)" : "scale(.985)",
          transition: `opacity ${MOTION.enterMs}ms ${EASE_OUT}, transform ${MOTION.enterMs}ms ${EASE_OUT}`,
        };
  })();

  // The verdict card unrolls from its own top edge — the file becoming the result.
  const verdictStyle: React.CSSProperties = (() => {
    if (exiting || reduced) return {};
    return {
      transformOrigin: "top center",
      opacity: entered ? 1 : 0,
      transform: entered
        ? "scaleY(1) translateY(0)"
        : "scaleY(.55) translateY(-10px)",
      transition: `opacity ${MOTION.enterMs}ms ${EASE_OUT}, transform ${MOTION.enterMs}ms ${EASE_OUT}`,
    };
  })();

  const counts: { value: number; label: string }[] = [
    { value: summary.renamed, label: "merchant names standardized" },
    { value: summary.shortened, label: "names shortened to 32 characters" },
    { value: summary.tagsStripped, label: "incompatible tags stripped" },
    { value: summary.headerRewritten, label: "file header rewritten" },
  ];

  return (
    <div style={shellStyle}>
      <div
        style={verdictStyle}
        className="bg-white border border-gray-200 rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 flex flex-wrap items-center gap-4">
          <span className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center shrink-0">
            <svg
              className="text-emerald-600"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>

          <div
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 outline-none"
          >
            <h1 className="font-semibold text-[15px] leading-tight text-gray-900">
              Ready for Money 99
            </h1>
            <p className="text-[13px] text-gray-500 leading-tight mt-0.5 truncate">
              <span className="font-mono">{file.filename}</span>
              <span className="text-gray-300 mx-1.5">·</span>
              {file.isXmlFormat ? "XML" : "SGML"}
              <span className="text-gray-300 mx-1.5">·</span>
              {file.transactions.length} transaction
              {file.transactions.length === 1 ? "" : "s"}
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="text-gray-900 font-medium">
                {summary.totalCorrections} correction
                {summary.totalCorrections === 1 ? "" : "s"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClear}
              disabled={exiting}
              className="text-[13px] font-medium text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg disabled:opacity-50"
            >
              Start over
            </button>
            <button
              type="button"
              onClick={() => downloadProcessed(file)}
              className="text-[13px] font-semibold bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-black flex items-center gap-2"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
              </svg>
              Download .ofx
            </button>
          </div>
        </div>

        {summary.totalCorrections > 0 && (
          <div className="border-t border-gray-200 bg-gray-50/70 px-5 py-3 text-[13px] text-gray-600 flex flex-wrap gap-x-5 gap-y-1">
            {counts
              .filter((count) => count.value > 0)
              .map((count) => (
                <span key={count.label}>
                  <b className="text-gray-900 tabular-nums">{count.value}</b>{" "}
                  {count.label}
                </span>
              ))}
          </div>
        )}
      </div>

      <TransactionList
        transactions={file.transactions}
        changedCount={summary.changedTransactions}
      />

      <p className="mt-5 text-[12.5px] text-gray-400">
        Renames come from your{" "}
        <a
          href="/rules"
          onClick={(e) => {
            e.preventDefault();
            onNavigate("/rules");
          }}
          className="text-blue-600 hover:underline"
        >
          correction rules
        </a>
        . This file was never uploaded — it was cleaned in your browser.
      </p>
    </div>
  );
};

export default ResultReceipt;
