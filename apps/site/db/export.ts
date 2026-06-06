// Export store -> src/data/posts.json (snapshot lido pelo Astro no build).
// Desacopla o build do banco (sem pglite no bundle Astro). Store = fonte; JSON = artefato.
// É o "Content Layer" pragmático: rebuild = export + astro build. Roda: pnpm --filter @artificio/site export
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "./connection";

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, "../src/data/posts.json");

interface PostRow {
  id: number; slug: string; title: string; excerpt: string; content_html: string;
  toc: unknown; published_at: string | Date | null; reading_time: number;
  featured_url: string | null; seo_description: string | null;
}
interface LinkRow { post_id: number; kind: string; slug: string; name: string; }

const fmt = (d: Date): string =>
  d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

async function main() {
  const db = await getDb();
  const posts = (await db.query<PostRow>(
    `SELECT id, slug, title, excerpt, content_html, toc, published_at, reading_time, featured_url, seo_description
     FROM posts WHERE status = 'publish' ORDER BY published_at DESC NULLS LAST`,
  )).rows;
  const links = (await db.query<LinkRow>(
    `SELECT pt.post_id, t.kind, t.slug, t.name FROM post_taxonomies pt JOIN taxonomies t ON t.id = pt.taxonomy_id`,
  )).rows;

  const byPost = new Map<number, { cats: { name: string; slug: string }[]; tags: { name: string; slug: string }[] }>();
  for (const l of links) {
    const e = byPost.get(l.post_id) ?? { cats: [], tags: [] };
    if (l.kind === "category" && l.slug !== "blog") e.cats.push({ name: l.name, slug: l.slug });
    if (l.kind === "tag") e.tags.push({ name: l.name, slug: l.slug });
    byPost.set(l.post_id, e);
  }

  const out = posts.map((p) => {
    const d = p.published_at ? new Date(p.published_at) : null;
    const terms = byPost.get(p.id) ?? { cats: [], tags: [] };
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      contentHtml: p.content_html,
      toc: Array.isArray(p.toc) ? p.toc : JSON.parse((p.toc as string) || "[]"),
      date: d ? d.toISOString() : "",
      dateFmt: d ? fmt(d) : "",
      readingTime: p.reading_time,
      image: p.featured_url ?? "",
      cats: terms.cats,
      tags: terms.tags,
      seo: { description: p.seo_description ?? p.excerpt.slice(0, 160) },
    };
  });

  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`export: ${out.length} posts -> ${OUT}`);
  await db.close();
}

main().catch((e) => {
  console.error("[export] ERRO:", e);
  process.exit(1);
});
