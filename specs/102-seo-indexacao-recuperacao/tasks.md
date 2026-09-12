# Tasks 102 — Recuperação de indexação e ranking

Estado atual de cada task. **Um bloco por task, reescrito** — nunca anexar bloco
novo abaixo do antigo (§Conclusão de Tarefas).

Ordem conforme `plan.md` §1. Frentes independentes: F1 não bloqueia F2/F3.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` concluída e medida · `[!]` bloqueada

---

## F1 — `mesas`: soft-404 e divergência sitemap/SSR — **CÓDIGO COMPLETO, SEM DEPLOY**

**Estado em 2026-09-11.** T1.1, T1.2, T1.3 e T1.4 implementadas e medidas. T1.4 está
em `dev` (commit `826b44f`); T1.1/T1.2/T1.3 estão **não commitadas** na branch
`fix/102-f1-mesas-soft404` (criada de `origin/dev` `25b6b7c`).

Diff aguardando autorização de commit: 3 arquivos alterados
(`utils/tableVisibility.ts`, `routes/tables.ts`, `routes/og.ts`), 2 testes novos
(`utils/tableVisibility.equivalence.test.ts`, `routes/og.seo.test.ts`) e os artefatos
de `verify:api` regenerados (só números de linha).

Validação: `tsc` limpo · **1175/1175** testes · lint limpo · `verify:api` breaking=0.
Ambos os testes novos passaram por **teste de mutação** (provado que falham quando a
regra quebra), não só por verde.

Pendências nomeadas, nenhuma bloqueando as demais frentes:
1. **Deploy do `mesas`** — sem ele nada chega ao Google (aprovação nominal).
2. **Espelho `apps/mesas/frontend/src/utils/tableVisibility.ts`** segue divergente —
   unificar exige criar pacote compartilhado (aprovação nominal, T1.1 item 3).
3. **Sugestões de mesas vigentes no corpo do `410`** (aceite 4 de T1.3) não
   implementadas — trabalho de frontend, não afeta o status HTTP.
4. Teste de equivalência **skipa em CI** sem `MESAS_TEST_DATABASE_URL` (decisão de
   infra pendente).

### [x] T1.1 — Unificar o critério de visibilidade de mesa — teste de equivalência ENTREGUE

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

**Escopo desta task:**
1. ~~Criar o helper~~ — já existia; era "ligar o SQL ao sitemap" (feito em T1.4).
2. ~~Teste de equivalência objeto↔SQL~~ — **ENTREGUE** (detalhe abaixo).
3. Unificar o espelho do frontend — **não é executável nesta spec e não bloqueia as
   demais tasks.** Medido em 2026-09-11: `ls packages/` devolve `analytics, auth,
   catalog-client, catalog-matching, catalog-ui, changelog, comments, config, content,
   content-editor, email, feedback, image-editor, media, ui` — **não existe pacote de
   domínio/visibilidade**. Subir a regra significa **criar pacote novo**, que exige
   aprovação nominal própria (§Autorização) e não foi pedida. Enquanto não houver, o
   espelho `apps/mesas/frontend/src/utils/tableVisibility.ts` segue divergente; o item
   fica nomeado aqui como bloqueio, não como pendência silenciosa.

**Entregue 2026-09-11 (sem deploy):**
`apps/mesas/backend/src/utils/tableVisibility.equivalence.test.ts` (arquivo novo).
14 casos nos limites de
`LEAST(COALESCE(starts_at, created_at + INTERVAL '5 days'), created_at + INTERVAL '5 days')`
— antes, depois, ±1 min do limite exato, `starts_at` nulo, `starts_at` antes/depois
do limite de criação, e `origin` manual/nulo. Seleciona por `importedTableIsCurrentSql`
e filtra o mesmo conjunto por `isImportedTableExpired`; falha se os ids divergirem.

Decisões de desenho, com o motivo medido:
- **Tabela `TEMP`, não `tables`.** A regra só toca `origin`/`created_at`/`starts_at`,
  então o teste não depende do schema de `tables` nem escreve em tabela de negócio.
- **`pg` + `describe.skipIf(!pool)` + `MESAS_TEST_DATABASE_URL`** — mesmo padrão de
  `apps/accounts/src/communityReadIntegration.test.ts`. Medido antes de escolher:
  `pg`, `kysely`, `@types/pg` e `vitest` **já são deps** do backend do `mesas`
  (`package.json:63,65,75,82`), então **zero pacote novo** e nenhuma aprovação
  necessária. PGlite existe no monorepo mas só em `apps/site`, e não resolve a partir
  do `mesas` (pnpm isola por pacote) — adicioná-lo seria pacote novo.
- Compilar a query sem executá-la **não serviria**: o que diverge é semântica de data
  (`LEAST`/`COALESCE`/`INTERVAL`, `NOW()` do servidor × relógio do Node), que só
  aparece rodando no Postgres.

**Validação — executado de verdade, não skipado.** Postgres 16 efêmero em Docker
(`postgres:16-alpine`, porta 55432, `--rm`, derrubado ao fim):
- `MESAS_TEST_DATABASE_URL=… rtk vitest run …equivalence.test.ts` → **1/1 PASS**
- **Teste de mutação (prova que detecta divergência):** alterado `INTERVAL '5 days'`
  → `'9 days'` **só no fragmento SQL** → o teste **FALHA** (`expected [ …(11) ] to
  deeply equal [ …(9) ]`). Mutação revertida; `rtk git diff --stat` do arquivo vazio.
  Um teste que só passa não prova que trava nada.
- `rtk tsc -p tsconfig.json --noEmit` → No errors found

**Bloqueio conhecido (não impede o aceite):** sem `MESAS_TEST_DATABASE_URL` o arquivo
**skipa em CI** — hoje não trava nada lá. Ligá-lo exige serviço Postgres no workflow,
que é mudança de infra/CI e **precisa de decisão do mantenedor**. Está provado que
roda e que detecta a divergência; o que falta é o gatilho automático.

---

### [x] T1.2 — Status HTTP correto para mesa inexistente — IMPLEMENTADO (sem deploy)

**Problema.** `routes/og.ts` respondia `res.status(200)` com "Mesa não encontrada" e
canonical auto-referente. Soft-404 é excluído da indexação pelo Google e consome crawl
budget do domínio.

**Entregue 2026-09-11, no mesmo diff de T1.3** (a classificação é uma só; separar a
implementação duplicaria a regra). Detalhe completo no bloco de T1.3 abaixo.

- Slug inexistente → **`404`**; o corpo segue sendo o app.
- Resposta de erro **sem** `<link rel=canonical>` — via `stripCanonical()`, função
  nova em `og.ts`. Canonical continua obrigatório em página que existe; a exceção
  vive num lugar só.

**Achado lateral, corrigido junto (não estava na spec).** `/og/mestre/:slug` tinha o
**mesmo defeito**: mestre inexistente devolvia `200` com "Mestre não encontrado" e
canonical auto-referente. Agora `404` sem canonical. Perfil não tem estado
"encerrado" — ou o slug existe, ou nunca existiu —, então aqui não há `410`.

**Aceite — coberto por teste, não por `curl` manual** (`og.seo.test.ts`, ver T1.3):
slug inexistente → `404`; mestre inexistente → `404`; nenhum dos dois emite canonical.
O `curl` contra produção só é possível **após deploy** (bloqueio abaixo).

---

### [x] T1.3 — Destino da mesa expirada — `410 Gone` + página útil — IMPLEMENTADO (sem deploy)

**Decisão do mantenedor (2026-09-11):** seguir a recomendação medida — *"decisões de
produto também são pesquisáveis sobre a melhor eficácia, o que o mercado melhor
entende ou as melhores práticas para SEO e usuário"*. A opção foi escolhida com o
catálogo medido e a prática de mercado citada, não por preferência do agente.

**Entrega: `410 Gone` com corpo útil.** O status é de remoção deliberada; o corpo
não é uma página de erro seca. Ver "Camada de UX" abaixo — é ela que resolve a parte
"usuário" da decisão, e sem ela o `410` sozinho seria pior que o estado atual.

**Resolvido em 2026-09-11: a regra de expiração de 5 dias está CORRETA e permanece.**
O mantenedor confirmou o porquê: *"mesas normalmente fecham em 2, 3 dias as vagas,
principalmente mesas gratuitas, os mestres esquecem de arquivar elas."* A expiração
automática existe justamente porque o mestre não arquiva. Não reabrir esta regra;
não construir fluxo de lembrete (ele marcou como não prioritário).

Isso **fecha uma bifurcação**: a correção era o sitemap parar de anunciar as expiradas
(T1.4, feito), não afrouxar o prazo.

**Por que `410` e não `301` — medido no catálogo de produção (2026-09-11).**

A prática de mercado é unânime no critério, não no código: **301 só quando existe
substituto genuinamente equivalente**; sem ele, `404`/`410` é melhor do que redirect
para algo irrelevante. John Mueller é explícito que redirecionar item expirado para
home ou categoria genérica faz o Google tratar como **soft-404** — exatamente o
defeito que esta spec existe para eliminar (achado C). Seria trocar um soft-404 por
outro.

Medição que decide (`mesas-db`, `archived_at IS NULL AND status='active'`),
**tirada em 2026-09-11**:

**Sobre os dois números que aparecem na spec (47 e 51).** Não é inconsistência: o
catálogo rotaciona — mesa expira em ≤ 5 dias e mesa nova entra todo dia. `51 de 92` é
a varredura do sitemap servido (§2.2 da `spec.md`), de uma data anterior; `47 de 88` é
a consulta ao banco de 2026-09-11. **A canônica para decidir T1.3 é a de 2026-09-11**,
porque é a que mede o substituto do mesmo mestre. A proporção não se move (53% × 55%),
que é o que sustenta a decisão; o valor absoluto de qualquer nova medição será
diferente outra vez, e isso é esperado.

| Métrica | Valor |
|---|---|
| Mesas expiradas pela regra | **47** de 88 ativas (53%) |
| Expiradas **com outra mesa vigente do mesmo mestre** | **0** |
| Expiradas com mesa vigente do mesmo sistema | 23 |
| Idade das expiradas | 6 a 27 dias |

**0 de 47** têm substituto do mesmo mestre — o único destino que seria de fato
"essencialmente a mesma coisa". Redirecionar para a listagem do sistema (23 casos)
é redirect para categoria: é o caso que Mueller nomeia como soft-404. Logo o `301`
está descartado **por medição**, não por preferência.

Dois fatores reforçam: as expiradas têm 6–27 dias (sem tempo de acumular backlink,
então não há autoridade a preservar — o outro motivo clássico de 301), e a
rotatividade é alta (53% do catálogo expira), o que tornaria redirect em massa para
poucos destinos um padrão que a própria literatura marca como suspeito.

**Por que `410` e não `404`.** Não é velocidade de deindexação: a doc do Google diz
que *"All `4xx` errors, except `429`, are treated the same"* (verificado 2026-09-11,
`http-network-errors`). O critério é **semântica honesta**: a mesa **existiu** e foi
removida por regra de negócio conhecida (5 dias / data do evento), não é URL
inexistente. `410` é o código que descreve isso, e a separação deixa o Search Console
legível — `404` passa a significar "slug errado" (T1.2) e `410`, "mesa encerrada".
São dois defeitos diferentes, e misturá-los num código só cega o diagnóstico.

**Camada de UX — obrigatória, é o que torna a decisão boa para o usuário.** Status
de erro e página útil não são excludentes: serve-se corpo prestativo **com** o código
correto. O link antigo no WhatsApp/Discord não pode terminar em beco sem saída. A
página de `410` mostra:

1. Que aquela mesa específica encerrou (com o título, para a pessoa reconhecer o que
   procurava — não "página não encontrada" genérico);
2. Mesas vigentes do **mesmo sistema** (23 das 47 têm; é conteúdo relacionado legítimo
   aqui, porque é sugestão visível ao usuário, não redirect invisível ao crawler);
3. Busca/atalho para o catálogo.

Essa é a diferença entre `301` e `410`+sugestões: no `301` o Google vê afirmação
falsa de equivalência; no `410`+página, a pessoa recebe a alternativa **e** o índice
recebe a verdade.

**Correção 2026-09-11 (achado de auditoria), preservada:** a versão anterior dizia
que "410 sai mais rápido do índice". **Sem base na fonte** — todos os 4xx (exceto
429) são tratados igual. Não usar velocidade como critério aqui.

**`eventStatus` saiu da lista** — T4.4 descartou `Event`, então não há status de
evento para carregar.

**Alcance:** 51 mesas hoje (medido), e crescente.

---

#### Implementação entregue 2026-09-11 (T1.2 + T1.3 no mesmo diff, sem deploy)

**A decisão de desenho que mais precisa de conferência: a matriz subiu para o helper.**
A matriz dos 6 estados de `table_status` **já existia** em `routes/tables.ts`, correta,
mas valia só para a **API JSON**. O SSR (`og.ts`) — que é o que Googlebot, WhatsApp e
Discord leem — não a aplicava. Copiá-la para o `og.ts` seria a **quarta** escrita da
mesma regra (detalhe, OG, sitemap, espelho do frontend), que é o defeito que este
módulo existe para evitar e que já causou 3 divergências em produção.

Então virou `classifyTablePublicDisposition(table): 'ok' | 'gone' | 'not_found'` em
`utils/tableVisibility.ts`, e os dois consumidores derivam dela.

**Consequência que o mantenedor precisa conferir:** isso adicionou um ramo que a
versão original não tinha — **`full` arquivada/expirada → `gone` (410)**. Antes caía
em `404` na API JSON, contradizendo o `410` que a *mesma mesa* recebe em `active`; o
estado observável é idêntico (a divulgação foi retirada), e a vaga cheia não muda
isso. **Se preferir preservar o comportamento antigo, é uma linha na função.**

Arquivos (3 alterados, 2 testes novos):
- `utils/tableVisibility.ts` — `classifyTablePublicDisposition` + tipo
  `TablePublicDisposition`. Recebe mesa **não-nula** de propósito: aceitar `null`
  quebrava o narrowing de tipo no chamador e forçaria `!` nos dois consumidores.
- `routes/tables.ts` — matriz local (~30 linhas) trocada pela chamada ao helper.
  Comportamento JSON idêntico, exceto o ramo `full`+`saiuDoAr` acima.
- `routes/og.ts` — o defeito central. `404`/`410`/`200` conforme a disposição, e
  `stripCanonical()` nas respostas de erro. O `410` carrega o **título da mesa** no
  `<title>` (a pessoa que clicou num link antigo no WhatsApp precisa reconhecer o que
  procurava) e o corpo continua sendo o app completo — é ele que monta a tela "Mesa
  Encerrada" a partir do `410` da API. Status de erro e página útil não são
  excludentes.

**A camada de UX do aceite 4 já existia e não precisou ser construída.**
`buildClosedTablePayload` (`tables.ts:470`) já devolve título, data de encerramento e
`id` para a conversa preservada, e o frontend já tem `pages/closedTable.ts` +
`MesaPage.tsx`. O que faltava era **o crawler receber o status certo**, não a tela.

**Teste novo: `routes/og.seo.test.ts` (14 casos).** `og.ts` é a rota que o Google lê e
**não tinha teste nenhum** até aqui. Cobre: `200` para pública e para `full`; `404`
para inexistente, `draft` e `pending_review`; `410` para expirada, arquivada, `ended`
e `cancelled`; ausência de canonical nas duas respostas de erro; presença do título da
mesa e do `<div id="root">` no corpo do `410`; e as duas rotas de `/og/mestre/`.

**Validação (sobre `dev` = `25b6b7c`, após rebase da branch):**
- `rtk tsc -p tsconfig.json --noEmit` → **No errors found**
- `rtk vitest run` (backend `mesas`) → **1175/1175 PASS** (eram 1161; +14)
- `rtk pnpm run lint` → limpo
- `pnpm verify:api` → exit 0, **breaking=0** nos 6 apps. Os artefatos regenerados
  (`api-map`/`api-inventory`) mudaram **só números de linha** de `tables.ts` —
  nenhuma rota alterada.
- **Teste de mutação:** revertido `status(encerrada ? 410 : 404)` → `status(200)` →
  **4 falhas** em `og.seo.test.ts`. Mutação revertida e verde reconfirmado.

**Aceite, item a item:**
1. mesa expirada → `410` — ✅ coberto por teste; `curl` em produção só após deploy.
2. slug inexistente → `404` — ✅ idem (T1.2).
3. `410` sem canonical auto-referente — ✅ testado.
4. corpo do `410` nunca é página vazia — ✅ serve o app + título da mesa. **Ressalva:
   a lista de "mesas vigentes do mesmo sistema" NÃO foi implementada** — a tela atual
   mostra a mesa encerrada e a conversa, sem sugestões. Isso é trabalho de frontend
   (F4 mexe nas mesmas telas) e não afeta o status HTTP, que é o que tira o soft-404
   do índice. **Fica nomeado como pendente, não como entregue.**
5. nenhuma expirada no sitemap — ✅ T1.4, commit `826b44f`.

**Bloqueio:** só chega ao Google **após deploy do `mesas`** (aprovação nominal).
Branch `fix/102-f1-mesas-soft404`, criada de `origin/dev` `25b6b7c`. **Nada commitado
ainda.**

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

**Estado em 2026-09-11.** T2.2 **carregada em produção** (105 linhas, autorizada após
backup). T2.1 entregue e medida, **sem deploy** — as correções não valem em produção
ainda. T2.3 varrida: **100/105**, com as 5 exceções explicadas abaixo (nenhuma é
defeito de dado ou de código).

Validação: `tsc` limpo nos dois apps · **149/149** no `site` (20 em
`server/redirect-cache.test.ts`) · **1175/1175** no `mesas` · lint limpo ·
`verify:api` breaking=0.

**Achados de review tratados (PR #315), todos com teste de mutação:**

1. *Query repetida se perdia.* `withOriginalQuery` usava `params.has(key)` dentro do
   laço; após anexar o primeiro valor a chave passava a existir e `?tag=a&tag=b`
   virava `?tag=a`. Corrigido com snapshot das chaves do destino antes do laço.
2. *Conflito de chave normalizada era silencioso.* `/legacy` e `/legacy/` colapsam na
   mesma chave; com destinos diferentes a última linha vencia sem sinal. Agora a
   primeira vence de forma determinística e o conflito vai para `console.warn`. **Não**
   se descarta a recarga inteira, como o review sugeria: derrubaria os outros 104
   redirects válidos por causa de uma linha ruim.
3. *Varredura derivava o esperado da tabela que verifica.* Um redirect apagado sumiria
   de `pairs` e a varredura diria "104/104 ok" — verde por ausência de evidência. O
   conjunto agora vem de `scripts/fixtures/redirects-legados-105.tsv`, congelado na
   carga, e ausência na tabela conta como falha.
4. *Fallback de erro do `og` devolvia 200 com canonical.* Falha de banco recriava o
   soft-404 que a F1 corrige. Agora 503 + `stripCanonical`.
5. *Teste de equivalência skipava em todo gate.* `MESAS_TEST_DATABASE_URL` não existia
   em nenhum workflow (medido), então `describe.skipIf` omitia a única prova de que
   `importedTableIsCurrentSql` e `isImportedTableExpired` não divergem. Ligado no
   `ci.yml` ao Postgres do job, no mesmo padrão de `COMMUNITY_TEST_DATABASE_URL`.
   **Não medido:** sem Postgres local, a execução real só será observável no run do CI.

**Achado próprio, fora do review:** `reloadRedirects` fazia `map.clear()` antes de
repopular, então o middleware servia 404 durante a repopulação, a cada 30 s. Agora
monta um mapa novo e troca de uma vez.

**Achado de infra que muda o diagnóstico de SEO — cache do Cloudflare varia por
user-agent.** Medido na ruleset `http_request_cache_settings` (regra principal):
o predicado termina em `not (user_agent contains "mobile"|"iphone"|"android"|…)`, e há
regra anterior com `cache: false` para mobile. Consequência medida na mesma URL,
no mesmo instante:

| Cliente | Status | `cf-cache-status` |
|---|---|---|
| mobile (iPhone UA) | **301** | `DYNAMIC` (vai à origem) |
| desktop (Chrome UA) | **404** | `HIT`, `Age: 5383` |

As 4 URLs estão **corretas para o Googlebot**, que rastreia predominantemente como
mobile, e erradas para visitante desktop. **Purge seletivo por URL não resolveu**:
executado duas vezes (API `success: true`), a segunda com 16 variantes de chave
(com/sem barra, com/sem `www`) — a entrada desktop sobreviveu às duas. O que
resolveria é purge geral da zona, fora do escopo autorizado.

### [x] T2.1 — Camada do redirect — dois defeitos do middleware CORRIGIDOS

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

**Dois defeitos do mecanismo, medidos em 2026-09-11 — reabrem trabalho de código.**
O subsistema existe e está ligado, mas popular a tabela não basta: nas duas formas
abaixo o 301 não acontece. Ambos são correção em `apps/site/server/`, sem infra.

*Defeito 1 — match exato, sem normalização de barra final.* `redirect-cache.ts:15-16`:

```ts
export function lookupRedirect(path: string): { to: string; code: number } | undefined {
  return map.get(path);
}
```

`Map.get` é igualdade estrita. Com `from_path = '/noticias/x/'` gravado, a requisição
a `/noticias/x` (sem barra) não casa e cai em **404** — e é essa a forma que sobrevive
em link externo e backlink antigo, que é justamente o que a F2 quer recuperar.
Astro usa `trailingSlash: "always"`, então as duas formas precisam resolver.

*Defeito 2 — a query string é descartada.* `server.ts:291-296`:

```js
const hit = lookupRedirect(req.path);
if (hit && hit.to !== req.path) { res.redirect(hit.code, hit.to); return; }
```

`req.path` **exclui** a query string, e `res.redirect` recebe só `hit.to`. Resultado:
`/noticias/x/?utm_source=fb` redireciona para `/blog/x/` sem os UTMs — a atribuição de
campanha some do GA4 em todo tráfego legado. O próprio arquivo já conhece a distinção:
`server.ts:87-92` usa `req.originalUrl` em vez de `req.path` para `/admin/assets/`.

**Entregue em 2026-09-11 (sem deploy):**

1. **Chave canônica no cache** (`server/redirect-cache.ts`). `canonicalKey` remove a
   barra final (exceto na raiz) e é aplicada **na escrita e na leitura** do `Map` — o
   `from_path` gravado resolve nas duas formas, independente de como a linha entrou.
   Escolhido em vez de "tentar a chave e depois a alternada" porque a busca dupla ainda
   dependeria da forma gravada quando as duas variantes existissem na tabela.
2. **`withOriginalQuery`** (mesmo arquivo, exportada e testada isolada). Reanexa ao
   destino a query de `req.originalUrl`; se o `to_path` já tiver query própria, mescla
   por chave, **o destino vencendo** — o destino é editorial, a origem é o que o
   visitante trouxe. Preserva fragmento (`#`) depois da query.
