-- @class: online-safe
-- @requires-backup: false
-- @author: spec-074
-- @created: 2026-07-12
-- @description: Escopo minimo funcional de "Notificacoes" do painel (T1.7),
--   sem spec/decisao previa detalhando o dominio — autorizado nominalmente
--   pelo mantenedor (2026-07-12) como escopo minimo. Eventos cobertos nesta
--   rodada: material aprovado, material rejeitado, denuncia resolvida —
--   os 3 eventos ja emitidos por rotas existentes (moderation.ts/reports.ts).
--   Sem envio externo (email/push); so feed interno lido no painel.

CREATE TABLE IF NOT EXISTS download_notification (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind VARCHAR(40) NOT NULL,
  material_id UUID,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_download_notification_user
  ON download_notification(user_id, created_at DESC);
