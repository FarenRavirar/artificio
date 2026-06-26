import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { requireAdmin } from '../../middleware/auth';

const router = Router();

// ─── GET /metrics — T-G6: métricas por rodada de importação ──────────────────

router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Últimas 20 rodadas
    const runs = await db
      .selectFrom('discord_import_runs')
      .selectAll()
      .orderBy('started_at', 'desc')
      .limit(20)
      .execute();

    // Totais agregados de correções (todas as rodadas)
    const correctionsAgg = await db
      .selectFrom('import_corrections')
      .select([
        db.fn.count<number>('id').as('total_corrections'),
      ])
      .executeTakeFirst();

    // Distribuição de status atual dos drafts
    const statusAgg = await db
      .selectFrom('discord_import_table_drafts')
      .select([
        db.fn.count<number>('id').as('total_drafts'),
      ])
      .select(db.fn.count<number>('id').filterWhere('status', '=', 'ready').as('ready_drafts'))
      .select(db.fn.count<number>('id').filterWhere('status', '=', 'needs_review').as('needs_review_drafts'))
      .select(db.fn.count<number>('id').filterWhere('status', '=', 'synced').as('synced_drafts'))
      .select(db.fn.count<number>('id').filterWhere('status', '=', 'rejected').as('rejected_drafts'))
      .executeTakeFirst();

    // Campos mais corrigidos (top 10, últimas 500 correções)
    const topFields = await db
      .selectFrom('import_corrections')
      .select('diff')
      .orderBy('created_at', 'desc')
      .limit(500)
      .execute()
      .then((rows) => {
        const fieldCounts: Record<string, number> = {};
        for (const row of rows) {
          const diff = row.diff as Record<string, unknown> | null;
          if (diff && typeof diff === 'object') {
            for (const key of Object.keys(diff)) {
              fieldCounts[key] = (fieldCounts[key] ?? 0) + 1;
            }
          }
        }
        return Object.entries(fieldCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([field, count]) => ({ field, count }));
      });

    return res.json({
      data: {
        runs,
        totals: {
          corrections: correctionsAgg?.total_corrections ?? 0,
          drafts: statusAgg?.total_drafts ?? 0,
          ready: statusAgg?.ready_drafts ?? 0,
          needs_review: statusAgg?.needs_review_drafts ?? 0,
          synced: statusAgg?.synced_drafts ?? 0,
          rejected: statusAgg?.rejected_drafts ?? 0,
        },
        top_corrected_fields: topFields,
      },
    });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/metrics]', error);
    return res.status(500).json({ error: 'Erro ao consultar métricas.' });
  }
});

// ─── GET /metrics/shadow — T-G7: shadow mode — compara decisão automática vs real ──

router.get('/shadow', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // Só decisões com desfecho conhecido (admin já decidiu)
    const completed = await db
      .selectFrom('discord_shadow_decisions')
      .selectAll()
      .where('actual_outcome', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(100)
      .execute();

    // Decisões pendentes (admin ainda não decidiu)
    const pending = await db
      .selectFrom('discord_shadow_decisions')
      .selectAll()
      .where('actual_outcome', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(50)
      .execute();

    // Resumo agregado
    const summary = await db
      .selectFrom('discord_shadow_decisions')
      .select([
        db.fn.count<number>('id').as('total_decisions'),
        db.fn.count<number>('id').filterWhere('would_auto_approve', '=', true).as('would_auto_approve'),
        db.fn.count<number>('id').filterWhere('actual_outcome', 'is not', null).as('decided'),
      ])
      .executeTakeFirst();

    // Comparação: quantas autoaprovariam e foram de fato synced/rejected
    let wouldApproveAndSynced = 0;
    let wouldApproveAndRejected = 0;
    let wouldNotApproveAndSynced = 0;
    let wouldNotApproveAndRejected = 0;

    for (const d of completed) {
      if (d.would_auto_approve && d.actual_outcome === 'synced') wouldApproveAndSynced++;
      if (d.would_auto_approve && d.actual_outcome === 'rejected') wouldApproveAndRejected++;
      if (!d.would_auto_approve && d.actual_outcome === 'synced') wouldNotApproveAndSynced++;
      if (!d.would_auto_approve && d.actual_outcome === 'rejected') wouldNotApproveAndRejected++;
    }

    return res.json({
      data: {
        summary: {
          total: summary?.total_decisions ?? 0,
          would_auto_approve: summary?.would_auto_approve ?? 0,
          decided: summary?.decided ?? 0,
        },
        accuracy: {
          would_approve_and_synced: wouldApproveAndSynced,
          would_approve_and_rejected: wouldApproveAndRejected,
          would_not_approve_and_synced: wouldNotApproveAndSynced,
          would_not_approve_and_rejected: wouldNotApproveAndRejected,
        },
        completed,
        pending,
      },
    });
  } catch (error: unknown) {
    console.error('[GET /admin/discord-sync/metrics/shadow]', error);
    return res.status(500).json({ error: 'Erro ao consultar shadow decisions.' });
  }
});

export default router;
