import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { TableRepository } from '../repositories/tableRepository';
import { autoArchiveStaleTables, AUTO_ARCHIVE_AFTER_DAYS } from '../services/tableArchiving';
import { logActivity } from '../services/activityLogger';
import { triggerMetaScrapeOnPublish } from '../services/metaScrapeClient';
import type { TableStatus, TablesTable } from '../db/types';
import type { Updateable } from 'kysely';
import { z } from 'zod';
import { scanTableDuplicateCandidates } from '../services/tableDuplicateDetection';

const router = Router();

function requireAdminRole(req: Request, res: Response): boolean {
  if (req.user?.role === 'admin') return true;
  res.status(403).json({ error: 'Acesso restrito a administradores.' });
  return false;
}

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
  } catch (error: unknown) {
    console.error('[POST /admin/tables/auto-archive]', error);
    return res.status(500).json({ error: 'Erro no auto-arquivamento.' });
  }
});

// POST /api/v1/admin/tables/batch — ações administrativas em lote (T2.5/R15).
// action: 'archive' | 'unarchive' | 'delete'. Idempotente por id.
router.post('/tables/batch', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
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
        actorId: req.user?.userId ?? null,
        actorRole: userRole ?? null,
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
      actorId: req.user?.userId ?? null,
      actorRole: userRole ?? null,
      action: action === 'archive' ? 'table.archived' : 'table.unarchived',
      entityType: 'table',
      entityId: null,
      summary: `${action === 'archive' ? 'Arquivamento' : 'Desarquivamento'} em lote: ${result.length} mesa(s).`,
      metadata: { count: result.length, ids },
    });
    return res.json({ data: { updated: result.length } });
  } catch (error: unknown) {
    console.error('[POST /admin/tables/batch]', error);
    return res.status(500).json({ error: 'Erro na ação em lote de mesas.' });
  }
});

// Spec 077: scanner sob demanda. Nunca decide, mescla ou apaga mesa sozinho.
// Compara só mesas status='active' e archived_at IS NULL (ver
// scanTableDuplicateCandidates) — rascunho, arquivada ou pausada nunca entra
// no par comparado, só draft×mesa-ativa e mesa-ativa×mesa-ativa.
router.post('/tables/duplicates/scan', authMiddleware, async (req: Request, res: Response) => {
  if (!requireAdminRole(req, res)) return;
  try {
    const result = await scanTableDuplicateCandidates();
    return res.json({ data: result });
  } catch (error: unknown) {
    console.error('[POST /admin/tables/duplicates/scan]', error);
    return res.status(500).json({ error: 'Erro ao verificar mesas duplicadas.' });
  }
});

router.get('/tables/duplicates', authMiddleware, async (req: Request, res: Response) => {
  if (!requireAdminRole(req, res)) return;
  try {
    const rows = await db
      .selectFrom('table_duplicate_candidates as candidate')
      .innerJoin('tables as active_table', 'active_table.id', 'candidate.table_id')
      .leftJoin('tables as other_table', 'other_table.id', 'candidate.candidate_table_id')
      .leftJoin('discord_parse_cases as parse_case', 'parse_case.id', 'candidate.candidate_parse_case_id')
      .leftJoin('discord_import_table_drafts as draft', 'draft.id', 'parse_case.draft_id')
      .select([
        'candidate.id', 'candidate.score', 'candidate.signals_json', 'candidate.status',
        'candidate.reviewed_by', 'candidate.reviewed_at', 'candidate.created_at',
        'active_table.id as table_id', 'active_table.slug as table_slug', 'active_table.title as table_title',
        'other_table.id as candidate_table_id', 'other_table.slug as candidate_table_slug', 'other_table.title as candidate_table_title',
        'parse_case.id as candidate_parse_case_id', 'draft.id as candidate_draft_id',
        'draft.normalized_payload as candidate_draft_payload', 'draft.parsed_payload as candidate_draft_parsed_payload',
      ])
      .orderBy('candidate.status', 'asc')
      .orderBy('candidate.score', 'desc')
      .execute();

    return res.json({ data: rows.map((row) => ({ ...row, score: Number(row.score) })) });
  } catch (error: unknown) {
    console.error('[GET /admin/tables/duplicates]', error);
    return res.status(500).json({ error: 'Erro ao listar mesas duplicadas.' });
  }
});

const duplicateDecisionSchema = z.object({
  status: z.enum(['confirmed_duplicate', 'rejected_duplicate', 'update_existing']),
});

