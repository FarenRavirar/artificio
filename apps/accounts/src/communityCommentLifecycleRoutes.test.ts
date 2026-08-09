import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { editComment, removeCommentByAuthor } from "./communityCommentLifecycle.js";

// Mesma divisão de `communityCommentWriteRoutes.test.ts`: o núcleo transacional é
// mockado porque estes testes provam a **rota** — guard, headers, forma do corpo,
// mapeamento credencial → input e tradução do resultado em status. A transação em
// si é provada pelo SQL compilado (`communityCommentLifecycleSql.test.ts`) e pelo
// script de medição contra PostgreSQL real.
vi.mock("./communityCommentLifecycle.js", () => ({
  editComment: vi.fn(),
  removeCommentByAuthor: vi.fn(),
}));

const editCommentMock = vi.mocked(editComment);
const removeCommentMock = vi.mocked(removeCommentByAuthor);

/**
 * T2.7/T2.7b — contrato HTTP de `PATCH` e `DELETE /internal/v1/comments/:id`
 * (`contrato-http-v1.md` §4).
 *
 * O caso que mais importa aqui não é nenhum caminho feliz: é **o campo que a
 * rota recusa**. O contrato diz que só `body_markdown` muda, e é a rota que
 * precisa garantir isso — se `parent_id` passar em silêncio até o núcleo,
 * qualquer bug lá vira reescrita da conversa de terceiros.
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
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const IDEMPOTENCY_KEY = "chave-de-edicao-0001";

const EDITED = {
  id: COMMENT_ID,
  parent_id: null,
  root_id: COMMENT_ID,
  depth: 0,
  body_markdown: "corpo novo",
  created_at: "2026-08-09T12:00:00.000Z",
  edited_at: "2026-08-09T12:30:00.000Z",
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

/** Fake mínimo: só resolve credencial. Transação lança — nenhum teste daqui deve abrir uma. */
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

function patch(app: Express, id = COMMENT_ID) {
  return request(app)
    .patch(`/internal/v1/comments/${id}`)
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("Idempotency-Key", IDEMPOTENCY_KEY)
    .set("X-Acting-User-Id", ACTING_USER);
}

function del(app: Express, id = COMMENT_ID) {
  return request(app)
    .delete(`/internal/v1/comments/${id}`)
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("X-Acting-User-Id", ACTING_USER);
}

beforeEach(() => {
  vi.clearAllMocks();
  editCommentMock.mockResolvedValue({ ok: true, comment: EDITED, replayed: false });
  removeCommentMock.mockResolvedValue({ ok: true });
});

