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
import {
  AUTHOR_REMOVAL_REASON,
  editComment,
  removeCommentByAuthor,
} from "./communityCommentLifecycle.js";

/**
 * T2.7/T2.7b — o SQL que a edição e a retirada realmente emitem.
 *
 * ## Por que sobre o SQL, e não sobre um mock do handler
 *
 * Os invariantes caros destas duas operações são todos **negativos**: o que
 * *não* entra no `SET`. Edição não pode tocar voto, ranking, autoria, pai nem
 * `visibility_state`; retirada não pode apagar o corpo nem virar `DELETE`
 * físico. Um teste de rota com o núcleo mockado não vê nada disso — ele para
 * antes. Um teste com fake de transação provaria o fake.
 *
 * O precedente é `communityCommentWriteSql.test.ts`: `values({})` compilava,
 * passava no `tsc` e só falhava no banco, em produção. Aqui o risco é pior,
 * porque um `SET` a mais **não falha em lugar nenhum** — só apaga voto de
 * terceiro em silêncio.
 *
 * ## Como o driver funciona
 *
 * Compilador de Postgres real; o driver só registra o SQL e devolve as linhas
 * roteirizadas por `enqueue`, para que a transação chegue até o fim e emita
 * todos os comandos. É a mesma forma de `communityCommentReadSql.test.ts`.
 */

interface Capture {
  sqls: string[];
  enqueue: (rows: unknown[]) => void;
}

function captureDb(): { db: Kysely<Database>; capture: Capture } {
  const sqls: string[] = [];
  const queue: unknown[][] = [];

  const connection: DatabaseConnection = {
    executeQuery: async <R>(compiled: CompiledQuery): Promise<QueryResult<R>> => {
      sqls.push(compiled.sql);
      // `BEGIN`/`COMMIT` não consomem da fila: o Kysely os emite por fora do
      // roteiro, e deixá-los consumir desalinharia todas as respostas seguintes.
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

  return { db, capture: { sqls, enqueue: (rows) => queue.push(rows) } };
}

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const ACTING_USER = "11111111-1111-4111-8111-111111111111";

const COMMENT_ROW = {
  id: COMMENT_ID,
  parent_id: null,
  root_id: COMMENT_ID,
  depth: 0,
  body_markdown: "corpo antigo",
  community_actor_id: ACTOR_ID,
  visibility_state: "visible",
  legacy_source: null,
  created_at: new Date("2026-08-09T12:00:00.000Z"),
  edited_at: null,
};

let ctx = captureDb();

beforeEach(() => {
  ctx = captureDb();
});

/**
 * Roteiro da edição bem-sucedida, na ordem em que o handler consulta:
 * reserva da chave, comentário travado, vínculo ator↔conta.
 */
function scriptEdit(comment: Record<string, unknown> = COMMENT_ROW): void {
  ctx.capture.enqueue([{ id: "idem-1" }]);
  ctx.capture.enqueue([comment]);
  ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);
}

/** Roteiro da retirada: comentário travado e vínculo. Sem chave de idempotência. */
function scriptRemove(comment: Record<string, unknown> = COMMENT_ROW): void {
  ctx.capture.enqueue([comment]);
  ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);
}

/** Junta o SQL emitido, para as asserções sobre o conjunto da transação. */
function allSql(): string {
  return ctx.capture.sqls.join("\n;\n");
}

function sqlMatching(pattern: RegExp): string[] {
  return ctx.capture.sqls.filter((sql) => pattern.test(sql));
}

const EDIT_INPUT = {
  realm: "prod",
  sourceApp: "downloads",
  commentId: COMMENT_ID,
  bodyMarkdown: "corpo novo",
  actingUserId: ACTING_USER,
  idempotencyKey: "chave-de-edicao-0001",
};

const REMOVE_INPUT = {
  realm: "prod",
  sourceApp: "downloads",
  commentId: COMMENT_ID,
  actingUserId: ACTING_USER,
};

