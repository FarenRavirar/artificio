export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json';
export type DiscordSourceChannelType = 'text' | 'announcement' | 'forum';

export type DiscordImportMessageStatus =
  | 'pending'
  | 'parsed'
  | 'needs_review'
  | 'synced'
  | 'ignored'
  | 'error';

export type DiscordImportDraftStatus =
  | 'draft'
  | 'ready'
  | 'needs_review'
  | 'synced'
  | 'rejected';

export type TableDraftType = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
export type TableDraftModality = 'online' | 'presencial' | 'hibrida';
export type TableDraftPriceType = 'gratuita' | 'paga';
export type TableDraftFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa';
export type CoverQuality = 'standard' | 'low';
export type DiscordImageUploadStatus =
  | 'pending'
  | 'success'
  | 'expired_url'
  | 'network'
  | 'cloudinary'
  | 'permanent_fail';
export type SlotsAmbiguitySource = 'x_slash_y';

export interface DiscordSlotsAmbiguity {
  first: number;
  second: number;
  source: SlotsAmbiguitySource;
}

export interface DiscordTableDraftSource {
  guild_id: string;
  channel_id: string;
  message_id: string;
  message_url: string;
  author_id?: string;
  author_name?: string;
}

export interface DiscordTableDraftTable {
  title: string | null;
  system_name: string | null;
  system_id: string | null;
  /**
   * Texto bruto extraído do nome do thread antes do ":" que o parser
   * tentou resolver como sistema mas não encontrou correspondência no banco.
   * Usado para criar system_suggestion automática e mostrar ao revisor
   * o que chegou do Discord antes de qualquer normalização.
   */
  raw_system_hint: string | null;
  type: TableDraftType | null;
  modality: TableDraftModality | null;
  price_type: TableDraftPriceType | null;
  price_value: number | null;
  slots_total: number | null;
  slots_filled: number | null;
  slots_open: number | null;
  day_of_week: string | null;
  start_time: string | null;
  frequency: TableDraftFrequency | null;
  description: string | null;
  contact_discord: string | null;
  contact_url: string | null;
  host_discord_id: string | null;
  cover_url: string | null;
  cover_url_source: string | null;
  cover_quality: CoverQuality | null;
  _slots_ambiguity: DiscordSlotsAmbiguity | null;
  _notes: string[];
}

export interface DiscordTableDraft {
  source: DiscordTableDraftSource;
  table: DiscordTableDraftTable;
  confidence: number;
  missing_fields: string[];
}

/** Mensagem normalizada independente da origem (bot ou ChatExporter). */
export interface DiscordRawMessage {
  source_kind: DiscordImportSourceKind;
  discord_message_id: string;
  discord_channel_id: string;
  discord_guild_id: string;
  discord_parent_channel_id?: string | null;
  discord_thread_id?: string | null;
  discord_thread_name?: string | null;
  discord_author_id: string | null;
  discord_author_name: string | null;
  discord_message_url: string | null;
  content_raw: string;
  attachments: unknown[];
  embeds: unknown[];
  message_created_at: Date | null;
  message_edited_at: Date | null;
}
