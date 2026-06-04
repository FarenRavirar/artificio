-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_14_user_profiles_complete.sql
-- Sistema completo de perfil de usuário (jogador + mestre + Discord)
-- Executar: cat migration_14_user_profiles_complete.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

-- =============================================================================
-- 1. AUTH PROVIDERS (suporte multi-provider)
-- =============================================================================

CREATE TABLE IF NOT EXISTS auth_providers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,  -- 'google' | 'discord'
    provider_user_id    TEXT NOT NULL,
    provider_data       JSONB,          -- dados extras do provider
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX idx_auth_providers_user ON auth_providers(user_id);
CREATE INDEX idx_auth_providers_provider ON auth_providers(provider);

-- =============================================================================
-- 2. ALTERAÇÕES EM USERS (username + location)
-- =============================================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location TEXT;

-- Criar índice para username (usado em URLs públicas)
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- =============================================================================
-- 3. ALTERAÇÕES EM PROFILES (avatar)
-- =============================================================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- =============================================================================
-- 4. PLAYER PROFILES (perfil de jogador)
-- =============================================================================

CREATE TABLE IF NOT EXISTS player_profiles (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    
    -- Experiência
    experience_level    TEXT,  -- 'iniciante' | 'intermediario' | 'veterano'
    
    -- Estilo de jogo (escala 1-5 para cada aspecto)
    playstyle           JSONB,  -- { "combat": 3, "roleplay": 5, "exploration": 4, "strategy": 4 }
    
    -- Disponibilidade
    preferred_days      TEXT[],  -- ['segunda', 'quarta', 'sexta']
    preferred_time      TEXT,    -- 'manha' | 'tarde' | 'noite'
    
    -- Preferência de preço
    pricing_preference  TEXT,    -- 'free' | 'paid' | 'both'
    
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_player_profiles_user ON player_profiles(user_id);

-- =============================================================================
-- 5. ALTERAÇÕES EM GM_PROFILES (Discord + experiência + estilo)
-- =============================================================================

-- Discord
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS discord_connected BOOLEAN DEFAULT false;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS discord_username TEXT;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS discord_id TEXT;

-- Selo Covil (controlado por admin)
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS covil_verified BOOLEAN DEFAULT false;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS covil_verified_at TIMESTAMPTZ;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS covil_verified_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- Experiência e monetização
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS average_price NUMERIC(10,2);

-- Estilo de mestria (escala 1-5 para cada aspecto)
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS gm_style JSONB;  -- { "narrative": 5, "tactical": 3, "sandbox": 4, "railroad": 2 }

-- Ferramentas e formato
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS tools JSONB;        -- ["Foundry VTT", "Discord", "Roll20"]
ALTER TABLE gm_profiles ADD COLUMN IF NOT EXISTS game_format JSONB;  -- { "session_length": "3-4h", "frequency": "semanal", "group_size": "4-6" }

-- Índices para Discord
CREATE INDEX IF NOT EXISTS idx_gm_profiles_discord_id ON gm_profiles(discord_id) WHERE discord_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gm_profiles_covil ON gm_profiles(covil_verified) WHERE covil_verified = true;

-- =============================================================================
-- 6. USER SYSTEMS (relacionamento usuário ↔ sistemas)
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_systems (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    system_id   UUID NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,  -- 'favorite' | 'gm'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, system_id, type)
);

CREATE INDEX idx_user_systems_user ON user_systems(user_id);
CREATE INDEX idx_user_systems_system ON user_systems(system_id);
CREATE INDEX idx_user_systems_type ON user_systems(type);

-- =============================================================================
-- 7. MIGRAÇÃO DE DADOS EXISTENTES
-- =============================================================================

-- Migrar google_id para auth_providers (se existir)
INSERT INTO auth_providers (user_id, provider, provider_user_id)
SELECT id, 'google', google_id
FROM users
WHERE google_id IS NOT NULL
ON CONFLICT (provider, provider_user_id) DO NOTHING;

-- Gerar username automático para usuários existentes sem username
UPDATE users
SET username = LOWER(REGEXP_REPLACE(display_name, '[^a-zA-Z0-9]', '', 'g'))
WHERE username IS NULL
AND display_name IS NOT NULL;

-- Garantir unicidade de username (adicionar sufixo numérico se necessário)
WITH duplicates AS (
    SELECT username, ROW_NUMBER() OVER (PARTITION BY username ORDER BY created_at) as rn
    FROM users
    WHERE username IS NOT NULL
)
UPDATE users u
SET username = u.username || duplicates.rn
FROM duplicates
WHERE u.username = duplicates.username
AND duplicates.rn > 1;

-- =============================================================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =============================================================================

COMMENT ON TABLE auth_providers IS 'Provedores de autenticação (Google, Discord) vinculados a usuários';
COMMENT ON TABLE player_profiles IS 'Perfil de jogador com preferências e estilo de jogo';
COMMENT ON TABLE user_systems IS 'Relacionamento entre usuários e sistemas de RPG (favoritos ou sistemas que mestra)';

COMMENT ON COLUMN gm_profiles.covil_verified IS 'Selo "Mestre do Covil" - controlado manualmente por admin';
COMMENT ON COLUMN gm_profiles.covil_verified_at IS 'Data de aprovação do selo Covil';
COMMENT ON COLUMN gm_profiles.covil_verified_by IS 'Admin que aprovou o selo Covil';
COMMENT ON COLUMN gm_profiles.discord_connected IS 'Indica se o mestre conectou sua conta Discord';

-- =============================================================================
-- FIM DA MIGRATION 14
-- =============================================================================
