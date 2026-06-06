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
  window.gtag!("event", name, params);
}

export function trackPageview(path: string): void {
  if (!hasGtag()) return;
  window.gtag!("event", "page_view", { page_path: path });
}
