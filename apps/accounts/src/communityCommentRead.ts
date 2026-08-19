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
  /**
   * Corpo do comentário importado (`community_comment_body_kind_check`: nativo
   * usa `body_markdown`, legado usa este, nunca os dois).
   *
   * **Reintroduzido depois de medir o efeito de tê-lo excluído.** A revisão da
   * PR #245 tirou o campo da CTE com o argumento de que "nenhum consumidor o lê"
   * e que trazê-lo trafegaria HTML não sanitizado pelo processo. A primeira
   * metade virou profecia autorrealizável — sem o campo na projeção,
   * `toTreeRow` montava o corpo só de `body_markdown`, que o import deixa NULO
   * por obrigação do `CHECK`, e todo comentário importado chegava à tela como
   * "Conteúdo indisponível." (medido nos 3 comentários já importados em beta).
   *
   * A segunda metade não se sustenta na medição: o conteúdo **já entra
   * sanitizado**. O exportador do módulo de origem aplica `sanitizeUserMarkdown`
   * antes de exportar (`exportLegacyComments.ts:132`) e declara o par
   * política/versão que viaja até `legacy_sanitizer_policy`/`_version` — é o
   * desenho que `tasks.md:867` fixa de propósito, para **não** arrastar
   * `@artificio/content-editor` para a imagem do `accounts.` (caso E016/E017,
   * SSO fora por 5h). O nome da coluna é herança do schema genérico: no
   * `downloads` a origem é `download_comment.body`, markdown que o componente
   * antigo já renderizava com `MarkdownContent` (`CommentSection.tsx:96`).
   *
   * `spec.md:444` fecha a questão — legado tem "defesa adicional na saída sem
   * regravar", e essa defesa é o `DOMPurify.sanitize()` com que `renderMarkdown`
   * termina (`ContentEditor.tsx:21`), no consumidor que renderiza. Reter o campo
   * aqui não protegia ninguém; só apagava o acervo.
   */
  legacy_content_html: string | null;
  /**
   * Sob qual regra o corpo legado foi limpo, e em que versão dela.
   *
   * Não é metadado decorativo: **a coluna guarda dois formatos diferentes**, e
   * só a política os distingue. O `downloads` exporta markdown
   * (`content-editor/sanitizeUserMarkdown`, `exportLegacyComments.ts:57`); o
   * `site` importará HTML (`site-comment-html`, `sanitize.ts:369`). Sem a
   * política no payload, o renderizador teria de adivinhar — e adivinhar errado
   * significa exibir tag crua como texto, ou pior, tratar HTML como markdown.
   */
  legacy_sanitizer_policy: string | null;
  legacy_sanitizer_version: number | null;
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
  /** A retirada foi de moderação, e não auto-retirada — ver o SELECT. */
  removed_by_moderator: boolean;
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
  /**
   * A retirada foi de **moderação**, e não auto-retirada do autor — ou seja, é
   * reversível por `POST /internal/v1/comments/:id/restore`.
   *
   * Booleano derivado, mesmo padrão de `viewer_is_author`: responde "dá para
   * restaurar?", e **só para quem pode restaurar**. O estado público continua
   * colapsando `author_removed` e `moderator_removed` em `removed` (§2), porque
   * o julgamento de autoria da remoção é dado de moderação.
   *
   * **Só é `true` quando o leitor tem papel de moderação** (`viewerIsModerator`).
   * Sem essa trava o campo respondia "foi a moderação ou foi o autor?" para
   * visitante anônimo — as fachadas repassam esta resposta em `GET` público sem
   * filtrar campo — e desfazia o colapso do §2 que ele deveria respeitar
   * (achado de review, PR #275).
   *
   * `false` em comentário visível, em auto-retirada, em `pending_review_hidden`
   * e para todo leitor que não modera.
   */
  removed_by_moderator: boolean;
  /**
   * Proveniência e corpo do comentário importado, ou `null` no nativo.
   *
   * `content_html` mora **aqui dentro**, e não como irmão de `body_markdown`,
   * porque o `community_comment_body_kind_check` é um XOR: nativo tem
   * `body_markdown` e nenhum `legacy_*`; legado tem o oposto. Dois campos
   * soltos no mesmo nível deixariam o consumidor achar que pode receber os
   * dois, ou nenhum — o agrupamento faz o schema do payload dizer a mesma
   * coisa que o `CHECK` do banco já diz.
   *
   * O nome preserva o da coluna. É enganoso (no `downloads` o conteúdo é
   * markdown vindo de `download_comment.body`), mas renomear no payload
   * criaria um terceiro vocabulário entre banco, moderação
   * (`moderation.ts:87`) e conversa.
   */
  legacy: {
    source: string;
    author_name: string;
    content_html: string | null;
    /**
     * Como o consumidor deve renderizar `content_html`.
     *
     * Derivado da política gravada, **não** a política crua: o payload entrega
     * a decisão já tomada ("é markdown" / "é HTML") em vez de obrigar cada um
     * dos três consumidores a reimplementar o mapeamento de string de política
     * — o primeiro que errasse renderizaria HTML como markdown, exibindo tag
     * crua ao leitor. Mesma razão de `badge` e `author.state` serem enum e não
     * texto (`AuthorBadge`, acima).
     */
    format: LegacyBodyFormat;
  } | null;
}

