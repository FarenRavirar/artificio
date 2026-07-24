-- @class: online-safe
-- @requires-backup: false
-- @author: spec-083
-- @created: 2026-07-23
-- @description: Adiciona rejection_category_id a download_material (T1.2,
--   spec 083) — motivo de reprovacao passa a ter categoria estruturada alem
--   do texto livre ja existente (rejection_reason, migration_011). FK
--   nullable (so preenchida quando editorial_state='rejected'); nunca
--   deletada fisicamente para preservar auditoria de material ja reprovado
--   com categoria depois desativada.

ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS rejection_category_id UUID REFERENCES download_rejection_category(id);

CREATE INDEX IF NOT EXISTS idx_download_material_rejection_category
  ON download_material(rejection_category_id);
