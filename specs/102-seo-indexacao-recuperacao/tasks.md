# Tasks 102 — Recuperação de indexação e ranking

Estado atual de cada task. **Um bloco por task, reescrito** — nunca anexar bloco
novo abaixo do antigo (§Conclusão de Tarefas).

Ordem conforme `plan.md` §1. Frentes independentes: F1 não bloqueia F2/F3.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` concluída e medida · `[!]` bloqueada

---

## F1 — `mesas`: soft-404 e divergência sitemap/SSR

### [~] T1.1 — Unificar o critério de visibilidade de mesa — PARCIAL: falta só o teste

**Problema.** `routes/sitemap.ts` e `routes/og.ts:226-230` definiam "mesa visível" de
formas diferentes; o SSR aplicava `isImportedTableExpired` e o sitemap não. Medido:
51 de 92 URLs do sitemap (55%) expiradas pelo critério do SSR.

**Medido em 2026-09-11: as duas formas JÁ EXISTIAM** em `utils/tableVisibility.ts`
desde antes desta spec —
- predicado de objeto: `isImportedTableExpired` / `isPublicTable`
- fragmento SQL Kysely: `importedTableIsCurrentSql`

O problema nunca foi ausência do helper: era o **sitemap não importar** o que já
existia. Consumidores hoje (`rtk rg`): `tables.ts` (2×), `gm.ts` (2×) e, desde T1.4,
`sitemap.ts`. Nenhum filtro de visibilidade replicado fora do helper.

**Feito.** O sitemap passou a importar (T1.4). Fim da divergência em produção.

**Terceira cópia, achada em 2026-09-11 (achado de auditoria).** Existe um **espelho
no frontend**: `apps/mesas/frontend/src/utils/tableVisibility.ts`, com
`isImportedTableExpired` e `importedTableExpiryDate` reimplementados. Medido: `diff`
contra o backend → **DIVERGEM** (o backend tem `importedTableIsCurrentSql`,
`isPublicTable` e as funções de comentário; o frontend, só duas). Consumido por
`DiscordDraftPreview.tsx`.

Ou seja, a mesma regra de negócio está escrita **duas vezes em dois apps** — o que
§"Compartilhado por padrão" trata como dívida por definição. A correção certa é subir
a regra para `packages/*` e os dois apps importarem, não sincronizar as cópias à mão.

**Falta — e é o que mantém esta task aberta.** O aceite pede um **teste de
equivalência**: para o mesmo conjunto de mesas, o predicado de objeto e o SQL
selecionam exatamente as mesmas linhas, falhando se alguém alterar um lado só. Esse
teste **não existe**. Sem ele, nada impede a regra de divergir de novo — já divergiu
três vezes: detalhe↔OG (spec 059/060), sitemap (T1.4) e o espelho backend↔frontend,
que **segue divergente**.

**Escopo revisto desta task:**
1. ~~Criar o helper~~ — já existia; era "ligar o SQL ao sitemap" (feito em T1.4).
2. Teste de equivalência objeto↔SQL (não existe).
3. Unificar o espelho do frontend em `packages/*` (não feito).

**Validação do que foi feito.** `rtk tsc -b` → No errors found; `rtk vitest run`
(`tableVisibility.test.ts` + `tables.visibility.test.ts`) → **37/37 PASS**. Esses 37
cobrem a regra de expiração, **não** a equivalência objeto↔SQL.

---

### [ ] T1.2 — Status HTTP correto para mesa inexistente

**Problema.** `routes/og.ts:232-238` responde `res.status(200)` com "Mesa não
encontrada" e canonical auto-referente. Medido: `/mesas/isto-nao-existe-jamais-zzz999`
→ HTTP 200. Soft-404 é excluído da indexação pelo Google e consome crawl budget do
domínio.

**Entrega.**
- Slug inexistente → `404` (HTML customizado pode continuar; status é que muda).
- Resposta de erro **sem** `<link rel=canonical>` auto-referente.

**Depende de.** T1.3 para o caso "expirada" — esta task cobre só "nunca existiu".

**Aceite.** `curl -s -o /dev/null -w '%{http_code}' …/mesas/nao-existe-zzz` → `404`.

---

### [!] T1.3 — Destino da mesa expirada (404 / 410 / 301)

**Ainda bloqueada: decisão de produto.** Muda o que o usuário vê ao abrir link antigo
compartilhado (WhatsApp, Discord), portanto não é call do agente (§Bug achado → exceção 2).

**Resolvido em 2026-09-11: a regra de expiração de 5 dias está CORRETA e permanece.**
O mantenedor confirmou o porquê: *"mesas normalmente fecham em 2, 3 dias as vagas,
principalmente mesas gratuitas, os mestres esquecem de arquivar elas."* A expiração
automática existe justamente porque o mestre não arquiva. Não reabrir esta regra;
não construir fluxo de lembrete (ele marcou como não prioritário).

Isso **fecha uma bifurcação**: a correção era o sitemap parar de anunciar as expiradas
(T1.4, feito), não afrouxar o prazo.

**O que resta decidir:** qual status a mesa expirada devolve.

| Opção | Google | Usuário |
|---|---|---|
| `404` | sai do índice | link antigo → erro |
| `410 Gone` | sai do índice; **não** é mais rápido que 404 | link antigo → erro |
| `301` → listagem do sistema | transfere autoridade | link antigo → mesas parecidas |

**Recomendação do agente:** `410` para expirada (remoção deliberada por regra de
negócio, não erro) e `404` para inexistente (T1.2).

**Correção 2026-09-11 (achado de auditoria):** a versão anterior dizia que "410 sai
mais rápido do índice". **Sem base na fonte** — a documentação do Google trata todos
os 4xx (exceto 429) da mesma forma. A escolha entre 404 e 410 é de **semântica**
("não existe" vs. "existiu e foi removido"), não de velocidade. Não usar velocidade
como critério de decisão aqui.

**`eventStatus` saiu da lista** — T4.4 descartou `Event`, então não há status de
evento para carregar.

**Alcance:** 51 mesas hoje (medido), e crescente.

---

### [x] T1.4 — Sitemap deixa de anunciar mesa expirada — IMPLEMENTADO (sem deploy)

**Entregue 2026-09-11.** `routes/sitemap.ts` passou a aplicar
`importedTableIsCurrentSql('tables')`, de `utils/tableVisibility.ts:8`.

**A causa, medida.** O sitemap filtrava só `status='active'` e `archived_at IS NULL`,
enquanto `og.ts:226-230` aplicava também `isImportedTableExpired`. O sitemap
**convidava o Google** para 51 páginas que o servidor tratava como inexistentes,
respondendo **HTTP 200 com "Mesa não encontrada"** — soft-404, o padrão que produz
exatamente o "Rastreada, mas não indexada" de 736 páginas que abriu esta spec.

Varredura das 92 URLs de mesa do sitemap com UA de Googlebot (2026-09-11):

```
OK=38   "Mesa não encontrada"=51   título vazio=3   TOTAL=92
```

Banco, mesas `active` e não arquivadas:

```
imported | 57 total | 51 expiradas pela regra
manual   | 35 total |  0 expiradas
```

51 e 51 — causa confirmada por medição, não inferida. Os 3 de título vazio foram
timeout do `curl`, não soft-404: a contagem com o predicado aplicado devolve 41,
consistente com 38 + 3.

**Por que reuso e não regra nova.** Esta regra já divergiu entre detalhe e OG antes
(achado CodeRabbit, spec 059/060) — é a razão de `tableVisibility.ts` existir. O
sitemap era um **terceiro leitor nunca ligado à fonte única**.

**Resultado:** 92 → **41** URLs. Não é perda: são URLs que já não serviam conteúdo.

**Validação:** `rtk tsc -b` → No errors found; `rtk vitest run` (visibilidade) →
**37/37 PASS**; `SELECT` com o predicado → **41**.

**Bloqueio:** só chega ao Google após deploy do `mesas` (aprovação nominal).

---

## F2 — `site`: 301 dos prefixos legados do WordPress

### [x] T2.1 — Camada do redirect — RESOLVIDA: o mecanismo JÁ EXISTE no repo

**Correção de 2026-09-11 (achado de auditoria).** Esta task perguntava "nginx do
container ou Cloudflare?". A pergunta era **falsa**: o `site` já tem um subsistema de
redirect 301 completo, em produção, que a spec ignorou.

Medido:

| Peça | Onde | O que faz |
|---|---|---|
| Tabela `redirects` | `db/migrations/001_init.sql:75-81` | `from_path` UNIQUE, `to_path`, `code` DEFAULT 301 |
| Repo | `db/repo/redirects.ts` | `addRedirect`, `listRedirects` |
| Cache | `server/redirect-cache.ts` | `reloadRedirects`, `lookupRedirect` |
| Middleware | `server/server.ts:287-294` | aplica **antes do estático**; recarrega no boot e a cada 30 s |
| CRUD admin | `server/admin-api.ts` | gated `requireAuth`+`requireAdmin` |

O comentário da migration diz o propósito literal: *"Mapa de redirects 301 (slug/URL
WP -> nova rota). Ativa só no cutover (D047)."* Foi construído **exatamente** para o
problema da F2 e nunca foi populado.

**Medido em produção: `SELECT COUNT(*) FROM redirects` → 0.** Existe, está ligado,
está vazio.

**Decisão: usar o que existe.** Nem nginx, nem Cloudflare. Motivos:
- É `INSERT` em tabela, não mudança de infra — não toca `Dockerfile`, nginx, Cloudflare
  nem `deploy-flow.md` §1.
- O middleware roda antes do estático, então o 301 vale para qualquer rota.
- Editável pelo admin sem deploy.
- §"Compartilhado por padrão": reusar o mecanismo do repo, não criar um paralelo.

**Consequência:** as aprovações nominais antes previstas para `Dockerfile`/nginx e
Cloudflare **saem** da lista da F2. Resta a autorização de `INSERT` (T2.2).

---

### [ ] T2.2 — Popular a tabela `redirects` com os prefixos legados

**Entrega.** `INSERT` na tabela `redirects` de `site` — um par 1:1 por post
divergente, sem cadeia, `code = 301`.

**Fonte dos pares.** Derivados do banco, não digitados:

```sql
SELECT canonical AS from_path,
       'https://artificiorpg.com/blog/' || slug || '/' AS to_path
FROM posts
WHERE canonical IS NOT NULL
  AND canonical <> 'https://artificiorpg.com/blog/' || slug || '/';
-- 105 linhas
```

Prefixos cobertos (medido, 2026-09-11): `/noticias/` 64, `/blog/<categoria>/` 38,
`/dnd/` 18, `/downloads/` 3, `/entrevistas/` 2. Os 20 já corretos **não** entram.

**`from_path` precisa ser o caminho, não a URL absoluta** — `lookupRedirect(req.path)`
compara com `req.path`. Normalizar removendo esquema+host antes do `INSERT`.

**Exigências de SEO (da pesquisa, confirmadas na fonte):**
- 301 (permanente), nunca 302 — *"301 redirects don't cause a loss in PageRank"*.
- 1:1 direto, **sem cadeia**: o destino tem que devolver 200, não outro 301.
- Manter no ar **≥ 1 ano** — *"at least 1 year"*.
- `trailingSlash: "always"` no Astro: destino termina em `/`.

**Depende de.** T3.1 (corrigir a origem no importador). Sem isso o importador volta a
gravar canonical legado e a F2 vira trabalho recorrente.

**Autorização nominal necessária.** `INSERT` de 105 linhas em `site` (produção).
Rollback: `DELETE FROM redirects WHERE from_path IN (…)`, reversível.

**Aceite.** `SELECT COUNT(*) FROM redirects` → 105, e cada `from_path` devolve **301**
para o `to_path`, que devolve **200**.

---

### [ ] T2.3 — Varredura de regressão dos 105

**Entrega.** Script que, a partir do `canonical` gravado no banco (fonte fiel das URLs
antigas do WP), testa cada uma das 105 URLs legadas e afirma 301 → 200 sem cadeia.

**Aceite.** 105/105 resolvem. Qualquer falha reabre T2.2.

---

## F3 — `site`: canonical legado

### [ ] T3.1 — Corrigir a origem no importador

**Problema.** O importador do WordPress grava `posts.canonical` com a URL antiga do
WP. `db/export.ts:66` a propaga para `posts.json`, e `[slug].astro:21` a emite como
autoridade. Medido: 105 de 126 posts (83%) com canonical apontando para 404.

**Entrega.** Importador para de gravar canonical do WP. **Preservar** a capacidade
de override editorial via admin (`[slug].astro:21` continua honrando
`post.seo.canonical`) — o recurso é legítimo; o dado é que está errado.

**Medido para descartar risco:** `SELECT count(*) … canonical NOT LIKE 'https://artificiorpg.com%'`
→ **0**. Nenhum canonical aponta para domínio externo; não há sindicação legítima a
preservar. Os 21 "corretos" são posts nascidos no stack novo, não override editorial.

---

### [!] T3.2 — Limpar os 105 canonicals divergentes em produção

**Bloqueada: SQL write em produção exige aprovação nominal** (§Autorização), com
dry-run e rollback registrados.

**Comando pretendido** (não executado):

```sql
UPDATE posts SET canonical = NULL
 WHERE canonical IS NOT NULL
   AND regexp_replace(canonical,'^https?://[^/]+','') <> '/blog/'||slug||'/';
-- esperado: UPDATE 105
```

Com `canonical` nulo, `[slug].astro:21` cai no fallback correto
(`${SITE.origin}/blog/${post.slug}/`).

**Rollback.** `pg_dump` da tabela `posts` antes; a coluna é restaurável isoladamente.
Não destrói conteúdo — só metadado de SEO já comprovadamente errado.

**Depende de.** T3.1 (senão a próxima importação regrava).

---

### [ ] T3.3 — Export + rebuild + deploy do site

**Por que é task própria.** `posts.canonical` → `export.ts` → `posts.json` → build
Astro → HTML estático. **Corrigir o banco não muda produção** sem export + build +
deploy. "Banco atualizado ≠ prod atualizado", mesma lógica de "Git atualizado ≠ prod
atualizado".

**Depende de.** T3.2. **Exige aprovação nominal** (deploy).

**Aceite.** Varredura dos 126 posts: `<link rel=canonical>` == URL servida em
**126/126** (hoje: 21/126).

---

## F4 — `mesas`: HTML-first e schema estruturado

Frente nova (Achado E, `spec.md` §2.5). Entrou por comparação medida com o MesaQuest.

### [x] T4.1 — Arquitetura de renderização do `mesas` — DECIDIDA: SSR universal

**Decisão do mantenedor (2026-09-11): caminho 2, SSR universal.** Motivo dado por
ele: *"o catálogo precisa ser sempre fresco"*. Isso elimina SSG/prerender, que
serviria HTML do momento do build — vaga preenchida apareceria como aberta até o
rebuild seguinte.

Nota: a recomendação anterior do agente era o caminho 1 (SSG). Ela partia de custo
de implementação, não do requisito de frescor, que só o mantenedor tinha.

**Problema que isto resolve.** O `mesas` serve HTML diferente por user-agent
(`nginx.conf:5-22` + `@og_proxy`) — *dynamic rendering*, que o Google deixou de
recomendar, chamando de contorno e não solução ("a workaround and not a recommended
solution"; a página não cita ano). Três defeitos desta spec
são sintomas: B (sitemap ≠ SSR), C (erro só no caminho do crawler) e E (lista de
UA desatualizada).

**Medido (2026-09-11), mesma mesa válida `/mesas/o-reinado-da-rainha-dragao-mtk6844i`:**

| User-agent | Bytes | `<title>` | `ld+json` |
|---|---:|---|---|
| navegador | 3.328 | genérico do site | não |
| Googlebot | 3.769 | da mesa (quando não expirada) | não |
| ClaudeBot | **3.328** | genérico do site | **não** |

ClaudeBot recebe a casca vazia porque o `nginx.conf` não lista nenhum crawler de
IA. Medição de 2026 (fontes em `plan.md`): **nenhum** dos crawlers de IA relevantes
— GPTBot, ClaudeBot, PerplexityBot, OAI-SearchBot, Bytespider — executa JavaScript.
Para todos eles o app hoje é uma página em branco.

**Por que não o caminho 3** (só ampliar a lista de UA): faria o sintoma sumir sem
tocar a causa e contraria §Regras Gerais de Código ("solução dinâmica, não caso
particular"). Lista fixa de UA envelhece sozinha — já envelheceu uma vez.

**Escopo da obra, não iniciado.** Mudar de Vite client-only (`react-router-dom` 7,
`package.json` sem adapter SSR) para SSR universal mexe em entry point, data
fetching e deploy. Precisa de autorização nominal antes de começar.

**Nota para T4.2.** `og.ts` **não faz join com `table_contacts`** — mesmo o HTML que
hoje vai ao Googlebot não tem dado de contato, necessário para `Offer` (T4.4). E os
normalizadores (`getWhatsAppUrl` em `tableViewMapper.ts:30`, `toSafeDiscordInviteUrl`)
vivem só no frontend. Por §"Compartilhado por padrão", sobem para pacote compartilhado
— não se reimplementam no backend.

---

### [ ] T4.2 — HTML-first nas rotas públicas de mesa e mestre

**Entrega.** Conteúdo e schema no HTML inicial, **iguais para todo user-agent**.
Elimina por construção a divergência bot↔usuário que produziu B, C e E.

**Depende de.** T4.1.

**Aceite.** `curl -A GPTBot/1.1` e `-A ClaudeBot/1.0` devolvem HTML com o conteúdo
real da mesa (hoje: 3.328 B de casca) e `grep -c 'ld+json'` → ≥ 1.

---

### [ ] T4.3 — Schema `Product`+`Offer` **e** `Event` no mesmo `@graph`

**Correção de premissa (2026-09-11).** A versão anterior desta task dizia que o
Google **exige** `VirtualLocation` para evento só-online. **Falso** — verificado na
fonte: `eventAttendanceMode`/`VirtualLocation` nem aparecem na página de `Event`. O
que ela diz é mais forte: *"Virtual experiences with no real-world component aren't
supported."* Mesa online **não é elegível** a rich result de `Event`, ponto. Detalhe
e citações em `plan.md` §5.2.

**Entrega.** Um `@graph` com dois tipos, papéis distintos:

- **`Product` + `Offer`** — para o Google. `name`, `description` (T4.5), `image`
  (≥720px, ideal 1920px), `offers.price`, `priceCurrency` `"BRL"`, `availability`
  (`InStock`/`SoldOut` de `slots_total`/`slots_filled`), `url`.
- **`Event`** — para crawlers de IA e schema.org, **sem esperar rich result**.
  `name`, `startDate` (ISO-8601 com offset), `eventAttendanceMode`, `location`.

**Decisão do mantenedor (2026-09-11):** *"tudo que puder fazer pessoas chegarem nos
sites, é válido"*. O `Event` existe para busca generativa, não para o Google.

**Duas regras obrigatórias, ambas por medição:**

1. **`eventAttendanceMode` deriva de `modality`, nunca literal.** Hoje o catálogo é
   100% `online` (`online | 168`, zero presencial/híbrida), mas o enum aceita as
   outras e o produto permite escolher. Literal faria a primeira mesa presencial
   emitir dado falso. Mapa: `online`→`OnlineEventAttendanceMode`+`VirtualLocation`;
   `presencial`→`OfflineEventAttendanceMode`+`Place`; `hibrida`→`Mixed…`+ambos.
2. **`price` sai de `price_value`/`price_type`, nunca do rótulo do contato.**
   "Ticket / Inscrição" aparece em 106 contatos, mas 101 dessas mesas são `gratuita`
   — derivar do rótulo geraria preço falso em 95% dos casos.

**Depende de.** T4.2/T4.1 (SSR). Schema injetado por JS é invisível para crawler de
IA — nenhum executa JavaScript. Sem SSR esta task entrega zero.

**Aceite — SUBSTITUI o aceite F2 anterior, que era inválido.** O anterior verificava
`VirtualLocation` como exigência do Google; testava regra inexistente.

1. Rich Results Test: **`Product` sem erro crítico**. `Event` ignorado pelo Google é
   resultado **esperado**, não falha.
2. `@graph` contém os dois tipos: `grep -c '"@type": "Event"'` → 1 e
   `grep -c '"@type": "Product"'` → 1 no HTML inicial.
3. `curl -A ClaudeBot/1.0` devolve o JSON-LD completo (hoje: 3.328 B de casca).
4. `price` conferido contra `price_value` em uma mesa gratuita e uma paga.
5. `eventAttendanceMode` conferido contra `modality` — hoje todas `Online…`.

---

### [x] T4.4 — Elegibilidade de `Event` — DECIDIDO: inelegível, emitir mesmo assim para IA

**Duas razões independentes tornam toda mesa do acervo inelegível a rich result de
`Event`** — verificadas na documentação do Google em 2026-09-11, não de memória:

1. **Virtual sem componente físico.** *"Virtual experiences with no real-world
   component aren't supported. Events must take place in a physical location."*
   Medido: `modality` devolve `online | 168` — **zero** presencial, zero híbrida.
2. **Passa por seleção.** *"Events that require membership, invitation or prior
   purchasing of a ticket for attending the event are ineligible."* Regra de produto
   do mantenedor: *"ele vai direto para onde o mestre definiu: link do google forms,
   site, link do whatsapp…"* — o mestre continua filtrando. Medido: 108 contatos são
   Google Forms, que é candidatura, não reserva. Confirmado em `uiHelpers.ts:39-51`.

**Correção do registro anterior.** A versão de 2026-09-11 descartou `Event` citando
só a razão 2, e afirmava que o Google **exige** `VirtualLocation` para evento online.
Essa exigência **não existe** — é de março/2020 (COVID) e saiu da doc. O descarte
estava certo; a justificativa, incompleta e parcialmente falsa.

**Decisão: emitir `Event` assim mesmo**, junto de `Product`+`Offer` no mesmo `@graph`
(T4.3). Razão do mantenedor: *"tudo que puder fazer pessoas chegarem nos sites, é
válido"*. Crawlers de IA e schema.org leem `Event`; não aplicam política do Google.

**Opção descartada por medição:** "emitir `Event` só onde houver componente físico"
cobriria **0 de 168** mesas.

**Risco, não medido e assumido.** Markup inelegível pode gerar ação manual de spam de
dados estruturados, que atinge o domínio inteiro. Mitigação: o markup não mente —
mesa online com vaga, preço e data é honestamente descrita pelos dois tipos, e ação
manual pune markup que contradiz a página. Não há dado público sobre a taxa; é
julgamento. O MesaQuest emite `Event`+`VirtualLocation` sem penalidade até
2026-09-11 — indício, não prova.

**Consequência para T1.3.** `eventStatus` volta a ser possível (há `Event` no
`@graph`), mas **não resolve** o destino da mesa expirada: o Google ignora esse
`Event`, então o status não afeta o índice. T1.3 segue entre `404`, `410` e `301`.

---

### [ ] T4.5 — `description` por mesa — é o texto que a IA cita

**Problema.** Toda URL do app repete a description institucional ("Plataforma gratuita
para encontrar mesas de RPG…"). Medido: idêntica em `/`, `/mesas/<slug>` e
`/mestre/<slug>`.

**Repriorizada em 2026-09-11.** Com busca generativa como objetivo, a `description`
deixa de ser só snippet do Google: é o trecho que um LLM cita ao resumir a mesa. 168
páginas com a mesma frase dão ao modelo 168 vezes a mesma informação — nenhuma sobre a
mesa específica.

**Referência medida (MesaQuest):**

> `<sinopse> | Dungeons & Dragons 5e (2014) • Online • Todos os níveis • R$ 50,00/mês • 6 vagas disponíveis`

**Entrega.** Montagem a partir de campo que já existe em `tables` (`title`, `synopsis`,
`listing_excerpt`, `system_id`, preço, vagas). Não é coleta de dado novo.

**Depende de.** T4.1/T4.2 — `description` injetada por JS não é lida por crawler de IA.

**Aceite.** Duas mesas distintas → duas descriptions distintas; nenhuma igual à
institucional.

---

### [ ] T4.6 — `robots.txt`: nomear crawlers de IA — DEIXOU DE SER COSMÉTICO

**Repriorizada em 2026-09-11.** A versão anterior classificava esta task como
cosmética. Com a decisão do mantenedor — *"tudo que puder fazer pessoas chegarem nos
sites, é válido"* — busca generativa virou objetivo de produto, e esta task passa a
fazer parte da entrega, não do enfeite.

**Estado atual.** Nosso `robots.txt` é `User-agent: * / Allow: /` — GPTBot e ClaudeBot
**já estão permitidos** pelo curinga. Nomear explicitamente (como o MesaQuest faz, com
`GPTBot`, `Claude-Web`, `PerplexityBot`, `Google-Extended` sob `# AI search engine
crawlers`) não muda a permissão; **documenta a intenção** e protege contra um
`Disallow` futuro escrito sem perceber o efeito.

**Continua dependente de T4.1/T4.2.** Permitir acesso a conteúdo que não existe no HTML
não entrega nada: nenhum crawler de IA executa JavaScript. Medido: ClaudeBot recebe
3.328 B de casca.

**Ordem correta:** T4.1 (SSR) → T4.2 (HTML-first) → T4.3 (schema) → T4.6 (robots).

**Aceite.** `robots.txt` nomeia os quatro agentes com `Allow: /`, e `curl -A GPTBot/1.1`
devolve HTML com conteúdo real da mesa.

---

## F5 — Facetas e guards

### [ ] T5.1 — Medir e tratar facetas de filtro

**Não medido ainda.** O Search Console lista
`https://mesas.artificiorpg.com/?system=castles-crusades` como afetada. Sem canonical
(medido: `grep -c 'rel="canonical"'` no HTML do navegador → 0), cada combinação de
filtro é URL distinta com conteúdo idêntico.

**Primeira etapa é medição**, não correção: quantos parâmetros existem, quantas
combinações o Google já rastreou, se alguma tem valor de busca próprio.

**Correção provável.** Canonical para a URL limpa. Se alguma faceta tiver valor de
busca real (ex.: `?system=dnd-5e`), a decisão de mantê-la indexável é de produto.

---

### [ ] T5.2 — Guards em CI

Nenhum dos defeitos desta spec quebra teste algum e todos são invisíveis em code
review — foi por isso que sobreviveram. Guard que falha o CI se voltarem:

| Guard | Trava |
|---|---|
| G-A | post com canonical ≠ URL real (sobre `posts.json` gerado) |
| G-B | URL do sitemap que o SSR nega (equivalência sitemap ↔ crawler) |
| G-C | slug inexistente sob `/mesas/` respondendo 200 |
| G-D | rota pública de mesa sem conteúdo/schema no HTML inicial (varre com UA de crawler de IA) |
| G-E | regra de visibilidade duplicada: predicado objeto ≠ SQL, ou espelho frontend ≠ backend |
| G-F | `price` do schema ≠ `price_value` do banco (trava a derivação pelo rótulo do contato) |

**G-B é o mais valioso:** trava a classe inteira de "sitemap anuncia o que o SSR
nega" — o defeito que ninguém veria sem esta investigação.

**G-D** trava a regressão para dynamic rendering: se alguém voltar a servir conteúdo
só para user-agent nomeado, o guard acusa.

**G-E** (novo, 2026-09-11) trava a causa-raiz do Achado B. A regra de visibilidade já
divergiu **três vezes**: detalhe↔OG (spec 059/060), sitemap (T1.4) e o espelho
`apps/mesas/frontend/src/utils/tableVisibility.ts`, que segue divergente do backend.
Corrigir as três ocorrências sem travar a quarta é consertar o sintoma — é exatamente
o que esta spec existe para não fazer.

**G-F** (novo, 2026-09-11) trava o erro que a medição evitou por pouco: "Ticket /
Inscrição" aparece em 106 contatos, mas 101 dessas mesas são `gratuita`. Sem guard,
qualquer refactor futuro do schema pode voltar a derivar preço do rótulo e publicar
ingresso pago em 95% dos casos.

**Depende de.** F1, F3 e F4 verdes (endurecer gate só depois do verde comprovado —
§Bug achado / débito).

---

## Achado lateral (fora do escopo da spec, registrado por medição)

### Discord: link de perfil quebrado — CORRIGIDO (sem deploy)

**Achado do mantenedor, 2026-09-11:** `https://discord.com/users/:id` **não abre
perfil nenhum**. O Discord não expõe URL pública de perfil — nem por username, nem
por ID. O campo guarda o user de **exibição**, não identificador navegável.

**Pergunta que definiu o escopo**, do mantenedor: *"o que me importa é se o código
atual ainda está replicando o problema de discord para novas mesas"*.

**Resposta: sim, estava.** `toDiscordUserId` (`safeExternalUrl.ts:199-207`) decidia
puramente pelo **formato do valor** — snowflake de 17-20 dígitos ou menção `<@id>` —
sem nenhuma condição de origem, data ou status da mesa. O campo do editor é texto
livre, então um mestre colando um ID copiado hoje reproduzia o link quebrado. As 33
mesas em produção eram sintoma; o gerador estava vivo.

**Distribuição medida** (33 contatos Discord): `username-texto` 27, `snowflake-puro` 5,
`mencao-<@id>` 1. Ou seja, **6 de 33** viravam link quebrado — era exceção, não a
regra. (Correção a um relato anterior do agente, que descreveu o caso numérico como
comportamento geral.)

**Corrigido em** `TableContactsBlock.tsx`: username agora é sempre texto, nunca link.
Ponto único de geração no monorepo — `rtk rg "discord.com/users" apps packages` → **0
ocorrências** (era 2). O comentário histórico do achado de 2026-07-08 foi reescrito,
não apagado (§"comentário explicativo não se perde").

`toDiscordUserId` **continua exportada** e consumida por `ContactMethodsEditor.tsx` e
`MestreContactMethods.tsx` — deliberadamente não removida, porque o papel dela nesses
dois pontos não foi medido.

**Validação:** `rtk tsc -b` → No errors found; `rtk vitest run src/test/contactXss.test.tsx`
→ **28/28 PASS**.

**Relação com SEO:** indireta. Link quebrado em página pública é sinal de qualidade
ruim, mas não foi medido como causa dos 736. Corrigido por §Bug achado, não como task
desta spec.

---

### Arquivos de log com nome corrompido

`apps/mesas/frontend/` contém arquivos de log com nome corrompido, resíduo de sessão
anterior de agente sob shell Windows:

```
C:tempeslint.log  494B      C:temptsc-baseline.log  497B
C:tempeslint2.log   0B      C:temptsc-final.log       0B
C:temptsc-after.log 0B      C:temptsc-v2.log          0B
```

São lixo de execução (redirecionamento `>` com caminho Windows dentro de shell POSIX),
não artefato de build. Não afetam SEO. Registrado aqui por ter sido medido durante a
investigação; remoção é trivial e entra em qualquer commit da spec que o mantenedor
autorizar.

---

## Ações que exigem aprovação nominal (nenhuma executada)

1. `UPDATE posts SET canonical = NULL` nos 105 divergentes, em `site` (T3.2).
2. `INSERT` de 105 linhas em `redirects`, em `site` (T2.2). Rollback: `DELETE` pelos
   `from_path` inseridos.
3. Deploy do `mesas` — status HTTP é comportamento observável (T1.2/T1.3), e é o que
   leva o sitemap corrigido (T1.4) ao Google.
4. Export + rebuild + deploy do `site` (T3.3).
5. Mudança de arquitetura de renderização do `mesas` para SSR (T4.1/T4.2) — altera
   build e deploy. **Decisão tomada** (2026-09-11); falta autorizar a execução.

**Saíram da lista em 2026-09-11** (achado de auditoria, T2.1): `Dockerfile`/nginx para
os 301 e mudança em Cloudflare. O mecanismo de redirect já existe no repo
(`server.ts:287-294` + tabela `redirects`), então a F2 é `INSERT`, não mudança de
infra — e não aciona a trava de `deploy-flow.md` §1.

Aprovação é por ação e não acumula (§Autorização).
