/** Frontend: respostas do Discord Sync API. Discord-only — inbox tem API própria. */
export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json';
export type DiscordSourceChannelType = 'text' | 'announcement' | 'forum';
export type DiscordImportMessageStatus = 'pending' | 'parsed' | 'needs_review' | 'synced' | 'ignored' | 'error';
export type DiscordImportDraftStatus = 'draft' | 'ready' | 'needs_review' | 'synced' | 'rejected';

/** Log de rodada de importação (entidade discord_import_runs). Datas como string ISO. */
export interface DiscordImportRun {
  id: string;
  source_kind: string;
  started_at: string;
  ended_at: string | null;
  total_messages: number;
  drafts_created: number;
  drafts_updated: number;
  messages_ignored: number;
  messages_failed: number;
  note: string | null;
  created_by: string | null;
}

export interface DiscordIntegrationMetrics {
  runs: DiscordImportRun[];
  totals: {
    corrections: number;
    drafts: number;
    ready: number;
    needs_review: number;
    synced: number;
    rejected: number;
  };
  top_corrected_fields: Array<{ field: string; count: number }>;
}

export interface DiscordSource {
  id: string;
  guild_id: string;
  channel_id: string;
  channel_name: string | null;
  channel_type: DiscordSourceChannelType;
  enabled: boolean;
  auto_sync_enabled: boolean;
  last_message_id: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscordDiscoveredGuild {
  id: string;
  name: string;
  icon: string | null;
  approximate_member_count: number | null;
}

export interface DiscordDiscoveredChannel {
  id: string;
  guild_id: string;
  name: string;
  type: number;
  kind: DiscordSourceChannelType;
  position: number | null;
  parent_id: string | null;
  parent_name: string | null;
}

export interface DiscordMessage {
  id: string;
  source_id: string;
  discord_message_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  discord_parent_channel_id: string | null;
  discord_thread_id: string | null;
  discord_thread_name: string | null;
  discord_author_id: string | null;
  discord_author_name: string | null;
  discord_message_url: string | null;
  content_raw: string;
  attachments: unknown[];
  embeds: unknown[];
  message_created_at: string | null;
  message_edited_at: string | null;
  content_hash: string;
  source_kind: DiscordImportSourceKind;
  status: DiscordImportMessageStatus;
  parse_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface DiscordSlotsAmbiguity {
  first: number;
  second: number;
  source: 'x_slash_y';
}

export type DiscordCoverQuality = 'standard' | 'low';

export interface DiscordDraftTablePayload extends Record<string, unknown> {
  title?: string | null;
  description?: string | null;
  system_id?: string | null;
  system_name?: string | null;
  raw_system_hint?: string | null;
  type?: string | null;
  modality?: string | null;
  price_type?: string | null;
  price_value?: number | null;
  slots_total?: number | null;
  slots_filled?: number | null;
  slots_open?: number | null;
  day_of_week?: string | null;
  start_time?: string | null;
  frequency?: string | null;
  contact_url?: string | null;
  contact_discord?: string | null;
  host_discord_id?: string | null;
  cover_url?: string | null;
  cover_url_source?: string | null;
  cover_quality?: DiscordCoverQuality | null;
  _slots_ambiguity?: DiscordSlotsAmbiguity | null;
  /** DEB-048-29: anúncio ambíguo p/ sistema autoral → badge "autoral?" na revisão. */
  _homebrew_suspect?: boolean | null;
}

export interface DiscordDraftPayload extends Record<string, unknown> {
  kind?: unknown;
  source?: Record<string, unknown>;
  table?: DiscordDraftTablePayload;
  confidence?: unknown;
  missing_fields?: unknown;
}

export interface DiscordDraft {
  id: string;
  discord_message_id: string | null;
  import_message_id?: string | null;
  table_id: string | null;
  parsed_payload: DiscordDraftPayload;
  normalized_payload: DiscordDraftPayload | null;
  confidence: number | null;
  status: DiscordImportDraftStatus;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface IngestResult {
  inserted: number;
  updated: number;
  total: number;
  newestMessageId: string | null;
  threadsScanned: number;
  sourceKind: DiscordSourceChannelType;
  parse?: {
    processed: number;
    succeeded: number;
    discarded?: number;
    ignored: number;
    failed: number;
  };
}

export interface DiscordFetchWindow {
  since?: string;
  until?: string;
}

export interface DiscordMessageContentDiagnostic {
  discord_message_id: string;
  discord_channel_id: string;
  discord_thread_name: string | null;
  db_content_length: number;
  api_content_length: number;
  api_attachments_count: number;
  api_embeds_count: number;
  api_content_preview: string;
  likely_missing_message_content_intent: boolean;
  diagnosis: string;
}

export interface SyncReadyResult {
  synced: number;
  failed: number;
  errors: string[];
}

export interface DiscordBotTokenSettings {
  is_set: boolean;
  preview: string | null;
  updated_at: string | null;
}

export interface DiscordSettings {
  bot_token: DiscordBotTokenSettings;
}

export type ChatExporterFrequency = 'hourly' | 'daily' | 'weekly';
export type ChatExporterIncludeThreads = 'none' | 'active' | 'all';
export type ChatExporterAuthType = 'global' | 'user' | 'bot';
export type ChatExporterGlobalAuthType = 'user' | 'bot';

export interface ChatExporterSecretStatus {
  is_set: boolean;
  preview: string | null;
  updated_at: string | null;
}

export interface ChatExporterConfig {
  enabled?: boolean;
  authType?: ChatExporterGlobalAuthType;
  frequency?: ChatExporterFrequency;
  time?: string;
  timezone?: string;
  importDir?: string;
  channelId?: string;
  after?: string;
  token: ChatExporterSecretStatus;
  updated_at: string | null;
  decrypt_error?: boolean;
}

export interface ChatExporterProfile {
  id: string;
  label: string;
  guild_id: string;
  guild_name: string | null;
  channel_id: string;
  channel_name: string | null;
  format: 'Json';
  auth_type: ChatExporterAuthType;
  include_threads: ChatExporterIncludeThreads;
  after: string | null;
  media: boolean;
  schedule_enabled: boolean;
  frequency: ChatExporterFrequency;
  time: string;
  timezone: string;
  import_dir: string;
  enabled: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  token: ChatExporterSecretStatus;
}

export interface ChatExporterProfileInput {
  label?: string;
  guild_id?: string;
  guild_name?: string | null;
  channel_id?: string;
  channel_name?: string | null;
  auth_type?: ChatExporterAuthType;
  token?: string;
  include_threads?: ChatExporterIncludeThreads;
  after?: string;
  media?: boolean;
  schedule_enabled?: boolean;
  frequency?: ChatExporterFrequency;
  time?: string;
  timezone?: string;
  enabled?: boolean;
  clearToken?: boolean;
}

export interface ChatExporterTestResult {
  ok: boolean;
  errors: string[];
  command: string | null;
}

export interface ChatExporterRunResult {
  exported: { outputPath: string };
  imported: {
    rootDir: string;
    incoming: number;
    processed: number;
    errors: number;
    retainedDeleted: number;
    files: Array<{ fileName: string; status: 'processed' | 'error'; error?: string }>;
  };
}

export interface ChatExporterDelta {
  /** Mensagens novas no canal desde a última importada (limitado a uma página). */
  newCount: number;
  /** true = página cheia; há pelo menos `newCount` novas (pode ser mais). */
  capped: boolean;
  afterMessageId: string | null;
}

export interface DraftApiOperations {
  updateDraft: (id: string, body: { normalized_payload?: Record<string, unknown>; status?: DiscordImportDraftStatus; review_notes?: string }) => Promise<DiscordDraft>;
  syncDraft: (id: string) => Promise<{ tableId: string; created: boolean }>;
  reparseDraft: (id: string) => Promise<DiscordDraft>;
  refreshDraftImage?: (id: string) => Promise<{ draftId: string; tableId: string | null; status: string; url: string | null; error: string | null }>;
  getDraft?: (id: string) => Promise<DiscordDraft>;
  submitCorrection?: (id: string, body: { corrections: Record<string, unknown>; reason?: string; before?: Record<string, unknown> }) => Promise<unknown>;
}
