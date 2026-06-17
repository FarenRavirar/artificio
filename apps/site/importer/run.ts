// Importador WP -> store (one-shot, idempotente por id/slug). DRY-RUN: sem Cloudinary
// (featured_url = URL original do WP). Escopo D046: post + taxonomias + comentários.
// Roda: pnpm --filter @artificio/site import   (precisa migrate antes)
import { getDb } from "../db/connection";
import { fetchAll, countOf, type WpTerm } from "./wp";
import { sanitize, withToc, stripTags, decode, readingTime, toDate } from "./sanitize";
import {
  buildMediaMap,
  cloudinaryEnabled,
  extractImageUrls,
  extractMediaUrls,
  getMediaReport,
  mediaMigrationEnabled,
  pruneWpAssets,
  recordPruned,
  resetMediaReport,
  rewriteUrls,
} from "./media";
import { PAGES_ALLOW } from "./pages";

interface WpRendered { rendered: string; }
interface WpPost {
  id: number; slug: string; date: string; modified: string; status: string;
  title: WpRendered; excerpt: WpRendered; content: WpRendered;
  yoast_head_json?: { title?: string; description?: string; canonical?: string; og_image?: { url: string }[] };
  _embedded?: { "wp:featuredmedia"?: WpMedia[]; "wp:term"?: WpTerm[][] };
}
interface WpMedia { id: number; source_url: string; alt_text?: string; mime_type?: string; media_details?: { width?: number; height?: number }; }
interface WpCat { id: number; slug: string; name: string; parent: number; count: number; }
interface WpTag { id: number; slug: string; name: string; count: number; }
interface WpComment { id: number; post: number; author_name: string; content: WpRendered; date: string; parent: number; }
interface WpPage {
  id: number; slug: string; status: string; modified: string;
  title: WpRendered; content: WpRendered;
  yoast_head_json?: { description?: string };
}

