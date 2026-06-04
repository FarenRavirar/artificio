-- @class: online-safe
-- @requires-backup: false
-- @author: sdd-013-discord-settings-config
-- @created: 2026-05-03
-- @description: Cria tabela cifrada de configuracoes Discord para token do bot.

-- 1. Configuracoes Discord cifradas
CREATE TABLE IF NOT EXISTS discord_settings (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id    VARCHAR(50),
  key         VARCHAR(100) NOT NULL,
  value       TEXT         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_settings_guild_key_unique UNIQUE (guild_id, key)
);

CREATE UNIQUE INDEX IF NOT EXISTS discord_settings_global_key_unique
  ON discord_settings (key)
  WHERE guild_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_discord_settings_key
  ON discord_settings (key);

-- 2. Validacao
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'discord_settings'
  ) THEN
    RAISE EXCEPTION 'migration falhou: discord_settings nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'discord_settings_global_key_unique'
  ) THEN
    RAISE EXCEPTION 'migration falhou: indice unico global de discord_settings nao criado';
  END IF;

  RAISE NOTICE 'migration_116: discord_settings ok';
END $$;
