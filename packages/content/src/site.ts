// Config canônica de SEO do Artifício RPG. Domínio final = raiz (D019): autoridade concentra aqui,
// mesmo enquanto o site vive em beta. (canonical sempre aponta p/ a URL final).

export const SITE = {
  name: "Artifício RPG",
  origin: "https://artificiorpg.com",
  locale: "pt-BR",
  description: "Hub de projetos de RPG em português: notícias, análises, guias e traduções.",
  /** Handle do Twitter/X, se houver. */
  twitter: undefined as string | undefined,
  /** Logo absoluto p/ JSON-LD Organization. */
  logo: "https://artificiorpg.com/logo.png",
} as const;

/** Junta caminho ao domínio canônico, garantindo trailing slash de diretório. */
export function canonicalUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return SITE.origin + p;
}
