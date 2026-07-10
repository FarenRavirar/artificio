import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import { logActivity } from '../services/activityLogger';
import { resolveActorName } from '../services/actorNameResolver';
import { listAdminHandler, rejectHandler } from './suggestionHelpers';
import { scoreSystemCandidates } from '../services/systemSuggestionCandidates';
import type { CandidateSystemInput, CandidateAliasInput } from '../services/systemSuggestionCandidates';
import { slugify, VALID_PARENT } from './systems';
import type { SystemNodeType } from '../db/types';
import { normalizeDraftPayload } from '../discord';
// Achado CodeRabbit (PR #145): esta rota aprovava/resolvia sugestoes gravando
// direto em systems/system_aliases LOCAIS, enquanto GET /api/v1/systems ja le
// so do catalogo central (spec 062). Sistema aprovado por sugestao ficava
// invisivel no picker/API publica. Toda escrita de no/alias migra pro
// catalogClient (HTTP para o site, fonte unica de verdade); a transacao
// Postgres local so cobre system_suggestions/notifications/activity_log e
// o relink de drafts Discord, nunca mais systems/system_aliases.
import {
  createCatalogNode,
  loadCatalogFlat,
  updateCatalogNode,
  invalidateCatalogCache,
  type CatalogNodeInput,
  type MesasSystemNode,
} from '../services/catalogClient';

const router = Router();

const VALID_RESOLUTION_TYPES = new Set([
  'create_system',
  'create_child',
  'create_chain',
  'create_alias',
  'merge_existing',
  'reject',
]);

function readTrimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// Adapta o catalogo central (MesasSystemNode[], aliases embutidos por no) para
// o formato plano que scoreSystemCandidates espera (systems + aliases soltos).
function toCandidateInputs(nodes: MesasSystemNode[]): {
  systems: CandidateSystemInput[];
  aliases: CandidateAliasInput[];
} {
  const systems: CandidateSystemInput[] = [];
  const aliases: CandidateAliasInput[] = [];
  for (const node of nodes) {
    systems.push({
      id: node.id,
      name: node.name,
      name_pt: node.name_pt,
      slug: node.slug,
      path_slug: node.path_slug,
      node_type: node.node_type,
      parent_id: node.parent_id,
    });
    for (const alias of node.aliases) {
      aliases.push({ system_id: node.id, alias });
    }
  }
  return { systems, aliases };
}

// Mescla aliases existentes de um no com novos aliases, deduplicando por slug
// normalizado. Nunca retorna lista menor que a original (evita apagar aliases
// via PUT — achado CodeRabbit PR #145 sobre aliases:[] no updateCatalogNode).
function mergeAliases(existing: string[], toAdd: Array<string | null | undefined>): {
  merged: string[];
  added: string[];
} {
  const seenSlugs = new Set(existing.map((alias) => slugify(alias)).filter(Boolean));
  const merged = [...existing];
  const added: string[] = [];
  for (const raw of toAdd) {
    const alias = typeof raw === 'string' ? raw.trim() : '';
    if (!alias) continue;
    const aliasSlug = slugify(alias);
    if (!aliasSlug || seenSlugs.has(aliasSlug)) continue;
    seenSlugs.add(aliasSlug);
    merged.push(alias);
    added.push(alias);
  }
  return { merged, added };
}

// Religa drafts Discord cujo raw_system_hint corresponde ao sistema resolvido.
// Espelha o comportamento do approve (status -> ready), com try/catch por draft
// para que um draft problematico nao bloqueie os demais. A constraint
// discord_drafts_ready_requires_no_missing (migration 118) pode rejeitar drafts
// que ainda tenham outros campos faltando; nesse caso o draft fica intacto.
async function relinkDiscordDrafts(
  systemId: string,
  canonicalName: string,
  hints: Array<string | null | undefined>,
): Promise<Array<{ id: string; title: string | null }>> {
  const linked: Array<{ id: string; title: string | null }> = [];
  const wanted = new Set(hints.filter((h): h is string => typeof h === 'string' && h.length > 0));
  if (wanted.size === 0) return linked;

  try {
    const drafts = await db
      .selectFrom('discord_import_table_drafts')
      .select(['id', 'parsed_payload'])
      .where('status', 'not in', ['synced', 'rejected'])
      .execute();

    for (const draft of drafts) {
      const payload = normalizeDraftPayload(draft.parsed_payload);
      const payloadTable = payload.table as Record<string, unknown> | undefined;
      const hint = payloadTable?.raw_system_hint;
      if (!hint || !wanted.has(String(hint))) continue;

      const updated = {
        ...payload,
        table: {
          ...(payloadTable ?? {}),
          system_id: systemId,
          system_name: canonicalName,
          raw_system_hint: null,
        },
      };
      try {
        await db
          .updateTable('discord_import_table_drafts')
          .set({ parsed_payload: updated, status: 'ready' })
          .where('id', '=', draft.id)
          .execute();
        linked.push({ id: draft.id, title: (payloadTable?.title as string | null) ?? null });
      } catch (perDraftErr) {
        console.error('[resolve] relink draft falhou', draft.id, perDraftErr);
      }
    }
  } catch (linkErr) {
    console.error('[resolve] Erro ao linkar drafts:', linkErr);
  }
  return linked;
}

