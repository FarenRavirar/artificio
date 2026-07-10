-- Migration 006 — fundação do catálogo canônico de sistemas (Spec 062 I1).
-- Serviço central dentro do site/artificiorpg.com. Aditivo e idempotente.
-- O runner (db/migrate.ts) envolve cada arquivo em BEGIN/COMMIT — NÃO incluir transação aqui.

CREATE TABLE IF NOT EXISTS catalog_versions (
  id BIGSERIAL PRIMARY KEY,
  version BIGINT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalog_versions (version, reason)
SELECT 1, 'initial_catalog_foundation'
WHERE NOT EXISTS (SELECT 1 FROM catalog_versions WHERE version = 1);

CREATE TABLE IF NOT EXISTS catalog_nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT NULL REFERENCES catalog_nodes(id),
  node_type TEXT NOT NULL,
  canonical_slug TEXT NOT NULL,
  path_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  name_pt TEXT NULL,
  description TEXT NULL,
  official_website_url TEXT NULL,
  logo_media_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  merged_into_id TEXT NULL REFERENCES catalog_nodes(id),
  version BIGINT NOT NULL DEFAULT 1,
  created_by TEXT NULL,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_nodes_type_check CHECK (node_type IN ('system', 'edition', 'subsystem', 'variant')),
  CONSTRAINT catalog_nodes_status_check CHECK (status IN ('draft', 'pending', 'active', 'rejected', 'merged')),
  CONSTRAINT catalog_nodes_root_type_check CHECK (
    (parent_id IS NULL AND node_type = 'system')
    OR (parent_id IS NOT NULL AND node_type IN ('edition', 'subsystem', 'variant'))
  ),
  CONSTRAINT catalog_nodes_no_self_merge CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_nodes_parent_slug
  ON catalog_nodes ((COALESCE(parent_id, '')), canonical_slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_nodes_path_slug
  ON catalog_nodes (path_slug);
CREATE INDEX IF NOT EXISTS idx_catalog_nodes_parent_id ON catalog_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_catalog_nodes_status ON catalog_nodes(status);
CREATE INDEX IF NOT EXISTS idx_catalog_nodes_type ON catalog_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_catalog_nodes_merged_into ON catalog_nodes(merged_into_id);

CREATE TABLE IF NOT EXISTS catalog_aliases (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NOT NULL REFERENCES catalog_nodes(id),
  alias TEXT NOT NULL,
  locale TEXT NULL,
  kind TEXT NOT NULL DEFAULT 'alias',
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_aliases_kind_check CHECK (kind IN ('alias', 'abbreviation', 'localized_name'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_aliases_node_alias_locale
  ON catalog_aliases (node_id, lower(alias), COALESCE(locale, ''));
CREATE INDEX IF NOT EXISTS idx_catalog_aliases_alias ON catalog_aliases(lower(alias));

CREATE TABLE IF NOT EXISTS catalog_redirects (
  source_id TEXT PRIMARY KEY,
  target_id TEXT NOT NULL REFERENCES catalog_nodes(id),
  reason TEXT NULL,
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_redirects_no_self CHECK (source_id <> target_id)
);

CREATE TABLE IF NOT EXISTS catalog_suggestions (
  id TEXT PRIMARY KEY,
  batch_id TEXT NULL,
  batch_index INT NOT NULL DEFAULT 0,
  parent_suggestion_index INT NULL,
  parent_id TEXT NULL REFERENCES catalog_nodes(id),
  node_type TEXT NOT NULL,
  name TEXT NOT NULL,
  name_pt TEXT NULL,
  canonical_slug TEXT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  resolution_type TEXT NULL,
  resolved_node_id TEXT NULL REFERENCES catalog_nodes(id),
  requester_id TEXT NULL,
  reviewer_id TEXT NULL,
  review_notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ NULL,
  CONSTRAINT catalog_suggestions_type_check CHECK (node_type IN ('system', 'edition', 'subsystem', 'variant')),
  CONSTRAINT catalog_suggestions_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT catalog_suggestions_resolution_check CHECK (
    resolution_type IS NULL OR resolution_type IN ('create_node', 'create_chain', 'merge_existing', 'create_alias', 'reject')
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_suggestions_status ON catalog_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_catalog_suggestions_batch ON catalog_suggestions(batch_id, batch_index);

CREATE TABLE IF NOT EXISTS catalog_audit_events (
  id BIGSERIAL PRIMARY KEY,
  node_id TEXT NULL REFERENCES catalog_nodes(id),
  suggestion_id TEXT NULL REFERENCES catalog_suggestions(id),
  event_type TEXT NOT NULL,
  actor_id TEXT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  catalog_version BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalog_audit_events_node ON catalog_audit_events(node_id);
CREATE INDEX IF NOT EXISTS idx_catalog_audit_events_suggestion ON catalog_audit_events(suggestion_id);
CREATE INDEX IF NOT EXISTS idx_catalog_audit_events_created ON catalog_audit_events(created_at DESC);
