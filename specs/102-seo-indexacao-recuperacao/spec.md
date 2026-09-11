# Spec 102 — Recuperação de indexação e ranking (`site` + `mesas`)

**Status:** aberta · **Criada:** 2026-09-10 · **Apps:** `apps/site`, `apps/mesas`
**Origem:** queda de posicionamento observada pelo mantenedor no Search Console —
736 páginas em "Rastreada, mas não indexada", detectada pela primeira vez em
02/08/2025, com exemplos em `mesas.artificiorpg.com` e `artificiorpg.com/blog/`.

---

## 1. Problema

Páginas que rankeavam no WordPress pararam de rankear no stack novo **com o mesmo
conteúdo**. O sintoma reportado pelo Search Console é "Rastreada, mas não
indexada": o Google chega na página, lê, e decide não indexar.

O relato do mantenedor que orienta esta spec:

> `https://artificiorpg.com/blog/chris-perkins-aposentadoria-dnd/` tinha alto valor
> e visitas antes de eu sair do WordPress, mesmo o conteúdo sendo o mesmo, e agora
> no site não tem.

Isso descarta hipótese de qualidade de conteúdo e aponta para perda na migração.
A investigação confirmou: **não é falta de boas práticas de SEO** — o on-page do
blog está bem construído. São três defeitos técnicos concretos, medidos abaixo,
sendo dois deles introduzidos na migração e um na arquitetura de crawler do `mesas`.

---

## 2. Evidência medida

Toda afirmação desta seção cita o comando que a sustenta (§Regras Pétreas →
Evidência). Medições de 2026-09-10, contra produção.

### 2.1 Achado A — `site`: canonical aponta para URL 404 (105 de 126 posts)

O importador do WordPress gravou a coluna `posts.canonical` com a **URL antiga do
WP**. `apps/site/db/export.ts:66` lê essa coluna, `apps/site/src/pages/blog/[slug].astro:21`
a usa com precedência (`post.seo.canonical || fallback`), e ela é emitida como
autoridade de indexação no HTML de produção.

Medido por HTTP, na página que o mantenedor citou:

```
URL servida:  https://artificiorpg.com/blog/chris-perkins-aposentadoria-dnd/   → HTTP 200
canonical:    https://artificiorpg.com/noticias/chris-perkins-aposentadoria-dnd/ → HTTP 404
og:url:       https://artificiorpg.com/noticias/chris-perkins-aposentadoria-dnd/
```

Medido no banco de produção (`site-prod-db`, `psql -U admin -d site`, SELECT):

```sql
SELECT count(*) total, count(canonical) preenchido,
       count(*) FILTER (WHERE canonical LIKE '%/noticias/%') noticias FROM posts;
-- 126|125|64

SELECT count(*) FROM posts
 WHERE canonical IS NOT NULL
   AND regexp_replace(canonical,'^https?://[^/]+','') <> '/blog/'||slug||'/';
-- 105
```

Distribuição dos prefixos legados:

| Prefixo do canonical | Posts | Existe hoje? |
|---|---:|---|
| `/noticias/…` | 64 | 404 |
| `/blog/<categoria>/…` | 38 | 404 (o site serve `/blog/<slug>/`, sem categoria no path) |
| `/dnd/…` | 18 | 404 |
| `/downloads/…` | 3 | 404 |
| `/entrevistas/…` | 2 | 404 |
| `/blog/<slug>/` (forma **correta**) | 20 | 200 — não precisa de redirect |
| **Total com canonical** | **125** | de 126 posts |

**Aritmética, corrigida em 2026-09-11 (achado de auditoria).** A versão anterior
rotulava a soma `64+38+18+3+2 = 125` como "total divergente 105", o que não fechava.
A tabela conta **todos** os canonicals, e 20 deles já estão na forma correta. Medido:

```
total_canonical | 125     divergentes | 105     corretos | 20
```

**105 continua correto** e é o que alimenta A1/D1/T2.3: 125 − 20 = 105. O erro era só
o rótulo da linha de total.

**Nota sobre o achado de auditoria.** Ele apontou que `/blog/<categoria>/` seria 18, e
não 38. Medido na fonte, a tabela da spec está certa: `/blog/` = **38** e `/dnd/` =
**18** — o 18 é outro prefixo. Query que resolve:

```sql
SELECT substring(canonical from 'https?://[^/]+(/[^/]+/)'), COUNT(*)
FROM posts WHERE canonical IS NOT NULL GROUP BY 1 ORDER BY 2 DESC;
-- /noticias/ 64 | /blog/ 38 | /dnd/ 18 | /downloads/ 3 | /entrevistas/ 2
```

Verificação independente por HTTP (varredura dos 126 posts do sitemap, comparando
`<link rel=canonical>` com a URL servida) devolveu **exatamente 105 mismatches** —
o mesmo número que o banco, por caminho diferente.

**Não existe redirect de `/noticias/`, `/dnd/`, `/downloads/`, `/entrevistas/`.**
Medido: `curl -sI https://artificiorpg.com/noticias/chris-perkins-aposentadoria-dnd/`
→ `HTTP/1.1 404 Not Found`. Busca por arquivo de redirect: `apps/site/public/`
contém apenas `og-default.png`; `rtk rg "noticias" apps/site/src apps/site/server`
não encontra regra de rota.

