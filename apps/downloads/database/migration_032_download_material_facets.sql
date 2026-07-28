-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-089
-- @created: 2026-07-27
-- @description: Estrutura autores/artistas em arrays, adiciona chaves de
--   comparação para facetas e preserva template/hints no log para a medição
--   da Fase 5. `credits` permanece intacto como fallback dos registros
--   históricos cujo papel não pode ser inferido com segurança.

ALTER TABLE download_material_metadata
  ADD COLUMN IF NOT EXISTS publisher_key TEXT,
  ADD COLUMN IF NOT EXISTS authors TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS author_keys TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS artists TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS artist_keys TEXT[] NOT NULL DEFAULT '{}';

-- Fase 5 mede também itens rejeitados, que não possuem material/metadata.
-- O log precisa preservar template e hints observados antes do ingest.
ALTER TABLE download_scraper_item_log
  ADD COLUMN IF NOT EXISTS source_category TEXT,
  ADD COLUMN IF NOT EXISTS system_hint TEXT,
  ADD COLUMN IF NOT EXISTS material_type_hint TEXT;

-- Espelha facetNormalization.ts sem depender da extensão `unaccent`.
UPDATE download_material_metadata
SET publisher_key = NULLIF(
  trim(BOTH ' ' FROM regexp_replace(
    regexp_replace(
      regexp_replace(
        translate(lower(publisher_name),
          'áàâãäéèêëíìîïóòôõöúùûüçñ',
          'aaaaaeeeeiiiiooooouuuucn'),
        '&', ' e ', 'g'),
      '[^a-z0-9]+', ' ', 'g'),
    '^(editora|editorial|ltda|limitada|eireli|me) | (editora|editorial|ltda|limitada|eireli|me)$',
    '', 'g')),
  '')
WHERE publisher_name IS NOT NULL;

-- Remove palavras de borda repetidamente, igual aos `while` de
-- normalizePublisherKey(). Uma única regexp deixaria, por exemplo,
-- "Acme Editora Ltda" diferente de "Acme".
DO $$
DECLARE
  changed_rows INTEGER;
BEGIN
  LOOP
    UPDATE download_material_metadata
    SET publisher_key = NULLIF(trim(BOTH ' ' FROM regexp_replace(
      publisher_key,
      '^(editora|editorial|ltda|limitada|eireli|me)( |$)| (editora|editorial|ltda|limitada|eireli|me)$',
      '', 'g')),
      '')
    WHERE publisher_key IS NOT NULL
      AND publisher_key ~ '^(editora|editorial|ltda|limitada|eireli|me)( |$)| (editora|editorial|ltda|limitada|eireli|me)$';
    GET DIAGNOSTICS changed_rows = ROW_COUNT;
    EXIT WHEN changed_rows = 0;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_download_material_metadata_publisher_key
  ON download_material_metadata (publisher_key)
  WHERE publisher_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_download_material_metadata_author_keys
  ON download_material_metadata USING GIN (author_keys);

ALTER TABLE download_material_metadata
  DROP CONSTRAINT IF EXISTS download_material_metadata_author_shape_check,
  ADD CONSTRAINT download_material_metadata_author_shape_check
    CHECK (cardinality(authors) = cardinality(author_keys)),
  DROP CONSTRAINT IF EXISTS download_material_metadata_artist_shape_check,
  ADD CONSTRAINT download_material_metadata_artist_shape_check
    CHECK (cardinality(artists) = cardinality(artist_keys));
