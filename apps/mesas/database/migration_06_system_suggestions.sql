-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 06: System Suggestions
-- Tabela para sugestões de sistemas pelos usuários

CREATE TABLE IF NOT EXISTS system_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES systems(id) ON DELETE SET NULL,
  suggestion_type VARCHAR(50) NOT NULL CHECK (suggestion_type IN ('new', 'edit', 'variant')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_at TIMESTAMP,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_suggestions_user_id ON system_suggestions(user_id);
CREATE INDEX idx_system_suggestions_status ON system_suggestions(status);
CREATE INDEX idx_system_suggestions_created_at ON system_suggestions(created_at DESC);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
