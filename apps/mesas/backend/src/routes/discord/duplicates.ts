import { Router, Request, Response } from 'express';
import { z } from 'zod';
import type { Kysely, Transaction } from 'kysely';
import { db } from '../../db';
import type { Database, DiscordDuplicateCandidateStatus } from '../../db/types';
import { requireAdmin } from '../../middleware/auth';
import { parseFeedbackContractSchema } from '../../discord/parseLearning';

const router = Router();

// Fase 5 (spec 058) — decisão humana sobre candidatos de duplicata em shadow.
// Estado derivado (não persistido): 'exact' | 'probable' vem do score/signals do
// candidato; estado de decisão humana ('confirmed_duplicate'/'rejected_duplicate'/
// 'update_existing') é o que fica em discord_duplicate_candidates.status.
type DuplicateMatchKind = 'exact' | 'probable';

function classifyMatchKind(score: number, signals: unknown): DuplicateMatchKind {
  const raw = signals && typeof signals === 'object' ? (signals as Record<string, unknown>) : {};
  const rawHashExact = raw.raw_hash_exact === true;
  const normalizedHashExact = raw.normalized_hash_exact === true;
  return score >= 0.9 || rawHashExact || normalizedHashExact ? 'exact' : 'probable';
}

type DuplicateCandidateViewRow = {
  id: string;
  score: number | string;
  signals_json: unknown;
  status: DiscordDuplicateCandidateStatus;
  reviewed_by: string | null;
  reviewed_at: Date | string | null;
  created_at: Date | string;
  candidate_case_id: string;
  candidate_draft_id: string | null;
  candidate_normalized_text: string | null;
  candidate_final_action: string | null;
  candidate_draft_status: string | null;
  candidate_draft_data: unknown;
};

function mapDuplicateCandidate(row: DuplicateCandidateViewRow) {
  return {
    id: row.id,
    score: Number(row.score),
    match_kind: classifyMatchKind(Number(row.score), row.signals_json),
    signals: row.signals_json,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: row.reviewed_at,
    created_at: row.created_at,
    candidate_case_id: row.candidate_case_id,
    candidate_draft_id: row.candidate_draft_id,
    candidate_normalized_text: row.candidate_normalized_text ?? '',
    candidate_final_action: row.candidate_final_action ?? 'unknown',
    candidate_draft_status: row.candidate_draft_status,
    candidate_draft_data: row.candidate_draft_data,
  };
}

function selectDuplicateCandidateView(conn: Kysely<Database> | Transaction<Database> = db) {
  return conn
    .selectFrom('discord_duplicate_candidates as dc')
    .innerJoin('discord_parse_cases as candidate', 'candidate.id', 'dc.candidate_case_id')
    .leftJoin('discord_import_table_drafts as candidate_draft', 'candidate_draft.id', 'candidate.draft_id')
    .select([
      'dc.id',
      'dc.score',
      'dc.signals_json',
      'dc.status',
      'dc.reviewed_by',
      'dc.reviewed_at',
      'dc.created_at',
      'candidate.id as candidate_case_id',
      'candidate.draft_id as candidate_draft_id',
      'candidate.normalized_text as candidate_normalized_text',
      'candidate.final_action as candidate_final_action',
      'candidate_draft.status as candidate_draft_status',
      'candidate_draft.normalized_payload as candidate_draft_data',
    ]);
}

// ─── GET /drafts/:id/duplicates ────────────────────────────────────────────────
// Candidatos de duplicata para o parse_case mais recente vinculado ao draft.

router.get('/:id/duplicates', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parseCase = await db
      .selectFrom('discord_parse_cases')
      .select(['id'])
      .where('draft_id', '=', req.params.id)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (!parseCase) return res.json({ data: [] });

    const candidates = await selectDuplicateCandidateView()
      .where('dc.parse_case_id', '=', parseCase.id)
      .orderBy('dc.score', 'desc')
      .execute();

    const data = candidates.map(mapDuplicateCandidate);

    return res.json({ data });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/drafts/:id/duplicates]', error);
    return res.status(500).json({ error: 'Erro ao buscar candidatos de duplicata.' });
  }
});

// ─── PATCH /duplicate-candidates/:id ───────────────────────────────────────────
// Decisão humana: confirma duplicata, rejeita ou marca para atualizar existente.
// Nunca some com o rascunho sozinho — quem decide o destino do draft é o admin
// via rota própria de status; aqui só resolve o candidato e alimenta aprendizado.

const resolveDecisionSchema = z.object({
  status: z.enum(['confirmed_duplicate', 'rejected_duplicate', 'update_existing'] satisfies DiscordDuplicateCandidateStatus[]),
});

const duplicatesRouter = Router();

duplicatesRouter.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = resolveDecisionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido.' });

    const candidate = await db
      .selectFrom('discord_duplicate_candidates')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!candidate) return res.status(404).json({ error: 'Candidato de duplicata não encontrado.' });

    const reviewedBy = req.user?.userId ?? null;
    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('discord_duplicate_candidates')
        .set({
          status: parsed.data.status,
          reviewed_by: reviewedBy,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', candidate.id)
        .returningAll()
        .executeTakeFirst();

      const feedback = parseFeedbackContractSchema.parse({
        parse_case_id: candidate.parse_case_id,
        draft_id: null,
        feedback_type: parsed.data.status === 'rejected_duplicate' ? 'not_duplicate' : 'duplicate',
        field: null,
        before_value: { candidate_case_id: candidate.candidate_case_id, previous_status: candidate.status },
        after_value: { candidate_case_id: candidate.candidate_case_id, status: parsed.data.status },
        reason: null,
        scope_json: { duplicate_candidate_id: candidate.id },
        admin_user_id: reviewedBy,
      });

      await trx
        .insertInto('discord_parse_feedback')
        .values(feedback)
        .execute();
    });

    const updated = await selectDuplicateCandidateView()
      .where('dc.id', '=', candidate.id)
      .executeTakeFirst();
    if (!updated) return res.status(404).json({ error: 'Candidato de duplicata não encontrado.' });

    return res.json({ data: mapDuplicateCandidate(updated) });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/duplicate-candidates/:id]', error);
    return res.status(500).json({ error: 'Erro ao resolver candidato de duplicata.' });
  }
});

export { duplicatesRouter };
export default router;
