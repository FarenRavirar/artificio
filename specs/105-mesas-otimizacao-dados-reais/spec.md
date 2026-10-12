# Spec 105 — Otimização do `mesas` guiada por dados reais (Search Console + GA4 + banco)

**Status:** aberta · **Criada:** 2026-10-12 · **App:** `apps/mesas` (pacotes tocados: `packages/analytics`, `packages/catalog-table`)
**Continuação de:** spec 102 (`specs/102-seo-indexacao-recuperacao/`). A 102 corrigiu o
que o Google vê no `mesas` (soft-404, sitemap × SSR, HTML-first, schema). A F6 dela
— operação no Search Console — ficou aberta porque o agente não tinha acesso aos dados.
Esta spec dá esse acesso, em modo só leitura, e troca a hipótese por medição.

---

## 1. Problema

Até aqui, toda decisão de SEO do `mesas` partiu de `curl`, `psql` e documentação. Nenhuma
partiu do que o Google e o usuário fazem de fato: quais buscas trazem impressão, em que
posição, com que CTR, que página converte e onde a pessoa abandona.

Os dados já existem:

- **GA4** do `mesas` em property própria (`G-43T3C6K6V6`) desde a D117 (2026-07-20).
- **Search Console** com a propriedade de Domínio `artificiorpg.com` verificada, que cobre
  `mesas.` (informado pelo mantenedor em 2026-09-14, `102/mapa-deploys.md` §Search Console).
- **Banco** do `mesas` com contadores próprios de visualização, clique e contato.

Objetivo: o agente lê as três fontes, mede uma linha de base, e cada melhoria passa a ter
hipótese, métrica e janela de comparação antes de ir para o código.

A investigação desta spec achou um bloqueio antes da análise. **Parte da instrumentação
mede errado ou não mede nada** (§2.3 e §2.4). Analisar dado de conversão antes de corrigir
isso levaria a conclusão errada. Por isso a F1 (instrumentação) vem antes da F2 (baseline).

---

## 2. Evidência medida (2026-10-12)

### 2.1 Ferramentas de acesso — pesquisa adversarial

**GA4 — existe servidor MCP oficial do Google.** É o `googleanalytics/google-analytics-mcp`,
com o título "Google Analytics MCP Server (Experimental)" no README. As ferramentas são
`get_account_summaries`, `get_property_details`, `list_google_ads_links`, `run_report`,
`run_funnel_report`, `get_custom_dimensions_and_metrics` e `run_realtime_report`. A
credencial é ADC ou service account, com escopo `analytics.readonly`. O servidor roda com
`uvx analytics-mcp@0.7.0` (versão no PyPI em 2026-10-12) e é registrado por
`claude mcp add`. Ele não tem ferramenta de
escrita.

**Search Console — não existe servidor oficial.** Todas as fontes de 2026 consultadas
concordam: o Google publica MCP para GA4, BigQuery, Drive e Gmail, mas não para o Search
Console. A opção mais usada é `AminForou/mcp-gsc` (licença MIT, release 0.4.1 de
setembro de 2026, Python 3.11+). No PyPI, ela é publicada como `mcp-search-console`. O
pacote chamado `mcp-gsc` no PyPI é de outro autor (`aminfseo`, versão 0.1.0). Instalar pelo
nome do repositório pegaria o pacote errado. O README lista as ferramentas `list_properties`,
`get_search_analytics`, `compare_search_periods`, `get_search_by_page_query`,
`get_advanced_search_analytics`, `inspect_url_enhanced`, `batch_url_inspection`,
`check_indexing_issues`, `get_sitemaps` e `manage_sitemaps`, entre outras.

Riscos desse servidor, medidos no README:

- **Não tem modo só leitura.** `GSC_ALLOW_DESTRUCTIVE=false` (o default) bloqueia
  `add_site`, `delete_site` e `delete_sitemap`. O README **não diz** se o flag também
  bloqueia o envio de sitemap por `manage_sitemaps`. Então `manage_sitemaps` é tratado como
  ferramenta de escrita.
- O README pede acesso **Full** para a service account. Não medi se o nível *Restricted*
  basta para a Search Analytics API e a URL Inspection API.
- Servidor da comunidade não tem contrato de versão: um update pode mudar o nome ou o
  schema de uma ferramenta (Scalekit, *GSC MCP vs API*).

**Opções descartadas:**

- **MCP hospedado** (`mcpsearchconsole.com` e afins): o dado do Search Console passaria por
  servidor de terceiro. Descartado por privacidade, já que existe opção local.
