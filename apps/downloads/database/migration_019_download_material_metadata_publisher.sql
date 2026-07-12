-- @class: online-safe
-- @requires-backup: false
-- @author: spec-075
-- @created: 2026-07-12
-- @description: Adiciona publisher_name a download_material_metadata —
--   campo de credito estruturado (editora/selo), ausente ate agora. Achado
--   do mantenedor (2026-07-12): cadastro de material nao tinha nenhum local
--   pra registrar editora. Texto livre, sem tabela/conta propria (editora
--   nao e entidade de login, so credito).

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS publisher_name TEXT;
