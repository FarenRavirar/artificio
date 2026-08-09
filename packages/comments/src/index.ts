/**
 * `@artificio/comments` — contrato compartilhado de comentários.
 *
 * Este export (`.`) é **livre de React** de propósito: quem o consome primeiro
 * é o **backend** de cada módulo, que precisa do guard de assunto antes de
 * chamar o `accounts.` (requisito 21b — backend e o Astro server-side do `site`
 * não podem ser obrigados a importar React).
 *
 * `@artificio/comments/react` e `@artificio/comments/styles.css` entram na
 * Fase 4, com `react`/`react-dom` em `peerDependencies`.
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
  runSubjectAuthorizationConformance,
  type ConformanceCheck,
  type ConformanceFixture,
  type ConformanceFixtures,
  type ConformanceReport,
} from './subjectAuthorizationConformance.js';
