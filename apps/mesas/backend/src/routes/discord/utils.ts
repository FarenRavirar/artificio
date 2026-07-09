import { Router, Response, Request } from 'express';
import { z } from 'zod';
import type { Selectable } from 'kysely';
import { db } from '../../db';
import type { DiscordSourceChannelType, DiscordImportMessagesTable, NewDiscordImportRun } from '../../db/types';
import type { SystemEntry, ImportRawMessage, ImportTableDraft } from '../../discord';
import type { MatchEntry } from '../../discord/parseDiscordAnnouncement';
import { normalizeDiscordTableDraft, parseDiscordAnnouncement, normalizeDraftPayload, assertDraftReadyTransition } from '../../discord';
import { uploadCoverForDraft, updateDraftImageUploadState } from '../../discord/syncHelpers';
import { assistDiscordParseWithContextPack } from '../../discord/llmAssist';
import { getAiAutomationConfig, isAiAssistEnabled } from '../../discord/aiAutomationConfig';
import { attachAiSuggestions, buildAiSuggestionFields } from '../../discord/aiSuggestions';
import { LEARNABLE_FIELDS, lookupFieldLearning, recordFieldLearning } from '../../discord/fieldLearning';
import {
  lookupLearningRules,
  recordLearningRuleApplications,
  recordLearningRulesFromCorrections,
} from '../../discord/learningRules';
import {
  buildParseCaseContract,
  extractDraftScope,
  parseActionFromNormalizedStatus,
  recordParseCase,
  recordParseFeedback,
  recordParseFeedbackForCorrections,
} from '../../discord/parseLearning';
import { loadRetrievalContextForCurrent } from '../../discord/parseRetrieval';
import { DiscordDiscoveryError, DiscordIngestError } from '../../discord';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { DiscordSettingsSecretUnavailableError } from '../../discord/settingsCrypto';
import { loadSystemsForParser, loadVttPlatformsForParser, loadCommunicationPlatformsForParser, loadScenariosForParser } from '../../discord/shared';
import { requireAdmin } from '../../middleware/auth';
import { notifyAdmins } from '../../services/adminNotifications';
import { patchDraftSchema, correctionSchema } from '../inbox/utils';

/** Catálogos de VTT/comunicação pré-carregados, reaproveitados por várias mensagens
 * do mesmo batch (evita N+1 de query por mensagem). Compartilhado por
 * parseDiscordMessage, processDiscordMessageToDraft e reparseOneMessage. */
export type ParserPlatformCatalogs = { vttPlatforms?: MatchEntry[]; communicationPlatforms?: MatchEntry[]; scenarios?: MatchEntry[] };

function extractArrayFromRecord(record: Record<string, unknown>): unknown[] | null {
  if (Array.isArray(record.items)) return record.items;
  if (Array.isArray(record.data)) return record.data;
  return null;
}

// Embeds/attachments podem vir como array (novo) ou JSON string (dados antigos)
export function parseJsonField(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object') {
    const extracted = extractArrayFromRecord(value as Record<string, unknown>);
    return extracted ?? Object.values(value as Record<string, unknown>);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
      if (typeof parsed === 'object' && parsed) {
        const extracted = extractArrayFromRecord(parsed as Record<string, unknown>);
        if (extracted) return extracted;
      }
      return [];
    } catch {
      return [];
    }
  }
  return [];
}

// ─── T-G3 — registerDraftCorrection (compartilhado: inbox + discord) ─────

interface CorrectionInput {
  draftId: string;
  corrections: Record<string, unknown>;
  reason?: string;
  before?: Record<string, unknown>;
  userId?: string;
}

interface CorrectionResult {
  draft_id: string;
  fields_corrected: number;
  diff: Record<string, { before: unknown; after: unknown }>;
}

// Achado do mantenedor (2026-07-08): 3 drafts em prod com table.description/
// requires_pc/type/etc gravados como { before, after } em vez de valor
// escalar — sync trava com "campo faltando" mesmo com valor visível na tela.
// Rastreio não achou o writer ativo (todo caminho hoje já unwrap corretamente),
// mas registerDraftCorrection grava `corrections[key]` direto em `table[key]`
// SEM validar shape — client malformado (bundle velho em cache, script manual,
// regressão futura) escreve qualquer objeto sem barreira. Isso fecha a porta
// na entrada: se algum valor já vier no formato de diff, rejeita com 400 em
// vez de persistir silenciosamente.
// Par espelhado no frontend: unwrapDiffShapedSuggestion em
// apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts — mesma
// checagem de shape, propósitos diferentes (aqui rejeita, lá desembrulha).
// Manter os dois sincronizados se o shape do resíduo mudar.
function isDiffShapedObject(value: unknown): value is { before: unknown; after: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    'after' in value &&
    'before' in value &&
    Object.keys(value).length <= 2
  );
}

