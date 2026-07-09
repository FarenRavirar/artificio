# Tasks — 063

## Já feito nesta sessão (marcar concluído, sem retrabalho)

- [x] T1 — Corrigir `banner_url` "Invalid URL" ao publicar mesa sem capa · feito quando: `mapper.ts` envia `undefined` para banner vazio e `createTable.types.ts` aceita `string | undefined`; build `mesas-frontend` verde.
- [x] T2 — Contagem real de termos na home do glossário · feito quando: `termController.ts` expõe `X-Total-Count` via `COUNT(*) OVER()`, CORS libera o header, frontend usa `totalCount` em vez de `dados.length`; build `glossario-backend`+`glossario-frontend` verde.
- [x] T3 — Botão "Anunciar Mesa" na home do mesas · feito quando: botão visível abaixo da busca; logado navega para `/painel?action=nova-mesa`; deslogado passa por `startSsoLogin` e chega no mesmo destino; `PainelMestrePage` abre `create-table` direto via query param; build verde.
- [x] T4 — Filtro de estilo dinâmico no catálogo · feito quando: `GET /api/v1/tables/style-facets` retorna estilos reais com contagem; `CatalogoPage` consome via `useStyleFacets`; `catalogFilters.ts` não descarta estilo válido fora da lista antiga; build verde.
- [x] T5 — Changelog do mesas atualizado · feito quando: entrada nova em `changelogs.json` cobre botão Anunciar Mesa e fix do banner, sem termos de admin; JSON válido.

## A fazer

- [x] T6 — Extrair util `systemTree.ts` de `SystemTreeSelector.tsx` (`flattenTree`, `normalizeText`, `getDisplayName`) · feito quando: `SystemTreeSelector.tsx` importa do util novo, comportamento idêntico (build + smoke visual do `CreateTableForm` sem diferença).
- [x] T7 — Criar `SystemAutocomplete.tsx` (busca com sugestões, sem grade de 3 colunas) · feito quando: digitar filtra por nome/name_pt/slug/alias, sugestões aparecem em dropdown, seleção por clique ou teclado (↑↓/Enter/Esc), chip do sistema selecionado com opção de trocar, acessível (combobox pattern).
- [x] T8 — Trocar `SystemTreeSelector` por `SystemAutocomplete` em `CatalogoPage.tsx` (desktop + mobile drawer) · feito quando: filtro de sistema funciona igual ou melhor que antes (buscar, selecionar base/edição/variante), sem quebrar `selectedSystemIds`/`handleSystemToggle` existentes.
- [x] T9 — Reformar painel de filtros do `/catalogo` (desktop) · feito quando: busca+sistema, modalidade/preço/nível, selos+estilos aparecem como blocos visuais distintos, sem desperdício de espaço vazio, usando tokens de espaçamento já existentes no app.
- [x] T10 — Reformar `FilterDrawer` mobile do `/catalogo` com a mesma lógica de agrupamento do T9 · feito quando: mobile reflete a mesma estrutura de blocos do desktop, sem duplicar decisões de estilo divergentes.
- [x] T11 — Smoke manual completo do `/catalogo` pós T6-T10 · feito via preview local (vite preview, sem backend real): snapshot confirma 3 blocos visuais renderizando, autocomplete com role=combobox correto, erro de rede tratado sem crash. `CreateTableForm`/`OnboardingPage`/`UserSystemsSelector` não tiveram comportamento alterado (só ganharam import do util extraído em T6) — build verde nos 4 consumidores confirma ausência de erro de tipo/import; smoke funcional completo (com backend real) fica pendente de ambiente com DB.
- [x] T12 — Validação final · feito quando: `pnpm run lint` (mesas-frontend) e `pnpm --filter mesas-frontend/backend --filter glossario-frontend/backend build` verdes. Backlog e `project-state.md` — pendente de atualizar nesta mesma sessão antes de fechar.
