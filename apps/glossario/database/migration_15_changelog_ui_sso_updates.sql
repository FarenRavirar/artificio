-- @class: online-safe
-- @requires-backup: false
-- @author: d-cont1-changelog
-- @created: 2026-06-13
-- @description: Registra no changelog do glossario as atualizacoes publicas de SSO, visual e navegacao.

-- Entradas idempotentes: reaplicar a migration nao duplica o changelog.
INSERT INTO public.update_log (title, body, type, created_at)
SELECT
  'Conta unica do Artificio RPG no Glossario',
  'O Glossario agora usa o login Google central do Artificio RPG. A mesma sessao vale entre Glossario, Mesas e os demais projetos; quem tinha conta antiga por email e senha pode reivindicar a conta para preservar termos, votos e comentarios.',
  'app',
  '2026-06-13 09:00:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.update_log
  WHERE type = 'app'
    AND title = 'Conta unica do Artificio RPG no Glossario'
    AND created_at = '2026-06-13 09:00:00'
);

INSERT INTO public.update_log (title, body, type, created_at)
SELECT
  'Visual e navegacao alinhados ao Artificio',
  'Atualizamos o cabecalho, o rodape, o favicon, as cores e a linguagem publica do Glossario para acompanhar a identidade visual comum do Artificio RPG. A navegacao entre Portal, Glossario, Mesas e os proximos projetos agora segue a mesma estrutura da suite.',
  'app',
  '2026-06-13 09:05:00'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.update_log
  WHERE type = 'app'
    AND title = 'Visual e navegacao alinhados ao Artificio'
    AND created_at = '2026-06-13 09:05:00'
);
