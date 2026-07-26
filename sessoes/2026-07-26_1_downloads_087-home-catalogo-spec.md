# 2026-07-26 — Downloads: spec 087 (home vira catálogo, busca funcional, redesign)

## Pedido
Mantenedor: front do Downloads horrível — home separada do catálogo não faz sentido, home deveria ser o próprio catálogo. Fazer spec completa (não codar), investigar tudo, pesquisar referências visuais (DMs Guild, DriveThruRPG, Amazon), usar skill `frontend-design`. Downloads não vende, publica links pros originais — refazer completamente a apresentação.

## O que foi feito
1. Investigação de código: `App.tsx` confirma `/` (HomePage.tsx, 22 linhas, H1+botão) separada de `/catalogo` (CatalogoPage.tsx, busca/filtro/grid reais e funcionais). `AppShell.tsx`: botão de busca do Header só faz `navigate('/catalogo')` sem query — busca do header não busca nada de fato.
2. Backend já suporta tudo que a spec precisa: `GET /api/v1/materials` aceita `q`/`system_id`/`edition_id`/`material_type`/`sort` (relevance/recent/popular/name)/`page`/`page_size` (max 60, default 20). Facetas via `/materials/facets`. Zero mudança de API necessária.
3. Pesquisa visual real via browser (Chrome MCP, navegação pública sem login): `dmsguild.com` — home É o catálogo, busca sempre visível no header, categorias como pills, múltiplas prateleiras horizontais curadas ("Populares", "Recentes", "Populares abaixo de $5" etc.) com "Ver tudo", cards com capa+selo+preço. DriveThruRPG (WebFetch bloqueado 403, confirmado por busca textual): mesmo padrão de mercado, sem tela "explorar" intermediária.
4. Escrita da spec completa em `specs/087-downloads-home-catalogo-unificado/` (spec.md, plan.md, tasks.md) via skill `new-spec`. `frontend-design` carregada como referência de processo, aplicação real fica pra fase de implementação (Fase 1 das tasks).

## Decisão de escopo
Zero código tocado nesta sessão — só investigação e spec, como pedido ("outro agente frio fazer"). 3 decisões de produto/arquitetura ficaram explicitamente pendentes na spec (não inferidas): destino da rota `/catalogo`, busca embutida no Header compartilhado (`packages/ui`) vs. local, e direção final de layout de vitrine (prateleiras vs. grid seccionado) — via `frontend-design` na implementação.

## Backlog
`specs/backlog.md` — linha `BL-087-DOWNLOADS-HOME-CATALOGO` adicionada, status "spec pronta pra desenvolvimento".

## Aprofundamento (mesma sessão, pedido adicional do mantenedor)
Pedido: aprofundar pesquisa via Chrome real em DriveThruRPG, Estante Virtual, Universo dos Livros, MercadoRPG — focando acessibilidade de busca/filtro — e escolher (não só listar pendência) o que faz mais sentido pro conjunto. Navegação real feita nos 4 sites (screenshots, interação com busca/filtro/popover). Síntese registrada em `spec.md` (`§Síntese — decisões de acessibilidade de busca/filtro`): busca sempre visível fora de popover (unânime nas 4 referências); filtros como pills+popover no modo vitrine (DriveThruRPG) e sidebar completa (`CatalogFilterSidebar` já existente) só no modo resultado; termo de busca vira chip removível igual aos outros filtros; contagem de resultado visível; sem botão "Filtrar" que exige clique extra (anti-padrão do MercadoRPG evitado); sem dropdown de escopo de busca (desnecessário pro nosso volume).

Pedido seguinte, mesma sessão: adicionar prateleiras "mais visitados" (combinando visualização + clique baixar/link), "recém adicionado", "mais bem avaliados" (criar 5 estrelas se não existir). Investigação de backend encontrou:
- Avaliação 5 estrelas **já existe completa** (`download_rating`, `routes/ratings.ts`) — só não está agregada/exposta na listagem.
- Clique em baixar/acessar **já é métrica real** (`download_metric_daily.download_count`, `routes/downloads.ts`).
- **Débito real descoberto:** `download_metric_daily.view_count` existe desde a spec 070 (migration_008) e é lido em `routes/admin.ts` pro painel de métricas, mas **nenhuma rota grava essa coluna** — painel sempre mostrou 0 visualizações. Não é bug introduzido nesta sessão, é achado de investigação de código pré-existente.

