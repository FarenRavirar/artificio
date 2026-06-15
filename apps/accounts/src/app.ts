import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth, type Session } from "@artificio/auth";
import type { Kysely } from "kysely";
import { accessCookieName, clearSessionCookies, refreshCookieName, setSessionCookies } from "./cookies.js";
import type { Database } from "./db.js";
import type { AccountsEnv } from "./env.js";
import { createGoogleClient, readGoogleProfile } from "./google.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokens.js";
import { upsertGoogleUser } from "./users.js";

export function isAllowedReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "artificiorpg.com" || url.hostname.endsWith(".artificiorpg.com"))
    );
  } catch {
    return false;
  }
}

export function sanitizeReturnUrl(value: unknown, env: AccountsEnv): string {
  if (typeof value !== "string" || !isAllowedReturnUrl(value)) {
    return env.PUBLIC_URL;
  }

  return value;
}

function readStateReturnUrl(value: unknown, env: AccountsEnv): string {
  if (typeof value !== "string") {
    return env.PUBLIC_URL;
  }

  try {
    const state: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    const returnUrl =
      state && typeof state === "object" && "returnUrl" in state
        ? (state as { returnUrl: unknown }).returnUrl
        : null;

    return sanitizeReturnUrl(returnUrl, env);
  } catch {
    return env.PUBLIC_URL;
  }
}

export function createApp(env: AccountsEnv, db: Kysely<Database>): express.Express {
  const app = express();
  const googleClient = createGoogleClient(env);

  app.set("trust proxy", env.TRUSTED_PROXY_CIDR);
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    cors({
      credentials: true,
      origin: /^https:\/\/(?:[^.]+\.)?artificiorpg\.com$/,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/api/auth/google", (req, res) => {
    const returnUrl = sanitizeReturnUrl(req.query.return, env);
    const state = Buffer.from(JSON.stringify({ returnUrl })).toString("base64url");
    const url = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      state,
    });

    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req, res, next) => {
    try {
      if (typeof req.query.code !== "string") {
        res.status(400).json({ error: "missing_code" });
        return;
      }

      const { tokens } = await googleClient.getToken(req.query.code);
      if (!tokens.id_token) {
        res.status(401).json({ error: "missing_id_token" });
        return;
      }

      const profile = await readGoogleProfile(
        googleClient,
        tokens.id_token,
        env.GOOGLE_CLIENT_ID,
      );
      const user = await upsertGoogleUser(db, profile);
      setSessionCookies(
        res,
        env,
        signAccessToken(user, env),
        signRefreshToken(user, env),
      );

      const returnUrl = readStateReturnUrl(req.query.state, env);

      res.redirect(returnUrl);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: (req as { session?: Session }).session?.user });
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookies(res, env);
    res.status(204).send();
  });

  app.get("/api/auth/refresh", (req, res) => {
    const token =
      typeof req.cookies?.[refreshCookieName] === "string"
        ? req.cookies[refreshCookieName]
        : null;
    const user = token ? verifyRefreshToken(token, env) : null;

    if (!user) {
      clearSessionCookies(res, env);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    setSessionCookies(
      res,
      env,
      signAccessToken(user, env),
      signRefreshToken(user, env),
    );
    res.json({ user });
  });

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const clientDir = join(currentDir, "client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(["/", "/login"], (_req, res) => {
      res.sendFile(join(clientDir, "index.html"));
    });
  }

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "internal_error";
    res.status(500).json({ error: message });
  });

  return app;
}

export { accessCookieName };
