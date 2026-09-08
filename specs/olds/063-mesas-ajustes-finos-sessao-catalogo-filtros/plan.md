# Plano — 063

## Arquitetura da solução

### R1 — banner_url "Invalid URL" (já corrigido nesta sessão, documentar aqui)
- `mapper.ts`: `banner_url` vazio/whitespace vira `undefined` em vez de `''`.
- `createTable.types.ts`: `banner_url` passa de `string` obrigatório para `string?`.
- Sem mudança de backend (schema zod já estava correto: `.url().nullable().optional()`).

### R2 — contagem real de termos do glossário (já corrigido nesta sessão, documentar aqui)
- Backend `termController.ts`: `COUNT(*) OVER()` na query existente de `/terms`, devolvido via header `X-Total-Count` (evita 2ª query).
- `index.ts` (CORS): `exposedHeaders: ['X-Total-Count']` — sem isso o browser não lê o header.
- Frontend `useGlossario.ts`: novo campo `totalCount` lido do header; `App.tsx`/`LandingSection` trocam `dados.length` por `totalCount`.

### R3 — botão "Anunciar Mesa" na home (já implementado nesta sessão, documentar aqui)
- `HomePage.tsx`: botão abaixo da busca. Logado → `navigate('/painel?action=nova-mesa')`. Deslogado → `startSsoLogin('/painel?action=nova-mesa')` (mesmo mecanismo de `ProtectedRoute`).
- `PainelMestrePage.tsx`: lê `?action=nova-mesa` na carga inicial e abre `view='create-table'` direto, mesmo padrão já usado para `?edit=<id>`.

### R4 — filtro de estilo dinâmico (já implementado nesta sessão, documentar aqui)
- Backend: `GET /api/v1/tables/style-facets` (`tables.ts`) — `LATERAL unnest(t.setting_styles)` + `COUNT(*)` agrupado, só mesas `status='active'`, ordenado por frequência desc.
- Frontend: hook `useStyleFacets.ts` novo; `CatalogoPage.tsx` troca `VALID_STYLES` fixo pelos facets reais (com contagem exibida).
- `catalogFilters.ts`: remove whitelist fixa de estilos no parse de URL (valida só forma: não vazio, ≤50 chars) — sem isso, estilo real fora da lista antiga seria descartado do parse da URL.
- `catalogService.ts`: `StyleOption` passa de union fixo para `string`.

### R5 — sistema com busca autocomplete no catálogo (novo, a fazer)
**Decisão:** criar componente novo `SystemAutocomplete.tsx`, dedicado ao catálogo — NÃO modificar `SystemTreeSelector.tsx`.

Motivo: `SystemTreeSelector` é consumido por 4 telas (`CatalogoPage`, `OnboardingPage`, `StepSystem` do `CreateTableForm`, `UserSystemsSelector`). As outras 3 usam o fluxo de árvore/3-colunas para *cadastro* (onde navegar a hierarquia base→edição→variante é o caso comum, o usuário está escolhendo/declarando o sistema da própria mesa ou perfil). O catálogo é *filtro de busca* (o caso comum é digitar "dnd" e escolher direto) — funções de UX diferentes o bastante para não forçar 1 componente a servir os 2 bem. Criar um componente próprio elimina o risco de regressão nos outros 3 consumidores (R7 do spec).

`SystemAutocomplete`:
- Recebe a mesma `tree: SystemTreeNode[]` já carregada pelo `CatalogoPage` (não duplica fetch).
- Reusa a função `flattenTree` (extraída de `SystemTreeSelector.tsx` para um util compartilhado `systemTree.ts`, para não duplicar a lógica de flatten/pathLabel entre os dois componentes).
- Input único com `<datalist>`-like custom dropdown (não usar `<datalist>` nativo — sem controle de estilo/teclado suficiente): digitar filtra por nome/name_pt/slug/alias (mesma lógica de `normalizeText` já existente), mostra até N sugestões com `pathLabel` (ex.: "D&D 5e 2024 > ..."), clique ou Enter em uma sugestão seleciona e fecha.
- Selecionado, mostra chip com nome + botão "trocar" (reabre busca) — sem grade de 3 colunas.
- Acessível: `role="combobox"`, `aria-expanded`, `aria-activedescendant`, navegação por teclado (seta ↑↓, Enter, Esc), label associado.
- Mantém contrato de fora: `selectedSystemId: string`, `onSelect(id: string)`, `tree: SystemTreeNode[]` — troca é só dentro do `CatalogoPage`, sem tocar `useCatalogFilters`/`catalogService`.

### R6 — reforma visual do painel de filtros do catálogo (novo, a fazer)
Escopo: só o bloco de filtros (desktop `<section>` fixo + `FilterDrawer` mobile) dentro de `CatalogoPage.tsx`. Não tocar grid de resultados, paginação, header da página.