- **BigQuery bulk export do Search Console:** o Search Console não cobra pela exportação,
  mas o BigQuery cobra pela consulta. A exportação também não tem backfill: o dado começa no
  dia da ativação. O limite que a exportação resolve (50 mil linhas por dia na API) não pesa
  num app com 17 URLs no sitemap (§2.5). Fica fora até a F2 provar volume que o justifique.
- **Indexing API para pedir indexação de mesa:** a doc diz *"The Indexing API can only be
  used to crawl pages with either JobPosting or BroadcastEvent embedded in a
  VideoObject."* Mesa não é nenhum dos dois. Usar a API fora desse escopo seria abuso.
  Request Indexing continua sendo ação manual no painel (102 T6.2).

### 2.2 Limites dos dados — o que a análise não pode prometer

- **Consultas anonimizadas:** o Search Console omite das linhas as consultas feitas por
  poucos usuários. A soma por consulta fica abaixo do total. Estudos da Ahrefs medem cerca
  de 46% dos cliques anonimizados (abril de 2025). Num site pequeno a proporção tende a ser
  maior (inferência a confirmar na F2).
- **Search Analytics API:** devolve até 25 mil linhas por requisição e 50 mil linhas por dia
  e tipo de busca. O Search Console guarda só as linhas do topo, não todas.
- **URL Inspection API:** cerca de 2 mil inspeções por propriedade por dia.
- **GA4 Data API:** 200 mil tokens por property por dia, 40 mil por hora e 14 mil por
  projeto, por property, por hora.
- **Volume:** o `mesas` tem 17 URLs no sitemap e 2.849 visualizações acumuladas de mesa
  (§2.4). Medido pela Search Console API em 2026-10-12: de 2026-09-10 a 2026-10-09, a home
  do `mesas` teve 3 cliques e 55 impressões (posição 2,2), e as mesas tiveram de 0 a 1
  clique cada. Um antes/depois em semanas não tem significância com esse volume. A F2 mede
  o volume antes de fixar a janela de comparação (`plan.md` §4.1).

### 2.3 Instrumentação GA4 do `mesas` — achados no código

**Achado I1 — `page_view` com parâmetro que o GA4 não documenta.**
`packages/analytics/src/events.ts:19-23` (`trackPageview`) envia
`{ page_path: safePath }`. A doc *Measure pageviews* do GA4 documenta `page_title` e
`page_location` e **não menciona `page_path`**. O comentário da função diz *"query string
descartada para evitar vazar PII"*. Essa garantia não está provada: o gtag coleta
`page_location` sozinho a partir da URL do documento. Hipótese a medir na F1: a query
string chega ao GA4 mesmo assim. O hook `useAnalyticsPageviews`
(`packages/analytics/src/react.ts`) é compartilhado por `mesas`, `glossario` e `downloads`.

**Achado I2 — risco de `page_view` duplicado.** `initGtag` usa `send_page_view: false`
(`gtag.ts:56`) e o hook envia o `page_view` manual. A doc do GA4 diz que
`send_page_view: false` **não desliga** o `page_view` por histórico do navegador quando a
*Enhanced Measurement* está ligada. Não medi o estado dessa opção no painel. Se estiver
ligada, cada navegação conta duas vezes, e taxa de engajamento, sessão e funil saem
distorcidos.

**Achado I3 — a conversão principal do produto não é evento GA4.** Os eventos GA4 do
`mesas` são `select_mesa` (`MesaPage.tsx:49`), `filter_sistema` (`CatalogoPage.tsx:404`)
e `editor_*` (`useTableEditor.ts`). O clique em "entrar em contato" com o mestre, que é o
objetivo do produto, não vira evento GA4. Ele vai só para o backend (§2.4). O funil
busca → mesa → contato não existe no GA4.

### 2.4 Métricas próprias (banco de produção, `mesas-db`, SELECT)

```
SELECT count(*), sum(views_count), sum(clicks_count), sum(contacts_count), max(updated_at)::date
  FROM table_metrics;
-- 206 | 2849 | 1176 | 1 | 2026-10-12
```

**Achado M1 — `contacts_count` está morto.** Só uma rota incrementa o contador:
`POST /api/v1/gm/tables/:id/contact` (`gmPanel.ts:1830`). Nenhum código do frontend chama
essa rota. Em `apps/mesas/frontend/src`, as chamadas de métrica são
`/api/v1/tables/${slug}/view|click|favorite`. Os consumidores do contador são
`gm.ts:582` (insights do mestre), `gmPanel.ts:1428` e `:1932` (painel) e `tables.ts:507`
(ranking, `contacts_count * 2`). O resultado: o mestre vê "contatos: 0" e o peso de
contato no ranking nunca atua. O defeito não gera erro em lugar nenhum.

