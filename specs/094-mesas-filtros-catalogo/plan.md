# Plano — 094

Base de fato: estado atual verificado em código e na página pública em 2026-08-21. Rotas foram
descobertas via `artificio-api-governance`; o grafo `C-projetos-artificio` estava na geração
`2026-08-21T13:40:12Z`. `check_index_coverage` marcou `CatalogoPage.tsx:407` e
`tables.ts:364` como parse parcial; ambos os intervalos foram lidos diretamente. Os demais
arquivos usados não tinham gap registrado, mas a metadata havia mudado; as conclusões materiais
foram confirmadas na fonte.

## Estado atual verificado (ponto de partida)

| Fato | Onde/evidência | Consequência pro plano |
|---|---|---|
| A spec 081 prescreveu todos os filtros numa barra horizontal. | `specs/081-.../tasks.md`, T2.2 | Não repetir a solução como requisito; redesenhar hierarquia. |
| A spec 093 tratou altura, borda e dado sujo. | `specs/093-.../spec.md:295,414-417`; `tasks.md:426-522` | Preservar ganhos, mas não declarar o problema estrutural resolvido. |
| Barra usa `flex-wrap`. | `CatalogoPage.tsx:449-453` | Substituir quebra emergente por grid/breakpoints deliberados. |
| Hero e catálogo mantêm duas buscas gerais. | `CatalogoPage.tsx:400-414` e `:456-463` | Uma fonte de estado e uma ação de busca. |
| Busca textual e busca do sistema repetem ID. | DOM vivo + `CatalogTree.tsx:396` | Separar prefixos/IDs e testar unicidade. |
| Sistema é árvore rica, não select simples. | `CatalogTree.tsx:301-533` | Preservar navegação, mas abri-la sob demanda em popover/dialog. |
| Metadados técnicos são renderizados para `role="user"`. | `CatalogTree.tsx:187-197,528-530` | D0.5 precisa ocultar parágrafo, “nome PT” e alias badge, sem retirar aliases da busca. |
| Estado é URL-driven. | `useCatalogFilters.ts`; `catalogFilters.ts` | Estender contrato existente, não criar estado paralelo. |
| Query já cancela transições e pagina. | `catalogService.ts:70-78`; `useInfiniteCatalogTables.ts` | Preservar AbortSignal, reset e deduplicação. |
| Facetas vêm do backend real. | `useStyleFacets.ts`; `GET /api/v1/tables/style-facets` | Nenhum enum hardcoded de estilos. |
| `useStyleFacets` já valida shape e tipos. | `useStyleFacets.ts:4-13` | Reusar hook/normalizador; não criar fetch ou validação paralela. |
| Backend já filtra tipo, público, estado e cidade. | `tables.ts:49-66,170-182` | Exposição é majoritariamente frontend após D0.2. |
| Backend usa overlap para estilos. | `tables.ts:206-213` | UI e chips devem comunicar/ preservar semântica QUALQUER. |
| UI oferece sorts sem implementação. | frontend `VALID_SORTS`; `tables.ts:216-261` | Fechar divergência na Fase 1. |
| UI e parser mantêm listas de enums separadas e já divergentes. | `CatalogoPage.tsx:32-36`; `catalogFilters.ts:23-27` | Criar registro canônico único e eliminar listas locais. |
| Desktop e mobile oferecem sorts diferentes. | `ResultsHeader.tsx:34-38`; `CatalogoPage.tsx:653-655` | Matriz de paridade inclui sort, não só filtros. |
| Backend interpreta destaque apenas como string `true`. | `tables.ts:180` | D0.2 mantém esse parâmetro sem consumidor no frontend; não adicioná-lo ao estado/URL do catálogo. |
| `slots_open` é `NOT NULL` e já participa do ranking popular. | `migration_100_add_slots_open.sql:20`; `tables.ts:227-229` | Sort de vagas não precisa migration nem fixture nula; corrigir TODO obsoleto. |
| Seleção de sistema já emite analytics. | `CatalogoPage.tsx:313` | Preservar uma emissão de `trackFilterSistema`; não inventar eventos novos. |
| `ActiveFiltersChips` já existe e será alterado. | `ActiveFiltersChips.tsx:55-109`; uso em `CatalogoPage.tsx:729` | Classificar como estendido e criar/estender teste nominal. |
| `CatalogTree` tem consumidor em Mesas e via `CatalogExplorer` no site-admin. | graph `trace_path` + imports | Qualquer mudança no pacote exige default compatível e smoke dos consumidores. |

