-- @class: online-safe
-- @requires-backup: false
-- @author: spec-081
-- @created: 2026-07-17
-- @description: Cria tabela table_reports para denuncias de mesa especifica (T6.6 — parity StartPlaying "Report Adventure").

CREATE TABLE table_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  reporter_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE table_reports
  ADD CONSTRAINT table_reports_reason_check
  CHECK (reason IN ('golpe', 'conteudo_inadequado', 'spam', 'informacao_falsa', 'outro'));

ALTER TABLE table_reports
  ADD CONSTRAINT table_reports_status_check
  CHECK (status IN ('new', 'reviewed', 'dismissed'));

CREATE INDEX idx_table_reports_table_id ON table_reports(table_id);
CREATE INDEX idx_table_reports_status ON table_reports(status);

COMMENT ON TABLE table_reports IS 'Denúncia de mesa específica (conteúdo/golpe/spam), diferente do dev_feedback que é sobre a ferramenta (spec 081, T6.6).';
COMMENT ON COLUMN table_reports.reason IS 'Motivo curado: golpe, conteudo_inadequado, spam, informacao_falsa, outro.';
COMMENT ON COLUMN table_reports.reporter_user_id IS 'Null quando denunciante não está logado (denúncia permitida sem auth).';
