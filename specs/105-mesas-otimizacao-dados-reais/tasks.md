# Tasks 105 — Otimização do `mesas` guiada por dados reais

Evidência: `spec.md` §2. Desenho: `plan.md`. Cada task tem **um** bloco de estado. Ao
retomar, o bloco é reescrito, nunca recebe anexo.

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

### [~] T1b.4 — Auditoria dos painéis (GA4 + Search Console) — LEVANTADA; escrita no GA4 pendente

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

### [~] T1.0 — GA4 não coleta em `mesas`, `glossario` e `downloads` — CORRIGIDO LOCAL; falta deploy

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

**Aceite (aberto até deploy).** Em produção, nos três apps, pelo menos um `/g/collect`
depois do load; o painel do stream deixa de mostrar "A coleta de dados não está ativa"; a
API devolve linhas de `hostName` `mesas.artificiorpg.com`.

### [~] T1.1 — `page_view` limpo e sem repetição (I1) — CORRIGIDO LOCAL; falta deploy

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

**Aceite.** Depois do deploy, `pagePathPlusQueryString` sem `?` nas rotas dos três apps, e
filtro de catálogo sem gerar `page_view`.

### [ ] T1.2 — `page_view` duplicado pela Enhanced Measurement (I2)

Medir no DebugView depois do deploy da T1.0, com navegação de N rotas. Se vier 2N, desligar
*"Page changes based on browser history events"* nas streams `mesas` e `glossario`. Com o
papel Editor, o agente faz isso pela Admin API quando o mantenedor pedir a regularização.

**Aceite.** I2.

### [~] T1.3 — Evento `contact_click` (I3) — IMPLEMENTADO LOCAL; falta deploy e key event

`trackContactClick({ origem, canal, mesa_id?, sistema? })` no catálogo de
`packages/analytics` (sem número, e-mail ou URL de destino). Disparado em três lugares:

- CTA da mesa que abre o canal direto (`handleCTA`, `external-link`). O canal vem de
  `CTAConfig.channel`, campo novo e opcional em `@artificio/catalog-table`, preenchido pelo
  `tableViewMapper` (`discord` ou `whatsapp`).
- Botões e links do bloco de contato da mesa (`TableContactsBlock`, só na página pública).
- Contato pelo perfil do mestre (`useTracking.trackGmContactClick`, com `origem: 'mestre'`).

Falta marcar `contact_click` como key event no GA4. O agente faz isso pela Admin API quando
o mantenedor pedir (papel Editor).

**Coerência com a 102 (conferido em 2026-10-12).** A 102 T4.4 decidiu que o contato da mesa
é **candidatura, não reserva**: `form 108 | whatsapp 46 | discord 33 | email 1`, e o mestre
seleciona. Por isso `Event` foi descartado e o JSON-LD é só `Product`+`Offer`. O
`contact_click` mede "contato iniciado", e não compra nem reserva, o que é coerente com a
decisão. O JSON-LD não foi tocado, e o guard G-F da 102 (`smoke:jsonld-price-source`)
continua OK. O username do Discord continua texto, nunca link (achado da 102 de
2026-09-11): o rastreio entrou só nos `<a>` que já existiam.

**Aceite.** I3, mais o key event marcado.

### [~] T1.4 — Contato e série temporal da mesa (M1, M2) — IMPLEMENTADO LOCAL; falta deploy

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
  usado também nas duas cópias de `gm.ts`). A `/view` passa a validar slug como as outras:
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
   detalhamento somar o mesmo que `clicks_count`. O A/B morto saiu do código; a tabela
   continua, agora com uso.
4. **Script que mataria a série.** `cleanupMetricEvents.ts` apagava eventos com mais de
   48 h. Nunca rodou (fora do `cronRunner`; eventos de 2026-04-07 no banco). Virou
   `anonymizeMetricEvents.ts` (`metrics:anonymize`): anula `fingerprint_hash` depois de 48 h
   e mantém a linha, recusando rodar se a retenção não cobrir a maior janela de dedupe
   (24 h). `apps/mesas/database/migration_168_table_metric_events_fingerprint_nullable.sql`
   faz `DROP NOT NULL` na coluna (medido em produção: `is_nullable = NO`); header validado
   por `parse_header` e `validate_sql_against_class`, rc 0. Ligado no `cronRunner` (1×
   por dia e no boot), que roda em produção (`docker-compose.prod.yml:144`,
   `npm run og:cron`). `README_CLEANUP.md`, que documentava o apagamento, saiu.

**Aceite.** M1, mais `SELECT action, count(*) FROM table_metric_events WHERE created_at >
<deploy> GROUP BY 1` com linhas novas.

### [~] T1.5 — Clique em contato do mestre persistido (M3) — IMPLEMENTADO LOCAL; falta deploy

