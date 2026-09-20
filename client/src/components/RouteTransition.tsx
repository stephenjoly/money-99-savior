// client/src/components/RouteTransition.tsx
import React from "react";
import type { Route } from "../routes";
import { EASE_OUT, MOTION, useHasEntered, usePrefersReducedMotion } from "../motion";

/**
 * Soft directional enter when switching Clean ↔ Rules. Arriving at /rules
 * slides in from the right; returning to / slides in from the left.
 */
const RouteTransition: React.FC<{
  route: Route;
  children: React.ReactNode;
}> = ({ route, children }) => {
  const entered = useHasEntered();
  const reduced = usePrefersReducedMotion();
  const fromRight = route === "/rules";

  const style: React.CSSProperties = reduced
    ? {
        opacity: entered ? 1 : 0,
        transition: "opacity 120ms linear",
      }
    : {
        opacity: entered ? 1 : 0,
        transform: entered
          ? "translateX(0) translateY(0)"
          : `translateX(${fromRight ? 18 : -18}px) translateY(6px)`,
        transition: `opacity ${MOTION.pageMs}ms ${EASE_OUT}, transform ${MOTION.pageMs}ms ${EASE_OUT}`,
      };

  return <div style={style}>{children}</div>;
};

export default RouteTransition;
