import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type DownloadEditorialState = 'draft' | 'in_review' | 'published' | 'rejected' | 'withdrawn';
export type DownloadAccessKind = 'external_link' | 'managed_upload';
export type DownloadCreatorRole = 'user' | 'publisher' | 'moderator' | 'admin';
export type DownloadReportPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type DownloadReportState = 'open' | 'in_review' | 'resolved' | 'dismissed';
// Spec 085 (emenda E1-E7, D-A) — origem do material deixa de ser enum
// fechado: registry vive em download_scraper_platform (banco), admin
// cadastra site novo sem deploy. Tipo hibrido mantem autocomplete/DX para
// as plataformas de seed conhecidas (literais abaixo), mas aceita
// qualquer slug cadastrado em runtime via `string & {}` — validacao real
// e sempre contra o registry (FK), nunca so contra o tipo. Trade-off
// aceito (D-A): perde exaustividade de switch; nenhum switch sobre este
// tipo existe hoje no backend, so Set.has/.includes, mas codigo novo que
// fizer switch precisa de `default` explicito.
export type KnownSourcePlatform =
  | 'manual'
  | 'itch_io'
  | 'drivethrurpg'
  | 'dms_guild'
  | 'rpg_gratis'
  | 'grimorios_e_dados'
  | 'opera_rpg'
  | 'catarse'
  | 'newton_rocha'
  | 'storytellersvault';
export type DownloadSourcePlatform = KnownSourcePlatform | (string & {});
export type DownloadScraperTriggerKind = 'manual' | 'cron' | 'local_ingest';
export type DownloadScraperRunStatus = 'running' | 'completed' | 'failed';
export type DownloadScraperItemOutcome = 'created' | 'skipped_duplicate' | 'skipped_not_portuguese' | 'skipped_error';

export type JSONColumnType<T> = ColumnType<T, T | undefined, T>;
// Achado real (review PR #203, CodeRabbit, P2): Zod não pode aceitar valor
// maior que a coluna PostgreSQL INTEGER comporta.
export const POSTGRES_INTEGER_MAX = 2_147_483_647;

