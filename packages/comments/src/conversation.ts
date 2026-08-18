import { z } from 'zod';

import { validateCommentBody } from './commentBody.js';
import {
  defineCommentsOperation,
  type CommentsClient,
} from './transport.js';

export const COMMENT_SORTS_UI = ['best', 'top', 'new', 'old'] as const;
export const commentSortUiSchema = z.enum(COMMENT_SORTS_UI);
export type CommentSortUi = z.infer<typeof commentSortUiSchema>;

export const COMMENT_REPORT_REASONS = [
  'malicious_link',
  'inappropriate_content',
  'spam_or_off_topic',
  'harassment_or_hate',
  'personal_data',
  'copyright_violation',
  'illegal_content',
  'other',
] as const;

export const commentReportReasonSchema = z.enum(COMMENT_REPORT_REASONS);
export type CommentReportReason = z.infer<typeof commentReportReasonSchema>;

// Serve aos dois caminhos: corpo ARMAZENADO que volta da fachada e corpo
// SUBMETIDO pelo autor. A regra de canonicalização é a mesma nos dois, então
// duplicar o schema só criaria a chance de um lado divergir do outro numa
// edição futura (achado de review, PR #259).
const canonicalCommentBodySchema = z.string().transform((value, context) => {
  const result = validateCommentBody(value);
  if (!result.ok) {
    context.addIssue({
      code: 'custom',
      message: result.code,
    });
    return z.NEVER;
  }
  return result.bodyMarkdown;
});

/**
 * Schemas de LEITURA são tolerantes a campo desconhecido; os de ESCRITA não.
 *
 * A assimetria é deliberada e segue o que `mutatedCommentSchema` já documenta
 * mais abaixo: `.strict()` num payload que VEM do servidor fecha a porta a um
 * campo novo do próprio servidor. O que o cliente ENVIA continua `.strict()`,
 * porque ali um campo a mais é erro de quem escreveu o código, não evolução do
 * contrato.
 *
 * O custo do `.strict()` na leitura foi medido e é desproporcional: Zod recusa
 * com `unrecognized_keys` e o array inteiro de comentários falha junto, então
 * um campo novo troca a conversa toda por `schema_incompatible` — tela em
 * branco, não degradação.
 *
 * E não existe janela em que isso não aconteça. O comentário anterior de
 * `removed_by_moderator` supunha que a esteira sobe `accounts.` e apps no mesmo
 * ciclo; medido, é falso: `deploy-manifest.json` tem `auto_deploy_on_push:
 * false` em todos os módulos e `deploy.yml` deploya UM módulo por
 * `workflow_dispatch`. Some-se que `removed_by_moderator` não existe em
 * `origin/dev` nem em `origin/main` (medido com `git show`), enquanto os três
 * frontends que fazem este parse já estão em produção — deployar o `accounts.`
 * primeiro apagaria a conversa nos três até cada um subir (achado P1 do Codex,
 * PR #275).
 *
 * Isto substitui a instrução de "entrar como `.optional()` no cliente antes de
 * o servidor emitir": ordem de deploy que precisa ser lembrada a cada campo
 * novo é exatamente o tipo de trava que falha em silêncio.
 *
 * Não é decisão nova no pacote — `moderation.ts:8` já a tomou na PR #262, pelo
 * mesmo motivo e com a mesma medição ("o `accounts.` é deployado
 * independentemente da fachada de cada módulo"). Este arquivo era a
 * inconsistência: as duas fronteiras leem do mesmo servidor.
 */
export const commentAuthorSchema = z.object({
  display_name: z.string().nullable(),
  avatar_url: z.url().nullable(),
  badge: z.enum(['admin', 'moderator', 'content_author']).nullable(),
  state: z.enum(['active', 'deleted', 'legacy']),
});

