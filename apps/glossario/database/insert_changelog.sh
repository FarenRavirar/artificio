#!/bin/bash
docker exec glossario-beta-db psql -U admin -d glossario_v2 -c "
INSERT INTO public.update_log (title, body, type, created_at) VALUES
  ('Cadastro de Usuarios', 'Os usuarios agora podem criar contas e se registrar no Glossario. Membros registrados tambem ganharam a capacidade de enviar sugestoes de novos termos, votar nas opcoes listadas e interagir adicionando comentarios.', 'app', '2026-03-15 00:00:00'),
  ('Sistema de Sugestoes', 'Membros registrados podem sugerir novos termos de traducao. Apos analise editorial, os termos podem ser marcados como aprovados. Todo o fluxo de moderacao e gerenciado pelo painel administrativo.', 'app', '2026-03-20 00:00:00'),
  ('Categorias do Glossario', 'Foram estruturadas e organizadas as categorias de glossario por tipo (sistema e cenario), permitindo filtragem e navegacao mais precisa entre os termos.', 'app', '2026-03-22 00:00:00'),
  ('Sistema de Selos', 'Implementado um novo sistema visual de selos (badges): Tradicao Oficial (traducoes publicadas pela Gale Force Nine), Rigor Artificio (termos documentados com pre-projeto de traducao) e Sugestao (contribuicoes da comunidade em revisao).', 'app', '2026-03-28 00:00:00');
"
