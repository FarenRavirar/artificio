# Plano — 087

## Decisões — todas respondidas pelo mantenedor em 2026-07-26 (histórico mantido para contexto de implementação)

Estas 6 decisões mudavam o raio/comportamento da implementação e foram levadas ao mantenedor via `AskUserQuestion` (não inferidas pelo agente) — `AGENTS.md` proíbe decidir escopo/pacote-compartilhado sozinho. Todas fechadas; a rechecagem em `tasks.md` T0.1 agora é confirmação, não pergunta aberta.

1. **Rota `/catalogo`: DECIDIDO — ambas rotas válidas (2b).** `/` e `/catalogo` renderizam o mesmo componente. Zero risco de quebrar link/bookmark/indexação existente, sem decidir tipo de redirect.
2. **Busca no Header: DECIDIDO — embutida no `Header` compartilhado (`packages/ui`), não local.** Mantenedor priorizou explicitamente escalonamento e funções centrais compartilhadas entre módulos nesta rodada ("funções centrais têm que se comunicar para facilitar manutenção, além de serem semelhantes nas funções e visuais") — supera a recomendação técnica inicial de "começar local" (que priorizava menor raio de mudança sobre reaproveitamento). Downloads é o primeiro consumidor; o componente nasce pensado pra mesas/glossario/site/links/esferas/srd ligarem depois.
3. **Layout de vitrine: DECIDIDO — prateleiras horizontais roláveis** (estilo DMs Guild/DriveThru), não grid seccionado vertical. Motivo do mantenedor: escala melhor conforme mais categorias forem adicionadas (mais categorias = mais faixas, página não alonga verticalmente sem limite) e é candidata a componente central reaproveitável por outros módulos — mesmo raciocínio da decisão 2. A Fase 1 de `tasks.md` ainda roda a skill `frontend-design` pra gerar o token system/identidade visual da prateleira (isso não estava em jogo na decisão de layout, só a estrutura horizontal-vs-vertical).
4. **Peso de popularidade combinada: DECIDIDO — REJEITADA a constante fixa original (`PESO=5`).** Mantenedor apontou corretamente que constante fixa não escala nem se auto-ajusta ("solução preguiçosa... tem que pensar em algo dinâmico"). Pesquisado (WebSearch, 2026-07-26) 3 algoritmos de produção (Wilson score / Reddit, Bayesian average / IMDB, Hacker News gravity-decay) — **escolhido Bayesian average (ancora material novo na média do catálogo, não penaliza) + janela temporal móvel (tendência recente domina sobre histórico acumulado)**. Detalhe completo da fórmula em `spec.md` §Cálculo de popularidade e avaliação. **Correção adicional do mantenedor, pós-fórmula:** material com `download_count = 0` (só visualizado, nunca baixado) é **excluído por corte de elegibilidade antes do Bayesian average** — visualização isolada nunca é sinal suficiente pra aparecer/escalonar na prateleira "Mais visitados", independente do Bayesian suavizar ou não.
5. **`sort` formal vs. prateleira fixa: DECIDIDO — ambos.** "Mais bem avaliados" e "Mais visitados" viram opções formais em `SORT_OPTIONS` (usáveis no modo resultado, com busca/filtro ativo) E aparecem como prateleira fixa na home — mesma métrica central serve os 2 lugares, coerente com o objetivo de reaproveitamento desta rodada.
6. **Piso mínimo de avaliações (N): DECIDIDO — REJEITADO piso fixo, substituído por Bayesian average também no rating.** Mesmo método da decisão 4 aplicado à métrica de avaliação: sem N de corte abrupto, material com 1+ avaliação participa da prateleira/ordenação, ancorado na média geral do catálogo até acumular avaliações suficientes pra pesar pelo próprio desempenho. Elimina a inconsistência de ter 2 métricas de destaque com estratégias diferentes (uma com corte fixo, outra sem).

## Direção de design (Fase 1 — aprovada pelo mantenedor em 2026-07-26)

Fonte única da direção visual desta spec. T4.1 aplica **isto**; divergir exige nova aprovação.

### Tese

