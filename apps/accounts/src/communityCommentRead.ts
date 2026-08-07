import type { Kysely } from "kysely";
import { sql } from "kysely";
import type { CommentSort } from "@artificio/comments";
import type { Database } from "./db.js";

/**
 * T2.3 — leitura em árvore de comentários (requisito 6; decisões 3, 8).
 *
 * ## Divisão de responsabilidade com `@artificio/comments`
 *
 * O pacote compartilhado decide **onde cortar** (`assembleTree`) e **como o
 * cursor viaja** (`treeCursor`); os dois são lógica pura, sem banco, e é por
 * isso que o aceite de 1.500 comentários roda em teste sem PostgreSQL. Este
 * módulo faz a outra metade: buscar as linhas do assunto **já ordenadas na
 * ordem de leitura da árvore** e traduzir cada linha no objeto público de
 * `contrato-http-v1.md` §2.
 *
 * ## Por que uma recursiva e não `ORDER BY` plano
 *
 * A ordenação é **entre irmãos, nunca entre níveis** (`spec.md` 8c). Um
 * `ORDER BY best_score DESC` sobre a tabela inteira misturaria uma resposta de
 * `depth=3` bem votada à frente de raízes — a árvore deixaria de ser árvore.
 * A CTE recursiva ordena dentro de cada conjunto de irmãos e concatena o
 * resultado num caminho materializado (`sort_path`), de modo que a ordem final
 * é a ordem de leitura: pai sempre antes dos descendentes, irmãos entre si pelo
 * sort pedido.
 *
 * Pai antes de descendente não é estética: `assembleTree` trunca um ramo gigante
 * pelo prefixo dessa ordem, e só um prefixo com essa propriedade é garantidamente
 * uma subárvore fechada no topo — ou seja, sem filho órfão.
 *
 * ## Score da revisão congelada, não o corrente
 *
 * `spec.md` 8d: a posição fica congelada na `snapshot_revision` da primeira
 * leitura. Por isso o join de score procura a faixa de
 * `community_comment_score_version` que **contém** aquela revisão
 * (`valid_from_revision <= rev AND (valid_to_revision IS NULL OR
 * valid_to_revision > rev)`), não a faixa corrente. Ler a corrente faria a
 * ordenação mudar entre a primeira página e a expansão do `more` — que é
 * exatamente como se duplica ou se perde item sem ninguém notar.
 *
 * Contagem exibida e `my_vote` podem vir do estado atual (o mesmo 8d permite);
 * só a **posição** é congelada. Aqui o score da revisão serve à ordenação e ao
 * payload; a divergência com o voto que acabou de chegar é aceita por decisão.
 */

/** Comentário sem score/voto/autor — o que a CTE devolve. */
interface CommentQueryRow {
  id: string;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string | null;
  legacy_content_html: string | null;
  visibility_state: string;
  edited_at: Date | null;
  created_at: Date;
  legacy_source: string | null;
  legacy_author_name: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  upvotes: number | null;
  downvotes: number | null;
  score: number | null;
  my_vote: number | null;
  sort_key: string;
}

/** Objeto público do `contrato-http-v1.md` §2. */
export interface PublicComment {
  id: string;
  parent_id: string | null;
  root_id: string;
  depth: number;
  body_markdown: string | null;
  created_at: string;
  edited_at: string | null;
  state: PublicCommentState;
  author: { display_name: string | null; avatar_url: string | null; badge: null };
  upvotes: number | null;
  downvotes: number | null;
  score: number | null;
  my_vote: number | null;
  legacy: { source: string; author_name: string } | null;
}

/**
 * Estado público. O banco distingue `author_removed` de `moderator_removed`
 * (`migration_006`), mas o payload público **não**: quem removeu é dado de
 * moderação, e expor "o autor apagou" versus "um moderador apagou" entrega ao
 * leitor um julgamento que `contrato-http-v1.md` §2 não autoriza. Os dois
 * colapsam em `removed`.
 */
export type PublicCommentState = "visible" | "removed" | "pending_review_hidden";

export interface SubjectRef {
  realm: string;
  sourceApp: string;
  subjectType: string;
  subjectId: string;
}

export interface ReadTreeOptions {
  subject: SubjectRef;
  sort: CommentSort;
  /**
   * Revisão a congelar. `undefined` na primeira leitura — a revisão corrente do
   * assunto é lida e devolvida em `snapshotRevision`.
   */
  snapshotRevision?: number;
  /** Ator do leitor, para `my_vote`. Ausente em leitura pública. */
  actingActorId?: string | null;
}

export interface ReadTreeResult {
  /** `null` quando o assunto nunca recebeu comentário. */
  snapshotRevision: number | null;
  rows: TreeRow[];
}

/** Linha pronta para `assembleTree` mais o payload público correspondente. */
export interface TreeRow {
  id: string;
  parent_id: string | null;
  depth: number;
  size_bytes: number;
  sort_key: string;
  comment: PublicComment;
}

