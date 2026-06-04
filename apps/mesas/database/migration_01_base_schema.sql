-- @class: online-safe
-- @requires-backup: false
-- @author: legacy
-- @created: 2026-04-20
-- @description: retro-migration header

-- =============================================================================
-- migration_01_base_schema.sql
-- Schema base do Anúncios de Mesas RPG — Artifício RPG
-- Executar manualmente: cat migration_01_base_schema.sql | docker exec -i mesas-beta-db psql -U admin -d mesas_rpg
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role AS ENUM ('visitor', 'player', 'gm', 'admin');
CREATE TYPE table_status AS ENUM ('draft', 'active', 'full', 'cancelled', 'ended', 'pending_review');
CREATE TYPE table_type AS ENUM ('campanha', 'one-shot', 'oneshot-serie', 'aberta');
CREATE TYPE table_audience AS ENUM ('livre', 'adultos');
CREATE TYPE table_modality AS ENUM ('online', 'presencial', 'hibrida');
CREATE TYPE table_origin AS ENUM ('manual', 'imported');
CREATE TYPE price_type AS ENUM ('gratuita', 'paga');
CREATE TYPE price_frequency AS ENUM ('sessao', 'mes', 'campanha');
CREATE TYPE experience_level AS ENUM ('todos', 'iniciante', 'intermediario', 'veterano');
CREATE TYPE cleanup_status AS ENUM ('success', 'not_found', 'error');

-- =============================================================================
-- TABELAS DE TAXONOMIA (sem dependências)
-- =============================================================================

