-- Migration 007: Click Tracking e Otimizações de Ranking
-- Adiciona suporte para tracking de cliques e A/B testing

-- 1. Adicionar coluna clicks_count em table_metrics
ALTER TABLE table_metrics 
ADD COLUMN IF NOT EXISTS clicks_count INTEGER DEFAULT 0;

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