export interface DownloadMaterialTable {
  id: Generated<string>;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  material_type: string;
  // Spec 086 Fase 5: referencia o vocabulario Central de tipos de material.
  // Sem FK SQL: Central vive no banco do Site e e acessado por API.
  material_type_id: string;
  system_id: string | null;
  edition_id: string | null;
  creator_id: string;
  editorial_state: Generated<DownloadEditorialState>;
  access_kind: Generated<DownloadAccessKind>;
  external_url: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  rejection_reason: string | null;
  rejection_category_id: string | null;
  auto_publish_enabled: Generated<boolean>;
  // Spec 084 — rastreabilidade de origem (scraper ou manual).
  source_platform: Generated<DownloadSourcePlatform>;
  source_url: string | null;
  source_scraped_at: Date | null;
  // Spec 084 (Fase 8) — resultado de detectPortuguese rodado no submit
  // (draft->in_review), persistido pra fila de moderação exibir sem
  // re-rodar detecção a cada GET /queue.
  detected_language: string | null;
  language_confident: boolean | null;
  language_checked_at: Date | null;
  // Spec 086 (Fase 4, migration_027) — texto bruto de sistema/regra quando o
  // scraper nao casa contra o catalogo central (equivalente a raw_system_hint
  // do apps/mesas). Material nunca perde essa informacao; limpo quando uma
  // download_system_suggestion e aprovada ou uma re-tentativa de match casa.
  raw_system_hint: string | null;
  // Spec 088 (migration_030) — simetrico ao raw_system_hint: texto bruto do
  // TIPO quando o hint da fonte nao casa contra a taxonomia central. Alimenta
  // a triagem admin; escrever no catalogo continua exclusivo dela.
  raw_material_type_hint: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadMaterial = Selectable<DownloadMaterialTable>;
export type NewDownloadMaterial = Insertable<DownloadMaterialTable>;
export type DownloadMaterialUpdate = Updateable<DownloadMaterialTable>;

export interface DownloadMaterialVersionTable {
  id: Generated<string>;
  material_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
  changed_at: Generated<Date>;
}

export type DownloadMaterialVersion = Selectable<DownloadMaterialVersionTable>;
export type NewDownloadMaterialVersion = Insertable<DownloadMaterialVersionTable>;

export interface DownloadMaterialMetadataTable {
  material_id: string;
  scenario: string | null;
  genre: string | null;
  // D119 (regra petrea): so 'pt' — CHECK/NOT NULL aplicados na migration 022.
  language: 'pt';
  file_format: string | null;
  vtt_platform: string | null;
  access_barriers: Generated<JSONColumnType<string[]>>;
  license_kind: string | null;
  license_url: string | null;
  credits: string | null;
  target_audience: string | null;
  age_rating: string | null;
  content_warnings: Generated<JSONColumnType<string[]>>;
  tags: Generated<JSONColumnType<string[]>>;
  // T-editora (spec 075, migration_019) — credito de editora/selo, texto
  // livre (nao e conta/entidade de login, so credito estruturado).
  publisher_name: string | null;
  // T2.7 (spec 082, migration_020) — MVP de Gestao de Midias: URL de texto
  // (sem upload/storage novo), coerente com T2.3 (MVP somente-link-externo).
  cover_image_url: string | null;
  // Spec 086 (migration_026) — metadados preservados da fonte. source_filters
  // mantém facet + caminho; tags continua a versão achatada para busca simples.
  file_size_text: string | null;
  page_count: number | null;
  creation_method: string | null;
  source_category: string | null;
  source_filters: Generated<JSONColumnType<Array<{ facet: string; path: string[] }>>>;
  description_html: string | null;
  updated_at: Generated<Date>;
}

export type DownloadMaterialMetadata = Selectable<DownloadMaterialMetadataTable>;
export type NewDownloadMaterialMetadata = Insertable<DownloadMaterialMetadataTable>;
export type DownloadMaterialMetadataUpdate = Updateable<DownloadMaterialMetadataTable>;

export interface DownloadCreatorTable {
  id: Generated<string>;
  user_id: string | null;
  slug: string;
  display_name: string;
  bio: string | null;
  role: Generated<DownloadCreatorRole>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadCreator = Selectable<DownloadCreatorTable>;
export type NewDownloadCreator = Insertable<DownloadCreatorTable>;
export type DownloadCreatorUpdate = Updateable<DownloadCreatorTable>;

export interface DownloadEvidenceTable {
  id: Generated<string>;
  material_id: string;
  evidence_kind: string;
  evidence_url: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  submitted_by: string;
  created_at: Generated<Date>;
}

export type DownloadEvidence = Selectable<DownloadEvidenceTable>;
export type NewDownloadEvidence = Insertable<DownloadEvidenceTable>;

export interface DownloadReportTable {
  id: Generated<string>;
  material_id: string;
  reporter_user_id: string | null;
  category: string;
  priority: Generated<DownloadReportPriority>;
  case_state: Generated<DownloadReportState>;
  details: string | null;
  resolution_note: string | null;
  created_at: Generated<Date>;
  resolved_at: Date | null;
}

export type DownloadReport = Selectable<DownloadReportTable>;
export type NewDownloadReport = Insertable<DownloadReportTable>;
export type DownloadReportUpdate = Updateable<DownloadReportTable>;

export interface DownloadFavoriteTable {
  user_id: string;
  material_id: string;
  created_at: Generated<Date>;
}

export type DownloadFavorite = Selectable<DownloadFavoriteTable>;
export type NewDownloadFavorite = Insertable<DownloadFavoriteTable>;

export interface DownloadCollectionTable {
  id: Generated<string>;
  user_id: string;
  slug: string;
  title: string;
  is_public: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadCollection = Selectable<DownloadCollectionTable>;
export type NewDownloadCollection = Insertable<DownloadCollectionTable>;
export type DownloadCollectionUpdate = Updateable<DownloadCollectionTable>;

export interface DownloadCollectionItemTable {
  collection_id: string;
  material_id: string;
  added_at: Generated<Date>;
}

export type DownloadCollectionItem = Selectable<DownloadCollectionItemTable>;
export type NewDownloadCollectionItem = Insertable<DownloadCollectionItemTable>;

export interface DownloadLinkCheckTable {
  id: Generated<string>;
  material_id: string;
  checked_url: string;
  http_status: number | null;
  is_healthy: boolean;
  error_detail: string | null;
  // Spec 084 (Fase 7) — distingue re-checagem de material de origem scraper
  // (falha nunca deriva pra 'withdrawn' sem confirmacao real de preco pago).
  is_scraper_origin: Generated<boolean>;
  checked_at: Generated<Date>;
}

export type DownloadLinkCheck = Selectable<DownloadLinkCheckTable>;
export type NewDownloadLinkCheck = Insertable<DownloadLinkCheckTable>;

export interface DownloadScraperRunTable {
  id: Generated<string>;
  source_platform: DownloadSourcePlatform;
  trigger_kind: DownloadScraperTriggerKind;
  status: Generated<DownloadScraperRunStatus>;
  items_found: Generated<number>;
  items_created: Generated<number>;
  items_skipped_duplicate: Generated<number>;
  items_skipped_not_portuguese: Generated<number>;
  items_skipped_error: Generated<number>;
  error_detail: string | null;
  started_at: Generated<Date>;
  finished_at: Date | null;
}

export type DownloadScraperRun = Selectable<DownloadScraperRunTable>;
export type NewDownloadScraperRun = Insertable<DownloadScraperRunTable>;
export type DownloadScraperRunUpdate = Updateable<DownloadScraperRunTable>;

export interface DownloadScraperItemLogTable {
  id: Generated<string>;
  run_id: string;
  material_id: string | null;
  source_url: string;
  outcome: DownloadScraperItemOutcome;
  detected_language: string | null;
  error_detail: string | null;
  created_at: Generated<Date>;
}

export type DownloadScraperItemLog = Selectable<DownloadScraperItemLogTable>;
export type NewDownloadScraperItemLog = Insertable<DownloadScraperItemLogTable>;

// Spec 085 (Fase 4) — auditoria minima do parser HTML determinístico
// (/parse-html), tabela nova (T4.1: enums de download_scraper_run/
// download_scraper_item_log são fechados demais, conceito não bate).
export type DownloadScraperParsePriceSignal =
  | 'pwyw_tag_present'
  | 'zero_price_no_pwyw_tag'
  | 'nonzero_price_no_pwyw_tag';

export interface DownloadScraperParseLogTable {
  parse_case_id: Generated<string>;
  source_platform: DownloadSourcePlatform;
  admin_user_id: string;
  fields_extracted: unknown;
  price_signal: DownloadScraperParsePriceSignal;
  confirmed_material_id: string | null;
  created_at: Generated<Date>;
}

export type DownloadScraperParseLog = Selectable<DownloadScraperParseLogTable>;
export type NewDownloadScraperParseLog = Insertable<DownloadScraperParseLogTable>;
export type DownloadScraperParseLogUpdate = Updateable<DownloadScraperParseLogTable>;

// Spec 085 (Fase 6, D-B/D-C) — registry de plataformas, PK=slug (nao UUID,
// as tabelas que ja guardam source_platform guardam esse texto). parser_kind
// referencia o slug do override em codigo (T7.2), nunca caminho de arquivo.
export interface DownloadScraperPlatformTable {
  slug: string;
  name: string;
  domain: string | null;
  supports_auto_scrape: Generated<boolean>;
  supports_price_recheck: Generated<boolean>;
  parser_kind: Generated<string>;
  created_at: Generated<Date>;
}

export type DownloadScraperPlatform = Selectable<DownloadScraperPlatformTable>;
export type NewDownloadScraperPlatform = Insertable<DownloadScraperPlatformTable>;
export type DownloadScraperPlatformUpdate = Updateable<DownloadScraperPlatformTable>;

// Spec 086 (Fase 4, migration_027) — fila de triagem de sistema/regra,
// espelhando o fluxo de draft do mesas (systemSuggestionCandidates.ts +
// suggestionHelpers.ts): scraper abre 'pending' automatico quando nao casa
// contra o catalogo central; usuario comum tambem pode sugerir; admin
// aprova/recusa. resolution_action registra o que o revisor de fato fez.
export type DownloadSystemSuggestionSource = 'scraper' | 'user';
export type DownloadSystemSuggestionStatus = 'pending' | 'approved' | 'rejected';
export type DownloadSystemSuggestionResolutionAction = 'merge_existing' | 'create_alias' | 'create_child' | 'create_system';

export interface DownloadSystemSuggestionTable {
  id: Generated<string>;
  material_id: string;
  raw_value: string;
  source: DownloadSystemSuggestionSource;
  status: Generated<DownloadSystemSuggestionStatus>;
  suggested_by_user_id: string | null;
  resolution_action: DownloadSystemSuggestionResolutionAction | null;
  resolved_node_id: string | null;
  rejection_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Generated<Date>;
}

export type DownloadSystemSuggestion = Selectable<DownloadSystemSuggestionTable>;
export type NewDownloadSystemSuggestion = Insertable<DownloadSystemSuggestionTable>;
export type DownloadSystemSuggestionUpdate = Updateable<DownloadSystemSuggestionTable>;

export interface DownloadMetricDailyTable {
  material_id: string;
  metric_date: Date;
  download_count: Generated<number>;
  view_count: Generated<number>;
}

export type DownloadMetricDaily = Selectable<DownloadMetricDailyTable>;
export type NewDownloadMetricDaily = Insertable<DownloadMetricDailyTable>;
export type DownloadMetricDailyUpdate = Updateable<DownloadMetricDailyTable>;

// Spec 087 (T1B.1, migration_029) — dedup de visualizacao. A PK composta
// (material_id, view_hash, view_date) E o mecanismo: a 2a view da mesma
// origem no mesmo dia colide e nao incrementa view_count de novo. view_hash e
// digest opaco da origem, nunca IP cru (visualizacao e anonima; guardar IP em
// claro seria coleta desnecessaria de dado).
export interface DownloadMaterialViewTable {
  material_id: string;
  view_hash: string;
  view_date: Date;
  created_at: Generated<Date>;
}

export type DownloadMaterialView = Selectable<DownloadMaterialViewTable>;
export type NewDownloadMaterialView = Insertable<DownloadMaterialViewTable>;

// Contador mensal LOCAL de bytes/operacoes por provider de storage (spec 071).
// Nunca bate no provider pra medir uso (isso gastaria cota Classe B); cota e
// checada ANTES de cada operacao real, com margem de 10% — regra petrea do
// mantenedor: zero risco de cobranca no free tier.
export interface DownloadStorageUsageTable {
  provider: string;
  year_month: string;
  bytes_used: Generated<number>;
  class_a_ops: Generated<number>;
  class_b_ops: Generated<number>;
  updated_at: Generated<Date>;
}

export type DownloadStorageUsage = Selectable<DownloadStorageUsageTable>;
export type NewDownloadStorageUsage = Insertable<DownloadStorageUsageTable>;
export type DownloadStorageUsageUpdate = Updateable<DownloadStorageUsageTable>;

export interface DownloadCommentTable {
  id: Generated<string>;
  material_id: string;
  user_id: string;
  body: string;
  removed_at: Date | null;
  removed_reason: string | null;
  created_at: Generated<Date>;
}

export type DownloadComment = Selectable<DownloadCommentTable>;
export type NewDownloadComment = Insertable<DownloadCommentTable>;
export type DownloadCommentUpdate = Updateable<DownloadCommentTable>;

export interface DownloadDestinationTable {
  id: Generated<string>;
  material_id: string;
  created_at: Generated<Date>;
}

export type DownloadDestination = Selectable<DownloadDestinationTable>;
export type NewDownloadDestination = Insertable<DownloadDestinationTable>;

// D111 item 7 (spec 074) — dedup de download por conta: PK composta
// (user_id, material_id) garante no maximo 1 registro por conta+material;
// so a primeira insercao incrementa download_metric_daily (T3.2).
export interface DownloadUserMaterialDownloadTable {
  user_id: string;
  material_id: string;
  created_at: Generated<Date>;
}

export type DownloadUserMaterialDownload = Selectable<DownloadUserMaterialDownloadTable>;
export type NewDownloadUserMaterialDownload = Insertable<DownloadUserMaterialDownloadTable>;

// D111 item 5 (spec 074) — avaliacao 1-5 + comentario opcional curto, 1 por
// conta+material (indice unico). Gate de escrita (so quem baixou) fica em
// services/ratingGuard.ts, nao em constraint de banco.
export interface DownloadRatingTable {
  id: Generated<string>;
  material_id: string;
  user_id: string;
  score: number;
  comment: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadRating = Selectable<DownloadRatingTable>;
export type NewDownloadRating = Insertable<DownloadRatingTable>;
export type DownloadRatingUpdate = Updateable<DownloadRatingTable>;

export type DownloadOrganizationMemberRole = 'member' | 'admin';

// T1.6 (spec 074) — escopo minimo funcional autorizado nominalmente
// (2026-07-12), sem spec previa detalhando o dominio. Organizacao = grupo de
// creators sob nome comum; sem vinculo com download_material nesta rodada.
export interface DownloadOrganizationTable {
  id: Generated<string>;
  slug: string;
  name: string;
  owner_user_id: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadOrganization = Selectable<DownloadOrganizationTable>;
export type NewDownloadOrganization = Insertable<DownloadOrganizationTable>;
export type DownloadOrganizationUpdate = Updateable<DownloadOrganizationTable>;

export interface DownloadOrganizationMemberTable {
  organization_id: string;
  user_id: string;
  role: Generated<DownloadOrganizationMemberRole>;
  created_at: Generated<Date>;
}

export type DownloadOrganizationMember = Selectable<DownloadOrganizationMemberTable>;
export type NewDownloadOrganizationMember = Insertable<DownloadOrganizationMemberTable>;

// T1.7 (spec 074) — escopo minimo funcional autorizado nominalmente
// (2026-07-12): feed interno de eventos ja emitidos por moderation.ts/
// reports.ts (aprovado/rejeitado/denuncia resolvida), sem envio externo.
export interface DownloadNotificationTable {
  id: Generated<string>;
  user_id: string;
  kind: string;
  material_id: string | null;
  body: string;
  read_at: Date | null;
  created_at: Generated<Date>;
}

export type DownloadNotification = Selectable<DownloadNotificationTable>;
export type NewDownloadNotification = Insertable<DownloadNotificationTable>;
export type DownloadNotificationUpdate = Updateable<DownloadNotificationTable>;

export interface DownloadRejectionCategoryTable {
  id: Generated<string>;
  slug: string;
  label: string;
  legal_basis: string | null;
  active: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export type DownloadRejectionCategory = Selectable<DownloadRejectionCategoryTable>;
export type NewDownloadRejectionCategory = Insertable<DownloadRejectionCategoryTable>;
export type DownloadRejectionCategoryUpdate = Updateable<DownloadRejectionCategoryTable>;

export type DownloadEmailKind = 'material_rejected' | 'material_approved';
export type DownloadEmailStatus = 'sent' | 'failed' | 'skipped_no_email' | 'sending';

export interface DownloadEmailLogTable {
  id: Generated<string>;
  user_id: string;
  material_id: string | null;
  kind: DownloadEmailKind;
  to_email: string | null;
  status: DownloadEmailStatus;
  provider_message_id: string | null;
  error_detail: string | null;
  attempts: Generated<number>;
  created_at: Generated<Date>;
  last_attempt_at: Generated<Date>;
}

export type DownloadEmailLog = Selectable<DownloadEmailLogTable>;
export type NewDownloadEmailLog = Insertable<DownloadEmailLogTable>;
export type DownloadEmailLogUpdate = Updateable<DownloadEmailLogTable>;

export interface Database {
  download_material: DownloadMaterialTable;
  download_destination: DownloadDestinationTable;
  download_material_version: DownloadMaterialVersionTable;
  download_material_metadata: DownloadMaterialMetadataTable;
  download_creator: DownloadCreatorTable;
  download_evidence: DownloadEvidenceTable;
  download_report: DownloadReportTable;
  download_favorite: DownloadFavoriteTable;
  download_collection: DownloadCollectionTable;
  download_collection_item: DownloadCollectionItemTable;
  download_link_check: DownloadLinkCheckTable;
  download_metric_daily: DownloadMetricDailyTable;
  download_material_view: DownloadMaterialViewTable;
  download_storage_usage: DownloadStorageUsageTable;
  download_comment: DownloadCommentTable;
  download_user_material_download: DownloadUserMaterialDownloadTable;
  download_rating: DownloadRatingTable;
  download_organization: DownloadOrganizationTable;
  download_organization_member: DownloadOrganizationMemberTable;
  download_notification: DownloadNotificationTable;
  download_rejection_category: DownloadRejectionCategoryTable;
  download_email_log: DownloadEmailLogTable;
  download_scraper_run: DownloadScraperRunTable;
  download_scraper_item_log: DownloadScraperItemLogTable;
  download_scraper_parse_log: DownloadScraperParseLogTable;
  download_scraper_platform: DownloadScraperPlatformTable;
  download_system_suggestion: DownloadSystemSuggestionTable;
}
