import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createComment, type CreateCommentInput } from "./communityCommentWrite.js";
import { readCommentTree } from "./communityCommentRead.js";
import {
  readModerationLog,
  readModerationQueue,
} from "./communityModerationQueue.js";
import type { Database } from "./db.js";

/**
 * Regressão da leitura da árvore **contra PostgreSQL real**.
 *
 * ## Por que este arquivo existe separado de `communityCommentReadSql.test.ts`
 *
 * Aquele arquivo compila a query com um `PostgresQueryCompiler` capturador e
 * casa o **texto** SQL: prova a forma da consulta (ordem entre irmãos, sort,
 * foto congelada) sem nunca enviá-la ao banco. Erro de inferência de tipo de
 * parâmetro é exatamente o que essa técnica não alcança — o SQL é
 * sintaticamente válido e o teste passa verde.
 *
 * Foi essa lacuna que deixou um `500` chegar em produção com a suíte inteira
 * verde: `readCommentTree` interpolava `revision` sem `::bigint`, e dentro da
 * condição de um LEFT JOIN o PostgreSQL não infere o tipo, respondendo
 * `could not determine data type of parameter $3`. Nenhum teste com banco real
 * chamava `readCommentTree` (medido: `readCommentTree` só aparecia no arquivo
 * capturador).
 *
 * **O bug só aparece com a conversa NÃO vazia** — com zero comentários
 * `readSubjectRevision` devolve `null` e a função retorna antes de montar a
 * query. Por isso o caso mínimo aqui é: criar um comentário, depois ler.
 *
 * Mesmo padrão de `communityWilson.test.ts` e
 * `notificationRecipientsIntegration.test.ts`: roda quando há banco
 * (`COMMUNITY_TEST_DATABASE_URL`) e se declara ausente onde não há.
 *
 * Para rodar: `COMMUNITY_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/accounts test`
 */

const databaseUrl = process.env.COMMUNITY_TEST_DATABASE_URL;

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;

const db = pool
  ? new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    })
  : undefined;

afterAll(async () => {
  await db?.destroy();
});

const REALM = "prod";
const SOURCE_APP = "site";
const SUBJECT_TYPE = "site.post";

async function insertUser(label: string): Promise<string> {
  const nonce = randomUUID();
  const row = await db!
    .insertInto("users")
    .values({
      google_sub: `read-integration-${label}-${nonce}`,
      email: `${label}-${nonce}@read-integration.test`,
      name: `Read Integration ${label}`,
      avatar: null,
      role: "user",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

function commentInput(
  actingUserId: string,
  ownerUserId: string,
  subjectId: string,
  parentId: string | null = null,
): CreateCommentInput {
  return {
    realm: REALM,
    source_app: SOURCE_APP,
    subject_type: SUBJECT_TYPE,
    subject_id: subjectId,
    canonicalPath: `/posts/${subjectId}`,
    ownerUserId,
    parentId,
    bodyMarkdown: `Comentário de leitura ${randomUUID()}`,
    actingUserId,
    idempotencyKey: `read-integration-${randomUUID()}`,
  };
}

async function create(input: CreateCommentInput): Promise<string> {
  const result = await createComment(db!, input);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(`createComment recusou: ${result.code}`);
  return result.comment.id;
}

describe.skipIf(!pool)("readCommentTree contra PostgreSQL real", () => {
  const sorts = ["best", "top", "new", "old"] as const;

  for (const sort of sorts) {
    it(`lê a árvore de uma conversa não vazia em sort=${sort}`, async () => {
      const publisher = await insertUser(`pub-${sort}`);
      const actor = await insertUser(`actor-${sort}`);
      const subjectId = randomUUID();

      const commentId = await create(
        commentInput(actor, publisher, subjectId),
      );

      const result = await readCommentTree(
        db!,
        {
          subject: {
            realm: REALM,
            sourceApp: SOURCE_APP,
            subjectType: SUBJECT_TYPE,
            subjectId,
          },
          sort,
        },
        100,
      );

      expect(result.snapshotRevision).not.toBeNull();
      expect(result.rows.map((row) => row.id)).toContain(commentId);
    });
  }

  it("lê resposta aninhada sem perder o pai", async () => {
    const publisher = await insertUser("pub-nested");
    const actor = await insertUser("actor-nested");
    const subjectId = randomUUID();

    const rootId = await create(commentInput(actor, publisher, subjectId));
    const replyId = await create(
      commentInput(publisher, publisher, subjectId, rootId),
    );

    const result = await readCommentTree(
      db!,
      {
        subject: {
          realm: REALM,
          sourceApp: SOURCE_APP,
          subjectType: SUBJECT_TYPE,
          subjectId,
        },
        sort: "best",
      },
      100,
    );

    const ids = result.rows.map((row) => row.id);
    expect(ids).toContain(rootId);
    expect(ids).toContain(replyId);
  });

  it("devolve revisão nula e nenhuma linha quando o assunto nunca recebeu comentário", async () => {
    // O caminho que funcionava mesmo com o bug — mantido para que uma correção
    // futura no cast não quebre o retorno antecipado de `revision === null`.
    const result = await readCommentTree(
      db!,
      {
        subject: {
          realm: REALM,
          sourceApp: SOURCE_APP,
          subjectType: SUBJECT_TYPE,
          subjectId: randomUUID(),
        },
        sort: "best",
      },
      100,
    );

    expect(result.snapshotRevision).toBeNull();
    expect(result.rows).toEqual([]);
  });
});

/**
 * Cursor das listagens de moderação — o **mesmo perfil de risco** da árvore.
 *
 * `(mc.opened_at, mc.id) < (${openedAt}, ${id}::uuid)` e o par equivalente do
 * log comparam tupla com parâmetro; `id` leva `::uuid`, `openedAt`/`occurredAt`
 * não levam cast. É o ramo que só executa a partir da **segunda página**, então
 * uma fila vazia (ou curta) nunca o exercita — foi exatamente assim que o `500`
 * da árvore chegou a produção.
 *
 * Medido antes de escrever: nenhum teste do repositório passava `cursor` para
 * `readModerationQueue`/`readModerationLog`, nem mesmo os capturadores de SQL.
 * Aqui o cursor é sempre preenchido, para que a query com a comparação de tupla
 * chegue de fato ao PostgreSQL.
 */
describe.skipIf(!pool)("cursor das listagens de moderação contra PostgreSQL real", () => {
  it("aceita cursor na fila sem erro de tipo de parâmetro", async () => {
    const items = await readModerationQueue(db!, {
      realm: REALM,
      sourceApp: SOURCE_APP,
      limit: 10,
      cursor: { openedAt: new Date(), id: randomUUID() },
    });

    // O conteúdo não importa — a base de teste pode não ter caso algum. O que
    // este teste prova é que a query COMPILA E EXECUTA no servidor.
    expect(Array.isArray(items)).toBe(true);
  });

  it("aceita cursor no log sem erro de tipo de parâmetro", async () => {
    const entries = await readModerationLog(
      db!,
      REALM,
      SOURCE_APP,
      10,
      { occurredAt: new Date(), id: randomUUID() },
    );

    expect(Array.isArray(entries)).toBe(true);
  });

  it("aceita filtro de prioridade combinado com cursor", async () => {
    const items = await readModerationQueue(db!, {
      realm: REALM,
      sourceApp: SOURCE_APP,
      status: "open",
      maxPriority: 3,
      limit: 10,
      cursor: { openedAt: new Date(), id: randomUUID() },
    });

    expect(Array.isArray(items)).toBe(true);
  });
});
