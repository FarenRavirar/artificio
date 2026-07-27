import { Router, type Request, type Response } from 'express';
import { sql, type Transaction } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import type { Database, DownloadMaterialTypeSuggestion, DownloadMaterialTypeSuggestionResolutionAction } from '../db/types';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { logModerationAudit } from '../services/moderationAuditLog';
import { loadCatalogMaterialTypes, createCatalogMaterialType, addCatalogMaterialTypeAlias, type CatalogMaterialType } from '../services/catalogClient';

// Spec 088 (achado de review PR #218, Codex P2) — triagem admin da fila de
// sugestão de TIPO, espelhando routes/systemSuggestionsAdmin.ts. Antes desta
// rota, `raw_material_type_hint` (migration_030) era gravado e nunca lido por
// ninguém: o tipo que a fonte publicou mas o catálogo não conhecia ficava
// invisível, sem caminho de resolução, enquanto o equivalente de sistema já
// tinha fila + triagem desde a spec 086.
//
// Diferença deliberada em relação à sugestão de sistema: a taxonomia de tipo é
// uma lista PLANA (catalog_material_types), não uma árvore. Por isso não há
// candidatos pontuados por hierarquia (scoreSystemCandidates), nem create_child,
// nem distinção system_id/edition_id — as resoluções possíveis são apontar para
// um tipo existente (merge_existing) ou criar um tipo novo (create_type).

const router = Router();

router.get('/', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { status } = req.query;
  let query = db.selectFrom('download_material_type_suggestion').selectAll().orderBy('created_at', 'desc');
  if (status && typeof status === 'string') {
    query = query.where('status', '=', status as 'pending' | 'approved' | 'rejected');
  }
  const suggestions = await query.execute();
  return res.json({ items: suggestions });
});

// Candidatos por casamento textual simples sobre a lista plana: nome, slug e
// aliases. Sem scoring hierárquico porque não há hierarquia — o vocabulário de
// tipo tem uma ordem de grandeza a menos de entradas que o de sistemas, e a
// decisão do revisor é sobre um punhado de opções visíveis de uma vez.
function scoreMaterialTypeCandidates(rawValue: string, materialTypes: CatalogMaterialType[]): CatalogMaterialType[] {
  const needle = rawValue.trim().toLocaleLowerCase('pt-BR');
  if (!needle) return [];

  return materialTypes
    .filter((type) => type.status === 'active')
    .filter((type) => {
      const haystack = [type.name, type.slug, ...type.aliases];
      return haystack.some((value) => {
        const candidate = value.toLocaleLowerCase('pt-BR');
        return candidate.includes(needle) || needle.includes(candidate);
      });
    });
}

router.get('/:id/candidates', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const suggestion = await db
    .selectFrom('download_material_type_suggestion')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!suggestion) {
    return res.status(404).json({ error: 'Sugestão não encontrada.' });
  }

  const materialTypes = await loadCatalogMaterialTypes();
  return res.json({ suggestion, candidates: scoreMaterialTypeCandidates(suggestion.raw_value, materialTypes) });
});

