-- @class: online-safe
-- @requires-backup: false
-- @author: spec-021-feedback-site-glossario
-- @created: 2026-06-13
-- @description: Registra no changelog do glossario o novo canal de reportar problema / sugerir melhoria.

-- Entrada idempotente: reaplicar a migration nao duplica o changelog.
INSERT INTO public.update_log (title, body, type, created_at)
SELECT
  'Reporte problemas e sugira melhorias',
  'O Glossario ganhou um botao de feedback no canto da tela para voce reportar um problema (bug) ou sugerir uma melhoria, do mesmo jeito que ja existe no Mesas e no site do Artificio. O envio e rapido, funciona ate sem login (com e-mail opcional para retorno) e leva junto o contexto da pagina para a equipe corrigir mais rapido.',
  'app',
  '2026-06-13 10:00:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.update_log
  WHERE type = 'app'
    AND title = 'Reporte problemas e sugira melhorias'
    AND created_at = '2026-06-13 10:00:00'
);
