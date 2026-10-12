# Plan 105 — Otimização do `mesas` guiada por dados reais

Evidência e escopo: `spec.md`. Este arquivo diz **como** fazer. As decisões técnicas daqui
são do agente e podem ser revertidas pelo mantenedor. As decisões de produto estão
marcadas e ficam abertas até ele responder.

---

## 1. Princípio

Três fontes com papéis diferentes, sem nenhuma promovida a verdade única:

| Fonte | Mede | Ponto cego |
|---|---|---|
| Search Console | o que acontece **antes** do clique: impressão, posição, CTR, indexação | consultas anonimizadas; só linhas do topo; atraso de 2 a 3 dias |
| GA4 | o que acontece **depois** do clique: entrada, engajamento, funil | bloqueador de anúncio e CSP cortam coleta; depende de instrumentação correta (F1) |
| Banco (`table_metrics` e afins) | ação no servidor: view, clique, contato | sem origem de tráfego; hoje sem série temporal (M2) |

Uma conclusão vale quando duas fontes concordam ou quando a divergência entre elas está
explicada. A divergência GA4 × banco no mesmo evento mede a perda por bloqueador. Essa
perda é um dado em si.

---

## 2. F0 — Acesso só leitura

### 2.1 Credencial

Uma service account dedicada, num projeto Google Cloud do mantenedor, com:

- APIs ligadas: Google Analytics Admin API, Google Analytics Data API e Google Search
  Console API.
- **GA4:** papel **Editor** na property `p475307720`. É decisão do mantenedor
  (2026-10-12), para a F1b regularizar a configuração pela Admin API. Leitor bastaria para a
  análise; Editor existe para a correção. Escrita só quando ele pedir.
- **Search Console:** **Total** em `sc-domain:artificiorpg.com`. É decisão do mantenedor
  (2026-10-12), para a regularização incluir sitemap. A escrita (`manage_sitemaps`) segue a
  §Autorização e a trava da T0.3.

