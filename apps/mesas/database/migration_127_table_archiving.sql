-- @class: online-safe
-- @requires-backup: false
-- @author: claude
-- @created: 2026-06-13
-- @description: arquivamento de mesas (D-MESAS1) - colunas archived_at, published_at + backfill + indices

BEGIN;

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS archived_at  TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;

-- Backfill da ancora de publicacao para mesas ja visiveis. Nao temos a data real
-- de publicacao historica, entao usamos created_at como proxy (refinado dai pra frente
-- pelo handler de status -> active). O auto-arquivamento usa COALESCE(published_at, created_at).
UPDATE tables
   SET published_at = created_at
 WHERE published_at IS NULL
   AND status IN ('active', 'full');

CREATE INDEX IF NOT EXISTS idx_tables_archived_at  ON tables(archived_at);
CREATE INDEX IF NOT EXISTS idx_tables_published_at ON tables(published_at);

COMMENT ON COLUMN tables.archived_at  IS 'Quando arquivada (some do catalogo publico; NULL = nao arquivada). Manual (dono/admin) ou auto (>1 mes publicada, prod-only). D-MESAS1.';
COMMENT ON COLUMN tables.published_at IS 'Quando a mesa passou a publica (status->active) pela 1a vez. Ancora da regra de auto-arquivamento (fallback created_at). D-MESAS1.';

COMMIT;
