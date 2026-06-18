// @artificio/analytics — GA4 cross-subdomínio (D020). Snippet SSR + helpers client. Zero deps.
// O measurement id (G-XXXX) é público; cada app lê do seu env (site: PUBLIC_GA_ID; mesas: VITE_GA_ID).
// Exclusão de referral interno + 1 property = config no painel GA4 (admin).
export type { GaOptions } from "./config.js";
export { ANALYTICS_DEFAULTS } from "./config.js";
export { gtagSrc, gtagInlineConfig, initGtag } from "./gtag.js";
export {
  trackEvent,
  trackPageview,
  trackSearch,
  trackViewTermo,
  trackSelectMesa,
  trackFilterSistema,
} from "./events.js";
