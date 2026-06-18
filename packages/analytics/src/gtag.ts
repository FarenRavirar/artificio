import { ANALYTICS_DEFAULTS, type GaOptions } from "./config.js";

/** URL do loader gtag.js para um measurement id (G-XXXXXXX). Público (não é segredo). */
export const gtagSrc = (id: string): string =>
  `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;

/** JS de configuração do gtag (vai num <script> inline). cookie_domain raiz = cross-subdomínio. */
export function gtagInlineConfig(id: string, opts: GaOptions = {}): string {
  const cfg: Record<string, unknown> = {
    cookie_domain: opts.cookieDomain ?? ANALYTICS_DEFAULTS.cookieDomain,
  };
  if (opts.anonymizeIp) cfg.anonymize_ip = true;
  if (opts.debug) cfg.debug_mode = true;
  return [
    "window.dataLayer = window.dataLayer || [];",
    "function gtag(){dataLayer.push(arguments);}",
    "gtag('js', new Date());",
    `gtag('config', ${JSON.stringify(id)}, ${JSON.stringify(cfg)});`,
  ].join("\n");
}

/**
 * Client-side: injeta o loader gtag.js e configura o gtag.
 * Idempotente: 2 chamadas com o mesmo id = 1 só <script> injetado.
 * No-op fora do browser (SSR seguro).
 */
export function initGtag(id: string, opts: GaOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  const src = gtagSrc(id);
  if (document.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);

  const dl = window.dataLayer || [];
  window.dataLayer = dl;

  function gtag(...args: unknown[]) {
    dl.push(args);
  }
  window.gtag = gtag as typeof window.gtag;

  const anonymize = opts.anonymizeIp ?? true;
  const cfg: Record<string, unknown> = {
    cookie_domain: opts.cookieDomain ?? ANALYTICS_DEFAULTS.cookieDomain,
    send_page_view: false,
  };
  if (anonymize) cfg.anonymize_ip = true;
  if (opts.debug) cfg.debug_mode = true;

  gtag("js", new Date());
  gtag("config", id, cfg);
}