type SystemChainInput = {
  id: string;
  name: string;
  name_pt: string | null;
  node_type: SystemNodeType;
  parent_id: string | null;
  batch_index: number | null;
  parent_suggestion_index: number | null;
  description: string | null;
};

// Cria no central (site) antes de qualquer transacao local — HTTP externo nao
// participa da transacao Postgres do mesas. Pior caso de falha parcial: no
// criado no catalogo central mas a sugestao nao chega a ser marcada aprovada;
// reexecutar approve/resolve e seguro (create_alias ja e idempotente por slug,
// demais casos exigiriam nova sugestao — aceitavel, sem escrita duplicada
// silenciosa no catalogo central).
// Achado Sonar (PR #145): validacao de parent extraida para reduzir
// complexidade cognitiva de createSystemNode.
async function assertValidChainParent(nodeType: SystemNodeType, parentId: string | null): Promise<void> {
  if (!parentId) return;
  const parent = (await loadCatalogFlat()).find((node) => node.id === parentId);
  if (!parent) {
    throw new Error('PARENT_NOT_FOUND');
  }
  const allowedParents = VALID_PARENT[nodeType];
  if (allowedParents && !allowedParents.includes(parent.node_type)) {
    throw new Error('HIERARCHY_INVALID');
  }
}

async function createSystemNode(
  input: {
    name: string;
    namePt: string | null;
    nodeType: SystemNodeType;
    parentId: string | null;
    description: string | null;
    aliases?: string[];
  },
): Promise<{ id: string; name: string; path_slug: string }> {
  const segmentSlug = slugify(input.name);
  if (!segmentSlug) {
    throw new Error('NAME_REQUIRED');
  }

  if (input.nodeType !== 'system' && !input.parentId) {
    throw new Error('PARENT_REQUIRED');
  }

  await assertValidChainParent(input.nodeType, input.parentId);

  const catalogInput: CatalogNodeInput = {
    name: input.name,
    name_pt: input.namePt,
    description: input.description,
    node_type: input.nodeType,
    parent_id: input.parentId,
    aliases: input.aliases && input.aliases.length > 0 ? input.aliases : undefined,
  };

  try {
    const created = await createCatalogNode(catalogInput);
    invalidateCatalogCache();
    return { id: created.id, name: created.name, path_slug: created.path_slug ?? '' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('duplicate')) throw new Error('PATH_SLUG_CONFLICT');
    throw error;
  }
}

// Adiciona aliases num no ja existente do catalogo central via updateCatalogNode,
// preservando os demais campos e mesclando aliases (nunca envia array vazio).
async function appendAliasesToNode(
  nodeId: string,
  toAdd: Array<string | null | undefined>,
): Promise<void> {
  const cleanToAdd = toAdd.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
  if (cleanToAdd.length === 0) return;

  const target = (await loadCatalogFlat()).find((node) => node.id === nodeId);
  if (!target) {
    throw new Error('PARENT_NOT_FOUND');
  }

  const { merged, added } = mergeAliases(target.aliases, cleanToAdd);
  if (added.length === 0) return;

  await updateCatalogNode(target.id, {
    name: target.name,
    name_pt: target.name_pt ?? null,
    description: target.description,
    node_type: target.node_type,
    parent_id: target.parent_id,
    aliases: merged,
  });
  invalidateCatalogCache();
}

router.use(authMiddleware, requireRole('admin'));

// GET /api/v1/admin/system-suggestions - Listar todas as sugestões
router.get('/system-suggestions', (req, res) =>
  listAdminHandler({ tableName: 'system_suggestions', logTag: 'system-suggestions' }, req, res));

