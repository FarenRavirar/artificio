// Acesso ao conteúdo do blog. Etapa 1: lê posts.json (fixtures WP normalizados).
// Etapa futura: vira Content Layer loader lendo o store Postgres (D005/D048).
import postsData from "../data/posts.json";
import pagesData from "../data/pages.json";
// Marca + nav do portal = FONTE ÚNICA static-safe em @artificio/ui (D062/D-SHELL1/B2).
import { brandLogoNavy, brandLogoNeg, defaultNavItems } from "@artificio/ui/static";

export interface Term {
  name: string;
  slug: string;
}
export interface TocItem {
  id: string;
  text: string;
  level: number;
}
export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml: string;
  toc: TocItem[];
  date: string;
  dateFmt: string;
  /** Data real da última edição (ISO) — alimenta o <lastmod> do sitemap.
   *  Opcional porque o snapshot versionado em `src/data/posts.json` pode ser anterior ao
   *  export que passou a emitir o campo; sem data real, o sitemap omite `<lastmod>`. */
  updated?: string;
  readingTime: number;
  image: string;
  cats: Term[];
  tags: Term[];
  seo: SeoMeta;
}

export interface SeoMeta {
  title?: string;
  description: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
  twitterCard?: string;
  noindex?: boolean;
}

export interface Page {
  id: number;
  slug: string;
  title: string;
  contentHtml: string;
  seo: SeoMeta;
}

export const posts = postsData as Post[];
export const pages = pagesData as Page[];
export const logos: { logoNavy: string; logoNeg: string } = {
  logoNavy: brandLogoNavy.src,
  logoNeg: brandLogoNeg.src,
};

export function getPageBySlug(slug: string): Page | undefined {
  return pages.find((p) => p.slug === slug);
}

export function getPost(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function related(p: Post, n = 3): Post[] {
  const r = posts.filter(
    (o) => o.id !== p.id && o.cats.some((c) => p.cats.some((pc) => pc.slug === c.slug)),
  );
  return (r.length ? r : posts.filter((o) => o.id !== p.id)).slice(0, n);
}

// Nav cross-projetos do portal (D017): fonte unica static-safe, sem barrel React/auth.
export const MODULES: { label: string; href: string }[] = defaultNavItems;

// Nav secundário (2ª linha): categorias principais do blog. Não substitui o nav do portal.
//
// Não existe item "Blog" em nav nenhum, e isso é coerente: o site TODO é o blog. O nav do
// portal (`defaultNavItems`, `packages/ui/src/modules.ts`) lista os outros projetos
// (Glossário, Mesas, Downloads, Esferas, SRD, WhatsApps) — o conteúdo editorial é a própria
// raiz, não um item ao lado deles. Medido em 2026-09-14; não procurar "link do blog faltando".
export const SECTIONS: { label: string; href: string }[] = [
  { label: "Notícias", href: "/blog/categoria/noticias/" },
  { label: "Análises", href: "/blog/categoria/analises/" },
  { label: "Guias", href: "/blog/categoria/guias/" },
  { label: "Downloads", href: "/blog/categoria/downloads/" },
];

interface TermAgg extends Term {
  count: number;
}
function aggregate(key: "cats" | "tags"): TermAgg[] {
  const map = new Map<string, TermAgg>();
  for (const p of posts) {
    for (const t of p[key]) {
      const cur = map.get(t.slug) ?? { ...t, count: 0 };
      cur.count += 1;
      map.set(t.slug, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/* ---- paginação de `/blog/` (T3.5c, spec 102) ----

   24 por fatia → 6 páginas para os 126 posts atuais. O número é decisão de engenharia,
   NÃO recomendação do Google: a doc primária de paginação não menciona quantidade de
   itens por página (medido em 2026-09-14; a "faixa de 24–48" atribuída ao Google por
   páginas de agência não existe na fonte). O que sustenta o 24 é o peso do HTML por
   fatia (184.714 B em `/blog/` inteiro → ~46 KB, medido) e um paginador numerado que
   cabe na tela do celular sem reticências. */
export const POSTS_POR_FATIA = 24;

export const totalFatias = (): number => Math.max(1, Math.ceil(posts.length / POSTS_POR_FATIA));

/** Posts da fatia `page` (1-based). A fatia 1 é `/blog/`; não existe `/blog/1/`. */
export const postsDaFatia = (page: number): Post[] =>
  posts.slice((page - 1) * POSTS_POR_FATIA, page * POSTS_POR_FATIA);

/** Slugs puramente numéricos, que colidiriam com a URL de uma fatia.
 *
 *  `/blog/2/` (fatia) e `/blog/2/` (post de slug "2") escrevem o MESMO
 *  `blog/2/index.html`, e o pipeline do Astro não avisa: `generate.js` só checa
 *  conflito com `publicDir`, e o último write vence em silêncio. Hoje não há colisão
 *  (medido: 0 de 126 em produção, 0 de 8 no snapshot versionado), mas sem este guard um
 *  post futuro derrubaria uma fatia sem erro de build. */
export const slugsNumericos = (): Set<string> =>
  new Set(posts.filter((p) => /^\d+$/.test(p.slug)).map((p) => p.slug));

export const allCategories = (): TermAgg[] => aggregate("cats");
export const allTags = (): TermAgg[] => aggregate("tags");
export const postsByCat = (slug: string): Post[] => posts.filter((p) => p.cats.some((c) => c.slug === slug));
export const postsByTag = (slug: string): Post[] => posts.filter((p) => p.tags.some((t) => t.slug === slug));
export const catName = (slug: string): string => allCategories().find((c) => c.slug === slug)?.name ?? slug;
export const tagName = (slug: string): string => allTags().find((t) => t.slug === slug)?.name ?? slug;
