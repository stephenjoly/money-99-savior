// client/src/routes.ts
import { useCallback, useEffect, useState } from "react";

export type Route = "/" | "/rules";

function toRoute(pathname: string): Route {
  return pathname === "/rules" ? "/rules" : "/";
}

/**
 * Two pages is not worth a router dependency. The server already serves
 * index.html for every path in production, so pushState is enough.
 */
export function useRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(() =>
    toRoute(window.location.pathname)
  );

  useEffect(() => {
    const onPopState = () => setRoute(toRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((next: Route) => {
    window.history.pushState({}, "", next);
    setRoute(next);
    window.scrollTo(0, 0);
  }, []);

  return [route, navigate];
}
