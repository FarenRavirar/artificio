-- @class: online-safe
-- @requires-backup: false
-- @author: spec-105
-- @created: 2026-10-12
-- @description: persiste o clique em metodo de contato do perfil publico do mestre

-- Spec 105 M3. `POST /api/v1/gm/perfis/:slug/contact-click` so fazia
-- `console.log`: o clique em WhatsApp/Discord/e-mail/formulario do perfil do
-- mestre nao deixava rastro consultavel, e o mestre nao tinha como saber se o
-- perfil gera contato. Padrao da `gm_profile_view_events` (migration_108), sem
-- IP e sem fingerprint: a linha so diz qual perfil, qual canal e quando.

CREATE TABLE IF NOT EXISTS gm_profile_contact_events (
  id BIGSERIAL PRIMARY KEY,
  gm_profile_id UUID NOT NULL REFERENCES gm_profiles(id) ON DELETE CASCADE,
  channel VARCHAR(16) NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mesmos canais aceitos pela rota (`gm.ts`, `GM_CONTACT_CHANNELS`). Tabela nova,
-- sem linha que possa violar a regra; o `DO $$` existe porque `ADD CONSTRAINT`
-- nao aceita `IF NOT EXISTS` no Postgres 16 (deploy-flow.md §3, Idempotencia).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'gm_profile_contact_events_channel_check'
      AND conrelid = 'gm_profile_contact_events'::regclass
  ) THEN
    ALTER TABLE gm_profile_contact_events
      ADD CONSTRAINT gm_profile_contact_events_channel_check
      CHECK (channel IN ('whatsapp', 'email', 'discord', 'form'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gm_profile_contact_events_profile_clicked
  ON gm_profile_contact_events (gm_profile_id, clicked_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'gm_profile_contact_events'
  ) THEN
    RAISE EXCEPTION 'Migration 167 failed: gm_profile_contact_events not created';
  END IF;
END $$;