Spec 087 ampliada (Requisitos 13-17) pra: implementar gravação real de `view_count` na ficha pública, expor `avg_rating`/`rating_count`/popularidade combinada na listagem, e as 3 prateleiras. Escopo mudou de "só frontend" pra "frontend + backend" — `spec.md` cabeçalho e `plan.md`/`tasks.md` atualizados (nova Fase 1B de backend, `pnpm verify:api` agora obrigatório).

## Revisão independente (agente g1-governance-reviewer, 2x — 1ª deu erro de API, relançada)
Pedido do mantenedor: revisar a spec com agente independente focando clareza/completude/design/funcional, respeitando `AGENTS.md`/template `new-spec`. Rodada 2 (bem-sucedida) achou, veredito "corrigir":
- **Importante**: Requisito 2 misturava afirmação categórica ("`/catalogo` deixa de existir") com decisão marcada como pendente — reescrito pra não pré-decidir.
- **Importante**: dedup de `view_count` (Requisito 13) sem critério mínimo verificável — adicionado ("no máximo 1 incremento por sessão/IP+material+dia" como comportamento observável obrigatório, mecanismo concreto livre).
- **Importante**: piso mínimo N de avaliações pra prateleira "Mais bem avaliados" ficava solto como "decisão de implementação" numa task, sem estar entre as perguntas formais ao mantenedor (T0.1) — promovido a item 6 de T0.1/`plan.md`, com default sugerido N=3 se o mantenedor não tiver preferência.
- **Nit**: `pnpm verify:api` estava só em `plan.md`/`tasks.md`, faltava nos Critérios de aceite formais do `spec.md` — adicionado.
- **Nit**: nome de componente de prateleira inconsistente entre arquivos (`ShowcaseShelves.tsx` em plan.md vs. `MaterialShelf.tsx` em tasks.md) — unificado em `MaterialShelf.tsx` (nome provisório, mas consistente).
Nenhum achado bloqueante nas 2 rodadas — formato aderente ao template `new-spec`, claims técnicas (view_count nunca gravado, activeFilters sem `q`, tokens de tema) verificadas contra código real e corretas, governança/gate mapeados corretamente (nenhuma decisão de escopo/pacote-compartilhado pré-tomada sem marcar como pendente).

## Rodada final: as 6 decisões respondidas pelo mantenedor (2026-07-26, mesma sessão)
Pedido: "já faça as perguntas, detalhando bem o que impacta: o foco é escalonamento, funções centrais tem que se comunica para facilitar manutenção além de serem semelhantes nas fuções e visuais". `AskUserQuestion` disparado em 2 lotes (limite de 4 perguntas por chamada):

**Lote 1** — Busca no Header compartilhado (**escolhido**, não local — decisão pesada pelo foco em escalonamento/funções centrais explicitado pelo mantenedor, apesar da recomendação técnica inicial ser "começar local"); rota `/catalogo` ambas válidas (**escolhido**); layout prateleiras horizontais roláveis (**escolhido**, escala melhor); peso da fórmula de popularidade — **REJEITADO pelo mantenedor**: "solução absurdamente preguiçosa. tem que pensar em algo dinamico, não fixo".

**Correção do peso (pesquisa real feita antes de re-perguntar):** WebSearch em 3 algoritmos de produção — Wilson score lower bound (Reddit), Bayesian average/weighted rating (IMDB Top 250), Hacker News gravity/decay. Nova pergunta oferecendo Bayesian+decay temporal vs. só Wilson vs. só decay — mantenedor escolheu **Bayesian average + janela temporal móvel** (ancora material novo na média do catálogo em vez de penalizar, tendência recente domina sobre acumulado histórico).

**Lote 2** — sort formal E prateleira fixa pros dois, não só prateleira (**escolhido ambos**); piso mínimo de avaliações também vira Bayesian average em vez de N fixo (**escolhido**, consistência com a decisão do peso).

**Correção crítica adicional do mantenedor** (mid-turn, depois das decisões): "materiais que só foram visitados, mas nunca baixados não podem escalonar ou se mostrar. não faz sentido. tem que ter esse corte." — Bayesian average sozinho ancora na média, não ZERA um material sem download. Adicionado **corte de elegibilidade obrigatório** (`WHERE download_count >= 1`, aplicado ANTES do Bayesian average) como regra de produto fixa, não ajustável por constante — material só-visualizado fica com `popularity_score: null`, nunca entra em `sort=trending`/prateleira "Mais visitados", independente de quantas visualizações tiver.