// GET /api/v1/admin/system-suggestions/:id/candidates - Candidatos provaveis do catalogo
router.get('/system-suggestions/:id/candidates', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const suggestion = await db
      .selectFrom('system_suggestions')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!suggestion) {
      return res.status(404).json({ error: 'Sugestão não encontrada.' });
    }

    const catalogNodes = await loadCatalogFlat();
    const { systems, aliases } = toCandidateInputs(catalogNodes);

    const result = scoreSystemCandidates(suggestion.name, systems, aliases);

    return res.json({
      data: {
        suggestion,
        candidates: result.candidates,
        recommended_action: result.recommended_action,
        analysis: result.analysis,
      },
    });
  } catch (error: any) {
    console.error('[GET /admin/system-suggestions/:id/candidates]', error);
    return res.status(500).json({ error: 'Erro ao calcular candidatos.' });
  }
});

// PATCH /api/v1/admin/system-suggestions/:id/approve - Aprovar sugestão
router.patch('/system-suggestions/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user?.userId;

    if (!adminId) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    // 1. Leitura local (fora de transacao): sugestao precisa estar pending.
    const suggestion = await db
      .selectFrom('system_suggestions')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (!suggestion) {
      throw new Error('NOT_FOUND_OR_REVIEWED');
    }

    // 2. Validar parent no catalogo central (fora de transacao).
    if (suggestion.parent_id) {
      const parentExists = (await loadCatalogFlat()).some((node) => node.id === suggestion.parent_id);
      if (!parentExists) {
        throw new Error('PARENT_NOT_FOUND');
      }
    }

    // 3. Criar no + aliases no catalogo central (HTTP, fora de transacao local).
    let newSystem: { id: string; name: string; path_slug: string };
    try {
      const created = await createCatalogNode({
        name: suggestion.name,
        name_pt: suggestion.name_pt,
        description: suggestion.description,
        node_type: suggestion.node_type,
        parent_id: suggestion.parent_id,
        aliases: suggestion.aliases && suggestion.aliases.length > 0 ? suggestion.aliases : undefined,
      });
      invalidateCatalogCache();
      newSystem = { id: created.id, name: created.name, path_slug: created.path_slug ?? '' };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('duplicate')) throw new Error('PATH_SLUG_CONFLICT');
      throw error;
    }

    // 4. Transacao Postgres local pequena: so system_suggestions/notifications/activity_log.
    const result = await db.transaction().execute(async (trx) => {
      const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

      await trx
        .updateTable('system_suggestions')
        .set({
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: adminId,
        })
        .where('id', '=', id)
        .execute();

      await trx
        .insertInto('notifications')
        .values({
          user_id: suggestion.user_id,
          type: 'suggestion_approved',
          title: 'Sugestão aprovada',
          message: `Seu sistema "${suggestion.name}" foi adicionado ao catálogo.`,
          action_url: `/catalogo?system=${newSystem.path_slug}`,
          metadata: JSON.stringify({
            suggestion_id: id,
            suggestion_kind: 'system',
            system_id: newSystem.id,
            path_slug: newSystem.path_slug,
          }),
        })
        .execute();

      await logActivity({
        actorId: adminId,
        actorRole: 'admin',
        action: 'system_suggestion.approved',
        entityType: 'system_suggestion',
        entityId: id,
        entityLabel: suggestion.name,
        targetUserId: suggestion.user_id,
        summary: `${adminName} aprovou "${suggestion.name}" e adicionou ao catálogo.`,
        metadata: {
          suggestion_id: id,
          system_id: newSystem.id,
          path_slug: newSystem.path_slug,
        },
      }, trx);

      return {
        suggestion_id: id,
        system_id: newSystem.id,
        system_name: suggestion.name,
        path_slug: newSystem.path_slug,
      };
    });

    // Achado Sonar (PR #145): bloco de relink duplicava relinkDiscordDrafts
    // (mesma logica, so log-tag diferente) e inflava a complexidade cognitiva
    // do handler. Reusa o helper generico ja usado pelos demais resolutionType.
    const pendingDrafts = await relinkDiscordDrafts(result.system_id, result.system_name, [result.system_name]);

    return res.json({ success: true, data: { ...result, pending_drafts: pendingDrafts } });
  } catch (error: any) {
    console.error('[PATCH /admin/system-suggestions/:id/approve]', error);

    if (error.message === 'NOT_FOUND_OR_REVIEWED') {
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    }
    if (error.message === 'PARENT_NOT_FOUND') {
      return res.status(404).json({ error: 'Sistema pai não encontrado.' });
    }
    if (error.message === 'PATH_SLUG_CONFLICT') {
      return res.status(409).json({ error: 'Já existe um sistema com este caminho.' });
    }

    return res.status(500).json({ error: 'Erro ao aprovar sugestão.' });
  }
});

