// Backend HTTP do site: health + admin (SSO role=admin) p/ disparar rebuild SSG (D006) e re-import WP.
// Canon: Express + @artificio/auth (cookie artificio_session). Estático servido à parte (Astro dist).
import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { requireAuth, verifyToken, csrfProtection, type AuthenticatedRequest } from "@artificio/auth";
import { BRAND_ORIGIN } from "@artificio/config";
import { getDb } from "../db/connection.js";
import { runJob, jobState } from "./jobs.js";
import { adminApi } from "./admin-api.js";
import { renderPreview } from "./preview.js";
import { reloadRedirects, lookupRedirect } from "./redirect-cache.js";
import { UPLOADS_DIR, storeUpload } from "./lib/media-store.js";
import { parseFeedbackInput, decodeScreenshotDataUri } from "./lib/feedback-validator.js";
import * as Feedback from "../db/repo/feedback.js";

const DIST = process.env.SITE_DIST || resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

const app = express();
app.disable("x-powered-by");
// CF Tunnel -> site-beta-app: confia somente no proxy interno da artificio_net.
// Assim req.ip usa X-Forwarded-For apenas quando o hop anterior e confiavel.
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
  new URL(process.env.PUBLIC_SITE_URL || BRAND_ORIGIN).origin,
  "https://www.artificiorpg.com",
]));
app.use(express.json({ limit: "10mb" }));

// noindex no beta (R8, spec 030): X-Robots-Tag quando SITE_NOINDEX=true.
// Prod nao define a var → header ausente → index normal.
if (process.env.SITE_NOINDEX === "true") {
  app.use((_req, res, next) => {
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    next();
  });
}

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
    const db = await getDb();
    const r = await db.query<{ n: number }>("SELECT count(*)::int AS n FROM posts");
    res.json({ ok: true, posts: r.rows[0]?.n ?? 0 });
  } catch {
    res.status(500).json({ ok: false });
  }
});

// Stats + último job. Admin.
app.get("/admin/status", requireAuth, requireAdmin, async (_req, res) => {
  const db = await getDb();
  const one = async (sql: string) => (await db.query<{ n: number }>(sql)).rows[0]?.n ?? 0;
  res.json({
    stats: {
      posts: await one("SELECT count(*)::int AS n FROM posts"),
      taxonomies: await one("SELECT count(*)::int AS n FROM taxonomies"),
      comments: await one("SELECT count(*)::int AS n FROM comments"),
      mediaMapped: await one("SELECT count(*)::int AS n FROM media_map"),
    },
    job: jobState(),
  });
});

// Rebuild SSG (export + astro build + pagefind). Gatilho de publicação (D006). Admin.
app.post("/admin/rebuild", requireAuth, requireAdmin, (_req, res) => {
  const r = runJob("rebuild", "rebuild");
  res.status(r.started ? 202 : 409).json(r);
});

// Re-import do WP -> store (one-shot). Admin.
app.post("/admin/import", requireAuth, requireAdmin, (_req, res) => {
  const r = runJob("import", "import");
  res.status(r.started ? 202 : 409).json(r);
});

// ===== Feedback público (Spec 021) — anônimo permitido, SEM auth =====
// Rate-limit simples em memória por IP (sem nova dependência): janela de 15min, 20 envios.
const FEEDBACK_WINDOW_MS = 15 * 60 * 1000;
const FEEDBACK_MAX = 20;
const feedbackHits = new Map<string, { count: number; reset: number }>();
const feedbackLimiter: RequestHandler = (req, res, next) => {
  const ip = req.ip || "unknown";
  const now = Date.now();
  const hit = feedbackHits.get(ip);
  if (!hit || now > hit.reset) {
    feedbackHits.set(ip, { count: 1, reset: now + FEEDBACK_WINDOW_MS });
    next();
    return;
  }
  if (hit.count >= FEEDBACK_MAX) {
    res.status(429).json({ error: "Muitos envios. Tente novamente mais tarde." });
    return;
  }
  hit.count += 1;
  next();
};