const iso = (s?: string): string | null => {
  if (!s) return null;
  const d = toDate(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

/** Resolve uma URL WP via media_map; se não migrou (continua WP) devolve null (D074: nada de URL WP servida). */
const cleanMapped = (wpUrl: string | null, map: Map<string, string>): string | null => {
  if (!wpUrl) return null;
  const mapped = map.get(wpUrl) ?? wpUrl;
  return /\/wp-content\/uploads\//.test(mapped) ? null : mapped;
};

async function main() {
  if (process.env.SITE_MIGRATE_MEDIA === "true" && !cloudinaryEnabled()) {
    throw new Error("SITE_MIGRATE_MEDIA=true exige configuracao Cloudinary presente");
  }
  const db = await getDb();
  let exitAfterClose = false;
  try {
    resetMediaReport();
    console.log(`[import] driver=${db.isPg ? "pg" : "pglite"} — mídia=${mediaMigrationEnabled() ? "Cloudinary (upload)" : "DRY-RUN (URLs WP)"}`);

    // 1) Taxonomias (categorias + tags). 2 passes p/ parent_id (forward refs).
    const cats = await fetchAll<WpCat>("categories");
    const tags = await fetchAll<WpTag>("tags");
  for (const c of cats) {
    await db.query(
      `INSERT INTO taxonomies (id, kind, slug, name, count) VALUES ($1,'category',$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind, slug=EXCLUDED.slug, name=EXCLUDED.name, count=EXCLUDED.count`,
      [c.id, c.slug, decode(c.name), c.count],
    );
  }
  for (const t of tags) {
    await db.query(
      `INSERT INTO taxonomies (id, kind, slug, name, count) VALUES ($1,'tag',$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET kind=EXCLUDED.kind, slug=EXCLUDED.slug, name=EXCLUDED.name, count=EXCLUDED.count`,
      [t.id, t.slug, decode(t.name), t.count],
    );
  }
  for (const c of cats) {
    if (c.parent) await db.query("UPDATE taxonomies SET parent_id=$2 WHERE id=$1", [c.id, c.parent]);
  }
  console.log(`[import] taxonomias: ${cats.length} categorias + ${tags.length} tags`);

  // 2) Posts (+ mídia featured + vínculos de taxonomia).
  const posts = await fetchAll<WpPost>(
    "posts?_embed=wp:featuredmedia,wp:term&_fields=id,slug,title,excerpt,content,date,modified,status,yoast_head_json,_embedded,_links",
  );
  let linked = 0;
  for (const p of posts) {
    const { html: rawHtml, toc } = withToc(sanitize(p.content.rendered));
    const media = p._embedded?.["wp:featuredmedia"]?.[0];
    const wpFeatured = media?.source_url ?? null;
    const seo = p.yoast_head_json ?? {};
    const wpOg = seo.og_image?.[0]?.url ?? null;
    // mídia: featured + og + inline (img + não-imagem) -> Cloudinary (ou URL WP em dry-run). Idempotente (media_map).
    const mmap = await buildMediaMap(
      db,
      [wpFeatured, wpOg, ...extractImageUrls(rawHtml), ...extractMediaUrls(rawHtml)].filter((u): u is string => Boolean(u)),
    );
    // Política D074: asset não migrado é removido do HTML (a URL WP morre), nunca pendurado.
    const { html: contentHtml, removed } = pruneWpAssets(rewriteUrls(rawHtml, mmap));
    if (removed.length) recordPruned(removed);
    const featuredUrl = cleanMapped(wpFeatured, mmap);
    if (media?.source_url) {
      const cloud = mmap.get(media.source_url);
      await db.query(
        `INSERT INTO media (id, wp_url, cloudinary_url, alt, width, height, mime) VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (id) DO UPDATE SET wp_url=EXCLUDED.wp_url, cloudinary_url=EXCLUDED.cloudinary_url, alt=EXCLUDED.alt, width=EXCLUDED.width, height=EXCLUDED.height, mime=EXCLUDED.mime`,
        [media.id, media.source_url, cloud && cloud !== media.source_url ? cloud : null, media.alt_text ?? null, media.media_details?.width ?? null, media.media_details?.height ?? null, media.mime_type ?? null],
      );
    }
    const ogImage = cleanMapped(wpOg, mmap) ?? featuredUrl;
    await db.query(
      `INSERT INTO posts (id, slug, title, excerpt, content_html, toc, status, published_at, updated_at, reading_time, featured_url, seo_title, seo_description, canonical, og_image)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, title=EXCLUDED.title, excerpt=EXCLUDED.excerpt,
         content_html=EXCLUDED.content_html, toc=EXCLUDED.toc, status=EXCLUDED.status, published_at=EXCLUDED.published_at,
         updated_at=EXCLUDED.updated_at, reading_time=EXCLUDED.reading_time, featured_url=EXCLUDED.featured_url,
         seo_title=EXCLUDED.seo_title, seo_description=EXCLUDED.seo_description, canonical=EXCLUDED.canonical, og_image=EXCLUDED.og_image`,
      [
        p.id, p.slug, decode(p.title.rendered), stripTags(p.excerpt.rendered).slice(0, 300), contentHtml,
        JSON.stringify(toc), p.status, iso(p.date), iso(p.modified), readingTime(p.content.rendered),
        featuredUrl, seo.title ? decode(seo.title) : null, seo.description ?? null,
        seo.canonical ?? `https://artificiorpg.com/blog/${p.slug}/`, ogImage,
      ],
    );
    // vínculos de taxonomia (limpa + reinsere)
    await db.query("DELETE FROM post_taxonomies WHERE post_id=$1", [p.id]);
    const terms = (p._embedded?.["wp:term"] ?? []).flat();
    for (const term of terms) {
      await db.query(
        "INSERT INTO post_taxonomies (post_id, taxonomy_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        [p.id, term.id],
      );
      linked += 1;
    }
  }
  console.log(`[import] posts: ${posts.length} (vínculos taxonomia: ${linked})`);

  // 3) Comentários (só dos posts importados).
  const postIds = new Set(posts.map((p) => p.id));
  const comments = await fetchAll<WpComment>("comments");
  let importedComments = 0;
  for (const c of comments) {
    if (!postIds.has(c.post)) continue;
    await db.query(
      `INSERT INTO comments (id, post_id, author_name, content_html, created_at, parent_id) VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET author_name=EXCLUDED.author_name, content_html=EXCLUDED.content_html`,
      [c.id, c.post, decode(c.author_name || ""), sanitize(c.content.rendered), iso(c.date), c.parent || null],
    );
    importedComments += 1;
  }
  console.log(`[import] comentários: ${importedComments}`);

  // 3.5) Pages institucionais (allow-list D046). HTML pode ser Elementor → sanitize + media map.
  const wpPages = await fetchAll<WpPage>(
    "pages?_fields=id,slug,title,content,status,modified,yoast_head_json&per_page=100",
  );
  let importedPages = 0;
  for (const pg of wpPages) {
    if (!PAGES_ALLOW.has(pg.slug)) continue;
    const cleaned = sanitize(pg.content.rendered);
    const pmap = await buildMediaMap(db, [...extractImageUrls(cleaned), ...extractMediaUrls(cleaned)]);
    const { html: contentHtml, removed } = pruneWpAssets(rewriteUrls(cleaned, pmap));
    if (removed.length) recordPruned(removed);
    await db.query(
      `INSERT INTO pages (id, slug, title, content_html, status, updated_at, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET slug=EXCLUDED.slug, title=EXCLUDED.title, content_html=EXCLUDED.content_html,
         status=EXCLUDED.status, updated_at=EXCLUDED.updated_at, seo_description=EXCLUDED.seo_description`,
      [pg.id, pg.slug, decode(pg.title.rendered), contentHtml, pg.status, iso(pg.modified), pg.yoast_head_json?.description ?? null],
    );
    importedPages += 1;
  }
  console.log(`[import] pages institucionais: ${importedPages}/${PAGES_ALLOW.size} (de ${wpPages.length} no WP)`);

    const mediaReport = getMediaReport();
    console.log("\n=== MÍDIA ===");
    console.log(`migradas=${mediaReport.migrated} falhas=${mediaReport.failures.length} removidas_html=${mediaReport.pruned.length}`);
    for (const failure of mediaReport.failures) {
      console.log(`- falha: ${failure.wpUrl} :: ${failure.motivo}`);
    }
    for (const url of mediaReport.pruned) {
      console.log(`- removida do HTML: ${url}`);
    }
    console.log("=============\n");
    exitAfterClose = mediaMigrationEnabled() && mediaReport.migrated === 0 && mediaReport.failures.length > 0;

    // Verificação residual-zero (D074): nenhuma coluna SERVIDA pode conter wp-content/uploads.
    const wpLike = "%wp-content/uploads%";
    const residualPosts = (await db.query<{ n: string }>(
      "SELECT count(*) n FROM posts WHERE content_html LIKE $1 OR featured_url LIKE $1 OR og_image LIKE $1 OR coalesce(seo_description,'') LIKE $1",
      [wpLike],
    )).rows[0].n;
    const residualPages = (await db.query<{ n: string }>(
      "SELECT count(*) n FROM pages WHERE content_html LIKE $1 OR coalesce(seo_description,'') LIKE $1",
      [wpLike],
    )).rows[0].n;
    console.log("=== RESIDUAL WP (servido) ===");
    console.log(`posts=${residualPosts} pages=${residualPages} ${Number(residualPosts) + Number(residualPages) === 0 ? "✓ ZERO" : "⚠ RESIDUAL"}`);
    console.log("media_map.wp_url / media.wp_url são chaves de idempotência (não servidas), fora deste critério.");
    console.log("=============================\n");

    // 4) Relatório de paridade vs WP (R9).
    const wpPosts = await countOf("posts");
    const wpComments = await countOf("comments");
    const storePosts = (await db.query<{ n: string }>("SELECT count(*) n FROM posts")).rows[0].n;
    const storeTax = (await db.query<{ n: string }>("SELECT count(*) n FROM taxonomies")).rows[0].n;
    const storeComments = (await db.query<{ n: string }>("SELECT count(*) n FROM comments")).rows[0].n;
    console.log("\n=== PARIDADE ===");
    console.log(`posts:      WP=${wpPosts}  store=${storePosts}  ${Number(storePosts) >= wpPosts ? "✓" : "⚠ FALTAM"}`);
    console.log(`taxonomias: WP=${cats.length + tags.length}  store=${storeTax}`);
    console.log(`comentários:WP(total)=${wpComments}  store(dos posts)=${storeComments}`);
    console.log("================\n");
  } finally {
    await db.close();
  }
  if (exitAfterClose) {
    console.error("[import] ERRO: nenhuma mídia migrou e houve falhas de mídia");
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[import] ERRO:", e);
  process.exit(1);
});
