// client/src/App.tsx
import React, { useState } from "react";
import FileUploader from "./components/FileUploader";
import TransactionList from "./components/TransactionList";
import ProcessingInfo from "./components/ProcessingInfo";
import FileFormatInfo from "./components/FileFormatInfo";
import type { ProcessedFile } from "./types";
import ActionButtons from "./components/ActionButtons";

const App: React.FC = () => {
  const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Function to clear all data and reset the state
  const clearData = () => {
    setProcessedFile(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900">
            OFX File Processor
          </h1>
          <p className="mt-3 text-lg text-gray-500">
            Upload, process, and download financial statement files
          </p>
        </div>

        <FileUploader
          onFileProcessed={setProcessedFile}
          setLoading={setLoading}
        />

        {loading && (
          <div className="mt-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Processing file...</p>
          </div>
        )}

        {processedFile && (
          <>
            <FileFormatInfo
              filename={processedFile.filename}
              isXmlFormat={processedFile.isXmlFormat}
            />
            <ProcessingInfo processingStats={processedFile.processingStats} />
            {/* <div className="mt-2 flex justify-center">
              <FileDownloader
                processedContent={processedFile.processedContent}
                originalFilename={processedFile.filename}
              />
            </div> */}
            <div className="mt-8 flex justify-center">
              <ActionButtons
                processedContent={processedFile.processedContent}
                originalFilename={processedFile.filename}
                onClear={clearData}
              />
            </div>
            <TransactionList transactions={processedFile.transactions} />
          </>
        )}
      </div>
    </div>
  );
};

export default App;
