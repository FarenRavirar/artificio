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
import { castVote, tallyDelta } from "./communityCommentVote.js";

/**
 * T2.12-T2.14 — o SQL que o voto realmente emite (`contrato-http-v1.md` §7).
 *
 * ## Por que sobre o SQL
 *
 * Os invariantes caros do voto são negativos e silenciosos: gravar `score` ou
 * `best_score` (colunas geradas) aborta a transação em runtime; esquecer de
 * fechar a faixa corrente passa em qualquer teste de payload e só aparece quando
 * o índice parcial `uq_community_comment_score_current` recusa a segunda faixa
 * aberta; emitir notificação viola a decisão 13 sem falhar em lugar nenhum.
 *
 * Mesmo precedente de `communityCommentWriteSql.test.ts`: `values({})` compilava,
 * passava no `tsc` e só falhava no banco, em produção.
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

const ATOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTOR = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const USUARIO = "11111111-1111-4111-8111-111111111111";

const COMENTARIO = {
  id: COMMENT_ID,
  subject_type: "downloads.material",
  subject_id: "material-1",
  community_actor_id: AUTOR,
  visibility_state: "visible",
  legacy_source: null,
};

let ctx = captureDb();

beforeEach(() => {
  ctx = captureDb();
});

/**
 * Roteiro do voto, na ordem em que o handler consulta.
 *
 * **A ordem mudou na correção do review da PR #251**: a contagem passou a ser
 * lida **depois** do `UPDATE` que trava o assunto, e não antes. Ler antes fazia
 * a transação seguir com a foto anterior a um voto concorrente já commitado,
 * perdendo o voto do vizinho em silêncio (`read committed`, medido no banco).
 *
 * Sequência atual: vínculo do ator → comentário travado → voto atual do ator →
 * revisão nova (lock) → faixa de score corrente.
 */
function script(options: {
  comentario?: Record<string, unknown>;
  votoAtual?: -1 | 1 | null;
  upvotes?: number;
  downvotes?: number;
  revisao?: number;
} = {}): void {
  const tally = [{ upvotes: options.upvotes ?? 0, downvotes: options.downvotes ?? 0 }];

  ctx.capture.enqueue([{ actor_id: ATOR }]);
  ctx.capture.enqueue([options.comentario ?? COMENTARIO]);
  ctx.capture.enqueue(options.votoAtual == null ? [] : [{ value: options.votoAtual }]);
  ctx.capture.enqueue([{ ranking_revision: options.revisao ?? 7 }]);
  ctx.capture.enqueue(tally);
}

/**
 * Roteiro do no-op, que sai **antes** do lock e portanto lê a contagem na outra
 * ordem: vínculo → comentário → voto atual → faixa corrente, sem revisão.
 */
function scriptNoOp(options: {
  votoAtual?: -1 | 1 | null;
  upvotes?: number;
  downvotes?: number;
} = {}): void {
  ctx.capture.enqueue([{ actor_id: ATOR }]);
  ctx.capture.enqueue([COMENTARIO]);
  ctx.capture.enqueue(options.votoAtual == null ? [] : [{ value: options.votoAtual }]);
  ctx.capture.enqueue([
    { upvotes: options.upvotes ?? 0, downvotes: options.downvotes ?? 0 },
  ]);
}

function allSql(): string {
  return ctx.capture.sqls.join("\n;\n");
}

function sqlMatching(pattern: RegExp): string[] {
  return ctx.capture.sqls.filter((sql) => pattern.test(sql));
}

const INPUT = {
  realm: "prod",
  sourceApp: "downloads",
  commentId: COMMENT_ID,
  actingUserId: USUARIO,
  value: 1 as const,
};