/**
 * Expressão de ordenação entre irmãos, por sort.
 *
 * O desempate é sempre `(created_at, id)` (`spec.md` 8c): sem ele, dois irmãos
 * com o mesmo score trocariam de lugar entre a primeira página e a expansão,
 * duplicando um e sumindo com o outro. `id` é UUID v4 e fecha o desempate
 * mesmo com `created_at` idêntico ao microssegundo.
 *
 * `best` usa `best_score` — a coluna gerada pela função PostgreSQL
 * `comment_wilson_reddit_80_v1` (T2.1c). A fórmula **não** é reimplementada em
 * TypeScript, por `plan.md` §Árvore: "PostgreSQL calcula; TypeScript orquestra".
 */
function siblingOrder(sort: CommentSort) {
  switch (sort) {
    case "best":
      return sql`coalesce(s.best_score, 0) desc, c.created_at asc, c.id asc`;
    case "top":
      return sql`coalesce(s.score, 0) desc, c.created_at asc, c.id asc`;
    case "new":
      return sql`c.created_at desc, c.id desc`;
    case "old":
      return sql`c.created_at asc, c.id asc`;
  }
}

/**
 * Chave de ordenação serializada, opaca para quem lê o cursor.
 *
 * Vai no `after` do cursor e é o ponto de retomada da expansão. Precisa conter
 * o critério **e** o desempate, na mesma ordem do `ORDER BY`; um `after` só com
 * o score não distingue dois irmãos empatados e a retomada erraria a posição.
 */
function sortKeyExpression(sort: CommentSort) {
  switch (sort) {
    case "best":
      return sql<string>`concat_ws(
        '|',
        to_char(coalesce(s.best_score, 0), 'FM0.999999999999'),
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        c.id::text
      )`;
    case "top":
      return sql<string>`concat_ws(
        '|',
        lpad((coalesce(s.score, 0) + 2147483648)::text, 10, '0'),
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        c.id::text
      )`;
    case "new":
    case "old":
      return sql<string>`concat_ws(
        '|',
        to_char(c.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        c.id::text
      )`;
  }
}

/**
 * Lê a revisão corrente do assunto.
 *
 * `null` significa assunto sem registro — nunca comentado. A leitura devolve
 * árvore vazia nesse caso, não 404: um assunto comentável que ainda não tem
 * comentário é estado normal, e 404 faria o consumidor tratar "ninguém comentou"
 * como "esse conteúdo não existe".
 */
export async function readSubjectRevision(
  db: Kysely<Database>,
  subject: SubjectRef,
): Promise<number | null> {
  const row = await db
    .selectFrom("community_comment_subject")
    .select("ranking_revision")
    .where("realm", "=", subject.realm)
    .where("source_app", "=", subject.sourceApp)
    .where("subject_type", "=", subject.subjectType)
    .where("subject_id", "=", subject.subjectId)
    .executeTakeFirst();

  return row ? Number(row.ranking_revision) : null;
}

/**
 * Busca a árvore do assunto na revisão dada, em ordem de leitura.
 *
 * O `limit` é o teto **bruto** da consulta, não o teto do payload: quem decide o
 * que entra é `assembleTree`. Buscar um pouco além do teto é o que permite
 * saber que existe resto — e portanto emitir `more` com contagem, em vez de
 * devolver uma árvore truncada sem avisar.
 */