3. **Middleware** (`server/server.ts:293-295`) passou a chamar `withOriginalQuery`.

**Aceite — medido (`server/redirect-cache.test.ts`, 14 casos, 14/14):**

1. `/noticias/<slug>/` → 301 → `/blog/<slug>/` → 200 ✓
2. `/noticias/<slug>` (**sem** barra) → 301 → `/blog/<slug>/` → 200 ✓ — cobre também o
   caso inverso, `from_path` gravado sem barra e requisição com barra.
3. `?utm_source=fb&utm_medium=social` preservados no `Location` ✓
4. Sem cadeia: o `Location` devolve 200 direto no teste de integração com `express` ✓

Casos-limite cobertos além do aceite: raiz `/` não vira string vazia, `?` sem conteúdo
não polui o destino, `code` ausente cai em 301, `POST` não redireciona.

**Ainda não em produção — e os dois defeitos seguem medidos e vivos lá.** Com a tabela
já populada (T2.2), a ausência do deploy do `site` fica observável em produção:

- `/blog/analises/dd-2024-orcs-…` **sem barra final** → **404** (com barra → 301)
- `…/?utm_source=fb&utm_medium=social` → 301 com `Location` **sem os UTMs**

Ou seja: hoje o backlink que chega sem barra continua perdido, e a atribuição de
campanha do tráfego legado ainda some do GA4. Resolve com o deploy (aprovação nominal).