**Calibragem da severidade (pesquisa, não treinamento).** Correção de 2026-09-11:
esta passagem citava a doc *Fix Canonicalization Issues* para afirmar que canonical
apontando para 404 "não é bloqueio duro". **A fonte não diz isso** — ela não trata do
caso em que o canonical declarado é inalcançável; a retratação está em §2.3 e vale
igualmente aqui. A calibragem se sustenta por outra via, essa sim na fonte: a doc do
Google descreve `rel=canonical` como **sinal** que o buscador pode sobrepor
(*"Google might choose a different canonical"*) — sinal ponderado, não diretiva. O
Achado A sozinho, portanto, **não explica integralmente** a queda — ele
descarta o sinal mais forte que a página tem para consolidar autoridade e joga a
decisão para heurística, mas não é um `noindex`. A perda real de autoridade do
WordPress vem principalmente da **ausência dos 301** (seção 2.4), não do canonical
em si. Esta distinção é deliberada: afirmar "canonical 404 = não indexado" seria
afirmação não medida, e levaria a priorizar errado.

### 2.2 Achado B — `mesas`: soft-404 em 55% das URLs do sitemap

O `mesas` **tem** SSR para crawler e ele funciona: `apps/mesas/frontend/nginx.conf:5-17`
define `map $http_user_agent $is_crawler` incluindo `~*Googlebot 1`, e as linhas
128-145 delegam para `@og_proxy` → backend `/og/*`. A rota existe em
`apps/mesas/backend/src/routes/og.ts`.

O defeito é outro, e mais grave: **o sitemap anuncia URLs que o SSR responde como
inexistentes, com HTTP 200**.

Divergência de critério, medida no código:

| Componente | Critério de visibilidade | Arquivo |
|---|---|---|
| Sitemap | `status='active' AND archived_at IS NULL` | `routes/sitemap.ts:10` |
| SSR de crawler | `status='active' AND !archived_at AND !isImportedTableExpired(table)` | `routes/og.ts:226-230` |

O SSR aplica **um terceiro filtro que o sitemap não aplica**:
`isImportedTableExpired` (`utils/tableVisibility.ts:29-44`) — mesa com
`origin='imported'` expira em `starts_at`, ou 5 dias após `created_at`.

Medido no banco de produção (`mesas-db`, `psql -U admin -d mesas_rpg`, SELECT):

```sql
SELECT origin, count(*) FROM tables
 WHERE status='active' AND archived_at IS NULL GROUP BY 1;
-- imported|57   manual|35        (= 92 URLs, bate com o sitemap: 92 + home)

SELECT count(*) FILTER (WHERE now() >= COALESCE(starts_at, created_at + interval '5 days')) expiradas,
       count(*) importadas_ativas
  FROM tables WHERE status='active' AND archived_at IS NULL AND origin='imported';
-- 51|57
```

**51 de 92 URLs do sitemap (55%) estão expiradas** pelo critério do SSR.

Confirmado por HTTP, com UA do Googlebot, em 6 mesas sorteadas do próprio sitemap:

```
Mesa não encontrada — Artifício Mesas  <=  o-reinado-da-rainha-dragao-mtk6844i
Convergência — Mesa de RPG | Artifício Mesas  <=  convergencia-mt57ogin
Mesa não encontrada — Artifício Mesas  <=  call-of-cthulhu---estilo-west-marches-mt7mfo2t
Mesa não encontrada — Artifício Mesas  <=  dragonlance-shadow-of-the-dragon-queen-mtd2t3fl
Mesa não encontrada — Artifício Mesas  <=  the-twilight-war-mstodezi
Mesa não encontrada — Artifício Mesas  <=  kingmaker-msxwycmp
```

5 de 6 devolvem "Mesa não encontrada". **Todas com HTTP 200.**

**Varredura completa (2026-09-11), não mais amostra.** As 92 URLs de mesa do sitemap,
com UA de Googlebot:

```
OK=38   "Mesa não encontrada"=51   título vazio=3 (timeout do curl)   TOTAL=92
```

Os 51 batem exatamente com as 51 importadas expiradas no banco — causa confirmada por
medição, não inferida.

**CORRIGIDO em código (2026-09-11), pendente de deploy.** `routes/sitemap.ts` passou a
aplicar `importedTableIsCurrentSql('tables')`, a mesma fonte única que o SSR usa.
Sitemap: **92 → 41 URLs**. Validado: `rtk tsc -b` limpo, 37/37 testes de visibilidade,
`SELECT` com o predicado → 41. Detalhe em `tasks.md` T1.4.

### 2.3 Achado C — `mesas`: soft-404 com status 200 e canonical auto-referente

`routes/og.ts:232-238`: quando a mesa não é visível, o backend responde
`res.status(200)` com título "Mesa não encontrada" e canonical apontando para a
própria URL inexistente. Medido com URL inventada:

```
https://mesas.artificiorpg.com/mesas/isto-nao-existe-jamais-zzz999
→ http=200
→ <title>Mesa não encontrada — Artifício Mesas</title>
→ <link rel="canonical" href="https://mesas.artificiorpg.com/mesas/isto-nao-existe-jamais-zzz999">
```

