-- Migration 003 — autoria nativa (spec 011, fase 0/1).
-- Habilita criar/editar posts e pages pelo admin (não só importar do WP).
-- Aditivo e idempotente (ADD COLUMN IF NOT EXISTS). Roda igual em pglite (dev) e PG16 (prod).

-- Sequence p/ ids de conteúdo NATIVO (criado no admin), bem acima dos ids do WP (pequenos)
-- p/ não colidir com import idempotente por id. Default não atrapalha inserts explícitos do importador.
CREATE SEQUENCE IF NOT EXISTS site_content_id_seq START 1000000;
ALTER TABLE posts ALTER COLUMN id SET DEFAULT nextval('site_content_id_seq');
ALTER TABLE pages ALTER COLUMN id SET DEFAULT nextval('site_content_id_seq');

-- POSTS: editor de blocos (D051), Open Graph completo, autoria, timestamps.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS block_doc       JSONB;          -- documento BlockNote (re-edição lossless)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS og_title        TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS og_description  TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS twitter_card    TEXT NOT NULL DEFAULT 'summary_large_image';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS noindex         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS author_id       TEXT;            -- SSO user id (ownership); NULL nos importados
ALTER TABLE posts ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- PAGES: mesmo editor e campos de SEO/OG; status já existe.
ALTER TABLE pages ADD COLUMN IF NOT EXISTS block_doc       JSONB;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS excerpt         TEXT NOT NULL DEFAULT '';
ALTER TABLE pages ADD COLUMN IF NOT EXISTS seo_title       TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS canonical       TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS og_title        TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS og_description  TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS og_image        TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS noindex         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS author_id       TEXT;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ;
ALTER TABLE pages ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_posts_status   ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_author   ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_pages_status   ON pages(status);
