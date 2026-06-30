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

async function main(): Promise<void> {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Uso: pnpm --filter @artificio/mesas-backend discord:ai-eval <arquivo.json>');
    process.exitCode = 1;
    return;
  }

  const raw = await fs.readFile(inputPath, 'utf8');
  const input = JSON.parse(raw) as EvalInputFile;
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
