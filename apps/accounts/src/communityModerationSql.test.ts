import {
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./db.js";
import { AUTO_HIDE_THRESHOLD, createReport, withdrawReport } from "./communityCommentReport.js";
import {
  removeCommentByModerator,
  resolveCase,
  restoreCommentByModerator,
} from "./communityModerationCase.js";
import { applySanction, decideAppeal, fileAppeal } from "./communityModerationAppeal.js";

/**
 * T2.17-T2.26 — o SQL que a moderação realmente emite.
 *
 * ## Por que sobre o SQL compilado, e não só sobre o payload
 *
 * Os invariantes caros desta superfície são **negativos e silenciosos**, no mesmo
 * padrão de `communityCommentVoteSql.test.ts`:
 *
 * - Contar antes do lock passa em qualquer teste de payload e só perde denúncia
 *   sob concorrência real, em produção.
 * - `UPDATE` sem `WHERE status = 'open'` deixa dois moderadores vencerem, e o
 *   teste de payload vê `200` nos dois.
 * - Escrever `removed_at` num auto-hide viola
 *   `community_comment_removal_check` e só falha no banco.
 * - Auditoria com `actor_id` do denunciante no auto-hide atribuiria a uma pessoa
 *   uma ação que foi do limiar — e nenhum tipo pega isso.
 *
 * O precedente é `values({})`, que compilava, passava no `tsc` e só falhou em
 * produção (2026-08-08).
 */

interface Capture {
  sqls: string[];
  params: readonly unknown[][];
  enqueue: (rows: unknown[]) => void;
}

function captureDb(): { db: Kysely<Database>; capture: Capture } {
  const sqls: string[] = [];
  const params: unknown[][] = [];
  const queue: unknown[][] = [];

  const connection: DatabaseConnection = {
    executeQuery: async <R>(compiled: CompiledQuery): Promise<QueryResult<R>> => {
      sqls.push(compiled.sql);
      params.push([...compiled.parameters]);
      if (/^\s*(begin|commit|rollback)/i.test(compiled.sql)) {
        return { rows: [] as R[] };
      }
      return { rows: (queue.shift() ?? []) as R[] };
    },
    streamQuery: async function* () {
      // Nunca chamado; existe para satisfazer a interface.
    },
  };

  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("begin"));
    },
    commitTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("commit"));
    },
    rollbackTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("rollback"));
    },
    releaseConnection: async () => {},
    destroy: async () => {},
  };

  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });

  return { db, capture: { sqls, params, enqueue: (rows) => queue.push(rows) } };
}

const DENUNCIANTE_ATOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTOR_ATOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MODERADOR_ATOR = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const VERSION_ID = "33333333-3333-4333-8333-333333333333";
const CASE_ID = "44444444-4444-4444-8444-444444444444";
const REPORT_ID = "55555555-5555-4555-8555-555555555555";
const APPEAL_ID = "66666666-6666-4666-8666-666666666666";
const USUARIO = "11111111-1111-4111-8111-111111111111";

const COMENTARIO = {
  id: COMMENT_ID,
  community_actor_id: AUTOR_ATOR,
  current_version_id: VERSION_ID,
  visibility_state: "visible",
  legacy_source: null,
};

let ctx = captureDb();

beforeEach(() => {
  ctx = captureDb();
});

const ENTRADA_DENUNCIA = {
  realm: "prod",
  sourceApp: "downloads",
  commentId: COMMENT_ID,
  actingUserId: USUARIO,
  reasonCode: "spam_or_off_topic" as const,
  details: null,
  idempotencyKey: "chave-de-idempotencia-1",
};

/**
 * Roteiro da denúncia, na ordem em que o handler consulta.
 *
 * Sequência: chave de idempotência → vínculo do ator → comentário → política do
 * motivo → aprovação da versão → caso travado → inserção → contagem → auditoria
 * → gravação da resposta.
 */
function scriptDenuncia(
  ctx: { capture: Capture },
  options: { distinctReporters: number; aprovada?: boolean },
): void {
  ctx.capture.enqueue([{ id: "chave" }]);
  ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
  ctx.capture.enqueue([COMENTARIO]);
  ctx.capture.enqueue([{ details_policy: "optional" }]);
  ctx.capture.enqueue(options.aprovada ? [{ id: "aprovacao" }] : []);
  ctx.capture.enqueue([{ id: CASE_ID }]);
  ctx.capture.enqueue([]);
  ctx.capture.enqueue([{ total: String(options.distinctReporters) }]);
  ctx.capture.enqueue([{ id: COMMENT_ID }]);
  ctx.capture.enqueue([]);
  ctx.capture.enqueue([]);
}

