-- @class: online-safe
-- @requires-backup: false
-- @author: spec-090
-- @created: 2026-07-30
-- @description: Papel moderator, versionamento e auditoria de papel global

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role_version INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users WHERE role NOT IN ('user', 'moderator', 'admin')
  ) THEN
    RAISE EXCEPTION 'users.role contém valor fora do contrato global';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass
      AND conname = 'users_role_check'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'moderator', 'admin')) NOT VALID;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS global_role_audit (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  old_role_version INTEGER NOT NULL,
  new_role_version INTEGER NOT NULL,
  actor_id TEXT,
  reason TEXT NOT NULL DEFAULT 'unspecified',
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_global_role_audit_user_changed
  ON global_role_audit(user_id, changed_at DESC, id DESC);

CREATE OR REPLACE FUNCTION audit_global_role_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role_version := OLD.role_version + 1;
    INSERT INTO global_role_audit (
      user_id,
      old_role,
      new_role,
      old_role_version,
      new_role_version,
      actor_id,
      reason
    ) VALUES (
      OLD.id,
      OLD.role,
      NEW.role,
      OLD.role_version,
      NEW.role_version,
      NULLIF(current_setting('app.actor_id', true), ''),
      COALESCE(NULLIF(current_setting('app.role_reason', true), ''), 'unspecified')
    );
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.users'::regclass
      AND tgname = 'users_audit_global_role_change'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER users_audit_global_role_change
      BEFORE UPDATE OF role ON users
      FOR EACH ROW
      EXECUTE FUNCTION audit_global_role_change();
  END IF;
END $$;
