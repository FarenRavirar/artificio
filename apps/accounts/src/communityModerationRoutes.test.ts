import request from "supertest";
import type { Express } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hash } from "@node-rs/argon2";
import { createApp } from "./app.js";
import { createReport, withdrawReport } from "./communityCommentReport.js";
import {
  changeCasePriority,
  removeCommentByModerator,
  resolveCase,
} from "./communityModerationCase.js";
import { applySanction, decideAppeal, fileAppeal } from "./communityModerationAppeal.js";
import {
  readCaseDetail,
  readCommentVersions,
  readModerationLog,
  readModerationQueue,
} from "./communityModerationQueue.js";

vi.mock("./communityCommentReport.js", async (original) => {
  const real = await original<typeof import("./communityCommentReport.js")>();
  return { ...real, createReport: vi.fn(), withdrawReport: vi.fn() };
});

vi.mock("./communityModerationCase.js", async (original) => {
  const real = await original<typeof import("./communityModerationCase.js")>();
  return {
    ...real,
    resolveCase: vi.fn(),
    changeCasePriority: vi.fn(),
    reopenCaseApproval: vi.fn(),
    removeCommentByModerator: vi.fn(),
    restoreCommentByModerator: vi.fn(),
  };
});

vi.mock("./communityModerationAppeal.js", async (original) => {
  const real = await original<typeof import("./communityModerationAppeal.js")>();
  return {
    ...real,
    fileAppeal: vi.fn(),
    decideAppeal: vi.fn(),
    applySanction: vi.fn(),
    liftSanction: vi.fn(),
    listSanctions: vi.fn(),
  };
});

vi.mock("./communityModerationQueue.js", () => ({
  readModerationQueue: vi.fn(),
  readModerationLog: vi.fn(),
  readCommentVersions: vi.fn(),
  readCaseDetail: vi.fn(),
}));

const createReportMock = vi.mocked(createReport);
const withdrawReportMock = vi.mocked(withdrawReport);
const resolveCaseMock = vi.mocked(resolveCase);
const changePriorityMock = vi.mocked(changeCasePriority);
const removeByModeratorMock = vi.mocked(removeCommentByModerator);
const fileAppealMock = vi.mocked(fileAppeal);
const decideAppealMock = vi.mocked(decideAppeal);
const applySanctionMock = vi.mocked(applySanction);
const readQueueMock = vi.mocked(readModerationQueue);
const readLogMock = vi.mocked(readModerationLog);
const readVersionsMock = vi.mocked(readCommentVersions);
const readCaseDetailMock = vi.mocked(readCaseDetail);

/**
 * T2.17-T2.26 — contrato HTTP da moderação
 * (`contrato-http-v1.md` §5, §9, §10, §11).
 *
 * O que estes casos protegem é a **fronteira**: o papel de moderador exigido em
 * toda rota de moderação, o bucket de leitura nas rotas `GET` (T2.20a), e a
 * validação de corpo que impede um payload malformado chegar ao núcleo. O núcleo
 * em si é coberto por `communityModerationSql.test.ts`.
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
const MODERADOR = "11111111-1111-4111-8111-111111111111";
const USUARIO_COMUM = "99999999-9999-4999-8999-999999999999";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const CASE_ID = "44444444-4444-4444-8444-444444444444";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const APPEAL_ID = "66666666-6666-4666-8666-666666666666";
const SANCTION_ID = "77777777-7777-4777-8777-777777777777";
const ATOR_ALVO = "88888888-8888-4888-8888-888888888888";
const CHAVE = "chave-de-idempotencia-1";

/**
 * Hash calculado **uma vez** por módulo, não por chamada.
 *
 * Argon2 custa ~34 ms por invocação (medido em 2026-08-09), e `credentialRow`
 * é chamada em quase todos os casos deste arquivo — recalcular era mais de um
 * segundo de suíte gasto derivando o mesmo valor. O `await` de topo de módulo é
 * suportado pelo ESM do vitest.
 */