describe("createReport — SQL compilado", () => {
  it("trava o caso com FOR UPDATE antes de contar denunciantes", async () => {
    scriptDenuncia(ctx, { distinctReporters: 1 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const lock = ctx.capture.sqls.findIndex(
      (sql) => sql.includes("community_moderation_case") && sql.includes("for update"),
    );
    const contagem = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('count(distinct "reporter_actor_id")'),
    );

    expect(lock).toBeGreaterThan(-1);
    expect(contagem).toBeGreaterThan(-1);
    // A ordem **é** o invariante: contar antes do lock lê a foto que o vencedor
    // da corrida já invalidou (`read committed`), e o auto-hide some em silêncio.
    expect(lock).toBeLessThan(contagem);
  });

  it("conta contas distintas, não linhas de denúncia", async () => {
    scriptDenuncia(ctx, { distinctReporters: 2 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const contagem = ctx.capture.sqls.find((sql) => sql.includes("count("));
    expect(contagem).toContain('count(distinct "reporter_actor_id")');
    // Denúncia retirada e refeita deixa duas linhas do mesmo ator. `count(*)`
    // faria a mesma conta valer duas vezes para o limiar (decisão 34).
    expect(contagem).not.toContain("count(*)");
  });

  it("filtra a contagem por state = active", async () => {
    scriptDenuncia(ctx, { distinctReporters: 3 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const contagem = ctx.capture.sqls.find((sql) => sql.includes("count(distinct"));
    expect(contagem).toContain('"state" =');
    const indice = ctx.capture.sqls.findIndex((sql) => sql.includes("count(distinct"));
    expect(ctx.capture.params[indice]).toContain("active");
  });

  it("não oculta abaixo do limiar", async () => {
    scriptDenuncia(ctx, { distinctReporters: AUTO_HIDE_THRESHOLD - 1 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const ocultou = ctx.capture.sqls.some(
      (sql) =>
        sql.includes('update "community_comment"') &&
        sql.includes('"visibility_state"'),
    );
    expect(ocultou).toBe(false);
  });

  it("oculta ao atingir o limiar, condicionado a visibility_state = visible", async () => {
    scriptDenuncia(ctx, { distinctReporters: AUTO_HIDE_THRESHOLD });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const update = ctx.capture.sqls.find(
      (sql) =>
        sql.includes('update "community_comment"') &&
        sql.includes('"visibility_state"'),
    );

    expect(update).toBeDefined();
    // Condicionar a `visible` é o que impede sobrescrever tombstone do autor,
    // remoção moderadora ou um auto-hide anterior.
    expect(update).toContain('"visibility_state" =');
    expect(update).toContain("returning");
  });

  it("auto-hide não escreve as colunas de tombstone", async () => {
    scriptDenuncia(ctx, { distinctReporters: AUTO_HIDE_THRESHOLD });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const update = ctx.capture.sqls.find(
      (sql) =>
        sql.includes('update "community_comment"') &&
        sql.includes('"visibility_state"'),
    );

    // `community_comment_removal_check` exige as três nulas em
    // `pending_review_hidden`. Auto-hide **não é tombstone** (decisão 34).
    expect(update).not.toContain('"removed_at"');
    expect(update).not.toContain('"removed_by_actor_id"');
    expect(update).not.toContain('"removed_reason"');
  });

  it("registra o auto-hide com actor_id nulo", async () => {
    scriptDenuncia(ctx, { distinctReporters: AUTO_HIDE_THRESHOLD });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const indice = ctx.capture.sqls.findIndex(
      (sql, i) =>
        sql.includes('insert into "community_moderation_audit"') &&
        ctx.capture.params[i].includes("comment.auto_hidden"),
    );

    expect(indice).toBeGreaterThan(-1);
    // Atribuí-lo ao quinto denunciante faria a auditoria dizer que uma pessoa
    // ocultou o comentário, quando o que ocultou foi o limiar (decisão 34).
    expect(ctx.capture.params[indice]).toContain(null);
    expect(ctx.capture.params[indice]).toContain("report_threshold_reached");
  });

  it("fixa reported_version_id na versão corrente", async () => {
    scriptDenuncia(ctx, { distinctReporters: 1 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const indice = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('insert into "community_comment_report"'),
    );

    expect(indice).toBeGreaterThan(-1);
    // Decisão 39: a evidência é fixada no instante da denúncia, e edição
    // posterior não a muda.
    expect(ctx.capture.params[indice]).toContain(VERSION_ID);
  });

  it("recusa auto-denúncia sem tocar em community_comment_report", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ actor_id: AUTOR_ATOR }]);
    ctx.capture.enqueue([COMENTARIO]);

    const resultado = await createReport(ctx.db, ENTRADA_DENUNCIA);

    expect(resultado).toEqual({ ok: false, code: "self_report", status: 403 });
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('insert into "community_comment_report"'),
      ),
    ).toBe(false);
    expect(ctx.capture.sqls.at(-1)).toMatch(/rollback/i);
  });

  it("recusa comentário legado antes de checar autoria", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([{ ...COMENTARIO, community_actor_id: null, legacy_source: "site" }]);

    const resultado = await createReport(ctx.db, ENTRADA_DENUNCIA);

    expect(resultado).toEqual({ ok: false, code: "legacy_immutable", status: 403 });
  });

  it("não cria ator antes das recusas", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([{ ...COMENTARIO, legacy_source: "site" }]);

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    // Criar o ator antes gravaria identidade comunitária permanente por causa de
    // um pedido recusado nas linhas seguintes.
    expect(
      ctx.capture.sqls.some((sql) => sql.includes('insert into "community_actor"')),
    ).toBe(false);
  });

  it("motivo required sem detalhes vira 422 sem inserir denúncia", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([COMENTARIO]);
    ctx.capture.enqueue([{ details_policy: "required" }]);

    const resultado = await createReport(ctx.db, {
      ...ENTRADA_DENUNCIA,
      reasonCode: "other",
      details: null,
    });

    expect(resultado).toEqual({ ok: false, code: "details_required", status: 422 });
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('insert into "community_comment_report"'),
      ),
    ).toBe(false);
  });

  it("motivo inativo vira invalid_reason", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([COMENTARIO]);
    ctx.capture.enqueue([]);

    const resultado = await createReport(ctx.db, ENTRADA_DENUNCIA);

    expect(resultado).toEqual({ ok: false, code: "invalid_reason", status: 422 });
  });

  it("reserva a chave de idempotência antes de qualquer leitura", async () => {
    scriptDenuncia(ctx, { distinctReporters: 1 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const chave = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('insert into "community_idempotency_key"'),
    );
    const comentario = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('from "community_comment"'),
    );

    expect(chave).toBeGreaterThan(-1);
    expect(chave).toBeLessThan(comentario);
  });

  it("retoma chave vencida condicionada a expires_at", async () => {
    scriptDenuncia(ctx, { distinctReporters: 1 });

    await createReport(ctx.db, ENTRADA_DENUNCIA);

    const chave = ctx.capture.sqls.find((sql) =>
      sql.includes('insert into "community_idempotency_key"'),
    );

    // `DO UPDATE ... WHERE expires_at <= now()`: sem a retomada, a chave ficaria
    // bloqueada para sempre após 24h — a varredura que `migration_008` documenta
    // nunca foi escrita.
    expect(chave).toContain("do update set");
    expect(chave).toContain('"expires_at" <=');
  });
});

