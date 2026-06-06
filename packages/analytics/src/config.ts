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
