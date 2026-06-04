import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import { logActivity } from '../services/activityLogger';
import { deleteFromCloudinary } from '../services/cloudinary';
import { buildMerge, MAX_MERGE_SOURCES, type MergeableFeedback } from '../services/devFeedbackMerge';
import type { DevFeedbackStatus } from '../db/types';

const router = Router();

const VALID_STATUS: ReadonlySet<DevFeedbackStatus> = new Set([
  'new', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate',
]);

const VALID_KIND = new Set(['bug', 'suggestion']);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve nomes de varios reporters em lote (evita N+1):
 * 1 query em profiles + 1 query em users (so para os sem display_name).
 */
async function resolveActorNames(userIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return names;

  try {
    const profiles = await db
      .selectFrom('profiles')
      .select(['user_id', 'display_name'])
      .where('user_id', 'in', ids)
      .execute();

    for (const p of profiles) {
      if (p.display_name && p.display_name.trim().length > 0) {
        names.set(p.user_id, p.display_name.trim());
      }
    }

    const remaining = ids.filter((id) => !names.has(id));
    if (remaining.length > 0) {
      const users = await db
        .selectFrom('users')
        .select(['id', 'username', 'email'])
        .where('id', 'in', remaining)
        .execute();

      for (const u of users) {
        if (u.username && u.username.trim().length > 0) {
          names.set(u.id, u.username.trim());
        } else if (u.email) {
          names.set(u.id, u.email.split('@')[0]);
        }
      }
    }
  } catch (error) {
    console.error('[devFeedbackAdmin][resolveActorNames]', error);
  }

  return names;
}

router.use(authMiddleware, requireRole('admin'));

// GET /api/v1/admin/dev-feedback?status=&kind= - lista para triagem
router.get('/dev-feedback', async (req: Request, res: Response) => {
  try {
    let query = db.selectFrom('dev_feedback').selectAll().orderBy('created_at', 'desc');

    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (VALID_STATUS.has(status as DevFeedbackStatus)) {
      query = query.where('status', '=', status as DevFeedbackStatus);
    }

    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    if (VALID_KIND.has(kind)) {
      query = query.where('kind', '=', kind as 'bug' | 'suggestion');
    }

    // Arquivados: por padrao escondidos. ?archived=true mostra so arquivados; =all mostra tudo.
    const archived = typeof req.query.archived === 'string' ? req.query.archived : 'false';
    if (archived === 'true') {
      query = query.where('archived_at', 'is not', null);
    } else if (archived !== 'all') {
      query = query.where('archived_at', 'is', null);
    }

    const rows = await query.execute();

    const names = await resolveActorNames(
      rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)),
    );
    const data = rows.map((row) => ({
      ...row,
      reporter_name: row.user_id ? (names.get(row.user_id) ?? 'Anonimo') : 'Anonimo',
    }));

    return res.json({ data });
  } catch (error: any) {
    console.error('[GET /admin/dev-feedback]', error);
    return res.status(500).json({ error: 'Erro ao listar feedbacks.' });
  }
});

// PATCH /api/v1/admin/dev-feedback/:id - atualiza status e/ou notas
router.patch('/dev-feedback/:id', async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    if (!adminId) {
      return res.status(401).json({ error: 'Nao autenticado.' });
    }

    const { id } = req.params;
    // Garante UUID valido: coluna `id` e UUID; entrada malformada retorna 400 em vez de 500.
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};

    const update: Record<string, unknown> = {
      reviewed_by: adminId,
      reviewed_at: new Date(),
      updated_at: new Date(),
    };

    let nextStatus: DevFeedbackStatus | null = null;
    if (typeof body.status === 'string') {
      if (!VALID_STATUS.has(body.status as DevFeedbackStatus)) {
        return res.status(400).json({ error: 'Status invalido.' });
      }
      nextStatus = body.status as DevFeedbackStatus;
      update.status = nextStatus;
    }

    if (typeof body.admin_notes === 'string') {
      const notes = body.admin_notes.trim();
      update.admin_notes = notes.length > 0 ? notes.slice(0, 4000) : null;
    }

    let archivedChange: boolean | null = null;
    if (typeof body.archived === 'boolean') {
      archivedChange = body.archived;
      update.archived_at = body.archived ? new Date() : null;
    }

    const updated = await db
      .updateTable('dev_feedback')
      .set(update)
      .where('id', '=', id)
      .returning(['id', 'kind', 'title', 'status', 'admin_notes', 'updated_at', 'archived_at'])
      .executeTakeFirst();

    if (!updated) {
      return res.status(404).json({ error: 'Feedback nao encontrado.' });
    }

    void logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: archivedChange !== null ? 'dev_feedback.archived' : 'dev_feedback.updated',
      entityType: 'dev_feedback',
      entityId: updated.id,
      entityLabel: updated.title,
      summary: archivedChange !== null
        ? `Feedback "${updated.title}" ${archivedChange ? 'arquivado' : 'desarquivado'}.`
        : `Feedback "${updated.title}" atualizado${nextStatus ? ` para ${nextStatus}` : ''}.`,
      metadata: { status: updated.status, archived: updated.archived_at !== null },
    });

    return res.json({ data: updated });
  } catch (error: any) {
    console.error('[PATCH /admin/dev-feedback/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar feedback.' });
  }
});

