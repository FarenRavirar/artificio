# Plano — 087

## Decisões — todas respondidas pelo mantenedor em 2026-07-26 (histórico mantido para contexto de implementação)

Estas 6 decisões mudavam o raio/comportamento da implementação e foram levadas ao mantenedor via `AskUserQuestion` (não inferidas pelo agente) — `AGENTS.md` proíbe decidir escopo/pacote-compartilhado sozinho. Todas fechadas; a rechecagem em `tasks.md` T0.1 agora é confirmação, não pergunta aberta.

1. **Rota `/catalogo`: DECIDIDO — ambas rotas válidas (2b).** `/` e `/catalogo` renderizam o mesmo componente. Zero risco de quebrar link/bookmark/indexação existente, sem decidir tipo de redirect.
2. **Busca no Header: DECIDIDO — embutida no `Header` compartilhado (`packages/ui`), não local.** Mantenedor priorizou explicitamente escalonamento e funções centrais compartilhadas entre módulos nesta rodada ("funções centrais têm que se comunicar para facilitar manutenção, além de serem semelhantes nas funções e visuais") — supera a recomendação técnica inicial de "começar local" (que priorizava menor raio de mudança sobre reaproveitamento). Downloads é o primeiro consumidor; o componente nasce pensado pra mesas/glossario/site/links/esferas/srd ligarem depois.
3. **Layout de vitrine: DECIDIDO — prateleiras horizontais roláveis** (estilo DMs Guild/DriveThru), não grid seccionado vertical. Motivo do mantenedor: escala melhor conforme mais categorias forem adicionadas (mais categorias = mais faixas, página não alonga verticalmente sem limite) e é candidata a componente central reaproveitável por outros módulos — mesmo raciocínio da decisão 2. A Fase 1 de `tasks.md` ainda roda a skill `frontend-design` pra gerar o token system/identidade visual da prateleira (isso não estava em jogo na decisão de layout, só a estrutura horizontal-vs-vertical).
4. **Peso de popularidade combinada: DECIDIDO — REJEITADA a constante fixa original (`PESO=5`).** Mantenedor apontou corretamente que constante fixa não escala nem se auto-ajusta ("solução preguiçosa... tem que pensar em algo dinâmico"). Pesquisado (WebSearch, 2026-07-26) 3 algoritmos de produção (Wilson score / Reddit, Bayesian average / IMDB, Hacker News gravity-decay) — **escolhido Bayesian average (ancora material novo na média do catálogo, não penaliza) + janela temporal móvel (tendência recente domina sobre histórico acumulado)**. Detalhe completo da fórmula em `spec.md` §Cálculo de popularidade e avaliação. **Correção adicional do mantenedor, pós-fórmula:** material com `download_count = 0` (só visualizado, nunca baixado) é **excluído por corte de elegibilidade antes do Bayesian average** — visualização isolada nunca é sinal suficiente pra aparecer/escalonar na prateleira "Mais visitados", independente do Bayesian suavizar ou não.
5. **`sort` formal vs. prateleira fixa: DECIDIDO — ambos.** "Mais bem avaliados" e "Mais visitados" viram opções formais em `SORT_OPTIONS` (usáveis no modo resultado, com busca/filtro ativo) E aparecem como prateleira fixa na home — mesma métrica central serve os 2 lugares, coerente com o objetivo de reaproveitamento desta rodada.
6. **Piso mínimo de avaliações (N): DECIDIDO — REJEITADO piso fixo, substituído por Bayesian average também no rating.** Mesmo método da decisão 4 aplicado à métrica de avaliação: sem N de corte abrupto, material com 1+ avaliação participa da prateleira/ordenação, ancorado na média geral do catálogo até acumular avaliações suficientes pra pesar pelo próprio desempenho. Elimina a inconsistência de ter 2 métricas de destaque com estratégias diferentes (uma com corte fixo, outra sem).

## Arquitetura da solução

### Estado atual (antes)
```
Header (packages/ui) — botão lupa → navigate('/catalogo') sem query
  │
  ├─ / (HomePage.tsx) ── H1 + botão "Explorar catálogo" ──┐
  │                                                          ▼
  └─ /catalogo (CatalogoPage.tsx) ── busca real + filtro + grid + paginação
```

