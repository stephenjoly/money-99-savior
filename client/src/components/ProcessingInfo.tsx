// client/src/components/ProcessingInfo.tsx
import React from "react";
import type { ProcessingStats } from "../types";

interface ProcessingInfoProps {
  processingStats: ProcessingStats | null;
}

const ProcessingInfo: React.FC<ProcessingInfoProps> = ({ processingStats }) => {
  if (!processingStats) {
    return null;
  }

  const hasReplacements =
    processingStats.replacements && processingStats.replacements.length > 0;
  const hasTruncatedNames =
    processingStats.truncatedNames && processingStats.truncatedNames.length > 0;
  const hasRemovedTags =
    processingStats.removedTags && processingStats.removedTags.length > 0;

  if (!hasReplacements && !hasTruncatedNames && !hasRemovedTags) {
    return null;
  }

  return (
    <div className="mt-8 bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4">Processing Information</h2>

      {hasReplacements && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Pattern Replacements</h3>
          <div className="space-y-4">
            {processingStats.replacements.map((replacement, index) => (
              <div
                key={index}
                className="bg-gray-50 border border-gray-300 rounded-md p-4"
              >
                <div className="flex justify-between items-start">
                  <div className="font-medium">
                    {replacement.pattern.length > 50
                      ? `${replacement.pattern.substring(0, 50)}...`
                      : replacement.pattern}
                  </div>
                  <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                    {replacement.count}{" "}
                    {replacement.count === 1 ? "match" : "matches"}
                  </div>
                </div>

                {replacement.examples.length > 0 && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-500">Examples:</div>
                    <ul className="list-disc pl-5 text-sm text-gray-700 mt-1">
                      {replacement.examples.map((example, i) => (
                        <li key={i} className="truncate">
                          {example.length > 60
                            ? `${example.substring(0, 60)}...`
                            : example}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {hasTruncatedNames && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3">Truncated Names</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-700">
              {processingStats.truncatedNames.length} transaction{" "}
              {processingStats.truncatedNames.length === 1 ? "name" : "names"}{" "}
              were truncated to 33 characters to meet OFX specifications.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Original Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Truncated Name
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {processingStats.truncatedNames.map((item, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {item.original}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {item.truncated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {hasRemovedTags && (
        <div>
          <h3 className="text-lg font-medium mb-3">Removed Tags</h3>
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <p className="text-sm text-green-700">
              The following tags were removed from the file for compatibility:
            </p>
            <ul className="mt-2 space-y-1">
              {processingStats.removedTags.map((tag, index) => (
                <li
                  key={index}
                  className="text-sm text-green-800 flex items-center"
                >
                  <svg
                    className="h-4 w-4 mr-1 text-green-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>
                    <strong>{tag.tagName}</strong>: {tag.count}{" "}
                    {tag.count === 1 ? "instance" : "instances"} removed
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProcessingInfo;
