-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 103: sugestões multilíngues e sugestões de cenários
-- 1) Adiciona name_pt em system_suggestions
-- 2) Cria scenario_suggestions

ALTER TABLE system_suggestions
  ADD COLUMN IF NOT EXISTS name_pt TEXT;

CREATE TABLE IF NOT EXISTS scenario_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_pt TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  user_notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenario_suggestions_user_id
  ON scenario_suggestions(user_id);

CREATE INDEX IF NOT EXISTS idx_scenario_suggestions_status
  ON scenario_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_scenario_suggestions_created_at
  ON scenario_suggestions(created_at DESC);