Problemas concretos na captura da sessão:
- Bloco único sem separação visual entre "busca textual", "sistema" e "modalidade/preço/nível" — tudo empilhado com o mesmo peso.
- Seletor de sistema ocupa 3 colunas fixas mesmo quando 2 delas estão vazias ("Selecione um sistema para explorar este nível") — desperdiça espaço e comunica "quebrado" antes de qualquer seleção.
- "Selos e estilos" numa única linha longa com wrap, sem agrupamento (selos DDAL/Covil são categoria diferente de estilos livres).

Direção (a refinar em código, não em texto): agrupar em 2-3 blocos visuais claros (busca + sistema | modalidade/preço/nível | selos + estilos), com o autocomplete de sistema (R5) substituindo o painel de 3 colunas — isso já resolve boa parte do desperdício de espaço. Espaçamento consistente (gap/padding via tokens já usados no resto do app, sem inventar novos). Mobile (`FilterDrawer`) segue a mesma reorganização lógica, sem duplicar decisões de estilo divergentes do desktop.

## Arquivos afetados

**Já tocados nesta sessão (documentar/consolidar, sem retrabalho):**
- `apps/mesas/frontend/src/features/create-table/utils/mapper.ts`
- `apps/mesas/frontend/src/features/create-table/types/createTable.types.ts`
- `apps/glossario/backend/src/controllers/termController.ts`
- `apps/glossario/backend/src/index.ts`
- `apps/glossario/frontend/src/hooks/useGlossario.ts`
- `apps/glossario/frontend/src/App.tsx`
- `apps/mesas/frontend/src/pages/HomePage.tsx`
- `apps/mesas/frontend/src/pages/PainelMestrePage.tsx`
- `apps/mesas/backend/src/routes/tables.ts`
- `apps/mesas/frontend/src/hooks/useStyleFacets.ts` (novo)
- `apps/mesas/frontend/src/pages/CatalogoPage.tsx`
- `apps/mesas/frontend/src/utils/catalogFilters.ts`
- `apps/mesas/frontend/src/services/catalogService.ts`
- `apps/mesas/database/changelogs.json`

**A fazer (R5/R6):**
- `apps/mesas/frontend/src/utils/systemTree.ts` (novo — extrai `flattenTree`/`normalizeText`/`getDisplayName` de `SystemTreeSelector.tsx` para reuso)
- `apps/mesas/frontend/src/components/SystemAutocomplete.tsx` (novo)
- `apps/mesas/frontend/src/components/SystemTreeSelector.tsx` (só o import do util extraído; comportamento intocado)
- `apps/mesas/frontend/src/pages/CatalogoPage.tsx` (troca do seletor + reforma do painel de filtros)
- Possível CSS/classe utilitária nova se o layout exigir (evitar inline styles ad-hoc; seguir padrão Tailwind já usado no arquivo)

## Contratos/interfaces tocados
- Nenhum contrato de API público muda de forma incompatível: `style-facets` e `X-Total-Count` são aditivos (novos).
- `SystemAutocomplete` é componente novo — não é contrato existente.
- `auth`/`accounts`/SSO: não tocado.

## Impacto em consumidores
- `SystemTreeSelector`: ganha um util extraído (`systemTree.ts`) mas mantém a mesma API pública e comportamento — `CreateTableForm`/`OnboardingPage`/`UserSystemsSelector` não precisam de smoke além do build/lint (nenhuma mudança funcional neles).
- `CatalogoPage`: smoke manual obrigatório (filtro de sistema, estilo, modalidade, preço, nível, selos, paginação, mobile drawer).

## Rollback
- Todo o trabalho é local (branch `fix/mesas-invalid-url-publicar-mesa`, sem commit ainda). Rollback = não commitar / `git checkout` dos arquivos tocados caso algo não valide.
- Backend: rotas novas (`style-facets`) e headers novos (`X-Total-Count`) são aditivos — não há migration, não há rollback de schema necessário.

## Validação
- `pnpm --filter @artificio/mesas-frontend --filter @artificio/mesas-backend --filter @artificio/glossario-frontend --filter @artificio/glossario-backend build`
- `pnpm run lint` (repo-wide ou filtrado nos 4 pacotes)
- Smoke manual local (dev server): publicar mesa sem banner, home glossário mostra contagem real, botão Anunciar Mesa (logado e deslogado), filtro de estilo com contagem, autocomplete de sistema (buscar "dnd", selecionar edição 2024), catálogo mobile/desktop.
- Sem deploy/beta nesta spec — validação fica em local/dev; deploy é decisão separada do mantenedor.