// Mesmo TOCTOU que systemSuggestionsAdmin resolveu (achado CodeRabbit PR #145,
// apps/mesas): sem o advisory lock, duas requisições concorrentes na mesma
// sugestão passam ambas pela checagem de status='pending' e criam tipos
// duplicados no catálogo central.
async function withSuggestionLock<T>(
  id: string,
  fn: (trx: Transaction<Database>, suggestion: DownloadMaterialTypeSuggestion) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${id}))`.execute(trx);
    const suggestion = await trx
      .selectFrom('download_material_type_suggestion')
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

function readTrimmed(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

// Espelha relinkPendingSuggestions de systemSuggestionsAdmin, com o mesmo fix
// de TOCTOU (achado Codex PR #204): um único UPDATE ... RETURNING, nunca um
// select desacoplado do update. Só as linhas que ESTE update de fato mudou
// entram no relink do material. Necessário aqui pela mesma razão: produtos
// diferentes da mesma fonte geram o mesmo hint bruto, e resolver um deve
// resolver todos no mesmo commit.
async function relinkPendingSuggestions(
  trx: Transaction<Database>,
  materialType: CatalogMaterialType,
  rawValue: string,
  excludeSuggestionId: string,
  adminId: string,
): Promise<void> {
  const relinked = await trx
    .updateTable('download_material_type_suggestion')
    .set({ status: 'approved', resolution_action: 'merge_existing', resolved_material_type_id: materialType.id, reviewed_by: adminId, reviewed_at: new Date() })
    .where('status', '=', 'pending')
    .where('raw_value', '=', rawValue)
    .where('id', '!=', excludeSuggestionId)
    .returning(['id', 'material_id'])
    .execute();

  for (const row of relinked) {
    await trx
      .updateTable('download_material')
      .set({ material_type: materialType.name, material_type_id: materialType.id, raw_material_type_hint: null, updated_at: new Date() })
      .where('id', '=', row.material_id)
      .execute();
  }
}

// Limpa raw_material_type_hint ao aplicar, pelo mesmo motivo que a resolução de
// sistema limpa raw_system_hint: o campo bruto existe para registrar "a fonte
// disse isso e o catálogo não conhecia". Resolvido, deixar o texto lá faria o
// material aparecer para sempre como pendente de triagem.
async function applyResolution(
  trx: Transaction<Database>,
  suggestion: DownloadMaterialTypeSuggestion,
  materialType: CatalogMaterialType,
  resolutionAction: DownloadMaterialTypeSuggestionResolutionAction,
  adminId: string,
): Promise<void> {
  await trx
    .updateTable('download_material_type_suggestion')
    .set({ status: 'approved', resolution_action: resolutionAction, resolved_material_type_id: materialType.id, reviewed_by: adminId, reviewed_at: new Date() })
    .where('id', '=', suggestion.id)
    .where('status', '=', 'pending')
    .execute();
  await trx
    .updateTable('download_material')
    .set({ material_type: materialType.name, material_type_id: materialType.id, raw_material_type_hint: null, updated_at: new Date() })
    .where('id', '=', suggestion.material_id)
    .execute();
  await relinkPendingSuggestions(trx, materialType, suggestion.raw_value, suggestion.id, adminId);
}

interface ResolveContext {
  trx: Transaction<Database>;
  suggestion: DownloadMaterialTypeSuggestion;
  adminId: string;
  body: Record<string, unknown>;
}

interface ResolveOutcome {
  resolution_action: DownloadMaterialTypeSuggestionResolutionAction | 'reject';
  resolved_material_type_id: string | null;
}

// Aprovar merge ENSINA o vocabulário (registra o raw_value como alias do tipo
// escolhido) — sem isso a mesma sugestão volta para a fila em todo
// reprocessamento, exatamente como acontecia com sistema antes da spec 086.
async function resolveMergeExisting(ctx: ResolveContext): Promise<ResolveOutcome> {
  const targetId = readTrimmed(ctx.body.target_material_type_id);
  if (!targetId) throw new Error('TARGET_REQUIRED');

  const materialTypes = await loadCatalogMaterialTypes(true);
  const target = materialTypes.find((type) => type.id === targetId);
  if (!target) throw new Error('TARGET_NOT_FOUND');

  await addCatalogMaterialTypeAlias(target.id, ctx.suggestion.raw_value);
  await applyResolution(ctx.trx, ctx.suggestion, target, 'merge_existing', ctx.adminId);
  return { resolution_action: 'merge_existing', resolved_material_type_id: target.id };
}

async function resolveCreateType(ctx: ResolveContext): Promise<ResolveOutcome> {
  const name = readTrimmed(ctx.body.name) ?? ctx.suggestion.raw_value;

  const created = await createCatalogMaterialType(name, [ctx.suggestion.raw_value]);
  await applyResolution(ctx.trx, ctx.suggestion, created, 'create_type', ctx.adminId);
  return { resolution_action: 'create_type', resolved_material_type_id: created.id };
}

async function resolveReject(ctx: ResolveContext): Promise<ResolveOutcome> {
  const reason = readTrimmed(ctx.body.reason);
  await ctx.trx
    .updateTable('download_material_type_suggestion')
    .set({ status: 'rejected', rejection_reason: reason, reviewed_by: ctx.adminId, reviewed_at: new Date() })
    .where('id', '=', ctx.suggestion.id)
    .where('status', '=', 'pending')
    .execute();
  return { resolution_action: 'reject', resolved_material_type_id: null };
}

const RESOLVERS: Record<string, (ctx: ResolveContext) => Promise<ResolveOutcome>> = {
  merge_existing: resolveMergeExisting,
  create_type: resolveCreateType,
  reject: resolveReject,
};

const resolveBodySchema = z.looseObject({
  resolution_type: z.enum(['merge_existing', 'create_type', 'reject']),
  target_material_type_id: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200).optional(),
  reason: z.string().trim().max(2000).optional(),
});

function resolveErrorResponse(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : '';
  switch (message) {
    case 'NOT_FOUND_OR_REVIEWED':
      return res.status(404).json({ error: 'Sugestão não encontrada ou já foi revisada.' });
    case 'TARGET_REQUIRED':
      return res.status(400).json({ error: 'É necessário escolher o tipo alvo (target_material_type_id).' });
    case 'TARGET_NOT_FOUND':
      return res.status(404).json({ error: 'Tipo de material alvo não encontrado.' });
    default:
      console.error('[POST /admin/material-type-suggestions/:id/resolve]', error);
      return res.status(500).json({ error: 'Erro ao resolver sugestão.' });
  }
}

// Contrato de /resolve único (não approve/reject separados), pelo mesmo motivo
// registrado na triagem de sistema: decisão do mantenedor na spec 086, "em um
// local só dá pra criar tudo".
router.post('/:id/resolve', writeRateLimiter, authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const parsed = resolveBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  try {
    const outcome = await withSuggestionLock(req.params.id, (trx, suggestion) =>
      RESOLVERS[parsed.data.resolution_type]({ trx, suggestion, adminId: req.user!.userId, body: req.body ?? {} }));

    const suggestionAfter = await db
      .selectFrom('download_material_type_suggestion')
      .select(['material_id'])
      .where('id', '=', req.params.id)
      .executeTakeFirstOrThrow();

    logModerationAudit({ action: 'material_type_suggestion_decide', actorUserId: req.user!.userId, materialId: suggestionAfter.material_id, suggestionId: req.params.id, reason: outcome.resolution_action });

    return res.json({ success: true, resolution_type: outcome.resolution_action, resolved_material_type_id: outcome.resolved_material_type_id });
  } catch (error) {
    return resolveErrorResponse(res, error);
  }
});

export default router;
