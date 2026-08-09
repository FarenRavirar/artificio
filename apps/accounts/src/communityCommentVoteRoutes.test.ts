import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { castVote, type VoteTally } from "./communityCommentVote.js";

vi.mock("./communityCommentVote.js", async (original) => {
  // `tallyDelta` é pura e usada por outro teste; só `castVote` é mockada, para
  // que estes casos provem a **rota** sem depender de banco.
  const real = await original<typeof import("./communityCommentVote.js")>();
  return { ...real, castVote: vi.fn() };
});

const castVoteMock = vi.mocked(castVote);

/**
 * T2.12-T2.14 — contrato HTTP de `PUT /internal/v1/comments/:id/vote`
 * (`contrato-http-v1.md` §7).
 *
 * O que estes casos protegem é o **formato do estado absoluto**: um `value` que
 * não seja exatamente `-1`, `0` ou `1` não pode chegar ao núcleo, e campo extra
 * não pode passar em silêncio — quem manda `{ value: 1, comment_id: "outro" }`
 * precisa saber que o segundo campo não valeu.
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

const TALLY: VoteTally = { my_vote: 1, upvotes: 4, downvotes: 1, score: 3 };

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hash(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["vote.write"],
    revoked_at: null,
    ...overrides,
  };
}

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
        throw new Error("teste chegou ao banco: use o teste de SQL compilado");
      },
    }),
  } as never;
}

function vote(app: Express, id = COMMENT_ID) {
  return request(app)
    .put(`/internal/v1/comments/${id}/vote`)
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("X-Acting-User-Id", ACTING_USER);
}

beforeEach(() => {
  vi.clearAllMocks();
  castVoteMock.mockResolvedValue({ ok: true, tally: TALLY });
});

describe("PUT vote — estado absoluto", () => {
  it.each([-1, 0, 1])("aceita value %i e devolve as contagens", async (value) => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({ value });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(TALLY);
    expect(castVoteMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value, commentId: COMMENT_ID }),
    );
  });

  it("realm e source_app saem da credencial, nunca do corpo", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    await vote(app).send({ value: 1 });

    expect(castVoteMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        realm: "prod",
        sourceApp: "downloads",
        actingUserId: ACTING_USER,
      }),
    );
  });

  it.each([2, -2, 0.5, "1", null, true])(
    "value %s fora do conjunto é 400",
    async (value) => {
      // `z.literal` fecha o conjunto exatamente como §7 o define. Um
      // `number().min(-1).max(1)` aceitaria `0.5` e `-0`.
      const app = createApp(env, fakeDb(await credentialRow())) as Express;

      const res = await vote(app).send({ value });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("invalid_body");
      expect(castVoteMock).not.toHaveBeenCalled();
    },
  );

  it("campo extra é recusado, não ignorado", async () => {
    // Ignorar em silêncio faria quem mandou `comment_id` achar que votou em
    // outro comentário.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({ value: 1, comment_id: "outro" });

    expect(res.status).toBe(400);
    expect(castVoteMock).not.toHaveBeenCalled();
  });

  it("corpo vazio é 400", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({});

    expect(res.status).toBe(400);
    expect(castVoteMock).not.toHaveBeenCalled();
  });
});

describe("PUT vote — credencial e identidade", () => {
  it("exige escopo vote.write, não comment.write", async () => {
    // Escopos separados: um módulo pode expor voto sem poder criar comentário.
    const app = createApp(
      env,
      fakeDb(await credentialRow({ scopes: ["comment.write"] })),
    ) as Express;

    const res = await vote(app).send({ value: 1 });

    expect(res.status).toBe(403);
    expect(castVoteMock).not.toHaveBeenCalled();
  });

  it("sem credencial é 401", async () => {
    const app = createApp(env, fakeDb(undefined)) as Express;

    const res = await request(app)
      .put(`/internal/v1/comments/${COMMENT_ID}/vote`)
      .set("X-Acting-User-Id", ACTING_USER)
      .send({ value: 1 });

    expect(res.status).toBe(401);
  });

  it("sem X-Acting-User-Id é 400 — o voto pertence a uma conta", async () => {
    // Diferente da leitura, onde o header é opcional e só afeta `my_vote`.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app)
      .put(`/internal/v1/comments/${COMMENT_ID}/vote`)
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .send({ value: 1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_acting_user");
    expect(castVoteMock).not.toHaveBeenCalled();
  });

  it("id malformado é 404, nunca 400", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app, "nao-e-uuid").send({ value: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("comment_not_found");
  });

  it("não exige Idempotency-Key (§6: estado absoluto)", async () => {
    // Nenhum header de idempotência é enviado por `vote()`, e a rota responde
    // `200`. Cobrar a chave aqui contradiria a decisão 12.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    expect((await vote(app).send({ value: 1 })).status).toBe(200);
  });
});

describe("PUT vote — recusas do núcleo viram o status do contrato", () => {
  it.each([
    ["self_vote", 403],
    ["legacy_immutable", 403],
    ["not_votable", 403],
    ["comment_not_found", 404],
  ] as const)("recusa %s vira %i", async (code, status) => {
    castVoteMock.mockResolvedValue({ ok: false, code, status });
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({ value: 1 });

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(code);
  });
});

describe("PUT vote — o payload é só contagem, nunca identidade", () => {
  it("resposta traz os quatro campos de §7 e nada mais", async () => {
    // "A API pública nunca expõe lista nominal" (decisão 10). Quem votou é dado
    // de moderação, e nem sequer é consultado por esta rota.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({ value: 1 });

    expect(Object.keys(res.body).sort()).toEqual([
      "downvotes",
      "my_vote",
      "score",
      "upvotes",
    ]);
  });

  it("nenhum identificador de votante aparece no corpo", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await vote(app).send({ value: 1 });
    const bruto = JSON.stringify(res.body);

    for (const proibido of ["actor", "user_id", "voter", "email", ACTING_USER]) {
      expect(bruto).not.toContain(proibido);
    }
  });
});
