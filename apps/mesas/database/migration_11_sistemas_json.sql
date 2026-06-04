-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_11_sistemas_json.sql
-- Migração para suporte a taxonomia JSON (sistemas.json)
-- Adiciona hierarquia: parent_id, node_type, depth, path_slug
-- Executar: cat migration_11_sistemas_json.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

-- =============================================================================
-- BACKUP E LIMPEZA
-- =============================================================================

-- Truncar tabela systems (CASCADE para system_aliases)
-- Confirmado pelo usuário: "Pode zerar tudo. até hoje subimos nada em produção"
TRUNCATE TABLE systems CASCADE;

-- =============================================================================
-- ADICIONAR NOVOS CAMPOS
-- =============================================================================

-- Campo parent_id: FK para sistema pai (edição aponta para base, variante aponta para edição)
ALTER TABLE systems ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES systems(id) ON DELETE CASCADE;

-- Campo node_type: Tipo do nó na hierarquia
ALTER TABLE systems ADD COLUMN IF NOT EXISTS node_type TEXT NOT NULL DEFAULT 'system';

-- Campo depth: Profundidade na hierarquia (0=base, 1=edição, 2=variante)
ALTER TABLE systems ADD COLUMN IF NOT EXISTS depth INTEGER NOT NULL DEFAULT 0;

-- Campo path_slug: Caminho completo slugificado (ex: dungeons-dragons/5e/2024)
ALTER TABLE systems ADD COLUMN IF NOT EXISTS path_slug TEXT UNIQUE;

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Índice para queries hierárquicas (buscar filhos de um pai)
CREATE INDEX IF NOT EXISTS idx_systems_parent ON systems(parent_id);

-- Índice para busca por caminho completo
CREATE INDEX IF NOT EXISTS idx_systems_path_slug ON systems(path_slug);

-- Índice para filtrar por tipo de nó
CREATE INDEX IF NOT EXISTS idx_systems_node_type ON systems(node_type);

-- Índice GIN para busca full-text em português
CREATE INDEX IF NOT EXISTS idx_systems_name_gin ON systems USING gin(to_tsvector('portuguese', name));

-- =============================================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON COLUMN systems.parent_id IS 'FK para sistema pai — edição aponta para base, variante aponta para edição. NULL para sistemas base.';
COMMENT ON COLUMN systems.node_type IS 'Tipo do nó na hierarquia: system (base), edition (edição), variant (variante)';
COMMENT ON COLUMN systems.depth IS 'Profundidade na hierarquia: 0=sistema base, 1=edição, 2=variante';
COMMENT ON COLUMN systems.path_slug IS 'Caminho completo slugificado para identificação única (ex: dungeons-dragons/5e/2024)';

-- =============================================================================
-- VALIDAÇÕES
-- =============================================================================

-- Garantir que node_type é válido
ALTER TABLE systems ADD CONSTRAINT check_node_type CHECK (node_type IN ('system', 'edition', 'variant'));

-- Garantir que depth é não-negativo
ALTER TABLE systems ADD CONSTRAINT check_depth_non_negative CHECK (depth >= 0);

-- Garantir que sistemas base não têm parent_id
ALTER TABLE systems ADD CONSTRAINT check_system_no_parent CHECK (
    (node_type = 'system' AND parent_id IS NULL) OR
    (node_type != 'system')
);

-- =============================================================================
-- FIM DA MIGRATION 11
-- =============================================================================
