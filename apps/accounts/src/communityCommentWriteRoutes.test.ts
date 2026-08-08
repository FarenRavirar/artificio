import request from "supertest";
import type { Express } from "express";
import { describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";

/**
 * T2.6c — contrato HTTP de `POST /internal/v1/comments` e `/:id/replies`
 * (`contrato-http-v1.md` §3).
 *
 * ## O que estes testes provam, e o que NÃO provam
 *
 * Provam a camada que roda **antes** da transação: guard de credencial e escopo,
 * headers obrigatórios, forma do corpo, e a derivação de `realm`/`source_app` a
 * partir da credencial. Todos param antes do banco, então o fake não precisa
 * simular transação — e um fake de transação provaria a si mesmo, não ao
 * produto.
 *
 * **Não** provam a transação: atomicidade, idempotência real, dedupe de recibo e
 * FKs vivem em `phase-2-write-measurement.sql`, contra PostgreSQL real. É a
 * mesma divisão de `communityCommentRoutes.test.ts:24` — fake prova tradução e
 * contrato, nunca corretude do SQL.
 */

const env = {
  NODE_ENV: "test",
  PORT: "4000",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/artificio_auth",
  JWT_SECRET: "x".repeat(48),
  JWT_REFRESH_SECRET: "y".repeat(48),
  ACCOUNTS_SECRETS_KEY: "z".repeat(48),
  ACCOUNTS_COMMENT_CURSOR_KEY: "w".repeat(48),
  GOOGLE_CLIENT_ID: "client",
  GOOGLE_CLIENT_SECRET: "secret",
  GOOGLE_REDIRECT_URI: "http://localhost:4000/api/auth/google/callback",
  FRONTEND_URL: "http://localhost:5173",
  COOKIE_DOMAIN: "localhost",
} as never;

const CREDENTIAL_SECRET = "s".repeat(43);
const ACTING_USER = "11111111-1111-4111-8111-111111111111";
const IDEMPOTENCY_KEY = "chave-de-teste-0001";

const VALID_BODY = {
  subject_type: "downloads.material",
  subject_id: "material-1",
  canonical_path: "/materiais/material-1",
  body_markdown: "comentário",
};

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hash(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["comment.write"],
    revoked_at: null,
    ...overrides,
  };
}

/**
 * Fake mínimo: só o suficiente para o guard resolver a credencial.
 *
 * `transaction()` lança de propósito — nenhum teste deste arquivo deve chegar ao
 * banco. Se um chegar, o erro aponta o teste que passou a depender de algo que
 * este fake não prova, em vez de passar em silêncio.
 */
function fakeDb(credential?: Record<string, unknown>) {
  return {
    selectFrom: (table: string) => {
      const builder = {
        select: () => builder,
        where: () => builder,
        executeTakeFirst: vi
          .fn()
          .mockResolvedValue(table === "community_service_credential" ? credential : undefined),
      };
      return builder;
    },
    updateTable: () => ({
      set: () => ({ where: () => ({ execute: vi.fn().mockResolvedValue([]) }) }),
    }),
    transaction: () => ({
      execute: () => {
        throw new Error("teste chegou ao banco: use o script de medição para isso");
      },
    }),
  } as never;
}

function post(app: Express, path = "/internal/v1/comments") {
  return request(app)
    .post(path)
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("Idempotency-Key", IDEMPOTENCY_KEY)
    .set("X-Acting-User-Id", ACTING_USER);
}

