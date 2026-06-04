-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_12_cenarios.sql
-- Criação da tabela scenarios (cenários de RPG)
-- Adiciona FK scenario_id em tables
-- Executar: cat migration_12_cenarios.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

-- =============================================================================
-- CRIAR TABELA SCENARIOS
-- =============================================================================

CREATE TABLE IF NOT EXISTS scenarios (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    subgenres   TEXT[] DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ADICIONAR FK EM TABLES
-- =============================================================================

-- Adicionar coluna scenario_id (FK opcional para cenário)
ALTER TABLE tables ADD COLUMN IF NOT EXISTS scenario_id UUID REFERENCES scenarios(id) ON DELETE SET NULL;

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Índice para busca por slug
CREATE INDEX IF NOT EXISTS idx_scenarios_slug ON scenarios(slug);

-- Índice GIN para busca full-text em português
CREATE INDEX IF NOT EXISTS idx_scenarios_name_gin ON scenarios USING gin(to_tsvector('portuguese', name));

-- Índice para FK em tables
CREATE INDEX IF NOT EXISTS idx_tables_scenario ON tables(scenario_id);

-- =============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE scenarios IS 'Cenários de RPG (ex: Forgotten Realms, Eberron, Shadowrun) — independentes de sistemas. Um cenário pode ser usado em múltiplos sistemas.';
COMMENT ON COLUMN scenarios.name IS 'Nome do cenário (ex: "Forgotten Realms", "Eberron")';
COMMENT ON COLUMN scenarios.slug IS 'Slug único para URLs e busca';
COMMENT ON COLUMN scenarios.subgenres IS 'Array de subgêneros parseados do JSON (ex: ["Alta fantasia", "Espada e feitiçaria"])';
COMMENT ON COLUMN tables.scenario_id IS 'FK opcional para cenário da mesa. Cenário é independente do sistema — ex: Forgotten Realms pode ser jogado em D&D ou Pathfinder.';

-- =============================================================================
-- FIM DA MIGRATION 12
-- =============================================================================