// DELETE /api/v1/admin/dev-feedback/:id - remove registro + screenshot Cloudinary
router.delete('/dev-feedback/:id', async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    if (!adminId) {
      return res.status(401).json({ error: 'Nao autenticado.' });
    }

    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      return res.status(400).json({ error: 'ID invalido.' });
    }

    const row = await db
      .selectFrom('dev_feedback')
      .select(['id', 'title', 'screenshot_public_id'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) {
      return res.status(404).json({ error: 'Feedback nao encontrado.' });
    }

    // Limpa o asset do Cloudinary antes de descartar a linha (nao-fatal: a funcao engole erros).
    if (row.screenshot_public_id) {
      await deleteFromCloudinary(row.screenshot_public_id);
    }

    await db.deleteFrom('dev_feedback').where('id', '=', id).execute();

    void logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'dev_feedback.deleted',
      entityType: 'dev_feedback',
      entityId: id,
      entityLabel: row.title,
      summary: `Feedback "${row.title}" excluido.`,
      metadata: { had_screenshot: Boolean(row.screenshot_public_id) },
    });

    return res.json({ data: { id } });
  } catch (error: any) {
    console.error('[DELETE /admin/dev-feedback/:id]', error);
    return res.status(500).json({ error: 'Erro ao excluir feedback.' });
  }
});

// POST /api/v1/admin/dev-feedback/merge - integra secundarios no destino e arquiva os secundarios
router.post('/dev-feedback/merge', async (req: Request, res: Response) => {
  try {
    const adminId = req.user?.userId;
    if (!adminId) {
      return res.status(401).json({ error: 'Nao autenticado.' });
    }

    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};
    const primaryId = typeof body.primary_id === 'string' ? body.primary_id : '';
    const sourceIdsRaw = Array.isArray(body.source_ids) ? body.source_ids : [];
    const sourceIds = Array.from(
      new Set(sourceIdsRaw.filter((v): v is string => typeof v === 'string' && v !== primaryId)),
    );

    if (!UUID_RE.test(primaryId) || sourceIds.some((sid) => !UUID_RE.test(sid))) {
      return res.status(400).json({ error: 'IDs invalidos.' });
    }
    if (sourceIds.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos um feedback para integrar.' });
    }
    if (sourceIds.length > MAX_MERGE_SOURCES) {
      return res.status(400).json({ error: `Maximo de ${MAX_MERGE_SOURCES} feedbacks por mescla.` });
    }

    const result = await db.transaction().execute(async (trx) => {
      const primary = await trx
        .selectFrom('dev_feedback')
        .selectAll()
        .where('id', '=', primaryId)
        .where('archived_at', 'is', null)
        .executeTakeFirst();

      if (!primary) {
        return { error: 'Feedback destino nao encontrado ou arquivado.' as const };
      }

      const sources = await trx
        .selectFrom('dev_feedback')
        .selectAll()
        .where('id', 'in', sourceIds)
        .where('archived_at', 'is', null)
        .execute();

      if (sources.length !== sourceIds.length) {
        return { error: 'Algum feedback de origem nao foi encontrado ou ja esta arquivado.' as const };
      }

      const toMergeable = (r: typeof primary): MergeableFeedback => ({
        id: r.id,
        kind: r.kind,
        title: r.title,
        description: r.description,
        contact_email: r.contact_email,
        screenshot_url: r.screenshot_url,
        page_url: r.page_url,
        route_path: r.route_path,
        environment: r.environment,
        created_at: r.created_at,
        console_errors: Array.isArray(r.console_errors) ? r.console_errors : [],
        network_errors: Array.isArray(r.network_errors) ? r.network_errors : [],
        merged_sources: Array.isArray(r.merged_sources) ? r.merged_sources : [],
      });

      const merged = buildMerge(toMergeable(primary), sources.map(toMergeable));

      await trx
        .updateTable('dev_feedback')
        .set({
          console_errors: JSON.stringify(merged.console_errors),
          network_errors: JSON.stringify(merged.network_errors),
          merged_sources: JSON.stringify(merged.merged_sources),
          updated_at: new Date(),
        })
        .where('id', '=', primaryId)
        .execute();

      await trx
        .updateTable('dev_feedback')
        .set({ archived_at: new Date(), merged_into: primaryId, updated_at: new Date() })
        .where('id', 'in', sourceIds)
        .execute();

      return { ok: true as const, merged_count: sources.length };
    });

    if ('error' in result) {
      return res.status(404).json({ error: result.error });
    }

    void logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'dev_feedback.merged',
      entityType: 'dev_feedback',
      entityId: primaryId,
      entityLabel: null,
      summary: `${result.merged_count} feedback(s) mesclado(s) e arquivado(s) no destino.`,
      metadata: { primary_id: primaryId, source_ids: sourceIds },
    });

    return res.json({ data: { primary_id: primaryId, merged_count: result.merged_count } });
  } catch (error: any) {
    console.error('[POST /admin/dev-feedback/merge]', error);
    return res.status(500).json({ error: 'Erro ao mesclar feedbacks.' });
  }
});

export default router;