Downloads é **acervo comunitário doado**, não loja. `credits`/`creator_slug` são campos de primeira classe no schema, e o propósito do produto é o usuário SAIR pro site do autor (D107/D119) — o oposto de DriveThruRPG, que retém. Pergunta que orienta a direção: *o que uma vitrine de e-commerce nunca faria?* Resposta: dar mais destaque ao autor do que ao item.

### Assinatura — crédito do autor promovido a eyebrow

O crédito sai da 3ª linha do card (12px, `--fg-muted`, "Por X") e sobe **acima do título**, em Oswald caixa-alta com tracking aberto, em `--fg` (não muted). Prateleira rolando vira sequência de nomes de criadores brasileiros.

```
┌─────────────────────────┐
│ [capa sangrada / "Sem capa"] │
│ ESTÚDIO FENRIS          │  ← Oswald 11px/600/0.10em/uppercase, --fg
│ Masmorra do Corvo       │  ← Inter 15px/600/-0.01em, 2 linhas
│ Cinzento                │
│ Para Forgotten Realms   │  ← Inter 12px/400, --fg-muted
│ ★★★★☆ 4.1 (7 avaliações)│
│ [Aventura] [Link ext.]  │
└─────────────────────────┘
```

Travas de implementação:
- Eyebrow é **texto (`<p>`), nunca link** nesta spec — fica dentro da área coberta pelo `before:absolute before:inset-0` do `<Link>` do card (Requisito 8 / T2.5). Virar link pro criador é mudança de comportamento, fora de escopo.
- `credits === null` (permitido pelo schema): eyebrow lê **"ACERVO ARTIFÍCIO"**. Nunca em branco, nunca colapsa a altura do card.
- Escolhida porque escala com a verdade do produto: maioria dos itens não tem `cover_image_url`, então o card precisa de hierarquia forte sem imagem.

**Assinatura descartada (registro):** "lombada" colorida por `material_type` na borda esquerda foi proposta e cortada — duplicava a informação do badge `[Aventura]` que continua no card (decoração redundante disfarçada de estrutura).

### Tipografia

| Papel | Face | px / peso / tracking / caixa |
|---|---|---|
| Título de prateleira | Oswald | 20 / 600 / `0.06em` / uppercase |
| Crédito (eyebrow) | Oswald | 11 / 600 / `0.10em` / uppercase |
| Título de card | Inter | 15 / 600 / `-0.01em` / line-height 1.3 |
| Cenário ("Para X") | Inter | 12 / 400 / `--fg-muted` |
| Rating numérico | Oswald | 13 / 600 / tabular |
| Contagem de avaliações | Inter | 12 / 400 / `--fg-muted` |
| Badge | Inter | 11 / 600 / `0.02em` |

Regra que carrega a direção: **Oswald aparece em exatamente 2 lugares — título de prateleira e crédito.** Nada mais. Rima visual entre "o rótulo da estante" e "quem fez isto". Inter cuida de todo conteúdo corrido. O tratamento (condensada + caixa alta + tracking largo) já existe em `.artificio-footer-nav-title` — é aplicação de padrão estabelecido, não invenção.

### Espaçamento (base 4)

- Dentro do card: capa→eyebrow 12, eyebrow→título 6, título→cenário 4, cenário→rating 8, rating→badges 12. Padding 14.
- Entre cards na prateleira: 12. Cabeçalho da prateleira→trilho: 12.
- **Entre prateleiras: 40** (passo grande deliberado — prateleiras horizontais próximas viram grade indistinta; marca a batida de seção sem linha divisória).

### MaterialShelf

- Título Oswald uppercase à esquerda; "Ver tudo →" à direita, `align-items: baseline`, `--fg-muted` → `--artificio-brand` no hover.
- Trilho `overflow-x: auto`, `scroll-snap-type: x proximity` (**proximity, não mandatory** — mandatory briga com trackpad e dá sensação de trava).
- Card 220px fixo; 240px em ≥1024px. Último card `scroll-snap-align: end` (prateleira não para cortando).
- Sem setas de navegação na v1: scroll nativo. Se o smoke mobile (T4.3) apontar problema de uso por toque, corrigir e registrar; não criar um segundo sistema de navegação preventivamente.
- Sem `scroll-behavior: smooth` forçado — preservar o comportamento nativo do browser.

