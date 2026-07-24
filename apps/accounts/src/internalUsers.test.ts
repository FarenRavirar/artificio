import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { AccountsEnv } from "./env.js";

// T7.2 (spec 083) — rota interna server-to-server GET /internal/users/:id:
// sem secret (401), secret errado (401), secret certo (200 + shape).

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
  SERVICE_SECRET: "service-secret-at-least-16-chars",
};

function fakeDb(row: { id: string; email: string; name: string } | undefined) {
  return {
    selectFrom: () => ({
      select: () => ({
        where: () => ({
          executeTakeFirst: vi.fn().mockResolvedValue(row),
        }),
      }),
    }),
  } as never;
}

describe("GET /internal/users/:id", () => {
  it("401 sem X-Service-Token", async () => {
    const app = createApp(env, fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }));

    await request(app).get("/internal/users/user-1").expect(401);
  });

  it("401 com X-Service-Token errado", async () => {
    const app = createApp(env, fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }));

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", "token-errado")
      .expect(401);

    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("200 com secret correto e usuario existente", async () => {
    const app = createApp(env, fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }));

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", env.SERVICE_SECRET as string)
      .expect(200);

    expect(response.body).toEqual({ id: "user-1", email: "a@example.com", display_name: "Ana" });
  });

  it("404 quando usuario nao existe", async () => {
    const app = createApp(env, fakeDb(undefined));

    const response = await request(app)
      .get("/internal/users/does-not-exist")
      .set("X-Service-Token", env.SERVICE_SECRET as string)
      .expect(404);

    expect(response.body).toEqual({ error: "user_not_found" });
  });

  it("401 quando SERVICE_SECRET nao esta configurado no servidor", async () => {
    const envWithoutSecret = { ...env, SERVICE_SECRET: undefined };
    const app = createApp(envWithoutSecret, fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }));

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", "qualquer-coisa")
      .expect(401);

    expect(response.body).toEqual({ error: "unauthorized" });
  });
});
