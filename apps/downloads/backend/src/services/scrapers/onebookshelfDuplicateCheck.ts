// Spec 085 (Fase 3) — dedupe por similaridade, adaptado de
// apps/mesas/backend/src/services/tableDuplicateDetection.ts. Diferença
// deliberada: mesas roda scan em batch (scanTableDuplicateCandidates,
// agendado); aqui é consulta on-demand, disparada só quando o admin cola
// HTML em /parse-html — não há job de fundo, o candidato é calculado na
// hora e nunca decide sozinho (endpoint sempre 200, mesmo com candidato).

import { sql } from 'kysely';
import { db } from '../../db';

export interface DuplicateCandidate {
  id: string;
  slug: string;
  title: string;
  similarity: number;
}

// Mesmo threshold do mesas (tableDuplicateDetection.ts) — 0.75 calibrado lá
// contra dados reais; sem dado próprio do downloads pra recalibrar, reaproveita
// o valor validado em vez de inventar um novo sem evidência.
const SIMILARITY_THRESHOLD = 0.75;

// Só materiais em estado visível/relevante pro admin comparar — draft de
// outro fluxo abandonado não deveria contar como duplicata real.
const RELEVANT_STATES = ['draft', 'in_review', 'published'] as const;

export async function findDuplicateCandidates(title: string): Promise<DuplicateCandidate[]> {
  const trimmed = title.trim();
  if (!trimmed) return [];

  const similarityExpr = sql<number>`similarity(lower(title), lower(${trimmed}))`;

  const rows = await db
    .selectFrom('download_material')
    .select(['id', 'slug', 'title', similarityExpr.as('similarity')])
    .where('editorial_state', 'in', RELEVANT_STATES)
    .where(similarityExpr, '>=', SIMILARITY_THRESHOLD)
    .orderBy('similarity', 'desc')
    .limit(10)
    .execute();

  return rows;
}
