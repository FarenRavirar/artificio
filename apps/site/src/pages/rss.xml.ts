import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { posts } from "../lib/content";
import { BRAND_ORIGIN, BRAND_NAME } from "@artificio/ui/static";

const toDate = (s: string): Date =>
  new Date(
    s.includes("/")
      ? s.replace(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, "$3-$2-$1")
      : s,
  );

export function GET(context: APIContext) {
  return rss({
    title: `${BRAND_NAME} — Blog`,
    description: "Conteúdo de RPG em português: notícias, análises, guias e traduções de D&D e além.",
    site: context.site ?? BRAND_ORIGIN,
    // Só itens com data válida: @astrojs/rss rejeita pubDate inválido e quebra o build inteiro.
    items: posts
      .map((p) => ({ p, d: toDate(p.date) }))
      .filter(({ d }) => !Number.isNaN(d.getTime()))
      .map(({ p, d }) => ({
        title: p.title,
        pubDate: d,
        description: p.excerpt,
        link: `/blog/${p.slug}/`,
        categories: p.cats.map((c) => c.name),
      })),
    customData: "<language>pt-BR</language>",
  });
}
