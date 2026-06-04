-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 11: Audit Log para Candidatos
-- CORREÇÃO DT-REQ28-13: Histórico de edições

CREATE TABLE IF NOT EXISTS aggregator_candidate_audit (
  id SERIAL PRIMARY KEY,
  candidate_id VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'approved', 'rejected'
  changed_fields JSONB, -- Campos que foram alterados
  old_values JSONB, -- Valores antigos
  new_values JSONB, -- Valores novos
  user_id INTEGER, -- ID do admin que fez a ação
  user_email VARCHAR(255), -- Email do admin
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (candidate_id) REFERENCES aggregator_import_candidates(id) ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX idx_candidate_audit_candidate_id ON aggregator_candidate_audit(candidate_id);
CREATE INDEX idx_candidate_audit_action ON aggregator_candidate_audit(action);
CREATE INDEX idx_candidate_audit_created_at ON aggregator_candidate_audit(created_at DESC);
CREATE INDEX idx_candidate_audit_user_id ON aggregator_candidate_audit(user_id);

-- Comentários
COMMENT ON TABLE aggregator_candidate_audit IS 'Histórico de todas as ações realizadas em candidatos de importação';
COMMENT ON COLUMN aggregator_candidate_audit.changed_fields IS 'Array de nomes dos campos que foram alterados';
COMMENT ON COLUMN aggregator_candidate_audit.old_values IS 'Valores anteriores dos campos alterados';
COMMENT ON COLUMN aggregator_candidate_audit.new_values IS 'Novos valores dos campos alterados';