const CREDENTIAL_HASH = await hash(CREDENTIAL_SECRET);

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "cred-1",
    token_id: "downloads-prod-abcd1234",
    token_hash: CREDENTIAL_HASH,
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["report.write", "moderation.write"],
    revoked_at: null,
    ...overrides,
  };
}

/**
 * `fakeDb` que distingue tabelas.
 *
 * `requireModeratorRole` consulta `users`, e o fake dos outros arquivos devolve
 * `undefined` para tudo que não seja credencial — o que faria toda rota de
 * moderação responder `403` e os testes passarem por engano, provando o guard e
 * nada mais.
 */
function fakeDb(
  credential?: Record<string, unknown>,
  user?: Record<string, unknown> | undefined,
) {
  return {
    selectFrom: (table: string) => {
      const builder = {
        select: () => builder,
        where: () => builder,
        executeTakeFirst: vi.fn().mockResolvedValue(
          table === "community_service_credential"
            ? credential
            : table === "users"
              ? user
              : undefined,
        ),
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

async function moderatorApp(role = "moderator"): Promise<Express> {
  return createApp(env, fakeDb(await credentialRow(), { id: MODERADOR, role }));
}

function withAuth(req: request.Test, actingUser = MODERADOR) {
  return req
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
    .set("X-Acting-User-Id", actingUser);
}

beforeEach(() => {
  vi.clearAllMocks();
  createReportMock.mockResolvedValue({
    ok: true,
    report: {
      id: REPORT_ID,
      comment_id: COMMENT_ID,
      reason_code: "spam_or_off_topic",
      state: "active",
      created_at: "2026-08-09T12:00:00.000Z",
    },
    replayed: false,
  });
  withdrawReportMock.mockResolvedValue({ ok: true });
  resolveCaseMock.mockResolvedValue({
    ok: true,
    resolution: {
      case_id: CASE_ID,
      action: "remove",
      status: "closed",
      closed_at: "2026-08-09T12:00:00.000Z",
      verdict_count: 1,
    },
    replayed: false,
  });
  changePriorityMock.mockResolvedValue({ ok: true });
  removeByModeratorMock.mockResolvedValue({ ok: true });
  fileAppealMock.mockResolvedValue({
    ok: true,
    appeal: {
      id: APPEAL_ID,
      case_id: CASE_ID,
      status: "open",
      submitted_at: "2026-08-09T12:00:00.000Z",
      appeal_deadline_at: "2027-02-09T12:00:00.000Z",
    },
    replayed: false,
  });
  decideAppealMock.mockResolvedValue({ ok: true, restored: true });
  applySanctionMock.mockResolvedValue({
    ok: true,
    sanction: {
      ids: [SANCTION_ID],
      scopes: ["commenting"],
      level: "temporary",
      expires_at: "2026-09-09T12:00:00.000Z",
    },
    replayed: false,
  });
  readQueueMock.mockResolvedValue([]);
  readLogMock.mockResolvedValue([]);
  readVersionsMock.mockResolvedValue([
    {
      id: "33333333-3333-4333-8333-333333333333",
      body_markdown: "texto",
      legacy_content_html: null,
      created_at: "2026-08-09T12:00:00.000Z",
      redacted_at: null,
      is_current: true,
      is_reported: true,
    },
  ]);
  readCaseDetailMock.mockResolvedValue({
    case_id: CASE_ID,
    comment_id: COMMENT_ID,
    status: "open",
    terminal_action: null,
    opened_at: "2026-08-09T12:00:00.000Z",
    closed_at: null,
    decision_reason: null,
    reports: [],
  });
});

describe("POST /internal/v1/comments/:id/reports", () => {
  async function reportApp(): Promise<Express> {
    // Denúncia **não** exige papel de moderador: qualquer conta denuncia.
    return createApp(env, fakeDb(await credentialRow(), undefined));
  }

  it("aceita denúncia de usuário comum e devolve 201", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "spam_or_off_topic" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(REPORT_ID);
  });

  it("recusa motivo fora do registro compartilhado", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "motivo_inventado" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_body");
    expect(createReportMock).not.toHaveBeenCalled();
  });

  it("recusa campo extra no corpo", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "spam_or_off_topic", comment_id: "outro" });

    // Ignorar o campo extra faria quem mandou `comment_id` achar que denunciou
    // outro comentário.
    expect(res.status).toBe(400);
    expect(createReportMock).not.toHaveBeenCalled();
  });

  it("exige Idempotency-Key", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    ).send({ reason_code: "spam_or_off_topic" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_idempotency_key");
  });

  it("normaliza details com trim antes de chamar o núcleo", async () => {
    const app = await reportApp();
    await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "other", details: "  abuso repetido  " });

    // `CHECK (details = BTRIM(details))`: espaço nas pontas viraria violação de
    // constraint, que chega como `500` sem motivo legível.
    expect(createReportMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ details: "abuso repetido" }),
    );
  });

  it("details só com espaço vira null", async () => {
    const app = await reportApp();
    await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "other", details: "     " });

    // "não mandou" e "mandou vazio" são o mesmo `422`/`details_required`, e o
    // `CHECK` exige `LENGTH BETWEEN 1 AND 4000` quando não-nulo.
    expect(createReportMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ details: null }),
    );
  });

  it("recusa details acima de 4.000 caracteres", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "other", details: "a".repeat(4001) });

    expect(res.status).toBe(400);
    expect(createReportMock).not.toHaveBeenCalled();
  });

  it("id malformado vira 404, nunca 400", async () => {
    const app = await reportApp();
    const res = await withAuth(
      request(app).post("/internal/v1/comments/nao-e-uuid/reports"),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "spam_or_off_topic" });

    // Distinguir "id inválido" de "id inexistente" diria ao chamador qual
    // formato de id o sistema usa (§13).
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("comment_not_found");
  });

  it("propaga a recusa do núcleo com o status dele", async () => {
    createReportMock.mockResolvedValue({
      ok: false,
      code: "report_already_active",
      status: 409,
    });

    const app = await reportApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "spam_or_off_topic" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("report_already_active");
  });

  it("recusa credencial sem escopo report.write", async () => {
    const app = createApp(
      env,
      fakeDb(await credentialRow({ scopes: ["comment.read"] }), undefined),
    );
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/reports`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason_code: "spam_or_off_topic" });

    expect(res.status).toBe(403);
    expect(createReportMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /internal/v1/reports/:id", () => {
  it("devolve 204 na retirada", async () => {
    const app = createApp(env, fakeDb(await credentialRow(), undefined));
    const res = await withAuth(
      request(app).delete(`/internal/v1/reports/${REPORT_ID}`),
      USUARIO_COMUM,
    );

    expect(res.status).toBe(204);
  });

  it("propaga report_locked do núcleo", async () => {
    withdrawReportMock.mockResolvedValue({
      ok: false,
      code: "report_locked",
      status: 409,
    });

    const app = createApp(env, fakeDb(await credentialRow(), undefined));
    const res = await withAuth(
      request(app).delete(`/internal/v1/reports/${REPORT_ID}`),
      USUARIO_COMUM,
    );

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("report_locked");
  });
});

describe("guard de papel de moderador", () => {
  const ROTAS_DE_MODERACAO: ReadonlyArray<[string, string]> = [
    ["get", "/internal/v1/comments/moderation-queue"],
    ["get", "/internal/v1/comments/moderation-log"],
    ["get", `/internal/v1/comments/${COMMENT_ID}/versions`],
    ["get", `/internal/v1/moderation/cases/${CASE_ID}`],
    ["post", `/internal/v1/moderation/cases/${CASE_ID}/resolution`],
    ["post", `/internal/v1/moderation/cases/${CASE_ID}/reopen`],
    ["patch", `/internal/v1/moderation/cases/${CASE_ID}/priority`],
    ["post", `/internal/v1/moderation/appeals/${APPEAL_ID}/resolution`],
    ["post", "/internal/v1/moderation/sanctions"],
    ["delete", `/internal/v1/moderation/sanctions/${SANCTION_ID}`],
    ["post", `/internal/v1/comments/${COMMENT_ID}/removal`],
    ["post", `/internal/v1/comments/${COMMENT_ID}/restore`],
  ];

  it.each(ROTAS_DE_MODERACAO)(
    "%s %s recusa usuário sem papel",
    async (method, path) => {
      // Conta existe, papel é `user`. Sem este guard, escopo de credencial seria
      // a única barreira, e qualquer usuário de um módulo com painel poderia
      // fechar caso alheio.
      const app = createApp(
        env,
        fakeDb(await credentialRow(), { id: USUARIO_COMUM, role: "user" }),
      );

      const req = (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ](path);
      const res = await withAuth(req, USUARIO_COMUM)
        .set("Idempotency-Key", CHAVE)
        .send({ reason: "motivo" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("forbidden_role");
    },
  );

  it("conta inexistente recebe o mesmo 403 de papel insuficiente", async () => {
    const app = createApp(env, fakeDb(await credentialRow(), undefined));
    const res = await withAuth(
      request(app).get("/internal/v1/comments/moderation-queue"),
    );

    // Separar as duas permitiria enumerar contas do SSO por tentativa.
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden_role");
  });

  it("aceita admin além de moderator", async () => {
    const app = await moderatorApp("admin");
    const res = await withAuth(
      request(app).get("/internal/v1/comments/moderation-queue"),
    );

    expect(res.status).toBe(200);
  });

  it("sem X-Acting-User-Id vira 403, não 400", async () => {
    const app = await moderatorApp();
    const res = await request(app)
      .get("/internal/v1/comments/moderation-queue")
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden_role");
  });
});

describe("GET /internal/v1/comments/moderation-queue", () => {
  it("usa o realm da credencial, nunca da query", async () => {
    const app = await moderatorApp();
    await withAuth(
      request(app).get("/internal/v1/comments/moderation-queue?realm=beta"),
    );

    // Requisito 27a: beta nunca aparece misturado com produção.
    expect(readQueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ realm: "prod" }),
    );
  });

  it("aplica limite padrão de 20", async () => {
    const app = await moderatorApp();
    await withAuth(request(app).get("/internal/v1/comments/moderation-queue"));

    expect(readQueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ limit: 20 }),
    );
  });

  it("recusa limite acima de 100", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get("/internal/v1/comments/moderation-queue?limit=500"),
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_query");
  });

  it("recusa cursor pela metade", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(
        "/internal/v1/comments/moderation-queue?cursor_id=44444444-4444-4444-8444-444444444444",
      ),
    );

    // Ignorar o que veio faria a página repetir desde o topo sem o moderador
    // perceber.
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_cursor");
  });

  it("aceita cursor completo", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(
        `/internal/v1/comments/moderation-queue?cursor_id=${CASE_ID}&cursor_opened_at=2026-08-09T12:00:00.000Z`,
      ),
    );

    expect(res.status).toBe(200);
    expect(readQueueMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ cursor: expect.objectContaining({ id: CASE_ID }) }),
    );
  });
});

describe("GET /internal/v1/comments/:id/versions", () => {
  it("devolve as versões com a corrente e a denunciada marcadas", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(`/internal/v1/comments/${COMMENT_ID}/versions`),
    );

    expect(res.status).toBe(200);
    expect(res.body.versions[0].is_current).toBe(true);
    expect(res.body.versions[0].is_reported).toBe(true);
  });

  it("lista vazia vira 404 uniforme", async () => {
    readVersionsMock.mockResolvedValue([]);

    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(`/internal/v1/comments/${COMMENT_ID}/versions`),
    );

    // `200` com array vazio diria que o comentário existe e não tem versão, o
    // que é impossível.
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("comment_not_found");
  });
});

describe("POST /internal/v1/moderation/cases/:id/resolution", () => {
  const CORPO = {
    verdicts: [{ report_id: REPORT_ID, verdict: "upheld" }],
    action: "remove",
    reason: "conteudo abusivo",
  };

  it("aceita decisão completa", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    )
      .set("Idempotency-Key", CHAVE)
      .send(CORPO);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("closed");
  });

  it("recusa veredito fora do vocabulário", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    )
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, verdicts: [{ report_id: REPORT_ID, verdict: "withdrawn" }] });

    // `withdrawn` é neutro e não escolhível pelo moderador (decisão 43).
    expect(res.status).toBe(400);
    expect(resolveCaseMock).not.toHaveBeenCalled();
  });

  it("recusa ação fora das três", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    )
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, action: "keep_visible" });

    // `keep_visible` era o nome anterior de `no_change`; aceitá-lo reintroduziria
    // a leitura errada de que a ação torna visível (decisão 46).
    expect(res.status).toBe(400);
  });

  it("recusa motivo vazio", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    )
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, reason: "   " });

    expect(res.status).toBe(400);
  });

  it("exige Idempotency-Key", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    ).send(CORPO);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("invalid_idempotency_key");
  });

  it("propaga case_already_resolved", async () => {
    resolveCaseMock.mockResolvedValue({
      ok: false,
      code: "case_already_resolved",
      status: 409,
    });

    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/cases/${CASE_ID}/resolution`),
    )
      .set("Idempotency-Key", CHAVE)
      .send(CORPO);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("case_already_resolved");
  });
});

