-- @class: online-safe
-- @requires-backup: false
-- @author: codex
-- @created: 2026-06-02
-- @description: adiciona status/hints de agenda a definir em tables sem alterar table_schedules

BEGIN;

ALTER TABLE tables
  ADD COLUMN IF NOT EXISTS schedule_day_status TEXT NOT NULL DEFAULT 'defined',
  ADD COLUMN IF NOT EXISTS schedule_time_status TEXT NOT NULL DEFAULT 'defined',
  ADD COLUMN IF NOT EXISTS schedule_day_hint TEXT NULL,
  ADD COLUMN IF NOT EXISTS schedule_time_hint TIME NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_schedule_day_status_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_schedule_day_status_check
      CHECK (schedule_day_status IN ('defined', 'to_define'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_schedule_time_status_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_schedule_time_status_check
      CHECK (schedule_time_status IN ('defined', 'to_define'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_schedule_day_hint_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_schedule_day_hint_check
      CHECK (
        schedule_day_hint IS NULL
        OR schedule_day_hint IN ('segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tables_schedule_tbd_hint_check'
  ) THEN
    ALTER TABLE tables
      ADD CONSTRAINT tables_schedule_tbd_hint_check
      CHECK (
        (schedule_day_status = 'defined' OR schedule_day_hint IS NULL)
        AND (schedule_time_status = 'defined' OR schedule_time_hint IS NULL)
      );
  END IF;
END $$;

COMMENT ON COLUMN tables.schedule_day_status IS 'Status do dia da semana da mesa: defined ou to_define.';
COMMENT ON COLUMN tables.schedule_time_status IS 'Status do horario da mesa: defined ou to_define.';
COMMENT ON COLUMN tables.schedule_day_hint IS 'Dia conhecido quando nao ha table_schedules completo.';
COMMENT ON COLUMN tables.schedule_time_hint IS 'Horario conhecido quando nao ha table_schedules completo.';

COMMIT;
