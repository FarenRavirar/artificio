import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { TableRepository } from '../repositories/tableRepository';
import { autoArchiveStaleTables, AUTO_ARCHIVE_AFTER_DAYS } from '../services/tableArchiving';
import { logActivity } from '../services/activityLogger';

const router = Router();

// POST /api/v1/admin/tables/auto-archive — rotina de auto-arquivamento (D-MESAS1).
// PROD-only por decisão de produto (beta/local não auto-arquivam por idade, p/ não
// bagunçar teste/hydrate). Autenticada por SEGREDO de cron (header x-cron-secret =
// env MESAS_CRON_SECRET) — chamada por workflow agendado, sem sessão. Idempotente.
router.post('/tables/auto-archive', async (req: Request, res: Response) => {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const isProd = nodeEnv === 'production' || nodeEnv === 'prod';
  if (!isProd) {
    return res.status(403).json({ error: 'Auto-arquivamento só roda em produção.' });
  }

  const cronSecret = process.env.MESAS_CRON_SECRET;
  if (!cronSecret) {
    return res.status(503).json({ error: 'MESAS_CRON_SECRET não configurado.' });
  }
  // Comparação em tempo constante (anti-timing-attack). timingSafeEqual exige buffers
  // de mesmo tamanho — checa o comprimento antes (diferença de tamanho já invalida).
  const provided = Buffer.from(req.header('x-cron-secret') || '', 'utf8');
  const expected = Buffer.from(cronSecret, 'utf8');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return res.status(401).json({ error: 'Segredo de cron inválido.' });
  }

  try {
    const archived = await autoArchiveStaleTables();
    void logActivity({
      actorId: null,
      actorRole: null,
      action: 'table.archived',
      entityType: 'table',
      entityId: null,
      summary: `Auto-arquivamento: ${archived.length} mesa(s) publicada(s) há mais de ${AUTO_ARCHIVE_AFTER_DAYS} dias arquivada(s).`,
      metadata: { count: archived.length, slugs: archived.map((t) => t.slug), after_days: AUTO_ARCHIVE_AFTER_DAYS },
    });
    return res.json({ data: { count: archived.length, tables: archived } });
  } catch (error: any) {
    console.error('[POST /admin/tables/auto-archive]', error);
    return res.status(500).json({ error: 'Erro no auto-arquivamento.' });
  }
});

// POST /api/v1/admin/tables/batch — ações administrativas em lote (T2.5/R15).
// action: 'archive' | 'unarchive' | 'delete'. Idempotente por id.
router.post('/tables/batch', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user.role;
  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  const rawIds = (req.body?.ids ?? []) as unknown;
  const action = req.body?.action as unknown;
  const ids = Array.isArray(rawIds) ? rawIds.filter((id): id is string => typeof id === 'string') : [];
  const validActions = ['archive', 'unarchive', 'delete'];

  if (ids.length === 0) {
    return res.status(400).json({ error: 'Nenhuma mesa selecionada.' });
  }
  if (typeof action !== 'string' || !validActions.includes(action)) {
    return res.status(400).json({ error: `Ação inválida. Valores: ${validActions.join(', ')}` });
  }

  try {
    if (action === 'delete') {
      let updated = 0;
      for (const id of ids) {
        await TableRepository.deleteTableWithRelations(id);
        updated += 1;
      }
      void logActivity({
        actorId: (req as any).user?.userId ?? null,
        actorRole: userRole,
        action: 'table.deleted',
        entityType: 'table',
        entityId: null,
        summary: `Exclusão em lote: ${updated} mesa(s).`,
        metadata: { count: updated, ids },
      });
      return res.json({ data: { updated } });
    }

    const result = await db
      .updateTable('tables')
      .set({ archived_at: action === 'archive' ? new Date() : null })
      .where('id', 'in', ids)
      .returning('id')
      .execute();
    void logActivity({
      actorId: (req as any).user?.userId ?? null,
      actorRole: userRole,
      action: action === 'archive' ? 'table.archived' : 'table.unarchived',
      entityType: 'table',
      entityId: null,
      summary: `${action === 'archive' ? 'Arquivamento' : 'Desarquivamento'} em lote: ${result.length} mesa(s).`,
      metadata: { count: result.length, ids },
    });
    return res.json({ data: { updated: result.length } });
  } catch (error: any) {
    console.error('[POST /admin/tables/batch]', error);
    return res.status(500).json({ error: 'Erro na ação em lote de mesas.' });
  }
});

// PUT /api/v1/admin/tables/:id — Ações administrativas (status, covil, etc.)
router.put('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user.role;
  const { id } = req.params;
  const { status, is_covil } = req.body;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const updateData: any = {};
    if (status !== undefined) {
      const validStatuses = ['active', 'full', 'cancelled', 'ended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Valores: ${validStatuses.join(', ')}` });
      }
      updateData.status = status;
    }

    if (is_covil !== undefined) {
      updateData.is_covil = is_covil;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
    }

    // 1a publicacao via ativacao admin grava published_at (mesma ancora do fluxo GM,
    // gmPanel). Sem isso, ativar um rascunho/importado antigo deixaria o auto-arquivamento
    // (D-MESAS1) arquivá-lo de imediato por created_at em vez de 30 dias após publicar.
    if (updateData.status === 'active') {
      const current = await db
        .selectFrom('tables')
        .select(['published_at'])
        .where('id', '=', id)
        .executeTakeFirst();
      if (current && !current.published_at) {
        updateData.published_at = new Date();
      }
    }

    const [result] = await db
      .updateTable('tables')
      .set(updateData)
      .where('id', '=', id)
      .returning(['id', 'slug', 'title', 'status', 'is_covil'])
      .execute();

    return res.json({ data: result });
  } catch (error: any) {
    console.error('[PUT /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mesa.' });
  }
});

// DELETE /api/v1/admin/tables/:id — Exclusão administrativa de mesa
router.delete('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user.role;
  const { id } = req.params;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const existingTable = await db
      .selectFrom('tables')
      .select(['id', 'title'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!existingTable) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    await TableRepository.deleteTableWithRelations(id);

    return res.json({ data: { message: `Mesa administrativa "${existingTable.title}" excluída.` } });
  } catch (error: any) {
    console.error('[DELETE /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao excluir mesa.' });
  }
});

export default router;