// PATCH /api/v1/admin/system-suggestions/:id/reject - Rejeitar sugestão
router.patch('/system-suggestions/:id/reject', (req, res) =>
  rejectHandler({ tableName: 'system_suggestions', suggestionKind: 'system', logTag: 'systemSuggestionsAdmin' }, req, res));

type SuggestionRow = Awaited<ReturnType<typeof loadPendingSuggestion>>;

type ResolveContext = {
  id: string;
  adminId: string;
  suggestion: NonNullable<SuggestionRow>;
  body: Record<string, unknown>;
  extraAliases: string[];
  parentAliases: string[];
};

type ResolveOutcome = {
  resolution_type: string;
  system_id: string;
  system_name: string;
  pending_drafts: Array<{ id: string; title: string | null }>;
};

async function loadPendingSuggestion(id: string) {
  return db
    .selectFrom('system_suggestions')
    .selectAll()
    .where('id', '=', id)
    .where('status', '=', 'pending')
    .executeTakeFirst();
}

// Achado Sonar (PR #145): handler /resolve tinha complexidade cognitiva 56
// (todos os resolutionType num so bloco). Cada resolutionType agora e uma
// funcao propria; o handler so despacha e trata erro num catch central.
async function resolveReject(ctx: ResolveContext): Promise<{ resolution_type: string; pending_drafts: [] }> {
  const { id, adminId, suggestion, body } = ctx;
  await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });
    const reason = readTrimmed(body.reason);

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'rejected',
        rejection_reason: reason,
        resolution_type: 'reject',
        resolution_notes: reason,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', id)
      .execute();

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
          suggestion_kind: 'system',
          ...(reason ? { reason } : {}),
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.rejected',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} rejeitou a sugestão "${suggestion.name}".`,
      metadata: { suggestion_id: id, ...(reason ? { reason } : {}) },
    }, trx);

    return { kind: 'reject' as const, suggestion };
  });

  return { resolution_type: 'reject', pending_drafts: [] };
}

async function resolveMergeExisting(ctx: ResolveContext): Promise<ResolveOutcome> {
  const { id, adminId, suggestion, body } = ctx;
  const targetSystemId = readTrimmed(body.target_system_id);
  const notes = readTrimmed(body.notes);
  if (!targetSystemId) {
    throw new Error('TARGET_REQUIRED');
  }

  const target = (await loadCatalogFlat()).find((node) => node.id === targetSystemId);
  if (!target) {
    throw new Error('TARGET_NOT_FOUND');
  }

  const outcome = await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'approved',
        resolution_type: 'merge_existing',
        resolved_system_id: target.id,
        resolution_notes: notes,
        resolution_payload: JSON.stringify({ target_system_id: target.id }) as any,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', id)
      .execute();

    await trx
      .insertInto('notifications')
      .values({
        user_id: suggestion.user_id,
        type: 'suggestion_approved',
        title: 'Sugestão revisada',
        message: `Sua sugestão "${suggestion.name}" já está coberta por "${target.name}" no catálogo.`,
        action_url: `/catalogo?system=${target.path_slug ?? ''}`,
        metadata: JSON.stringify({
          suggestion_id: id,
          suggestion_kind: 'system',
          resolution_type: 'merge_existing',
          system_id: target.id,
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.resolved',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} mesclou "${suggestion.name}" em "${target.name}".`,
      metadata: { suggestion_id: id, resolution_type: 'merge_existing', system_id: target.id },
    }, trx);

    return {
      kind: 'merge_existing' as const,
      suggestion,
      systemId: target.id,
      systemName: target.name,
    };
  });

  const pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
    outcome.suggestion.name,
    outcome.systemName,
  ]);

  return { resolution_type: 'merge_existing', system_id: outcome.systemId, system_name: outcome.systemName, pending_drafts: pendingDrafts };
}