describe("POST /internal/v1/comments — autenticação e escopo", () => {
  it("401 sem X-Service-Token", async () => {
    const app = createApp(env, fakeDb());

    const response = await request(app)
      .post("/internal/v1/comments")
      .send(VALID_BODY)
      .expect(401);

    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("403 quando a credencial não tem comment.write", async () => {
    // `comment.read` não autoriza escrita: é a separação de escopo que permite
    // um app ler comentários sem poder criá-los.
    const app = createApp(env, fakeDb(await credentialRow({ scopes: ["comment.read"] })));

    const response = await post(app).send(VALID_BODY).expect(403);
    expect(response.body).toEqual({ error: "insufficient_scope" });
  });
});

describe("POST /internal/v1/comments — headers obrigatórios (§3)", () => {
  it("400 sem Idempotency-Key", async () => {
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await request(app)
      .post("/internal/v1/comments")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Acting-User-Id", ACTING_USER)
      .send(VALID_BODY)
      .expect(400);

    expect(response.body.error.code).toBe("invalid_idempotency_key");
  });

  it.each([
    ["curta demais", "abc"],
    ["longa demais", "k".repeat(129)],
    // Caractere não-ASCII, e não byte de controle: byte nulo e quebra de linha
    // são rejeitados pelo cliente HTTP antes de sair, então o teste nunca
    // chegaria ao handler e mediria a biblioteca, não o produto. `é` atravessa o
    // transporte e é recusado pela nossa validação — que é o que se quer medir.
    ["com caractere fora de ASCII imprimível", "chave-com-acento-é"],
  ])("400 com Idempotency-Key %s", async (_caso, key) => {
    // §6 fixa 8-128 ASCII. O limite não é enfeite: a chave entra num índice
    // único, e valor fora da faixa viraria erro de constraint.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await request(app)
      .post("/internal/v1/comments")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("Idempotency-Key", key)
      .set("X-Acting-User-Id", ACTING_USER)
      .send(VALID_BODY)
      .expect(400);

    expect(response.body.error.code).toBe("invalid_idempotency_key");
  });

  it("400 sem X-Acting-User-Id", async () => {
    // Diferente da leitura, onde o header é opcional e só afeta `my_vote`: aqui
    // ele é a autoria. Sem ele não há o que escrever.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await request(app)
      .post("/internal/v1/comments")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("Idempotency-Key", IDEMPOTENCY_KEY)
      .send(VALID_BODY)
      .expect(400);

    expect(response.body.error.code).toBe("invalid_acting_user");
  });

  it("400 com X-Acting-User-Id que não é UUID", async () => {
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await request(app)
      .post("/internal/v1/comments")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("Idempotency-Key", IDEMPOTENCY_KEY)
      .set("X-Acting-User-Id", "nao-e-uuid")
      .send(VALID_BODY)
      .expect(400);

    expect(response.body.error.code).toBe("invalid_acting_user");
  });
});

describe("POST /internal/v1/comments — contrato do corpo (§3)", () => {
  it.each([
    ["subject_type", "subject_type"],
    ["subject_id", "subject_id"],
    ["canonical_path", "canonical_path"],
    ["body_markdown", "body_markdown"],
  ])("400 sem %s", async (_caso, campo) => {
    const app = createApp(env, fakeDb(await credentialRow()));
    const body: Record<string, unknown> = { ...VALID_BODY };
    delete body[campo];

    const response = await post(app).send(body).expect(400);
    expect(response.body.error.code).toBe("invalid_body");
  });

  it.each([
    ["realm", { realm: "beta" }],
    ["source_app", { source_app: "site" }],
    ["root_id", { root_id: "11111111-1111-4111-8111-111111111111" }],
    ["depth", { depth: 0 }],
  ])("400 quando o payload declara %s", async (_caso, extra) => {
    // `spec.md` 6a e §3: `realm`/`source_app` derivam da credencial, `root_id` e
    // `depth` são calculados. Ignorar em silêncio deixaria o chamador achar que
    // o valor foi aceito — e uma credencial de beta tentando `realm: 'prod'`
    // precisa falhar ruidosamente, não ser corrigida sem aviso.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({ ...VALID_BODY, ...extra })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });

  it.each([
    ["sem ponto", "material"],
    ["com maiúscula", "Downloads.Material"],
    ["ponto solto no fim", "downloads."],
    ["ponto duplo", "downloads..material"],
  ])("400 com subject_type %s", async (_caso, subjectType) => {
    // `migration_006:118` tem `CHECK (subject_type LIKE '%.%')`. Sem esta
    // validação o valor morria como erro de constraint, sem motivo legível
    // (achado de 2026-08-07, rodando a medição contra PostgreSQL real).
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({ ...VALID_BODY, subject_type: subjectType })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });
});

describe("POST /internal/v1/comments/:id/replies", () => {
  it("404 quando o :id não é UUID", async () => {
    // Id malformado e id inexistente devolvem o mesmo `404`: distinguir diria ao
    // chamador qual formato de id o sistema usa, e §3 lista só `404` para pai.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app, "/internal/v1/comments/nao-e-uuid/replies")
      .send(VALID_BODY)
      .expect(404);

    expect(response.body.error.code).toBe("parent_not_found");
  });

  it("exige comment.write igual à criação de raiz", async () => {
    const app = createApp(env, fakeDb(await credentialRow({ scopes: ["comment.read"] })));

    const response = await post(
      app,
      "/internal/v1/comments/11111111-1111-4111-8111-111111111111/replies",
    )
      .send(VALID_BODY)
      .expect(403);

    expect(response.body).toEqual({ error: "insufficient_scope" });
  });

  it("valida o corpo antes de tocar o banco", async () => {
    // Se a validação passasse adiante, o fake lançaria "teste chegou ao banco" e
    // o teste falharia com 500 em vez de 400 — que é o ponto: recusar antes de
    // abrir transação.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(
      app,
      "/internal/v1/comments/11111111-1111-4111-8111-111111111111/replies",
    )
      .send({ ...VALID_BODY, subject_type: "material" })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });
});
