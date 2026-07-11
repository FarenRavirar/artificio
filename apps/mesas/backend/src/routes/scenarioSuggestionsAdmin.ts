import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import { logActivity } from '../services/activityLogger';
import { resolveActorName } from '../services/actorNameResolver';
import { listAdminHandler, rejectHandler } from './suggestionHelpers';

const router = Router();

router.use(authMiddleware, requireRole('admin'));

// GET /api/v1/admin/scenario-suggestions - Listar todas as sugestões
router.get('/scenario-suggestions', (req, res) =>
  listAdminHandler({ tableName: 'scenario_suggestions', logTag: 'scenario-suggestions' }, req, res));

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

      const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'scenarioSuggestionsAdmin' });

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
  } catch (error: unknown) {
    console.error('[PATCH /admin/scenario-suggestions/:id/approve]', error);

    const message = error instanceof Error ? error.message : undefined;

    if (message === 'NOT_FOUND_OR_REVIEWED') {
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    }
    if (message === 'SLUG_CONFLICT') {
      return res.status(409).json({ error: 'Já existe um cenário com este nome.' });
    }

    return res.status(500).json({ error: 'Erro ao aprovar sugestão.' });
  }
});

// PATCH /api/v1/admin/scenario-suggestions/:id/reject - Rejeitar sugestão
router.patch('/scenario-suggestions/:id/reject', (req, res) =>
  rejectHandler({ tableName: 'scenario_suggestions', suggestionKind: 'scenario', logTag: 'scenarioSuggestionsAdmin' }, req, res));

export default router;