// CodeRabbit (PR #133): a checagem original só olhava o nível raiz de
// corrections[key] — um campo como _ai_suggestions (objeto com sub-estrutura)
// podia carregar um filho poluído (ex.: table._ai_suggestions.fields.slots_total
// visto no draft b93a455d) sem o objeto inteiro bater no shape {before,after}.
// Desce 1 nível dentro de objetos/arrays não-diff-shaped pra pegar esse caso
// sem varrer profundidade arbitrária (custo/risco de over-engineering).
function findDiffShapedPath(value: unknown, depth = 0): boolean {
  if (isDiffShapedObject(value)) return true;
  if (depth >= 1) return false;
  if (Array.isArray(value)) return value.some((item) => findDiffShapedPath(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some((item) => findDiffShapedPath(item, depth + 1));
  }
  return false;
}

export async function registerDraftCorrection(input: CorrectionInput): Promise<CorrectionResult> {
  const { draftId, corrections, reason, before } = input;

  const poisoned = Object.entries(corrections).filter(([, value]) => findDiffShapedPath(value));
  if (poisoned.length > 0) {
    throw Object.assign(
      new Error(`Correção rejeitada: valor no formato {before,after} para campo(s) ${poisoned.map(([k]) => k).join(', ')} — envie o valor final, não um diff.`),
      { statusCode: 400 },
    );
  }

  const draft = await db
    .selectFrom('discord_import_table_drafts')
    .select(['id', 'status', 'parsed_payload', 'normalized_payload', 'discord_message_id', 'import_message_id'])
    .where('id', '=', draftId)
    .executeTakeFirst();

  if (!draft) throw Object.assign(new Error('Draft não encontrado.'), { statusCode: 404 });
  if (draft.status === 'synced') throw Object.assign(new Error('Draft já sincronizado não pode ser corrigido.'), { statusCode: 422 });
  if (draft.status === 'rejected') throw Object.assign(new Error('Draft rejeitado não pode ser corrigido.'), { statusCode: 422 });

  // Busca raw_text: inbox → import_messages, discord → discord_import_messages
  let rawText: string | null = null;
  if (draft.import_message_id) {
    const inboxMsg = await db
      .selectFrom('import_messages')
      .select(['raw_text', 'content_raw'])
      .where('id', '=', draft.import_message_id)
      .executeTakeFirst();
    rawText = inboxMsg?.raw_text ?? inboxMsg?.content_raw ?? null;
  } else if (draft.discord_message_id) {
    const discordMsg = await db
      .selectFrom('discord_import_messages')
      .select(['content_raw'])
      .where('id', '=', draft.discord_message_id)
      .executeTakeFirst();
    rawText = discordMsg?.content_raw ?? null;
  }

  const parsedBefore = normalizeDraftPayload(draft.normalized_payload ?? draft.parsed_payload);
  // CodeRabbit: table vem de JSONB (unknown); fallback tipado antes do spread.
  const parsedTable = parsedBefore.table;
  const tableBefore =
    parsedTable && typeof parsedTable === 'object' && !Array.isArray(parsedTable)
      ? (parsedTable as Record<string, unknown>)
      : {};
  const humanCorrected = { ...parsedBefore, table: { ...tableBefore, ...corrections } };

  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of Object.keys(corrections)) {
    const beforeVal = before?.[key] ?? tableBefore[key];
    const after = corrections[key];
    if (JSON.stringify(beforeVal) !== JSON.stringify(after)) {
      diff[key] = { before: beforeVal, after };
    }
  }

  const userId = input.userId ?? null;

  await db.transaction().execute(async (trx) => {
    await trx
      .insertInto('import_corrections')
      .values({
        draft_id: draftId,
        import_message_id: draft.import_message_id ?? null,
        raw_text: rawText,
        parsed_before: parsedBefore,
        human_corrected: humanCorrected,
        diff,
        reason: reason ?? null,
        corrected_by: userId,
      })
      .execute();

    // CodeRabbit (TOCTOU): status foi checado fora da tx; condiciona o UPDATE a
    // estado não-terminal e verifica linhas afetadas. 0 linhas → draft virou
    // synced/rejected na janela → aborta a tx (rollback do insert acima).
    const updateResult = await trx
      .updateTable('discord_import_table_drafts')
      .set({
        normalized_payload: humanCorrected,
        updated_at: new Date(),
      })
      .where('id', '=', draftId)
      .where('status', 'not in', ['synced', 'rejected'])
      .executeTakeFirst();

    if (updateResult.numUpdatedRows === 0n) {
      throw Object.assign(new Error('Draft mudou de estado durante a correção.'), { statusCode: 409 });
    }
  });

  // D087 — alimenta o learning-store DEPOIS do commit, NUNCA dentro da tx da
  // correção: um erro SQL aqui abortaria a transação do Postgres (COMMIT vira
  // ROLLBACK) e a correção humana seria perdida. Best-effort, conn própria (db).
  const source = parsedBefore.source as Record<string, unknown> | undefined;
  const guildId = typeof source?.guild_id === 'string' ? source.guild_id : null;
  const learningEntries = Object.entries(diff).map(([field, { before, after }]) => ({
    field,
    inputValue: before,
    outputValue: after,
  }));
  await recordFieldLearning(learningEntries, guildId, userId);
  await recordLearningRulesFromCorrections(learningEntries, source ?? null, userId);
  await recordParseFeedbackForCorrections({
    draftId,
    diff,
    reason: reason ?? null,
    adminUserId: userId,
    scope: source ?? {},
  });

  return { draft_id: draftId, fields_corrected: Object.keys(diff).length, diff };
}

// REV-016 onda 3: factory DRY — POST /:id/correction (inbox + discord)
export function createCorrectionHandler(routeLabel: string): Router {
  const router = Router();

  router.post('/:id/correction', requireAdmin, async (req: Request, res: Response) => {
    try {
      const draftId = req.params.id;
      if (!draftId || typeof draftId !== 'string') {
        return res.status(400).json({ error: 'ID do draft obrigatório.' });
      }

      const parsed = correctionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Payload inválido.' });
      }

      const result = await registerDraftCorrection({
        draftId,
        corrections: parsed.data.corrections,
        reason: parsed.data.reason,
        before: parsed.data.before,
        userId: req.user?.userId ?? undefined,
      });

      return res.json({ data: result });
    } catch (error: unknown) {
      const statusCode = (error as Record<string, unknown>)?.statusCode;
      if (typeof statusCode === 'number') {
        return res.status(statusCode).json({ error: (error as Error).message });
      }
      console.error(`[POST ${routeLabel}]`, error);
      return res.status(500).json({ error: 'Erro ao registrar correção.' });
    }
  });

  return router;
}

// ─── T-G6 — registra uma rodada de importação ──────────────────────────

