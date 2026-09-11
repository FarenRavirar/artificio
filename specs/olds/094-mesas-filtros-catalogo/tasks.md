# Tasks — 094

**Modelo de entrega:** uma fase por PR. Cada fase fecha código + testes + verde local e prepara
entrega contra `dev`; abrir PR, fazer commit ou push exige autorização nominal própria. Depois dos
reviews, achados procedentes são corrigidos no próprio código com comentário de origem quando
exigido pela governança; só então a fase seguinte é liberada.

## 🔁 Gate de fase — regra obrigatória

Cada fase termina com uma task 🔁 antes do PR. Divergência entre implementação e `spec.md`/
`plan.md` é corrigida ou perguntada ao mantenedor; nunca se fecha requisito parcialmente nem se
segue a checklist contra a spec.

## Decisões aprovadas e gates técnicos restantes

| Onde | Estado vinculante |
|---|---|
| T0.1 | D0.1 aprova a arquitetura desktop/mobile e a hierarquia dos controles. |
| T0.2a/T0.2 | Medir aptidão; aplicar automaticamente a política D0.2. `featured` nunca entra. |
| T0.3 | D0.3 fixa busca geral por botão/Enter; busca interna de sistemas permanece local. |
| T0.4 | D0.4 manda implementar `slots` e remover `ending_soon`. |
| T0.5 | D0.5 autoriza nominalmente a extensão aditiva de `packages/catalog-ui`. |

Não há nova decisão do mantenedor antes da implementação. T0.2a e T0.6 continuam bloqueantes
porque produzem evidência, não porque devolvem escolhas já respondidas.

**Ordem das fases importa:** Fase 0 fixa o contrato; Fase 1 torna estado/API verdadeiros; Fase 2
consome esse contrato na interface; Fase 3 só fecha depois de review e smoke real.

---

## Fase 0 — decisões e baseline · bloqueante, sem código runtime

- [x] **T0.1** — Registrar no baseline a arquitetura D0.1: desktop com uma busca,
      sistema/modalidade/preço, “Mais filtros” e “Buscar” na linha primária; atalhos em faixa
      separada; chips abaixo; sort no cabeçalho. Mobile com busca/sistema full-width e
      drawer/dialog com aplicar/limpar visíveis · atende **R1–R4, R10, R15–R20**.
      Registrada em `spec.md` §“Decisões aprovadas pelo mantenedor” (D0.1) e em
      `plan.md` §“Fase 2 — interface responsiva única”.
- [x] **T0.2a** — Antes da Fase 1, medir via `SELECT` read-only ou resposta pública
      agregada, usando o mesmo predicado de visibilidade de `/api/v1/tables`: total elegível;
      preenchimento e distribuição de `type`, `audience`, `state`, `city`, `featured`;
      cardinalidade; variantes de trim/case; valores fora do contrato; e `total` da rota para ao
      menos uma opção não vazia de cada candidato. Ler schema/assinatura antes da consulta e não
      registrar dados pessoais/credenciais · atende **R22**.

      Medição executada 2026-08-21. Predicado espelhado de `routes/tables.ts:156-167` +
      `tableVisibility.ts` (status `active`, `archived_at IS NULL`, importada não expirada),
      via `psql` read-only em `mesas-db` (prod) + rota pública. Schema lido antes
      (`migration_01_base_schema.sql:121-150`).

      | Campo | Total público | Preenchidos | Distintos | Distribuição/top valores | Sujeira/zero resultado | Comando/rota |
      |---|---:|---:|---:|---|---|---|
      | `type` | 25 | 25 | 2 | campanha=24, oneshot-serie=1 | one-shot=0, aberta=0 (rota) | `psql mesas-db`; `GET /tables?type=*` |
      | `audience` | 25 | 25 | 1 | livre=25 | adultos=0 (rota) — 1 valor útil | `psql mesas-db`; `GET /tables?audience=*` |
      | `state` | 25 | 0 | 0 | — (100% NULL) | — | `psql mesas-db` |
      | `city` | 25 | 0 | 0 | — (100% NULL) | — | `psql mesas-db` |
      | `featured` | 25 | 25 | 1 | false=25 | true=0 (rota) | `psql mesas-db`; `GET /tables?featured=true` |

      Total elegível: **25**. Nenhum nome de mesa, usuário ou credencial registrado.
