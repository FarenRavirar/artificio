import { sql } from 'kysely';
import { db } from '../db';
import type { DiscordParseCase } from '../db/types';

export type RetrievedExampleGroup =
  | 'duplicate_candidates'
  | 'similar_cases'
  | 'positive_examples'
  | 'negative_examples'
  | 'corrected_examples';

export interface DuplicateSignals {
  raw_hash_exact: boolean;
  normalized_hash_exact: boolean;
  same_form_url: boolean;
  shared_form_urls: string[];
  shared_attachment_urls: string[];
  same_guild: boolean;
  same_channel: boolean;
  same_author: boolean;
  same_system_hint: boolean;
  text_similarity: number;
}

export interface RetrievedParseCase {
  id: string;
  draft_id: string | null;
  final_action: string;
  raw_hash: string;
  normalized_hash: string;
  normalized_text: string;
  guild_id: string | null;
  channel_id: string | null;
  author_id: string | null;
  features_json: unknown;
  final_result_json: unknown;
  text_similarity: number;
  has_field_correction: boolean;
  has_publish_feedback: boolean;
  has_discard_feedback: boolean;
}

export interface ScoredParseCase extends RetrievedParseCase {
  score: number;
  signals: DuplicateSignals;
}

export interface RetrievalContext {
  duplicate_candidates: ScoredParseCase[];
  similar_cases: ScoredParseCase[];
  positive_examples: ScoredParseCase[];
  negative_examples: ScoredParseCase[];
  corrected_examples: ScoredParseCase[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const TRAILING_PUNCT = new Set(['.', ',', ';', ':']);

/** Remove pontuação de fechamento no fim da URL sem regex de quantificador+âncora (Sonar S5852). */
function stripTrailingPunct(url: string): string {
  let end = url.length;
  while (end > 0 && TRAILING_PUNCT.has(url[end - 1])) end -= 1;
  return url.slice(0, end);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function extractFinalResultRecord(caseRow: Pick<DiscordParseCase, 'final_result_json'> | RetrievedParseCase): Record<string, unknown> {
  const finalResult = asRecord(caseRow.final_result_json);
  const payload = asRecord(finalResult.payload);
  const normalized = asRecord(finalResult.normalized);
  return Object.keys(payload).length > 0 ? payload : normalized;
}

export function extractSystemHint(caseRow: Pick<DiscordParseCase, 'final_result_json'> | RetrievedParseCase): string | null {
  const result = extractFinalResultRecord(caseRow);
  const system = result.system_name ?? result.system ?? result.systemId ?? result.system_id;
  return typeof system === 'string' && system.trim().length > 0 ? system.trim().toLowerCase() : null;
}

export function extractStructuralUrls(caseRow: Pick<DiscordParseCase, 'features_json' | 'normalized_text'>): {
  form_urls: string[];
  attachment_urls: string[];
} {
  const features = asRecord(caseRow.features_json);
  const formUrls = new Set(asStringArray(features.form_urls));
  const attachmentUrls = new Set(asStringArray(features.attachment_urls));
  const urlMatches = caseRow.normalized_text.match(/https?:\/\/[^\s)>\]]+/g) ?? [];
  for (const url of urlMatches) {
    const cleanUrl = stripTrailingPunct(url);
    if (/forms\.gle|docs\.google\.com\/forms/i.test(cleanUrl)) {
      formUrls.add(cleanUrl);
    }
  }
  return {
    form_urls: [...formUrls].sort((a, b) => a.localeCompare(b)),
    attachment_urls: [...attachmentUrls].sort((a, b) => a.localeCompare(b)),
  };
}

function intersection(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => rightSet.has(item));
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(4))));
}

export function buildDuplicateSignals(current: DiscordParseCase, candidate: RetrievedParseCase): DuplicateSignals {
  const currentUrls = extractStructuralUrls(current);
  const candidateUrls = extractStructuralUrls(candidate);
  const sharedFormUrls = intersection(currentUrls.form_urls, candidateUrls.form_urls);
  const sharedAttachmentUrls = intersection(currentUrls.attachment_urls, candidateUrls.attachment_urls);
  const currentSystem = extractSystemHint(current);
  const candidateSystem = extractSystemHint(candidate);

  return {
    raw_hash_exact: current.raw_hash === candidate.raw_hash,
    normalized_hash_exact: current.normalized_hash === candidate.normalized_hash,
    same_form_url: sharedFormUrls.length > 0,
    shared_form_urls: sharedFormUrls,
    shared_attachment_urls: sharedAttachmentUrls,
    same_guild: Boolean(current.guild_id && current.guild_id === candidate.guild_id),
    same_channel: Boolean(current.channel_id && current.channel_id === candidate.channel_id),
    same_author: Boolean(current.author_id && current.author_id === candidate.author_id),
    same_system_hint: Boolean(currentSystem && currentSystem === candidateSystem),
    text_similarity: clampScore(candidate.text_similarity),
  };
}

