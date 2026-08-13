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
  legacy: z.object({
    source: z.string().min(1),
    author_name: z.string().min(1),
  }).strict().nullable(),
}).strict().superRefine((comment, context) => {
  const hidden = comment.state !== 'visible';
  if (hidden && (
    comment.body_markdown !== null
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

const commentBodyInputSchema = z.string().transform((value, context) => {
  const result = validateCommentBody(value);
  if (!result.ok) {
    context.addIssue({ code: 'custom', message: result.code });
    return z.NEVER;
  }
  return result.bodyMarkdown;
});

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
  inputSchema: subjectInputSchema.extend({ bodyMarkdown: commentBodyInputSchema }),
  outputSchema: conversationCommentSchema,
});

export const replyToCommentOperation = defineCommentsOperation({
  capability: 'comment.reply',
  kind: 'mutation',
  inputSchema: subjectInputSchema.extend({
    commentId: z.uuid(),
    bodyMarkdown: commentBodyInputSchema,
  }),
  outputSchema: conversationCommentSchema,
});

export const editCommentOperation = defineCommentsOperation({
  capability: 'comment.edit',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    bodyMarkdown: commentBodyInputSchema,
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

export const createCommentReportOperation = defineCommentsOperation({
  capability: 'report.create',
  kind: 'mutation',
  inputSchema: z.object({
    commentId: z.uuid(),
    reasonCode: commentReportReasonSchema,
    details: z.string().trim().max(4_000).optional(),
  }).strict(),
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

export function createCommentsConversationClient(
  client: CommentsClient<CommentsConversationCapability>,
  subject: CommentsConversationSubject,
) {
  return {
    read: (sort: CommentSortUi, cursor?: string, signal?: AbortSignal) =>
      client.execute(readCommentsThreadOperation, { ...subject, sort, cursor }, { signal }),
    create: (bodyMarkdown: string, signal?: AbortSignal) =>
      client.execute(createCommentOperation, { ...subject, bodyMarkdown }, { signal }),
    reply: (commentId: string, bodyMarkdown: string, signal?: AbortSignal) =>
      client.execute(replyToCommentOperation, { ...subject, commentId, bodyMarkdown }, { signal }),
    edit: (commentId: string, bodyMarkdown: string, signal?: AbortSignal) =>
      client.execute(editCommentOperation, { commentId, bodyMarkdown }, { signal }),
    withdraw: (commentId: string, signal?: AbortSignal) =>
      client.execute(withdrawCommentOperation, { commentId }, { signal }),
    vote: (commentId: string, value: -1 | 0 | 1, signal?: AbortSignal) =>
      client.execute(setCommentVoteOperation, { commentId, value }, { signal }),
    report: (
      commentId: string,
      reasonCode: CommentReportReason,
      details?: string,
      signal?: AbortSignal,
    ) => client.execute(
      createCommentReportOperation,
      { commentId, reasonCode, details },
      { signal },
    ),
  };
}

export type CommentsConversationClient = ReturnType<typeof createCommentsConversationClient>;