---

### [x] T2.2 — Popular a tabela `redirects` — CARREGADA EM PRODUÇÃO

**Entrega.** `INSERT` na tabela `redirects` de `site` — um par 1:1 por post
divergente, sem cadeia, `code = 301`.

**Ferramenta entregue em 2026-09-11:** `apps/site/scripts/redirects-legados.ts`, com
três modos. `plan` lista os pares derivados, conta por prefixo e **aborta se houver
cadeia** (destino de um par que seja origem de outro), sem escrever nada. `load` faz a
carga via `addRedirect` (idempotente por `ON CONFLICT`) e imprime a contagem final.
`verify --base <url>` é a varredura de T2.3. Nada foi executado contra produção.

**Fonte dos pares.** Derivados do banco, não digitados — o script roda exatamente a
`SELECT` abaixo, não uma cópia reescrita:

```sql
SELECT regexp_replace(canonical, '^https?://[^/]+', '') AS from_path,
       '/blog/' || slug || '/'                          AS to_path
FROM posts
WHERE canonical IS NOT NULL
  AND regexp_replace(canonical, '^https?://[^/]+', '') <> '/blog/' || slug || '/';
-- esperado: 105 linhas
```

O predicado é o **mesmo** `regexp_replace` usado em T3.2 e nas medições de §2 — de
propósito. Comparar a URL absoluta literal daria contagem diferente se algum canonical
tiver `http://` em vez de `https://`, e as duas tasks operam sobre o mesmo conjunto de
105 linhas. Predicados divergentes aqui produziriam redirect para post cujo canonical
T3.2 não limpou, ou o inverso.