- [x] **T0.2** — Aplicar a política D0.2 à tabela T0.2a, sem nova pergunta: excluir `featured`;
      incluir `type`, `audience`, `state` ou `city` somente com pelo menos dois valores úteis com
      resultado público; omitir opções zero; condicionar UF/cidade a presencial/híbrida e cidade
      à UF. Registrar incluído/omitido, label, ordem e medição determinante · atende
      **R4–R6, R22**.

      Política aplicada à medição T0.2a:

      | Faceta | Decisão | Medição determinante |
      |---|---|---|
      | `type` | **INCLUÍDA** — painel avançado, opções `campanha` (24) e `oneshot-serie` (1) | 2 valores úteis com resultado público; `one-shot` e `aberta` com 0 resultado → opções omitidas |
      | `audience` | **OMITIDA** — só 1 valor útil (`livre`=25; `adultos`=0) | reprovada pela regra de 2 valores úteis |
      | `state` | **OMITIDA** — 100% NULL | reprovada (0 preenchidos) |
      | `city` | **OMITIDA** — 100% NULL | reprovada (0 preenchidos) |
      | `featured` | **EXCLUÍDA SEMPRE** | D0.2; parâmetro preexistente do backend permanece sem consumidor no frontend |

      Resultado: somente `type` entra no painel avançado. A dependência modalidade→UF→cidade fica
      registrada no contrato para quando houver dados (R4), sem renderização hoje.
- [x] **T0.3** — Fixar nos contratos de implementação a decisão D0.3: busca geral promove
      `draftSearch` somente por botão/Enter; busca interna de sistemas filtra localmente por
      caractere e não consulta mesas · atende **R1, R7, R19**.
      Registrada em `spec.md` D0.3 e `plan.md` §“URL e query”; contrato canônico em
      `catalogFilterOptions.ts` (Fase 1).
- [x] **T0.4** — Fixar a lista final de sorts D0.4: `popular`, `recent`, `price_asc`, `price_desc`
      e `slots`; implementar `slots_open DESC, created_at DESC`; remover `ending_soon`. Registrar
      que `slots_open` é `NOT NULL` · atende **R13**.
      `slots_open INTEGER NOT NULL` confirmado em `migration_100_add_slots_open.sql` e
      `migration_01_base_schema.sql`; lista final fixada em `spec.md` D0.4.
- [x] **T0.5** — Registrar o blast radius da autorização D0.5: `packages/catalog-ui` recebe
      `presentation='full'|'selection'`, default `full`; Mesas usa `selection`; testes do pacote
      e smoke de Mesas + site-admin são obrigatórios · atende **R8, R18, R20, R21**.
      Blast radius registrado em `spec.md` D0.5 e `plan.md` §“Impacto em consumidores”
      (Mesas + site-admin via `CatalogExplorer`).
