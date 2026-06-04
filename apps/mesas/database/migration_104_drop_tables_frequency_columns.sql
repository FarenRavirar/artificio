-- @class: manual-risk
-- @requires-backup: true
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_104_drop_tables_frequency_columns.sql
-- Remove colunas legadas de frequência global da tabela tables
-- Fonte de verdade: table_schedules.frequency
-- =============================================================================

ALTER TABLE tables
  DROP COLUMN IF EXISTS frequency,
  DROP COLUMN IF EXISTS frequency_custom;

-- =============================================================================
-- FIM DA MIGRATION 104
-- =============================================================================