### Card — ajustes pontuais autorizados pelo Requisito 8

1. Eyebrow de crédito (acima).
2. **Capa sangra até bordas laterais e topo** (hoje é `mb-3 h-32 w-full rounded` dentro do padding). Card vira ficha; placeholder "Sem capa" sangra igual, então card com e sem capa têm a mesma silhueta.

Intacto: título 2 linhas sem truncamento cego, cenário, badges de tipo/acesso/idioma, `SystemChainBadge`, alvo de clique único.

### Estrelas (T2.5)

`★★★★☆ 4.1 (7 avaliações)`. Preenchida `--artificio-brand`, vazia `--line-strong`, **meia-estrela por gradiente** (arredondar mente: 4.4 não são 4 cheias). Número em Oswald tabular, contagem em Inter `--fg-muted`. Glifos `aria-hidden` + `<span class="sr-only">` "Avaliação 4,1 de 5 em 7 avaliações". Cinco `<span>`, **nunca `<button>`** — não entra na ordem de tabulação, não disputa o `before:absolute` do link do card. `rating_count === 0`: bloco some inteiro, sem texto substituto.

### Pills de filtro (T2.3)

Métrica base de `.artificio-badge` (raio 999px), altura 36px, peso 600 (leem como controle, não rótulo passivo). Idle `--fill-subtle`/`--line`; hover `--fill`/`--line-strong`; ativa borda `--artificio-brand` + texto `--artificio-brand-deep` + fundo `rgba(255,87,34,.10)`. Pill ativa mostra o valor no lugar do label (`Sistema: D&D 5e ⊗`) — mesmo vocabulário do chip de busca (Síntese item 3: filtro e busca são a mesma coisa). Popover reusa a receita de `.artificio-usermenu-dropdown` (posicionamento/sombra/borda/Escape/clique-fora já resolvidos); conteúdo é `FilterControls` extraído de `CatalogFilterSidebar.tsx` — composição, não reescrita.

### Copy

- Títulos de prateleira descritivos, sem hype: "Recém adicionados", "Mais visitados", "Mais bem avaliados".
- Busca: `Buscar por título, autor ou sistema`.
- Vazio no modo resultado: **"Nenhum material com esses filtros. Tente remover um filtro ou buscar outro termo."** (diz o que houve e o que fazer, sem pedir desculpa). Prateleira sem item elegível não renderiza (Requisito 16).

### Trava de cor (Requisito 9a)

Zero cor nova. Todo elemento desta direção usa exclusivamente tokens semânticos já existentes em `packages/ui/src/styles.css`, que viram automaticamente entre `:root` e `:root[data-theme="dark"]`. `--artificio-brand` é o único acento (estrelas, pill ativa, hover de "Ver tudo") — sem amarelo-genérico-de-rating, sem segunda cor de acento.

## Handoff de implementação — Fase 4 (auditoria de lacunas, 2026-07-26)

Esta seção é o ponto de retomada para o agente que implementar a Fase 4. Não reabrir a direção visual da Fase 1: ela já foi aprovada. O trabalho é conferir o código real, completar lacunas e provar o resultado.

### Decisão do mantenedor: acessibilidade não é frente desta fase

O comentário manual foi reconfirmado ao iniciar a Fase 4: **não executar auditoria AA, checklist de teclado, contraste, leitor de tela ou `prefers-reduced-motion` nesta rodada**. Isto supersede a redação antiga de T4.2. Não remover proteções já existentes e não introduzir regressão deliberada, mas também não ampliar escopo para “melhorar acessibilidade”. T4.2 registra somente esta decisão e não exige implementação.

### Estado material já presente na branch

A Fase 2 antecipou grande parte de T4.1. Antes de escrever, verificar o código atual; não reconstruir o que já existe:

