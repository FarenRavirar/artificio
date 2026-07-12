-- @class: online-safe
-- @requires-backup: false
-- @author: spec-071
-- @created: 2026-07-12
-- @description: Cria download_storage_usage — contador mensal LOCAL de bytes
--   e operacoes (Classe A = write/list/delete; Classe B = read) por provider
--   de storage. Regra petrea do mantenedor: NUNCA arriscar cobranca no free
--   tier do R2 (10GB / 1M classe A / 10M classe B). Contagem e local (nao
--   bate no provider a cada checagem, o que ja gastaria cota Classe B) e
--   cota e checada ANTES de cada operacao real, com margem de 10% (900k/9M/9GB).

CREATE TABLE IF NOT EXISTS download_storage_usage (
  provider VARCHAR(20) NOT NULL,
  year_month VARCHAR(7) NOT NULL, -- formato 'YYYY-MM'
  bytes_used BIGINT NOT NULL DEFAULT 0 CHECK (bytes_used >= 0),
  class_a_ops INTEGER NOT NULL DEFAULT 0 CHECK (class_a_ops >= 0),
  class_b_ops INTEGER NOT NULL DEFAULT 0 CHECK (class_b_ops >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (provider, year_month)
);
