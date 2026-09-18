// client/src/motion.ts
import { useEffect, useState } from "react";

/**
 * Timings for the upload -> receipt handoff, in one place so the choreography
 * can be tuned without hunting through components.
 *
 * The uploader leaves before the receipt arrives rather than crossing over it,
 * which keeps both elements in normal document flow — no absolute positioning,
 * no height jump.
 */
export const MOTION = {
  /** Uploader collapsing away once the file has processed. */
  exitMs: 220,
  /** Beat between the uploader leaving and the receipt arriving. */
  gapMs: 30,
  /** Receipt arriving. */
  enterMs: 360,
  /** Per-row delay in the transaction table. */
  rowStaggerMs: 22,
  /** Rows past this index all share the last delay, so long files still settle quickly. */
  rowStaggerCap: 10,
} as const;

export const EASE_OUT = "cubic-bezier(.16, 1, .3, 1)";
export const EASE_IN = "cubic-bezier(.4, 0, 1, 1)";

/** Tracks the user's reduced-motion preference, including changes to it. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Returns false on the first paint after mount, then true, so a component can
 * animate in from a starting state without a layout-thrashing measure pass.
 */
export function useHasEntered(): boolean {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return entered;
}
