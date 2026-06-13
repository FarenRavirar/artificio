// Acesso ao conteúdo do blog. Etapa 1: lê posts.json (fixtures WP normalizados).
// Etapa futura: vira Content Layer loader lendo o store Postgres (D005/D048).
import postsData from "../data/posts.json";
import pagesData from "../data/pages.json";
// Marca + nav do portal = FONTE ÚNICA em @artificio/ui (D062/D-SHELL1). Sem espelho local.
import { brandLogoNavy, brandLogoNeg } from "@artificio/ui/brand";
import { defaultNavItems } from "@artificio/ui/modules";

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

// Nav cross-projetos do portal (unidade D017: une apps por nav + SSO + design system).
// Espelha `defaultNavItems` do @artificio/ui; replicado local (zero-JS no Astro, sem puxar
// o barrel React/@artificio/auth do header). Mantido em sync com packages/ui/src/modules.ts.
// Nav primário do portal = FONTE ÚNICA `defaultNavItems` (@artificio/ui). Sem espelho local.
export const MODULES: { label: string; href: string }[] = defaultNavItems;

// Nav secundário (2ª linha): categorias principais do blog. Não substitui o nav do portal.
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

export const allCategories = (): TermAgg[] => aggregate("cats");
export const allTags = (): TermAgg[] => aggregate("tags");
export const postsByCat = (slug: string): Post[] => posts.filter((p) => p.cats.some((c) => c.slug === slug));
export const postsByTag = (slug: string): Post[] => posts.filter((p) => p.tags.some((t) => t.slug === slug));
export const catName = (slug: string): string => allCategories().find((c) => c.slug === slug)?.name ?? slug;
export const tagName = (slug: string): string => allTags().find((t) => t.slug === slug)?.name ?? slug;
