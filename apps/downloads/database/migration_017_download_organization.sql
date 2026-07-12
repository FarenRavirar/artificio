-- @class: online-safe
-- @requires-backup: false
-- @author: spec-074
-- @created: 2026-07-12
-- @description: Escopo minimo funcional de "Organizacoes" do painel (T1.6),
--   sem spec/decisao previa detalhando o dominio — autorizado nominalmente
--   pelo mantenedor (2026-07-12) como escopo minimo. Organizacao = grupo de
--   creators sob um nome comum (ex.: editora/coletivo publicando varios
--   materiais); membro tem role dentro da organizacao. Sem vinculo com
--   download_material nesta rodada (associacao org->material fica para
--   quando houver demanda real).

CREATE TABLE IF NOT EXISTS download_organization (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(160) NOT NULL,
  name VARCHAR(160) NOT NULL,
  owner_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_organization_slug
  ON download_organization(slug);

CREATE TABLE IF NOT EXISTS download_organization_member (
  organization_id UUID NOT NULL REFERENCES download_organization(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (organization_id, user_id)
);

DROP TRIGGER IF EXISTS set_updated_at ON download_organization;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON download_organization
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