describe("edição toca o corpo e nada além dele", () => {
  it("o UPDATE grava body_markdown, current_version_id e edited_at", async () => {
    scriptEdit();
    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result.ok).toBe(true);
    const update = sqlMatching(/update "community_comment" set/i);
    expect(update).toHaveLength(1);
    expect(update[0]).toMatch(/"body_markdown"\s*=/i);
    expect(update[0]).toMatch(/"current_version_id"\s*=/i);
    expect(update[0]).toMatch(/"edited_at"\s*=/i);
  });

  it.each([
    ["parent_id", /"parent_id"\s*=/i],
    ["root_id", /"root_id"\s*=/i],
    ["depth", /"depth"\s*=/i],
    ["community_actor_id", /"community_actor_id"\s*=/i],
    ["created_at", /"created_at"\s*=/i],
    ["subject_id", /"subject_id"\s*=/i],
    ["visibility_state", /"visibility_state"\s*=/i],
  ])("o UPDATE nunca grava %s", async (_coluna, pattern) => {
    // Cada um destes seria um defeito diferente e igualmente silencioso: mover o
    // pai reescreve a conversa de terceiros, mexer em `created_at` reordena a
    // árvore de quem já leu, e `visibility_state` no `SET` revelaria comentário
    // sob revisão que a decisão 41 manda manter oculto.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const update = sqlMatching(/update "community_comment" set/i);
    expect(update[0]).not.toMatch(pattern);
  });

  it.each([
    ["voto", /community_comment_vote/i],
    ["faixa de score", /community_comment_score_version/i],
    ["revisão de ranking", /ranking_revision/i],
    ["assunto", /community_comment_subject/i],
  ])("a transação inteira nunca menciona %s (decisão 18)", async (_alvo, pattern) => {
    // O ponto mais contraintuitivo da task: editar **preserva** voto e ranking.
    // Zerar puniria quem corrige uma vírgula e não impediria o mal-intencionado,
    // que edita antes do primeiro voto chegar. A defesa é o marcador público de
    // edição mais o histórico da moderação.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    expect(allSql()).not.toMatch(pattern);
  });

  it("cria versão nova em vez de reescrever a existente", async () => {
    // `community_comment_version_guard_update` recusa reescrita de versão
    // (medido em produção, `pg_trigger` de `artificio_auth`). Um `UPDATE` aqui
    // não é apenas errado — aborta a transação inteira em runtime.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    expect(allSql()).toMatch(/insert into "community_comment_version"/i);
    expect(allSql()).not.toMatch(/update "community_comment_version"/i);
  });

  it("a versão nova registra o próprio autor, nunca um moderador", async () => {
    // Decisão 22: a identidade exibida nunca assina texto produzido pela
    // moderação. `authored_by_actor_id` sai do comentário travado, e a autoria
    // já foi provada antes de chegar aqui.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const insert = sqlMatching(/insert into "community_comment_version"/i);
    expect(insert[0]).toMatch(/"authored_by_actor_id"/i);
  });

  it("edição não emite evento nem recibo de notificação (decisão 20)", async () => {
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    expect(allSql()).not.toMatch(/notification_event/i);
    expect(allSql()).not.toMatch(/notification_receipt/i);
  });

  it("edição idêntica não cria versão nem mexe no comentário", async () => {
    // No-op de verdade: nem versão, nem `edited_at`. Criar versão para corpo
    // idêntico encheria o histórico de ruído e faria a interface exibir
    // "editado" para quem não editou nada.
    scriptEdit({ ...COMMENT_ROW, body_markdown: "corpo novo" });
    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result.ok).toBe(true);
    expect(allSql()).not.toMatch(/insert into "community_comment_version"/i);
    expect(sqlMatching(/update "community_comment" set/i)).toHaveLength(0);
  });

  it("o comentário é travado com FOR UPDATE, não FOR SHARE", async () => {
    // As duas operações escrevem nesta linha. Sem trava exclusiva, duas edições
    // concorrentes do mesmo autor inseririam duas versões e deixariam
    // `current_version_id` apontando para a perdedora — corpo exibido divergindo
    // do histórico, sem erro nenhum.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const select = sqlMatching(/from "community_comment"\s+where/i);
    expect(select[0]).toMatch(/for update/i);
    expect(select[0]).not.toMatch(/for share/i);
  });

  it("o SELECT do comentário filtra por realm e source_app da credencial", async () => {
    // Sem os dois no `WHERE`, uma credencial de beta editaria linha de produção
    // por id. O `404` uniforme depende deste filtro.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const select = sqlMatching(/from "community_comment"\s+where/i);
    expect(select[0]).toMatch(/"realm"\s*=/i);
    expect(select[0]).toMatch(/"source_app"\s*=/i);
  });

  it("o UPDATE também filtra por realm e source_app, não só por id", async () => {
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const update = sqlMatching(/update "community_comment" set/i);
    expect(update[0]).toMatch(/"realm"\s*=/i);
    expect(update[0]).toMatch(/"source_app"\s*=/i);
  });

  it("a chave de idempotência é reservada com ON CONFLICT DO NOTHING", async () => {
    // Capturar a violação de unicidade mataria a transação (`25P02`) e
    // transformaria repetição legítima em `500` — o defeito que a criação já
    // corrigiu.
    scriptEdit();
    await editComment(ctx.db, EDIT_INPUT);

    const insert = sqlMatching(/insert into "community_idempotency_key"/i);
    expect(insert[0]).toMatch(/on conflict do nothing/i);
  });
});