app.post("/api/feedback", feedbackLimiter, async (req, res) => {
  try {
    const parsed = parseFeedbackInput(req.body);
    if (!parsed.ok) { res.status(400).json({ error: parsed.error }); return; }
    const input = parsed.value;

    // Sessão OPCIONAL: enriquece o registro se houver cookie SSO válido (não bloqueia anônimo).
    let reporterId: string | null = null;
    let reporterRole = "visitor";
    const cookie = (req as { cookies?: Record<string, string> }).cookies?.artificio_session;
    if (typeof cookie === "string" && cookie) {
      const session = verifyToken(cookie);
      if (session) { reporterId = session.user.id; reporterRole = session.user.role ?? "visitor"; }
    }

    // Screenshot é não-fatal (FR-006): reusa storeUpload (Cloudinary ou disco local).
    let screenshotUrl: string | null = null;
    let screenshotPublicId: string | null = null;
    if (input.screenshot) {
      const decoded = decodeScreenshotDataUri(input.screenshot);
      if (decoded) {
        try {
          const stored = await storeUpload(decoded.buffer, decoded.ext);
          screenshotUrl = stored.url;
          screenshotPublicId = stored.public_id;
        } catch (e) {
          console.warn("[feedback] upload de captura falhou; gravando sem imagem.", String(e));
        }
      }
    }

    const { id } = await Feedback.createFeedback({
      ...input,
      reporter_id: reporterId,
      reporter_role: reporterRole,
      screenshot_url: screenshotUrl,
      screenshot_public_id: screenshotPublicId,
    });
    res.status(201).json({ data: { id } });
  } catch (e) {
    console.error("[POST /api/feedback]", e);
    res.status(500).json({ error: "Erro ao registrar feedback." });
  }
});

// API de autoria (CRUD posts/pages/taxonomias/redirects/mídia). Gated requireAuth+requireAdmin.
app.use("/api/admin/v1", adminApi(requireAuth, requireAdmin));

// Mídia em modo local/dev (sem Cloudinary): serve apps/site/uploads em /uploads (público, só leitura).
// Montado sempre (dir pode não existir ainda no boot; static cai p/ 404 até o 1º upload criá-lo).
app.use("/uploads", express.static(UPLOADS_DIR));

// Preview de rascunho (D053): renderiza post/page do store no shell do artigo, SEM publicar. Admin.
app.get("/admin/preview/:type/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const type = req.params.type === "page" ? "page" : "post";
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) { res.status(400).send("id inválido"); return; }
    const html = await renderPreview(type, id);
    if (!html) { res.status(404).send("não encontrado"); return; }
    res.type("html").send(html);
  } catch (e) {
    res.status(500).send("erro no preview: " + String(e));
  }
});

// Redirects 301 (spec 011): aplica a tabela `redirects` ANTES do estático (slug antigo -> novo).
// Cache compartilhado (redirect-cache.ts): recarregado no boot, por intervalo, e na hora após gravar.
void reloadRedirects();
setInterval(() => void reloadRedirects(), 30_000).unref?.();
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const hit = lookupRedirect(req.path);
  if (hit && hit.to !== req.path) { res.redirect(hit.code, hit.to); return; }
  next();
});

// SPA admin (spec 011): build do @artificio/site-admin (vite) servido em /admin.
// As rotas /admin/status|rebuild|import|preview acima têm precedência (registradas antes).
const ADMIN_DIST = process.env.SITE_ADMIN_DIST || resolve(dirname(fileURLToPath(import.meta.url)), "../../site-admin/dist");
if (existsSync(ADMIN_DIST)) {
  app.use("/admin", express.static(ADMIN_DIST));
  // fallback SPA: rotas client-side (/admin/posts/123 etc) → index.html
  app.use("/admin", (_req, res) => res.sendFile(resolve(ADMIN_DIST, "index.html")));
}

// Estático: serve o Astro dist/ (depois das rotas /healthz e /admin). Em deploy = 1 container.
if (existsSync(DIST)) {
  app.use(express.static(DIST, { extensions: ["html"] }));
  app.use((_req, res) => {
    const notFound = resolve(DIST, "404.html");
    if (existsSync(notFound)) res.status(404).sendFile(notFound);
    else res.status(404).send("404");
  });
}

const PORT = Number(process.env.PORT || 4322);
app.listen(PORT, () => console.log(`[site-api] on :${PORT} (static=${existsSync(DIST) ? DIST : "off"})`));