- [x] **T0.6** — Capturar baseline real em 320, 390, 768, 1280 e 1440, dark/light: screenshot,
      `getBoundingClientRect`, `flex-wrap`, `overflow-x`, IDs duplicados, sorts de cada viewport e
      requests por busca · atende
      **R3, R9, R16, R17, R19, R21**.

      Baseline capturado 2026-08-21 via Playwright (Chrome headless, zoom 100%, DPR 1) contra
      `https://mesas.artificiorpg.com/`. Screenshots em
      `C:\Users\paulo\.agent-tools\baseline-094\shots\{light,dark}-{vp}.png`.
      Medidas completas em `C:\Users\paulo\.agent-tools\baseline-094\baseline.json`.

      | Tema | VP | scrollW/clientW | IDs duplicados | Top controles primários (y) | Sorts visíveis | Requests busca "vamp"+Enter | Screenshot |
      |---|---|---|---|---|---|---|---|
      | light | 320 | 320/320, sem overflow-x | `catalog-desktop-search` | hero 448; "Filtros" 592 | relevantes, recentes, vagas, menor/menor preço | — (mobile, drawer) | `shots/light-320.png` |
      | light | 390 | 390/390, sem overflow-x | `catalog-desktop-search` | hero 389; "Filtros" 592 | idem | — | `shots/light-390.png` |
      | light | 768 | 768/768, sem overflow-x | `catalog-desktop-search` | busca 441; modalidade/preço/nível/DDAL/Covil 576 (1 linha) | idem | — | `shots/light-768.png` |
      | light | 1280 | 1280/1280, sem overflow-x | `catalog-desktop-search` | busca 571; sistema 556; modalidade 571; preço 571; **nível 638 (2ª linha — quebra)** | idem | digitar "vamp" → +1 request; Enter → +0 | `shots/light-1280.png` |
      | light | 1440 | 1440/1440, sem overflow-x | `catalog-desktop-search` | busca 571; modalidade 571; preço 571; nível 571 (1 linha) | idem | — | `shots/light-1440.png` |
      | dark | 320 | 320/320, sem overflow-x | `catalog-desktop-search` | hero 448; "Filtros" 592 | idem | — | `shots/dark-320.png` |
      | dark | 390 | 390/390, sem overflow-x | `catalog-desktop-search` | hero 389; "Filtros" 592 | idem | — | `shots/dark-390.png` |
      | dark | 768 | 768/768, sem overflow-x | `catalog-desktop-search` | busca 441; controles 576 (1 linha) | idem | — | `shots/dark-768.png` |
      | dark | 1280 | 1280/1280, sem overflow-x | `catalog-desktop-search` | busca 571; sistema 556; modalidade 571; preço 571; **nível 638 (2ª linha — quebra)** | idem | — | `shots/dark-1280.png` |
      | dark | 1440 | 1440/1440, sem overflow-x | `catalog-desktop-search` | busca 571; modalidade 571; preço 571; nível 571 (1 linha) | idem | — | `shots/dark-1440.png` |

      Achados de baseline: (1) `#catalog-desktop-search` duplicado em **todos** os viewports
      (busca textual + busca interna do `CatalogTree`, Gap 2); (2) quebra da linha primária em
      1280 com `Nível`/selos na 2ª linha (Gap 1 confirmado: `flex-wrap`); (3) dois campos de
      busca geral (hero `#input-busca-mesas` + catálogo, Gap 2); (4) busca consulta por caractere
      (1 request ao digitar, 0 no Enter — D0.3 muda isso); (5) `slots` aparece como "Mais vagas"
      na UI sem efeito real no backend (Gap 6); (6) `ending_soon` não renderizado no select atual.
- [x] **T0.7** — Verificar que `spec.md`, `plan.md` e `tasks.md` mantêm D0.1–D0.5 como decisões
      aprovadas e não reabrem alternativas revogadas · atende **R1–R23**.
      Verificado em `spec.md` §“Decisões aprovadas pelo mantenedor (2026-08-21) — registro
      autoritativo”: D0.1–D0.5 presentes; nenhum artefato reabre alternativa revogada.
- [x] **T0.8** — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Reler §“Decisões
      aprovadas pelo mantenedor”, **R1–R23**, §“Fase 0 — decisões e baseline aprovado” e
      §“Contratos/interfaces tocados”. Confirmar: T0.2 aplica a medição real; `featured` está
      excluído; busca, sorts e pacote seguem D0.3–D0.5; baseline tem medidas nos cinco viewports,
      overflow e sort por viewport.
      Divergência = corrigir ou perguntar · atende **R1–R23**.
      Gate passou: T0.2 aplicou a medição real (somente `type` habilitada); `featured` excluído;
      D0.3–D0.5 fixadas nos contratos; baseline com 10 combinações tema/viewport, overflow-x e
      sorts medidos por viewport. Sem divergência contra spec/plan.
- [x] **T0.9** — Verde documental (`rtk git diff` restrito aos artefatos da spec/sessão) + PR
      documental se o mantenedor determinar entrega separada · atende **R21**.
      `rtk git status`: working tree contém apenas `specs/094-*`, `sessoes/*` e
      `sessoes/index.md` — nenhum arquivo runtime alterado. PR documental aguarda determinação do
      mantenedor.

## Fase 1 — contrato, URL e ordenação verdadeira · PR próprio

- [x] **T1.1** — Estender `CatalogFilters` e enums somente com facetas habilitadas por T0.2;
      adicionar `slots` e remover `ending_soon`; `featured` não entra · atende **R5, R6, R13, R22** · feito quando tipos não aceitam valores
      fora do contrato.
      `CatalogFilters.type: TableTypeOption | ''` adicionado; `SortOption` sem `ending_soon`;
      `audience`/`state`/`city`/`featured` ausentes do contrato frontend (testado).
