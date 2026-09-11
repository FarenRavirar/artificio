# Reviews — 094

## Review adversarial de spec (2026-08-21, pré-Fase 0)

Executado com a skill `review` (refutação com evidência, não aprovação por simpatia).
Método: leitura integral de `spec.md`, `plan.md` e `tasks.md`; verificação de cada claim
material contra o código real e o bundle de API (`artificio-api-governance`), leitura direta
dos trechos citados, `rtk rg` para inventário e consumidores.

### Base de fato validada (claims confirmadas contra o código)

Todas as claims materiais da spec foram verificadas e se confirmam:

- Barra usa `flex flex-wrap` — `CatalogoPage.tsx:452` (a spec cita 449-453; drift de linha, ver N1).
- IDs duplicados — `CatalogoPage.tsx:457` (`id="catalog-desktop-search"`) e `CatalogTree.tsx:396`
  (`id={`${idPrefix}-search`}`) com `idPrefix="catalog-desktop"` passado em `CatalogoPage.tsx:472`.
- Duas buscas gerais — hero (`CatalogoPage.tsx:400-417`, `#input-busca-mesas`, submissão por
  botão/Enter) e catálogo (`CatalogoPage.tsx:459-460`, aplicação a cada `onChange`).
- Backend lê `type`, `audience`, `state`, `city`, `featured` — `tables.ts:51-66`; aplica em
  `tables.ts:176-182` (`featured === 'true'` na linha 180).
- Sorts do backend: `popular`, `recent`, `price_asc`, `price_desc` implementados
  (`tables.ts:217-260`); TODO na linha 261 confirma `ending_soon`/`slots` pendentes.
- Frontend aceita sorts sem implementação — `SortOption` inclui `slots`/`ending_soon`
  (`catalogService.ts:4`); `VALID_SORTS` local inclui ambos (`CatalogoPage.tsx:35`);
  select desktop tem `slots` (`ResultsHeader.tsx:36`) e drawer mobile tem `ending_soon`
  (`CatalogoPage.tsx:655`).
- `CatalogFilters` sem os filtros avançados — `catalogService.ts:17-28`; mapper snake_case
  em `catalogService.ts:48-49`; parser `VALID_SORT_VALUES` só com 4 valores
  (`catalogFilters.ts:23`) — URL legado cai em `popular` hoje.
- Rotas públicas ativas no bundle: `GET /api/v1/tables`, `GET /api/v1/tables/style-facets`,
  `GET /api/v1/systems` (todas `auth: none`).
- Estilos com semântica QUALQUER via overlap — `tables.ts:206-213` (`&&` sobre `text[]`).
- Consumidores do pacote: Mesas via `SystemPicker` (`SystemPicker.tsx:62` → `CatalogTree` com
  `role="user"` em `CatalogoPage.tsx:100-107`) e site-admin via `CatalogExplorer`
  (`CatalogSystemsPage.tsx:130`).
- Enums propostos no plano batem com o backend — `TableType = 'campanha' | 'one-shot' |
  'oneshot-serie' | 'aberta'`, `TableAudience = 'livre' | 'adultos'`,
  `TableModality = 'online' | 'presencial' | 'hibrida'` (`db/types.ts:228-230`).
- `slots_open` existe (`db/types.ts:266`) e já é usado no score do sort popular
  (`tables.ts:227-229`) — D0.4 não exige migration.
- Hooks existentes confirmados: `useCatalogFilters` (URL state), `useInfiniteCatalogTables`
  (reset por filter key, dedupe), `useCatalogTables` (React Query, queryKey = URL, AbortSignal
  via queryFn, `staleTime` 10 s), `useStyleFacets` (normalização tipada em `:4-13`).
- `ActiveFiltersChips.tsx` existe (109 linhas) e é usado no catálogo (`CatalogoPage.tsx:729`).
- A sessão citada pela spec (`sessoes/26-08-21_1_mesas_094-filtros-catalogo.md`) existe em disco,
  ainda não versionada (estado normal pré-commit).

A base de fato da spec é sólida: nenhuma claim material foi refutada.

---

## Achados

### BLOCK

**B1 — O plano não remove todo o texto técnico da árvore pública.**

`CatalogTree.tsx` renderiza, sem condição de `role`:
- parágrafo técnico — `:528-530` ("Cada nível é um nó...");
- "nome PT: {name_pt || '—'}" por nó — `:188-190`;
- badge de aliases por nó — `:168` e `:193-197` (`getAliasBadge`).

