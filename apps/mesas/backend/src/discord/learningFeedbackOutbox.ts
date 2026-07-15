import { sql } from 'kysely';
import { db } from '../db';
import {
  recordLabelAliasFromCorrection,
  recordLearningRulesFromCorrections,
  recordSystemEntityRule,
  type LearningRuleScope,
} from './learningRules';

export type LearningFeedbackStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface LearningFeedbackResult {
  correction_id: string;
  status: LearningFeedbackStatus;
  attempts: number;
  error: string | null;
}

export interface AppliedLearningApplication {
  rule_id: string;
  field: string;
  affected_fields: string[];
  before: unknown;
  after: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseDiff(value: unknown): Record<string, { before: unknown; after: unknown }> {
  const result: Record<string, { before: unknown; after: unknown }> = {};
  for (const [field, rawChange] of Object.entries(asRecord(value))) {
    const change = asRecord(rawChange);
    if (!Object.hasOwn(change, 'after')) continue;
    result[field] = { before: change.before, after: change.after };
  }
  return result;
}

function appliedApplications(payload: unknown): AppliedLearningApplication[] {
  const table = asRecord(asRecord(payload).table);
  const learning = asRecord(table._learning_applied);
  const applications = Array.isArray(learning.applications) ? learning.applications : [];
  return applications.flatMap((raw) => {
    const item = asRecord(raw);
    const ruleId = typeof item.rule_id === 'string' ? item.rule_id : '';
    const field = typeof item.field === 'string' ? item.field : '';
    const affectedFields = asStringArray(item.affected_fields);
    if (!ruleId || !field || affectedFields.length === 0) return [];
    return [{
      rule_id: ruleId,
      field,
      affected_fields: affectedFields,
      before: item.before,
      after: item.after,
    }];
  });
}

function isPresent(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

export function buildLearningFeedbackPlan(input: {
  parsedBefore: unknown;
  humanCorrected: unknown;
  diff: unknown;
  confirmedFields: unknown;
}) {
  const parsedBefore = asRecord(input.parsedBefore);
  const corrected = asRecord(input.humanCorrected);
  const beforeTable = asRecord(parsedBefore.table);
  const correctedTable = asRecord(corrected.table);
  const diff = parseDiff(input.diff);
  const entries = Object.entries(diff).map(([field, change]) => ({
    field,
    inputValue: change.before,
    outputValue: change.after,
  }));
  const confirmedFields = asStringArray(input.confirmedFields)
    .filter((field) => !field.startsWith('_') && !Object.hasOwn(diff, field))
    .filter((field) => Object.hasOwn(beforeTable, field)
      && JSON.stringify(beforeTable[field]) === JSON.stringify(correctedTable[field])
      && isPresent(correctedTable[field]));
  const correctedFields = new Set(Object.keys(diff));
  const rejectedApplications = appliedApplications(parsedBefore)
    .filter((application) => application.affected_fields.some((field) => correctedFields.has(field)));
  return { parsedBefore, corrected, beforeTable, correctedTable, diff, entries, confirmedFields, rejectedApplications };
}

function json(value: unknown) {
  return sql`${JSON.stringify(value ?? null)}::jsonb`;
}

async function markFailed(correctionId: string, error: unknown): Promise<LearningFeedbackResult> {
  const message = error instanceof Error ? error.message : 'unknown error';
  const row = await db
    .updateTable('import_corrections')
    .set({
      learning_status: 'failed',
      learning_attempts: sql`learning_attempts + 1`,
      learning_error: message.slice(0, 2000),
      learning_updated_at: new Date(),
    })
    .where('id', '=', correctionId)
    .where('learning_status', '!=', 'completed')
    .returning(['id', 'learning_status', 'learning_attempts', 'learning_error'])
    .executeTakeFirst();
  const current = row ?? await db
    .selectFrom('import_corrections')
    .select(['id', 'learning_status', 'learning_attempts', 'learning_error'])
    .where('id', '=', correctionId)
    .executeTakeFirst();
  return {
    correction_id: correctionId,
    status: current?.learning_status ?? 'failed',
    attempts: current?.learning_attempts ?? 1,
    error: current?.learning_error ?? message,
  };
}

export async function processLearningFeedbackCorrection(correctionId: string): Promise<LearningFeedbackResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const correction = await trx
        .selectFrom('import_corrections')
        .selectAll()
        .where('id', '=', correctionId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (correction.learning_status === 'completed') {
        return {
          correction_id: correction.id,
          status: 'completed' as const,
          attempts: correction.learning_attempts,
          error: null,
        };
      }

      const plan = buildLearningFeedbackPlan({
        parsedBefore: correction.parsed_before,
        humanCorrected: correction.human_corrected,
        diff: correction.diff,
        confirmedFields: correction.confirmed_fields,
      });
      const { beforeTable, correctedTable, diff, entries, confirmedFields, rejectedApplications } = plan;
      const source = asRecord(plan.parsedBefore.source) as LearningRuleScope;
      const strict = { throwOnError: true };

      await recordLearningRulesFromCorrections(entries, source, correction.corrected_by, trx, strict);
      await recordLabelAliasFromCorrection(entries, correction.raw_text, source, correction.corrected_by, trx, strict);
      await recordSystemEntityRule({
        sourceHint: beforeTable._system_source_hint ?? beforeTable.raw_system_hint,
        systemId: correctedTable.system_id,
        systemName: correctedTable.system_name,
        scope: source,
        userId: correction.corrected_by,
      }, trx, strict);

      const parseCase = await trx
        .selectFrom('discord_parse_cases')
        .select('id')
        .where('draft_id', '=', correction.draft_id)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();

      for (const [field, change] of Object.entries(diff)) {
        await trx.insertInto('discord_parse_feedback').values({
          correction_id: correction.id,
          parse_case_id: parseCase?.id ?? null,
          draft_id: correction.draft_id,
          feedback_type: 'field_correction',
          field,
          before_value: json(change.before),
          after_value: json(change.after),
          reason: correction.reason,
          scope_json: source,
          admin_user_id: correction.corrected_by,
        }).onConflict((oc) => oc.doNothing()).execute();
      }

      for (const field of confirmedFields) {
        await trx.insertInto('discord_parse_feedback').values({
          correction_id: correction.id,
          parse_case_id: parseCase?.id ?? null,
          draft_id: correction.draft_id,
          feedback_type: 'field_confirmation',
          field,
          before_value: json(correctedTable[field]),
          after_value: json(correctedTable[field]),
          reason: 'confirmed_on_save',
          scope_json: source,
          admin_user_id: correction.corrected_by,
        }).onConflict((oc) => oc.doNothing()).execute();
      }

      const correctedFields = new Set(Object.keys(diff));
      for (const application of rejectedApplications) {
        await trx.updateTable('discord_learning_rules').set({
          rejections: sql`rejections + 1`,
          confidence: sql`GREATEST(0.10, confidence - 0.20)`,
          status: 'suppressed',
          last_rejected_at: new Date(),
          updated_at: new Date(),
        }).where('id', '=', application.rule_id).execute();

        const correctedValues = Object.fromEntries(
          application.affected_fields
            .filter((field) => correctedFields.has(field))
            .map((field) => [field, correctedTable[field]]),
        );
        await trx.insertInto('discord_learning_rule_applications').values({
          rule_id: application.rule_id,
          parse_case_id: parseCase?.id ?? null,
          draft_id: correction.draft_id,
          field: application.field,
          before_value: json(application.after),
          after_value: json(correctedValues),
          outcome: 'rejected_by_human',
          reason: `correction:${correction.id}`,
        }).execute();
      }

      const completed = await trx.updateTable('import_corrections').set({
        learning_status: 'completed',
        learning_attempts: sql`learning_attempts + 1`,
        learning_error: null,
        learning_processed_at: new Date(),
        learning_updated_at: new Date(),
      }).where('id', '=', correction.id)
        .returning(['id', 'learning_status', 'learning_attempts'])
        .executeTakeFirstOrThrow();

      return {
        correction_id: completed.id,
        status: completed.learning_status,
        attempts: completed.learning_attempts,
        error: null,
      };
    });
  } catch (error: unknown) {
    console.error('[processLearningFeedbackCorrection]', error instanceof Error ? error.message : 'unknown error');
    return markFailed(correctionId, error);
  }
}

export async function retryLearningFeedbackForDraft(draftId: string): Promise<LearningFeedbackResult[]> {
  const pending = await db.selectFrom('import_corrections')
    .select('id')
    .where('draft_id', '=', draftId)
    .where('learning_status', 'in', ['pending', 'failed'])
    .orderBy('created_at', 'asc')
    .limit(20)
    .execute();
  const results: LearningFeedbackResult[] = [];
  for (const row of pending) results.push(await processLearningFeedbackCorrection(row.id));
  return results;
}
