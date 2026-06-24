import { Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import type { DiscordSourceChannelType } from '../../db/types';
import type { SystemEntry, ImportRawMessage } from '../../discord';
import { normalizeDiscordTableDraft, parseDiscordAnnouncement, normalizeDraftPayload, assertDraftReadyTransition } from '../../discord';
import { DiscordDiscoveryError, DiscordIngestError } from '../../discord';
import { DiscordSettingsSecretUnavailableError } from '../../discord/settingsCrypto';
import { loadSystemsForParser } from '../../discord/shared';
import { notifyAdmins } from '../../services/adminNotifications';

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

// ─── REV-036 — parseDiscordMessage compartilhada (messageParse.ts + drafts.ts) ──

/**
 * Parseia uma mensagem Discord importada e normaliza para draft.
 * Substitui 20 linhas duplicadas em messageParse.ts:22-42 e drafts.ts:168-187.
 */
export async function parseDiscordMessage(
  msg: { source_kind: unknown; discord_message_id: unknown; discord_channel_id: unknown; discord_guild_id: unknown; discord_parent_channel_id: unknown; discord_thread_id: unknown; discord_thread_name: unknown; discord_author_id: unknown; discord_author_name: unknown; discord_message_url: unknown; content_raw: unknown; attachments: unknown; embeds: unknown; message_created_at: unknown; message_edited_at: unknown },
  systems?: SystemEntry[],
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
    content_raw: (msg.content_raw as string) ?? '',
    attachments: parseJsonField(msg.attachments),
    embeds: parseJsonField(msg.embeds),
    message_created_at: msg.message_created_at ? new Date(msg.message_created_at as string) : null,
    message_edited_at: msg.message_edited_at ? new Date(msg.message_edited_at as string) : null,
  };
  const parsed = parseDiscordAnnouncement(raw, sys);
  if (!parsed) return null;
  const normalized = normalizeDiscordTableDraft(parsed, sys);
  return { parsed, normalized };
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
