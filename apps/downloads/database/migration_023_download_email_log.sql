-- @class: online-safe
-- @requires-backup: false
-- @author: spec-083
-- @created: 2026-07-23
-- @description: Cria download_email_log (T1.3, spec 083) — audita toda
--   tentativa de envio de e-mail transacional (rejeicao/aprovacao de
--   material), sucesso ou falha. Nunca atualiza linha existente em reenvio
--   de material diferente (novo evento = nova linha); reenvio manual do
--   MESMO evento falho atualiza attempts/status/last_attempt_at na mesma
--   linha (ver services/moderationEmail.ts).

CREATE TABLE IF NOT EXISTS download_email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  material_id UUID REFERENCES download_material(id) ON DELETE SET NULL,
  kind VARCHAR(40) NOT NULL,
  to_email TEXT,
  status VARCHAR(20) NOT NULL,
  provider_message_id TEXT,
  error_detail TEXT,
  attempts INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_email_log_material
  ON download_email_log(material_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_download_email_log_status
  ON download_email_log(status);
