// Config canônica de SEO do Artifício RPG. Domínio derivado de PUBLIC_SITE_URL (env) p/ beta/prod
// distintos (spec 030 R11). Fallback = raiz (artificiorpg.com).

import { BRAND_NAME, BRAND_ORIGIN } from "@artificio/config";

export const SITE = {
  name: BRAND_NAME,
  origin: process.env.PUBLIC_SITE_URL || BRAND_ORIGIN,
  locale: "pt-BR",
  description: "Hub de projetos de RPG em português: notícias, análises, guias e traduções.",
  /** Handle do Twitter/X, se houver. */
  twitter: undefined as string | undefined,
  /** Logo absoluto p/ JSON-LD Organization. */
  logo: `${BRAND_ORIGIN}/logo.png`,
} as const;

/** Junta caminho ao domínio canônico, garantindo trailing slash de diretório. */
export function canonicalUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return SITE.origin + p;
}
