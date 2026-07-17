import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logActivity } from '../services/activityLogger.js';
import { notifyAdmins } from '../services/adminNotifications.js';
import { resolveActorName } from '../services/actorNameResolver.js';
import { listMineHandler } from './suggestionHelpers.js';

const router = Router();

router.use(authMiddleware);

// POST /api/v1/scenario-suggestions - Criar sugestão
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { name, name_pt, description } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Nome é obrigatório.' });
    }

    // Limite de 5 sugestões pendentes por usuário
    const pendingCount = await db
      .selectFrom('scenario_suggestions')
      .select(sql<number>`COUNT(id)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (pendingCount && Number(pendingCount.count) >= 5) {
      return res.status(400).json({ error: 'Você já possui 5 sugestões pendentes. Aguarde a revisão.' });
    }

    const userName = await resolveActorName(userId, { logTag: 'scenarioSuggestions' });

    const newSuggestion = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('scenario_suggestions')
        .values({
          user_id: userId,
          name: name.trim(),
          name_pt: typeof name_pt === 'string' && name_pt.trim().length > 0 ? name_pt.trim() : null,
          description: typeof description === 'string' && description.trim().length > 0 ? description.trim() : null,
          status: 'pending',
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return created;
    });

    await notifyAdmins({
      type: 'scenario_suggestion',
      title: 'Nova sugestão de cenário',
      message: `${userName} sugeriu "${newSuggestion.name}" para o catálogo.`,
      action_url: '/gestao',
      metadata: {
        suggestion_id: newSuggestion.id,
        suggestion_kind: 'scenario',
      },
      excludeUserId: userId,
    });

    if (newSuggestion) {
      void logActivity({
        actorId: userId,
        actorRole: req.user?.role,
        action: 'scenario_suggestion.created',
        entityType: 'scenario_suggestion',
        entityId: newSuggestion.id,
        entityLabel: newSuggestion.name,
        targetUserId: userId,
        summary: `${userName} sugeriu o cenário "${newSuggestion.name}".`,
        metadata: {
          suggestion_id: newSuggestion.id,
          name_pt: newSuggestion.name_pt,
        },
      });
    }

    return res.status(201).json({ data: newSuggestion });
  } catch (error: unknown) {
    console.error('[POST /scenario-suggestions]', error);
    return res.status(500).json({ error: 'Erro ao criar sugestão.' });
  }
});

// GET /api/v1/scenario-suggestions/mine - Listar minhas sugestões
router.get('/mine', (req, res) =>
  listMineHandler({ tableName: 'scenario_suggestions', logTag: 'scenario-suggestions' }, req, res));

export default router;
