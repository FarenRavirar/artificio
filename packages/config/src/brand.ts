export const BRAND_NAME = "Artifício RPG";

export const BRAND_DOMAIN = "artificiorpg.com";

export const BRAND_ORIGIN = `https://${BRAND_DOMAIN}` as const;

export const BRAND_TAGLINE_FREE =
  "Gratuito, sem anúncios, sem coleta desnecessária.";

/** Origin público canônico de um módulo/projeto (subdomínio sob o domínio da marca). */
export const moduleOrigin = (subdomain: string) =>
  `https://${subdomain}.${BRAND_DOMAIN}` as const;

/** Origins canônicos por módulo. Fonte única — não hardcodar URLs de subdomínio. */
export const MODULE_ORIGINS = {
  glossario: moduleOrigin("glossario"),
  mesas: moduleOrigin("mesas"),
  downloads: moduleOrigin("downloads"),
  esferas: moduleOrigin("esferas"),
  srd: moduleOrigin("srd"),
  links: moduleOrigin("links"),
} as const;