export const conversationCommentSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  root_id: z.uuid(),
  depth: z.number().int().min(0).max(4),
  body_markdown: canonicalCommentBodySchema.nullable(),
  created_at: z.iso.datetime(),
  edited_at: z.iso.datetime().nullable(),
  state: z.enum(['visible', 'removed', 'pending_review_hidden']),
  author: commentAuthorSchema,
  upvotes: z.number().int().nonnegative().nullable(),
  downvotes: z.number().int().nonnegative().nullable(),
  score: z.number().int().nullable(),
  my_vote: z.union([z.literal(-1), z.literal(0), z.literal(1)]).nullable(),
  /**
   * DEB-090-VIEWER-AUTHOR — o leitor é o autor desta fala.
   *
   * Booleano derivado no servidor, **nunca identificador**: responde "é seu?"
   * sem dizer de quem é quando não for, que é o que `contrato-http-v1.md` §2
   * protege ao proibir `user_id` cru e `community_actor_id` no payload público.
   *
   * Sem ele, o host não tinha como oferecer editar/auto-retirar (§4, ações só
   * do autor) nem esconder o voto no próprio comentário (decisão 5) — restava
   * exibir botão que devolve `403` para quase todo mundo, ou não exibir. Era o
   * segundo, e o autor não conseguia corrigir a própria fala pela interface.
   *
   * `.default(false)` e não obrigatório: fachada que ainda não repassa o campo
   * degrada para "não é seu" — some o botão, nada quebra. Exigi-lo derrubaria o
   * parse inteiro da árvore num consumidor desatualizado, trocando um botão
   * ausente por uma conversa em branco.
   */
  viewer_is_author: z.boolean().default(false),
  /**
   * A retirada foi de **moderação**, e não auto-retirada do autor — logo, é
   * reversível.
   *
   * Booleano derivado, irmão de `viewer_is_author` e pela mesma razão: responde
   * "dá para restaurar?" sem dizer quem apagou. `state` continua colapsando
   * `author_removed` e `moderator_removed` em `removed` (§2), porque quem
   * apagou é dado de moderação; o que atravessa é a capacidade.
   *
   * Sem ele, "Restaurar (moderação)" aparecia sobre toda auto-retirada alheia e
   * falhava sempre — `restoreCommentByModerator` recusa `author_removed` com
   * `409 comment_removed_by_author`. A tentativa anterior guardou o conjunto no
   * componente, mas ele nasce vazio a cada reload e não havia caminho de volta:
   * a fila de contas novas filtra `visibility_state = 'visible'` e não lista
   * retirados, e a resolução de caso exige denúncia prévia, que a retirada
   * direta não cria (achado de review, PR #274).
   *
   * `.default(false)` pelo mesmo motivo de `viewer_is_author`: fachada que ainda
   * não repassa o campo degrada para "não dá para restaurar" — some um botão,
   * nada quebra. Exigi-lo derrubaria o parse da árvore inteira num consumidor
   * desatualizado, trocando um botão ausente por uma conversa em branco.
   *
   * **A direção inversa é coberta pela tolerância do schema de leitura**, e não
   * por ordem de deploy: ver o comentário de `commentAuthorSchema`. Um bundle
   * antigo que receba este campo antes de conhecê-lo simplesmente o ignora.
   *
   * A versão anterior deste trecho dizia que a esteira sobe `accounts.` e apps
   * no mesmo ciclo e que bastava um deploy de janela. Medido, era falso — o
   * deploy é por módulo, sob dispatch manual —, e é o que motivou remover o
   * `.strict()` da leitura em vez de confiar na ordem.
   */
  removed_by_moderator: z.boolean().default(false),
  legacy: z.object({
    source: z.string().min(1),
    author_name: z.string().min(1),
    /**
     * Corpo do comentário importado — `z.string()` cru, deliberadamente **não**
     * `canonicalCommentBodySchema`.
     *
     * O schema canônico roda `validateCommentBody`, que aplica a política de
     * links do requisito 10a: HTTPS-only, `http:` recusado com
     * `INVALID_COMMENT_LINK`. Conteúdo importado é anterior a essa política e
     * não teve chance de obedecê-la — um único `http://` num comentário de
     * 2015 derrubaria o parse da **árvore inteira** (o `superRefine` é do
     * comentário, mas o array falha junto), trocando a conversa toda por
     * `schema_incompatible`. Validar na leitura o que já está gravado pune o
     * leitor por uma regra que o autor não podia conhecer.
     *
     * Não sanitizar aqui é seguro e é o desenho: o conteúdo entrou sanitizado
     * pelo exportador da origem, com política e versão declaradas
     * (`exportLegacyComments.ts:132`), e a "defesa adicional na saída sem
     * regravar" que `spec.md:444` exige é o `DOMPurify.sanitize()` de
     * `renderMarkdown`, aplicado no render. Mesma forma que
     * `moderation.ts:87` já usa para o mesmo campo.
     */
    content_html: z.string().nullable().default(null),
    /**
     * Como renderizar `content_html` — a coluna guarda os dois formatos.
     *
     * `.default('html')` e não obrigatório, pela mesma razão que
     * `viewer_is_author` tem default: fachada ainda não atualizada continua
     * parseando. O default é `html` porque é o caminho conservador na
     * renderização — markdown exibido como HTML perde formatação, enquanto HTML
     * exibido como markdown mostraria `<p>` cru ao leitor.
     */
    format: z.enum(['markdown', 'html']).default('html'),
  }).nullable(),
}).superRefine((comment, context) => {
  const hidden = comment.state !== 'visible';
  if (hidden && (
    comment.body_markdown !== null
    // O corpo legado entra na MESMA invariante que o nativo: são as duas
    // metades do XOR do banco, e cobrir só uma deixaria o tombstone de um
    // comentário importado exibir o texto que a moderação derrubou.
    || comment.legacy?.content_html != null
    || comment.upvotes !== null
    || comment.downvotes !== null
    || comment.score !== null
  )) {
    context.addIssue({
      code: 'custom',
      message: 'Comentário oculto não pode expor corpo nem placar.',
    });
  }
  if (comment.legacy !== null && (
    comment.author.state !== 'legacy'
    || comment.author.avatar_url !== null
    || comment.author.badge !== null
    // DEB-090-VIEWER-AUTHOR: legado tem `community_actor_id` nulo por
    // construção (`community_comment_body_kind_check`), então ninguém é seu
    // autor perante o sistema. `true` aqui ofereceria editar e auto-retirar
    // sobre fala importada — que a decisão 6 fixa como imutável — e o servidor
    // recusaria com `legacy_immutable` depois do clique.
    || comment.viewer_is_author
  )) {
    context.addIssue({
      code: 'custom',
      message: 'Comentário legado não pode sugerir identidade verificada.',
    });
  }
});

