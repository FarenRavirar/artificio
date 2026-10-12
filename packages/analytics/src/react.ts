import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageview } from "./events.js";

/**
 * Hook React: dispara `page_view` a cada mudança de rota (react-router-dom).
 * Use no topo do app React (ex.: `<AnalyticsPageviews />` em volta do router).
 *
 * Só o `pathname` define página. A versão anterior também disparava quando
 * `location.search` mudava — e como `trackPageview` descarta a query, cada filtro
 * aplicado no catálogo virava um `page_view` repetido da MESMA URL, inflando
 * visualizações e derrubando o tempo por página (spec 105 I1).
 *
 * peerDependencies: react (^19), react-router-dom (^7).
 */
export function useAnalyticsPageviews(): void {
  const { pathname } = useLocation();
  useEffect(() => {
    trackPageview(pathname);
  }, [pathname]);
}
