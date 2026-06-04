-- Migration 006: Sistema de VTT Platforms com logos
-- Cria tabela de plataformas VTT pré-cadastradas e sistema de sugestões

-- Tabela de VTT Platforms
CREATE TABLE IF NOT EXISTS vtt_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  logo_filename VARCHAR(255), -- Nome do arquivo em /public/vtt-logos/
  website_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de sugestões de VTT (mestres podem sugerir)
CREATE TABLE IF NOT EXISTS vtt_platform_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggested_name VARCHAR(100) NOT NULL,
  suggested_by_user_id UUID NOT NULL REFERENCES users(id),
  table_id UUID REFERENCES tables(id), -- Mesa onde foi sugerido
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  reviewed_at TIMESTAMP,
  reviewed_by_user_id UUID REFERENCES users(id)
);

-- Popular com VTTs iniciais (ordem alfabética)
INSERT INTO vtt_platforms (name, slug, sort_order) VALUES
  ('Alchemy RPG', 'alchemy-rpg', 1),
  ('D&D Beyond Maps', 'dndbeyond-maps', 2),
  ('Fantasy Grounds Unity', 'fantasy-grounds-unity', 3),
  ('Foundry VTT', 'foundry-vtt', 4),
  ('Owlbear Rodeo', 'owlbear-rodeo', 5),
  ('Quest Portal', 'quest-portal', 6),
  ('Roll20', 'roll20', 7),
  ('Tableplop', 'tableplop', 8),
  ('Tabletop Simulator (TTS)', 'tabletop-simulator', 9),
  ('TaleSpire', 'talespire', 10)
ON CONFLICT (slug) DO NOTHING;

-- Alterar tabela tables para referenciar vtt_platforms
ALTER TABLE tables 
  ADD COLUMN IF NOT EXISTS vtt_platform_id UUID REFERENCES vtt_platforms(id),
  ADD COLUMN IF NOT EXISTS game_platform_custom TEXT, -- Texto livre quando seleciona "Personalizado"
  ADD COLUMN IF NOT EXISTS game_platform_legacy TEXT; -- Backup do texto livre antigo

-- Migrar dados existentes (backup)
UPDATE tables 
SET game_platform_legacy = game_platform 
WHERE game_platform IS NOT NULL 
  AND game_platform_legacy IS NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_vtt_platforms_active ON vtt_platforms(is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_vtt_suggestions_status ON vtt_platform_suggestions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_tables_vtt_platform ON tables(vtt_platform_id);

-- Comentários
COMMENT ON TABLE vtt_platforms IS 'Plataformas VTT pré-cadastradas com logos';
COMMENT ON TABLE vtt_platform_suggestions IS 'Sugestões de VTT enviadas por mestres';
COMMENT ON COLUMN tables.vtt_platform_id IS 'Referência à VTT selecionada (null se personalizado)';
COMMENT ON COLUMN tables.game_platform_custom IS 'Nome customizado quando mestre seleciona "Personalizado"';
COMMENT ON COLUMN tables.game_platform_legacy IS 'Backup do campo texto livre antigo (antes da migration)';
