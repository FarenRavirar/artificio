import crypto from 'node:crypto';
import { z } from 'zod';
import { db } from '../db';
import { persistDuplicateCandidatesForCase } from './parseRetrieval';

export const PARSE_LEARNING_PARSER_VERSION = '058-fase3-v1';

const parseFinalActionSchema = z.enum(['draft', 'needs_review', 'discard', 'ignore', 'synced', 'rejected', 'error']);
const parseFeedbackTypeSchema = z.enum([
  'field_correction',
  'status_change',
  'discard',
  'undiscard',
  'duplicate',
  'not_duplicate',
  'ignore',
  'publish',
]);
const nullableIdSchema = z.string().min(1).nullable();

export const parseCaseContractSchema = z.object({
  discord_message_id: nullableIdSchema,
  import_message_id: nullableIdSchema,
  draft_id: nullableIdSchema,
  import_run_id: nullableIdSchema,
  guild_id: z.string().nullable(),
  channel_id: z.string().nullable(),
  author_id: z.string().nullable(),
  raw_hash: z.string().min(1),
  normalized_hash: z.string().min(1),
  normalized_text: z.string(),
  features_json: z.record(z.string(), z.unknown()),
  deterministic_result_json: z.unknown().nullable(),
  retrieval_context_json: z.unknown().nullable(),
  llm_context_hash: z.string().nullable(),
  final_result_json: z.unknown().nullable(),
  final_action: parseFinalActionSchema,
  parser_version: z.string().min(1),
  prompt_version: z.string().nullable(),
  model: z.string().nullable(),
});

export const parseFeedbackContractSchema = z.object({
  parse_case_id: nullableIdSchema,
  draft_id: nullableIdSchema,
  feedback_type: parseFeedbackTypeSchema,
  field: z.string().nullable(),
  before_value: z.unknown().nullable(),
  after_value: z.unknown().nullable(),
  reason: z.string().nullable(),
  scope_json: z.record(z.string(), z.unknown()),
  admin_user_id: nullableIdSchema,
});

export type ParseFinalAction = z.infer<typeof parseFinalActionSchema>;
export type ParseFeedbackType = z.infer<typeof parseFeedbackTypeSchema>;
export type ParseCaseContract = z.infer<typeof parseCaseContractSchema>;
export type ParseFeedbackContract = z.infer<typeof parseFeedbackContractSchema>;

