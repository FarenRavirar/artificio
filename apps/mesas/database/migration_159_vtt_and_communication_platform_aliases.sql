-- @class: online-safe
-- @requires-backup: false
-- @author: spec-093
-- @created: 2026-08-20
-- @description: tabelas de aliases para vtt_platforms e communication_platforms + seed (D2)

-- Decisao D2 (spec 093): aliases de VTT e de plataforma de comunicacao passam a
-- viver em tabela, espelhando system_aliases (migration_02) e scenario_aliases
-- (migration_107) — em vez do Record hardcoded VTT_ALIASES e do aliases: [] fixo
-- (shared.ts). Isso elimina o risco documentado em shared.ts:57-59 (slug/name
-- divergente vira [] em silencio) e permite que VTT criada pelo CRUD admin
-- (vttPlatforms.ts) ganhe alias, coisa que o mapa hardcoded nunca permitiu.

-- ===== VTT =====

CREATE TABLE IF NOT EXISTS vtt_platform_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vtt_platform_id UUID NOT NULL REFERENCES vtt_platforms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (vtt_platform_id, alias_slug)
);

CREATE INDEX IF NOT EXISTS idx_vtt_platform_aliases_platform_id ON vtt_platform_aliases(vtt_platform_id);
CREATE INDEX IF NOT EXISTS idx_vtt_platform_aliases_alias_slug ON vtt_platform_aliases(alias_slug);

-- ===== Comunicacao =====

CREATE TABLE IF NOT EXISTS communication_platform_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_platform_id UUID NOT NULL REFERENCES communication_platforms(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL,
  is_official BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (communication_platform_id, alias_slug)
);

CREATE INDEX IF NOT EXISTS idx_communication_platform_aliases_platform_id ON communication_platform_aliases(communication_platform_id);
CREATE INDEX IF NOT EXISTS idx_communication_platform_aliases_alias_slug ON communication_platform_aliases(alias_slug);

-- ===== Seed VTT (os 6 conjuntos do VTT_ALIASES + grafias plausiveis) =====
-- Regra desta spec (T3.4/§A3): so alias de 3+ caracteres. Siglas de 2 letras
-- (TS, FG, R20) ficam de fora — zero ocorrencia em 1030 linhas de anuncios reais
-- e findPlatformMatch desliga o guard de comprimento (allowShortAliases=true).
INSERT INTO vtt_platform_aliases (vtt_platform_id, alias, alias_slug)
SELECT vp.id, a.alias, a.alias_slug
FROM (VALUES
  ('roll20', 'Roll 20', 'roll-20'),
  ('talespire', 'Tale Spire', 'tale-spire'),
  ('quest-portal', 'QuestPortal', 'questportal'),
  ('tableplop', 'Table Plop', 'table-plop'),
  ('fantasy-grounds-unity', 'Fantasy Grounds', 'fantasy-grounds'),
  ('fantasy-grounds-unity', 'FGU', 'fgu'),
  ('fantasy-grounds-unity', 'FGC', 'fgc'),
  ('fantasy-grounds-unity', 'Fantasy Grounds Classic', 'fantasy-grounds-classic'),
  ('foundry-vtt', 'Foundry', 'foundry'),
  ('foundry-vtt', 'FoundryVTT', 'foundryvtt'),
  ('tabletop-simulator', 'TTS', 'tts'),
  ('tabletop-simulator', 'Tabletop Simulator', 'tabletop-simulator'),
  ('owlbear-rodeo', 'Owlbear', 'owlbear'),
  ('dndbeyond-maps', 'D&D Beyond', 'd-d-beyond'),
  ('dndbeyond-maps', 'DDB Maps', 'ddb-maps'),
  ('dndbeyond-maps', 'DnD Beyond', 'dnd-beyond'),
  ('alchemy-rpg', 'Alchemy', 'alchemy')
) AS a(slug, alias, alias_slug)
JOIN vtt_platforms vp ON vp.slug = a.slug
ON CONFLICT (vtt_platform_id, alias_slug) DO NOTHING;

-- ===== Seed Comunicacao (R16) =====
-- Medido em discord-announcements-real.txt (2026-08-20): das 5 plataformas,
-- so "Discord" aparece (36x, na grafia exata do nome). Nenhuma forma curta
-- ("Meet", "Teams", "Telegram", "Zoom") tem ocorrencia. Semeia apenas grafia
-- obvia como defesa para grafias futuras — "Tele" fica de fora (ambiguo demais).
INSERT INTO communication_platform_aliases (communication_platform_id, alias, alias_slug)
SELECT cp.id, a.alias, a.alias_slug
FROM (VALUES
  ('google-meet', 'Meet', 'meet'),
  ('microsoft-teams', 'Teams', 'teams')
) AS a(slug, alias, alias_slug)
JOIN communication_platforms cp ON cp.slug = a.slug
ON CONFLICT (communication_platform_id, alias_slug) DO NOTHING;
