-- @class: online-safe
-- @requires-backup: false
-- @author: spec-084
-- @created: 2026-07-24
-- @description: Schema do scraper de indexacao automatica (spec 084): origem
--   rastreavel em download_material (source_platform/source_url/
--   source_scraped_at), auditoria de execucao (download_scraper_run) e por
--   item (download_scraper_item_log), marcacao de origem em
--   download_link_check (is_scraper_origin, para a re-checagem de preco da
--   Fase 7 distinguir material de scraper), e trava petrea D119 (so
--   portugues) em download_material_metadata.language via CHECK + NOT NULL.
--   T1.1 auditou download_material_metadata em downloads-beta-db (unico
--   ambiente com o app rodando; prod ainda sem container downloads-db) —
--   0 linhas, sem dado legado, sem divergencia a resolver antes do CHECK.
--   Fase 8: detected_language/language_confident/language_checked_at em
--   download_material — resultado do languageDetector rodado 1x no submit
--   (draft->in_review), persistido pra fila de moderacao exibir sem re-rodar
--   deteccao (custo de chamada DeepSeek) a cada GET /queue.

ALTER TABLE download_material
  ADD COLUMN IF NOT EXISTS source_platform VARCHAR(30) NOT NULL DEFAULT 'manual'
    CHECK (source_platform IN (
      'manual', 'itch_io', 'drivethrurpg', 'dms_guild', 'rpg_gratis',
      'grimorios_e_dados', 'opera_rpg', 'catarse', 'newton_rocha'
    )),
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_scraped_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS detected_language VARCHAR(20),
  ADD COLUMN IF NOT EXISTS language_confident BOOLEAN,
  ADD COLUMN IF NOT EXISTS language_checked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_download_material_source_platform
  ON download_material(source_platform);

CREATE TABLE IF NOT EXISTS download_scraper_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform VARCHAR(30) NOT NULL,
  trigger_kind VARCHAR(20) NOT NULL CHECK (trigger_kind IN ('manual', 'cron', 'local_ingest')),
  status VARCHAR(20) NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed')),
  items_found INT NOT NULL DEFAULT 0,
  items_created INT NOT NULL DEFAULT 0,
  items_skipped_duplicate INT NOT NULL DEFAULT 0,
  items_skipped_not_portuguese INT NOT NULL DEFAULT 0,
  items_skipped_error INT NOT NULL DEFAULT 0,
  error_detail TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_download_scraper_run_source
  ON download_scraper_run(source_platform, started_at DESC);

CREATE TABLE IF NOT EXISTS download_scraper_item_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES download_scraper_run(id) ON DELETE CASCADE,
  material_id UUID REFERENCES download_material(id) ON DELETE SET NULL,
  source_url TEXT NOT NULL,
  outcome VARCHAR(20) NOT NULL
    CHECK (outcome IN ('created', 'skipped_duplicate', 'skipped_not_portuguese', 'skipped_error')),
  detected_language VARCHAR(20),
  error_detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_scraper_item_log_run
  ON download_scraper_item_log(run_id);

ALTER TABLE download_link_check
  ADD COLUMN IF NOT EXISTS is_scraper_origin BOOLEAN NOT NULL DEFAULT FALSE;

-- D119 (regra petrea): download_material_metadata.language so aceita 'pt'.
-- T1.1 confirmou 0 linhas em downloads-beta-db — sem UPDATE de saneamento
-- necessario antes do CHECK/NOT NULL abaixo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_material_metadata_language_pt_check'
  ) THEN
    ALTER TABLE download_material_metadata
      ALTER COLUMN language SET NOT NULL,
      ADD CONSTRAINT download_material_metadata_language_pt_check
      CHECK (language = 'pt');
  END IF;
END $$;
