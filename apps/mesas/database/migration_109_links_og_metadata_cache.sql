-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 109: Open Graph Metadata Cache and Retry Logic para user_links
-- Adiciona campos de estado e retenção para o worker de enriquecimento OG
-- Idempotente via IF NOT EXISTS

ALTER TABLE user_links
ADD COLUMN IF NOT EXISTS metadata_status VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS metadata_fetched_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS metadata_last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS metadata_fail_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS metadata_next_retry_at TIMESTAMPTZ NULL;

-- Índices operacionais para o worker de polling e rotina de cleanup (30 dias)
CREATE INDEX IF NOT EXISTS idx_user_links_worker_polling ON user_links (metadata_status, metadata_next_retry_at);
CREATE INDEX IF NOT EXISTS idx_user_links_last_accessed ON user_links (metadata_last_accessed_at);