Qualquer URL sob `/mesas/` devolve 200. Isto é a definição literal de soft-404 na
documentação do Google: página que diz ao usuário que não existe enquanto retorna 200.

**Este é o achado mais severo da spec, e a pesquisa sustenta a priorização.**
Soft-404 é classificado como **"Not indexed"** — exclusão de indexação, não sinal a
ponderar. **Correção de âncora (2026-09-11):** a fonte antes citada aqui era a doc de
soft-404, que redirecionou e **não contém** a string "Not indexed"; a classificação
vive no relatório **Page indexing** do Search Console, que lista "Soft 404" entre os
motivos sob *Why pages aren't indexed*. A afirmação se mantém — a referência é que
estava no lugar errado. O aviso de que URLs assim
"waste your budget" vem de **outra página**, a de crawl budget (a de soft-404/status
codes não contém a frase; conferido 2026-09-11). Um estudo de caso do Search Engine
Land documenta correlação
entre acúmulo de soft-404 e queda de crawl de 60–70k/dia para 20–30k/dia. Soft-404
se acumula em silêncio: não gera alerta como 404 real, degrada o rastreamento até a
queda de tráfego aparecer.

**Correção de 2026-09-11 (achado de auditoria).** A versão anterior afirmava que o
canonical apontando para 404 "não é bloqueio duro, o Google continua indexando",
citando a página *Fix Canonicalization Issues*. **Essa página não contém tal
afirmação** — verificado na fonte: ela não diz o que o Google faz quando o canonical
declarado é inalcançável ou 404. A fonte foi retirada desta comparação.

A distinção de severidade **continua válida, por outra via**: soft-404 tem status
documentado de exclusão ("Not indexed"), enquanto `rel=canonical` é descrito pela
própria doc como **sinal** que o Google pode sobrepor ("Google might choose a
different canonical"). Diferença de categoria — exclusão vs. sinal ponderado —, não
de intensidade.

**Correção de 2026-09-11 (achado de auditoria): crawl budget é por hostname.** A
versão anterior dizia que "o crawl budget é do domínio" e que o soft-404 do `mesas`
"plausivelmente prejudica o blog na raiz". A documentação do Google define crawl
budget **por hostname**: `mesas.artificiorpg.com` e `artificiorpg.com` têm budgets
separados. O argumento "prejudica o blog também" **cai** e foi removido.

A prioridade de F1 **não depende dele** e permanece, por severidade própria e medida:
51 de 92 URLs do sitemap do `mesas` (55%) devolvem "Mesa não encontrada" com HTTP
200 — o app gasta o próprio budget em página que o Google classifica como não
indexável.

### 2.4 Achado D — autoridade do WordPress não migrada

Consequência dos prefixos legados sem 301. As URLs antigas (`/noticias/…`,
`/dnd/…`, `/entrevistas/…`, `/downloads/…`) acumularam backlinks e histórico no
WordPress e hoje devolvem 404, sem rota para o destino novo.

A documentação do Google sobre migrações é direta: 301/308 server-side, 1:1, para a
URL específica (nunca blanket para a home), sem cadeias, mantidos por **pelo menos
um ano**. E registra que "301 e outros redirects permanentes **não** causam perda de
PageRank" — ou seja, a autoridade é recuperável, mas só através do redirect que hoje
não existe.

Este é o achado que melhor explica o relato do mantenedor sobre a página do Chris
Perkins: o conteúdo migrou, os sinais de autoridade não.

#### 2.4.1 Confirmação no Search Console (2026-09-11)

Verificado no Chrome do mantenedor, com autorização nominal, na propriedade
`https://artificiorpg.com/` (relatório de indexação, dados de 03/09/2026).
**2,11 mil páginas não indexadas contra 92 indexadas.** Motivos:

| Motivo | Páginas | Relação com esta spec |
|---|---:|---|
| Não encontrado (404) | **994** | Achado D — prefixos legados sem 301 |
| Rastreada, mas não indexada | **723** | o sintoma que originou a spec (§1) |
| Página alternativa com tag canônica adequada | **235** | Achado A — canonical divergente |
| Detectada, mas não indexada | 122 | fila de rastreio |
| Página com redirecionamento | 22 | — |
| Excluída pela tag "noindex" | 17 | — |
| Erro no servidor (5xx) | **1** | não investigado — ver §3 Fora de escopo |

O grupo dos 404 traz **"Detectada pela primeira vez: 01/02/2025"**, que é a data do
cutover do WordPress. O número da spec para "Rastreada, mas não indexada" era 736;
hoje são 723 — variação normal de recontagem, não invalida o diagnóstico.

#### 2.4.2 Por que 994 URLs em 404, se só há 105 posts com canonical divergente

A diferença **não** significa que faltem redirects além dos 105. As URLs do WordPress
carregavam a categoria na rota, e cada post era alcançável por várias delas. Medido em
produção:

```sql
-- profundidade das URLs legadas
SELECT avg(array_length(string_to_array(trim(both '/' from
         regexp_replace(canonical,'^https?://[^/]+','')),'/'),1)),
       max(...) FROM posts WHERE canonical IS NOT NULL;
-- → média 2,42 segmentos, máximo 5

SELECT count(DISTINCT substring(regexp_replace(canonical,'^https?://[^/]+','')
         from '^(/([^/]+/){1,3})')) FROM posts WHERE canonical IS NOT NULL;
-- → 122 pastas de categoria distintas
```

Exemplo real do banco: `/blog/guias/rpg-em-geral/o-que-e-rpg/guia-definitivo-…/`
— quatro segmentos de categoria para um post. Somam-se ainda as rotas de arquivo do
WP (`/category/`, `/tag/`, `/author/`, `/feed/`, paginação), todas medidas hoje como
404. **122 pastas × páginas de arquivo + 105 posts** é a ordem de grandeza dos 994.

Amostra de 10 URLs de exemplo do GSC revelou também prefixos **ausentes de qualquer
`canonical`**: `/magia/` (4 de 10), `/doc/` e `/dd/`. Medido: `/magia/` como raiz
devolve 404 e apenas **1** post no banco casa com `%magia%` — era uma seção inteira do
WP (catálogo de magias) que **não foi migrada**. Não é URL errada; é conteúdo ausente.

**Consequência para o escopo da F2:** os 105 pares 1:1 continuam sendo a entrega
correta e completa. O restante — arquivos de categoria/tag e seções não migradas —
permanece em 404 **por recomendação oficial**, não por omissão:

- *"All `4xx` errors, except `429`, are treated the same"* e *"The `4xx` status
  codes, except `429`, have no effect on crawl rate."* (HTTP status codes and Google
  Search). 404 não penaliza ranking nem consome orçamento de rastreio.
