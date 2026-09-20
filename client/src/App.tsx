// client/src/App.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import FileUploader from "./components/FileUploader";
import ProcessingBeat from "./components/ProcessingBeat";
import ResultReceipt from "./components/ResultReceipt";
import Navbar from "./components/Navbar";
import RulesPage from "./pages/RulesPage";
import RouteTransition from "./components/RouteTransition";
import { useRoute } from "./routes";
import {
  EASE_IN,
  EASE_OUT,
  MOTION,
  useHasEntered,
  usePrefersReducedMotion,
} from "./motion";
import { processStatement } from "./processStatement";
import { getEffectiveRulesFingerprint } from "./ruleStore";
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
  /** Remount key so the uploader can animate back in on start over. */
  uploaderKey: number;
  animateUploaderIn: boolean;
}

const INITIAL_SESSION: CleanSession = {
  phase: "idle",
  filename: "",
  sourceContent: null,
  processedFile: null,
  appliedRulesFingerprint: null,
  reprocessError: null,
  uploaderKey: 0,
  animateUploaderIn: false,
};

const UploaderPane: React.FC<{
  phase: Phase;
  filename: string;
  animateIn: boolean;
  reduced: boolean;
  onStart: (name: string) => void;
  onProcessed: (
    data: ProcessedFile,
    sourceContent: string,
    rulesFingerprint: string
  ) => void;
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
    uploaderKey,
    animateUploaderIn,
  } = session;
  const reduced = usePrefersReducedMotion();

  const rulesChanged =
    appliedRulesFingerprint !== null &&
    appliedRulesFingerprint !== getEffectiveRulesFingerprint();

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
          onStart={onStart}
          onProcessed={onProcessed}
          onError={onError}
        />
      )}

      {showReceipt && processedFile && (
        <ResultReceipt
          file={processedFile}
          exiting={phase === "returning"}
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
      animateUploaderIn: false,
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
    setSession((prev) => {
      if (prev.phase !== "result") return prev;
      window.clearTimeout(exitTimer.current);
      exitTimer.current = window.setTimeout(() => {
        setSession((current) => ({
          ...INITIAL_SESSION,
          uploaderKey: current.uploaderKey + 1,
          animateUploaderIn: true,
          phase: "idle",
        }));
      }, reduced ? 0 : MOTION.exitMs + MOTION.gapMs);
      return { ...prev, phase: "returning" };
    });
  }, [reduced]);

  const handleReprocess = useCallback(() => {
    setSession((prev) => {
      if (!prev.sourceContent || !prev.filename || prev.phase !== "result") {
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
