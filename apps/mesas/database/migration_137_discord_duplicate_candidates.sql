-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-01
-- @description: Fase 2 parser learning: candidatos de duplicata em shadow para revisao humana.

CREATE TABLE IF NOT EXISTS discord_duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_case_id UUID NOT NULL REFERENCES discord_parse_cases(id) ON DELETE CASCADE,
  candidate_case_id UUID NOT NULL REFERENCES discord_parse_cases(id) ON DELETE CASCADE,
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'confirmed_duplicate', 'rejected_duplicate', 'update_existing')
  ),
  reviewed_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_duplicate_candidates_distinct_cases CHECK (parse_case_id <> candidate_case_id),
  CONSTRAINT discord_duplicate_candidates_unique_pair UNIQUE (parse_case_id, candidate_case_id)
);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_normalized_text_trgm
  ON discord_parse_cases USING GIN (normalized_text gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_discord_parse_cases_features_gin
  ON discord_parse_cases USING GIN (features_json jsonb_path_ops);

CREATE INDEX IF NOT EXISTS idx_discord_duplicate_candidates_parse_case
  ON discord_duplicate_candidates(parse_case_id);

CREATE INDEX IF NOT EXISTS idx_discord_duplicate_candidates_candidate_case
  ON discord_duplicate_candidates(candidate_case_id);

CREATE INDEX IF NOT EXISTS idx_discord_duplicate_candidates_status
  ON discord_duplicate_candidates(status);

CREATE INDEX IF NOT EXISTS idx_discord_duplicate_candidates_score
  ON discord_duplicate_candidates(score DESC);