export type ConversationComment = z.infer<typeof conversationCommentSchema>;

export const conversationMoreNodeSchema = z.object({
  parent_id: z.uuid().nullable(),
  count: z.number().int().positive(),
  cursor: z.string().min(1),
});

export type ConversationMoreNode = z.infer<typeof conversationMoreNodeSchema>;

export const commentsThreadSchema = z.object({
  state: z.literal('fresh'),
  snapshot_revision: z.number().int().nonnegative(),
  comments: z.array(conversationCommentSchema),
  more: z.array(conversationMoreNodeSchema),
  truncated: z.boolean(),
});

export type CommentsThread = z.infer<typeof commentsThreadSchema>;

/**
 * Incorpora uma página de `more` sem duplicar comentário nem manter o cursor já
 * consumido. Revisões diferentes nunca são misturadas: o host deve recarregar a
 * conversa desde a raiz quando a fachada devolver outro snapshot.
 */
export function mergeCommentsThreadPage(
  current: CommentsThread,
  page: CommentsThread,
  consumedCursor: string,
): CommentsThread {
  if (current.snapshot_revision !== page.snapshot_revision) {
    throw new TypeError('Não é possível misturar páginas de revisões diferentes.');
  }

  const comments = new Map(current.comments.map((comment) => [comment.id, comment]));
  for (const comment of page.comments) comments.set(comment.id, comment);

  const more = new Map(
    current.more
      .filter((node) => node.cursor !== consumedCursor)
      .map((node) => [node.cursor, node]),
  );
  for (const node of page.more) more.set(node.cursor, node);

  return commentsThreadSchema.parse({
    state: 'fresh',
    snapshot_revision: current.snapshot_revision,
    comments: [...comments.values()],
    more: [...more.values()],
    truncated: more.size > 0,
  });
}

const subjectInputSchema = z.object({
  subjectType: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(255),
}).strict();

export const readCommentsThreadOperation = defineCommentsOperation({
  capability: 'thread.read',
  kind: 'query',
  inputSchema: subjectInputSchema.extend({
    sort: commentSortUiSchema.default('best'),
    cursor: z.string().min(1).optional(),
  }),
  outputSchema: commentsThreadSchema,
});

