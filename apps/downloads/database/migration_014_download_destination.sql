-- @class: online-safe
-- @requires-backup: false
-- @author: spec-073
-- @created: 2026-07-12
-- @description: Cria download_destination (DEB-073-02) — id opaco de
--   redirecionamento desacoplado do slug do material. Um material publicado
--   tem no maximo um destino ativo; troca de slug ou rotacao de link nao
--   muda o destinationId ja distribuido.

CREATE TABLE IF NOT EXISTS download_destination (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_destination_material
  ON download_destination(material_id);
