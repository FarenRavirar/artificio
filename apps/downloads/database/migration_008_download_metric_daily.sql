-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_metric_daily — agregado diario de downloads.
--   Download = clique logado no CTA de acesso, deduplicado por (conta,
--   material) — 1 download unico por conta (D111 item 7). Deduplicacao real
--   fica numa tabela de eventos brutos na spec 072/075; aqui so o agregado
--   diario consumido por metricas publicas/admin (061/spec.md F2/T2.5).

CREATE TABLE IF NOT EXISTS download_metric_daily (
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0 CHECK (download_count >= 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  PRIMARY KEY (material_id, metric_date)
);
