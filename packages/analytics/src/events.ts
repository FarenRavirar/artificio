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

/** page_view com apenas o pathname (query string descartada para evitar vazar PII). */
export function trackPageview(path: string): void {
  if (!hasGtag()) return;
  const safePath = path.split("?")[0];
  window.gtag!("event", "page_view", { page_path: safePath });
}

function cleanParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ── Catálogo de eventos (BI agregado, sem PII) ──

/** Busca textual. Redige e-mail e PII óbvia; cap 100 caracteres; min 2. */
export function trackSearch(searchTerm: string): void {
  const trimmed = searchTerm.trim();
  if (trimmed.length < 2) return;
  const redacted = trimmed.replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/gi, "[redacted]");
  const capped = redacted.slice(0, 100);
  trackEvent("search", { search_term: capped });
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
}): void {
  trackEvent("filter_sistema", {
    sistema: params.sistema,
  });
}