## Arquitetura da solução

### Fase 0 — decisões e baseline aprovado

D0.1–D0.5 estão aprovadas no registro autoritativo de `spec.md`. A Fase 0 não pergunta novamente
por arquitetura, filtros, busca, sorts ou pacote compartilhado. Ela produz o inventário T0.2a e
o baseline visual T0.6, aplica a política aprovada e registra o resultado antes do código runtime.

O baseline visual inclui screenshots em 320, 390, 768, 1280 e 1440 px, dark/light, com medidas
do bloco de filtros. Essas imagens serão comparação, não “golden pixel” frágil.

Antes da Fase 1, produzir um inventário read-only das mesas que satisfazem **o mesmo predicado de
visibilidade pública de `GET /api/v1/tables`** (`status='active'`, `archived_at IS NULL` e regra
de validade de importadas). A medição deve registrar:

| Campo | Medida mínima |
|---|---|
| `type`, `audience` | preenchidos, distribuição por enum e valores fora do enum esperado |
| `state` | preenchidos, distribuição por UF, vazios e valores fora do padrão de UF |
| `city` | preenchidos, cardinalidade, top valores e duplicatas por trim/case |
| `featured` | `true`/`false` e percentual elegível em cada grupo |

Executar via SQL `SELECT` read-only ou resposta pública agregada equivalente. Antes do SQL, ler
schema/assinatura real; não chutar colunas. Não persistir nomes de mesas, contatos, usuários,
credenciais ou qualquer dado pessoal no relatório. Cruzar ao menos uma combinação não vazia de
cada filtro candidato contra a rota pública e registrar `total`. Aplicar sem nova pergunta:

- `featured` é sempre excluído da UI;
- `type`, `audience`, `state` ou `city` só entra se houver pelo menos dois valores úteis com
  resultado público;
- opções com zero resultados são omitidas;
- `state` e `city` só são renderizadas para modalidade presencial/híbrida;
- `city` só é habilitada após UF e suas opções são derivadas dessa UF;
- cada inclusão/omissão registra a medição que a determinou.

Existir no handler não é evidência de utilidade. A medição é gate técnico, não nova decisão de
produto.

### Fase 1 — contrato de filtros, URL e ordenação

#### Modelo único

Estender `CatalogFilters` com os candidatos que passarem pela política de D0.2/T0.2a:

```ts
type TableTypeOption = 'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta';
type AudienceOption = 'livre' | 'adultos';

interface CatalogFilters {
  // atuais
  search: string;
  system: string;
  modality: ModalityOption | '';
  priceType: PriceTypeOption | '';
  experience: ExperienceLevelOption | '';
  seal: '' | 'ddal' | 'covil-do-lich';
  styles: string[];
  sort: SortOption;
  page: number;
  limit: number;
  // habilitados por T0.2a
  type: TableTypeOption | '';
  audience: AudienceOption | '';
  state: string;
  city: string;
}
```

Uma definição canônica dos campos alimenta desktop, mobile, contagem e limpeza. Não criar um
segundo tipo para o drawer.

Criar `apps/mesas/frontend/src/utils/catalogFilterOptions.ts` como fonte única de:

- `SORT_OPTIONS` com value/label;
- valores de modalidade, preço, experiência, selo, tipo e público;
- type guards/parsers derivados dessas mesmas listas;
- metadados necessários à apresentação compartilhada desktop/mobile.

`CatalogoPage`, `ResultsHeader`, `catalogFilters.ts` e os componentes novos importam essa fonte.
É proibido manter um segundo `VALID_SORTS`, `VALID_SORT_VALUES` ou arrays equivalentes. Um teste
compara o conjunto renderizado ao conjunto aceito pelo parser.

#### URL e query

`parseCatalogFilters` e `buildCatalogParams` mantêm round-trip. `mapFiltersToQueryParams` envia
snake_case conforme contrato atual. Arrays de estilos são normalizados com trim, remoção de
duplicatas e ordenação determinística antes da URL/cache key.

`featured` não entra em `CatalogFilters`, parser, builder, mapper, chips nem URL canônica. O
parâmetro preexistente do backend permanece intocado e sem consumidor novo no catálogo.

Por D0.3, a busca usa `draftSearch` visual e só promove para `filters.search` na submissão por botão/Enter.
Back/forward sincroniza o draft com o valor confirmado sem loop de navegação. Digitação na busca
interna de sistemas filtra apenas o catálogo já carregado, sem request de mesas.

#### Ordenação

