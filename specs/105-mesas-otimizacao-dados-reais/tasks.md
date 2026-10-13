# Tasks 105 — Otimização do `mesas` guiada por dados reais

Evidência: `spec.md` §2. Desenho: `plan.md`. Cada task tem **um** bloco de estado. Ao
retomar, o bloco é reescrito, nunca recebe anexo.

**Prioridade (mantenedor, 2026-10-13):** o básico do Analytics e do Search Console vem antes de
qualquer evento. Nas palavras dele: *"essa porcaria de evento, deixa pra lá por enquanto
[…] isso é bônus, onde o básico do analytics e search console mal está funcionando"*.
**Adiado, por ordem dele:** `contact_click`, contagem de contato por canal e o clique do
perfil (T1.3, M1 por canal, T1.5 aceite, lacunas de T1.4). Não investigar nem medir mais
nada disso até o básico fechar. O básico em aberto: T1.0 (linha de `hostName` no relatório
padrão e aviso do painel), T1.1 (`pagePathPlusQueryString`), T1.2 (`page_view` 2N),
T1b.1 (stream de `downloads`), T2.4 e a indexação (T2.2, T4.1).

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` fechada com medição · **(mantenedor)**
ação que só ele faz · **(aprovação)** ação de §Autorização.

---

## Manutenção do mapa

### [ ] T-MAP — Atualizar `specs/backlog.md` e `project-state.md`

Regra de `specs/README.md`. Só executa quando o mantenedor mandar: governança proíbe
atualizar `project-state.md` por conta própria.

---

## F0 — Acesso só leitura

### [x] T0.1 — Credencial — FEITA (2026-10-12)

Tudo na conta `artificiorpg@gmail.com`, que é a proprietária de
`sc-domain:artificiorpg.com` (medido na tela "Usuários e permissões"), e não na pessoal.

1. Projeto Google Cloud `artificiorpg-analytics`, com Google Analytics Admin API,
   Analytics Data API e Search Console API ativadas.
2. Service account `analytics-leitura@artificiorpg-analytics.iam.gserviceaccount.com`,
   sem papel IAM no projeto.
3. Chave em `%USERPROFILE%\.config\artificio\ga-gsc-leitura.json`, fora do repositório. O
   download caiu em `.tmp/`, que é ignorado (`.gitignore:46`), e o arquivo foi movido de lá.
   A criação da chave foi feita pelo mantenedor, porque o classificador do auto mode barra
   gravação de segredo.
4. GA4: **Editor** na property `p475307720` ("Artifício RPG", conta "Toca do Coruja RPG
   Total", `a237327410`). Adicionada pelo mantenedor; a aba do Chrome do agente travou.
   **Editor, e não Leitor, é decisão do mantenedor**, nas palavras dele: *"eu permito isso,
   já que vou pedir voce depois para corrigir e executar ações até regularizar a conta e as
   fontes"*. Regra: escrita no GA4 só quando ele pedir a correção. O `analytics-mcp` não
   tem ferramenta de escrita; a escrita vai por chamada explícita à Admin API.
5. Search Console: **Total** em `sc-domain:artificiorpg.com`. Primeiro foi Restrita
   (adicionada pelo agente); o mantenedor subiu para Total em 2026-10-12, para a
   regularização incluir sitemap. A API devolve `permissionLevel: siteFullUser`.

Erro de execução registrado: um primeiro projeto, `artificio-analytics`, foi criado por
engano na conta pessoal e encerrado no mesmo dia. Ele fica em exclusão pendente por 30
dias.

### [x] T0.2 — MCP ga4 e gsc — FEITA (2026-10-12)

Registrados em escopo `local` (`~/.claude.json`, fora do repositório):
`ga4` → `uvx analytics-mcp@0.7.0` (com `GOOGLE_APPLICATION_CREDENTIALS` e
`GOOGLE_PROJECT_ID=artificiorpg-analytics`); `gsc` → `uvx mcp-search-console@0.4.1`, com
`GSC_SKIP_OAUTH=true`, `GSC_DATA_STATE=final` e sem `GSC_ALLOW_DESTRUCTIVE`.

Medido pelo MCP, em sessão nova:

- **K1.** `mcp__ga4__run_report` na property `475307720`, 28 dias até ontem, por
  `hostName`: `artificiorpg.com` 2.246 usuários ativos e 15.266 eventos;
  `beta.artificiorpg.com` 1 e 42. `row_count: 2`, sem linha de `mesas.` — o esperado antes
  do deploy da T1.0.
- **K2.** `mcp__gsc__list_properties` → `sc-domain:artificiorpg.com`, `siteFullUser`.
  `mcp__gsc__get_advanced_search_analytics` (2026-09-10 a 2026-10-09, `page` contém
  `https://mesas.artificiorpg.com/`, top 5, `has_more: true`): `/` com 3 cliques, 55
  impressões e posição 2,2; três mesas com 1 clique cada; `/catalogo` com 0 cliques e 2
  impressões. Bate com a medição anterior por script.

Nota de ferramenta: `get_search_analytics` não aceita filtro de página; o filtro por
subdomínio exige `get_advanced_search_analytics`.

### [x] T0.3 — Trava de escrita — FEITA (2026-10-12)

A doc do Claude Code (*Configure permissions*) diz que regra de permissão aceita o nome
exato `mcp__<server>__<tool>`. Regra com parênteses em `mcp__` é ignorada.

**Decisão do mantenedor (2026-10-12):** todas as ferramentas ficam disponíveis — a spec
existe para usá-las, inclusive na regularização de sitemap. Por isso a trava é `ask`, e não
`deny`: medido nesta sessão, `deny` tirou as cinco ferramentas do contexto (o `ToolSearch`
delas devolveu só `get_sitemaps`), o que inviabiliza a regularização.

