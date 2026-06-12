-- @class: online-safe
-- @requires-backup: false
-- @author: spec-015-glossario-sso-compat
-- @created: 2026-06-12
-- @description: Registra no changelog do glossario o login unificado via accounts.

-- Entrada idempotente: reaplicar a migration nao duplica o changelog.
INSERT INTO public.update_log (title, body, type, created_at)
SELECT
  'Login unificado do Artificio RPG',
  'O Glossario agora usa o login unificado do Artificio RPG: entre com sua conta Google pelo accounts.artificiorpg.com e mantenha a mesma sessao entre os modulos. Contas antigas por email e senha podem ser reivindicadas pelo fluxo de migracao para preservar termos, votos e comentarios.',
  'app',
  '2026-06-12 00:00:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.update_log
  WHERE type = 'app'
    AND title = 'Login unificado do Artificio RPG'
    AND created_at = '2026-06-12 00:00:00'
);

