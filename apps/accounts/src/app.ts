import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { requireAuth, csrfProtection, type Session } from "@artificio/auth";
import type { Kysely } from "kysely";
import { BRAND_DOMAIN, BRAND_ORIGIN } from "@artificio/config";
import { accessCookieName, clearSessionCookies, refreshCookieName, setSessionCookies } from "./cookies.js";
import type { Database } from "./db.js";
import type { AccountsEnv } from "./env.js";
import { createGoogleClient, readGoogleProfile } from "./google.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./tokens.js";
import { destroyAssetResult, isConfigured as isMediaConfigured, uploadBuffer } from "@artificio/media";
import {
  deleteUser,
  findAuthUserById,
  findUserById,
  updateUserAvatar,
  upsertGoogleUser,
} from "./users.js";
import { createAdminSecretsRoutes } from "./adminSecretsRoutes.js";
import { createAdminRoleRoutes } from "./adminRoleRoutes.js";
import { isValidServiceToken } from "./serviceToken.js";

const avatarMaxBytes = 2 * 1024 * 1024;
const avatarDataUrlPattern = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/=]+)$/i;
const avatarUploadTimeoutMs = 15_000;

/**
 * Limite do corpo JSON da rota de avatar. Base64 infla o binário em ~33%, e o
 * `express.json()` global usa o padrão de 100 KB — com ele, toda foto acima de
 * ~75 KB morria com 413 antes de chegar ao validador, apesar dos 2 MB
 * anunciados na tela (achado de review, PR #235). O teto vale só nesta rota:
 * ampliar o parser global aumentaria a superfície de payload grande em todas as
 * outras. A margem cobre o prefixo `data:image/...;base64,` e o padding.
 */
const avatarBodyLimitBytes = Math.ceil(avatarMaxBytes * 4 / 3) + 1024;

