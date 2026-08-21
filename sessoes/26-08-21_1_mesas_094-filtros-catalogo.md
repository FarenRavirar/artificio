# Sessão 26-08-21_1 — Mesas · Spec 094 filtros do catálogo

- **Data:** 2026-08-21
- **Módulo:** Mesas
- **Spec:** `specs/094-mesas-filtros-catalogo/`
- **Estado:** Fases 0, 1 e 2 implementadas no working tree (`feat/094-mesas-filtros-catalogo`),
  verdes local; smoke visual medido; aguardando aprovação visual do mantenedor e autorização de
  commit/PR

## Pedido do mantenedor

Auditar e prototipar o filtro público de `mesas.artificiorpg.com`, usando duas referências de
mercado e aproveitando ao máximo as APIs existentes. O mantenedor informou que fases de specs
anteriores trataram o tema, mas não resolveram o resultado, e pediu uma nova spec SDD Completa.

## Evidência levantada

- Página pública inspecionada em viewport efetivo `1265×720`.
- `getBoundingClientRect()` mediu a quebra: busca/modalidade/preço em `y=571`; nível em `y=638`.
- DOM contém duas buscas gerais e dois elementos `#catalog-desktop-search`.
- `CatalogoPage.tsx:449-453` usa `flex-wrap` na barra “horizontal única”.
- `CatalogTree.tsx:528-530` expõe explicação técnica sobre nós/aliases.
- `GET /api/v1/tables` já aceita `type`, `audience`, `state`, `city` e `featured`.
- `artificio-api-governance search_api` confirmou `/tables`, `/tables/style-facets` e `/systems`
  como rotas públicas ativas sem auth.
- Frontend oferece `slots` e `ending_soon`; backend não executa esses sorts (`tables.ts:261`).
- Specs relacionadas lidas: 081 e 093. A 081 prescreveu a barra única; a 093 poliu geometria,
  bordas e dados, sem rever a hierarquia.
- `check_index_coverage` executado nos 12 arquivos usados. Dois ranges parciais foram lidos
  diretamente: `CatalogoPage.tsx:407` e `tables.ts:364`.

## Artefatos criados

- `specs/094-mesas-filtros-catalogo/spec.md`
- `specs/094-mesas-filtros-catalogo/plan.md`
- `specs/094-mesas-filtros-catalogo/tasks.md`
- protótipo externo ao repo em
  `C:\Users\paulo\.codex\visualizations\2026\08\21\01a02490-3bd7-7353-828a-201f28bf2fb5\mesas-filtro-prototipo.html`

## Pendências antes de implementar

Resolvidas: as cinco pendências viraram as decisões D0.1–D0.5 (aprovadas e registradas no
`spec.md`). Implementação executada nas Fases 0–2; resta a aprovação visual (critério 19),
reviews; commit, push e abertura de PR foram autorizados para esta entrega.

Nenhum deploy ou mudança runtime em produção foi executado.
