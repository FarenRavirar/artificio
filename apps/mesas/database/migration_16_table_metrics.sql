-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 16: Tabela de métricas de engajamento de mesas
-- Rastreia visualizações, cliques, contatos e favoritos

CREATE TABLE IF NOT EXISTS table_metrics (
  id SERIAL PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  views_count INTEGER DEFAULT 0 NOT NULL,
  clicks_count INTEGER DEFAULT 0 NOT NULL,
  contacts_count INTEGER DEFAULT 0 NOT NULL,
  favorites_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(table_id)
);

CREATE INDEX idx_table_metrics_table_id ON table_metrics(table_id);

-- Popular métricas para mesas existentes (valores iniciais = 0)
INSERT INTO table_metrics (table_id, views_count, clicks_count, contacts_count, favorites_count)
SELECT id, 0, 0, 0, 0
FROM tables
ON CONFLICT (table_id) DO NOTHING;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_table_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_table_metrics_updated_at
BEFORE UPDATE ON table_metrics
FOR EACH ROW
EXECUTE FUNCTION update_table_metrics_updated_at();
