import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp, sanitizeReturnUrl } from "./app.js";
import type { AccountsEnv } from "./env.js";

const originalSecret = process.env.JWT_SECRET;

const env: AccountsEnv = {
  COOKIE_DOMAIN: ".artificiorpg.com",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/artificio_auth",
  GOOGLE_CALLBACK_URL: "https://accounts.artificiorpg.com/api/auth/google/callback",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  JWT_REFRESH_SECRET: "refresh-secret-refresh-secret-refresh",
  JWT_SECRET: "access-secret-access-secret-access",
  PORT: 3000,
  PUBLIC_URL: "https://accounts.artificiorpg.com",
  TRUSTED_PROXY_CIDR: "172.18.0.0/16",
};

describe("/api/auth/me", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("returns 401 without cookie", async () => {
    const app = createApp(env, null as never);

    await request(app).get("/api/auth/me").expect(401);
  });

  it("returns user with valid JWT cookie", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      {
        sub: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`artificio_session=${token}`])
      .expect(200);

    expect(response.body).toMatchObject({
      user: {
        id: "user-1",
        email: "ana@example.com",
        name: "Ana",
        role: "user",
      },
    });
  });

  it("returns moderator with valid JWT cookie", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      {
        sub: "moderator-1",
        email: "moderator@example.com",
        name: "Moderação",
        role: "moderator",
      },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    const response = await request(app)
      .get("/api/auth/me")
      .set("Cookie", [`artificio_session=${token}`])
      .expect(200);

    expect(response.body.user.role).toBe("moderator");
  });
});

function fakeAuthDb(row: {
  avatar: string | null;
  email: string;
  id: string;
  name: string;
  role: "user" | "moderator" | "admin";
  role_version: number;
} | undefined) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: async () => row,
        }),
      }),
    }),
  } as never;
}

function refreshToken(role: "user" | "moderator" | "admin") {
  return jwt.sign(
    {
      sub: "user-1",
      email: "old@example.com",
      name: "Nome antigo",
      role,
      typ: "refresh",
    },
    env.JWT_REFRESH_SECRET,
    { algorithm: "HS256", expiresIn: "7d" },
  );
}

/**
 * Rotas de conta restauradas em 2026-07-31: existiam até `a7d9d20`
 * (2026-06-29), que reverteu `app.ts` a um ponto anterior e as levou junto,
 * deixando `users.avatar_source` órfã em produção.
 */
describe("/api/account/avatar", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // O `dataUrl` é recusado pelo CONTEÚDO, não pelo rótulo declarado: quem envia
  // escolhe o `Content-Type`. Aqui o rótulo nem é de imagem, e o corpo tampouco.
  it("recusa payload que não é imagem", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", roleVersion: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ dataUrl: "data:text/plain;base64,Zm9v" })
      .expect(400);
  });

  // Rótulo de imagem legítimo com corpo que não é PNG: sem a checagem de magic
  // bytes isto passaria e o Cloudinary receberia lixo com nome de imagem.
  it("recusa mime de imagem com conteúdo que não bate com os magic bytes", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", roleVersion: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ dataUrl: `data:image/png;base64,${Buffer.from("nao sou png").toString("base64")}` })
      .expect(400);
  });

  it("exige sessão", async () => {
    const app = createApp(env, null as never);

    await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .send({ dataUrl: "data:text/plain;base64,Zm9v" })
      .expect(401);
  });
});

describe("DELETE /api/account", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  // Exclusão encerra o acesso a TODOS os projetos. O e-mail digitado tem de
  // bater com o da sessão — não basta estar autenticado.
  it("recusa exclusão quando o e-mail de confirmação não bate", async () => {
    const app = createApp(env, null as never);
    const token = jwt.sign(
      { sub: "user-1", email: "ana@example.com", name: "Ana", role: "user", roleVersion: 1 },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: "15m" },
    );

    await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ confirm: "errado@example.com" })
      .expect(400);
  });

  it("exige sessão", async () => {
    const app = createApp(env, null as never);

    await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .send({ confirm: "ana@example.com" })
      .expect(401);
  });
});

describe("/api/auth/refresh", () => {
  it("promotes an active session from the database", async () => {
    const app = createApp(env, fakeAuthDb({
      id: "user-1",
      email: "user@example.com",
      name: "Pessoa",
      avatar: null,
      role: "moderator",
      role_version: 2,
    }));

    const response = await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("user")}`])
      .expect(200);

    expect(response.body.user).toMatchObject({ role: "moderator", roleVersion: 2 });
  });

  it("revokes an active moderator session from the database", async () => {
    const app = createApp(env, fakeAuthDb({
      id: "user-1",
      email: "user@example.com",
      name: "Pessoa",
      avatar: null,
      role: "user",
      role_version: 3,
    }));

    const response = await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("moderator")}`])
      .expect(200);

    expect(response.body.user).toMatchObject({ role: "user", roleVersion: 3 });
  });

  it("invalidates a session whose account no longer exists", async () => {
    const app = createApp(env, fakeAuthDb(undefined));

    await request(app)
      .get("/api/auth/refresh")
      .set("Cookie", [`artificio_refresh=${refreshToken("user")}`])
      .expect(401);
  });
});

describe("return URL allowlist", () => {
  it("allows HTTPS subdomains under artificiorpg.com", () => {
    expect(
      sanitizeReturnUrl("https://mesas.artificiorpg.com/campanhas", env),
    ).toBe("https://mesas.artificiorpg.com/campanhas");
  });

  it("allows HTTPS apex domain for the future portal", () => {
    expect(sanitizeReturnUrl("https://artificiorpg.com/blog/", env)).toBe(
      "https://artificiorpg.com/blog/",
    );
  });

  it("blocks external hosts", () => {
    expect(sanitizeReturnUrl("https://evil.com", env)).toBe(env.PUBLIC_URL);
  });

  it("blocks lookalike domains", () => {
    expect(sanitizeReturnUrl("https://evilartificiorpg.com", env)).toBe(
      env.PUBLIC_URL,
    );
  });

  it("stores only sanitized return URL in Google state", async () => {
    const app = createApp(env, null as never);

    const response = await request(app)
      .get("/api/auth/google")
      .query({ return: "https://evil.com" })
      .expect(302);
    const location = response.headers.location as string;
    const state = new URL(location).searchParams.get("state");

    expect(state).not.toBeNull();
    const body = JSON.parse(
      Buffer.from(state ?? "", "base64url").toString("utf8"),
    ) as { returnUrl: string };
    expect(body.returnUrl).toBe(env.PUBLIC_URL);
  });

  it("preserves beta origin return URL in Google state", async () => {
    const app = createApp(env, null as never);
    const betaReturn = "https://beta.artificiorpg.com/admin/";

    const response = await request(app)
      .get("/api/auth/google")
      .query({ return: betaReturn })
      .expect(302);
    const location = response.headers.location as string;
    const state = new URL(location).searchParams.get("state");

    expect(state).not.toBeNull();
    const body = JSON.parse(
      Buffer.from(state ?? "", "base64url").toString("utf8"),
    ) as { returnUrl: string };
    expect(body.returnUrl).toBe(betaReturn);
  });
});