- `MaterialCard.tsx`: capa sangrada, crédito acima do título em Oswald, fallback “Acervo Artifício”, rating e badges.
- `MaterialRating.tsx`: estrelas fracionárias, número formatado em pt-BR e contagem real.
- `MaterialShelf.tsx`/`CatalogShowcase.tsx`: trilho horizontal, 220/240px, snap `proximity`, último item em `snap-end`, 40px entre prateleiras e ausência de seção vazia.
- `FilterPills.tsx`: três pills com popover, estado ativo por token semântico e reaproveitamento de `FilterControls`.
- `CatalogoPage.tsx`: vitrine/resultado, sidebar/drawer no resultado, sorts novos e chip removível de busca.
- `Header.tsx`/`styles.css`: busca controlada e regra mobile já estão no diff local da Fase 3.

Durante a auditoria desta retomada, ajustes preparatórios locais foram aplicados e **não devem ser refeitos nem revertidos**: “Ver tudo →”; trilho com gesto horizontal/overscroll contido; popover das pills limitado à largura mobile; tipografia de badges 11px/600; `SystemChainBadge` sem `border-white/10`; erro por token semântico; ordenação em largura total no mobile; contagem “N materiais encontrados”. Ainda precisam de testes/validação pelo implementador.

### Lacunas restantes — T4.1/T4.3

1. Comparar a renderização final, nos dois temas, contra cada trava de `§Direção de design`: Oswald só em título de prateleira e eyebrow; Inter no restante; espaçamentos 12/40; card sem lombada redundante; único acento laranja; nenhuma cor literal/Tailwind cromática fora de token.
2. Validar conteúdo com e sem capa, crédito vazio, título longo, cenário ausente, zero avaliações e cadeia de sistema longa. Nenhum desses estados pode mudar a altura/hierarquia de forma que quebre a prateleira.
3. Rodar viewport real em 320px, 375px, 768px e desktop ≥1024px. Em mobile: busca do Header ocupa linha própria sem overflow; popover cabe na viewport; prateleira rola por toque e deixa parte do próximo card visível; sort ocupa largura útil; drawer abre/fecha e aplica filtro; paginação não estoura horizontalmente.
4. Rodar os dois modos: vitrine limpa e resultado com `q` + filtro + sort. Confirmar transição sem navegação extra, contagem total, vazio orientativo e “Ver tudo →” abrindo o sort correspondente.
5. Não marcar T4.1/T4.3 só por teste unitário ou build: o aceite pede inspeção visual/renderização real. Se o ambiente não tiver Browser interno, usar browser autorizado pelo mantenedor ou deixar o smoke explicitamente aberto.

### Lacuna SEO — T4.4

`apps/downloads/frontend` é SPA Vite servida por fallback do Nginx (`try_files ... /index.html`). Isso cria duas travas que a redação antiga não conciliava:

- canonical estática em `index.html` também seria entregue em `/materiais/:slug`, `/painel/*` e `/gestao/*`, canonicalizando páginas distintas para o catálogo — incorreto;
- canonical inserida por React não aparece em `curl`/“view source”; aparece somente no DOM depois da renderização. Portanto o aceite antigo por `curl/view-source` era incompatível com a alternativa sem dependência sugerida pela própria task.

Implementação recomendada, sem biblioteca nova: componente/hook pequeno montado por `CatalogoPage` que cria ou atualiza **um único** `link[rel="canonical"]` no `document.head`, usa URL absoluta, mantém o mesmo alvo para `/`, `/catalogo` e suas query strings, e remove a tag no cleanup para não vazar ao navegar para ficha/painel/gestão. Cobrir criação, unicidade, alvo e cleanup em teste JSDOM. Validar manualmente no DOM renderizado (`document.querySelector('link[rel="canonical"]')`), não em `view-source`.

Google Search Central confirma que canonical injetada por JavaScript é coletada durante a renderização, embora HTML seja preferível; também alerta para nunca produzir múltiplas canonicals conflitantes: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics#set-canonical-urls-correctly-with-javascript

**Decisão ainda bloqueante do mantenedor:** escolher o alvo único — `https://downloads.artificiorpg.com/` ou `https://downloads.artificiorpg.com/catalogo`. Não inferir. A implementação começa depois dessa resposta. Se o mantenedor exigir canonical visível na resposta HTTP, isso deixa de ser ajuste React e amplia o escopo para Nginx/prerenderização; registrar e aprovar essa ampliação antes.

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
