import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { createComment } from "./communityCommentWrite.js";

// Mock do núcleo transacional: os testes de caminho feliz precisam provar o que
// a ROTA faz — mapear corpo e credencial para o input, e traduzir o resultado em
// `201` — sem depender do banco. A transação em si é provada por
// `phase-2-write-measurement.sql`, contra PostgreSQL real.
vi.mock("./communityCommentWrite.js", () => ({ createComment: vi.fn() }));

const createCommentMock = vi.mocked(createComment);

/**
 * T2.6c — contrato HTTP de `POST /internal/v1/comments` e `/:id/replies`
 * (`contrato-http-v1.md` §3).
 *
 * ## O que estes testes provam, e o que NÃO provam
 *
 * Provam a **rota**: guard de credencial e escopo, headers obrigatórios, forma do
 * corpo, o mapeamento payload+credencial → input do núcleo, e a tradução do
 * resultado em status HTTP. `createComment` é mockado de propósito — um fake de
 * transação provaria a si mesmo, não ao produto.
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

/**
 * Afirmação do guard do módulo (§8). É **obrigatória** no corpo: sem ela o
 * `accounts.` estaria escrevendo contra referência opaca.
 */
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
    scopes: ["comment.write"],
    revoked_at: null,
    ...overrides,
  };
}

