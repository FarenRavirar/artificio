-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_05_aggregator_sources_and_queue.sql
-- Feature Aggregator Discord: fontes, fila bruta e candidatos editoriais
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS aggregator_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'discord',
  server_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  allow_paid BOOLEAN NOT NULL DEFAULT FALSE,
  publish_mode TEXT NOT NULL DEFAULT 'manual_review',
  default_timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aggregator_sources_platform_check CHECK (platform IN ('discord')),
  CONSTRAINT aggregator_sources_publish_mode_check CHECK (publish_mode IN ('manual_review', 'auto_publish')),
  CONSTRAINT aggregator_sources_unique_channel UNIQUE (platform, server_id, channel_id)
);

CREATE TABLE IF NOT EXISTS aggregator_imported_raw_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES aggregator_sources(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  author_name TEXT,
  author_discord_id TEXT,
  message_url TEXT,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  message_created_at TIMESTAMPTZ,
  raw_payload JSONB NOT NULL,
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  last_processing_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aggregator_raw_unique_source_external UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS aggregator_import_candidates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_id UUID NOT NULL REFERENCES aggregator_sources(id) ON DELETE CASCADE,
  raw_message_id UUID NOT NULL UNIQUE REFERENCES aggregator_imported_raw_messages(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  parsed_json JSONB,
  confidence_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
  editorial_status TEXT NOT NULL DEFAULT 'awaiting_review',
  publish_mode TEXT NOT NULL DEFAULT 'manual_review',
  publish_at TIMESTAMPTZ,
  rejection_reason TEXT,
  published_table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT aggregator_candidates_editorial_status_check CHECK (editorial_status IN ('accepted', 'rejected', 'awaiting_review')),
  CONSTRAINT aggregator_candidates_publish_mode_check CHECK (publish_mode IN ('manual_review', 'auto_publish')),
  CONSTRAINT aggregator_candidates_unique_source_external UNIQUE (source_id, external_id)
);

CREATE TABLE IF NOT EXISTS aggregator_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aggregator_sources_enabled
  ON aggregator_sources (enabled);

CREATE INDEX IF NOT EXISTS idx_aggregator_raw_source_created
  ON aggregator_imported_raw_messages (source_id, message_created_at DESC);

CREATE INDEX IF NOT EXISTS idx_aggregator_raw_processed
  ON aggregator_imported_raw_messages (processed);

CREATE INDEX IF NOT EXISTS idx_aggregator_candidates_status_publish
  ON aggregator_import_candidates (editorial_status, publish_mode);

CREATE INDEX IF NOT EXISTS idx_aggregator_candidates_publish_at
  ON aggregator_import_candidates (publish_at);

COMMIT;
