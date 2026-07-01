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
  DiscordIntegrationMetrics,
  DiscordFetchWindow,
  DiscordMessageContentDiagnostic,
  IngestResult,
  SyncReadyResult,
  ChatExporterConfig,
  ChatExporterProfile,
  ChatExporterProfileInput,
  ChatExporterTestResult,
  ChatExporterRunResult,
  ChatExporterDelta,
} from '../types';
import { z } from 'zod';
import { authenticatedFetch } from '../../../services/apiClient';

const BASE = '/api/v1/admin/discord';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await authenticatedFetch(`${BASE}${path}`, options || {});
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Resposta inesperada do servidor (HTTP ${res.status}).`);
  }
  if (!res.ok) throw new Error(typeof data === 'object' && data !== null && 'error' in data ? String((data as Record<string, unknown>).error) : `HTTP ${res.status}`);
  return (data as Record<string, unknown>).data as T;
}

const discordBotTokenSettingsSchema = z.object({
  is_set: z.boolean(),
  preview: z.string().nullable(),
  updated_at: z.string().nullable(),
});

const discordSettingsSchema = z.object({
  bot_token: discordBotTokenSettingsSchema,
});

const chatExporterSecretStatusSchema = z.object({
  is_set: z.boolean(),
  preview: z.string().nullable(),
  updated_at: z.string().nullable(),
});

const chatExporterConfigSchema = z.object({
  enabled: z.boolean().optional(),
  authType: z.enum(['user', 'bot']).optional(),
  frequency: z.enum(['hourly', 'daily', 'weekly']).optional(),
  time: z.string().optional(),
  timezone: z.string().optional(),
  importDir: z.string().optional(),
  channelId: z.string().optional(),
  after: z.string().optional(),
  token: chatExporterSecretStatusSchema,
  updated_at: z.string().nullable(),
  decrypt_error: z.boolean().optional(),
});

const chatExporterProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  guild_id: z.string(),
  guild_name: z.string().nullable(),
  channel_id: z.string(),
  channel_name: z.string().nullable(),
  format: z.literal('Json'),
  auth_type: z.enum(['global', 'user', 'bot']),
  include_threads: z.enum(['none', 'active', 'all']),
  after: z.string().nullable(),
  media: z.boolean(),
  schedule_enabled: z.boolean(),
  frequency: z.enum(['hourly', 'daily', 'weekly']),
  time: z.string(),
  timezone: z.string(),
  import_dir: z.string(),
  enabled: z.boolean(),
  last_run_at: z.string().nullable(),
  last_status: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  token: chatExporterSecretStatusSchema,
});

const chatExporterDeltaSchema = z.object({
  newCount: z.number().int().nonnegative(),
  capped: z.boolean(),
  afterMessageId: z.string().nullable(),
});
function parseChatExporterDelta(data: unknown): ChatExporterDelta {
  const parsed = chatExporterDeltaSchema.safeParse(data);
  if (!parsed.success) throw new Error('Resposta de delta ChatExporter em formato inesperado.');
  return parsed.data;
}

const chatExporterValidateTokenResultSchema = z.object({
  ok: z.boolean(),
  username: z.string(),
});
function parseChatExporterValidateTokenResult(value: unknown): { ok: boolean; username: string } {
  const parsed = chatExporterValidateTokenResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resposta de validação de token em formato inesperado.');
  return parsed.data;
}

const chatExporterTestResultSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string()),
  command: z.string().nullable(),
});

const chatExporterRunResultSchema = z.object({
  exported: z.object({ outputPath: z.string() }),
  imported: z.object({
    rootDir: z.string(),
    incoming: z.number(),
    processed: z.number(),
    errors: z.number(),
    retainedDeleted: z.number(),
    files: z.array(z.object({
      fileName: z.string(),
      status: z.enum(['processed', 'error']),
      error: z.string().optional(),
    })),
  }),
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

function parseChatExporterConfig(value: unknown): ChatExporterConfig {
  const parsed = chatExporterConfigSchema.safeParse(value);
  if (!parsed.success) throw new Error('Configuração do ChatExporter em formato inesperado.');
  return parsed.data;
}

function parseChatExporterProfiles(value: unknown): ChatExporterProfile[] {
  const parsed = z.array(chatExporterProfileSchema).safeParse(value);
  if (!parsed.success) throw new Error('Lista de perfis ChatExporter em formato inesperado.');
  return parsed.data;
}

function parseChatExporterProfile(value: unknown): ChatExporterProfile {
  const parsed = chatExporterProfileSchema.safeParse(value);
  if (!parsed.success) throw new Error('Perfil ChatExporter em formato inesperado.');
  return parsed.data;
}

function parseChatExporterTestResult(value: unknown): ChatExporterTestResult {
  const parsed = chatExporterTestResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resposta do teste ChatExporter em formato inesperado.');
  return parsed.data;
}

function parseChatExporterRunResult(value: unknown): ChatExporterRunResult {
  const parsed = chatExporterRunResultSchema.safeParse(value);
  if (!parsed.success) throw new Error('Resposta da execução ChatExporter em formato inesperado.');
  return parsed.data;
}

function parseDiscordDiscoveredGuilds(value: unknown): DiscordDiscoveredGuild[] {
  const parsed = z.array(discordDiscoveredGuildSchema).safeParse(value);
  if (!parsed.success) throw new Error('Lista de guilds Discord em formato inesperado.');
  return parsed.data;
}

function parseDiscordDiscoveredChannels(value: unknown): DiscordDiscoveredChannel[] {
  const parsed = z.array(discordDiscoveredChannelSchema).safeParse(value);
  if (!parsed.success) throw new Error('Lista de canais Discord em formato inesperado.');
  return parsed.data;
}

function parseDiscordSources(value: unknown): DiscordSource[] {
  const parsed = z.array(discordSourceSchema).safeParse(value);
  if (!parsed.success) throw new Error('Lista de fontes Discord em formato inesperado.');
  return parsed.data;
}

function parseDiscordMessages(value: unknown): DiscordMessage[] {
  const parsed = z.array(discordMessageSchema).safeParse(value);
  if (!parsed.success) throw new Error('Lista de mensagens Discord em formato inesperado.');
  return parsed.data;
}

function parseDiscordMessage(value: unknown): DiscordMessage {
  const parsed = discordMessageSchema.safeParse(value);
  if (!parsed.success) throw new Error('Mensagem Discord em formato inesperado.');
  return parsed.data;
}

const importResultSchema = z.object({
  total: z.number(),
  inserted: z.number(),
  updated: z.number(),
  ignored: z.number(),
  failed: z.number(),
});

const previewResultSchema = z.object({
  guild: z.object({ id: z.string(), name: z.string() }),
  channel: z.object({ id: z.string(), name: z.string() }),
  dateRange: z.object({ after: z.string().optional(), before: z.string().optional() }).nullable(),
  exportedAt: z.string().nullable(),
  messageCount: z.number(),
  totalAttachments: z.number(),
  totalEmbeds: z.number(),
});

function parseImportResult(data: unknown) {
  const parsed = importResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Resposta de importação em formato inesperado.');
  return parsed.data;
}

// Envelope das ações em lote: só `updated` é consumido (contador). Validado, não cast cego.
const batchResultSchema = z.object({ updated: z.number().int().nonnegative() });
function parseBatchResult(data: unknown): { updated: number } {
  const parsed = batchResultSchema.safeParse(data);
  return { updated: parsed.success ? parsed.data.updated : 0 };
}

// Envelope da limpeza de descartados: `deleted` é consumido (contador). Falha alto
// se o payload sair do contrato — silenciar como 0 esconderia a regressão e a UI
// mostraria "0 apagado(s)" como sucesso (CodeRabbit).
const deletedResultSchema = z.object({ deleted: z.number().int().nonnegative() });
function parseDeletedResult(data: unknown): { deleted: number } {
  const parsed = deletedResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Resposta de limpeza em formato inesperado.');
  return parsed.data;
}

// Métricas de integração (entra em render → normalização tipada obrigatória).
const importRunSchema = z.object({
  id: z.string(),
  source_kind: z.string().default('desconhecido'),
  started_at: z.string(),
  ended_at: z.string().nullable().default(null),
  total_messages: z.number().default(0),
  drafts_created: z.number().default(0),
  drafts_updated: z.number().default(0),
  messages_ignored: z.number().default(0),
  messages_failed: z.number().default(0),
  note: z.string().nullable().default(null),
  created_by: z.string().nullable().default(null),
});
const integrationMetricsSchema = z.object({
  runs: z.array(importRunSchema).catch([]),
  totals: z.object({
    corrections: z.number().default(0),
    drafts: z.number().default(0),
    ready: z.number().default(0),
    needs_review: z.number().default(0),
    synced: z.number().default(0),
    rejected: z.number().default(0),
  }).catch({ corrections: 0, drafts: 0, ready: 0, needs_review: 0, synced: 0, rejected: 0 }),
  top_corrected_fields: z.array(z.object({ field: z.string(), count: z.number() })).catch([]),
});
function parseIntegrationMetrics(data: unknown): DiscordIntegrationMetrics {
  const parsed = integrationMetricsSchema.safeParse(data);
  if (!parsed.success) {
    return { runs: [], totals: { corrections: 0, drafts: 0, ready: 0, needs_review: 0, synced: 0, rejected: 0 }, top_corrected_fields: [] };
  }
  return parsed.data;
}

function parsePreviewResult(data: unknown) {
  const parsed = previewResultSchema.safeParse(data);
  if (!parsed.success) throw new Error('Resposta de preview em formato inesperado.');
  return parsed.data;
}

// REV-016: helper DRY — elimina duplicação entre previewFile e importFile
async function fileApiFetch<T>(
  url: string,
  file: File,
  parser: (data: unknown) => T,
  errorLabel: string,
): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authenticatedFetch(`${BASE}${url}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    let errData: unknown;
    try { errData = JSON.parse(text); } catch { /* ignorar */ }
    throw new Error(typeof errData === 'object' && errData !== null && 'error' in errData
      ? String((errData as Record<string, unknown>).error)
      : `Erro ao ${errorLabel} (HTTP ${res.status}).`);
  }
  const data = await res.json();
  return parser((data as Record<string, unknown>).data);
}