export async function recordImportRun(counts: {
  sourceKind: string;
  totalMessages: number;
  draftsCreated: number;
  draftsUpdated: number;
  messagesIgnored: number;
  messagesFailed: number;
  note?: string;
  userId?: string;
}): Promise<void> {
  try {
    await db.insertInto('discord_import_runs')
      .values({
        source_kind: counts.sourceKind,
        total_messages: counts.totalMessages,
        drafts_created: counts.draftsCreated,
        drafts_updated: counts.draftsUpdated,
        messages_ignored: counts.messagesIgnored,
        messages_failed: counts.messagesFailed,
        ended_at: new Date(),
        note: counts.note ?? null,
        created_by: counts.userId ?? null,
      } as NewDiscordImportRun)
      .execute();
  } catch (err) {
    // best-effort — não bloqueia import
    console.error('[recordImportRun]', err instanceof Error ? err.message : 'unknown error');
  }
}

// ─── T-G7 — registra decisão shadow (o que o sistema teria autoaprovado?) ──

import { classifyConfidence, isHomebrewSystem } from '../../discord/parseDiscordAnnouncement';

function buildShadowReason(
  tier: ReturnType<typeof classifyConfidence> | null,
  wouldAutoApprove: boolean,
  missingFields: string[],
): string {
  if (wouldAutoApprove) return 'Confiança muito alta e todos os campos preenchidos.';
  if (tier === 'muito_alta') return `Confiança muito alta, mas campos pendentes: ${missingFields.join(', ')}.`;
  if (tier === null) return 'Sem score de confiança.';
  return `Confiança ${tier}. Autoaprovação exige "muito_alta".`;
}

export async function recordShadowDecision(draftId: string, confidence: number | null, missingFields: string[]): Promise<void> {
  try {
    const tier = confidence === null ? null : classifyConfidence(confidence);
    const wouldAutoApprove = tier === 'muito_alta' && missingFields.length === 0;
    const reason = buildShadowReason(tier, wouldAutoApprove, missingFields);

    await db.insertInto('discord_shadow_decisions')
      .values({
        draft_id: draftId,
        confidence,
        confidence_tier: tier,
        would_auto_approve: wouldAutoApprove,
        auto_approve_reason: reason,
        missing_fields: missingFields.length > 0 ? missingFields : null,
        actual_outcome: null,
        actual_at: null,
      })
      .execute();
  } catch (err) {
    console.error('[recordShadowDecision]', err instanceof Error ? err.message : 'unknown error');
  }
}

function getUnmatchedSystemHint(draft: ReturnType<typeof normalizeDiscordTableDraft>['draft']): string | null {
  if (draft.table.system_id) return null;
  const hint = draft.table.raw_system_hint ?? draft.table.system_name;
  const normalized = typeof hint === 'string' ? hint.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

export async function ensureSystemSuggestionForDraft(
  draft: ReturnType<typeof normalizeDiscordTableDraft>['draft'],
  adminId: string | undefined,
  sourceLabel: string | null | undefined,
): Promise<void> {
  try {
    const rawHint = getUnmatchedSystemHint(draft);
    if (!rawHint || !adminId) return;

    const existing = await db
      .selectFrom('system_suggestions')
      .select('id')
      .where('name', '=', rawHint)
      .where('status', 'in', ['pending', 'approved'])
      .executeTakeFirst();

    if (existing) return;

    const createdSuggestion = await db
      .insertInto('system_suggestions')
      .values({
        user_id: adminId,
        name: rawHint,
        name_pt: null,
        node_type: 'system',
        parent_id: null,
        description: `Sugestão automática gerada ao parsear mensagem Discord: "${sourceLabel ?? rawHint}"`,
        aliases: [rawHint],
        status: 'pending',
        reviewed_by: null,
        reviewed_at: null,
        rejection_reason: null,
      })
      .returning(['id', 'name'])
      .executeTakeFirst();

    if (createdSuggestion) {
      await notifyAdmins({
        type: 'system_suggestion',
        title: 'Nova sugestão de sistema (Discord)',
        message: `Sugestão automática "${createdSuggestion.name}" detectada no Discord.`,
        action_url: '/gestao',
        metadata: {
          suggestion_id: createdSuggestion.id,
          suggestion_kind: 'system',
          source: 'discord',
        },
      });
    }
  } catch (error) {
    console.error('[ensureSystemSuggestionForDraft]', error);
  }
}

// ─── T-F8 — contentIndex + replyContext (import.ts + parse-batch.ts) ──

/**
 * Constrói índice messageId → snippet (~80 chars) para resolver replies.
 * Extraído para evitar duplicação entre import.ts e parse-batch.ts.
 */
export function buildContentIndex(messages: { discord_message_id: unknown; content_raw: unknown }[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const msg of messages) {
    const raw = msg.content_raw;
    const id = msg.discord_message_id;
    if (typeof id === 'string' && id.length > 0 && typeof raw === 'string' && raw.length > 0) {
      index.set(id, raw.length > 80 ? raw.slice(0, 80) + '...' : raw);
    }
  }
  return index;
}

/**
 * Resolve replyContext a partir de reference.messageId no contentIndex.
 */
export function resolveReplyContext(message: Record<string, unknown>, contentIndex: Map<string, string>): string | undefined {
  const ref = message.reference;
  if (ref && typeof ref === 'object' && ref !== null) {
    const refMsgId = (ref as Record<string, unknown>).messageId;
    if (typeof refMsgId === 'string' && contentIndex.has(refMsgId)) {
      return contentIndex.get(refMsgId);
    }
  }
  return undefined;
}

// ─── REV-036 — parseDiscordMessage compartilhada (messageParse.ts + drafts.ts) ──

/**
 * Normaliza `reference` vindo de JSONB/DB (dado externo) antes de entrar no
 * contrato interno. messageId obrigatório (string não-vazia); channelId/guildId
 * só se forem string. Caso contrário → null.
 */
function normalizeReference(raw: unknown): ImportRawMessage['reference'] {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.messageId !== 'string' || r.messageId.length === 0) return null;
  return {
    messageId: r.messageId,
    channelId: typeof r.channelId === 'string' ? r.channelId : undefined,
    guildId: typeof r.guildId === 'string' ? r.guildId : undefined,
  };
}

