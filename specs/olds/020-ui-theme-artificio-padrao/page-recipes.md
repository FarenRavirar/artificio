# Recipes de pagina — Spec 020

Status: **contrato documentado**. Nao ha implementacao em `packages/ui` nesta revisao.

## Premissa

Recipes de pagina sao guias de composicao para telas recorrentes do Artificio RPG. Elas definem ordem de blocos, slots visuais, estados obrigatorios e fronteiras entre shell compartilhado e dominio local.

Recipes **nao** sao layouts forcados, componentes gigantes ou containers com regra de negocio. Cada app continua dono de dados, fetch, auth, copy contextual, SEO especifico, normalizadores, permissoes, rotas e assets de dominio.

Se um recipe virar codigo em `packages/ui`, ele entra em T14/fatia propria: SDD Completo, build do pacote, builds/smokes dos consumidores tocados e rollback por app.

## Inventario vivo

- `PublicSearchPage`: `apps/glossario/frontend/src/App.tsx` (`HomePage`) combina header compartilhado, busca, landing, filtros, resultados, loading/error/empty e footer.
- `CatalogPage`: `apps/mesas/frontend/src/pages/CatalogoPage.tsx` combina titulo, contagem, filtros desktop/mobile, chips ativos, refresh, erro, empty, grid e paginacao.
- `AdminWorkspacePage`: `apps/mesas/frontend/src/pages/GestaoPage.tsx` e `apps/site-admin/src/App.tsx` combinam shell lateral/abas, toolbar, listas/tabelas, paineis especializados, modais/drawers e feedback de operacao.
- `AuthPage`: `apps/accounts/frontend/src/main.tsx`, `apps/mesas/frontend/src/pages/LoginPage.tsx`, `apps/glossario/frontend/src/pages/Login.tsx` cobrem login compacto SSO, retorno seguro, checagem de sessao e CTA Google.
- `EditorialPage`: `apps/site/src/pages/blog/[slug].astro` e `apps/site/src/pages/[slug].astro` cobrem artigo/pagina estatica com breadcrumb, meta/canonical/json-ld, prose sanitizado, capa, tags, TOC e relacionados.
- `DetailPage`: `apps/mesas/frontend/src/pages/MesaPage.tsx`, `apps/mesas/frontend/src/features/table/TableView.tsx`, `apps/mesas/frontend/src/features/master/MasterProfilePage.tsx` e `apps/glossario/frontend/src/components/ResultCard.tsx` cobrem detalhe publico com hero, conteudo, metadados, CTA/sidebar, estados e acoes condicionais.

## Recipe: PublicSearchPage

Intencao: pagina publica de busca/leitura, com entrada rapida e resultado escaneavel.

Exemplo base: glossario `HomePage`.

Composicao:
- `Header` + area principal centralizada + `Footer`.
- Hero/badge opcional quando nao ha busca ativa.
- Search principal acima de filtros e resultados.
- Filtros so aparecem apos intencao de busca ou quando ha filtro ativo.
- Resultados em lista/grid simples, com contagem e agrupamento quando o dominio precisar.
- Estados: loading, error, empty, no-results e resultado parcial.

Slots:
- `heroSlot`, `searchSlot`, `filterSlot`, `resultSlot`, `emptySlot`, `errorSlot`, `actionSlot`.

Fronteiras:
- Query, debounce, analytics, agrupamento, ranking e permissao admin ficam no app.
- Recipe so define ritmo visual, espaçamento, estados e ordem de leitura.

## Recipe: CatalogPage

Intencao: pagina publica de catalogo navegavel, com filtros ricos, URL state e lista paginada.

Exemplo base: mesas `CatalogoPage`.

Composicao:
- Header de pagina com titulo, subtitulo, contagem e acao de limpar.
- Painel de filtros desktop persistente.
- Drawer/floating action de filtros no mobile.
- Chips de filtros ativos.
- Indicador de refresh separado de loading inicial.
- Grid responsivo de cards.
- Empty state com acao de limpar filtros.
- Paginacao simples ou cursor.

Slots:
- `titleSlot`, `countSlot`, `filterDesktopSlot`, `filterMobileSlot`, `activeFiltersSlot`, `sortSlot`, `cardGridSlot`, `paginationSlot`.

Fronteiras:
- URL parser, filtros validos, arvore de sistemas, ordenacao e cards pertencem ao app.
- Recipe nao conhece shape de mesa, termo, produto ou sistema.

## Recipe: AdminWorkspacePage

Intencao: area operacional densa, com navegacao de contexto, CRUD, status e feedback claro.

Exemplos base: mesas `GestaoPage`; site-admin `App`, `PostsList`, `PostEditor`.

Composicao:
- Shell admin com sidebar ou abas, conforme densidade.
- Toolbar superior com titulo, status/badge, busca e acao primaria.
- Workspace com listas, tabelas, formularios ou paineis.
- Feedback de operacao via toast/alert inline.
- Confirmacoes para acao destrutiva.
- Estados: carregando, vazio, erro, saving/busy por item.

Slots:
- `navSlot`, `toolbarSlot`, `statusSlot`, `workspaceSlot`, `inspectorSlot`, `modalSlot`, `toastSlot`.