describe("withdrawReport — SQL compilado", () => {
  const ENTRADA_RETIRADA = {
    realm: "prod",
    sourceApp: "downloads",
    reportId: REPORT_ID,
    actingUserId: USUARIO,
  };

  it("trava o caso antes de olhar a visibilidade", async () => {
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([
      { id: REPORT_ID, case_id: CASE_ID, comment_id: COMMENT_ID, state: "active" },
    ]);
    ctx.capture.enqueue([{ id: CASE_ID }]);
    ctx.capture.enqueue([{ visibility_state: "visible" }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);

    await withdrawReport(ctx.db, ENTRADA_RETIRADA);

    const lock = ctx.capture.sqls.findIndex(
      (sql) => sql.includes("community_moderation_case") && sql.includes("for update"),
    );
    const visibilidade = ctx.capture.sqls.findIndex(
      (sql) =>
        sql.includes('from "community_comment"') && sql.includes("visibility_state"),
    );

    expect(lock).toBeGreaterThan(-1);
    // A mesma trava que a quinta denúncia toma: é o que faz a corrida da decisão
    // 42 ter um vencedor definido.
    expect(lock).toBeLessThan(visibilidade);
  });

  it("nunca faz DELETE — a linha permanece como withdrawn", async () => {
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([
      { id: REPORT_ID, case_id: CASE_ID, comment_id: COMMENT_ID, state: "active" },
    ]);
    ctx.capture.enqueue([{ id: CASE_ID }]);
    ctx.capture.enqueue([{ visibility_state: "visible" }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);

    await withdrawReport(ctx.db, ENTRADA_RETIRADA);

    // Apagar destruiria a evidência que sustenta o sinal de abuso da decisão 37.
    expect(
      ctx.capture.sqls.some((sql) => sql.includes("delete from")),
    ).toBe(false);
    const update = ctx.capture.sqls.find((sql) =>
      sql.includes('update "community_comment_report"'),
    );
    expect(update).toContain('"state" =');
  });

  it("recusa retirada depois do auto-hide", async () => {
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([
      { id: REPORT_ID, case_id: CASE_ID, comment_id: COMMENT_ID, state: "active" },
    ]);
    ctx.capture.enqueue([{ id: CASE_ID }]);
    ctx.capture.enqueue([{ visibility_state: "pending_review_hidden" }]);

    const resultado = await withdrawReport(ctx.db, ENTRADA_RETIRADA);

    expect(resultado).toEqual({ ok: false, code: "report_locked", status: 409 });
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('update "community_comment_report"'),
      ),
    ).toBe(false);
  });

  it("denúncia de outro ator não é encontrada", async () => {
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);
    ctx.capture.enqueue([]);

    const resultado = await withdrawReport(ctx.db, ENTRADA_RETIRADA);

    // `404` uniforme: distinguir "não existe" de "não é sua" diria se um id de
    // denúncia é válido, e denúncia alheia é dado de moderação.
    expect(resultado).toEqual({ ok: false, code: "report_not_found", status: 404 });
  });
});

