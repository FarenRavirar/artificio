// Backend HTTP do site: health + admin (SSO role=admin) p/ disparar rebuild SSG (D006) e re-import WP.
// Canon: Express + @artificio/auth (cookie artificio_session). Estático servido à parte (Astro dist).
import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type RequestHandler } from "express";
import cookieParser from "cookie-parser";
import { requireAuth, type AuthenticatedRequest } from "@artificio/auth";
import { getDb } from "../db/connection.js";
import { runJob, jobState } from "./jobs.js";

const DIST = process.env.SITE_DIST || resolve(dirname(fileURLToPath(import.meta.url)), "../dist");

const app = express();
app.use(cookieParser());
app.use(express.json());

const requireAdmin: RequestHandler = (req, res, next) => {
  const session = (req as AuthenticatedRequest).session;
  if (session?.user.role !== "admin") {
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
