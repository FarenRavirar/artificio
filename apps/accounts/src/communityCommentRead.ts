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
  // `legacy_content_html` NÃO entra aqui nem na projeção da CTE (achado de
  // review, PR #245). Nenhum consumidor o lê — `toTreeRow` monta o payload só
  // a partir de `body_markdown` —, então trazê-lo do banco significava
  // trafegar HTML de origem legada por dentro do processo sem que ninguém o
  // sanitizasse. Suporte a legado renderizável é T2.8, e entra pelo pipeline
  // de sanitização, não por um campo carregado de carona.
  visibility_state: string;
  edited_at: Date | null;
  created_at: Date;
  legacy_source: string | null;
  legacy_author_name: string | null;
  author_display_name: string | null;
  author_avatar_url: string | null;
  /** `users.role` do autor, quando há conta viva ligada ao ator. */
  author_role: string | null;
  /** `true` quando o autor é o publicador afirmado pelo domínio (§8). */
  author_is_content_author: boolean;
  upvotes: number | null;
  downvotes: number | null;
  score: number | null;
  my_vote: number | null;
  /** DEB-090-VIEWER-AUTHOR — o leitor é o autor desta fala. */
  viewer_is_author: boolean;
  sort_key: string;
}

/**
 * Selo do autor (requisito 11, `contrato-http-v1.md` §2/§8).
 *
 * **Valor de máquina, não texto de tela.** `admin` e `moderator` são o enum de
 * `users.role` (`migration_002:24`) — o papel global sai do `JOIN` com `users`,
 * nunca do payload. `content_author` é o "autor/publicador" que `spec.md:311`
 * classifica como papel **de domínio**, e vem de `community_comment_subject.
 * owner_user_id`, afirmado pelo backend do módulo por credencial de serviço: do
 * payload público qualquer um se declararia dono.
 *
 * A palavra é neutra de propósito. O mesmo selo serve post de blog, material do
 * `downloads`, mesa do `mesas` e verbete do `glossario`; o rótulo em português
 * ("autor do post", "autor do material") é escolha do frontend por `source_app`,
 * na Fase 4 — `AGENTS.md:85` reserva a linguagem pública para lá e mantém o
 * técnico aqui.
 *
 * `null` para usuário comum: requisito 11 manda **não** rotular quem não tem
 * papel, e um selo "user" acabaria renderizado como rótulo vazio.
 */
export type AuthorBadge = "admin" | "moderator" | "content_author";

/**
 * Nome neutro de quem não tem mais conta (requisito 7; decisão 53).
 *
 * A string está fixada em quatro pontos da spec — `spec.md:86`, `spec.md:712`,
 * decisão 53 e T2.9 — sempre nesta grafia. Ela é **materializada aqui**, no
 * backend, e não deixada para o frontend: `display_name: null` obrigaria cada
 * consumidor a inventar o próprio texto, e o primeiro que esquecesse renderizaria
 * comentário sem autor nenhum. `author.state` acompanha para quem quiser
 * traduzir ou estilizar sem depender de comparar string.
 */
export const DELETED_ACCOUNT_DISPLAY_NAME = "Conta excluída";

/**
 * Estado da identidade por trás do comentário, em valor de máquina.
 *
 * Existe pelo mesmo motivo de `badge` ser enum e não rótulo: o texto é escolha do
 * frontend (Fase 4), e comparar `display_name === "Conta excluída"` faria a
 * interface quebrar no dia em que a redação mudasse.
 *
 * - `active` — vínculo vivo, perfil real resolvido no mesmo `SELECT`.
 * - `deleted` — não há conta por trás do ator. Requisito 7b: a exclusão apaga a
 *   linha de `users`, e o `ON DELETE CASCADE` de
 *   `community_actor_account_link.user_id` leva o vínculo junto; o `LEFT JOIN`
 *   simplesmente não casa. **Retenção interna cai aqui também, de propósito**:
 *   T2.9 exige que a API pública não distinga conta excluída de conta em
 *   retenção, senão o payload viraria oráculo de "tem caso de moderação aberto".
 * - `legacy` — comentário importado, que nunca teve conta (decisão 6). O nome
 *   vem de `legacy_author_name` e a autoria é não verificada.
 */
