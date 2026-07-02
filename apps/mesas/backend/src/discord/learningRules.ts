import crypto from 'node:crypto';
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';
import { db } from '../db';
import type { Database } from '../db/types';
import { LEARNABLE_FIELDS, normalizeToken, type FieldLearningEntry, type LearnableField } from './fieldLearning';

export type LearningRuleType =
  | 'field_value'
  | 'label_alias'
  | 'classification'
  | 'discard_rule'
  | 'duplicate_rule'
  | 'negative_rule';

export type LearningRuleScopeType = 'global' | 'guild' | 'channel' | 'profile' | 'author' | 'composite';
export type LearningRuleStatus = 'candidate' | 'active' | 'suppressed' | 'retired';
export type LearningRuleSource = 'human' | 'confirmed_ai' | 'migration_seed';

export interface LearningRuleScope {
  guild_id?: string | null;
  channel_id?: string | null;
  author_id?: string | null;
  profile_id?: string | null;
}

export interface LearningRuleHit {
  ruleId: string;
  field: string;
  value: unknown;
  confidence: number;
  scopeType: LearningRuleScopeType;
}

export interface LearningRuleConflict {
  field: string;
  token: string;
  values: unknown[];
  ruleIds: string[];
}

export interface LearningRuleLookupResult {
  hits: LearningRuleHit[];
  conflicts: LearningRuleConflict[];
}

const LEARNABLE_SET = new Set<string>(LEARNABLE_FIELDS);
const ACTIVE_CONFIDENCE = 0.8;
const CANDIDATE_CONFIDENCE = 0.65;

function stableJson(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return JSON.stringify(value ?? {});
  const record = value as Record<string, unknown>;
  return JSON.stringify(Object.keys(record).sort().reduce<Record<string, unknown>>((acc, key) => {
    const item = record[key];
    if (item !== undefined && item !== null && item !== '') acc[key] = item;
    return acc;
  }, {}));
}

function hashScope(scopeType: LearningRuleScopeType, scope: Record<string, unknown>): string {
  return crypto.createHash('sha256').update(`${scopeType}:${stableJson(scope)}`).digest('hex');
}

export function deriveScope(scope: LearningRuleScope | undefined | null): {
  scopeType: LearningRuleScopeType;
  scopeJson: Record<string, unknown>;
  scopeHash: string;
} {
  const clean = {
    guild_id: scope?.guild_id ?? null,
    channel_id: scope?.channel_id ?? null,
    author_id: scope?.author_id ?? null,
    profile_id: scope?.profile_id ?? null,
  };
  const filled = Object.entries(clean).filter(([, value]) => typeof value === 'string' && value.length > 0);
  const scopeJson = Object.fromEntries(filled);
  let scopeType: LearningRuleScopeType = 'global';
  if (filled.length > 1) scopeType = 'composite';
  else if (filled[0]?.[0] === 'guild_id') scopeType = 'guild';
  else if (filled[0]?.[0] === 'channel_id') scopeType = 'channel';
  else if (filled[0]?.[0] === 'author_id') scopeType = 'author';
  else if (filled[0]?.[0] === 'profile_id') scopeType = 'profile';
  return { scopeType, scopeJson, scopeHash: hashScope(scopeType, scopeJson) };
}

function normalizeJsonValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function isLearnableCorrection(entry: FieldLearningEntry): entry is FieldLearningEntry & { field: LearnableField } {
  return LEARNABLE_SET.has(entry.field)
    && normalizeToken(entry.inputValue) !== null
    && entry.outputValue !== null
    && entry.outputValue !== undefined
    && entry.outputValue !== '';
}

function confidenceFromCounts(hits: number, rejections: number): number {
  const total = hits + rejections;
  if (total <= 0) return CANDIDATE_CONFIDENCE;
  const ratio = hits / total;
  return Math.max(0.1, Math.min(0.98, Number((0.45 + ratio * 0.5).toFixed(4))));
}

export async function recordLearningRulesFromCorrections(
  entries: FieldLearningEntry[],
  scope: LearningRuleScope | undefined | null,
  userId: string | null,
  conn: Kysely<Database> | Transaction<Database> = db,
): Promise<void> {
  const derived = deriveScope(scope);
  for (const entry of entries) {
    if (!isLearnableCorrection(entry)) continue;
    const inputToken = normalizeToken(entry.inputValue);
    if (!inputToken) continue;
    const outputJson = normalizeJsonValue(entry.outputValue);

    try {
      const builder = conn.insertInto('discord_learning_rules');
      if (!builder || typeof (builder as { values?: unknown }).values !== 'function') continue;
      await builder
        .values({
          rule_type: 'field_value',
          field: entry.field,
          input_token: inputToken,
          input_pattern: null,
          output_value: sql`${outputJson}::jsonb`,
          scope_type: derived.scopeType,
          scope_json: derived.scopeJson,
          scope_hash: derived.scopeHash,
          confidence: CANDIDATE_CONFIDENCE,
          status: 'candidate',
          source: 'human',
        })
        .onConflict((oc) =>
          oc.columns(['rule_type', 'field', 'input_token', 'scope_hash']).doUpdateSet({
            output_value: sql`${outputJson}::jsonb`,
            hits: sql`discord_learning_rules.hits + 1`,
            rejections: sql`CASE WHEN discord_learning_rules.output_value IS DISTINCT FROM ${outputJson}::jsonb THEN discord_learning_rules.rejections + 1 ELSE discord_learning_rules.rejections END`,
            confidence: sql`LEAST(0.98, CASE WHEN discord_learning_rules.output_value IS DISTINCT FROM ${outputJson}::jsonb THEN GREATEST(0.10, discord_learning_rules.confidence - 0.20) ELSE discord_learning_rules.confidence + 0.08 END)`,
            status: sql`CASE WHEN discord_learning_rules.output_value IS DISTINCT FROM ${outputJson}::jsonb THEN 'suppressed' ELSE CASE WHEN discord_learning_rules.confidence >= 0.72 THEN 'active' ELSE discord_learning_rules.status END END`,
            last_rejected_at: sql`CASE WHEN discord_learning_rules.output_value IS DISTINCT FROM ${outputJson}::jsonb THEN NOW() ELSE discord_learning_rules.last_rejected_at END`,
            updated_at: sql`NOW()`,
          }),
        )
        .execute();
    } catch (error: unknown) {
      console.error('[recordLearningRulesFromCorrections]', error instanceof Error ? error.message : 'unknown error', userId);
    }
  }
}

