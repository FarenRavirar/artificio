export type InboxDraftStatus = 'draft' | 'ready' | 'needs_review' | 'synced' | 'rejected';

export interface InboxDraftSummary {
  id: string;
  source_type: string;
  raw_text: string;
  status: InboxDraftStatus;
  confidence: number | null;
  title: string | null;
  created_at: string;
}

export interface InboxDraftPayload {
  table: Record<string, unknown>;
  source?: Record<string, unknown>;
  confidence?: number;
  missing_fields?: string[];
}

export interface InboxDraft {
  id: string;
  discord_message_id: string | null;
  import_message_id: string | null;
  table_id: string | null;
  parsed_payload: unknown;
  normalized_payload: unknown;
  confidence: number | null;
  status: InboxDraftStatus;
  review_notes: string | null;
  image_upload_status: string | null;
  image_upload_attempts: number;
  image_upload_last_error: string | null;
  image_upload_last_at: string | null;
  raw_text?: string;
  created_at: string;
  updated_at: string;
}

export interface InboxImportResult {
  segments_found: number;
  drafts_created: number;
  drafts: InboxImportDraft[];
}

export interface InboxImportDraft {
  id: string;
  title: string | null;
  status: string;
  confidence: number | null;
  missing_fields: string[];
}

export interface InboxCorrectionResult {
  draft_id: string;
  fields_corrected: number;
  diff: Record<string, { before: unknown; after: unknown }>;
}

export interface InboxSyncResult {
  tableId: string;
  created: boolean;
}

export interface InboxMetrics {
  total_corrections: number;
  most_corrected_fields: Array<{ field: string; count: number }>;
}