describe("retirada é tombstone, nunca DELETE", () => {
  it("emite UPDATE de visibilidade e nenhum DELETE", async () => {
    // Apagar a linha quebraria os filhos: `community_comment_parent_subject_fk`
    // aponta para ela. Pior — apagar em cascata deixaria o autor de um
    // comentário apagar a fala de terceiros que responderam.
    scriptRemove();
    const result = await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(result.ok).toBe(true);
    expect(allSql()).not.toMatch(/delete from/i);
    expect(sqlMatching(/update "community_comment" set/i)).toHaveLength(1);
  });

  it("grava os quatro campos que o CHECK do banco exige juntos", async () => {
    // `community_comment_removal_check` recusa estado removido sem `removed_at`,
    // `removed_by_actor_id` e `removed_reason` não-vazio. Faltar um não é bug de
    // estilo: a transação aborta.
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    const update = sqlMatching(/update "community_comment" set/i)[0];
    expect(update).toMatch(/"visibility_state"\s*=/i);
    expect(update).toMatch(/"removed_at"\s*=/i);
    expect(update).toMatch(/"removed_by_actor_id"\s*=/i);
    expect(update).toMatch(/"removed_reason"\s*=/i);
  });

  it("o corpo permanece na linha — evidência de denúncia sobrevive", async () => {
    // Decisão 46: a retirada do autor não encerra a moderação. Apagar o texto
    // aqui destruiria a prova do caso que segue aberto, e T2.19 fixa
    // `reported_version_id` justamente sobre essas versões.
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    const update = sqlMatching(/update "community_comment" set/i)[0];
    expect(update).not.toMatch(/"body_markdown"\s*=/i);
    expect(allSql()).not.toMatch(/delete from "community_comment_version"/i);
  });

  it("registra auditoria na MESMA transação", async () => {
    // Nenhum trigger obriga isto: `community_comment` aparece com zero triggers
    // em `pg_trigger` de produção (medido em 2026-08-09), enquanto as cinco
    // tabelas de moderação têm `require_community_terminal_audit`. Se este
    // `insert` sumir do handler, a retirada continua funcionando e a trilha some
    // sem erro nenhum. Por isso o teste afirma a linha, não só o estado.
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    const audit = sqlMatching(/insert into "community_moderation_audit"/i);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatch(/"action"/i);
    expect(audit[0]).toMatch(/"target_type"/i);
    expect(audit[0]).toMatch(/"target_id"/i);
    expect(audit[0]).toMatch(/"reason"/i);
  });

  it("o motivo canônico não é vazio — o CHECK do banco recusaria", async () => {
    expect(AUTHOR_REMOVAL_REASON.trim().length).toBeGreaterThan(0);
  });

  it("retirada não emite notificação", async () => {
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(allSql()).not.toMatch(/notification_event/i);
    expect(allSql()).not.toMatch(/notification_receipt/i);
  });

  it("retirada não toca voto, score nem ranking", async () => {
    // O comentário sai da vista, mas o score dele continua existindo — a
    // ocultação acontece na leitura (`toTreeRow`), não apagando dado.
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(allSql()).not.toMatch(/community_comment_vote/i);
    expect(allSql()).not.toMatch(/community_comment_score_version/i);
    expect(allSql()).not.toMatch(/ranking_revision/i);
  });

  it("não abre chave de idempotência (§4 não exige no DELETE)", async () => {
    scriptRemove();
    await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(allSql()).not.toMatch(/community_idempotency_key/i);
  });
});

