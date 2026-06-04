-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 18: Campos editoriais separados (REQ-28 Fase 2)
-- Data: 2026-04-05
-- Descrição: Adiciona campos para separar blocos editoriais (synopsis_narrative, benefits_text, gm_bio)

BEGIN;

-- Adicionar novos campos à tabela tables
ALTER TABLE tables
ADD COLUMN IF NOT EXISTS synopsis_narrative TEXT,
ADD COLUMN IF NOT EXISTS benefits_text TEXT,
ADD COLUMN IF NOT EXISTS gm_bio TEXT;

-- Comentários para documentação
COMMENT ON COLUMN tables.synopsis_narrative IS 'Bloco narrativo principal extraído do anúncio original';
COMMENT ON COLUMN tables.benefits_text IS 'Benefícios e diferenciais oferecidos pela mesa';
COMMENT ON COLUMN tables.gm_bio IS 'Biografia ou apresentação do mestre';

-- Índice para busca textual em synopsis_narrative
CREATE INDEX IF NOT EXISTS idx_tables_synopsis_narrative_gin 
ON tables USING gin(to_tsvector('portuguese', synopsis_narrative));

-- Índice para busca textual em gm_bio
CREATE INDEX IF NOT EXISTS idx_tables_gm_bio_gin 
ON tables USING gin(to_tsvector('portuguese', gm_bio));

COMMIT;
