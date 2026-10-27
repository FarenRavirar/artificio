-- @class: online-safe
-- @requires-backup: false
-- @author: spec-106
-- @created: 2026-10-27
-- @description: spec 106 - gm_slug_redirects (301 de slug), client_errors (telemetria de cliente) e dev_feedback.stale_alerted_at

-- Spec 106. Uma migration so para as tres mudancas de schema (deploy-flow.md §3,
-- "Nao fatiar o schema de uma mesma feature"; cada arquivo conta no guard
-- MAX_AUTO_PENDING).

-- 1. R3: slug trocado responde 301 para o atual. Guarda `gm_id`, nao o slug novo:
--    o destino e sempre o slug atual e nao existem cadeias.
CREATE TABLE IF NOT EXISTS gm_slug_redirects (
  old_slug   TEXT PRIMARY KEY,
  gm_id      UUID NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gm_slug_redirects_gm ON gm_slug_redirects (gm_id);

-- 2. R19: erro de cliente chega ao proprio servidor. Upsert por `fingerprint`;
--    sem IP, sem header, sem query string (plan §9).
CREATE TABLE IF NOT EXISTS client_errors (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint     TEXT NOT NULL UNIQUE,
  first_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  occurrences     INTEGER NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  user_id         UUID NULL,
  route_pattern   TEXT NOT NULL DEFAULT '',
  path            TEXT NOT NULL DEFAULT '',
  message         TEXT NOT NULL DEFAULT '',
  stack           TEXT NOT NULL DEFAULT '',
  component_stack TEXT NOT NULL DEFAULT '',
  user_agent      TEXT NOT NULL DEFAULT '',
  build           TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_client_errors_last_seen ON client_errors (last_seen);
CREATE INDEX IF NOT EXISTS idx_client_errors_first_seen ON client_errors (first_seen);

-- 3. R13: alerta de fila parada avisa uma vez por report.
ALTER TABLE dev_feedback ADD COLUMN IF NOT EXISTS stale_alerted_at TIMESTAMPTZ NULL;

-- Validacao: falha alto se algo nao nasceu.
DO $$
BEGIN
  IF to_regclass('gm_slug_redirects') IS NULL OR to_regclass('client_errors') IS NULL THEN
    RAISE EXCEPTION 'Migration 168 failed: table not created';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dev_feedback' AND column_name = 'stale_alerted_at'
  ) THEN
    RAISE EXCEPTION 'Migration 168 failed: dev_feedback.stale_alerted_at not created';
  END IF;
END $$;
