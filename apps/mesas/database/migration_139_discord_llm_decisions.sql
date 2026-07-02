-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-01
-- @description: Fase 4 parser learning: auditoria e cache de decisoes DeepSeek ContextPack.

CREATE TABLE IF NOT EXISTS discord_llm_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parse_case_id UUID NULL REFERENCES discord_parse_cases(id) ON DELETE SET NULL,
  provider TEXT NOT NULL DEFAULT 'deepseek',
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  context_pack_hash TEXT NOT NULL,
  request_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_json JSONB NULL,
  validated_result_json JSONB NULL,
  latency_ms INTEGER NULL CHECK (latency_ms IS NULL OR latency_ms >= 0),
  token_estimate INTEGER NULL CHECK (token_estimate IS NULL OR token_estimate >= 0),
  status TEXT NOT NULL CHECK (status IN ('success', 'invalid_response', 'http_error', 'timeout', 'error', 'cache_hit')),
  error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_discord_llm_decisions_cache
  ON discord_llm_decisions(provider, model, prompt_version, context_pack_hash)
  WHERE status = 'success';

CREATE INDEX IF NOT EXISTS idx_discord_llm_decisions_parse_case
  ON discord_llm_decisions(parse_case_id);

CREATE INDEX IF NOT EXISTS idx_discord_llm_decisions_status
  ON discord_llm_decisions(status);