**Achado M2 — não existe série temporal própria.**

```
SELECT action, count(*), min(created_at)::date, max(created_at)::date
  FROM table_metric_events GROUP BY 1;
-- click|1|2026-04-07|2026-04-07   contact|1|…   favorite|1|…   view|1|…
```

A tabela de eventos tem uma linha por ação, todas de 2026-04-07. As rotas públicas gravam
só no contador acumulado de `table_metrics`, e um contador acumulado não mostra tendência.
Hoje, a única série temporal de engajamento é o GA4.

**Achado M3 — clique em contato do mestre só vai para o log.**
`POST /api/v1/gm/perfis/:slug/contact-click` (`gm.ts:677-720`) faz `console.log` e deixa
um TODO (`gm_contact_clicks`). Nada é persistido.

**Achado M4 — o formulário de contato do mestre perde a mensagem e diz que enviou.**
`POST /api/v1/gm/perfis/:slug/contact` (`gm.ts:605-674`) valida o formulário e responde
*"Mensagem enviada com sucesso! O mestre receberá seu contato em breve."*, mas não envia
nada (`// TODO: Implementar envio de email`, `gm.ts:652`). O formulário aparece em
`MestrePage.tsx:184` quando o mestre cadastra o canal `form`. Medido em produção:
**2 perfis** têm esse canal. É o achado mais grave da spec. O jogador acha que o contato
foi feito, o mestre nunca recebe, e nenhuma métrica registra a perda.

### 2.5 Superfície indexável hoje (HTTP, com cache-bust)

- `sitemap.xml` tem **17 URLs**: a home e 16 mesas. O banco tem 16 mesas `manual` e 23
  `imported` ativas. A diferença bate com o filtro de expiração da 102 T1.4 (inferência:
  não rodei o predicado nesta rodada).
- **Perfil de mestre fica fora do sitemap.** São 61 linhas em `gm_profiles`.
  `/mestre/filipe` com UA do Googlebot devolve `canonical` auto-referente e nenhum
  `meta robots`, ou seja, é indexável. `routes/sitemap.ts` não gera URL de `/mestre/`.
  Não medi quantos dos 61 perfis são públicos.
- Slug inexistente devolve `404`, e a home para `GPTBot/1.1` devolve 391.975 B. Os
  critérios C1 e F1 da 102 seguem verdes.

### 2.6 Configuração do GA4 — o painel diverge do registrado (medido em 2026-10-12)

Medição no painel do GA4 (conta `artificiorpg@gmail.com`) e em produção (Chrome e
`curl`). O detalhe e as evidências de cada item estão em `tasks.md` T0.1 e T1.0.

**Achado G1 — o GA4 não coleta em `mesas`, `glossario` e `downloads`.** Esse defeito
precede todos os outros desta spec. `initGtag` (`packages/analytics/src/gtag.ts:47-49`)
empurra Array para o `dataLayer`, e o gtag.js só processa o objeto `arguments`. O
resultado é zero `/g/collect`. Contraprova na mesma página: `config` como `arguments`
disparou 1 `/collect`. O painel confirma: o stream Mesas mostra *"A coleta de dados não
está ativa no seu site"*, e o Glossario mostra "Nenhum dado foi recebido nas últimas 48
horas". O `site` usa o snippet oficial (`gtagInlineConfig`) e coleta. A Data API confirma
no período inteiro: em 28 dias, `hostName` só tem `artificiorpg.com` (2.246 usuários) e
`beta.artificiorpg.com` (1). Não medi desde quando a coleta parou; a estimativa é desde que
esses apps passaram a usar `initGtag`, e o histórico do `git` mede isso na F2. Todo número de
GA4 desses três apps desde então está zerado, e não pode servir de baseline. Corrigido local
em 2026-10-12 (`tasks.md` T1.0); vale só depois do deploy.

**Coerência com a spec 102.** A 102 T4.4 classificou o contato da mesa como candidatura, e
não reserva (108 dos 188 contatos são formulário). Daí o JSON-LD ser só `Product`+`Offer`,
sem `Event`. Esta spec não toca o JSON-LD. O `contact_click` mede "contato iniciado", que é
compatível com candidatura. O guard G-F da 102 segue verde (`tasks.md` T1.3).

**Achado G2 — a D117 não descreve o que existe.** A D117 (`decisions.md`) registra "1
property por app". O painel mostra outra coisa:

