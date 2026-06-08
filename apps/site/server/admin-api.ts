// API de autoria do admin (spec 011). CRUD de posts/pages/taxonomias/redirects + slug-check + rebuild.
// Gate atual = requireAdmin (role SSO 'admin'); roles editoriais granulares = fase futura (D052).
import { Router, type RequestHandler } from "express";
import type { AuthenticatedRequest } from "@artificio/auth";
import { cleanHtml, withToc, readingTime, slugify, uniqueSlug, excerptFromHtml } from "./lib/content.js";
import { renderPreviewFromContent } from "./preview.js";
import { runJob } from "./jobs.js";
import * as Posts from "../db/repo/posts.js";
import * as Pages from "../db/repo/pages.js";
import * as Tax from "../db/repo/taxonomies.js";
import * as Redirects from "../db/repo/redirects.js";
import { reloadRedirects } from "./redirect-cache.js";

const REDIRECT_CODES = [301, 302, 307, 308];

const asInt = (v: unknown): number | undefined => {
  const n = Number(v); return Number.isFinite(n) ? n : undefined;
};
/** Id de rota: inteiro positivo finito, senão null (→ 400). */
const parseId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const authorOf = (req: unknown): string | null =>
  (req as AuthenticatedRequest).session?.user?.id ?? null;