- [x] **T1.1a** — Criar `apps/mesas/frontend/src/utils/catalogFilterOptions.ts` como fonte única
      de valores/labels/guards para modalidade, preço, experiência, selo, tipo, público e sort;
      remover `VALID_*` paralelos de `CatalogoPage.tsx` e `catalogFilters.ts`. Desktop, mobile,
      parser e builder importam o mesmo registro · atende **R6, R13, R15, R21**.
      Fonte única criada (+134 linhas); `VALID_*` removidos de `CatalogoPage.tsx` (26/−23) e
      `catalogFilters.ts` (46/−34); `ResultsHeader.tsx` importa `SORT_OPTIONS`.
- [x] **T1.2** — Estender `parseCatalogFilters`/`buildCatalogParams` com defaults e round-trip;
      normalizar styles e URLs legados. `featured` não é aceito nem serializado pelo frontend;
      `ending_soon` legado cai em `popular` · atende **R6, R7, R11, R13, R22**.
      Parser/builder estendidos com `type`; `normalizeStyles` (trim/dedupe/sort) compartilhado;
      `ending_soon`→`popular` testado; `featured` ignorado no parse e ausente do build.
- [x] **T1.3** — Estender `mapFiltersToQueryParams` para as facetas habilitadas por T0.2, preservando
      snake_case, AbortSignal e ausência de params vazios · atende **R5, R6, R19**.
      Mapper exportado (era privado) para teste; envia `type` e styles normalizados; sem params
      vazios (testado); `featured` nunca enviado pelo frontend (testado).
- [x] **T1.4** — Unificar contagem, remoção e limpeza de filtros; selos continuam mutuamente
      exclusivos e qualquer mudança reinicia `page=1` · atende **R6, R10, R12, R14**.
      `clearFilters`/`activeFiltersCount`/chips incluem `type`; `updateFilter` mantém reset
      `page=1`; exclusão mútua de selos preservada.
- [x] **T1.5** — Aplicar D0.4 no backend/frontend: ordenar `slots` por
      `slots_open DESC, created_at DESC`; `ending_soon` sai até haver contrato real. Corrigir o
      TODO de `tables.ts:261`, removendo a afirmação falsa sobre `slots_available`; fixture segue
      o schema `NOT NULL` com 5/2/0 e desempate por data · atende **R13, R21**.
      Ramo `sort === 'slots'` implementado (11/+1); TODO substituído registrando só a pendência
      de `ending_soon`/data final; fixture 5/2/0 sem null testado.
      **Reaberta pela auditoria de 2026-08-21:** a fixture já chegava ordenada do mock e não
      comprovava o desempate com vagas iguais e datas diferentes.
      Corrigida: fixture usa 5/5/2/0 fora de ordem, com datas distintas nos dois registros de 5
      vagas; o teste exige `slots_open DESC, created_at DESC` e verifica a limpeza do `orderBy`
      anterior. Os ramos `popular` e `recent` também têm ordem explícita verificada.
- [x] **T1.6** — Testes: **novos**
      `apps/mesas/frontend/src/utils/catalogFilters.test.ts`,
      `apps/mesas/frontend/src/utils/catalogFilterOptions.test.ts`,
      `apps/mesas/frontend/src/services/catalogService.test.ts` e
      `apps/mesas/backend/src/routes/tables.catalog.test.ts`; cobrir URL, mapper, filtros já
      existentes, ausência de `featured` no frontend, igualdade UI/parser, estilos QUALQUER e sort
      decidido · atende **R5–R7, R11–R15, R19, R21**.
      Criados (181+135+112 linhas frontend; 193 backend). Frontend 55/55, backend 24/24.
      **Reaberta pela auditoria de 2026-08-21:** o verde não exercitava a ordenação SQL nem o
      desempate exigido por T1.5.
      Corrigida em `tables.catalog.test.ts`: a asserção agora falha se faltar qualquer termo ou
      se a precedência entre vagas e data mudar.