export type AuthorState = "active" | "deleted" | "legacy";

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
  author: {
    display_name: string | null;
    avatar_url: string | null;
    badge: AuthorBadge | null;
    /** T2.9 — estado da identidade, em valor de máquina. */
    state: AuthorState;
  };
  upvotes: number | null;
  downvotes: number | null;
  score: number | null;
  my_vote: number | null;
  /**
   * DEB-090-VIEWER-AUTHOR — habilita editar/auto-retirar (§4) e esconder o voto
   * no próprio comentário (decisão 5) sem expor identidade: booleano derivado,
   * nunca identificador. `false` na leitura anônima e em todo legado.
   */
  viewer_is_author: boolean;
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
  /**
   * Posição total da última linha servida (`sort_key` do cursor). A query
   * retoma **estritamente depois** dela.
   *
   * Aplicado no banco, não em memória (achado de review, PR #245). A versão
   * anterior buscava sempre as mesmas ~1.200 primeiras linhas e recortava
   * depois: numa árvore de 3.000 comentários, a segunda página recortava o
   * mesmo bloco já servido e devolvia vazio — perda silenciosa, sem erro.
   */
  after?: string | null;
  /**
   * Ramo a expandir. Restringe a consulta à subárvore daquela raiz, incluindo
   * a própria raiz como âncora — sem ela os filhos chegariam sem pai nesta
   * resposta, que é o filho órfão que o aceite proíbe.
   */
  branchId?: string | null;
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
 * Chave de retomada do cursor: **posição total na ordem de leitura**, não chave
 * de ordenação local.
 *
 * ## Por que não a chave de ordenação (achado de review, PR #245)
 *
 * A primeira versão serializava o critério do sort (`best_score|created_at|id`)
 * e o handler retomava com `sort_key > after`. Três defeitos, todos reais:
 *
 * 1. **Direção invertida em três dos quatro sorts.** `best`, `top` e `new`
 *    ordenam `DESC`; `> after` avança na direção **crescente**. Retomar depois
 *    de uma raiz de score alto devolvia justamente as de score maior — as já
 *    servidas. Duplicação garantida, e `old` funcionava só por coincidência.
 * 2. **Chave local comparada globalmente.** `row_number()` particionado por
 *    `parent_id` ordena entre irmãos; o handler comparava raízes de ramos
 *    diferentes. Em `best`/`top` o score de duas raízes não diz nada sobre a
 *    posição relativa delas na árvore montada.
 * 3. **Sem monotonicidade não há retomada correta possível** — nenhum ajuste no
 *    operador de comparação conserta uma chave que não é monotônica na ordem
 *    servida.
 *
 * ## O que é agora
 *
 * `sort_path` é o caminho materializado de `row_number()`s (`{2,5,1}` = segunda
 * raiz, quinto filho dela, primeiro neto). Ele **já é** a ordem de leitura: o
 * `ORDER BY sort_path` do final da query é o que produz a árvore. Serializá-lo
 * em segmentos de largura fixa dá uma chave textual cuja ordem lexicográfica
 * coincide com a ordem servida, em **qualquer** sort — porque a direção do sort
 * já foi absorvida pelo `row_number()`.
 *
 * Com isso `> after` é sempre "depois na ordem que o cliente viu", e a mesma
 * comparação vale para os quatro sorts, sem inversão nem caso especial.
 *
 * Largura de 9 dígitos com zero à esquerda: um assunto com mais de 10^9 irmãos
 * no mesmo nível quebraria a ordenação lexicográfica, o que está muitas ordens
 * de grandeza acima do teto de 1.000 por leitura e do que o produto comporta.
 */
