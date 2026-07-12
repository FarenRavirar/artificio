-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_material e download_material_version (schema
--   isolado proprio do app downloads, spec 070). system_id/edition_id
--   referenciam o catalogo central (spec 062, apps/site) por UUID string,
--   sem FK cross-servico possivel (HTTP externo, nao FK real) — mesmo padrao
--   adotado em apps/mesas/database/migration_144_drop_tables_system_fk.sql.

CREATE TABLE IF NOT EXISTS download_material (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  description TEXT,
  material_type VARCHAR(50) NOT NULL,
  system_id UUID,
  edition_id UUID,
  creator_id UUID NOT NULL,
  editorial_state VARCHAR(30) NOT NULL DEFAULT 'draft',
  access_kind VARCHAR(30) NOT NULL DEFAULT 'external_link',
  external_url TEXT,
  storage_provider VARCHAR(30),
  storage_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_material_slug
  ON download_material(slug);

-- Historico de edicao por campo (D111 item 7): toda edicao de material,
-- incluindo o link de acesso, grava entrada com valor antigo/novo, autor e
-- timestamp desde o primeiro commit — nao e ajuste retroativo.
CREATE TABLE IF NOT EXISTS download_material_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by UUID NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_material_version_material
  ON download_material_version(material_id, changed_at);