function scopePredicates(scope: LearningRuleScope | undefined | null): Array<ReturnType<typeof deriveScope>> {
  const scopes = [deriveScope(null)];
  if (scope?.guild_id) scopes.push(deriveScope({ guild_id: scope.guild_id }));
  if (scope?.channel_id) scopes.push(deriveScope({ channel_id: scope.channel_id }));
  if (scope?.author_id) scopes.push(deriveScope({ author_id: scope.author_id }));
  if (scope?.guild_id && scope?.channel_id) scopes.push(deriveScope({ guild_id: scope.guild_id, channel_id: scope.channel_id }));
  if (scope?.guild_id && scope?.author_id) scopes.push(deriveScope({ guild_id: scope.guild_id, author_id: scope.author_id }));
  return scopes;
}

function sameJsonValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function lookupLearningRules(
  queries: Array<{ field: string; value: unknown }>,
  scope: LearningRuleScope | undefined | null,
  conn: Kysely<Database> = db,
): Promise<LearningRuleLookupResult> {
  const keyed = queries
    .map((query) => ({ field: query.field, token: normalizeToken(query.value) }))
    .filter((query): query is { field: string; token: string } => Boolean(query.token) && LEARNABLE_SET.has(query.field));
  if (keyed.length === 0) return { hits: [], conflicts: [] };

  const scopeHashes = scopePredicates(scope).map((item) => item.scopeHash);
  const hits: LearningRuleHit[] = [];
  const conflicts: LearningRuleConflict[] = [];

  try {
    for (const { field, token } of keyed) {
      const rows = await conn
        .selectFrom('discord_learning_rules')
        .select(['id', 'output_value', 'confidence', 'scope_type'])
        .where('rule_type', '=', 'field_value')
        .where('field', '=', field)
        .where('input_token', '=', token)
        .where('status', '=', 'active')
        .where('confidence', '>=', ACTIVE_CONFIDENCE)
        .where('scope_hash', 'in', scopeHashes)
        .orderBy('confidence', 'desc')
        .orderBy('updated_at', 'desc')
        .limit(5)
        .execute();

      if (rows.length === 0) continue;
      const distinctValues = rows.reduce<unknown[]>((acc, row) => {
        if (!acc.some((value) => sameJsonValue(value, row.output_value))) acc.push(row.output_value);
        return acc;
      }, []);

      if (distinctValues.length > 1) {
        conflicts.push({ field, token, values: distinctValues, ruleIds: rows.map((row) => row.id) });
        continue;
      }

      const best = rows[0];
      hits.push({
        ruleId: best.id,
        field,
        value: best.output_value,
        confidence: Number(best.confidence),
        scopeType: best.scope_type as LearningRuleScopeType,
      });
    }
    return { hits, conflicts };
  } catch (error: unknown) {
    console.error('[lookupLearningRules]', error instanceof Error ? error.message : 'unknown error');
    return { hits: [], conflicts: [] };
  }
}

export async function recordLearningRuleApplications(input: {
  hits: LearningRuleHit[];
  draftId?: string | null;
  parseCaseId?: string | null;
  beforeValues?: Record<string, unknown>;
  outcome?: 'applied' | 'conflict' | 'rejected_by_guard' | 'shadow';
  reason?: string | null;
}): Promise<void> {
  for (const hit of input.hits) {
    try {
      const builder = db.insertInto('discord_learning_rule_applications');
      if (!builder || typeof (builder as { values?: unknown }).values !== 'function') continue;
      await builder
        .values({
          rule_id: hit.ruleId,
          parse_case_id: input.parseCaseId ?? null,
          draft_id: input.draftId ?? null,
          field: hit.field,
          before_value: normalizeJsonValue(input.beforeValues?.[hit.field]),
          after_value: hit.value,
          outcome: input.outcome ?? 'applied',
          reason: input.reason ?? null,
        })
        .execute();

      await db
        .updateTable('discord_learning_rules')
        .set({
          applied_count: sql`applied_count + 1`,
          last_applied_at: sql`NOW()`,
          updated_at: sql`NOW()`,
        })
        .where('id', '=', hit.ruleId)
        .execute();
    } catch (error: unknown) {
      console.error('[recordLearningRuleApplications]', error instanceof Error ? error.message : 'unknown error');
    }
  }
}

export function nextRuleState(input: { hits: number; rejections: number; outputChanged: boolean }): {
  confidence: number;
  status: LearningRuleStatus;
} {
  const hits = input.hits + (input.outputChanged ? 0 : 1);
  const rejections = input.rejections + (input.outputChanged ? 1 : 0);
  const confidence = confidenceFromCounts(hits, rejections);
  if (input.outputChanged || rejections >= 2) return { confidence, status: 'suppressed' };
  if (hits >= 2 && confidence >= ACTIVE_CONFIDENCE) return { confidence, status: 'active' };
  return { confidence, status: 'candidate' };
}