/**
 * Parseia uma mensagem Discord importada e normaliza para draft.
 * Substitui 20 linhas duplicadas em messageParse.ts:22-42 e drafts.ts:168-187.
 */
export async function parseDiscordMessage(
  msg: { source_kind: unknown; discord_message_id: unknown; discord_channel_id: unknown; discord_guild_id: unknown; discord_parent_channel_id: unknown; discord_thread_id: unknown; discord_thread_name: unknown; discord_author_id: unknown; discord_author_name: unknown; discord_message_url: unknown; content_raw: unknown; attachments: unknown; embeds: unknown; message_created_at: unknown; message_edited_at: unknown },
  systems?: SystemEntry[],
  replyContext?: string,
  catalogs?: ParserPlatformCatalogs,
): Promise<{ parsed: NonNullable<ReturnType<typeof parseDiscordAnnouncement>>; normalized: ReturnType<typeof normalizeDiscordTableDraft>; systems: SystemEntry[] } | null> {
  const sys = systems ?? await loadSystemsForParser();
  const [vttPlatforms, communicationPlatforms, scenarios] = await Promise.all([
    catalogs?.vttPlatforms ?? loadVttPlatformsForParser(),
    catalogs?.communicationPlatforms ?? loadCommunicationPlatformsForParser(),
    catalogs?.scenarios ?? loadScenariosForParser(),
  ]);
  const raw: ImportRawMessage = {
    source_kind: (msg.source_kind ?? 'text') as ImportRawMessage['source_kind'],
    discord_message_id: String(msg.discord_message_id ?? ''),
    discord_channel_id: String(msg.discord_channel_id ?? ''),
    discord_guild_id: (msg.discord_guild_id as string) ?? '',
    discord_parent_channel_id: msg.discord_parent_channel_id as string | null | undefined,
    discord_thread_id: msg.discord_thread_id as string | null | undefined,
    discord_thread_name: msg.discord_thread_name as string | null | undefined,
    discord_author_id: msg.discord_author_id as string | null,
    discord_author_name: msg.discord_author_name as string | null,
    discord_message_url: msg.discord_message_url as string | null,
    content_raw: String(msg.content_raw ?? ''),
    attachments: parseJsonField(msg.attachments),
    embeds: parseJsonField(msg.embeds),
    reference: normalizeReference((msg as Record<string, unknown>).reference),
    message_created_at: msg.message_created_at ? new Date(msg.message_created_at as string) : null,
    message_edited_at: msg.message_edited_at ? new Date(msg.message_edited_at as string) : null,
  };
  const parsed = parseDiscordAnnouncement(raw, sys, replyContext, { vtt: vttPlatforms, communication: communicationPlatforms, scenarios });
  if (!parsed) return null;
  const normalized = normalizeDiscordTableDraft(parsed, sys);
  return { parsed, normalized, systems: sys };
}

// ─── DEB-048-22 — processa UMA mensagem → draft (parse-batch + /reparse) ──

export type DiscordDraftOutcome = 'parsed' | 'ignored' | 'reconciled' | 'discarded';

const LLM_FIELD_MAP: Record<string, string> = {
  system_name: 'system_hint',
  raw_system_hint: 'system_hint',
  title: 'title',
  day_of_week: 'day_of_week',
  start_time: 'start_time',
  slots_total: 'slots_total',
  slots_open: 'slots_open',
  price_type: 'price_type',
  price_value: 'price_value',
  contact_url: 'contact_url',
  description: 'description',
};

const AMBIGUITY_TARGETS: Record<string, string[]> = {
  _price_ambiguity: ['price_type', 'price_value'],
  _schedule_ambiguity: ['day_of_week', 'start_time'],
  _slots_ambiguity: ['slots_total', 'slots_open'],
  _homebrew_suspect: ['system_hint'],
};

function getLlmTargetFields(
  missingFields: string[],
  table: Record<string, unknown>,
  storeFields: Record<string, unknown>,
): string[] {
  const targets = new Set<string>();
  for (const missing of missingFields) {
    const base = missing.split(':')[0];
    const mapped = LLM_FIELD_MAP[base];
    if (mapped && !(base in storeFields)) targets.add(mapped);
  }
  for (const [flag, fields] of Object.entries(AMBIGUITY_TARGETS)) {
    if (!table[flag]) continue;
    for (const field of fields) targets.add(field);
  }
  return Array.from(targets);
}

/**
 * REV-039: enriquecimento LLM p/ baixa confiança/campos faltantes. Best-effort:
 * falha/timeout/sem-update retorna o `normalized` original. Extraído de
 * processDiscordMessageToDraft p/ reduzir a complexidade cognitiva (Sonar 83→).
 */
