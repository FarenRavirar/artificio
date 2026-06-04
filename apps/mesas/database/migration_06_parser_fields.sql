-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 06: Adicionar campos extraídos pelo parser Python
-- Data: 2026-04-05
-- Descrição: Adiciona 7 campos opcionais e 3 campos de metadados do parser

-- Adicionar novos campos à tabela import_candidates
ALTER TABLE import_candidates 
ADD COLUMN IF NOT EXISTS level_range VARCHAR(50),
ADD COLUMN IF NOT EXISTS session_duration VARCHAR(50),
ADD COLUMN IF NOT EXISTS campaign_length VARCHAR(100),
ADD COLUMN IF NOT EXISTS experience_required VARCHAR(50),
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS requires_pc BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parser_missing_fields JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS parser_review_flags JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS parser_confidence_by_field JSONB DEFAULT '{}'::jsonb;

-- Comentários para documentação
COMMENT ON COLUMN import_candidates.level_range IS 'Faixa de nível extraída pelo parser (ex: "1-5", "10-20")';
COMMENT ON COLUMN import_candidates.session_duration IS 'Duração da sessão extraída pelo parser (ex: "3h", "4h")';
COMMENT ON COLUMN import_candidates.campaign_length IS 'Duração da campanha extraída pelo parser (ex: "6 meses", "curta")';
COMMENT ON COLUMN import_candidates.experience_required IS 'Experiência necessária: iniciante, intermediario, avancado';
COMMENT ON COLUMN import_candidates.tags IS 'Tags/estilos da mesa (terror, investigacao, combate, etc.)';
COMMENT ON COLUMN import_candidates.requires_pc IS 'Se requer PC para jogar (Foundry VTT, Roll20, etc.)';
COMMENT ON COLUMN import_candidates.parser_missing_fields IS 'Campos obrigatórios que o parser não conseguiu extrair';
COMMENT ON COLUMN import_candidates.parser_review_flags IS 'Flags de revisão do parser (low_confidence, missing_system, etc.)';
COMMENT ON COLUMN import_candidates.parser_confidence_by_field IS 'Confidence individual por campo extraído';

-- Índices para busca e filtros
CREATE INDEX IF NOT EXISTS idx_candidates_level_range ON import_candidates(level_range);
CREATE INDEX IF NOT EXISTS idx_candidates_experience ON import_candidates(experience_required);
CREATE INDEX IF NOT EXISTS idx_candidates_tags ON import_candidates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_candidates_requires_pc ON import_candidates(requires_pc);

-- Índice para busca por review flags
CREATE INDEX IF NOT EXISTS idx_candidates_parser_review_flags ON import_candidates USING GIN(parser_review_flags);
