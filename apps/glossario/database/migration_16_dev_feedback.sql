-- @class: online-safe
-- @requires-backup: false
-- @author: spec-021-feedback-site-glossario
-- @created: 2026-06-13
-- @description: cria tabela dev_feedback (relatos de problema/sugestao com contexto tecnico) para o widget de feedback do glossario. Paridade com mesas (Spec 021).

-- Aditiva e idempotente. Nada destrutivo (online-safe). Tabela isolada: nenhuma
-- coluna/constraint de tabela existente e alterada. Segue o fluxo de migration
-- proprio do glossario (D059), nao o runner do mesas.

CREATE TABLE IF NOT EXISTS public.dev_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
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
  reviewed_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  archived_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dev_feedback_kind_check'
  ) THEN
    ALTER TABLE public.dev_feedback
      ADD CONSTRAINT dev_feedback_kind_check
      CHECK (kind IN ('bug', 'suggestion'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dev_feedback_status_check'
  ) THEN
    ALTER TABLE public.dev_feedback
      ADD CONSTRAINT dev_feedback_status_check
      CHECK (status IN ('new', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_dev_feedback_status      ON public.dev_feedback(status);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_kind        ON public.dev_feedback(kind);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_created_at  ON public.dev_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_feedback_archived_at ON public.dev_feedback(archived_at);

COMMENT ON TABLE public.dev_feedback IS 'Relatos de problema (bug) e sugestoes de melhoria do widget de feedback (Spec 021).';
COMMENT ON COLUMN public.dev_feedback.kind IS 'Tipo do relato: bug ou suggestion.';
COMMENT ON COLUMN public.dev_feedback.reporter_role IS 'Role do reporter no envio (visitor|user|admin) ou null.';
COMMENT ON COLUMN public.dev_feedback.contact_email IS 'E-mail opcional opt-in para retorno (anonimo).';
COMMENT ON COLUMN public.dev_feedback.console_errors IS 'Buffer de erros de console/globais; sem dados sensiveis.';
COMMENT ON COLUMN public.dev_feedback.network_errors IS 'Falhas de rede HTTP >= 400 (url, metodo, status); sem corpo/headers/tokens.';
COMMENT ON COLUMN public.dev_feedback.screenshot_public_id IS 'public_id Cloudinary da captura, para exclusao do asset junto do registro.';

-- Verificacao de pos-condicao (falha a migration se a tabela nao existir).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'dev_feedback'
  ) THEN
    RAISE EXCEPTION 'migration_16 falhou: public.dev_feedback nao criada';
  END IF;
  RAISE NOTICE 'migration_16 dev_feedback: ok';
END $$;
