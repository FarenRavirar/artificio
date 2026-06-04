-- @class: manual-risk
-- @requires-backup: true
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_99_drop_aggregator_tables.sql
-- Remove sistema de ingestão automática (AggregatorBot) desacoplado
-- =============================================================================

BEGIN;

-- Drop tabelas na ordem correta (respeitando FKs)
DROP TABLE IF EXISTS aggregator_candidate_audit CASCADE;
DROP TABLE IF EXISTS aggregator_import_candidates CASCADE;
DROP TABLE IF EXISTS aggregator_imported_raw_messages CASCADE;
DROP TABLE IF EXISTS aggregator_sources CASCADE;
DROP TABLE IF EXISTS aggregator_settings CASCADE;

-- Remover campos relacionados ao aggregator da tabela tables
-- Campo 'origin' é mantido pois mesas manuais também usam
-- Campo 'imported_expires_at' pode ser removido (só usado por mesas importadas)
ALTER TABLE tables DROP COLUMN IF EXISTS imported_expires_at;

COMMIT;
