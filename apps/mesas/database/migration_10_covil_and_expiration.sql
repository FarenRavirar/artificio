-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 10: is_covil e imported_expires_at
-- Aplicar em: mesas-beta-db (e depois em produção)
-- Pré-requisito: migration_09 aplicada (colunas frequency, rules_notes, banner_url presentes)

ALTER TABLE tables ADD COLUMN IF NOT EXISTS is_covil BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tables ADD COLUMN IF NOT EXISTS imported_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN tables.is_covil IS 'Mesa vinculada ao Covil do Lich — detectado automaticamente pelo parser Python, editável pelo admin';
COMMENT ON COLUMN tables.imported_expires_at IS 'Data de expiração configurável para mesas importadas via JSON do Discord — política gerenciada pelo AdminDevTools';
