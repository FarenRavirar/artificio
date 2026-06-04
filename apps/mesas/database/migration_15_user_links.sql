-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 15: User Links (Conteúdo & Redes)
-- Adiciona tabela para links externos do mestre (YouTube, Spotify, etc)

CREATE TABLE user_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  url TEXT NOT NULL,
  type TEXT NOT NULL, -- youtube, spotify, twitch, twitter, article, website
  
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Índice para busca por usuário
CREATE INDEX idx_user_links_user_id ON user_links(user_id);

-- Índice para ordenação
CREATE INDEX idx_user_links_sort_order ON user_links(user_id, sort_order);

-- Comentários
COMMENT ON TABLE user_links IS 'Links externos do mestre (YouTube, Spotify, artigos, etc) para prova social';
COMMENT ON COLUMN user_links.type IS 'Tipo detectado automaticamente: youtube, spotify, twitch, twitter, article, website';
COMMENT ON COLUMN user_links.sort_order IS 'Ordem de exibição (menor = primeiro)';
