-- CORREÇÃO DT-11: Backfill de slots_open para mesas antigas
-- Data: 2026-04-07
-- Descrição: Mesas criadas antes da migration_100 têm slots_open = NULL

-- Atualizar mesas antigas com slots_open = slots_total (todas vagas abertas por padrão)
UPDATE tables 
SET slots_open = slots_total 
WHERE slots_open IS NULL;

-- Verificar resultado
SELECT 
  COUNT(*) as total_mesas,
  COUNT(slots_open) as mesas_com_slots_open,
  COUNT(*) - COUNT(slots_open) as mesas_sem_slots_open
FROM tables;