async function resolveCreateAlias(ctx: ResolveContext): Promise<ResolveOutcome> {
  const { id, adminId, suggestion, body } = ctx;
  const targetSystemId = readTrimmed(body.target_system_id);
  const aliasText = readTrimmed(body.alias) ?? suggestion.name;
  const notes = readTrimmed(body.notes);
  if (!targetSystemId) {
    throw new Error('TARGET_REQUIRED');
  }

  const target = (await loadCatalogFlat()).find((node) => node.id === targetSystemId);
  if (!target) {
    throw new Error('TARGET_NOT_FOUND');
  }

  const aliasSlug = slugify(aliasText);
  const idempotent = target.aliases.some((a) => slugify(a) === aliasSlug);

  if (!idempotent) {
    const { merged } = mergeAliases(target.aliases, [aliasText]);
    await updateCatalogNode(target.id, {
      name: target.name,
      name_pt: target.name_pt ?? null,
      description: target.description,
      node_type: target.node_type,
      parent_id: target.parent_id,
      aliases: merged,
    });
    invalidateCatalogCache();
  }

  // Sem endpoint dedicado de alias-id no catalogo central: aliasId usa o
  // slug normalizado como identificador estavel (nao ha registro proprio
  // por linha como no antigo system_aliases local).
  const aliasId = aliasSlug;

  const outcome = await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'approved',
        resolution_type: 'create_alias',
        resolved_system_id: target.id,
        created_alias_id: aliasId,
        resolution_notes: notes,
        resolution_payload: JSON.stringify({
          target_system_id: target.id,
          alias: aliasText,
          idempotent,
        }) as any,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', id)
      .execute();

    await trx
      .insertInto('notifications')
      .values({
        user_id: suggestion.user_id,
        type: 'suggestion_approved',
        title: 'Sugestão aprovada',
        message: `Sua sugestão "${suggestion.name}" foi adicionada como nome alternativo de "${target.name}".`,
        action_url: `/catalogo?system=${target.path_slug ?? ''}`,
        metadata: JSON.stringify({
          suggestion_id: id,
          suggestion_kind: 'system',
          resolution_type: 'create_alias',
          system_id: target.id,
          alias_id: aliasId,
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.resolved',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} resolveu "${suggestion.name}" como alias de "${target.name}".`,
      metadata: {
        suggestion_id: id,
        resolution_type: 'create_alias',
        system_id: target.id,
        alias_id: aliasId,
        idempotent,
      },
    }, trx);

    return {
      kind: 'create_alias' as const,
      suggestion,
      systemId: target.id,
      systemName: target.name,
    };
  });

  const pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
    outcome.suggestion.name,
    outcome.systemName,
  ]);

  return { resolution_type: 'create_alias', system_id: outcome.systemId, system_name: outcome.systemName, pending_drafts: pendingDrafts };
}