- Redirecionar URL sem equivalente para a home ou para página pouco relacionada é
  reclassificado pelo Google como **soft-404** — o mesmo defeito que a F1 corrige no
  `mesas`. Seria trocar um problema por outro.

**Limite da medição.** O relatório do GSC exporta no máximo 1.000 linhas por tipo, e a
paginação da UI não respondeu ao seletor de linhas nesta sessão. A classificação
completa das 994 exigiria a exportação CSV ou a URL Inspection API (2.000 URLs/dia por
propriedade). **Não foi feita** — a decisão de escopo acima não depende dela, mas a
proporção exata entre arquivos de categoria e posts permanece estimada, não medida.

#### 2.4.3 A propriedade `mesas.artificiorpg.com` não existe no Search Console

Informado pelo mantenedor e confirmado na sessão: a única propriedade é
`https://artificiorpg.com/` (prefixo de URL). **Todo o Achado B e o Achado C são
invisíveis ao Search Console hoje** — os 47 soft-404 do `mesas` foram medidos por
`curl` direto, nunca apareceram em relatório do Google.

Consequências, que não são opcionais para a F6:
- Não existe linha de base para o `mesas` antes do deploy da F1.
- **T6.1 (Validate Fix) não consegue validar a F1**, porque o relatório que ela usaria
  não cobre o subdomínio.
- O mesmo vale para `glossario.`, `downloads.` e todo subdomínio futuro.

Adicionar a propriedade exige verificação de domínio no DNS — **ação do mantenedor**,
não do agente. O formato indicado é propriedade de **Domínio** (`artificiorpg.com`),
que cobre todos os subdomínios de uma vez, em vez de uma propriedade de prefixo por
subdomínio. Deveria preceder o deploy da F1, para existir comparação depois.

### 2.5 Achado E — `mesas`: arquitetura invisível a crawler de IA e schema ausente

Medido por comparação com o concorrente direto **MesaQuest** (2026-09-10). Este
achado não estava na investigação original; entrou por pergunta do mantenedor sobre
como os concorrentes indexam mesas.

**StartPlay não é referência.** Medido: `startplay.com.br` redireciona para
`www.startplay.com.br` (WordPress + Yoast), e o sitemap tem **2 URLs**
(`page-sitemap: 2`, `post-sitemap: 0`). Não expõe mesas por URL própria — o app real
fica atrás de login. Não indexa mesas; não serve de parâmetro.

**MesaQuest é a referência real.** Comparação medida, mesma data:

| | MesaQuest | Artifício Mesas |
|---|---:|---:|
| Mesas no sitemap | **640** | 92 (51 quebradas) |
| HTML ao Googlebot | 136.520 B | 3.745 B |
| `<h1>` | 1 | **0** |
| Blocos JSON-LD | 2 | **0** |
| `canonical` (fluxo normal) | presente | **ausente** |
| `description` | por mesa (sistema, modalidade, preço, vagas) | genérica do site |

#### 2.5.1 Schema estruturado ausente

Cada mesa do MesaQuest emite, medido por
`grep -oE '"@type" *: *"[^"]+"'`:

```
3× Person · 3× ListItem · 2× Offer · 1× VirtualLocation
1× Product · 1× Organization · 1× Event · 1× BreadcrumbList · 1× Brand
```

O que o MesaQuest emite acima é a modelagem **deles**, e não a que cabe a nós. Nossa
entrega é `Product` + `Offer`, **sem `Event`** — decisão do mantenedor em 2026-09-11
(`tasks.md` T4.4, `plan.md` §5.2). Raciocínio completo vive em T4.4; aqui fica só o
veredito, para não recriar divergência documental.

