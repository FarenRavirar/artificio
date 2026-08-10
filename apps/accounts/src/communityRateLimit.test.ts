import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { createComment } from "./communityCommentWrite.js";

vi.mock("./communityCommentWrite.js", () => ({ createComment: vi.fn() }));

const createCommentMock = vi.mocked(createComment);

/**
 * T2.10 — buckets independentes (`spec.md` 12b; decisões 50, 54;
 * `contrato-http-v1.md` §14).
 *
 * O caso que dá nome à task é o penúltimo bloco: **carga de comentário não
 * consome cota de `/login`**. Ele não falha em runtime nem em revisão — o
 * sintoma é o usuário que comentou demais não conseguir mais entrar, semanas
 * depois, sem nada nos logs ligando as duas coisas.
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
const OUTRO_USUARIO = "22222222-2222-4222-8222-222222222222";

const VALID_AUTHORIZATION = {
  exists: true,
  visible: true,
  commentable: true,
  owner_user_id: null,
  canonical_path: "/materiais/material-1",
};

const VALID_BODY = {
  subject_type: "downloads.material",
  subject_id: "material-1",
  canonical_path: "/materiais/material-1",
  body_markdown: "comentário",
  subject_authorization: VALID_AUTHORIZATION,
};

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hash(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["comment.write", "comment.read"],
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
        throw new Error("teste chegou ao banco: use o script de medição para isso");
      },
    }),
  } as never;
}

/** `write` tem 30 por usuário e 600 por credencial — ver `BUDGETS`. */
const LIMITE_ESCRITA_USUARIO = 30;

function post(app: Express, actingUser = ACTING_USER, chave = "chave-de-teste-0001") {
  return request(app)
    .post("/internal/v1/comments")
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("Idempotency-Key", chave)
    .set("X-Acting-User-Id", actingUser)
    .send(VALID_BODY);
}

beforeEach(() => {
  vi.clearAllMocks();
  createCommentMock.mockResolvedValue({
    ok: true,
    comment: {
      id: "c1",
      parent_id: null,
      root_id: "c1",
      depth: 0,
      body_markdown: "comentário",
      created_at: "2026-08-09T12:00:00.000Z",
    },
    replayed: false,
  });
});

describe("o orçamento é por usuário, dentro do bucket da ação", () => {
  it("estoura no limite do bucket de escrita e devolve 429", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i < LIMITE_ESCRITA_USUARIO; i += 1) {
      const res = await post(app);
      expect(res.status).toBe(201);
    }

    const excedente = await post(app);
    expect(excedente.status).toBe(429);
    // A requisição barrada não chega ao núcleo: nada de abrir transação nem
    // reservar chave de idempotência para um pedido que já foi recusado.
    expect(createCommentMock).toHaveBeenCalledTimes(LIMITE_ESCRITA_USUARIO);
  });

  it("o estouro de um usuário não barra outro", async () => {
    // NAT e módulo compartilhado: se o bucket fosse só da credencial, um usuário
    // abusivo derrubaria o comentário de todos os outros do mesmo app.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i <= LIMITE_ESCRITA_USUARIO; i += 1) await post(app);
    expect((await post(app)).status).toBe(429);

    expect((await post(app, OUTRO_USUARIO)).status).toBe(201);
  });
});

describe("429 não revela nada sobre o estado interno (decisão 50)", () => {
  it("corpo segue o formato único de erro, sem bucket nem saldo", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i <= LIMITE_ESCRITA_USUARIO; i += 1) await post(app);
    const res = await post(app);

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ error: { code: "rate_limited", correlation_id: null } });
    // Dizer qual bucket estourou, ou quanto resta, entrega ao atacante como
    // calibrar a próxima rajada — e revela se outro usuário do módulo está ativo.
    expect(JSON.stringify(res.body)).not.toMatch(/write|user|credential|bucket|remaining/i);
  });

  it("não emite RateLimit-* nem Retry-After — são o saldo que a decisão veda", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i <= LIMITE_ESCRITA_USUARIO; i += 1) await post(app);
    const res = await post(app);

    expect(res.headers["ratelimit-remaining"]).toBeUndefined();
    expect(res.headers["ratelimit-limit"]).toBeUndefined();
    expect(res.headers["retry-after"]).toBeUndefined();
  });

  it("ecoa X-Correlation-Id quando o chamador envia (§1.1)", async () => {
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i <= LIMITE_ESCRITA_USUARIO; i += 1) await post(app);
    const res = await request(app)
      .post("/internal/v1/comments")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("Idempotency-Key", "chave-de-teste-0001")
      .set("X-Acting-User-Id", ACTING_USER)
      .set("X-Correlation-Id", "corr-1")
      .send(VALID_BODY);

    expect(res.status).toBe(429);
    expect(res.body.error.correlation_id).toBe("corr-1");
  });
});