- Conta "Toca do Coruja RPG Total" (`a237327410`) → **uma** property, "Artifício RPG"
  (`p475307720`), com três streams: `Artificio RPG` (`artificiorpg.com`, recebendo
  tráfego), `Mesas` (`G-43T3C6K6V6`, sem dado) e `Glossario` (sem dado).
- Conta "Artifício RPG" (`a343417141`) → property legada `p475470428`, com streams `www`,
  `Artificio 2` e `glossariorpg`, todos sem dado nas últimas 48 h. A queda de 99,9% em
  usuários ativos que aparece nela é a aposentadoria esperada, não perda de tráfego.
- `downloads` usa `G-2H50PCM950`, o mesmo measurement id do `site` ("provisório",
  conforme a D117). Os dados de `downloads` caem no stream do `site`, misturados.

Consequência para o desenho: streams na mesma property compartilham relatórios. Separar por
app exige filtro por `hostName` em toda consulta da F2 e da F3. O manifesto da F3 passa a
ser `{ app, host, ga4Property, stream }`, com o host como filtro obrigatório.

**Achado G3 — Enhanced Measurement ligado no stream do `mesas`** ("Métrica otimizada"). Isso
torna o risco I2 (`page_view` duplicado pela mudança de histórico) real assim que a G1 for
corrigida. I2 só se mede depois da G1.

**Achado G4 — a propriedade de Domínio do Search Console é da conta
`artificiorpg@gmail.com`** (proprietária), com `paulohenriquercc@gmail.com` como usuário
Total. A spec 102 tinha a informação de propriedade sem dizer de qual conta. Fica medido
aqui para não repetir o erro de conta (`tasks.md` T0.1).

---

## 3. Escopo

### Em escopo

1. **F0 — Acesso só leitura.** GA4 MCP oficial e `mcp-search-console` no Claude Code, com a
   credencial fora do repositório e as ferramentas de escrita bloqueadas.
2. **F1 — Instrumentação correta.** Primeiro G1, porque sem coleta não há dado. Depois
   I1, I2, I3, M1 e M3, e resolver M4. É pré-requisito para confiar no dado.
2b. **F1b — Saneamento da configuração de analytics e SEO** (pedido do mantenedor em
   2026-10-12: *"tem muita coisa bagunçada no analytics e seo"*). Cada divergência entre o
   painel do GA4, o painel do Search Console, o código e a documentação vira task com
   medição: G2 (D117 × painel, `downloads` no stream do `site`, property legada), G3 e as que
   a auditoria de painel da F2 achar. A correção de doc de decisão (`decisions.md`) só
   acontece com ordem do mantenedor. Até lá, a divergência fica registrada aqui.
3. **F2 — Baseline.** Medir GSC, GA4 e banco do `mesas`, com volume, cobertura de
   indexação, consultas, páginas de entrada e funil.
4. **F3 — Coleta reproduzível.** Um script determinístico que roda a mesma consulta em
   qualquer data e para qualquer app (manifesto por app). O MCP serve para explorar; o
   script serve para comparar.
5. **F4 — Melhorias por hipótese.** Cada mudança tem hipótese, métrica, baseline e janela.
   Os candidatos de §2.5 e os que a F2 levantar entram aqui.
6. **F5 — Fechar a F6 da 102.** *Validate Fix* e *Request Indexing* (ação manual no
   painel), agora com o dado à vista.

### Fora de escopo

- **Indexing API:** fora do escopo da própria API (§2.1).
- **BigQuery:** até a F2 provar volume que o justifique (§2.1).
- **MCP hospedado de terceiro** (§2.1).
- **Outros apps (`site`, `glossario`, `downloads`).** O desenho da F3 é multi-app, mas a
  análise e as mudanças desta spec são do `mesas`. Uma exceção: o defeito I1/I2 em
  `packages/analytics` atinge os três consumidores e se corrige na raiz (regra
  "compartilhado por padrão").
- **Regra de expiração de mesa importada**, mantida como na 102.

### Inferência a confirmar

- **Ordem F1 → F2.** Proposta porque um baseline com `page_view` possivelmente duplicado e
  zero evento de contato mediria o instrumento, não o produto. As partes da F2 que não
  dependem do GA4 (GSC e cobertura de indexação) podem rodar em paralelo com a F1.

---

## 4. Critérios de aceite

Todos se verificam por comando ou consulta. Nenhum fecha com dry-run ou documentação.

