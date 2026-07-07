-- @class: online-safe
-- @requires-backup: false
-- @author: spec-058
-- @created: 2026-07-06
-- @description: Indice em discord_llm_decisions.created_at (achado CodeRabbit, PR #128) — endpoint de metricas de automacao (GET /admin/discord/automation) filtra por created_at >= NOW() - INTERVAL e agrupa por prompt_version/status; sem indice vira table scan conforme a tabela cresce.

CREATE INDEX IF NOT EXISTS discord_llm_decisions_created_at_idx
  ON discord_llm_decisions (created_at DESC);