Resumo: o `Event` não é elegível (mesas passam por seleção do mestre — 108 contatos
são Google Forms, candidatura e não reserva — e *"Virtual experiences that have no
real-world component aren't supported"* contra `online | 168`), e o benefício que
justificaria emiti-lo assim mesmo **foi refutado por medição**: no experimento
SearchVIU (30/10/2025), dado presente só em JSON-LD foi lido por **0 de 5** sistemas
de IA. A ação manual não derruba ranking, mas retira elegibilidade a rich result
(`sd-policies`) — ou seja, ameaçaria justamente o `Product`+`Offer`, que funciona.

O fato medido que continua valendo, e é o que importa aqui: nós emitimos **zero**
JSON-LD em mesa (`grep -c 'ld+json'` → 0), enquanto eles emitem 13 itens.

A `description` deles é gerada por mesa e carrega o que a pessoa busca:

> `…sinopse… | Dungeons & Dragons 5e (2014) • Online • Todos os níveis • R$ 50,00/mês • 6 vagas disponíveis`

A nossa é a mesma frase institucional em toda URL do app.

#### 2.5.2 Invisibilidade a crawler de IA (achado mais severo desta seção)

O SSR do `mesas` dispara por **user-agent** (`nginx.conf:5-17`), e a lista cobre
buscadores e redes sociais — **não cobre crawler de IA**. Medido na mesma URL
(`/mesas/convergencia-mt57ogin`, mesa válida e ativa):

| User-agent | Bytes recebidos | Título |
|---|---:|---|
| Googlebot | 4.128 | `Convergência — Mesa de RPG \| Artifício…` |
| **GPTBot** | **3.328** | `Artifício Mesas — Encontre sua próxima…` |
| **ClaudeBot** | **3.328** | `Artifício Mesas — Encontre sua próxima…` |
| **PerplexityBot** | **3.328** | `Artifício Mesas — Encontre sua próxima…` |

3.328 bytes é a casca do SPA: sem conteúdo, sem `h1`, sem schema. **Toda mesa do
Artifício é invisível para busca generativa.**

MesaQuest, mesma medição: **137.974 bytes para GPTBot, ClaudeBot e PerplexityBot** —
idêntico ao que serve ao usuário.

A pesquisa sustenta que isto não é detalhe: estudo da Vercel e experimento de
log-file do Search Engine Land mostram que GPTBot, ClaudeBot e PerplexityBot
**buscam JavaScript mas não executam**. No experimento controlado, GPTBot varreu 759
páginas ligadas por HTML e **parou na fronteira do JS**, sem alcançar uma única
página injetada por JavaScript. Schema entregue via JS é inútil para eles: "never
rely on JavaScript to deliver information you want AI systems to understand".

O `robots.txt` do `mesas` é `User-agent: * / Allow: /` — permite, mas não adianta
permitir acesso a conteúdo que não existe no HTML. O MesaQuest nomeia explicitamente
`GPTBot`, `Claude-Web`, `PerplexityBot` e `Google-Extended` no robots, sob o comentário
`# AI search engine crawlers (GEO optimization)`.

#### 2.5.3 A arquitetura é *dynamic rendering*, que o Google não recomenda

O padrão do `nginx.conf` — detectar crawler por user-agent e mandar para um
renderizador separado, servindo HTML diferente do que o usuário recebe — é a
definição literal de **dynamic rendering**. O Google a classifica como *workaround*,
não solução — citação literal, verificada na fonte em 2026-09-11: *"Dynamic rendering
is a workaround and not a recommended solution, because it creates additional
complexities and resource requirements."* (A versão anterior desta spec datava isso
de 2022; **a página não cita ano** — atribuição removida.) Dois motivos que o nosso
caso ilustra:

1. **Bot e usuário veem versões diferentes**, com risco de divergência. Já divergiu:
   é a causa do Achado B (sitemap e SSR com critérios distintos).
2. **Manter duas versões de cada página custa complexidade.** A lista de user-agents
   precisa ser mantida à mão — e já está desatualizada, como prova 2.5.2.