CREATE TABLE systems (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tags (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE platforms (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name       TEXT NOT NULL,
    slug       TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- USUÁRIOS E PERFIS
-- =============================================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id           TEXT NOT NULL UNIQUE,
    email               TEXT NOT NULL UNIQUE,
    role                user_role NOT NULL DEFAULT 'player',
    refresh_token       TEXT,
    privacy_public      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    bio          TEXT,
    languages    TEXT[] DEFAULT '{}',
    tags         TEXT[] DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE gm_profiles (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    slug              TEXT NOT NULL UNIQUE,
    bio_long          TEXT,
    avatar_url        TEXT,
    avatar_deletehash TEXT,  -- NUNCA retornar em rotas públicas
    avatar_imgur_id   TEXT,
    banner_url        TEXT,
    banner_deletehash TEXT,  -- NUNCA retornar em rotas públicas
    banner_imgur_id   TEXT,
    languages         TEXT[] DEFAULT '{}',
    specialties       TEXT[] DEFAULT '{}',
    badges            TEXT[] DEFAULT '{}',  -- ex: Neurodivergente, Streamer, Worldbuilder
    tables_count      INTEGER NOT NULL DEFAULT 0,
    avg_rating        NUMERIC(3,2),
    reviews_count     INTEGER NOT NULL DEFAULT 0,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_preferences (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    systems         UUID[] DEFAULT '{}',
    tags            UUID[] DEFAULT '{}',
    languages       TEXT[] DEFAULT '{}',
    platforms       UUID[] DEFAULT '{}',
    weekdays        INTEGER[] DEFAULT '{}',  -- 0=Dom, 1=Seg ... 6=Sáb
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MESAS (entidade central)
-- =============================================================================

CREATE TABLE tables (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug                TEXT NOT NULL UNIQUE,
    gm_id               UUID REFERENCES gm_profiles(id) ON DELETE SET NULL,
    system_id           UUID REFERENCES systems(id) ON DELETE SET NULL,
    title               TEXT NOT NULL,
    description         TEXT,
    cover_url           TEXT,
    cover_deletehash    TEXT,  -- NUNCA retornar em rotas públicas
    cover_imgur_id      TEXT,
    origin              table_origin NOT NULL DEFAULT 'manual',
    status              table_status NOT NULL DEFAULT 'draft',
    type                table_type NOT NULL,
    audience            table_audience NOT NULL DEFAULT 'livre',
    modality            table_modality NOT NULL DEFAULT 'online',
    price_type          price_type NOT NULL DEFAULT 'gratuita',
    price_value         NUMERIC(10,2),
    price_frequency     price_frequency,
    slots_total         INTEGER NOT NULL DEFAULT 4,
    slots_filled        INTEGER NOT NULL DEFAULT 0,
    language            TEXT NOT NULL DEFAULT 'Português',
    experience_level    experience_level NOT NULL DEFAULT 'todos',
    starts_at           TIMESTAMPTZ,
    city                TEXT,   -- opcional, só para presencial/hibrida
    state               TEXT,   -- opcional, só para presencial/hibrida
    content_warnings    TEXT[] DEFAULT '{}',
    safety_tools        TEXT[] DEFAULT '{}',
    source_url          TEXT,
    source_id           UUID,   -- FK para sources (AggregatorBot)
    featured            BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT slots_filled_valid CHECK (slots_filled >= 0 AND slots_filled <= slots_total),
    CONSTRAINT price_value_required CHECK (
        price_type = 'gratuita' OR (price_type = 'paga' AND price_value IS NOT NULL)
    )
);

CREATE TABLE table_schedules (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id    UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    weekday     INTEGER,           -- 0=Dom ... 6=Sáb (para recorrentes)
    scheduled_at TIMESTAMPTZ,     -- data exata (para pontuais)
    time_start  TIME,
    time_end    TIME,
    timezone    TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    recurring   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE table_platforms (
    table_id    UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    platform_id UUID NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
    PRIMARY KEY (table_id, platform_id)
);

CREATE TABLE table_tags (
    table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    tag_id   UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (table_id, tag_id)
);

-- =============================================================================
-- HISTÓRICO E AUDITORIA
-- =============================================================================

CREATE TABLE table_history (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id    UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    field       TEXT NOT NULL,
    old_value   TEXT,
    new_value   TEXT,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE imgur_cleanup_log (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type  TEXT NOT NULL,   -- 'table' ou 'gm_profile'
    entity_id    UUID NOT NULL,
    imgur_id     TEXT NOT NULL,
    status       cleanup_status NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    error_detail TEXT
);

-- =============================================================================
-- FONTES EXTERNAS (AggregatorBot) — Fase 7, tabelas criadas desde o início
-- =============================================================================

CREATE TABLE sources (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name         TEXT NOT NULL,
    url          TEXT NOT NULL UNIQUE,
    type         TEXT NOT NULL,   -- 'facebook', 'reddit', 'discord', 'whatsapp'
    active       BOOLEAN NOT NULL DEFAULT TRUE,
    cron_schedule TEXT,
    last_run_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE imported_tables (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id    UUID NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_url   TEXT NOT NULL,
    raw_data     JSONB,
    status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'approved', 'rejected', 'duplicate'
    table_id     UUID REFERENCES tables(id) ON DELETE SET NULL,
    imported_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ENGAJAMENTO SOCIAL — Fase 5, tabelas criadas desde o início
-- =============================================================================

CREATE TABLE questions (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id   UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE answers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
    gm_id       UUID NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id   UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (table_id, user_id)
);

CREATE TABLE bookmarks (
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_id   UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, table_id)
);

CREATE TABLE table_interests (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    table_id   UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
    message    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, table_id)
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

-- Catálogo público (queries mais frequentes)
CREATE INDEX idx_tables_status        ON tables(status);
CREATE INDEX idx_tables_system        ON tables(system_id);
CREATE INDEX idx_tables_gm            ON tables(gm_id);
CREATE INDEX idx_tables_modality      ON tables(modality);
CREATE INDEX idx_tables_featured      ON tables(featured) WHERE featured = TRUE;
CREATE INDEX idx_tables_created_at    ON tables(created_at DESC);
CREATE INDEX idx_tables_starts_at     ON tables(starts_at);
CREATE INDEX idx_tables_state_city    ON tables(state, city) WHERE modality IN ('presencial', 'hibrida');

-- Urgência / "Falta 1 jogador" / "Abertas recentemente"
CREATE INDEX idx_tables_slots         ON tables((slots_total - slots_filled)) WHERE status = 'active';

-- Buscas de texto
CREATE INDEX idx_tables_title_trgm    ON tables USING gin(to_tsvector('portuguese', title));
CREATE INDEX idx_systems_slug         ON systems(slug);
CREATE INDEX idx_gm_profiles_slug     ON gm_profiles(slug);
CREATE INDEX idx_gm_profiles_user     ON gm_profiles(user_id);

-- Engajamento
CREATE INDEX idx_questions_table      ON questions(table_id);
CREATE INDEX idx_reviews_table        ON reviews(table_id);
CREATE INDEX idx_bookmarks_user       ON bookmarks(user_id);
CREATE INDEX idx_interests_table      ON table_interests(table_id);
CREATE INDEX idx_interests_user       ON table_interests(user_id);

-- Auditoria
CREATE INDEX idx_table_history_table  ON table_history(table_id);
CREATE INDEX idx_cleanup_log_entity   ON imgur_cleanup_log(entity_type, entity_id);

-- =============================================================================
-- DADOS INICIAIS DE TAXONOMIA
-- =============================================================================

INSERT INTO systems (name, slug) VALUES
    ('D&D 5e', 'dnd-5e'),
    ('Pathfinder 2e', 'pathfinder-2e'),
    ('Tormenta20', 'tormenta20'),
    ('Call of Cthulhu', 'call-of-cthulhu'),
    ('Vampire: The Masquerade', 'vampire-the-masquerade'),
    ('Shadowrun', 'shadowrun'),
    ('GURPS', 'gurps'),
    ('Savage Worlds', 'savage-worlds'),
    ('Fate Core', 'fate-core'),
    ('Ordem Paranormal', 'ordem-paranormal'),
    ('3D&T Alpha', '3det-alpha'),
    ('Starfinder', 'starfinder'),
    ('Cyberpunk RED', 'cyberpunk-red'),
    ('Old Dragon 2e', 'old-dragon-2e'),
    ('Sistema Próprio', 'sistema-proprio');

INSERT INTO tags (name, slug) VALUES
    ('Fantasia', 'fantasia'),
    ('Horror', 'horror'),
    ('Ficção Científica', 'ficcao-cientifica'),
    ('Investigação', 'investigacao'),
    ('Comédia', 'comedia'),
    ('Drama', 'drama'),
    ('Ação', 'acao'),
    ('Político', 'politico'),
    ('Steampunk', 'steampunk'),
    ('Pós-Apocalíptico', 'pos-apocaliptico'),
    ('Urbano', 'urbano'),
    ('Pirataria', 'pirataria'),
    ('Mitologia', 'mitologia'),
    ('Faroeste', 'faroeste'),
    ('Medieval', 'medieval');

INSERT INTO platforms (name, slug) VALUES
    ('Discord', 'discord'),
    ('Foundry VTT', 'foundry-vtt'),
    ('Roll20', 'roll20'),
    ('Talespire', 'talespire'),
    ('Owlbear Rodeo', 'owlbear-rodeo'),
    ('Alchemy', 'alchemy'),
    ('Google Meet', 'google-meet'),
    ('Zoom', 'zoom'),
    ('Presencial', 'presencial');

-- =============================================================================
-- FIM DO SCHEMA BASE
-- =============================================================================
