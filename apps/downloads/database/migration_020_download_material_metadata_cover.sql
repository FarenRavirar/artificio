-- @class: online-safe
-- @requires-backup: false
-- @author: spec-082
-- @created: 2026-07-23
-- @description: Adiciona cover_image_url a download_material_metadata (T2.7,
--   spec 082) — MVP de Gestao de Midias: so URL de texto (editor cola link
--   ja hospedado externamente/Cloudinary), sem upload/storage novo, coerente
--   com decisao T2.3 (MVP somente-link-externo desta rodada). Upload real via
--   Cloudinary signed preset fica como task futura (ver tasks.md T2.7).

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