- `apps/mesas/database/migration_167_gm_profile_contact_events.sql`: tabela
  `gm_profile_contact_events (id, gm_profile_id, channel, clicked_at)`, sem IP e sem
  fingerprint, padrão da `gm_profile_view_events` (migration 108). `CHECK` de canal
  idempotente por `DO $$` + `pg_constraint`, índice `(gm_profile_id, clicked_at DESC)` e
  bloco de validação no fim. `deploy-flow.md` §3 lido nesta sessão.
- Validado pelo script oficial: `parse_header` devolve `CLASS=online-safe`,
  `REQUIRES_BACKUP=false`, rc 0; `validate_sql_against_class … online-safe` rc 0. Em
  produção (só leitura): `gm_profiles.id` é `uuid` e `to_regclass('gm_profile_contact_events')`
  é nulo. **Não medi a execução 2×:** Docker local parado, e rodar no banco da VM é escrita.
- Rota `POST /api/v1/gm/perfis/:slug/contact-click` insere a linha no lugar do
  `console.log`. `req.body` agora passa por normalizador (antes, `as { channel?: string }`),
  e a lista de canais virou `GM_CONTACT_CHANNELS`, a mesma do `CHECK`.
- `GET /api/v1/gm/perfis/:slug/insights` devolve `profile_contacts: { total, by_channel }`,
  campo novo e aditivo. O frontend ainda não exibe: mostrar ao mestre é decisão de produto.
- `db/types.ts` com `GmProfileContactEventsTable`. Backend: `build`, `lint` e 1203 testes
  verdes.

**Aceite.** M3: depois do deploy, um clique no perfil público gera linha nova em
`gm_profile_contact_events`.

### [ ] T1.5b — Juntar as migrations 167 e 168 numa só

Pedido do mantenedor em 2026-10-12: as duas migrations novas da spec
(`migration_167_gm_profile_contact_events.sql` e
`migration_168_table_metric_events_fingerprint_nullable.sql`) viram um arquivo só. Nenhuma
foi aplicada (`to_regclass('gm_profile_contact_events')` nulo e `fingerprint_hash` ainda
`NOT NULL` em produção, medido em 2026-10-12), então dá para juntar sem migration de
correção. Header único `online-safe` (as duas já validaram assim), o bloco de validação de
cada parte mantido, e as referências a `migration_168` em `anonymizeMetricEvents.ts` e
`db/types.ts` atualizadas para o número único.

**Aceite.** Um arquivo `migration_167_*.sql`; `parse_header` e `validate_sql_against_class`
com rc 0; `rtk rg "migration_168" apps` sem resultado.

### [ ] T1.6 — Formulário de contato do mestre (M4) · **decisão de produto pendente**

Opções medidas em `plan.md` §3.6: (a) enviar por `@artificio/email`, recomendada; (b)
retirar o canal `form` (2 perfis em produção). Independente da resposta, o endpoint deixa
de responder sucesso sem ter enviado.

**Aceite.** M4.

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

### [ ] T2.1 — Volume e janela

Os itens 1 e 5 de `plan.md` §4, mais a janela de comparação fixada (§4.1).

### [ ] T2.2 — Cobertura de indexação

`batch_url_inspection` nas 17 URLs do sitemap e nos perfis públicos de mestre. Contar
antes quantos dos 61 `gm_profiles` são públicos.

### [ ] T2.3 — Consultas e CTR por posição

Item 3 de `plan.md` §4. Lista de páginas candidatas a ajuste de título e description, e de
consultas por sistema com impressão (insumo da decisão de página por sistema).

### [ ] T2.4 — Entrada e funil

Item 4 de `plan.md` §4. O funil completo só depois de T1.3 no ar.

**Aceite da F2.** B1: cada task com número, período e consulta citados.

---

## F3 — Coleta reproduzível

### [ ] T3.1 — `scripts/seo/coletar.mjs` + manifesto

Desenho em `plan.md` §5. `google-auth-library@11.1.0` autorizado pelo mantenedor em
2026-10-12 (11.1.0 com 26 dias de publicada; a 11.2.0 tinha 5). Entra junto com o script,
para não ficar dependência sem consumidor. No estado atual do lock, ele entra com `+36`,
`−0` (medido em cópia isolada).

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

**Aceite.** S1: duas execuções no mesmo período fechado, saída idêntica (`diff` vazio).

---

## F4 — Melhorias por hipótese

Formato obrigatório de cada task: hipótese · métrica · antes · janela · depois
(`plan.md` §6).

### [ ] T4.1 — Perfis de mestre no sitemap

Hipótese: os perfis indexáveis fora do sitemap demoram mais para ser descobertos.
Métrica: estado de indexação (T2.2) e impressões em `/mestre/` (T2.3). Usar o mesmo
critério de visibilidade da rota pública do perfil, como fonte única (lição da 102 Achado
B).

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