const ENTRADA_RESOLUCAO = {
  realm: "prod",
  sourceApp: "downloads",
  caseId: CASE_ID,
  moderatorUserId: USUARIO,
  verdicts: [{ report_id: REPORT_ID, verdict: "upheld" as const }],
  action: "remove" as const,
  reason: "conteudo abusivo",
  idempotencyKey: "chave-de-resolucao-1",
};

/**
 * Roteiro do fechamento, na ordem **medida** com uma sonda sobre o handler real
 * — não deduzida da leitura do código.
 *
 * Sequência: chave → caso travado → denúncias ativas → ator do moderador →
 * comentário travado → transição condicionada → veredito por denúncia → efeito
 * na visibilidade → [aprovação de versão] → notificação do autor (vínculo +
 * `users` + evento + recibo) → notificação de cada denunciante (idem) →
 * auditoria → resposta da chave.
 *
 * `resolveUserIdOfActor` faz **duas** consultas por destinatário: o vínculo e a
 * confirmação em `users`. Enfileirar uma só faz o destinatário virar `null` em
 * silêncio e o evento não ser emitido — foi exatamente o que a primeira versão
 * deste roteiro fez, e o teste de dois eventos pegou.
 */
function scriptResolucao(
  ctx: { capture: Capture },
  options: { visibility?: string; aprovaVersao?: boolean } = {},
): void {
  ctx.capture.enqueue([{ id: "chave" }]);
  ctx.capture.enqueue([{ id: CASE_ID, comment_id: COMMENT_ID, status: "open" }]);
  ctx.capture.enqueue([{ id: REPORT_ID, reporter_actor_id: DENUNCIANTE_ATOR }]);
  ctx.capture.enqueue([{ actor_id: MODERADOR_ATOR }]);
  ctx.capture.enqueue([
    {
      id: COMMENT_ID,
      community_actor_id: AUTOR_ATOR,
      current_version_id: VERSION_ID,
      visibility_state: options.visibility ?? "pending_review_hidden",
    },
  ]);
  // transição condicionada
  ctx.capture.enqueue([{ id: CASE_ID }]);
  // veredito
  ctx.capture.enqueue([]);
  // efeito na visibilidade
  ctx.capture.enqueue([{ id: COMMENT_ID }]);
  if (options.aprovaVersao) {
    ctx.capture.enqueue([]);
  }
  // notificação do autor: vínculo, users, evento, recibo
  ctx.capture.enqueue([{ user_id: USUARIO }]);
  ctx.capture.enqueue([{ id: USUARIO }]);
  ctx.capture.enqueue([]);
  ctx.capture.enqueue([]);
  // notificação do denunciante: vínculo, users, evento, recibo
  ctx.capture.enqueue([{ user_id: USUARIO }]);
  ctx.capture.enqueue([{ id: USUARIO }]);
  ctx.capture.enqueue([]);
  ctx.capture.enqueue([]);
  // auditoria + resposta da chave
  ctx.capture.enqueue([]);
  ctx.capture.enqueue([]);
}

