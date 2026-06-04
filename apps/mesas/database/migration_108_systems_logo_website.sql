-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 108: Adiciona logo_filename e website_url para sistemas
-- Objetivo: Permitir que sistemas raiz tenham logo e link oficial
-- Padrão: VttPlatformsTable (logo_filename, website_url)

ALTER TABLE systems ADD COLUMN IF NOT EXISTS logo_filename TEXT;
ALTER TABLE systems ADD COLUMN IF NOT EXISTS website_url TEXT;

COMMENT ON COLUMN systems.logo_filename IS 'Nome do arquivo de logo em /sys-logos/ (ex: dnd.svg)';
COMMENT ON COLUMN systems.website_url IS 'URL oficial do sistema (ex: https://dnd.wizards.com)';
