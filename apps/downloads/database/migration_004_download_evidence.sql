-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_evidence — prova de gratuidade/permissao (D100)
--   exigida em toda aprovacao. Retencao ILIMITADA (D111 item 2): tabela
--   deliberadamente SEM coluna de expurgo/prazo/TTL. Nao adicionar essa
--   coluna sem reabrir decisao com o mantenedor.

CREATE TABLE IF NOT EXISTS download_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  evidence_kind VARCHAR(30) NOT NULL,
  evidence_url TEXT,
  storage_provider VARCHAR(30),
  storage_key TEXT,
  submitted_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_evidence_material
  ON download_evidence(material_id);