export function adminApi(requireAuth: RequestHandler, requireAdmin: RequestHandler): Router {
  const r = Router();
  r.use(requireAuth, requireAdmin);

  // ---- slug-check (sugestão + unicidade) ----
  r.get("/slug-check", async (req, res) => {
    const type = req.query.type === "page" ? "page" : "post";
    const base = String(req.query.slug || req.query.title || "");
    const id = asInt(req.query.id);
    const exists = type === "page"
      ? (s: string) => Pages.pageSlugExists(s, id)
      : (s: string) => Posts.slugExists(s, id);
    const slug = slugify(base);
    const taken = slug ? await exists(slug) : false;
    const suggestion = await uniqueSlug(base, exists);
    res.json({ slug, available: !taken, suggestion });
  });

  // ================= POSTS =================
  r.get("/posts", async (req, res) => {
    const items = await Posts.listPosts({
      status: req.query.status as Posts.PostStatus | undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      limit: asInt(req.query.limit), offset: asInt(req.query.offset),
    });
    res.json({ items });
  });

  r.get("/posts/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const p = await Posts.getPost(id);
    if (!p) { res.status(404).json({ error: "not_found" }); return; }
    res.json(p);
  });

  r.post("/posts", async (req, res) => {
    const built = await buildPost(req.body, undefined, authorOf(req));
    const id = await Posts.createPost(built.write);
    await Posts.setPostTaxonomies(id, built.cats, built.tags);
    const rebuild = maybeRebuild(built.write.status);
    res.status(201).json({ id, slug: built.write.slug, rebuild });
  });

  r.put("/posts/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const existing = await Posts.getPost(id);
    if (!existing) { res.status(404).json({ error: "not_found" }); return; }
    const built = await buildPost(req.body, id, existing.author_id ?? authorOf(req));
    // slug mudou em post publicado -> 301 do caminho antigo
    if (existing.slug !== built.write.slug && existing.status === "publish") {
      await Redirects.addRedirect(`/blog/${existing.slug}/`, `/blog/${built.write.slug}/`);
      await reloadRedirects();
    }
    await Posts.updatePost(id, built.write);
    await Posts.setPostTaxonomies(id, built.cats, built.tags);
    // republicar/despublicar muda o SSG -> rebuild server-side (atômico p/ o cliente)
    const rebuild = maybeRebuild(built.write.status, existing.status);
    res.json({ id, slug: built.write.slug, rebuild });
  });

  r.post("/posts/:id/status", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const status = String(req.body?.status || "") as Posts.PostStatus;
    if (!STATUSES.includes(status)) { res.status(400).json({ error: "bad_status" }); return; }
    const prev = await Posts.getPostStatus(id);
    if (prev == null) { res.status(404).json({ error: "not_found" }); return; }
    const ok = await Posts.setPostStatus(id, status);
    if (!ok) { res.status(404).json({ error: "not_found" }); return; }
    const rebuild = maybeRebuild(status, prev); // só rebuilda se publish entra/sai do público
    res.json({ ok: true, rebuild });
  });

  // Apagar permanentemente um post. Exige estar na lixeira (R4b): só deleta a partir de `trash`.
  r.delete("/posts/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const prev = await Posts.getPostStatus(id);
    if (prev == null) { res.status(404).json({ error: "not_found" }); return; }
    if (prev !== "trash") { res.status(409).json({ error: "must_trash_first" }); return; }
    const ok = await Posts.deletePost(id);
    res.json({ ok }); // já estava em trash = fora do público; sem rebuild
  });

  // ================= PAGES =================
  r.get("/pages", async (req, res) => {
    res.json({ items: await Pages.listPages({ status: req.query.status as Pages.PageStatus | undefined, q: req.query.q ? String(req.query.q) : undefined }) });
  });
  r.get("/pages/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const p = await Pages.getPage(id);
    if (!p) { res.status(404).json({ error: "not_found" }); return; }
    res.json(p);
  });
  r.post("/pages", async (req, res) => {
    const w = await buildPage(req.body, undefined, authorOf(req));
    const id = await Pages.createPage(w);
    res.status(201).json({ id, slug: w.slug, rebuild: maybeRebuild(w.status) });
  });
  r.put("/pages/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const existing = await Pages.getPage(id);
    if (!existing) { res.status(404).json({ error: "not_found" }); return; }
    const w = await buildPage(req.body, id, existing.author_id ?? authorOf(req));
    if (existing.slug !== w.slug && existing.status === "publish") {
      await Redirects.addRedirect(`/${existing.slug}/`, `/${w.slug}/`);
      await reloadRedirects();
    }
    await Pages.updatePage(id, w);
    res.json({ id, slug: w.slug, rebuild: maybeRebuild(w.status, existing.status) });
  });
  r.post("/pages/:id/status", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const status = String(req.body?.status || "") as Pages.PageStatus;
    if (!["draft", "publish", "trash", "archived"].includes(status)) { res.status(400).json({ error: "bad_status" }); return; }
    const prev = await Pages.getPageStatus(id);
    if (prev == null) { res.status(404).json({ error: "not_found" }); return; }
    const ok = await Pages.setPageStatus(id, status);
    if (!ok) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ ok: true, rebuild: maybeRebuild(status, prev) });
  });

  // Apagar permanentemente uma page. Exige estar na lixeira (R4b).
  r.delete("/pages/:id", async (req, res) => {
    const id = parseId(req.params.id);
    if (id == null) { res.status(400).json({ error: "bad_id" }); return; }
    const prev = await Pages.getPageStatus(id);
    if (prev == null) { res.status(404).json({ error: "not_found" }); return; }
    if (prev !== "trash") { res.status(409).json({ error: "must_trash_first" }); return; }
    const ok = await Pages.deletePage(id);
    res.json({ ok });
  });

  // ================= TAXONOMIAS =================
  r.get("/taxonomies", async (req, res) => {
    res.json({ items: await Tax.listTerms(req.query.kind as Tax.TermKind | undefined) });
  });
  r.post("/taxonomies", async (req, res) => {
    const kind: Tax.TermKind = req.body?.kind === "tag" ? "tag" : "category";
    const name = String(req.body?.name || "").trim();
    if (!name) { res.status(400).json({ error: "name_required" }); return; }
    const slug = await uniqueSlug(req.body?.slug || name, (s) => Tax.termSlugExists(kind, s));
    const parentId = asInt(req.body?.parent_id) ?? null;
    const id = await Tax.createTerm(kind, name, slug, parentId);
    res.status(201).json({ id, kind, name, slug, parent_id: parentId });
  });

  // ================= REDIRECTS =================
  r.get("/redirects", async (_req, res) => res.json({ items: await Redirects.listRedirects() }));
  r.post("/redirects", async (req, res) => {
    const from = String(req.body?.from_path || "").trim();
    const to = String(req.body?.to_path || "").trim();
    if (!from || !to) { res.status(400).json({ error: "from_to_required" }); return; }
    if (from === to) { res.status(400).json({ error: "from_equals_to" }); return; }
    if (!isInternalPath(from) || !isInternalPath(to)) { res.status(400).json({ error: "invalid_redirect_path" }); return; }
    const reqCode = asInt(req.body?.code) ?? 301;
    const code = REDIRECT_CODES.includes(reqCode) ? reqCode : 301;
    await Redirects.addRedirect(from, to, code);
    await reloadRedirects();
    res.status(201).json({ ok: true, code });
  });

  // ============ PREVIEW STATELESS (não persiste, não publica) ============
  r.post("/preview", (req, res) => {
    const html = renderPreviewFromContent(
      String(req.body?.title || ""),
      String(req.body?.status || "rascunho"),
      cleanHtml(String(req.body?.content_html || "")),
    );
    res.type("html").send(html);
  });

  // ================= REBUILD (publicação) =================
  r.post("/rebuild", (_req, res) => {
    const out = runJob("rebuild", "rebuild");
    res.status(out.started ? 202 : 409).json(out);
  });

  return r;
}

