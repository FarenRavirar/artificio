import { z } from 'zod';
import { authGet, authPatch, authPost } from '../../../services/apiClient';

const candidateStatusSchema = z.enum(['candidate', 'confirmed_duplicate', 'rejected_duplicate', 'update_existing']);

const candidateSchema = z.object({
  id: z.string(),
  score: z.coerce.number().min(0).max(1),
  signals_json: z.unknown(),
  status: candidateStatusSchema,
  table_id: z.string(),
  table_slug: z.string(),
  table_title: z.string(),
  candidate_table_id: z.string().nullable().optional(),
  candidate_table_slug: z.string().nullable().optional(),
  candidate_table_title: z.string().nullable().optional(),
  candidate_parse_case_id: z.string().nullable().optional(),
  candidate_draft_id: z.string().nullable().optional(),
  candidate_draft_payload: z.unknown().nullable().optional(),
  candidate_draft_parsed_payload: z.unknown().nullable().optional(),
});

export type TableDuplicateCandidate = z.infer<typeof candidateSchema>;
export type TableDuplicateDecision = z.infer<typeof candidateStatusSchema>;

async function readJson(response: Response): Promise<unknown> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'error' in payload
      ? String((payload as { error: unknown }).error)
      : 'Erro ao consultar duplicatas.';
    throw new Error(message);
  }
  return payload;
}

export async function listTableDuplicateCandidates(): Promise<TableDuplicateCandidate[]> {
  const payload = await readJson(await authGet('/api/v1/admin/tables/duplicates'));
  const parsed = z.object({ data: z.array(candidateSchema) }).safeParse(payload);
  if (!parsed.success) throw new Error('Resposta inválida ao listar duplicatas.');
  return parsed.data.data;
}

export async function scanTableDuplicateCandidates(): Promise<{ tablePairs: number; draftPairs: number }> {
  const payload = await readJson(await authPost('/api/v1/admin/tables/duplicates/scan', {}));
  const parsed = z.object({ data: z.object({ tablePairs: z.number().int().nonnegative(), draftPairs: z.number().int().nonnegative() }) }).safeParse(payload);
  if (!parsed.success) throw new Error('Resposta inválida ao verificar duplicatas.');
  return parsed.data.data;
}

export async function resolveTableDuplicateCandidate(id: string, status: TableDuplicateDecision): Promise<void> {
  await readJson(await authPatch(`/api/v1/admin/table-duplicate-candidates/${id}`, { status }));
}