export function scoreDuplicateCandidate(signals: DuplicateSignals): number {
  // Hash exato só vira duplicata forte se houver outro sinal — protege
  // attachment-only/embed-only quando o texto dá hash de string vazia.
  const hasCorroboratingSignal =
    signals.same_form_url
    || signals.shared_attachment_urls.length > 0
    || signals.same_channel
    || signals.same_author
    || signals.same_system_hint;
  if (signals.raw_hash_exact && hasCorroboratingSignal) return 1;
  if (signals.normalized_hash_exact && hasCorroboratingSignal) return 0.97;
  if (signals.raw_hash_exact) return 0.6;
  if (signals.normalized_hash_exact) return 0.55;

  let score = signals.text_similarity * 0.62;
  if (signals.same_form_url) score += 0.22;
  if (signals.shared_attachment_urls.length > 0) score += 0.08;
  if (signals.same_system_hint) score += 0.08;
  if (signals.same_channel) score += 0.06;
  else if (signals.same_guild) score += 0.03;
  if (signals.same_author) score += 0.03;

  return clampScore(score);
}

export function buildRetrievalContext(current: DiscordParseCase, rows: RetrievedParseCase[]): RetrievalContext {
  const scored = rows
    .map((row) => {
      const signals = buildDuplicateSignals(current, row);
      return { ...row, signals, score: scoreDuplicateCandidate(signals) };
    })
    .sort((left, right) => right.score - left.score || right.text_similarity - left.text_similarity);

  return {
    duplicate_candidates: scored.filter((row) => row.score >= 0.75),
    similar_cases: scored.filter((row) => row.score >= 0.35),
    positive_examples: scored.filter((row) => row.final_action === 'synced' || row.has_publish_feedback),
    negative_examples: scored.filter((row) => ['discard', 'rejected', 'ignore'].includes(row.final_action) || row.has_discard_feedback),
    corrected_examples: scored.filter((row) => row.has_field_correction),
  };
}

export async function loadRetrievalContext(parseCaseId: string, limit = 20): Promise<RetrievalContext | null> {
  const current = await db
    .selectFrom('discord_parse_cases')
    .selectAll()
    .where('id', '=', parseCaseId)
    .executeTakeFirst();
  if (!current) return null;

  const currentUrls = extractStructuralUrls(current);
  const formUrlPredicates = currentUrls.form_urls.map((url) => {
    const likePattern = `%${url}%`;
    return sql<boolean>`candidate.normalized_text LIKE ${likePattern}`;
  });
  const structuralPredicate = formUrlPredicates.length > 0
    ? sql<boolean>`OR (${sql.join(formUrlPredicates, sql` OR `)})`
    : sql<boolean>``;

  const result = await sql<RetrievedParseCase>`
    SELECT
      candidate.id,
      candidate.draft_id,
      candidate.final_action,
      candidate.raw_hash,
      candidate.normalized_hash,
      candidate.normalized_text,
      candidate.guild_id,
      candidate.channel_id,
      candidate.author_id,
      candidate.features_json,
      candidate.final_result_json,
      similarity(candidate.normalized_text, ${current.normalized_text})::float AS text_similarity,
      EXISTS (
        SELECT 1 FROM discord_parse_feedback feedback
        WHERE feedback.parse_case_id = candidate.id
          AND feedback.feedback_type = 'field_correction'
      ) AS has_field_correction,
      EXISTS (
        SELECT 1 FROM discord_parse_feedback feedback
        WHERE feedback.parse_case_id = candidate.id
          AND feedback.feedback_type = 'publish'
      ) AS has_publish_feedback,
      EXISTS (
        SELECT 1 FROM discord_parse_feedback feedback
        WHERE feedback.parse_case_id = candidate.id
          AND feedback.feedback_type = 'discard'
      ) AS has_discard_feedback
    FROM discord_parse_cases candidate
    WHERE candidate.id <> ${current.id}
      AND (
        candidate.raw_hash = ${current.raw_hash}
        OR candidate.normalized_hash = ${current.normalized_hash}
        OR similarity(candidate.normalized_text, ${current.normalized_text}) >= 0.28
        OR (
          candidate.guild_id IS NOT NULL
          AND candidate.guild_id = ${current.guild_id}
          AND candidate.created_at >= NOW() - INTERVAL '30 days'
          AND (
            candidate.channel_id = ${current.channel_id}
            OR candidate.author_id = ${current.author_id}
            OR similarity(candidate.normalized_text, ${current.normalized_text}) >= 0.15
          )
        )
        ${structuralPredicate}
      )
    ORDER BY
      CASE
        WHEN candidate.raw_hash = ${current.raw_hash} THEN 1
        WHEN candidate.normalized_hash = ${current.normalized_hash} THEN 2
        ELSE 3
      END,
      similarity(candidate.normalized_text, ${current.normalized_text}) DESC,
      candidate.created_at DESC
    LIMIT ${limit}
  `.execute(db);

  return buildRetrievalContext(current, result.rows);
}

export async function persistDuplicateCandidatesForCase(parseCaseId: string): Promise<void> {
  try {
    const context = await loadRetrievalContext(parseCaseId);
    if (!context) return;

    for (const candidate of context.duplicate_candidates.slice(0, 10)) {
      await db
        .insertInto('discord_duplicate_candidates')
        .values({
          parse_case_id: parseCaseId,
          candidate_case_id: candidate.id,
          score: candidate.score,
          signals_json: candidate.signals,
        })
        .onConflict((oc) =>
          oc.columns(['parse_case_id', 'candidate_case_id']).doUpdateSet({
            score: candidate.score,
            signals_json: candidate.signals,
            updated_at: new Date(),
          }),
        )
        .execute();
    }
  } catch (error: unknown) {
    console.error('[persistDuplicateCandidatesForCase]', error instanceof Error ? error.message : 'unknown error');
  }
}
