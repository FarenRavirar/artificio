import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { assertValidTransition, InvalidEditorialTransitionError } from '../services/editorialStateMachine';
import { emitNotification } from '../services/notify';
import { logModerationAudit } from '../services/moderationAuditLog';
import { sendModerationEmail } from '../services/moderationEmail';
import type { DownloadEditorialState } from '../db/types';

const router = Router();

// T2.4/T4.1 — publicador envia o proprio rascunho para revisao. Reenvio apos
// reprovacao (T4.4) usa a mesma rota: preserva title/summary/description e
// so limpa rejection_reason, nunca apaga historico (download_material_version
// ja guarda o rastro completo de edicao).
router.post('/:id/submit', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  if (material.creator_id !== req.user!.userId) {
    return res.status(403).json({ error: 'Você não tem permissão para enviar este material para revisão.' });
  }

  try {
    assertValidTransition(material.editorial_state, 'in_review');
  } catch (error) {
    if (error instanceof InvalidEditorialTransitionError) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }

  const updated = await db
    .updateTable('download_material')
    .set({ editorial_state: 'in_review', rejection_reason: null, rejection_category_id: null, updated_at: new Date() })
    .where('id', '=', material.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  logModerationAudit({ action: 'submit', actorUserId: req.user!.userId, materialId: updated.id });

  return res.json(updated);
});

// T4.2 — fila de moderacao: so material em revisao, mais antigo primeiro.
router.get('/queue', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (_req: Request, res: Response) => {
  const queue = await db
    .selectFrom('download_material')
    .selectAll()
    .where('editorial_state', '=', 'in_review')
    .orderBy('updated_at', 'asc')
    .execute();

  return res.json(queue);
});

const rejectSchema = z.object({
  reason: z.string().trim().min(1, 'Motivo de reprovação é obrigatório.'),
  rejection_category_id: z.string().trim().min(1, 'Categoria de reprovação é obrigatória.'),
});

// T4.2/T5.1 (spec 072/083) — reprovacao SEMPRE grava motivo estruturado
// (texto livre + categoria); schema zod rejeita ausencia de qualquer um
// antes de tocar a maquina de estados.
router.post('/:id/reject', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const parsed = rejectSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const category = await db
    .selectFrom('download_rejection_category')
    .selectAll()
    .where('id', '=', parsed.data.rejection_category_id)
    .where('active', '=', true)
    .executeTakeFirst();

  if (!category) {
    return res.status(400).json({ error: 'Categoria de reprovação inválida ou inativa.' });
  }

  try {
    assertValidTransition(material.editorial_state, 'rejected');
  } catch (error) {
    if (error instanceof InvalidEditorialTransitionError) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }

  const updated = await db
    .updateTable('download_material')
    .set({
      editorial_state: 'rejected',
      rejection_reason: parsed.data.reason,
      rejection_category_id: category.id,
      updated_at: new Date(),
    })
    .where('id', '=', material.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  try {
    await emitNotification({
      userId: updated.creator_id,
      kind: 'material_rejected',
      materialId: updated.id,
      body: `Seu material "${updated.title}" foi rejeitado. Motivo: ${parsed.data.reason}`,
    });
  } catch (error) {
    console.error('[POST /moderation/:id/reject] Falha ao emitir notificação:', error);
  }

  try {
    await sendModerationEmail({
      kind: 'material_rejected',
      userId: updated.creator_id,
      materialId: updated.id,
      materialTitle: updated.title,
      categoryLabel: category.label,
      legalBasis: category.legal_basis,
      reason: parsed.data.reason,
    });
  } catch (error) {
    console.error('[POST /moderation/:id/reject] Falha ao enviar e-mail:', error);
  }

  logModerationAudit({
    action: 'reject',
    actorUserId: req.user!.userId,
    materialId: updated.id,
    reason: `${category.slug}: ${parsed.data.reason}`,
  });

  return res.json(updated);
});

// T4.1 — aprovacao: exige prova (download_evidence) registrada (critério de
// aceite 4 — prova nunca aceita automaticamente, mas so entra aqui apos
// revisao humana explicita deste endpoint).
router.post('/:id/approve', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  try {
    assertValidTransition(material.editorial_state, 'published');
  } catch (error) {
    if (error instanceof InvalidEditorialTransitionError) {
      return res.status(409).json({ error: error.message });
    }
    throw error;
  }

  const evidence = await db
    .selectFrom('download_evidence')
    .select('id')
    .where('material_id', '=', material.id)
    .executeTakeFirst();

  if (!evidence) {
    return res.status(409).json({ error: 'Material sem prova de gratuidade/permissão (download_evidence) registrada.' });
  }

  const updated = await db
    .updateTable('download_material')
    .set({ editorial_state: 'published', rejection_reason: null, rejection_category_id: null, updated_at: new Date() })
    .where('id', '=', material.id)
    .returningAll()
    .executeTakeFirstOrThrow();

  try {
    await emitNotification({
      userId: updated.creator_id,
      kind: 'material_approved',
      materialId: updated.id,
      body: `Seu material "${updated.title}" foi aprovado e publicado.`,
    });
  } catch (error) {
    console.error('[POST /moderation/:id/approve] Falha ao emitir notificação:', error);
  }

  try {
    await sendModerationEmail({
      kind: 'material_approved',
      userId: updated.creator_id,
      materialId: updated.id,
      materialTitle: updated.title,
      materialSlug: updated.slug,
    });
  } catch (error) {
    console.error('[POST /moderation/:id/approve] Falha ao enviar e-mail:', error);
  }

  logModerationAudit({ action: 'approve', actorUserId: req.user!.userId, materialId: updated.id });

  return res.json(updated);
});

const batchSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  reason: z.string().trim().min(1).optional(),
  rejection_category_id: z.string().trim().min(1).optional(),
});

type BatchAction = 'approve' | 'reject' | 'archive';

const ACTION_TARGET_STATE: Record<BatchAction, DownloadEditorialState> = {
  approve: 'published',
  reject: 'rejected',
  archive: 'withdrawn',
};

// T4.3 — acoes batch, mesmo contrato ja usado em apps/mesas (PATCH .../batch).
// Cada item e processado de forma independente: um id invalido/transicao
// invalida nao aborta os demais, resultado agregado reporta por item.
router.patch('/batch/:action', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const action = req.params.action as BatchAction;
  if (!(action in ACTION_TARGET_STATE)) {
    return res.status(400).json({ error: 'Ação de moderação em lote desconhecida.' });
  }

  const parsed = batchSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  if (action === 'reject' && !parsed.data.reason) {
    return res.status(400).json({ error: 'Motivo de reprovação é obrigatório para ação em lote de reprovar.' });
  }
  if (action === 'reject' && !parsed.data.rejection_category_id) {
    return res.status(400).json({ error: 'Categoria de reprovação é obrigatória para ação em lote de reprovar.' });
  }

  let rejectCategory: { id: string; slug: string; label: string; legal_basis: string | null } | null = null;
  if (action === 'reject' && parsed.data.rejection_category_id) {
    rejectCategory = await db
      .selectFrom('download_rejection_category')
      .select(['id', 'slug', 'label', 'legal_basis'])
      .where('id', '=', parsed.data.rejection_category_id)
      .where('active', '=', true)
      .executeTakeFirst() ?? null;

    if (!rejectCategory) {
      return res.status(400).json({ error: 'Categoria de reprovação inválida ou inativa.' });
    }
  }

  const targetState = ACTION_TARGET_STATE[action];
  const results: Array<{ id: string; status: 'updated' | 'skipped'; reason?: string }> = [];

  for (const id of parsed.data.ids) {
    const material = await db
      .selectFrom('download_material')
      .select(['id', 'editorial_state', 'creator_id', 'title', 'slug'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!material) {
      results.push({ id, status: 'skipped', reason: 'não encontrado' });
      continue;
    }

    if (!assertValidTransitionSafe(material.editorial_state, targetState)) {
      results.push({ id, status: 'skipped', reason: `transição inválida de "${material.editorial_state}" para "${targetState}"` });
      continue;
    }

    if (action === 'approve') {
      const evidence = await db
        .selectFrom('download_evidence')
        .select('id')
        .where('material_id', '=', id)
        .executeTakeFirst();
      if (!evidence) {
        results.push({ id, status: 'skipped', reason: 'sem prova de gratuidade/permissão registrada' });
        continue;
      }
    }

    await db
      .updateTable('download_material')
      .set({
        editorial_state: targetState,
        rejection_reason: action === 'reject' ? (parsed.data.reason ?? null) : null,
        rejection_category_id: action === 'reject' ? (rejectCategory?.id ?? null) : null,
        updated_at: new Date(),
      })
      .where('id', '=', id)
      .execute();

    if (action === 'approve' || action === 'reject') {
      try {
        await emitNotification({
          userId: material.creator_id,
          kind: action === 'approve' ? 'material_approved' : 'material_rejected',
          materialId: material.id,
          body: action === 'approve'
            ? `Seu material "${material.title}" foi aprovado e publicado.`
            : `Seu material "${material.title}" foi rejeitado. Motivo: ${parsed.data.reason}`,
        });
      } catch (error) {
        console.error(`[PATCH /moderation/batch/${action}] Falha ao emitir notificação para material ${material.id}:`, error);
      }

      try {
        if (action === 'approve') {
          await sendModerationEmail({
            kind: 'material_approved',
            userId: material.creator_id,
            materialId: material.id,
            materialTitle: material.title,
            materialSlug: material.slug,
          });
        } else if (rejectCategory) {
          await sendModerationEmail({
            kind: 'material_rejected',
            userId: material.creator_id,
            materialId: material.id,
            materialTitle: material.title,
            categoryLabel: rejectCategory.label,
            legalBasis: rejectCategory.legal_basis,
            reason: parsed.data.reason ?? '',
          });
        }
      } catch (error) {
        console.error(`[PATCH /moderation/batch/${action}] Falha ao enviar e-mail para material ${material.id}:`, error);
      }
    }

    logModerationAudit({
      action,
      actorUserId: req.user!.userId,
      materialId: material.id,
      reason: action === 'reject' ? `${rejectCategory?.slug ?? '?'}: ${parsed.data.reason}` : undefined,
    });

    results.push({ id, status: 'updated' });
  }

  return res.json({ results });
});

function assertValidTransitionSafe(from: DownloadEditorialState, to: DownloadEditorialState): boolean {
  try {
    assertValidTransition(from, to);
    return true;
  } catch {
    return false;
  }
}

export default router;
