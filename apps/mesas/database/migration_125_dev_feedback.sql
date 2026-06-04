-- @class: online-safe
-- @requires-backup: false
-- @author: codex
-- @created: 2026-06-02
-- @description: cria tabela dev_feedback para relatos de problema/sugestao com contexto tecnico (Spec 022)

BEGIN;

CREATE TABLE IF NOT EXISTS dev_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reporter_role TEXT NULL,
  contact_email TEXT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  page_url TEXT NULL,
  route_path TEXT NULL,
  page_title TEXT NULL,
  environment TEXT NULL,
  user_agent TEXT NULL,
  viewport TEXT NULL,
  console_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  network_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  screenshot_url TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT NULL,
  reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dev_feedback_kind_check'
  ) THEN
    ALTER TABLE dev_feedback
      ADD CONSTRAINT dev_feedback_kind_check
      CHECK (kind IN ('bug', 'suggestion'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dev_feedback_status_check'
  ) THEN
    ALTER TABLE dev_feedback
      ADD CONSTRAINT dev_feedback_status_check
      CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dev_feedback_status     ON dev_feedback(status);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_kind       ON dev_feedback(kind);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_created_at ON dev_feedback(created_at DESC);

COMMENT ON TABLE dev_feedback IS 'Relatos de problema (bug) e sugestoes de melhoria enviados pelo widget de feedback (Spec 022).';
COMMENT ON COLUMN dev_feedback.kind IS 'Tipo do relato: bug ou suggestion.';
COMMENT ON COLUMN dev_feedback.reporter_role IS 'Role do reporter no momento do envio (visitor|player|gm|admin) ou null.';
COMMENT ON COLUMN dev_feedback.contact_email IS 'E-mail opcional opt-in para retorno (anonimo).';
COMMENT ON COLUMN dev_feedback.console_errors IS 'Buffer de erros de console/globais coletados; sem dados sensiveis.';
COMMENT ON COLUMN dev_feedback.network_errors IS 'Falhas de rede HTTP >= 400 (url, metodo, status); sem corpo/headers/tokens.';
COMMENT ON COLUMN dev_feedback.environment IS 'Ambiente derivado do hostname (beta|production|development).';

COMMIT;
