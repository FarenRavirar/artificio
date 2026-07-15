import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import type { ParseFinalAction } from './parseLearning';

export const PARSE_EVAL_FIELDS = [
  'action',
  'price_type',
  'system_name',
  'slots_total',
  'slots_open',
  'day_of_week',
  'start_time',
  'contact_url',
] as const;

export type ParseEvalField = typeof PARSE_EVAL_FIELDS[number];
export type ParsePredictionLayer = 'parser' | 'learning' | 'deepseek';

export interface ParseEvalExample {
  id: string;
  predicted_action: string;
  expected_action: string;
  expected_payload: Record<string, unknown>;
  parser_prediction: Record<string, unknown>;
  learning_prediction: Record<string, unknown> | null;
  deepseek_prediction: Record<string, unknown> | null;
}

export interface ParseEvalMetric {
  field: ParseEvalField;
  total: number;
  correct: number;
  accuracy: number | null;
}

export interface LayeredParseEvalResult {
  layer: ParsePredictionLayer;
  examples: number;
  metrics: ParseEvalMetric[];
}

const parseEvalFeedbackTypeSchema = z.enum([
  'field_correction',
  'discard',
  'duplicate',
  'not_duplicate',
  'ignore',
  'publish',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function tableOf(value: unknown): Record<string, unknown> {
  const record = asRecord(value);
  const table = asRecord(record?.table);
  return table ?? record ?? {};
}

function normalizeComparable(field: ParseEvalField, value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (field === 'contact_url') {
    try {
      const url = new URL(trimmed);
      return `${url.protocol.toLowerCase()}//${url.hostname.toLowerCase()}${url.pathname}${url.search}${url.hash}`;
    } catch {
      return trimmed;
    }
  }
  return trimmed.toLowerCase();
}

function equalValue(field: ParseEvalField, left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeComparable(field, left)) === JSON.stringify(normalizeComparable(field, right));
}

function withTablePatch(base: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const record = asRecord(base) ?? {};
  return {
    ...record,
    table: {
      ...tableOf(record),
      ...patch,
    },
  };
}

function suggestionProvider(payload: unknown): string | null {
  const suggestions = asRecord(tableOf(payload)._ai_suggestions);
  const provider = suggestions?.provider;
  return typeof provider === 'string' ? provider.toLowerCase() : null;
}

function suggestionFields(payload: unknown): Record<string, unknown> {
  const suggestions = asRecord(tableOf(payload)._ai_suggestions);
  return asRecord(suggestions?.fields) ?? {};
}

function appliedLearningFields(payload: unknown): Record<string, unknown> {
  const applied = asRecord(tableOf(payload)._learning_applied);
  return asRecord(applied?.fields) ?? {};
}

export function buildLayerPrediction(
  layer: ParsePredictionLayer,
  deterministicResult: unknown,
  finalResult: unknown,
): Record<string, unknown> | null {
  if (layer === 'parser') return asRecord(deterministicResult) ?? {};

  const provider = suggestionProvider(finalResult);
  const learningFields = appliedLearningFields(finalResult);

  if (layer === 'learning' && Object.keys(learningFields).length > 0) {
    return withTablePatch(finalResult, learningFields);
  }
  if (!provider) return null;

  if (layer === 'learning' && !provider.includes('learning')) return null;
  if (layer === 'deepseek' && !provider.includes('deepseek')) return null;

  return withTablePatch(finalResult, suggestionFields(finalResult));
}

export function buildParseEvalExample(input: {
  id: string;
  deterministicResult: unknown;
  finalResult: unknown;
  finalAction: string;
  feedback: Array<{
    feedback_type: string;
    field: string | null;
    after_value: unknown;
  }>;
}): ParseEvalExample | null {
  const parserPrediction = buildLayerPrediction('parser', input.deterministicResult, input.finalResult);
  if (!parserPrediction) return null;

  let expectedAction = input.finalAction;
  let expectedPayload = asRecord(input.finalResult) ?? asRecord(input.deterministicResult) ?? {};
  const fieldPatch: Record<string, unknown> = {};
  let hasHumanLabel = false;

  for (const feedback of input.feedback) {
    const parsedType = parseEvalFeedbackTypeSchema.safeParse(feedback.feedback_type);
    if (!parsedType.success) continue;
    hasHumanLabel = true;

    if (parsedType.data === 'field_correction' && feedback.field) {
      fieldPatch[feedback.field] = feedback.after_value;
    } else if (parsedType.data === 'discard') {
      expectedAction = 'discard';
    } else if (parsedType.data === 'duplicate') {
      expectedAction = 'duplicate';
    } else if (parsedType.data === 'not_duplicate') {
      expectedAction = 'draft';
    } else if (parsedType.data === 'ignore') {
      expectedAction = 'ignore';
    } else if (parsedType.data === 'publish') {
      expectedAction = 'publish';
    }
  }

  if (!hasHumanLabel) return null;
  if (Object.keys(fieldPatch).length > 0) expectedPayload = withTablePatch(expectedPayload, fieldPatch);

  return {
    id: input.id,
    predicted_action: input.finalAction,
    expected_action: expectedAction,
    expected_payload: expectedPayload,
    parser_prediction: parserPrediction,
    learning_prediction: buildLayerPrediction('learning', input.deterministicResult, input.finalResult),
    deepseek_prediction: buildLayerPrediction('deepseek', input.deterministicResult, input.finalResult),
  };
}

function valueForField(field: ParseEvalField, payload: Record<string, unknown>, action: string): unknown {
  if (field === 'action') return action;
  return tableOf(payload)[field];
}

export function evaluateParseLayer(
  examples: ParseEvalExample[],
  layer: ParsePredictionLayer,
): LayeredParseEvalResult {
  return {
    layer,
    examples: examples.length,
    metrics: PARSE_EVAL_FIELDS.map((field) => {
      let total = 0;
      let correct = 0;
      for (const example of examples) {
        const prediction = getLayerPrediction(example, layer);
        if (!prediction) continue;

        const expected = valueForField(field, example.expected_payload, example.expected_action);
        if (expected === undefined) continue;

        total++;
        const predicted = valueForField(field, prediction, example.predicted_action);
        if (equalValue(field, predicted, expected)) correct++;
      }
      return {
        field,
        total,
        correct,
        accuracy: total === 0 ? null : Math.round((correct / total) * 10000) / 10000,
      };
    }),
  };
}

function getLayerPrediction(example: ParseEvalExample, layer: ParsePredictionLayer): Record<string, unknown> | null {
  if (layer === 'parser') return example.parser_prediction;
  if (layer === 'learning') return example.learning_prediction;
  return example.deepseek_prediction;
}

export function evaluateParseLayers(examples: ParseEvalExample[]): LayeredParseEvalResult[] {
  return [
    evaluateParseLayer(examples, 'parser'),
    evaluateParseLayer(examples, 'learning'),
    evaluateParseLayer(examples, 'deepseek'),
  ];
}

interface ParseEvalRow {
  id: string;
  deterministic_result_json: unknown;
  final_result_json: unknown;
  final_action: string;
  feedback_json: unknown;
}

export async function loadParseEvalDataset(limit = 100): Promise<ParseEvalExample[]> {
  const rows = await db
    .selectFrom('discord_parse_cases as pc')
    .select([
      'pc.id',
      'pc.deterministic_result_json',
      'pc.final_result_json',
      'pc.final_action',
      sql<unknown>`COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'feedback_type', pf.feedback_type,
            'field', pf.field,
            'after_value', pf.after_value
          )
          ORDER BY pf.created_at ASC
        ) FILTER (WHERE pf.id IS NOT NULL),
        '[]'::jsonb
      )`.as('feedback_json'),
    ])
    .leftJoin('discord_parse_feedback as pf', 'pf.parse_case_id', 'pc.id')
    .groupBy(['pc.id', 'pc.deterministic_result_json', 'pc.final_result_json', 'pc.final_action', 'pc.created_at'])
    .orderBy('pc.created_at', 'desc')
    .limit(limit)
    .execute() as ParseEvalRow[];

  return rows.flatMap((row) => {
    const feedback = Array.isArray(row.feedback_json)
      ? row.feedback_json as Array<{ feedback_type: string; field: string | null; after_value: unknown }>
      : [];
    const example = buildParseEvalExample({
      id: row.id,
      deterministicResult: row.deterministic_result_json,
      finalResult: row.final_result_json,
      finalAction: row.final_action,
      feedback,
    });
    return example ? [example] : [];
  });
}

function confidenceFromPayload(payload: unknown): number | null {
  const record = asRecord(payload);
  const value = record?.confidence;
  return typeof value === 'number' ? value : null;
}

function reasonCodesFromPayload(payload: unknown): string[] | null {
  const table = tableOf(payload);
  const missing = asRecord(payload)?.missing_fields;
  if (Array.isArray(missing) && missing.every((value) => typeof value === 'string')) return missing;
  const notes = table._notes;
  if (Array.isArray(notes) && notes.every((value) => typeof value === 'string')) return notes;
  return null;
}

export async function recordParseLayerShadowDecisions(input: {
  parseCaseId: string;
  draftId?: string | null;
  deterministicResult: unknown;
  finalResult: unknown;
  finalAction: ParseFinalAction;
}): Promise<void> {
  try {
    const rows = (['parser', 'learning', 'deepseek'] as const).flatMap((layer) => {
      const prediction = buildLayerPrediction(layer, input.deterministicResult, input.finalResult);
      if (!prediction) return [];
      return [{
        parse_case_id: input.parseCaseId,
        draft_id: input.draftId ?? null,
        prediction_layer: layer,
        predicted_action: input.finalAction,
        predicted_payload: prediction,
        confidence: confidenceFromPayload(prediction),
        reason_codes: reasonCodesFromPayload(prediction),
        actual_action: null,
        actual_payload: null,
        actual_at: null,
      }];
    });
    if (rows.length === 0) return;
    await db.insertInto('discord_parse_shadow_decisions').values(rows).execute();
  } catch (error: unknown) {
    console.error('[recordParseLayerShadowDecisions]', error instanceof Error ? error.message : 'unknown error');
  }
}
