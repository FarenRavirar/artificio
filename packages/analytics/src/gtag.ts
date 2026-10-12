import { ANALYTICS_DEFAULTS, GA_PRIVACY_CONFIG, type GaOptions } from "./config.js";

/** URL do loader gtag.js para um measurement id (G-XXXXXXX). Público (não é segredo). */
export const gtagSrc = (id: string): string =>
  `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;

/** JS de configuração do gtag (vai num <script> inline). cookie_domain raiz = cross-subdomínio. */
export function gtagInlineConfig(id: string, opts: GaOptions = {}): string {
  const cfg: Record<string, unknown> = {
    ...GA_PRIVACY_CONFIG,
    cookie_domain: opts.cookieDomain ?? ANALYTICS_DEFAULTS.cookieDomain,
  };
  if (opts.sendPageView === false) cfg.send_page_view = false;
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
 * Idempotente: 2 chamadas com o mesmo id = 1 só <script>.
 * No-op fora do browser (SSR seguro).
 *
 * A configuração entra como `<script>` inline com o snippet oficial
 * (`gtagInlineConfig`, o mesmo que o `site` usa), e não como função TS, porque o
 * gtag.js só processa o objeto `arguments` no `dataLayer`. A versão anterior
 * definia `function gtag(...args) { dl.push(args) }`: empurrava um Array, o gtag.js
 * ignorava em silêncio e nenhum `/g/collect` saía. Medido em produção no `mesas`
 * (2026-10-12, spec 105 T1.0): zero hits com o Array; um hit assim que o mesmo
 * `config` foi empurrado como `arguments`. Afetava `mesas`, `glossario` e
 * `downloads`; o `site` já usava o snippet inline e coletava. Escrever `arguments`
 * aqui em TS esbarra em `prefer-rest-params` (typescript-eslint recommended) — o
 * snippet em texto é a forma documentada pelo Google e não precisa de exceção de lint.
 * Os três apps não enviam CSP (medido por `curl -sI`); se um deles passar a enviar,
 * o inline precisa de hash/nonce, como no `site`.
 */
export function initGtag(id: string, opts: GaOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;

  if (!/^G-[A-Z0-9]+$/i.test(id)) {
    console.warn(`[analytics] measurement id invalido: ${id}`);
    return;
  }

  const src = gtagSrc(id);
  if (document.querySelector(`script[src="${src}"]`)) return;

  // Configuração ANTES do loader: o snippet oficial cria `window.gtag` e enfileira
  // `js`/`config` no `dataLayer`, que o gtag.js consome quando terminar de carregar.
  const inline = document.createElement("script");
  inline.dataset.artificioGtag = id;
  inline.text = gtagInlineConfig(id, {
    cookieDomain: opts.cookieDomain,
    anonymizeIp: opts.anonymizeIp ?? true,
    debug: opts.debug,
    // O `page_view` sai de `useAnalyticsPageviews` a cada rota (SPA).
    sendPageView: false,
  });
  document.head.appendChild(inline);

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}
