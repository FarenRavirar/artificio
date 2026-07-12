-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Indices minimos de download_material (070/spec.md §Escopo):
--   composto catalogo central + tipo + estado editorial (filtro de descoberta
--   publica, spec 073), (estado editorial, criado_em) para fila de moderacao
--   (spec 072), trigram para busca textual por titulo/resumo (mesmo padrao
--   pg_trgm ja usado em discord_parse_cases no mesas) e criador_id para
--   listagem "meus materiais" no painel (spec 074).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_download_material_catalog_type_state
  ON download_material(system_id, edition_id, material_type, editorial_state);

CREATE INDEX IF NOT EXISTS idx_download_material_state_created
  ON download_material(editorial_state, created_at);

CREATE INDEX IF NOT EXISTS idx_download_material_creator
  ON download_material(creator_id);

CREATE INDEX IF NOT EXISTS idx_download_material_title_trgm
  ON download_material USING gin (title gin_trgm_ops);