router.patch('/table-duplicate-candidates/:id', authMiddleware, async (req: Request, res: Response) => {
  if (!requireAdminRole(req, res)) return;
  const parsed = duplicateDecisionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Payload inválido.' });

  try {
    const existing = await db
      .selectFrom('table_duplicate_candidates')
      .selectAll()
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!existing) return res.status(404).json({ error: 'Candidato de duplicata não encontrado.' });

    const updated = await db.transaction().execute(async (trx) => {
      // Achado bot review PR #159: filtrar por status='candidate' na própria
      // transação evita decisão concorrente duplicada (TOCTOU entre o SELECT
      // acima e este UPDATE); 409 sinaliza "já resolvido" sem criar feedback.
      const result = await trx
        .updateTable('table_duplicate_candidates')
        .set({
          status: parsed.data.status,
          reviewed_by: req.user?.userId ?? null,
          reviewed_at: new Date(),
          updated_at: new Date(),
        })
        .where('id', '=', existing.id)
        .where('status', '=', 'candidate')
        .returningAll()
        .executeTakeFirst();

      if (!result) return null;

      if (existing.candidate_parse_case_id) {
        await trx.insertInto('discord_parse_feedback').values({
          parse_case_id: existing.candidate_parse_case_id,
          draft_id: null,
          feedback_type: parsed.data.status === 'rejected_duplicate' ? 'not_duplicate' : 'duplicate',
          field: null,
          before_value: { table_id: existing.table_id, previous_status: existing.status },
          after_value: { table_id: existing.table_id, status: parsed.data.status },
          reason: null,
          scope_json: { table_duplicate_candidate_id: existing.id },
          admin_user_id: req.user?.userId ?? null,
        }).execute();
      }
      return result;
    });
    if (!updated) return res.status(409).json({ error: 'Candidato já foi resolvido.' });
    return res.json({ data: { ...updated, score: Number(updated.score) } });
  } catch (error: unknown) {
    console.error('[PATCH /admin/table-duplicate-candidates/:id]', error);
    return res.status(500).json({ error: 'Erro ao resolver candidato de duplicata.' });
  }
});

// PUT /api/v1/admin/tables/:id — Ações administrativas (status, covil, etc.)
router.put('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  const { id } = req.params;
  const { status, is_covil } = req.body as { status?: unknown; is_covil?: unknown };

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const updateData: Updateable<TablesTable> = {};
    if (status !== undefined) {
      const validStatuses: TableStatus[] = ['active', 'full', 'cancelled', 'ended'];
      if (typeof status !== 'string' || !validStatuses.includes(status as TableStatus)) {
        return res.status(400).json({ error: `Status inválido. Valores: ${validStatuses.join(', ')}` });
      }
      updateData.status = status as TableStatus;
    }

    if (is_covil !== undefined) {
      updateData.is_covil = Boolean(is_covil);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
    }

    // 1a publicacao via ativacao admin grava published_at (mesma ancora do fluxo GM,
    // gmPanel). Sem isso, ativar um rascunho/importado antigo deixaria o auto-arquivamento
    // (D-MESAS1) arquivá-lo de imediato por created_at em vez de 30 dias após publicar.
    let previousStatus: string | null = null;
    if (updateData.status === 'active') {
      const current = await db
        .selectFrom('tables')
        .select(['published_at', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
      previousStatus = current?.status ?? null;
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

    // Achado Codex (PR #157): PUT /admin/tables/:id (acoes administrativas de
    // status) tambem publica mesa e nao disparava o scrape automatico de OG.
    if (result && updateData.status) {
      triggerMetaScrapeOnPublish(result.slug, result.status, previousStatus);
    }

    return res.json({ data: result });
  } catch (error: unknown) {
    console.error('[PUT /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mesa.' });
  }
});

// GET /api/v1/admin/tables — Lista mesas de qualquer status (spec 060).
// Sem isto, mesa importada via Discord sync (gm_id: null, status: 'draft')
// fica invisível: GET /api/v1/tables filtra active-only, GET /gm/tables
// filtra por gm_id do usuário logado — nenhum dos dois serve mesa órfã.
router.get('/tables', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  const { status } = req.query;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    let query = db
      .selectFrom('tables')
      .select(['id', 'slug', 'title', 'status', 'gm_id', 'origin', 'created_at', 'is_covil'])
      .orderBy('created_at', 'desc');

    if (typeof status === 'string' && status) {
      query = query.where('status', '=', status as TableStatus);
    }

    const tables = await query.execute();
    return res.json({ data: tables });
  } catch (error: unknown) {
    console.error('[GET /admin/tables]', error);
    return res.status(500).json({ error: 'Erro ao buscar mesas.' });
  }
});

// GET /api/v1/admin/tables/:id — Detalhe de mesa sem exigir gm_id (spec 060).
router.get('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
  const { id } = req.params;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const table = await TableRepository.findById(id);
    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    const contacts = await TableRepository.findContactsByTableId(id);
    const schedules = await TableRepository.findSchedulesByTableId(id);

    return res.json({ data: { ...table, contacts, schedules } });
  } catch (error: unknown) {
    console.error('[GET /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar mesa.' });
  }
});

// DELETE /api/v1/admin/tables/:id — Exclusão administrativa de mesa
router.delete('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = req.user?.role;
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
  } catch (error: unknown) {
    console.error('[DELETE /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao excluir mesa.' });
  }
});

export default router;
