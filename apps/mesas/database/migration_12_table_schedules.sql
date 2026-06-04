-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 12: Tabela table_schedules para múltiplos horários
-- REQ-27: Agenda Estruturada
-- Data: 05/04/2026
-- Autor: Sistema (via análise PRIORIDADES_OBVIAS.MD)

-- Criar tabela para múltiplos horários de sessão por mesa
CREATE TABLE IF NOT EXISTS table_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo')),
  start_time TIME NOT NULL,
  end_time TIME,
  frequency TEXT NOT NULL CHECK (frequency IN ('semanal', 'quinzenal', 'mensal', 'avulsa')),
  slots_per_session INT,
  is_ongoing BOOLEAN DEFAULT false,
  notes TEXT,
  sort_order SMALLINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_table_schedules_table_id ON table_schedules(table_id);
CREATE INDEX idx_table_schedules_day ON table_schedules(day_of_week);

-- Comentários para documentação
COMMENT ON TABLE table_schedules IS 'Múltiplos horários de sessão para uma mesa (REQ-27). Suporta mesas com múltiplos dias, horários e frequências diferentes por sessão.';
COMMENT ON COLUMN table_schedules.table_id IS 'FK para tables(id). ON DELETE CASCADE garante limpeza automática ao deletar mesa.';
COMMENT ON COLUMN table_schedules.day_of_week IS 'Dia da semana da sessão. Valores: segunda, terça, quarta, quinta, sexta, sábado, domingo.';
COMMENT ON COLUMN table_schedules.start_time IS 'Horário de início da sessão (formato TIME: HH:MM:SS).';
COMMENT ON COLUMN table_schedules.end_time IS 'Horário de término da sessão. NULL = duração não especificada.';
COMMENT ON COLUMN table_schedules.frequency IS 'Frequência da sessão. Valores: semanal, quinzenal, mensal, avulsa.';
COMMENT ON COLUMN table_schedules.slots_per_session IS 'Vagas específicas desta sessão. NULL = herda de tables.slots_total.';
COMMENT ON COLUMN table_schedules.is_ongoing IS 'Sessão já em andamento (não aceita novos jogadores nesta sessão específica).';
COMMENT ON COLUMN table_schedules.notes IS 'Observações opcionais sobre esta sessão (ex: "Apenas para jogadores veteranos", "Sessão de encerramento").';
COMMENT ON COLUMN table_schedules.sort_order IS 'Ordem de exibição (0 = primeira). Permite reordenação manual das sessões.';

-- Validação: end_time deve ser maior que start_time (se preenchido)
-- Nota: Validação adicional será feita no backend para evitar constraint complexo no banco
