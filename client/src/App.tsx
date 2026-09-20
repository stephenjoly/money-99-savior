// client/src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import FileUploader from "./components/FileUploader";
import ProcessingBeat from "./components/ProcessingBeat";
import ResultReceipt from "./components/ResultReceipt";
import Navbar from "./components/Navbar";
import RulesPage from "./pages/RulesPage";
import RouteTransition from "./components/RouteTransition";
import { useRoute } from "./routes";
import { EASE_IN, MOTION, usePrefersReducedMotion } from "./motion";
import { processStatement } from "./processStatement";
import { getEffectiveRulesFingerprint } from "./ruleStore";
import type { ProcessedFile } from "./types";

/**
 * idle     — waiting for a file
 * working  — request in flight; the uploader stays put so a failure can simply
 *            re-enable it instead of animating back
 * leaving  — file processed, uploader collapsing away
 * result   — receipt only
 */
type Phase = "idle" | "working" | "leaving" | "result";

/**
 * Session for the clean-a-file flow. Lives on App so navigating to /rules and
 * back does not drop the uploaded statement or its cleaned result.
 */
interface CleanSession {
  phase: Phase;
  filename: string;
  /** Raw statement text kept so rules can be reapplied without re-choosing a file. */
  sourceContent: string | null;
  processedFile: ProcessedFile | null;
  /** Fingerprint of the rules that produced `processedFile`. */
  appliedRulesFingerprint: string | null;
  reprocessError: string | null;
}

const INITIAL_SESSION: CleanSession = {
  phase: "idle",
  filename: "",
  sourceContent: null,
  processedFile: null,
  appliedRulesFingerprint: null,
  reprocessError: null,
};

const CleanFilePage: React.FC<{
  session: CleanSession;
  onStart: (filename: string) => void;
  onProcessed: (
    data: ProcessedFile,
    sourceContent: string,
    rulesFingerprint: string
  ) => void;
  onError: () => void;
  onClear: () => void;
  onReprocess: () => void;
  onNavigate: (route: "/" | "/rules") => void;
}> = ({
  session,
  onStart,
  onProcessed,
  onError,
  onClear,
  onReprocess,
  onNavigate,
}) => {
  const {
    phase,
    filename,
    processedFile,
    appliedRulesFingerprint,
    reprocessError,
  } = session;
  const reduced = usePrefersReducedMotion();

  const rulesChanged =
    appliedRulesFingerprint !== null &&
    appliedRulesFingerprint !== getEffectiveRulesFingerprint();

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
            onStart={onStart}
            onProcessed={onProcessed}
            onError={onError}
            disabled={phase !== "idle"}
          />
          {phase === "working" && <ProcessingBeat filename={filename} />}
        </div>
      )}

      {phase === "result" && processedFile && (
        <ResultReceipt
          file={processedFile}
          onClear={onClear}
          onReprocess={onReprocess}
          rulesChanged={rulesChanged}
          reprocessError={reprocessError}
          onNavigate={onNavigate}
        />
      )}
    </main>
  );
};

const App: React.FC = () => {
  const [route, navigate] = useRoute();
  const appVersion = import.meta.env.VITE_APP_VERSION ?? "vDev";
  const [session, setSession] = useState<CleanSession>(INITIAL_SESSION);
  const reduced = usePrefersReducedMotion();
  const exitTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const handleStart = useCallback((name: string) => {
    setSession((prev) => ({
      ...prev,
      filename: name,
      phase: "working",
      reprocessError: null,
    }));
  }, []);

  const handleProcessed = useCallback(
    (
      data: ProcessedFile,
      sourceContent: string,
      rulesFingerprint: string
    ) => {
      setSession((prev) => ({
        ...prev,
        processedFile: data,
        sourceContent,
        filename: data.filename,
        appliedRulesFingerprint: rulesFingerprint,
        phase: "leaving",
        reprocessError: null,
      }));
      exitTimer.current = window.setTimeout(
        () =>
          setSession((prev) =>
            prev.phase === "leaving" ? { ...prev, phase: "result" } : prev
          ),
        reduced ? 0 : MOTION.exitMs + MOTION.gapMs
      );
    },
    [reduced]
  );

  const handleError = useCallback(() => {
    setSession((prev) => ({
      ...prev,
      phase: "idle",
      filename: "",
      sourceContent: null,
      appliedRulesFingerprint: null,
    }));
  }, []);

  const handleClear = useCallback(() => {
    window.clearTimeout(exitTimer.current);
    setSession(INITIAL_SESSION);
  }, []);

  const handleReprocess = useCallback(() => {
    setSession((prev) => {
      if (!prev.sourceContent || !prev.filename) {
        return prev;
      }

      try {
        const { processed, rulesFingerprint } = processStatement(
          prev.filename,
          prev.sourceContent
        );
        return {
          ...prev,
          processedFile: processed,
          appliedRulesFingerprint: rulesFingerprint,
          reprocessError: null,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          ...prev,
          reprocessError: `Couldn’t reapply rules — ${message}`,
        };
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar route={route} onNavigate={navigate} />

      <div className="flex-1">
        <RouteTransition key={route} route={route}>
          {route === "/rules" ? (
            <RulesPage />
          ) : (
            <CleanFilePage
              session={session}
              onStart={handleStart}
              onProcessed={handleProcessed}
              onError={handleError}
              onClear={handleClear}
              onReprocess={handleReprocess}
              onNavigate={navigate}
            />
          )}
        </RouteTransition>
      </div>

      <footer className="py-8 text-center text-xs text-gray-400">
        {appVersion}
      </footer>
    </div>
  );
};

export default App;
