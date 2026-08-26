import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { enqueueOutboxEvent, processOutboxPending } from "./notificationOutbox.js";

/**
 * T3.13 — contrato HTTP de `POST /internal/v1/notifications/events`.
 *
 * ## O que estes testes provam, e o que NÃO provam
 *
 * Provam a **rota**: guard de credencial e escopo, forma do corpo, derivação de
 * `realm`/`source_app` da credencial (nunca do payload), idempotência de
 * produtor e o status 202. Mesma divisão de `communityCommentWriteRoutes.test.ts:20-30`
 * — fake prova tradução e contrato, nunca corretude do SQL.
 *
 * **Não** provam a transação nem o fan-out: atomicidade evento+outbox e criação
 * de recibo vivem em `notificationOutboxSavepoint.test.ts`, contra PostgreSQL
 * real.
 */

vi.mock("./notificationOutbox.js", () => ({
  enqueueOutboxEvent: vi.fn(),
  processOutboxPending: vi.fn().mockResolvedValue(0),
}));

const enqueueMock = vi.mocked(enqueueOutboxEvent);
const processMock = vi.mocked(processOutboxPending);

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
const RECIPIENT = "11111111-1111-4111-8111-111111111111";
const EVENT_ID = "33333333-3333-4333-8333-333333333333";
const EXISTING_ROW_ID = "44444444-4444-4444-8444-444444444444";

const VALID_BODY = {
  event_id: EVENT_ID,
  event_type: "downloads.material_approved",
  event_version: 1,
  subject_type: "material",
  subject_id: "material-1",
  canonical_path: "/materiais/material-1",
  snapshot: { legacy_kind: "material_approved", legacy_body: "Seu material foi aprovado." },
  recipients: [RECIPIENT],
};

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hash(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["notification.write"],
    revoked_at: null,
    ...overrides,
  };
}

/**
 * Fake mínimo. `existingEvent` controla o ramo de idempotência: `undefined`
 * significa evento novo (insere), objeto significa reenvio (devolve o que já
 * existe sem inserir).
 */
function fakeDb(
  credential?: Record<string, unknown>,
  existingEvent?: { id: string },
  captured?: { values?: Record<string, unknown> },
) {
  const trx = {
    selectFrom: () => {
      const builder = {
        select: () => builder,
        where: () => builder,
        executeTakeFirst: vi.fn().mockResolvedValue(existingEvent),
        executeTakeFirstOrThrow: vi.fn().mockResolvedValue(existingEvent),
      };
      return builder;
    },
    insertInto: () => ({
      values: (values: Record<string, unknown>) => {
        if (captured) captured.values = values;
        const chain = {
          onConflict: () => chain,
          // `numInsertedOrUpdatedRows` 0 é o que `ON CONFLICT DO NOTHING`
          // devolve num reenvio — é o sinal que a rota usa para buscar o id
          // existente em vez de enfileirar de novo.
          executeTakeFirst: vi.fn().mockResolvedValue({
            numInsertedOrUpdatedRows: existingEvent ? 0n : 1n,
          }),
        };
        return chain;
      },
    }),
  };

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
      execute: async (cb: (t: unknown) => Promise<unknown>) => cb(trx),
    }),
  } as never;
}