describe("PATCH /internal/v1/moderation/cases/:id/priority", () => {
  it("recusa prioridade 3, que o CHECK aceita mas a spec não prevê", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).patch(`/internal/v1/moderation/cases/${CASE_ID}/priority`),
    ).send({ priority: 3, reason: "urgente" });

    // `spec.md` 847 fixa **P0-P2**. O `CHECK (priority BETWEEN 0 AND 3)` da
    // migration é mais frouxo, e a semente não usa 3 em nenhum dos oito motivos
    // — copiar o intervalo do banco deixaria o moderador reclassificar para uma
    // faixa sem significado, abaixo do menos urgente que existe.
    expect(res.status).toBe(400);
    expect(changePriorityMock).not.toHaveBeenCalled();
  });

  it("recusa prioridade negativa", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).patch(`/internal/v1/moderation/cases/${CASE_ID}/priority`),
    ).send({ priority: -1, reason: "urgente" });

    expect(res.status).toBe(400);
  });

  it("aceita prioridade válida e devolve 204", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).patch(`/internal/v1/moderation/cases/${CASE_ID}/priority`),
    ).send({ priority: 0, reason: "link malicioso" });

    expect(res.status).toBe(204);
  });
});

describe("POST /internal/v1/moderation/decisions/:id/appeals", () => {
  it("aceita recurso do autor com 201", async () => {
    const app = createApp(env, fakeDb(await credentialRow(), undefined));
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/decisions/${CASE_ID}/appeals`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason: "discordo da remocao" });

    // Recurso não exige papel de moderador — é o autor que recorre.
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(APPEAL_ID);
  });

  it("propaga forbidden_appellant", async () => {
    fileAppealMock.mockResolvedValue({
      ok: false,
      code: "forbidden_appellant",
      status: 403,
    });

    const app = createApp(env, fakeDb(await credentialRow(), undefined));
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/decisions/${CASE_ID}/appeals`),
      USUARIO_COMUM,
    )
      .set("Idempotency-Key", CHAVE)
      .send({ reason: "discordo" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden_appellant");
  });
});

