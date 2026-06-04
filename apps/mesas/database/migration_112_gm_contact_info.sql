-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- Migration 110: Adiciona campo de contatos do mestre no perfil público
-- Data: 2026-04-18
-- Autor: Sistema
-- Descrição: Permite que o mestre configure múltiplos contatos para o perfil público (WhatsApp, Email, Discord, Formulário)

-- Adicionar coluna para armazenar contatos do mestre (array de objetos)
ALTER TABLE gm_profiles
  ADD COLUMN IF NOT EXISTS contact_methods JSONB DEFAULT '[]'::jsonb;

-- Comentário explicativo
COMMENT ON COLUMN gm_profiles.contact_methods IS 'Array de contatos do mestre para perfil público - [{ channel: "whatsapp"|"email"|"discord"|"form", value: string, label?: string, discord_server_url?: string }]';

-- Índice GIN para busca eficiente em JSONB
CREATE INDEX IF NOT EXISTS idx_gm_profiles_contact_methods 
  ON gm_profiles USING GIN (contact_methods);