| # | Critério | Como medir |
|---|---|---|
| G1 | GA4 coleta em `mesas`, `glossario` e `downloads` | no Chrome, em produção, pelo menos um `/g/collect` depois do load em cada app; o item do `dataLayer` é `[object Arguments]`; o teste do pacote falha com Array; o painel não mostra mais "coleta não está ativa" |
| G2 | Configuração GA4 descrita como existe | cada app com stream próprio (inclusive `downloads`), e o registro de decisão atualizado com ordem do mantenedor |
| K1 | Agente lê GA4 do `mesas` | `run_report` na property `p475307720` devolve linhas. Para o `mesas`, filtro `hostName = mesas.artificiorpg.com`. Antes da G1, o esperado são zero linhas desse host |
| K2 | Agente lê GSC do `mesas` | `get_search_analytics` em `sc-domain:artificiorpg.com` com filtro `page` contendo `https://mesas.artificiorpg.com/` devolve linhas |
| K3 | Escrita bloqueada | config sem `GSC_ALLOW_DESTRUCTIVE`; nenhuma chamada a `manage_sitemaps` na sessão sem autorização nominal; credencial fora do repo (`git ls-files` não lista o JSON) |
| I1 | `page_view` sem query string e sem parâmetro fora da doc | `run_report` com a dimensão `pagePathPlusQueryString` não mostra `?` nas rotas do `mesas` depois do deploy; código envia `page_location`/`page_title` |
| I2 | Sem `page_view` duplicado | em navegação SPA de N rotas, o DebugView e o realtime mostram N `page_view`, não 2N |
| I3 | Contato é evento GA4 | `run_report` com `eventName = contact_click` devolve contagem > 0 após o deploy; parâmetros sem PII |
| M1 | `contacts_count` cresce com uso real | `SELECT sum(contacts_count) FROM table_metrics` aumenta depois do deploy (hoje: 1) |
| M3 | Clique em contato do mestre persistido | linha nova na tabela escolhida para cada clique, sem PII |
| M4 | Formulário não mente | a mensagem chega ao mestre, ou o canal `form` deixa de ser oferecido (decisão de produto, T1.6) |
| B1 | Baseline registrado | bloco da F2 em `tasks.md` com números, período e consulta usada |
| S1 | Coleta reproduzível | o script roda duas vezes para o mesmo período fechado e devolve saída idêntica |
| H1 | Toda mudança da F4 tem antes/depois | cada task da F4 cita a métrica do baseline e a medição pós-janela |

---

## 5. Riscos

- **Servidor GSC da comunidade com credencial do Google.** Mitigação: só a versão
  publicada no PyPI, com versão fixa; service account dedicada só ao Search Console; nível
  *Restricted*, se bastar (T0.2 mede); flag destrutivo nunca ligado.
- **Concluir sobre amostra pequena.** Mitigação: K3 da F2 fixa a janela pelo volume medido.
  Mudança sem volume suficiente vira melhoria técnica, sem alegação de ganho.
- **Mudança em `packages/analytics` atinge 3 apps.** Mitigação: teste do hook (hoje é TODO,
  `analytics.test.ts:210`) e conferência em produção dos três consumidores.
- **GA4 em experimento.** O README marca o MCP como *Experimental*: ferramenta e schema
  podem mudar. A F3 (script) não depende dele.

---

## 6. Fontes

- [googleanalytics/google-analytics-mcp](https://github.com/googleanalytics/google-analytics-mcp)
- [AminForou/mcp-gsc](https://github.com/AminForou/mcp-gsc)
- [GSC MCP: No Official Server Exists — usecarly](https://www.usecarly.com/blog/google-search-console-mcp/)
- [Google Search Console MCP vs API — Scalekit](https://www.scalekit.com/blog/google-search-console-mcp-vs-api)
- [Measure pageviews — GA4](https://developers.google.com/analytics/devguides/collection/ga4/views)
- [Performance data filtering and limits — Google Search Central](https://developers.google.com/search/blog/2022/10/performance-data-deep-dive)
- [Bulk data export — Google Search Central](https://developers.google.com/search/blog/2023/02/bulk-data-export)
- [BigQuery efficiency tips — Google Search Central](https://developers.google.com/search/blog/2023/06/bigquery-efficiency-tips)
- [GA4 Data API quotas](https://developers.google.com/analytics/devguides/reporting/data/v1/quotas)
- [Indexing API quickstart](https://developers.google.com/search/apis/indexing-api/v3/quickstart)
- [Search Console 50k rows/day — Fivetran](https://fivetran.com/docs/connectors/applications/google-search-console/troubleshooting/kb-search-console-rows-per-day-limit)
- [Anonymized queries — Search Engine Roundtable](https://www.seroundtable.com/google-search-console-anonymizes-tons-of-queries-33735.html)
