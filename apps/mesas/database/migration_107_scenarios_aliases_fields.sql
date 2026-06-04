-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 107: Adiciona campos faltantes para scenarios e aliases
-- Problema: scenarios sem description, scenario_suggestions sem subgenres, falta tabela scenario_aliases
-- Solução: ADD description em scenarios, ADD subgenres em scenario_suggestions, CREATE scenario_aliases

-- 1. Adicionar description em scenarios
ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Adicionar subgenres em scenario_suggestions
ALTER TABLE scenario_suggestions ADD COLUMN IF NOT EXISTS subgenres TEXT[] DEFAULT '{}';

-- 3. Criar tabela scenario_aliases (similar a system_aliases)
CREATE TABLE IF NOT EXISTS scenario_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id UUID NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scenario_id, alias_slug)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_scenario_aliases_scenario_id ON scenario_aliases(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_aliases_alias_slug ON scenario_aliases(alias_slug);

-- Validação: verificar que colunas e tabela foram criadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenarios' AND column_name = 'description'
  ) THEN
    RAISE EXCEPTION 'Migration 107 failed: scenarios.description not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scenario_suggestions' AND column_name = 'subgenres'
  ) THEN
    RAISE EXCEPTION 'Migration 107 failed: scenario_suggestions.subgenres not created';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'scenario_aliases'
  ) THEN
    RAISE EXCEPTION 'Migration 107 failed: scenario_aliases table not created';
  END IF;
  
  RAISE NOTICE 'Migration 107 completed successfully';
END $$;