async function enrichDraftWithLlm(
  message: Selectable<DiscordImportMessagesTable>,
  parsed: NonNullable<ReturnType<typeof parseDiscordAnnouncement>>,
  normalized: ReturnType<typeof normalizeDiscordTableDraft>,
): Promise<ReturnType<typeof normalizeDiscordTableDraft>> {
  const aiConfig = getAiAutomationConfig();
  if (!normalized.draft.table) return normalized;

  const table = normalized.draft.table as unknown as Record<string, unknown>;

  // D087 — camada learning-store (token-zero) ANTES da IA. Correções humanas
  // passadas resolvem valores errados/repetidos sem chamar o provider.
  const lookupQueries = LEARNABLE_FIELDS
    .filter((f) => table[f] !== null && table[f] !== undefined && table[f] !== '')
    .map((f) => ({ field: f as string, value: table[f] }));
  const guildId = normalized.draft.source?.guild_id ?? null;
  const learningScope = {
    guild_id: normalized.draft.source?.guild_id ?? null,
    channel_id: normalized.draft.source?.channel_id ?? null,
    author_id: normalized.draft.source?.author_id ?? null,
  };
  const ruleLookup = await lookupLearningRules(lookupQueries, learningScope);
  const storeHits = await lookupFieldLearning(lookupQueries, guildId);
  const storeFields: Record<string, unknown> = {};
  for (const hit of ruleLookup.hits) {
    if (JSON.stringify(table[hit.field]) !== JSON.stringify(hit.value)) {
      storeFields[hit.field] = hit.value;
    }
  }
  for (const hit of storeHits) {
    if (JSON.stringify(table[hit.field]) !== JSON.stringify(hit.value)) {
      storeFields[hit.field] = hit.value;
    }
  }

  // Se o store já resolveu todos os campos faltantes, não gasta token de IA.
  // missing_fields pode ter marcador `campo:motivo` (ex.: system_name:unmatched_hint);
  // o store chaveia por campo-base, então normalizar antes de comparar.
  const missingBaseFields = normalized.draft.missing_fields.map((m) => m.split(':')[0]);
  const storeResolvedAllMissing = missingBaseFields.length > 0 && missingBaseFields.every((m) => m in storeFields);

  const rawText = typeof message.content_raw === 'string' ? message.content_raw : '';
  let iaFields: Record<string, unknown> = {};
  let iaModel = 'n/a';
  const targetFields = getLlmTargetFields(normalized.draft.missing_fields, table, storeFields);
  if (isAiAssistEnabled(aiConfig) && !storeResolvedAllMissing && rawText.length > 50 && targetFields.length > 0) {
    const existingFields = Object.fromEntries(
      Object.entries(table).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    );

    const draftForContext = {
      ...normalized.draft,
      table: {
        ...normalized.draft.table,
        ...existingFields,
      },
    };
    const retrievalContext = await loadDraftRetrievalContext(message, parsed, normalized);
    const llmResult = await assistDiscordParseWithContextPack({
      rawText,
      draft: draftForContext,
      model: aiConfig.model,
      retrievalContext,
      ruleHits: ruleLookup.hits,
      ruleConflicts: ruleLookup.conflicts,
      targetFields,
    });
    if (llmResult) {
      iaFields = buildAiSuggestionFields(llmResult.extracted, normalized.draft.table);
      iaModel = llmResult.model;
    }
  }

  // Store tem precedência (correção humana > palpite da IA).
  const merged = { ...iaFields, ...storeFields };
  if (Object.keys(merged).length === 0) return normalized;

  const usedIa = Object.keys(iaFields).length > 0;
  const usedStore = Object.keys(storeFields).length > 0;
  const usedRules = ruleLookup.hits.length > 0;
  const learningProvider = usedRules ? 'learning-rules' : 'learning-store';
  let provider = learningProvider;
  if (usedIa) provider = usedStore ? `${learningProvider}+${aiConfig.provider}` : aiConfig.provider;
  const model = usedIa ? iaModel : 'n/a';
  if (ruleLookup.hits.length > 0) {
    void recordLearningRuleApplications({
      hits: ruleLookup.hits,
      beforeValues: table,
      outcome: ruleLookup.conflicts.length > 0 ? 'conflict' : 'applied',
      reason: ruleLookup.conflicts.length > 0 ? 'conflict_guard' : 'draft_enrichment',
    });
  }

  return {
    ...normalized,
    draft: attachAiSuggestions(normalized.draft, merged, provider, model),
  };
}

