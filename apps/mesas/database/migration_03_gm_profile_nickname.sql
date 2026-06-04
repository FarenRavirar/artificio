-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_03_gm_profile_nickname.sql
-- Campo de nickname público para mestre (sem sobrescrever profiles.display_name)
-- =============================================================================

BEGIN;

ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS nickname TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'gm_profiles_nickname_length_check'
  ) THEN
    ALTER TABLE gm_profiles
      ADD CONSTRAINT gm_profiles_nickname_length_check
      CHECK (nickname IS NULL OR char_length(btrim(nickname)) BETWEEN 2 AND 40);
  END IF;
END $$;

COMMIT;
