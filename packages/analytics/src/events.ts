// Helpers client-side (browser-only). No-op fora do browser ou sem gtag carregado.
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

function hasGtag(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function trackEvent(name: string, params: Record<string, unknown> = {}): void {
  if (!hasGtag()) return;
  window.gtag!("event", name, cleanParams(params));
}

export function trackPageview(path: string): void {
  if (!hasGtag()) return;
  window.gtag!("event", "page_view", { page_path: path });
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ── Catálogo de eventos (BI agregado, sem PII) ──

/** Busca textual. search_term com pelo menos 2 caracteres. */
export function trackSearch(searchTerm: string): void {
  const trimmed = searchTerm.trim();
  if (trimmed.length < 2) return;
  trackEvent("search", { search_term: trimmed });
}

/** Visualização de termo (glossário). */
export function trackViewTermo(params: {
  termo_id: string;
  termo: string;
  sistema?: string;
}): void {
  trackEvent("view_termo", {
    termo_id: params.termo_id,
    termo: params.termo,
    sistema: params.sistema,
  });
}

/** Abertura/seleção de mesa. */
export function trackSelectMesa(params: {
  mesa_id: string;
  mesa_nome: string;
  sistema?: string;
}): void {
  trackEvent("select_mesa", {
    mesa_id: params.mesa_id,
    mesa_nome: params.mesa_nome,
    sistema: params.sistema,
  });
}

/** Filtro por sistema acionado. */
export function trackFilterSistema(params: {
  sistema: string;
  filter_type?: string;
  filter_value?: string;
}): void {
  trackEvent("filter_sistema", {
    sistema: params.sistema,
    filter_type: params.filter_type,
    filter_value: params.filter_value,
  });
}

/** Filtro aplicado (genérico). */
export function trackFilterApply(params: {
  sistema?: string;
  filter_type: string;
  filter_value: string;
}): void {
  trackEvent("filter_apply", {
    sistema: params.sistema,
    filter_type: params.filter_type,
    filter_value: params.filter_value,
  });
}