/**
 * O que a escrita devolve — **não** é o comentário completo da leitura.
 *
 * `POST`/`PATCH` respondem com o comentário recém-gravado
 * (`communityCommentRoutes.ts:403,655`), que carrega só identidade, posição,
 * corpo e datas: `CreatedComment` (`communityCommentWrite.ts:106`) e
 * `EditedComment` (`communityCommentLifecycle.ts:111`). Placar, autor resolvido,
 * `my_vote`, `state`, `viewer_is_author` e `legacy` **não existem nesse
 * momento** — dependem de joins que só a árvore faz, e alguns nem fazem sentido
 * na resposta da própria escrita (`my_vote` de um comentário que acabou de
 * nascer).
 *
 * Antes disto as três mutações declaravam `conversationCommentSchema`, e o
 * payload real falhava em **8 campos** (medido: `edited_at`, `state`, `author`,
 * `upvotes`, `downvotes`, `score`, `my_vote`, `legacy`). O efeito era grave e
 * silencioso: escrita **confirmada e persistida** pelo servidor virava
 * `schema_incompatible` no cliente, a UI mostrava falha, o `reload` não rodava,
 * e quem reenviasse geraria uma chave de idempotência nova — duplicando a fala
 * que já estava gravada. Achado da revisão do Codex na PR #263.
 *
 * `edited_at` é opcional porque só a edição o devolve; a criação não tem o
 * campo. `.strict()` fecharia a porta a um campo novo do servidor, então fica
 * aberto de propósito: a mutação valida o que precisa consumir, não a forma
 * inteira da resposta.
 */
export const mutatedCommentSchema = z.object({
  id: z.uuid(),
  parent_id: z.uuid().nullable(),
  root_id: z.uuid(),
  depth: z.number().int().min(0).max(4),
  body_markdown: canonicalCommentBodySchema,
  created_at: z.iso.datetime(),
  edited_at: z.iso.datetime().nullable().optional(),
});

export type MutatedComment = z.infer<typeof mutatedCommentSchema>;

export const createCommentOperation = defineCommentsOperation({
  capability: 'comment.create',
  kind: 'mutation',
  inputSchema: subjectInputSchema.extend({ bodyMarkdown: canonicalCommentBodySchema }),
  outputSchema: mutatedCommentSchema,
});

export const replyToCommentOperation = defineCommentsOperation({
  capability: 'comment.reply',
  kind: 'mutation',
  inputSchema: subjectInputSchema.extend({
    commentId: z.uuid(),
    bodyMarkdown: canonicalCommentBodySchema,
  }),
  outputSchema: mutatedCommentSchema,
});

export const editCommentOperation = defineCommentsOperation({
  capability: 'comment.edit',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    bodyMarkdown: canonicalCommentBodySchema,
  }).strict(),
  outputSchema: mutatedCommentSchema,
});

export const withdrawCommentOperation = defineCommentsOperation({
  capability: 'comment.withdraw',
  kind: 'mutation',
  inputSchema: z.object({ commentId: z.uuid() }).strict(),
  outputSchema: z.union([z.undefined(), z.null(), z.object({ ok: z.literal(true) }).strict()]),
});

/**
 * Teto do `reason` das ações de moderação, **500 e não 4.000**.
 *
 * O número vem do `accounts.`, que é quem de fato recusa:
 * `reasonOnlyBodySchema` em `communityModerationRoutes.ts:180` valida
 * `z.string().trim().min(1).max(500)` e devolve `400 invalid_body` — genérico,
 * sem dizer qual campo estourou. As fachadas de `mesas` e `downloads` são
 * proxies puros e não revalidam, então nada entre o formulário e o banco
 * corrige a diferença.
 *
 * Nasceu como `4_000` aqui, copiado do `details` da denúncia (que é 4.000 de
 * verdade, `DETAILS_MAX_LENGTH`): o `textarea` aceitava 600 caracteres, o
 * cliente aceitava, e o `400` chegava sete camadas depois como "não foi
 * possível concluir a ação" (achado de review, PR #274). É exatamente a falha
 * que o `AGENTS.md` descreve — app mandando formato que o dono do contrato
 * recusa, com o sintoma aparecendo longe da origem.
 *
 * Exportada porque o `maxLength` do `textarea` precisa do MESMO número: dois
 * literais iguais em arquivos diferentes é como o primeiro divergiu.
 */
export const MODERATION_REASON_MAX_LENGTH = 500;

