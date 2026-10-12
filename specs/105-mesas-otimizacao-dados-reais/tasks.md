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

### [~] T0.2 — MCP registrados; acesso medido pela API; ferramentas só em sessão nova

Registrados em escopo `local` (`~/.claude.json`, fora do repositório):
`ga4` → `uvx analytics-mcp@0.7.0` (com `GOOGLE_APPLICATION_CREDENTIALS` e
`GOOGLE_PROJECT_ID=artificiorpg-analytics`); `gsc` → `uvx mcp-search-console@0.4.1`, sem
`GSC_ALLOW_DESTRUCTIVE`. O `claude mcp get` dá **Connected** nos dois. Isso só prova que o
servidor sobe.

**O acesso foi medido de verdade em 2026-10-12**, com a mesma chave, por um script só
leitura (`google-api-python-client` via `uvx`, fora do repositório):

- `accountSummaries.list` → só a conta "Toca do Coruja RPG Total", property
  `properties/475307720`.
- `runReport` (28 dias, por `hostName`): `artificiorpg.com` 2.246 usuários ativos e 15.266
  eventos; `beta.artificiorpg.com` 1 usuário e 42 eventos. **Zero linhas de `mesas.`,
  `glossario.` ou `downloads.`**, o que confirma a T1.0 no período inteiro.
- `sites.list` → `sc-domain:artificiorpg.com`, `siteFullUser`.
- `searchanalytics.query` (2026-09-10 a 2026-10-09, `page` contém `mesas.artificiorpg.com`,
  top 5): `/` com 3 cliques, 55 impressões e posição 2,2; três mesas com 1 clique cada; e
  `/catalogo` com 0 cliques e 2 impressões.

Nada mais é preciso para a API funcionar. **Falta só reiniciar o Claude Code**, para as
ferramentas `mcp__ga4__*` e `mcp__gsc__*` aparecerem. Na sessão nova, repetir uma consulta
pelo MCP e fechar esta task.

**Aceite.** K1 e K2 (`spec.md` §4) pelo MCP, com saída citada.

### [ ] T0.3 — Trava de escrita

Medir se `permissions.deny` aceita nome de ferramenta MCP. Se aceitar, negar
`manage_sitemaps` (e `add_site`, `delete_site` e `delete_sitemap`, como defesa extra). Se
não aceitar, a trava fica só na §Autorização, e isso é registrado aqui. Com Search Console
Total, a trava fica mais importante: o nível de acesso já permite escrever.

**Aceite.** K3, com a medição da trava citada.

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

`downloads` envia para `G-2H50PCM950`, o stream do `site`, e mistura os dados dos dois.
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

### [ ] T1b.4 — Auditoria dos painéis (GA4 + Search Console)

Com o MCP ativo, levantar por medição:

- No GA4: key events configurados, filtros de tráfego interno, exclusão de referral entre
  subdomínios (o `cookie_domain` raiz depende disso), retenção de dados e Enhanced
  Measurement por stream (G3).
- No Search Console: propriedades existentes além da de Domínio, sitemaps enviados versus os
  servidos hoje, e usuários.

Cada divergência achada vira item novo nesta fase.

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
  lógica foi movida do `gmPanel`, sem mudança.
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

**Risco registrado (não executa hoje):** `scripts/cleanupMetricEvents.ts` apaga eventos com
mais de 48 h. Ligado, ele mataria a série do M2. Hoje não roda: não está no `cronRunner`, e
os eventos de 2026-04-07 continuam no banco. Desenho proposto, a decidir junto com a T1.5
(precisa de migration): depois de 48 h, anular `fingerprint_hash` em vez de apagar a linha.
Fica a série, sai o dado de dedupe.

**Aceite.** M1, mais `SELECT action, count(*) FROM table_metric_events WHERE created_at >
<deploy> GROUP BY 1` com linhas novas.

### [ ] T1.5 — Clique em contato do mestre persistido (M3) — migration pendente

Desenho: `migration_167_gm_profile_contact_events.sql`, com `gm_profile_contact_events (id,
gm_profile_id, channel, clicked_at)`, sem IP e sem fingerprint, no padrão da
`gm_profile_view_events` (migration 108). A rota `contact-click` passa a inserir no lugar do
`console.log`. `deploy-flow.md` §3 lido em 2026-10-12. **Não escrita nesta rodada:** o
mantenedor pediu para fechar e abrir a PR antes de continuar.

**Aceite.** M3.

### [ ] T1.6 — Formulário de contato do mestre (M4) · **decisão de produto pendente**

Opções medidas em `plan.md` §3.6: (a) enviar por `@artificio/email`, recomendada; (b)
retirar o canal `form` (2 perfis em produção). Independente da resposta, o endpoint deixa
de responder sucesso sem ter enviado.

**Aceite.** M4.

### [ ] T1.7 — Aviso de lint pré-existente em `useBannerScrim.ts`

Pedido do mantenedor em 2026-10-12. `pnpm lint` no frontend do `mesas` devolve 1 aviso, num
arquivo que esta spec não tocou: `src/components/mestre/useBannerScrim.ts:251:6`,
`React Hook useEffect has a missing dependency: 'enquadramento'`
(`react-hooks/exhaustive-deps`). Verificar se a omissão é intencional (efeito que não deve
reexecutar com o enquadramento) ou bug (scrim calculado com enquadramento velho). Corrigir
na causa, sem `eslint-disable`.

**Aceite.** `pnpm lint` no frontend sem avisos, e o comportamento do banner medido antes e
depois.

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

### [ ] T3.1 — `scripts/seo/coletar.mjs` + manifesto **(aprovação: `google-auth-library`)**

Desenho em `plan.md` §5.

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
- T1.5: migration nova (deploy do `mesas`).
- T3.1: `google-auth-library` (pacote novo).
- Qualquer chamada a `manage_sitemaps`.
- Commit, push e deploy de cada frente.
