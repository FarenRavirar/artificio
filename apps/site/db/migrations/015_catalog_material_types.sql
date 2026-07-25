-- @class: online-safe
-- @requires-backup: false
-- @author: spec-086
-- @created: 2026-07-25
-- @description: Cria vocabulario Central de tipos de material, separado da arvore de sistemas.

CREATE TABLE IF NOT EXISTS catalog_material_types (
  id UUID PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NULL,
  updated_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catalog_material_types_status_check CHECK (status IN ('pending', 'active', 'merged', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_catalog_material_types_status
  ON catalog_material_types (status, name);

-- Vocabulário inicial cobre valor que o Downloads já persiste desde seu MVP.
-- UUID fixo permite backfill transacional no banco isolado do Downloads sem
-- criar FK cross-serviço nem depender de chamada HTTP durante migration.
-- Achado real (review PR #205, Sonar, Critical): o seed repetia 'active' além
-- do DEFAULT/CHECK. Omitir status usa o DEFAULT e EXCLUDED.status mantém o
-- mesmo upsert canônico sem terceira fonte literal.
INSERT INTO catalog_material_types (id, slug, name, aliases)
VALUES (
  'b071ab5e-2d16-4c58-8f0e-086000000001',
  'aventura',
  'Aventura',
  '["adventure", "aventuras"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  status = EXCLUDED.status,
  updated_at = now();
