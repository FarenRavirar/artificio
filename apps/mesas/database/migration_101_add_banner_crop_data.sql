-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 101: Adicionar campo banner_crop_data para crop visual via CSS
-- Data: 2026-04-14
-- Descrição: Armazenar coordenadas de crop visual (x, y, width, height) para display com object-position CSS

-- Adicionar novo campo como JSONB (armazena objeto {x, y, width, height})
ALTER TABLE tables ADD COLUMN IF NOT EXISTS banner_crop_data JSONB;

-- Permitir nulo (mesas antigas não têm crop)
ALTER TABLE tables ALTER COLUMN banner_crop_data DROP NOT NULL;

-- Valor padrão null
ALTER TABLE tables ALTER COLUMN banner_crop_data SET DEFAULT NULL;

-- Comentário
COMMENT ON COLUMN tables.banner_crop_data IS 'Coordenadas de crop visual {x, y, width, height} para display via CSS object-position';

-- Index para consultas rápidas (opcional, JSONB pode ser indexado se necessário)
-- CREATE INDEX idx_tables_banner_crop_data ON tables ((banner_crop_data IS NOT NULL)) WHERE banner_crop_data IS NOT NULL;