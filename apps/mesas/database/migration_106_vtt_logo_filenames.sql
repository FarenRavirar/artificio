-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 106: Vincular logos locais aos registros de VTT
-- Objetivo: preencher logo_filename com os arquivos existentes em frontend/public/vtt-logos
-- Segurança: idempotente (reexecução mantém o mesmo estado)

UPDATE vtt_platforms
SET
  logo_filename = CASE slug
    WHEN 'alchemy-rpg' THEN 'alchemy-rpg.webp'
    WHEN 'dndbeyond-maps' THEN 'dndbeyond-maps.webp'
    WHEN 'fantasy-grounds-unity' THEN 'fantasy-grounds-unity.webp'
    WHEN 'foundry-vtt' THEN 'foundry-vtt.webp'
    WHEN 'owlbear-rodeo' THEN 'owlbear-rodeo.webp'
    WHEN 'quest-portal' THEN 'quest-portal.webp'
    WHEN 'roll20' THEN 'roll20.webp'
    WHEN 'tabletop-simulator' THEN 'tabletop-simulator.webp'
    WHEN 'talespire' THEN 'talespire.webp'
    ELSE logo_filename
  END,
  updated_at = NOW()
WHERE slug IN (
  'alchemy-rpg',
  'dndbeyond-maps',
  'fantasy-grounds-unity',
  'foundry-vtt',
  'owlbear-rodeo',
  'quest-portal',
  'roll20',
  'tabletop-simulator',
  'talespire'
);