const STATUSES: Posts.PostStatus[] = ["draft", "pending", "publish", "scheduled", "private", "trash", "archived"];

function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/[\r\n]/.test(path);
}

// Dispara rebuild SSG no servidor quando a mudança afeta o público (publicar OU despublicar).
// Single-flight (jobs.ts); o cliente não precisa de uma 2ª requisição (corrige inconsistência DB↔SSG).
function maybeRebuild(newStatus: string, prevStatus?: string): { started: boolean; busy?: boolean } {
  const affectsPublic = newStatus === "publish" || prevStatus === "publish";
  if (!affectsPublic) return { started: false };
  const r = runJob("rebuild", "rebuild");
  return { started: r.started, busy: r.busy };
}

// Monta PostWrite a partir do body do editor (sanitiza HTML, toc, fallbacks, slug único).
async function buildPost(body: Record<string, unknown>, id: number | undefined, authorId: string | null): Promise<{ write: Posts.PostWrite; cats: number[]; tags: number[] }> {
  const title = String(body.title || "").trim() || "Sem título";
  const rawHtml = String(body.content_html || "");
  const safe = cleanHtml(rawHtml);
  const { html, toc } = withToc(safe);
  const slug = await uniqueSlug(String(body.slug || title), (s) => Posts.slugExists(s, id));
  const excerpt = String(body.excerpt || "").trim() || excerptFromHtml(html);
  const status = (STATUSES.includes(body.status as Posts.PostStatus) ? body.status : "draft") as Posts.PostStatus;
  const publishedAt = body.published_at ? String(body.published_at)
    : status === "publish" ? new Date().toISOString() : null;
  const write: Posts.PostWrite = {
    title, slug, excerpt, content_html: html, block_doc: body.block_doc ?? null, toc,
    status, published_at: publishedAt, reading_time: readingTime(html),
    featured_url: strOrNull(body.featured_url),
    seo_title: strOrNull(body.seo_title) ?? title,
    seo_description: strOrNull(body.seo_description) ?? excerpt.slice(0, 160),
    canonical: strOrNull(body.canonical),
    og_title: strOrNull(body.og_title) ?? title,
    og_description: strOrNull(body.og_description) ?? excerpt.slice(0, 200),
    og_image: strOrNull(body.og_image) ?? strOrNull(body.featured_url),
    twitter_card: strOrNull(body.twitter_card) ?? "summary_large_image",
    noindex: Boolean(body.noindex),
    author_id: authorId,
  };
  return { write, cats: toIntArray(body.cats), tags: toIntArray(body.tags) };
}

async function buildPage(body: Record<string, unknown>, id: number | undefined, authorId: string | null): Promise<Pages.PageWrite> {
  const title = String(body.title || "").trim() || "Sem título";
  const safe = cleanHtml(String(body.content_html || ""));
  const { html } = withToc(safe);
  const slug = await uniqueSlug(String(body.slug || title), (s) => Pages.pageSlugExists(s, id));
  const excerpt = String(body.excerpt || "").trim() || excerptFromHtml(html);
  const status = (["draft", "publish", "trash", "archived"].includes(body.status as string) ? body.status : "draft") as Pages.PageStatus;
  return {
    title, slug, excerpt, content_html: html, block_doc: body.block_doc ?? null, status,
    published_at: status === "publish" ? (body.published_at ? String(body.published_at) : new Date().toISOString()) : null,
    seo_title: strOrNull(body.seo_title) ?? title,
    seo_description: strOrNull(body.seo_description) ?? excerpt.slice(0, 160),
    canonical: strOrNull(body.canonical),
    og_title: strOrNull(body.og_title) ?? title,
    og_description: strOrNull(body.og_description) ?? excerpt.slice(0, 200),
    og_image: strOrNull(body.og_image),
    noindex: Boolean(body.noindex),
    author_id: authorId,
  };
}

const strOrNull = (v: unknown): string | null => {
  const s = (v == null ? "" : String(v)).trim(); return s || null;
};
const toIntArray = (v: unknown): number[] =>
  Array.isArray(v) ? v.map((x) => Number(x)).filter((n) => Number.isFinite(n)) : [];
