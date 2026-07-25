-- @class: manual-risk
-- @requires-backup: true
-- @author: spec-085
-- @created: 2026-07-24
-- @description: Registry de plataformas de origem (spec 085, emenda E1-E7)
--   substitui o enum fechado DownloadSourcePlatform por cadastro em banco —
--   mantenedor vai adicionar 100+ sites ao Modo 3 (colar HTML) e nao da
--   pra abrir PR por site novo. Tabela nova (download_scraper_platform,
--   PK=slug, D-B) com seed identico ao comportamento atual (9 plataformas
--   do enum + storytellersvault, E3 — fixture ja existia como negativo,
--   vira positivo na Fase 7). Troca CHECK->FK em download_material e
--   download_scraper_parse_log (unicas com CHECK real, migration_022:21-25
--   e migration_024:18-19); download_scraper_run so ganha FK (nunca teve
--   CHECK, migration_022:47); download_scraper_item_log nao tem coluna
--   source_platform (herda via run_id), nada a fazer nela. T6.0 confirmou
--   beta com 0 linhas nas 3 tabelas afetadas antes desta migration —
--   pg_dump de rollback em /tmp/t6_0_backup_20260724.sql na VM.

CREATE TABLE IF NOT EXISTS download_scraper_platform (
  slug VARCHAR(30) PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  supports_auto_scrape BOOLEAN NOT NULL DEFAULT FALSE,
  supports_price_recheck BOOLEAN NOT NULL DEFAULT FALSE,
  parser_kind VARCHAR(30) NOT NULL DEFAULT 'json_ld_generic',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- domain nullable so para 'manual' (material criado a mao, sem HTML
-- colado, sem hostname a casar). UNIQUE do Postgres aceita multiplos NULL,
-- entao futuras plataformas sem dominio tambem cabem. Trava anti-fallback
-- fica no parser (T7.1): busca sempre "WHERE domain = $1", nunca
-- "IS NOT DISTINCT FROM", senao HTML sem canonical reconhecivel cairia em
-- 'manual' silenciosamente em vez de dar unsupported_platform.
-- Dominio preenchido so quando confirmado no codigo real (scraper
-- existente com URL fixa/testada). rpg_gratis/catarse/newton_rocha nao tem
-- adapter automatico implementado (sem arquivo em services/scrapers/) —
-- domain fica NULL em vez de chute; cadastro correto e tarefa de quem
-- ligar o scraper dessas fontes depois, nao desta migration.
INSERT INTO download_scraper_platform
  (slug, name, domain, supports_auto_scrape, supports_price_recheck, parser_kind)
VALUES
  ('manual', 'Manual', NULL, FALSE, FALSE, 'json_ld_generic'),
  ('itch_io', 'itch.io', 'itch.io', TRUE, TRUE, 'json_ld_generic'),
  ('drivethrurpg', 'DriveThruRPG', 'www.drivethrurpg.com', FALSE, FALSE, 'onebookshelf'),
  ('dms_guild', 'DMs Guild', 'www.dmsguild.com', FALSE, FALSE, 'onebookshelf'),
  ('rpg_gratis', 'RPG Grátis', NULL, FALSE, FALSE, 'json_ld_generic'),
  ('grimorios_e_dados', 'Grimórios & Dados', 'grimorios-e-dados.itch.io', TRUE, TRUE, 'json_ld_generic'),
  ('opera_rpg', 'Opera RPG', 'operarpg.com.br', TRUE, FALSE, 'json_ld_generic'),
  ('catarse', 'Catarse', NULL, FALSE, FALSE, 'json_ld_generic'),
  ('newton_rocha', 'Newton Rocha', NULL, FALSE, FALSE, 'json_ld_generic'),
  ('storytellersvault', 'Storytellers Vault', 'www.storytellersvault.com', FALSE, FALSE, 'onebookshelf')
ON CONFLICT (slug) DO NOTHING;

-- download_material.source_platform TEM CHECK inline (migration_022:21-25).
-- Nome auto-gerado pelo Postgres: download_material_source_platform_check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_material_source_platform_check'
  ) THEN
    ALTER TABLE download_material DROP CONSTRAINT download_material_source_platform_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_material_source_platform_fkey'
  ) THEN
    ALTER TABLE download_material
      ADD CONSTRAINT download_material_source_platform_fkey
      FOREIGN KEY (source_platform) REFERENCES download_scraper_platform(slug);
  END IF;
END $$;

-- download_scraper_parse_log.source_platform TEM CHECK inline
-- IN ('dms_guild','drivethrurpg') (migration_024:18-19). Nome
-- auto-gerado: download_scraper_parse_log_source_platform_check.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_scraper_parse_log_source_platform_check'
  ) THEN
    ALTER TABLE download_scraper_parse_log DROP CONSTRAINT download_scraper_parse_log_source_platform_check;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_scraper_parse_log_source_platform_fkey'
  ) THEN
    ALTER TABLE download_scraper_parse_log
      ADD CONSTRAINT download_scraper_parse_log_source_platform_fkey
      FOREIGN KEY (source_platform) REFERENCES download_scraper_platform(slug);
  END IF;
END $$;

-- download_scraper_run.source_platform NAO TEM CHECK (migration_022:47,
-- so VARCHAR(30) NOT NULL) — nada a dropar, so ADD FOREIGN KEY.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'download_scraper_run_source_platform_fkey'
  ) THEN
    ALTER TABLE download_scraper_run
      ADD CONSTRAINT download_scraper_run_source_platform_fkey
      FOREIGN KEY (source_platform) REFERENCES download_scraper_platform(slug);
  END IF;
END $$;

-- download_scraper_item_log nao tem coluna source_platform (herda via
-- run_id, confirmado em db/types.ts:216-226) — nada a fazer aqui.

-- Achado real (review PR #201, CodeRabbit, nitpick): FK sem indice no lado
-- referenciante forca seq scan em UPDATE/DELETE no lado referenciado
-- (download_scraper_platform.slug) pra checar violacao, e em filtro por
-- source_platform nas 3 tabelas.
CREATE INDEX IF NOT EXISTS idx_download_material_source_platform
  ON download_material (source_platform);

CREATE INDEX IF NOT EXISTS idx_download_scraper_parse_log_source_platform
  ON download_scraper_parse_log (source_platform);

CREATE INDEX IF NOT EXISTS idx_download_scraper_run_source_platform
  ON download_scraper_run (source_platform);