- [x] **T1.7** — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Reler
      **R5–R7, R10–R14, R19, R21**, §“Fase 1 — contrato de filtros, URL e ordenação” e
      §“Contratos/interfaces tocados”. Confirmar: nenhum endpoint novo; todo filtro atravessa
      estado→URL→query→limpeza; styles continuam QUALQUER; sort oferecido tem teste de ordem;
      UI e parser importam uma fonte única; `featured` não integra o estado frontend; URL legado cai em
      default; página reinicia em 1; TODO de `slots_available` não permanece · atende
      **R5–R7, R10–R14, R19, R21**.
      Gate passou (verificação por código + testes): sem endpoint novo; `type` atravessa
      estado→URL→query→chips→limpeza; styles QUALQUER preservado (`&&` intocado); ordem de
      `slots` testada; fonte única importada por UI/parser/builder; `featured` ausente do
      frontend; `ending_soon` legado→`popular`; `page=1` em mudança; TODO corrigido.
- [x] **T1.8** — Verde local focado e `rtk pnpm verify:api` com `breaking=0`; preparar a entrega
      contra `dev` e só commitar/pushar/abrir PR após autorização nominal de cada ação · atende
      **R21**.
      Frontend: vitest 55/55, tsc limpo, lint limpo. Backend: vitest 24/24, tsc limpo, lint
      limpo. `verify:api` → `breaking=0` em todos os apps. Commit/PR aguardam autorização.

## Fase 2 — interface responsiva e acessível · PR próprio

- [x] **T2.1** — Remover busca geral duplicada do hero/barra conforme D0.1 e implementar uma
      única fonte de busca por botão/Enter conforme D0.3 · atende **R1, R7, R19**.
      Hero sem campo de busca; busca única na barra (`CatalogFiltersBar`); `draftSearch`
      promovido a `filters.search` só por submit (controller em `useCatalogFilters`).
      **Reaberta pelo smoke de 2026-08-21:** Enter real não submeteu a busca; o teste anterior
      disparava `submit` programaticamente e só o botão alterava a URL.
      Corrigida com tratamento explícito de Enter no input. Smoke real mediu URL inalterada ao
      digitar e `?search=vamp` após Enter; teste de regressão reproduz a interação no input.
- [x] **T2.2** — Criar `CatalogFiltersBar.tsx` com linha primária deliberada, sem `flex-wrap`
      emergente, e cabeçalho de resultados separado · atende **R2, R3, R20**.
      Criado (+386): grid com breakpoints, busca cresce, sistema limitado, modalidade/preço
      estáveis, "Mais filtros" com badge, ação "Buscar"; contagem/ordenação no `ResultsHeader`.
- [x] **T2.3** — Criar `CatalogAdvancedFilters.tsx` a partir de uma definição canônica usada em
      desktop/mobile; incluir somente facetas habilitadas por T0.2, nunca `featured`; aplicar
      dependência modalidade→UF→cidade · atende **R4, R6, R15, R22**.
      Criado (+126): experiência, tipo (renderiza só `campanha`/`oneshot-serie`), selos
      exclusivos, estilos via `useStyleFacets`. `featured`/`audience`/`state`/`city` sem
      controle. UF/cidade sem dados hoje (T0.2a); dependência registrada no contrato.
- [x] **T2.4** — Criar `CatalogSystemPopover.tsx`: gatilho compacto, árvore sob demanda, busca
      acessível distinta, Escape e retorno de foco. No modo público não renderizar parágrafo
      técnico, “nome PT” nem alias badge; busca por nome PT/alias continua funcional · atende
      **R8, R9, R16, R18**.
      Criado (+225): popover desktop / bottom-sheet mobile; `aria-label="Buscar sistema"`;
      IDs `catalog-system-*` (sem colisão); Escape/fora com retorno de foco; `selection` em uso.
- [x] **T2.5** — Por D0.5, estender `CatalogTreeProps` de forma aditiva e default-
      preserving com `presentation='full'|'selection'`: `full` mantém o
      site-admin; `selection` esconde os três metadados técnicos sem removê-los do matcher.
      Testar default, busca por alias e smokar `site-admin`; esconder por CSS não satisfaz o requisito · atende
      **R8, R18, R20, R21**.
      Prop aditiva com default `full` (+30/−4); não-renderização condicional dos 3 metadados;
      `nodeMatchesQuery` intocado; teste estendido (+90/−2, 4 casos novos).
      **Reaberta pela auditoria de 2026-08-21:** falta evidência do smoke do consumidor
      `site-admin` exigido por D0.5.
      Smoke concluído em 2026-08-21: Vite local respondeu HTTP 200 em `/admin/`; no Browser,
      `/admin/catalogo-sistemas` renderizou “Catálogo de sistemas”, busca “Buscar por nome, slug,
      caminho ou alias” e o parágrafo técnico completo do default `full`. A API local de snapshot
      estava indisponível (`502`/`ECONNREFUSED`), limitação registrada sem afetar a prova do modo
      de apresentação do consumidor.