async function loadDraftRetrievalContext(
  message: Selectable<DiscordImportMessagesTable>,
  parsed: NonNullable<ReturnType<typeof parseDiscordAnnouncement>>,
  normalized: ReturnType<typeof normalizeDiscordTableDraft>,
) {
  try {
    const currentParseCase = buildParseCaseContract({
      message,
      deterministicResult: parsed,
      finalResult: normalized.draft,
      finalAction: parseActionFromNormalizedStatus(normalized.status),
    });
    return await loadRetrievalContextForCurrent({
      id: 'current',
      draft_id: currentParseCase.draft_id,
      discord_message_id: currentParseCase.discord_message_id,
      import_message_id: currentParseCase.import_message_id,
      final_result_json: currentParseCase.final_result_json,
      features_json: currentParseCase.features_json,
      normalized_text: currentParseCase.normalized_text,
      raw_hash: currentParseCase.raw_hash,
      normalized_hash: currentParseCase.normalized_hash,
      guild_id: currentParseCase.guild_id,
      channel_id: currentParseCase.channel_id,
      author_id: currentParseCase.author_id,
    });
  } catch (error: unknown) {
    console.error('[loadDraftRetrievalContext]', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

/**
 * Insere ou atualiza o draft normalizado e registra a decisão shadow. Extraído de
 * processDiscordMessageToDraft p/ baixar a complexidade cognitiva (Sonar 20→).
 * Dedup do `recordShadowDecision` (antes repetido nos dois ramos).
 */
async function upsertDraftWithShadow(
  existingId: string | undefined,
  messageId: string,
  parsed: unknown,
  normalizedResult: ReturnType<typeof normalizeDiscordTableDraft>,
): Promise<string> {
  const { draft } = normalizedResult;
  let draftId: string;
  if (existingId) {
    draftId = existingId;
    await db.updateTable('discord_import_table_drafts')
      .set({
        parsed_payload: parsed,
        normalized_payload: draft,
        confidence: draft.confidence,
        status: normalizedResult.status,
        updated_at: new Date(),
      })
      .where('id', '=', draftId)
      .execute();
  } else {
    const inserted = await db.insertInto('discord_import_table_drafts')
      .values({
        discord_message_id: messageId,
        parsed_payload: parsed,
        normalized_payload: draft,
        confidence: draft.confidence,
        status: normalizedResult.status,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    draftId = inserted.id;
  }
  recordShadowDecision(draftId, draft.confidence, draft.missing_fields ?? []).catch(() => {});
  return draftId;
}

/**
 * Upload best-effort da capa ao Cloudinary + persistência do estado de upload.
 * Falha de imagem NÃO derruba o parse — o erro fica registrado p/ retry (cron/admin).
 * Extraído de processDiscordMessageToDraft p/ baixar a complexidade cognitiva (REV-039).
 */
async function persistCoverUpload(
  draftId: string,
  draft: ReturnType<typeof normalizeDiscordTableDraft>['draft'],
  messageId: string,
): Promise<void> {
  // WS1: upload no momento do parse (URL Discord fresca).
  const draftResult = await uploadCoverForDraft(draftId, draft, 0).catch((err: unknown) => {
    console.warn('[discord-parse] uploadCoverForDraft failed silently', {
      messageId,
      error: err instanceof Error ? err.message : err,
    });
    return null;
  });

  if (!draftResult?.status) return;

  await updateDraftImageUploadState(
    draftId,
    draftResult.payload,
    draftResult.status,
    draftResult.attempts,
    draftResult.error,
    draftResult.coverPublicId,
  ).catch((err: unknown) => {
    console.warn('[discord-parse] updateDraftImageUploadState failed silently', {
      messageId,
      error: err instanceof Error ? err.message : err,
    });
  });
}

/**
 * Processa uma mensagem do DiscordChatExporter até o draft: parseia, reconcilia
 * draft terminal, faz upsert do draft, atualiza status da mensagem e gera sugestão
 * de sistema. Compartilhado entre parse-batch e /reparse (eram ~45 linhas idênticas
 * — SonarCloud 24.8% dup em import.ts). Lança em erro de DB; o caller decide a
 * política de catch e os contadores conforme o `DiscordDraftOutcome` retornado.
 */
// Achado CodeRabbit (PR #140): descarte de mesa paga e de contato não-explícito
// repetiam a mesma sequência (mensagem->ignored, draft existente->rejected,
// recordParseCase 'discard'). Extraído para não divergir entre os dois casos.
async function discardParsedMessage(
  message: Selectable<DiscordImportMessagesTable>,
  existing: { id: string; status: string } | undefined,
  parsed: ImportTableDraft,
): Promise<'discarded'> {
  await db.updateTable('discord_import_messages')
    .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
    .where('id', '=', message.id)
    .execute();
  if (existing?.id) {
    await db.updateTable('discord_import_table_drafts')
      .set({ status: 'rejected', updated_at: new Date() })
      .where('id', '=', existing.id as string)
      .where('status', 'not in', ['synced', 'rejected'])
      .execute();
  }
  await recordParseCase({
    message,
    deterministicResult: parsed,
    finalResult: null,
    finalAction: 'discard',
  });
  return 'discarded';
}

export async function processDiscordMessageToDraft(
  message: Selectable<DiscordImportMessagesTable>,
  systems: SystemEntry[] | undefined,
  replyContext: string | undefined,
  userId: string | undefined,
  // DEB-058-XX: filtro funcional de mesa paga na importação. Default `true`
  // preserva o comportamento anterior (caller que não passa a flag continua
  // aceitando pagas) — só o import-json/preview e o /reparse plugam a escolha
  // explícita do mantenedor na UI.
  acceptPaidTables = true,
  catalogs?: ParserPlatformCatalogs,
  // Achado do mantenedor 2026-07-08: mover o filtro "só com contato explícito"
  // da tela de revisão (era só ocultação visual, pós-import) pra opção real de
  // importação — mesa sem contact_discord/contact_url publicado no anúncio
  // nunca vira draft. Independe de host_discord_id (autor da mensagem no
  // Discord), que é só fallback técnico pra mesa nunca ficar sem NENHUM
  // contato, não é o que o mestre divulgou de propósito. No fim da lista de
  // params pra não deslocar posicionalmente os callers existentes.
  requireExplicitContact = false,
): Promise<DiscordDraftOutcome> {
  // Reconcilia draft terminal (synced/rejected) ANTES de parsear — evita marcar
  // a mensagem como ignored/error em cima de um draft já terminal (CodeRabbit).
  const existing = await db.selectFrom('discord_import_table_drafts')
    .select(['id', 'status'])
    .where('discord_message_id', '=', message.id)
    .executeTakeFirst();

  if (await reconcileTerminalDraft(existing, message.id)) {
    return 'reconciled';
  }

  const result = await parseDiscordMessage(message, systems, replyContext, catalogs);
  if (!result) {
    // DEB-048-27: distingue descarte por autoria (homebrew) de não-anúncio.
    const discarded = isHomebrewSystem({
      discord_thread_name: message.discord_thread_name,
      content_raw: String(message.content_raw ?? ''),
      embeds: parseJsonField(message.embeds),
    } as ImportRawMessage);
    await db.updateTable('discord_import_messages')
      .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();
    await recordParseCase({
      message,
      deterministicResult: null,
      finalResult: null,
      finalAction: discarded ? 'discard' : 'ignore',
    });
    return discarded ? 'discarded' : 'ignored';
  }
  const { parsed, systems: resolvedSystems } = result;

  // DEB-058-XX: filtro de mesa paga acontece logo após o parse determinístico
  // (já tem price_type), antes do enrich/upsert — mesa paga não vira draft nem
  // some silenciosamente: mensagem fica 'ignored' e o caso é registrado como
  // 'discard' para a camada de aprendizado.
  if (!acceptPaidTables && parsed.table.price_type === 'paga') {
    return discardParsedMessage(message, existing, parsed);
  }

  if (requireExplicitContact && !parsed.table.contact_url && !(parsed.table.contact_discord && parsed.table.contact_discord_explicit)) {
    return discardParsedMessage(message, existing, parsed);
  }

  // WS3: enriquecimento LLM (best-effort) antes do upsert, p/ o draft salvo já
  // conter o melhor resultado disponível. Extraído p/ helper (REV-039).
  const normalizedResult = await enrichDraftWithLlm(message, parsed, result.normalized);

  const draftId = await upsertDraftWithShadow(existing?.id, message.id, parsed, normalizedResult);
  await recordParseCase({
    message,
    draftId,
    deterministicResult: parsed,
    finalResult: normalizedResult.draft,
    finalAction: parseActionFromNormalizedStatus(normalizedResult.status),
  });

  await db.updateTable('discord_import_messages')
    .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
    .where('id', '=', message.id)
    .execute();

  await ensureSystemSuggestionForDraft(
    normalizedResult.draft,
    userId,
    message.discord_thread_name ?? message.discord_message_id,
  );

  await persistCoverUpload(draftId, normalizedResult.draft, message.id);

  return 'parsed';
}

/**
 * Valida `messageIds` de payload externo (DEB-048-19). Lança
 * DiscordChatExporterValidationError (→ 400 no handler) se inválido.
 */
// Achado CodeRabbit PR #124: sem esse teto, /reparse com messageIds fatia em
// chunks de REPARSE_BATCH_SIZE e processa TODOS os chunks numa única
// requisição síncrona — o `if (idChunk || ...) break` do route handler nunca
// chega a checar REPARSE_MAX_BATCHES nesse caminho, então o teto de segurança
// (~10k) só valia pro caminho sem ids. Rejeita cedo (400) em vez de aceitar
// qualquer tamanho.
export const MAX_REPARSE_MESSAGE_IDS = 2000;

export function validateReparseMessageIds(rawIds: unknown): string[] | undefined {
  if (rawIds === undefined || rawIds === null) return undefined;
  if (!Array.isArray(rawIds)) {
    throw new DiscordChatExporterValidationError('messageIds deve ser um array de strings.');
  }
  if (rawIds.length > MAX_REPARSE_MESSAGE_IDS) {
    throw new DiscordChatExporterValidationError(
      `messageIds excede o limite (${rawIds.length} > ${MAX_REPARSE_MESSAGE_IDS}). Divida em chamadas menores.`,
    );
  }
  // Normaliza: trim em cada id; rejeita não-string ou vazio (inclui "   ").
  const normalized = rawIds.map((id: unknown) => (typeof id === 'string' ? id.trim() : id));
  if (!normalized.every((id) => typeof id === 'string' && id.length > 0)) {
    throw new DiscordChatExporterValidationError('messageIds deve conter apenas strings não-vazias.');
  }
  return normalized as string[];
}

/**
 * Processa UMA mensagem no /reparse com política de erro própria (DEB-048-20):
 * pula `synced` ('skipped'), processa via helper compartilhado, e em falha marca
 * a mensagem como erro sem abortar o lote. Extraído para reduzir a complexidade
 * cognitiva do handler.
 */
export async function reparseOneMessage(
  message: Selectable<DiscordImportMessagesTable>,
  contentIndex: Map<string, string>,
  userId: string | undefined,
  acceptPaidTables = true,
  systems?: SystemEntry[],
  catalogs?: ParserPlatformCatalogs,
  requireExplicitContact = false,
): Promise<DiscordDraftOutcome | 'error' | 'skipped'> {
  if (message.status === 'synced') return 'skipped'; // segurança extra
  try {
    const replyContext = resolveReplyContext(message as Record<string, unknown>, contentIndex);
    return await processDiscordMessageToDraft(message, systems, replyContext, userId, acceptPaidTables, catalogs, requireExplicitContact);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'unknown error';
    try {
      await db.updateTable('discord_import_messages')
        .set({ status: 'error', parse_error: errorMessage, updated_at: new Date() })
        .where('id', '=', message.id)
        .execute();
    } catch (dbError: unknown) {
      console.error('[reparseOneMessage] DB update failed for message', message.id,
        dbError instanceof Error ? dbError.message : 'unknown db error');
    }
    return 'error';
  }
}

// ─── REV-037 — validateDraftStatusTransition (drafts.ts + adminImportInbox.ts) ──

/**
 * Valida transição de status de draft (→ ready). Padroniza o formato de erro 422
 * para `{ error, details: { missing_fields } }`. Substitui 12 linhas duplicadas
 * em drafts.ts:90-102 e adminImportInbox.ts:344-355.
 */
export function validateDraftStatusTransition(
  data: { status?: string; normalized_payload?: unknown },
  current: { normalized_payload: unknown },
): { allowed: boolean; reason?: string; missingFields?: string[] } {
  const patchPayload = normalizeDraftPayload(data.normalized_payload ?? current.normalized_payload) as { missing_fields?: unknown } | undefined;
  const currentPayload = normalizeDraftPayload(current.normalized_payload) as { missing_fields?: unknown } | null;
  return assertDraftReadyTransition({
    patchStatus: data.status as string,
    patchPayloadMissing: patchPayload?.missing_fields,
    currentPayloadMissing: currentPayload?.missing_fields,
  });
}

// ─── REV-074 — handlePatchDraft (boilerplate compartilhado de PATCH drafts) ────

type PatchCheckResult = { status: number; body: unknown } | null;

interface PatchDraftConfig {
  /** Validações antes da transição de status. Retorna resultado de erro ou null (prossegue). */
  preTransitionChecks?: (current: Record<string, unknown>, data: Record<string, unknown>) => PatchCheckResult;
  /** Validações após a transição de status. Retorna resultado de erro ou null (prossegue). */
  postTransitionChecks?: (current: Record<string, unknown>, data: Record<string, unknown>) => PatchCheckResult;
  /** Transforma os dados antes de validar/atualizar (ex.: merge de normalized_payload). */
  transformData?: (data: Record<string, unknown>, current: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Handler compartilhado de PATCH drafts — extrai ~35 linhas de boilerplate
 * duplicadas entre inbox/drafts.ts e discord/drafts.ts.
 *
 * O call-site faz parse do body com patchDraftSchema e chama esta função,
 * que lida com fetch, validação de transição e update no banco.
 *
 * Sempre faz selectAll() — uma linha a mais na query PATCH, mas elimina
 * a complexidade de select dinâmico com colunas extras (Kysely typed).
 */
export async function handlePatchDraft(
  req: Request,
  config: PatchDraftConfig = {},
): Promise<{ status: number; body: unknown }> {
  const parsed = patchDraftSchema.safeParse(req.body);
  if (!parsed.success) {
    return { status: 400, body: { error: 'Dados inválidos.', details: z.flattenError(parsed.error) } };
  }
  if (Object.keys(parsed.data).length === 0) {
    return { status: 400, body: { error: 'Nenhum dado para atualizar.' } };
  }

  const current = await db
    .selectFrom('discord_import_table_drafts')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!current) {
    return { status: 404, body: { error: 'Draft não encontrado.' } };
  }

  // Cast básico — callbacks conhecem os campos que precisam
  const currentRow = current as unknown as Record<string, unknown>;

  if (config.preTransitionChecks) {
    const check = config.preTransitionChecks(currentRow, parsed.data as Record<string, unknown>);
    if (check) return check;
  }

  const data = config.transformData
    ? config.transformData(parsed.data as Record<string, unknown>, currentRow)
    : parsed.data;

  const transition = validateDraftStatusTransition(data as { status?: string; normalized_payload?: unknown }, current);
  if (!transition.allowed) {
    return {
      status: 422,
      body: {
        error: transition.reason ?? "Draft não pode ser marcado como 'ready'.",
        details: { missing_fields: transition.missingFields ?? [] },
      },
    };
  }

  if (config.postTransitionChecks) {
    const check = config.postTransitionChecks(currentRow, data as Record<string, unknown>);
    if (check) return check;
  }

  const [draft] = await db
    .updateTable('discord_import_table_drafts')
    .set({ ...(data as Record<string, unknown>), updated_at: new Date() })
    .where('id', '=', req.params.id)
    .returningAll()
    .execute();

  if (!draft) {
    return { status: 404, body: { error: 'Draft não encontrado.' } };
  }

  // Codex P2 (T-G7): rejeição via PATCH fecha o outcome real da decisão shadow.
  // Sync vai por syncDiscordDraftToTable (grava 'synced' lá). No-op p/ inbox.
  const patchedStatus = (data as Record<string, unknown>).status;
  if (patchedStatus === 'rejected' || patchedStatus === 'synced') {
    await db
      .updateTable('discord_shadow_decisions')
      .set({ actual_outcome: patchedStatus, actual_at: new Date() })
      .where('draft_id', '=', req.params.id)
      .where('actual_outcome', 'is', null)
      .execute()
      .catch((err) => console.error('[handlePatchDraft shadow]', err instanceof Error ? err.message : 'unknown error'));
    const currentPayload = normalizeDraftPayload(current.normalized_payload ?? current.parsed_payload);
    await recordParseFeedback({
      draftId: req.params.id,
      feedbackType: patchedStatus === 'rejected' ? 'discard' : 'publish',
      beforeValue: current.status,
      afterValue: patchedStatus,
      reason: null,
      scope: extractDraftScope(currentPayload),
      adminUserId: req.user?.userId ?? null,
    });
  }

  return { status: 200, body: { data: draft } };
}

// ─── REV-077 — reconcileTerminalDraft (evita reprocessamento em loop) ─────────

/**
 * REV-077: Se o draft existente está em estado terminal (synced/rejected),
 * reconcilia o status da mensagem para evitar reprocessamento infinito.
 *
 * Comportamento:
 * - Draft synced → message.status = 'synced' (nunca mais será reprocessado)
 * - Draft rejected → message.status = 'ignored' (nunca mais será reprocessado)
 * - Caso contrário → retorna false (caller deve prosseguir com o fluxo normal)
 *
 * Uso:
 *   if (await reconcileTerminalDraft(existingDraft, message.id)) { continue; }
 *
 * Elimina a duplicação do mesmo padrão em parse-batch.ts e fetch.ts.
 */
export async function reconcileTerminalDraft(
  existingDraft: { id: unknown; status: string } | undefined,
  messageId: string,
): Promise<boolean> {
  if (existingDraft?.status !== 'synced' && existingDraft?.status !== 'rejected') {
    return false;
  }
  await db.updateTable('discord_import_messages')
    .set({
      status: existingDraft.status === 'synced' ? 'synced' : 'ignored',
      parse_error: null,
      updated_at: new Date(),
    })
    .where('id', '=', messageId)
    .execute();
  return true;
}

// ─── D009 — helpers extraídos de adminDiscordSync.ts ──────────────────────────

export const snowflakeParamSchema = z.object({
  guildId: z.string().regex(/^\d{5,30}$/, 'Servidor Discord inválido.'),
});

export function normalizeSourceChannelType(value: unknown): DiscordSourceChannelType {
  return value === 'announcement' || value === 'forum' ? value : 'text';
}

export function sendDiscordDiscoveryError(res: Response, error: unknown, fallbackMessage: string): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof DiscordDiscoveryError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof Error && error.message.includes('DISCORD_BOT_TOKEN não configurado')) {
    return res.status(422).json({ error: 'Configure o token do bot antes de descobrir servidores e canais.' });
  }
  console.error(fallbackMessage, error);
  return res.status(502).json({ error: 'Não foi possível consultar o Discord agora. Tente novamente em instantes.' });
}

export function sendDiscordFetchError(res: Response, error: unknown): Response {
  if (error instanceof DiscordSettingsSecretUnavailableError) {
    return res.status(503).json({ error: error.message });
  }
  if (error instanceof DiscordIngestError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  if (error instanceof Error && error.message.includes('DISCORD_BOT_TOKEN não configurado')) {
    return res.status(422).json({ error: error.message });
  }
  console.error('[POST /admin/discord/fetch]', error);
  return res.status(500).json({ error: 'Erro ao buscar mensagens.' });
}
