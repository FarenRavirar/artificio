-- @class: manual-risk
-- @requires-backup: true
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_17_drop_imgur_legacy.sql
-- Remoção estrutural definitiva de legado de imagens (Imgur/deletehash)
-- =============================================================================

BEGIN;

ALTER TABLE gm_profiles
  DROP COLUMN IF EXISTS avatar_deletehash,
  DROP COLUMN IF EXISTS avatar_imgur_id,
  DROP COLUMN IF EXISTS banner_deletehash,
  DROP COLUMN IF EXISTS banner_imgur_id;

ALTER TABLE tables
  DROP COLUMN IF EXISTS cover_deletehash,
  DROP COLUMN IF EXISTS cover_imgur_id;

DROP TABLE IF EXISTS imgur_cleanup_log;
DROP TYPE IF EXISTS cleanup_status;

COMMIT;
