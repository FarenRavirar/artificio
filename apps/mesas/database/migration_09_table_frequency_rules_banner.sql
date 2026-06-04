-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_09_table_frequency_rules_banner.sql
-- Adiciona campos de frequência, regras/observações e banner_url
-- Executar: cat migration_09_table_frequency_rules_banner.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

ALTER TABLE tables
ADD COLUMN frequency VARCHAR(20) CHECK (frequency IN ('semanal', 'quinzenal', 'mensal', 'outros')),
ADD COLUMN frequency_custom TEXT,
ADD COLUMN rules_notes TEXT,
ADD COLUMN banner_url TEXT;

COMMENT ON COLUMN tables.frequency IS 'Frequência das sessões: semanal, quinzenal, mensal ou outros';
COMMENT ON COLUMN tables.frequency_custom IS 'Descrição customizada quando frequency = outros';
COMMENT ON COLUMN tables.rules_notes IS 'Regras específicas e observações da mesa';
COMMENT ON COLUMN tables.banner_url IS 'URL do banner/imagem de capa da mesa';

-- =============================================================================
-- FIM DA MIGRATION 09
-- =============================================================================
