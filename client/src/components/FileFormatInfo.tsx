// client/src/components/FileFormatInfo.tsx
import React from "react";

interface FileFormatInfoProps {
  filename: string;
  isXmlFormat: boolean;
}

const FileFormatInfo: React.FC<FileFormatInfoProps> = ({
  filename,
  isXmlFormat,
}) => {
  return (
    <div className="mt-4 p-4 bg-blue-50 rounded-md border border-blue-200">
      <div className="flex items-center">
        <svg
          className="h-5 w-5 text-blue-500 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-sm font-medium text-blue-800">
          File: <span className="font-semibold">{filename}</span>
        </span>
      </div>
      <div className="mt-2 text-sm text-blue-700">
        Format detected:{" "}
        <span className="font-medium">
          {isXmlFormat
            ? "XML Format (with closing tags)"
            : "SGML Format (without closing tags)"}
        </span>
      </div>
    </div>
  );
};

export default FileFormatInfo;