Por D0.4, a lista e o comportamento são vinculantes:

- `popular`, `recent`, `price_asc`, `price_desc` permanecem;
- `slots` passa a ordenar `slots_open DESC`, com `created_at DESC` como desempate; a coluna é
  `NOT NULL` desde migration 100;
- `ending_soon` sai de tipo, opções e parser enquanto não existir data final.

No mesmo patch, substituir o TODO de `tables.ts:261`: ele cita `slots_available`, mas o contrato
real é `slots_open`. Comentário novo registra apenas a pendência verdadeira de
`ending_soon`/data final; não manter afirmação sabidamente falsa.

URL legado com `ending_soon` cai em `popular` e nunca produz opção selecionada sem efeito.

### Fase 2 — interface responsiva única

#### Composição

Extrair de `CatalogoPage.tsx`:

- `CatalogFiltersBar`: busca, controles primários, botão e filtros ativos;
- `CatalogAdvancedFilters`: filtros secundários e facetas;
- `CatalogSystemPopover`: gatilho compacto e árvore de sistemas;
- definição canônica de labels/opções usada por desktop e mobile.

`CatalogoPage` continua dono dos hooks, resultados, analytics e paginação; componentes recebem
estado e callbacks tipados. A extração evita que mais quatro filtros agravem o arquivo atual e
reduz divergência desktop/mobile.

`trackFilterSistema` permanece no callback canônico de seleção e dispara uma vez por mudança
confirmada. O refactor não adiciona analytics para abrir painel, buscar ou selecionar outros
filtros: evento novo só entra depois de decisão explícita e catálogo em `packages/analytics`.

#### Sistema

O gatilho mostra “Sistema” ou caminho/nome selecionado. Ao abrir:

- desktop: popover com largura/altura limitadas e scroll interno;
- mobile: dialog/drawer;
- busca interna mantém `aria-label="Buscar sistema"`;
- fechamento devolve foco ao gatilho;
- Escape fecha sem limpar seleção.

Por D0.5, `CatalogTreeProps` ganha a política aditiva de apresentação
`presentation?: 'full' | 'selection'`, com default `'full'` para não alterar consumidores:

- `full`: comportamento atual, incluindo nome PT, alias badge e explicação final;
- `selection`: esconde os três metadados técnicos, mas `nodeMatchesQuery` continua buscando por
  nome, nome PT, slug e aliases.

Mesas passa `presentation="selection"`. Teste do pacote prova o default e prova que uma busca por
alias ainda encontra/seleciona o nó sem renderizar o alias. CSS para apenas esconder conteúdo não
satisfaz R18.

#### Layout desktop

Grid deliberado, sem `flex-wrap` emergente:

1. busca cresce;
2. sistema tem largura limitada;
3. modalidade e preço têm largura estável;
4. “Mais filtros” mostra badge com quantidade avançada;
5. “Buscar” é a ação primária.

Abaixo ficam atalhos aprovados, chips ativos e “Limpar tudo”. Contagem/ordenação formam cabeçalho
dos resultados, não parte da barra.

#### Layout mobile

Busca e sistema ocupam largura total; “Mais filtros” abre drawer/dialog com ações visíveis e
sticky de “Aplicar” e “Limpar”. O mesmo componente de campos e o mesmo modelo geram query. O
botão não fica sobreposto ao FAB de feedback nem depende de posição fixa para ser descoberto.

#### Atalhos

Atalhos são aliases de filtros reais, nunca estados paralelos. Exemplo: “Mesas gratuitas” define
`priceType=free`; clicar novamente remove. DDAL/Covil seguem exclusão mútua quando elegíveis pela
medição de produção, mas hoje não são renderizados porque ambos retornaram zero. Facetas de
estilo vêm de `style-facets`, com no máximo o conjunto aprovado visível como atalho; o restante
fica pesquisável no painel. Atalho/faceta sem resultado público não é renderizado.

### Fase 3 — validação final e smoke real

Antes de liberar a Fase 3, a correção pós-auditoria da Fase 2 deve provar: opções e atalhos com
resultado público conforme R22; paridade desktop/mobile por interação, sem comparação
autorreferencial; ordenação `slots` com empate e desempate por data; contenção de foco nos dialogs;
smoke do consumidor `site-admin`; e smoke Mesas com o cookie `artificio_theme` efetivamente
alternado, incluindo loading e erro.

Essas provas técnicas foram concluídas em 2026-08-21 e registradas em `tasks.md` T1.5–T2.13.
A única trava restante da Fase 2 é a aprovação visual explícita do mantenedor em T2.11; ela não é
substituída por teste automatizado nem por autoaprovação do agente.