`permissions.ask` em `.claude/settings.local.json` (ignorado pelo Git, `.gitignore:74`,
mesmo escopo local do registro do MCP), editado pelo mantenedor: `mcp__gsc__manage_sitemaps`,
`submit_sitemap`, `delete_sitemap`, `add_site` e `delete_site`. Depois da troca o harness
anunciou as cinco de novo como disponíveis. Cada chamada de escrita pede aprovação, o que
casa com a §Autorização. Escrita no GA4 não tem ferramenta no `analytics-mcp`; segue pela
§Autorização (Admin API por chamada explícita).

**Limite medido do servidor:** `mcp__gsc__get_capabilities` diz que `add_site`,
`delete_site` e o delete de `manage_sitemaps` ficam desligados sem
`GSC_ALLOW_DESTRUCTIVE=true`; envio de sitemap funciona sem ela. Ligar a variável muda o K3
de `spec.md` §4 — pergunta aberta ao mantenedor.

K3: sem `GSC_ALLOW_DESTRUCTIVE` (config acima); nenhuma chamada de escrita nesta sessão;
`git ls-files | grep -i "ga-gsc\|leitura.json"` sem saída (exit 1), e a chave vive em
`%USERPROFILE%\.config\artificio\`, fora do repositório.

### [x] T0.4 — Ids das properties — FEITA (2026-10-12)

Painel e API concordam: property `p475307720`, conta `a237327410`. Streams: `10202428829`
(site), `15290051302` (Mesas, `G-43T3C6K6V6`) e `15290119709` (Glossario). Consequência
para a F3: o manifesto precisa do filtro por `hostName`, porque os apps dividem a property.

**A D117 não bate com o painel.** A divergência está registrada em `spec.md` §2.6 G2 e na
T1b.2.

---

## F1b — Saneamento da configuração de analytics e SEO

Pedido do mantenedor em 2026-10-12. Cada divergência entre painel, código e documentação
vira task, com medição. Evidência em `spec.md` §2.6.

### [ ] T1b.1 — `downloads` sem stream próprio

`downloads` envia para `G-2H50PCM950`, igual ao `site`, e mistura os dados dos dois.
`G-2H50PCM950` não é stream da `p475307720`: é um Google tag combinado que entrega no
stream `10202428829` (`G-8FKEJX5L9G`). Medido em 2026-10-12: o container
`gtag/js?id=G-2H50PCM950` cita `G-8FKEJX5L9G` 21 vezes, o bundle de produção do `site` e
do `downloads` carrega `G-2H50PCM950`, e o `run_report` por `streamId` põe todo o
`artificiorpg.com` no stream `10202428829`.
**(mantenedor)** criar o stream `Downloads` (`https://downloads.artificiorpg.com`) na
property `p475307720`. O agente troca o measurement id no compose e no `.env.example` do
`downloads`, igual ao que foi feito no `mesas`. Depende de T1.0 para coletar.

### [ ] T1b.2 — D117 × painel

A D117 diz "1 property por app"; no painel é 1 property com N streams (§2.6 G2). O registro
em `decisions.md` e em `project-state.md` só muda com ordem do mantenedor. Até lá, fica aqui
como divergência medida.

### [ ] T1b.3 — Property legada `p475470428` (conta "Artifício RPG")

Está sem dado. Os streams `www`, `Artificio 2` e `glossariorpg` apontam para hosts antigos.
**Decisão do mantenedor:** manter só como histórico ou arquivar. Não apagar sem ordem,
porque guarda o histórico do WordPress.

### [~] T1b.4 — Auditoria dos painéis (GA4 + Search Console) — falta Google Signals (produto) e filtros/referral (painel)

Medido em 2026-10-12 pela Admin API (v1alpha) e pela Search Console API, só leitura,
script fora do repositório, mesma chave:

- **Key events:** só `purchase` (padrão da criação da property, 2025-01-29). Falta
  `contact_click` (T1.3).
- **Dimensões personalizadas:** nenhuma. Sem elas, `origem`, `canal` e `sistema` do
  `contact_click` chegam ao GA4 mas não aparecem em relatório. `mesa_id` fica de fora de
  propósito: cardinalidade alta vira linha `(other)`.
- **Retenção de eventos:** `TWO_MONTHS`, o padrão. Exploração acima de 60 dias fica sem
  dado, o que corta a comparação antes/depois da F4. 14 meses não custa nada na versão
  padrão.
- **Enhanced Measurement:** ligada nos três streams, com `pageChangesEnabled: true` em
  todos. É o risco do I2 (T1.2) no `mesas` e no `glossario`, que já mandam `page_view` por
  rota.
- **Google Signals:** `GOOGLE_SIGNALS_ENABLED`. Coleta dado demográfico e entre aparelhos
  ligado à conta Google do visitante — **decisão de produto** diante de "sem coleta
  desnecessária de dados".
- **Filtro de tráfego interno e exclusão de referral:** não medidos. A Admin API v1alpha
  não expõe essas configurações; precisa do painel.
- **Search Console:** só `sc-domain:artificiorpg.com` (`siteFullUser`). Sitemaps enviados
  eram 3 (`artificiorpg.com/sitemap-index.xml`, `mesas`, `glossario`). Serviam e não estavam
  enviados: `downloads.artificiorpg.com/sitemap.xml` (17 URLs, declarado no `robots.txt`) e
  `links.artificiorpg.com/sitemap-index.xml` (200, declarado no `robots.txt`). **Enviados
  em 2026-10-12** por `mcp__gsc__submit_sitemap`, com sua aprovação pela regra `ask`;
  `get_sitemaps` devolve 5, todos `Valid`. `srd` e `esferas` não respondem (`000`).