function post(app: Express) {
  return request(app)
    .post("/internal/v1/notifications/events")
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`);
}

beforeEach(() => {
  enqueueMock.mockReset();
  processMock.mockReset().mockResolvedValue(0);
});

describe("POST /internal/v1/notifications/events — guard de credencial", () => {
  it("401 sem X-Service-Token", async () => {
    const app = createApp(env, fakeDb(await credentialRow()));

    await request(app)
      .post("/internal/v1/notifications/events")
      .send(VALID_BODY)
      .expect(401);
  });

  it("403 com credencial válida mas sem o escopo notification.write", async () => {
    // A separação de escopo é o ponto: `comment.write` autoriza criar fala em
    // nome de usuário e não pode servir para emitir notificação.
    const app = createApp(env, fakeDb(await credentialRow({ scopes: ["comment.write"] })));

    await post(app).send(VALID_BODY).expect(403);
  });
});

describe("POST /internal/v1/notifications/events — contrato do corpo", () => {
  it("400 quando canonical_path é absoluto", async () => {
    // Espelha o CHECK de migration_006:480-486. Sem esta validação, o path
    // absoluto viraria erro de constraint (500) em vez de contrato (400).
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app)
      .send({ ...VALID_BODY, canonical_path: "https://exemplo.com/x" })
      .expect(400);
  });

  it("400 quando recipients vem vazio", async () => {
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app).send({ ...VALID_BODY, recipients: [] }).expect(400);
  });

  it("400 quando o corpo traz campo não declarado", async () => {
    // `strict()`: campo extra ignorado em silêncio faria o produtor acreditar
    // que mandou algo que o servidor nunca leu.
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app).send({ ...VALID_BODY, realm: "beta" }).expect(400);
  });
});

describe("POST /internal/v1/notifications/events — gravação", () => {
  it("202 e enfileira no outbox na mesma transação", async () => {
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app).send(VALID_BODY).expect(202);

    expect(response.body.event_row_id).toEqual(expect.any(String));
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        realm: "prod",
        sourceApp: "downloads",
        recipients: [RECIPIENT],
      }),
    );
  });

  it("deriva realm e source_app da credencial, nunca do payload", async () => {
    // A credencial é `downloads`/`prod`. Aceitar do corpo permitiria a
    // credencial de beta gravar evento marcado prod.
    const captured: { values?: Record<string, unknown> } = {};
    const app = createApp(env, fakeDb(await credentialRow(), undefined, captured));

    await post(app).send(VALID_BODY).expect(202);

    expect(captured.values).toMatchObject({ realm: "prod", source_app: "downloads" });
  });

  it("actor_id nulo: produtor externo informa destinatário, não autor comunitário", async () => {
    const captured: { values?: Record<string, unknown> } = {};
    const app = createApp(env, fakeDb(await credentialRow(), undefined, captured));

    await post(app).send(VALID_BODY).expect(202);

    expect(captured.values?.actor_id).toBeNull();
  });

  it("reenvio do mesmo event_id não cria evento nem entrada nova no outbox", async () => {
    // É o caso que `event_id` existe para cobrir: retry do produtor precisa ser
    // no-op, não notificação duplicada.
    //
    // O conflito é resolvido pelo índice único (`ON CONFLICT DO NOTHING`), não
    // por SELECT anterior: duas entregas simultâneas do mesmo evento — sweep
    // periódico junto do disparo pós-commit — passariam as duas por um
    // check-then-insert antes de qualquer INSERT commitar, e a segunda
    // devolveria 500 num retry legítimo.
    const app = createApp(env, fakeDb(await credentialRow(), { id: EXISTING_ROW_ID }));

    const response = await post(app).send(VALID_BODY).expect(202);

    expect(response.body.event_row_id).toBe(EXISTING_ROW_ID);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});

// Achado de review (PR #289, Codex P2): a fase 7 da spec 096 removeu
// `/api/v1/notifications` do `mesas`, então avisos que o usuário já tinha lido
// lá ficariam sem caminho de leitura. Migrá-los sem preservar o estado seria
// pior — reapareceriam como pendentes no sino.
describe("POST /internal/v1/notifications/events — read_at (migração de histórico)", () => {
  it("grava read_at quando a credencial tem notification.migrate", async () => {
    const captured: { values?: Record<string, unknown> } = {};
    const credencial = await credentialRow({
      scopes: ["notification.write", "notification.migrate"],
    });
    const app = createApp(env, fakeDb(credencial, undefined, captured));

    await post(app)
      .send({ ...VALID_BODY, read_at: "2026-08-13T10:00:00.000Z" })
      .expect(202);

    expect(captured.values?.read_at).toEqual(new Date("2026-08-13T10:00:00.000Z"));
  });

  // Achado de review (PR #289, CodeRabbit): criar aviso pendente é o trabalho
  // normal de um produtor; criar aviso JÁ LIDO é silenciar um aviso. Sem esta
  // trava, qualquer credencial com `notification.write` — seis em produção,
  // medido em 2026-08-26 — poderia mandar `read_at` no fluxo corrente e o sino
  // nunca acenderia.
  it("403 quando manda read_at sem o escopo notification.migrate", async () => {
    const captured: { values?: Record<string, unknown> } = {};
    const app = createApp(env, fakeDb(await credentialRow(), undefined, captured));

    const response = await post(app)
      .send({ ...VALID_BODY, read_at: "2026-08-13T10:00:00.000Z" })
      .expect(403);

    expect(response.body).toEqual({ error: "forbidden_scope" });
    // Recusa ANTES de gravar: nada chega ao banco.
    expect(captured.values).toBeUndefined();
  });

  it("read_at nulo quando ausente: aviso novo nasce pendente", async () => {
    // O caminho de TODO produtor corrente. Se este quebrar, o campo novo virou
    // regressão silenciosa — todo aviso nasceria lido e o sino nunca acenderia.
    const captured: { values?: Record<string, unknown> } = {};
    const app = createApp(env, fakeDb(await credentialRow(), undefined, captured));

    await post(app).send(VALID_BODY).expect(202);

    expect(captured.values?.read_at).toBeNull();
  });

  it("400 quando read_at não é datetime ISO", async () => {
    // Com o escopo concedido — senão a recusa viria do guard (403) e o caso não
    // provaria nada sobre a validação do formato.
    const app = createApp(env, fakeDb(await credentialRow({
      scopes: ["notification.write", "notification.migrate"],
    })));

    const response = await post(app)
      .send({ ...VALID_BODY, read_at: "ontem" })
      .expect(400);

    // Achado de review (PR #289, CodeRabbit): sem asserir o corpo, o caso
    // passaria com qualquer 400 — inclusive um vindo do guard de credencial ou
    // do rate limit, que não provariam nada sobre a validação do campo.
    expect(response.body).toEqual({ error: "invalid_body" });
  });
});
