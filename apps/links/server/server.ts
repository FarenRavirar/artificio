// Backend HTTP do módulo links. Express 5 + @artificio/auth (cookie artificio_session) + Kysely/pg.
// Público: GET /api/groups. Comunidade (auth): POST /api/groups/suggest. Admin: /api/admin/v1/groups/*.
// Serve o Astro dist/ no final (1 container em deploy). Espelha apps/mesas + apps/site.
import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { requireAuth, csrfProtection, type AuthenticatedRequest } from "@artificio/auth";
import sanitizeHtml from "sanitize-html";
import * as Groups from "./repo/groups.js";
import { parseSuggestion, cleanText } from "./lib/validate.js";
import { parseInviteUrl } from "./lib/og.js";
import { resolveLogo, deleteLogo } from "./lib/cloudinary.js";
import { slugify } from "./lib/slug.js";
import { renderGroupPage } from "./lib/render.js";
import { runJob, jobState, jobBusy } from "./jobs.js";
import type { GroupCategory, GroupSource, GroupStatus } from "../db/types.js";

const DIST = process.env.LINKS_DIST || resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const GRUPO_DIR = resolve(DIST, "grupo") + sep;
const VALID_CATEGORIES = ["artificio", "tematicos", "parceiros", "comunidade"] as const;

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUSTED_PROXY_CIDR || "172.18.0.0/16");
app.use(cookieParser());

// Rate-limit global (leve): conta TODAS as requests antes do CSRF, inclusive as rejeitadas.
// Sem isso, CSRF-rejeitadas (403) nunca batem nos limiters por-rota → DoS ilimitado.
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde." },
});
app.use(globalLimiter);

app.use(csrfProtection([
  new URL(process.env.PUBLIC_LINKS_URL || "https://links.artificiorpg.com").origin,
]));
app.use(express.json({ limit: "256kb" }));

