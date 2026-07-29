import { Router, type Request, type Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { sanitizeNullableUserMarkdown } from '@artificio/content-editor/sanitize';
import { scoreSystemCandidates, type CandidateSystemInput, type CandidateAliasInput } from '@artificio/catalog-matching';
import { db } from '../db';
import type { Database, DownloadSystemSuggestion, DownloadSystemSuggestionResolutionAction } from '../db/types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { emitNotification } from '../services/notify';
import { logModerationAudit } from '../services/moderationAuditLog';
import { archiveCatalogNode } from '@artificio/catalog-client';
import { loadCatalogSystemsFlat, createCatalogNode, addCatalogNodeAlias, resolveTaxonomyIds, type FlatCatalogSystem } from '../services/catalogClient';

const router = Router();

// T4.8/T4.9 (spec 086, Fase 4) — triagem admin da fila de sugestão de
// sistema, espelhando routes/systemSuggestionsAdmin.ts do mesas (decisão do
// mantenedor 2026-07-25: "não pode ter complicações [...] em um local só dá
// pra criar tudo [...] isso tem que ser comum" — contrato único de
// resolução, não 2 rotas separadas). Downloads usa tabela e notificação
// próprias (download_system_suggestion / download_notification), nunca as
// do mesas; sem drafts Discord/notifications/activity_log (conceitos que não
// existem neste domínio).

router.get('/', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { status } = req.query;
  let query = db.selectFrom('download_system_suggestion').selectAll().orderBy('created_at', 'desc');
  if (status && typeof status === 'string') {
    query = query.where('status', '=', status as 'pending' | 'approved' | 'rejected');
  }
  const suggestions = await query.execute();
  return res.json({ items: suggestions.map((suggestion) => ({
    ...suggestion,
    rejection_reason: sanitizeNullableUserMarkdown(suggestion.rejection_reason ?? null),
  })) });
});

function toCandidateInputs(nodes: FlatCatalogSystem[]): { systems: CandidateSystemInput[]; aliases: CandidateAliasInput[] } {
  const systems: CandidateSystemInput[] = [];
  const aliases: CandidateAliasInput[] = [];
  for (const node of nodes) {
    systems.push({ id: node.id, name: node.name, name_pt: node.name_pt, slug: node.slug, path_slug: node.path_slug, node_type: node.node_type, parent_id: node.parent_id });
    for (const alias of node.aliases) aliases.push({ system_id: node.id, alias });
  }
  return { systems, aliases };
}

// T4.8 — candidatos PONTUADOS (scoreSystemCandidates), não lista crua.
router.get('/:id/candidates', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const suggestion = await db
    .selectFrom('download_system_suggestion')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!suggestion) {
    return res.status(404).json({ error: 'Sugestão não encontrada.' });
  }

  const catalogNodes = await loadCatalogSystemsFlat();
  const { systems, aliases } = toCandidateInputs(catalogNodes);
  const result = scoreSystemCandidates(suggestion.raw_value, systems, aliases);

  return res.json({ suggestion: {
    ...suggestion,
    rejection_reason: sanitizeNullableUserMarkdown(suggestion.rejection_reason ?? null),
  }, ...result });
});

