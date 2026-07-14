-- @class: online-safe
-- @requires-backup: false
-- @author: spec-077
-- @created: 2026-07-14
-- @description: Candidatos manuais de duplicidade entre mesa ativa e mesa ou draft.

CREATE TABLE IF NOT EXISTS table_duplicate_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  candidate_table_id UUID REFERENCES tables(id) ON DELETE CASCADE,
  candidate_parse_case_id UUID REFERENCES discord_parse_cases(id) ON DELETE CASCADE,
  score NUMERIC(5,4) NOT NULL CHECK (score >= 0 AND score <= 1),
  signals_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (
    status IN ('candidate', 'confirmed_duplicate', 'rejected_duplicate', 'update_existing')
  ),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT table_duplicate_candidates_one_target CHECK (
    (candidate_table_id IS NOT NULL)::integer
    + (candidate_parse_case_id IS NOT NULL)::integer = 1
  ),
  CONSTRAINT table_duplicate_candidates_distinct_tables CHECK (
    candidate_table_id IS NULL OR table_id < candidate_table_id
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_table_duplicate_candidates_table_pair
  ON table_duplicate_candidates(table_id, candidate_table_id)
  WHERE candidate_table_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_table_duplicate_candidates_draft_pair
  ON table_duplicate_candidates(table_id, candidate_parse_case_id)
  WHERE candidate_parse_case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_table_duplicate_candidates_status_score
  ON table_duplicate_candidates(status, score DESC);

