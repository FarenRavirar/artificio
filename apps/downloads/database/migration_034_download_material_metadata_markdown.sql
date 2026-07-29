-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-089
-- @created: 2026-07-28
-- @description: Fonte rica canônica em Markdown GFM; HTML legado preservado para rollback

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS description_markdown TEXT NULL;

-- O campo plano já é a projeção sanitizada do conteúdo rico. Usá-lo no
-- backfill torna a perda de formatação explícita e segura, sem tentar converter
-- HTML com regex. description_html permanece intacto durante a transição.
UPDATE download_material_metadata AS metadata
SET description_markdown = NULLIF(BTRIM(material.description), '')
FROM download_material AS material
WHERE material.id = metadata.material_id
  AND metadata.description_markdown IS NULL
  AND material.description IS NOT NULL;

COMMENT ON COLUMN download_material_metadata.description_markdown IS
  'Markdown GFM canônico editado por usuários; description_html é legado temporário de rollback.';