### Estado alvo (depois, decisões aplicadas)
```
Header (packages/ui) — GANHA input de busca embutido (prop nova, aditiva)
  │
  └─ / e /catalogo (mesmo componente — ambas rotas válidas, decisão 1)
       │
       ├─ modo "vitrine" (sem q/filtro ativo na URL):
       │    busca sempre visível (Header compartilhado, decisão 2)
       │    pills de categoria (material_type/sistema/edição facets) com popover
       │    prateleira horizontal rolável "Recém adicionados" (sort=recent)
       │    prateleira horizontal rolável "Mais visitados" (sort=trending,
       │        Bayesian average + corte de elegibilidade download_count>=1)
       │    prateleira horizontal rolável "Mais bem avaliados" (sort=rating,
       │        Bayesian average, sem piso fixo)
       │
       └─ modo "resultado" (q e/ou filtro presente na URL):
            comportamento atual de CatalogoPage.tsx preservado
            (grid único + CatalogFilterSidebar completa + paginação)
            + 2 novas opções no dropdown de ordenação: Mais visitados / Mais bem avaliados
```

### Migração de componente
- `CatalogoPage.tsx` vira a base do componente unificado (já tem toda a lógica de URL/filtro/busca/paginação funcionando e testada). Não reescrever do zero.
- Adicionar: detecção de "vitrine vs. resultado" (`const isBrowsing = !q && !materialType && !systemId && !editionId`), e o bloco de prateleiras (`isBrowsing ? <MaterialShelves /> : <ResultsGrid />`).
- Novo componente `MaterialShelf.tsx` (nome provisório, consistente com `MaterialCard.tsx` já existente — pode mudar na Fase 1 de design, mas usar este nome como referência em toda a spec até lá para evitar confusão de busca) — 3 instâncias (`sort=recent`/`sort=trending`/`sort=rating`, `page_size` reduzido), renderizando `MaterialCard` reaproveitado, com scroll horizontal.
- `HomePage.tsx` é deletado (rota `/` passa a apontar pro componente unificado, decisão 1).
- `AppShell.tsx`: `showSearch`/`onSearch` do `Header` são substituídos pelo novo contrato de busca embutida (decisão 2) — handler passa a escrever `?q=` de verdade em vez de só navegar.

## Arquivos afetados