/**
 * Teto do `details` da denúncia — 4.000, e o número vive **aqui**.
 *
 * Mesmo motivo de `MODERATION_REASON_MAX_LENGTH` logo acima, e a mesma falha
 * que ele já corrigiu uma vez: o número precisa ser idêntico no schema que
 * valida, no `maxLength` do editor e em quem barra o envio, e literal repetido
 * diverge no primeiro ajuste. Estava em três lugares — `communityCommentReport.ts:87`
 * (accounts, quem de fato recusa), `ReportButton.tsx:8` (downloads) e inline no
 * `createCommentReportOperation` abaixo.
 *
 * O pacote é o dono porque é ele que valida `details` antes do envio nos três
 * consumidores; o `accounts.` reexporta deste ponto em vez de manter cópia.
 */
export const REPORT_DETAILS_MAX_LENGTH = 4_000;

/**
 * Retirada de comentário **alheio** por moderador global.
 *
 * Distinta de `withdrawCommentOperation` de propósito, e não é redundância:
 * aquela é auto-retirada do autor (`DELETE`, sem corpo, `forbidden_not_author`
 * para qualquer outro), enquanto esta bate na fachada de moderação, exige
 * `reason` e entra no log de moderação com o ator que decidiu.
 *
 * O `reason` é obrigatório porque o servidor o exige, e a UI o valida antes de
 * enviar pela mesma razão da denúncia (achado de review, PR #259): formulário
 * operável que sempre volta `422` não informa o que faltou.
 */
export const moderationRemoveCommentOperation = defineCommentsOperation({
  capability: 'moderation.remove',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    reason: z.string().trim().min(1).max(MODERATION_REASON_MAX_LENGTH),
  }).strict(),
  // Mesma tolerância do `withdraw`: a fachada repassa o que o `accounts.`
  // devolver, e o corpo não é lido pela UI — o que importa é o status.
  outputSchema: z.unknown(),
});

/**
 * Restauração de comentário retirado — o par de `moderationRemoveCommentOperation`.
 *
 * Existe pelo mesmo motivo que a retirada: sem ela, um moderador que retira por
 * engano não tem caminho de volta pela conversa, e o comentário fica preso no
 * placeholder "Comentário retirado." até alguém abrir a fila de moderação — que
 * hoje só existe no `downloads`. Retirada sem desfazer é uma ação de mão única
 * numa superfície onde o erro é barato de cometer (um clique) e caro de corrigir.
 */
export const moderationRestoreCommentOperation = defineCommentsOperation({
  capability: 'moderation.restore',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    reason: z.string().trim().min(1).max(MODERATION_REASON_MAX_LENGTH),
  }).strict(),
  outputSchema: z.unknown(),
});

export const setCommentVoteOperation = defineCommentsOperation({
  capability: 'vote.set',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    value: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  }).strict(),
  outputSchema: z.object({
    my_vote: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    upvotes: z.number().int().nonnegative(),
    downvotes: z.number().int().nonnegative(),
    score: z.number().int(),
  }).strict(),
});

/**
 * Motivos que exigem `details` não vazio (`contrato-http-v1.md` §denúncia). Os
 * demais aceitam, mas não obrigam. Exportado porque a UI precisa da mesma lista
 * para marcar o campo como obrigatório — duas cópias divergiriam na primeira
 * mudança de política.
 */
export const COMMENT_REPORT_REASONS_REQUIRING_DETAILS = [
  'other',
  'copyright_violation',
  'illegal_content',
] as const satisfies readonly CommentReportReason[];

export function commentReportRequiresDetails(reason: CommentReportReason): boolean {
  return (COMMENT_REPORT_REASONS_REQUIRING_DETAILS as readonly CommentReportReason[]).includes(reason);
}

export const createCommentReportOperation = defineCommentsOperation({
  capability: 'report.create',
  kind: 'mutation',
  // Valida a política condicional aqui, e não só no servidor: sem isso o
  // formulário fica operável, o envio sempre volta `422`/`details_required` e o
  // usuário não descobre o que faltou (achado de review, PR #259).
  inputSchema: z.object({
    commentId: z.uuid(),
    reasonCode: commentReportReasonSchema,
    details: z.string().trim().max(REPORT_DETAILS_MAX_LENGTH).optional(),
  }).strict().superRefine((report, context) => {
    if (commentReportRequiresDetails(report.reasonCode) && !report.details) {
      context.addIssue({
        code: 'custom',
        path: ['details'],
        message: 'details_required',
      });
    }
  }),
  outputSchema: z.object({
    id: z.uuid(),
    comment_id: z.uuid(),
    reason_code: commentReportReasonSchema,
    state: z.string().min(1),
    created_at: z.iso.datetime(),
  }).strict(),
});