Prefixos cobertos (medido, 2026-09-11): `/noticias/` 64, `/blog/<categoria>/` 38,
`/dnd/` 18, `/downloads/` 3, `/entrevistas/` 2. Os 20 já corretos **não** entram.

**105 é o número certo, mesmo com 994 URLs em 404 no GSC — não reabrir.** A diferença
já foi investigada e explicada em `spec.md` §2.4.2: as URLs do WP carregavam categoria
na rota (média 2,42 segmentos, máx. 5, em **122** pastas distintas) e somavam páginas
de arquivo (`/category/`, `/tag/`, `/author/`, `/feed/`, paginação), todas medidas hoje
como 404. O redirect é **por post**, não por URL de arquivo.

O que **não** entra, por decisão fundamentada e não por omissão:
- Arquivos de categoria/tag/autor do WP — não têm destino 1:1; redirecioná-los para a
  listagem seria soft-404, o defeito que a F1 corrige.
- `/magia/`, `/doc/`, `/dd/` — seções nunca migradas (apenas **1** post casa com
  `%magia%`). Não é URL errada, é conteúdo ausente; 404 é a resposta correta.
- Fundamento oficial: *"The `4xx` status codes, except `429`, have no effect on crawl
  rate"* — 404 não penaliza ranking nem consome orçamento de rastreio.

**`from_path` é caminho, não URL absoluta** — `lookupRedirect(req.path)` compara com
`req.path`. A `SELECT` acima já entrega normalizado; `to_path` também é relativo, pelo
mesmo motivo.

**Exigências de SEO (da pesquisa, confirmadas na fonte):**
- 301 (permanente), nunca 302 — *"301 redirects don't cause a loss in PageRank"*.
- 1:1 direto, **sem cadeia**: o destino tem que devolver 200, não outro 301.
- Manter no ar **≥ 1 ano** — *"at least 1 year"*.
- `trailingSlash: "always"` no Astro: destino termina em `/`.

