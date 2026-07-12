-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_material_metadata para campos de taxonomia
--   condicionais/opcionais definidos em 061/spec.md F3/T3.1 (cenario, genero,
--   idioma, formato, plataforma, acesso, barreiras, licenca, publico, idade,
--   avisos, tags), separados de download_material para nao inchar a tabela
--   principal com colunas majoritariamente nulas.

CREATE TABLE IF NOT EXISTS download_material_metadata (
  material_id UUID PRIMARY KEY REFERENCES download_material(id) ON DELETE CASCADE,
  scenario VARCHAR(100),
  genre VARCHAR(100),
  language VARCHAR(20),
  file_format VARCHAR(30),
  vtt_platform VARCHAR(60),
  access_barriers JSONB NOT NULL DEFAULT '[]'::jsonb,
  license_kind VARCHAR(60),
  license_url TEXT,
  credits TEXT,
  target_audience VARCHAR(60),
  age_rating VARCHAR(20),
  content_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
