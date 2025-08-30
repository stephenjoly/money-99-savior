import React from "react";

interface FileDownloaderProps {
  processedContent: string | null;
  originalFilename: string | null;
}

const FileDownloader: React.FC<FileDownloaderProps> = ({
  processedContent,
  originalFilename,
}) => {
  if (!processedContent || !originalFilename) {
    return null;
  }

  const handleDownload = () => {
    const blob = new Blob([processedContent], { type: "text/ofx" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    // #### IF YOU WANT TO RETURN THE SAME EXTENSION AS WAS UPLOADED
    // Create a filename with "_processed" suffix
    // const filenameParts = originalFilename.split(".");
    // const ext = filenameParts.pop();
    // const name = filenameParts.join(".");
    // const processedFilename = `${name}_processed.${ext}`;

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
    <div className="mt-6">
      <button
        onClick={handleDownload}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Download Processed OFX File
      </button>
    </div>
  );
};

export default FileDownloader;