Executar validação focada durante cada PR. Só após o mantenedor declarar encerradas as rodadas de
review executar validação completa, sequencial e sem `--force`.

O smoke real cobre página com backend disponível e inspeciona rede/DOM, não só screenshot:

- uma request por busca/filtro confirmado;
- query params corretos;
- reload/back/forward;
- reset do infinito;
- dark/light e cinco viewports;
- teclado, Escape, retorno de foco e remoção de chips;
- estados loading, erro, vazio, com/sem filtros;
- ausência de ID duplicado e texto técnico.
- ausência de “nome PT”/aliases visuais com busca por alias ainda funcional;
- exatamente uma emissão de `trackFilterSistema` por seleção;
- igualdade de opções e sorts entre desktop, mobile, parser e URL.

## Arquivos afetados

### Previstos — frontend Mesas

| Arquivo | Mudança prevista |
|---|---|
| `apps/mesas/frontend/src/pages/CatalogoPage.tsx` | Remover busca duplicada, delegar UI, preservar hooks/resultados. |
| `apps/mesas/frontend/src/components/CatalogFiltersBar.tsx` | Novo: linha primária, atalhos, chips e ação de busca. |
| `apps/mesas/frontend/src/components/CatalogAdvancedFilters.tsx` | Novo: filtros secundários/facetas compartilhados por viewport. |
| `apps/mesas/frontend/src/components/CatalogSystemPopover.tsx` | Novo: gatilho compacto + árvore. |
| `apps/mesas/frontend/src/components/ActiveFiltersChips.tsx` | Labels/remoção das facetas habilitadas por T0.2. |
| `apps/mesas/frontend/src/components/ResultsHeader.tsx` | Lista de sorts verdadeira. |
| `apps/mesas/frontend/src/components/FilterDrawer.tsx` | Hospedar composição comum; remover duplicação de campos. |
| `apps/mesas/frontend/src/services/catalogService.ts` | Tipos e mapper das facetas habilitadas por T0.2. |
| `apps/mesas/frontend/src/utils/catalogFilters.ts` | Parse/build/normalização e defaults. |
| `apps/mesas/frontend/src/utils/catalogFilterOptions.ts` | Novo: fonte única de enums, sorts, labels e guards. |
| `apps/mesas/frontend/src/hooks/useCatalogFilters.ts` | Preservar URL state e sincronizar busca draft/confirmada. |
| `apps/mesas/frontend/src/hooks/useInfiniteCatalogTables.ts` | Só se testes revelarem ajuste necessário ao novo filter key. |
| `apps/mesas/frontend/src/utils/focusTrap.ts` | Novo: contenção de Tab/Shift+Tab compartilhada pelos dialogs. |
| `apps/mesas/frontend/src/App.tsx` | Corrigir loading/erro para tokens legíveis em dark/light, achado pelo smoke. |
| `apps/mesas/frontend/src/components/TableCard.tsx` | Remover controles interativos aninhados no link do card, achado pelo smoke. |

Os testes nominais de `App` e `TableCard` acompanham essas duas correções pós-smoke.

### Previstos — backend Mesas

| Arquivo | Mudança prevista |
|---|---|
| `apps/mesas/backend/src/routes/tables.ts` | Implementar `slots_open DESC, created_at DESC`; remover TODO obsoleto; preservar filtros existentes. |

### Autorizado — pacote compartilhado

| Arquivo | Mudança prevista |
|---|---|
| `packages/catalog-ui/src/CatalogTree.tsx` | Adicionar `presentation?: 'full' | 'selection'`, com default `full`. Em `selection`, ocultar parágrafo, nome PT e badges de alias sem alterar o matcher. |
| `packages/catalog-ui/src/CatalogTree.test.tsx` | Estender junto da prop: provar default `full`, metadados técnicos ausentes em `selection` e busca por alias preservada. |

Arquivos não previstos que surgirem devem ser justificados contra um requisito antes da edição;
mudança em outro app/pacote exige ampliação explícita do escopo.

## Contratos/interfaces tocados

- `GET /api/v1/tables`: sem endpoint novo; parâmetros existentes passam a ter novos consumidores
  na UI conforme T0.2a. `sort=slots` muda de aceito-sem-efeito para comportamento real.
