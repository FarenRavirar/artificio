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

export const commentAuthorSchema = z.object({
  display_name: z.string().nullable(),
  avatar_url: z.url().nullable(),
  badge: z.enum(['admin', 'moderator', 'content_author']).nullable(),
  state: z.enum(['active', 'deleted', 'legacy']),
}).strict();

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
  }).strict().nullable(),
}).strict().superRefine((comment, context) => {
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
}).strict();

export type ConversationMoreNode = z.infer<typeof conversationMoreNodeSchema>;

export const commentsThreadSchema = z.object({
  state: z.literal('fresh'),
  snapshot_revision: z.number().int().nonnegative(),
  comments: z.array(conversationCommentSchema),
  more: z.array(conversationMoreNodeSchema),
  truncated: z.boolean(),
}).strict();

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

export const createCommentOperation = defineCommentsOperation({
  capability: 'comment.create',
  kind: 'mutation',
  inputSchema: subjectInputSchema.extend({ bodyMarkdown: canonicalCommentBodySchema }),
  outputSchema: conversationCommentSchema,
});

export const replyToCommentOperation = defineCommentsOperation({
  capability: 'comment.reply',
  kind: 'mutation',
  inputSchema: subjectInputSchema.extend({
    commentId: z.uuid(),
    bodyMarkdown: canonicalCommentBodySchema,
  }),
  outputSchema: conversationCommentSchema,
});

export const editCommentOperation = defineCommentsOperation({
  capability: 'comment.edit',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    bodyMarkdown: canonicalCommentBodySchema,
  }).strict(),
  outputSchema: conversationCommentSchema,
});

export const withdrawCommentOperation = defineCommentsOperation({
  capability: 'comment.withdraw',
  kind: 'mutation',
  inputSchema: z.object({ commentId: z.uuid() }).strict(),
  outputSchema: z.union([z.undefined(), z.null(), z.object({ ok: z.literal(true) }).strict()]),
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
    details: z.string().trim().max(4_000).optional(),
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
  | 'report.create';

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