const SORT_POSITION_EXPRESSION = sql<string>`(
  select string_agg(lpad(segment::text, 9, '0'), '.' order by ordinality)
  from unnest(sort_path) with ordinality as t(segment, ordinality)
)`;

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
  { subject, sort, snapshotRevision, actingActorId, after, branchId }: ReadTreeOptions,
  fetchLimit: number,
): Promise<ReadTreeResult> {
  const revision =
    snapshotRevision ?? (await readSubjectRevision(db, subject));

  if (revision === null) {
    return { snapshotRevision: null, rows: [] };
  }

  const order = siblingOrder(sort);

  // `actingActorId` entra como parâmetro sempre, mesmo nulo: montar o SQL
  // condicionalmente daria dois planos de query para manter, e o `LEFT JOIN`
  // com ator nulo simplesmente não casa linha nenhuma.
  const actorParam = actingActorId ?? null;
  const afterParam = after ?? null;
  const branchParam = branchId ?? null;

  const query = sql<CommentQueryRow>`
    with recursive scored as (
      select
        c.id,
        c.parent_id,
        c.root_id,
        c.depth,
        c.body_markdown,
        c.visibility_state,
        c.edited_at,
        c.created_at,
        c.legacy_source,
        c.legacy_author_name,
        u.name as author_display_name,
        u.avatar as author_avatar_url,
        u.role as author_role,
        -- Autor do conteudo: a conta do autor e o publicador que o dominio
        -- afirmou (secao 8). Compara contra owner_user_id do assunto, nao contra
        -- campo do comentario — o dono muda com o tempo (post transferido, conta
        -- vinculada depois) e o selo reflete o estado atual, nao o de quando o
        -- comentario nasceu.
        --
        -- Usa l.user_id, nao c.community_actor_id: o ator e opaco e sobrevive a
        -- exclusao da conta; sem vinculo vivo nao ha a quem atribuir o selo. O
        -- is not null fecha o assunto sem dono, em que null = null daria null e
        -- nao false.
        (subj.owner_user_id is not null and l.user_id = subj.owner_user_id)
          as author_is_content_author,
        s.upvotes,
        s.downvotes,
        s.score,
        v.value as my_vote,
        -- DEB-090-VIEWER-AUTHOR: quem le e o autor desta fala?
        --
        -- Sem isto o consumidor nao tem como oferecer editar/auto-retirar (§4,
        -- acoes so do autor) nem esconder o voto no proprio comentario (decisao
        -- 5): §2 proibe expor user_id cru e community_actor_id, entao a UI
        -- ficava sem qualquer forma de saber. O resultado media era botao que
        -- devolve 403 para quase todo mundo, ou nenhum botao — foi o segundo,
        -- e o autor nao conseguia corrigir a propria fala pela interface.
        --
        -- Booleano derivado, nao identificador: responde "e seu?" sem revelar
        -- de quem e quando nao for, que e exatamente o que §2 protege. O dado
        -- ja estava na query (c.community_actor_id contra o ator do leitor) —
        -- e a mesma comparacao que communityCommentVote.ts:154 faz para recusar
        -- self_vote, agora visivel para quem desenha a tela.
        --
        -- is not null nos dois lados: leitura anonima tem ator nulo e legado
        -- tem community_actor_id nulo; sem o guarda, null = null daria null e
        -- o coalesce final entregaria false por acidente, nao por decisao.
        (c.community_actor_id is not null
          and ${actorParam}::uuid is not null
          and c.community_actor_id = ${actorParam}::uuid) as viewer_is_author,
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
      -- O assunto entra no mesmo SELECT para o selo de autor do conteudo. Uma
      -- segunda consulta leria o dono fora da mesma foto da arvore, e o join e
      -- por chave primaria: uma linha, sem custo de fan-out.
      left join community_comment_subject subj
        on subj.realm = c.realm
        and subj.source_app = c.source_app
        and subj.subject_type = c.subject_type
        and subj.subject_id = c.subject_id
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
      -- Ancora da recursao. Sem cursor de ramo, sao as raizes do assunto; com
      -- branchId, e a propria raiz daquele ramo. Ancorar no ramo e o que mantem
      -- a expansao restrita a subarvore — antes disso a query trazia a arvore
      -- inteira e o recorte acontecia em memoria.
      select
        scored.*,
        array[scored.sibling_rank] as sort_path
      from scored
      where case
        when ${branchParam}::uuid is null then scored.parent_id is null
        else scored.id = ${branchParam}::uuid
      end

      union all

      select
        child.*,
        parent.sort_path || child.sibling_rank
      from scored child
      join tree parent on child.parent_id = parent.id
    ),
    positioned as (
      select tree.*, ${SORT_POSITION_EXPRESSION} as sort_key
      from tree
    )
    select
      id,
      parent_id,
      root_id,
      depth,
      body_markdown,
      visibility_state,
      edited_at,
      created_at,
      legacy_source,
      legacy_author_name,
      author_display_name,
      author_avatar_url,
      author_role,
      author_is_content_author,
      upvotes,
      downvotes,
      score,
      my_vote,
      viewer_is_author,
      sort_key
    from positioned
    -- Retomada estritamente depois da ultima posicao servida. sort_key e a
    -- posicao total na ordem de leitura, entao > vale igual nos quatro sorts —
    -- a direcao de cada um ja foi absorvida pelo row_number().
    --
    -- A raiz do ramo escapa do filtro de proposito: numa expansao ela ja foi
    -- servida antes e ficaria para tras do cursor, mas precisa voltar como
    -- ancora para os filhos terem onde pendurar. Chega com o mesmo id, entao o
    -- cliente a reconhece e nao duplica.
    where ${afterParam}::text is null
       or sort_key > ${afterParam}::text
       or (${branchParam}::uuid is not null and id = ${branchParam}::uuid)
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
 * Selo do autor, por precedência (T2.6, requisito 11).
 *
 * `admin` > `moderator` > `content_author`, e `null` para o resto. A ordem vem
 * de `spec.md:311`: papel de domínio — "autor/publicador" — **nunca é promovido
 * a papel global**, então quando os dois coexistem quem aparece é o global, que
 * é o que o `accounts.` conhece e o que descreve autoridade sobre a conversa.
 * Um campo só, porque §2 define `badge` singular.
 *
 * Legado nunca recebe selo, e a checagem vem antes de tudo: `spec.md:249`
 * ("nenhum badge de autor em post") e `15b` ("badge só quando há conta real por
 * trás"). Comentário importado tem `legacy_author_name` e nenhuma conta — dar
 * selo a ele afirmaria uma identidade que ninguém verificou.
 *
 * `user` vira `null` de propósito: requisito 11 manda não rotular usuário
 * comum.
 */
/**
 * Identidade pública do autor, resolvida no mesmo `SELECT` (T2.9, requisitos 7,
 * 7a-7b; decisão 53).
 *
 * ## Três estados, uma consulta
 *
 * Nenhuma segunda chamada e nenhuma rota em lote: o `JOIN` de
 * `community_comment` → `community_actor_account_link` → `users` já traz tudo, e
 * é o que o requisito 7 exige ("comentários e usuários vivem no mesmo banco").
 *
 * ## Por que ausência de vínculo é `deleted`, e não erro
 *
 * `community_actor_account_link.user_id` tem `ON DELETE CASCADE` para `users`
 * (`migration_006:50`), e `deleteUser` faz `DELETE` físico (`users.ts:87`). Logo
 * conta excluída **apaga o vínculo**, o `LEFT JOIN` não casa, e `u.name` chega
 * nulo. O ator (`community_actor`) sobrevive, porque é ele que sustenta o
 * comentário e o voto sem FK nominal (requisito 7a).
 *
 * Antes desta task o nulo virava `display_name: null`, e cada consumidor teria de
 * inventar o próprio texto — o primeiro que esquecesse renderizaria comentário
 * sem autor. Requisito 7 pede **nome neutro**, não ausência de nome.
 *
 * ## O que a API pública deliberadamente NÃO distingue
 *
 * Conta excluída, conta em retenção interna (`retention_until` no futuro) e
 * vínculo já expurgado saem **iguais**: `deleted`, avatar nulo, sem badge.
 * Distingui-los diria ao público que aquele autor tem caso de moderação aberto —
 * o oráculo que T2.9 fecha ao exigir que "a API pública nunca distinga retenção
 * interna". A moderação enxerga a diferença por outra superfície (T2.19), nunca
 * por esta.
 *
 * Isso vale **sem código extra** aqui: `retention_until` e `legal_hold` só
 * existem na linha de vínculo, e a leitura pública nem os seleciona. A ausência
 * do campo no `SELECT` é o mecanismo, e o teste de payload afirma essa ausência.
 */
function authorIdentity(row: CommentQueryRow): PublicComment["author"] {
  // Legado primeiro: ele tem `legacy_author_name` e nunca teve conta, então cair
  // na checagem de vínculo o classificaria como `deleted` — que é falso e
  // sugeriria que alguém apagou a conta de um comentário de 2019.
  if (row.legacy_source) {
    return {
      display_name: row.legacy_author_name,
      avatar_url: null,
      badge: null,
      state: "legacy",
    };
  }

  // Sem nome resolvido não há conta viva por trás do ator. Testa `display_name`
  // e não `avatar_url` porque `users.avatar` é legitimamente nulo em conta ativa
  // sem foto — usá-lo marcaria como excluída uma conta que existe.
  if (row.author_display_name === null) {
    return {
      display_name: DELETED_ACCOUNT_DISPLAY_NAME,
      // Avatar nulo é requisito 7, não consequência: mesmo que a coluna
      // guardasse a URL antiga, ela não sairia daqui.
      avatar_url: null,
      // Sem badge: o selo afirma autoridade de uma conta que não existe mais, e
      // `authorBadge` já devolveria nulo por não haver `author_role`. Explícito
      // para que a regra não dependa de um nulo vindo de outro lugar.
      badge: null,
      state: "deleted",
    };
  }

  return {
    display_name: row.author_display_name,
    avatar_url: row.author_avatar_url,
    badge: authorBadge(row),
    state: "active",
  };
}

function authorBadge(row: CommentQueryRow): AuthorBadge | null {
  if (row.legacy_source) return null;
  if (row.author_role === "admin") return "admin";
  if (row.author_role === "moderator") return "moderator";
  return row.author_is_content_author ? "content_author" : null;
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
    author: authorIdentity(row),
    upvotes: hidden ? null : (row.upvotes ?? 0),
    downvotes: hidden ? null : (row.downvotes ?? 0),
    score: hidden ? null : (row.score ?? 0),
    my_vote: row.my_vote ?? null,
    // Sem `hidden ?`, ao contrário de placar e corpo: saber que a fala oculta é
    // sua é o que permite a UI mostrar "seu comentário foi retirado" em vez de
    // um placeholder anônimo, e o autor precisa disso justamente quando o
    // conteúdo sumiu. Não vaza nada — para terceiro continua `false`.
    viewer_is_author: row.viewer_is_author ?? false,
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