async function resolveCreateChain(ctx: ResolveContext): Promise<ResolveOutcome> {
  const { id, adminId, suggestion, body } = ctx;
  const notes = readTrimmed(body.notes);
  const sourceRows = suggestion.batch_id
    ? await db
      .selectFrom('system_suggestions')
      .selectAll()
      .where('batch_id', '=', suggestion.batch_id)
      .where('status', '=', 'pending')
      .orderBy('batch_index', 'asc')
      .execute()
    : [suggestion];
  const chainRows = sourceRows
    .map((row): SystemChainInput => ({
      id: row.id,
      name: row.name,
      name_pt: row.name_pt,
      node_type: row.node_type,
      parent_id: row.parent_id,
      batch_index: row.batch_index,
      parent_suggestion_index: row.parent_suggestion_index,
      description: row.description,
    }))
    .sort((a, b) => (a.batch_index ?? 0) - (b.batch_index ?? 0));

  if (chainRows.length === 0 || chainRows.length > 3) {
    throw new Error('CHAIN_INVALID');
  }

  // Criacao no catalogo central acontece fora de qualquer transacao local.
  const createdByIndex = new Map<number, { id: string; name: string; path_slug: string | null }>();
  const createdNodes: Array<{ suggestion_id: string; system_id: string; name: string; path_slug: string | null }> = [];

  for (let index = 0; index < chainRows.length; index += 1) {
    const row = chainRows[index];
    const parentFromSuggestion = row.parent_suggestion_index === null
      ? null
      : createdByIndex.get(row.parent_suggestion_index);
    if (row.parent_suggestion_index !== null && !parentFromSuggestion) {
      throw new Error('CHAIN_INVALID');
    }

    const created = await createSystemNode({
      name: row.name,
      namePt: row.name_pt,
      nodeType: row.node_type,
      parentId: row.parent_id ?? parentFromSuggestion?.id ?? null,
      description: row.description,
    });
    createdByIndex.set(row.batch_index ?? index, created);
    createdNodes.push({
      suggestion_id: row.id,
      system_id: created.id,
      name: created.name,
      path_slug: created.path_slug,
    });
  }

  const lastCreated = createdNodes[createdNodes.length - 1];
  if (!lastCreated) {
    throw new Error('CHAIN_INVALID');
  }

  const outcome = await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'approved',
        resolution_type: 'create_chain',
        resolved_system_id: createdNodes[0]?.system_id ?? null,
        created_system_id: lastCreated.system_id,
        resolution_notes: notes,
        resolution_payload: JSON.stringify({
          batch_id: suggestion.batch_id,
          created_nodes: createdNodes,
        }) as any,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', 'in', chainRows.map((row) => row.id))
      .execute();

    await trx
      .insertInto('notifications')
      .values({
        user_id: suggestion.user_id,
        type: 'suggestion_approved',
        title: 'Sugestão aprovada',
        message: `Sua sugestão "${suggestion.name}" foi adicionada ao catálogo.`,
        action_url: `/catalogo?system=${lastCreated.path_slug ?? ''}`,
        metadata: JSON.stringify({
          suggestion_id: id,
          suggestion_kind: 'system',
          resolution_type: 'create_chain',
          system_id: lastCreated.system_id,
          path_slug: lastCreated.path_slug,
          batch_id: suggestion.batch_id,
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.resolved',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} criou uma cadeia de ${createdNodes.length} nós a partir da sugestão "${suggestion.name}".`,
      metadata: {
        suggestion_id: id,
        resolution_type: 'create_chain',
        batch_id: suggestion.batch_id,
        created_nodes: createdNodes,
      },
    }, trx);

    return {
      kind: 'create_chain' as const,
      suggestion,
      systemId: lastCreated.system_id,
      systemName: lastCreated.name,
    };
  });

  const pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
    outcome.suggestion.name,
    outcome.systemName,
  ]);

  return { resolution_type: 'create_chain', system_id: outcome.systemId, system_name: outcome.systemName, pending_drafts: pendingDrafts };
}

async function resolveCreateChild(ctx: ResolveContext): Promise<ResolveOutcome> {
  const { id, adminId, suggestion, body, extraAliases, parentAliases } = ctx;
  const nodeType = typeof body.node_type === 'string' ? (body.node_type as SystemNodeType) : undefined;
  const parentId = readTrimmed(body.parent_id);
  const name = readTrimmed(body.name) ?? suggestion.name;
  const namePt = readTrimmed(body.name_pt) ?? suggestion.name_pt;
  const description = readTrimmed(body.description) ?? suggestion.description;

  if (!nodeType || !['edition', 'variant', 'subsystem'].includes(nodeType)) {
    throw new Error('NODE_TYPE_INVALID');
  }
  if (!parentId) {
    throw new Error('PARENT_REQUIRED');
  }

  const parent = (await loadCatalogFlat()).find((node) => node.id === parentId);
  if (!parent) {
    throw new Error('PARENT_NOT_FOUND');
  }

  const allowedParents = VALID_PARENT[nodeType];
  if (allowedParents && !allowedParents.includes(parent.node_type)) {
    throw new Error('HIERARCHY_INVALID');
  }

  const newSystem = await createSystemNode({
    name,
    namePt,
    nodeType,
    parentId: parent.id,
    description,
    aliases: [...(suggestion.aliases ?? []), ...extraAliases],
  });

  // Aliases do pai (nao do no recem-criado) exigem update separado no pai.
  await appendAliasesToNode(parent.id, parentAliases);

  const outcome = await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'approved',
        resolution_type: 'create_child',
        resolved_system_id: parent.id,
        created_system_id: newSystem.id,
        resolution_notes: readTrimmed(body.notes),
        resolution_payload: JSON.stringify({
          node_type: nodeType,
          parent_id: parent.id,
          path_slug: newSystem.path_slug,
          aliases: extraAliases,
          parent_aliases: parentAliases,
        }) as any,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', id)
      .execute();

    await trx
      .insertInto('notifications')
      .values({
        user_id: suggestion.user_id,
        type: 'suggestion_approved',
        title: 'Sugestão aprovada',
        message: `Sua sugestão "${suggestion.name}" foi adicionada ao catálogo.`,
        action_url: `/catalogo?system=${newSystem.path_slug}`,
        metadata: JSON.stringify({
          suggestion_id: id,
          suggestion_kind: 'system',
          resolution_type: 'create_child',
          system_id: newSystem.id,
          path_slug: newSystem.path_slug,
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.resolved',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} resolveu "${suggestion.name}" como ${nodeType} de "${parent.name}".`,
      metadata: {
        suggestion_id: id,
        resolution_type: 'create_child',
        system_id: newSystem.id,
        path_slug: newSystem.path_slug,
        parent_aliases: parentAliases,
      },
    }, trx);

    return {
      kind: 'create_child' as const,
      suggestion,
      systemId: newSystem.id,
      systemName: newSystem.name,
    };
  });

  const pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
    outcome.suggestion.name,
    outcome.systemName,
  ]);

  return { resolution_type: 'create_child', system_id: outcome.systemId, system_name: outcome.systemName, pending_drafts: pendingDrafts };
}

