// client/src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import FileUploader from "./components/FileUploader";
import ProcessingBeat from "./components/ProcessingBeat";
import ResultReceipt from "./components/ResultReceipt";
import Navbar from "./components/Navbar";
import RulesPage from "./pages/RulesPage";
import { useRoute } from "./routes";
import { EASE_IN, MOTION, usePrefersReducedMotion } from "./motion";
import type { ProcessedFile } from "./types";

/**
 * idle     — waiting for a file
 * working  — request in flight; the uploader stays put so a failure can simply
 *            re-enable it instead of animating back
 * leaving  — file processed, uploader collapsing away
 * result   — receipt only
 */
type Phase = "idle" | "working" | "leaving" | "result";

const CleanFilePage: React.FC<{
  onNavigate: (route: "/" | "/rules") => void;
}> = ({ onNavigate }) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [filename, setFilename] = useState("");
  const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(null);
  const reduced = usePrefersReducedMotion();
  const exitTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const handleStart = useCallback((name: string) => {
    setFilename(name);
    setPhase("working");
  }, []);

  const handleProcessed = useCallback(
    (data: ProcessedFile) => {
      setProcessedFile(data);
      setPhase("leaving");
      exitTimer.current = window.setTimeout(
        () => setPhase("result"),
        reduced ? 0 : MOTION.exitMs + MOTION.gapMs
      );
    },
    [reduced]
  );

  const handleError = useCallback(() => {
    setPhase("idle");
    setFilename("");
  }, []);

  const handleClear = useCallback(() => {
    window.clearTimeout(exitTimer.current);
    setProcessedFile(null);
    setFilename("");
    setPhase("idle");
  }, []);

  const leaving = phase === "leaving";
  const uploaderStyle: React.CSSProperties = reduced
    ? { opacity: leaving ? 0 : phase === "working" ? 0.38 : 1 }
    : {
        opacity: leaving ? 0 : phase === "working" ? 0.38 : 1,
        transform: leaving ? "translateY(26px) scale(.90)" : "none",
        transformOrigin: "top center",
        transition: leaving
          ? `opacity ${MOTION.exitMs}ms ${EASE_IN}, transform ${MOTION.exitMs}ms ${EASE_IN}`
          : "opacity 160ms ease",
      };

  return (
    <main className="max-w-5xl mx-auto px-5 py-10">
      {phase !== "result" && (
        <div style={uploaderStyle} aria-hidden={leaving || undefined}>
          <FileUploader
            onStart={handleStart}
            onProcessed={handleProcessed}
            onError={handleError}
            disabled={phase !== "idle"}
          />
          {phase === "working" && <ProcessingBeat filename={filename} />}
        </div>
      )}

      {phase === "result" && processedFile && (
        <ResultReceipt
          file={processedFile}
          onClear={handleClear}
          onNavigate={onNavigate}
        />
      )}
    </main>
  );
};

const App: React.FC = () => {
  const [route, navigate] = useRoute();
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "vDev";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar route={route} onNavigate={navigate} />

      <div className="flex-1">
        {route === "/rules" ? (
          <RulesPage />
        ) : (
          <CleanFilePage onNavigate={navigate} />
        )}
      </div>

      <footer className="py-8 text-center text-xs text-gray-400">
        {appVersion}
      </footer>
    </div>
  );
};

export default App;