interface ParseLearningMessage {
  id: string;
  discord_guild_id?: string | null;
  discord_channel_id?: string | null;
  discord_author_id?: string | null;
  content_raw?: unknown;
  attachments?: unknown;
  embeds?: unknown;
  source_kind?: unknown;
  discord_thread_name?: unknown;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function normalizeParseLearningText(rawText: unknown): string {
  return String(rawText ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractStringValue(source: unknown, keys: string[]): string | null {
  if (!source || typeof source !== 'object') return null;
  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function extractUrlsFromText(rawText: string): string[] {
  return [...new Set(
    (rawText.match(/https?:\/\/[^\s)>\]]+/gi) ?? [])
      .map((url) => url.replace(/[.,;:]+$/g, '').toLowerCase()),
  )].sort();
}

function buildFeatures(message: ParseLearningMessage, normalizedText: string): Record<string, unknown> {
  const attachments = parseJsonArray(message.attachments);
  const embeds = parseJsonArray(message.embeds);
  const rawText = String(message.content_raw ?? '');
  const textUrls = extractUrlsFromText(rawText);
  const attachmentUrls = attachments
    .map((attachment) => extractStringValue(attachment, ['url', 'proxy_url', 'attachment_url']))
    .filter((url): url is string => Boolean(url))
    .map((url) => url.toLowerCase())
    .sort();
  const embedUrls = embeds
    .flatMap((embed) => [
      extractStringValue(embed, ['url']),
      extractStringValue((embed as Record<string, unknown> | null)?.image, ['url']),
      extractStringValue((embed as Record<string, unknown> | null)?.thumbnail, ['url']),
    ])
    .filter((url): url is string => Boolean(url))
    .map((url) => url.toLowerCase())
    .sort();
  const formUrls = [...new Set([...textUrls, ...embedUrls].filter((url) => /forms\.gle|docs\.google\.com\/forms/i.test(url)))].sort();
  return {
    source_kind: message.source_kind,
    thread_name_present: Boolean(message.discord_thread_name),
    text_length: rawText.length,
    normalized_text_length: normalizedText.length,
    attachments_count: attachments.length,
    embeds_count: embeds.length,
    has_form_url: formUrls.length > 0,
    has_price_signal: /\b(r\$|reais?|gratuit[ao]|sem custo|valor|paga)\b/i.test(rawText),
    text_urls: textUrls,
    form_urls: formUrls,
    attachment_urls: attachmentUrls,
    embed_urls: embedUrls,
  };
}

export function buildParseCaseContract(input: {
  message: ParseLearningMessage;
  discordMessageId?: string | null;
  draftId?: string | null;
  importMessageId?: string | null;
  importRunId?: string | null;
  deterministicResult?: unknown | null;
  finalResult?: unknown | null;
  finalAction: ParseFinalAction;
  promptVersion?: string | null;
  model?: string | null;
}): ParseCaseContract {
  const rawText = String(input.message.content_raw ?? '');
  const normalizedText = normalizeParseLearningText(rawText);
  const contract: ParseCaseContract = {
    discord_message_id: input.discordMessageId === undefined ? input.message.id : input.discordMessageId,
    import_message_id: input.importMessageId ?? null,
    draft_id: input.draftId ?? null,
    import_run_id: input.importRunId ?? null,
    guild_id: input.message.discord_guild_id ?? null,
    channel_id: input.message.discord_channel_id ?? null,
    author_id: input.message.discord_author_id ?? null,
    raw_hash: sha256(rawText),
    normalized_hash: sha256(normalizedText),
    normalized_text: normalizedText,
    features_json: buildFeatures(input.message, normalizedText),
    deterministic_result_json: input.deterministicResult ?? null,
    retrieval_context_json: null,
    llm_context_hash: null,
    final_result_json: input.finalResult ?? null,
    final_action: input.finalAction,
    parser_version: PARSE_LEARNING_PARSER_VERSION,
    prompt_version: input.promptVersion ?? null,
    model: input.model ?? null,
  };
  return parseCaseContractSchema.parse(contract);
}

export async function recordParseCase(input: Parameters<typeof buildParseCaseContract>[0]): Promise<string | null> {
  try {
    const contract = buildParseCaseContract(input);
    const builder = db.insertInto('discord_parse_cases');
    if (!builder || typeof (builder as { values?: unknown }).values !== 'function') return null;
    const inserted = await builder
      .values(contract)
      .returning('id')
      .executeTakeFirst();
    const insertedId = inserted?.id ?? null;
    if (insertedId) {
      void persistDuplicateCandidatesForCase(insertedId);
    }
    return insertedId;
  } catch (error: unknown) {
    console.error('[recordParseCase]', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

async function findLatestParseCaseIdForDraft(draftId: string): Promise<string | null> {
  const row = await db
    .selectFrom('discord_parse_cases')
    .select('id')
    .where('draft_id', '=', draftId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row?.id ?? null;
}

export async function recordParseFeedback(input: {
  draftId?: string | null;
  parseCaseId?: string | null;
  feedbackType: ParseFeedbackType;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  reason?: string | null;
  scope?: Record<string, unknown>;
  adminUserId?: string | null;
}): Promise<void> {
  try {
    const parseCaseId = input.parseCaseId ?? (input.draftId ? await findLatestParseCaseIdForDraft(input.draftId) : null);
    const contract = parseFeedbackContractSchema.parse({
      parse_case_id: parseCaseId,
      draft_id: input.draftId ?? null,
      feedback_type: input.feedbackType,
      field: input.field ?? null,
      before_value: input.beforeValue ?? null,
      after_value: input.afterValue ?? null,
      reason: input.reason ?? null,
      scope_json: input.scope ?? {},
      admin_user_id: input.adminUserId ?? null,
    });

    const builder = db.insertInto('discord_parse_feedback');
    if (!builder || typeof (builder as { values?: unknown }).values !== 'function') return;
    await builder.values(contract).execute();
  } catch (error: unknown) {
    console.error('[recordParseFeedback]', error instanceof Error ? error.message : 'unknown error');
  }
}

export async function recordParseFeedbackForCorrections(input: {
  draftId: string;
  diff: Record<string, { before: unknown; after: unknown }>;
  reason?: string | null;
  adminUserId?: string | null;
  scope?: Record<string, unknown>;
}): Promise<void> {
  for (const [field, change] of Object.entries(input.diff)) {
    await recordParseFeedback({
      draftId: input.draftId,
      feedbackType: 'field_correction',
      field,
      beforeValue: change.before,
      afterValue: change.after,
      reason: input.reason ?? null,
      scope: input.scope,
      adminUserId: input.adminUserId ?? null,
    });
  }
}

export function parseActionFromDraftStatus(status: string): ParseFinalAction {
  if (status === 'rejected') return 'rejected';
  if (status === 'synced') return 'synced';
  if (status === 'needs_review') return 'needs_review';
  return 'draft';
}

export function parseActionFromNormalizedStatus(status: string): ParseFinalAction {
  return status === 'needs_review' ? 'needs_review' : 'draft';
}

export function extractDraftScope(payload: unknown): Record<string, unknown> {
  const source =
    payload && typeof payload === 'object' && 'source' in payload
      ? (payload as { source?: Record<string, unknown> | null }).source
      : null;
  return {
    guild_id: source?.guild_id ?? null,
    channel_id: source?.channel_id ?? null,
    message_id: source?.message_id ?? null,
  };
}
