import type {
  DiscordSource,
  DiscordDiscoveredGuild,
  DiscordDiscoveredChannel,
  DiscordMessage,
  DiscordDraft,
  DiscordSettings,
  DiscordBotTokenSettings,
  DiscordSourceChannelType,
  DiscordImportMessageStatus,
  DiscordImportDraftStatus,
  DiscordFetchWindow,
  DiscordMessageContentDiagnostic,
  IngestResult,
  SyncReadyResult,
} from '../types';
import { z } from 'zod';

const API_BASE = import.meta.env.VITE_API_URL || '';
const BASE = `${API_BASE}/api/v1/admin/discord-sync`;

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.data as T;
}

const discordBotTokenSettingsSchema = z.object({
  is_set: z.boolean(),
  preview: z.string().nullable(),
  updated_at: z.string().nullable(),
});

const discordSettingsSchema = z.object({
  bot_token: discordBotTokenSettingsSchema,
});

const discordDiscoveredGuildSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  approximate_member_count: z.number().nullable(),
});

const discordDiscoveredChannelSchema = z.object({
  id: z.string(),
  guild_id: z.string(),
  name: z.string(),
  type: z.number(),
  kind: z.enum(['text', 'announcement', 'forum']).default('text'),
  position: z.number().nullable(),
  parent_id: z.string().nullable(),
  parent_name: z.string().nullable(),
});

const discordSourceSchema = z.object({
  id: z.string(),
  guild_id: z.string(),
  channel_id: z.string(),
  channel_name: z.string().nullable(),
  channel_type: z.enum(['text', 'announcement', 'forum']).default('text'),
  enabled: z.boolean(),
  auto_sync_enabled: z.boolean(),
  last_message_id: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const discordJsonArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.items)) return record.items;
    if (Array.isArray(record.data)) return record.data;
    return Object.values(record);
  }
  return [];
}, z.array(z.unknown()));