export type CommentsConversationCapability =
  | 'thread.read'
  | 'comment.create'
  | 'comment.reply'
  | 'comment.edit'
  | 'comment.withdraw'
  | 'vote.set'
  | 'report.create'
  | 'moderation.remove'
  | 'moderation.restore';

export interface CommentsConversationSubject {
  readonly subjectType: string;
  readonly subjectId: string;
}

/**
 * Chave de idempotência de uma tentativa de escrita.
 *
 * `contrato-http-v1.md` §6 a torna **obrigatória** em criação, resposta e
 * edição: `readAuthorAndKey` (`communityCommentRoutes.ts:338-342`) recusa com
 * `400 invalid_idempotency_key` quando o header falta ou foge de
 * `[\x20-\x7E]{8,128}`. Sem esta função a conversa inteira era incapaz de
 * publicar — toda mutação batia no `400`, nos três consumidores.
 *
 * Uma chave por **tentativa**, gerada aqui e não pelo host: o transporte já
 * documenta (`transport.ts:59-68`) que a retentativa do MESMO envio precisa
 * repetir a chave para o servidor devolver a resposta original em vez de
 * duplicar a fala. Gerar por requisição HTTP quebraria exatamente esse caso;
 * gerar por componente faria dois envios distintos colidirem, e o segundo
 * receberia de volta o resultado do primeiro.
 *
 * `withdraw` e `vote` ficam de fora de propósito: o `DELETE` é idempotente por
 * construção (a segunda chamada encontra o tombstone) e o voto é estado
 * absoluto (decisão 12) — nenhum dos dois passa por `readAuthorAndKey`.
 */
function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function createCommentsConversationClient(
  client: CommentsClient<CommentsConversationCapability>,
  subject: CommentsConversationSubject,
) {
  return {
    read: (sort: CommentSortUi, cursor?: string, signal?: AbortSignal) =>
      client.execute(readCommentsThreadOperation, { ...subject, sort, cursor }, { signal }),
    create: (bodyMarkdown: string, signal?: AbortSignal, idempotencyKey = newIdempotencyKey()) =>
      client.execute(
        createCommentOperation,
        { ...subject, bodyMarkdown },
        { signal, idempotencyKey },
      ),
    reply: (
      commentId: string,
      bodyMarkdown: string,
      signal?: AbortSignal,
      idempotencyKey = newIdempotencyKey(),
    ) =>
      client.execute(
        replyToCommentOperation,
        { ...subject, commentId, bodyMarkdown },
        { signal, idempotencyKey },
      ),
    edit: (
      commentId: string,
      bodyMarkdown: string,
      signal?: AbortSignal,
      idempotencyKey = newIdempotencyKey(),
    ) =>
      client.execute(
        editCommentOperation,
        { commentId, bodyMarkdown },
        { signal, idempotencyKey },
      ),
    withdraw: (commentId: string, signal?: AbortSignal) =>
      client.execute(withdrawCommentOperation, { commentId }, { signal }),
    // Sem `idempotencyKey`, como o `withdraw`: a retirada é idempotente por
    // construção (a segunda chamada encontra o comentário já retirado) e a rota
    // não passa por `readAuthorAndKey`.
    moderationRemove: (commentId: string, reason: string, signal?: AbortSignal) =>
      client.execute(moderationRemoveCommentOperation, { commentId, reason }, { signal }),
    moderationRestore: (commentId: string, reason: string, signal?: AbortSignal) =>
      client.execute(moderationRestoreCommentOperation, { commentId, reason }, { signal }),
    vote: (commentId: string, value: -1 | 0 | 1, signal?: AbortSignal) =>
      client.execute(setCommentVoteOperation, { commentId, value }, { signal }),
    // A denúncia tem validação própria da chave
    // (`communityModerationRoutes.ts:125-132`), com o mesmo formato.
    report: (
      commentId: string,
      reasonCode: CommentReportReason,
      details?: string,
      signal?: AbortSignal,
      idempotencyKey = newIdempotencyKey(),
    ) => client.execute(
      createCommentReportOperation,
      { commentId, reasonCode, details },
      { signal, idempotencyKey },
    ),
  };
}

export type CommentsConversationClient = ReturnType<typeof createCommentsConversationClient>;