describe("recusas param antes de qualquer escrita", () => {
  it("comentário já retirado não gera segundo tombstone nem segunda auditoria", async () => {
    // Repetir sobrescreveria `removed_at` e o ator da retirada original — um
    // autor conseguiria carimbar o próprio nome sobre uma remoção de moderação.
    scriptRemove({ ...COMMENT_ROW, visibility_state: "author_removed" });
    const result = await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(result).toEqual({ ok: false, code: "comment_removed", status: 403 });
    expect(sqlMatching(/update "community_comment" set/i)).toHaveLength(0);
    expect(allSql()).not.toMatch(/insert into "community_moderation_audit"/i);
  });

  it("remoção por moderador não pode ser sobrescrita pelo autor", async () => {
    scriptRemove({ ...COMMENT_ROW, visibility_state: "moderator_removed" });
    const result = await removeCommentByAuthor(ctx.db, REMOVE_INPUT);

    expect(result).toEqual({ ok: false, code: "comment_removed", status: 403 });
    expect(sqlMatching(/update "community_comment" set/i)).toHaveLength(0);
  });

  it("terceiro não edita: nenhuma versão criada", async () => {
    ctx.capture.enqueue([{ id: "idem-1" }]);
    ctx.capture.enqueue([COMMENT_ROW]);
    ctx.capture.enqueue([{ actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }]);

    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result).toEqual({ ok: false, code: "forbidden_not_author", status: 403 });
    expect(allSql()).not.toMatch(/insert into "community_comment_version"/i);
  });

  it("usuário sem ator nenhum é recusado como não-autor", async () => {
    ctx.capture.enqueue([{ id: "idem-1" }]);
    ctx.capture.enqueue([COMMENT_ROW]);
    ctx.capture.enqueue([]);

    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result).toEqual({ ok: false, code: "forbidden_not_author", status: 403 });
  });

  it("legado é recusado por imutabilidade, não por autoria", async () => {
    // A ordem importa: legado tem `community_actor_id` nulo, então a checagem de
    // autor sozinha o recusaria com a mensagem errada. Ninguém é autor de um
    // legado; o motivo real é a decisão 6.
    ctx.capture.enqueue([{ id: "idem-1" }]);
    ctx.capture.enqueue([
      { ...COMMENT_ROW, community_actor_id: null, legacy_source: "site" },
    ]);

    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result).toEqual({ ok: false, code: "legacy_immutable", status: 403 });
  });

  it("comentário retirado não volta a ser editável", async () => {
    ctx.capture.enqueue([{ id: "idem-1" }]);
    ctx.capture.enqueue([{ ...COMMENT_ROW, visibility_state: "author_removed" }]);
    ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);

    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result).toEqual({ ok: false, code: "comment_removed", status: 403 });
    expect(allSql()).not.toMatch(/insert into "community_comment_version"/i);
  });

  it("comentário sob revisão CONTINUA editável e a edição não o revela (decisão 41)", async () => {
    // O oposto do caso acima, e o mais fácil de errar: quem está sob revisão
    // precisa poder corrigir o que foi denunciado. Bloquear aqui puniria o autor
    // por uma denúncia que ainda não foi julgada.
    scriptEdit({ ...COMMENT_ROW, visibility_state: "pending_review_hidden" });

    const result = await editComment(ctx.db, EDIT_INPUT);

    expect(result.ok).toBe(true);
    expect(allSql()).toMatch(/insert into "community_comment_version"/i);
    const update = sqlMatching(/update "community_comment" set/i)[0];
    expect(update).not.toMatch(/"visibility_state"\s*=/i);
  });

  it("corpo inválido nem abre transação", async () => {
    const result = await editComment(ctx.db, { ...EDIT_INPUT, bodyMarkdown: "   " });

    expect(result.ok).toBe(false);
    expect(ctx.capture.sqls).toHaveLength(0);
  });
});
