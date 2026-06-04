-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 100: Adicionar campo slots_open para sistema de vagas
-- Data: 2026-04-07
-- Descrição: Separar "vagas totais" de "vagas abertas para recrutamento"

-- Adicionar novo campo
ALTER TABLE tables ADD COLUMN slots_open INTEGER;

-- Migrar dados existentes (assumir que todas vagas não preenchidas estão abertas)
UPDATE tables 
SET slots_open = GREATEST(0, slots_total - COALESCE(slots_filled, 0))
WHERE slots_open IS NULL;

-- Tornar campo obrigatório
ALTER TABLE tables ALTER COLUMN slots_open SET NOT NULL;

-- Adicionar constraint de validação
ALTER TABLE tables ADD CONSTRAINT check_slots_valid 
CHECK (
  slots_open >= 0 
  AND slots_filled >= 0 
  AND slots_open <= slots_total
);

-- Comentários
COMMENT ON COLUMN tables.slots_open IS 'Número de vagas abertas para recrutamento';
COMMENT ON CONSTRAINT check_slots_valid ON tables IS 'Valida que vagas abertas não excedem o total e são não-negativas';