/**
 * Formato do corpo importado, resolvido a partir de
 * `legacy_sanitizer_policy`.
 *
 * `markdown` — política `content-editor/sanitizeUserMarkdown`: a origem já
 * guardava markdown (no `downloads`, `download_comment.body`, que o componente
 * antigo renderizava com `MarkdownContent`).
 * `html` — política `site-comment-html`: HTML de verdade, limpo por
 * `sanitizeLegacyCommentHtml` (T2.5).
 */
export type LegacyBodyFormat = "markdown" | "html";

/** Política de sanitização → formato de render. */
export function legacyBodyFormat(policy: string | null): LegacyBodyFormat {
  // `html` é o default deliberado do desconhecido. Uma política que este
  // código ainda não conhece é mais provavelmente HTML de um importador novo,
  // e tratar HTML como markdown exibiria `<p>` cru ao leitor; o caminho HTML
  // ainda passa pelo `DOMPurify` do render, então errar para este lado degrada
  // a formatação, nunca a segurança.
  return policy === "content-editor/sanitizeUserMarkdown" ? "markdown" : "html";
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
   * O leitor tem papel de moderação. Só isso libera `removed_by_moderator`.
   *
   * Derivado de `users.role` no servidor, nunca do request — a mesma origem que
   * `requireModeratorRole` usa. Ausente ou `false` em leitura pública, que é o
   * default seguro: o campo responde "quem retirou?", e essa pergunta não pode
   * ter resposta para quem não modera (`contrato-http-v1.md` §2).
   */
  viewerIsModerator?: boolean;
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
  { subject, sort, snapshotRevision, actingActorId, viewerIsModerator, after, branchId }: ReadTreeOptions,
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
  // Default fechado: quem não provou papel de moderação não recebe a origem da
  // retirada. Ver o comentário no SELECT de `removed_by_moderator`.
  const moderatorParam = viewerIsModerator === true;
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
        c.legacy_content_html,
        c.legacy_sanitizer_policy,
        c.legacy_sanitizer_version,
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
        -- A retirada foi de MODERACAO, e nao auto-retirada do autor.
        --
        -- Mesmo padrao de viewer_is_author logo acima, e pela mesma razao: a
        -- pergunta que a tela faz e "da para restaurar?", nao "quem apagou".
        -- publicState colapsa author_removed e moderator_removed no mesmo
        -- 'removed' de proposito (contrato-http-v1.md §2 nao autoriza entregar
        -- ao leitor o julgamento de quem apagou), e isso continua valendo: este
        -- booleano nao diz quem, diz se a acao e reversivel.
        --
        -- Sem ele, "Restaurar (moderacao)" aparecia sobre TODA auto-retirada
        -- alheia e falhava sempre, porque restoreCommentByModerator recusa
        -- author_removed com 409 comment_removed_by_author
        -- (communityModerationCase.ts:903-909). A primeira correcao guardou o
        -- conjunto no componente, mas ele nasce vazio a cada reload e nao havia
        -- caminho de volta: a fila de contas novas filtra visibility_state =
        -- 'visible' (communityModerationQueue.ts:109) e nao lista retirados, e
        -- a resolucao de caso exige denuncia previa — que a retirada direta nao
        -- cria. Retirada sem denuncia ficava irreversivel apos F5, nos tres
        -- apps (achado de review, PR #274).
        --
        -- false, e nao null, quando o comentario esta visivel: a pergunta so faz
        -- sentido sobre retirado, e null forcaria todo consumidor a tratar o
        -- terceiro estado sem ganhar informacao nenhuma.
        --
        -- moderatorParam e a TRAVA: sem ela o campo respondia "foi a
        -- moderacao ou foi o autor?" para visitante anonimo, desfazendo o
        -- colapso que publicState faz de proposito e que o contrato-http-v1 §2
        -- exige. As fachadas de mesas/downloads/site repassam esta resposta em
        -- GET publico sem filtrar campo (achado de review, PR #275).
        --
        -- Quem nao modera recebe false, que e o mesmo que o campo diz sobre
        -- auto-retirada: indistinguivel de fora, e suficiente por dentro —
        -- o unico consumidor e moderateRestore (viewerPermissions.ts:194), que
        -- ja exige papel de moderacao na mesma linha.
        --
        -- NAO usar sintaxe de interpolacao de template dentro de comentario SQL
        -- aqui: o template tagueado interpola antes do Postgres ver o texto,
        -- entao o placeholder nasce dentro do -- sem cast e o parse falha
        -- inteiro com 42P18 (could not determine data type of parameter $N),
        -- mesmo sendo "so um comentario". Foi o que derrubou os 5 testes de
        -- communityReadIntegration.test.ts no CI (2026-08-19). Citar o binding
        -- por nome, em texto puro, como acima. Crase tambem nao entra: fecha o
        -- template literal e quebra o parse do TypeScript antes do SQL.
        (${moderatorParam}::boolean
          and c.visibility_state = 'moderator_removed') as removed_by_moderator,
        row_number() over (
          partition by c.parent_id
          order by ${order}
        ) as sibling_rank
      from community_comment c
      left join community_comment_score_version s
        on s.realm = c.realm
        and s.source_app = c.source_app
        and s.comment_id = c.id
        -- Cast ::bigint explicito nos tres usos de revision (aqui e no
        -- created_revision abaixo). Sem o cast, o Postgres nao infere o tipo do
        -- parametro dentro da condicao de um LEFT JOIN e a leitura inteira falha
        -- com "could not determine data type of parameter $3". O bug so aparecia
        -- com a conversa NAO vazia: com zero comentarios readSubjectRevision
        -- devolve null e a funcao retorna antes de montar esta query, entao o
        -- caminho nunca era exercitado (medido em producao, smoke T8.4 da spec
        -- 090 — 500 na leitura, 200 na conversa vazia). As colunas sao BIGINT
        -- (migration_006_community_comments.sql). Regressao coberta por
        -- communityReadIntegration.test.ts, contra Postgres real: o teste
        -- capturador de communityCommentReadSql.test.ts casa o TEXTO do SQL e
        -- nunca envia ao banco, entao nao alcanca erro de inferencia de tipo.
        and s.valid_from_revision <= ${revision}::bigint
        and (s.valid_to_revision is null or s.valid_to_revision > ${revision}::bigint)
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
        and c.created_revision <= ${revision}::bigint
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
      legacy_content_html,
      legacy_sanitizer_policy,
      legacy_sanitizer_version,
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
      removed_by_moderator,
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
    removed_by_moderator: row.removed_by_moderator ?? false,
    legacy:
      row.legacy_source && row.legacy_author_name
        ? {
            source: row.legacy_source,
            author_name: row.legacy_author_name,
            // Mesmo `hidden` que zera `body_markdown` logo acima, e pela mesma
            // razão: tombstone e conteúdo sob revisão não expõem corpo
            // (decisões 34, 46). Sem este guarda, retirar um comentário
            // importado apagaria o corpo nativo e deixaria o legado visível —
            // o vazamento entraria justamente pelo campo recém-adicionado.
            content_html: hidden ? null : row.legacy_content_html,
            format: legacyBodyFormat(row.legacy_sanitizer_policy),
          }
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
