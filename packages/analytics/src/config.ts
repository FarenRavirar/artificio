// Config GA4 cross-subdomínio (D020). cookie_domain raiz = sessão de analytics atravessa
// todos os subdomínios (1 property cobre tudo); navegação entre subdomínios não vira referral.
export interface GaOptions {
  /** Domínio do cookie GA. Raiz p/ cross-subdomínio. */
  cookieDomain?: string;
  anonymizeIp?: boolean;
  debug?: boolean;
}

export const ANALYTICS_DEFAULTS = {
  cookieDomain: ".artificiorpg.com",
} as const;

// Sem sinal de anúncio: o produto é sem anúncios e sem coleta desnecessária
// (AGENTS.md §Produto). Medido em produção (2026-09-24): o gtag do `site` tentava
// `stats.g.doubleclick.net/g/collect` e `google.com.br/ads/ga-audiences`, que só a CSP
// barrava. `allow_google_signals: false` suprime esses beacons; `allow_ad_personalization_signals:
// false` marca os eventos como não usáveis para anúncio
// (developers.google.com/tag-platform/security/guides/privacy). Vale em todo `config`,
// não importa o que estiver ligado no painel do GA4.
export const GA_PRIVACY_CONFIG = {
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;
