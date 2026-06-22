import type { Request, Response } from 'express';
import { db } from '../db';
import { logActivity } from '../services/activityLogger';
import { resolveActorName } from '../services/actorNameResolver';

export interface RejectConfig {
  tableName: 'scenario_suggestions' | 'system_suggestions';
  suggestionKind: 'scenario' | 'system';
  logTag: string;
}

export async function rejectHandler(config: RejectConfig, req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const rawReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const reason = rawReason.length > 0 ? rawReason : null;
    const adminId = req.user?.userId;

    if (!adminId) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    await db.transaction().execute(async (trx) => {
      const suggestion = await trx
        .selectFrom(config.tableName)
        .select(['id', 'user_id', 'name'])
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!suggestion) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: config.logTag });

      const updated = await trx
        .updateTable(config.tableName)
        .set({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date(),
          reviewed_by: adminId,
        })
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .returning('id')
        .executeTakeFirst();

      if (!updated) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      await trx
        .insertInto('notifications')
        .values({
          user_id: suggestion.user_id,
          type: 'suggestion_rejected',
          title: 'Sugestão revisada',
          message: `Sua sugestão "${suggestion.name}" não foi aceita desta vez.`,
          action_url: `/perfil/minhas-sugestoes/${id}`,
          metadata: JSON.stringify({
            suggestion_id: id,
            suggestion_kind: config.suggestionKind,
            ...(reason ? { reason } : {}),
          }),
        })
        .execute();

      await logActivity({
        actorId: adminId,
        actorRole: 'admin',
        action: `${config.suggestionKind}_suggestion.rejected`,
        entityType: `${config.suggestionKind}_suggestion`,
        entityId: id,
        entityLabel: suggestion.name,
        targetUserId: suggestion.user_id,
        summary: `${adminName} rejeitou a sugestão "${suggestion.name}".`,
        metadata: {
          suggestion_id: id,
          ...(reason ? { reason } : {}),
        },
      }, trx);
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error(`[PATCH /admin/${config.logTag}/:id/reject]`, error);

    if (error.message === 'NOT_FOUND_OR_REVIEWED') {
      res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
      return;
    }

    res.status(500).json({ error: 'Erro ao rejeitar sugestão.' });
  }
}

export interface ListAdminConfig {
  tableName: 'scenario_suggestions' | 'system_suggestions';
  logTag: string;
}

export async function listAdminHandler(config: ListAdminConfig, req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query;

    let query = db.selectFrom(config.tableName).selectAll().orderBy('created_at', 'desc');

    if (status && typeof status === 'string') {
      query = query.where('status', '=', status as any);
    }

    const suggestions = await query.execute();
    res.json({ data: suggestions });
  } catch (error: any) {
    console.error(`[GET /admin/${config.logTag}]`, error);
    res.status(500).json({ error: 'Erro ao listar sugestões.' });
  }
}

export interface ListMineConfig {
  tableName: 'scenario_suggestions' | 'system_suggestions';
  logTag: string;
}

export async function listMineHandler(config: ListMineConfig, req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Não autenticado.' });
      return;
    }

    const suggestions = await db
      .selectFrom(config.tableName)
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'desc')
      .execute();

    res.json({ data: suggestions });
  } catch (error: any) {
    console.error(`[GET /${config.logTag}/mine]`, error);
    res.status(500).json({ error: 'Erro ao listar sugestões.' });
  }
}
