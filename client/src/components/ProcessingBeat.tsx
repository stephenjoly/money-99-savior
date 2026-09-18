// client/src/components/ProcessingBeat.tsx
import React from "react";

interface ProcessingBeatProps {
  filename: string;
}

/**
 * The in-flight beat. The uploader stays exactly where it is underneath this —
 * committing the exit animation before the response lands would mean animating
 * back on a failure, which reads as a glitch.
 */
const ProcessingBeat: React.FC<ProcessingBeatProps> = ({ filename }) => (
  <div className="mt-4" aria-live="polite">
    <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center gap-4">
      <span className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 grid place-items-center shrink-0">
        <svg
          className="text-gray-400"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
          <path d="M14 2v6h6" />
        </svg>
      </span>
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[13px] truncate text-gray-900">
          {filename}
        </div>
        <div className="sweep h-1 rounded-full mt-2 bg-gray-200" />
      </div>
      <span className="text-[12.5px] text-gray-400 shrink-0">Cleaning…</span>
    </div>
  </div>
);

export default ProcessingBeat;