/**
 * Fake mínimo: só o suficiente para o guard resolver a credencial.
 *
 * `transaction()` lança de propósito. `createComment` está mockado, então nenhum
 * teste daqui deveria abrir transação; se um abrir, o erro aponta o teste que
 * passou a depender de algo que este fake não prova, em vez de passar em
 * silêncio.
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

beforeEach(() => {
  createCommentMock.mockReset();
});

describe("POST /internal/v1/comments — caminho de sucesso", () => {
  const CRIADO = {
    id: "22222222-2222-4222-8222-222222222222",
    parent_id: null,
    root_id: "22222222-2222-4222-8222-222222222222",
    depth: 0,
    body_markdown: "comentário",
    created_at: "2026-08-08T00:00:00.000Z",
  };

  it("201 com o comentário criado no corpo", async () => {
    createCommentMock.mockResolvedValue({ ok: true, comment: CRIADO, replayed: false });
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app).send(VALID_BODY).expect(201);

    expect(response.body).toEqual(CRIADO);
  });

  it("deriva realm e source_app da credencial, não do payload", async () => {
    // É a trava de `spec.md` 6a em ação: a credencial é `downloads`/`prod`, e é
    // isso que precisa chegar ao núcleo — mesmo que o corpo não os mencione.
    createCommentMock.mockResolvedValue({ ok: true, comment: CRIADO, replayed: false });
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app).send(VALID_BODY).expect(201);

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ realm: "prod", source_app: "downloads" }),
    );
  });

  it("repassa corpo, headers e parentId nulo na criação de raiz", async () => {
    createCommentMock.mockResolvedValue({ ok: true, comment: CRIADO, replayed: false });
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app).send(VALID_BODY).expect(201);

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subject_type: "downloads.material",
        subject_id: "material-1",
        canonicalPath: "/materiais/material-1",
        bodyMarkdown: "comentário",
        ownerUserId: null,
        parentId: null,
        actingUserId: ACTING_USER,
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    );
  });

  it("resposta passa o :id da URL como parentId", async () => {
    const PAI = "33333333-3333-4333-8333-333333333333";
    createCommentMock.mockResolvedValue({
      ok: true,
      comment: { ...CRIADO, parent_id: PAI, root_id: PAI, depth: 1 },
      replayed: false,
    });
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app, `/internal/v1/comments/${PAI}/replies`).send(VALID_BODY).expect(201);

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ parentId: PAI }),
    );
  });

  it("o dono vem da autorização do domínio, não do campo solto", async () => {
    // §8: o publicador é afirmado pelo backend do domínio, e a autorização é a
    // portadora dessa afirmação. Nulo é caso legítimo (post sem conta
    // vinculada).
    const DONO = "44444444-4444-4444-8444-444444444444";
    createCommentMock.mockResolvedValue({ ok: true, comment: CRIADO, replayed: false });
    const app = createApp(env, fakeDb(await credentialRow()));

    await post(app)
      .send({
        ...VALID_BODY,
        subject_owner_user_id: DONO,
        subject_authorization: { ...VALID_AUTHORIZATION, owner_user_id: DONO },
      })
      .expect(201);

    expect(createCommentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ ownerUserId: DONO }),
    );
  });

  it("repetição idempotente devolve 201 com o mesmo corpo", async () => {
    // §6: repetição com mesmo payload devolve a resposta original, mesmo status.
    // Um `200` aqui faria o cliente que reenviou por timeout achar que houve dois
    // comentários.
    createCommentMock.mockResolvedValue({ ok: true, comment: CRIADO, replayed: true });
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app).send(VALID_BODY).expect(201);

    expect(response.body).toEqual(CRIADO);
  });

  it.each([
    ["409 idempotency_key_reuse", "idempotency_key_reuse" as const, 409],
    ["422 depth_exceeded", "depth_exceeded" as const, 422],
    ["404 parent_not_found", "parent_not_found" as const, 404],
    ["403 sanctioned", "sanctioned" as const, 403],
  ])("traduz rejeição do núcleo em %s", async (_caso, code, status) => {
    createCommentMock.mockResolvedValue({ ok: false, code, status });
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app).send(VALID_BODY).expect(status);

    expect(response.body.error.code).toBe(code);
  });
});

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

describe("POST /internal/v1/comments — autorização do assunto (§8)", () => {
  it("400 sem subject_authorization", async () => {
    // O campo é a única coisa que afirma que o alvo existe, está visível e
    // aceita comentário. Faltava no handler até 2026-08-09: o corpo era
    // `strict()` sem ele, então quem seguisse o contrato levava `400` justamente
    // por mandar o campo certo.
    const app = createApp(env, fakeDb(await credentialRow()));
    const body: Record<string, unknown> = { ...VALID_BODY };
    delete body.subject_authorization;

    const response = await post(app).send(body).expect(400);
    expect(response.body.error.code).toBe("invalid_body");
  });

  it.each([
    ["exists", { exists: false }],
    ["visible", { visible: false }],
    ["commentable", { commentable: false }],
  ])("404 uniforme quando o domínio nega %s", async (_caso, negado) => {
    // §13: `404` uniforme. Nem `403` nem código próprio por caso — a recusa
    // diferenciada viraria oráculo de existência, exatamente o que
    // `SubjectRefusalReason` documenta como "não é para o `accounts.` receber".
    //
    // Sem `mockResolvedValue` de propósito: se a rota chamasse o núcleo mesmo
    // assim, o mock devolveria `undefined` e o teste quebraria por dentro — o
    // que é o sinal certo. A asserção de `not.toHaveBeenCalled` fecha o caso.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({
        ...VALID_BODY,
        subject_authorization: { ...VALID_AUTHORIZATION, ...negado },
      })
      .expect(404);

    expect(response.body.error.code).toBe("subject_not_found");
    // A recusa acontece **antes** da transação: nada de gravar chave de
    // idempotência para um alvo que o domínio já negou.
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it.each([
    ["esquema", "https://evil.example/x"],
    ["protocol-relative", "//evil.example/x"],
    ["barra invertida", "/materiais\\evil"],
    ["credencial embutida", "/materiais/@evil"],
  ])("400 com canonical_path contendo %s", async (_caso, path) => {
    // `canonicalPathSchema` do pacote é reaplicado aqui: o caminho vira link de
    // volta ao conteúdo, e aceitar URL inteira abriria open redirect
    // (requisito 5b). Guard do outro lado com bug não passa.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({
        ...VALID_BODY,
        canonical_path: path,
        subject_authorization: { ...VALID_AUTHORIZATION, canonical_path: path },
      })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });

  it("400 quando canonical_path do corpo diverge do da autorização", async () => {
    // Escolher um dos dois em silêncio faria o chamador achar que mandou o valor
    // que valeu. A autoridade é a autorização (§8); a divergência é erro dele.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({ ...VALID_BODY, canonical_path: "/outro-caminho" })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });

  it("400 quando subject_owner_user_id diverge do dono da autorização", async () => {
    const DONO = "44444444-4444-4444-8444-444444444444";
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({ ...VALID_BODY, subject_owner_user_id: DONO })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
  });

  it("400 com campo desconhecido dentro da autorização", async () => {
    // `strict()` também no objeto aninhado: um guard que mandasse `owner_id` no
    // lugar de `owner_user_id` teria o dono descartado em silêncio, e o
    // comentário nasceria sem badge nem recibo do publicador.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(app)
      .send({
        ...VALID_BODY,
        subject_authorization: { ...VALID_AUTHORIZATION, owner_id: null },
      })
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

  it("valida o corpo antes de chamar o núcleo", async () => {
    // Recusar na rota evita abrir transação por um pedido já inválido — e, mais
    // importante, evita gravar a chave de idempotência (passo 1 da transação)
    // para um pedido que nunca poderia ter sido aceito.
    const app = createApp(env, fakeDb(await credentialRow()));

    const response = await post(
      app,
      "/internal/v1/comments/11111111-1111-4111-8111-111111111111/replies",
    )
      .send({ ...VALID_BODY, subject_type: "material" })
      .expect(400);

    expect(response.body.error.code).toBe("invalid_body");
    expect(createCommentMock).not.toHaveBeenCalled();
  });
});
