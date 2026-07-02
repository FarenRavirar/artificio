-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-01
-- @description: Fase 3 parser learning: regras ampliadas com escopo, confianca e rejeicoes.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Funcoes IMMUTABLE p/ eliminar duplicacao de literal (Sonar S1192) entre CHECK
-- constraints e o INSERT de seed mais abaixo — mesma constante, uma so fonte.
CREATE OR REPLACE FUNCTION discord_learning_rule_type_field_value() RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'field_value' $$;
CREATE OR REPLACE FUNCTION discord_learning_rule_scope_global() RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'global' $$;
CREATE OR REPLACE FUNCTION discord_learning_rule_status_candidate() RETURNS TEXT
  LANGUAGE sql IMMUTABLE AS $$ SELECT 'candidate' $$;

CREATE TABLE IF NOT EXISTS discord_learning_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type TEXT NOT NULL CHECK (
    rule_type IN (discord_learning_rule_type_field_value(), 'label_alias', 'classification', 'discard_rule', 'duplicate_rule', 'negative_rule')
  ),
  field TEXT NULL,
  input_pattern TEXT NULL,
  input_token TEXT NULL,
  output_value JSONB NULL,
  scope_type TEXT NOT NULL DEFAULT discord_learning_rule_scope_global() CHECK (
    scope_type IN (discord_learning_rule_scope_global(), 'guild', 'channel', 'profile', 'author', 'composite')
  ),
  scope_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  scope_hash TEXT NOT NULL,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.6500 CHECK (confidence >= 0 AND confidence <= 1),
  hits INTEGER NOT NULL DEFAULT 1 CHECK (hits >= 0),
  rejections INTEGER NOT NULL DEFAULT 0 CHECK (rejections >= 0),
  applied_count INTEGER NOT NULL DEFAULT 0 CHECK (applied_count >= 0),
  status TEXT NOT NULL DEFAULT discord_learning_rule_status_candidate() CHECK (status IN (discord_learning_rule_status_candidate(), 'active', 'suppressed', 'retired')),
  source TEXT NOT NULL DEFAULT 'human' CHECK (source IN ('human', 'confirmed_ai', 'migration_seed')),
  created_from_feedback_id UUID NULL REFERENCES discord_parse_feedback(id) ON DELETE SET NULL,
  last_applied_at TIMESTAMPTZ NULL,
  last_rejected_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT discord_learning_rules_field_value_requires_field CHECK (
    rule_type <> discord_learning_rule_type_field_value() OR (field IS NOT NULL AND input_token IS NOT NULL)
  ),
  CONSTRAINT discord_learning_rules_identity UNIQUE (
    rule_type,
    field,
    input_token,
    scope_hash
  )
);

CREATE TABLE IF NOT EXISTS discord_learning_rule_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES discord_learning_rules(id) ON DELETE CASCADE,
  parse_case_id UUID NULL REFERENCES discord_parse_cases(id) ON DELETE SET NULL,
  draft_id UUID NULL REFERENCES discord_import_table_drafts(id) ON DELETE SET NULL,
  field TEXT NULL,
  before_value JSONB NULL,
  after_value JSONB NULL,
  outcome TEXT NOT NULL DEFAULT 'applied' CHECK (
    outcome IN ('applied', 'conflict', 'rejected_by_guard', 'shadow')
  ),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_discord_learning_rules_lookup
  ON discord_learning_rules(rule_type, field, input_token, status, scope_type, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_discord_learning_rules_scope_hash
  ON discord_learning_rules(scope_hash);

CREATE INDEX IF NOT EXISTS idx_discord_learning_rules_status
  ON discord_learning_rules(status);

CREATE INDEX IF NOT EXISTS idx_discord_learning_rule_applications_rule
  ON discord_learning_rule_applications(rule_id);

CREATE INDEX IF NOT EXISTS idx_discord_learning_rule_applications_draft
  ON discord_learning_rule_applications(draft_id);

INSERT INTO discord_learning_rules (
  rule_type,
  field,
  input_pattern,
  input_token,
  output_value,
  scope_type,
  scope_json,
  scope_hash,
  confidence,
  hits,
  rejections,
  applied_count,
  status,
  source,
  created_at,
  updated_at
)
SELECT
  discord_learning_rule_type_field_value(),
  field,
  NULL,
  input_token,
  output_value,
  CASE WHEN guild_id IS NULL THEN discord_learning_rule_scope_global() ELSE 'guild' END,
  CASE WHEN guild_id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('guild_id', guild_id) END,
  encode(digest(
    CASE
      WHEN guild_id IS NULL THEN 'global:{}'
      -- Canonical JSON DEVE bater com stableJson() do TS (learningRules.ts):
      -- chaves ordenadas, sem espacos, sem null/empty. guild_id e snowflake (digitos).
      ELSE 'guild:{"guild_id":"' || guild_id || '"}'
    END,
    'sha256'
  ), 'hex'),
  CASE
    WHEN rejections > 0 THEN GREATEST(0.1000, LEAST(0.9500, 0.4500 + (hits::numeric / GREATEST(hits + rejections, 1)) * 0.5000))
    ELSE LEAST(0.9500, 0.6500 + (hits::numeric * 0.0800))
  END,
  hits,
  rejections,
  applied_count,
  CASE
    WHEN active = false THEN 'suppressed'
    WHEN rejections > 1 THEN 'suppressed'
    WHEN hits >= 2 AND rejections = 0 THEN 'active'
    ELSE discord_learning_rule_status_candidate()
  END,
  'migration_seed',
  created_at,
  updated_at
FROM discord_field_learning
WHERE input_token IS NOT NULL
ON CONFLICT (rule_type, field, input_token, scope_hash) DO NOTHING;