const discordMessageSchema = z.object({
  id: z.string(),
  source_id: z.string(),
  discord_message_id: z.string(),
  discord_channel_id: z.string(),
  discord_guild_id: z.string(),
  discord_parent_channel_id: z.string().nullable().default(null),
  discord_thread_id: z.string().nullable().default(null),
  discord_thread_name: z.string().nullable().default(null),
  discord_author_id: z.string().nullable(),
  discord_author_name: z.string().nullable(),
  discord_message_url: z.string().nullable(),
  content_raw: z.string(),
  attachments: discordJsonArraySchema.default([]),
  embeds: discordJsonArraySchema.default([]),
  message_created_at: z.string().nullable(),
  message_edited_at: z.string().nullable(),
  content_hash: z.string(),
  source_kind: z.enum(['discord_bot', 'discord_chat_exporter_json']),
  status: z.enum(['pending', 'parsed', 'needs_review', 'synced', 'ignored', 'error']),
  parse_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

function parseDiscordSettings(value: unknown): DiscordSettings {
  const parsed = discordSettingsSchema.safeParse(value);
  if (!parsed.success) {
    return { bot_token: { is_set: false, preview: null, updated_at: null } };
  }
  return parsed.data;
}

function parseDiscordBotTokenSettings(value: unknown): DiscordBotTokenSettings {
  const parsed = discordBotTokenSettingsSchema.safeParse(value);
  if (!parsed.success) {
    return { is_set: false, preview: null, updated_at: null };
  }
  return parsed.data;
}

function parseDiscordDiscoveredGuilds(value: unknown): DiscordDiscoveredGuild[] {
  const parsed = z.array(discordDiscoveredGuildSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseDiscordDiscoveredChannels(value: unknown): DiscordDiscoveredChannel[] {
  const parsed = z.array(discordDiscoveredChannelSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseDiscordSources(value: unknown): DiscordSource[] {
  const parsed = z.array(discordSourceSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseDiscordMessages(value: unknown): DiscordMessage[] {
  const parsed = z.array(discordMessageSchema).safeParse(value);
  return parsed.success ? parsed.data : [];
}

function parseDiscordMessage(value: unknown): DiscordMessage {
  const parsed = discordMessageSchema.safeParse(value);
  if (!parsed.success) throw new Error('Mensagem Discord em formato inesperado.');
  return parsed.data;
}

export const discordSyncApi = {
  getDiscordSettings: async () =>
    parseDiscordSettings(await apiFetch<unknown>('/settings')),

  saveDiscordBotToken: async (body: { token: string }) =>
    parseDiscordBotTokenSettings(await apiFetch<unknown>('/settings/bot-token', { method: 'PUT', body: JSON.stringify(body) })),

  deleteDiscordBotToken: () =>
    apiFetch<void>('/settings/bot-token', { method: 'DELETE' }),

  discoverGuilds: async () =>
    parseDiscordDiscoveredGuilds(await apiFetch<unknown>('/discovery/guilds')),

  discoverChannels: async (guildId: string) =>
    parseDiscordDiscoveredChannels(await apiFetch<unknown>(`/discovery/guilds/${guildId}/channels`)),

  getSources: async () =>
    parseDiscordSources(await apiFetch<unknown>('/sources')),

  createSource: (body: { guild_id: string; channel_id: string; channel_name?: string; channel_type?: DiscordSourceChannelType; enabled?: boolean }) =>
    apiFetch<DiscordSource>('/sources', { method: 'POST', body: JSON.stringify(body) }),

  updateSource: (id: string, body: { channel_name?: string; enabled?: boolean; auto_sync_enabled?: boolean }) =>
    apiFetch<DiscordSource>(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  deleteSource: (id: string) =>
    apiFetch<{ message: string }>(`/sources/${id}`, { method: 'DELETE' }),

  fetchMessages: (body: { source_id: string; limit?: number; before_message_id?: string } & DiscordFetchWindow) =>
    apiFetch<IngestResult>('/fetch', { method: 'POST', body: JSON.stringify(body) }),

  getMessages: async (params?: { source_id?: string; status?: DiscordImportMessageStatus; limit?: number; offset?: number } & DiscordFetchWindow) => {
    const qs = new URLSearchParams();
    if (params?.source_id) qs.set('source_id', params.source_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.since) qs.set('since', params.since);
    if (params?.until) qs.set('until', params.until);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    return parseDiscordMessages(await apiFetch<unknown>(`/messages?${qs}`));
  },

  updateMessage: async (id: string, body: { status: DiscordImportMessageStatus }) =>
    parseDiscordMessage(await apiFetch<unknown>(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  parseMessage: (id: string) =>
    apiFetch<DiscordDraft>(`/messages/${id}/parse`, { method: 'POST' }),

  diagnoseMessageContent: (id: string) =>
    apiFetch<DiscordMessageContentDiagnostic>(`/messages/${id}/diagnose-content`, { method: 'POST' }),

  getDrafts: (params?: { status?: DiscordImportDraftStatus; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    return apiFetch<DiscordDraft[]>(`/drafts?${qs}`);
  },

  getDraft: (id: string) =>
    apiFetch<DiscordDraft>(`/drafts/${id}`),

  updateDraft: (id: string, body: { normalized_payload?: Record<string, unknown>; status?: DiscordImportDraftStatus; review_notes?: string }) =>
    apiFetch<DiscordDraft>(`/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  syncDraft: (id: string) =>
    apiFetch<{ tableId: string; created: boolean }>(`/drafts/${id}/sync`, { method: 'POST' }),

  reparseDraft: (id: string) =>
    apiFetch<DiscordDraft>(`/drafts/${id}/reparse`, { method: 'POST' }),

  syncReady: () =>
    apiFetch<SyncReadyResult>('/sync-ready', { method: 'POST' }),

  reingestForce: (sourceId: string, body?: DiscordFetchWindow) =>
    apiFetch<IngestResult & { deleted: number }>(`/sources/${sourceId}/reingest-force`, { method: 'POST', body: JSON.stringify(body ?? {}) }),

  parseBatch: () =>
    apiFetch<{ processed: number; succeeded: number; failed: number }>('/messages/parse-batch', { method: 'POST' }),
};