/** Identidade do asset no Cloudinary — usada no upload e na exclusão. */
function avatarPublicId(userId: string): string {
  return `avatar-${userId}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    timer.unref?.();
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error: unknown) => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(String(error))); },
    );
  });
}

function readSession(req: express.Request): Session | null {
  return (req as { session?: Session }).session ?? null;
}

/**
 * O `dataUrl` chega do navegador e é hostil até prova em contrário. Não basta
 * conferir o rótulo `image/png` do próprio payload: quem envia escolhe o rótulo.
 * Por isso o tipo declarado é confrontado com os **magic bytes** do conteúdo, e
 * o tamanho é limitado antes de qualquer upload — um `dataUrl` gigante viraria
 * banda e custo no Cloudinary sem nunca ter sido uma imagem.
 */
function decodeAvatarDataUrl(value: unknown): { buffer: Buffer; mime: string } | null {
  if (typeof value !== "string") return null;
  const match = avatarDataUrlPattern.exec(value);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > avatarMaxBytes) return null;

  const isPng = mime === "image/png"
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = mime === "image/jpeg"
    && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = mime === "image/webp"
    && buffer.subarray(0, 4).toString("ascii") === "RIFF"
    && buffer.subarray(8, 12).toString("ascii") === "WEBP";

  return isPng || isJpeg || isWebp ? { buffer, mime } : null;
}

export function isAllowedReturnUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === BRAND_DOMAIN || url.hostname.endsWith(`.${BRAND_DOMAIN}`))
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
  app.disable("x-powered-by");
  const googleClient = createGoogleClient(env);

  app.set("trust proxy", env.TRUSTED_PROXY_CIDR);
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(cookieParser());
  app.use(csrfProtection([
    BRAND_ORIGIN,
    `https://links.${BRAND_DOMAIN}`,
    `https://mesas.${BRAND_DOMAIN}`,
    `https://glossario.${BRAND_DOMAIN}`,
    `https://accounts.${BRAND_DOMAIN}`,
  ]));
  // Parser dedicado ANTES do global: a foto chega como data URL em JSON, e
  // base64 infla ~33%. Com o limite padrão de 100 KB, foto acima de ~75 KB
  // recebia 413 antes de qualquer validação, apesar dos 2 MB oferecidos na
  // tela. Escopo de rota, não global — o teto maior não vale para o resto da
  // API (achado de review, PR #235).
  app.use("/api/account/avatar", express.json({ limit: avatarBodyLimitBytes }));
  app.use(express.json());
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
      const user = await upsertGoogleUser(db, profile, env.ACCOUNTS_BOOTSTRAP_ADMIN_EMAIL);
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

  app.patch("/api/account/avatar", requireAuth, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const decoded = decodeAvatarDataUrl((req.body as { dataUrl?: unknown } | null)?.dataUrl);
      if (!decoded) {
        res.status(400).json({ error: "invalid_avatar" });
        return;
      }

      // Sem credencial de mídia configurada o upload falharia dentro do
      // Cloudinary com erro opaco. 503 diz o que é: indisponibilidade de
      // infraestrutura, não payload inválido do usuário.
      if (!isMediaConfigured()) {
        res.status(503).json({ error: "media_storage_unavailable" });
        return;
      }

      // Falha do provedor (rede, quota, timeout) não pode escapar como 500
      // genérico nem pendurar a requisição: o Cloudinary é dependência externa e
      // o cliente precisa distinguir "sua imagem é inválida" (400) de "o upload
      // não foi" (502). O timeout existe porque `uploadBuffer` não tem um
      // próprio — sem ele, um provedor lento segura a conexão indefinidamente.
      let stored: Awaited<ReturnType<typeof uploadBuffer>>;
      try {
        stored = await withTimeout(
          uploadBuffer(decoded.buffer, {
            folder: "artificio/accounts/avatars",
            publicId: avatarPublicId(session.user.id),
            overwrite: true,
            // Preset é POR APP (o `downloads` usa `downloads-signed`), não
            // compartilhado como as credenciais — daí a variável própria.
            // Opcional: sem ela o upload segue assinado por `api_key`/
            // `api_secret`, que é o contrato de signed upload do Cloudinary; o
            // preset só acrescenta transformação e pasta padrão do lado deles.
            //
            // `.trim()` porque `.env` editado no Windows deixa `\r` grudado no
            // valor — já aconteceu com `CLOUDINARY_API_SECRET` do `links` em
            // produção, achado em 2026-07-31. Mesma defesa do `coverStorage.ts`
            // do downloads.
            uploadPreset: process.env.CLOUDINARY_AVATAR_UPLOAD_PRESET?.trim() || undefined,
          }),
          avatarUploadTimeoutMs,
        );
      } catch (uploadError) {
        console.error("[accounts] falha ao subir avatar", String(uploadError));
        res.status(502).json({ error: "avatar_upload_failed" });
        return;
      }
      const user = await updateUserAvatar(db, session.user.id, stored.url);
      // Cookies reemitidos porque o avatar viaja dentro do token de sessão: sem
      // isto a foto nova só apareceria no próximo login, e o usuário veria a
      // antiga logo após trocá-la.
      setSessionCookies(
        res,
        env,
        signAccessToken(user, env),
        signRefreshToken(user, env),
      );
      res.json({ user });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/account", requireAuth, async (req, res, next) => {
    try {
      const session = readSession(req);
      if (!session) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      // Exclusão é irreversível e encerra o acesso a TODOS os projetos (o
      // `accounts.` é a origem da identidade). Digitar o próprio e-mail é a
      // confirmação deliberada exigida antes de apagar.
      const confirm = (req.body as { confirm?: unknown } | null)?.confirm;
      if (confirm !== session.user.email) {
        res.status(400).json({ error: "confirmation_required" });
        return;
      }

      // Apagar a linha não apaga a imagem: o avatar personalizado fica público
      // no Cloudinary sob `artificio/accounts/avatars/avatar-<id>` mesmo depois
      // de a conta deixar de existir — foto de rosto de quem pediu exclusão
      // seguiria acessível por URL (achado de review, PR #235).
      //
      // Roda ANTES do delete no banco, e a falha não aborta a exclusão: o
      // direito de excluir a conta não pode depender de o Cloudinary responder.
      // O `public_id` fica no log para retry manual, que é o mesmo contrato do
      // REV-019 em `destroyAssetResult`.
      const publicId = avatarPublicId(session.user.id);
      if (isMediaConfigured() && !(await destroyAssetResult(publicId))) {
        console.error("[accounts] avatar orfao no Cloudinary apos exclusao de conta", publicId);
      }

      await deleteUser(db, session.user.id);
      clearSessionCookies(res, env);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSessionCookies(res, env);
    res.status(204).send();
  });

  app.get("/api/auth/refresh", async (req, res, next) => {
    const token =
      typeof req.cookies?.[refreshCookieName] === "string"
        ? req.cookies[refreshCookieName]
        : null;
    const tokenUser = token ? verifyRefreshToken(token, env) : null;

    if (!tokenUser) {
      clearSessionCookies(res, env);
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    try {
      // Spec 090 T1.2: o refresh é a fronteira de reidratação. Papel, perfil e
      // roleVersion vêm do banco; claim antiga só autentica o ID da sessão.
      const user = await findAuthUserById(db, tokenUser.id);
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
    } catch (error) {
      next(error);
    }
  });

  // WS3: admin secrets (DeepSeek key, etc.) — admin-gated + X-Service-Token
  app.use(createAdminSecretsRoutes(db, env as unknown as Record<string, string | undefined>));
  app.use(createAdminRoleRoutes(db));

  // Spec 083 (downloads: rejeicao com e-mail) — rota interna server-to-server,
  // resolve email/nome do autor por user_id. So X-Service-Token, sem fallback
  // de sessao admin (nunca chamada por humano, so por outro backend).
  app.get("/internal/users/:id", (req, res, next) => {
    if (!isValidServiceToken(env.SERVICE_SECRET, req.headers["x-service-token"])) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    findUserById(db, req.params.id)
      .then((user) => {
        if (!user) {
          res.status(404).json({ error: "user_not_found" });
          return;
        }
        res.json({ id: user.id, email: user.email, display_name: user.name });
      })
      .catch(next);
  });

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const clientDir = join(currentDir, "client");
  if (existsSync(clientDir)) {
    app.use(express.static(clientDir));
    app.get(["/", "/login", "/conta", "/admin/papeis"], (_req, res) => {
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
