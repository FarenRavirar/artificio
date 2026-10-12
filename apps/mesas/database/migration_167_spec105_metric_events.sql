-- @class: online-safe
-- @requires-backup: false
-- @author: spec-105
-- @created: 2026-10-12
-- @description: metricas da spec 105 - clique em contato do perfil do mestre e fingerprint anulavel

-- Spec 105. Uma migration so para as duas mudancas de schema da frente de
-- metricas (deploy-flow.md §3, "Nao fatiar o schema de uma mesma feature";
-- cada arquivo conta no guard MAX_AUTO_PENDING).

-- 1. M3: `POST /api/v1/gm/perfis/:slug/contact-click` so fazia `console.log`.
--    O clique em metodo de contato do perfil do mestre nao deixava rastro
--    consultavel. Padrao da `gm_profile_view_events` (migration_108), sem IP e
--    sem fingerprint: a linha so diz qual perfil, qual canal e quando.
CREATE TABLE IF NOT EXISTS gm_profile_contact_events (
  id BIGSERIAL PRIMARY KEY,
  gm_profile_id UUID NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
  channel VARCHAR(16) NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Os 7 canais de `CONTACT_CHANNELS` (backend/src/utils/contactUrls.ts, spec
-- 096 R12). Tabela nova, sem linha que possa violar a regra; o `DO $$` existe
-- porque `ADD CONSTRAINT` nao aceita `IF NOT EXISTS` no Postgres 16.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gm_profile_contact_events_channel_check'
      AND conrelid = 'gm_profile_contact_events'::regclass
  ) THEN
    ALTER TABLE gm_profile_contact_events
      ADD CONSTRAINT gm_profile_contact_events_channel_check
      CHECK (channel IN ('whatsapp', 'discord', 'phone', 'email', 'facebook', 'instagram', 'form'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gm_profile_contact_events_profile_clicked
  ON gm_profile_contact_events (gm_profile_id, clicked_at DESC);

-- 2. M2: `table_metric_events` virou a serie temporal de view/click/contact/
--    favorite por mesa. O fingerprint (hash de IP+UA) so serve ao dedupe, cuja
--    maior janela e 24 h; o script `metrics:anonymize` o anula depois de 48 h e
--    mantem a linha. `DROP NOT NULL` e permitido em online-safe.
ALTER TABLE table_metric_events ALTER COLUMN fingerprint_hash DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'gm_profile_contact_events'
  ) THEN
    RAISE EXCEPTION 'Migration 167 failed: gm_profile_contact_events not created';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'table_metric_events'
      AND column_name = 'fingerprint_hash'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Migration 167 failed: table_metric_events.fingerprint_hash still NOT NULL';
  END IF;
END $$;