O catálogo público do Mesas usa `role="user"` (`CatalogoPage.tsx:100-107` → `SystemPicker.tsx:62`),
então os três aparecem hoje na página pública. D0.5/T2.5 preveem apenas
`description?: ReactNode | false`, que cobre somente o parágrafo `:528-530`. Implementar conforme
o plano deixa "nome PT" e badges de aliases expostos, violando R18 ("nenhum texto sobre nós,
aliases, schema, árvore persistida ou implementação") — requisito da própria spec.

Correção antes de código: ampliar D0.5 (ou a estratégia de composição local) para cobrir os três
pontos, e incluir no teste de ausência (`CatalogSystemPopover.test.tsx` / aceite 4) os textos
"nome PT" e o badge de aliases, não só a frase do parágrafo.

### HARDEN

**H1 — Duas fontes de enums/validação já divergem.**

`CatalogoPage.tsx:32-36` declara `VALID_MODALITIES`, `VALID_PRICE_TYPES`,
`VALID_EXPERIENCE_LEVELS`, `VALID_SORTS` (com `slots`/`ending_soon`) e `VALID_SEALS`;
`catalogFilters.ts:23-27` declara as mesmas listas com `VALID_SORT_VALUES` sem `slots`/
`ending_soon`. O plano fala em "definição canônica" (Fase 1), mas nenhuma task exige eliminar a
duplicação — e ela é a causa material da divergência atual. Draft de §V no final.

**H2 — Serialização de `featured` indefinida.**

Backend espera string `featured === 'true'` (`tables.ts:180`). O plano propõe
`featured: boolean` no tipo sem definir formato na URL/query ('true'/'false' vs presença/
ausência) nem a validação no parser. O aceite 5 exige round-trip de todo filtro aprovado — falta
o contrato do booleano. Draft de §V no final.

**H3 — Analytics fora dos requisitos.**

`trackFilterSistema` é chamado na seleção de sistema (`CatalogoPage.tsx:313`) e precisa
sobreviver ao redesenho; as interações novas (submissão de busca, abertura de "Mais filtros",
aplicação de filtros avançados) são eventos úteis candidatos conforme a governança de analytics.
A spec não menciona instrumentação em nenhum requisito. Draft de §V no final.

**H4 — Inventário do `plan.md` errado para `ActiveFiltersChips`.**

A tabela "Previstos — frontend Mesas" lista `ActiveFiltersChips.tsx` como "Novo", mas o arquivo
já existe (109 linhas) e já é usado no catálogo (`CatalogoPage.tsx:729`). Deve ser "Estendido", e
a auditoria T3.3 (classes Novos/Estendidos) precisa incluí-lo — senão um componente alterado fica
fora da exigência de cobertura.

**H5 — TODO do backend desatualizado e enganoso.**

`tables.ts:261` afirma que `slots` requer campo `slots_available` no banco — campo que não
existe; o real é `slots_open` (`db/types.ts:266`), já em uso no sort popular (`tables.ts:227-229`).
Se D0.4 aprovar, corrigir o comentário no mesmo trabalho (governança: comentário explicativo não
se perde nem fica mentindo). Observação associada: o tipo diz `Generated<number>` mas fixtures
reais usam `null` (`aiAutomation.test.ts:35`) — o teste do aceite 9 já prevê `null`; manter a
cobertura de nulidade, ela é o caso real.

### NOTE

- **N1 — Citações com drift.** `flex-wrap` está na `CatalogoPage.tsx:452` (spec: 449-453) e o
  parágrafo técnico na `CatalogTree.tsx:529` (spec: 528-530) — cosmético. O Gap 6 cita
  `ResultsHeader.tsx:36` como `ending_soon`, mas a linha 36 é `value="slots"`; `ending_soon` está
  no drawer mobile (`CatalogoPage.tsx:655`) e no tipo (`catalogService.ts:4`). A claim agregada é
  verdadeira; a citação pontual está trocada.
- **N2 — Segundo mecanismo de degradação não nomeado.** A barra tem `overflow-x-auto` além do
  `flex-wrap` (`CatalogoPage.tsx:452`). O Gap 1 descreve só a quebra; o scroll horizontal é o
  segundo sintoma e vale registro no baseline T0.6.
- **N3 — Sorts já divergem entre viewports hoje.** Desktop: popular/recent/slots/price_asc/
  price_desc (`ResultsHeader.tsx:34-38`); drawer mobile: popular/recent/ending_soon
  (`CatalogoPage.tsx:653-655`). É a evidência concreta do risco que R15 ataca; incluir `sort`
  explicitamente na matriz de paridade do aceite 12.
- **N4 — Sessão da spec não versionada.** Existe em disco, fora do `git ls-files` — esperado antes
  do commit; T0.9 (verde documental) cobre.
- **N5 — `useStyleFacets` já cumpre normalização obrigatória** (`useStyleFacets.ts:4-13`,
  `Array.isArray` + checagem de tipos). T2.7 pode reusar sem retrabalho.

---

## Drafts de §V propostos (para a skill spec escrever, se o mantenedor aprovar)

- **V1:** As listas de valores válidos (sorts, selos, enums de filtro) existem em um único módulo;
  página e parser importam a mesma fonte. Teste prova que o conjunto aceito pela UI é igual ao
  conjunto aceito pelo parser.
- **V2:** Filtro booleano serializa em formato definido no contrato (ex.: `'true'`/`'false'`,
  ausência = default) e o round-trip é coberto por teste (aceite 5).
- **V3:** `trackFilterSistema` permanece ativo na seleção de sistema; interações novas confirmadas
  (submissão de busca, abertura de "Mais filtros", aplicação de filtros avançados) são
  instrumentadas conforme o padrão do pacote `analytics`.
- **V4:** Nenhum texto sobre nós, nome PT, aliases, schema ou implementação é renderizado na
  superfície pública do catálogo; teste de ausência por texto-chave cobre parágrafo técnico,
  "nome PT" e badge de aliases, em dark e light.

---

## review verdict

```
BLOCK: 1 — B1: D0.5 cobre só o parágrafo; "nome PT" (CatalogTree.tsx:188-190) e badge de
aliases (:193-197) continuariam públicos, violando R18. Ampliar D0.5/T2.5 antes de código.
HARDEN: 5 — H1 fonte única de enums; H2 contrato de serialização de featured; H3 analytics;
H4 inventário ActiveFiltersChips; H5 TODO tables.ts:261.
NOTE: 5 — drift de citação, overflow-x-auto, divergência de sorts por viewport, sessão
não versionada, useStyleFacets já normaliza.
gate: NO-GO para implementação (Fases 1+) até B1 ser resolvido na reconciliação T0.7 e
D0.1–D0.5 serem respondidas pelo mantenedor. A Fase 0 (decisões + baseline) pode prosseguir.
```
