import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "./app.js";
import type { AccountsEnv } from "./env.js";
import { hashServiceSecret } from "./serviceCredential.js";

const CREDENTIAL_SECRET = "segredo-de-credencial-registrada";

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hashServiceSecret(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["users.read"],
    ...overrides,
  };
}

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
};

/**
 * T2.2a acrescentou uma segunda consulta no caminho desta rota: o guard resolve
 * `community_service_credential` antes de chegar em `users`. O fake precisa
 * responder por tabela — devolver a linha de usuário para as duas faria o guard
 * tratar um usuário como credencial e "autenticar" qualquer coisa.
 */
function fakeDb(
  row: { id: string; email: string; name: string } | undefined,
  credentialRow?: Record<string, unknown>,
) {
  return {
    selectFrom: (table: string) => {
      const result = table === "community_service_credential" ? credentialRow : row;
      const builder = {
        select: () => builder,
        where: () => builder,
        executeTakeFirst: vi.fn().mockResolvedValue(result),
      };
      return builder;
    },
    updateTable: () => ({
      set: () => ({
        where: () => ({ execute: vi.fn().mockResolvedValue([]) }),
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

  // T2.2a-op passo 6: o fallback pelo `SERVICE_SECRET` global saiu. Um token
  // opaco, do formato que antes era aceito, não tem mais caminho — é a trava
  // contra reintroduzir o fallback sem que nenhum teste reclame.
  it("401 com token opaco que nao resolve credencial registrada", async () => {
    const app = createApp(env, fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }));

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", "service-secret-at-least-16-chars")
      .expect(401);

    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("404 quando usuario nao existe", async () => {
    const app = createApp(env, fakeDb(undefined, await credentialRow()));

    const response = await request(app)
      .get("/internal/users/does-not-exist")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .expect(404);

    expect(response.body).toEqual({ error: "user_not_found" });
  });

  // ── T2.2a: credencial registrada ─────────────────────────────────────────

  it("200 com credencial registrada de escopo users.read", async () => {
    const app = createApp(
      env,
      fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }, await credentialRow()),
    );

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .expect(200);

    expect(response.body).toEqual({ id: "user-1", email: "a@example.com", display_name: "Ana" });
  });

  // Separação de capacidade: credencial de leitura de segredo não lê usuário.
  // Com o `SERVICE_SECRET` global as duas rotas compartilhavam a mesma chave.
  it("403 quando a credencial nao tem escopo users.read", async () => {
    const app = createApp(
      env,
      fakeDb(
        { id: "user-1", email: "a@example.com", name: "Ana" },
        await credentialRow({ scopes: ["secrets.read"] }),
      ),
    );

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .expect(403);

    expect(response.body).toEqual({ error: "insufficient_scope" });
  });

  it("401 com credencial revogada", async () => {
    // A query filtra `revoked_at IS NULL`, então revogada volta `undefined`.
    const app = createApp(
      env,
      fakeDb({ id: "user-1", email: "a@example.com", name: "Ana" }, undefined),
    );

    const response = await request(app)
      .get("/internal/users/user-1")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .expect(401);

    // Corpo genérico, igual ao de credencial inexistente: distinguir "revogada"
    // de "nunca existiu" entregaria ao atacante um oráculo de enumeração de
    // `source_app`. Asserção explícita porque `.expect(401)` sozinho não prova
    // que a resposta não vazou o motivo.
    expect(response.body).toEqual({ error: "unauthorized" });
  });
});
