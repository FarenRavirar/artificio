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
import { readCommentTree } from "./communityCommentRead.js";

/**
 * T2.3b — as quatro ordenações, provadas sobre o SQL que vai ao banco.
 *
 * ## Por que sobre o SQL, e não sobre uma árvore semeada
 *
 * O aceite pede "nenhuma ordenação mistura níveis". Isso é propriedade da
 * **consulta**, não do dado: quem impede a mistura é `partition by c.parent_id`
 * no `row_number()` — irmãos competem entre si e com mais ninguém — somado ao
 * `order by sort_path` final, que devolve a árvore em ordem de leitura. Nenhuma
 * quantidade de comentários semeados prova isso melhor do que ler a cláusula;
 * uma árvore sem voto, aliás, **não prova nada**: os três comentários de
 * produção têm score 0 (`community_comment_vote` e
 * `community_comment_score_version` com zero linhas, medido em 2026-08-08),
 * empatam nos quatro sorts e caem todos no mesmo desempate.
 *
 * O precedente é `communityCommentWriteSql.test.ts`: `values({})` compilava,
 * passava no `tsc` e só falhava no banco. Aqui o risco é o simétrico — uma
 * cláusula trocada continua compilando e devolvendo linhas plausíveis, na ordem
 * errada.
 *
 * ## O que este arquivo NÃO cobre
 *
 * A execução da função Wilson em PostgreSQL, que é `communityWilson.test.ts` e
 * exige `COMMUNITY_TEST_DATABASE_URL`. Medido em 2026-08-09: nenhum container de
 * banco da VM expõe porta ao host (`docker ps --filter ancestor=postgres:16-alpine`
 * devolve `5432/tcp` sem mapeamento nos nove), e o Docker local está desligado
 * (`failed to connect to the docker API`). Provisionar PostgreSQL no CI é
 * pré-requisito de T8.1 e continua em aberto lá.
 */

/** Captura o SQL final — o compilador é o de Postgres, o driver só não conecta. */
function captureDb() {
  const sqls: string[] = [];

  const connection: DatabaseConnection = {
    executeQuery: async <R>(compiled: CompiledQuery): Promise<QueryResult<R>> => {
      sqls.push(compiled.sql);
      return { rows: [] };
    },
    streamQuery: async function* () {
      // Nunca chamado: a leitura usa `execute`, não `stream`. Existe para
      // satisfazer a interface.
    },
  };

  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
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

  return { db, sqls };
}

const SUBJECT = {
  realm: "prod",
  sourceApp: "downloads",
  subjectType: "downloads.material",
  subjectId: "material-1",
};

let capture = captureDb();

beforeEach(() => {
  capture = captureDb();
});

async function sqlFor(sort: "best" | "top" | "new" | "old"): Promise<string> {
  await readCommentTree(
    capture.db,
    { subject: SUBJECT, sort, snapshotRevision: 7, actingActorId: null },
    100,
  );
  // `snapshotRevision` dado de propósito: sem ele a função consultaria a revisão
  // antes, e a query capturada seria a do assunto, não a da árvore.
  //
  // Último SQL, não o primeiro: um caso que compara dois sorts chama esta função
  // duas vezes, e ler `sqls[0]` devolveria o SQL do primeiro nas duas asserções
  // — o teste passaria comparando `new` consigo mesmo.
  return capture.sqls.at(-1) ?? "";
}

