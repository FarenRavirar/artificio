-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 108: gm_profile_metrics
-- Objetivo: instrumentar visualizações do perfil público do mestre com dedupe por sessão
-- Segurança: idempotente (CREATE TABLE/INDEX IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS gm_profile_metrics (
  id BIGSERIAL PRIMARY KEY,
  gm_profile_id UUID NOT NULL UNIQUE REFERENCES gm_profiles(id) ON DELETE CASCADE,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gm_profile_metrics_views_count_nonnegative CHECK (views_count >= 0)
);

CREATE TABLE IF NOT EXISTS gm_profile_view_events (
  id BIGSERIAL PRIMARY KEY,
  gm_profile_id UUID NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
  session_id VARCHAR(128) NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gm_profile_view_events_gm_profile_id_session_id_unique
    UNIQUE (gm_profile_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_profile_metrics_updated_at
  ON gm_profile_metrics (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_gm_profile_view_events_profile_id
  ON gm_profile_view_events (gm_profile_id);

CREATE INDEX IF NOT EXISTS idx_gm_profile_view_events_viewed_at
  ON gm_profile_view_events (viewed_at DESC);
