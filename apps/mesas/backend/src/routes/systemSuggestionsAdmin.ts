import { Router, Request, Response } from 'express';
import { Transaction } from 'kysely';
import { authMiddleware, requireRole } from '../middleware/auth';
import { db } from '../db';
import { Database } from '../db/types';
import { logActivity } from '../services/activityLogger';
import { resolveActorName } from '../services/actorNameResolver';
import { listAdminHandler, rejectHandler } from './suggestionHelpers';
import { scoreSystemCandidates } from '../services/systemSuggestionCandidates';
import { slugify, VALID_PARENT } from './systems';
import type { SystemNodeType } from '../db/types';
import { normalizeDraftPayload } from '../discord';

const router = Router();

const VALID_RESOLUTION_TYPES = new Set([
  'create_system',
  'create_child',
  'create_alias',
  'merge_existing',
  'reject',
]);

function readTrimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
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

    const systems = await db
      .selectFrom('systems')
      .select(['id', 'name', 'name_pt', 'slug', 'path_slug', 'node_type', 'parent_id'])
      .execute();

    const aliases = await db
      .selectFrom('system_aliases')
      .select(['system_id', 'alias'])
      .execute();

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

    // Transação completa: SELECT + INSERT systems + UPDATE status + INSERT notification
    const result = await db.transaction().execute(async (trx) => {
      // 1. SELECT sugestão WHERE status='pending'
      const suggestion = await trx
        .selectFrom('system_suggestions')
        .selectAll()
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!suggestion) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

      // 2. Verificar se parent_id existe (se fornecido)
      if (suggestion.parent_id) {
        const parentExists = await trx
          .selectFrom('systems')
          .select('id')
          .where('id', '=', suggestion.parent_id)
          .executeTakeFirst();

        if (!parentExists) {
          throw new Error('PARENT_NOT_FOUND');
        }
      }

      // 3. Gerar path_slug e verificar colisão
      const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const slug = slugify(suggestion.name);
      
      let pathSlug = slug;
      let depth = 0;
      if (suggestion.parent_id) {
        const parent = await trx
          .selectFrom('systems')
          .select(['path_slug', 'depth'])
          .where('id', '=', suggestion.parent_id)
          .executeTakeFirst();

        pathSlug = parent ? `${parent.path_slug}/${slug}` : slug;
        depth = (parent?.depth ?? 0) + 1;
      }

      const existingSystem = await trx
        .selectFrom('systems')
        .select('id')
        .where('path_slug', '=', pathSlug)
        .executeTakeFirst();

      if (existingSystem) {
        throw new Error('PATH_SLUG_CONFLICT');
      }

      // 4. INSERT em systems

      const newSystem = await trx
        .insertInto('systems')
        .values({
          name: suggestion.name,
          name_pt: suggestion.name_pt,
          slug,
          path_slug: pathSlug,
          node_type: suggestion.node_type,
          depth,
          parent_id: suggestion.parent_id,
          description: suggestion.description,
        })
        .returning(['id', 'name', 'path_slug'])
        .executeTakeFirstOrThrow();

      // 5. Copiar aliases para system_aliases (se existirem)
      if (suggestion.aliases && suggestion.aliases.length > 0) {
        const slugify = (str: string) => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        for (const alias of suggestion.aliases) {
          await trx
            .insertInto('system_aliases')
            .values({
              system_id: newSystem.id,
              alias: alias,
              alias_slug: slugify(alias),
              is_official: false,
            })
            .execute();
        }
      }

      // 5. UPDATE status da sugestão
      await trx
        .updateTable('system_suggestions')
        .set({
          status: 'approved',
          reviewed_at: new Date(),
          reviewed_by: adminId,
        })
        .where('id', '=', id)
        .execute();

      // 6. INSERT em notifications
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

    // Pós-transação: linkar drafts Discord que aguardavam este sistema
    const pendingDrafts: Array<{ id: string; title: string | null }> = [];
    try {
      const drafts = await db
        .selectFrom('discord_import_table_drafts')
        .select(['id', 'parsed_payload'])
        .where('status', 'not in', ['synced', 'rejected'])
        .execute();

      for (const draft of drafts) {
        const payload = normalizeDraftPayload(draft.parsed_payload);
        const payloadTable = payload.table as Record<string, unknown> | undefined;
        if (payloadTable?.raw_system_hint === result.system_name) {
          const updated = {
            ...payload,
            table: {
              ...(payloadTable ?? {}),
              system_id: result.system_id,
              system_name: result.system_name,
              raw_system_hint: null,
            },
          };
          await db
            .updateTable('discord_import_table_drafts')
            .set({ parsed_payload: updated, status: 'ready' })
            .where('id', '=', draft.id)
            .execute();
          pendingDrafts.push({ id: draft.id, title: (payloadTable?.title as string | null) ?? null });
        }
      }
    } catch (linkErr) {
      console.error('[approve] Erro ao linkar drafts:', linkErr);
    }

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

// Insere aliases em system_aliases, deduplicando por slug e ignorando conflitos.
async function insertSystemAliases(
  trx: Transaction<Database>,
  systemId: string,
  aliases: Array<string | null | undefined>,
): Promise<void> {
  const seen = new Set<string>();
  for (const raw of aliases) {
    const alias = typeof raw === 'string' ? raw.trim() : '';
    if (!alias) continue;
    const aliasSlug = slugify(alias);
    if (!aliasSlug || seen.has(aliasSlug)) continue;
    seen.add(aliasSlug);
    await trx
      .insertInto('system_aliases')
      .values({ system_id: systemId, alias, alias_slug: aliasSlug, is_official: false })
      .onConflict((oc) => oc.columns(['system_id', 'alias_slug']).doNothing())
      .execute();
  }
}

async function makeUniqueSystemSlug(
  trx: Transaction<Database>,
  segmentSlug: string,
  parentPathSlug: string | null,
): Promise<string> {
  const directCollision = await trx
    .selectFrom('systems')
    .select('id')
    .where('slug', '=', segmentSlug)
    .executeTakeFirst();

  if (!directCollision) return segmentSlug;

  const parentPrefix = slugify(parentPathSlug ?? '');
  const base = parentPrefix ? `${parentPrefix}-${segmentSlug}` : segmentSlug;
  let candidate = base;
  let suffix = 2;

  while (true) {
    const collision = await trx
      .selectFrom('systems')
      .select('id')
      .where('slug', '=', candidate)
      .executeTakeFirst();
    if (!collision) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
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
      error: 'resolution_type inválido. Use create_system, create_child, create_alias, merge_existing ou reject.',
    });
  }

  try {
    const outcome = await db.transaction().execute(async (trx) => {
      const suggestion = await trx
        .selectFrom('system_suggestions')
        .selectAll()
        .where('id', '=', id)
        .where('status', '=', 'pending')
        .executeTakeFirst();

      if (!suggestion) {
        throw new Error('NOT_FOUND_OR_REVIEWED');
      }

      const adminName = await resolveActorName(adminId, { trx, fallback: 'Admin', logTag: 'systemSuggestionsAdmin' });

      // ----- REJEITAR -----
      if (resolutionType === 'reject') {
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
      }

      // ----- MESCLAR (sem criar nada) -----
      if (resolutionType === 'merge_existing') {
        const targetSystemId = readTrimmed(body.target_system_id);
        const notes = readTrimmed(body.notes);
        if (!targetSystemId) {
          throw new Error('TARGET_REQUIRED');
        }

        const target = await trx
          .selectFrom('systems')
          .select(['id', 'name', 'path_slug'])
          .where('id', '=', targetSystemId)
          .executeTakeFirst();
        if (!target) {
          throw new Error('TARGET_NOT_FOUND');
        }

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
      }

      // ----- ALIAS (idempotente) -----
      if (resolutionType === 'create_alias') {
        const targetSystemId = readTrimmed(body.target_system_id);
        const aliasText = readTrimmed(body.alias) ?? suggestion.name;
        const notes = readTrimmed(body.notes);
        if (!targetSystemId) {
          throw new Error('TARGET_REQUIRED');
        }

        const target = await trx
          .selectFrom('systems')
          .select(['id', 'name', 'path_slug'])
          .where('id', '=', targetSystemId)
          .executeTakeFirst();
        if (!target) {
          throw new Error('TARGET_NOT_FOUND');
        }

        const aliasSlug = slugify(aliasText);

        const existingAlias = await trx
          .selectFrom('system_aliases')
          .select(['id'])
          .where('system_id', '=', target.id)
          .where('alias_slug', '=', aliasSlug)
          .executeTakeFirst();

        let aliasId: string;
        let idempotent = false;
        if (existingAlias) {
          aliasId = existingAlias.id;
          idempotent = true;
        } else {
          const inserted = await trx
            .insertInto('system_aliases')
            .values({
              system_id: target.id,
              alias: aliasText,
              alias_slug: aliasSlug,
              is_official: false,
            })
            .returning(['id'])
            .executeTakeFirstOrThrow();
          aliasId = inserted.id;
        }

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
      }

      // ----- CRIAR FILHO (edition/variant/subsystem) -----
      if (resolutionType === 'create_child') {
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

        const parent = await trx
          .selectFrom('systems')
          .select(['id', 'name', 'depth', 'path_slug', 'node_type'])
          .where('id', '=', parentId)
          .executeTakeFirst();
        if (!parent) {
          throw new Error('PARENT_NOT_FOUND');
        }

        const allowedParents = VALID_PARENT[nodeType];
        if (allowedParents && !allowedParents.includes(parent.node_type)) {
          throw new Error('HIERARCHY_INVALID');
        }

        const segmentSlug = slugify(name);
        if (!segmentSlug) {
          throw new Error('NAME_REQUIRED');
        }
        const parentPathSlug = parent.path_slug ?? slugify(parent.name);
        const slug = await makeUniqueSystemSlug(trx, segmentSlug, parentPathSlug);
        const pathSlug = `${parentPathSlug}/${segmentSlug}`;
        const depth = (parent.depth ?? 0) + 1;

        const collision = await trx
          .selectFrom('systems')
          .select('id')
          .where('path_slug', '=', pathSlug)
          .executeTakeFirst();
        if (collision) {
          throw new Error('PATH_SLUG_CONFLICT');
        }

        const newSystem = await trx
          .insertInto('systems')
          .values({
            name,
            name_pt: namePt,
            slug,
            path_slug: pathSlug,
            node_type: nodeType,
            depth,
            parent_id: parent.id,
            description,
          })
          .returning(['id', 'name', 'path_slug'])
          .executeTakeFirstOrThrow();

        await insertSystemAliases(trx, newSystem.id, [...(suggestion.aliases ?? []), ...extraAliases]);
        await insertSystemAliases(trx, parent.id, parentAliases);

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
      }

      // ----- CRIAR SISTEMA RAIZ (opcionalmente com edição específica) -----
      // resolutionType === 'create_system'
      const name = readTrimmed(body.name) ?? suggestion.name;
      const namePt = readTrimmed(body.name_pt) ?? suggestion.name_pt;
      const description = readTrimmed(body.description) ?? suggestion.description;
      const editionName = readTrimmed(body.edition_name);
      const force = body.force === true;

      // NFR-001: nao criar raiz por clique unico se houver candidato similar (sem force).
      if (!force) {
        const systemsForGuard = await trx
          .selectFrom('systems')
          .select(['id', 'name', 'name_pt', 'slug', 'path_slug', 'node_type', 'parent_id'])
          .execute();
        const aliasesForGuard = await trx
          .selectFrom('system_aliases')
          .select(['system_id', 'alias'])
          .execute();
        const guard = scoreSystemCandidates(name, systemsForGuard, aliasesForGuard);
        if (guard.recommended_action !== 'create_system' && guard.candidates.length > 0) {
          const err: any = new Error('SIMILAR_EXISTS');
          err.candidates = guard.candidates;
          err.recommended_action = guard.recommended_action;
          err.analysis = guard.analysis;
          throw err;
        }
      }

      const slug = slugify(name);
      if (!slug) {
        throw new Error('NAME_REQUIRED');
      }
      const pathSlug = slug;

      const collision = await trx
        .selectFrom('systems')
        .select('id')
        .where('path_slug', '=', pathSlug)
        .executeTakeFirst();
      if (collision) {
        throw new Error('PATH_SLUG_CONFLICT');
      }

      const newSystem = await trx
        .insertInto('systems')
        .values({
          name,
          name_pt: namePt,
          slug,
          path_slug: pathSlug,
          node_type: 'system',
          depth: 0,
          parent_id: null,
          description,
        })
        .returning(['id', 'name', 'path_slug'])
        .executeTakeFirstOrThrow();

      await insertSystemAliases(trx, newSystem.id, [...(suggestion.aliases ?? []), ...extraAliases]);

      // Edição específica opcional: cria um nó edition sob a nova raiz no mesmo ato.
      let createdNode: { id: string; name: string; path_slug: string | null } = newSystem;
      let createdEditionId: string | null = null;
      if (editionName) {
        const editionSlug = slugify(editionName);
        if (!editionSlug) {
          throw new Error('NAME_REQUIRED');
        }
        const uniqueEditionSlug = await makeUniqueSystemSlug(trx, editionSlug, newSystem.path_slug);
        const editionPath = `${newSystem.path_slug}/${editionSlug}`;
        const editionCollision = await trx
          .selectFrom('systems')
          .select('id')
          .where('path_slug', '=', editionPath)
          .executeTakeFirst();
        if (editionCollision) {
          throw new Error('PATH_SLUG_CONFLICT');
        }
        const editionSystem = await trx
          .insertInto('systems')
          .values({
            name: editionName,
            name_pt: null,
            slug: uniqueEditionSlug,
            path_slug: editionPath,
            node_type: 'edition',
            depth: 1,
            parent_id: newSystem.id,
            description,
          })
          .returning(['id', 'name', 'path_slug'])
          .executeTakeFirstOrThrow();
        createdEditionId = editionSystem.id;
        createdNode = editionSystem;
      }

      const resolvedSystemName = editionName ? `${newSystem.name} ${editionName}` : newSystem.name;

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

    // Pós-transação: religar drafts Discord quando a resolução aponta para um sistema.
    let pendingDrafts: Array<{ id: string; title: string | null }> = [];
    if (outcome.kind !== 'reject' && 'systemId' in outcome && outcome.systemId) {
      pendingDrafts = await relinkDiscordDrafts(outcome.systemId, outcome.systemName, [
        outcome.suggestion.name,
        outcome.systemName,
      ]);
    }

    return res.json({
      success: true,
      data: {
        suggestion_id: id,
        resolution_type: resolutionType,
        ...('systemId' in outcome ? { system_id: outcome.systemId, system_name: outcome.systemName } : {}),
        pending_drafts: pendingDrafts,
      },
    });
  } catch (error: any) {
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
});

export default router;