// Achado CodeRabbit (PR #145, apps/mesas): approve/resolve tinham TOCTOU
// entre checar status='pending' e criar o node no catálogo central — duas
// requisições concorrentes na mesma sugestão podiam ambas passar a checagem
// e criar nodes duplicados. Mesmo fix aqui: pg_advisory_xact_lock(hashtext(id))
// dentro da transação Kysely, libera só no COMMIT/ROLLBACK.
async function withSuggestionLock<T>(
  id: string,
  fn: (trx: Transaction<Database>, suggestion: DownloadSystemSuggestion) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${id}))`.execute(trx);
    const suggestion = await trx
      .selectFrom('download_system_suggestion')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'pending')
      .executeTakeFirst();
    if (!suggestion) {
      throw new Error('NOT_FOUND_OR_REVIEWED');
    }
    return fn(trx, suggestion);
  });
}

interface ResolveContext {
  trx: Transaction<Database>;
  suggestion: DownloadSystemSuggestion;
  adminId: string;
  body: Record<string, unknown>;
}

interface ResolveOutcome {
  resolution_action: DownloadSystemSuggestionResolutionAction | 'reject';
  resolved_node_id: string | null;
}

function readTrimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// T4.6 — re-tentativa: casa OUTRAS sugestões pending com o mesmo raw_value
// no mesmo commit (produtos duplicados da mesma fonte geram o mesmo hint).
// Equivalente a normalizeDiscordTableDraft.ts:74-81 do mesas, aplicado no
// momento em que o catálogo efetivamente aprendeu o alias/node novo — não
// existe fluxo de "reprocessar material" isolado no Downloads (decisão do
// mantenedor, spec 086).
// Achado real (review PR #204, Codex, P2): select-then-update separado tinha
// TOCTOU — se 2 sugestões com o mesmo raw_value resolvem simultaneamente
// para nodes DIFERENTES, cada advisory lock (withSuggestionLock) só protege
// seu próprio id; o select de "outras pending" podia incluir uma linha que a
// transação concorrente já resolveu, e o update do material rodava mesmo
// perdendo a corrida no update da suggestion. Fix: um único
// UPDATE ... WHERE status='pending' RETURNING id/material_id — só as linhas
// que ESTE update de fato mudou (venceu a corrida) entram no relink do
// material, nunca um select desacoplado do update real.
async function relinkPendingSuggestions(
  trx: Transaction<Database>,
  resolvedNodeId: string,
  systemId: string,
  editionId: string | null,
  rawValue: string,
  excludeSuggestionId: string,
  adminId: string,
): Promise<void> {
  const relinked = await trx
    .updateTable('download_system_suggestion')
    .set({ status: 'approved', resolution_action: 'create_alias', resolved_node_id: resolvedNodeId, reviewed_by: adminId, reviewed_at: new Date() })
    .where('status', '=', 'pending')
    .where('raw_value', '=', rawValue)
    .where('id', '!=', excludeSuggestionId)
    .returning(['id', 'material_id'])
    .execute();

  for (const row of relinked) {
    await trx
      .updateTable('download_material')
      .set({ system_id: systemId, edition_id: editionId, raw_system_hint: null, updated_at: new Date() })
      .where('id', '=', row.material_id)
      .execute();
  }
}

// Achado real (review PR #204, Codex, P1): resolvedNodeId pode ser um node
// edition/variant (ex. resolveCreateChild, ou create_system com edition_name)
// — gravar direto em system_id quebra os dois filtros de routes/materials.ts.
// resolveTaxonomyIds (compartilhado com scraperIngest.ts) sobe até a raiz
// pra distribuir system_id (raiz) / edition_id (folha) corretamente.
async function applyResolution(trx: Transaction<Database>, suggestion: DownloadSystemSuggestion, resolvedNodeId: string, resolutionAction: DownloadSystemSuggestionResolutionAction, adminId: string): Promise<void> {
  const catalogNodes = await loadCatalogSystemsFlat(true);
  const { systemId, editionId } = resolveTaxonomyIds(resolvedNodeId, catalogNodes);

  await trx
    .updateTable('download_system_suggestion')
    .set({ status: 'approved', resolution_action: resolutionAction, resolved_node_id: resolvedNodeId, reviewed_by: adminId, reviewed_at: new Date() })
    .where('id', '=', suggestion.id)
    .where('status', '=', 'pending')
    .execute();
  await trx
    .updateTable('download_material')
    .set({ system_id: systemId, edition_id: editionId, raw_system_hint: null, updated_at: new Date() })
    .where('id', '=', suggestion.material_id)
    .execute();
  await relinkPendingSuggestions(trx, resolvedNodeId, systemId, editionId, suggestion.raw_value, suggestion.id, adminId);
}

// T4.9 — merge com node existente: registra raw_value como alias, no
// espírito de recordSystemEntityRule do mesas (sem isso a mesma sugestão
// volta pra fila indefinidamente).
async function resolveMergeExisting(ctx: ResolveContext): Promise<ResolveOutcome> {
  const targetNodeId = readTrimmed(ctx.body.target_node_id);
  if (!targetNodeId) throw new Error('TARGET_REQUIRED');

  await addCatalogNodeAlias(targetNodeId, ctx.suggestion.raw_value);
  await applyResolution(ctx.trx, ctx.suggestion, targetNodeId, 'merge_existing', ctx.adminId);
  return { resolution_action: 'merge_existing', resolved_node_id: targetNodeId };
}

async function resolveCreateAlias(ctx: ResolveContext): Promise<ResolveOutcome> {
  const targetNodeId = readTrimmed(ctx.body.target_node_id);
  if (!targetNodeId) throw new Error('TARGET_REQUIRED');

  await addCatalogNodeAlias(targetNodeId, ctx.suggestion.raw_value);
  await applyResolution(ctx.trx, ctx.suggestion, targetNodeId, 'create_alias', ctx.adminId);
  return { resolution_action: 'create_alias', resolved_node_id: targetNodeId };
}

// T4.9 — cria node novo (edition/variant) sob um parent existente, já
// registrando o raw_value como alias no ato da criação.
async function resolveCreateChild(ctx: ResolveContext): Promise<ResolveOutcome> {
  const parentId = readTrimmed(ctx.body.parent_id);
  const nodeType = readTrimmed(ctx.body.node_type);
  const name = readTrimmed(ctx.body.name) ?? ctx.suggestion.raw_value;
  if (!parentId) throw new Error('PARENT_REQUIRED');
  if (!nodeType || !['edition', 'variant'].includes(nodeType)) throw new Error('NODE_TYPE_INVALID');

  const parentExists = (await loadCatalogSystemsFlat()).some((node) => node.id === parentId);
  if (!parentExists) throw new Error('PARENT_NOT_FOUND');

  const created = await createCatalogNode({ name, node_type: nodeType as 'edition' | 'variant', parent_id: parentId, aliases: [ctx.suggestion.raw_value] });
  await applyResolution(ctx.trx, ctx.suggestion, created.id, 'create_child', ctx.adminId);
  return { resolution_action: 'create_child', resolved_node_id: created.id };
}

// T4.9/requisito 7 — cria sistema novo (raiz), com edição opcional na mesma
// chamada (equivalente ao create_chain do mesas: sistema+edição juntos, sem
// exigir 2 aprovações separadas — "em um local só dá pra criar tudo").
async function resolveCreateSystem(ctx: ResolveContext): Promise<ResolveOutcome> {
  const name = readTrimmed(ctx.body.name) ?? ctx.suggestion.raw_value;
  const editionName = readTrimmed(ctx.body.edition_name);

  const system = await createCatalogNode({ name, node_type: 'system', aliases: [ctx.suggestion.raw_value] });

  let resolvedNodeId = system.id;
  if (editionName) {
    // Achado real (review PR #204, Codex, P1): se o 2º POST (edição) falhar
    // depois do 1º (sistema) já ter persistido no catálogo central, a
    // sugestão volta a 'pending' (transação local reverte) mas o sistema
    // órfão continua lá — retry colide de slug e a fila trava. Compensação:
    // arquiva o sistema recém-criado (archiveCatalogNode, soft, mesmo
    // mecanismo de D099) antes de relançar o erro original, deixando o
    // catálogo limpo pra um retry real criar de novo.
    try {
      resolvedNodeId = (await createCatalogNode({ name: editionName, node_type: 'edition', parent_id: system.id })).id;
    } catch (error) {
      await archiveCatalogNode(system.id).catch((archiveError: unknown) => {
        console.error('[resolveCreateSystem] Falha ao compensar (arquivar) sistema órfão após falha na edição:', system.id, archiveError);
      });
      throw error;
    }
  }

  await applyResolution(ctx.trx, ctx.suggestion, resolvedNodeId, 'create_system', ctx.adminId);
  return { resolution_action: 'create_system', resolved_node_id: resolvedNodeId };
}

async function resolveReject(ctx: ResolveContext): Promise<ResolveOutcome> {
  const reason = sanitizeNullableUserMarkdown(readTrimmed(ctx.body.reason));
  await ctx.trx
    .updateTable('download_system_suggestion')
    .set({ status: 'rejected', rejection_reason: reason, reviewed_by: ctx.adminId, reviewed_at: new Date() })
    .where('id', '=', ctx.suggestion.id)
    .where('status', '=', 'pending')
    .execute();
  return { resolution_action: 'reject', resolved_node_id: null };
}

const RESOLVERS: Record<string, (ctx: ResolveContext) => Promise<ResolveOutcome>> = {
  merge_existing: resolveMergeExisting,
  create_alias: resolveCreateAlias,
  create_child: resolveCreateChild,
  create_system: resolveCreateSystem,
  reject: resolveReject,
};

// Achado real (review PR #204, Codex, nitpick): campos condicionais por
// resolution_type (target_node_id/parent_id/node_type/name/edition_name/
// reason) só passavam por readTrimmed dentro de cada resolver, sem limite de
// tamanho/formato — payload absurdo (string gigante) chegava até createCatalogNode.
// Validação de tamanho/formato aqui, na fronteira da rota; readTrimmed nos
// resolvers continua fazendo o trim/presença condicional por tipo de resolução
// (cada resolution_type usa um subconjunto diferente de campos).
const resolveBodySchema = z.looseObject({
  resolution_type: z.enum(['merge_existing', 'create_alias', 'create_child', 'create_system', 'reject']),
  target_node_id: z.string().trim().min(1).max(100).optional(),
  parent_id: z.string().trim().min(1).max(100).optional(),
  node_type: z.enum(['edition', 'variant']).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  edition_name: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().max(2000).optional(),
});

function resolveErrorResponse(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  switch (message) {
    case 'NOT_FOUND_OR_REVIEWED':
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    case 'TARGET_REQUIRED':
      return res.status(400).json({ error: 'É necessário escolher o sistema alvo (target_node_id).' });
    case 'PARENT_REQUIRED':
      return res.status(400).json({ error: 'É necessário escolher o sistema pai (parent_id).' });
    case 'PARENT_NOT_FOUND':
      return res.status(404).json({ error: 'Sistema pai não encontrado.' });
    case 'NODE_TYPE_INVALID':
      return res.status(400).json({ error: 'node_type inválido. Use edition ou variant.' });
    default:
      console.error('[POST /admin/system-suggestions/:id/resolve]', error);
      return res.status(500).json({ error: 'Erro ao resolver sugestão.' });
  }
}

// T4.8/T4.9/T4.6 — resolução única da sugestão: aprovar (com escolha de
// merge/alias/child/system, todas ensinando o catálogo — requisito 6e) ou
// rejeitar, tudo sob o mesmo advisory lock. requisito 8: contrato de
// referência é o /resolve único do mesas, não 2 rotas approve/reject
// separadas (decisão do mantenedor, 2026-07-25).
router.post('/:id/resolve', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = resolveBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  try {
    // Achado real (review PR #218, CodeRabbit, encontrado na rota de TIPO e
    // aplicado aqui pela mesma causa): passar `req.body` cru fazia os resolvers
    // lerem o valor ORIGINAL por `readTrimmed(ctx.body.name)`, ignorando a
    // normalização do schema.
    //
    // Correção da justificativa (2ª passada do CodeRabbit): o defeito NÃO era
    // payload acima do limite chegar a `createCatalogNode` — `safeParse` acima
    // rejeita esse caso com 400 antes de qualquer resolver rodar. O que
    // escapava era o payload VÁLIDO chegar sem transformação: `.trim()` do
    // schema não se aplicava ao valor efetivamente usado, então nome com
    // espaços nas pontas ia para o catálogo central como veio.
    //
    // `resolveBodySchema` é `looseObject`, então `parsed.data` preserva as
    // chaves extras que cada resolver consome; o que muda é que os campos
    // declarados chegam normalizados.
    const outcome = await withSuggestionLock(req.params.id, (trx, suggestion) =>
      RESOLVERS[parsed.data.resolution_type]({ trx, suggestion, adminId: req.user!.userId, body: parsed.data }));

    const suggestionAfter = await db
      .selectFrom('download_system_suggestion')
      .select(['material_id', 'raw_value', 'source', 'suggested_by_user_id'])
      .where('id', '=', req.params.id)
      .executeTakeFirstOrThrow();

    if (suggestionAfter.source === 'user' && suggestionAfter.suggested_by_user_id) {
      const body = outcome.resolution_action === 'reject'
        ? `Sua sugestão de sistema "${suggestionAfter.raw_value}" não foi aceita desta vez.`
        : `Sua sugestão de sistema "${suggestionAfter.raw_value}" foi aceita.`;
      try {
        await emitNotification({ userId: suggestionAfter.suggested_by_user_id, kind: 'system_suggestion_resolved', materialId: suggestionAfter.material_id, body });
      } catch (error) {
        console.error('[POST /admin/system-suggestions/:id/resolve] Falha ao emitir notificação:', error);
      }
    }

    logModerationAudit({ action: 'system_suggestion_decide', actorUserId: req.user!.userId, materialId: suggestionAfter.material_id, suggestionId: req.params.id, reason: outcome.resolution_action });

    return res.json({ success: true, resolution_type: outcome.resolution_action, resolved_node_id: outcome.resolved_node_id });
  } catch (error) {
    return resolveErrorResponse(res, error);
  }
});

export default router;