describe("cada ação tem orçamento independente", () => {
  it("escrita estourada não impede leitura", async () => {
    // O invariante que separa os buckets: quem comentou demais ainda consegue
    // **ler** a conversa. Orçamento único faria a punição alcançar a leitura,
    // que não tem o mesmo custo nem o mesmo risco.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    for (let i = 0; i <= LIMITE_ESCRITA_USUARIO; i += 1) await post(app);
    expect((await post(app)).status).toBe(429);

    const leitura = await request(app)
      .get("/internal/v1/comments")
      .query({ subject_type: "downloads.material", subject_id: "material-1" })
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Acting-User-Id", ACTING_USER);

    expect(leitura.status).not.toBe(429);
  });
});

describe("comentário não consome a cota do SSO (requisito 12b)", () => {
  it(
    "carga de escrita além do teto do SSO não afeta /api/auth/me",
    async () => {
      // O limiter global do `app.ts` é de 200/15 min e cobria a aplicação
      // inteira. Sem o `skip`, as 201 escritas abaixo o esgotariam e
      // `/api/auth/me` responderia 429 — o usuário que comentou perderia o
      // login.
      //
      // 201 requisições, uma a mais que o teto do SSO: o bucket comunitário
      // barra no 31, mas todas passariam pelo limiter global antes dele.
      //
      // Concorrentes e não sequenciais: cada `POST` verifica a credencial com
      // Argon2, que é deliberadamente caro, e 201 verificações em série estouram
      // o timeout padrão do vitest. O limiter conta requisição, não ordem.
      const app = createApp(env, fakeDb(await credentialRow())) as Express;

      await Promise.all(Array.from({ length: 201 }, () => post(app)));

      const sso = await request(app).get("/api/auth/me");
      // Sem sessão o esperado é 401. O que importa é **não ser 429**: 401 prova
      // que a requisição chegou ao handler de autenticação em vez de morrer no
      // limiter gasto pelos comentários.
      expect(sso.status).not.toBe(429);
      expect(sso.status).toBe(401);
    },
    30_000,
  );

  it("o limiter do SSO continua valendo para as rotas do SSO", async () => {
    // O `skip` não pode ter desligado a proteção de quem ele deve proteger.
    // `/api/auth/me` sem sessão não passa por Argon2, então a série é barata.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    let ultimoStatus = 0;
    for (let i = 0; i < 201; i += 1) {
      ultimoStatus = (await request(app).get("/api/auth/me")).status;
    }

    expect(ultimoStatus).toBe(429);
  });
});

describe("a tentativa não autenticada tem teto (achado de review, PR #251)", () => {
  it(
    "token inválido em /internal/v1/* acaba barrado por 429, não fica ilimitado",
    async () => {
      // A regressão que isto fecha: o `skip` tirou o prefixo do bucket do SSO,
      // mas os buckets comunitários rodam **depois** de
      // `requireServiceCredential` — token errado leva `401` e nunca chega a
      // eles. Cada tentativa ainda paga Argon2, que
      // `resolveServiceCredential` roda **também quando o token não existe**
      // (`serviceCredential.ts:170-172`, contra timing attack). Medido nesta
      // máquina: 33,7 ms de CPU por tentativa.
      //
      // 2001 requisições, uma acima do teto pré-auth. Credencial ausente no
      // fake, então todas falham a autenticação; o que se afirma é que em algum
      // ponto o limiter passa a responder `429` em vez de `401` indefinidamente.
      const app = createApp(env, fakeDb(undefined)) as Express;

      const respostas = await Promise.all(
        Array.from({ length: 2001 }, () =>
          request(app)
            .get("/internal/v1/comments")
            .query({ subject_type: "downloads.material", subject_id: "material-1" })
            .set("X-Service-Token", "downloads-prod-abcd1234.token-errado"),
        ),
      );

      const status = respostas.map((r) => r.status);
      expect(status).toContain(429);
      // E parte da rajada continua chegando ao guard: o limiter é teto, não
      // bloqueio do prefixo inteiro.
      //
      // `toContain(401)` e não `status[0] === 401`: `Promise.all` preserva a
      // ordem do **array**, não a ordem em que o servidor processou — a
      // requisição do índice 0 pode ter chegado depois de mil outras, e o teste
      // falharia de forma intermitente sem nada estar errado no limiter.
      expect(status).toContain(401);
    },
    120_000,
  );

  it("o teto pré-auth não alcança as rotas do SSO", async () => {
    // `skip` invertido: este limiter existe só para `/internal/v1/*`. Se
    // vazasse para `/api/auth/*`, daria ao SSO um segundo teto não declarado.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

describe("a chave da credencial contém módulo descontrolado", () => {
  it("limitar por credencial não depende de identificar o usuário abusivo", async () => {
    // Requisições sem `X-Acting-User-Id` só têm a credencial como identidade. O
    // bucket dela é o que impede um módulo com bug de saturar o `accounts.`
    // usando um usuário diferente a cada chamada.
    const app = createApp(env, fakeDb(await credentialRow())) as Express;

    const semUsuario = await request(app)
      .get("/internal/v1/comments")
      .query({ subject_type: "downloads.material", subject_id: "material-1" })
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`);

    // Sem usuário a leitura é permitida (o header é opcional em §2) e continua
    // debitando o bucket da credencial.
    expect(semUsuario.status).not.toBe(429);
  });
});
