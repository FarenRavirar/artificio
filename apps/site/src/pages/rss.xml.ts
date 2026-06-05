import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { posts } from "../lib/content";

const toDate = (s: string): Date =>
  new Date(s.includes("/") ? s.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2") : s);

export function GET(context: APIContext) {
  return rss({
    title: "Artifício RPG — Blog",
    description: "Conteúdo de RPG em português: notícias, análises, guias e traduções de D&D e além.",
    site: context.site ?? "https://beta.artificiorpg.com",
    items: posts.map((p) => ({
      title: p.title,
      pubDate: toDate(p.date),
      description: p.excerpt,
      link: `/blog/${p.slug}/`,
      categories: p.cats.map((c) => c.name),
    })),
    customData: "<language>pt-BR</language>",
  });
}