**Não depende de T3.1.** A dependência registrada aqui até 2026-09-11 ("sem isso o
importador volta a gravar canonical legado") caiu com a refutação da premissa de
T3.1: o importador foi removido em 2026-07-27 (`server.ts:167-169`). Não há
reimportação para regravar nada; as duas tasks são independentes.

**Autorização nominal necessária.** `INSERT` de 105 linhas em `site` (produção).
Rollback: `DELETE FROM redirects WHERE from_path IN (…)`, reversível.

**Idempotência medida.** `addRedirect` (`apps/site/db/repo/redirects.ts:9`) usa
`ON CONFLICT (from_path) DO UPDATE SET to_path = EXCLUDED.to_path, code = EXCLUDED.code`.
Reexecutar a carga não duplica linha nem falha — o aceite pode rodar duas vezes.

**Executada em 2026-09-11, autorizada pelo mantenedor após backup.**

Backup antes da escrita (condição da autorização): `pg_dump -Fc` de `site-prod-db`,
1,5 MB, integridade verificada por `pg_restore -l` (128 objetos; `posts` e `redirects`
presentes). Em `/home/ubuntu/backups/102-f2-redirects/site-prod-20260911-2034.dump` e
copiado para `C:\projetos\artificiobackup\102-f2-redirects\` — SHA-256 idêntico nos
dois lados (`37d77ce6…828eb`).

**Consultas de refutação rodadas ANTES da carga** (não só as que confirmariam):

| Verificação | Resultado |
|---|---|
| Pares divergentes em prod | **105** (confirma o número da spec) |
| `redirects` antes da carga | **0** |
| Cadeias (destino que é origem de outro par) | 0 |
| Origens duplicadas com destinos diferentes | 0 |
| Colisões sob a normalização de barra de T2.1 | 0 |
| Destinos não publicados (`status <> 'publish'`) | 0 |
| Pares com formato inválido | 0 |

Carga em transação única: `INSERT 0 105`, todos com `code = 301`.

**Aceite — medido.**

1. `SELECT count(*) FROM redirects` → **105**, `count(*) FILTER (WHERE code = 301)` →
   **105**. `/blog/analises/dd-2024-orcs-monstros-ou-personagens/` → **301** →
   `/blog/dd-2024-orcs-monstros-ou-personagens/` → **200** ✓
2. Segunda execução da carga: `INSERT 0 105`, contagem final **105** — idempotência
   provada, sem duplicar linha ✓

**A carga NÃO passou pelo `scripts/redirects-legados.ts`.** O modo `load` roda via
`tsx` e exigiria `DATABASE_URL` de produção montada no container. Usei `INSERT` em SQL
direto, com o **mesmo** predicado e o **mesmo** `ON CONFLICT` do `addRedirect`. O modo
`load` do script segue não exercitado contra produção.

---

### [~] T2.3 — Varredura de regressão dos 105 — RODADA: 100/105

**Entregue em 2026-09-11.** Modo `verify --base <url>` de
`apps/site/scripts/redirects-legados.ts`. Para cada par, faz duas requisições com
`redirect: "manual"`: exige **301** no primeiro hop e **200** no `Location`, o que
prova a ausência de cadeia; confere ainda que o `Location` é o `to_path` esperado
(comparando sem barra final, já que a normalização de T2.1 aceita as duas formas).

**Decisão de desenho:** a varredura lê os pares da tabela `redirects` e só cai para
`posts` se a tabela estiver vazia. Motivo medido: T3.2 apaga o `canonical`
(`SET canonical = NULL`); se a varredura dependesse só de `posts`, ela pararia de
funcionar assim que a F3 rodasse — justamente quando a regressão importa mais.

**Varredura rodada em 2026-09-11 contra `https://artificiorpg.com`: 100/105** resolvem
301 → 200 sem cadeia. As 5 exceções, todas investigadas até a causa:

- **1 falha transitória de rede** (`curl` devolveu `000` em
  `/noticias/project-dante-cancelado-…`). Reexecutada isolada: **301 correto**.
- **4 são cache de borda, não defeito.** `/blog/guias/rpg-em-geral/o-que-e-rpg/comecar-aventura-rpg-impacto/`,
  `/dnd/dnd-2024-guia-completo-…`, `/noticias/internacional/livro-dos-monstros-…` e
  `/noticias/paizocon-2025-…`. Medido em cada uma: a linha existe na tabela com bytes
  idênticos ao path requisitado (md5 conferido), o destino devolve **200**, e o app
  responde **301** quando consultado direto no container
  (`docker exec site-prod-app`, contornando o Cloudflare). O 404 vem da borda —
  detalhe e o achado de variação por user-agent no cabeçalho da F2 acima.

**Por que as outras 101 passaram:** `Age: 309` (entrada cacheada **depois** da carga)
contra `Age: 5212` nas 4 (cacheada em 10/09, **antes**). A diferença é só qual versão
a borda guardou, não o dado.

**Aceite não fechado.** Falta 105/105 limpo, o que depende de invalidar a entrada
desktop dessas 4 (purge seletivo não resolveu) e do deploy do `site` para T2.1.

---

## F3 — `site`: canonical legado

### [ ] T3.1 — Fechar a origem do canonical divergente — REESCRITA (2026-09-11): não há importador

**Premissa anterior refutada.** A task dizia "importador para de gravar canonical do
WP". Medido em `apps/site/server/server.ts:167-169`, verbatim:

```
// POST /admin/import (re-import do WP -> store) foi REMOVIDA em 2026-07-27 junto com o importador.
// Disparava pnpm run import, script que deixou de existir — manter a rota daria 500 em vez de 404,
// e o WP que ela importava está fora do ar desde o cutover (D074/spec 029).
```

Não existe importador para corrigir. Os 105 canonicals divergentes são **dado
legado congelado**, não fluxo ativo: nada no stack atual regrava `posts.canonical`
com URL do WP.

**Consequência na ordem das tasks.** A dependência T2.2→T3.1 é **falsa como estava
escrita** — não há risco de reimportação regravar o que T3.2 limpar. T3.2 pode rodar
sem esperar T2.2.

**Único caminho de escrita restante:** o override editorial via admin. `[slug].astro:21`
honra `post.seo.canonical` quando presente; o editor pode preencher pelo admin. O
recurso é legítimo e **se preserva** — o problema nunca foi o mecanismo, foi o dado
que o importador removido deixou para trás.

**Medido para descartar risco:** `SELECT count(*) … canonical NOT LIKE 'https://artificiorpg.com%'`
→ **0**. Nenhum canonical aponta para domínio externo; não há sindicação legítima a
preservar. Os 21 "corretos" são posts nascidos no stack novo, não override editorial.

**Entrega desta task (documental + guarda):**

1. Registrar no código do admin/editor que canonical vazio é o default correto — só
   se preenche para sindicação real, nunca "por completude".
2. Guarda de regressão: teste que falha se qualquer canonical persistido apontar para
   host diferente de `artificiorpg.com`.

**Aceite:**

1. `rtk rg "run import" apps/site` → 0 ocorrências de script de importação vivo.
2. Teste da guarda falha ao inserir canonical com host externo e passa com `NULL`.
3. Nenhuma linha da spec afirma que T3.2 depende de T2.2.

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

**Não depende de T3.1.** "Senão a próxima importação regrava" pressupunha um
importador que não existe desde 2026-07-27 (`server.ts:167-169`). T3.2 pode rodar
assim que a autorização nominal do `UPDATE` sair; T3.1 é guarda de regressão, não
pré-condição.

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

### [ ] T3.4 — `lastmod` no sitemap do `site`

**Problema, medido em 2026-09-11:**

```
curl -s https://artificiorpg.com/sitemap-0.xml | grep -c "lastmod"   →  0
```

Cada `<url>` do sitemap do `site` traz só `<loc>`. O do `mesas` já emite `lastmod`; o
`site`, não. `apps/site/astro.config.mjs:20` usa `@astrojs/sitemap` com config padrão,
que não deriva data.

**Por que entra nesta spec.** É a única alavanca barata para o Google **redescobrir**
os 126 posts depois que T3.2/T3.3 corrigirem o canonical. Sem `lastmod`, nada no
sitemap sinaliza que o conteúdo mudou, e a redescoberta fica dependendo do ritmo
natural de recrawl — as "semanas a meses" do `plan.md` §9. Google recomenda `lastmod`
explicitamente para conteúdo atualizado, e o usa quando a data é consistente e
confiável (data inventada ou igual para todas as URLs é ignorada).

**Entrega.** `serialize` do `@astrojs/sitemap` preenchendo `lastmod` a partir da data
real de atualização do post (`posts.updated_at`, propagada via `export.ts` →
`posts.json`), não da data do build. Para páginas sem data própria (home, `/blog/`),
omitir o campo em vez de inventar.

**Aceite:**

1. `curl -s https://artificiorpg.com/sitemap-0.xml | grep -c "lastmod"` → ≥ 126.
2. Duas URLs de posts com datas de edição diferentes têm `lastmod` diferentes (guarda
   contra "data do build para todas").
3. Nenhuma URL sem data real recebe `lastmod`.

**Depende de.** T3.3 (mesmo ciclo de export + build + deploy) — cabe no mesmo deploy.

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
normalizadores (`getWhatsAppUrl` em `apps/mesas/frontend/src/features/table/mappers/tableViewMapper.ts:79`, `toSafeDiscordInviteUrl`)
vivem só no frontend. Por §"Compartilhado por padrão", sobem para pacote compartilhado
— não se reimplementam no backend.

---

### [ ] T4.2 — HTML-first nas rotas públicas de mesa e mestre

**Entrega.** Conteúdo e schema no HTML inicial, **iguais para todo user-agent**.
Elimina por construção a divergência bot↔usuário que produziu B, C e E.

**Mecanismo — decidido em 2026-09-11 por pesquisa, não deixado em aberto.** T4.1
decidiu *SSR universal*; faltava **como**. Medido no repo
(`apps/mesas/frontend/package.json`): `react-router-dom` `^7.18.0`, `react` `^19.2.7`,
`vite` `^8.0.16`, nenhum adapter SSR, `"dev": "vite"`.

**Recomendação: React Router v7 em framework mode**, e não Next.js/Remix/Astro:

- É o **mesmo pacote já instalado**. Framework mode é modo de operação do
  `react-router` 7, ativado por `react-router.config.ts` com `{ ssr: true }` — não é
  dependência nova, o que evita a aprovação de lib nova (§Autorização) e a troca de
  stack. O time do React Router declara framework mode como o caminho pretendido para
  a maioria dos apps, SSR ou não.
- Preserva Vite, que já é o bundler do app.
- Servidor Express próprio via `createRequestHandler` de `@react-router/express`,
  servindo `build/client` estático — encaixa no container atual do `mesas` sem trocar
  o modelo de deploy.

**Custos medidos na experiência pública de quem migrou, para não descobrir no meio:**

1. Imports mudam de `react-router-dom` para `react-router` (pacote unificado).
2. Código só-de-browser (`window`, `localStorage`) precisa sair do render e ir para
   `clientLoader`/`clientAction` — é a causa mais citada de quebra na migração.
3. Dependência CJS/ESM mal empacotada quebra no SSR; o contorno é `ssr.noExternal`.
4. Tipagem de loader muda; `react-router typegen` gera os tipos.

A migração **não é mecânica** — os relatos de "uma tarde" são de apps v6→v7 sem SSR.
Tratar como obra, com autorização nominal própria (já registrada em T4.1).

**Escopo das rotas.** Duas famílias públicas, não uma: `/mesas/<slug>` **e** o perfil
de mestre. T4.3 define schema só para mesa; **o perfil de mestre não recebe schema
nesta spec** — entra em HTML-first (conteúdo visível para crawler), que é o que
resolve B/C/E. Schema de `Person`/`ProfilePage` para mestre fica fora de escopo,
declarado aqui para não virar improviso do implementador.

**Nota de dado (de T4.1).** `og.ts` não faz join com `table_contacts` — o HTML que
hoje chega ao Googlebot já nasce sem os contatos. O SSR precisa incluir esse join,
senão troca uma casca por outra.

**Depende de.** T4.1. **Exige autorização nominal** (obra de arquitetura).

**Aceite.**

1. `curl -A GPTBot/1.1` e `-A ClaudeBot/1.0` devolvem HTML com o conteúdo real da
   mesa (hoje: 3.328 B de casca) e `grep -c 'ld+json'` → ≥ 1.
2. Mesma medição na rota de perfil de mestre: conteúdo real, não casca.
3. Navegador e crawler recebem **o mesmo** HTML — `diff` entre as duas respostas
   vazio fora de nonce/timestamp. É o fim do dynamic rendering, não sua ampliação.

---

### [ ] T4.3 — Schema `Product`+`Offer` no `@graph` (sem `Event` — ver T4.4)

**Correção de premissa (2026-09-11).** A versão anterior desta task dizia que o
Google **exige** `VirtualLocation` para evento só-online. **Falso** — verificado na
fonte: `eventAttendanceMode`/`VirtualLocation` nem aparecem na página de `Event`. O
que ela diz é mais forte: *"Virtual experiences with no real-world component aren't
supported."* Mesa online **não é elegível** a rich result de `Event`, ponto. Detalhe
e citações em `plan.md` §5.2.

**Entrega.** Um `@graph` com **um** tipo. Decisão de 2026-09-11 (T4.4): `Event`
descartado.

- **`Product` + `Offer`** — `name`, `description` (T4.5), `image` (quando houver;
  ver regra 3 abaixo), `offers.price`, `priceCurrency` `"BRL"`, `availability`
  (`InStock`/`SoldOut` de `slots_total`/`slots_filled`), `url`.

**Regra pétrea desta task — nenhum fato existe só no JSON-LD.** Toda propriedade
emitida (preço, vagas, data, modalidade) tem de estar no **HTML visível** da mesa.
Duas razões medidas, e as duas apontam para a mesma regra:

- É o que os crawlers de IA de fato leem. No experimento SearchVIU (30/10/2025),
  preço presente só em JSON-LD foi extraído por **0 de 5** sistemas; em HTML visível,
  por 3 de 5. O JSON-LD sozinho entrega zero para busca generativa.
- É o critério pelo qual a ação manual é aplicada: *"Don't mark up content that is
  not visible to readers of the page"* (`sd-policies`). Markup que espelha a página
  não é punível.

**Duas regras obrigatórias, ambas por medição:**

1. **`price` sai de `price_value`/`price_type`, nunca do rótulo do contato.**
   "Ticket / Inscrição" aparece em ~106 contatos (`label ILIKE '%ticket%' OR
   '%inscri%'` → **107** em 2026-09-11; o número oscila com a rotação do catálogo),
   mas 101 dessas mesas são `gratuita` — derivar do rótulo geraria preço falso em
   ~95% dos casos. O que decide é a proporção, não o valor absoluto.

   Não confundir com `channel = 'form'` → 108 (citado em T4.4): são consultas
   diferentes — uma sobre o **rótulo**, outra sobre o **canal** — que por coincidência
   caem perto. Números próximos, fontes distintas.
2. **`availability` deriva de `slots_total`/`slots_filled`, nunca literal.**
   `InStock` com mesa lotada contradiz a página e é exatamente o que a ação manual
   pune.
3. **`image`: `banner_url` primeiro, `cover_url` como fallback, omitir se nenhuma.**
   Decidido por medição (2026-09-11), não por preferência:

   ```
   SELECT count(*) total, count(cover_url), count(banner_url) FROM tables;
   -- 168 | 90 | 145
   SELECT count(*) FILTER (WHERE banner_url IS NULL AND cover_url IS NULL) FROM tables;
   -- 23
   ```

   `banner_url` cobre 145 de 168 (86%) contra 90 de `cover_url` (54%) — por isso é a
   primeira escolha. Ambas são `is_nullable = YES`, e **23 mesas não têm nenhuma**.

   Para essas 23, a regra é **omitir `image`**, nunca emitir placeholder. Medido na
   fonte (`product-snippet`): as propriedades obrigatórias de `Product` são `name` e
   pelo menos um de `offers`/`review`/`aggregateRating` — **`image` não é required**.
   Omitir custa, no pior caso, um snippet menos rico; emitir imagem genérica que não
   está na página viola *"Don't mark up content that is not visible to readers"* e
   cai na regra pétrea desta task.

*(A regra antiga nº 1, `eventAttendanceMode` derivado de `modality`, saiu junto com o
`Event`. O princípio que a motivava — nunca emitir literal onde o dado existe no
banco — está preservado nas duas regras acima. Se `Event` voltar algum dia, a regra
volta com ele: `online`→`OnlineEventAttendanceMode`+`VirtualLocation`;
`presencial`→`OfflineEventAttendanceMode`+`Place`; `hibrida`→`Mixed…`+ambos.)*

**Depende de.** T4.2/T4.1 (SSR). Schema injetado por JS é invisível para crawler de
IA — nenhum executa JavaScript em fetch direto. Sem SSR esta task entrega zero.

**Aceite — SUBSTITUI o aceite F2 anterior, que era inválido.** O anterior verificava
`VirtualLocation` como exigência do Google; testava regra inexistente.

1. Rich Results Test: **`Product` sem erro crítico**.
2. `grep -c '"@type": "Product"'` → 1 no HTML inicial, e
   `grep -c '"@type": "Event"'` → **0** (garante que a decisão T4.4 não regrediu).
3. `curl -A ClaudeBot/1.0` devolve o JSON-LD completo (hoje: 3.328 B de casca).
4. `price` conferido contra `price_value` em uma mesa gratuita e uma paga.
5. **Espelhamento:** cada valor do JSON-LD (preço, vagas, data) aparece no HTML
   visível da mesma página. Sem isso a task não fecha — é a regra pétrea acima.

---

### [x] T4.4 — Elegibilidade de `Event` — DECIDIDO (2026-09-11): descartado, só `Product`+`Offer`

**Duas razões independentes tornam toda mesa do acervo inelegível a rich result de
`Event`** — verificadas na documentação do Google em 2026-09-11, não de memória:

1. **Virtual sem componente físico.** *"Virtual experiences with no real-world
   component aren't supported. Events must take place in a physical location."*
   Medido: `modality` devolve `online | 168` — **zero** presencial, zero híbrida.
2. **Passa por seleção.** *"Events that require membership, invitation or prior
   purchasing of a ticket for attending the event are ineligible."* Regra de produto
   do mantenedor: *"ele vai direto para onde o mestre definiu: link do google forms,
   site, link do whatsapp…"* — o mestre continua filtrando. Medido no banco
   (`SELECT channel, count(*) FROM table_contacts GROUP BY channel`):
   `form 108 | whatsapp 46 | discord 33 | email 1`. **108 contatos são formulário**,
   que é candidatura, não reserva.

   *Citação corrigida em 2026-09-11:* a versão anterior atribuía esse número a
   `uiHelpers.ts:39-51`. **Refutado** — aquele trecho é handler de CTA, não a fonte do
   dado. O número está certo; a referência estava errada e a fonte é o banco.

**Correção do registro anterior.** A versão de 2026-09-11 descartou `Event` citando
só a razão 2, e afirmava que o Google **exige** `VirtualLocation` para evento online.
Essa exigência **não existe** — é de março/2020 (COVID) e saiu da doc. O descarte
estava certo; a justificativa, incompleta e parcialmente falsa.

**Decisão intermediária, já superada — mantida só para explicar o porquê da virada.**
Houve uma decisão de *emitir `Event` assim mesmo* junto de `Product`+`Offer`, sob a
razão *"tudo que puder fazer pessoas chegarem nos sites, é válido"* e sob a premissa
de que *"crawlers de IA e schema.org leem `Event`; não aplicam política do Google"*.
Essa premissa foi **refutada por medição** horas depois (ver bloco seguinte), e o
veredito final está no fim desta task: **`Event` descartado**.

**Opção também descartada por medição:** "emitir `Event` só onde houver componente
físico" cobriria **0 de 168** mesas — o catálogo é `online | 168`.

**Risco e benefício — ambos medidos em 2026-09-11 (pesquisa de mercado). A premissa
da decisão anterior caiu.**

A decisão de emitir `Event` se apoiava em uma frase: *"Crawlers de IA e schema.org
leem `Event`; não aplicam política do Google."* A primeira metade é **falsa** na
prática, e é o benefício inteiro da task.

**1. O benefício não existe no fetch direto — medido em experimento controlado.**
Estudo SearchVIU (30/10/2025, 5 sistemas, 8 variantes de entrega do mesmo preço,
5 repetições por sistema). O preço presente **somente em JSON-LD**, invisível na
página, foi encontrado por **0 de 5** sistemas (ChatGPT, Claude, Perplexity, Gemini,
Google AI Mode) — antes e depois da indexação. Idem JSON-LD injetado por JS e
Microdata oculto: falha universal. Já o preço em HTML visível foi extraído por
ChatGPT, Gemini e AI Mode. Conclusão dos autores, textual: *"Current AI chatbots do
NOT use JSON-LD Schema Markup in direct retrieval"*; extraem *"exclusively visible
HTML content"*. Resultado por sistema: Gemini 4/8, ChatGPT 3/8, Claude **0/8**,
Perplexity 1/8 após indexar, AI Mode 2/8 após indexar. **Visibilidade, não formato
de markup, previu a extração.**

Um segundo experimento (Mark Williams-Cook, fev/2026) encontrou o oposto — ChatGPT e
Perplexity extraíram endereço presente só em JSON-LD inventado — mas a explicação
dos próprios autores reforça o ponto: os LLMs **tokenizam JSON-LD como texto cru**,
destruindo a estrutura semântica. Não é *"crawler de IA lê `Event`"*; é *"o bloco
`<script>` entra no texto"*. Nessa hipótese, o mesmo conteúdo em HTML visível serve
igual ou melhor, sem nenhum custo de política.

Ressalva honesta: o estudo SearchVIU limita o achado à fase de **fetch direto**, e
admite que schema pode contar na indexação, no treino e em sistemas acoplados a
índice (AI Overviews, Copilot). Ou seja: o `Event` não é inútil — mas o ganho
específico que justificava assumir risco de domínio **não foi demonstrado por
ninguém**, e foi refutado na única fase testada.

**2. O risco é menor do que a versão anterior deste bloco afirmou.** Correção da
correção: escrevi acima que a ação manual *"atinge o domínio inteiro"*. Medido na
fonte primária (`sd-policies`), o Google é explícito quanto ao alcance:
*"A structured data manual action means that a page loses eligibility for appearance
as a rich result"* e, na mesma frase, *"it doesn't affect how the page ranks in
Google web search."* A doc de `Event` confirma: *"If you received a structured data
manual action against a page, structured data on the page will be ignored (although
the page can still appear in Google Search results)."*

Consequência real, então: perda de elegibilidade a rich result (inclusive do
`Product`+`Offer`, que é o que **de fato** funciona no Google) e necessidade de
pedido de reconsideração. **Não** é queda de ranking. O risco continua existindo —
as guidelines dizem *"Virtual experiences that have no real-world component aren't
supported"* contra um catálogo `online | 168`, e *"Google may take manual action"* —
mas o dano se concentra exatamente na feature que o `Event` não conseguiria obter de
todo modo, e ameaça a que já está garantida.

**DECISÃO DO MANTENEDOR (2026-09-11): emitir só `Product`+`Offer`. `Event`
descartado.** Instrução literal: *"siga a recomendação e o que os estudos mais
recentes apontam como melhor"*. Esta decisão **substitui** a de emitir `Event`,
tomada mais cedo no mesmo dia sobre a premissa — depois refutada — de que crawlers de
IA leem `Event`.

O raciocínio não é conservadorismo: a alternativa perdia o que funciona para comprar
algo que a medição mostra não funcionar. Arriscar a elegibilidade a rich result do
`Product` — único caminho comprovado no Google — em troca de um `Event` que 0 de 5
sistemas de IA leram no fetch direto é trocar benefício medido por benefício não
demonstrado.

**O objetivo original do mantenedor não foi abandonado, foi realocado.** *"Tudo que
puder fazer pessoas chegarem nos sites, é válido"* segue valendo; o que mudou é onde
esse ganho é obtido — em T4.2 (HTML-first) e T4.5 (`description` por mesa), não no
tipo de schema. Ver a regra de espelhamento em T4.3, que é o mecanismo concreto.

**O objetivo do mantenedor (*"tudo que puder fazer pessoas chegarem nos sites, é
válido"*) continua atendido, e por caminho mais forte:** o que move busca generativa
é HTML-first (T4.2) + `description` por mesa (T4.5), consistente com o experimento
SEL 485228 (GPTBot rastreou 759 páginas do grupo HTML e **0** do grupo JS) e com o
SearchVIU (só HTML visível é extraído). Nenhum crawler de IA executa JS em fetch
direto. **Sem T4.2, nem `Event` nem `Product` entregam qualquer coisa para IA** — é
lá que está o ganho, não no tipo de schema.

**Regra que sobrevive às duas evidências contraditórias, e que vale para T4.3/T4.5:**
nunca deixar um fato existir **apenas** no JSON-LD. Toda propriedade emitida
(data, preço, vagas, modalidade) precisa estar no HTML visível da mesa. Isso entrega
o dado ao crawler de IA na única fase medida, e simultaneamente satisfaz a guideline
*"Don't mark up content that is not visible to readers of the page"* — que é o
critério pelo qual a ação manual é de fato aplicada.

**Task fechada.** A decisão está tomada e implementada na especificação de T4.3
(`@graph` com `Product`+`Offer`, regra de espelhamento, aceite nº 2 exigindo
`grep -c '"@type": "Event"'` → **0** como guarda de regressão). Nada aqui bloqueia
implementação.

**Se o `Event` voltar à mesa no futuro** (ex.: catálogo passar a ter mesas
presenciais, hoje `online | 168` e zero presenciais), a condição de reabertura é:
componente real-world existente + regra de espelhamento mantida + `eventAttendanceMode`
derivado de `modality`, nunca literal.

**Consequência para T1.3.** Sem `Event` no `@graph`, `eventStatus` fica fora —
consistente com `tasks.md` T1.2 (linha 108). Não muda nada em T1.3: mesmo quando o
`Event` esteve na mesa, o Google o ignoraria por inelegibilidade, e o status não
afetaria o índice. O destino da mesa expirada segue decidido por status HTTP —
T1.3 continua entre `404`, `410` e `301`, e é decisão de produto do mantenedor.

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

**Problema.** O Search Console lista
`https://mesas.artificiorpg.com/?system=castles-crusades` como afetada. Sem canonical
(medido: `grep -c 'rel="canonical"'` no HTML do navegador → 0), cada combinação de
filtro é URL distinta com conteúdo idêntico.

**Medido em 2026-09-11 — a combinatória, que antes estava só como "não medido":**

`apps/mesas/frontend/src/utils/catalogFilters.ts:85-104` serializa **10 parâmetros**:
`search`, `system`, `modality`, `price_type`, `experience_level`, `type`, `seal`,
`styles` (multivalorado, separado por vírgula), `sort`, `page`.

```
SELECT count(*) FROM systems;                                    -- 1269
SELECT count(DISTINCT system_id) FROM tables WHERE system_id IS NOT NULL;  -- 73
```

O espaço de URLs é combinatório sobre 10 eixos, com 1.269 valores possíveis só em
`system`. Nenhuma poda é viável por enumeração.

**Decisão (2026-09-11): canonical para a URL limpa em todas as facetas — nenhuma
indexável.** Não é preferência; sai da própria medição:

- Dos 1.269 sistemas, **73** têm ao menos uma mesa. Os outros 1.196 produziriam
  `?system=<slug>` com **catálogo vazio** — que é conteúdo fino, exatamente o perfil
  de página que o Google exclui. Indexar a faceta significaria indexar, na maioria
  esmagadora dos casos, uma página sem resultado.
- Os 73 restantes rotacionam: mesa expira em ≤ 5 dias (regra de T1.1), então uma
  faceta hoje povoada fica vazia em uma semana. Indexável e instável é o pior par.
- `search` é entrada livre — indexá-la abre URL infinita gerada por usuário.

**Reabre se, e só se,** houver demanda de busca medida para uma faceta específica
(volume real em `system`), caso em que a saída é **página própria com rota limpa**
(`/sistemas/<slug>`) e conteúdo curado, não parâmetro indexável. Isso é trabalho de
outra spec.

**Entrega.** `<link rel="canonical">` apontando para a URL sem query em toda rota de
catálogo com parâmetro. Depende de T4.2 (canonical injetado por JS não é lido).

**Aceite:**

1. `curl -s 'https://mesas.artificiorpg.com/?system=castles-crusades' | grep canonical`
   → canonical para `https://mesas.artificiorpg.com/`.
2. Mesma verificação com 3 parâmetros combinados → mesmo canonical limpo.
3. `curl -s https://mesas.artificiorpg.com/ | grep -c canonical` → 1, auto-referente.

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

## F6 — Operação no Search Console (depois do deploy das correções)

Frente acrescentada em 2026-09-11. As F1–F5 corrigem o que o Google vê; nenhuma delas
**avisa** o Google. Sem esta fase, a recuperação fica inteiramente no ritmo natural de
recrawl. Todas as tasks aqui são operação manual do mantenedor no painel — o agente
não tem acesso ao Search Console.

### [ ] T6.1 — Validação dos fixes nos relatórios do GSC

**Entrega.** Depois do deploy de cada frente, abrir o relatório correspondente no
Search Console e acionar **Validate Fix**:

| Relatório | O que valida | Fecha qual frente | Propriedade |
|---|---|---|---|
| Page indexing → "Soft 404" | as URLs de mesa expirada agora devolvem 410 | F1 | **não existe** |
| Page indexing → "Not found (404)" | os prefixos legados agora devolvem 301 | F2 | `artificiorpg.com` |
| Page indexing → "Alternate page with proper canonical tag" | canonical auto-referente correto | F3 | `artificiorpg.com` |

**Bloqueio medido (2026-09-11): a F1 não é validável hoje.** A única propriedade no
Search Console é `https://artificiorpg.com/` (prefixo de URL);
`mesas.artificiorpg.com` **não está cadastrado**, então os soft-404 do `mesas` nunca
apareceram em relatório algum — foram medidos por `curl` direto (`spec.md` §2.4.3).

Sem a propriedade, a linha da F1 nesta tabela é inexecutável, e não existe linha de
base anterior ao deploy para comparar depois.

**Pré-requisito, ação do mantenedor.** Criar propriedade de **Domínio**
(`artificiorpg.com`), que cobre todos os subdomínios de uma vez — incluindo `mesas.`,
`glossario.` e os futuros. Exige verificação por registro DNS, que é mudança em DNS de
produção (§Autorização). Deve preceder o deploy da F1; feito depois, perde-se a
comparação antes/depois.

**Aceite.**
1. Propriedade de Domínio `artificiorpg.com` existe e reporta o subdomínio `mesas.`.
2. Cada validação entra em estado "Started"/"Passed"; nenhuma volta a "Failed" com as
   mesmas URLs.
3. Enquanto (1) não existir, a linha da F1 fica declarada **bloqueada**, nunca
   marcada como concluída por ausência de dado.

**Baseline registrado antes de qualquer deploy** (`artificiorpg.com`, dados de
03/09/2026): 404 → **994**; Rastreada não indexada → **723**; Alternativa com
canônica → **235**; 5xx → **1**; indexadas → **92**. É contra estes números que a
recuperação se mede.

### [ ] T6.2 — Request Indexing das URLs de maior valor

**Regra medida (`ask-google-to-recrawl`), que define o escopo desta task:**

- *"Keep in mind that there's a quota for submitting individual URLs"* — não dá para
  submeter os 126 posts um a um.
- *"requesting a recrawl multiple times for the same URL won't get it crawled any faster"*
  — reenviar não acelera; só queima cota.
- *"Crawling can take anywhere from a few days to a few weeks."*
- *"If you have large numbers of URLs, submit a sitemap."*
- *"Requesting a crawl does not guarantee that inclusion in search results will happen instantly or even at all."*

**Entrega.** Inspeção manual + Request Indexing de **até 10 URLs**, escolhidas por
valor, não por ordem: a home, `/blog/`, e os posts com mais backlink/tráfego histórico
(o de Chris Perkins entre eles, por ser o que originou o relato). O restante dos 126
fica por conta do sitemap + `lastmod` (T3.4) — que é literalmente o método que a doc
recomenda para volume.

**Aceite.** As URLs submetidas aparecem como "URL is on Google" na inspeção, ou o
motivo do contrário está registrado. Nenhuma URL é resubmetida.

### [ ] T6.3 — Removals: posição registrada (não usar)

**Decisão: não usar a ferramenta de Removals nesta recuperação.** Medido na doc
`remove-information`: *"Requests made in Removals tool last about 6 months."* — é
remoção **temporária** de exibição, e a própria página aponta que remoção permanente
se faz pelo conteúdo, por senha ou por `noindex`, não por ela.

Aplicado ao caso: as URLs de mesa expirada passam a devolver **410** (T1.3), que é
exatamente o sinal de remoção permanente pelo caminho correto. Usar Removals por cima
esconderia por 6 meses o sintoma que queremos ver desaparecer nos relatórios, e ao
fim do prazo as URLs voltariam se o 410 não estivesse no ar — trocando uma métrica
real por uma temporária.

**Fica registrado aqui para não ser redecidido.** Reabre só se surgir necessidade de
tirar do ar com urgência conteúdo indevidamente publicado, que é o caso de uso real
da ferramenta e nada tem a ver com esta spec.

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

Cada uma com rollback próprio — as cinco, não só duas (corrigido em 2026-09-11).

1. **`UPDATE posts SET canonical = NULL`** nos 105 divergentes, em `site` (T3.2).
   *Rollback:* `pg_dump` só da tabela `posts` **antes** do `UPDATE`; a coluna é
   restaurável isoladamente por `UPDATE … FROM` sobre o dump. Não destrói conteúdo —
   só metadado de SEO já medido como errado.
2. **`INSERT` de 105 linhas em `redirects`**, em `site` (T2.2).
   *Rollback:* `DELETE FROM redirects WHERE from_path IN (…)` pelos `from_path`
   inseridos. O cache recarrega a cada 30 s (`redirect-cache.ts`), então a reversão
   vale sem restart.
3. **Deploy do `mesas`** — status HTTP é comportamento observável (T1.2/T1.3), e é o
   que leva o sitemap corrigido (T1.4) ao Google.
   *Rollback:* redeploy da imagem anterior (tag do commit prévio), pelo fluxo de
   `deploy-flow.md`. Sem migration envolvida: nada a reverter no banco.
4. **Export + rebuild + deploy do `site`** (T3.3, e T3.4 no mesmo ciclo).
   *Rollback:* redeploy da imagem anterior. O `posts.json` é artefato de build,
   regerado do banco — reverter o item 1 e reexportar restaura o estado anterior por
   completo.
5. **Mudança de arquitetura de renderização do `mesas` para SSR** (T4.1/T4.2).
   *Rollback:* é o **mais caro dos cinco** e precisa ser dito antes de começar — o
   estado anterior (Vite client-only + dynamic rendering no nginx) só volta por
   redeploy da imagem anterior, e a migração muda imports, entry point e deploy no
   repositório. Reverter em produção é um redeploy; reverter no código é `git revert`
   de uma obra inteira. Mitigação: a branch só sobe depois de os três aceites de T4.2
   passarem em beta. **Decisão tomada** (2026-09-11); falta autorizar a execução.

**Fora desta lista, por não exigirem autorização:** as tasks de F6 são operação manual
do mantenedor no Search Console (o agente não tem acesso) e não têm rollback técnico —
Request Indexing não se desfaz, apenas não se repete (T6.2).

**Saíram da lista em 2026-09-11** (achado de auditoria, T2.1): `Dockerfile`/nginx para
os 301 e mudança em Cloudflare. O mecanismo de redirect já existe no repo
(`server.ts:287-294` + tabela `redirects`), então a F2 é `INSERT`, não mudança de
infra — e não aciona a trava de `deploy-flow.md` §1.

Aprovação é por ação e não acumula (§Autorização).