- `GET /api/v1/tables/style-facets`: inalterado, continua fonte das facetas.
- `GET /api/v1/systems`: inalterado, continua fonte da árvore.
- URL público do catálogo: adição apenas das facetas de `type`, `audience`, `state` e `city` que
  passarem T0.2a; valores inválidos normalizados. `featured` não entra no estado/URL frontend.
- `CatalogTreeProps`: mudança aditiva e default-preserving autorizada por D0.5; modo público compacto
  afeta apresentação, nunca a capacidade de busca por nome PT/alias.

## Impacto em consumidores

- `apps/mesas/frontend`: consumidor principal, desktop e mobile.
- `apps/site-admin`: consumidor indireto de `CatalogTree` por `CatalogExplorer`; smoke obrigatório
  porque `packages/catalog-ui` será tocado.
- Nenhum impacto previsto em SSO, accounts, backend de outros projetos ou banco.

## Rollback

- Frontend/backend: revert da PR da fase; URLs com novos parâmetros continuarão ignoradas pelo
  frontend antigo e já são aceitas pelo backend.
- `sort=slots`: revert restaura comportamento anterior, mas links com `sort=slots` voltam a cair
  na ordem default silenciosa; registrar isso no rollback da PR.
- `packages/catalog-ui`: prop aditiva pode ser revertida junto com o consumidor Mesas. Default
  preservado impede migração simultânea de site-admin.
- Não há migration nem escrita de dados; rollback não exige SQL.
- Deploy/rollback real exige autorização nominal própria e segue esteira GitHub.

## Validação — como provar que funciona

### Objetiva e focada por fase

1. Frontend:
   - `rtk vitest run <arquivos focados>` dentro de `apps/mesas/frontend`;
   - `rtk tsc -p tsconfig.json --noEmit`;
   - lint do pacote afetado.
2. Backend:
   - `rtk vitest run src/routes/tables.catalog.test.ts`;
   - `rtk tsc -p tsconfig.json --noEmit`;
   - lint do backend.
3. Compartilhado:
   - `rtk vitest run src/CatalogTree.test.tsx` em `packages/catalog-ui`;
   - build/test do pacote e smoke Mesas + site-admin proporcional ao impacto.
4. API:
   - `rtk pnpm verify:api`; esperado `breaking=0`.

### Testes automatizados previstos

| Tipo | Caminho | Cobertura |
|---|---|---|
| **Novo** | `apps/mesas/frontend/src/utils/catalogFilters.test.ts` | defaults, enums, URL round-trip, estilos, filtros avançados, sort legado. |
| **Novo** | `apps/mesas/frontend/src/utils/catalogFilterOptions.test.ts` | fonte única; UI e parser aceitam exatamente os mesmos valores/sorts. |
| **Novo** | `apps/mesas/frontend/src/services/catalogService.test.ts` | mapper snake_case e ausência de parâmetros vazios. |
| **Novo** | `apps/mesas/frontend/src/components/CatalogFiltersBar.test.tsx` | uma busca, submissão, atalhos, chips, limpar, IDs únicos, teclado. |
| **Novo** | `apps/mesas/frontend/src/components/CatalogAdvancedFilters.test.tsx` | paridade dos filtros secundários e facetas. |
| **Novo** | `apps/mesas/frontend/src/components/CatalogSystemPopover.test.tsx` | abrir/fechar, busca acessível, Escape, retorno de foco, ausência visual de parágrafo, nome PT e badges de alias; busca por alias preservada. |
| **Novo** | `apps/mesas/frontend/src/components/ActiveFiltersChips.test.tsx` | labels, remoção isolada e limpeza dos filtros avançados. |
| **Novo** | `apps/mesas/frontend/src/pages/CatalogoPage.test.tsx` | integração URL/hook/resultados e uma request por ação confirmada. |
| **Novo** | `apps/mesas/frontend/src/hooks/useInfiniteCatalogTables.test.ts` | reset com novos filter keys e descarte do acumulado anterior. |
| **Novo** | `apps/mesas/backend/src/routes/tables.catalog.test.ts` | filtros reutilizados, estilos QUALQUER e sort de vagas 5/2/0 + desempate por data. |
| **Estendido** | `packages/catalog-ui/src/CatalogTree.test.tsx` | default `full`, modo `selection`, metadados ausentes e busca por alias preservada. |

### Smoke visual obrigatório

Mantenedor valida a página rodando em dark/light nos viewports 320, 390, 768, 1280 e 1440.
Registrar screenshots, medidas de overflow/linha, DOM sem IDs duplicados e request log. O aceite
visual do protótipo não substitui o smoke da implementação.
