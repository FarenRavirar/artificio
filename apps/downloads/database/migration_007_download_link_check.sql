-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_link_check — historico de verificacao de
--   saude de link (checker isolado, SSRF-safe, implementado de fato na spec
--   075). D111 item 7: publico ve so a ultima checagem agregada via join com
--   download_material_version; aqui fica o historico completo p/ admin.

CREATE TABLE IF NOT EXISTS download_link_check (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  checked_url TEXT NOT NULL,
  http_status INTEGER,
  is_healthy BOOLEAN NOT NULL,
  error_detail TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_link_check_material
  ON download_link_check(material_id, checked_at);
