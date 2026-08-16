/**
 * `@artificio/comments` — contrato compartilhado de comentários.
 *
 * Este export (`.`) é **livre de React** de propósito: quem o consome primeiro
 * é o **backend** de cada módulo, que precisa do guard de assunto antes de
 * chamar o `accounts.` (requisito 21b — backend e o Astro server-side do `site`
 * não podem ser obrigados a importar React).
 *
 * `@artificio/comments/react` e `@artificio/comments/styles.css` são subpaths
 * separados, com `react`/`react-dom` em `peerDependencies` opcionais para que
 * este root continue seguro em Node/SSR.
 */

export {
  CANONICAL_PATH_MAX_LENGTH,
  SUBJECT_ID_MAX_LENGTH,
  SUBJECT_TYPE_MAX_LENGTH,
  SUBJECT_TYPE_MESSAGE,
  SUBJECT_TYPE_PATTERN,
  authorize,
  canonicalPathSchema,
  normalizeGuardResult,
  refuse,
  subjectAuthorizationSchema,
  subjectRefSchema,
  type CommentSubjectAuthorization,
  type CommentSubjectGuard,
  type CommentSubjectRef,
  type SubjectAuthorizationResult,
  type SubjectRefusalReason,
} from './subjectAuthorization.js';

export {
  COMMENT_BODY_MAX_LENGTH,
  validateCommentBody,
  type CommentBodyRejectionCode,
  type CommentBodyValidation,
} from './commentBody.js';

export {
  MAX_BYTES_PER_READ,
  MAX_COMMENTS_PER_READ,
  assembleTree,
  type AssemblyInput,
  type AssemblyResult,
  type AssemblyRow,
  type MoreNode,
} from './treeAssembly.js';

export {
  resolveNotificationRecipients,
  type RecipientCandidates,
} from './notificationRecipients.js';

export {
  MAX_COMMENT_DEPTH,
  placeComment,
  type CommentSubjectScope,
  type ParentComment,
  type ThreadPlacement,
  type ThreadRejectionCode,
} from './threadIntegrity.js';

export {
  COMMENT_SORTS,
  CURSOR_SECRET_MIN_LENGTH,
  CURSOR_TTL_MS,
  issueTreeCursor,
  treeCursorPayloadSchema,
  verifyTreeCursor,
  type CommentSort,
  type CursorRejectionReason,
  type TreeCursorPayload,
  type TreeCursorVerification,
} from './treeCursor.js';

export {
  COMMENT_RATE_BUCKETS,
  RateLimitConfigurationError,
  resolveRateLimitKeys,
  serializeRateLimitKey,
  type CommentRateBucket,
  type RateLimitIdentity,
  type RateLimitKey,
  type RateLimitLayer,
} from './rateLimitBuckets.js';

export {
  runSubjectAuthorizationConformance,
  type ConformanceCheck,
  type ConformanceFixture,
  type ConformanceFixtures,
  type ConformanceReport,
} from './subjectAuthorizationConformance.js';

export {
  COMMENT_CAPABILITIES,
  COMMENTS_ERROR_CODES,
  COMMENTS_REQUEST_TIMEOUT_MS,
  CommentsClientError,
  commentCapabilitySchema,
  commentsErrorCodeSchema,
  commentsErrorSchema,
  createCommentsClient,
  defineCommentsOperation,
  normalizeCommentsError,
  type CommentCapability,
  type CommentsClient,
  type CommentsClientOptions,
  type CommentsErrorCode,
  type CommentsErrorShape,
  type CommentsExecuteOptions,
  type CommentsOperation,
  type CommentsOperationKind,
  type CommentsTransport,
  type CommentsTransportRequest,
} from './transport.js';

export {
  commentsResourceIdentitySchema,
  createCommentsResource,
  createCommentsResourceKey,
  type CommentsResource,
  type CommentsResourceIdentity,
  type CommentsResourceOptions,
  type CommentsResourceState,
  type FreshCommentsState,
  type StaleCommentsState,
  type UnavailableCommentsState,
} from './resource.js';

export {
  COMMENT_REPORT_REASONS,
  COMMENT_SORTS_UI,
  commentAuthorSchema,
  commentReportReasonSchema,
  commentSortUiSchema,
  commentsThreadSchema,
  conversationCommentSchema,
  conversationMoreNodeSchema,
  createCommentOperation,
  createCommentReportOperation,
  createCommentsConversationClient,
  editCommentOperation,
  mergeCommentsThreadPage,
  mutatedCommentSchema,
  readCommentsThreadOperation,
  replyToCommentOperation,
  setCommentVoteOperation,
  withdrawCommentOperation,
  type CommentReportReason,
  type CommentSortUi,
  type CommentsConversationCapability,
  type CommentsConversationClient,
  type CommentsConversationSubject,
  type CommentsThread,
  type ConversationComment,
  type ConversationMoreNode,
  type MutatedComment,
} from './conversation.js';

export {
  moderationCaseSchema,
  commentVersionSchema,
  commentVersionsSchema,
  moderationLogEntrySchema,
  moderationLogSchema,
  moderationQueueItemSchema,
  moderationQueueSchema,
  moderatorAppealSchema,
  newAccountCommentSchema,
  ownReportSchema,
  ownReportsSchema,
  reportReasonSchema,
  reportReasonsSchema,
  sanctionHistoryEntrySchema,
  sanctionHistorySchema,
  type CommunityModerationAdapter,
  type CommentVersion,
  type ModerationCase,
  type ModerationLogEntry,
  type ModerationQueue,
  type ModerationQueueItem,
  type ModeratorAppeal,
  type NewAccountComment,
  type OwnReport,
  type ReportReason,
  type SanctionHistoryEntry,
} from './moderation.js';
