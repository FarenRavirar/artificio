-- @class: online-safe
-- @requires-backup: false
-- @author: Faren Ravirar
-- @created: 2026-06-20
-- @description: Tabelas groups + group_tags (diretório WhatsApp; curados + sugestões; tags geridas pelo admin)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Vocabulário de tags (gerido pelo admin: criar/editar/remover). Ex.: Mestres, Jogadores, DnD, Cenários.
CREATE TABLE IF NOT EXISTS group_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  -- slug SEO da página publicada do card (/grupo/<slug>). Nulo enquanto pending; gerado na ativação.
  slug           TEXT,
  -- até 3 tags (slugs referenciando group_tags); cardinalidade garantida por CHECK.
  tags           TEXT[] NOT NULL DEFAULT '{}' CHECK (array_length(tags, 1) IS NULL OR array_length(tags, 1) <= 3),
  description    TEXT,
  invite_url     TEXT NOT NULL,
  -- regras próprias do grupo (sanitizado), exibidas na página do card além da descrição.
  rules          TEXT,
  kind           TEXT NOT NULL DEFAULT 'group'  CHECK (kind IN ('group','channel')),
  category       TEXT NOT NULL                  CHECK (category IN ('artificio','tematicos','parceiros','comunidade')),
  is_adult       BOOLEAN NOT NULL DEFAULT false,
  logo_url       TEXT,
  logo_public_id TEXT,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','archived','rejected')),
  source         TEXT NOT NULL DEFAULT 'community' CHECK (source IN ('curated','community')),
  submitted_by   TEXT,
  -- email/nome de quem sugeriu (denormalizado do SSO; links não tem tabela de usuários).
  submitted_email TEXT,
  submitted_name  TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  -- created_at = quando foi enviado/sugerido; approved_at = quando o admin aprovou (ativou).
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotência do seed e dedupe de sugestões: 1 linha por convite.
CREATE UNIQUE INDEX IF NOT EXISTS groups_invite_url_uniq ON groups (invite_url);

-- Slug único entre os publicados (múltiplos NULL permitidos enquanto pending).
CREATE UNIQUE INDEX IF NOT EXISTS groups_slug_uniq ON groups (slug) WHERE slug IS NOT NULL;

-- Listagem pública filtra por status+source+categoria, ordena por sort_order.
CREATE INDEX IF NOT EXISTS groups_status_source_idx ON groups (status, source, category, sort_order);
