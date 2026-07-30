import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { ABUSE_DISMISSED_STREAK_THRESHOLD, ABUSE_LOOKBACK_WINDOW, WITHDRAWN_RESOLUTION_NOTE, isReporterAbusive, reporterDismissedStreak } from '../services/reportAbuseGuard';
import { emitNotification } from '../services/notify';
import { logModerationAudit } from '../services/moderationAuditLog';
import { sanitizeNullableUserMarkdown } from '@artificio/content-editor/sanitize';

const router = Router();

const REPORT_CATEGORIES = [
  'copyright_violation',
  'malicious_link',
  'inappropriate_content',
  'broken_link',
  'other',
] as const;

type ReportCategory = (typeof REPORT_CATEGORIES)[number];
type ReportPriority = 'P0' | 'P1' | 'P2' | 'P3';

// Decisão do mantenedor, 2026-07-29: prioridade mede reversibilidade do dano
// durante a espera. P0 significa somente "primeiro na fila". Nunca remove
// material ou comentário automaticamente; a contenção automática anterior
// foi revogada por risco de brigading quando a UI de denúncia passou a existir.
export const REPORT_PRIORITY_BY_CATEGORY: Record<ReportCategory, ReportPriority> = {
  malicious_link: 'P0',
  copyright_violation: 'P1',
  inappropriate_content: 'P1',
  other: 'P2',
  broken_link: 'P3',
};

const createReportSchema = z.object({
  material_id: z.string().trim().min(1).optional(),
  comment_id: z.string().trim().min(1).optional(),
  category: z.enum(REPORT_CATEGORIES),
  details: z.string().trim().max(4000).optional(),
}).refine((value) => Boolean(value.material_id) !== Boolean(value.comment_id), {
  message: 'Informe exatamente um alvo: material_id ou comment_id.',
});

interface CommentTargetRow {
  id: string;
  material_id: string;
  user_id: string | null;
  body: string;
  removed_at: Date | null;
  material_title: string;
}

