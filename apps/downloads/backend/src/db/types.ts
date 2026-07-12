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
  updated_at: Generated<Date>;
}

export type DownloadMaterialMetadata = Selectable<DownloadMaterialMetadataTable>;
export type NewDownloadMaterialMetadata = Insertable<DownloadMaterialMetadataTable>;
export type DownloadMaterialMetadataUpdate = Updateable<DownloadMaterialMetadataTable>;

export interface DownloadCreatorTable {
  id: Generated<string>;
  user_id: string;
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

export interface Database {
  download_material: DownloadMaterialTable;
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
}
