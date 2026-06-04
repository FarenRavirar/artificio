-- @class: manual-risk
-- @requires-backup: true
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 06: Renomear gm_bio para table_gm_bio
-- Data: 2026-04-07
-- Motivo: Eliminar conflito de nomenclatura com gm_profiles.bio_long
-- Autor: Sistema de correção de nomenclatura

BEGIN;

-- Renomear coluna
ALTER TABLE tables 
  RENAME COLUMN gm_bio TO table_gm_bio;

-- Adicionar comentário para documentação
COMMENT ON COLUMN tables.table_gm_bio IS 
  'Bio do mestre específica para esta mesa (REQ-28 Fase 6). Diferente de gm_profiles.bio_long que é global do perfil.';

COMMIT;