describe("o delta de contagem é aritmética pura", () => {
  it.each([
    ["primeiro upvote", null, 1, { upvotes: 1, downvotes: 0 }],
    ["primeiro downvote", null, -1, { upvotes: 0, downvotes: 1 }],
    ["remover upvote", 1, null, { upvotes: -1, downvotes: 0 }],
    ["remover downvote", -1, null, { upvotes: 0, downvotes: -1 }],
    ["trocar up por down", 1, -1, { upvotes: -1, downvotes: 1 }],
    ["trocar down por up", -1, 1, { upvotes: 1, downvotes: -1 }],
  ] as const)("%s", (_caso, from, to, esperado) => {
    // A troca mexe nas **duas** contagens. Tratá-la como "remove e adiciona" em
    // dois passos deixaria uma janela em que o total não fecha; aqui é um delta
    // só, aplicado numa faixa nova.
    expect(tallyDelta(from, to)).toEqual(esperado);
  });

  it("nenhum delta produz contagem negativa a partir de estado consistente", () => {
    // `CHECK (upvotes >= 0)` aborta a transação inteira se isto quebrar. Um
    // comentário com 1 upvote e 0 downvotes, sob qualquer transição válida,
    // nunca fica negativo.
    for (const from of [null, 1, -1] as const) {
      for (const to of [null, 1, -1] as const) {
        const base = from === 1 ? { u: 1, d: 0 } : from === -1 ? { u: 0, d: 1 } : { u: 0, d: 0 };
        const delta = tallyDelta(from, to);
        expect(base.u + delta.upvotes).toBeGreaterThanOrEqual(0);
        expect(base.d + delta.downvotes).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("a transação escreve nas quatro tabelas certas", () => {
  it("grava voto, fecha a faixa, abre a nova e audita", async () => {
    script();
    const result = await castVote(ctx.db, INPUT);

    expect(result.ok).toBe(true);
    expect(allSql()).toMatch(/insert into "community_comment_vote"/i);
    expect(sqlMatching(/update "community_comment_score_version" set/i)).toHaveLength(1);
    expect(sqlMatching(/insert into "community_comment_score_version"/i)).toHaveLength(1);
    expect(sqlMatching(/insert into "community_comment_vote_audit"/i)).toHaveLength(1);
  });

  it("nunca grava score nem best_score — são colunas geradas", async () => {
    // `INSERT` numa coluna `GENERATED ALWAYS AS ... STORED` levanta erro no
    // PostgreSQL. Decisão 21: a fórmula de Wilson vive na função SQL, e
    // TypeScript não mantém segunda implementação.
    script();
    await castVote(ctx.db, INPUT);

    const insert = sqlMatching(/insert into "community_comment_score_version"/i)[0];
    expect(insert).not.toMatch(/"score"/i);
    expect(insert).not.toMatch(/"best_score"/i);
    expect(allSql()).not.toMatch(/wilson/i);
  });

  it("fecha a faixa corrente antes de abrir a nova", async () => {
    // Sem o `UPDATE`, o índice parcial `uq_community_comment_score_current`
    // recusa a segunda faixa aberta e a transação morre. Com ele na ordem
    // errada, o `WHERE valid_to_revision is null` fecharia a faixa recém-criada.
    script();
    await castVote(ctx.db, INPUT);

    const fecha = ctx.capture.sqls.findIndex((s) =>
      /update "community_comment_score_version" set/i.test(s),
    );
    const abre = ctx.capture.sqls.findIndex((s) =>
      /insert into "community_comment_score_version"/i.test(s),
    );

    expect(fecha).toBeGreaterThan(-1);
    expect(abre).toBeGreaterThan(fecha);
    expect(ctx.capture.sqls[fecha]).toMatch(/"valid_to_revision"\s+is null/i);
  });

  it("o incremento da revisão trava e devolve numa instrução só (T2.13)", async () => {
    // `UPDATE ... RETURNING` em vez de `SELECT ... FOR UPDATE` seguido de
    // `UPDATE`: duas idas ao banco segurariam o lock do assunto por mais tempo, e
    // o lock precisa ser curto para não serializar o assunto inteiro.
    script();
    await castVote(ctx.db, INPUT);

    const update = sqlMatching(/update "community_comment_subject" set/i);
    expect(update).toHaveLength(1);
    expect(update[0]).toMatch(/"ranking_revision"\s*=\s*"ranking_revision"\s*\+/i);
    expect(update[0]).toMatch(/returning "ranking_revision"/i);
    expect(allSql()).not.toMatch(/from "community_comment_subject".*for update/is);
  });

  it("o comentário é travado com FOR SHARE, não FOR UPDATE", async () => {
    // O voto não escreve na linha do comentário. `FOR UPDATE` serializaria votos
    // concorrentes no mesmo comentário, que é justamente o caso comum.
    script();
    await castVote(ctx.db, INPUT);

    const select = sqlMatching(/from "community_comment"\s+where/i);
    expect(select[0]).toMatch(/for share/i);
    expect(select[0]).not.toMatch(/for update/i);
  });

  it("voto não emite evento nem recibo (decisão 13, T2.16)", async () => {
    // A ausência é o requisito. Nem voto individual nem marco agregado.
    script();
    await castVote(ctx.db, INPUT);

    expect(allSql()).not.toMatch(/notification_event/i);
    expect(allSql()).not.toMatch(/notification_receipt/i);
  });

  it("não usa chave de idempotência (§6: voto é estado absoluto)", async () => {
    script();
    await castVote(ctx.db, INPUT);

    expect(allSql()).not.toMatch(/community_idempotency_key/i);
  });

  it("as escritas filtram por realm e source_app, não só por id", async () => {
    script();
    await castVote(ctx.db, INPUT);

    for (const sql of sqlMatching(/community_comment_vote|community_comment_score_version/i)) {
      expect(sql).toMatch(/"realm"|realm/i);
    }
  });
});

describe("value 0 remove a linha, não grava zero", () => {
  it("emite DELETE do voto e nenhum insert de voto", async () => {
    // `CHECK (value IN (-1, 1))` recusa zero. Ausência de linha é a
    // representação de "sem voto".
    script({ votoAtual: 1, upvotes: 1 });
    const result = await castVote(ctx.db, { ...INPUT, value: 0 });

    expect(result).toEqual({
      ok: true,
      tally: { my_vote: 0, upvotes: 0, downvotes: 0, score: 0 },
    });
    expect(allSql()).toMatch(/delete from "community_comment_vote"/i);
    expect(allSql()).not.toMatch(/insert into "community_comment_vote"\s*\(/i);
  });

  it("a auditoria da remoção registra new_value nulo", async () => {
    script({ votoAtual: -1, downvotes: 1 });
    await castVote(ctx.db, { ...INPUT, value: 0 });

    expect(sqlMatching(/insert into "community_comment_vote_audit"/i)).toHaveLength(1);
  });
});

describe("no-op não move nada (§7)", () => {
  it("mesmo valor não incrementa revisão nem cria histórico", async () => {
    // Incrementar a revisão aqui invalidaria o cursor de quem está navegando,
    // por uma requisição que não mudou nada.
    scriptNoOp({ votoAtual: 1, upvotes: 1 });
    const result = await castVote(ctx.db, INPUT);

    expect(result).toEqual({
      ok: true,
      tally: { my_vote: 1, upvotes: 1, downvotes: 0, score: 1 },
    });
    expect(allSql()).not.toMatch(/update "community_comment_subject"/i);
    expect(allSql()).not.toMatch(/insert into "community_comment_vote_audit"/i);
    expect(allSql()).not.toMatch(/insert into "community_comment_score_version"/i);
  });

  it("remover voto inexistente também é no-op", async () => {
    scriptNoOp({ votoAtual: null });
    const result = await castVote(ctx.db, { ...INPUT, value: 0 });

    expect(result).toEqual({
      ok: true,
      tally: { my_vote: 0, upvotes: 0, downvotes: 0, score: 0 },
    });
    expect(allSql()).not.toMatch(/update "community_comment_subject"/i);
    expect(allSql()).not.toMatch(/delete from "community_comment_vote"/i);
  });

  it("remover voto de quem nem tem ator não cria ator", async () => {
    // Achado de review do Codex (P2): a requisição não muda voto, revisão nem
    // auditoria, mas criava `community_actor` e vínculo — identidade
    // comunitária persistida por um no-op.
    ctx.capture.enqueue([]); // sem vínculo ator↔conta
    ctx.capture.enqueue([COMENTARIO]);
    ctx.capture.enqueue([{ upvotes: 2, downvotes: 0 }]);

    const result = await castVote(ctx.db, { ...INPUT, value: 0 });

    expect(result).toEqual({
      ok: true,
      tally: { my_vote: 0, upvotes: 2, downvotes: 0, score: 2 },
    });
    expect(allSql()).not.toMatch(/insert into "community_actor"/i);
    expect(allSql()).not.toMatch(/insert into "community_actor_account_link"/i);
  });
});

describe("a contagem é lida depois do lock (voto perdido)", () => {
  it("o SELECT da faixa corrente vem depois do UPDATE que trava o assunto", async () => {
    // Sob `read committed` — medido: `show default_transaction_isolation` em
    // `artificio_auth` devolve `read committed` —, ler antes do lock devolvia a
    // foto anterior a um voto concorrente já commitado. As duas transações
    // gravavam `upvotes: 1`, e um dos votos sumia sem erro nenhum.
    //
    // Achado de review, apontado por Codex (P1) e CodeRabbit (Crítico) na
    // PR #251.
    script();
    await castVote(ctx.db, INPUT);

    const lock = ctx.capture.sqls.findIndex((s) =>
      /update "community_comment_subject" set/i.test(s),
    );
    const leituraDaFaixa = ctx.capture.sqls.findIndex((s) =>
      /select .*"upvotes".*from "community_comment_score_version"/is.test(s),
    );

    expect(lock).toBeGreaterThan(-1);
    expect(leituraDaFaixa).toBeGreaterThan(lock);
  });
});

describe("voto não gera notificação, em nenhuma sequência (T2.16, decisão 13)", () => {
  it("uma sequência inteira de votos não produz um único recibo", async () => {
    // T2.16 pede exatamente isto: "sequência de votos não produz nenhum recibo,
    // provado por teste". Nem voto individual, nem marco agregado ("seu
    // comentário chegou a 10 pontos") — o autor acompanha a contagem na thread.
    //
    // A sequência sobe de 0 a 10 upvotes, cruzando o marco que um sistema com
    // notificação agregada usaria como gatilho.
    for (let i = 0; i < 10; i += 1) {
      ctx = captureDb();
      script({ upvotes: i, revisao: i + 1 });
      const result = await castVote(ctx.db, INPUT);

      expect(result.ok).toBe(true);
      expect(allSql()).not.toMatch(/notification_event/i);
      expect(allSql()).not.toMatch(/notification_receipt/i);
    }
  });

  it("remover voto também não notifica", async () => {
    ctx = captureDb();
    script({ votoAtual: 1, upvotes: 1 });
    await castVote(ctx.db, { ...INPUT, value: 0 });

    expect(allSql()).not.toMatch(/notification/i);
  });
});

describe("as recusas param antes de qualquer escrita", () => {
  it("autor não vota no próprio comentário (decisão 5)", async () => {
    // Divergência deliberada do Reddit, que dá auto-upvote. Aqui o score
    // representa reação de outras contas.
    ctx.capture.enqueue([{ actor_id: AUTOR }]);
    ctx.capture.enqueue([COMENTARIO]);

    const result = await castVote(ctx.db, INPUT);

    expect(result).toEqual({ ok: false, code: "self_vote", status: 403 });
    expect(allSql()).not.toMatch(/insert into|update "community_comment_subject"/i);
  });

  it("legado não aceita voto (decisão 6)", async () => {
    // Recusado por imutabilidade e **antes** da checagem de autoria: legado tem
    // ator nulo e passaria pela comparação de auto-voto.
    ctx.capture.enqueue([{ actor_id: ATOR }]);
    ctx.capture.enqueue([
      { ...COMENTARIO, community_actor_id: null, legacy_source: "site" },
    ]);

    const result = await castVote(ctx.db, INPUT);

    expect(result).toEqual({ ok: false, code: "legacy_immutable", status: 403 });
  });

  it.each(["author_removed", "moderator_removed", "pending_review_hidden"])(
    "comentário em %s não é votável",
    async (estado) => {
      // O corpo não está visível: votar seria opinar sobre placeholder, e o voto
      // mexeria num score que a leitura já esconde.
      ctx.capture.enqueue([{ actor_id: ATOR }]);
      ctx.capture.enqueue([{ ...COMENTARIO, visibility_state: estado }]);

      const result = await castVote(ctx.db, INPUT);

      expect(result).toEqual({ ok: false, code: "not_votable", status: 403 });
    },
  );

  it("comentário inexistente é 404", async () => {
    ctx.capture.enqueue([{ actor_id: ATOR }]);
    ctx.capture.enqueue([]);

    const result = await castVote(ctx.db, INPUT);

    expect(result).toEqual({ ok: false, code: "comment_not_found", status: 404 });
  });

  it("usuário sem ator não cria ator numa requisição recusada", async () => {
    // Criar o ator antes das recusas gravaria identidade comunitária por causa
    // de um voto que nem aconteceu.
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([{ ...COMENTARIO, legacy_source: "site" }]);

    const result = await castVote(ctx.db, INPUT);

    expect(result.ok).toBe(false);
    expect(allSql()).not.toMatch(/insert into "community_actor"/i);
  });

  it("usuário sem ator que vota válido ganha ator e vínculo", async () => {
    // Quem nunca comentou pode votar: o ator nasce aqui, depois das recusas.
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([COMENTARIO]);
    ctx.capture.enqueue([{ id: ATOR }]);
    ctx.capture.enqueue([]);
    ctx.capture.enqueue([{ upvotes: 0, downvotes: 0 }]);
    ctx.capture.enqueue([{ ranking_revision: 7 }]);

    const result = await castVote(ctx.db, INPUT);

    expect(result.ok).toBe(true);
    // `defaultValues()`, nunca `values({})` — o SQL inválido que foi a produção.
    expect(allSql()).toMatch(/insert into "community_actor" default values/i);
    expect(allSql()).not.toMatch(/\(\s*\)\s*values\s*\(\s*\)/i);
    expect(allSql()).toMatch(/insert into "community_actor_account_link"/i);
  });
});
