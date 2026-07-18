-- @class: online-safe
-- @requires-backup: false
-- @author: spec-081
-- @created: 2026-07-17
-- @description: Tabela de favoritos de usuário por mesa (T3.6 — parity StartPlaying).

CREATE TABLE table_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, table_id)
);

CREATE INDEX idx_table_favorites_table_id ON table_favorites(table_id);

COMMENT ON TABLE table_favorites IS 'Favoritos de mesa por usuário logado (bookmark do catálogo, spec 081)';