describe("PATCH — só o corpo muda", () => {
  it("edição do autor devolve 200 com o comentário atual", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app).send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(EDITED);
  });

  it("realm e source_app saem da credencial, nunca do corpo", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    await patch(app).send({ body_markdown: "corpo novo" });

    expect(editCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ realm: "prod", sourceApp: "downloads", commentId: COMMENT_ID }),
    );
  });

  it.each([
    ["parent_id", { parent_id: "33333333-3333-4333-8333-333333333333" }],
    ["subject_id", { subject_id: "outro" }],
    ["created_at", { created_at: "2020-01-01T00:00:00.000Z" }],
    ["community_actor_id", { community_actor_id: "44444444-4444-4444-8444-444444444444" }],
    ["visibility_state", { visibility_state: "visible" }],
    ["realm", { realm: "beta" }],
  ])("campo imutável %s é recusado com 400, não ignorado", async (_campo, extra) => {
    // O ponto inteiro da task: ignorar em silêncio faria o chamador achar que a
    // mudança valeu. `strict()` transforma cada um destes num `400`, e o núcleo
    // nem é chamado.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app).send({ body_markdown: "corpo novo", ...extra });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_body");
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("corpo vazio é recusado antes de abrir transação", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app).send({ body_markdown: "" });

    expect(res.status).toBe(400);
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("sem Idempotency-Key é 400 (§4 exige na edição)", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app)
      .patch(`/internal/v1/comments/${COMMENT_ID}`)
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Acting-User-Id", ACTING_USER)
      .send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_idempotency_key");
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("sem X-Acting-User-Id é 400 — sem ele não há autoria a provar", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app)
      .patch(`/internal/v1/comments/${COMMENT_ID}`)
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("Idempotency-Key", IDEMPOTENCY_KEY)
      .send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_acting_user");
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("id malformado é 404, nunca 400 — não revela o formato de id do sistema", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app, "nao-e-uuid").send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("comment_not_found");
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("credencial sem comment.write é 403, não 401", async () => {
    const app = createApp(env, fakeDb(await credentialRow({ scopes: ["comment.read"] }))) as Express;

    const res = await patch(app).send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(403);
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it("sem credencial nenhuma é 401", async () => {
    const app = createApp(env, fakeDb(undefined)) as Express;

    const res = await request(app)
      .patch(`/internal/v1/comments/${COMMENT_ID}`)
      .set("Idempotency-Key", IDEMPOTENCY_KEY)
      .set("X-Acting-User-Id", ACTING_USER)
      .send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(401);
    expect(editCommentMock).not.toHaveBeenCalled();
  });

  it.each([
    ["forbidden_not_author", 403],
    ["legacy_immutable", 403],
    ["comment_removed", 403],
    ["comment_not_found", 404],
    ["idempotency_key_reuse", 409],
    ["body_too_long", 422],
  ] as const)("recusa %s vira %i", async (code, status) => {
    editCommentMock.mockResolvedValue({ ok: false, code, status });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app).send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });

  it("no-op e repetição idempotente devolvem 200 como a edição real", async () => {
    // §4 não pede que o cliente distinga os três casos: os três são "o estado
    // atual do comentário". Um `204` ou `304` no no-op faria o consumidor
    // escrever caminho especial para nada.
    editCommentMock.mockResolvedValue({ ok: true, comment: EDITED, replayed: true });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await patch(app).send({ body_markdown: "corpo novo" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(EDITED);
  });
});

describe("DELETE — auto-retirada", () => {
  it("retirada do autor devolve 204 sem corpo", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await del(app);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe("");
  });

  it("não exige Idempotency-Key (§4) — o efeito já é idempotente", async () => {
    // A segunda chamada encontra o tombstone e recusa; não há segundo efeito a
    // deduplicar, então cobrar a chave só criaria atrito.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await del(app);

    expect(res.status).toBe(204);
    expect(removeCommentMock).toHaveBeenCalledTimes(1);
  });

  it("sem X-Acting-User-Id é 400", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app)
      .delete(`/internal/v1/comments/${COMMENT_ID}`)
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_acting_user");
    expect(removeCommentMock).not.toHaveBeenCalled();
  });

  it("realm e source_app saem da credencial", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    await del(app);

    expect(removeCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        realm: "prod",
        sourceApp: "downloads",
        commentId: COMMENT_ID,
        actingUserId: ACTING_USER,
      }),
    );
  });

  it("terceiro recebe 403, não 404 — o comentário existe, ele é que não é o dono", async () => {
    removeCommentMock.mockResolvedValue({
      ok: false,
      code: "forbidden_not_author",
      status: 403,
    });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await del(app);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden_not_author");
  });

  it("segunda retirada é 403/comment_removed — irreversível para o autor", async () => {
    removeCommentMock.mockResolvedValue({ ok: false, code: "comment_removed", status: 403 });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await del(app);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("comment_removed");
  });

  it("legado não é retirável", async () => {
    removeCommentMock.mockResolvedValue({ ok: false, code: "legacy_immutable", status: 403 });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await del(app);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("legacy_immutable");
  });

  it("credencial sem comment.write é 403", async () => {
    const app = createApp(env, fakeDb(await credentialRow({ scopes: ["comment.read"] }))) as Express;

    const res = await del(app);

    expect(res.status).toBe(403);
    expect(removeCommentMock).not.toHaveBeenCalled();
  });

  it("não existe rota de restauração pelo autor", async () => {
    // A ausência é o requisito (decisão 17): auto-retirada é irreversível para o
    // autor, e só `moderator`/`admin` restaura (§5). Um `POST .../restore` que
    // aceitasse `comment.write` daria ao autor um botão de esconder e reexibir
    // conforme a reação da conversa.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app)
      .post(`/internal/v1/comments/${COMMENT_ID}/restore`)
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Acting-User-Id", ACTING_USER)
      .send({});

    expect(res.status).toBe(404);
  });
});
