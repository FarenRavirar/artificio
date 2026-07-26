-- @class: online-safe
-- @requires-backup: false
-- @author: spec-087
-- @created: 2026-07-26
-- @description: Dedup de visualizacao por origem+material+dia e indice do agregado de popularidade.

-- Spec 087 (T1B.1) — `download_metric_daily.view_count` existe desde a
-- migration_008 (spec 070) mas NUNCA foi incrementada: o painel admin sempre
-- mostrou total_views = 0. O incremento entra agora em GET /materials/:slug,
-- e o Requisito 13 exige no maximo 1 view por (origem, material, dia).
--
-- `download_metric_daily` agrega por (material_id, metric_date) e nao tem onde
-- registrar QUEM ja contou — sem esta tabela, todo refresh incrementaria de
-- novo. `view_hash` e um digest opaco da origem (nunca IP cru: visualizacao e
-- anonima por natureza e guardar IP em claro seria coleta desnecessaria de
-- dado, proibida pelos compromissos de produto do AGENTS.md).
--
-- A PK composta E o mecanismo de dedup: a 2a tentativa do mesmo (material,
-- origem, dia) colide e vira no-op via ON CONFLICT DO NOTHING, entao o
-- incremento de view_count so roda quando a insercao de fato aconteceu —
-- mesmo padrao ja usado por download_user_material_download em
-- routes/downloads.ts para dedup de download por conta.
CREATE TABLE IF NOT EXISTS download_material_view (
  material_id UUID NOT NULL REFERENCES download_material(id) ON DELETE CASCADE,
  view_hash TEXT NOT NULL,
  view_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (material_id, view_hash, view_date)
);

-- Limpeza de linha antiga: a tabela so serve pra dedup do DIA corrente, entao
-- nao precisa crescer pra sempre. Indice por data permite o expurgo barato.
CREATE INDEX IF NOT EXISTS idx_download_material_view_date
  ON download_material_view (view_date);

-- T1B.5 — o Bayesian average de popularidade agrega download_metric_daily por
-- material dentro de uma janela movel de 30 dias, em TODA listagem publica.
-- O indice por (metric_date, material_id) cobre esse filtro de janela seguido
-- de agrupamento por material, sem o qual o agregado varre a tabela inteira a
-- cada request de catalogo.
CREATE INDEX IF NOT EXISTS idx_download_metric_daily_date_material
  ON download_metric_daily (metric_date, material_id);

-- Agregado de rating (media + contagem por material) roda no mesmo request.
CREATE INDEX IF NOT EXISTS idx_download_rating_material
  ON download_rating (material_id);
