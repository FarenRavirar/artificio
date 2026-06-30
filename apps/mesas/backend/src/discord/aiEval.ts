export const EVAL_FIELDS = ['system_name', 'slots_total', 'slots_open', 'day_of_week', 'start_time', 'contact_url'] as const;
export type EvalField = typeof EVAL_FIELDS[number];

export interface EvalExample {
  id: string;
  parsed_before: Record<string, unknown>;
  human_corrected: Record<string, unknown>;
}

export interface EvalPrediction {
  id: string;
  predicted: Record<string, unknown>;
}

export interface EvalFieldResult {
  field: EvalField;
  total: number;
  correct: number;
  accuracy: number | null;
}

function tableOf(value: Record<string, unknown>): Record<string, unknown> {
  const table = value.table;
  return table && typeof table === 'object' && !Array.isArray(table)
    ? table as Record<string, unknown>
    : value;
}

function equalValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b);
  if (typeof a === 'string' && typeof b === 'string') return a.trim().toLowerCase() === b.trim().toLowerCase();
  return JSON.stringify(a) === JSON.stringify(b);
}

export function evaluatePredictions(examples: EvalExample[], predictions: EvalPrediction[]): EvalFieldResult[] {
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction.predicted]));
  return EVAL_FIELDS.map((field) => {
    let total = 0;
    let correct = 0;
    for (const example of examples) {
      const expectedTable = tableOf(example.human_corrected);
      if (!(field in expectedTable)) continue;
      const predicted = byId.get(example.id);
      if (!predicted) continue;
      total++;
      if (equalValue(tableOf(predicted)[field], expectedTable[field])) correct++;
    }
    return {
      field,
      total,
      correct,
      accuracy: total === 0 ? null : Math.round((correct / total) * 10000) / 10000,
    };
  });
}
