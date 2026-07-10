-- Migration 007 — mapa legado→canônico para importação do catálogo Mesas (Spec 062 I2).
-- Aditivo e idempotente. Ambientes beta/prod mantêm mapas independentes.
-- O runner (db/migrate.ts) envolve cada arquivo em BEGIN/COMMIT — NÃO incluir transação aqui.

CREATE TABLE IF NOT EXISTS catalog_legacy_mappings (
  id BIGSERIAL PRIMARY KEY,
  source_app TEXT NOT NULL,
  source_environment TEXT NOT NULL,
  source_table TEXT NOT NULL,
  legacy_id TEXT NOT NULL,
  canonical_id TEXT NOT NULL REFERENCES catalog_nodes(id),
  source_path_slug TEXT NULL,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  checksum TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_legacy_mappings_env_check CHECK (source_environment IN ('beta', 'prod', 'local')),
  CONSTRAINT catalog_legacy_mappings_app_check CHECK (source_app IN ('mesas', 'glossario', 'downloads')),
  UNIQUE (source_app, source_environment, source_table, legacy_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_legacy_mappings_canonical
  ON catalog_legacy_mappings(canonical_id);
CREATE INDEX IF NOT EXISTS idx_catalog_legacy_mappings_source
  ON catalog_legacy_mappings(source_app, source_environment, source_table);
