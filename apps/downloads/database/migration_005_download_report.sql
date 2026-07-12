-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_report — denuncias com canal/categoria,
--   prioridade P0-P3 e estado do caso (061/spec.md F3/T3.4, D105). Fluxo
--   completo de triagem/decisao fica na spec 072; aqui so o modelo de dados.

CREATE TABLE IF NOT EXISTS download_report (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  reporter_user_id UUID,
  category VARCHAR(40) NOT NULL,
  priority VARCHAR(4) NOT NULL DEFAULT 'P3'
    CHECK (priority IN ('P0','P1','P2','P3')),
  case_state VARCHAR(30) NOT NULL DEFAULT 'open'
    CHECK (case_state IN ('open','in_review','resolved','dismissed')),
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_download_report_material
  ON download_report(material_id);

CREATE INDEX IF NOT EXISTS idx_download_report_state
  ON download_report(case_state, priority);
