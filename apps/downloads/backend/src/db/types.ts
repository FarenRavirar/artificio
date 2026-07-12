import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export type DownloadEditorialState = 'draft' | 'in_review' | 'published' | 'rejected' | 'withdrawn';
export type DownloadAccessKind = 'external_link' | 'managed_upload';
export type DownloadCreatorRole = 'user' | 'publisher' | 'moderator' | 'admin';
export type DownloadReportPriority = 'P0' | 'P1' | 'P2' | 'P3';
export type DownloadReportState = 'open' | 'in_review' | 'resolved' | 'dismissed';

export type JSONColumnType<T> = ColumnType<T, T | undefined, T>;

export interface DownloadMaterialTable {
  id: Generated<string>;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  material_type: string;
  system_id: string | null;
  edition_id: string | null;
  creator_id: string;
  editorial_state: Generated<DownloadEditorialState>;
  access_kind: Generated<DownloadAccessKind>;
  external_url: string | null;
  storage_provider: string | null;
  storage_key: string | null;
  rejection_reason: string | null;
  auto_publish_enabled: Generated<boolean>;
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
  language: string | null;
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
  checked_at: Generated<Date>;
}

export type DownloadLinkCheck = Selectable<DownloadLinkCheckTable>;
export type NewDownloadLinkCheck = Insertable<DownloadLinkCheckTable>;

export interface DownloadMetricDailyTable {
  material_id: string;
  metric_date: Date;
  download_count: Generated<number>;
  view_count: Generated<number>;
}

export type DownloadMetricDaily = Selectable<DownloadMetricDailyTable>;
export type NewDownloadMetricDaily = Insertable<DownloadMetricDailyTable>;
export type DownloadMetricDailyUpdate = Updateable<DownloadMetricDailyTable>;

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
  download_storage_usage: DownloadStorageUsageTable;
  download_comment: DownloadCommentTable;
  download_user_material_download: DownloadUserMaterialDownloadTable;
  download_rating: DownloadRatingTable;
  download_organization: DownloadOrganizationTable;
  download_organization_member: DownloadOrganizationMemberTable;
  download_notification: DownloadNotificationTable;
}
