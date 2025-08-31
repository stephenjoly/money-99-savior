import React, { useState } from "react";

interface FileUploaderProps {
  onFileProcessed: (data: any) => void;
  setLoading: (loading: boolean) => void;
}

const FileUploader: React.FC<FileUploaderProps> = ({
  onFileProcessed,
  setLoading,
}) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!["ofx", "qfx", "qbo"].includes(fileExt || "")) {
      setError("Invalid file type. Please upload an OFX, QFX, or QBO file.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      console.log("Uploading file:", file.name, "Size:", file.size);

      const response = await fetch("/api/process-ofx", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status);
      console.log(
        "Response headers:",
        Object.fromEntries([...response.headers.entries()])
      );

      // Get the raw text response first
      const rawText = await response.text();
      console.log("Raw response length:", rawText.length);

      if (rawText.length < 100) {
        console.log("Raw response content:", rawText);
      } else {
        console.log("Raw response preview:", rawText.substring(0, 100) + "...");
      }

      // If we have text, try to parse it as JSON
      if (rawText) {
        try {
          const data = JSON.parse(rawText);
          onFileProcessed(data);
        } catch (parseError) {
          console.error("Error parsing JSON:", parseError);
          throw new Error(
            "Invalid response format from server. Check console for details."
          );
        }
      } else {
        throw new Error("Empty response from server");
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Error uploading file:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-xl font-semibold mb-4">Upload Financial Statement</h2>
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className="w-10 h-10 mb-3 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              ></path>
            </svg>
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Click to upload</span> or drag and
              drop
            </p>
            <p className="text-xs text-gray-500">OFX, QFX, or QBO files only</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".ofx,.qfx,.qbo"
            onChange={handleFileChange}
          />
        </label>
      </div>
      {error && <div className="mt-4 text-red-500 text-sm">{error}</div>}
    </div>
  );
};

export default FileUploader;
