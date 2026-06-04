import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "./app.js";
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