describe("resolveCase — SQL compilado", () => {
  it("condiciona a transição a status = open e usa RETURNING", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const update = ctx.capture.sqls.find((sql) =>
      sql.includes('update "community_moderation_case"'),
    );

    expect(update).toBeDefined();
    // T2.20(b): sem a condição, dois moderadores concorrentes vencem os dois —
    // o defeito do `downloads` que a task manda não reproduzir.
    expect(update).toContain('"status" =');
    expect(update).toContain("returning");
  });

  it("trava o caso com FOR UPDATE antes de decidir", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const lock = ctx.capture.sqls.findIndex(
      (sql) =>
        sql.includes('from "community_moderation_case"') && sql.includes("for update"),
    );
    const update = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('update "community_moderation_case"'),
    );

    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(update);
  });

  it("recusa caso já fechado sem escrever nada", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: CASE_ID, comment_id: COMMENT_ID, status: "closed" }]);

    const resultado = await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    expect(resultado).toEqual({
      ok: false,
      code: "case_already_resolved",
      status: 409,
    });
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('update "community_moderation_case"'),
      ),
    ).toBe(false);
  });

  it("recusa fechamento com denúncia sem veredito", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: CASE_ID, comment_id: COMMENT_ID, status: "open" }]);
    ctx.capture.enqueue([
      { id: REPORT_ID, reporter_actor_id: DENUNCIANTE_ATOR },
      { id: APPEAL_ID, reporter_actor_id: MODERADOR_ATOR },
    ]);

    const resultado = await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    // Decisão 43: o caso não fecha pela metade.
    expect(resultado).toEqual({
      ok: false,
      code: "incomplete_verdicts",
      status: 422,
    });
  });

  it("recusa veredito de denúncia que não pertence ao caso", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: CASE_ID, comment_id: COMMENT_ID, status: "open" }]);
    ctx.capture.enqueue([{ id: APPEAL_ID, reporter_actor_id: DENUNCIANTE_ATOR }]);

    const resultado = await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    expect(resultado).toEqual({ ok: false, code: "unknown_report", status: 422 });
  });

  it("remove escrevendo as três colunas de tombstone juntas", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const update = ctx.capture.sqls.find(
      (sql) =>
        sql.includes('update "community_comment"') && sql.includes('"removed_at"'),
    );

    // `community_comment_removal_check` exige as três junto com o estado.
    expect(update).toContain('"visibility_state"');
    expect(update).toContain('"removed_by_actor_id"');
    expect(update).toContain('"removed_reason"');
  });

  it("no_change não toca em community_comment", async () => {
    scriptResolucao(ctx, { visibility: "author_removed" });

    await resolveCase(ctx.db, {
      ...ENTRADA_RESOLUCAO,
      action: "no_change",
    });

    // Decisão 46: `no_change` preserva a visibilidade **atual**, inclusive
    // tombstone do autor. Nem um `UPDATE` que reescreve o mesmo valor.
    const tocou = ctx.capture.sqls.some(
      (sql) =>
        sql.includes('update "community_comment"') &&
        sql.includes('"visibility_state"'),
    );
    expect(tocou).toBe(false);
  });

  it("remove não sobrescreve tombstone do autor", async () => {
    scriptResolucao(ctx, { visibility: "author_removed" });

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const tocou = ctx.capture.sqls.some(
      (sql) =>
        sql.includes('update "community_comment"') && sql.includes('"removed_at"'),
    );
    // Sobrescrever trocaria a autoria da retirada: a interface diria que a
    // moderação removeu o que o próprio autor tirou do ar.
    expect(tocou).toBe(false);
  });

  it("restore limpa as três colunas de tombstone", async () => {
    scriptResolucao(ctx, { visibility: "moderator_removed", aprovaVersao: true });

    await resolveCase(ctx.db, { ...ENTRADA_RESOLUCAO, action: "restore" });

    const update = ctx.capture.sqls.find(
      (sql) =>
        sql.includes('update "community_comment"') && sql.includes('"removed_at"'),
    );

    expect(update).toBeDefined();
    const indice = ctx.capture.sqls.indexOf(update as string);
    // Três `null` no `SET` — `community_comment_removal_check` exige as três
    // nulas em `visible`.
    expect(ctx.capture.params[indice].filter((p) => p === null)).toHaveLength(3);
  });

  it("restore aprova a versão revisada", async () => {
    scriptResolucao(ctx, { visibility: "moderator_removed", aprovaVersao: true });

    await resolveCase(ctx.db, { ...ENTRADA_RESOLUCAO, action: "restore" });

    const aprovacao = ctx.capture.sqls.find((sql) =>
      sql.includes('insert into "community_comment_version_approval"'),
    );

    expect(aprovacao).toBeDefined();
    // Segunda decisão sobre a mesma versão não duplica linha
    // (`uq_community_comment_version_approval_active`).
    expect(aprovacao).toContain("do nothing");
  });

  it("remove não aprova versão nenhuma", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('insert into "community_comment_version_approval"'),
      ),
    ).toBe(false);
  });

  it("condiciona o veredito a state = active", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const update = ctx.capture.sqls.find((sql) =>
      sql.includes('update "community_comment_report"'),
    );

    // `guard_community_comment_report_update` recusa rejulgar denúncia terminal;
    // a condição transforma a recusa em zero linhas, não em exceção sem código.
    expect(update).toContain('"state" =');
  });

  it("grava auditoria na mesma transação do estado", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const inicio = ctx.capture.sqls.findIndex((sql) => /^\s*begin/i.test(sql));
    const fim = ctx.capture.sqls.findIndex((sql) => /^\s*commit/i.test(sql));
    const auditoria = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('insert into "community_moderation_audit"'),
    );

    // T2.20(c): auditoria que sobrevive ao rollback registraria ficção.
    expect(auditoria).toBeGreaterThan(inicio);
    expect(auditoria).toBeLessThan(fim);
  });

  it("emite eventos separados para autor e denunciante", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const eventos = ctx.capture.sqls
      .map((sql, i) => ({ sql, params: ctx.capture.params[i] }))
      .filter((e) => e.sql.includes('insert into "notification_event"'));

    expect(eventos).toHaveLength(2);
    const tipos = eventos.flatMap((e) =>
      e.params.filter(
        (p): p is string =>
          typeof p === "string" && p.startsWith("comment.moderation.decision"),
      ),
    );
    // Um evento único carregaria o superconjunto dos campos dos dois lados, e o
    // recibo não filtra conteúdo — só endereça (decisão 44).
    expect(tipos).toContain("comment.moderation.decision.author");
    expect(tipos).toContain("comment.moderation.decision.reporter");
  });

  it("snapshot do denunciante não carrega identidade nem motivo interno", async () => {
    scriptResolucao(ctx);

    await resolveCase(ctx.db, ENTRADA_RESOLUCAO);

    const indice = ctx.capture.sqls.findIndex(
      (sql, i) =>
        sql.includes('insert into "notification_event"') &&
        ctx.capture.params[i].includes("comment.moderation.decision.reporter"),
    );

    const snapshot = ctx.capture.params[indice].find(
      (p): p is Record<string, unknown> =>
        typeof p === "object" && p !== null && "outcome" in p,
    );

    expect(snapshot).toBeDefined();
    // Decisão 44: só o resultado mínimo do próprio veredito.
    expect(snapshot).toEqual({ outcome: "action_taken", comment_id: COMMENT_ID });
    expect(JSON.stringify(snapshot)).not.toContain(ENTRADA_RESOLUCAO.reason);
    expect(JSON.stringify(snapshot)).not.toContain(DENUNCIANTE_ATOR);
  });
});

