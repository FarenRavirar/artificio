// <lastmod> do sitemap do `site` (spec 102 T3.4).
//
// Medido em 2026-09-11: `curl -s https://artificiorpg.com/sitemap-0.xml | grep -c lastmod` → 0.
// Cada <url> trazia só <loc>. Sem lastmod, nada sinaliza ao Google que os 126 posts mudaram, e a
// redescoberta depois da correção de canonical (T3.2/T3.3) fica no ritmo natural de recrawl.
//
// Duas travas deliberadas, porque lastmod não confiável é pior que lastmod ausente — o Google
// ignora o campo quando percebe data inventada:
//   1. A data vem de `posts.updated_at` (edição real), nunca da data do build.
//   2. URL sem data própria (home, /blog/, taxonomias, busca) NÃO recebe lastmod.

// Forma mínima consumida daqui. Deliberadamente NÃO importa `Post` de `./content.js`: aquele
// módulo puxa assets (`@artificio/ui/static` → `_logo.png`) e este arquivo é carregado pelo
// `astro.config.mjs`, que roda fora do pipeline do Vite — medido: "Unknown file extension .png".
export interface LastmodSource {
  slug: string;
  updated?: string;
}

/** Índice slug → data ISO de última edição, só para posts com data real. */
export function buildLastmodIndex(posts: readonly LastmodSource[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const post of posts) {
    const raw = post.updated ?? "";
    if (!raw) continue;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    index.set(post.slug, d.toISOString());
  }
  return index;
}

/** Slug do post a partir da URL do sitemap; `null` para qualquer URL que não seja post. */
export function postSlugFromUrl(url: string): string | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const m = /^\/blog\/([^/]+)\/?$/.exec(path);
  if (!m) return null;
  const slug = m[1];
  // /blog/categoria/... e /blog/tag/... são listagens, não posts: não têm data própria.
  if (slug === "categoria" || slug === "tag" || slug === "busca") return null;
  return slug;
}

export interface SitemapItem {
  url: string;
  lastmod?: string;
  [key: string]: unknown;
}

/**
 * `serialize` do @astrojs/sitemap: preenche lastmod só quando há data real de edição.
 * Retorna a própria entrada (sem lastmod) para todo o resto.
 */
export function serializeWithLastmod(
  item: SitemapItem,
  index: Map<string, string>,
): SitemapItem {
  const slug = postSlugFromUrl(item.url);
  if (!slug) return item;
  const lastmod = index.get(slug);
  if (!lastmod) return item;
  return { ...item, lastmod };
}