- **Glossário com 1 URL no sitemap:** intencional no código
  (`apps/glossario/backend/src/routes/sitemapRoutes.ts`: "não listar verbetes até que
  `/termo/:id` tenha página pública"). Não é divergência; os verbetes ficam fora da busca
  até existir a página.
- Campo `indexed` da API de sitemaps devolve 0 em todos; o MCP mostra o número enviado
  como `indexed_urls`. Nenhum dos dois mede indexação. Indexação real é a T2.2.

**Escrita no GA4 aplicada em 2026-10-12**, com autorização do mantenedor: key event
`contact_click` (`keyEvents/16114982864`), dimensões de evento `origem`, `canal` e
`sistema`, retenção de eventos `FOURTEEN_MONTHS`. Conferido por nova leitura: key events
`['purchase', 'contact_click']`, dimensões `['origem', 'sistema', 'canal']`, retenção
`FOURTEEN_MONTHS`. Em aberto: Google Signals (decisão de produto) e filtros/referral
(painel).

**Aceite.** Cada item acima medido ou com bloqueio nomeado; escrita do GA4 aplicada e
conferida por nova leitura.

---

## F1 — Instrumentação

### [~] T1.0 — GA4 não coleta em `mesas`, `glossario` e `downloads` — em prod; falta linha de `hostName` na API padrão

**Causa, medida em produção em 2026-10-12, no Chrome, em `https://mesas.artificiorpg.com/`:**

- O `gtag.js?id=G-43T3C6K6V6` carrega com 200. `window.dataLayer` recebe `js`, `config` e
  `event page_view`. Mesmo assim, **zero requisições `/g/collect`** com o monitor de rede
  ligado desde o reload.
- `Object.prototype.toString.call(dataLayer[1])` → `[object Array]`. O `initGtag` antigo
  definia `function gtag(...args) { dl.push(args) }`, que empurra um **Array**. O gtag.js
  só processa o objeto `arguments`. O snippet oficial é
  `function gtag(){dataLayer.push(arguments);}`, que o `site` já usava via `gtagInlineConfig`.
- Contraprova: na mesma página, empurrar `js` e `config` como `arguments` disparou **1**
  `/collect` em 5 s.
- O Next.js documenta a mesma diferença (`@next/third-parties`).
- A CSP foi descartada como causa: nenhum dos três apps envia `Content-Security-Policy`
  (`curl -sI`, sem `<meta http-equiv>`).

Alcance: todo consumidor de `initGtag`, ou seja, `mesas` (`entry.client.tsx:16`),
`glossario` (`main.tsx:16`) e `downloads` (`main.tsx:18`). A API confirma: 28 dias sem
nenhuma linha desses hosts (T0.2).

**Correção (local, 2026-10-12).** `initGtag` (`packages/analytics/src/gtag.ts`) injeta o
snippet oficial como `<script>` inline (texto de `gtagInlineConfig`, a mesma fonte do
`site`) e depois o loader. Escrever `arguments` em TS esbarra em `prefer-rest-params`, e a
governança proíbe `eslint-disable`; o snippet em texto é a forma documentada e dispensa
exceção. Novo `GaOptions.sendPageView`. Se algum dos três apps passar a enviar CSP, o inline
precisa de hash ou nonce, como no `site` (comentário no código).

**Teste que pega o defeito:** `analytics.test.ts` exige que todo item do `dataLayer` seja
`[object Arguments]`. Rodado contra o `gtag.ts` antigo: **2 falhas**. Contra o novo: 21/21.
O jsdom do vitest não executa o inline no `window` do teste, então o teste roda o texto do
snippet por eval indireto (comentado no teste). `lint`, `typecheck` e `build` do pacote
limpos.

**Medido em produção em 2026-10-13, depois do deploy dos 6 (Playwright sem sessão).**
`POST www.google-analytics.com/g/collect` com `en=page_view`, resposta 204: `mesas`
(`tid=G-43T3C6K6V6`), `glossario` (`G-YVHMJEVTE4`) e `downloads` (`G-8FKEJX5L9G`, o mesmo
stream do `site`, T1b.1). `run_realtime_report` por `streamId`: `15290051302` (Mesas) e
`15290119709` (Glossario) com `page_view`. `run_report` padrão por `hostName` e `date`
(2026-10-12 a hoje, medido em 2026-10-13): `mesas.artificiorpg.com` 3 eventos e 1 usuário em
20261012; `glossario.artificiorpg.com` sem linha; 20261013 só tem `artificiorpg.com` (46
eventos). O relatório padrão atrasa o dia corrente.

**Aceite (aberto).** Falta: `run_report` por `hostName` devolver
`glossario.artificiorpg.com` (e `mesas.` em 20261013); e o painel do stream deixar de mostrar
"A coleta de dados não está ativa" (painel, não medi).

### [~] T1.1 — `page_view` limpo e sem repetição (I1) — em prod; falta relatório

1. `trackPageview` envia `page_location` (origem + path, sem query e sem fragmento) e
   `page_title`, os parâmetros da doc GA4 *Measure pageviews*. Antes do evento roda
   `gtag('set', …)`, para que eventos seguintes (`select_mesa`, `contact_click`) herdem a URL
   limpa. `page_path`, da geração UA, saiu. Teste novo no pacote.
2. **Achado e corrigido:** `useAnalyticsPageviews` disparava em toda mudança de
   `location.search`. Como a query é descartada, cada filtro do catálogo virava um
   `page_view` repetido da mesma URL. Agora só o `pathname` define página
   (`packages/analytics/src/react.ts`).

Não medi se a query chegava ao GA4 antes, porque não chegava nada (T1.0). O teste do hook
continua TODO em `analytics.test.ts`: exigiria `@testing-library/react`, que é dependência
nova.

**Medido em prod (2026-10-13).** Carregando `glossario` e `downloads` com `?x=1`, o `dl` do
`/g/collect` veio sem query (`https://glossario.artificiorpg.com/`,
`https://downloads.artificiorpg.com/`); `mesas` na rota de mesa, `dl` com o path limpo.

**Relatório (2026-10-13).** `run_report` por `hostName` × `pagePathPlusQueryString`,
filtrado em `mesas.artificiorpg.com`: 1 linha, `/` (3 eventos), sem `?`. Amostra só da home;
rota de mesa e catálogo com filtro ainda não aparecem.

**Aceite (aberto).** `pagePathPlusQueryString` sem `?` numa rota com query (catálogo
filtrado) e filtro de catálogo sem gerar `page_view` — ainda não medidos.

### [ ] T1.2 — `page_view` duplicado pela Enhanced Measurement (I2)

Medir no DebugView depois do deploy da T1.0, com navegação de N rotas. Se vier 2N, desligar
*"Page changes based on browser history events"* nas streams `mesas` e `glossario`. Com o
papel Editor, o agente faz isso pela Admin API quando o mantenedor pedir a regularização.

**Medido em prod (2026-10-13, `mesas`, Playwright sem sessão).** Navegação sintética
(`history.pushState` + `popstate`) por 3 rotas, `/g/collect` capturados: a carga inicial
gerou 1 `page_view`; cada rota seguinte gerou 2 `page_view` com o mesmo `dl`
(`/mesas/<slug>`, `/mestre/nidolina`, `/`). É o padrão 2N do I2. Ressalva: a navegação não
passou pelo roteador do app com clique real, então o par pode ser EM + app, ou o app
duas vezes; o DebugView separa. **Escrita no GA4 (desligar *Page changes* em `mesas` e
`glossario`) não aplicada:** só com ordem do mantenedor.

**Aceite (aberto).** I2 confirmado no DebugView e, depois do ajuste, N `page_view` em N
rotas.

### [ ] T1.3 — Evento `contact_click` (I3) — ADIADO por ordem do mantenedor (2026-10-13)

`trackContactClick({ origem, canal, mesa_id?, sistema? })` no catálogo de
`packages/analytics` (sem número, e-mail ou URL de destino). Disparado em três lugares:

- CTA da mesa que abre o canal direto (`handleCTA`, `external-link`). O canal vem de
  `CTAConfig.channel`, campo novo e opcional em `@artificio/catalog-table`, preenchido pelo
  `tableViewMapper` (`discord` ou `whatsapp`).
- Botões e links do bloco de contato da mesa (`TableContactsBlock`, só na página pública).
- Contato pelo perfil do mestre (`useTracking.trackGmContactClick`, com `origem: 'mestre'`).

Key event `contact_click` marcado no GA4 em 2026-10-12 (T1b.4).

**Coerência com a 102 (conferido em 2026-10-12).** A 102 T4.4 decidiu que o contato da mesa
é **candidatura, não reserva**: `form 108 | whatsapp 46 | discord 33 | email 1`, e o mestre
seleciona. Por isso `Event` foi descartado e o JSON-LD é só `Product`+`Offer`. O
`contact_click` mede "contato iniciado", e não compra nem reserva, o que é coerente com a
decisão. O JSON-LD não foi tocado, e o guard G-F da 102 (`smoke:jsonld-price-source`)
continua OK. O username do Discord continua texto, nunca link (achado da 102 de
2026-09-11): o rastreio entrou só nos `<a>` que já existiam.

**Aceite (aberto).** I3: um `contact_click` em produção. O clique no CTA de uma mesa real
abre o WhatsApp de um mestre real; o classificador do auto mode barrou a ação
(`[Real-World Transactions]`) e não contornei. Medir exige o mantenedor clicar, ou ele
liberar o clique.

### [~] T1.4 — Contato e série temporal da mesa (M1, M2) — em prod; `view` medido, `click`/`contact` não

- `services/tableMetrics.ts` (novo): `recordTableMetric(tableId, action, req)` grava evento
  em `table_metric_events` e contador em `table_metrics` na mesma transação, com dedupe por
  visitante na janela (`view` 15 min, `click` 5 min, `contact` 30 min, `favorite` 24 h). A
  lógica veio do `gmPanel`. Achado do Codex na PR #337 (P2, procedente): a checagem da
  janela rodava fora da transação, e duas requisições simultâneas do mesmo visitante
  contavam as duas (índice da migration 07 não é único, e não pode ser, porque a janela é de
  tempo). Agora checagem e escrita rodam na mesma transação, depois de
  `pg_advisory_xact_lock(hashtextextended('table_metric:<mesa>:<ação>:<fingerprint>', 0))`.
  `hashtextextended` medido no Postgres 16.14 de produção (`select … ('x', 0)` devolve
  bigint). Sem teste de concorrência: exigiria Postgres real no vitest, que o backend não
  tem fora do teste de equivalência pulado.
- Sonar (6,5% de duplicação em código novo; `tables.ts` 68,3%): as rotas `view`, `click` e
  `contact` repetiam `select` + `isPublicTable` e a validação de slug. Viraram
  `findPublicTableIdBySlug` (em `tables.ts`) e `isValidSlugParam` (`utils/validation.ts`,
  usado também nas duas cópias de `gm.ts`). Na PR #338 o Sonar ainda marcou 30% na casca
  dos handlers (validar, buscar, 404, registrar, 500): virou `tableMetricHandler`, com o
  detalhamento de clique em `clickBreakdownWriter`; os `router.post` seguem literais, e o
  `api:inventory` continua achando as três rotas com confiança `high`. Na rodada seguinte (25%),
  as rotas de favorito (GET/POST) repetiam a mesma busca de mesa pública e passaram a
  usar `findPublicTableIdBySlug`; a leitura de campo de `req.body` repetida entre `gm.ts` e
  `tables.ts` virou `readBodyField` (`utils/validation.ts`, com `validation.test.ts`). A `/view` passa a validar slug como as outras:
  0 de 208 slugs em produção falham na regex (`psql` read-only), então nenhum slug real
  muda de resposta.
- Rotas públicas `POST /api/v1/tables/:slug/view` e `/click` passam a usar o serviço. Rota
  nova `POST /api/v1/tables/:slug/contact`, com validação de slug igual à `/click` e
  `isPublicTable`. CSRF: passa por `Origin` same-origin, igual `/click`. Rate limit: o
  `globalRateLimiter` (`server.ts:92`) cobre.
- Removidas as rotas `POST /api/v1/gm/tables/:slug/view` e `/:id/click|contact|favorite` do
  `gmPanel`: zero consumidores em `apps/`, `packages/` e `scripts/`. O OpenAPI foi
  atualizado pelo `pnpm verify:api` (4 rotas removidas, 1 incluída; `api:diff` registra as 4
  remoções como breaking, e é exatamente o que se pretende).

**Mudança de semântica, registrada para não comparar errado:** `views_count` e
`clicks_count` passam a contar no máximo um por visitante por janela, quando antes contavam
cada requisição. **A série antes e depois do deploy não é comparável.** O GA4 é a
referência de tendência.

**Achados e corrigidos no mesmo trabalho:**

1. **Clique contado duas vezes.** O CTA do painel chamava `trackTableClick(…,
   'cta_entrar')`, e `handleCTA` fazia outro `POST /click` (slug tirado do pathname) ao abrir
   link externo. `handleCTA(cta, tracking)` agora conta o clique uma vez, e só com contexto
   (página pública).
2. **Clique em VTT contado só para o dono.** O link de VTT só contava clique no preview do
   dono (`VisitorPreview`). No painel público não contava. Invertido: o público conta, o
   preview do dono não.

3. **Detalhamento de cliques do painel do mestre sempre zerado.** O frontend manda o tipo
   de clique (`refactored_v4` no card, `cta_entrar`, `link_vtt`); o backend só gravava
   `with_metrics`/`without_metrics` em `table_click_events`, de um A/B test que nenhum
   frontend envia. Medido em produção: `table_click_events` com 0 linhas. O
   `click_breakdown` do `GET /api/v1/gm/insights` lia essa tabela vazia. Agora a rota
   `/click` grava os três tipos que o painel lê, e só quando o clique contou, para o
   detalhamento somar o mesmo que `clicks_count`. O insert roda na mesma transação do
   contador, pelo gancho `onCounted` de `recordTableMetric` (achado do CodeRabbit na PR
   #338: fora dela, falha no insert deixava o clique contado e a rota em 500). O A/B morto saiu do código; a tabela
   continua, agora com uso.
4. **Script que mataria a série.** `cleanupMetricEvents.ts` apagava eventos com mais de
   48 h. Nunca rodou (fora do `cronRunner`; eventos de 2026-04-07 no banco). Virou
   `anonymizeMetricEvents.ts` (`metrics:anonymize`): anula `fingerprint_hash` depois de 48 h
   e mantém a linha, recusando rodar se a retenção não cobrir a maior janela de dedupe
   (24 h). A migration 167 (`migration_167_spec105_metric_events.sql`, T1.5b)
   faz `DROP NOT NULL` na coluna (medido em produção: `is_nullable = NO`); header validado
   por `parse_header` e `validate_sql_against_class`, rc 0. Ligado no `cronRunner` (1×
   por dia e no boot), que roda em produção (`docker-compose.prod.yml:144`,
   `npm run og:cron`). `README_CLEANUP.md`, que documentava o apagamento, saiu.

**Medido em prod (2026-10-13, depois do deploy).** `POST /api/v1/tables/<slug>/view` → 200
e `table_metric_events` com 1 linha `view` (16:17 UTC). `mesas-cron` rodou
`metrics:anonymize` (15:30 UTC): "4 eventos anonimizados".

Clique em card do catálogo (2026-10-13, 16:23 UTC, mantenedor): `table_metric_events` ganhou
1 linha `click` e `table_click_events` a primeira linha da tabela (`variant = refactored_v4`),
que tinha 0 linhas antes do deploy — o detalhamento do painel do mestre passa a ter dado.

**CTA medido em prod (2026-10-13, 16:45 UTC).** Mantenedor relatou clicar no CTA, mas o log
da API mostra 3 `POST /click` (16:23, 16:41, 16:42), todos colados num `POST /view` 0,1–0,4
s depois (padrão do clique em card) e nenhum `POST /contact`; não identifiquei por quê. Com
`window.open` substituído por stub (sem abrir o WhatsApp) e o botão `💬 Enviar WhatsApp`
acionado por JS no Playwright, o código de prod fez `POST /click`, `POST /contact` e
`/g/collect` com `en=contact_click`, `origem=mesa`, `canal=whatsapp` (204). Banco: linha
`contact` em `table_metric_events` (16:45:06) e `contacts_count = 1` em `table_metrics`.
Isso gravou 1 `click` e 1 `contact` de visitante sintético em `caverna-do-dragao-lv-4`.

**Lacunas de contagem por canal (medido em 2026-10-13, 39 mesas ativas).**

- `table_metric_events` não tem coluna de canal, e o dedupe de `contact` (30 min por
  visitante e mesa) ignora o canal: WhatsApp e depois Discord contam 1 no banco e 2
  `contact_click` no GA4. Os dois números divergem por construção.
- Mesa só com WhatsApp (11) tem 3 alvos clicáveis para o mesmo `wa.me`: CTA, botão do bloco
  "Como participar" e o link com a URL crua. O CTA e o bloco chamam `registerTableContact`.
- 22 das 39 têm só `form`: o CTA vira `scroll-contact` (`tableViewMapper.ts`), gera `click` e
  nunca `contact`; o contato só conta no botão do bloco.
- Nick do Discord sem `discord_server_url` é texto sem link e não mede nada. Hoje são 0 nas
  ativas (os 2 Discord têm convite), mas o importador cria esse caso. Telefone abre `wa.me`
  com rótulo "Ligar ou enviar SMS" (0 nas ativas).
- Correção proposta, não aplicada: coluna `channel` + dedupe por canal (migration, exige
  aprovação), botão "Copiar" no nick, rótulo do telefone, e dedupe visual CTA × bloco
  (decisão de produto do mantenedor).

**ADIADO (mantenedor, 2026-10-13):** correção por canal, botão de copiar nick e UI
duplicada ficam para depois do básico do Analytics e do Search Console.

**Aceite (aberto).** M1 fechado pelo caminho do CTA. Falta o `contact_click` aparecer no GA4
(o realtime não o listou 2 min depois do 204; não medi o relatório padrão) e o clique
do perfil (M3).

### [ ] T1.5 — Clique em contato do mestre persistido (M3) — em prod; aceite ADIADO (mantenedor, 2026-10-13)

- `apps/mesas/database/migration_167_spec105_metric_events.sql`: tabela
  `gm_profile_contact_events (id, gm_profile_id, channel, clicked_at)`, sem IP e sem
  fingerprint, padrão da `gm_profile_view_events` (migration 108). `CHECK` de canal
  idempotente por `DO $$` + `pg_constraint`, índice `(gm_profile_id, clicked_at DESC)` e
  bloco de validação no fim. `deploy-flow.md` §3 lido nesta sessão.
- Validado pelo script oficial: `parse_header` devolve `CLASS=online-safe`,
  `REQUIRES_BACKUP=false`, rc 0; `validate_sql_against_class … online-safe` rc 0. Em
  produção (só leitura): `gm_profiles.id` é `uuid` e `to_regclass('gm_profile_contact_events')`
  é nulo. **Não medi a execução 2×:** Docker local parado, e rodar no banco da VM é escrita.
- Rota `POST /api/v1/gm/perfis/:slug/contact-click` insere a linha no lugar do
  `console.log`. `req.body` agora passa por normalizador (antes, `as { channel?: string }`).
  **Achado do Codex na PR #338 (P1, procedente):** a rota aceitava só 4 canais e devolvia
  400 — em silêncio, porque o frontend ignora erro de tracking — para `phone`, `facebook` e
  `instagram`, que o perfil aceita desde a spec 096 R12. O defeito já existia na lista
  `validChannels` antiga; a primeira versão do `CHECK` o copiou. Agora a rota e o `CHECK`
  usam os 7 de `CONTACT_CHANNELS` (`utils/contactUrls.ts`), via `isGmContactChannel` em
  `utils/profileContacts.ts`.
- `GET /api/v1/gm/perfis/:slug/insights` devolve `profile_contacts: { total, by_channel }`,
  campo novo e aditivo. As linhas do banco passam por `summarizeProfileContacts`, que as
  trata como `unknown` (achado do Codex na PR #338, P1); 5 testes em
  `profileContacts.test.ts`. O frontend ainda não exibe: mostrar ao mestre é decisão de produto.
- `db/types.ts` com `GmProfileContactEventsTable`. Backend: `build`, `lint` e testes
  verdes (1214 passam, 1 pulado, medido em 2026-10-13 com a árvore atual).

**Deploy (medido em 2026-10-13).** Dos 6 módulos: beta de `glossario`, `site` e
`downloads`; promote `dev → main` (`main` = `dev` = `a02f6ca`); prod de `mesas`, `glossario`,
`site`, `downloads`, `links` e `accounts`, um por vez, todos com run verde e containers
novos `healthy`. `mesas` prod: migration 167 em `schema_migrations`,
`to_regclass('gm_profile_contact_events')` não nulo, `fingerprint_hash` `is_nullable = YES`.
`accounts`: antes do deploy, só `tsx` → `catalog:` (devDependency) no diff, ledger 12/12.

**Aceite (aberto).** M3: um clique no perfil público gerar linha nova em
`gm_profile_contact_events` (hoje 0 linhas, medido depois do deploy).

### [x] T1.5b — Migrations 167 e 168 unidas — FEITA (2026-10-12)

Pedido do mantenedor; o Codex cobrou o mesmo na PR #338 (P1: cada arquivo conta no
`MAX_AUTO_PENDING`). Agora é um arquivo só,
`apps/mesas/database/migration_167_spec105_metric_events.sql`: tabela
`gm_profile_contact_events` + `DROP NOT NULL` em `table_metric_events.fingerprint_hash`, com
um bloco de validação para as duas partes. Nenhuma das duas tinha sido aplicada (medido em
produção). `parse_header` e `validate_sql_against_class … online-safe` rc 0;
`rtk rg "migration_168" apps` sem resultado.

### [~] T1.6 — Formulário interno do mestre responde sucesso sem enviar (M4) — removido; falta deploy

**Correção do enquadramento (2026-10-13, medido).** `plan.md` §3.6 trata o canal `form` como
"o formulário que não envia" e oferece enviar por `@artificio/email` ou retirar o canal. Isso
confundia duas coisas de mesmo nome:

- **Canal `form`** = link externo. `classifyContactChannel` (`syncHelpers.ts:187`) devolve
  `form` para qualquer URL de host desconhecido; `MestreContactMethods.tsx:140` abre
  `contact.value` com `openSafeExternalUrl`. Funciona. Produção: 131 de 235 contatos de mesa
  são `form` (86 `forms.gle`, 39 `docs.google.com`, 1 `forms.cloud.microsoft`, 2 sites) e 2
  de 42 contatos de perfil (`forms.gle`, `docs.google.com`). É o canal mais usado.
- **`MestreContactForm`** = formulário interno (nome, e-mail, mensagem) que `MestrePage.tsx:184`
  renderiza **sempre que o perfil tem algum canal `form`**. Posta em
  `POST /api/v1/gm/perfis/:slug/contact` (`gm.ts:617`), que valida, faz `console.log` do
  tamanho e responde "enviada com sucesso" (`TODO: Implementar envio de email`). A mensagem
  se perde. Os 2 mestres que cadastraram `form` informaram o próprio Google Form: o
  formulário interno aparece além dele, sem ter sido pedido, e mente.

**Achado lateral:** 3 dos 131 `form` de mesa não são URL (`kauarang`, `.zero9899`, `uwill`):
o `catch` de `classifyContactChannel` joga texto não reconhecido em `form`, e o CTA abre
nada. Vindo de import do Discord (`syncHelpers.ts`). Não medi o que o CTA faz com eles.

**Aplicado (2026-10-13, ordem do mantenedor: "siga o caminho sugerido").** Removidos
`MestreContactForm`, o bloco em `MestrePage.tsx` e `POST /api/v1/gm/perfis/:slug/contact`
(`verify:api`: 1 breaking, a rota; consumidor único era o componente). Não foi para e-mail:
o canal `form` já é o formulário do mestre, e uma mensagem anônima por e-mail seria canal
novo, decisão de produto que ele não pediu.

**Achado lateral corrigido.** `classifyContactChannel` e a escrita já recusam identificador
solto desde 2026-08-03 (medido: 90 `form` criados depois, 0 não-URL). Os 3 `form` não-URL
são de 2026-07-09, de mesas **fechadas** (410 na API). A leitura (`serializeContact`) não
aplicava a regra e emitiria `https://uwill/` para legado ativo: agora `form` não-resolvível
sai como `discord`, igual ao importador. 3 testes novos. As 3 linhas no banco seguem como
estão; corrigi-las é SQL write em prod (aprovação), e a leitura já as neutraliza.

**Aceite.** M4: nenhuma rota responde sucesso sem ter enviado. Falta deploy de `mesas`.

### [x] T1.7 — Aviso de lint em `useBannerScrim.ts` — FEITA (2026-10-12)

O aviso era `useBannerScrim.ts:251:6`, `React Hook useEffect has a missing dependency:
'enquadramento'` (`react-hooks/exhaustive-deps`). A omissão era intencional, e não bug:
`MestreHero.tsx:207` monta `{ ...caixaBanner, objectPosition }` a cada render, e depender
do objeto refaria a medição (nova `Image` e nova leitura de canvas) em todo render. As
dependências já eram os três primitivos, então o scrim nunca usou enquadramento velho.

Correção na causa: o hook lê `largura`, `altura` e `objectPosition` fora do efeito e remonta
o objeto dentro dele. As dependências são as mesmas de antes, agora exaustivas, sem
`eslint-disable`. `pnpm lint` do frontend sai sem aviso; os testes de
`src/components/mestre` passam (14 arquivos, 172 testes, incluindo `useBannerScrim.test.ts`).
O comportamento é o mesmo por construção: mesmas três dependências, mesmo valor passado a
`medirPiorCaso`. Não medi no browser.

---

## F2 — Baseline

Medido em 2026-10-13, só leitura. Janela GSC: 2026-09-13 a 2026-10-10 (28 dias fechados,
`dataState=final`).

### [~] T2.1 — Volume e janela

- GSC, `mesas.artificiorpg.com`: **5 cliques e 133 impressões** em 28 dias (`/` 2 cliques,
  três mesas 1 cada), 56 páginas com impressão (`/` 51 impressões, posição 2,3; o resto 1–7
  cada). Mesmo número no MCP e no `coletar.mjs` (T3.1). O
  domínio todo: 2.301 cliques e 23.698 impressões em 28 dias (posição 6,1), então o `mesas` é
  pequeno no total.
- GA4: **sem baseline.** `hostName` `mesas.`/`glossario.` tiveram 0 evento nos 28 dias
  (T0.2); a coleta existe desde o deploy de 2026-10-13. Comparação antes/depois da F4 só
  pode usar GA4 a partir dessa data; GSC e banco têm série anterior.
- Banco: contadores `table_metrics` existem, mas `views_count`/`clicks_count` mudaram de
  semântica no deploy (T1.4); a série anterior não é comparável.

**Janela mínima** (`plan.md` §4.1): com 5 cliques/28 dias, qualquer efeito de título ou
description em cliques é indetectável; a F4 só pode medir impressão, posição e indexação.

### [x] T2.2 — Cobertura de indexação

`batch_url_inspection`, 78 URLs:

- **17 do sitemap:** 16 `Submitted and indexed`; 1 `Discovered - currently not indexed`
  (`caverna-do-dragao-lv-4`, mesa nova, nunca rastreada).
- **61 perfis públicos de mestre** (todos 200 na API; fora do sitemap): 41 indexados, 14
  `URL is unknown to Google`, 6 `Duplicate, Google chose different canonical than user`
  (`foolangel`, `marcio-abreu`, `mesa-video-game`, `mestre-kevin`, `mestre-noir`, `vidal17`).
  Os 14 desconhecidos sustentam a hipótese da T4.1.
- **Achado:** as 16 mesas indexadas inspecionadas têm o mesmo aviso de *Merchant listings*:
  `Invalid object type for field "brand"` — o JSON-LD usava `Person`. `brand` saiu
  do `Product` (`tableMeta.ts`, teste novo): `Brand` com o nome do mestre só trocaria o tipo,
  porque nome de exibição não é marca do produto (achado do CodeRabbit na PR #339).
  Falta deploy, e confirmar no Rich Results Test depois dele que o aviso sumiu. Os demais avisos (`review`, `aggregateRating`,
  `shippingDetails`, `hasMerchantReturnPolicy`) são opcionais e não se aplicam a mesa de RPG.
- Não medi o porquê do canonical diferente nos 6 perfis.

### [~] T2.3 — Consultas e CTR por posição

A API anonimiza consulta de baixo volume: `query × page` devolveu 8 linhas
(`site:artificiorpg.com` 35 impressões na home, `artificio rpg` 6, `o mestre do artifício` 4,
`vaasa dnd` 2, `casarao agua verde` 1). Não há faixa 4–15 com volume para CTR por posição.
Páginas na faixa 4–15 com mais impressões: `bem-vindos-a-vaasa-dnd-2024` (7, pos. 12),
`cronicas-do-ninho-flamejante` (4, 15,2), `o-vale-dos-sinos` (4, 16), `sombra-de-falmouth`
(3, 13,3), `/mestre/alquenauta` (3, 9,7), `/mestre/yuripi` (3, 7,7). **Conclusão medida:** o
tráfego orgânico é majoritariamente de marca (`artificio rpg`, `site:`); não há consulta de
sistema com impressão que justifique página por sistema.

### [ ] T2.4 — Entrada e funil

Sem dado: `page_view(mesa) → select_mesa → contact_click` só existe depois de 2026-10-13, e
`contact_click` ainda não foi medido (T1.3). Reabrir com 14 dias de coleta.

**Aceite da F2.** B1: T2.1–T2.3 com número, período e consulta citados (feito); T2.4 depende
de coleta.

---

## F3 — Coleta reproduzível

### [x] T3.1 — `scripts/seo/coletar.mjs` + manifesto — FEITA (2026-10-13)

Desenho em `plan.md` §5. `scripts/seo/apps.json` (mesas, glossario, downloads, site; uma linha
por app, com `hostName` porque os apps dividem a property), `coletar-lib.mjs` (funções
puras) e `coletar.mjs` (REST com `google-auth-library@11.1.0`, autorizada pelo mantenedor em
2026-10-12; 11.1.0 com 26 dias de publicada). A dependência está em `scripts/package.json`;
o lock ganhou `+37`, `−0` (`pnpm install --lockfile-only`, conferido com `git diff`),
`--frozen-lockfile` depois exit 0. Recusa período aberto (`--end` ≥ hoje) e measurement id
`G-…` no lugar do id numérico.

**Medido.** `node scripts/seo/coletar.mjs --start 2026-09-13 --end 2026-10-10`, duas
execuções (todos os apps e só `mesas`): `diff` vazio nas duas. `mesas`: 5 cliques, 133
impressões, 56 páginas, igual ao MCP; GA4 de `mesas` vazio no período, esperado (T0.2). 10
testes em `coletar-lib.test.mjs`; `smoke:test-typecheck-coverage` verde.

**Lock destravado na causa (2026-10-12) — histórico em `errors.md` E023, regra em
`deploy-flow.md` §2.** A primeira tentativa de instalar reescreveu o lock fora do escopo
(sufixo `(supports-color@5.5.0)`, o mesmo sintoma da 102 e do incidente de 2026-09-03).
Causa medida: `nodemon` era o único pacote a trazer `supports-color@5.5.0`, e com ele o
lock dependia da ordem das operações, mesmo na mesma versão do pnpm. Mudanças:

- `tsx` é o único executor TypeScript do monorepo, com versão única em `catalog:`
  (`pnpm-workspace.yaml`); `nodemon` e `ts-node` saíram de `mesas`, `glossario` e
  `downloads` (`dev` = `tsx watch`, scripts `*:dev` = `tsx`). Raiz, `accounts`, `site` e
  `links` passam de três faixas de `tsx` para `catalog:`.
- `overrides` com seletor de pai fixam `legacy-javascript` 0.0.1 e `third-party-web`
  0.29.2 sob `@paulirish/trace_engine`, que os declara como `latest`.
- `.gitattributes`: `*.mjs text eol=lf`. Achado no `turbo run test`: com CRLF no checkout
  do Windows, o vitest recusava o shebang de `scripts/check-*.mjs` (`SyntaxError: Invalid
  or unexpected token`); no CI (LF) passava.

Validação: lock só perde a árvore de `nodemon`/`ts-node`; três ordens de operação dão o
mesmo lock; `pnpm install --frozen-lockfile` exit 0; `turbo build --force` 27/27;
`turbo run lint` 27/27; `@artificio/scripts` 49/49 depois do LF; `tsx` resolvido nos
quatro backends; os três backends sobem pelo `tsx` até a checagem de env. No `turbo run
test`, `downloads-frontend` falhou na corrida paralela e passou sozinho (326/326) — teste
sensível à carga, não investigado.

**Aceite.** S1: duas execuções no mesmo período fechado, saída idêntica — **cumprido**
(`diff` vazio).

---

## F4 — Melhorias por hipótese

Formato obrigatório de cada task: hipótese · métrica · antes · janela · depois
(`plan.md` §6).

### [~] T4.1 — Perfis de mestre no sitemap — implementado; falta deploy e a janela

- **Hipótese:** perfis indexáveis fora do sitemap demoram mais para ser descobertos.
- **Métrica:** perfis `Submitted and indexed` no `batch_url_inspection`; impressões em
  `/mestre/` no GSC.
- **Antes (2026-10-13):** 41 de 61 indexados, 14 `URL is unknown to Google`, 6 `Duplicate,
  Google chose different canonical`; 0 dos 61 no sitemap (T2.2). Impressões em `/mestre/`
  na janela 2026-09-13…10-10: 16 páginas, 1–3 impressões cada, 0 cliques (T2.3).
- **Janela:** 28 dias fechados depois do deploy, com o sitemap reenviado no GSC.
- **Depois:** a medir.

`routes/sitemap.ts` passa a listar `gm_profiles` ⨝ `users`, o mesmo critério da rota
pública `GET /gm/perfis/:slug` (que só dá 404 sem essa linha; 61 de 61 devolveram 200). Sem
teste de rota: o arquivo não tinha teste e a consulta é um join sem regra própria; `tsc` e
`eslint` limpos. Os 6 perfis com canonical diferente não têm causa medida: o sitemap não os
resolve, e não devem ser contados como efeito da mudança.

### [ ] T4.x — Derivadas da F2

Abertas só com os quatro primeiros campos preenchidos.

---

## F5 — Fechar a F6 da 102

### [ ] T5.1 — *Validate Fix* e *Request Indexing* **(mantenedor)**

Lista de até 10 URLs vinda de T2.3, por impressão. Depois, marcar 102 T6.1/T6.2 com
ponteiro para esta task.

---

## Ações que exigem aprovação nominal

- T0.2: instalar `analytics-mcp` e `mcp-search-console` (pacote novo). Autorizado pelo
  mantenedor em 2026-10-12 ("instalar e ativar na íntegra").
- T1.1 e T1.3: mudança em `packages/analytics` (pacote compartilhado).
- T1.4 e T1.5: migrations 167 e 168 (deploy do `mesas`).
- T1b.4: escrita no GA4 (key event, dimensões, retenção), barrada no auto mode.
- T3.1: `google-auth-library` (pacote novo).
- Qualquer chamada a `manage_sitemaps`.
- Commit, push e deploy de cada frente.