export const discordSyncApi = {

  getDiscordSettings: async () =>
    parseDiscordSettings(await apiFetch<unknown>('/settings')),

  saveDiscordBotToken: async (body: { token: string }) =>
    parseDiscordBotTokenSettings(await apiFetch<unknown>('/settings/bot-token', { method: 'PUT', body: JSON.stringify(body) })),

  deleteDiscordBotToken: () =>
    apiFetch<void>('/settings/bot-token', { method: 'DELETE' }),

  getChatExporterConfig: async () =>
    parseChatExporterConfig(await apiFetch<unknown>('/chat-exporter/config')),

  saveChatExporterConfig: async (body: Partial<{
    enabled: boolean;
    frequency: 'hourly' | 'daily' | 'weekly';
    time: string;
    timezone: string;
    authType: 'user' | 'bot';
    importDir: string;
    channelId: string;
    after: string;
    token: string;
    clearToken: boolean;
  }>) => parseChatExporterConfig(await apiFetch<unknown>('/chat-exporter/config', { method: 'PUT', body: JSON.stringify(body) })),

  validateChatExporterToken: async (token: string, authType: 'user' | 'bot') =>
    parseChatExporterValidateTokenResult(await apiFetch<unknown>('/chat-exporter/validate-token', { method: 'POST', body: JSON.stringify({ token, authType }) })),

  testChatExporterConfig: async () =>
    parseChatExporterTestResult(await apiFetch<unknown>('/chat-exporter/test', { method: 'POST' })),

  runChatExporterNow: async () =>
    parseChatExporterRunResult(await apiFetch<unknown>('/chat-exporter/run', { method: 'POST' })),

  getChatExporterProfiles: async () =>
    parseChatExporterProfiles(await apiFetch<unknown>('/chat-exporter/profiles')),

  createChatExporterProfile: async (body: ChatExporterProfileInput) =>
    parseChatExporterProfile(await apiFetch<unknown>('/chat-exporter/profiles', { method: 'POST', body: JSON.stringify(body) })),

  updateChatExporterProfile: async (id: string, body: ChatExporterProfileInput) =>
    parseChatExporterProfile(await apiFetch<unknown>(`/chat-exporter/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  deleteChatExporterProfile: (id: string) =>
    apiFetch<void>(`/chat-exporter/profiles/${id}`, { method: 'DELETE' }),

  testChatExporterProfile: async (id: string) =>
    parseChatExporterTestResult(await apiFetch<unknown>(`/chat-exporter/profiles/${id}/test`, { method: 'POST' })),

  runChatExporterProfile: async (id: string) =>
    parseChatExporterRunResult(await apiFetch<unknown>(`/chat-exporter/profiles/${id}/run`, { method: 'POST' })),

  getChatExporterProfileDelta: async (id: string) =>
    parseChatExporterDelta(await apiFetch<unknown>(`/chat-exporter/profiles/${id}/delta`)),

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

  getMessages: async (params?: { source_id?: string; status?: DiscordImportMessageStatus; limit?: number; offset?: number } & DiscordFetchWindow, options?: { signal?: AbortSignal }) => {
    const qs = new URLSearchParams();
    if (params?.source_id) qs.set('source_id', params.source_id);
    if (params?.status) qs.set('status', params.status);
    if (params?.since) qs.set('since', params.since);
    if (params?.until) qs.set('until', params.until);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    return parseDiscordMessages(await apiFetch<unknown>(`/messages?${qs}`, { signal: options?.signal }));
  },

  updateMessage: async (id: string, body: { status: DiscordImportMessageStatus }) =>
    parseDiscordMessage(await apiFetch<unknown>(`/messages/${id}`, { method: 'PATCH', body: JSON.stringify(body) })),

  updateMessagesBatch: async (ids: string[], status: DiscordImportMessageStatus) =>
    parseBatchResult(await apiFetch<unknown>('/messages/batch', { method: 'PATCH', body: JSON.stringify({ ids, status }) })),

  parseMessage: (id: string) =>
    apiFetch<DiscordDraft>(`/messages/${id}/parse`, { method: 'POST' }),

  diagnoseMessageContent: (id: string) =>
    apiFetch<DiscordMessageContentDiagnostic>(`/messages/${id}/diagnose-content`, { method: 'POST' }),

  getDrafts: (params?: { status?: DiscordImportDraftStatus; limit?: number; offset?: number; origin?: 'discord' | 'inbox' | 'all' }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.origin) qs.set('origin', params.origin);
    return apiFetch<DiscordDraft[]>(`/drafts?${qs}`);
  },

  getDraft: (id: string) =>
    apiFetch<DiscordDraft>(`/drafts/${id}`),

  updateDraftsBatch: async (ids: string[], status: 'draft' | 'needs_review' | 'rejected') =>
    parseBatchResult(await apiFetch<unknown>('/drafts/batch', { method: 'PATCH', body: JSON.stringify({ ids, status }) })),

  // Apaga definitivamente todos os drafts descartados (status='rejected').
  purgeRejectedDrafts: async (origin: 'discord' | 'inbox' | 'all' = 'all') =>
    parseDeletedResult(await apiFetch<unknown>(`/drafts/rejected?origin=${origin}`, { method: 'DELETE' })),

  updateDraft: (id: string, body: { normalized_payload?: Record<string, unknown>; status?: DiscordImportDraftStatus; review_notes?: string }) =>
    apiFetch<DiscordDraft>(`/drafts/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  submitCorrection: (id: string, body: { corrections: Record<string, unknown>; reason?: string; before?: Record<string, unknown> }) =>
    apiFetch<{ draft_id: string; fields_corrected: number; diff: Record<string, { before: unknown; after: unknown }> }>(`/drafts/${id}/correction`, { method: 'POST', body: JSON.stringify(body) }),

  syncDraft: (id: string) =>
    apiFetch<{ tableId: string; created: boolean }>(`/drafts/${id}/sync`, { method: 'POST' }),

  reparseDraft: (id: string) =>
    apiFetch<DiscordDraft>(`/drafts/${id}/reparse`, { method: 'POST' }),

  refreshDraftImage: (id: string) =>
    apiFetch<{ draftId: string; tableId: string | null; status: string; url: string | null; error: string | null }>(`/drafts/${id}/refresh-image`, { method: 'POST' }),

  syncReady: () =>
    apiFetch<SyncReadyResult>('/sync-ready', { method: 'POST' }),

  reingestForce: (sourceId: string, body?: DiscordFetchWindow) =>
    apiFetch<IngestResult & { deleted: number }>(`/sources/${sourceId}/reingest-force`, { method: 'POST', body: JSON.stringify(body ?? {}) }),

  parseBatch: () =>
    apiFetch<{ processed: number; succeeded: number; discarded: number; ignored: number; failed: number }>('/messages/parse-batch', { method: 'POST' }),

  importJson: async (json: unknown) => {
    const data = await apiFetch<unknown>('/import-json', { method: 'POST', body: JSON.stringify(json) });
    return parseImportResult(data);
  },

  previewJson: async (json: unknown) => {
    const data = await apiFetch<unknown>('/import-json/preview', { method: 'POST', body: JSON.stringify(json) });
    return parsePreviewResult(data);
  },

  getIntegrationMetrics: async () =>
    parseIntegrationMetrics(await apiFetch<unknown>('/metrics')),

  previewFile: async (file: File) =>
    fileApiFetch('/import-json/preview/file', file, parsePreviewResult, 'analisar arquivo'),

  importFile: async (file: File) =>
    fileApiFetch('/import-json/file', file, parseImportResult, 'importar arquivo'),
};
