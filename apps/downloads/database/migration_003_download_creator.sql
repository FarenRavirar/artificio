-- @class: online-safe
-- @requires-backup: false
-- @author: spec-070
-- @created: 2026-07-11
-- @description: Cria download_creator, perfil publico de criador/publicador
--   (061/spec.md — perfis publicos separados de /painel do usuario comum).
--   user_id referencia sessao SSO (accounts.), sem FK cross-servico.

CREATE TABLE IF NOT EXISTS download_creator (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  slug VARCHAR(160) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  bio TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_creator_user
  ON download_creator(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_creator_slug
  ON download_creator(slug);