describe("viewer_is_author (DEB-090-VIEWER-AUTHOR)", () => {
  it("deriva o booleano do ator do leitor, sem expor identificador", async () => {
    const sql = await sqlFor("best");

    // O campo sai da MESMA comparação que `communityCommentVote.ts:154` usa
    // para recusar `self_vote` — e é a única forma de a UI oferecer editar e
    // auto-retirar (§4) sem que §2 precise expor `community_actor_id`.
    expect(sql).toContain("as viewer_is_author");
    expect(sql).toMatch(/c\.community_actor_id\s*=\s*\$\d+/);

    // Booleano derivado, não identificador: o SQL não projeta o ator em si.
    expect(sql).not.toMatch(/c\.community_actor_id\s+as\s/);
  });

  it("protege contra null = null, que devolveria null em vez de false", async () => {
    const sql = await sqlFor("best");

    // Leitura anônima tem ator nulo e legado tem `community_actor_id` nulo. Sem
    // os dois guardas, a comparação daria `null` e o payload entregaria `false`
    // por acidente do coalesce, não por decisão.
    expect(sql).toContain("c.community_actor_id is not null");
    expect(sql).toMatch(/\$\d+::uuid is not null/);
  });

  it("é projetado até a seleção externa, não morre na CTE", async () => {
    const sql = await sqlFor("new");

    // A CTE calcula e o SELECT de fora precisa carregar: sem isto o campo
    // existiria no plano e nunca chegaria ao consumidor.
    expect(sql.match(/viewer_is_author/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("ordenação acontece entre irmãos, nunca entre níveis", () => {
  it.each(["best", "top", "new", "old"] as const)(
    "%s particiona por parent_id",
    async (sort) => {
      // A cláusula é o mecanismo inteiro: sem `partition by`, o `row_number()`
      // numeraria a tabela toda e um filho bem avaliado subiria acima de raízes.
      expect(await sqlFor(sort)).toMatch(/row_number\(\)\s+over\s*\(\s*partition by\s+"?c"?\."?parent_id"?/i);
    },
  );

  it.each(["best", "top", "new", "old"] as const)(
    "%s devolve a árvore em ordem de leitura, não na ordem do sort",
    async (sort) => {
      // `sort_path` é o caminho da raiz até o nó, com a posição de cada nível.
      // Ordenar a saída por ele é o que mantém filho logo abaixo do pai; ordenar
      // pelo critério do sort achataria a árvore.
      expect(await sqlFor(sort)).toMatch(/order by\s+sort_path/i);
    },
  );
});

describe("cada sort usa o critério do produto (decisões 7, 19)", () => {
  it("best ordena pelo Wilson da função PostgreSQL", async () => {
    // `best_score` é coluna gerada por `comment_wilson_reddit_80_v1` (T2.1c). A
    // fórmula não é reimplementada em TypeScript — `plan.md` §Árvore.
    const sql = await sqlFor("best");
    expect(sql).toMatch(/coalesce\("?s"?\."?best_score"?,\s*0\)\s+desc/i);
    expect(sql).not.toMatch(/coalesce\("?s"?\."?score"?,\s*0\)\s+desc/i);
  });

  it("top ordena por score líquido, não por Wilson", async () => {
    const sql = await sqlFor("top");
    expect(sql).toMatch(/coalesce\("?s"?\."?score"?,\s*0\)\s+desc/i);
    expect(sql).not.toMatch(/best_score/i);
  });

  it("new e old diferem na direção do tempo E do desempate", async () => {
    // `new` desempata por `id desc`, não `asc`. Não é assimetria acidental: no
    // sort "mais recentes primeiro", dois irmãos com `created_at` idêntico ao
    // microssegundo precisam sair na mesma direção do critério principal —
    // `id asc` ali colocaria o mais antigo dos dois na frente, contradizendo o
    // próprio sort. Os outros três ordenam ascendente por tempo e mantêm
    // `id asc`.
    expect(await sqlFor("new")).toMatch(/"?c"?\."?created_at"?\s+desc,\s*"?c"?\."?id"?\s+desc/i);
    expect(await sqlFor("old")).toMatch(/"?c"?\."?created_at"?\s+asc,\s*"?c"?\."?id"?\s+asc/i);
  });

  it.each(["best", "top", "new", "old"] as const)(
    "%s termina no desempate estável (created_at, id)",
    async (sort) => {
      // `spec.md` 8c: sem desempate determinístico, dois irmãos empatados trocam
      // de lugar entre a primeira página e a expansão — um duplica, o outro
      // some, e nenhum erro aparece. O que importa é que os dois campos estejam
      // lá, na ordem; a direção é do sort e está no teste acima.
      expect(await sqlFor(sort)).toMatch(
        /"?c"?\."?created_at"?\s+(asc|desc),\s*"?c"?\."?id"?\s+(asc|desc)/i,
      );
    },
  );

  it("o coalesce impede comentário sem faixa de score de abrir a conversa", async () => {
    // `NULLS FIRST` é o default do PostgreSQL em `desc`. Sem `coalesce`, quem
    // nunca recebeu voto — e portanto não tem linha em
    // `community_comment_score_version` — ficaria acima do mais bem avaliado no
    // sort padrão de abertura (`spec.md` 8c).
    expect(await sqlFor("best")).toContain("coalesce");
    expect(await sqlFor("top")).toContain("coalesce");
  });
});

describe("a foto congelada governa a consulta inteira", () => {
  it("comentário criado depois da revisão não entra", async () => {
    // Deixá-lo aparecer no meio de uma expansão empurraria os seguintes de
    // posição — a duplicação silenciosa que o cursor existe para impedir.
    expect(await sqlFor("best")).toMatch(/"?c"?\."?created_revision"?\s*<=/i);
  });

  it("o score lido é o da faixa que contém a revisão, não o atual", async () => {
    const sql = await sqlFor("best");
    expect(sql).toMatch(/"?s"?\."?valid_from_revision"?\s*<=/i);
    expect(sql).toMatch(/"?s"?\."?valid_to_revision"?\s+is null or\s+"?s"?\."?valid_to_revision"?\s*>/i);
  });
});
