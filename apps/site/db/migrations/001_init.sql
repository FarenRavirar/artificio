-- Migration 001 — store nativo do blog Artifício RPG (D005/D048).
-- Fonte da verdade pós-import; o importador WP (descartável) popula isto.
-- SQL idempotente (IF NOT EXISTS). Roda igual em pglite (dev) e PG16 (prod).

-- Taxonomias: categorias (aninhadas via parent_id) + tags. Preserva term_id do WP.
CREATE TABLE IF NOT EXISTS taxonomies (
  id           BIGINT PRIMARY KEY,
  kind         TEXT NOT NULL CHECK (kind IN ('category', 'tag')),
  slug         TEXT NOT NULL,
  name         TEXT NOT NULL,
  parent_id    BIGINT REFERENCES taxonomies(id) ON DELETE SET NULL,
  count        INTEGER NOT NULL DEFAULT 0,
  UNIQUE (kind, slug)
);

-- Mídia: mapa WP -> Cloudinary. Dry-run mantém wp_url (cloudinary_url NULL).
CREATE TABLE IF NOT EXISTS media (
  id             BIGINT PRIMARY KEY,
  wp_url         TEXT NOT NULL,
  cloudinary_url TEXT,
  alt            TEXT,
  width          INTEGER,
  height         INTEGER,
  mime           TEXT
);

-- Posts do blog. slug = chave natural IMUTÁVEL pós-import (R2).
CREATE TABLE IF NOT EXISTS posts (
  id                BIGINT PRIMARY KEY,
  slug              TEXT NOT NULL UNIQUE,
  title             TEXT NOT NULL,
  excerpt           TEXT NOT NULL DEFAULT '',
  content_html      TEXT NOT NULL,
  toc               JSONB NOT NULL DEFAULT '[]',
  status            TEXT NOT NULL DEFAULT 'publish',
  published_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ,
  reading_time      INTEGER NOT NULL DEFAULT 1,
  featured_url      TEXT,
  seo_title         TEXT,
  seo_description   TEXT,
  canonical         TEXT,
  og_image          TEXT,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- N:N posts <-> taxonomias.
CREATE TABLE IF NOT EXISTS post_taxonomies (
  post_id      BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  taxonomy_id  BIGINT NOT NULL REFERENCES taxonomies(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, taxonomy_id)
);

-- Pages institucionais (sobre, contato, políticas...). slug imutável.
CREATE TABLE IF NOT EXISTS pages (
  id               BIGINT PRIMARY KEY,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  content_html     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'publish',
  updated_at       TIMESTAMPTZ,
  seo_description  TEXT
);

-- Comentários importados (read-only por ora; reativar é futuro).
CREATE TABLE IF NOT EXISTS comments (
  id            BIGINT PRIMARY KEY,
  post_id       BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_name   TEXT NOT NULL DEFAULT '',
  content_html  TEXT NOT NULL,
  created_at    TIMESTAMPTZ,
  parent_id     BIGINT
);

-- Mapa de redirects 301 (slug/URL WP -> nova rota). Ativa só no cutover (D047).
CREATE TABLE IF NOT EXISTS redirects (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  from_path  TEXT NOT NULL UNIQUE,
  to_path    TEXT NOT NULL,
  code       INTEGER NOT NULL DEFAULT 301
);

CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_post_tax_taxonomy ON post_taxonomies(taxonomy_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
