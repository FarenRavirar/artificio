import { Response, Request } from 'express';
import { z } from 'zod';
import type { Selectable } from 'kysely';
import { db } from '../../db';
import type { DiscordSourceChannelType, DiscordImportMessagesTable } from '../../db/types';
import type { SystemEntry, ImportRawMessage } from '../../discord';
import { normalizeDiscordTableDraft, parseDiscordAnnouncement, normalizeDraftPayload, assertDraftReadyTransition } from '../../discord';
import { DiscordDiscoveryError, DiscordIngestError } from '../../discord';
import { DiscordChatExporterValidationError } from '../../discord/chatExporterAdapter';
import { DiscordSettingsSecretUnavailableError } from '../../discord/settingsCrypto';
import { loadSystemsForParser } from '../../discord/shared';
import { notifyAdmins } from '../../services/adminNotifications';
import { patchDraftSchema } from '../inbox/utils';

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

// loadSystemsForParser → importado de ../../discord/shared (D013)

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
): Promise<{ parsed: NonNullable<ReturnType<typeof parseDiscordAnnouncement>>; normalized: ReturnType<typeof normalizeDiscordTableDraft> } | null> {
  const sys = systems ?? await loadSystemsForParser();
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
  const parsed = parseDiscordAnnouncement(raw, sys, replyContext);
  if (!parsed) return null;
  const normalized = normalizeDiscordTableDraft(parsed, sys);
  return { parsed, normalized };
}

// ─── DEB-048-22 — processa UMA mensagem → draft (parse-batch + /reparse) ──

export type DiscordDraftOutcome = 'parsed' | 'ignored' | 'reconciled';

/**
 * Processa uma mensagem do DiscordChatExporter até o draft: parseia, reconcilia
 * draft terminal, faz upsert do draft, atualiza status da mensagem e gera sugestão
 * de sistema. Compartilhado entre parse-batch e /reparse (eram ~45 linhas idênticas
 * — SonarCloud 24.8% dup em import.ts). Lança em erro de DB; o caller decide a
 * política de catch e os contadores conforme o `DiscordDraftOutcome` retornado.
 */
export async function processDiscordMessageToDraft(
  message: Selectable<DiscordImportMessagesTable>,
  systems: SystemEntry[] | undefined,
  replyContext: string | undefined,
  userId: string | undefined,
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

  const result = await parseDiscordMessage(message, systems, replyContext);
  if (!result) {
    await db.updateTable('discord_import_messages')
      .set({ status: 'ignored', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();
    return 'ignored';
  }
  const { parsed, normalized } = result;

  if (existing) {
    await db.updateTable('discord_import_table_drafts')
      .set({
        parsed_payload: parsed,
        normalized_payload: normalized.draft,
        confidence: normalized.draft.confidence,
        status: normalized.status,
        updated_at: new Date(),
      })
      .where('id', '=', existing.id)
      .execute();
  } else {
    await db.insertInto('discord_import_table_drafts')
      .values({
        discord_message_id: message.id,
        parsed_payload: parsed,
        normalized_payload: normalized.draft,
        confidence: normalized.draft.confidence,
        status: normalized.status,
      })
      .execute();
  }

  await db.updateTable('discord_import_messages')
    .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
    .where('id', '=', message.id)
    .execute();

  await ensureSystemSuggestionForDraft(
    normalized.draft,
    userId,
    message.discord_thread_name ?? message.discord_message_id,
  );

  return 'parsed';
}

/**
 * Valida `messageIds` de payload externo (DEB-048-19). Lança
 * DiscordChatExporterValidationError (→ 400 no handler) se inválido.
 */
export function validateReparseMessageIds(rawIds: unknown): string[] | undefined {
  if (rawIds === undefined || rawIds === null) return undefined;
  if (!Array.isArray(rawIds)) {
    throw new DiscordChatExporterValidationError('messageIds deve ser um array de strings.');
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
): Promise<DiscordDraftOutcome | 'error' | 'skipped'> {
  if (message.status === 'synced') return 'skipped'; // segurança extra
  try {
    const replyContext = resolveReplyContext(message as Record<string, unknown>, contentIndex);
    return await processDiscordMessageToDraft(message, undefined, replyContext, userId);
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
  console.error('[POST /admin/discord-sync/fetch]', error);
  return res.status(500).json({ error: 'Erro ao buscar mensagens.' });
}
