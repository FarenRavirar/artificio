-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 109: Adiciona campo para VTT platforms preferidas do mestre
-- Data: 2026-04-18
-- Autor: Sistema
-- Descrição: Permite que o mestre selecione suas plataformas VTT preferidas para exibir no perfil público

-- Adicionar coluna para armazenar IDs das VTT platforms preferidas
ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS preferred_vtt_platforms UUID[] DEFAULT '{}';

-- Comentário explicativo
COMMENT ON COLUMN gm_profiles.preferred_vtt_platforms IS 'Array de IDs de vtt_platforms que o mestre usa/prefere - exibido no perfil público com logos';

-- Índice para busca eficiente (GIN para arrays)
CREATE INDEX IF NOT EXISTS idx_gm_profiles_preferred_vtt_platforms 
  ON gm_profiles USING GIN (preferred_vtt_platforms);
