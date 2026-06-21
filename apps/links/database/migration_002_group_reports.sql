-- @class: online-safe
-- @requires-backup: false
-- @author: Faren Ravirar
-- @created: 2026-06-21
-- @description: Tabela group_reports — denúncias da comunidade (convite quebrado, conteúdo impróprio, etc.)

CREATE TABLE IF NOT EXISTS group_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id       UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  reason         TEXT NOT NULL CHECK (reason IN ('convite_quebrado', 'conteudo_improprio', 'grupo_inativo', 'outro')),
  note           TEXT,
  reporter_email TEXT,
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_reports_status_created_idx ON group_reports (status, created_at);
