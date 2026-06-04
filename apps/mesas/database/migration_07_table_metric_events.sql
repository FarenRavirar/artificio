-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 07: Tabela de eventos de métricas para anti-abuso
-- Registra cada ação de métrica (view, click, contact, favorite) com fingerprint do cliente
-- Permite deduplicação e rate limiting por IP/user-agent

CREATE TABLE IF NOT EXISTS table_metric_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'click', 'contact', 'favorite')),
  fingerprint_hash VARCHAR(64) NOT NULL, -- SHA256 de (IP + User-Agent)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas de deduplicação (verificar se já existe evento recente)
CREATE INDEX idx_metric_events_dedup ON table_metric_events(table_id, action, fingerprint_hash, created_at DESC);

-- Índice para limpeza periódica de eventos antigos
CREATE INDEX idx_metric_events_cleanup ON table_metric_events(created_at);

COMMENT ON TABLE table_metric_events IS 'Registro de eventos de métricas para anti-abuso e deduplicação';
COMMENT ON COLUMN table_metric_events.fingerprint_hash IS 'Hash SHA256 de (IP + User-Agent) para identificar cliente sem armazenar PII';
COMMENT ON COLUMN table_metric_events.action IS 'Tipo de métrica: view, click, contact, favorite';