// T9.7 (spec 089) — moderador precisa ver o comentario denunciado sem sair da
// fila. `body` volta null quando ja removido: a linha continua no banco (marca
// de moderacao, nao delete), mas reexibir o texto removido reabriria o dano que
// a remocao fechou.
function buildCommentTarget(
  commentId: string | null,
  byId: ReadonlyMap<string, CommentTargetRow>,
): (Omit<CommentTargetRow, 'body'> & { body: string | null }) | null {
  if (!commentId) return null;
  const target = byId.get(commentId);
  if (!target) return null;
  return {
    ...target,
    body: target.removed_at ? null : sanitizeNullableUserMarkdown(target.body),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505';
}

// T5.1/T5.4 — denuncia exige conta accounts. (revogado anonimato em
// 2026-07-12, decisão nominal do mantenedor — habilita rastreio de abuso por
// usuário via reporter_user_id, nunca mais NULL nesta rota).
// Decisão do mantenedor, 2026-07-29: denúncia apenas abre caso. A contenção
// automática de 2026-07-12 foi revogada; moderação humana decide toda remoção.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = createReportSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  if (parsed.data.material_id) {
    const material = await db.selectFrom('download_material').select('id')
      .where('id', '=', parsed.data.material_id).executeTakeFirst();
    if (!material) return res.status(404).json({ error: 'Material não encontrado.' });
  } else {
    const comment = await db.selectFrom('download_comment').select('id')
      .where('id', '=', parsed.data.comment_id!).executeTakeFirst();
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado.' });
  }

  // Achado de review (PR #230): o filtro por case_state espelha o indice unico
  // parcial da migration 036, que so cobre open/in_review. Sem ele o handler
  // seria mais restritivo que o banco — bloquearia nova denuncia sobre problema
  // que reapareceu depois de a moderacao ter decidido, o que nao e a regra.
  const duplicate = await db.selectFrom('download_report').select('id')
    .where('reporter_user_id', '=', req.user!.userId)
    .where(parsed.data.material_id ? 'material_id' : 'comment_id', '=', parsed.data.material_id ?? parsed.data.comment_id!)
    .where('case_state', 'in', ['open', 'in_review'])
    .executeTakeFirst();
  if (duplicate) return res.status(409).json({ error: 'Você já tem uma denúncia em análise para este conteúdo.' });

  // Dois `dismissed` não significam denúncia improcedente e por isso não contam
  // como abuso: retirada voluntária (ver WITHDRAWN_RESOLUTION_NOTE) e
  // consolidação de duplicata (migration 037, achado Codex P2 na PR #231) — esta
  // última o próprio backend permitia criar antes de 03578da, então cobrá-la do
  // denunciante puniria comportamento que a plataforma autorizou.
  const recentReports = await db.selectFrom('download_report').select('case_state')
    .where('reporter_user_id', '=', req.user!.userId)
    .where('case_state', 'in', ['resolved', 'dismissed'])
    .where('consolidated_into_report_id', 'is', null)
    .where((eb) => eb.or([
      eb('resolution_note', 'is', null),
      eb('resolution_note', '<>', WITHDRAWN_RESOLUTION_NOTE),
    ]))
    .orderBy('created_at', 'desc')
    .limit(ABUSE_LOOKBACK_WINDOW)
    .execute();
  const recentStates = recentReports.map((report) => report.case_state);
  const dismissedStreak = reporterDismissedStreak(recentStates);
  const priority = REPORT_PRIORITY_BY_CATEGORY[parsed.data.category];

  try {
    const created = await db.insertInto('download_report').values({
      material_id: parsed.data.material_id ?? null,
      comment_id: parsed.data.comment_id ?? null,
      reporter_user_id: req.user!.userId,
      category: parsed.data.category,
      priority,
      details: sanitizeNullableUserMarkdown(parsed.data.details ?? null),
      reporter_abuse_flagged: isReporterAbusive(recentStates),
      reporter_dismissed_streak: dismissedStreak,
    }).returningAll().executeTakeFirstOrThrow();
    return res.status(201).json(created);
  } catch (error) {
    if (isUniqueViolation(error)) return res.status(409).json({ error: 'Você já denunciou este conteúdo.' });
    throw error;
  }
});

// DEB-074-02 (spec 074/075) — "minhas denuncias": denunciante ve as proprias,
// qualquer case_state. Rota fixa precisa vir antes de "/:id" (Express casaria
// "mine" como id senao).
router.get('/mine', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const reports = await db
    .selectFrom('download_report')
    .selectAll()
    .where('reporter_user_id', '=', req.user!.userId)
    .orderBy('created_at', 'desc')
    .execute();

  return res.json(reports.map((report) => ({
    ...report,
    details: sanitizeNullableUserMarkdown(report.details),
  })));
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
    .set({ case_state: 'dismissed', resolved_at: new Date(), resolution_note: WITHDRAWN_RESOLUTION_NOTE })
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
    // Mesmos filtros do POST: sem eles esta rota diria "abusivo" para quem só
    // retirou as próprias denúncias ou teve duplicatas consolidadas pela
    // migration 037, contradizendo o flag gravado na criação.
    .where('consolidated_into_report_id', 'is', null)
    .where((eb) => eb.or([
      eb('resolution_note', 'is', null),
      eb('resolution_note', '<>', WITHDRAWN_RESOLUTION_NOTE),
    ]))
    .orderBy('created_at', 'desc')
    // Mesma janela do POST (não o limiar): com LIMIT 3 uma "resolved" na 4ª
    // posição é invisível aqui e visível na criação, então as duas rotas
    // divergiam sobre o mesmo usuário. `isReporterAbusive` só olha o prefixo
    // dismissed, então ler 20 não muda o veredito — só o alinha.
    .limit(ABUSE_LOOKBACK_WINDOW)
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

  const commentIds = reports.flatMap((report) => report.comment_id ? [report.comment_id] : []);
  const commentTargets = commentIds.length === 0 ? [] : await db
    .selectFrom('download_comment')
    .innerJoin('download_material', 'download_material.id', 'download_comment.material_id')
    .select([
      'download_comment.id', 'download_comment.material_id', 'download_comment.user_id',
      'download_comment.body', 'download_comment.removed_at', 'download_material.title as material_title',
    ])
    .where('download_comment.id', 'in', commentIds)
    .execute();
  const commentTargetById = new Map(commentTargets.map((comment) => [comment.id, comment]));

  return res.json(reports.map((report) => ({
    ...report,
    details: sanitizeNullableUserMarkdown(report.details),
    resolution_note: sanitizeNullableUserMarkdown(report.resolution_note),
    comment_target: buildCommentTarget(report.comment_id, commentTargetById),
  })));
});