const requireAdmin: RequestHandler = (req, res, next) => {
  const session = (req as AuthenticatedRequest).session;
  if (!session || session.user.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
};

// Health (deploy/smoke). Sem auth.
app.get("/healthz", async (_req, res) => {
  try {
    const rows = await Groups.listGroups({ status: "active" });
    res.json({ ok: true, groups: rows.length });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// ===== Público: lista de grupos =====
// Default = ativos. ?source=community&status=active p/ a seção comunitária; ?category= filtra.
app.get("/api/groups", async (req, res) => {
  try {
    const status = (req.query.status as GroupStatus) || "active";
    const source = req.query.source as GroupSource | undefined;
    const category = req.query.category as GroupCategory | undefined;
    // Pendentes/rejeitados nunca pelo endpoint público.
    if (status !== "active" && status !== "archived") {
      res.status(400).json({ error: "status inválido" });
      return;
    }
    const rows = await Groups.listGroups({ status, source, category });
    res.json({ data: rows });
  } catch (e) {
    console.error("[GET /api/groups]", e);
    res.status(500).json({ error: "erro ao listar" });
  }
});

// Card publicado por slug (SEO; alimenta a página /grupo/<slug>). Só ativos.
app.get("/api/groups/:slug", async (req, res) => {
  try {
    const g = await Groups.findBySlug(req.params.slug);
    if (!g || g.status !== "active") {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    res.json({ data: g });
  } catch (e) {
    console.error("[GET /api/groups/:slug]", e);
    res.status(500).json({ error: "erro" });
  }
});

// Vocabulário de tags (público). Ilha comunitária usa p/ resolver slug→label nos chips.
app.get("/api/tags", async (_req, res) => {
  try {
    const rows = await Groups.listTags();
    res.json({ data: rows.map((t) => ({ slug: t.slug, label: t.label })) });
  } catch (e) {
    console.error("[GET /api/tags]", e);
    res.status(500).json({ error: "erro" });
  }
});

// ===== Comunidade: sugerir grupo (auth + rate-limit) =====
const suggestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos envios. Tente novamente mais tarde." },
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde." },
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas requisições. Aguarde." },
});

const reportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitos envios. Tente novamente mais tarde." },
});

app.post("/api/groups/suggest", suggestLimiter, requireAuth, async (req, res) => {
  try {
    const parsed = parseSuggestion(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const session = (req as AuthenticatedRequest).session!;
    const { id, created } = await Groups.insertSuggestion({
      ...parsed.value,
      submitted_by: session.user.id,
      submitted_email: session.user.email ?? null,
      submitted_name: session.user.name ?? null,
    });
    // Sugestão entra como pending; logo (og→Cloudinary) é resolvida na aceitação pelo admin.
    res.status(created ? 201 : 200).json({ data: { id, created } });
  } catch (e) {
    console.error("[POST /api/groups/suggest]", e);
    res.status(500).json({ error: "erro ao registrar sugestão" });
  }
});

const VALID_REPORT_REASONS = ["convite_quebrado", "conteudo_improprio", "grupo_inativo", "outro"] as const;

// ===== Comunidade: reportar grupo (público, sem login obrigatório) =====
app.post("/api/groups/:slug/report", reportLimiter, async (req, res) => {
  try {
    const slug = req.params.slug;
    if (slug !== slugify(slug)) {
      res.status(400).json({ error: "slug inválido" });
      return;
    }
    const g = await Groups.findBySlug(slug);
    if (!g || g.status !== "active") {
      res.status(404).json({ error: "grupo não encontrado" });
      return;
    }
    const body = req.body as Record<string, unknown> | undefined;
    const reason = typeof body?.reason === "string" ? body.reason : "";
    if (!(VALID_REPORT_REASONS as readonly string[]).includes(reason)) {
      res.status(400).json({ error: "motivo inválido" });
      return;
    }
    const rawNote = typeof body?.note === "string" ? body.note : "";
    const note = sanitizeHtml(rawNote, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim().slice(0, 1000) || null;
    const session = (req as AuthenticatedRequest).session;
    const reporterEmail = session?.user?.email ?? null;
    const report = await Groups.insertReport({
      group_id: g.id,
      reason: reason as Groups.InsertReportInput["reason"],
      note,
      reporter_email: reporterEmail,
    });
    res.status(201).json({ data: { id: report.id } });
  } catch (e) {
    console.error("[POST /api/groups/:slug/report]", e);
    res.status(500).json({ error: "erro ao registrar denúncia" });
  }
});

// ===== Admin: moderação =====
const admin = express.Router();
admin.use(adminLimiter);
admin.use(requireAuth, requireAdmin);

// Lista p/ moderação (qualquer status). ?status=pending p/ a fila.
admin.get("/groups", async (req, res) => {
  try {
    const status = req.query.status as GroupStatus | undefined;
    const rows = await Groups.listGroups(status ? { status } : {});
    res.json({ data: rows });
  } catch (e) {
    console.error("[GET /admin/groups]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

// Aceitar sugestão → active + resolve logo.
admin.post("/groups/:id/accept", async (req, res) => {
  try {
    const g = await Groups.findById(req.params.id);
    if (!g) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    const logo = g.logo_url ? null : await resolveLogo(g.invite_url, "admin");
    const slug = g.slug ?? (await Groups.ensureUniqueSlug(slugify(g.name), g.id));
    const approved_at = g.approved_at ? undefined : new Date().toISOString();
    const updated = await Groups.updateGroup(g.id, { status: "active", slug, approved_at, ...(logo ?? {}) });
    res.json({ data: updated });
    runJob("rebuild", "rebuild");
  } catch (e) {
    console.error("[POST /admin/groups/:id/accept]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

// Editar campos. Trocar invite_url re-busca a logo.
admin.patch("/groups/:id", async (req, res) => {
  try {
    const g = await Groups.findById(req.params.id);
    if (!g) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    const b = req.body as Record<string, unknown>;
    const patch: Groups.AdminPatch = {};
    if (typeof b.name === "string") patch.name = cleanText(b.name, 80);
    if (typeof b.slug === "string" && b.slug.trim()) {
      patch.slug = await Groups.ensureUniqueSlug(slugify(b.slug), g.id);
    }
    if (Array.isArray(b.tags)) {
      const slugs = b.tags.filter((t): t is string => typeof t === "string");
      patch.tags = await Groups.sanitizeTagSlugs(slugs);
    }
    if (typeof b.description === "string") patch.description = cleanText(b.description, 500) || null;
    if (typeof b.rules === "string") patch.rules = cleanText(b.rules, 4000) || null;
    if (typeof b.is_adult === "boolean") patch.is_adult = b.is_adult;
    if (typeof b.category === "string") {
      if (!(VALID_CATEGORIES as readonly string[]).includes(b.category)) {
        res.status(400).json({ error: "categoria inválida" });
        return;
      }
      patch.category = b.category as GroupCategory;
    }
    if (typeof b.sort_order === "number") patch.sort_order = b.sort_order;
    if (typeof b.invite_url === "string") {
      const invite = parseInviteUrl(b.invite_url);
      if (!invite) {
        res.status(400).json({ error: "link inválido" });
        return;
      }
      patch.invite_url = invite.url;
      patch.kind = invite.kind;
      const logo = await resolveLogo(invite.url, "admin");
      if (logo) Object.assign(patch, logo);
    }
    const updated = await Groups.updateGroup(g.id, patch);
    res.json({ data: updated });
  } catch (e) {
    console.error("[PATCH /admin/groups/:id]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.post("/groups/:id/archive", async (req, res) => {
  try {
    const updated = await Groups.updateGroup(req.params.id, { status: "archived" });
    if (!updated) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    res.json({ data: updated });
  } catch (e) {
    console.error("[POST /admin/groups/:id/archive]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.delete("/groups/:id", async (req, res) => {
  try {
    const removed = await Groups.deleteGroup(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    await deleteLogo(removed.logo_public_id);
    res.json({ data: { id: removed.id } });
  } catch (e) {
    console.error("[DELETE /admin/groups/:id]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

// ----- Vocabulário de tags (admin: criar/editar/remover) -----
admin.get("/tags", async (_req, res) => {
  try {
    res.json({ data: await Groups.listTags() });
  } catch (e) {
    console.error("[GET /admin/tags]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.post("/tags", async (req, res) => {
  try {
    const label = cleanText(String((req.body as { label?: unknown }).label ?? ""), 60);
    if (label.length < 2) {
      res.status(400).json({ error: "label inválido (mín. 2)" });
      return;
    }
    const slug = slugify(label);
    if (!slug) {
      res.status(400).json({ error: "label não gera slug válido" });
      return;
    }
    const sortOrder = Number((req.body as { sort_order?: unknown }).sort_order) || 0;
    res.status(201).json({ data: await Groups.createTag(label, slug, sortOrder) });
  } catch (e) {
    console.error("[POST /admin/tags]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.patch("/tags/:id", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const patch: { label?: string; sort_order?: number } = {};
    if (typeof b.label === "string") patch.label = cleanText(b.label, 60);
    if (typeof b.sort_order === "number") patch.sort_order = b.sort_order;
    const updated = await Groups.updateTag(req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    res.json({ data: updated });
  } catch (e) {
    console.error("[PATCH /admin/tags/:id]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.delete("/tags/:id", async (req, res) => {
  try {
    const removed = await Groups.deleteTag(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    res.json({ data: { id: removed.id, slug: removed.slug } });
  } catch (e) {
    console.error("[DELETE /admin/tags/:id]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

// ----- Reports: fila de denúncias (admin, spec 038 R6) -----
admin.get("/reports", async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    if (status && !["open", "resolved", "dismissed"].includes(status)) {
      res.status(400).json({ error: "status inválido" });
      return;
    }
    const rows = await Groups.listReports(status ? { status: status as "open" | "resolved" | "dismissed" } : {});
    res.json({ data: rows });
  } catch (e) {
    console.error("[GET /admin/reports]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

admin.patch("/reports/:id", async (req, res) => {
  try {
    const b = req.body as Record<string, unknown>;
    const status = typeof b.status === "string" ? b.status : "";
    if (!["resolved", "dismissed"].includes(status)) {
      res.status(400).json({ error: "status inválido (resolved ou dismissed)" });
      return;
    }
    const updated = await Groups.updateReport(req.params.id, { status: status as "resolved" | "dismissed" });
    if (!updated) {
      res.status(404).json({ error: "não encontrado" });
      return;
    }
    res.json({ data: updated });
  } catch (e) {
    console.error("[PATCH /admin/reports/:id]", e);
    res.status(500).json({ error: "erro interno" });
  }
});

// ----- Rebuild SSG (admin, pós-moderação) -----
admin.post("/rebuild", (_req, res) => {
  const out = runJob("rebuild", "rebuild");
  res.json(out);
});

// Status do job em curso (p/ o painel exibir progresso).
admin.get("/rebuild/status", (_req, res) => {
  res.json({ busy: jobBusy(), job: jobState() });
});

// ----- Reidratação de logos (admin, spec 038 R4) -----
// Dispara reidratação em lote das logos dos grupos ativos (single-flight). Espelha o padrão rebuild.
admin.post("/groups/rehydrate-logos", (_req, res) => {
  const out = runJob("rehydrate", "rehydrate-logos");
  res.json(out);
});

admin.get("/groups/rehydrate-logos/status", (_req, res) => {
  res.json({ busy: jobBusy(), job: jobState() });
});

app.use("/api/admin/v1", admin);

// Estático: Astro dist/ (depois das rotas /api). Em deploy = 1 container.
if (existsSync(DIST)) {
  // SSR fallback (ANTES do static): slug aprovado que ainda não existe no dist (pré-rebuild).
  // Verifica se o arquivo estático existe; se sim, deixa o express.static servir.
  app.get("/grupo/:slug", publicLimiter, async (req, res, next) => {
    const raw = req.params.slug;
    // Path-validation: só slug canônico (alfanumérico, sem traversal); containment check.
    if (raw !== slugify(raw)) return next();
    const filePath = resolve(DIST, "grupo", raw, "index.html");
    if (!filePath.startsWith(GRUPO_DIR)) return next();
    if (existsSync(filePath)) return next(); // static serve
    try {
      const g = await Groups.findBySlug(raw);
      if (!g || g.status !== "active") return next(); // 404 normal
      res.send(renderGroupPage(g));
    } catch (e) {
      console.error("[SSR /grupo/:slug]", e);
      res.status(500).send("Erro interno");
    }
  });

  app.use(publicLimiter, express.static(DIST, { extensions: ["html"] }));

  app.use(publicLimiter, (_req, res) => {
    const notFound = resolve(DIST, "404.html");
    if (existsSync(notFound)) res.status(404).sendFile(notFound);
    else res.status(404).send("404");
  });
}

const PORT = Number(process.env.PORT || 4324);
app.listen(PORT, () => console.log(`[links-api] on :${PORT} (static=${existsSync(DIST) ? DIST : "off"})`));
