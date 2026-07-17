import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import crypto from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { db } from '../db/index.js';
import { logActivity } from '../services/activityLogger.js';
import { notifyAdmins } from '../services/adminNotifications.js';
import { resolveActorName } from '../services/actorNameResolver.js';
import { listMineHandler } from './suggestionHelpers.js';
import { loadSystemCatalogFlat } from '../services/systemCatalogProvider.js';
import { validateSystemSuggestionHierarchy } from '../services/systemHierarchy.js';

const router = Router();

router.use(authMiddleware);

type SuggestionPayload = {
  name?: unknown;
  name_pt?: unknown;
  description?: unknown;
  parent_id?: unknown;
  suggestion_type?: unknown;
  node_type?: unknown;
  parent_suggestion_index?: unknown;
};

const VALID_NODE_TYPES = ['system', 'edition', 'variant'] as const;

const readTrimmed = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const normalizeSuggestionPayload = (payload: SuggestionPayload, index: number) => {
  const name = readTrimmed(payload.name);
  const suggestionType = readTrimmed(payload.suggestion_type) ?? readTrimmed(payload.node_type);
  const parentId = readTrimmed(payload.parent_id);
  const parentSuggestionIndex = typeof payload.parent_suggestion_index === 'number'
    && Number.isInteger(payload.parent_suggestion_index)
    ? payload.parent_suggestion_index
    : null;

  if (!name) throw new Error(`Nome é obrigatório no item ${index + 1}.`);
  if (!suggestionType || !VALID_NODE_TYPES.includes(suggestionType as (typeof VALID_NODE_TYPES)[number])) {
    throw new Error(`Tipo de sugestão inválido no item ${index + 1}.`);
  }
  if (parentSuggestionIndex !== null && (parentSuggestionIndex < 0 || parentSuggestionIndex >= index)) {
    throw new Error(`parent_suggestion_index inválido no item ${index + 1}.`);
  }
  if (parentId && parentSuggestionIndex !== null) {
    throw new Error(`Use parent_id ou parent_suggestion_index no item ${index + 1}, não ambos.`);
  }

  return {
    name,
    name_pt: readTrimmed(payload.name_pt),
    description: readTrimmed(payload.description),
    parent_id: parentId,
    node_type: suggestionType as typeof VALID_NODE_TYPES[number],
    parent_suggestion_index: parentSuggestionIndex,
  };
};

async function validateSuggestionHierarchy(items: ReturnType<typeof normalizeSuggestionPayload>[]): Promise<string | null> {
  const catalog = await loadSystemCatalogFlat();
  const byId = new Map(catalog.map((node) => [node.id, node.node_type]));
  return validateSystemSuggestionHierarchy(items, byId);
}

// POST /api/v1/system-suggestions - Criar sugestao unica ou cadeia em lote
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const rawItems: SuggestionPayload[] = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body?.nodes)
        ? req.body.nodes
        : [req.body];
    if (rawItems.length === 0 || rawItems.length > 3) {
      return res.status(400).json({ error: 'Envie entre 1 e 3 sugestões por lote.' });
    }

    let items: ReturnType<typeof normalizeSuggestionPayload>[];
    try {
      items = rawItems.map((item, index) => normalizeSuggestionPayload(item ?? {}, index));
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : 'Payload inválido.';
      return res.status(400).json({ error: message });
    }
    const hierarchyError = await validateSuggestionHierarchy(items);
    if (hierarchyError) return res.status(400).json({ error: hierarchyError });

    // Verificar limite de 5 sugestões pendentes
    const pendingCount = await db
      .selectFrom('system_suggestions')
      .select(sql<number>`COUNT(id)::int`.as('count'))
      .where('user_id', '=', userId)
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (pendingCount && Number(pendingCount.count) + items.length > 5) {
      return res.status(400).json({ error: 'Você já possui 5 sugestões pendentes. Aguarde a revisão.' });
    }

    const userName = await resolveActorName(userId, { logTag: 'systemSuggestions' });
    const batchId = items.length > 1 ? crypto.randomUUID() : null;

    const newSuggestions = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('system_suggestions')
        .values(items.map((item, index) => ({
          user_id: userId,
          name: item.name,
          name_pt: item.name_pt,
          description: item.description,
          parent_id: item.parent_id,
          node_type: item.node_type,
          batch_id: batchId,
          batch_index: batchId ? index : null,
          parent_suggestion_index: item.parent_suggestion_index,
          status: 'pending',
        })))
        .returningAll()
        .execute();

      return created;
    });

    const newSuggestion = newSuggestions[0];
    if (!newSuggestion) {
      return res.status(500).json({ error: 'Erro ao criar sugestão.' });
    }

    await notifyAdmins({
      type: 'system_suggestion',
      title: 'Nova sugestão de sistema',
      message: items.length > 1
        ? `${userName} sugeriu uma cadeia com ${items.length} nós para o catálogo.`
        : `${userName} sugeriu "${newSuggestion.name}" para o catálogo.`,
      action_url: '/gestao',
      metadata: {
        suggestion_id: newSuggestion.id,
        suggestion_kind: 'system',
        node_type: newSuggestion.node_type,
        parent_id: newSuggestion.parent_id,
        batch_id: batchId,
        batch_size: items.length,
      },
      excludeUserId: userId,
    });

    void logActivity({
      actorId: userId,
      actorRole: req.user?.role,
      action: 'system_suggestion.created',
      entityType: 'system_suggestion',
      entityId: newSuggestion.id,
      entityLabel: newSuggestion.name,
      targetUserId: userId,
      summary: items.length > 1
        ? `${userName} sugeriu uma cadeia de sistemas com ${items.length} nós.`
        : `${userName} sugeriu o sistema "${newSuggestion.name}".`,
      metadata: {
        suggestion_id: newSuggestion.id,
        suggestion_ids: newSuggestions.map((suggestion) => suggestion.id),
        node_type: newSuggestion.node_type,
        parent_id: newSuggestion.parent_id,
        name_pt: newSuggestion.name_pt,
        batch_id: batchId,
        batch_size: items.length,
      },
    });

    return res.status(201).json({ data: items.length === 1 ? newSuggestion : newSuggestions });
  } catch (error) {
    console.error('[POST /system-suggestions]', error);
    return res.status(500).json({ error: 'Erro ao criar sugestão.' });
  }
});

// GET /api/v1/system-suggestions/mine - Listar minhas sugestões
router.get('/mine', (req, res) =>
  listMineHandler({ tableName: 'system_suggestions', logTag: 'system-suggestions' }, req, res));

export default router;