**apps/downloads/backend/src/** (escopo ampliado 2026-07-26, Requisitos 13-17)
- `routes/materials.ts` — `GET /:slug` (ficha) grava `view_count` do dia (mesmo padrão `onConflict` de `routes/downloads.ts:48-54`), com dedup por sessão/IP+dia; `GET /` (listagem) ganha join/subquery de `avg_rating`/`rating_count` (Bayesian average sobre `download_rating`) e `popularity_score` (Bayesian average da taxa de conversão sobre `download_metric_daily`, janela móvel 30 dias, `null` quando `download_count=0` — corte de elegibilidade)
- `routes/materials.ts` — `SORT_OPTIONS` ganha `'rating'` e `'trending'` (decisão 5)
- `database/migration_0NN_*.sql` — SÓ SE o agregado precisar de índice novo pra performance (ver §Validação e `spec.md` §Riscos); checklist pétreo completo se for criada
- `test/` — testes novos cobrindo: view_count incrementando com dedup, avg_rating Bayesian aparecendo/null, popularity_score Bayesian, **corte de elegibilidade (material com view>0/download=0 nunca aparece em sort=trending)**

**apps/downloads/frontend/src/**
- `pages/HomePage.tsx` — removido (decisão 1: rota `/` passa a apontar pro componente unificado)
- `pages/HomePage.test.tsx` — removido
- `pages/CatalogoPage.tsx` — expandido com modo vitrine/resultado, possivelmente renomeado; dropdown de ordenação ganha "Mais visitados"/"Mais bem avaliados"
- `pages/CatalogoPage.test.tsx` — expandido pra cobrir os dois modos + novos sorts
- `components/MaterialCard.tsx` — ganha exibição de estrelas+contagem (Requisito 17), resto do contrato visual preservado
- `components/CatalogFilterSidebar.tsx` — preservado (funcional); conteúdo reaproveitado dentro de popover de pill no modo vitrine (decisão 3/síntese de busca)
- `components/MaterialShelf.tsx` — novo (ver acima)
- `App.tsx` — rota `/` e `/catalogo` apontam pro mesmo componente (decisão 1)
- `components/AppShell.tsx` — `handleSearch`/`onSearch` do Header substituído pelo contrato de busca embutida real (decisão 2)

**packages/ui/src/** (decisão 2 confirmada — pacote compartilhado É tocado)
- `Header.tsx` — input de busca embutido (prop nova aditiva, ex. `searchValue`/`onSearchChange`/`searchPlaceholder`)
- `styles.css` — estilos do novo input, usando os tokens de tema já existentes (claro/escuro automático)
- **Consumidores reais de `Header` a validar via smoke visual antes do commit (confirmado por grep, 2026-07-27): `accounts`, `mesas`, `glossario`, `site`, `links`, `downloads`.** `esferas` e `srd` NÃO têm frontend implementado ainda (`Glob apps/esferas/**`/`apps/srd/**` vazio) — não entram no smoke porque não existem, não porque foram esquecidos. `accounts` é o app de SSO/login — consumidor de maior risco da lista (regressão de layout ali afeta a porta de entrada de todo o portal), confirmado em `apps/accounts/frontend/src/main.tsx:286`.

## Contratos/interfaces tocados

- `GET /api/v1/materials` ganha campos novos na resposta (`avg_rating`, `rating_count`, `popularity_score`) e novos valores de `sort` (`'rating'`, `'trending'`) — aditivo, não quebra consumidores existentes, mas muda o bundle OpenAPI (`pnpm verify:api` obrigatório).
- `GET /api/v1/materials/:slug` ganha efeito colateral novo (incrementa `view_count`) — sem mudança de payload de resposta.
- Contrato de URL pública (`?q=`, `?system_id=`, `?sort=`, `?page=`) preservado — é D073, em produção, compartilhável; `sort` ganha 2 valores novos válidos.
- **`HeaderProps` (`packages/ui`) ganha prop nova de busca** (decisão 2) — aditiva, não quebra consumidores existentes que não passam a prop nova. Nome/formato exato definido na implementação (Fase 3).

## Impacto em consumidores

- **Backend Downloads**: `routes/materials.ts` — impacto local, sem consumidor externo do contrato além do próprio frontend Downloads.
- **`packages/ui` (decisão 2 confirmada):** todo módulo que usa `Header` de verdade hoje — `accounts`, mesas, glossario, site, links — precisa de smoke visual antes do commit, mesmo que não adote a busca embutida imediatamente (mudança de altura/layout do header pode vazar pra quem não usa a prop nova). `esferas`/`srd` não têm frontend ainda, fora do smoke por não existirem. Aprovação nominal obrigatória antes do commit conforme `AGENTS.md` §Regras Pétreas.

## Rollback

- Frontend/backend sem migration na maior parte do escopo — rollback = reverter o PR/branch. Deploy segue o fluxo normal (branch → PR → dev → beta smoke → prod com `workflow_dispatch` manual).
- Se migration nova for criada (T1B.4): rollback de migration segue `AGENTS.md` §Migrations (nunca reescrever arquivo aplicado, criar migration de correção nova se preciso).
- Se algo quebrar visualmente em outro módulo por causa do `Header`: reverter só `Header.tsx`/`styles.css` (prop aditiva, reverter não quebra Downloads se a lógica nova estiver isolada atrás da prop, mas quebra a busca embutida do Downloads até o próximo fix — aceitável como rollback de emergência).

## Validação (como provo que funciona)

1. `rtk pnpm --filter downloads-frontend lint` / build local; `rtk pnpm --filter downloads-backend lint`/build.
2. `rtk pnpm --filter downloads-frontend test` e `rtk pnpm --filter downloads-backend test` (ajustar/rodar suítes de `HomePage`/`CatalogoPage`/`AppShell`/`materials.ts`).
3. `pnpm run build` completo (packages/ui é tocado, decisão 2 confirmada) + build dos outros consumidores (mesas/glossario/site/links/esferas/srd).
4. Smoke visual real: rodar dev server local (`pnpm --filter downloads-frontend dev`), abrir no browser, testar busca/filtro/prateleira/paginação/ordenação nova, mobile (drawer de filtro) e desktop, tema claro e escuro.
5. `pnpm verify:api` **obrigatório**: `GET /materials` e `GET /materials/:slug` mudam de contrato de resposta — rodar antes do commit conforme `AGENTS.md` §PR/Commit/Push, revisar `docs/api/generated/*` regenerado.
6. Teste específico de corte de elegibilidade: fixture com material de muitas visualizações e zero downloads, confirmar ausência total em `sort=trending`/prateleira "Mais visitados" (não presença no fim da lista).
7. Deploy beta (`gh workflow run deploy.yml --ref dev -f module=downloads -f mode=deploy -f env=beta`, autorização nominal) e smoke real em `downloadsbeta.artificiorpg.com` antes de cogitar prod.
