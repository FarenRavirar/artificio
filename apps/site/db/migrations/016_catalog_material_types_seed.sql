-- @class: online-safe
-- @requires-backup: false
-- @author: spec-088
-- @created: 2026-07-27
-- @description: Povoa o vocabulario de tipos de material e adiciona o tipo neutro de nao classificado.

-- Spec 088 (T2.9d/T2.9e, requisitos 52/54/55) — a taxonomia central existia
-- com UM unico tipo ('aventura', seed da spec 086/migration 015), o minimo
-- necessario pro backfill do que o Downloads ja persistia. Isso bloqueava a
-- Fase 2: o scraper passa a resolver o hint de tipo CONTRA esta tabela, e com
-- vocabulario de um item todo hint legitimo ('suplemento', 'cenario', 'ficha',
-- 'mapa', 'regras') cairia em nao-casado, abrindo triagem pra 100% do acervo.
--
-- Os seis slugs abaixo sao o mesmo vocabulario que o frontend ja desenha em
-- CoverPlaceholder.tsx (spec 088, Fase 1) — nao e taxonomia nova inventada
-- aqui, e a materializacao do conjunto que a UI ja assume.
--
-- Aliases cobrem plural, grafia sem acento (o normalizador do catalogo casa
-- por slug OU alias, com normalizacao pt-BR) e o termo em ingles que as
-- fontes estrangeiras usam. Hint que ainda assim nao casar preserva o valor
-- bruto e abre triagem — a fronteira do requisito 48 nao muda: scraper nunca
-- escreve no catalogo central.
INSERT INTO catalog_material_types (id, slug, name, aliases)
VALUES
  (
    'b071ab5e-2d16-4c58-8f0e-086000000002',
    'suplemento',
    'Suplemento',
    '["suplementos", "supplement", "supplements", "sourcebook", "sourcebooks", "expansao", "expansão"]'::jsonb
  ),
  (
    'b071ab5e-2d16-4c58-8f0e-086000000003',
    'cenario',
    'Cenário',
    '["cenarios", "cenário", "cenários", "setting", "settings", "campaign setting", "ambientacao", "ambientação"]'::jsonb
  ),
  (
    'b071ab5e-2d16-4c58-8f0e-086000000004',
    'ficha',
    'Ficha',
    '["fichas", "character sheet", "character sheets", "sheet", "planilha"]'::jsonb
  ),
  (
    'b071ab5e-2d16-4c58-8f0e-086000000005',
    'mapa',
    'Mapa',
    '["mapas", "map", "maps", "battlemap", "battlemaps", "cartografia"]'::jsonb
  ),
  (
    'b071ab5e-2d16-4c58-8f0e-086000000006',
    'regras',
    'Regras',
    '["regra", "livro de regras", "regras basicas", "regras básicas", "rules", "rulebook", "rulebooks", "core rulebook", "core rulebooks", "sistema"]'::jsonb
  ),
  -- Tipo NEUTRO exigido pelo requisito 55. Substitui 'aventura' como default
  -- do ingest: rotular como Aventura um material que ninguem classificou e
  -- afirmacao falsa sobre o conteudo, e era o que produzia a distribuicao de
  -- 103 materiais numa linha so. Ter slug proprio torna o "caiu no default"
  -- DISTINGUIVEL de classificacao real — consulta por este slug lista
  -- exatamente o que falta triar, o que 'aventura' tornava impossivel.
  (
    'b071ab5e-2d16-4c58-8f0e-086000000007',
    'nao-classificado',
    'Não classificado',
    '["nao classificado", "não classificado", "unclassified", "uncategorized", "outros", "other", "misc", "miscellaneous"]'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  aliases = EXCLUDED.aliases,
  status = EXCLUDED.status,
  updated_at = now();

-- 'aventura' ja existia (migration 015) e continua valida como tipo real —
-- so deixa de ser o default de quem nao foi classificado. Aliases ampliados
-- pra casar o vocabulario que as fontes usam de fato.
UPDATE catalog_material_types
SET aliases = '["adventure", "adventures", "aventuras", "modulo", "módulo", "module", "one-shot", "oneshot"]'::jsonb,
    updated_at = now()
WHERE id = 'b071ab5e-2d16-4c58-8f0e-086000000001';