describe("POST /internal/v1/moderation/appeals/:id/resolution", () => {
  it("aceita reversed e ecoa restored", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/appeals/${APPEAL_ID}/resolution`),
    ).send({ outcome: "reversed", reason: "remocao equivocada" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: "reversed", restored: true });
  });

  it("aceita upheld sem restaurar", async () => {
    // `upheld` = a decisão original foi **mantida**, o recurso perdeu. O
    // vocabulário é do ponto de vista da decisão, não do recorrente, e trocar os
    // dois restauraria exatamente nos casos em que a moderação confirmou a
    // remoção. O teste anterior só exercitava `reversed`, então a inversão
    // passaria despercebida.
    decideAppealMock.mockResolvedValue({ ok: true, restored: false });

    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/appeals/${APPEAL_ID}/resolution`),
    ).send({ outcome: "upheld", reason: "remocao confirmada" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ outcome: "upheld", restored: false });
  });

  it("recusa outcome inventado", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/moderation/appeals/${APPEAL_ID}/resolution`),
    ).send({ outcome: "granted", reason: "motivo" });

    expect(res.status).toBe(400);
    expect(decideAppealMock).not.toHaveBeenCalled();
  });
});

describe("POST /internal/v1/moderation/sanctions", () => {
  const CORPO = {
    target_actor_id: ATOR_ALVO,
    scopes: ["commenting"],
    level: "temporary",
    expires_at: "2026-09-09T12:00:00.000Z",
    reason: "reincidencia",
  };

  it("aceita sanção temporária com 201", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post("/internal/v1/moderation/sanctions"),
    )
      .set("Idempotency-Key", CHAVE)
      .send(CORPO);

    expect(res.status).toBe(201);
    expect(res.body.ids).toEqual([SANCTION_ID]);
  });

  it("recusa escopo fora de posting/commenting", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post("/internal/v1/moderation/sanctions"),
    )
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, scopes: ["login"] });

    // Sanção comunitária não alcança login (decisão 48).
    expect(res.status).toBe(400);
    expect(applySanctionMock).not.toHaveBeenCalled();
  });

  it("recusa nível do schema em vez do contrato", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post("/internal/v1/moderation/sanctions"),
    )
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, level: "temporary_suspension" });

    // O contrato HTTP fala `temporary`; a tradução para o valor do `CHECK` mora
    // no núcleo, num só lugar.
    expect(res.status).toBe(400);
  });

  it("deduplica escopo repetido antes do núcleo", async () => {
    const app = await moderatorApp();
    await withAuth(request(app).post("/internal/v1/moderation/sanctions"))
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, scopes: ["commenting", "commenting"] });

    // Duas linhas no mesmo escopo bateriam em `uq_community_restriction_active`
    // — `409` para um pedido que o moderador escreveu certo.
    expect(applySanctionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scopes: ["commenting"] }),
    );
  });

  it("converte expires_at para Date", async () => {
    const app = await moderatorApp();
    await withAuth(request(app).post("/internal/v1/moderation/sanctions"))
      .set("Idempotency-Key", CHAVE)
      .send(CORPO);

    expect(applySanctionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expiresAt: new Date(CORPO.expires_at) }),
    );
  });

  it("permanent envia expiresAt nulo", async () => {
    const app = await moderatorApp();
    await withAuth(request(app).post("/internal/v1/moderation/sanctions"))
      .set("Idempotency-Key", CHAVE)
      .send({ ...CORPO, level: "permanent", expires_at: null });

    expect(applySanctionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ expiresAt: null, level: "permanent" }),
    );
  });
});

describe("POST /internal/v1/comments/:id/removal", () => {
  it("devolve 204 e exige motivo", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/removal`),
    ).send({ reason: "conteudo ilegal" });

    expect(res.status).toBe(204);
  });

  it("recusa sem motivo", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/removal`),
    ).send({});

    expect(res.status).toBe(400);
    expect(removeByModeratorMock).not.toHaveBeenCalled();
  });

  it("propaga comment_removed_by_author", async () => {
    removeByModeratorMock.mockResolvedValue({
      ok: false,
      code: "comment_removed_by_author",
      status: 409,
    });

    const app = await moderatorApp();
    const res = await withAuth(
      request(app).post(`/internal/v1/comments/${COMMENT_ID}/removal`),
    ).send({ reason: "conteudo ilegal" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("comment_removed_by_author");
  });
});

describe("GET /internal/v1/moderation/cases/:id", () => {
  it("devolve o caso com as denúncias", async () => {
    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(`/internal/v1/moderation/cases/${CASE_ID}`),
    );

    expect(res.status).toBe(200);
    expect(res.body.case_id).toBe(CASE_ID);
  });

  it("caso inexistente vira 404", async () => {
    readCaseDetailMock.mockResolvedValue(null);

    const app = await moderatorApp();
    const res = await withAuth(
      request(app).get(`/internal/v1/moderation/cases/${CASE_ID}`),
    );

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("case_not_found");
  });
});