- [x] **T2.6** — Implementar atalhos como aliases de filtros reais, badge de avançados, chips
      removíveis e “Limpar tudo”; DDAL/Covil permanecem exclusivos; atalho/opção sem resultado
      público não é renderizado · atende **R10–R12, R22**.
      Atalhos como aliases com toggle-remove; badge `advancedCount`; chips + "Limpar tudo";
      exclusividade de selos preservada.
      **Reaberta pela auditoria de 2026-08-21:** GET público mediu zero resultados para
      `iniciante`, `presencial`, `hibrida`, `ddal` e `covil-do-lich`, mas os controles permaneciam
      renderizados, contrariando R22.
      Corrigida usando produção como autoridade de T0.2a: controles públicos mantidos apenas para
      `online` (25), `intermediario` (2), `veterano` (1), `gratuita` (17), `paga` (8),
      `campanha` (24) e `oneshot-serie` (1). Omitidos `iniciante`, `presencial`, `hibrida`, DDAL
      e Covil (todos 0 em produção). Rechecagem do beta encontrou dados divergentes — iniciante=1,
      DDAL=1 e Covil=3 — sem substituir a autoridade de produção fixada pela spec.
- [x] **T2.7** — Reusar `style-facets` no painel pesquisável; nenhuma lista fixa completa nem
      scroll horizontal sem affordance. Consumir `useStyleFacets` existente e sua normalização;
      não criar segundo fetch/normalizador · atende **R5, R11**.
      Painel consome `useStyleFacets` existente (hook/normalizador únicos).
- [x] **T2.8** — Integrar composição ao mobile sem duplicar lista/mapper e sem sobrepor FAB de
      feedback; drawer/dialog tem “Aplicar” e “Limpar” visíveis/sticky; garantir alvos ≥44 px ·
      atende **R15–R17**.
      Busca/sistema full-width; drawer `role="dialog"` com Aplicar/Limpar sticky ≥44px; FAB de
      feedback não sobreposto; tokens de tema no drawer (legível dark/light).
      **Reaberta pela auditoria de 2026-08-21:** os dialogs restauravam o foco, mas não continham
      Tab/Shift+Tab; o botão "Aplicar" apenas fechava após mudanças já aplicadas.
      Corrigida com focus trap compartilhado nos dois dialogs e estado de rascunho no drawer:
      alterações não mudam URL/query antes de “Aplicar”; “Limpar” limpa apenas o rascunho aberto.
      Testes cobrem Tab e Shift+Tab; smoke mediu URL sem parâmetro antes de aplicar e
      `?experience_level=veterano` depois.
- [x] **T2.9** — Preservar loading, erro, vazio, scroll infinito, dedup, reset e fallback manual;
      estender teste do hook para novos filter keys · atende **R14, R19**.
      `useInfiniteCatalogTables` intocado; teste novo prova reset do acumulado com filter keys
      novas (incluindo `type`).
- [x] **T2.9a** — Preservar `trackFilterSistema` no callback canônico e provar exatamente uma
      emissão por seleção. Não adicionar evento para abrir painel, submeter busca ou aplicar
      filtro sem decisão explícita e contrato em `packages/analytics` · atende **R23**.
      Callback canônico preservado; teste de `CatalogoPage` prova 1 emissão; nenhum evento novo.
