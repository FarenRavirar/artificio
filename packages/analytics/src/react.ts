import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageview } from "./events.js";

/**
 * Hook React: dispara `page_view` a cada mudança de rota (react-router-dom).
 * Use no topo do app React (ex.: `<AnalyticsPixels />` em volta do router).
 *
 * peerDependencies: react (^19), react-router-dom (^7).
 */
export function useAnalyticsPageviews(): void {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