describe("moderação direta — SQL compilado", () => {
  const ENTRADA_DIRETA = {
    realm: "prod",
    sourceApp: "downloads",
    commentId: COMMENT_ID,
    moderatorUserId: USUARIO,
    reason: "conteudo ilegal",
  };

  it("recusa remover comentário retirado pelo autor", async () => {
    ctx.capture.enqueue([{ id: COMMENT_ID, visibility_state: "author_removed" }]);

    const resultado = await removeCommentByModerator(ctx.db, ENTRADA_DIRETA);

    expect(resultado).toEqual({
      ok: false,
      code: "comment_removed_by_author",
      status: 409,
    });
  });

  it("recusa restaurar comentário retirado pelo autor", async () => {
    ctx.capture.enqueue([{ id: COMMENT_ID, visibility_state: "author_removed" }]);

    const resultado = await restoreCommentByModerator(ctx.db, ENTRADA_DIRETA);

    // Decisão 17: auto-retirada é irreversível para a moderação — restaurar
    // republicaria o texto contra a vontade de quem o escreveu.
    expect(resultado).toEqual({
      ok: false,
      code: "comment_removed_by_author",
      status: 409,
    });
  });

  it("remoção direta não fecha caso aberto", async () => {
    ctx.capture.enqueue([{ id: COMMENT_ID, visibility_state: "visible" }]);
    ctx.capture.enqueue([{ actor_id: MODERADOR_ATOR }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([{ community_actor_id: AUTOR_ATOR }]);
    ctx.capture.enqueue([{ user_id: USUARIO }]);
    ctx.capture.enqueue([{ id: USUARIO }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);

    await removeCommentByModerator(ctx.db, ENTRADA_DIRETA);

    // O caso é sobre as denúncias, e elas ainda precisam de veredito individual
    // (decisão 43).
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('update "community_moderation_case"'),
      ),
    ).toBe(false);
  });
});

describe("fileAppeal — SQL compilado", () => {
  const FECHADO_EM = new Date("2026-08-01T12:00:00.000Z");

  const ENTRADA_RECURSO = {
    realm: "prod",
    sourceApp: "downloads",
    caseId: CASE_ID,
    actingUserId: USUARIO,
    reason: "discordo da remocao",
    idempotencyKey: "chave-de-recurso-1",
  };

  function scriptRecurso(
    ctx: { capture: Capture },
    options: { terminalAction?: string; autorAtor?: string | null } = {},
  ): void {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([
      {
        id: CASE_ID,
        comment_id: COMMENT_ID,
        status: "closed",
        terminal_action: options.terminalAction ?? "remove",
        decision_version_id: VERSION_ID,
        closed_at: FECHADO_EM,
      },
    ]);
    ctx.capture.enqueue([
      { community_actor_id: options.autorAtor ?? AUTOR_ATOR },
    ]);
    ctx.capture.enqueue([{ actor_id: AUTOR_ATOR }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
  }

  it("calcula appeal_deadline_at como closed_at + 6 meses", async () => {
    scriptRecurso(ctx);

    await fileAppeal(ctx.db, ENTRADA_RECURSO);

    const indice = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('insert into "community_comment_appeal"'),
    );

    const esperado = new Date(FECHADO_EM);
    esperado.setMonth(esperado.getMonth() + 6);

    // `validate_community_comment_appeal` exige **exatamente** esse valor.
    // Aceitá-lo do cliente daria ao autor a chance de esticar o próprio prazo.
    const datas = ctx.capture.params[indice].filter(
      (p): p is Date => p instanceof Date,
    );
    expect(datas.map((d) => d.toISOString())).toContain(esperado.toISOString());
  });

  it("recusa recurso de decisão que não removeu", async () => {
    scriptRecurso(ctx, { terminalAction: "no_change" });

    const resultado = await fileAppeal(ctx.db, ENTRADA_RECURSO);

    expect(resultado).toEqual({
      ok: false,
      code: "appeal_not_available",
      status: 422,
    });
  });

  it("recusa recorrente que não é o autor", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([
      {
        id: CASE_ID,
        comment_id: COMMENT_ID,
        status: "closed",
        terminal_action: "remove",
        decision_version_id: VERSION_ID,
        closed_at: FECHADO_EM,
      },
    ]);
    ctx.capture.enqueue([{ community_actor_id: AUTOR_ATOR }]);
    ctx.capture.enqueue([{ actor_id: DENUNCIANTE_ATOR }]);

    const resultado = await fileAppeal(ctx.db, ENTRADA_RECURSO);

    // Decisão 47: denunciante não recorre de `not_upheld`.
    expect(resultado).toEqual({
      ok: false,
      code: "forbidden_appellant",
      status: 403,
    });
  });

  it("recusa fora da janela de seis meses", async () => {
    const antigo = new Date("2020-01-01T00:00:00.000Z");
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([
      {
        id: CASE_ID,
        comment_id: COMMENT_ID,
        status: "closed",
        terminal_action: "remove",
        decision_version_id: VERSION_ID,
        closed_at: antigo,
      },
    ]);
    ctx.capture.enqueue([{ community_actor_id: AUTOR_ATOR }]);
    ctx.capture.enqueue([{ actor_id: AUTOR_ATOR }]);

    const resultado = await fileAppeal(ctx.db, ENTRADA_RECURSO);

    expect(resultado).toEqual({
      ok: false,
      code: "appeal_window_expired",
      status: 422,
    });
  });
});

describe("decideAppeal — SQL compilado", () => {
  const ENTRADA_DECISAO = {
    realm: "prod",
    sourceApp: "downloads",
    appealId: APPEAL_ID,
    moderatorUserId: USUARIO,
    outcome: "reversed" as const,
    reason: "remocao equivocada",
  };

  function scriptDecisao(
    ctx: { capture: Capture },
    options: { restaurou?: boolean } = {},
  ): void {
    ctx.capture.enqueue([
      {
        id: APPEAL_ID,
        case_id: CASE_ID,
        status: "open",
        appellant_actor_id: AUTOR_ATOR,
      },
    ]);
    ctx.capture.enqueue([{ actor_id: MODERADOR_ATOR }]);
    ctx.capture.enqueue([{ id: APPEAL_ID }]);
    ctx.capture.enqueue([{ comment_id: COMMENT_ID }]);
    ctx.capture.enqueue(options.restaurou === false ? [] : [{ id: COMMENT_ID }]);
    ctx.capture.enqueue([{ user_id: USUARIO }]);
    ctx.capture.enqueue([{ id: USUARIO }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
  }

  it("condiciona a decisão a status = open", async () => {
    scriptDecisao(ctx);

    await decideAppeal(ctx.db, ENTRADA_DECISAO);

    const update = ctx.capture.sqls.find((sql) =>
      sql.includes('update "community_comment_appeal"'),
    );

    expect(update).toContain('"status" =');
    expect(update).toContain("returning");
  });

  it("reversed restaura só a partir de moderator_removed", async () => {
    scriptDecisao(ctx);

    await decideAppeal(ctx.db, ENTRADA_DECISAO);

    const update = ctx.capture.sqls.find((sql) =>
      sql.includes('update "community_comment"'),
    );
    const indice = ctx.capture.sqls.indexOf(update as string);

    // Se o autor retirou depois da remoção moderadora, o tombstone dele
    // prevalece.
    expect(ctx.capture.params[indice]).toContain("moderator_removed");
  });

  it("upheld não toca na visibilidade", async () => {
    ctx.capture.enqueue([
      {
        id: APPEAL_ID,
        case_id: CASE_ID,
        status: "open",
        appellant_actor_id: AUTOR_ATOR,
      },
    ]);
    ctx.capture.enqueue([{ actor_id: MODERADOR_ATOR }]);
    ctx.capture.enqueue([{ id: APPEAL_ID }]);
    ctx.capture.enqueue([{ comment_id: COMMENT_ID }]);
    ctx.capture.enqueue([{ user_id: USUARIO }]);
    ctx.capture.enqueue([{ id: USUARIO }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([]);

    await decideAppeal(ctx.db, { ...ENTRADA_DECISAO, outcome: "upheld" });

    // `upheld` = a decisão original foi mantida, o recurso perdeu.
    expect(
      ctx.capture.sqls.some((sql) => sql.includes('update "community_comment"')),
    ).toBe(false);
  });

  it("recusa recurso já decidido", async () => {
    ctx.capture.enqueue([
      {
        id: APPEAL_ID,
        case_id: CASE_ID,
        status: "upheld",
        appellant_actor_id: AUTOR_ATOR,
      },
    ]);

    const resultado = await decideAppeal(ctx.db, ENTRADA_DECISAO);

    expect(resultado).toEqual({
      ok: false,
      code: "appeal_already_decided",
      status: 409,
    });
  });
});

describe("applySanction — SQL compilado", () => {
  const ENTRADA_SANCAO = {
    realm: "prod",
    sourceApp: "downloads",
    targetActorId: AUTOR_ATOR,
    moderatorUserId: USUARIO,
    scopes: ["commenting"] as const,
    level: "temporary" as const,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    reason: "reincidencia",
    idempotencyKey: "chave-de-sancao-1",
  };

  function scriptSancao(ctx: { capture: Capture }, escopos: number): void {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: AUTOR_ATOR }]);
    ctx.capture.enqueue([{ actor_id: MODERADOR_ATOR }]);
    for (let i = 0; i < escopos; i += 1) {
      ctx.capture.enqueue([]);
      ctx.capture.enqueue([]);
    }
    ctx.capture.enqueue([]);
  }

  it("traduz temporary para temporary_suspension", async () => {
    scriptSancao(ctx, 1);

    await applySanction(ctx.db, ENTRADA_SANCAO);

    const indice = ctx.capture.sqls.findIndex((sql) =>
      sql.includes('insert into "community_restriction"'),
    );

    // O `CHECK` da migration usa `temporary_suspension`; o contrato HTTP fala
    // `temporary`. Mandar o valor do contrato falharia só no banco.
    expect(ctx.capture.params[indice]).toContain("temporary_suspension");
    expect(ctx.capture.params[indice]).not.toContain("temporary");
  });

  it("grava uma linha por escopo", async () => {
    scriptSancao(ctx, 2);

    await applySanction(ctx.db, {
      ...ENTRADA_SANCAO,
      scopes: ["posting", "commenting"],
    });

    const insercoes = ctx.capture.sqls.filter((sql) =>
      sql.includes('insert into "community_restriction"'),
    );

    // Uma linha por escopo é o que permite levantar `commenting` mantendo
    // `posting` — `uq_community_restriction_active` é sobre `(realm, actor, scope)`.
    expect(insercoes).toHaveLength(2);
  });

  it("recusa temporary sem expires_at", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: AUTOR_ATOR }]);

    const resultado = await applySanction(ctx.db, {
      ...ENTRADA_SANCAO,
      expiresAt: null,
    });

    expect(resultado).toEqual({ ok: false, code: "invalid_duration", status: 422 });
    expect(
      ctx.capture.sqls.some((sql) =>
        sql.includes('insert into "community_restriction"'),
      ),
    ).toBe(false);
  });

  it("recusa permanent com expires_at", async () => {
    ctx.capture.enqueue([{ id: "chave" }]);
    ctx.capture.enqueue([{ id: AUTOR_ATOR }]);

    const resultado = await applySanction(ctx.db, {
      ...ENTRADA_SANCAO,
      level: "permanent",
    });

    expect(resultado).toEqual({ ok: false, code: "invalid_duration", status: 422 });
  });

  it("nunca toca em users, refresh ou sessão", async () => {
    scriptSancao(ctx, 1);

    await applySanction(ctx.db, ENTRADA_SANCAO);

    // Decisão 48: login, leitura e uso não comunitário continuam. A separação é
    // estrutural, não uma regra que alguém precisa lembrar.
    expect(
      ctx.capture.sqls.some(
        (sql) => sql.includes('update "users"') || sql.includes('"refresh'),
      ),
    ).toBe(false);
  });
});