- [x] **T2.10** — Testes: **novos**
      `CatalogFiltersBar.test.tsx`, `CatalogAdvancedFilters.test.tsx`,
      `CatalogSystemPopover.test.tsx`, `ActiveFiltersChips.test.tsx` e `CatalogoPage.test.tsx`;
      **novo** `useInfiniteCatalogTables.test.ts`;
      **condicional estendido** `packages/catalog-ui/src/CatalogTree.test.tsx`. Cobrir metadados
      técnicos ausentes + alias pesquisável, remoção isolada dos filtros avançados, paridade de
      sort e emissão única de analytics · atende **R1–R4, R8–R12, R14–R21, R23**.
      Criados/estendidos: 6 testes novos de componentes/página/hook (1.305 linhas) + CatalogTree
      estendido. Suite F1+F2 frontend 119/119; CatalogTree 16/16.
      **Reaberta pela auditoria de 2026-08-21:** a matriz desktop/mobile comparava a mesma função
      e entrada consigo; faltavam testes de contenção de foco e do chip quando apenas o sort está
      ativo.
      Corrigida: testes interagem com os cinco sorts em larguras desktop/mobile, comparam o estado
      avançado produzido pelas duas composições, cobrem focus trap nos dialogs e exigem chip para
      sort não default. Suite final da Fase 1+2: 126/126 em 12 arquivos.
- [ ] **T2.11** — Smoke visual real antes do PR em 320, 390, 768, 1280 e 1440, dark/light:
      linha primária, painel, chips, todos os estados, teclado e rede. Registrar medidas,
      screenshots, overflow, sort disponível em cada viewport e ausência dos três metadados
      técnicos; aprovação visual explícita do mantenedor · atende **R3, R9, R15–R21**.

      Smoke refeito em 2026-08-21 no Browser contra o frontend local, com APIs GET proxyadas para
      `https://mesasbeta.artificiorpg.com`. O tema foi aplicado pelo cookie real
      `artificio_theme`, não apenas por `colorScheme`. Screenshots em
      `.artifacts/spec-094-smoke/`.

      | Tema | VP | Linha primária | overflow-x | IDs dup | busca única | sort visível | metadados técnicos |
      |---|---|---|---|---|---|---|---|
      | light/dark | 320 | busca full-width; controles responsivos | não | 0 | 1 ("Buscar mesas") | 5 opções | ausentes |
      | light/dark | 390 | idem | não | 0 | 1 | 5 opções | ausentes |
      | light/dark | 768 | composição desktop sem quebra emergente | não | 0 | 1 | 5 opções | ausentes |
      | light/dark | 1280 | 1 linha primária | não | 0 | 1 | 5 opções | ausentes |
      | light/dark | 1440 | 1 linha primária | não | 0 | 1 | 5 opções | ausentes |

      Medições: light calculado com fundo `rgb(244,246,251)`, texto `rgb(11,18,32)` e superfície
      `#fff`; dark com fundo `rgb(27,42,74)`, texto branco e superfície `#1b2a4a`. Os dez pares
      tema/viewport têm SHA-256 distintos, `scrollWidth == clientWidth`, zero IDs duplicados, uma
      busca geral e os cinco sorts. Nenhuma opção inelegível pela medição de produção aparece.

      Interações: digitar sem Enter manteve a URL e Enter produziu `?search=vamp`; drawer mobile
      manteve alterações em rascunho até “Aplicar”; Tab/Shift+Tab ficaram contidos; Escape do
      seletor de sistema devolveu foco ao gatilho; busca por alias encontrou Dungeons & Dragons;
      vazio exibiu chip “Veterano” e “Limpar tudo”. Loading e erro foram capturados separadamente;
      o loading light passou a usar tokens de superfície/texto após o smoke revelar texto branco.
      O mesmo smoke revelou HTML interativo aninhado no card; `TableCard` foi corrigido para link
      overlay irmão e teste estrutural impede `a a` e `a button`.

      **Pendência: aprovação visual explícita do mantenedor (critério de aceite 19).** GA4 não
      carrega em dev local (sem `VITE_GA_ID`); a emissão única de `trackFilterSistema` está
      coberta pelo teste de integração de `CatalogoPage` (T2.9a) e será verificada em rede no
      smoke pós-deploy (T3.5).