`spec.md` (Requisitos 2/3/5/13-16, seção de cálculo reescrita), `plan.md` (§Decisões reescrito com histórico + justificativa técnica de cada escolha) e `tasks.md` (todas as fases atualizadas, T0.1 vira rechecagem em vez de pergunta aberta, T1B ganha task de corte de elegibilidade com teste crítico obrigatório) atualizados por completo.

## Rodada 3 de revisão: fase-a-fase exaustiva (2026-07-26/27, agente g1-governance-reviewer)
Pedido do mantenedor: "voce sempre deixa passar mais de 30 coisas... se voce não viu, não significa que não tem" — revisão mais profunda, fase por fase de `tasks.md` cruzando contra `spec.md`/`plan.md` inteiros. Perguntado (AskUserQuestion) se paralelizar 1 agente por fase ou 1 sequencial — mantenedor escolheu 1 agente sequencial. Achados (veredito "corrigir"), todos aplicados:

**Bloqueantes:**
1. Consumidor real `accounts` (app de SSO/login) faltava na lista de smoke de `Header` em `plan.md`/`tasks.md` T3.4 — confirmado por grep (`apps/accounts/frontend/src/main.tsx:286`), maior risco da lista (regressão ali afeta porta de entrada do portal inteiro).
2. `esferas`/`srd` listados como consumidores de `Header` mas não têm frontend implementado (`Glob` vazio) — T3.4 pedia smoke de app inexistente, "feito quando" não executável como escrito.
3. Nenhuma task estendia `apps/downloads/frontend/src/types/material.ts` (schema Zod) nem `SORT_OPTIONS`/`SORT_LABELS` do frontend com os campos novos (`avg_rating`/`rating_count`/`popularity_score`/`sort=rating`/`sort=trending`) — sem isso, campos novos chegam como `unknown`/`any`, violando normalização pétrea de `AGENTS.md`.

**Importantes:**
4. Canonical entre `/` e `/catalogo` — spec.md/plan.md levantam a necessidade (conteúdo duplicado aos olhos do Google) mas nenhuma task implementava; achado adicional: `apps/downloads/frontend` não tem NENHUM mecanismo de manipulação de `<head>` hoje (sem react-helmet ou equivalente).
5. `MaterialCard.tsx` usa `before:absolute before:inset-0` pra alvo de clique único do card — Requisito 17 (estrelas) não tinha cuidado explícito de não quebrar isso.
6. `routes/materials.ts` (a rota mais tocada por esta spec) não tem NENHUM teste hoje (`materials.test.ts` não existe) — "nenhum teste existente quebrado" no critério de aceite ficava sem o que verificar; risco de regressão silenciosa no comportamento pré-existente (paginação, facetas, sorts atuais) pelo novo join/subquery.
7. Dedup de `view_count` (T1B.1) sem mecanismo de janela/expiração pra sessão anônima especificado — só "mesma origem, mesmo dia" coberto, não "mesmo IP, dias diferentes".

**Nits:** navegação por teclado da prateleira horizontal rolável não coberta explicitamente em T4.2; observações negativas confirmadas contra código real (não achados, mas verificadas): reversão de download não existe no sistema hoje (sem endpoint de estorno), nome de componente `MaterialShelf` consistente.

Todos os bloqueantes/importantes corrigidos: `tasks.md` ganhou T3.5 (schema Zod), T4.4 (canonical), ajustes em T2.5 (clique único), T1B.6 (testes de regressão da rota), T4.2 (teclado), T3.4 (lista de consumidores corrigida); `plan.md` §Arquivos afetados/§Impacto em consumidores corrigidos com a lista real de consumidores de Header.

(Nota operacional: um 2º agente foi acidentalmente lançado em worktree isolado pedindo "reportar logo" — sem contexto da spec 087, revisou por engano um commit de git não relacionado (`f766111`, fix E017 de deploy). Resultado descartado, sem relação com esta spec.)

## Próximo passo
Spec 100% fechada, sem decisão pendente, revisada 3x (2 rodadas de conteúdo geral + 1 rodada fase-a-fase exaustiva). Sessão de implementação: T0.0-T0.4 (gate/rechecagem/aprovação nominal de `packages/ui`), depois `tasks.md` fase a fase (Fase 1B de backend pode rodar em paralelo com Fase 1 de design, ambas antes da Fase 2). Aprovação nominal de commit em `packages/ui` (T0.4/T3.0) ainda não foi dada nesta sessão — é ação separada da decisão de design já confirmada.