Não há bônus de ranking por método de renderização ("No SEO Benefit For Either
Dynamic Rendering Or Server Side Rendering") — o ganho aqui **não é de ranking por
SSR**, é de deixar de servir conteúdo divergente e de alcançar crawler que não executa
JS. A recomendação da própria página: *"we recommend that you use server-side
rendering, static rendering, or hydration as a solution."*

**Correção 2026-09-11 (achado de auditoria):** a frase "servindo o mesmo HTML para
todos" foi atribuída a *JavaScript SEO basics*, onde **não aparece**. A recomendação
de SSR/estático está na página de *dynamic rendering*, citada acima. A conclusão
prática se mantém: renderização universal elimina por construção as classes de
defeito B, C e E.

### 2.6 O que foi medido e está CORRETO (descartado como causa)

Para não desperdiçar trabalho em hipótese já refutada:

- **On-page do blog** — `Base.astro` emite `canonical`, OG completo, Twitter card,
  `description`, JSON-LD. `[slug].astro:27-38` emite `articleLd` + `breadcrumbLd`,
  `<h1>`, imagem com `width`/`height`. Bem construído.
- **Sitemap do site** — 221 URLs, todas sob `/blog/` e páginas institucionais.
  Medido: `curl -s .../sitemap-0.xml | grep -c '<loc>'` → 221.
- **`noindex` acidental** — ausente. `curl -sI` na página do Chris Perkins não traz
  `X-Robots-Tag`; HTTP 200 limpo; `SITE_NOINDEX` só afeta beta (`astro.config.mjs:15`).
  Correção 2026-09-11: `SITE_NOINDEX` hoje faz mais que o header — ele **remove a
  integração de sitemap** do build (`integrations: noindex ? [react()] : [sitemap(), react()]`)
  e o `robots.txt` emite `Disallow: /`. Beta não gera sitemap; produção gera.
- **SSR do `mesas` para Googlebot** — existe e dispara (resposta difere do navegador:
  3.745 vs 3.328 bytes). O defeito é o *conteúdo* da resposta, não a ausência dela.
  **Ressalva (Achado E):** vale só para Googlebot e a lista de user-agents do
  `nginx.conf`. Não vale para crawler de IA, que recebe a casca vazia, nem para o
  usuário — e a própria abordagem é dynamic rendering, deprecada.
- **Perfil de mestre** — funciona. `/mestre/filipe` via Googlebot devolve
  `<title>Filipe — Mestre de RPG | Artifício Mesas</title>` com canonical correto.
- **Qualidade de conteúdo** — é o mesmo que rankeava no WordPress.

---

## 3. Escopo

### Em escopo

1. Corrigir a origem do canonical legado no `site` (dado + código que o emite).
2. Implementar 301 de todos os prefixos legados do WordPress para `/blog/<slug>/`.
3. Eliminar o soft-404 do `mesas`: status HTTP correto para mesa inexistente/expirada.
4. Alinhar o critério de visibilidade do sitemap ao do SSR (fonte única compartilhada).
5. Auditoria de `?system=` e demais facetas de filtro (canonical/`noindex`).
6. Guard automatizado que impeça reintrodução dos defeitos.
7. Schema `Product`+`Offer` + `description` por mesa (Achado E). **Sem `Event`** —
   decidido em T4.4 (2026-09-11); a redação anterior deste item ainda citava
   `Event`/`VirtualLocation`, superada.
8. HTML-first em `mesas`: conteúdo e schema no HTML inicial, iguais para todo
   user-agent — substituindo o dynamic rendering atual (Achado E).
9. `lastmod` no sitemap do `site` (hoje ausente: `grep -c lastmod` → 0) — é o que
   sinaliza ao Google que os 126 posts mudaram (T3.4).
10. Operação no Search Console depois do deploy: validação dos fixes e Request
    Indexing das URLs de maior valor (F6). Sem isso, a recuperação fica só no ritmo
    natural de recrawl.

### Fora de escopo (sem decisão do mantenedor)

- Mudança de estratégia editorial ou de conteúdo.
- Reestruturação de URL do blog (`/blog/<slug>/` permanece).
- Alteração da regra de negócio de expiração de mesa importada — a spec corrige o
  **status HTTP e o sitemap**, não o prazo de 5 dias.
- **Schema do perfil de mestre.** T4.2 leva o perfil a HTML-first (conteúdo visível
  ao crawler), mas `Person`/`ProfilePage` não entra nesta spec. Declarado aqui para
  não virar improviso: T4.3 define schema só de mesa.
- **Unificar o espelho de `tableVisibility` em `packages/*`** (T1.1, item 3). Medido:
  não existe pacote de domínio em `packages/` — seria criação de pacote novo, que
  exige aprovação própria e não foi pedida. Fica nomeado como bloqueio, não como
  pendência silenciosa.
- **Faceta indexável com rota própria** (`/sistemas/<slug>`). T5.1 decide canonical
  para a URL limpa em todas; página curada por sistema é outra spec.
- **Recuperar as ~889 URLs em 404 além dos 105 pares.** São arquivos de categoria/tag
  do WP e seções não migradas (`/magia/`, `/doc/`, `/dd/`). Permanecem em 404 por
  recomendação oficial — 4xx não afeta ranking nem crawl rate, e redirect sem
  equivalente vira soft-404 (§2.4.2). Não é omissão: é a resposta correta.
- **Criar a propriedade de Domínio no Search Console.** Exige verificação de DNS,
  ação do mantenedor (§2.4.3). A spec registra a consequência (T6.1 não valida a F1
  sem ela), não executa.
- **Erro no servidor (5xx) — 1 página.** Apareceu no relatório do GSC (§2.4.1) e não
  foi investigado nesta rodada. Nomeado como não medido, não como inexistente.
- **Exportação completa das 994 URLs em 404.** Limite de 1.000 linhas por relatório e
  paginação da UI não cooperou; a URL Inspection API (2.000/dia por propriedade) seria
  o caminho. A decisão de escopo da F2 não depende dela (§2.4.2).

### Decisões fechadas nesta rodada (2026-09-11) — não redecidir

Estavam em aberto na revisão e foram resolvidas por medição ou fonte, não por
preferência. Cada uma tem o detalhe e o aceite na task citada:

| Decisão | Resultado | Onde |
|---|---|---|
| Mecanismo de SSR | React Router v7 framework mode — mesmo pacote já instalado, sem lib nova | T4.2 |
| Imagem do `Product` | `banner_url` (145/168) → `cover_url` (90/168) → **omitir**; `image` não é required | T4.3 |
| Facetas de filtro | Canonical limpo em todas; nenhuma indexável (1.196 de 1.269 sistemas sem mesa) | T5.1 |
| Citação por busca generativa | Sim, é objetivo; o meio é HTML-first, não `robots.txt` | `plan.md` §5.4 |
| Removals do GSC | Não usar — é temporário (~6 meses) e o 410 já é o sinal correto | T6.3 |
| Tamanho da F2 diante das 994 em 404 | Continua **105 pares 1:1**; o resto fica em 404 por recomendação oficial | §2.4.2 |
| Escopo dos `/magia/`, `/doc/`, `/dd/` | Conteúdo nunca migrado, não URL errada — 404 é a resposta correta | §2.4.2 |

### Inferência a confirmar

- **Ordem de prioridade.** A spec propõe Achado C/B (soft-404, `mesas`) antes do
  Achado A/D (`site`), porque a documentação do Google classifica soft-404 como
  exclusão de indexação + dreno de crawl budget, enquanto canonical-404 é heurística.
  Se o mantenedor preferir recuperar o blog primeiro por valor de negócio, a ordem
  inverte sem prejuízo técnico — as frentes são independentes.
- **Destino das mesas expiradas — DECIDIDO (2026-09-11): `410 Gone` + página útil.**
  Sair do sitemap já estava certo (T1.4, feito). O `301` para a listagem do sistema
  foi descartado por medição: das **47** expiradas em produção, **0** têm mesa
  vigente do mesmo mestre, então não há substituto equivalente — e redirect de item
  expirado para categoria é justamente o que o Google trata como soft-404, o defeito
  que esta spec combate. Detalhe e aceite: `tasks.md` T1.3.

---

## 4. Critérios de aceite

Todos verificáveis por comando; nenhum se fecha com dry-run ou documentação.

| # | Critério | Como medir |
|---|---|---|
| A1 | Nenhum post com canonical divergente da URL real | `SELECT count(*) … <> '/blog/'||slug||'/'` → **0** (hoje: 105) |
| A2 | Varredura HTTP dos 126 posts sem mismatch | script de comparação → **0 mismatches** |
| D1 | Todo prefixo legado responde 301 para o slug correto | `curl -sI /noticias/<slug>/` → `301` + `Location: /blog/<slug>/` |
| D2 | Sem cadeia de redirect | `curl -sIL` → no máximo 1 hop até 200 |
| D3 | Forma **sem barra final** também redireciona | `curl -sI /noticias/<slug>` (sem `/`) → `301`, não 404. Hoje falha: `lookupRedirect` usa `map.get` exato (`redirect-cache.ts:15-16`) |
| D4 | Query string preservada no redirect | `curl -sI '/noticias/<slug>/?utm_source=fb'` → `Location` contendo `utm_source=fb`. Hoje falha: `req.path` exclui a query (`server.ts:291-296`) |
| D5 | `lastmod` no sitemap do `site` | `curl -s /sitemap-0.xml \| grep -c lastmod` → ≥ 126 (hoje: **0**) |
| C1 | Mesa inexistente responde 404 (não 200) | `curl -s -o /dev/null -w '%{http_code}' /mesas/nao-existe-zzz` → **404** |
| C2 | Soft-404 não emite canonical auto-referente | resposta 404 sem `<link rel=canonical>` para si |
| B1 | Sitemap e SSR concordam 100% | varredura: toda URL do sitemap devolve página real ao Googlebot |
| B2 | Critério de visibilidade em função única compartilhada | sitemap e og importam o mesmo helper |
| E1 | Facetas de filtro não geram duplicata indexável | `?system=x` com canonical para a URL limpa |
| F1 | Crawler de IA recebe o mesmo conteúdo que o Googlebot | `curl -A GPTBot/1.1` e `-A ClaudeBot/1.0` devolvem HTML com conteúdo da mesa (hoje: 3.328 B de casca) |
| F2 | Mesa emite `Product`+`Offer` elegível, sem `Event` | `Product` **sem erro crítico** no Rich Results Test; `grep -c '"@type": "Event"'` → **0** (guarda da decisão T4.4). Todo valor do JSON-LD espelhado no HTML visível — `price` de `price_value`, `availability` de `slots_total`/`slots_filled`, nunca literais |
| F3 | `Offer` com preço, moeda e disponibilidade | `price`, `priceCurrency` (ISO 4217), `availability` (`InStock`/`SoldOut`) |
| F4 | `description` por mesa, não institucional | 2 mesas distintas → 2 descriptions distintas |
| F5 | Schema presente no HTML inicial, não injetado por JS | `curl -A GPTBot/1.1 \| grep -c ld+json` → ≥ 1 |
| G1 | Guard automatizado cobre A1, C1, B1 e F1 | teste roda em CI e falha se o defeito voltar |
| H1 | Fixes validados no Search Console | "Validate Fix" acionado nos relatórios de Soft 404, Not found (404) e canonical; nenhum volta a "Failed" (F6/T6.1) |

---

## 5. Riscos

- **Perda de canonical editorial legítimo — risco descartado por medição.** Um post
  poderia ter canonical intencional (conteúdo sindicado). Medido:
  `SELECT count(*) … canonical NOT LIKE 'https://artificiorpg.com%'` → **0**. Nenhum
  aponta para domínio externo, logo não há sindicação a preservar.
  **Reconciliação dos números:** 126 posts = 105 divergentes + **20** já na forma
  correta + **1** com `canonical NULL`. O "21" que aparecia aqui somava os 20 com o
  nulo; os 20 são posts nascidos no stack novo, não override editorial. O `UPDATE` de
  T3.2 tem predicado restrito aos 105 e não toca os demais.
- **301 em massa mal mapeado.** A documentação do Google alerta contra blanket
  redirect para home. O mapeamento precisa ser 1:1 por slug, com o slug legado
  extraído do próprio canonical gravado (que é a fonte fiel da URL antiga).
- **Link compartilhado de mesa expirada (WhatsApp/Discord) vira beco sem saída.**
  Risco real e **mitigado por decisão**, não aceito: o `410` obriga corpo útil —
  título da mesa encerrada, mesas vigentes do mesmo sistema (23 das 47 têm) e busca.
  Status de erro e página prestativa não são excludentes. Sem essa camada a decisão
  não fecha (aceite 4 de T1.3).
- **Janela de recuperação.** A pesquisa indica semanas a meses para reindexação,
  com redirects mantidos por no mínimo 1 ano. A spec entrega a correção; o
  ranking volta no tempo do Google, não no do deploy.

---

## 6. Fontes consultadas

Pesquisa de 2026-09-10, usada para calibrar severidade e priorização — não substitui
as medições da seção 2.

- [Fix Canonicalization Issues — Google Search Central](https://developers.google.com/search/docs/crawling-indexing/canonicalization-troubleshooting)
- [5 common mistakes with rel=canonical — Google](https://developers.google.com/search/blog/2013/04/5-common-mistakes-with-relcanonical)
- [Soft 404 errors / HTTP status codes — Google Search Central](https://developers.google.com/search/docs/advanced/crawling/soft-404-errors)
- [Site Moves with URL changes — Google Search Central](https://developers.google.com/search/docs/crawling-indexing/site-move-with-url-changes)
- [Redirects and Google Search — Google Search Central](https://developers.google.com/search/docs/crawling-indexing/301-redirects)
- [How soft 404s and indexing issues caused a 90% traffic collapse — Search Engine Land](https://searchengineland.com/soft-404s-indexing-issues-traffic-collapse-477116)
- [How to fix GSC "Crawled – currently not indexed" — Search Engine Land](https://searchengineland.com/fix-crawled-currently-not-indexed-error-google-search-console-445344)
- [Ultimate site migration SEO checklist — Search Engine Land](https://searchengineland.com/guide/ultimate-site-migration-seo-checklist)

Pesquisa adicional do Achado E (schema, renderização, crawler de IA):

- [Event structured data — Google Search Central](https://developers.google.com/search/docs/appearance/structured-data/event)
- [New properties for virtual, postponed, and canceled events — Google](https://developers.google.com/search/blog/2020/03/new-properties-virtual-or-canceled-events)
- [General structured data guidelines — Google](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Dynamic rendering as a workaround (deprecado) — Google](https://developers.google.com/search/docs/crawling-indexing/javascript/dynamic-rendering)
- [JavaScript SEO basics — Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [JavaScript links can make your pages invisible to AI search — Search Engine Land](https://searchengineland.com/javascript-links-pages-invisible-ai-search-485228)
- [Technical SEO for AI search: 4 fundamentals — Search Engine Land](https://searchengineland.com/technical-seo-for-ai-search-fundamentals-485262)
- [Google says no SEO benefit for dynamic vs server-side rendering — Search Engine Roundtable](https://www.seroundtable.com/google-seo-dynamic-rendering-or-server-side-rendering-33947.html)

Pesquisa de 2026-09-11, que fundamenta a decisão de **não** redirecionar as ~889 URLs
sem equivalente (§2.4.2) e o limite de exportação do GSC:

- [HTTP status codes, network and DNS errors, and Google Search](https://developers.google.com/search/docs/crawling-indexing/http-network-errors) — *"All `4xx` errors, except `429`, are treated the same"*; *"The `4xx` status codes, except `429`, have no effect on crawl rate."*
- [Do 404 errors hurt my site? — Google Search Central Blog](https://developers.google.com/search/blog/2011/05/do-404s-hurt-my-site)
- [Best practices when moving your site — Google Search Central Blog](https://developers.google.com/search/blog/2008/04/best-practices-when-moving-your-site) — page-to-page, nunca blanket para a home
- [Troubleshoot crawling errors — Google Search Central](https://developers.google.com/search/docs/crawling-indexing/troubleshoot-crawling-errors)
- [301 redirects to less-relevant pages are seen as soft 404s (case study) — GSQi](https://www.gsqi.com/marketing-blog/redirects-less-relevant-pages-soft-404s/) — base do descarte do redirect em massa
- [How to automate the URL Inspection API — Screaming Frog](https://www.screamingfrog.co.uk/seo-spider/tutorials/how-to-automate-the-url-inspection-api/) — limite de 2.000 URLs/dia por propriedade
