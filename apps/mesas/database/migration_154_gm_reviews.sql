-- @class: online-safe
-- @requires-backup: false
-- @author: spec-081
-- @created: 2026-07-17
-- @description: Cria tabela gm_reviews para review estruturado do GM (T8, spec 081 — parity StartPlaying).

CREATE TABLE gm_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (gm_user_id, author_user_id)
);

ALTER TABLE gm_reviews
  ADD CONSTRAINT gm_reviews_rating_check
  CHECK (rating >= 1 AND rating <= 5);

ALTER TABLE gm_reviews
  ADD CONSTRAINT gm_reviews_not_self_check
  CHECK (gm_user_id <> author_user_id);

CREATE INDEX idx_gm_reviews_gm_user_id ON gm_reviews(gm_user_id);

COMMENT ON TABLE gm_reviews IS 'Review estruturado de mestre por jogador logado (nota + tags curadas + comentário livre), spec 081 T8.';
COMMENT ON COLUMN gm_reviews.tags IS 'Subconjunto de: pontual, bom_narrador, justo_com_regras, cria_bom_ambiente, flexivel_horarios, responde_rapido, organizado, recomendaria.';
