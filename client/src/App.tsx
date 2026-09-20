// client/src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import FileUploader from "./components/FileUploader";
import ProcessingBeat from "./components/ProcessingBeat";
import ResultReceipt from "./components/ResultReceipt";
import Navbar from "./components/Navbar";
import RulesPage from "./pages/RulesPage";
import { useRoute } from "./routes";
import {
  EASE_IN,
  EASE_OUT,
  MOTION,
  useHasEntered,
  usePrefersReducedMotion,
} from "./motion";
import type { ProcessedFile } from "./types";

/**
 * idle      — waiting for a file
 * working   — request in flight; the uploader stays put so a failure can simply
 *             re-enable it instead of animating back
 * leaving   — file processed, uploader collapsing away
 * result    — receipt only
 * returning — start over: receipt collapsing away before the uploader returns
 */
type Phase = "idle" | "working" | "leaving" | "result" | "returning";

const UploaderPane: React.FC<{
  phase: Phase;
  filename: string;
  animateIn: boolean;
  reduced: boolean;
  onStart: (name: string) => void;
  onProcessed: (data: ProcessedFile) => void;
  onError: () => void;
}> = ({ phase, filename, animateIn, reduced, onStart, onProcessed, onError }) => {
  const entered = useHasEntered();
  const leaving = phase === "leaving";

  let style: React.CSSProperties;
  if (leaving) {
    style = reduced
      ? { opacity: 0, transition: "opacity 120ms linear" }
      : {
          opacity: 0,
          transform: "translateY(26px) scale(.90)",
          transformOrigin: "top center",
          transition: `opacity ${MOTION.exitMs}ms ${EASE_IN}, transform ${MOTION.exitMs}ms ${EASE_IN}`,
        };
  } else if (animateIn) {
    style = reduced
      ? {
          opacity: entered ? 1 : 0,
          transition: "opacity 120ms linear",
        }
      : {
          opacity: entered ? 1 : 0,
          transform: entered ? "none" : "translateY(26px) scale(.90)",
          transformOrigin: "top center",
          transition: `opacity ${MOTION.enterMs}ms ${EASE_OUT}, transform ${MOTION.enterMs}ms ${EASE_OUT}`,
        };
  } else {
    style = reduced
      ? { opacity: phase === "working" ? 0.38 : 1 }
      : {
          opacity: phase === "working" ? 0.38 : 1,
          transition: "opacity 160ms ease",
        };
  }

  return (
    <div style={style} aria-hidden={leaving || undefined}>
      <FileUploader
        onStart={onStart}
        onProcessed={onProcessed}
        onError={onError}
        disabled={phase !== "idle"}
      />
      {phase === "working" && <ProcessingBeat filename={filename} />}
    </div>
  );
};

const CleanFilePage: React.FC<{
  onNavigate: (route: "/" | "/rules") => void;
}> = ({ onNavigate }) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [filename, setFilename] = useState("");
  const [processedFile, setProcessedFile] = useState<ProcessedFile | null>(null);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [animateUploaderIn, setAnimateUploaderIn] = useState(false);
  const reduced = usePrefersReducedMotion();
  const exitTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const handleStart = useCallback((name: string) => {
    setAnimateUploaderIn(false);
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
    if (phase !== "result") return;
    window.clearTimeout(exitTimer.current);
    setPhase("returning");
    exitTimer.current = window.setTimeout(() => {
      setProcessedFile(null);
      setFilename("");
      setAnimateUploaderIn(true);
      setUploaderKey((key) => key + 1);
      setPhase("idle");
    }, reduced ? 0 : MOTION.exitMs + MOTION.gapMs);
  }, [phase, reduced]);

  const showUploader = phase !== "result" && phase !== "returning";
  const showReceipt =
    (phase === "result" || phase === "returning") && processedFile !== null;

  return (
    <main className="max-w-5xl mx-auto px-5 py-10">
      {showUploader && (
        <UploaderPane
          key={uploaderKey}
          phase={phase}
          filename={filename}
          animateIn={animateUploaderIn}
          reduced={reduced}
          onStart={handleStart}
          onProcessed={handleProcessed}
          onError={handleError}
        />
      )}

      {showReceipt && processedFile && (
        <ResultReceipt
          file={processedFile}
          exiting={phase === "returning"}
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
