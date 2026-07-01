-- @migration: 134
-- @description: Perfis multi-canal para DiscordChatExporter.
-- @class: online-safe

CREATE TABLE IF NOT EXISTS discord_chat_exporter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  guild_name TEXT,
  channel_id TEXT NOT NULL,
  channel_name TEXT,
  format TEXT NOT NULL DEFAULT 'Json',
  token_enc TEXT,
  include_threads TEXT NOT NULL DEFAULT 'active',
  after TIMESTAMPTZ,
  media BOOLEAN NOT NULL DEFAULT FALSE,
  schedule_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  frequency TEXT NOT NULL DEFAULT 'daily',
  time TEXT NOT NULL DEFAULT '03:20',
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  import_dir TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT discord_chat_exporter_profiles_format_check CHECK (format = 'Json'),
  CONSTRAINT discord_chat_exporter_profiles_threads_check CHECK (include_threads IN ('none', 'active', 'all')),
  CONSTRAINT discord_chat_exporter_profiles_frequency_check CHECK (frequency IN ('hourly', 'daily', 'weekly')),
  CONSTRAINT discord_chat_exporter_profiles_time_check CHECK (time ~ '^[0-9]{2}:[0-9]{2}$'),
  CONSTRAINT discord_chat_exporter_profiles_channel_unique UNIQUE (guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_dce_profiles_enabled
  ON discord_chat_exporter_profiles (enabled, schedule_enabled, frequency);

CREATE INDEX IF NOT EXISTS idx_dce_profiles_updated_at
  ON discord_chat_exporter_profiles (updated_at DESC);
