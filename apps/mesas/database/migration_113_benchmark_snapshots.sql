-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 113: Snapshots de benchmarks dinâmicos para insights do mestre
-- Data: 2026-04-18
-- Autor: Sistema
-- Descrição: Materializa percentis da plataforma (P25/P50/P75) por métrica para comparação contextualizada no dashboard

CREATE TABLE IF NOT EXISTS benchmark_snapshots (
  id BIGSERIAL PRIMARY KEY,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  segment VARCHAR(50) NOT NULL DEFAULT 'global',
  metric VARCHAR(20) NOT NULL,
  p25 NUMERIC(14,4) NOT NULL,
  p50 NUMERIC(14,4) NOT NULL,
  p75 NUMERIC(14,4) NOT NULL,
  sample_size INTEGER NOT NULL CHECK (sample_size >= 0)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_segment_calc
  ON benchmark_snapshots (segment, calculated_at DESC);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_metric
  ON benchmark_snapshots (metric);

COMMENT ON TABLE benchmark_snapshots IS 'Snapshots de benchmarks dinâmicos (quartis) para insights de performance das mesas.';
COMMENT ON COLUMN benchmark_snapshots.segment IS 'Segmento de benchmark (ex: global, system:dnd5e)';
COMMENT ON COLUMN benchmark_snapshots.metric IS 'Métrica benchmarkeada (views, clicks, contacts, ctr)';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'benchmark_snapshots'
  ) THEN
    RAISE EXCEPTION 'Migration 113 failed: table benchmark_snapshots not created';
  END IF;

  RAISE NOTICE 'Migration 113 completed successfully';
END $$;
