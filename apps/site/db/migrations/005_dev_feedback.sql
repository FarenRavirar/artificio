-- Migration 005 — feedback (problema/sugestão) do widget público (Spec 021).
-- Aditivo e idempotente. Roda igual em pglite (dev) e PG16 (prod). O runner
-- (db/migrate.ts) envolve cada arquivo em BEGIN/COMMIT — NÃO incluir transação aqui.
-- Paridade de dados com mesas/glossario: kind/title/description + contexto +
-- console/network (JSONB) + screenshot + triagem (status/notes/archived).

CREATE TABLE IF NOT EXISTS dev_feedback (
  id BIGSERIAL PRIMARY KEY,
  reporter_id TEXT NULL,            -- SSO user id (se logado); NULL = anônimo
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
  screenshot_public_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  admin_notes TEXT NULL,
  reviewed_by TEXT NULL,
  reviewed_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_feedback_status      ON dev_feedback(status);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_kind        ON dev_feedback(kind);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_created_at  ON dev_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_archived_at ON dev_feedback(archived_at);
