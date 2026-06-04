-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_08_external_gm.sql
-- Cria user e gm_profile genérico para mesas importadas
-- Executar: cat migration_08_external_gm.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

-- Criar user genérico para mesas importadas
INSERT INTO users (google_id, email, role)
VALUES ('external_gm_system', 'mestre_externo@sistema.local', 'gm')
ON CONFLICT (google_id) DO NOTHING;

-- Criar profile genérico
INSERT INTO profiles (user_id, display_name, bio)
SELECT id, 'Mestre Externo', 'Perfil genérico para mesas importadas de fontes externas'
FROM users
WHERE google_id = 'external_gm_system'
ON CONFLICT (user_id) DO NOTHING;

-- Criar gm_profile genérico (será usado como base para criar profiles temporários)
INSERT INTO gm_profiles (user_id, slug, nickname, bio_long)
SELECT 
  id, 
  'mestre-externo', 
  'Mestre Externo',
  'Este é um perfil temporário criado automaticamente para mesas importadas de fontes externas. O nome do mestre real está indicado na descrição da mesa.'
FROM users
WHERE google_id = 'external_gm_system'
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- FIM DA MIGRATION 08
-- =============================================================================