async function resolveCreateSystem(ctx: ResolveContext): Promise<ResolveOutcome> {
  const { id, adminId, suggestion, body, extraAliases } = ctx;
  const name = readTrimmed(body.name) ?? suggestion.name;
  const namePt = readTrimmed(body.name_pt) ?? suggestion.name_pt;
  const description = readTrimmed(body.description) ?? suggestion.description;
  const editionName = readTrimmed(body.edition_name);
  const force = body.force === true;

  // NFR-001: nao criar raiz por clique unico se houver candidato similar (sem force).
  if (!force) {
    const catalogNodes = await loadCatalogFlat();
    const { systems: systemsForGuard, aliases: aliasesForGuard } = toCandidateInputs(catalogNodes);
    const guard = scoreSystemCandidates(name, systemsForGuard, aliasesForGuard);
    if (guard.recommended_action !== 'create_system' && guard.candidates.length > 0) {
      const err: any = new Error('SIMILAR_EXISTS');
      err.candidates = guard.candidates;
      err.recommended_action = guard.recommended_action;
      err.analysis = guard.analysis;
      throw err;
    }
  }

  const newSystem = await createSystemNode({
    name,
    namePt,
    nodeType: 'system',
    parentId: null,
    description,
    aliases: [...(suggestion.aliases ?? []), ...extraAliases],
  });

  // Edição específica opcional: cria um nó edition sob a nova raiz no mesmo ato.
  let createdNode: { id: string; name: string; path_slug: string | null } = newSystem;
  let createdEditionId: string | null = null;
  if (editionName) {
    const editionCreated = await createSystemNode({
      name: editionName,
      namePt: null,
      nodeType: 'edition',
      parentId: newSystem.id,
      description,
    });
    createdEditionId = editionCreated.id;
    createdNode = editionCreated;
  }

  const resolvedSystemName = editionName ? `${newSystem.name} ${editionName}` : newSystem.name;

  const outcome = await db.transaction().execute(async (trx) => {
    const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

    await trx
      .updateTable('system_suggestions')
      .set({
        status: 'approved',
        resolution_type: 'create_system',
        resolved_system_id: createdEditionId ? newSystem.id : null,
        created_system_id: createdNode.id,
        resolution_notes: readTrimmed(body.notes),
        resolution_payload: JSON.stringify({
          path_slug: createdNode.path_slug,
          root_id: newSystem.id,
          edition_id: createdEditionId,
        }) as any,
        resolved_at: new Date(),
        reviewed_at: new Date(),
        reviewed_by: adminId,
      })
      .where('id', '=', id)
      .execute();

    await trx
      .insertInto('notifications')
      .values({
        user_id: suggestion.user_id,
        type: 'suggestion_approved',
        title: 'Sugestão aprovada',
        message: `Seu sistema "${suggestion.name}" foi adicionado ao catálogo.`,
        action_url: `/catalogo?system=${createdNode.path_slug}`,
        metadata: JSON.stringify({
          suggestion_id: id,
          suggestion_kind: 'system',
          resolution_type: 'create_system',
          system_id: createdNode.id,
          path_slug: createdNode.path_slug,
        }),
      })
      .execute();

    await logActivity({
      actorId: adminId,
      actorRole: 'admin',
      action: 'system_suggestion.resolved',
      entityType: 'system_suggestion',
      entityId: id,
      entityLabel: suggestion.name,
      targetUserId: suggestion.user_id,
      summary: `${adminName} criou o sistema "${resolvedSystemName}" a partir da sugestão.`,
      metadata: {
        suggestion_id: id,
        resolution_type: 'create_system',
        system_id: createdNode.id,
        path_slug: createdNode.path_slug,
      },
    }, trx);

    return {
      kind: 'create_system' as const,
      suggestion,
      systemId: createdNode.id,
      systemName: resolvedSystemName,
    };
  });

  const pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
    outcome.suggestion.name,
    outcome.systemName,
  ]);

  return { resolution_type: 'create_system', system_id: outcome.systemId, system_name: outcome.systemName, pending_drafts: pendingDrafts };
}

