// client/src/components/ActionButtons.tsx
import React from "react";

interface ActionButtonsProps {
  processedContent: string | null;
  originalFilename: string | null;
  onClear: () => void;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  processedContent,
  originalFilename,
  onClear,
}) => {
  if (!processedContent || !originalFilename) {
    return null;
  }

  const handleDownload = () => {
    const blob = new Blob([processedContent], { type: "text/ofx" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    // Extract just the name part without extension
    const baseName = originalFilename.split(".")[0];
    // Always use .ofx extension
    const processedFilename = `${baseName}_processed.ofx`;

    a.href = url;
    a.download = processedFilename;
    document.body.appendChild(a);
    a.click();

    // Clean up
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  return (
    <div className="flex space-x-4">
      <button
        onClick={handleDownload}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Download Processed OFX
      </button>

      <button
        onClick={onClear}
        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
      >
        Clear & Start Over
      </button>
    </div>
  );
};

export default ActionButtons;
