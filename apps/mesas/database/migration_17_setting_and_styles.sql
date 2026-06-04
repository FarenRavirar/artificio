-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 17: Cenário e Estilos com Sugestões Automáticas
-- REQ-28: Implementar campos de cenário e estilos com auto-sugestão
-- Data: 05/04/2026

BEGIN;

-- CORREÇÃO DT-24: Garantir que a extensão pg_trgm está habilitada antes de criar índices
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Adicionar colunas de cenário e estilos em tables
ALTER TABLE tables 
  ADD COLUMN IF NOT EXISTS setting_name TEXT,
  ADD COLUMN IF NOT EXISTS setting_styles TEXT[];

COMMENT ON COLUMN tables.setting_name IS 'Nome do cenário da mesa (ex: "Forgotten Realms", "Eberron")';
COMMENT ON COLUMN tables.setting_styles IS 'Array de estilos/temáticas (ex: ["Alta Fantasia", "Aventura Épica"])';

-- CORREÇÃO DT-15: Adicionar índice GIN para otimizar buscas por array em setting_styles
CREATE INDEX IF NOT EXISTS idx_tables_setting_styles_gin 
  ON tables 
  USING gin (setting_styles);

COMMENT ON INDEX idx_tables_setting_styles_gin IS 'Índice GIN para buscas eficientes em arrays de estilos';

-- 2. Criar tabela de sugestões de estilos por cenário
CREATE TABLE IF NOT EXISTS setting_style_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_name TEXT NOT NULL UNIQUE,
  suggested_styles TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE setting_style_suggestions IS 'Mapeamento de cenários para estilos sugeridos automaticamente';
COMMENT ON COLUMN setting_style_suggestions.setting_name IS 'Nome do cenário (normalizado para busca fuzzy)';
COMMENT ON COLUMN setting_style_suggestions.suggested_styles IS 'Array de estilos sugeridos para este cenário';

-- 3. Criar índice para busca fuzzy por cenário
CREATE INDEX IF NOT EXISTS idx_setting_suggestions_name_trgm 
  ON setting_style_suggestions 
  USING gin (setting_name gin_trgm_ops);

-- 4. Popular com exemplos iniciais (D&D, Pathfinder, Call of Cthulhu)
INSERT INTO setting_style_suggestions (setting_name, suggested_styles) VALUES
  ('Forgotten Realms', ARRAY['Alta Fantasia', 'Aventura Épica', 'Magia Abundante']),
  ('Eberron', ARRAY['Steampunk', 'Magitech', 'Noir', 'Pulp']),
  ('Ravenloft', ARRAY['Horror Gótico', 'Dark Fantasy', 'Terror']),
  ('Greyhawk', ARRAY['Fantasia Clássica', 'Exploração de Masmorras']),
  ('Planescape', ARRAY['Multiverso', 'Filosofia', 'Bizarro']),
  ('Dark Sun', ARRAY['Pós-Apocalíptico', 'Sobrevivência', 'Deserto']),
  ('Golarion', ARRAY['Alta Fantasia', 'Diversidade Cultural', 'Aventura']),
  ('Arkham', ARRAY['Horror Cósmico', 'Investigação', 'Anos 1920']),
  ('Tormenta', ARRAY['Alta Fantasia', 'Deuses Ativos', 'Aventura Brasileira']),
  ('Arton', ARRAY['Fantasia Medieval', 'Aventura', 'Humor'])
ON CONFLICT (setting_name) DO NOTHING;

COMMIT;