Fronteiras:
- Permissao, endpoints, mutacoes, transicoes de status e confirm text ficam no app.
- Recipe so padroniza densidade, hierarquia visual, feedback e estados de operacao.

## Recipe: AuthPage

Intencao: tela curta de entrada, centrada, sem distrair do login Google unico.

Exemplos base: accounts `main.tsx`; mesas `LoginPage`; glossario `Login`.

Composicao:
- Painel unico, max-width curto.
- Logo/identidade do Artificio.
- Titulo direto.
- Texto de suporte curto.
- CTA Google como acao primaria.
- Link de retorno ao projeto/portal.
- Estado "validando sessao" quando aplicavel.
- Toggle de tema permitido apenas se app estiver dark-ready.

Slots:
- `brandSlot`, `titleSlot`, `subtitleSlot`, `primaryActionSlot`, `sessionStateSlot`, `returnSlot`, `trustNoteSlot`.

Fronteiras:
- Allowlist de `return`, checagem `/api/auth/me`, OAuth URL, redirect e copy legal ficam em `accounts`/app.
- Recipe nao implementa auth.

## Recipe: EditorialPage

Intencao: pagina estatica/SSG de leitura longa, SEO forte e zero-JS publico quando possivel.

Exemplos base: site `blog/[slug].astro` e `[slug].astro`.

Composicao:
- `Base` static-friendly com meta, canonical, OG/Twitter e JSON-LD.
- Breadcrumb.
- Article header com categoria, titulo e meta.
- Capa opcional.
- Corpo `.prose` sanitizado.
- Tags, TOC e relacionados quando existirem.
- Para paginas institucionais: mesma base, sem elementos de artigo que nao se aplicam.

Slots:
- `breadcrumbSlot`, `articleHeaderSlot`, `coverSlot`, `proseSlot`, `tocSlot`, `tagsSlot`, `relatedSlot`.

Fronteiras:
- Sanitizacao, import WP, canonical, 301 futuro, content model e SEO editorial ficam no site/`@artificio/content`.
- Recipe deve permanecer static-friendly: CSS/classes/vars, sem exigir React/auth client no publico.

## Recipe: DetailPage

Intencao: detalhe publico de entidade, com decisao/CTA, metadados e informacao profunda.

Exemplos base: mesas `MesaPage`/`TableView`; mestre `MasterProfilePage`; glossario `ResultCard` como detalhe compacto de termo.

Composicao:
- Breadcrumb quando pagina propria.
- Hero/identity block.
- Blocos de conteudo em ordem de decisao: resumo, agenda/atributos, conteudo, autor/mestre, seguranca/confianca, tecnico.
- Sidebar/action panel sticky no desktop quando houver CTA.
- CTA sticky mobile quando decisao principal precisar ficar sempre acessivel.
- Estados de loading, not found, service unavailable e erro generico.
- Acoes owner/admin isoladas visualmente do fluxo publico.

Slots:
- `breadcrumbSlot`, `heroSlot`, `metadataSlot`, `contentBlocksSlot`, `trustSlot`, `technicalSlot`, `actionPanelSlot`, `ownerActionsSlot`, `mobileCtaSlot`.

Fronteiras:
- ViewModel, ownership, CTA behavior, tracking, fetch e normalizacao ficam no app.
- Recipe so dita composicao, responsividade, estados e relacao entre conteudo principal e acoes.

## Primitives requeridas

Os recipes dependem dos contratos de `primitives-form-state.md`:

- `Button`, `Badge`, `Panel`, `Toolbar`, `FilterPanel`, `State`, `Modal`, `Drawer`, `HeaderAction`.
- Campos (`Field`, `TextInput`, `Textarea`, `Select`) para admin/auth/catalogo.
- Tokens de theme, foco, surface, line, radius e shadow.

Primitives iniciais ja existem em `packages/ui` desde B4 (2026-06-15). Apps podem migrar de forma incremental quando a tela piloto justificar; ate la, componentes locais seguem validos.

**Cadeia de dependencia:** tokens semanticos `success/warning/danger/info` (**B11**) -> primitives (**B4**) -> recipes runtime. B11 e B4 ja fecharam; recipes runtime continuam oportunisticos e so devem virar codigo quando dois apps repetirem a mesma composicao com baixa divergencia.

## Fora de escopo

- Migrar telas existentes.
- Criar componentes `PageFrame` em `packages/ui`.
- Alterar rotas, SEO, auth, fetch, schema, banco ou permissoes.
- Forcar site Astro a importar React no publico.
- Centralizar copy contextual.

## Rollout futuro

1. Manter este documento como checklist de design para novas telas.
2. Usar primitives compartilhadas em piloto pequeno quando reduzir duplicacao.
3. Extrair recipes somente quando dois apps repetirem a mesma composicao com baixa divergencia.
4. Validar por app tocado: desktop/mobile, contraste AA, loading/error/empty, foco, keyboard e smoke de rota.
5. Rollback: app volta ao wrapper local mantendo tokens compartilhados.

## Criterio de fechamento T8/B5

T8 e B5 fecham quando os seis recipes acima estao descritos como composicao, com exemplos vivos, slots, fronteiras e validacao. Esta revisao cumpre o criterio documental. Implementacao runtime fica fora do fechamento.
