-- @class: online-safe
-- @requires-backup: false
-- @author: spec-085
-- @created: 2026-07-24
-- @description: Tabela de auditoria minima do parser HTML deterministico
--   (spec 085, POST /parse-html): registra que campos vieram preenchidos e
--   qual sinal de preco foi usado, sem persistir o HTML colado pelo admin
--   (nunca gravado em nenhuma coluna). Tabela nova, nao reaproveita
--   download_scraper_run/download_scraper_item_log (spec 084) — decisao
--   tecnica ja resolvida em tasks.md T4.1: trigger_kind daquele schema e
--   enum fechado sem 'html_paste', e o conceito de "run que processa N
--   items" nao cabe "parse individual, ninguem confirmou nada ainda".
--   parse_case_id e PK propria pra linkar com /ingest depois (T4.3, campo
--   opcional novo em ingestItemSchema).

CREATE TABLE IF NOT EXISTS download_scraper_parse_log (
  parse_case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_platform VARCHAR(30) NOT NULL
    CHECK (source_platform IN ('dms_guild', 'drivethrurpg')),
  admin_user_id UUID NOT NULL,
  fields_extracted JSONB NOT NULL,
  price_signal VARCHAR(30) NOT NULL
    CHECK (price_signal IN ('pwyw_tag_present', 'zero_price_no_pwyw_tag', 'nonzero_price_no_pwyw_tag')),
  confirmed_material_id UUID REFERENCES download_material(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_scraper_parse_log_admin
  ON download_scraper_parse_log(admin_user_id, created_at DESC);