export async function readCommentTree(
  db: Kysely<Database>,
  { subject, sort, snapshotRevision, actingActorId }: ReadTreeOptions,
  fetchLimit: number,
): Promise<ReadTreeResult> {
  const revision =
    snapshotRevision ?? (await readSubjectRevision(db, subject));

  if (revision === null) {
    return { snapshotRevision: null, rows: [] };
  }

  const order = siblingOrder(sort);
  const sortKey = sortKeyExpression(sort);

  // `actingActorId` entra como parâmetro sempre, mesmo nulo: montar o SQL
  // condicionalmente daria dois planos de query para manter, e o `LEFT JOIN`
  // com ator nulo simplesmente não casa linha nenhuma.
  const actorParam = actingActorId ?? null;

  const query = sql<CommentQueryRow>`
    with recursive scored as (
      select
        c.id,
        c.parent_id,
        c.root_id,
        c.depth,
        c.body_markdown,
        c.legacy_content_html,
        c.visibility_state,
        c.edited_at,
        c.created_at,
        c.legacy_source,
        c.legacy_author_name,
        u.name as author_display_name,
        u.avatar as author_avatar_url,
        s.upvotes,
        s.downvotes,
        s.score,
        v.value as my_vote,
        ${sortKey} as sort_key,
        row_number() over (
          partition by c.parent_id
          order by ${order}
        ) as sibling_rank
      from community_comment c
      left join community_comment_score_version s
        on s.realm = c.realm
        and s.source_app = c.source_app
        and s.comment_id = c.id
        and s.valid_from_revision <= ${revision}
        and (s.valid_to_revision is null or s.valid_to_revision > ${revision})
      left join community_actor_account_link l
        on l.actor_id = c.community_actor_id
      left join users u
        on u.id = l.user_id
      left join community_comment_vote v
        on v.realm = c.realm
        and v.source_app = c.source_app
        and v.comment_id = c.id
        and v.community_actor_id = ${actorParam}::uuid
      where c.realm = ${subject.realm}
        and c.source_app = ${subject.sourceApp}
        and c.subject_type = ${subject.subjectType}
        and c.subject_id = ${subject.subjectId}
        -- Comentário criado depois da revisão congelada não entra: ele não
        -- existia na foto que esta navegação está percorrendo, e deixá-lo
        -- aparecer no meio de uma expansão empurraria os seguintes de posição.
        and c.created_revision <= ${revision}
    ),
    tree as (
      select
        scored.*,
        array[scored.sibling_rank] as sort_path
      from scored
      where scored.parent_id is null

      union all

      select
        child.*,
        parent.sort_path || child.sibling_rank
      from scored child
      join tree parent on child.parent_id = parent.id
    )
    select
      id,
      parent_id,
      root_id,
      depth,
      body_markdown,
      legacy_content_html,
      visibility_state,
      edited_at,
      created_at,
      legacy_source,
      legacy_author_name,
      author_display_name,
      author_avatar_url,
      upvotes,
      downvotes,
      score,
      my_vote,
      sort_key
    from tree
    order by sort_path
    limit ${fetchLimit}
  `;

  const result = await query.execute(db);

  return {
    snapshotRevision: revision,
    rows: result.rows.map((row) => toTreeRow(row)),
  };
}

/**
 * Colapsa o estado do banco no estado público.
 *
 * `author_removed` e `moderator_removed` viram o mesmo `removed` — ver o
 * comentário de `PublicCommentState`.
 */
function publicState(visibilityState: string): PublicCommentState {
  if (visibilityState === "pending_review_hidden") return "pending_review_hidden";
  if (visibilityState === "visible") return "visible";
  return "removed";
}

/**
 * Traduz a linha crua no objeto público.
 *
 * Tombstone e conteúdo sob revisão saem com corpo, contagens e score **nulos**
 * (decisões 34, 46; `contrato-http-v1.md` §2), mas mantêm posição, `depth` e
 * descendentes — a conversa não perde o encadeamento porque um nó foi retirado.
 * Nulo e não string vazia: vazio é um corpo que existe e está em branco, nulo
 * diz que não há corpo a mostrar.
 */
function toTreeRow(row: CommentQueryRow): TreeRow {
  const state = publicState(row.visibility_state);
  const hidden = state !== "visible";

  const comment: PublicComment = {
    id: row.id,
    parent_id: row.parent_id,
    root_id: row.root_id,
    depth: row.depth,
    body_markdown: hidden ? null : row.body_markdown,
    created_at: toIso(row.created_at),
    edited_at: row.edited_at ? toIso(row.edited_at) : null,
    state,
    author: {
      // Legado tem `legacy_author_name` e nenhuma conta ligada; o nome exibido
      // vem de lá. Autoria não verificada é sinalizada por `legacy`, não por
      // ausência de nome.
      display_name: row.legacy_source ? row.legacy_author_name : row.author_display_name,
      avatar_url: row.legacy_source ? null : row.author_avatar_url,
      // T2.6 calcula o badge a partir do que o backend do domínio afirma
      // (`contrato-http-v1.md` §8). A leitura não o inventa: `null` aqui é
      // "esta task não decide badge", não "este autor não tem badge".
      badge: null,
    },
    upvotes: hidden ? null : (row.upvotes ?? 0),
    downvotes: hidden ? null : (row.downvotes ?? 0),
    score: hidden ? null : (row.score ?? 0),
    my_vote: row.my_vote ?? null,
    legacy:
      row.legacy_source && row.legacy_author_name
        ? { source: row.legacy_source, author_name: row.legacy_author_name }
        : null,
  };

  return {
    id: row.id,
    parent_id: row.parent_id,
    depth: row.depth,
    size_bytes: estimateSizeBytes(comment),
    sort_key: row.sort_key,
    comment,
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Tamanho aproximado da linha no payload, para o teto de 2 MiB.
 *
 * Medido sobre o JSON real do objeto público, não sobre o `body_markdown`
 * isolado: o teto existe para limitar o que sai pela rede e a memória que o
 * `accounts.` monta (decisão 3 — ele também sustenta o SSO), e num comentário
 * curto os campos estruturais pesam mais que o corpo.
 *
 * `Buffer.byteLength` e não `.length` porque o corpo é UTF-8: acento, emoji e
 * CJK ocupam 2-4 bytes, e contar caracteres subestimaria o payload em
 * português — justamente o idioma do produto.
 */
function estimateSizeBytes(comment: PublicComment): number {
  return Buffer.byteLength(JSON.stringify(comment), "utf8");
}