const decisionSchema = z.object({
  case_state: z.enum(['in_review', 'resolved', 'dismissed']),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']).optional(),
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
    .select(['id', 'reporter_user_id', 'material_id', 'comment_id', 'priority', 'case_state'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!report) {
    return res.status(404).json({ error: 'Denúncia não encontrada.' });
  }

  if (report.case_state === 'resolved' || report.case_state === 'dismissed') {
    return res.status(409).json({ error: 'Denúncia já foi decidida.' });
  }

  const isTerminal = parsed.data.case_state === 'resolved' || parsed.data.case_state === 'dismissed';
  const safeResolutionNote = sanitizeNullableUserMarkdown(parsed.data.resolution_note ?? null);

  const commentTarget = report.comment_id ? await db.selectFrom('download_comment')
    .select(['id', 'material_id']).where('id', '=', report.comment_id).executeTakeFirst() : undefined;
  const targetMaterialId = report.material_id ?? commentTarget?.material_id;

  const updated = await db.transaction().execute(async (trx) => {
    const updatedReport = await trx
      .updateTable('download_report')
      .set({
        case_state: parsed.data.case_state,
        ...(parsed.data.priority ? { priority: parsed.data.priority } : {}),
        resolution_note: safeResolutionNote ?? undefined,
        resolved_at: isTerminal ? new Date() : null,
      })
      .where('id', '=', req.params.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    if (parsed.data.case_state === 'resolved' && report.comment_id) {
      await trx.updateTable('download_comment').set({
        removed_at: new Date(),
        removed_reason: safeResolutionNote ?? 'Removido pela moderação após denúncia.',
      }).where('id', '=', report.comment_id).execute();
    }

    return updatedReport;
  });

  if (parsed.data.priority && parsed.data.priority !== report.priority) {
    logModerationAudit({
      action: 'report_reclassify', actorUserId: req.user!.userId,
      materialId: targetMaterialId, reportId: report.id,
      reason: `${report.priority} -> ${parsed.data.priority}`,
    });
  }

  if (isTerminal && report.reporter_user_id && targetMaterialId) {
    try {
      await emitNotification({
        userId: report.reporter_user_id,
        kind: parsed.data.case_state === 'resolved' ? 'report_resolved' : 'report_dismissed',
        materialId: targetMaterialId,
        body: parsed.data.case_state === 'resolved'
          ? 'Sua denúncia foi analisada e resolvida.'
          : 'Sua denúncia foi analisada e dispensada.',
      });
    } catch (error) {
      console.error('[PATCH /reports/:id] Falha ao emitir notificação:', error);
    }
  }

  if (isTerminal) {
    logModerationAudit({
      action: 'report_decide',
      actorUserId: req.user!.userId,
      materialId: targetMaterialId,
      reportId: report.id,
      reason: safeResolutionNote ?? undefined,
    });
  }

  return res.json({
    ...updated,
    details: sanitizeNullableUserMarkdown(updated.details),
    resolution_note: sanitizeNullableUserMarkdown(updated.resolution_note),
  });
});

export default router;
