import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { assertValidTransition, InvalidEditorialTransitionError } from '../services/editorialStateMachine';
import { emitNotification } from '../services/notify';
import { logModerationAudit } from '../services/moderationAuditLog';
import { sendModerationEmail } from '../services/moderationEmail';
import { detectPortuguese } from '../services/languageDetector';
import type { DownloadEditorialState } from '../db/types';
import { sanitizeNullableUserMarkdown } from '@artificio/content-editor/sanitize';

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

  // T8.1 (spec 084) — roda detectPortuguese 1x no submit (nunca bloqueia o
  // envio — decisão do mantenedor: alerta o moderador na fila, quem decide
  // reprovar é humano). Persistido pra GET /queue não re-rodar detecção
  // (custo de chamada DeepSeek) a cada carregamento da fila.
  const combinedText = `${material.title}\n${material.description ?? material.summary ?? ''}`;
  const languageDetection = await detectPortuguese(combinedText);

  const updated = await db
    .updateTable('download_material')
    .set({
      editorial_state: 'in_review',
      rejection_reason: null,
      rejection_category_id: null,
      detected_language: languageDetection.detectedLanguage,
      language_confident: languageDetection.confident,
      language_checked_at: new Date(),
      updated_at: new Date(),
    })
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

  return res.json(queue.map((material) => ({
    ...material,
    rejection_reason: sanitizeNullableUserMarkdown(material.rejection_reason),
  })));
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

  // O `min(1)` do Zod roda antes da sanitização, então entrada só-markup
  // (`<script>alert(1)</script>`, `<div></div>`) passa na validação e sai vazia
  // daqui — gravava motivo de reprovação em branco. Rejeitar com 400 em vez de
  // usar `!` para silenciar o null (achado de review PR #227).
  const safeReason = sanitizeNullableUserMarkdown(parsed.data.reason);
  if (!safeReason?.trim()) {
    return res.status(400).json({ error: 'Motivo de reprovação é obrigatório.' });
  }

  const updated = await db.transaction().execute(async (trx) => {
    const changed = await trx
      .updateTable('download_material')
      .set({
        editorial_state: 'rejected',
        rejection_reason: safeReason,
        rejection_category_id: category.id,
        updated_at: new Date(),
      })
      .where('id', '=', material.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await emitNotification({
      userId: changed.creator_id,
      kind: 'material_rejected',
      materialId: changed.id,
      body: `Seu material "${changed.title}" foi rejeitado. Motivo: ${safeReason}`,
    }, trx);
    return changed;
  });

  // Fire-and-forget: retry interno tem backoff de 30s (RETRY_DELAY_MS),
  // await bloquearia a resposta HTTP da moderacao por isso — e-mail e
  // sempre best-effort, nunca trava a acao de mérito do moderador.
  sendModerationEmail({
    kind: 'material_rejected',
    userId: updated.creator_id,
    materialId: updated.id,
    materialTitle: updated.title,
    categoryLabel: category.label,
    legalBasis: category.legal_basis,
    reason: safeReason,
  }).catch((error: unknown) => {
    console.error('[POST /moderation/:id/reject] Falha ao enviar e-mail:', error);
  });

  logModerationAudit({
    action: 'reject',
    actorUserId: req.user!.userId,
    materialId: updated.id,
    reason: `${category.slug}: ${safeReason}`,
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

  const updated = await db.transaction().execute(async (trx) => {
    const changed = await trx
      .updateTable('download_material')
      .set({ editorial_state: 'published', rejection_reason: null, rejection_category_id: null, updated_at: new Date() })
      .where('id', '=', material.id)
      .returningAll()
      .executeTakeFirstOrThrow();

    await emitNotification({
      userId: changed.creator_id,
      kind: 'material_approved',
      materialId: changed.id,
      body: `Seu material "${changed.title}" foi aprovado e publicado.`,
    }, trx);
    return changed;
  });

  // Fire-and-forget: ver comentario equivalente em /reject.
  sendModerationEmail({
    kind: 'material_approved',
    userId: updated.creator_id,
    materialId: updated.id,
    materialTitle: updated.title,
    materialSlug: updated.slug,
  }).catch((error: unknown) => {
    console.error('[POST /moderation/:id/approve] Falha ao enviar e-mail:', error);
  });

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
  const safeBatchReason = sanitizeNullableUserMarkdown(parsed.data.reason ?? null);
  // O guard acima checa o valor cru; a sanitização pode esvaziar entrada
  // só-markup e gravaria motivo em branco no lote inteiro (mesmo achado da
  // reprovação individual, review PR #227).
  if (action === 'reject' && !safeBatchReason?.trim()) {
    return res.status(400).json({ error: 'Motivo de reprovação é obrigatório para ação em lote de reprovar.' });
  }
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

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('download_material')
        .set({
          editorial_state: targetState,
          rejection_reason: action === 'reject' ? safeBatchReason : null,
          rejection_category_id: action === 'reject' ? (rejectCategory?.id ?? null) : null,
          updated_at: new Date(),
        })
        .where('id', '=', id)
        .execute();

      if (action === 'approve' || action === 'reject') {
        await emitNotification({
          userId: material.creator_id,
          kind: action === 'approve' ? 'material_approved' : 'material_rejected',
          materialId: material.id,
          body: action === 'approve'
            ? `Seu material "${material.title}" foi aprovado e publicado.`
            : `Seu material "${material.title}" foi rejeitado. Motivo: ${safeBatchReason}`,
        }, trx);
      }
    });

    if (action === 'approve' || action === 'reject') {
      // Fire-and-forget (ver comentario em /reject individual) — critico no
      // batch: await serializaria 30s de retry POR ITEM, um lote de 100
      // materiais com Resend fora do ar travaria a resposta por ~50min.
      const emailPromise = action === 'approve'
        ? sendModerationEmail({
            kind: 'material_approved',
            userId: material.creator_id,
            materialId: material.id,
            materialTitle: material.title,
            materialSlug: material.slug,
          })
        : rejectCategory
          ? sendModerationEmail({
              kind: 'material_rejected',
              userId: material.creator_id,
              materialId: material.id,
              materialTitle: material.title,
              categoryLabel: rejectCategory.label,
              legalBasis: rejectCategory.legal_basis,
              reason: safeBatchReason ?? '',
            })
          : null;

      emailPromise?.catch((error: unknown) => {
        console.error(`[PATCH /moderation/batch/${action}] Falha ao enviar e-mail para material ${material.id}:`, error);
      });
    }

    logModerationAudit({
      action,
      actorUserId: req.user!.userId,
      materialId: material.id,
      reason: action === 'reject' ? `${rejectCategory?.slug ?? '?'}: ${safeBatchReason}` : undefined,
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
