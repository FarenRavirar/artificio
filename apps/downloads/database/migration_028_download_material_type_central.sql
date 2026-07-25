-- @class: online-safe
-- @requires-backup: false
-- @author: spec-086
-- @created: 2026-07-25
-- @description: Referencia tipos de material no vocabulario Central sem FK cross-servico.

ALTER TABLE download_material ADD COLUMN IF NOT EXISTS material_type_id UUID;

UPDATE download_material
SET material_type_id = 'b071ab5e-2d16-4c58-8f0e-086000000001',
    material_type = 'Aventura'
WHERE material_type_id IS NULL
  AND lower(trim(material_type)) IN ('adventure', 'aventura', 'aventuras');

-- Falha fechada: valor livre desconhecido exige cadastro Central explícito.
-- Não converte silenciosamente para categoria errada nem deixa referência nula.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM download_material WHERE material_type_id IS NULL) THEN
    RAISE EXCEPTION 'material_type_legacy_unmapped';
  END IF;
END
$$;

-- Achado real (review PR #205, Codex): SET NOT NULL direto pode escanear a
-- tabela segurando ACCESS EXCLUSIVE. O CHECK NOT VALID entra rápido; VALIDATE
-- faz o scan com lock mais leve; SET NOT NULL reaproveita a prova validada.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'download_material'::regclass
      AND conname = 'download_material_material_type_id_not_null'
  ) THEN
    ALTER TABLE download_material
      ADD CONSTRAINT download_material_material_type_id_not_null
      CHECK (material_type_id IS NOT NULL) NOT VALID;
  END IF;
END
$$;

ALTER TABLE download_material
  VALIDATE CONSTRAINT download_material_material_type_id_not_null;

ALTER TABLE download_material ALTER COLUMN material_type_id SET NOT NULL;

ALTER TABLE download_material
  DROP CONSTRAINT IF EXISTS download_material_material_type_id_not_null;

CREATE INDEX IF NOT EXISTS idx_download_material_material_type_id
  ON download_material (material_type_id)
  WHERE material_type_id IS NOT NULL;

-- `material_type` fica como rótulo denormalizado compatível com consumidores
-- legados. Toda escrita nova valida `material_type_id` no Central e copia o
-- nome canônico; filtros e facetas usam somente o ID.
