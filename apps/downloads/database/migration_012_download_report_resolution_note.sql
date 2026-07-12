-- @class: online-safe
-- @requires-backup: false
-- @author: spec-072
-- @created: 2026-07-12
-- @description: Adiciona resolution_note a download_report — nota de decisao
--   do moderador separada do relato original do denunciante (details). Achado
--   de review (PR #151): PATCH /reports/:id sobrescrevia details com a nota
--   de resolucao, apagando o texto original da denuncia.

ALTER TABLE download_report
  ADD COLUMN IF NOT EXISTS resolution_note TEXT;
