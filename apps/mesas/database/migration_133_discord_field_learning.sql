-- @class: online-safe
-- @requires-backup: false
-- @author: spec-052-d087
-- @created: 2026-06-30
-- @description: Learning-store determinístico (D087) — correções humanas viram
--               cache campo+token consultado ANTES da IA, economizando tokens.
--               Escopo por guild + fallback global (guild_id NULL). Campos de
--               guarda: rejections/active/applied_count; key_type p/ futuro
--               aprendizado de label (DEB-052-02).

BEGIN;

CREATE TABLE IF NOT EXISTS discord_field_learning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field TEXT NOT NULL,
  input_token TEXT NOT NULL,
  output_value JSONB NOT NULL,
  guild_id TEXT,                                   -- NULL = regra global (fallback)
  key_type TEXT NOT NULL DEFAULT 'value',          -- 'value' (hoje) | 'label' (futuro DEB-052-02)
  hits INTEGER NOT NULL DEFAULT 1,                 -- reforços na correção
  rejections INTEGER NOT NULL DEFAULT 0,           -- vezes que o valor aprendido foi re-corrigido
  applied_count INTEGER NOT NULL DEFAULT 0,        -- vezes que a regra foi de fato aplicada
  active BOOLEAN NOT NULL DEFAULT TRUE,            -- desligar regra ruim sem deletar
  last_applied_at TIMESTAMPTZ,
  last_corrected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- PG16: NULLS NOT DISTINCT trata guild_id NULL como valor único (1 regra global por chave)
  CONSTRAINT discord_field_learning_key_unique
    UNIQUE NULLS NOT DISTINCT (field, input_token, guild_id, key_type)
);

-- Lookup quente: field+token+guild, só regras ativas.
CREATE INDEX IF NOT EXISTS idx_discord_field_learning_lookup
  ON discord_field_learning(field, input_token, guild_id)
  WHERE active;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'discord_field_learning'
  ) THEN
    RAISE EXCEPTION 'migration_133 falhou: tabela discord_field_learning nao criada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_field_learning' AND column_name = 'output_value'
  ) THEN
    RAISE EXCEPTION 'migration_133 falhou: coluna output_value nao criada em discord_field_learning';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'discord_field_learning' AND column_name = 'guild_id'
  ) THEN
    RAISE EXCEPTION 'migration_133 falhou: coluna guild_id nao criada em discord_field_learning';
  END IF;

  RAISE NOTICE 'migration_133: discord_field_learning ok';
END $$;

COMMIT;