function resolveErrorResponse(res: Response, error: any) {
  console.error('[POST /admin/system-suggestions/:id/resolve]', error);

  switch (error.message) {
    case 'NOT_FOUND_OR_REVIEWED':
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    case 'TARGET_REQUIRED':
      return res.status(400).json({ error: 'É necessário escolher o sistema alvo.' });
    case 'TARGET_NOT_FOUND':
      return res.status(404).json({ error: 'Sistema alvo não encontrado.' });
    case 'NODE_TYPE_INVALID':
      return res.status(400).json({ error: 'Tipo de nó inválido. Use edition, variant ou subsystem.' });
    case 'PARENT_REQUIRED':
      return res.status(400).json({ error: 'É necessário escolher o sistema pai.' });
    case 'PARENT_NOT_FOUND':
      return res.status(404).json({ error: 'Sistema pai não encontrado.' });
    case 'NAME_REQUIRED':
      return res.status(400).json({ error: 'Informe um nome válido.' });
    case 'HIERARCHY_INVALID':
      return res.status(400).json({ error: 'Hierarquia inválida para o tipo de nó escolhido.' });
    case 'PATH_SLUG_CONFLICT':
      return res.status(409).json({ error: 'Já existe um sistema com este caminho.' });
    case 'CHAIN_INVALID':
      return res.status(400).json({ error: 'Cadeia de sugestão inválida.' });
    case 'SIMILAR_EXISTS':
      return res.status(409).json({
        error: 'Há candidatos similares no catálogo. Confirme com force=true para criar mesmo assim.',
        candidates: error.candidates ?? [],
        recommended_action: error.recommended_action ?? null,
        analysis: error.analysis ?? null,
      });
    default:
      return res.status(500).json({ error: 'Erro ao resolver sugestão.' });
  }
}

// POST /api/v1/admin/system-suggestions/:id/resolve - Resolver sugestão (alias/edição/variante/mescla/sistema novo/rejeição)
router.post('/system-suggestions/:id/resolve', async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.userId;

  if (!adminId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const resolutionType = typeof body.resolution_type === 'string' ? body.resolution_type : '';
  const extraAliases = Array.isArray(body.aliases)
    ? body.aliases.filter((a): a is string => typeof a === 'string')
    : [];
  const parentAliases = Array.isArray(body.parent_aliases)
    ? body.parent_aliases.filter((a): a is string => typeof a === 'string')
    : [];

  if (!VALID_RESOLUTION_TYPES.has(resolutionType)) {
    return res.status(400).json({
      error: 'resolution_type inválido. Use create_system, create_child, create_chain, create_alias, merge_existing ou reject.',
    });
  }

  try {
    // Leitura local (fora de transacao): sugestao precisa estar pending.
    const suggestion = await loadPendingSuggestion(id);
    if (!suggestion) {
      throw new Error('NOT_FOUND_OR_REVIEWED');
    }

    const ctx: ResolveContext = { id, adminId, suggestion, body, extraAliases, parentAliases };

    if (resolutionType === 'reject') {
      const outcome = await resolveReject(ctx);
      return res.json({ success: true, data: { suggestion_id: id, resolution_type: outcome.resolution_type, pending_drafts: outcome.pending_drafts } });
    }

    const resolvers: Record<string, (ctx: ResolveContext) => Promise<ResolveOutcome>> = {
      merge_existing: resolveMergeExisting,
      create_alias: resolveCreateAlias,
      create_chain: resolveCreateChain,
      create_child: resolveCreateChild,
      create_system: resolveCreateSystem,
    };

    const outcome = await resolvers[resolutionType](ctx);
    return res.json({
      success: true,
      data: {
        suggestion_id: id,
        resolution_type: outcome.resolution_type,
        system_id: outcome.system_id,
        system_name: outcome.system_name,
        pending_drafts: outcome.pending_drafts,
      },
    });
  } catch (error: any) {
    return resolveErrorResponse(res, error);
  }
});

export default router;
