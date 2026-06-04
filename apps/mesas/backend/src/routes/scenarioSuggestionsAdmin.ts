import { Router, Request, Response } from 'express';
import { Transaction } from 'kysely';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import { Database } from '../db/types';
import { logActivity } from '../services/activityLogger';

const router = Router();

async function resolveActorName(userId: string, trx?: Transaction<Database>): Promise<string> {
  const executor = trx ?? db;

  try {
    const profile = await executor
      .selectFrom('profiles')
      .select('display_name')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (profile?.display_name && profile.display_name.trim().length > 0) {
      return profile.display_name.trim();
    }

    const adminUser = await executor
      .selectFrom('users')
      .select(['username', 'email'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (adminUser?.username && adminUser.username.trim().length > 0) {
      return adminUser.username.trim();
    }

    if (adminUser?.email) {
      return adminUser.email.split('@')[0];
    }
  } catch (error) {
    console.error('[scenarioSuggestionsAdmin][resolveActorName]', error);
  }

  return 'Admin';
}

router.use(authMiddleware, requireRole('admin'));

// GET /api/v1/admin/scenario-suggestions - Listar todas as sugestões
router.get('/scenario-suggestions', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let query = db.selectFrom('scenario_suggestions').selectAll().orderBy('created_at', 'desc');

    if (status && typeof status === 'string') {
      query = query.where('status', '=', status as any);
    }

    const suggestions = await query.execute();
    return res.json({ data: suggestions });
  } catch (error: any) {
    console.error('[GET /admin/scenario-suggestions]', error);
    return res.status(500).json({ error: 'Erro ao listar sugestões.' });
  }
});

// PATCH /api/v1/admin/scenario-suggestions/:id/approve - Aprovar sugestão
router.patch('/scenario-suggestions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId;

    if (!adminId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // Transação completa: SELECT + INSERT scenarios + UPDATE status + INSERT notification
    const result = await db.transaction().execute(async (trx) => {
      // 1. SELECT sugestão WHERE status='pending'
      const suggestion = await trx
        .selectFrom('scenario_suggestions')
        .selectAll()
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!suggestion) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      const adminName = await resolveActorName(adminId, trx);

      // 2. Gerar slug e verificar colisão
      const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = slugify(suggestion.name);

      const existingScenario = await trx
        .selectFrom('scenarios')
        .select('id')
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (existingScenario) {
        throw new Error('SLUG_CONFLICT');
      }

      // 3. INSERT em scenarios (cenários são flat - sem depth/path_slug/parent_id)
      const newScenario = await trx
        .insertInto('scenarios')
        .values({
          name: suggestion.name,
          name_pt: suggestion.name_pt,
          slug,
          description: suggestion.description,
          subgenres: suggestion.subgenres || [],
        })
        .returning(['id', 'name', 'slug'])
        .executeTakeFirstOrThrow();

      // 4. Copiar aliases para scenario_aliases (se existirem)
      if (suggestion.aliases && suggestion.aliases.length > 0) {
        const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        for (const alias of suggestion.aliases) {
          await trx
            .insertInto('scenario_aliases')
            .values({
              scenario_id: newScenario.id,
              alias: alias,
              alias_slug: slugify(alias),
              is_official: false,
            })
            .execute();
        }
      }

      // 4. UPDATE status da sugestão
      await trx
        .updateTable('scenario_suggestions')
        .set({
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: adminId,
        })
        .where('id', '=', id)
        .execute();

      // 5. INSERT em notifications
      await trx
        .insertInto('notifications')
        .values({
          user_id: suggestion.user_id,
          type: 'suggestion_approved',
          title: 'Sugestão aprovada',
          message: `Seu cenário "${suggestion.name}" foi adicionado ao catálogo.`,
          action_url: `/catalogo?scenario=${newScenario.slug}`,
          metadata: JSON.stringify({
            suggestion_id: id,
            suggestion_kind: 'scenario',
            scenario_id: newScenario.id,
            slug: newScenario.slug,
          }),
        })
        .execute();

      await logActivity({
        actorId: adminId,
        actorRole: 'admin',
        action: 'scenario_suggestion.approved',
        entityType: 'scenario_suggestion',
        entityId: id,
        entityLabel: suggestion.name,
        targetUserId: suggestion.user_id,
        summary: `${adminName} aprovou "${suggestion.name}" e adicionou ao catálogo.`,
        metadata: {
          suggestion_id: id,
          scenario_id: newScenario.id,
          slug: newScenario.slug,
        },
      }, trx);

      return {
        suggestion_id: id,
        scenario_id: newScenario.id,
        slug: newScenario.slug,
      };
    });

    return res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[PATCH /admin/scenario-suggestions/:id/approve]', error);
    
    if (error.message === 'NOT_FOUND_OR_REVIEWED') {
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    }
    if (error.message === 'SLUG_CONFLICT') {
      return res.status(409).json({ error: 'Já existe um cenário com este nome.' });
    }
    
    return res.status(500).json({ error: 'Erro ao aprovar sugestão.' });
  }
});

// PATCH /api/v1/admin/scenario-suggestions/:id/reject - Rejeitar sugestão
router.patch('/scenario-suggestions/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const rawReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
    const reason = rawReason.length > 0 ? rawReason : null;
    const adminId = req.user?.userId;

    if (!adminId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // Transação: UPDATE status + INSERT notification
    await db.transaction().execute(async (trx) => {
      // 1. SELECT sugestão WHERE status='pending'
      const suggestion = await trx
        .selectFrom('scenario_suggestions')
        .select(['id', 'user_id', 'name'])
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!suggestion) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      const adminName = await resolveActorName(adminId, trx);

      // 2. UPDATE status para rejected
      await trx
        .updateTable('scenario_suggestions')
        .set({
          status: 'rejected',
          rejection_reason: reason,
          reviewed_at: new Date(),
          reviewed_by: adminId,
        })
        .where('id', '=', id)
        .execute();

      // 3. INSERT em notifications
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
            suggestion_kind: 'scenario',
            ...(reason ? { reason } : {}),
          }),
        })
        .execute();

      await logActivity({
        actorId: adminId,
        actorRole: 'admin',
        action: 'scenario_suggestion.rejected',
        entityType: 'scenario_suggestion',
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

    return res.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /admin/scenario-suggestions/:id/reject]', error);
    
    if (error.message === 'NOT_FOUND_OR_REVIEWED') {
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    }
    
    return res.status(500).json({ error: 'Erro ao rejeitar sugestão.' });
  }
});

export default router;
