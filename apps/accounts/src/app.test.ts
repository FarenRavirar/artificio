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
});

describe("/api/account/avatar", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("rejects invalid avatar payload", async () => {
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

    await request(app)
      .patch("/api/account/avatar")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ dataUrl: "data:text/plain;base64,Zm9v" })
      .expect(400);
  });
});

describe("DELETE /api/account", () => {
  beforeEach(() => {
    process.env.JWT_SECRET = env.JWT_SECRET;
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it("requires email confirmation", async () => {
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

    await request(app)
      .delete("/api/account")
      .set("Origin", "https://accounts.artificiorpg.com")
      .set("Cookie", [`artificio_session=${token}`])
      .send({ confirm: "errado@example.com" })
      .expect(400);
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
