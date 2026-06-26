import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';
import type { ChangelogEntry } from '@artificio/changelog';

export type UserRole = 'visitor' | 'player' | 'gm' | 'admin';
export type SystemNodeType = 'system' | 'edition' | 'variant' | 'subsystem';
export type AuthProvider = 'google' | 'discord';
export type ExperienceLevelPlayer = 'iniciante' | 'intermediario' | 'veterano';
export type PreferredTime = 'manha' | 'tarde' | 'noite';
export type PricingPreference = 'free' | 'paid' | 'both';
export type UserSystemType = 'favorite' | 'gm';

export interface UsersTable {
  id: Generated<string>;
  google_id: string;
  email: string;
  username: string | null;
  location: string | null;
  role: Generated<UserRole>;
  refresh_token: string | null;
  privacy_public: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type UserUpdate = Updateable<UsersTable>;

export interface AuthProvidersTable {
  id: Generated<string>;
  user_id: string;
  provider: AuthProvider;
  provider_user_id: string;
  provider_data: unknown | null;
  created_at: Generated<Date>;
}

export type AuthProvider_Record = Selectable<AuthProvidersTable>;
export type NewAuthProvider = Insertable<AuthProvidersTable>;
export type AuthProviderUpdate = Updateable<AuthProvidersTable>;

export interface ProfilesTable {
  id: Generated<string>;
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  languages: Generated<string[]>;
  tags: Generated<string[]>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type Profile = Selectable<ProfilesTable>;
export type NewProfile = Insertable<ProfilesTable>;

export interface UserPreferencesTable {
  id: Generated<string>;
  user_id: string;
  systems: Generated<string[]>;
  tags: Generated<string[]>;
  languages: Generated<string[]>;
  platforms: Generated<string[]>;
  weekdays: Generated<number[]>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type UserPreference = Selectable<UserPreferencesTable>;
export type NewUserPreference = Insertable<UserPreferencesTable>;
export type UserPreferenceUpdate = Updateable<UserPreferencesTable>;

export interface PlayerProfilesTable {
  user_id: string;
  experience_level: ExperienceLevelPlayer | null;
  playstyle: unknown | null; // JSONB: { combat: number, roleplay: number, exploration: number, strategy: number }
  preferred_days: string[] | null;
  preferred_time: PreferredTime | null;
  pricing_preference: PricingPreference | null;
  updated_at: Generated<Date>;
}

export type PlayerProfile = Selectable<PlayerProfilesTable>;
export type NewPlayerProfile = Insertable<PlayerProfilesTable>;
export type PlayerProfileUpdate = Updateable<PlayerProfilesTable>;

export interface UserSystemsTable {
  id: Generated<string>;
  user_id: string;
  system_id: string;
  type: UserSystemType;
  created_at: Generated<Date>;
}

export type UserSystem = Selectable<UserSystemsTable>;
export type NewUserSystem = Insertable<UserSystemsTable>;
export type UserSystemUpdate = Updateable<UserSystemsTable>;

export interface GmProfilesTable {
  id: Generated<string>;
  user_id: string;
  slug: string;
  nickname: string | null;
  bio_long: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  languages: Generated<string[]>;
  specialties: Generated<string[]>;
  badges: Generated<string[]>;
  tables_count: Generated<number>;
  avg_rating: number | null;
  reviews_count: Generated<number>;
  // Discord
  discord_connected: Generated<boolean>;
  discord_username: string | null;
  discord_id: string | null;
  // Selo Covil (controlado por admin)
  covil_verified: Generated<boolean>;
  covil_verified_at: Date | null;
  covil_verified_by: string | null;
  // Experiência e monetização
  experience_years: number | null;
  average_price: number | null;
  // Estilo de mestria (JSONB)
  gm_style: unknown | null; // { narrative: number, tactical: number, sandbox: number, railroad: number }
  tools: unknown | null; // string[] - ["Foundry VTT", "Discord", "Roll20"]
  game_format: unknown | null; // { session_length: string, frequency: string, group_size: string }
  // Perfil público v2
  tagline: string | null;
  promo_badge_text: string | null;
  selling_points: unknown; // JSONB: Array<{ icon, title, description, highlight? }>
  closed_group_enabled: Generated<boolean>;
  closed_group_systems: Generated<string[]>; // UUID[]
  closed_group_description: string | null;
  closed_group_min_price_cents: number | null;
  preferred_vtt_platforms: Generated<string[]>; // UUID[] - VTT platforms que o mestre usa/prefere
  contact_methods: unknown; // JSONB - Array<{ channel: string, value: string, label?: string, discord_server_url?: string }>
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type GmProfile = Selectable<GmProfilesTable>;
export type NewGmProfile = Insertable<GmProfilesTable>;
export type GmProfileUpdate = Updateable<GmProfilesTable>;

export interface SystemsTable {
  id: Generated<string>;
  name: string;
  name_pt: string | null;
  slug: string;
  description: string | null;
  parent_id: string | null;
  node_type: Generated<SystemNodeType>;
  depth: Generated<number>;
  path_slug: string | null;
  logo_filename: string | null;
  website_url: string | null;
  created_at: Generated<Date>;
}

export interface SystemAliasesTable {
  id: Generated<string>;
  system_id: string;
  alias: string;
  alias_slug: string;
  is_official: Generated<boolean>;
  created_at: Generated<Date>;
}

export interface TagsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  created_at: Generated<Date>;
}

export interface PlatformsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  created_at: Generated<Date>;
}

export interface ScenariosTable {
  id: Generated<string>;
  name: string;
  name_pt: string | null;
  slug: string;
  description: string | null; // Migration 107
  subgenres: Generated<string[]>;
  created_at: Generated<Date>;
}

export type Scenario = Selectable<ScenariosTable>;
export type NewScenario = Insertable<ScenariosTable>;
export type ScenarioUpdate = Updateable<ScenariosTable>;

// Scenario Aliases (Migration 107)
export interface ScenarioAliasesTable {
  id: Generated<string>;
  scenario_id: string;
  alias: string;
  alias_slug: string;
  is_official: Generated<boolean>;
  created_at: Generated<Date>;
}

export type ScenarioAlias = Selectable<ScenarioAliasesTable>;
export type NewScenarioAlias = Insertable<ScenarioAliasesTable>;
export type ScenarioAliasUpdate = Updateable<ScenarioAliasesTable>;


export type TableStatus = 'draft' | 'active' | 'full' | 'cancelled' | 'ended' | 'pending_review';
export type TableType = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
export type TableAudience = 'livre' | 'adultos';
export type TableModality = 'online' | 'presencial' | 'hibrida';
export type PriceType = 'gratuita' | 'paga';
export type PriceFrequency = 'sessao' | 'mes' | 'campanha';
export type ExperienceLevel = 'todos' | 'iniciante' | 'intermediario' | 'veterano';
export type PublisherRole = 'gm' | 'announcer';
export type TableContactChannel = 'whatsapp' | 'discord' | 'phone' | 'email' | 'facebook' | 'instagram' | 'form';
export type TableOrigin = 'manual' | 'imported';


export interface TablesTable {
  id: Generated<string>;
  slug: string;
  gm_id: string | null;
  system_id: string | null;
  scenario_id: string | null;
  custom_scenario: string | null;
  title: string;
  description: string | null;
  cover_url: string | null;
  status: Generated<TableStatus>;
  type: TableType;
  audience: Generated<TableAudience>;
  age_rating: 'livre' | '10+' | '12+' | '14+' | '16+' | '18+' | null;
  modality: Generated<TableModality>;
  // VTT Platform (Migration 006)
  vtt_platform_id: string | null; // Referência à vtt_platforms
  game_platform_custom: string | null; // Texto livre quando seleciona "Personalizado"
  game_platform_legacy: string | null; // Backup do campo antigo
  game_platform: string | null; // DEPRECATED: Manter por compatibilidade temporária
  communication_platform_id: string | null; // Referência à communication_platforms (Migration 105)
  communication_platform: string | null; // DEPRECATED: fallback legado de texto livre
  price_type: Generated<PriceType>;
  price_value: number | null;
  price_frequency: PriceFrequency | null;
  slots_total: Generated<number>;
  slots_filled: Generated<number>;
  slots_open: Generated<number>; // REQ-02: Vagas abertas para recrutamento
  language: Generated<string>;
  experience_level: Generated<ExperienceLevel>;
  table_level: 'iniciante' | 'intermediario' | 'avancado' | null;
  starts_at: Date | null;
  schedule_day_status: Generated<ScheduleDefinitionStatus>;
  schedule_time_status: Generated<ScheduleDefinitionStatus>;
  schedule_day_hint: DayOfWeek | null;
  schedule_time_hint: string | null;
  city: string | null;
  state: string | null;
  content_warnings: Generated<string[]>;
  safety_tools: Generated<string[]>;
  source_url: string | null;
  source_id: string | null;
  origin: Generated<TableOrigin>;
  featured: Generated<boolean>;
  publisher_role: Generated<PublisherRole>;
  actual_gm_name: string | null;
  is_ddal: Generated<boolean>;
  ddal_code: string | null;
  ddal_name: string | null;
  ddal_tier: number | null;
  ddal_season: string | null;
  ddal_duration: string | null;
  ddal_format: string | null;
  ddal_org_code: string | null;
  ddal_setting: string | null;
  ddal_rules_notes: string | null;
  is_covil: Generated<boolean>;
  imported_expires_at: Date | null;
  rules_notes: string | null;
  banner_url: string | null;
  banner_crop_data: { x: number; y: number; width: number; height: number } | null;
  master_display_name: string | null;
  campaign_length: string | null;
  level_range: string | null;
  billing_text: string | null;
  session_zero_free: Generated<boolean>;
  synopsis: string | null;
  style_text: string | null;
  listing_excerpt: string | null;
  technical_requirements: string | null;
  requires_pc: Generated<boolean>;
  requires_camera: Generated<boolean>;
  requires_microphone: Generated<boolean>;
  setting_name: string | null;
  setting_styles: string[] | null;
  style_tags: string[] | null;
  synopsis_narrative: string | null;
  benefits_text: string | null;
  features: unknown; // JSONB: string[]
  table_gm_bio: string | null;
  archived_at: Date | null;
  published_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TableContactsTable {
  id: Generated<string>;
  table_id: string;
  channel: TableContactChannel;
  value: string;
  label: string | null;
  discord_server_url: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export type DayOfWeek = 'segunda' | 'terça' | 'quarta' | 'quinta' | 'sexta' | 'sábado' | 'domingo';
export type ScheduleFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa';
export type ScheduleDefinitionStatus = 'defined' | 'to_define';

export interface TableSchedulesTable {
  id: Generated<string>;
  table_id: string;
  day_of_week: DayOfWeek;
  start_time: string; // TIME stored as string "HH:MM:SS"
  end_time: string | null;
  frequency: ScheduleFrequency;
  slots_per_session: number | null;
  is_ongoing: Generated<boolean>;
  notes: string | null;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
}

export type TableSchedule = Selectable<TableSchedulesTable>;
export type NewTableSchedule = Insertable<TableSchedulesTable>;
export type TableScheduleUpdate = Updateable<TableSchedulesTable>;

export interface SettingStyleSuggestionsTable {
  id: Generated<string>;
  setting_name: string;
  suggested_styles: string[];
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type SettingStyleSuggestion = Selectable<SettingStyleSuggestionsTable>;
export type NewSettingStyleSuggestion = Insertable<SettingStyleSuggestionsTable>;
export type SettingStyleSuggestionUpdate = Updateable<SettingStyleSuggestionsTable>;



export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface SystemSuggestionsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  name_pt: string | null;
  node_type: SystemNodeType;
  parent_id: string | null;
  description: string | null;
  aliases: string[] | null;
  status: Generated<SuggestionStatus>;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  user_notified: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  // Migration 123 - auditoria de resolucao (Spec 018)
  resolution_type: SuggestionResolutionType | null;
  resolved_system_id: string | null;
  created_system_id: string | null;
  created_alias_id: string | null;
  resolution_notes: string | null;
  resolution_payload: Generated<unknown>; // JSONB
  resolved_at: Date | null;
}

export type SuggestionResolutionType =
  | 'create_system'
  | 'create_child'
  | 'create_alias'
  | 'merge_existing'
  | 'reject';

export type SystemSuggestion = Selectable<SystemSuggestionsTable>;
export type NewSystemSuggestion = Insertable<SystemSuggestionsTable>;
export type SystemSuggestionUpdate = Updateable<SystemSuggestionsTable>;

export interface ScenarioSuggestionsTable {
  id: Generated<string>;
  user_id: string;
  name: string;
  name_pt: string | null;
  description: string | null;
  aliases: string[] | null;
  subgenres: Generated<string[]>; // Migration 107
  status: Generated<SuggestionStatus>;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  rejection_reason: string | null;
  user_notified: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ScenarioSuggestion = Selectable<ScenarioSuggestionsTable>;
export type NewScenarioSuggestion = Insertable<ScenarioSuggestionsTable>;
export type ScenarioSuggestionUpdate = Updateable<ScenarioSuggestionsTable>;

// Migration 125: Feedback de desenvolvimento (Spec 022)
export type DevFeedbackKind = 'bug' | 'suggestion';
export type DevFeedbackStatus =
  | 'new' | 'triaged' | 'in_progress' | 'resolved' | 'wont_fix' | 'duplicate';

export interface DevFeedbackTable {
  id: Generated<string>;
  user_id: string | null;
  reporter_role: string | null;
  contact_email: string | null;
  kind: DevFeedbackKind;
  title: string;
  description: string;
  page_url: string | null;
  route_path: string | null;
  page_title: string | null;
  environment: string | null;
  user_agent: string | null;
  viewport: string | null;
  console_errors: ColumnType<unknown[], string, string>;
  network_errors: ColumnType<unknown[], string, string>;
  screenshot_url: string | null;
  status: Generated<DevFeedbackStatus>;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  // Migration 126 (Spec 024): triagem
  archived_at: Date | null;
  screenshot_public_id: string | null;
  merged_into: string | null;
  merged_sources: ColumnType<unknown[], string | undefined, string>;
}

export type DevFeedback = Selectable<DevFeedbackTable>;
export type NewDevFeedback = Insertable<DevFeedbackTable>;
export type DevFeedbackUpdate = Updateable<DevFeedbackTable>;

export type NotificationType =
  | 'suggestion_approved' | 'suggestion_rejected' | 'suggestion_edited' | 'system'
  | 'system_suggestion' | 'scenario_suggestion' | 'table_published' | 'member_joined'
  | 'dev_feedback';

export interface NotificationsTable {
  id: Generated<string>;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  action_url: string | null; // Migration 106
  metadata: Generated<unknown>; // Migration 106 - JSONB
  read: Generated<boolean>;
  created_at: Generated<Date>;
}

export type Notification = Selectable<NotificationsTable>;
export type NewNotification = Insertable<NotificationsTable>;
export type NotificationUpdate = Updateable<NotificationsTable>;

export interface ActivityLogTable {
  id: Generated<string>;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_label: string | null;
  target_user_id: string | null;
  summary: string;
  metadata: ColumnType<Record<string, unknown>, string, string>;
  created_at: Generated<Date>;
}

export interface UserLinksTable {
  id: Generated<string>;
  user_id: string;
  url: string;
  type: string;
  title: string | null;
  description: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  metadata_status: Generated<'pending' | 'success' | 'failed' | 'stale'>;
  metadata_fetched_at: Date | null;
  metadata_last_accessed_at: Generated<Date>;
  metadata_fail_count: Generated<number>;
  metadata_next_retry_at: Date | null;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type UserLinks = Selectable<UserLinksTable>;
export type NewUserLink = Insertable<UserLinksTable>;
export type UserLinkUpdate = Updateable<UserLinksTable>;

// VTT Platforms (Migration 006)
export interface VttPlatformsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type VttPlatform = Selectable<VttPlatformsTable>;
export type NewVttPlatform = Insertable<VttPlatformsTable>;
export type VttPlatformUpdate = Updateable<VttPlatformsTable>;

// GM Preferred VTT Platforms (Migration 109) - Tabela de junção
export interface GmPreferredVttPlatformsTable {
  id: Generated<string>;
  gm_profile_id: string;
  vtt_platform_id: string;
  created_at: Generated<Date>;
}

export type GmPreferredVttPlatform = Selectable<GmPreferredVttPlatformsTable>;
export type NewGmPreferredVttPlatform = Insertable<GmPreferredVttPlatformsTable>;

// Communication Platforms (Migration 105)
export interface CommunicationPlatformsTable {
  id: Generated<string>;
  name: string;
  slug: string;
  website_url: string | null;
  is_active: Generated<boolean>;
  sort_order: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type CommunicationPlatform = Selectable<CommunicationPlatformsTable>;
export type NewCommunicationPlatform = Insertable<CommunicationPlatformsTable>;
export type CommunicationPlatformUpdate = Updateable<CommunicationPlatformsTable>;

export type VttSuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface VttPlatformSuggestionsTable {
  id: Generated<string>;
  suggested_name: string;
  suggested_by_user_id: string;
  table_id: string | null;
  status: Generated<VttSuggestionStatus>;
  admin_notes: string | null;
  created_at: Generated<Date>;
  reviewed_at: Date | null;
  reviewed_by_user_id: string | null;
}

export type VttPlatformSuggestion = Selectable<VttPlatformSuggestionsTable>;
export type NewVttPlatformSuggestion = Insertable<VttPlatformSuggestionsTable>;
export type VttPlatformSuggestionUpdate = Updateable<VttPlatformSuggestionsTable>;

// Migration 115: Pipeline de importação Discord/Covil
/** DB/Kysely: coluna discord_import_messages.source_kind. Discord-only — não inclui 'manual_paste' (inbox vai para import_messages.source_type). */
export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json';
export type DiscordSourceChannelType = 'text' | 'announcement' | 'forum';
export type DiscordImportMessageStatus = 'pending' | 'parsed' | 'needs_review' | 'synced' | 'ignored' | 'error';
export type DiscordImportDraftStatus = 'draft' | 'ready' | 'needs_review' | 'synced' | 'rejected';
export type DiscordImageUploadStatus =
  | 'pending'
  | 'success'
  | 'expired_url'
  | 'network'
  | 'cloudinary'
  | 'permanent_fail';

export interface DiscordImportSourcesTable {
  id: Generated<string>;
  guild_id: string;
  channel_id: string;
  channel_name: string | null;
  channel_type: Generated<DiscordSourceChannelType>;
  enabled: Generated<boolean>;
  auto_sync_enabled: Generated<boolean>;
  last_message_id: string | null;
  last_synced_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DiscordImportSource = Selectable<DiscordImportSourcesTable>;
export type NewDiscordImportSource = Insertable<DiscordImportSourcesTable>;
export type DiscordImportSourceUpdate = Updateable<DiscordImportSourcesTable>;

export interface DiscordImportMessagesTable {
  id: Generated<string>;
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
  attachments: Generated<unknown[]>;
  embeds: Generated<unknown[]>;
  message_created_at: Date | null;
  message_edited_at: Date | null;
  content_hash: string;
  source_kind: Generated<DiscordImportSourceKind>;
  status: Generated<DiscordImportMessageStatus>;
  parse_error: string | null;
  reference: { messageId: string; channelId?: string; guildId?: string } | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DiscordImportMessage = Selectable<DiscordImportMessagesTable>;
export type NewDiscordImportMessage = Insertable<DiscordImportMessagesTable>;
export type DiscordImportMessageUpdate = Updateable<DiscordImportMessagesTable>;

export interface DiscordImportTableDraftsTable {
  id: Generated<string>;
  discord_message_id: string | null;
  import_message_id: string | null;
  table_id: string | null;
  parsed_payload: unknown;
  normalized_payload: unknown | null;
  confidence: number | null;
  status: Generated<DiscordImportDraftStatus>;
  review_notes: string | null;
  image_upload_status: DiscordImageUploadStatus | null;
  image_upload_attempts: Generated<number>;
  image_upload_last_error: string | null;
  image_upload_last_at: Date | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DiscordImportTableDraft = Selectable<DiscordImportTableDraftsTable>;
export type NewDiscordImportTableDraft = Insertable<DiscordImportTableDraftsTable>;
export type DiscordImportTableDraftUpdate = Updateable<DiscordImportTableDraftsTable>;

// Migration 128: Inbox de importação de mesas
export interface ImportMessagesTable {
  id: Generated<string>;
  source_type: Generated<string>;
  raw_text: string | null;
  content_raw: string;
  thread_name: string | null;
  metadata: Generated<unknown | null>;
  content_hash: string;
  status: Generated<string>;
  parse_error: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type ImportMessage = Selectable<ImportMessagesTable>;
export type NewImportMessage = Insertable<ImportMessagesTable>;
export type ImportMessageUpdate = Updateable<ImportMessagesTable>;

// Migration 129: Corpus de treino do inbox
export interface ImportCorrectionsTable {
  id: Generated<string>;
  draft_id: string;
  import_message_id: string | null;
  raw_text: string | null;
  parsed_before: unknown;
  human_corrected: unknown;
  diff: unknown;
  reason: string | null;
  corrected_by: string | null;
  created_at: Generated<Date>;
}

export type ImportCorrection = Selectable<ImportCorrectionsTable>;
export type NewImportCorrection = Insertable<ImportCorrectionsTable>;
export type ImportCorrectionUpdate = Updateable<ImportCorrectionsTable>;

// Migration 116: Configuracoes cifradas do modulo Discord
export interface DiscordSettingsTable {
  id: Generated<string>;
  guild_id: string | null;
  key: string;
  value: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DiscordSetting = Selectable<DiscordSettingsTable>;
export type NewDiscordSetting = Insertable<DiscordSettingsTable>;
export type DiscordSettingUpdate = Updateable<DiscordSettingsTable>;

export interface Database {
  users: UsersTable;
  auth_providers: AuthProvidersTable;
  profiles: ProfilesTable;
  user_preferences: UserPreferencesTable;
  player_profiles: PlayerProfilesTable;
  user_systems: UserSystemsTable;
  gm_profiles: GmProfilesTable;
  systems: SystemsTable;
  system_aliases: SystemAliasesTable;
  system_suggestions: SystemSuggestionsTable;
  scenario_suggestions: ScenarioSuggestionsTable;
  notifications: NotificationsTable;
  activity_log: ActivityLogTable;
  tags: TagsTable;
  platforms: PlatformsTable;
  scenarios: ScenariosTable;
  scenario_aliases: ScenarioAliasesTable; // Migration 107
  tables: TablesTable;
  table_contacts: TableContactsTable;
  table_schedules: TableSchedulesTable;
  setting_style_suggestions: SettingStyleSuggestionsTable;

  user_links: UserLinksTable;
  table_metrics: TableMetricsTable;
  gm_profile_metrics: GmProfileMetricsTable;
  gm_profile_view_events: GmProfileViewEventsTable;
  table_metric_events: TableMetricEventsTable;
  table_click_events: TableClickEventsTable; // Migration 007: A/B testing

  // Benchmarks dinâmicos (Migration 113)
  benchmark_snapshots: BenchmarkSnapshotsTable;

  // VTT Platforms (Migration 006)
  vtt_platforms: VttPlatformsTable;
  vtt_platform_suggestions: VttPlatformSuggestionsTable;
  gm_preferred_vtt_platforms: GmPreferredVttPlatformsTable; // Migration 109

  // Communication Platforms (Migration 105)
  communication_platforms: CommunicationPlatformsTable;

  // Migration 17: Sistema de Changelog/Atualizações
  update_log: UpdateLogTable;

  // Migration 115: Pipeline de importação Discord/Covil
  discord_import_sources: DiscordImportSourcesTable;
  discord_import_messages: DiscordImportMessagesTable;
  discord_import_table_drafts: DiscordImportTableDraftsTable;

  // Migration 128: Inbox de importação de mesas (multi-origem)
  import_messages: ImportMessagesTable;

  // Migration 129: Corpus de treino do inbox
  import_corrections: ImportCorrectionsTable;

  // Migration 116: Configuracoes cifradas do modulo Discord
  discord_settings: DiscordSettingsTable;

  // Migration 125: Feedback de desenvolvimento (Spec 022)
  dev_feedback: DevFeedbackTable;
}

// Migration 16: Métricas de engajamento de mesas
export interface TableMetricsTable {
  id: Generated<number>;
  table_id: string;
  views_count: Generated<number>;
  clicks_count: Generated<number>;
  contacts_count: Generated<number>;
  favorites_count: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type TableMetrics = Selectable<TableMetricsTable>;
export type NewTableMetrics = Insertable<TableMetricsTable>;
export type TableMetricsUpdate = Updateable<TableMetricsTable>;

// Migration 113: Snapshots de benchmark dinâmico
export interface BenchmarkSnapshotsTable {
  id: Generated<number>;
  calculated_at: Generated<Date>;
  segment: Generated<string>;
  metric: string;
  p25: string | number;
  p50: string | number;
  p75: string | number;
  sample_size: number;
}

export type BenchmarkSnapshot = Selectable<BenchmarkSnapshotsTable>;
export type NewBenchmarkSnapshot = Insertable<BenchmarkSnapshotsTable>;
export type BenchmarkSnapshotUpdate = Updateable<BenchmarkSnapshotsTable>;

// Migration 108: Métricas de visualização do perfil público do mestre
export interface GmProfileMetricsTable {
  id: Generated<number>;
  gm_profile_id: string;
  views_count: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type GmProfileMetrics = Selectable<GmProfileMetricsTable>;
export type NewGmProfileMetrics = Insertable<GmProfileMetricsTable>;
export type GmProfileMetricsUpdate = Updateable<GmProfileMetricsTable>;

// Migration 108: Eventos de visualização do perfil público (dedupe por sessão)
export interface GmProfileViewEventsTable {
  id: Generated<number>;
  gm_profile_id: string;
  session_id: string;
  viewed_at: Generated<Date>;
}

export type GmProfileViewEvent = Selectable<GmProfileViewEventsTable>;
export type NewGmProfileViewEvent = Insertable<GmProfileViewEventsTable>;
export type GmProfileViewEventUpdate = Updateable<GmProfileViewEventsTable>;

// Migration 07: Eventos de métricas para anti-abuso
export type TableMetricAction = 'view' | 'click' | 'contact' | 'favorite';

export interface TableMetricEventsTable {
  id: Generated<string>;
  table_id: string;
  action: TableMetricAction;
  fingerprint_hash: string;
  created_at: Generated<Date>;
}

export type TableMetricEvent = Selectable<TableMetricEventsTable>;
export type NewTableMetricEvent = Insertable<TableMetricEventsTable>;
export type TableMetricEventUpdate = Updateable<TableMetricEventsTable>;

// Migration 007: Click events para A/B testing
export interface TableClickEventsTable {
  id: Generated<string>;
  table_id: string;
  variant: string | null; // 'with_metrics' ou 'without_metrics'
  clicked_at: Generated<Date>;
}

export type TableClickEvent = Selectable<TableClickEventsTable>;
export type NewTableClickEvent = Insertable<TableClickEventsTable>;
export type TableClickEventUpdate = Updateable<TableClickEventsTable>;

// Migration 17: Sistema de Changelog/Atualizações
export type UpdateLogType = ChangelogEntry['type'];

export interface UpdateLogTable {
  id: Generated<string>;
  title: string;
  body: string;
  type: UpdateLogType;
  published: Generated<boolean>;
  created_by: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type UpdateLog = Selectable<UpdateLogTable>;
export type NewUpdateLog = Insertable<UpdateLogTable>;
export type UpdateLogUpdate = Updateable<UpdateLogTable>;
