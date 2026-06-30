import fs from 'node:fs/promises';
import { evaluatePredictions, type EvalExample, type EvalPrediction } from '../discord/aiEval';

interface CandidateFile {
  name: string;
  predictions: EvalPrediction[];
}

interface EvalInputFile {
  examples: EvalExample[];
  candidates: CandidateFile[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEvalExample(value: unknown): EvalExample | null {
  if (!isRecord(value) || typeof value.id !== 'string') return null;
  if (!isRecord(value.parsed_before) || !isRecord(value.human_corrected)) return null;
  return { id: value.id, parsed_before: value.parsed_before, human_corrected: value.human_corrected };
}

function normalizeEvalPrediction(value: unknown): EvalPrediction | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !isRecord(value.predicted)) return null;
  return { id: value.id, predicted: value.predicted };
}

function normalizeCandidate(value: unknown): CandidateFile | null {
  if (!isRecord(value) || typeof value.name !== 'string' || !Array.isArray(value.predictions)) return null;
  const predictions = value.predictions.map(normalizeEvalPrediction);
  if (predictions.some((prediction) => prediction === null)) return null;
  return { name: value.name, predictions: predictions as EvalPrediction[] };
}

function normalizeEvalInput(value: unknown): EvalInputFile {
  if (!isRecord(value) || !Array.isArray(value.examples) || !Array.isArray(value.candidates)) {
    throw new Error('Arquivo inválido: examples e candidates devem ser arrays.');
  }
  const examples = value.examples.map(normalizeEvalExample);
  const candidates = value.candidates.map(normalizeCandidate);
  if (examples.some((example) => example === null) || candidates.some((candidate) => candidate === null)) {
    throw new Error('Arquivo inválido: examples/candidates fora do formato esperado.');
  }
  return { examples: examples as EvalExample[], candidates: candidates as CandidateFile[] };
}

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Uso: pnpm --filter @artificio/mesas-backend discord:ai-eval <arquivo.json>');
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(inputPath, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  const input = normalizeEvalInput(parsed);
  const report = input.candidates.map((candidate) => ({
    candidate: candidate.name,
    fields: evaluatePredictions(input.examples, candidate.predictions),
  }));

  console.log(JSON.stringify({ examples: input.examples.length, report }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Erro ao avaliar predições.');
  process.exitCode = 1;
});
