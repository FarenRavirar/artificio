-- @class: online-safe
-- @requires-backup: false
-- @author: spec-086
-- @created: 2026-07-25
-- @description: Fase 4 da spec 086 — taxonomia: resolve + fila de sugestao.
--   Espelha o fluxo de draft do apps/mesas (decisao do mantenedor:
--   "o draft de mesa tem muito o que ensinar, pois ele ja funciona como
--   deveria"). raw_system_hint em download_material preserva o texto bruto
--   quando o scraper nao casa contra o catalogo central (equivalente ao
--   raw_system_hint do mesas em discord/types.ts) — o material nunca perde
--   essa informacao nem finge que nao tem sistema. download_system_suggestion
--   e a fila de triagem: scraper abre pending automatico (nunca escreve
--   direto no catalogo, requisito 8), usuario comum tambem pode sugerir
--   (POST /api/v1/system-suggestions), admin aprova/recusa/ajusta
--   (equivalente a routes/suggestionHelpers.ts do mesas). resolution_action
--   registra o que o revisor de fato fez (merge_existing/create_alias/
--   create_child/create_system), no espirito de recordSystemEntityRule.

ALTER TABLE download_material ADD COLUMN IF NOT EXISTS raw_system_hint TEXT;

CREATE TABLE IF NOT EXISTS download_system_suggestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  raw_value TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  suggested_by_user_id UUID,
  resolution_action TEXT,
  resolved_node_id UUID,
  rejection_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT download_system_suggestion_source_check
    CHECK (source IN ('scraper', 'user')),
  CONSTRAINT download_system_suggestion_status_check
    CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT download_system_suggestion_resolution_action_check
    CHECK (resolution_action IS NULL OR resolution_action IN ('merge_existing', 'create_alias', 'create_child', 'create_system'))
);

-- Fila de triagem admin filtra por status='pending' o tempo todo (mesmo uso
-- de suggestionHelpers.listAdminHandler do mesas) — indice parcial evita
-- varrer sugestoes ja resolvidas, que crescem sem limite ao longo do tempo.
CREATE INDEX IF NOT EXISTS idx_download_system_suggestion_status_pending
  ON download_system_suggestion (status)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_download_system_suggestion_material_id
  ON download_system_suggestion (material_id);

-- Achado real (review PR #204, Codex): scraperIngest.ts abre suggestion
-- automatica toda vez que o hint nao casa. Sem esta trava, reprocessar o
-- mesmo item (retry de run, ou 2 fixtures com o mesmo raw_value pro mesmo
-- material) empilha sugestoes 'pending' identicas indefinidamente pro mesmo
-- (material_id, raw_value). Indice unico parcial so em source='scraper'
-- AND status='pending' — sugestao de usuario (source='user') pode repetir
-- (pessoas diferentes sugerindo o mesmo texto e legitimo), e sugestao ja
-- resolvida (approved/rejected) nao conta pra unicidade (novo ciclo depois
-- de rejeitada precisa poder reabrir).
CREATE UNIQUE INDEX IF NOT EXISTS uidx_download_system_suggestion_scraper_pending
  ON download_system_suggestion (material_id, raw_value)
  WHERE source = 'scraper' AND status = 'pending';
