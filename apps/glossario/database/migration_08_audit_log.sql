-- migration_08_audit_log.sql
-- Objetivo: criar trilha de auditoria administrativa append-only.
-- Correção importante: IDs em UUID para compatibilidade com schema atual.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  environment TEXT        NOT NULL CHECK (environment IN ('beta', 'prod')),
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL, -- 'term', 'user', 'migration', etc.
  entity_id   UUID,                 -- NULL para ações em lote
  actor_id    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  actor_role  TEXT        NOT NULL,
  prev_state  JSONB,
  next_state  JSONB,
  meta        JSONB
);

ALTER TABLE public.audit_log
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON public.audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor
  ON public.audit_log (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_action
  ON public.audit_log (action);

CREATE INDEX IF NOT EXISTS idx_audit_log_occurred
  ON public.audit_log (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_env
  ON public.audit_log (environment);

CREATE OR REPLACE FUNCTION public.audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é append-only: operação % não permitida', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_no_update ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

DROP TRIGGER IF EXISTS trg_audit_log_no_delete ON public.audit_log;
CREATE TRIGGER trg_audit_log_no_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_immutable();

COMMIT;

