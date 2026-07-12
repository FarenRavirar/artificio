import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { assertValidTransition, InvalidEditorialTransitionError } from '../services/editorialStateMachine';
import { ABUSE_DISMISSED_STREAK_THRESHOLD, isReporterAbusive } from '../services/reportAbuseGuard';
import { emitNotification } from '../services/notify';
import { logModerationAudit } from '../services/moderationAuditLog';

const router = Router();

const REPORT_CATEGORIES = [
  'copyright_violation',
  'malicious_link',
  'inappropriate_content',
  'broken_link',
  'other',
] as const;

const createReportSchema = z.object({
  material_id: z.string().trim().min(1),
  category: z.enum(REPORT_CATEGORIES),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
  details: z.string().trim().max(4000).optional(),
});

// T5.1/T5.4 — denuncia exige conta accounts. (revogado anonimato em
// 2026-07-12, decisão nominal do mantenedor — habilita rastreio de abuso por
// usuário via reporter_user_id, nunca mais NULL nesta rota).
// T5.2 — contenção proporcional (D-nova 2026-07-12): 1 denúncia P0 já
// suspende o material (editorial_state -> withdrawn) até revisão manual —
// falso positivo custa reaparecer via moderação; manter no ar custa mais.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createReportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const material = await db
    .selectFrom('download_material')
    .select(['id', 'editorial_state'])
    .where('id', '=', parsed.data.material_id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const priority = parsed.data.priority ?? 'P3';

  const created = await db
    .insertInto('download_report')
    .values({
      material_id: parsed.data.material_id,
      reporter_user_id: req.user!.userId,
      category: parsed.data.category,
      priority,
      details: parsed.data.details ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  if (priority === 'P0' && material.editorial_state === 'published') {
    try {
      assertValidTransition(material.editorial_state, 'withdrawn');
      await db
        .updateTable('download_material')
        .set({ editorial_state: 'withdrawn', updated_at: new Date() })
        .where('id', '=', material.id)
        .execute();
    } catch (error) {
      if (!(error instanceof InvalidEditorialTransitionError)) throw error;
    }
  }

  return res.status(201).json(created);
});

// DEB-074-02 (spec 074/075) — "minhas denuncias": denunciante ve as proprias,
// qualquer case_state. Rota fixa precisa vir antes de "/:id" (Express casaria
// "mine" como id senao).
router.get('/mine', authMiddleware, async (req: Request, res: Response) => {
  const reports = await db
    .selectFrom('download_report')
    .selectAll()
    .where('reporter_user_id', '=', req.user!.userId)
    .orderBy('created_at', 'desc')
    .execute();

  return res.json(reports);
});

// T5.4 — retirada voluntária: o próprio autor da denúncia pode cancelar,
// desde que ainda esteja aberta (decisão de mérito já tomada não se desfaz).
router.delete('/:id', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const report = await db
    .selectFrom('download_report')
    .select(['id', 'reporter_user_id', 'case_state'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!report) {
    return res.status(404).json({ error: 'Denúncia não encontrada.' });
  }

  if (report.reporter_user_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Você só pode retirar denúncias que você mesmo abriu.' });
  }

  if (report.case_state !== 'open') {
    return res.status(409).json({ error: 'Denúncia já entrou em análise/decisão e não pode mais ser retirada.' });
  }

  await db
    .updateTable('download_report')
    .set({ case_state: 'dismissed', resolved_at: new Date(), resolution_note: 'Retirada voluntária pelo denunciante.' })
    .where('id', '=', req.params.id)
    .execute();

  return res.status(204).send();
});

// T5.4 — abuso: sinaliza (nunca bane sozinho) usuário cuja última sequência
// de denúncias terminou "dismissed" — moderador decide a ação real.
router.get('/abuse-check/:userId', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const recentReports = await db
    .selectFrom('download_report')
    .select(['case_state'])
    .where('reporter_user_id', '=', req.params.userId)
    .where('case_state', 'in', ['resolved', 'dismissed'])
    .orderBy('created_at', 'desc')
    .limit(ABUSE_DISMISSED_STREAK_THRESHOLD)
    .execute();

  const abusive = isReporterAbusive(recentReports.map((r) => r.case_state));

  return res.json({ user_id: req.params.userId, abusive, threshold: ABUSE_DISMISSED_STREAK_THRESHOLD });
});

// T5.2 — fila de denuncias por prioridade (P0 primeiro), so moderador/admin.
router.get('/', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (_req: Request, res: Response) => {
  const reports = await db
    .selectFrom('download_report')
    .selectAll()
    .where('case_state', 'in', ['open', 'in_review'])
    .orderBy('priority', 'asc')
    .orderBy('created_at', 'asc')
    .execute();

  return res.json(reports);
});

const decisionSchema = z.object({
  case_state: z.enum(['in_review', 'resolved', 'dismissed']),
  resolution_note: z.string().trim().max(4000).optional(),
});

// T5.3 — decisao de merito (contraditório/recurso ficam registrados via
// resolution_note por ora; fluxo de UI de contestação é da spec 073/074).
// Critério de aceite 5: decisão de mérito exige role autenticada.
router.patch('/:id', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const report = await db
    .selectFrom('download_report')
    .select(['id', 'reporter_user_id', 'material_id', 'case_state'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!report) {
    return res.status(404).json({ error: 'Denúncia não encontrada.' });
  }

  const isTerminal = parsed.data.case_state === 'resolved' || parsed.data.case_state === 'dismissed';

  const updated = await db
    .updateTable('download_report')
    .set({
      case_state: parsed.data.case_state,
      resolution_note: parsed.data.resolution_note ?? undefined,
      resolved_at: isTerminal ? new Date() : null,
    })
    .where('id', '=', req.params.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  if (isTerminal && report.reporter_user_id) {
    await emitNotification({
      userId: report.reporter_user_id,
      kind: parsed.data.case_state === 'resolved' ? 'report_resolved' : 'report_dismissed',
      materialId: report.material_id,
      body: parsed.data.case_state === 'resolved'
        ? 'Sua denúncia foi analisada e resolvida.'
        : 'Sua denúncia foi analisada e dispensada.',
    });
  }

  if (isTerminal) {
    logModerationAudit({
      action: 'report_decide',
      actorUserId: req.user!.userId,
      materialId: report.material_id,
      reportId: report.id,
      reason: parsed.data.resolution_note ?? undefined,
    });
  }

  return res.json(updated);
});

export default router;
