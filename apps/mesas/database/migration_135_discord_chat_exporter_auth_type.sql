-- @migration: 135
-- @class: online-safe
-- @requires-backup: false
-- @author: spec-057
-- @created: 2026-07-01
-- @description: Adiciona modo de autenticacao por perfil do DiscordChatExporter.

ALTER TABLE discord_chat_exporter_profiles
  ADD COLUMN IF NOT EXISTS auth_type TEXT NOT NULL DEFAULT 'global';

ALTER TABLE discord_chat_exporter_profiles
  DROP CONSTRAINT IF EXISTS discord_chat_exporter_profiles_auth_type_check;

ALTER TABLE discord_chat_exporter_profiles
  ADD CONSTRAINT discord_chat_exporter_profiles_auth_type_check
  CHECK (auth_type IN ('global', 'user', 'bot')) NOT VALID;

ALTER TABLE discord_chat_exporter_profiles
  VALIDATE CONSTRAINT discord_chat_exporter_profiles_auth_type_check;
