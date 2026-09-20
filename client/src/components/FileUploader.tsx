// client/src/components/FileUploader.tsx
import React, { useRef, useState } from "react";
import type { ProcessedFile } from "../types";
import { MAX_FILE_SIZE, validateFileType } from "../ofx/processor";
import { processStatement } from "../processStatement";

interface FileUploaderProps {
  onStart: (filename: string) => void;
  onProcessed: (data: ProcessedFile, sourceContent: string) => void;
  onError: () => void;
  disabled: boolean;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onStart,
  onProcessed,
  onError,
  disabled,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!validateFileType(file.name)) {
      setError(
        `“${file.name}” isn’t a statement file. Money 99 Savior reads .ofx, .qfx and .qbo.`
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(`“${file.name}” is larger than 10 MB.`);
      return;
    }

    setError(null);
    onStart(file.name);

    try {
      // Everything below happens on this machine. The file is read as text and
      // cleaned in memory; there is no upload endpoint to send it to.
      const content = await file.text();
      const processed = processStatement(file.name, content);
      onProcessed(processed, content);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Couldn’t read that file — ${message}`);
      onError();
      console.error("Error processing file:", err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file twice in a row still fires a change event.
    e.target.value = "";
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  return (
    <div>
      <div className="text-center mb-7">
        <h1 className="text-[22px] font-semibold tracking-tight text-gray-900">
          Clean a statement for Money 99
        </h1>
        <p className="mt-1.5 text-[14px] text-gray-500">
          Drop a .ofx, .qfx or .qbo file. It’s cleaned right here — your
          statement never leaves your browser.
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`w-full bg-white border-2 border-dashed rounded-2xl px-6 py-14 transition-colors group disabled:cursor-default ${
          dragging
            ? "border-gray-900 bg-gray-50"
            : "border-gray-200 enabled:hover:border-gray-400 enabled:hover:bg-gray-50/60"
        }`}
      >
        <span className="w-11 h-11 rounded-xl bg-gray-100 border border-gray-200 grid place-items-center mx-auto transition-colors group-enabled:group-hover:bg-white">
          <svg
            className="text-gray-500"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 21V9m0 0 4 4m-4-4-4 4M20 16.5A4.5 4.5 0 0 0 17.5 8h-1.2A7 7 0 1 0 4 14.9" />
          </svg>
        </span>
        <span className="mt-3.5 block text-[14px] font-medium text-gray-900">
          Choose a file{" "}
          <span className="text-gray-400 font-normal">or drag it here</span>
        </span>
        <span className="mt-1 block text-[12.5px] text-gray-400">
          OFX · QFX · QBO — up to 10 MB
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".ofx,.qfx,.qbo"
        onChange={handleFileChange}
      />

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-[13px] text-rose-800"
        >
          <svg
            className="shrink-0 mt-0.5 text-rose-500"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M12 8v5m0 3.5h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