- [ ] **T2.12** — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Reler
      **R1–R4, R8–R12, R14–R21**, §“Fase 2 — interface responsiva única”, §“Impacto em
      consumidores” e §“Smoke visual obrigatório”. Confirmar: exatamente uma busca geral; IDs
      únicos; sistema compacto sem parágrafo/“nome PT”/alias badge, mas busca por alias funciona;
      filtros e sorts iguais em desktop/mobile; sem overflow; uma request por ação; uma emissão de
      `trackFilterSistema`; default de `CatalogTree` preservado se tocado; smoke real aprovado ·
      atende **R1–R4, R8–R12, R14–R21, R23**.
      Gate passou (verificação por código + teste + smoke): 1 busca geral; 0 IDs duplicados nos
      10 cenários; metadados técnicos ausentes com busca por alias funcional (teste do pacote);
      sorts idênticos desktop/mobile (fonte única); sem overflow; 1 request por ação confirmada;
      `trackFilterSistema` 1× (teste de integração; GA4 indisponível em dev local);
      `presentation` default `full` preservada para site-admin; smoke medido (aprovação visual
      do mantenedor pendente em T2.11).
      **Gate reaberto em 2026-08-21** pelos achados registrados em T2.5, T2.6, T2.8, T2.10 e
      T2.11.
      Achados técnicos da reabertura corrigidos e revalidados em 2026-08-21. O gate permanece
      aberto exclusivamente porque T2.11 exige aprovação visual explícita do mantenedor.
- [x] **T2.13** — Verde local focado dos pacotes afetados e `rtk pnpm verify:api` com
      `breaking=0`; preparar a entrega contra `dev` e só commitar/pushar/abrir PR após autorização
      nominal de cada ação · atende **R21**.
      CatalogTree: vitest 16/16, tsc, lint e build limpos. Mesas frontend: vitest 126/126 em 12
      arquivos, tsc e lint limpos. Mesas backend: vitest 43/43 em 3 arquivos, tsc e lint limpos.
      Site-admin: typecheck, lint e build limpos; smoke do consumidor registrado em T2.5.
      `verify:api` → `breaking=0` em todos os apps (Mesas: 259 rotas). Entrega preparada em
      `feat/094-mesas-filtros-catalogo`; commit/PR aguardam autorização.

## Fase 3 — validação final e fechamento

- [ ] **T3.0** — 🔁 **GATE FINAL — varredura completa.** Percorrer **R1–R23**, os sete gaps do
      §Problema e os 19 critérios de aceite, item por item. Reconferir: uma busca; linha sem quebra
      em 1280; inventário real aplica D0.2; fonte única de enums; `featured` ausente do frontend; sort
      verdadeiro; estilos QUALQUER; IDs únicos; parágrafo/“nome PT”/aliases ausentes mas busca por
      alias funcional; analytics preservado; desktop/mobile equivalentes; smoke aprovado.
      Requisito parcial reabre a fase correspondente · atende **R1–R23**.
- [ ] **T3.1** — Depois de o mantenedor declarar encerradas as rodadas de review, executar
      validação completa sequencial, nunca em paralelo e sem `--force`: tsc, lint, test e build dos
      pacotes afetados · atende **R21**.
- [ ] **T3.2** — Executar `rtk pnpm verify:api`; esperado `breaking=0`. Divergência de bundle
      reabre Fase 1 · atende **R5, R21**.
- [ ] **T3.3** — Auditoria de cobertura de teste:

      | Classe | Arquivos que precisam estar cobertos |
      |---|---|
      | Novos | `CatalogFiltersBar`, `CatalogAdvancedFilters`, `CatalogSystemPopover`, `ActiveFiltersChips.test`, `useInfiniteCatalogTables.test`, integração `CatalogoPage`, registro canônico, filtros/mapper, rota catálogo |
      | Estendidos | `CatalogTree.test` obrigatório por D0.5 |

      Listar caminhos reais após implementação. Arquivo alterado sem teste correspondente reabre
      task; exceção exige justificativa objetiva aprovada, não “é só visual” · atende **R21**.
- [ ] **T3.4** — Auditar achados de bots: fix procedente recebe comentário no próprio código com
      PR+bot+severidade, erro real e motivo da correção. Achado descartado é registrado aqui com
      evidência. Nunca responder/resolver/reagir nas threads do PR · atende **R21**.
- [ ] **T3.5** — Smoke pós-deploy em `mesas.artificiorpg.com` somente após aprovação nominal de
      deploy: dark/light, cinco viewports, teclado, URL compartilhada, back/forward, rede e sorts ·
      atende **R3, R7, R13, R15–R21, R23**.
- [ ] **T3.6** — Atualizar sessão; atualizar backlog somente se o mantenedor mandar retirar item
      desta spec; atualizar `project-state.md` apenas se o estado operacional mudar · atende
      **R21**.