O JSON da chave fica em `%USERPROFILE%\.config\artificio\` e **nunca no repositório**. O
TruffleHog barraria o commit, mas a defesa principal é o arquivo nunca entrar na árvore.

### 2.2 Registro no Claude Code

Escopo **`local`** (`claude mcp add --scope local`), e não o `.mcp.json` versionado
(`git ls-files .mcp.json` → versionado). O registro carrega o caminho da credencial, que é
da máquina do mantenedor e não do projeto. Decisão técnica do agente.

- GA4: `uvx analytics-mcp@0.7.0` com `GOOGLE_APPLICATION_CREDENTIALS` e
  `GOOGLE_PROJECT_ID`. Na máquina tem `uv`, mas não tem `pipx`.
- GSC: `uvx mcp-search-console@0.4.1`. **O pacote do PyPI chamado `mcp-gsc` é outro
  projeto**: versão 0.1.0, homepage `aminfseo/mcp-gsc`, medido em 2026-10-12. O pacote
  publicado pelo repositório `AminForou/mcp-gsc` é `mcp-search-console`: o README o usa no
  `uvx`, e a homepage no PyPI aponta para `AminForou/mcp-gsc`. Configuração:
  `GSC_SKIP_OAUTH=true`,
  `GSC_CREDENTIALS_PATH`, `GSC_DATA_STATE=final` e **sem** `GSC_ALLOW_DESTRUCTIVE`.

Codex e OpenCode ficam fora: a análise é do Claude Code. Isso entra na skill
`ferramentas-mcp` só se o mantenedor pedir.

### 2.3 Trava de escrita

`manage_sitemaps` pode enviar sitemap mesmo com o flag destrutivo desligado (o README não
garante o contrário). A regra: chamar `manage_sitemaps` é escrita em configuração de
produção no Google e segue a §Autorização (nominal, por ação). O ideal é bloquear a
ferramenta por permissão. **Não medi** se `permissions.deny` do Claude Code aceita nome de
ferramenta MCP (`mcp__gsc__manage_sitemaps`); T0.3 mede isso antes de confiar.

---

## 3. F1 — Instrumentação

### 3.1 I1 — `page_view` com `page_location` limpo (`packages/analytics`)

Trocar `{ page_path }` pelo par documentado. Antes do evento, usar
`gtag('set', { page_location: origin + pathname, page_title: document.title })`. A doc de
SPA do gtag diz que o `set` vale para todo evento seguinte. Essa página é da geração
anterior do gtag, então o efeito no GA4 precisa ser confirmado no DebugView (T1.1). Se se
confirmar, `select_mesa` e `contact_click` também herdam a URL sem query, e a promessa de
privacidade passa a ser verdadeira.

O título precisa estar atualizado quando o hook dispara. No React Router v7 em framework
mode, o `<title>` vem do `meta` da rota. T1.1 mede se, no `useEffect` do hook,
`document.title` já é o da rota nova. Se não for, o título sai do `matches` da rota.

### 3.2 I2 — `page_view` duplicado

Primeiro medir: com acesso ao GA4 (F0), comparar a contagem de `page_view` com a
navegação conhecida no DebugView. Se duplicar, a fonte única de `page_view` passa a ser o
hook manual, porque é ele que garante a URL limpa. O mantenedor desliga *"Page changes
based on browser history events"* nas três streams (`mesas`, `glossario`, `downloads`).
Isso é ação no painel.

### 3.3 I3 — evento `contact_click`

Novo helper no catálogo de `packages/analytics/src/events.ts`:
`trackContactClick({ origem: 'mesa' | 'mestre', canal, mesa_id?, sistema? })`. Sem nome de
pessoa, sem contato, sem URL de destino. Na mesa, "contato" é abrir o canal: o CTA
`external-link` (`handleCTA`) e os links do `TableContactsBlock`. O CTA `scroll-contact` só
rola até o bloco, e não conta. No perfil do mestre, `trackGmContactClick`. Uma função única
na mesa (`features/table/utils/contactTracking.ts`) dispara o banco e o GA4 juntos. Marcar
`contact_click` como *key event* é escrita no GA4: o agente faz pela Admin API quando o
mantenedor pedir.

### 3.4 M1 e M2 — contador de contato e série temporal

- Nova rota pública `POST /api/v1/tables/:slug/contact`, irmã de `/view` e `/click`
  (`routes/tables.ts`), com a mesma validação de slug e o mesmo `isPublicTable` das
  irmãs. Ela incrementa `contacts_count`. Medido: o `globalRateLimiter` (`server.ts:92`)
  cobre todas as rotas, e o CSRF passa por `Origin` same-origin.
- As rotas públicas `/view`, `/click` e `/contact` passam a gravar também uma linha em
  `table_metric_events` (`action`, `fingerprint_hash`). É a tabela que já existe para isso
  e hoje está vazia (M2). A deduplicação reaproveita `shouldCountMetric`
  (`gmPanel.ts:1838`). Antes de mover esse helper, conferir como o fingerprint é derivado,
  para não gravar PII.
- As rotas `POST /api/v1/gm/tables/:id/click|contact|favorite` (`gmPanel.ts:1794-1866`)
  não têm consumidor no frontend. Se `api:consumers` confirmar zero consumidor, elas são
  removidas. Se não confirmar, continuam e o motivo fica registrado.
- Toda rota nova ou removida passa por `pnpm verify:api` e pela atualização do OpenAPI.

### 3.5 M3 — clique em contato do mestre

Tabela nova `gm_profile_contact_events (id, gm_profile_id, channel, clicked_at)`, sem
fingerprint e sem IP, no padrão da `gm_profile_view_events` (migration 108). Migration nova exige ler antes `deploy-flow.md` §3. O `console.log` sai e a
inserção entra. Os insights do mestre (`gm.ts:582`) passam a somar a nova tabela.

### 3.6 M4 — formulário que não envia (decisão de produto)

Duas saídas medidas:

- **(a) Enviar de verdade** por `@artificio/email`, o pacote que já existe (spec 083, Resend,
  hoje consumido só por `downloads-backend`). O e-mail do mestre fica no servidor e nunca
  vai para o jogador. Tem custo de envio, e o `mesas` precisa da chave do Resend.
- **(b) Retirar o canal `form`.** Os 2 mestres que o usam são avisados, e o editor deixa de
  oferecer o canal.

**Recomendação: (a).** O formulário é o único canal que não expõe o contato pessoal do
mestre. Enquanto o mantenedor não decide, existe uma correção que vale para as duas
saídas: o endpoint para de responder "enviada com sucesso" sem ter enviado.

---

## 4. F2 — Baseline

Período: os últimos 28 dias fechados (GSC com `dataState=final`), mais os 3 meses
disponíveis no GA4 desde a D117. Medir:

1. **Volume:** cliques e impressões no GSC, sessões orgânicas no GA4, soma dos contadores
   no banco. Isso define a janela mínima de comparação da F4 (§4.1).
2. **Cobertura de indexação:** `batch_url_inspection` nas 17 URLs do sitemap e nos perfis
   públicos de mestre. Em cada uma: estado, canonical escolhido pelo Google e último crawl.
3. **Consultas:** top consultas e páginas, mais CTR por faixa de posição. A faixa de 4 a 15
   com CTR abaixo da curva é a candidata a ajuste de título e description.
4. **Entrada e funil (GA4):** páginas de entrada da origem orgânica, engajamento por tipo
   de página (home, catálogo, mesa, mestre) e funil
   `page_view(mesa) → select_mesa → contact_click`, este último só depois da F1.
5. **Divergência GA4 × banco** em views de mesa, para medir a perda de coleta.
6. **Estado da 102 F6:** relatórios *Soft 404*, *Not found* e canonical no painel. A API não
   expõe esses relatórios; quem lê é o mantenedor, ou o agente por browser sem sessão.

### 4.1 Janela de comparação

A regra só fixa depois do volume medido. Ponto de partida: 28 dias antes e 28 depois,
descontando 3 dias de atraso do GSC. Se o volume não sustentar, a mudança é registrada como
técnica, sem alegação de ganho.

---

## 5. F3 — Coleta reproduzível

`scripts/seo/coletar.mjs` lê um manifesto `scripts/seo/apps.json`:

```json
[{ "app": "mesas", "host": "https://mesas.artificiorpg.com/", "ga4Property": "<id numérico>" }]
```

O id numérico da property sai de `get_account_summaries` na F0. O measurement id `G-…` não
serve para a Data API. O script consulta GSC e GA4 com parâmetros fixos (período fechado,
dimensões e ordenação explícitas) e devolve JSON no stdout. O snapshot **não é
versionado**: o repositório guarda o instrumento, não o dado.

Para escalar, basta acrescentar uma linha no manifesto. Nada de `if (app === 'mesas')`.

**Dependência:** `google-auth-library`, para assinar com a service account. As chamadas vão
por `fetch` à REST, sem o `googleapis` inteiro. Pacote novo exige aprovação antes da
instalação.

---

## 6. F4 — Ciclo de melhoria

Cada task da F4 nasce com cinco campos fixos: **hipótese** (o que muda e por quê),
**métrica** (a do baseline), **valor de antes**, **janela** e **valor de depois**. Sem os
quatro primeiros, a task não começa. Sem o quinto, ela não fecha.

Candidatos medidos que já entram assim:

- **Perfis de mestre no sitemap** (§2.5 da spec): indexáveis, mas fora do sitemap. Métrica:
  perfis com estado "indexado" no `batch_url_inspection` e impressões em `/mestre/`.
- **Description e título por CTR:** só depois do item 3 da F2.
- **Página por sistema** (`/sistemas/<slug>`, fora de escopo na 102): entra só se a F2
  mostrar demanda medida, como consultas "mesa de <sistema> online" com impressão.

---

## 7. F5 — Fechar a F6 da 102

T6.1 (*Validate Fix*) e T6.2 (*Request Indexing* de até 10 URLs) continuam como ação manual
no painel. A F2 entrega a lista das URLs de maior valor, por impressão e não por palpite.
Depois de fechadas, as tasks da 102 são marcadas e apontam para esta spec.
