-- Migration 004 — biblioteca de mídia nativa (spec 011, fase 2, T18).
-- Estende a tabela `media` (que hoje guarda só mídia importada do WP) p/ upload nativo
-- (Cloudinary ou local/dev) com metadados editoriais. Aditivo e idempotente (ADD COLUMN IF NOT EXISTS).
-- Roda igual em pglite (dev) e PG16 (prod). Preserva `media`/`media_map` importados.

-- Ids nativos vêm do mesmo sequence dos posts/pages (>=1e6), bem acima dos ids do WP (pequenos).
ALTER TABLE media ALTER COLUMN id SET DEFAULT nextval('site_content_id_seq');

ALTER TABLE media ADD COLUMN IF NOT EXISTS source               TEXT NOT NULL DEFAULT 'wp';  -- wp | cloudinary | local
ALTER TABLE media ADD COLUMN IF NOT EXISTS url                  TEXT;            -- URL canônica servida (secure_url Cloudinary, /uploads/... local, ou wp_url)
ALTER TABLE media ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS size_bytes           BIGINT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS caption              TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS title                TEXT;
ALTER TABLE media ADD COLUMN IF NOT EXISTS created_by           TEXT;            -- SSO user id de quem subiu
ALTER TABLE media ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE media ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: registros importados do WP ganham `url` canônica (Cloudinary se migrado, senão a do WP).
UPDATE media SET url = COALESCE(cloudinary_url, wp_url) WHERE url IS NULL;

-- wp_url passa a ser opcional (uploads nativos não têm origem WP). Mantém os existentes.
ALTER TABLE media ALTER COLUMN wp_url DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_source     ON media(source);
