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
