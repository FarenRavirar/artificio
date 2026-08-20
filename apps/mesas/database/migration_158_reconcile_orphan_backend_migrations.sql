-- @class: online-safe
-- @requires-backup: false
-- @author: spec-093
-- @created: 2026-08-20
-- @description: reconciliacao das migrations orfas 006/007 (vtt_platforms e click tracking) para o contrato de migration

-- Reconciliacao das migrations 006_create_vtt_platforms.sql e
-- 007_click_tracking.sql, que viviam fora do contrato em
-- apps/mesas/backend/migrations/ e foram aplicadas em producao por fora do
-- framework (nao constam em schema_migrations).
--
-- Medido em producao (psql read-only, 2026-08-20): todas as 4 tabelas
-- (vtt_platforms, vtt_platform_suggestions, table_click_events, table_metrics),
-- as 5 colunas (tables.vtt_platform_id/game_platform_custom/game_platform_legacy/
-- game_platform e table_metrics.clicks_count), os 7 indices e o seed das 10 VTTs
-- ja existem. O backfill de game_platform_legacy ja rodou (0 linhas pendentes).
--
-- Portanto esta migration NAO recria nada: reproduz o schema em forma idempotente
-- (IF NOT EXISTS / ON CONFLICT DO NOTHING) para que o runner possa registra-la em
-- schema_migrations sem erro, e para que um banco novo parta do zero correto.
-- Rodar duas vezes e seguro — e o requisito central desta fase (AGENTS.md
-- §Migrations item 2).

-- ===== 006 — Sistema de VTT Platforms com logos =====

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

-- Migrar dados existentes (backup). Idempotente: so preenche onde
-- game_platform_legacy IS NULL. Guardado pela existencia da coluna depreciada
-- game_platform (types.ts:258): se um dia for removida, o backfill e pulado em
-- vez de quebrar a migration.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tables' AND column_name = 'game_platform'
  ) THEN
    UPDATE tables 
    SET game_platform_legacy = game_platform 
    WHERE game_platform IS NOT NULL 
      AND game_platform_legacy IS NULL;
  END IF;
END $$;

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

-- ===== 007 — Click Tracking e Otimizações de Ranking =====

-- clicks_count NAO entra aqui: ja e criado por migration_16_table_metrics.sql
-- (auditoria, Fase 2 achado 5). O ADD COLUMN do 007 original era redundante e
-- nao e passivo a sanar.

-- 2. Índice composto para performance do ranking inteligente
CREATE INDEX IF NOT EXISTS idx_table_metrics_ranking 
ON table_metrics(table_id, contacts_count, views_count, clicks_count);

-- 3. Tabela de eventos de clique para A/B testing
CREATE TABLE IF NOT EXISTS table_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  variant VARCHAR(50), -- 'with_metrics' ou 'without_metrics'
  clicked_at TIMESTAMP DEFAULT NOW()
);

-- 4. Índices para análise de A/B test
CREATE INDEX IF NOT EXISTS idx_click_events_table 
ON table_click_events(table_id);

CREATE INDEX IF NOT EXISTS idx_click_events_variant 
ON table_click_events(variant);

CREATE INDEX IF NOT EXISTS idx_click_events_clicked_at 
ON table_click_events(clicked_at);

-- 5. Comentários para documentação
COMMENT ON COLUMN table_metrics.clicks_count IS 'Contador de cliques no card da mesa (para CTR tracking)';
COMMENT ON TABLE table_click_events IS 'Eventos de clique para análise de A/B test e funil de conversão';
COMMENT ON COLUMN table_click_events.variant IS 'Variante do A/B test: with_metrics ou without_metrics';
