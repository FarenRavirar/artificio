import { z } from 'zod';

const id = z.string().min(1);
const instant = z.iso.datetime();

export const moderationQueueItemSchema = z.object({
  case_id: id,
  comment_id: id,
  source_app: z.string().min(1),
  status: z.string().min(1),
  opened_at: instant,
  active_report_count: z.number().int().nonnegative(),
  reason_codes: z.array(z.string()),
  priority: z.number().int().nullable(),
  comment_visibility_state: z.string(),
}).strict();

export const newAccountCommentSchema = z.object({
  comment_id: id,
  source_app: z.string().min(1),
  community_actor_id: id,
  created_at: instant,
  comment_visibility_state: z.string(),
  author_comment_count: z.number().int().nonnegative(),
  new_account_reasons: z.array(z.enum(['account_age', 'comment_count'])),
}).strict();

export const moderationQueueSchema = z.object({
  items: z.array(moderationQueueItemSchema),
  new_account_comments: z.array(newAccountCommentSchema),
}).strict();

export const moderationLogEntrySchema = z.object({
  id,
  action: z.string(),
  target_type: z.string(),
  target_id: id,
  reason: z.string(),
  metadata: z.unknown(),
  occurred_at: instant,
  actor_id: id.nullable(),
}).strict();

export const moderationLogSchema = z.object({ entries: z.array(moderationLogEntrySchema) }).strict();

export const moderationCaseReportSchema = z.object({
  id,
  reason_code: z.string(),
  details: z.string().nullable(),
  state: z.string(),
  created_at: instant,
  reported_version_id: id,
  reporter_actor_id: id,
  reporter_display_name: z.string().nullable(),
}).strict();

export const moderationCaseSchema = z.object({
  case_id: id,
  comment_id: id,
  reported_author_actor_id: id.nullable(),
  status: z.string(),
  terminal_action: z.string().nullable(),
  opened_at: instant,
  closed_at: instant.nullable(),
  decision_reason: z.string().nullable(),
  reports: z.array(moderationCaseReportSchema),
}).strict();

export const commentVersionSchema = z.object({
  id,
  body_markdown: z.string().nullable(),
  legacy_content_html: z.string().nullable(),
  created_at: instant,
  redacted_at: instant.nullable(),
  is_current: z.boolean(),
  is_reported: z.boolean(),
}).strict();
export const commentVersionsSchema = z.object({ versions: z.array(commentVersionSchema) }).strict();

export const reportReasonSchema = z.object({
  code: z.string(),
  label: z.string(),
  priority: z.number().int(),
  details_policy: z.enum(['required', 'optional', 'forbidden']),
}).strict();
export const reportReasonsSchema = z.object({ reasons: z.array(reportReasonSchema) }).strict();

export const ownReportSchema = z.object({
  id,
  realm: z.string(),
  source_app: z.string(),
  comment_id: id,
  reason_code: z.string(),
  state: z.string(),
  result: z.enum(['action_taken', 'not_upheld', 'no_determination']).nullable(),
  can_withdraw: z.boolean(),
  created_at: instant,
}).strict();
export const ownReportsSchema = z.object({ reports: z.array(ownReportSchema) }).strict();

export const moderatorAppealSchema = z.object({
  id,
  case_id: id,
  status: z.string(),
  submitted_at: instant,
  appeal_deadline_at: instant,
  decision: z.enum(['upheld', 'reversed']).nullable(),
  decided_at: instant.nullable(),
  comment_version_id: id,
  reason: z.string(),
  original_decider_actor_id: id.nullable(),
  current_decider_actor_id: id.nullable(),
}).strict();

export const sanctionHistoryEntrySchema = z.object({
  id,
  scope: z.enum(['posting', 'commenting']),
  level: z.string(),
  reason: z.string(),
  starts_at: instant,
  expires_at: instant.nullable(),
  lifted_at: instant.nullable(),
  active: z.boolean(),
}).strict();
export const sanctionHistorySchema = z.object({ sanctions: z.array(sanctionHistoryEntrySchema) }).strict();

export type ModerationQueue = z.infer<typeof moderationQueueSchema>;
export type ModerationQueueItem = z.infer<typeof moderationQueueItemSchema>;
export type NewAccountComment = z.infer<typeof newAccountCommentSchema>;
export type ModerationLogEntry = z.infer<typeof moderationLogEntrySchema>;
export type ModerationCase = z.infer<typeof moderationCaseSchema>;
export type CommentVersion = z.infer<typeof commentVersionSchema>;
export type ReportReason = z.infer<typeof reportReasonSchema>;
export type OwnReport = z.infer<typeof ownReportSchema>;
export type ModeratorAppeal = z.infer<typeof moderatorAppealSchema>;
export type SanctionHistoryEntry = z.infer<typeof sanctionHistoryEntrySchema>;

export interface CommunityModerationAdapter {
  remove(commentId: string, reason: string): Promise<unknown>;
  restore(commentId: string, reason: string): Promise<unknown>;
  resolveCase(caseId: string, input: {
    verdicts: Array<{ report_id: string; verdict: 'upheld' | 'dismissed' | 'no_determination' }>;
    action: 'no_change' | 'restore' | 'remove';
    reason: string;
  }): Promise<unknown>;
  decideAppeal(appealId: string, outcome: 'upheld' | 'reversed', reason: string): Promise<unknown>;
  applySanction(input: {
    target_actor_id: string;
    scopes: Array<'posting' | 'commenting'>;
    level: 'warning' | 'temporary' | 'permanent';
    expires_at?: string | null;
    reason: string;
  }): Promise<unknown>;
}
