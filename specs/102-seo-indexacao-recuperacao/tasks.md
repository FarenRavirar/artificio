# Tasks 102 — Recuperação de indexação e ranking

Estado atual de cada task. **Um bloco por task, reescrito** — nunca anexar bloco
novo abaixo do antigo (§Conclusão de Tarefas).

Ordem conforme `plan.md` §1. Frentes independentes: F1 não bloqueia F2/F3.

Legenda: `[ ]` aberta · `[~]` em andamento · `[x]` concluída e medida · `[!]` bloqueada

---

## ⚠️ Registro anti-compactação — vale para TODAS as fases desta spec

**Por que está no topo.** Esta spec atravessa várias sessões e já sofreu
compactações. O que a compactação apaga primeiro é o mais caro de redescobrir: a
medição que **derrubou** uma hipótese e a armadilha que já custou uma volta. A
checklist sobrevive; o "por que não é do jeito óbvio" não. Aconteceu aqui: os
três defeitos de proxy de T4.2 foram achados, corrigidos e **reencontrados**
depois do corte de contexto, porque só existiam no chat.

**Regra, em qualquer fase:** achado medido vai para arquivo **no mesmo turno**.
Comentário no código quando explica o código; bloco da task aqui quando muda
estado ou contrato. Na dúvida, os dois — o comentário sobrevive ao refactor, o
`tasks.md` sobrevive ao `git checkout`.

**Obriga registro, sem exceção:**

1. **Forma óbvia que não funciona** — a que o próximo agente tentará primeiro.
   Registrar o **sintoma**, não só a forma certa, senão ele "corrige" de volta.
2. **Medição que contradiz o que esta spec dizia** — a correção substitui o texto
   errado e diz que o registro anterior estava errado. Nunca apagar em silêncio.
3. **Valor que parece constante e não é** — env, porta, nome de container, CIDR,
   com prod e beta lado a lado quando divergem.
4. **Bug latente achado de passagem**, principalmente o que **falha em silêncio**,
   sem erro de boot.
5. **Decisão de NÃO fazer algo**, com o motivo medido — senão o próximo agente
   "completa" o trabalho e derruba o que estava intencionalmente de pé.

**Só vale registro verificável:** comando e o que devolveu, `arquivo:linha`,
contagem. "Cuidado com o proxy" não é registro.

**Cumprimento não depende de o agente lembrar disto.** O hook
`.claude/hooks/registro-anti-compactacao.js` (`Stop`, suíte com 19 casos) fecha o
turno que fez **≥1 medição** sem escrever em doc de spec/governança, e devolve os 5
gatilhos acima no motivo. Escrever na spec libera; turno sem medição nenhuma não é
cobrado; `stop_hook_active` corta o laço.

**O limiar é 1 desde 2026-09-12, e era 4.** Determinação do mantenedor, literal:
*"to falando a cada etapa"*. O raciocínio antigo — "1 `ls` é rotina, cobrar seria
hostil" — está medido como errado: o limiar 4 deixava passar justamente o turno que
descobre **uma coisa só**, e uma coisa só é o tamanho típico do achado caro. Naquela
sessão, três achados que custaram horas foram **uma medição cada**: `react-router`
ausente da árvore do `mesas` (o `tsc` acusando `Cannot find module` em 33 arquivos),
o CodeRabbit recusando a #316 por tamanho, e o próprio hook existindo só num commit.
Os três passariam batido sob o limiar 4. O custo de um falso-positivo é uma frase
("medição de rotina, nada a registrar", que o motivo do bloqueio já autoriza); o do
falso-negativo é trabalho perdido.

**BUG LATENTE, resolvido — a trava vivia num só commit.** O hook e a declaração
`"Stop"` dele no `.claude/settings.json` existiam **apenas no commit `4bb3108`**
(branch da PR #316): não estavam em `origin/dev`, nem na branch da #317, nem em
`~/.claude/hooks/`. Fechar ou perder a #316 apagaria em silêncio o único mecanismo que
cobra registro — hook ausente não dá erro, só deixa de cobrar. Os dois estão
commitados em `57270d0` (PR #317). **Ao criar a PR 3, conferir que seguem lá**
(`grep -c registro-anti-compactacao .claude/settings.json` deve devolver 1).

Ao mexer no limiar, a suíte cobre os três caminhos: turno sem medição libera; **uma**
medição sem registro cobra; uma medição **com** escrita em `specs/*/tasks.md` libera.

**Bug latente achado pelo Codex na #317 e corrigido:** baixar o limiar para 1 deixou
DOIS testes afirmando o oposto da regra — `NÃO cobra turno de rotina` e
`só conta o ÚLTIMO turno` usavam um `bash` solto no turno atual, que sob limiar 1
**tem** que bloquear. Eles passavam **por acidente**, e um teste verde que afirma o
contrário da regra é pior que teste ausente: garantiria silêncio no dia em que o
limiar voltasse a subir. O primeiro virou `cobra turno com UM comando solto`; o
segundo passou a provar o corte com um turno atual **sem** medição, que é o único
caminho que ainda distingue "contou o anterior" de "contou o atual".

Rodar `node .claude/hooks/registro-anti-compactacao.test.js` (21/21) e, porque a
mudança passa pelo `settings.json`, as outras quatro suítes de hook —
`git-commit-msg-gate` 9/9, `autorizacao-gate` 56/56, `deploy-contract-gate` 11,
`rtk-enforce` 36/36. JSON quebrado ali derruba **todas** as travas do repo de uma vez,
inclusive as de autorização.

Duas armadilhas medidas ao escrever esse hook, para quem for mexer nele:
`hookSpecificOutput{hookEventName:"Stop"}` **não funciona** — `Stop` não é membro
da união do CC (`security_reminder_hook.py:242-255`), a linha reprova a validação
e o motivo vaza como JSON cru; o canal certo é `exit 2` + stderr. E o
`transcript_path` pode chegar com o turno atual ainda incompleto (lag medido:
3,7 s), mas as chamadas de ferramenta já estão gravadas — o aviso da doc vale
para a última mensagem do assistente, não para o que o gate lê.

Mesma regra na skill `new-spec` (§Registro anti-compactação), para toda spec nova.

---

## F1 — `mesas`: soft-404 e divergência sitemap/SSR — **CÓDIGO COMPLETO, SEM DEPLOY**

**Estado em 2026-09-12: T1.1 a T1.4 estão em `origin/dev`.** A PR #315 foi mergeada
(2026-09-12, 16 arquivos) e `tableVisibility.equivalence.test.ts` e `og.seo.test.ts`
existem na árvore de `dev` — medido com `git ls-tree origin/dev`. O que falta nesta
frente é **deploy**, não código nem commit.

Validação (remedida em 2026-09-12): `tsc` limpo · **1175 testes** (1 skip por
desenho, abaixo) · lint limpo · `verify:api` breaking=0. Os dois testes novos
passaram por **teste de mutação** — provado que falham quando a regra quebra, não
só que estão verdes.

Pendências nomeadas, nenhuma bloqueando as demais frentes:
1. **Deploy do `mesas`** — sem ele nada chega ao Google (aprovação nominal). Sobe
   junto com F3 e F4, num único deploy.
2. **Espelho `apps/mesas/frontend/src/utils/tableVisibility.ts`** segue divergente —
   unificar exige criar pacote compartilhado (aprovação nominal, T1.1 item 3).
3. **Sugestões de mesas vigentes no corpo do `410`** (aceite 4 de T1.3) não
   implementadas — trabalho de frontend, não afeta o status HTTP.
4. Teste de equivalência **skipa sem `MESAS_TEST_DATABASE_URL`** — é o 1 skip da
   contagem acima, por `describe.skipIf(!db)`. Comportamento desenhado, não falha;
   ligar em CI é decisão de infra pendente.

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
Mergeado em `origin/dev` pela **PR #315** (2026-09-12); a branch
`fix/102-f1-mesas-soft404` foi a origem.

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

### [x] T3.1 — Guarda contra canonical de host externo — FEITO (2026-09-11)

Não há importador para corrigir: a rota `POST /admin/import` e o script saíram em
2026-07-27 (`apps/site/server/server.ts:167-169`). Os 105 canonicals divergentes são
dado legado congelado. **T3.2 não depende de T2.2.**

O único caminho de escrita restante é o override editorial via admin, que continua
existindo de propósito — serve a sindicação real.

**Entregue.**

- `packages/content/src/canonical.ts` — `normalizeCanonical`/`isCanonicalSafe`, no
  pacote compartilhado. Vazio → `null` (fallback auto-referente, o default correto);
  domínio canônico → normalizado para `https` + trailing slash; outro host →
  rejeitado com motivo.
- `apps/site/server/admin-api.ts` — `rejectBadCanonical` nos 4 handlers de escrita
  (`POST`/`PUT` de posts e pages) → `400 bad_canonical`; grava o valor normalizado.
  Rejeita em vez de descartar calado, senão o editor não sabe que o valor dele não foi
  gravado.

**Aceite — medido.**

1. `rtk rg "run import" apps/site` → 1 ocorrência, e é o comentário que documenta a
   remoção. Nenhum script vivo.
2. `vitest run src/canonical.test.ts` → **10/10** (host externo, formato do WP, vazio
   → `null`, URL relativa, quase-match `evilartificiorpg.com`).
3. Nenhuma linha da spec diz que T3.2 depende de T2.2.

**Validação.** `packages/content` 22/22; `apps/site` 155/155; `tsc --noEmit` e lint
limpos nos dois.

---

### [x] T3.2 — Limpar os 105 canonicals divergentes em produção — FEITO (2026-09-12)

Autorizado nominalmente pelo mantenedor em 2026-09-12.

**Executado** em `site-prod-db`:

```sql
UPDATE posts SET canonical = NULL
 WHERE canonical IS NOT NULL
   AND regexp_replace(canonical,'^https?://[^/]+','') <> '/blog/'||slug||'/';
```

→ `UPDATE 105`.

**Antes → depois** (mesmo `SELECT` nos dois lados): 126 posts, 125 com canonical, **105
divergentes** → 126 posts, **20** com canonical, **0** divergentes. Os 20 restantes são
auto-referentes e foram preservados.

**Dry-run.** O mesmo `UPDATE` sob `BEGIN … ROLLBACK` devolveu `UPDATE 105` e 0
divergentes restantes antes da execução real.

**Backup, verificado nos dois lados.** `pg_dump -t posts --data-only --column-inserts`
→ `~/backups/spec102/posts_pre_t32_20260912_021453.sql` na VM, copiado para
`C:\projetos\artificiobackup\spec102\`. 3.824.421 bytes e 126 `INSERT INTO` idênticos
na VM e off-VM; dump íntegro. *Rollback:* `UPDATE … FROM` da coluna `canonical` sobre o
dump — não destrói conteúdo, só metadado de SEO.

**Por que nenhum dos 105 era sindicação legítima.** Todos os 125 canonicals estavam em
`https://artificiorpg.com` — nenhum host externo. Os divergentes apontavam para
caminhos legados do WP: `noticias` (64), `blog/<categoria>/` (18), `dnd` (18),
`downloads` (3), `entrevistas` (2). Verificado por `curl` que esses caminhos **já
respondem 301** para `/blog/<slug>/`, que serve 200 — o canonical apontava para uma URL
que redireciona, que é exatamente o defeito A.

**Não aparece em produção ainda.** O HTML servido vem do `dist` buildado; a correção só
fica visível após o rebuild do container (T3.3).

---

### [x] T3.3 — Export + rebuild + deploy do `site` — FEITO (2026-09-14)

**Deploy B executado: promote `dev`→`main` (run `34907438221`) + `deploy.yml` prod (run
`34907514215`), ambos `success`.** `main` = `1c833b5`, distância para `dev` = 0.
Rollback, se precisar: `main` estava em `31ff668`.

**Aceites medidos em `artificiorpg.com`, todos verdes:**

| critério | alvo | medido |
|---|---|---|
| A2 canonical == URL servida | 0 mismatch | **30/30** (amostra do sitemap) |
| D1 prefixo legado → 301 correto | 301 | **12/12** |
| D2 sem cadeia (1 hop até 200) | 1 hop | **12/12** |
| D3 forma sem barra final | 301 | **6/6** |
| D4 query preservada | mantém | **`?utm_source=fb&utm_campaign=teste` intacto** |
| D5 `lastmod` no sitemap | ≥ 126 | **126** (226 `<loc>` no total) |
| posts no sitemap | 126 | **126** |
| recorte das fatias | 5×24 + 6 | **126 cards** |
| raiz: `h1`, canonical, title | próprios | **`<h1>Artifício RPG</h1>`, canonical para si** |
| raiz: "Todos os Posts" | 2 | **2** |

**⚠️ ARMADILHA DE MEDIÇÃO — `grep -c` MENTE neste sitemap.** O XML vem em **uma linha
só**, e `grep -c` conta LINHAS, não ocorrências: devolve `1` (ou `0`) mesmo com 126
`lastmod` presentes. O aceite 2 abaixo e o `plan.md` §7 usam `grep -c` e **estão
errados como escritos**. A forma correta é `grep -o "<lastmod>" | wc -l`. Esta
armadilha já produziu dois relatos falsos de "D5 = 0" nesta spec — um em beta, um em
prod, os dois meus.

**Segunda armadilha, medida no mesmo dia: cache de borda do Cloudflare.** Logo após o
deploy, `curl` sem cache-buster devolveu canonical antigo na raiz (`cf-cache-status:
HIT`, `Age: 6472`, `Cache-Control: public, max-age=7200`) e `/blog/2/` como 404, enquanto
`/blog/3..6/` já serviam 200 — mistura de versões que parece deploy pela metade e não é.
**Toda conferência pós-deploy deste app exige `?cb=$(date +%s%N)`**, senão mede um build
de até 2 h atrás.

**Bloqueio, atualizado em 2026-09-12.** `deploy.yml` roda com `--ref main` e a VM faz
`git reset --hard origin/<branch>` (`deploy-flow.md` §6), então só chega a produção o
que estiver em `main`. O código de T3.4 já está commitado — o bloqueio deixou de ser
"não commitado" e passou a ser **a distância até `main`**: falta PR → merge em `dev` →
promote `dev`→`main` → dispatch.

**A #317 MERGEOU em 2026-09-13 (`49ac4b1`), e a #319 também (`a7ea7e1`).** T3.4 entrou
por `58305fb`, dentro da #317. O bloqueio deixou de ser "falta chegar em `dev`" — o
código está em `dev`. **Resta só a distância até `main`:** promote `dev`→`main` +
dispatch. Nenhuma PR pendente destrava nada aqui.

Deployar `main` antes disso corrigiria o canonical (o entrypoint reexporta do banco,
onde T3.2 já limpou) mas emitiria **0 `lastmod`**, falhando o aceite 2 — o `main` de
hoje não tem o código de T3.4.

**Destrava com:** PR → `dev` → promote → `dev`→`main` → dispatch. Cada passo exige
autorização nominal própria (§Autorização).

**Por que é task própria.** `posts.canonical` → `export.ts` → `posts.json` → build Astro
→ HTML. Corrigir o banco não muda produção: o container serve o `dist` do último build.
"Banco atualizado ≠ prod atualizado".

**O que entra neste mesmo ciclo.** O `lastmod` (T3.4) é exercido pelo mesmo export +
build — o `updated` só aparece no `posts.json` quando o export roda contra o banco real.
Um ciclo resolve canonical e `lastmod`.

**Comando.** `gh workflow run deploy.yml --ref main -f module=site -f mode=deploy -f env=prod`

**Ensaio em beta feito — Deploy A, run `34903089436`, `success` em 2026-09-14.** O ciclo
export → `posts.json` → build rodou contra banco real e o recorte da paginação saiu
correto: `/blog/` e as fatias 2–5 com **24 cards** cada, fatia 6 com **5**, `/blog/1/` e
`/blog/7/` com **404**. O risco que esta task carregava — descobrir erro de recorte só em
prod — está eliminado.

**Dois valores DIVERGEM entre beta e prod, medidos no mesmo dia:**

| | `site-beta-db` | `site-prod-db` |
|---|---:|---:|
| posts `status='publish'` | **125** | **126** |

O beta serviu 125 posts (5×24 + 5 = 125 cards, conferido por `class="card"`), que é
exatamente o conteúdo do banco dele. **Não há post perdido no pipeline** — descartadas
por medição as hipóteses de filtro por status, slug numérico (0), slug duplicado (0),
`published_at` nulo (0) e `noindex` (0). São bancos com conteúdo diferente.

Consequência para o aceite: em prod a aritmética dá **6 fatias** (126 = 5×24 + 6), a
mesma contagem de fatias do beta. O recorte não muda. Mas **o número "126" que esta spec
usa em 9 lugares é do banco de prod**; ao conferir beta, o alvo é 125. Não tratar 125 em
beta como falha.

**`lastmod` (D5) NÃO é medível em beta — por desenho, não por falha.** `astro.config.mjs`
só carrega a integração `sitemap` quando `SITE_NOINDEX !== "true"` (achado do mantenedor,
PR #271: beta não emite convite a rastrear). Medido: `/sitemap-0.xml`, `/sitemap.xml` e
`/sitemap-index.xml` devolvem **404** em beta, e `robots.txt` serve `Disallow: /`. O
aceite 2 abaixo só tem valor em prod.

**Aceite.**

1. Varredura dos posts: `<link rel=canonical>` == URL servida em **126/126** em prod
   (hoje: 21/126). Em beta o alvo é 125/125 — bancos diferentes, ver tabela acima.
2. `curl -s https://artificiorpg.com/sitemap-0.xml | grep -c "lastmod"` → ≥ 126
   (aceite 1 de T3.4). **Só em prod:** beta não gera sitemap.

---

### [x] T3.4 — `lastmod` no sitemap do `site` — FEITO (2026-09-11)

Medido em 2026-09-11: `curl -s https://artificiorpg.com/sitemap-0.xml | grep -c
"lastmod"` → **0**. É a alavanca barata para o Google redescobrir os 126 posts depois
que T3.2/T3.3 corrigirem o canonical.

**Entregue.**

- `apps/site/db/export.ts` — `posts.updated_at` sai no `posts.json` como `updated`.
- `apps/site/src/lib/sitemap-lastmod.ts` — `buildLastmodIndex` + `serializeWithLastmod`.
- `apps/site/astro.config.mjs` — `sitemap({ serialize })` ligado.

Duas travas, porque o Google ignora `lastmod` que parece inventado: a data vem da
edição real, nunca do build; URL sem data própria (home, `/blog/`, taxonomias, busca)
não recebe o campo.

**Armadilha — não desfazer.** O `astro.config.mjs` roda fora do pipeline do Vite. Ele
**não pode** importar `src/lib/content.ts`, que puxa `@artificio/ui/static` →
`_logo.png`: o build morre com `Unable to load your Astro config / Unknown file
extension ".png"`. Por isso o config lê `posts.json` direto e `sitemap-lastmod.ts` não
depende de assets. Comentado nos dois arquivos.

**Aceite — medido.**

1. Ponta a ponta: snapshot de teste com 3 posts com data real → build → **3 `lastmod`
   distintos**; as outras 43 URLs sem o campo. Snapshot versionado restaurado
   (`git status` limpo em `src/data/posts.json`).
2. Datas diferentes → `lastmod` diferentes: teste dedicado.
3. URL sem data real não recebe `lastmod`: teste dedicado.
4. `vitest run src/lib/sitemap-lastmod.test.ts` → **6/6**.

**FECHADO EM PRODUÇÃO — 2026-09-14, Deploy B (run `34907514215`).** Medido:
`curl -s "https://artificiorpg.com/sitemap-0.xml?cb=$(date +%s)" | grep -o "<lastmod>" |
wc -l` → **126**. O sitemap tem 226 `<loc>` (126 posts + fatias + taxonomias).

**Use `grep -o … | wc -l`, NUNCA `grep -c`** — o XML é uma linha só, e `grep -c` conta
linhas: devolve `1` com 126 `lastmod` presentes. Ver a armadilha completa em T3.3.

**Beta nunca vai medir isto, por desenho.** `/sitemap-0.xml`, `/sitemap.xml` e
`/sitemap-index.xml` devolvem **404** em `beta.artificiorpg.com`, e `robots.txt` serve
`Disallow: /`. Causa em `astro.config.mjs`: a integração `sitemap` só entra quando
`SITE_NOINDEX !== "true"` — beta não emite convite a rastrear (achado do mantenedor,
PR #271). Localmente, o `posts.json` versionado (46 posts, nenhum com `updated`) gera 0
`lastmod` por motivo diferente: "não inventar data".

**Depende de.** T3.3 — mesmo ciclo de export + build + deploy.

---

### [ ] T3.5 — Raiz do `site` se declara duplicata de `/blog/` — BLOQUEIA O DEPLOY

**É da spec, e será resolvido ANTES do deploy** (determinação do mantenedor,
2026-09-14). Nasceu como "achado lateral" e foi promovido a task: o mesmo defeito do
Achado A, na URL mais valiosa do domínio. Deployar T3.3 sem isto publica a correção dos
126 posts e deixa a home fora do índice.

**Origem.** Pergunta do mantenedor: *"o artificiorpg.com é um blog, com possibilidades
de páginas. tem que resolver isso"* — depois de estranhar que ainda se falasse de
`/blog/` "sendo que esse projeto já foi abandonado". O WordPress foi abandonado; a rota
não.

**Medido em produção, `curl`:**

| | `/` (vitrine) | `/blog/` (arquivo) |
|---|---|---|
| `<title>` | Artifício RPG — Blog | Blog — Artifício RPG |
| `canonical` | **`…/blog/`** ❌ | `…/blog/` ✅ |
| `og:url` | **`…/blog/`** ❌ | — |
| posts listados | 10 | 126 |
| HTML | 34.927 B | 184.714 B |
| `h1` | **0** | 1 |
| `h2` / `h3` | 2 / 10 | 1 / 126 |
| JSON-LD | `WebSite` + `Organization` | **nenhum** |
| texto próprio | hero + 9 cards | **nenhum**: kicker + h1 + pílulas + cards |
| links internos p/ ela | — | **4** (ver abaixo) |
| no sitemap | sim (1ª) | sim (2ª) |

**Correção de 2026-09-14 — a versão anterior desta tabela dizia "zero links internos
(só o Ver tudo → da home)", que é contraditório e estava errado.** A medição que
sustentava era `rtk rg 'href="/blog/"'`, que devolveu vazio: o padrão com `/` e aspas
não casou. Refeito com busca literal em Node, são **4** links internos para `/blog/`:

| arquivo | papel |
|---|---|
| `pages/index.astro:21` | o "Ver tudo →" |
| `pages/blog/[slug].astro:54` | breadcrumb de todo post |
| `pages/blog/categoria/[slug].astro:22` | breadcrumb de categoria |
| `pages/blog/tag/[slug].astro:22` | breadcrumb de tag |

Isso muda o peso do item 3 da correção: `/blog/` não é folha esquecida — é o nó do
breadcrumb de **todas** as 126 páginas de post e das 81 taxonomias. Foi uma das
medições que derrubaram a proposta de `noindex` (ver item 3): tirar do índice a página
que costura 207 URLs seria retirar o próprio mapa do acervo.

A raiz declara outra página como sua autoridade em **dois** sinais, em
`apps/site/src/pages/index.astro:13`. É o **Erro nº 4** do Google em *"5 common mistakes
with rel=canonical"*: listagem que canonicaliza para outra de conteúdo parecido — e a
consequência documentada é que **a página que aponta não aparece nos resultados de
busca**.

**Falha em silêncio:** nenhum teste quebra, nenhum build falha, a página abre normal no
navegador. O dano acontece inteiro dentro do índice.

**Contradiz o que esta spec afirmava.** `spec.md` §2.6 listava o sitemap do `site` como
"medido e CORRETO, descartado como causa", com as 221 URLs sendo "todas sob `/blog/` e
páginas institucionais". Falso: `/` é a primeira entrada. Corrigido lá, não apagado.

**Três formas óbvias que NÃO funcionam:**

1. **Só trocar a string do `canonical`.** Conserta o sinal e deixa a canibalização de
   pé: as duas seguem competindo pela mesma consulta.
2. **Canonicalizar páginas 2+ para a página 1.** **Erro nº 1** do mesmo post do Google;
   contraria a doc de paginação (*"Don't use the first page of a paginated sequence as
   the canonical page"*). Corta o caminho até os posts profundos.
3. **Fundir as duas — raiz virar o arquivo, ou 301 de `/blog/` para `/`.** **Era a
   proposta anterior deste bloco, e estava errada.** Barrada pelo mantenedor:
   *"hoje tem o design que tem exatamente para as pessoas poderem entrar e chamar a
   atenção, além de ter os posts mais recentes. aplicar o /blog/ como raiz é tampar
   buraco NOVAMENTE"*. A tabela acima confirma: **propósitos diferentes**, não uma sobra
   da outra.

   **Por que a doc do Google desautoriza fundir** (redação corrigida em 2026-09-14 —
   ver aviso abaixo): o `canonical` serve para *"duplicate or very similar pages"*
   (literal, [Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)),
   que não é o caso aqui. E o **Erro nº 4** do post de 2013 é exatamente este cenário —
   uma página de categoria/listagem apontando `canonical` para um artigo — cuja
   consequência é a própria página de listagem deixar de aparecer nos resultados.
   Fundir mata o design que existe de propósito.

   > **⚠️ Citação fabricada, removida em 2026-09-14.** Este parágrafo afirmava, entre
   > aspas e como se fosse do Google, que *"pages serving two very different purposes
   > should not include canonical links to the other"*. **A frase não existe** — nem na
   > doc atual nem na versão arquivada de 2023 (verificado na fonte). Também dizia que o
   > Google **"ignora"** canonical de conteúdo diferente; a doc é menos categórica —
   > ela diz que o Google *"identify which version of the URL is objectively the best
   > version to show to users"*, e o post de 2013 fala em não aceitar o sinal. A
   > substância do argumento se sustenta pelas fontes reais citadas acima; o que caiu
   > foi a letra inventada. **Não reintroduzir aspas sem fonte.**

**Correção — nada é fundido, o design fica intocado.** Cada página declara o que é:

1. **Raiz**: `canonical` e `og:url` auto-referentes (`https://artificiorpg.com/`).
2. **Raiz ganha `h1`** — hoje o heading mais alto é o `h2` "Mais recentes".
3. **`/blog/` CONTINUA INDEXADA.** Mantém o canonical próprio, que já está correto.
   Nada mais muda nela nesta task — ver "Dois itens descartados" abaixo.

   **Correção de 2026-09-14: a versão anterior desta task recomendava `noindex` aqui, e
   estava ERRADA.** Derrubada por pergunta do mantenedor — *"PORQUE O BLOG NÃO
   RECEBERIA? PREJUDICA ALGO? LÁ NÃO TEM LINKS E PROPOSTAS DIFERENTES? O HOME É O
   CONVIDATIVO, O /BLOG NÃO É O CATALOGO?"* — e pela medição que ela obrigou:

   | | home | `/blog/` |
   |---|---|---|
   | posts linkados (únicos) | 10 | **126** |
   | taxonomias linkadas | 4 (do menu) | **12** |
   | pílulas de categoria com contagem | **0** | **12** |

   As 12 pílulas trazem o tamanho de cada seção (Notícias 60, DnD 54, Internacional 47,
   Análises 45, Lançamentos 39, Nacional 33, Guias 15, Downloads 13, RPG em Geral 9,
   O que é RPG 7, Entrevistas 5, Crônicas 1). **Isso É contexto próprio** — diz a forma
   e o tamanho do acervo, informação que a home não dá em lugar nenhum.

   O erro do agente foi aplicar o critério "lista sem texto corrido = página fina" sem
   medir o que a página oferece de navegação. `/blog/` é a maior concentração de links
   do domínio (126 + 12) e o mapa que melhor expõe a estrutura ao rastreador.
   `noindex` ali retiraria do índice justamente essa página, e **prejudica**:
   a) some o catálogo, que responde a intenção de busca que a vitrine não responde;
   b) o `nofollow` que o código emite junto cortaria a passagem de sinal pelos 138
   links dela.

   Consequência prática: **some o item 4 (mexer no sitemap), some a mudança em
   `packages/content`, some o risco nos breadcrumbs.** A correção encolhe para o
   defeito real, que é só o canonical da raiz.
4. **Sitemap permanece como está** — nada sai dele. O item que mandava excluir `/blog/`
   caiu junto com o `noindex`.

   **Registrado porque quase virou trabalho inútil:** o `@astrojs/sitemap` v3 **não** lê
   `robots noindex` (doc: *"All pages are included in your sitemap by default"*), então
   excluir exigiria um `filter` novo no `astro.config.mjs:33`, que hoje só passa
   `serialize`. Se alguém reabrir essa ideia, saiba que é trabalho de config **e** que
   mexer ali arrisca desfazer o `serialize` do `lastmod` (T3.4) e a trava de
   `SITE_NOINDEX`.
5. **Botão "Todos os Posts" — em DOIS lugares, e o do fim é o que importa.** Pedido do
   mantenedor em 2026-09-14 (*"algo como um botão, que faça juz, que tenha alinhamento,
   que seja realmente bonito e sóbrio"*) e cobrado de novo no mesmo dia: *"E O BOTÃO
   PARA VER MAIS? HOJE O USUARIO MAL SABE ONDE VER TODOS OS POSTS"*.

   **Medido na home de produção, e é pior do que a versão anterior desta task
   registrava:** `href="/blog/"` aparece **1 vez** na home inteira. É o "Ver tudo →"
   de 14px, e ele fica **ANTES** dos 10 cards, no `.section-head`. Depois do último
   card vem `</a> </section> </main>` — **nada**. O leitor rola os 10 cards, chega ao
   fim e não tem saída; precisa rolar de volta ao topo e reparar num texto pequeno ao
   lado de um `h2`. O rodapé não cobre: os 7 links dele vão para os outros projetos
   (Glossário, Mesas, Downloads, Esferas, SRD, WhatsApps, Portal), nenhum para o
   acervo.

   **Forma óbvia que NÃO resolve:** só trocar o estilo do `.see-all` existente. Deixa o
   fim da home vazio do mesmo jeito, que é exatamente onde o leitor está quando termina
   o que a vitrine ofereceu. O botão do fim é o padrão de blog há décadas justamente
   por isso: o convite aparece quando o usuário tem motivo para aceitá-lo.

   Então são dois, com papéis distintos:

   - **Fim da home, depois da grade** — o botão que resolve o problema medido acima.
   - **Topo (`.section-head`)** — o "Ver tudo →" atual vira botão sóbrio, para quem já
     sabe o que quer.

   **Forma — o design system JÁ TEM o botão.** Determinação do mantenedor, 2026-09-14:
   *"ONDE FOR 'VER TUDO', SUBSTITUI POR UM BOTÃO, BEM ORGANIZADO, USANDO AS CORES DO
   ARTIFICIO 'Todos os Posts' (…) bonito, organizado, que faça jus, alinhado, sem
   exageros mas que aplique as melhores práticas"*.

   **Correção: a versão anterior deste item propunha reusar `.cat-pill`, e estava
   errada.** Pílula é controle de filtro (categoria), não ação — usá-la como botão
   confunde dois papéis distintos. Medido em `packages/ui/src/styles.css`: já existe
   `.artificio-button` (linha 1049) com variantes de tamanho (`-sm` 32px, `-md` 40px,
   `-lg` 48px) e de estilo (`-primary`, `-secondary`, `-ghost`), e o `focus-visible`
   resolvido na linha 1418 (`outline: 3px solid var(--artificio-focus)`).

   **Especificação:** `.artificio-button .artificio-button-secondary
   .artificio-button-md`, rótulo **"Todos os Posts"**.

   - **Secundária, não primária.** A ação principal da home é ler um post — são os
     cards. O botão é caminho para o acervo: importante, subordinado. Laranja sólido
     (`--artificio-brand` #ff5722) competiria com os cards numa página que se quer
     sóbria. A secundária usa `--surface` com borda `--line`, e o hover é **neutro**
     (`--surface-subtle` + `--line-strong`, `styles.css:1104`) — sem cor de marca em
     nenhum estado, que é o "sem exageros" pedido.
   - **`-md` (40px):** alvo de toque adequado sem inchar a página.
   - **Cores da marca, medidas:** `--artificio-brand` #ff5722 (D064),
     `--artificio-brand-deep` #e64a19, `--artificio-ink` #020740,
     `--artificio-focus` #e64a19.
   - **`.see-all` sai do `global.css:69`** — regra órfã não fica no CSS.
   - **`.section-head`: `align-items` de `baseline` para `center`.** Com `h2` em Oswald
     22px e o link virando caixa com padding, baseline desalinha opticamente.

   "Ver tudo" existe em **um** lugar hoje (`index.astro:21`, medido) — mas a regra do
   mantenedor é *onde for*: se aparecer outro, recebe o mesmo botão.

   **O hover do botão FUNCIONA — premissa anterior refutada por medição (2026-09-14).**
   Lembrete do mantenedor (*"tem 2 cores, light e dark, e tem que funcionar para mobile
   também"*) levou à medição. A versão anterior deste bloco afirmava "BUG LATENTE — o
   hover MORRE em silêncio", com a causa "os tokens não existem no site". **A causa
   estava errada, e o trabalho que ela criava era desnecessário.**

   **Por que a afirmação anterior era falsa.** Ela mediu um arquivo (`global.css`) e
   concluiu sobre o site. Mas `global.css:8` faz `@import "@artificio/ui/styles.css"`
   **antes de tudo**, e é esse arquivo que define os dois tokens — as únicas definições
   do repo (medido: `rtk rg -- "--surface-subtle:|--line-strong:" apps packages` só casa
   `packages/ui/src/styles.css`, linhas 148/153 light e 300/304 dark). O `:root` do site
   (`global.css:17-30`) redefine `--bg`/`--surface`/`--fg`/`--muted`/`--line`/`--chip-*`
   e **nunca** os dois de hover. Custom property não redefinida mantém o valor da
   cascata anterior, logo `var(--surface-subtle)` resolve normalmente.

   ```css
   .artificio-button-secondary:hover {   /* styles.css:1104 */
     background: var(--surface-subtle);  /* resolve: #eef2f8 light / #16223e dark */
     border-color: var(--line-strong);   /* resolve: rgba(2,7,64,.24) / rgba(255,255,255,.20) */
   }
   ```

   **A hipótese de purge do Lightning CSS também está morta** — era a única ressalva que
   a refutação deixou em aberto, e foi medida no bundle servido
   (`apps/site/dist/_astro/Base.DBUI5Cpc.css`, build de 13/09):

   ```
   --surface-subtle:var(--artificio-light-subtle)
   --surface-subtle:var(--artificio-dark-subtle)
   --line-strong:#0207403d      ← rgba(2,7,64,.24) minificado
   --line-strong:#fff3          ← rgba(255,255,255,.20) minificado
   ```

   Os quatro valores estão no CSS final, nos dois temas. Não é preciso navegador para
   concluir: o hover responde.

   **O que resta fazer (opcional, não é conserto).** Definir os dois no `global.css` é
   **blindagem** contra mudança futura de ordem de import ou purge mais agressivo — não
   corrige defeito nenhum. Se for feito, usar os valores do design system:

   | token | light | dark |
   |---|---|---|
   | `--surface-subtle` | `#eef2f8` | `#16223e` |
   | `--line-strong` | `rgba(2,7,64,.24)` | `rgba(255,255,255,.20)` |

   **Lição de método (a razão de este bloco continuar aqui depois de refutado):** medir
   a ausência de um token em UM arquivo não mede a ausência dele no site. Onde há
   `@import`, a cascata atravessa arquivos — a medição válida é no bundle final.

   **Dark funciona**, confirmado: site e design system usam o mesmo seletor
   `:root[data-theme="dark"]`, então o tema troca junto. Site light `--surface`
   `#ffffff` / dark `#1b2a4a`; `--line` `#e6e8ef` / `rgba(255,255,255,.12)`. O que
   faltava eram só os dois tokens de hover — nos dois temas.

   **Mobile — dois pontos que nenhum breakpoint cobre hoje** (medido: os `@media` de
   900px e 600px em `global.css:217,225` não tocam `.section-head`):

   1. `.section-head` é `flex` com `justify-content: space-between`, sem `wrap`. Com
      `h2` Oswald 22px + botão de 40px em tela de 360px (`.container` deixa 312px
      úteis, `padding: 32px 24px`), os dois disputam a linha: o botão comprime ou
      estoura. Precisa de `flex-wrap: wrap` + `gap`, e empilhar em ≤600px.
   2. O botão do fim da grade precisa de tratamento próprio em mobile — largura total
      ou centralizado, nunca encostado à esquerda por herança do fluxo.

   **⚠️ DEFEITO MAIOR, achado pelo mantenedor em 2026-09-14:** *"o artificio nunca traz
   os módulos mesas, links, downloads, glossário. o usuário mobile não tem acesso a
   isso"*.

   **Medido em produção.** O HTML da home tem **11** `artificio-nav-link`: 7 do nav de
   projetos (Portal, Glossário, Mesas, Downloads, Esferas, SRD, WhatsApps) e 4 do
   subnav de categorias (Notícias, Análises, Guias, Downloads). E `menu-toggle`:
   **0 ocorrências**.

   `packages/ui/src/styles.css:2022-2024`, em telas ≤860px:

   ```css
   .artificio-header-main > nav,
   .artificio-subnav { display: none; }
   ```

   **Os 11 links somem e NADA aparece no lugar.** O usuário mobile do
   `artificiorpg.com` perde acesso a todos os outros projetos e a todas as categorias
   do blog — em `/`, em `/blog/`, nos 126 posts e nas 81 taxonomias. Toda página.

   **Por que só o `site`.** O `Header.tsx` do design system TEM o toggle
   (`packages/ui/src/Header.tsx:326`) e um `.artificio-mobile-nav` que abre com os
   links. Quem usa esse componente está coberto: `glossario`, `mesas`, `downloads`,
   `links`, `accounts`, `site-admin` (medido por import). O `site` é o **único** com
   header próprio — `SiteHeader.astro` — e copiou a marcação do nav **sem** copiar o
   toggle. O CSS que esconde vem do pacote compartilhado; o botão que compensa, não.

   É o caso exato de AGENTS.md §"Compartilhado por padrão": a pergunta não é "por que
   este quebrou", é "por que os outros não quebraram" — e a resposta é que os outros
   usam o componente, o `site` reimplementou.

   **Gravidade maior que a do botão "Todos os Posts".** Aquele é um caminho ruim para o
   acervo; este é navegação **inexistente** em mobile, onde está a maior parte do
   tráfego de blog.

   **Como um webdesigner resolve — pesquisado em 2026-09-14**, a pedido do mantenedor
   (*"como um webdesigner resolveria? não confie no contexto, pesquise"*). A pesquisa
   **contradiz a primeira proposta do agente**, que era só replicar o hambúrguer do
   `Header.tsx`:

   - **Hambúrguer puro custa descoberta.** NN/g, teste quantitativo com 179 pessoas:
     *"discoverability is cut almost in half by hiding a website's main navigation"*;
     quem usa navegação escondida usa **mais tarde** na tarefa, com tempo maior e
     dificuldade percebida maior. Pesquisa mais recente mostra que o ícone hoje é
     reconhecido, mas o **custo de interação** do passo extra permanece.
   - **O padrão híbrido é recomendação explícita da NN/g**, não inferência: *"Use a
     combination navigation where some options are exposed and the rest are
     collapsed"*. No mesmo estudo, o melhor desempenho era híbrido: *"People used the
     navigation significantly more on SupermarketHQ (89% usage) than on Bloomberg (44%
     usage)"* — e o BBC, também híbrido, teve o menor tempo até a navegação (21s).
     *(Correção 2026-09-14: a versão anterior citava "BBC 84% de uso". Esse número não
     está na prosa do artigo — só no gráfico. Removido; o 89% do SupermarketHQ, esse
     literal, já sustenta o ponto.)* **Números primários do estudo** (179 participantes, 6 sites,
     2016): desktop **39% mais lento** com navegação escondida, mobile **15% mais
     lento**; navegação visível usada **~2× mais** no desktop e **1,5× mais** no mobile;
     dificuldade percebida **+21%**.

     **⚠️ Removido por falta de fonte (2026-09-14): "elevou descoberta em 30%+ e
     acelerou a tarefa em 40%".** Pesquisado na origem: o número circula em blogs de
     agência que citam "múltiplos estudos de caso" sem identificar nenhum, e a NN/g —
     que é a fonte primária do assunto — mede grandezas diferentes (as acima). Não
     reintroduzir. Os números primários já sustentam a decisão sozinhos.
   - **Rótulo importa:** citação literal da NN/g (2025), *"A label is especially helpful
     for less-experienced users or when introducing the pattern in unfamiliar
     contexts"*. *(Correção 2026-09-14: a versão anterior dizia "prejudica mais quem tem
     +40 anos". O artigo **não menciona idade** — fala em "less-experienced users".
     Número inventado, removido.)*

   **Aplicado a este site**, que tem 7 projetos + 4 categorias = 11 itens: esconder os
   11 atrás de um ícone repete o erro que a pesquisa desaconselha. O que fica visível
   se decide pela **regra de acesso** (ver auditoria adiante), não por "qual é mais
   importante": as ferramentas públicas pertencem à esquerda, e é dela que se escolhe os
   3–5 itens que permanecem visíveis em mobile. O restante vai para o painel, e o toggle
   leva rótulo textual, não só ícone. **A porta de entrada da sessão — o botão "Entrar"
   — é a exceção: pública, mas fica na direita** (ver item 15).

   **Requisitos de acessibilidade do toggle, não negociáveis** (WCAG, pesquisado):
   `aria-expanded` refletindo o estado; `aria-label` que muda com o estado ("Abrir
   menu" / "Fechar menu"); **Escape fecha**; foco navegável e com saída (sem armadilha
   de foco); botão de fechar como **primeiro elemento focável** dentro do painel; alvo
   de toque **44×44px** (WCAG 2.5.5); e respeitar `prefers-reduced-motion` na animação.

   **O `links` JÁ RESOLVEU, e é o modelo — medido em 2026-09-14.** O mantenedor pediu
   revisão do mobile de todos (*"seria importante revisar o mobile de todos… é um site
   só com subdomínios, mas conectam pelo site"*), e a varredura dos 7 subdomínios
   mostrou que o `site` é o único Astro quebrado:

   | subdomínio | tipo | toggle no HTML | nav no HTML | situação |
   |---|---|---|---|---|
   | `artificiorpg.com` (site) | Astro SSG | **0** | 11 | **quebrado** — nav some, nada no lugar |
   | `links` | Astro + ilha React | **1** | 7 | **correto** |
   | `glossario` | SPA React | 0 | 0 | casca vazia (2.789 B) |
   | `mesas` | SPA React | 0 | 0 | casca vazia (3.327 B) |
   | `downloads` | SPA React | 0 | 0 | casca vazia (3.073 B) |
   | `accounts` | SPA React | 0 | 0 | casca vazia (1.349 B) |
   | `srd`, `esferas` | — | — | — | **HTTP 000** |

   **`apps/links/src/components/PortalHeader.astro` monta `<LinksHeader client:load />`**
   — o Astro pré-renderiza o componente React no build, e o toggle mais os 7 links
   **saem no HTML** (medido: 42.741 B, 37 `astro-island`). O `site` é Astro igual e
   reimplementou o header à mão em `SiteHeader.astro`. **A correção do `site` não é
   inventar navegação mobile: é fazer o que o app irmão já faz.** Isso muda a escolha
   entre as duas saídas abaixo — a 1 deixa de ser "escrever do zero".

   1. `SiteHeader.astro` monta o `Header` do design system como ilha, no padrão do
      `links`. Contido no `site`, sem tocar pacote compartilhado. **Atenção:** herda o
      hambúrguer-puro que a pesquisa acima desaconselha — aceitável como correção
      imediata do defeito, com o híbrido ficando para revisão do pacote.
   2. Revisar o padrão mobile **no `packages/ui`**, aplicando o híbrido (3–5 itens
      visíveis + hambúrguer para o secundário). Corrige `site` e os 6 apps de uma vez,
      mas é pacote compartilhado: §Autorização exige aprovação + verificação de impacto
      nos consumidores.

   **Achado lateral com impacto em TODO o portal: dois itens do menu compartilhado são
   links mortos.** `packages/ui/src/modules.ts:8-16` lista 7 projetos, mas `apps/` tem
   `accounts`, `downloads`, `glossario`, `links`, `mesas`, `site`, `site-admin` —
   **não existem `srd` nem `esferas`**, e os dois subdomínios devolvem **HTTP 000**
   (falha de conexão, não 502). Todo app que usa o nav compartilhado publica esses dois
   links. Por AGENTS.md §"Não lançado ≠ não deve subir" isso é deploy pendente, não
   rota indevida — mas o usuário que clica hoje bate em erro de conexão. **DECIDIDO
   em 2026-09-14: ficam no menu** (*"fica para depois"*). Não remover do
   `modules.ts` por conta própria; a pergunta está respondida.

   **NÃO MEDIDO — os 4 SPAs.** `glossario`, `mesas`, `downloads` e `accounts` entregam
   casca vazia por `curl` (1.349–3.327 B, `id="root"`, um `type="module"`): o nav só
   existe depois do JS hidratar, então **`curl` não avalia o mobile deles**. Precisa de
   navegador real. Não afirmar que estão corretos nem que estão quebrados — não foi
   medido.

   **A divisão esquerda/direita é REGRA DE ACESSO, não de tipo de conteúdo.** Regra do
   mantenedor, 2026-09-14, na formulação final e definitiva: *"esquerda o que não
   precisa estar logado, direita o que precisa estar. no sentido de ferramentas e
   opções"*.

   A primeira formulação que ele deu (*"esquerda é do módulo em si… direita são as
   opções do usuário"*) descrevia **onde as coisas estão hoje**; o critério real é
   **exige sessão ou não**. O agente registrou a descrição como se fosse o critério —
   erro corrigido aqui. Consequência prática: item público na direita ou item que
   exige login na esquerda está no lado errado, mesmo que "pareça" do módulo ou do
   usuário.

   Medido: o `Header.tsx` já implementa exatamente três faixas —

   | faixa | prop | o que carrega HOJE | onde renderiza |
   |---|---|---|---|
   | esquerda (linha topo) | `navItems` | os 7 projetos do portal | `Nav`, linha 256 |
   | esquerda (2ª linha) | `moduleNav` | links do módulo | `.artificio-subnav`, linha 342 |
   | direita | `.artificio-session` | busca, changelog, tema, botão "Entrar", avatar + `userMenu` | linhas 285–323 |

   **Atenção:** a coluna acima descreve o estado ATUAL, que não segue a regra de
   acesso — e é resumo, não inventário: a direita carrega ainda a prop `actions` e o
   `menu-toggle` (`Header.tsx:320-336`). **Três** itens estão no lado errado (busca,
   changelog e tema); o "Entrar" é público mas fica na direita por ser a porta de
   entrada da sessão. Ver a auditoria logo abaixo, que é o que vale para a
   implementação.

   **O defeito:** `.artificio-mobile-nav` (linha 347) renderiza `navItems` **e**
   `moduleNav`, mas **NÃO o `userMenu`**. Em ≤860px, `.artificio-header-main > nav` e
   `.artificio-subnav` somem (`styles.css:2022`) e o painel devolve só as duas faixas
   esquerdas. **As opções do usuário não têm painel mobile** — dependem do avatar, que
   fica no `.artificio-session` e sobrevive ao breakpoint. Funciona para quem está
   logado; para o resto, a faixa direita simplesmente não existe em mobile.

   **Estado do `moduleNav` por app — a faixa esquerda de conteúdo quase não é usada:**

   | app | `moduleNav` | observação |
   |---|---|---|
   | `mesas` | ✅ `Catálogo`, `Painel` | única implementação de referência |
   | `downloads` | ❌ | tinha e **saiu por decisão**: spec 086 T10.2/T10.3 moveu "Sobre e uso" para o footer (institucional, não catálogo), com teste em `AppShell.test.tsx:52` |
   | `glossario` | ❌ | nunca teve |
   | `links` | ❌ | nunca teve |
   | `accounts` | ❌ | nunca teve |
   | `site` | ❌ | header próprio; tem `SECTIONS` (4 categorias) que **é** a faixa esquerda, mas montada à mão fora do contrato |

   **Leitura:** a regra do mantenedor não é desenho novo — é o contrato que o
   `Header.tsx` já expressa e que os apps deixaram de preencher. O `site` chega a ter o
   conteúdo certo (`SECTIONS` = categorias do blog) no lugar certo (2ª linha), só que
   fora do componente compartilhado, o que é como ele perdeu o toggle.

   **DECIDIDO pelo mantenedor em 2026-09-14 — não reabrir:**

   - **`accounts`, `glossario` e `links` NÃO ganham `moduleNav`.** Literal: *"accounts
     não ganha. não tem. glossario e links também não precisa"*. O `accounts` é fluxo
     de sessão, sem conteúdo próprio para navegar; `glossario` e `links` têm superfície
     única. **Não "completar" isso depois achando que é lacuna** — a faixa esquerda de
     conteúdo só existe onde há conteúdo a navegar, hoje `mesas` (Catálogo/Painel) e
     `site` (as 4 categorias do blog).
   - **`srd` e `esferas` ficam no menu**, como estão. Literal: *"fica para depois"*. Os
     dois seguem dando HTTP 000 e sem app em `apps/` — é deploy pendente, coerente com
     AGENTS.md §"Não lançado ≠ não deve subir". Não remover do
     `packages/ui/src/modules.ts` por conta própria.

   **EM ABERTO, pendente de decisão de desenho:** o painel do celular
   (`.artificio-mobile-nav`) hoje recebe `navItems` + `moduleNav` e **não** o
   `userMenu` ("Meu Perfil", "Painel", "Gestão"). Essas seguem atrás do avatar, que não
   some no breakpoint — não está quebrado para quem está logado.

   Depois de T3.5e o painel passa a carregar também busca, changelog e tema, que migram
   para a esquerda ("Entrar" permanece na direita — ver item 15). A pergunta que resta é
   se o `userMenu` ganha lugar nele ou continua só no avatar. Escolha de desenho, não
   conserto, e mexe em `packages/ui` (§Autorização).

   ---

   #### Auditoria da regra de acesso — o código NÃO segue a regra

   Medido em 2026-09-14 contra o critério do mantenedor (*"se não precisa de login,
   então é esquerda; se precisa, é direita"*). O que existe hoje é **"navegação à
   esquerda, ferramentas à direita"** — organização por TIPO. A regra do mantenedor é
   por ACESSO. São critérios diferentes, e o código segue o outro.

   **Uma exceção, fixada pelo mantenedor em 2026-09-14** (*"na direita tem que ter ao
   menos o login. login é publico, senão não tem como o cara entrar"*): o botão
   "Entrar" é público mas **fica na direita**. Aplicar o critério ao pé da letra o
   mandaria para a esquerda e tiraria o login do lugar onde o usuário o procura — o
   mesmo lugar onde o avatar aparece depois de logar. A formulação precisa da regra é:
   ***ferramenta pública à esquerda; a sessão e a porta para ela, à direita.***

   **Direita (`.artificio-session`) — 3 de 6 itens estão no lado errado.** A auditoria
   original dizia "4 de 5" e errava nas duas pontas: contava o "Entrar" como item a
   mover (correção do mantenedor, ver abaixo) e ignorava o `menu-toggle`, que também
   vive nessa div (`Header.tsx:324-336`).

   | item | origem | exige login? | veredito |
   |---|---|---|---|
   | Busca | `showSearch`, `Header.tsx:285` | não | ❌ mover p/ esquerda |
   | Changelog | `showChangelog`, `Header.tsx:299` | não | ❌ mover p/ esquerda |
   | Tema | `showThemeToggle`, `Header.tsx:319` | não | ❌ mover p/ esquerda |
   | Botão "Entrar" | `renderSession()`, `Header.tsx:225` | não | ✅ **fica** — é a porta de entrada da sessão |
   | `actions` (prop) | `Header.tsx:320-322` | depende do app | ✅ fica — conteúdo do consumidor |
   | `menu-toggle` | `Header.tsx:324-336` | não | ✅ fica — controle do painel mobile |
   | Avatar + `userMenu` | `renderSession()`, `Header.tsx:181` | **sim** | ✅ fica |

   Os três primeiros são renderizados **sem nenhuma condição de sessão** — medido: não
   há `user`/`loading` no caminho deles.

   **Esquerda — uma violação:**

   | faixa | conteúdo | exige login? | veredito |
   |---|---|---|---|
   | `navItems` | 7 projetos do portal | não | ✅ |
   | `moduleNav` (`mesas`) | `Catálogo` | não | ✅ |
   | `moduleNav` (`mesas`) | **`Painel`** | **sim** | ❌ sai da esquerda |

   `mesas` põe `Painel` nos DOIS lados (`AppShell.tsx:16` no `userMenu`,
   `AppShell.tsx:22` no `moduleNav`). `routes.ts:30` declara `/painel` entre as
   "Autenticadas" e `PainelMestrePage.tsx:254` faz `if (!user || !isAuthenticated)` →
   redireciona. É o único app com `moduleNav`, logo o único candidato a essa violação.

   **`userMenu` — tudo exige login, está certo.** `Header.tsx:170-174` concatena
   `globalMenuItems` (Perfil Artifício, conta de serviço) com os itens do app,
   filtrando `adminOnly` por `user?.role === "admin"`. Só renderiza dentro de
   `if (user)`.

   **Alcance por app (medido):**

   | app | ferramentas públicas na direita | `Painel` duplicado |
   |---|---|---|
   | `site` | 4 — changelog, busca, **sino de notificação**, tema (`SiteHeaderIsland.tsx:62-94`) | não |
   | `mesas` | 3 (busca, changelog, tema) | **sim** |
   | `downloads` | 3 | não (sem `moduleNav`) |
   | `glossario` | 3 | não |
   | `links` | 3 | não |

   `accounts` fora da tabela de propósito: é fluxo de sessão, sem navegação de conteúdo
   — o mantenedor já o tirou de discussão em 2026-09-14 (*"accounts não ganha. não
   tem"*). Não reintroduzir em auditoria de navegação.

   O `site` tem um item a mais: `<NotificationBell sourceApp="site" />`. **Medido: o
   sino EXIGE sessão** — `packages/ui/src/NotificationBell.tsx:266` faz
   `if (!user) return null`, e a busca de notificações (linha 166) também aborta sem
   `user`. Pela regra de acesso, **fica na direita** junto com o avatar. É a única
   ferramenta do header que não se move.

---

#### Subfases propostas — NÃO implementar sem autorização por ação

**Escopo autorizado pelo mantenedor em 2026-09-14:** as 7 subfases entram nesta spec,
incluindo `packages/ui` (T3.5e) e `apps/mesas` (T3.5f). Autorização de **escopo**, não
de ação: cada `git commit`/`push` segue exigindo pedido nomeado (AGENTS.md
§Autorização).

Ordem deliberada: cada uma é independente e reversível sozinha, e as que tocam
`packages/ui` vêm por último porque têm o maior raio de impacto — se algo regredir, o
que já estiver verde não entra na investigação. **Exceção:** T3.5d e T3.5g são o mesmo
trabalho (ver aviso em T3.5g).

**T3.5a — canonical, `h1` e `title` da raiz (`apps/site`).** O defeito de indexação que
originou esta task. Não depende de nada abaixo. Três correções em
`apps/site/src/pages/index.astro`:

1. `canonical` (linha 13) passa de `https://artificiorpg.com/blog/` para
   `https://artificiorpg.com/`. **`og:url` vem junto sozinho** — ele não existe no
   `index.astro`: é derivado do `canonical` em `packages/content/src/meta.ts:16`
   (`{ property: "og:url", content: input.canonical }`), via `Base.astro` → `buildMeta`.
   Não há segunda edição a fazer.
2. Ganha um `h1` (hoje o primeiro heading é o `h2` "Mais recentes", linha 20).
3. **`title` e `description` distintos dos de `/blog/`** (decisão do mantenedor,
   2026-09-14). Hoje a raiz declara `title="Artifício RPG — Blog"` (linha 12) e
   `/blog/` declara `"Blog — Artifício RPG"`: corrigir só o canonical deixaria as duas
   páginas disputando a mesma consulta no SERP, que é o defeito que esta subfase existe
   para resolver. **Título definido pelo mantenedor:**
   `Artifício RPG - Artigos sobre RPG, Traduções, Dicas e Materiais`.

*Aceite:* itens 1–3 do Aceite geral.

**Estado: implementada e verificada no `dist` (2026-09-14).** `index.astro` com
canonical `https://artificiorpg.com/`, `title` definido pelo mantenedor, `description`
distinta da de `/blog/`. Medido no build: canonical e `og:url` auto-referentes, 1 `h1`,
ordem `h1 h2 h3 h2 h3`.

**O `h1` sozinho REPROVAVA o aceite 3 — a ordem ficava `h1 → h3 → h2`.** `Card.astro`
emite `h3` no título do card, e o hero vem antes do `h2` "Mais recentes": pôr só o `h1`
no topo deixa um `h3` entre ele e o primeiro `h2`. Por isso a home ganhou também um `h2`
"Destaque" antes do hero (`.section-title` no `global.css`). A contagem de `h1` passava
nos dois casos — é exatamente o que o aceite 3 previne ao cobrar a ordem, não o número.

**Achado menor do bloco, corrigido junto:** `404.astro` passou a
`canonical="https://artificiorpg.com/404/"` (com barra, conforme `trailingSlash`) e
ganhou `noindex`. **Efeito a conferir:** `buildMeta` (`packages/content/src/meta.ts:24`)
emite `noindex,nofollow` juntos — não há como pedir um sem o outro. Em página de erro
não há link a preservar, mas foi efeito não medido antes da edição.

**T3.5b — botão "Todos os Posts" (`apps/site`).** Dois botões, topo e fim da grade,
`.artificio-button-secondary`, e o `.section-head` responsivo. **Não inclui mais
definir `--surface-subtle`/`--line-strong`:** a premissa de que o hover morria foi
refutada por medição no bundle (2026-09-14, ver bloco acima). Definir os dois no
`global.css` continua sendo blindagem legítima contra mudança de ordem de import, mas é
opcional e não bloqueia esta subfase.
*Aceite:* itens 7–12.

**Estado: itens 7 e 8 verificados no `dist` (2026-09-14).** Dois botões
`.artificio-button .artificio-button-secondary .artificio-button-md`, o segundo depois
do fechamento da grade; `.see-all` removida do `global.css` (era a única ocorrência no
repo — medido: `rtk rg "see-all" apps packages` devolvia só a definição);
`.section-head` com `flex-wrap`/`gap` e `.all-posts-end` centralizado. Itens 9, 11 e 12
(foco visível, hover nos dois temas, 360px) exigem navegador — não medidos.

**⚠️ Comentário HTML (`<!-- -->`) na home REPROVA o aceite 7 sem defeito real.** O
aceite conta ocorrências de `href="/blog/"` no HTML servido por grep, e comentário HTML
vai para o arquivo. Um comentário que cite a string literal do link é contado como um
terceiro: medido, deu 3. Comentário na home que precise citar o link usa `{/* */}`, que
o Astro não emite. Vale para qualquer edição futura do `index.astro`.

**T3.5c — paginação de `/blog/` (`apps/site`).** Fatias com URL e canonical próprios,
paginador numerado (`1 2 3 … N`, com primeira/última), links `<a href>` reais.

**DEFINIDO em 2026-09-14 — não reabrir:**

1. **URL das fatias: `/blog/2/`, `/blog/3/`…** Determinação do mantenedor, literal:
   *"URL É BLOG/2"*. `/blog/` continua sendo a fatia 1 (não existe `/blog/1/`).
2. **Fatia de 24 posts** → **6 páginas** para os 126 atuais. O mantenedor mandou
   escolher pela melhor prática de indexação (*"A ESCOLHA DA FATIA É A MELHOR PRÁTICA
   PARA INDEXAR NO GOOGLE"*). **A pesquisa abaixo sustenta PAGINAR, não o número 24** —
   nenhuma fonte do Google recomenda quantidade de itens por página (medido). O 24 é
   decisão de engenharia: peso do HTML por fatia e paginador que cabe na tela do
   celular. *(Correção 2026-09-14: a redação anterior dizia "a pesquisa abaixo é o que
   sustenta o número", contradizendo o que o próprio bloco admite adiante.)*

**⚠️ A "recomendação de 24–48 do Google" NÃO EXISTE na fonte.** Várias páginas de
agência atribuem essa faixa à documentação de e-commerce do Google. Fui à doc primária
(`developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading`)
e ela **não menciona número nenhum** — nem faixa, nem limite, nem velocidade como
restrição. Não citar essa faixa como oficial.

**O critério que o Google de fato dá**, citação literal da doc: *"URLs in a paginated
sequence are treated as separate pages by Google."* A doc **não** usa "crawl budget",
**não** diz que as páginas "competem" por nada e **não** recomenda número de itens por
página (verificado na fonte primária em 2026-09-14; a versão anterior deste bloco
atribuía "compete por crawl budget" à doc, o que ela não diz). Ser página separada
significa que cada fatia é indexável por si — que é o **benefício** buscado aqui, não um
custo. *(A redação anterior emendava "mais fatias = mais URLs a rastrear e indexar pelo
mesmo acervo", mantendo pela porta dos fundos o enquadramento de risco de rastreio que o
estudo logo abaixo enfraquece.)*

**⚠️ O estudo dos "67% / 0,3%" existe, mas conclui o CONTRÁRIO do que esta spec
insinuava.** Fonte localizada em 2026-09-14: Glenn Gabe (GSQi), 07/10/2021,
[*What happens to crawling and Google search rankings when 67% of a site's indexed urls
are pagination?*](https://www.gsqi.com/marketing-blog/pagination-indexing-levels-seo-case-study/).
Os números conferem — 67% das URLs indexadas eram paginação, gerando 0,3% dos cliques
(5.000 de 1,62M em três meses). Mas a conclusão do autor é que **não houve dano**:
*"Yes, your site can be fine SEO-wise with a lot of pagination indexed"* e *"Google has
a long history of handling pagination and it typically will not cause many problems
across a site rankings-wise"* — a performance do site foi estável por anos, atravessando
vários core updates. **Não citar este estudo como risco de paginar.** Ele sustenta, no
máximo, que paginação indexada rende pouco clique direto — não que prejudique o site.
Isso enfraquece o argumento "menos fatias = menos desperdício": a escolha de 24 se
sustenta pelo peso do HTML e pela usabilidade do paginador, não por risco de rastreio.

**Medido no `/blog/` de produção (2026-09-14):** 1.347 B por card, 14.419 B de
estrutura fixa (header + 12 pílulas + footer). Os pesos da tabela são **medidos**, não
derivados da fórmula — a conta `24 × 1.347 + 14.419` dá 46.747, e a medição deu 46.756.
A diferença de 4–18 B por linha é arredondamento da medida. **Não "corrigir" a tabela
para bater com a fórmula.**

| fatia | páginas | peso medido |
|---|---|---|
| 12 | 11 | 30.587 B |
| **24 (escolhida)** | **6** | **46.756 B** |
| 48 | 3 | 79.093 B |

**Por que 24, neste caso concreto:** 6 páginas mantêm o número de URLs baixo; o peso
cai de 184.714 B para ~46 KB (um quarto); e o paginador numerado (`1 2 3 4 5 6`) cabe
inteiro na tela do celular sem reticências. Com 12 seriam 11 URLs pelo mesmo acervo
para economizar 16 KB. Com 48, a primeira fatia já nasce com 79 KB.

**⚠️ MECANISMO — o `paginate()` nativo do Astro NÃO serve aqui.** Ele gera `/blog/1/`,
exatamente a URL que o item 6 do Aceite proíbe (a fatia 1 é `/blog/`). E hoje **não
existe paginação nenhuma** no app — `apps/site/src/pages/blog/` tem só `[slug].astro`,
`index.astro`, `categoria/` e `tag/`; nada gera `/blog/2/`. A implementação precisa de:

- `index.astro` continua sendo a fatia 1, passando a renderizar só os 24 primeiros
  (hoje: `posts.map(...)` sem recorte, linha 23);
- **uma rota nova `[...page].astro` — com spread (`...`), não `[page].astro`** — com
  `getStaticPaths()` **manual** emitindo apenas as páginas 2–6;
- o paginador numerado compartilhado entre as duas, com `<a href>` reais e
  `aria-current="page"` no número da fatia atual (padrão já usado no repo:
  `packages/ui/src/Nav.tsx:34`, com estilo em `styles.css:687`).

**Cada fatia precisa de identidade própria — title, description, `h1` e canonical.**
Se `[...page].astro` reusar os valores de `blog/index.astro:9-11,16` (`"Blog — Artifício
RPG"`, `"Todos os artigos do Artifício RPG: notícias, análises, guias e traduções."`,
`<h1>Todos os artigos</h1>`), as 6 fatias nascem idênticas entre si — e o Google trata
cada URL paginada como página separada (a doc citada acima). Seria o mesmo defeito de
duplicata que esta task existe para corrigir, reintroduzido na paginação.

O mecanismo é a prop do `Base.astro` — uma só, que resolve canonical e `og:url` juntos
(`Base.astro:11-14` declara `title`/`description`/`canonical`; a linha 50 emite o
`<link rel="canonical">` e a 40 passa por `buildMeta`, que deriva `og:url` em
`packages/content/src/meta.ts:16`):

```astro
<Base
  title={`Todos os artigos — Página ${page} de 6 — Artifício RPG`}
  description={`Página ${page} de 6 do acervo do Artifício RPG: notícias, análises, guias e traduções.`}
  canonical={`https://artificiorpg.com/blog/${page}/`}
>
  <h1>Todos os artigos — Página {page} de 6</h1>
```

A fatia 1 (`/blog/`) mantém os valores atuais, sem sufixo de página.

**`lastmod` das fatias: nada a fazer.** `sitemap-lastmod.ts:63-66` resolve `/blog/2/`
como slug `"2"`, que não existe no índice de posts, e devolve o item sem `lastmod` —
que é o comportamento correto (URL sem data própria não recebe data inventada, trava
deliberada de T3.4).

**Por que spread e não `[page].astro`** (medido em `astro@6.4.8`,
`dist/core/routing/priority.js`): o `routeComparator` ordena rotas de mesmo tamanho
primeiro por estática > dinâmica > spread; entre duas dinâmicas puras o desempate é
`a.route.localeCompare(b.route)`, e `/blog/[page]` < `/blog/[slug]`. **`[page]` venceria
o `[slug]` no primeiro match**, e em `astro dev` todo post (`/blog/<slug>/`) seria
servido pela página de paginação — `page="meu-post"` → `NaN` → lista vazia. Produção
(SSG) não é afetada, porque os arquivos já estão gerados e nada roteia em runtime; o
estrago é no ambiente de quem implementa. O spread resolve na raiz: `aHasSpread → 1`
ordena `[...page]` **depois** de `[slug]`, e a fatia 1 continua sendo `/blog/` por
construção (sem `params.page`).

**Guard obrigatório no `getStaticPaths`: pular número que colida com slug real.** Se um
post tiver slug `"2"`, as duas rotas escrevem `blog/2/index.html` e o pipeline **não
avisa** — `generate.js` só checa conflito com `publicDir`, e o último write vence em
silêncio. Hoje não há colisão (medido: `SELECT slug FROM posts WHERE slug ~ '^[0-9]+$'`
→ 0 de 126 em produção; 0 de 8 no `posts.json` versionado), mas o guard evita que um
post futuro derrube uma fatia sem erro de build.

**O 404 de `/blog/1/` e `/blog/7/` está garantido.** O site é SSG puro
(`astro.config.mjs`: sem `output`, `trailingSlash: "always"`) e o `getStaticPaths`
manual não gera esses arquivos. O servidor de produção não faz fallback SPA: uma URL
inexistente sob `/blog/` já responde 404 hoje (medido ao vivo). Não confundir com o
`(catch-all) → http_status:404` do tunnel — aquele é por hostname não mapeado e não
diz nada sobre path dentro de um container.

*Aceite:* item 6.

**Estado: implementada, NÃO verificada.** `apps/site/src/pages/blog/[...page].astro`
(spread + `getStaticPaths` manual 2..N + guard de slug numérico),
`components/Paginador.astro` (compartilhado entre a fatia 1 e as 2..N, `<a href>` reais,
`aria-current="page"`), `lib/content.ts` (`POSTS_POR_FATIA`, `totalFatias`,
`postsDaFatia`, `slugsNumericos`) e `blog/index.astro` recortado para 24.

**O aceite 6 não é verificável localmente, e isto não é pendência de implementação.** O
`posts.json` versionado tem 8 posts → `totalFatias()` = 1: o `getStaticPaths` não emite
`/blog/2/` e o `Paginador` não renderiza (`total > 1` falso). Build medido em
2026-09-14: 47 páginas, sem erro, `/blog/` com os 8 cards, `blog/1/` inexistente. As
6 fatias e todo o item 6 só se provam com os 126 posts — mesmo ciclo export + build +
deploy de T3.3. Não declarar T3.5c concluída antes disso.

**T3.5d — navegação mobile do `site` (`apps/site`).** Corrige os 11 links que somem
em ≤860px. Contido no app.

**Medido: o `site` JÁ monta ilha React** — `SiteHeader.astro:30` tem
`<SiteHeaderIsland client:idle />`. Não é "adotar um padrão novo": a marcação do
nav é que foi escrita à mão em Astro puro, fora da ilha, e por isso ficou sem o
toggle. **Duas diferenças a decidir na implementação:**

- **Onde o nav é montado.** Hoje o `SiteHeader.astro` renderiza `MODULES` e
  `SECTIONS` como HTML estático; o toggle precisa de estado, logo o nav precisa
  entrar na ilha (ou ganhar uma ilha própria).
- **`client:idle` vs `client:load`.** O `site` usa `idle`, o `links` usa `load`.
  `idle` hidrata quando o navegador fica ocioso — um toggle que só responde depois
  disso é pior que o de hoje em conexão lenta. Medir antes de escolher.

*Aceite:* item 13.

**Estado de T3.5d+g: implementadas juntas, aceite 13 verificado no `dist` (2026-09-14).**
`SiteHeader.astro` ficou só com a marca; `SiteHeaderIsland.tsx` recebe `modules`,
`sections`, `siteOrigin` e `pathname` por prop e monta nav, ferramentas públicas,
sessão, subnav e painel mobile. Medido nas 4 páginas do build (home, `/blog/`,
categoria, post): **11 `artificio-nav-link` e 1 `artificio-menu-toggle`** em todas —
antes eram 11 e **0**. `tsc --noEmit` e `eslint` exit 0. CSS: nenhuma regra nova de
toggle/painel foi preciso escrever — `.artificio-menu-toggle` e `.artificio-mobile-nav`
já existem em `packages/ui/src/styles.css:611-638` e `2027-2035`.

**A causa dos 11 links sumirem estava no CSS COMPARTILHADO, não no app.**
`packages/ui/src/styles.css:2022` esconde `.artificio-header-main > nav` em ≤860px —
filho direto. A nav do `site` era filha direta (`SiteHeader.astro:16`), então sumia pela
regra de um pacote que o app nem sabia estar seguindo, e sem hambúrguer não havia
substituto. Não procurar a causa no `global.css` do site: ele não tem override de header
nenhum (medido).

**T3.5g NÃO era só reordenar itens dentro do TSX — a spec descrevia a estrutura errada.**
A ilha INTEIRA estava dentro de `.artificio-session` (`SiteHeader.astro:29-31`, versão
anterior): o wrapper era do Astro e envolvia tudo que o TSX renderizava. Mover busca,
changelog e tema "para a esquerda" exigiu tirar o wrapper do `.astro` e a ilha passar a
renderizar como fragmento, com `.artificio-session` criada dentro dela em volta apenas
de sino + sessão + toggle. As ferramentas públicas ficaram em `.artificio-header-tools`
(classe nova; não existia no repo — medido), 4ª coluna do grid do header no `global.css`.

**⚠️ Regressão introduzida e corrigida no mesmo trabalho — `aria-current` do nav.** Ao
mover o nav para a ilha, a condição `m.label === "Portal"` virou
`currentHref === item.href`, e o atributo sumiu de TODAS as páginas (medido no dist: 0
ocorrências). Causa: **nenhuma rota do `site` passa `currentHref`** — só o `Base.astro`
declara e repassa a prop, ninguém a preenche (medido: `rtk rg "currentHref"
apps/site/src/pages` → exit 1). O item "Portal" aponta para `BRAND_ORIGIN`
(`modules.ts:9`), que é a origem deste próprio site, então a comparação correta é por
href contra a origem. A ilha agora recebe `siteOrigin` e `pathname` do Astro e resolve o
destaque no SSR.

**Achado preexistente, corrigido junto:** a subnav de categorias NUNCA destacou a seção
ativa — dependia do mesmo `currentHref` que ninguém passa. O fallback por `pathname`
(prefixo da URL da categoria) resolve sem exigir que cada página passe prop.

**`client:idle` mantido** (precedente do aceite 13: `NotificationBell`/`ThemeToggle` já
hidratam assim e funcionam). Os 11 links não dependem da hidratação — vêm do SSR do
React, medido no HTML servido.

**T3.5e — regra de acesso no `packages/ui`. ESCOPO AUTORIZADO pelo mantenedor em
2026-09-14** (*"PODE TOCAR no compartilhado"*). Move para a **esquerda**: busca,
changelog e tema — as ferramentas públicas. Fica na **direita**: avatar, `userMenu`, o
**sino de notificação** (medido: exige sessão), o **botão "Entrar"** e o `menu-toggle`.
Muda o header de todos os apps de uma vez.

**O "Entrar" fica na direita mesmo sendo público** (correção do mantenedor,
2026-09-14): é o acesso à sessão, e ocupa o lugar onde o avatar aparece depois do login.
A regra é *"ferramenta pública à esquerda; sessão — e a porta para ela — à direita"*,
não *"tudo que é público à esquerda"*.

**A autorização é de ESCOPO, não de ação.** Editar `packages/ui` está liberado; o
`git commit`/`push` continua exigindo autorização nomeada a cada vez (AGENTS.md
§Autorização). E segue valendo a verificação de impacto nos consumidores — é o que o
aceite 16 cobra.
*Aceite:* itens 14–16.

**Estado: implementada; aceites 14–15 verificados em código, aceite 16 PENDENTE.**
`Header.tsx`: busca, changelog e tema saíram de `.artificio-session` para um
`.artificio-header-tools` novo, renderizado antes dela e só quando o app liga ao menos
uma das três (sem container vazio, sem coluna sobrando). Ficaram na direita `actions`,
`renderSession()` (avatar + menu + o botão "Entrar") e o `menu-toggle` — exatamente a
lista do aceite 15. `styles.css` ganhou `.artificio-header-tools` e a 4ª coluna do grid.

**Validação medida (2026-09-14):** `packages/ui` — `tsc` exit 0, `eslint` exit 0, build
exit 0, **20 arquivos / 85 testes** passando. Consumidores: `mesas` **86/1152**,
`downloads` **54/315** (é o que inspeciona o header real em `AppShell.test.tsx`),
`glossario` **4/37**, `site` **16/170**, todos passando; `tsc` exit 0 em `links`,
`site-admin`, `glossario/frontend` e `accounts/frontend`. `links` não tem suíte
(`"(links) no tests"`).

**⚠️ O mobile quebraria: o grid de ≤860px estava fixo em 2 colunas.**
`styles.css:2019` declarava `grid-template-columns: 1fr auto` — suficiente enquanto as
ferramentas viviam DENTRO de `.artificio-session` (2 filhos visíveis: brand e sessão).
Com o container novo são 3, e o terceiro cairia em coluna implícita, empurrando a faixa
de sessão para fora da área visível. Corrigido para `1fr auto auto`, na regra normal e
na `[data-has-search="true"]`. Este é o risco real do aceite 16: **é layout, e nenhum
teste de unidade o pega** — a suíte inteira passou com o valor errado.

**Dedup: o `global.css` do `site` não tem mais regra de header.** T3.5d/g haviam criado
`.artificio-header-tools` e o grid de 4 colunas no app; com T3.5e a definição subiu para
`packages/ui/src/styles.css` e chega ao site pelo `@import` (`global.css:8`). Manter as
duas seria a divergência-por-app que o AGENTS.md trata como defeito: a cópia local
venceria em silêncio se a regra do pacote mudasse. Medido no CSS emitido do site: as 2
regras de `.artificio-header-main` (desktop `auto 1fr auto auto`, mobile `1fr auto
auto`) vêm só do pacote, e o aceite 18 continua verde.

**O aceite 16 exige navegador** — "header não quebra em desktop nem em ≤860px", em
`mesas`, `downloads`, `glossario`, `links`, `site-admin` e `accounts`. Não declarar
T3.5e concluída antes do smoke.

**O SMOKE ACONTECEU E FALHOU — achado do mantenedor em `beta.artificiorpg.com`,
2026-09-14, depois do Deploy A (run `34903089436`).** Relato: *"site beta mobile: não tem
as funções do desktop. Não tem changelog nem mudar para escuro. O nome do usuário ficou
muito feio ao lado."* Três defeitos de layout, todos confirmados por medição no CSS e no
HTML servidos. **O aceite 16 está REPROVADO no `site`** — o único dos 6 apps que tem
deploy nesta spec.

**CORRIGIDO em 2026-09-14, com guard. Ainda NÃO deployado.**

**Causa raiz dos dois primeiros: a ilha do `site` NÃO montava a estrutura que o grid do
pacote espera.** O comentário do `global.css` afirmava que montava "a MESMA estrutura";
era falso. Medido:

- `Header.tsx` põe brand, nav, `.artificio-header-tools` e `.artificio-session` como os
  **4 filhos diretos** de `.artificio-header-main` — casa com `auto 1fr auto auto`.
- `SiteHeader.astro` abria o grid e punha a ilha dentro. Ao hidratar, o Astro injeta um
  `<style>` e um `<script>` como **irmãos** do `<astro-island>`, no mesmo pai — os dois
  são filhos diretos do grid e ocupam coluna. **Medido no HTML do beta (`1c833b5`):**
  dentro do grid estavam `<style>`, `<script>`, `<astro-island>`, nav e tools — **5
  itens para 4 colunas**, 3 em ≤860px. A subnav, que é 2ª linha do header, também caía
  na barra.

**O `<astro-island>` NÃO era o problema — e a primeira versão deste bloco dizia que era.**
O Astro emite `astro-island,astro-slot,astro-static-slot{display:contents}` por conta
própria (conferido no HTML servido de beta e prod), então o elemento é transparente ao
layout. O agente viu 2 filhos no DOM, concluiu que o grid via 2 colunas e escreveu isso
no código e aqui, sem verificar se aquele elemento gerava caixa — e sem pesquisar, embora
o comportamento do `<style>`/`<script>` injetados seja documentado pela comunidade Astro.
A correção adotada acerta por remover os três de dentro do grid; o diagnóstico registrado
é que estava errado. Não adicionar `display:contents` ao CSS do projeto achando que
corrige: já está lá, e não alcança os irmãos nem a subnav.

Em ≤860px o pacote reduz para `1fr auto auto` contando que a nav suma e sobrem 3 filhos
diretos. Com 2, o encaixe era outro e as ferramentas públicas saíam da área visível. **O
aceite 18 (dedup do CSS) continua verde e não causou isto** — o CSS estava certo; o
markup do consumidor é que divergia do contrato.

**A correção: a ilha virou dona do `<header>` inteiro.** `SiteHeader.astro` é só a ponte
(resolve assets da marca + dados de nav e repassa por prop, incluindo `logoNavy`/
`logoNeg`/`brandName`); `SiteHeaderIsland.tsx` renderiza `<header>` → grid com os 4
filhos diretos → subnav e painel mobile como **irmãos** do grid. É o padrão de
`apps/links` (`PortalHeader.astro` → `<LinksHeader client:load />`), o único outro header
por ilha do repo — e o único que **não** tinha o defeito (medido em produção).

**`display: contents` no `<astro-island>` foi descartado, e o motivo importa:** resolveria
a coluna, mas não a subnav. Ela é 2ª LINHA do header (`.artificio-header` é
`flex-direction: column`, com `border-top` próprio) e precisa ser IRMÃ do grid, não
filha. Um Fragment não produz filhos em dois níveis diferentes da árvore.

**Terceiro defeito, corrigido no pacote:** em `@media (max-width: 860px)`,
`.artificio-user-name` sai da tela por **ocultação visual** (`position:absolute` +
`clip-path: inset(50%)`), não por `display: none`. Vale para todos os consumidores. A
regra base (desktop) segue intacta.

**A primeira versão usava `display: none` e quebrava acessibilidade — achado do Codex na
PR #322, confirmado por medição.** O `<span>` do nome é o único texto dentro do
`<button aria-haspopup="menu">` do avatar (`Header.tsx:221` e `SiteHeaderIsland.tsx:240`);
a `<img>` ao lado tem `alt=""` por ser decorativa. Com `display: none` o elemento sai da
árvore de acessibilidade e o leitor de tela anuncia um botão de menu sem identificação —
WCAG 4.1.2. No caso do fallback sem avatar o texto das iniciais sobrevive, mas o nome
acessível vira "FT", que também não identifica.

**Nenhum teste pegava.** `Header.paineis.test.tsx:44` localiza o avatar por
`getByRole("button", { name: /fulano/i })` — depende exatamente desse nome acessível — e
passou verde com a regra errada, porque jsdom não aplica media query. Teste de
comportamento não alcança regra de CSS; o guard novo (`styles.contract.test.ts`, 2 testes)
assere sobre o CSS emitido.

**⚠️ ESTE BLOCO É DIAGNÓSTICO, NÃO ESPECIFICAÇÃO — não implementar a partir dele.**
Avaliado em 2026-09-15 a pedido do mantenedor ("veja se a spec está definindo bem para um
implementador conseguir implementar"): **não está.** Os defeitos, medidos na própria
leitura:

1. **Lugar errado.** Vive dentro de T3.5e, na F3 (`site`: canonical legado). Quem procura
   "header mobile" não acha. O mantenedor pediu fase nova; **a F7 ainda não existe**.
2. **Sem tasks.** Nenhum `T7.x`, nenhum critério de aceite, nenhuma ordem de execução.
3. **Duas aritméticas conflitantes convivem** sem dizer qual vale: a de **318/306px**
   (estrutura anterior, descartada pelo mantenedor) e a de **290px** (estrutura decidida).
4. **Decisões já tomadas aparecem como pergunta aberta:** "Adicionar Sugestão fica
   exposto" está decidido, mas a tabela de `actions` ainda o lista como problema; a
   exclusão mútua foi respondida ("quando um entra, outro tem que fechar") e o texto
   ainda pergunta.
5. **Falta o essencial para implementar:** onde ficam changelog e tema DENTRO do painel
   público; o que acontece com a subnav de módulo em mobile; se o `site` ganha lupa ou
   campo; como o `downloads` (campo embutido, sem `/busca`) se encaixa nos 4 slots.
6. **Duas decisões do mantenedor seguem pendentes e bloqueiam:** tokens (renomear os 4
   para `--artificio-*` ou estender o guard aos apps) e a busca do `downloads`.

O material medido abaixo é válido e deve ser MOVIDO para a F7 ao criá-la, não recopiado.

**⚠️ ABERTO — o header estoura abaixo de ~400px, e JÁ ESTÁ EM PRODUÇÃO.** Achado P1 do
Codex na #322, confirmado por aritmética sobre os valores medidos no CSS:

| item | largura | origem |
|---|---:|---|
| logo | 90px | PNG 300×100 a `height:30px`, `flex-shrink:0` |
| 3 ferramentas | 128px | 3 × `min-width:40px` + 2 × `gap:4px` |
| sessão (logado) | 112px | sino 40 + avatar 32 + hambúrguer 40 |
| sessão (deslogado) | 124px | "Entrar" (`padding:0 18px` + texto) + hambúrguer 40 |
| gaps + padding | 64px | 2 × `gap:16px` + `padding:8px 16px` |
| **total** | **394px logado · 406px deslogado** | |

Estoura em 360, 375 e 390 — as larguras mais comuns. Nada encolhe: `min-width:40px` nos
botões, `flex-shrink:0` no logo, e as colunas `auto` do grid não cedem.

**Não foi a #322 que introduziu.** `grid-template-columns: 1fr auto auto` e
`.artificio-header-tools` já estavam em `origin/dev` desde T3.5e (`93b325f`); o diff da
#322 no `@media` só acrescenta a regra do `user-name`. Com o CSS anterior (`1fr auto`) a
soma dava **378px** — já estourava em 360 e 375. T3.5e piorou em 16px (um gap a mais).

**Está no ar só no `site`.** Medido no CSS servido: `artificiorpg.com` tem
`1fr auto auto` + `header-tools` (chegou pelo Deploy B); `mesas` e `glossario` ainda
servem `1fr auto`, versão pré-T3.5e. Os outros 4 apps recebem quando forem deployados.

**Duas soluções óbvias NÃO servem — pesquisadas e descartadas por medição:**

- **`minmax(0, 1fr)` / `min-width: 0`** é a resposta canônica para *grid blowout*, mas
  vale quando o conteúdo PODE encolher. Aqui não pode: `min-width:40px` em cada
  `.artificio-header-action` e `.artificio-menu-toggle`, `flex-shrink:0` no logo. A
  própria fonte que documenta a técnica (defensivecss.dev) diz não cobrir o caso de
  conteúdo com mínimo maior que a viewport.
- **`overflow: hidden`** mascara sem corrigir e esconde botão interativo — desaconselhado
  explicitamente pelas fontes.

**A solução estabelecida, convergente entre Material Design 3 e headers reais:** o que não
cabe vai para o overflow/drawer, e as ações mais usadas ficam na barra. O painel do
hambúrguer já existe (`.artificio-mobile-nav`).

**Aritmética da correção** (mesmos valores medidos acima), tirando busca e changelog da
barra e mantendo o tema:

| estado | largura | 360px |
|---|---:|---|
| deslogado: logo + tema + Entrar + hambúrguer | **318px** | cabe |
| logado: logo + tema + sino + avatar + hambúrguer | **306px** | cabe |

**ESTRUTURA DECIDIDA PELO MANTENEDOR em 2026-09-15** (só ≤860px; desktop intacto):

> hambúrguer público à ESQUERDA (nav + changelog + tema) · logo · busca · hambúrguer de
> SESSÃO à direita (login quando deslogado; conta + **notificações** quando logado).
> "Isso tem que ser padrão para todos os apps."

O sino fica dentro do hambúrguer de sessão por ser notificação de quem está logado.

**Aritmética: 290px** (4 slots × 40/90px + 3 gaps + padding) — cabe em **320px** com 30px
de folga. É a melhor das opções medidas.

**⚠️ Três apps injetam conteúdo próprio na direita via `actions` e precisam mudar junto**,
senão o conteúdo fica solto na barra e a conta estoura de novo — mas **não é sino nos
três**, ao contrário do que esta linha dizia antes (medido em 2026-09-15):

| app | o que passa em `actions` | é notificação? |
|---|---|---|
| `downloads/AppShell.tsx:87` | `NotificationBell` | sim |
| `mesas/AppShell.tsx:80` | `HeaderActions` → `NotificationBell` com gate próprio (`useAuth`) | sim |
| `glossario/GlossarioHeader.tsx:68` | botão **"Adicionar Sugestão"** (`PlusCircle`) | **não** — ação do app, exige login |

**⚠️ Mapa da busca nos 4 apps — medido em 2026-09-15.** A linha anterior deste bloco dizia
que `downloads` E `mesas` usavam campo embutido; errado, só o `downloads` usa:

| app | modo | destino da lupa |
|---|---|---|
| `mesas` | lupa (`onSearch`) | `navigate('/busca')` |
| `glossario` | lupa (`onSearch`) | `navigate('/busca')` |
| `site` | lupa própria na ilha | modal Pagefind; fallback `window.location.assign('/busca/')` |
| `downloads` | **campo embutido** (`onSearchChange`) | **não navega** — filtra a listagem atual por `?q=`, com debounce; não existe página `/busca` |

O campo embutido é o único que precisa da 2ª linha em ≤860px (`grid-column: 1 / -1;
grid-row: 2`). O `downloads` é caso legítimo, não divergência a corrigir: a busca dele
filtra a página em que o usuário está, não leva a outra.

**Determinação do mantenedor (2026-09-15):** o header do `mesas` é o modelo — logo +
sessão + menu. A lupa no mobile **direciona para a página de busca daquele módulo**. O
`site` precisa ganhar busca explícita na home, que hoje não tem. O botão "Adicionar
Sugestão" do `glossario` **fica exposto**, não entra no hambúrguer de sessão.

**⚠️ CORREÇÃO DE UMA OPÇÃO QUE O AGENTE OFERECEU E PREJUDICA SEO.** Na pergunta sobre a
busca do `downloads`, o mantenedor escolheu "vira lupa + cria página `/busca`". Medido
depois: **essa opção colide com decisão de SEO deliberada** e não deveria ter sido
oferecida sem essa ressalva.

- `CatalogoPage.tsx:49` tem `useCanonicalUrl('/')` com comentário próprio: as query
  strings são recortes da MESMA listagem, e consolidar tudo em `/` é o que preserva o
  sinal de indexação — "apontar cada recorte pra si mesmo diluiria o domínio entre dezenas
  de URLs equivalentes". Uma página `/busca` real seria mais uma URL disputando a mesma
  autoridade, o oposto do que esta spec faz.
- **O `mesas`, que o mantenedor aprovou como modelo, NÃO tem página de busca:**
  `apps/mesas/frontend/src/routes/busca.tsx` tem **3 linhas** e é redirect `replace` para
  `/catalogo` (`routes/redirect.tsx`, spec 102 T4.2 — `replace` e não `redirect` para o
  Voltar não cair em loop, achado do Codex na #319).
- `glossario` é o único com página real (`BuscaPage.tsx`, 96 linhas) — e ali faz sentido:
  a busca dele consulta a API de termos, não filtra uma listagem já existente.

**Forma correta para o `downloads`, alinhada ao modelo aprovado e ao SEO:** rota `/busca`
que **redireciona** (`replace`) para `/catalogo`, preservando `?q=`. Zero URL nova
indexável, canonical de `/` intocado, e o comportamento no celular fica idêntico ao do
`mesas`. **Confirmar com o mantenedor antes de implementar** — a escolha registrada foi
"criar página".

**⚠️ ACHADO PREEXISTENTE, SILENCIOSO: `/busca/` do `site` É INDEXÁVEL.** Medido em
2026-09-15 no que está no ar:

| medição | resultado |
|---|---|
| `<meta name="robots">` na página | **ausente** |
| `X-Robots-Tag` no header HTTP | **ausente** |
| no `sitemap-0.xml` | **presente** (`<loc>https://artificiorpg.com/busca/</loc>`) |
| canonical | auto-referente (`/busca/`) |

É página de resultado de busca interna, anunciada no sitemap e sem bloqueio. A doc do
Google é explícita: páginas de busca interna são de baixa qualidade e devem levar
`noindex` — "if you can't limit the indexable search results pages, noindex or robot all
of the search pages". Uma URL sem conteúdo próprio competindo por autoridade é exatamente
a classe de problema que esta spec existe para corrigir.

**Correção, com o mecanismo que já existe no repo:** `Base.astro` já aceita `noindex`
(prop → `buildMeta` → `packages/content/src/meta.ts:23`, que emite
`robots: noindex,nofollow`); `404.astro`, `[slug].astro` e `blog/[slug].astro` já usam.
Basta `noindex` em `pages/busca/index.astro`. Para tirá-la do sitemap,
`@astrojs/sitemap` aceita `filter(page)` (`dist/index.d.ts:9`), hoje não usado em
`astro.config.mjs`.

**Não é do escopo da F7** (header), mas é da spec 102 e está em produção. Task própria a
criar.

**⚠️ CAUSA DA DIVERGÊNCIA VISUAL ENTRE APPS — medida em 2026-09-15.** O mantenedor
observou que "os estilos estão dispersos" e perguntou por que o pacote compartilhado não
evita isso. O pacote existe e **nenhum app sobrescreve classe de header** (medido: `rg -c
"artificio-header|artificio-nav|artificio-subnav|artificio-session"` → **0** em
`mesas/index.css`, `glossario/index.css`, `downloads/index.css`). A divergência entra por
outro caminho: **o header lê 20 tokens de DUAS famílias**.

| família | quantos | quem define |
|---|---:|---|
| `--artificio-*` (`ink`, `surface`, `line`, `brand`, `navy`, `canvas`, `focus`, `muted`, `border`, `brand-deep`, `font-sans`) | 12 | só `packages/ui`; **0 sobrescritas** nos apps |
| **sem prefixo** — `--fg`, `--fg-muted`, `--line`, `--surface-subtle` | 4 | **cada app, no próprio `:root`** |
| estruturais (`--radius-*`, `--weight-*`) | 4 | pacote |

`mesas/index.css:21` define `--fg: #FFFFFF` + superfícies escuras próprias; `glossario`
define `--fg` a partir de outra origem; `site` tem os seus. O header compartilhado herda a
cor de cada app **sem ninguém ter tocado numa classe dele**.

**O guard não alcança:** `check-token-parity.mjs` compara `tokens.ts` × `styles.css` ×
`tailwind-preset.js` DENTRO do pacote; nunca olha `apps/*`. Um app pode definir `--fg`
divergente e nada acusa.

**Não é falta de fallback — é CASCATA.** O pacote JÁ define os quatro em `:root`
(`styles.css:142-152`, com `--fg: var(--artificio-light-ink)`). Os apps importam
`@artificio/ui/styles.css` ANTES do próprio `index.css` (`glossario/main.tsx:6-7`,
`downloads/main.tsx:7-11`, `mesas/root.tsx:11`), e redefinem os mesmos nomes em `:root`
puro — mesma especificidade, quem vem depois vence.

**⚠️ MAS ISSO NÃO É A CAUSA DA DIVERGÊNCIA DO HEADER — medido em 2026-09-15, na
conferência independente da F7.** A afirmação acima ("o header inteiro fica branco naquele
app") estava **errada**. Medição por extração das declarações de cada classe:

- As classes estruturais (`.artificio-header`, `-main`, `-nav-link`, `-subnav`,
  `-session`, `-header-tools`, `-header-action`, `-menu-toggle`, `-mobile-nav`,
  `-usermenu*`) usam **só `--artificio-*`** — e **nenhum app redefine esses** (`rg
  "--artificio-[a-z-]*:" apps` → 0).
- Os 4 tokens sem prefixo aparecem em **4 lugares, todos na busca embutida**
  (`.artificio-header-search`, `-search-input`, `-input::placeholder`).

**A causa real é `data-variant`**, e está detalhada em **T7.4 (F7)**: 25 regras de CSS
dependem dele, cada app o calcula de um jeito, e o `site` não o passa — aplica por JS
depois de hidratar. Não reabrir a hipótese dos tokens sem antes remedir.

**Subnav de módulo sem diferenciação.** Só o `mesas` passa `moduleNav`; o `site` monta a
própria subnav na ilha; `glossario` e `downloads` não usam. O CSS é um só
(`styles.css:597` — `border-top` + fonte 13px), sem distinguir visualmente o que é
navegação COMPARTILHADA do que é opção DAQUELE módulo. O mantenedor pediu diferenciação
maior; é mudança no pacote, atinge os consumidores de `moduleNav`.

**NÃO IMPLEMENTADO NA #322 — decisão de escopo do agente, a confirmar.** A #322 corrige o
defeito de acessibilidade e a estrutura do grid, ambos medidos e testados. A estrutura
acima é redesenho do header mobile: `packages/ui/src/Header.tsx` (menu do avatar vira
hambúrguer de sessão), `SiteHeaderIsland.tsx` (código próprio, mesma mudança),
`styles.css` (4 slots), os 3 apps consumidores, mais guards. 6 arquivos em 4 pacotes, com
smoke visual que só navegador resolve.

**Questão aberta que muda a implementação, não medida:** os dois hambúrgueres abrem o
MESMO painel (um, com duas seções) ou dois painéis independentes? Dois painéis exigem
exclusão mútua entre si — que é exatamente o bug já reportado pelo mantenedor neste header
("quando clica no direita ou esquerda, o outro tem que fechar").

Breakpoint: o estouro não ocorre em 860px, só abaixo de ~400. Precedente de breakpoint
menor no repo: `packages/comments/src/styles.css:314` (`max-width: 480px`).

**DESCARTADO: `aria-label` no botão do avatar** (sugestão do CodeRabbit na #322). A
sugestão parte de o nome estar escondido, o que valia no commit revisado (`0b65434`, com
`display: none`) mas não depois da correção. Medido na regra atual: não tem `display:
none` nem `visibility: hidden`, então o `<span>` permanece na árvore de acessibilidade e
já nomeia o botão. Um `aria-label` sobrescreveria o conteúdo com o mesmo valor —
redundante. Não reabrir sem antes medir a regra vigente.

**RESOLVIDO em 2026-09-15 pela Container API do Astro — nenhuma dependência nova, lock
intocado, `--frozen-lockfile` exit 0.** O bloco abaixo registra por que o caminho anterior
foi abandonado; ele não descreve mais o estado do código.

A primeira versão do guard usava `renderToStaticMarkup` do React e exigia
`@types/react-dom` no `apps/site` (`tsc` → TS7016). Isso levou ao impasse do lockfile
descrito adiante. O caminho certo era outro, e só apareceu **porque o agente foi buscar**
(§Pesquisar antes de inventar): a Container API (`astro/container` +
`loadRenderers` de `astro:container`) renderiza o `.astro` REAL, com `<astro-island>` e as
tags que o Astro injeta. É estritamente melhor que o React isolado — o defeito vivia
justamente na fronteira `.astro`/`.tsx`, que o guard anterior não enxergava.

**`pnpm install --lockfile-only` produziu +26/−23, e o lock foi restaurado.** Só **3
linhas** eram o link novo; as outras 46 rearranjavam `supports-color` em `@babel/core`,
`eslint-plugin-react-hooks` e `http-proxy-middleware` — `@babel/core@7.29.7(supports-color@5.5.0)`
virava `@babel/core@7.29.7`. É exatamente a poda que `deploy-flow.md` §2 proíbe, e
`@babel/core` removido do lock foi o que quebrou o `apps/site` no CI em 2026-09-03.
Baseline medido: sem esta dep, o mesmo comando deixa o lock **intacto** — o rearranjo é
consequência dela, não ruído preexistente.

Estado final: lock idêntico a `origin/dev` (hash `7478ba57` nos dois), `package.json` com
a linha, `tsc` do site **exit 0 e zero TS7016**, `@types/react-dom@19.2.3` resolvendo a
partir do site porque já está no store por outros workspaces.

**⚠️ MEDIDO, E O ESTADO ATUAL NÃO PASSA NO CI.** `ci.yml:70` e `:229` rodam
`pnpm install --frozen-lockfile`. Controle isolando a variável: **com** a dep declarada →
**exit 1**; **sem** ela → **exit 0**. As 3 últimas runs de CI em `dev` deram `success`,
então o gate funciona e é a declaração nova que ele rejeita. Declarar a dep sem regenerar
o lock **não é viável**, ao contrário do que a primeira versão deste bloco supôs.

**As saídas medidas, nenhuma boa:**

| caminho | resultado |
|---|---|
| declarar a dep, lock intocado | CI falha (`--frozen-lockfile` exit 1) |
| `pnpm install --lockfile-only` | +26/−23 com poda de `@babel/core`, contra `deploy-flow` §2 |
| `--lockfile-only --filter @artificio/site` | mesmo +26/−23 — **39 linhas** de babel/supports-color contra **1** de react-dom; o filtro não isola |
| `declare module "react-dom/server"` | `tsc` exit 0, mas vira `any` — mascaramento que §Bug achado proíbe |

**⚠️ Enquanto a dep estiver declarada sem o lock regenerado, TODO comando `pnpm` suja o
lock sozinho** — `test`, `lint`, `exec`, `smoke:*`. Cada um dispara install implícito e
reintroduz os +26/−23; medido três vezes em 2026-09-15. Consequência prática: `git status`
mostra `pnpm-lock.yaml` modificado sem ninguém ter editado, e um `git add -A` o levaria
junto para o commit em silêncio. Restaurar com `rtk git checkout HEAD -- pnpm-lock.yaml`
e conferir por CONTEÚDO (`git diff --exit-code`), não por `git status` — o status mostra
`M` por stat cache mesmo com o conteúdo idêntico.

O rearranjo é **determinístico** (26/23 em duas rodadas) e **não é preexistente**: sem a
dep, `--lockfile-only` deixa o lock intacto. Ele é consequência de acrescentar
`@types/react-dom` ao `site` — o pnpm recalcula peers e move `supports-color` de
`@babel/core`/`eslint-plugin-react-hooks` para `http-proxy-middleware`.

**Nenhuma dessas saídas foi tomada — a Container API dispensou a dep inteira.** O impasse
existia só porque o guard fora escrito com a ferramenta errada. Estado final medido em
2026-09-15: `pnpm-lock.yaml` idêntico ao HEAD, `apps/site/package.json` idêntico ao HEAD,
`pnpm install --frozen-lockfile` **exit 0** (o mesmo comando dava exit 1 com a dep
declarada), site **190/190**, `tsc` exit 0, `eslint` exit 0, gate de typecheck-coverage ✓.

**Arquivos novos:** `apps/site/vitest.config.ts` (`getViteConfig`, que torna
`astro:container` resolvível), `apps/site/src/ambient.d.ts` (`declare module "*.astro"` —
`astro/client` declara `*.png`/`*.gif` mas não `.astro`) e o guard
`SiteHeader.estrutura.test.tsx`, com 6 asserções por posição no HTML.

**Duas armadilhas medidas ao montar, ambas documentadas no próprio guard:** o ambiente
`jsdom` do vitest quebra a Container API com `Invariant violation: new
TextEncoder().encode("") instanceof Uint8Array` (vitest#5685/#4043), então o teste roda em
`node`; e `getViteConfig` não tipa a chave `test`, o que reprova o exemplo oficial do
Astro em `tsc --noEmit` (withastro/astro#12791, fechada como "not planned") — resolvido
com cast tipado, não `any`.

**Guard novo: `apps/site/src/components/SiteHeaderIsland.estrutura.test.tsx` (6 testes).**
Afirma a árvore que o CSS exige: `<header>` como raiz da ilha, exatamente 4 filhos
diretos na ordem certa, ferramentas como filha direta, subnav irmã do grid, os 11 links
no HTML servido e a marca com assets por prop. **Nenhum teste pegava o defeito antes** —
`tsc`, `eslint` e as 184 unidades passavam verdes com o header quebrado, porque o defeito
vivia na FRONTEIRA entre o `.astro` e o `.tsx`, cada lado correto isoladamente.

**Validação medida (2026-09-14):**

| alvo | resultado |
|---|---|
| `site` — `tsc --noEmit` | exit 0 |
| `site` — `eslint` | exit 0 |
| `site` — suíte | **190/190** (184 + 6 do guard) |
| `site` — `astro build` | 47 páginas, exit 0 |
| dist: filhos diretos do grid | **4** (brand, nav, tools, session) — via jsdom |
| dist: subnav é irmã do grid | **sim** |
| dist: `<header>` dentro do island | **sim** (island por fora, como no `links`) |
| dist: `artificio-nav-link` | **11** + 1 toggle, em `/` e `/blog/` (aceite 13) |
| `packages/ui` — `tsc`/`eslint`/suíte | exit 0 · exit 0 · **102/102** |
| `mesas` | **1152/1152** e 1175/1176 (1 skip preexistente) |
| `downloads-frontend` | **315/315** |
| `glossario-frontend` | **37/37** |
| `accounts` | **602/602** (52 skips preexistentes) |
| `tsc` dos consumidores | exit 0 em `downloads-frontend`, `glossario-frontend`, `site-admin`, `links`, `accounts` |

`site-admin` não tem suíte (`"test": "echo (site-admin) test TODO"`).

**Não medido, e não afirmo:** o layout renderizado em navegador real a ≤860px. O guard
prova a ÁRVORE que o CSS exige, não o pixel. O aceite 16 pede navegador, e nos outros 5
apps segue pendente — nenhum deles tem deploy nesta spec.

**Agravante medido — `client:idle`.** `curl` na raiz de beta: `grep -c changelog` no HTML
→ **0**, enquanto o bundle do island traz `Novidades` ×3 e `artificio_theme`. Changelog,
busca e tema só existem **depois da hidratação**. Em mobile isso soma ao defeito de grid:
antes de hidratar não há o que posicionar, e depois já não há coluna.

**Terceiro defeito — nome do usuário.** `.artificio-user-name` tem `max-width:160px` +
`ellipsis`, em `inline-flex` com `gap:10px` ao lado do avatar, e **nenhuma regra o
esconde em ≤860px**. Disputa espaço com o hambúrguer e com `.artificio-session`
(`min-width:96px`). O padrão em mobile é só o avatar.

**Quarto achado do mantenedor — "não consigo acessar nada da minha conta no beta" — NÃO
é regressão de T3.5, e o `accounts` está correto.** Medido: CORS de
`accounts.artificiorpg.com` devolve `access-control-allow-origin:
https://beta.artificiorpg.com` com `allow-credentials: true`; `isAllowedReturnUrl`
(`apps/accounts/src/app.ts:170`) aceita qualquer subdomínio https de `artificiorpg.com`;
`/api/auth/refresh` sem cookie → **401**, que é o correto para anônimo; `accounts-api` up
há 2 semanas (healthy). **Bug latente que falha em silêncio:** o island importa
`useSession` de `ContentEditor.BNTIvaGk.js` (283 KB), e esse chunk **não está entre os 6
`<script>` do HTML** — carrega só por import dinâmico após `client:idle`. Até lá a faixa
de sessão não sabe se há usuário. Não medi com cookie de sessão real (exige navegador
autenticado, §Autorização), então **não afirmo** que é a causa única do relato.

**`/api/auth/me` no `site` devolve 404 — e isso é correto, não defeito.** A sessão vem do
`accounts`, não do site; a rota nunca existiu ali. Registrado porque a medição parece
falha e não é — não reinvestigar.

**E nenhum deploy desta spec entrega o aceite 16 — medido no manifesto em 2026-09-14.**
`deploy_paths` de cada módulo lista apenas `apps/*` (`site` → `apps/site` +
`apps/site-admin`; `mesas` → `apps/mesas`; etc.). **`packages/*` não aparece em módulo
algum.** Como T3.5e/g vivem em `packages/ui`, o merge desta PR não dispara deploy de
nada, e o header novo chega a cada app só quando aquele app for deployado por outro
motivo — o build do app é que resolve o pacote. Consequência para o planejamento: o
deploy do `site` (T3.3) leva o header a `artificiorpg.com` e mais nada; `downloads`,
`glossario`, `links`, `site-admin` e `accounts` continuam servindo o header antigo até
terem deploy próprio, que esta spec não prevê. O smoke do aceite 16 em 5 dos 6 apps não
tem, hoje, deploy que o torne medível em produção. Mapa completo dos deploys, do que
cada um fecha e do que destrava: `mapa-deploys.md` nesta mesma pasta.

**Achado do mantenedor, FORA do previsto por esta spec: os dois painéis do header
abriam juntos.** Pergunta dele em 2026-09-14 (*"quando clica no direita ou esquerda, o
outro tem que fechar, só um pode exibir"*). Medido: menu do avatar (`open`) e painel
mobile (`navOpen`) eram estados independentes, nos DOIS headers — `Header.tsx:128-129` e
`SiteHeaderIsland.tsx:65-66`. O clique-fora do avatar (`Header.tsx:134`) o fechava ao
tocar no hambúrguer, porque o toggle está fora do `menuRef`; **o sentido inverso não
tinha nada** — o painel mobile só escutava `Escape`, então abrir o avatar com ele aberto
deixava os dois. Sobrepostos: o dropdown é `position:absolute; z-index:50`
(`styles.css:842-856`) e o painel mobile é irmão em fluxo normal, na mesma extremidade.

**Não é regressão de T3.5** — os estados sempre foram independentes; o defeito é
anterior. T3.5e apenas aproximou o toggle da faixa de sessão, tornando o encontro mais
provável. Corrigido nos dois componentes com setters que fecham o outro painel ao abrir
(`toggleUserMenu`/`toggleNav`), porque o comportamento é do contrato compartilhado e não
de um app — corrigir só o `site` deixaria 6 apps com a sobreposição.

#### Cobertura de teste que faltava (pergunta do mantenedor, 2026-09-14)

Auditados os arquivos tocados por T3.5: **`Header.tsx` tinha suíte que não cobria a
mudança, e `content.ts` não tinha nenhuma.** Três arquivos novos:

- **`apps/site/src/lib/content.test.ts`** — a guarda que faltava para T3.5c. O aceite 6
  não roda local (8 posts → 1 fatia), então sem teste unitário a paginação só seria
  exercitada em produção. Cobre: 126 posts → 6 fatias, divisão exata sem fatia vazia,
  sobra na última, vazio além da última (o que sustenta o 404 de `/blog/7/`), nenhum post
  repetido entre fatias, acervo inteiro sem buraco, e o guard de slug numérico. Sem
  jsdom, seguindo o precedente registrado em `PostConversation.test.ts` (o `site` não tem
  a dependência, e adicioná-la é decisão do mantenedor).
- **`packages/ui/src/Header.acesso.test.tsx`** — aceites 14/15. O `Header.test.tsx`
  existente cobre só busca embutida vs. lupa legada e **passava verde com os três itens
  públicos dentro de `.artificio-session`**, que é o defeito que T3.5e corrigiu. Agora
  trava: ferramentas fora da faixa, "Entrar"/`menu-toggle`/`actions` dentro dela, e a
  coluna que não se cria quando o app não liga ferramenta nenhuma.
- **`packages/ui/src/Header.paineis.test.tsx`** — exclusão mútua, com jsdom por arquivo
  (padrão do pacote). Cobre os dois sentidos, alternância repetida e o segundo clique
  fechando o próprio painel.

**Erro na primeira versão da suíte de acesso, corrigido:** a asserção
`not.toContain('aria-label="Buscar"')` foi copiada do `Header.test.tsx`, onde o
`searchLabel` era customizado. Com o default, esse rótulo pertence ao **input embutido** —
o teste reprovava um render correto. Passou a asserir a ausência do *botão* de lupa.

**O que continua sem teste, e por quê:** `SiteHeaderIsland.tsx` (o `site` não tem jsdom;
a lógica equivalente está coberta no `packages/ui`) e `AppShell.tsx` do `mesas` (o
`downloads` tem precedente, mas o aceite 17 é grep e o `mesas` não tem suíte de shell —
criar uma é decisão do mantenedor, não pendência inferida).

**BLOQUEIO: `Header.paineis.test.tsx` passa, mas NÃO foi provado que reprova o código
antigo.** A verificação padrão desta branch — sabotar o fonte, rodar, confirmar o
vermelho, reverter (precedente: commit `8573ed5`, *"tres guards passavam verde em
sabotagem, todos reproduzidos"*) — foi barrada pelo classificador do harness como
escrita destrutiva local. Sem ela, a suíte cobre o comportamento correto mas não está
demonstrado que pega o defeito: um teste que acompanha o bug em vez de travá-lo passaria
igual. **Não tratar a cobertura de T3.5 como completa até rodar a sabotagem** —
restaurar `onClick={() => setOpen((value) => !value)}` e
`onClick={() => setNavOpen((value) => !value)}` em `packages/ui/src/Header.tsx` deve
derrubar os 4 testes de exclusão mútua (os 2 de "abre sozinho" seguiriam verdes).

**Entregue em 2026-09-14:** commit `93b325f`, branch `feat/102-t35-indexacao-raiz-header`,
PR #321 contra `dev`, 16 arquivos (+1083/−99). `verify:api` exit 0, zero breaking nos 6
apps. Nenhuma subfase declarada concluída exceto T3.5f — o resto aguarda deploy.

#### Achados de review na PR #321, todos corrigidos (2026-09-14)

**CodeRabbit 1 — o teste de `content.ts` provava a CÓPIA, não o código.** A primeira
versão de `content.test.ts` reimplementava `fatiasDe`/`recorte` no próprio arquivo:
passaria verde mesmo com o recorte de produção errado, que é o oposto do que a suíte
existe para fazer. As três funções passaram a aceitar a lista por parâmetro (default =
acervo real) e o teste chama `totalFatias`/`postsDaFatia`/`slugsNumericos` de verdade,
com fixture de 126 posts. **Não é ponto de extensão da API** — é o que permite exercitar
com 126 posts o que o snapshot de 8 nunca alcança.

**CodeRabbit 2 — o guard de slug numérico trocava um silêncio por outro.** O `continue`
pulava a fatia colidente: os posts dela ficavam inalcançáveis pelo paginador, sem aviso
— mesma classe de dano que o guard existe para impedir. Agora `getStaticPaths` **quebra
o build** nomeando o slug conflitante. Provado com fixture: com um post de slug `"2"`
entre 126, lança; sem colisão, gera as 5 fatias normalmente.

**CodeRabbit 3 — a coluna de ferramentas nascia VAZIA com busca embutida.** A condição
do wrapper checava `showSearch` solto, mas `hasEmbeddedSearch` desliga a lupa: com busca
embutida e nenhuma outra ferramenta (caso do `mesas`), saía
`<div class="artificio-header-tools"></div>` — a coluna sobrando no grid que o próprio
comentário dizia evitar. Pior: **meu `Header.acesso.test.tsx` assertava esse HTML vazio
como esperado**, congelando o bug. Condição passou a espelhar o que cada filho renderiza;
o teste foi corrigido e ganhou 3 casos (busca embutida sozinha, com changelog, e
`showChangelog` sem handler).

**Sonar — handler de evento em `<div>` não-interativo, nos DOIS headers.** O painel
mobile fechava por `onClick` no container (S1082/S6847: sem equivalente por teclado). **O
padrão veio de `packages/ui/src/Header.tsx:401`** — eu o copiei para a ilha do `site`;
corrigir só o app deixaria 6 apps com o defeito.

**A primeira correção NÃO resolveu, e o Sonar reincidiu.** Troquei `onClick` por
`onClickCapture` + `onKeyUp` no mesmo `<div>`, achando que o problema era a falta do
caminho por teclado. Errado: **a regra é sobre existir handler no elemento
não-interativo, não sobre qual handler** — reapareceu em `Header.tsx:411` e
`SiteHeaderIsland.tsx:317`.

**A correção que vale: o `<div>` não escuta nada.** Quem fecha o painel é o próprio
link, por `onNavigate` — prop nova e opcional do `Nav` (`packages/ui/src/Nav.tsx`), e
terceiro parâmetro do `renderNavList` na ilha. O `<a>` é interativo de nascença (teclado,
toque e mouse), enquanto `role`+`tabIndex` num `<div>` inventaria um controle que não
existe. Também aplicado `Readonly<Props>` na ilha e no `Nav` (convenção que o repo ainda
não usa em `Header`; não varri o resto).

**T3.5f — tirar `Painel` da esquerda do `mesas` (`apps/mesas`). ENTRA NESTA SPEC** —
escopo ampliado pelo mantenedor em 2026-09-14 (*"T3.5F É NESSE ESCOPO"*). Remover do
`moduleNav` (`AppShell.tsx:22`); ele já está no `userMenu` (`AppShell.tsx:16`).
`/painel` é rota autenticada (`routes.ts:30`, `PainelMestrePage.tsx:254` redireciona
sem sessão), logo pertence só à direita.
*Aceite:* item 17.

**Estado: concluída e verificada localmente (2026-09-14).** É a ÚNICA subfase de T3.5
cujo aceite fecha sem deploy — o item 17 é grep no fonte, não `curl` em produção.
Medido: `rtk rg "Painel" apps/mesas/frontend/src/components/AppShell.tsx` → **1**
ocorrência (linha 16, no `userMenu`), contra 2 antes. Validação do app: `tsc --noEmit`
exit 0, `eslint` exit 0 (1 warning preexistente em `useBannerScrim.ts:251`, arquivo não
tocado), suíte completa **86 arquivos / 1152 testes, todos passando**.

**⚠️ Comentário que cita o rótulo REPROVA o aceite 17 — mesma classe de erro do aceite
7.** O item conta ocorrências de `Painel` por grep no arquivo inteiro, então explicar a
decisão citando o rótulo (ou o nome do componente `PainelMestrePage`) infla a contagem:
medido 3, depois 2, antes de a redação parar de nomeá-los. O comentário no arquivo
registra a restrição para a próxima edição. Vale a regra geral: **em arquivo cujo aceite
é grep textual, o comentário não pode conter o termo medido.**

**Não foi criado teste code-level.** O `downloads` tem precedente para esta mesma classe
de mudança (`AppShell.test.tsx`, spec 086 T10.4, prova que o item saiu do `moduleNav`) e
o `mesas` não tem `AppShell.test.tsx` — 51 arquivos de teste, nenhum do shell. O aceite
17 pede só o grep; criar a suíte do shell do `mesas` é trabalho além do pedido, e fica
como decisão do mantenedor, não como pendência inferida.

**T3.5g — regra de acesso no `site` (`apps/site`). SEM ELA A REGRA NÃO ALCANÇA O
PRÓPRIO APP DESTA SPEC.**

> **⚠️ T3.5d e T3.5g mexem NOS MESMOS DOIS ARQUIVOS** — `SiteHeader.astro` e
> `SiteHeaderIsland.tsx`. T3.5d move o nav para dentro da ilha (para o toggle ter
> estado); T3.5g redistribui os itens entre esquerda e direita. Feitas em separado, a
> segunda reescreve o que a primeira acabou de montar. **Implementar as duas no mesmo
> trabalho, T3.5d primeiro** (define onde o nav vive), T3.5g em seguida (define o que
> vai em cada lado). Os aceites continuam separados: item 13 para uma, 18–19 para a
> outra. T3.5e cobre `packages/ui/src/Header.tsx`, e o `site` **não
usa** esse componente: ele tem `SiteHeaderIsland.tsx` próprio, com os mesmos itens
públicos na direita (medido, linhas 62-94 e 146-152):

| item no `SiteHeaderIsland` | exige login? | destino |
|---|---|---|
| Changelog (linha 62) | não | **esquerda** |
| Busca (linha 80) | não | **esquerda** |
| Tema (`ThemeToggle`, linha 94) | não | **esquerda** |
| Botão "Entrar" (linhas 146-152) | não | **direita** — porta de entrada da sessão (ver item 15) |
| `NotificationBell` (linha 93) | **sim** (`NotificationBell.tsx:266`) | direita |
| Avatar + dropdown (Admin / Perfil / Sair), linhas 98-144 | **sim** | direita |

Mesma regra, código diferente. Fazer T3.5e sem T3.5g corrige 5 apps e deixa de fora
exatamente aquele que esta spec existe para corrigir.
*Aceite:* itens 18–19.

**Os itens 4 e 5 do Aceite não pertencem a subfase nenhuma — são travas contra
regressão.** O 4 (`/blog/` sem `robots`) e o 5 (nada removido do sitemap) verificam que
ninguém reintroduziu o `noindex` nem mexeu no sitemap, ideias que esta task descartou
por medição. Valem para **toda** subfase: a que os quebrar está errada, mesmo cumprindo
o próprio aceite.

**Fontes de navegação mobile:**
[NN/g — Hamburger Menus and Hidden Navigation Hurt UX Metrics](https://www.nngroup.com/articles/hamburger-menus/) ·
[NN/g — Beyond the Hamburger: What Makes Navigation Discoverable on Mobile](https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/) ·
[NN/g — The Hamburger-Menu Icon Today: Is it Recognizable?](https://www.nngroup.com/articles/hamburger-menu-icon-recognizability/) ·
[WCAG 2.1.1 Keyboard Accessibility (2026)](https://www.uxpin.com/studio/blog/wcag-211-keyboard-accessibility-explained/) ·
[Mobile Navigation UX Best Practices 2026](https://www.designstudiouiux.com/blog/mobile-navigation-ux/)

Posts seguem em `/blog/<slug>/`, categorias e tags intactas (D047/D019). **Sem 301, sem
fusão.**

**O botão e a paginação NÃO se substituem.** O botão resolve *chegar* ao acervo (item 5
da correção); o paginador resolve *navegar* dentro dele. Implementar um sem o outro
deixa metade do problema de pé.

**Dois itens DESCARTADOS em 2026-09-14 — eram proposta do agente, não defeito.** O
mantenedor cobrou o valor de cada item ("qual os valores que agregam ao usuário, ao
indexador e pagerank"), e estes não se sustentaram. Registrado para não voltarem como
"plano aprovado":

- **Schema `CollectionPage`/`ItemList` em `/blog/`.** Invisível ao usuário; não gera
  rich result para lista de posts; **não medido** que mude ranking. Custo > ganho.
- **Trocar o `h1` de `/blog/`.** Já existe `h1` ("Todos os artigos") e já é claro.
  Trocar palavra não move indexação e é texto de tela, decisão do mantenedor.

**Melhoria editorial, também não bloqueante:** um parágrafo de abertura em `/blog/`
reforçaria o que as pílulas já entregam. Não é pré-requisito para indexar — o contexto
próprio já existe na forma de navegação (126 + 12 links, 12 pílulas com contagem). É
trabalho do mantenedor, não do agente.

**PAGINAR `/blog/` — é isto, e não era decisão em aberto.** Determinação do mantenedor,
2026-09-14: *"COMO OS BLOGS RESOLVEM MUITOS LINKS? COM A PORRA DO BOTÃO PARA VER AS
MAIS ANTIGAS E MAIS RECENTES, NO RECORTE DE UM TEMPO. É UM BLOG, UMA DAS COISAS MAIS
ANTIGAS DA INTERNET, E VOCE TÁ INVENTANDO MODA"*.

**O agente tratou paginação de blog como problema aberto de arquitetura. Não é.** É a
solução padrão desde que blog existe: recorte por tempo, mais recentes primeiro, com
navegação entre as fatias. O "risco de profundidade de clique" que a versão anterior
deste bloco levantava **também já tem resposta padrão** — paginador **numerado**
(`1 2 3 4 5 6`, com primeira/última), não só "próxima". Com números no paginador,
nenhuma **fatia** fica a mais de 2 cliques da home; o risco de 4+ cliques só existe em
paginação sequencial pura, que ninguém usa em blog.

**Ressalva honesta sobre profundidade (achado de revisão, 2026-09-14):** a frase acima
vale para as *fatias*, não para todo *post*. Um post na fatia 6 passa de 2 para 3
cliques da home (home → `/blog/` → `/blog/6/` → post). É o custo aceito da paginação, e
a literatura citada o aceita — mas não se deve afirmar paridade total com o estado
atual.

Medido em produção (2026-09-14):

| | medido |
|---|---|
| `/blog/` | 126 links de post + 12 de categoria num HTML de **184.714 B** (valor canônico desta spec), 130 `<img>` (126 com `loading="lazy"`) |
| post individual | linka só **3** relacionados |
| home | linka 10 posts + 4 taxonomias |
| profundidade de todo post | **2 cliques** da home (home → `/blog/` → post) |

O que a paginação resolve, nos três destinatários:

- **Usuário:** 126 cards em rolagem única, sem recorte, não é navegação — é despejo. O
  `lazy` poupa banda de imagem, mas o HTML de 184 KB chega inteiro. Fatias de 24
  com paginador numerado e as pílulas de categoria no topo é o "bonito e organizado"
  que o mantenedor pediu.
- **PageRank:** cada link divide a autoridade da página. Hoje `/blog/` reparte entre
  138 destinos; fatiado, cada página concentra em ~24. **Não existe limite numérico** —
  a doc do Google é literal: *"There's no magical ideal number of links a given page
  should contain. However, if you think it's too much, then it probably is"*
  ([Links crawlability](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)).
  A diluição de autoridade entre links é teoria SEO convencional, não afirmação do
  Google — vale como razão de desenho, não como dado.

  *(Correção 2026-09-14: a versão anterior atribuía a John Mueller, entre aspas, a frase
  "milhares são aceitáveis se a estrutura ajuda o usuário". A substância é atribuível a
  ele em office-hours, mas a redação exata não foi localizada em fonte primária —
  citação literal sem fonte. Substituída pela doc oficial acima, que diz o mesmo e é
  verificável.)*
- **Indexador:** **não piora**, com paginador numerado. Cada fatia fica a 2 cliques da
  home, igual a hoje, e passa a ter URL própria indexável — o Google descobre o acervo
  por 6 páginas rasas em vez de uma só enorme.

**Regras da doc do Google para a implementação** (já citadas acima, repetidas aqui
porque é onde serão aplicadas): URL única por fatia; **canonical auto-referente em cada
uma** — canonicalizar as fatias para a primeira é o Erro nº 1; links entre fatias com
`<a href>` real, nunca fragmento `#`; e paginador **numerado**, não só "próxima", que é
o que mantém a profundidade baixa.

O tamanho da fatia (12, 24) e o formato da URL são escolha do mantenedor.

**Fonte desatualizada, a descartar:** textos que apresentam `rel="next"`/`rel="prev"`
como recomendação oficial — inclusive o artigo do Search Engine Journal. **Google
abandonou esses atributos como sinal de indexação em março de 2019**; hoje o caminho é
descoberto pelo link interno. Qualquer texto que os recomende é pré-2019.

**Não é cópia do WordPress.** Determinação do mantenedor: *"não é uma copia do
wordpress. se fosse para ser wordpress, eu usaria"*. `/blog/` como listagem só existe
porque no WP o blog era seção dentro de um site institucional. Aqui o blog é o site, e
as institucionais (`/sobre-nos/`, `/contato/`…) convivem como exceção — medido: as 4
testadas já têm canonical auto-referente correto.

**Dois defeitos próprios medidos junto, ambos falham em silêncio:**

- **A raiz não tem `h1` nenhum** (`grep -c '<h1'` → **0**). Confirmado na fonte, não só
  no HTML: `index.astro` tem um `h2` ("Mais recentes", linha 20) e o hero é `Card big`,
  que emite `h3` (`Card.astro:32`) — não existe caminho em que o hero vire `h1`. A
  página mais importante do domínio não declara do que trata. Pesa no ranking
  tradicional e, plausivelmente, na citação por IA.

  **⚠️ Removido por falta de fonte (2026-09-14): "a hierarquia de heading é o sinal
  primário dos motores generativos".** Pesquisado: os números que circulam ("2,8× mais
  citações", "+63%") rastreiam até posts de agência que citam uns aos outros, sem
  estudo, dataset, amostra ou metodologia publicados — a página que seria a origem
  responde 404. **Não citar como fato.** A correção do `h1` continua justificada pelo
  motivo sólido e verificável: a raiz não declara do que trata, o que é defeito de
  hierarquia de documento independentemente de qualquer efeito sobre IA.
- **`/blog/` não emite JSON-LD nenhum**, enquanto a raiz emite `WebSite` +
  `Organization`.

**As 81 taxonomias, que a versão anterior desta task ignorava.** Medido em produção:
12 categorias + 69 tags no sitemap, **todas com canonical auto-referente correto e sem
`robots`** — ou seja, indexáveis. Elas têm o mesmo perfil de `/blog/`: lista de posts
sem texto próprio. **Esta task NÃO as altera**, e a decisão é deliberada: são 81 URLs
com recorte temático (`/blog/categoria/dnd/` responde a uma intenção de busca real que
a home não responde), enquanto `/blog/` é "todos os artigos", que é exatamente o que a
raiz já é. Se o Search Console mostrar as taxonomias como "Duplicada sem canônica
selecionada pelo usuário", aí vira trabalho próprio — não se antecipa sem o dado.

**Atenção do próximo agente — números de produção ≠ local.** A tabela acima é de
produção (126 posts). O `posts.json` versionado tem **8** (medido). Build local da raiz
e de `/blog/` renderiza 8 e 8, e a diferença "10 vs 126" **não reproduz** sem export
contra o banco. Valide canonical, `og:url`, `h1` e `robots` — que independem da
contagem —, nunca o número de cards.

**Achado menor, junto:** `apps/site/src/pages/404.astro:4` emite
`canonical="https://artificiorpg.com/404"` — sem barra final, contra
`trailingSlash: "always"`. Página de erro não deveria declarar canonical.

**Aceite.**

1. `curl -s https://artificiorpg.com/ | grep -o '<link rel="canonical"[^>]*>'` →
   `https://artificiorpg.com/` (hoje: `…/blog/`).
2. Mesmo para `og:url`.
3. `curl -s https://artificiorpg.com/ | grep -c '<h1'` → **1** (hoje: 0), e a ordem dos
   headings é `h1 → h2 → h3` (não basta a contagem: `h1` seguido de `h3` sem `h2`
   quebra a hierarquia que o item existe para garantir). Verificar também que `title` e
   `description` da raiz são os definidos em T3.5a e **diferentes** dos de `/blog/`.
4. `curl -s https://artificiorpg.com/blog/ | grep -c '<meta name="robots"'` → **0**.
   `/blog/` continua indexável — se aparecer `robots` ali, alguém reintroduziu o
   `noindex` que esta task descartou por medição.
5. **Nada é REMOVIDO do sitemap:** `/`, `/blog/` e as 81 taxonomias (12 categoria + 69
   tag) continuam presentes, e `lastmod` em ≥126 URLs — prova de que T3.4 seguiu de pé.
   **As 5 URLs novas de paginação ENTRAM** — `/blog/2/` a `/blog/6/`; `/blog/` já está
   lá. Elas são indexáveis e têm canonical auto-referente, então excluí-las contradiria
   o próprio item 6. Nenhuma mudança de código é necessária — `astro.config.mjs:33` usa
   `sitemap()` sem `filter`, e o `@astrojs/sitemap` inclui toda rota SSG por padrão.
6. `/blog/` paginada em fatias de **24 posts** → **6 páginas** para os 126 atuais:
   - `curl -s https://artificiorpg.com/blog/2/` responde **200** e emite
     `<link rel="canonical" href="https://artificiorpg.com/blog/2/">` — a própria URL,
     nunca a de `/blog/` (canonicalizar para a fatia 1 é o Erro nº 1 do Google).
   - `/blog/1/` **não existe** (404): a fatia 1 é `/blog/`.
   - **Cada fatia tem `title`, `description` e `h1` próprios**, com o número da página —
     nunca iguais aos de `/blog/`:
     `curl -s https://artificiorpg.com/blog/2/ | grep -o '<title>[^<]*</title>'` →
     contém `Página 2 de 6`, e o mesmo para o `h1`. Fatias com title idêntico
     reintroduzem no acervo a duplicata que esta task corrige na raiz.
   - `curl -s https://artificiorpg.com/blog/ | grep -o 'href="/blog/[0-9]\+/"' | sort -u`
     → as 5 fatias seguintes, com `<a href>` real (paginador **numerado**, não só
     "próxima"), o que mantém toda fatia a ≤2 cliques da home. **`[0-9]\+`, não
     `[0-9]*`:** o asterisco casa zero dígitos e `href="/blog/"` entraria no resultado,
     reprovando o aceite sem defeito real.
   - `/blog/7/` → **404** (não gerar fatia vazia além da última). Garantido: SSG sem
     `output`, o `getStaticPaths` manual não emite o arquivo, e o servidor de produção
     não faz fallback — URL inexistente sob `/blog/` já devolve 404 hoje (medido ao
     vivo).
7. `curl -s https://artificiorpg.com/ | grep -o 'href="/blog/"' | wc -l` → **2**
   (hoje: 1), e o segundo aparece DEPOIS do fechamento da grade de cards — não adianta
   ter dois no topo. **`grep -o … | wc -l`, não `grep -c`:** `-c` conta *linhas* com
   ocorrência, e o Astro não garante uma tag por linha no HTML servido — dois links na
   mesma linha devolveriam 1.
8. Os dois botões com rótulo exato **"Todos os Posts"**, classe
   `.artificio-button .artificio-button-secondary .artificio-button-md` (não
   `.cat-pill`, não classe nova), o do topo alinhado ao `h2` (`.section-head` em
   `center`), e `.see-all` removida do `global.css`.
9. Foco visível ao navegar por teclado nos dois (herdado de
   `.artificio-button:focus-visible`, `styles.css:1418`).
10. **RETIRADO — premissa refutada por medição (2026-09-14).** Este item exigia definir
    `--surface-subtle`/`--line-strong` no `global.css` porque "sem isso o hover é
    descartado em silêncio". Falso: os dois tokens chegam ao site pelo
    `@import "@artificio/ui/styles.css"` do `global.css:8` e estão presentes no bundle
    servido, nos dois temas (medido em `dist/_astro/Base.DBUI5Cpc.css`). O hover
    funciona sem trabalho nenhum. Não reintroduzir este item; se alguém quiser a
    blindagem no `global.css`, é melhoria opcional, não aceite.
11. Hover verificado no navegador em light **e** dark — fundo e borda mudam nos dois.
    Screenshot não serve: não captura hover.
12. Em 360px de largura: `.section-head` não estoura (título e botão empilham ou
    quebram com `gap`), e o botão do fim ocupa largura total ou fica centralizado.
13. `curl -s https://artificiorpg.com/ | grep -c 'menu-toggle'` → ≥1 (hoje: **0**), e
    em ≤860px os 7 links de projeto + 4 de categoria continuam alcançáveis. Hoje os 11
    somem sem substituto.

    **E os 11 links continuam no HTML SERVIDO:**
    `curl -s https://artificiorpg.com/ | grep -c 'artificio-nav-link'` → **11**. Esta
    linha não é redundante — é o que protege o SEO. Hoje os links são HTML estático do
    `SiteHeader.astro` (linhas 18-21 e 35-38), **fora** da ilha; T3.5d os move para
    dentro dela. Uma implementação com `client:only`, ou que condicione o render à
    hidratação, sumiria com os 11 links para o crawler **e ainda passaria no aceite do
    parágrafo anterior**, porque o toggle estaria lá. Sem esta verificação, o item 13
    aprova a própria regressão que a task existe para evitar.

    **`client:idle` vs `client:load` — decidido por precedente, não por medição nova.**
    A dúvida registrada em T3.5d pode ser fechada: `NotificationBell` e `ThemeToggle` já
    hidratam com `client:idle` na ilha atual (`SiteHeader.astro:30`) e funcionam. Manter
    `idle`. Se ainda assim for medir, o critério de aceite é objetivo: o toggle responde
    ao primeiro toque em 3G throttled — não "parece rápido".

**Aceite de T3.5e** (regra de acesso no `packages/ui` — escopo autorizado):

14. Busca, changelog e tema renderizam **fora** de `.artificio-session`, em todos os
    apps que os ligam. Hoje os três estão dentro (`Header.tsx:285-323`). **O botão
    "Entrar" NÃO se move** — ver item 15.
15. `.artificio-session` contém avatar + `userMenu` + `NotificationBell` — os três
    exigem sessão (medido: `Header.tsx:181`, `NotificationBell.tsx:266`) — **e mais
    três itens que permanecem na direita, cada um por um motivo diferente:**

    | item hoje em `.artificio-session` | destino | por quê |
    |---|---|---|
    | busca, changelog, `ThemeToggle` | **esquerda** | ferramentas públicas: é a regra desta task |
    | **botão "Entrar"** | **FICA na direita** | é público, mas é a **porta de entrada da sessão**: fica onde o avatar aparecerá depois de logar. Mandá-lo para a esquerda deixa o usuário sem o lugar convencional de procurar login |
    | `actions` (prop) | **fica na direita** | conteúdo do app consumidor, não da regra — `mesas` injeta `NotificationBell` por ela (`AppShell.tsx:73`, `Header.tsx:320-322`), que exige sessão |
    | `artificio-menu-toggle` | **fica na direita** | controle do painel mobile; o lugar convencional é a extremidade da barra |

    **A regra desta task não é "tudo que é público vai para a esquerda"** — é *"o que é
    ferramenta pública vai para a esquerda; o que pertence à sessão, incluindo o acesso
    a ela, fica na direita"*. Correção do mantenedor, 2026-09-14: *"na direita tem que
    ter ao menos o login. login é publico, senão não tem como o cara entrar"*. A versão
    anterior mandava "Entrar" para a esquerda por aplicar a regra ao pé da letra, e
    quebrava o acesso à conta.

    *(A versão anterior também dizia "apenas avatar + userMenu + NotificationBell" e
    ignorava o toggle e a prop `actions`, ambos medidos em `Header.tsx:320-336`. Como
    escrito, o aceite reprovaria uma implementação correta.)*
16. Smoke visual em `mesas`, `downloads`, `glossario`, `links` **e `site-admin`**:
    header não quebra em desktop nem em ≤860px. Os quatro primeiros são os consumidores
    do `Header.tsx` que ligam ferramentas (3 cada). **`site-admin` entrou na lista em
    2026-09-14:** `apps/site-admin/src/App.tsx:20` monta `<Header sticky={false} />` e
    estava fora do smoke — não liga ferramentas, então o risco é baixo, mas é consumidor
    do componente alterado. `accounts` liga só tema; conferir que não regride.

**Aceite de T3.5f** (`apps/mesas` — escopo autorizado, entra nesta spec):

17. `rtk rg "Painel" apps/mesas/frontend/src/components/AppShell.tsx` → **1**
    ocorrência (hoje: 2). Sai do `moduleNav`, permanece no `userMenu`.

**Aceite de T3.5g** (regra de acesso no `site` — o app desta spec):

18. `curl -s https://artificiorpg.com/` → changelog, busca e tema renderizam **fora**
    de `.artificio-session`. Hoje os três estão dentro
    (`SiteHeaderIsland.tsx:62-94`). **"Entrar" NÃO se move** — item 19.
19. `.artificio-session` do `site` contém `NotificationBell` + avatar com seu dropdown
    (Admin / Perfil Artifício / Sair) — todos exigem sessão — **mais o botão "Entrar"
    (`SiteHeaderIsland.tsx:146-152`) e o `menu-toggle`**, pelas mesmas razões do item 15:
    "Entrar" é a porta de entrada da sessão e ocupa o lugar onde o avatar aparece depois
    do login; o toggle é o controle do painel mobile.

**Depende de.** Mesmo ciclo de export + build + deploy de T3.3 — não adianta corrigir o
código sem o rebuild, porque produção serve o `dist`.

**Nenhuma decisão pendente.** As duas que estavam aqui (`noindex` sim/não; separar
`noindex` de `nofollow` em `packages/content`) foram **respondidas e fechadas** em
2026-09-14 pela medição do item 3: `/blog/` é o catálogo, continua indexada, e nada
disso é mais necessário. Não reabrir sem dado novo do Search Console.

**Fontes — primárias do Google, não convenção de CMS.** O agente primeiro afirmou de
memória, depois pesquisou "o que WordPress/Yoast/Ghost fazem", e só então mediu na
fonte:
[Pagination and incremental page loading](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading) ·
[5 common mistakes with rel=canonical](https://developers.google.com/search/blog/2013/04/5-common-mistakes-with-relcanonical) ·
[Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) ·
[rel=prev/next abandonado em 2019](https://yoast.com/google-doesnt-use-rel-prev-next-for-pagination/)

---

## F4 — `mesas`: HTML-first e schema estruturado

Frente nova (Achado E, `spec.md` §2.5). Entrou por comparação medida com o MesaQuest.

### [x] T4.1 — Arquitetura de renderização do `mesas` — DECIDIDA E FECHADA: SSR universal

**Decisão do mantenedor (2026-09-11): caminho 2, SSR universal.** Motivo dado por
ele: *"o catálogo precisa ser sempre fresco"*. Isso elimina SSG/prerender, que
serviria HTML do momento do build — vaga preenchida apareceria como aberta até o
rebuild seguinte.

**Critério de decisão do mantenedor, literal (2026-09-11):** *"NÃO EXISTE CUSTO,
TEM QUE SER ROBUSTO E ESCALONÁVEL."* Custo de implementação — número de arquivos
tocados, esforço de migração, pacote novo — **não é critério** nesta spec e não se
apresenta como argumento. O que decide é robustez e escalabilidade da solução.

**NÃO REABRIR.** Esta task está fechada. O agente que chegar aqui implementa SSR
universal; não propõe alternativa, não pede escolha entre caminhos, não traz
comparação de custo. Três propostas já foram rejeitadas pelo mantenedor, todas pelo
mesmo motivo (partiam de custo de implementação, não de robustez):

| Proposta rejeitada | Por que não |
|---|---|
| SSG/prerender | serve HTML do build — viola "sempre fresco" |
| SSR só das rotas públicas | **não existe**: React Router v7 não tem toggle `ssr` por rota (medido na doc oficial `reactrouter.com/how-to/pre-rendering`: a flag é app-level) |
| Estender `og.ts` com HTML em string | duplica os 3.024 LOC de `features/table` em string no backend; não é escalonável |

**Medições que sustentam o fechamento (2026-09-11, `apps/mesas/frontend`):** 378
arquivos em `src`; 37 importam `react-router-dom`; 58 usam `window`/`localStorage`/
`document`; `features/table` soma 3.024 LOC sem teste. Esses números descrevem a
obra — **não** são argumento contra ela.

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

### [~] T4.2 — HTML-first nas rotas públicas de mesa e mestre — CÓDIGO COMPLETO E VALIDADO; entra pela PR 3 (ver §Entrega), falta deploy

**Estado em 2026-09-12 (reescrever este bloco, não anexar abaixo):**

| item | estado |
|---|---|
| 1. `Dockerfile` do frontend | **escrito**, asserção de runtime 7/7 |
| 2. `server.js` + 2 composes + `nginx.conf` removido | **aplicado e medido** — ver §Contrato do `server.js` |
| 3. Código morto (`App.tsx`, `main.tsx`, `index.html`) | **removido e validado** — `tsc -b` limpo, `BackendStatusScreen.test.tsx` 2/2, suíte 84/1139 |
| Ingress `:80` → `:3000` — **beta** | **FEITO em 2026-09-13.** Tunnel `Artificio` v26 → **v27**; `mesasbeta` → `mesas-beta-app:3000`. Prod conferido intacto na resposta da API |
| Ingress `:80` → `:3000` — **prod** | **pendente de autorização nominal** — item 6 da §Ações |

**O código desta task está fechado.** O único item aberto é a porta do ingress de
PROD, que é escrita em tunnel de produção e roda no momento do deploy (§Autorização),
não antes.

**ARMADILHA DE SEQUÊNCIA — o primeiro deploy do `mesas` FALHA O SMOKE POR
CONSTRUÇÃO, e vai falhar igual em prod.** Medido em beta, run `34778898181`
(2026-09-13):

```
healthy_mesas-beta-api=true
healthy_mesas-beta-app=true
ERRO: smoke home esperava 200 recebeu 502   → exit 1
```

**Não é container quebrado.** Os três containers ficaram `Up (healthy)` na VM, e
dentro do `mesas-beta-app` o SSR já respondia: `localhost:3000` devolvia o HTML
completo, `localhost:80` devolvia `Connection refused`. O tunnel ainda entregava em
`:80`, onde o container novo não escuta — `USER node` não abre porta <1024
(`docker-compose.beta.yml:16` registra isso no próprio arquivo).

A esteira roda o smoke contra o **hostname público**, então ela mede o tunnel, não o
container. E a ordem não pode ser invertida — trocar o ingress antes do container
novo subir só alonga o `502`. Logo: **a run vermelha é o estado esperado do primeiro
deploy; o ingress é o passo seguinte, não a correção de um defeito.**

Consequência para prod: depois do dispatch, a run vai acusar `ERRO: smoke home`. Não
diagnosticar container, não fazer rollback — aplicar o item 6 da §Ações e remedir.
Custo em beta: `502` por ~4 minutos entre o fim do deploy e a troca do ingress.

**Aceites de T4.2/T4.3/T4.5 medidos em beta depois da troca (v27):**

| aceite | medido |
|---|---|
| smokes do manifesto | home **200**, `private_no_cookie` **401**, `auth_redirect` **302** com o `location` exato |
| HTML da home | 3.328 → **193.502** bytes (58×) |
| URL de mesa | **200**, com `ld+json`, `canonical` e `og:title` no fonte |
| JSON-LD | `Product` + **`offers`** + `price "10.00"` + `InStock` — a propriedade qualificadora que o `3d6ff5c` corrigiu, agora provada em runtime |
| `description` | **152** chars, abaixo do limite de 160 do `3d6ff5c` |
| **bot ↔ navegador** | JSON-LD, `title`, `canonical` e `description` **idênticos** — a divergência que originou a spec acabou |

O `canonical` em beta aponta para `mesas.artificiorpg.com` (prod), correto: beta não
disputa indexação.

**Não medido:** o HTML difere em 1.094 bytes entre Googlebot e navegador (44.956 vs
46.050) com todos os metadados idênticos. Não é dynamic rendering; a origem do delta
não foi investigada.

**MERGEADA em 2026-09-13** — PR #319 (branch `feat/102-f4-mesas-ssr`, 7 commits de
`b7a03ed` a `32da301`), merge `a7ea7e1`. `origin/dev` já serve este código.
`pnpm-lock.yaml` e `Dockerfile` entraram no `b7a03ed`, com o `deploy-contract-gate`
cobrando `deploy-flow.md` §1.

**Entrega.** Conteúdo e schema no HTML inicial, **iguais para todo user-agent**.
Elimina por construção a divergência bot↔usuário que produziu B, C e E.

**Mecanismo — decidido em 2026-09-11 por pesquisa, não deixado em aberto.** T4.1
decidiu *SSR universal*; faltava **como**. Medido no repo
(`apps/mesas/frontend/package.json`): `react-router-dom` `^7.18.0`, `react` `^19.2.7`,
`vite` `^8.0.16`, nenhum adapter SSR, `"dev": "vite"`.

**DECIDIDO — React Router v7 em framework mode**, e não Next.js/Remix/Astro. Não é
recomendação em aberto; é o mecanismo desta task. Razões:

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
Tratar como obra. **Autorização já concedida pelo mantenedor em 2026-09-11** ("autorizado",
mais *"code o que der para codar, pois vou deployar, depois vou desbloquear tudo em 1
deploy só"*). Não pedir de novo a autorização da obra; as ações perigosas de sempre
(commit, push, deploy, escrita na VM) seguem exigindo palavra por ação, como em
qualquer task.

**`ssr: true` vale para o app inteiro — medido na doc oficial.** Não existe
`export const ssr = false` por rota no React Router v7; a flag é app-level e a
granularidade vem de `prerender` (build-time, incompatível com "sempre fresco") e
`clientLoader`. Consequência prática para o implementador: **as rotas autenticadas
entram no SSR junto**, e os 58 arquivos com código só-de-browser precisam sair do
render para `clientLoader`/`clientAction` ou ficar atrás de guarda de ambiente. Isso
é parte da obra, não desvio dela.

**Comando do deploy BETA — medido em 2026-09-13, não estava registrado em lugar
nenhum desta spec** (só havia o de prod, em T3.3):

```bash
gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta
```

Três medições que o sustentam, todas no `deploy.yml`:

- **O beta sai de `dev`, sem promote.** `deploy.yml:209` — env vazio faz o
  `_deploy-module` derivar do ref (`dev`→beta, senão prod); o `env=beta` explícito é
  override (D044). Validar em beta **não exige tocar em `main`**, o que importa
  porque o rollback do SSR é o mais caro dos cinco (§Ações item 5).
- **O bloqueio de `env=beta` alcança `accounts` E `links`** (`deploy.yml:184`) — o
  `mesas` não é afetado. O `deploy-flow.md` §Casos por módulo cita só o `accounts`;
  o workflow barra os dois. Divergência doc↔código: o código prevalece.
- **`mesasbeta.artificiorpg.com` responde `200`** (medido antes do dispatch). O
  hostname existe no tunnel, então falha de smoke em beta será código, não DNS.

**Ordem de deploy (decidida pelo mantenedor em 2026-09-11).** F1, F3 e F4 sobem num
**único deploy**. O código se escreve todo antes; nada nesta frente espera deploy de
outra. Medição de produção **não serve de linha de base** para esta task enquanto o
deploy único não acontecer: produção roda o código pré-F1/F3, então `curl` contra
`mesas.artificiorpg.com` mede o estado antigo. Medido em 2026-09-11: 47 das 88 URLs
de mesa do sitemap devolvem "Mesa não encontrada" ao Googlebot, e 0 devolvem
"encerrada" — é o Achado B original com T1.2/T1.3/T1.4 ainda não deployadas, **não**
regressão nova. A linha de base desta task é o código do repositório.

**Escopo das rotas.** Duas famílias públicas, não uma: `/mesas/<slug>` **e** o perfil
de mestre. T4.3 define schema só para mesa; **o perfil de mestre não recebe schema
nesta spec** — entra em HTML-first (conteúdo visível para crawler), que é o que
resolve B/C/E. Schema de `Person`/`ProfilePage` para mestre fica fora de escopo,
declarado aqui para não virar improviso do implementador.

**Nota de dado (de T4.1), corrigida por medição em 2026-09-12.** A falta do join com
`table_contacts` é **só do `og.ts`**, que o SSR substitui. O endpoint que o `loader`
consome já devolve os contatos (`backend/src/routes/tables.ts:728-733` e `:764`) —
não há trabalho de backend aqui. Ver item 6 do estado de execução.

**`tableViewMapper` é puro e se reusa — não reimplementar (medido 2026-09-11).**
`apps/mesas/frontend/src/features/table/mappers/tableViewMapper.ts` (359 LOC) não
importa React nem toca `window`/`document`/`localStorage` (`rtk rg` → 0 ocorrências);
só depende de `@artificio/media/image-kinds` e de utilitários locais. Ele deriva
preço, vagas, selos, urgência e CTA a partir do dado cru. Por §"Compartilhado por
padrão", sobe para pacote compartilhado e serve SSR e cliente **pela mesma função** —
é o que garante que o JSON-LD de T4.3 e o HTML visível não possam divergir, que é a
regra pétrea daquela task. Reimplementar essa derivação no backend é o defeito, não
a solução.

Mesma medição nos componentes de conteúdo: `TableContent`, `TableSchedules`,
`TableTechnical` e `MasterCard` não têm estado nem handler (0 ocorrências de
`useState|useEffect|useRef|onClick|window\.|localStorage`); só `TableHero` tem (2).
A árvore de render das rotas públicas é quase toda apresentação pura — renderiza no
servidor sem adaptação.

**Estado da execução (2026-09-11): pacote compartilhado ENTREGUE e verde;
nenhum código de SSR escrito ainda.**

**1. `packages/catalog-table` criado — a fundação de T4.3.** Autorizado nominalmente
pelo mantenedor em 2026-09-11. Reúne o que SSR e cliente precisam derivar **pela
mesma função**, que é o que torna impossível o JSON-LD divergir do HTML visível:

| Módulo do pacote | Origem no app | O que entrega |
|---|---|---|
| `tableViewMapper.ts` | `features/table/mappers/` | preço, vagas, urgência, CTA, selos |
| `contactUrls.ts` | `utils/safeExternalUrl.ts` | WhatsApp/Discord/e-mail para `Offer` |
| `ageRating.ts` | `utils/ageRating.ts` | faixa etária |
| `types.ts` | `types/tables.ts` | contrato de domínio (`TableDetail`, `TableContact`) |
| `viewModel.types.ts` | `features/table/types/` | `TableViewModel` |

`openSafeExternalUrl` **não** subiu: usa `window.open`. `TablesResponse` também não:
é paginação de API, não domínio de mesa. A divisão é explícita para ninguém importar
o pacote no servidor e descobrir a quebra em runtime.

Os 5 módulos antigos do app viraram **re-export** do pacote em vez de serem
reescritos nos 84 arquivos que os importam — fonte única sem churn. Testes migraram
junto (`tableViewMapper`, `tableViewCover`, `ageRating`).

**Validação medida:** pacote `tsc --noEmit` limpo, **26/26** testes, build ESM+CJS
gerando `dist` sem teste dentro. App `mesas/frontend`: `tsc -b` limpo, **83 arquivos
/ 1122 testes** passando. Os 12 avisos `Could not parse CSS stylesheet` são os já
documentados em `App.tsx`, não regressão.

**2. Dependências de SSR instaladas** (linha `7.18.3`, fixada de propósito:
`pnpm add` sem versão resolveu `@react-router/dev@8.3.1`, major à frente do
`react-router-dom@^7.18.0` do app):
`@react-router/dev` (dev), `@react-router/node`, `@react-router/express`,
`react-router`, `isbot` (resolveu `5.2.2`).

**Armadilha do lockfile — conferir `@babel/core` antes de qualquer commit deste
lock.** O primeiro `pnpm add` produziu +200/−49 com `@babel/core@7.29.7`
**removido**, o mesmo defeito de 2026-09-03 que quebrou o teste do `apps/site` no CI
(`deploy-flow.md` §2). Restaurado com `git checkout origin/dev -- pnpm-lock.yaml` e
refeito com `pnpm install --lockfile-only`. Estado atual do lock: **+412/−42**, com
`@babel/core@7.29.7` presente em **51** referências e a entrada base existindo nas
duas seções. As remoções são a variante `(supports-color@5.5.0)` colapsando na
entrada base — dedup de peer, não poda (busca negativa: nenhuma remoção fora de
`@babel`/`supports-color`).

**3. Framework mode LIGADO e servindo — SSR roda, mas ainda sem dados.**
Escrito e verde nesta sessão:

| Arquivo | Papel |
|---|---|
| `react-router.config.ts` | `{ ssr: true, appDirectory: 'src' }` |
| `src/routes.ts` | as 23 rotas do antigo `<Routes>` |
| `src/root.tsx` | documento HTML + providers (era o `App.tsx`) |
| `src/entry.server.tsx` | render no servidor, `isbot` decide o despacho |
| `src/entry.client.tsx` | hidratação + o que só existe no browser |
| `src/routes/*.tsx` | 18 módulos de rota |
| `server.js` | Express com `createRequestHandler` |

`ssr: true` e `appDirectory` confirmados no **tipo instalado**
(`@react-router/dev/dist/config.d.ts:154` e `:77`), não na documentação — é o que
permitiu manter o código em `src/` em vez de mover tudo para `app/`.

O `isbot` no `entry.server.tsx` **não é dynamic rendering**: o conteúdo é idêntico
nos dois caminhos, muda só o momento do despacho (`onAllReady` para bot, que não
executa JS e abandonaria stream incompleto; `onShellReady` para navegador).

**Medição do que o crawler recebe (servidor local, 2026-09-11):**

| User-agent | Antes | Agora |
|---|---|---|
| ClaudeBot / GPTBot / Googlebot / navegador | 3.328 B de casca (só ClaudeBot medido) | **33.005 B, idênticos entre si** |

Texto visível no HTML: **1.126 caracteres** (era 0). `Conectando ao backend` →
**0 ocorrências**. HTTP 200. Bytes iguais para todos os user-agents é o fim do
dynamic rendering medido, não sua ampliação — critério 3 do aceite.

**4. Health-check saiu do caminho do render.** `App.tsx` devolvia
`<BackendStatusScreen status="loading" />` enquanto `backendHealthy === null`; como
`useEffect` não roda no servidor, **todo request renderizaria a tela de espera** e
era isso que o crawler receberia. Agora a aplicação renderiza sempre e o aviso de
indisponibilidade só cobre a página quando o `/health` de fato falhou — o humano
continua vendo "Atualização sendo executada" durante deploy.

**5. Duplicata de instância do router — corrigida com override.** O app passou a
depender de `react-router@7.18.3` direto; `@artificio/analytics` arrastava
`react-router@7.18.0` por dentro de `react-router-dom@^7.18.0`. As duas cópias no
bundle do servidor derrubavam **toda** rota com
`useLocation() may be used only in the context of a <Router> component` (500 medido
em `/`). Override `"react-router@<7.18.3": ">=7.18.3 <8"` em `pnpm-workspace.yaml`,
mesmo mecanismo já usado para `prosemirror-model`/`prosemirror-view` e pelo mesmo
motivo. Depois: HTTP 200.

**Validação:** build SSR gera `build/client` + `build/server/index.js`; suíte do app
**83 arquivos / 1122 testes** passando.

**6. `loader` + `meta` escritos nas três rotas públicas — itens 1 e 2 da ordem
anterior estão FEITOS.** `tsc -b` limpo. O que cada um resolve:

| Rota | `loader` | Decisão que o código carrega |
|---|---|---|
| `routes/mesa.tsx` | `GET /api/v1/tables/:slug` | `410` é **resposta de sucesso** desta rota (a tela de encerramento é conteúdo legítimo); `404`/`5xx` são `throw` para o status chegar ao crawler |
| `routes/mestre.tsx` | `GET /api/v1/gm/perfis/:slug` | **sem credencial de propósito** — mandar o cookie do visitante para a API abriria a porta para o HTML de um usuário ser servido a outro por cache |
| `routes/catalogo.tsx` | `fetchCatalogTables` | falha de API **não** derruba a página: é a URL mais indexável e a origem de todos os links `/mesas/` |

**Correção de rota medida (o `plan.md` e este bloco diziam o contrário).** A "Nota de
dado" acima afirma que o SSR precisa incluir o join de `table_contacts`. Medido em
`apps/mesas/backend/src/routes/tables.ts:728-733` e `:764`: o endpoint `GET /:slug`
**já** consulta `table_contacts` e devolve `contacts: serializeContacts(contacts)`.
A lacuna existe só no `og.ts`, que o SSR substitui. **Nenhuma mudança de backend é
necessária em T4.2.**

`lib/apiFetch.server.ts` é o que torna o fetch no servidor possível: no browser a URL
fica relativa e o nginx faz proxy; no servidor não existe origin, e `fetch('/api/...')`
lança `Failed to parse URL`. Resolve para `http://mesas-api:3000` reusando
`API_UPSTREAM` — **a mesma variável do `nginx.conf:49`**, para que renomear o serviço
não separe frontend e nginx.

`features/table/seo/tableMeta.ts` entrega T4.3 e T4.5 junto: `description` com a cauda
de facetas dentro do orçamento de 160 caracteres, e `@graph` com `Product`+`Offer` —
`price: "0"` quando gratuita, nunca ausência (ausência lê como preço desconhecido).
Preço deriva de `price_value`/`price_type`, **nunca** do rótulo do contato (medido:
"Ticket / Inscrição" aparece em 106 contatos, mas 101 dessas mesas são `gratuita`).

**7. Regressão do agente, achada por medição e corrigida.** `grep` por
`BackendStatusScreen|backendHealthy` em `root.tsx`/`entry.client.tsx` devolveu **0**:
o overlay de health-check foi perdido quando `root.tsx` substituiu `App.tsx` no item 3
desta mesma sessão. Sem ele, uma promoção beta→prod não mostraria aviso nenhum ao
visitante. Extraído para `components/BackendStatusScreen.tsx` e religado como overlay
não-bloqueante.

**8. Split `react-router-dom` / `react-router` em 33 arquivos — a mesma classe de bug
do item 5, em outro lugar.** `useUrlState.ts:51` quebrava com
`useLocation() may be used only in the context of a <Router>` porque a página importava
de `react-router` e o hook de `react-router-dom`: duas instâncias, contexto não
atravessa. Migrados os 33 arquivos; `rtk rg` → 0 restantes; `tsc -b` limpo.

**9. Medição de custo do SSR com dado REAL (2026-09-12) — a lacuna que o
mantenedor apontou, agora fechada do lado do catálogo.** Sem backend local, subi
um stub servindo os payloads de produção (`/api/v1/tables` com 24 mesas / 76 KB e
`/api/v1/tables/<slug>` com 93 campos), para o render exercitar o mesmo trabalho
que fará no ar.

| Rota | Antes dos `loader` | Com `loader` + dado real |
|---|---|---|
| `/catalogo` | 35.889 B, 0 links `/mesas/` | **258.951 B, 24 links `/mesas/`** |
| Tempo | 2,28 s | **0,42 s** |
| `<title>` | ausente | presente |
| `Carregando` | presente | **0** |
| `"@type":"Event"` | — | **0** |

**Os 2,28 s anteriores NÃO eram CPU de render — eram timeout** do `loader`
tentando `http://mesas-api:3000` sem backend no ar (estáveis em 5 repetições, o
que denuncia espera de rede, não trabalho). O custo real do catálogo inteiro no
primeiro request, sem cache, é **0,42 s**.

**Rajada de 880 renders (10 × as 88 URLs do sitemap), que é o número que decide a
folga da VM.** Todas as 880 responderam `200`.

| Métrica | Medido |
|---|---|
| Throughput | **~28 req/s** (constante da 1ª à 10ª rodada) |
| ms/render | média **33**, p50 34, p95 50, máx 58 |
| RSS em regime | **368 MB** (estabilizado) |

A memória **não vaza**: 122 MB → 173 → 276 → **caiu para 167** na 4ª rodada (GC do
V8) → subiu e parou em 368 MB nas rodadas 9 e 10, com throughput inalterado. A
curva crescente das 3 primeiras rodadas é heap antes do primeiro GC maior, não
retenção — medir só 3 rodadas teria produzido a conclusão errada de vazamento.

**Contra a VM (24 GB / 4 OCPU): 368 MB sobre ~21 GB livres = 1,7% da folga.** Para
comparação medida na mesma VM, `site-prod-app` (Astro Node SSR, análogo já em
produção) ocupa 238,9 MB. Uma varredura completa do Googlebot nas 88 URLs custa
**~3 s de uma OCPU**. CPU e RAM não são o risco.

**10. `renderMarkdown` quebrava o SSR — `/mesas/<slug>` respondia `500`.**
`packages/content-editor/src/ContentEditor.tsx:42` chamava `DOMPurify.sanitize`;
o DOMPurify sanitiza pelo DOM real e, sem `window`, o import devolve fábrica não
ligada (`TypeError: DOMPurify.sanitize is not a function`). Atingia a rota central
da spec.

Corrigido **sem lib nova**: a `sanitize-html@2.17.7` já era dependência do pacote,
roda nos dois lados e já tinha política medida contra 10 vetores
(`LEGACY_COMMENT_HTML_OPTIONS`). O mantenedor havia autorizado `jsdom` como
runtime dependency; a medição mostrou que **não é preciso** — `jsdom` foi
descartado e nada novo entrou no `package.json`. Nova
`sanitizeRenderedMarkdown` em `sanitize.ts`, com allowlist própria para o
`<input type="checkbox" disabled>` das task lists (qualquer outro `<input>` é
descartado). `packages/content-editor`: **120/120 testes passando**.

A `sanitize-html` serializa void element na forma XHTML (`<br />`,
`<input ... />`) onde o DOMPurify emitia `<br>` e `disabled=""`. O parser HTML do
navegador produz a mesma árvore para as duas formas, e é a árvore que precisa
bater na hidratação — as asserções foram atualizadas para a forma real
(`sanitize.test.ts` já esperava `<br />` antes desta spec). **Armadilha medida:**
`selfClosing: []` faz a lib FECHAR void element (`<input></input>`, HTML
inválido) — não repetir.

**`/mesas/<slug>` responde `200`** (37.074 B em 0,43 s) e cumpre os critérios da
T4.3: `<title>` presente, 1 bloco `ld+json` com `@graph` → `Product` + `Offer`
(`price: "0"`, `InStock`, derivado de `price_value`), `"@type":"Event"` = 0,
`Carregando` = 0.

**Pegadinha de build que custou uma volta:** o `mesas` consome o `dist/` compilado
do `content-editor`, não o `src/`. Corrigir o pacote e rebuildar só o app mantém o
`500` — o `dist/` seguia com o `DOMPurify` de 04/09. Ordem obrigatória:
`pnpm build` no pacote, depois no app.

**Todas as 5 rotas medidas no SSR, nenhum erro no log:** `/catalogo` `200`
(258.951 B), `/mesas/<slug>` `200` (37.074 B), `/perfil` `200`, `/busca` `302`,
`/mestre/<inexistente>` `404`. O código do SSR está **completo e verde** — o que
falta é imagem e borda, não aplicação.

**O QUE FALTA PARA T4.2 FECHAR — tudo é infra, o código do SSR está pronto.**

**1. [x] `apps/mesas/frontend/Dockerfile` — nginx-estático → Node. ESCRITO.**
Multi-stage no molde de `apps/mesas/backend/Dockerfile` (mesmo app, mesmo
compose): `builder` roda o `turbo build` e `production` é `FROM node:24-alpine`
com `CMD ["node","server.js"]`, `USER node`, `EXPOSE 3000`.

**Aceite passou:** `node scripts/ci/check_dockerfile_workspace_deps.mjs` →
**7 imagens conferidas** (antes 6), `apps/mesas/frontend (12 pacotes)`, nenhum
faltando. O gate passou a cobrir esta imagem **sozinho**, sem editar o script: ele
pula imagem cujo último `FROM` é `nginx` (linha 212), porque ali o Vite bundlou
tudo no estático. Trocar a base ligou a checagem.

Medição que sustenta o `pnpm install --prod` (é o que evita repetir [[E021]]): **o
bundle do servidor NÃO embute as dependências** — `build/server/index.js` as
importa em runtime (`react`, `react-dom/server`, `react-router`,
`@react-router/express`, `express`, `isbot`, `@tanstack/react-query`,
`lucide-react`, `zod`, `dompurify`, `html2canvas-pro`). Imagem sem `node_modules`
de produção compila verde e crasha com `MODULE_NOT_FOUND` no primeiro request.

12 pacotes no fecho transitivo, 7 deles com dependency externa própria
(`auth`→jsonwebtoken, `catalog-ui`→lucide-react, `comments`/`config`→zod,
`content-editor`→sanitize-html/markdown-it, `image-editor`→react-image-crop,
`media`→cloudinary) — cada um precisa do SEU `--filter`, senão o `.pnpm` é podado.
**`changelog` não aparece em nenhum import do `src`**: entra só por
transitividade, que é exatamente o vetor do E021 — conferir import direto não o
encontraria.

**2. `nginx.conf` + os dois composes — (b) APLICADO e commitado em 2026-09-12.**
`server.js` reescrito (84 linhas), `docker-compose.prod.yml` e
`docker-compose.beta.yml` editados (+8/−9 cada), `nginx.conf` removido via
`git rm` (147 linhas). Validação no fim deste item.

O item estava subespecificado como "remover 3 diretivas". Medido, o
`nginx.conf` faz **seis** coisas, e só uma morre com o SSR:

| o que faz | destino sob (b) |
|---|---|
| `map $is_crawler` + `error_page 418` + `@og_proxy` | **morre** — dynamic rendering |
| `set_real_ip_from` + `CF-Connecting-IP` (IP real) | `app.set('trust proxy')` — **padrão já rodando em 6 apps** |
| `client_max_body_size 12m` (upload de banner) | **config do proxy**, NÃO `express.json` (ver §Contrato do `server.js`) |
| `proxy_pass /api/` → `mesas-api:3000` | **proxy no Node** (ver §Proxy interno) |
| `proxy_pass = /auth/google` + `= /auth/google/callback` | idem |
| `proxy_pass = /auth/discord/connect` + `= /auth/discord/callback` | idem |
| `proxy_pass = /sitemap.xml` → backend | idem |
| `= /robots.txt` (`try_files`, não proxy) | `express.static` já serve — T4.6 |

**São 7 `proxy_pass`, não 3** (medido: `grep -n proxy_pass nginx.conf` → linhas
49, 64, 73, 83, 92, 115, 138). O registro anterior omitia
`/auth/discord/connect` e `/auth/discord/callback` (`nginx.conf:82,91`), do fluxo
OAuth do `discord-sync`: se ficarem de fora, conectar Discord quebra em produção.

**O mesmo vale para o beta.** `docker-compose.beta.yml:32,34,96` tem o `cp`
idêntico e o volume `frontend_dist_beta`. O item 2 são **dois** composes.

**Incidente que qualquer opção precisa preservar:** `client_max_body_size` existe
porque banner >1 MB foi cortado com `413` em produção (2026-08-27), antes de
chegar ao backend — o usuário só via "não carrega". Perder esse limite reintroduz
o bug.

**O que mudou nos dois composes** (idêntico em prod e beta): `expose` 80 → 3000,
healthcheck `127.0.0.1:80` → `:3000`, `command` do nginx removido, volume
`frontend_dist_*` desmontado do `mesas-app`, e `TRUSTED_REAL_IP_FROM` trocado por
`TRUSTED_PROXY_CIDR`.

**A troca da env era um bug latente, achado ao editar.** O `mesas-app` só
declarava `TRUSTED_REAL_IP_FROM` (`prod:27`/`beta:28`), que era do
`set_real_ip_from` do nginx. Quem lê o CIDR agora é
`app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || …)` — nome diferente.
Sem a troca o `trust proxy` cairia no default **silenciosamente**, sem erro de
boot. `TRUSTED_PROXY_CIDR` já existia no compose, mas só no `mesas-api`
(`prod:84`/`beta:83`).

**O volume `frontend_dist_*` continua montado no `mesas-api`** (`prod:105`,
`beta:95`) — só saiu do `mesas-app`, que era quem o populava. Ver DEB-102-1: sem
o `cp`, ele fica vazio, mas `og.ts` lê sob demanda dentro de `loadIndexHtml()`,
não no boot (medido em `og.ts:29`), então o backend sobe normalmente. Desmontar o
volume do `mesas-api` também quebraria o boot se alguém religasse o `og` — por
isso ficou.

Também corrigido: o comentário de `backend/src/server.ts:68` dizia "Atras do
nginx na artificio_net", o que deixou de ser verdade no mesmo commit.

**3. Código morto removido** (`git rm`): `src/App.tsx`, `src/main.tsx`,
`index.html`, `src/App.test.tsx`. Busca por referência restante devolveu **0**.
`index.html` já não participava do build — medido: `build/client/index.html` não
existe, e o `Dockerfile` não o copia.

Antes de apagar, conferido item a item que tudo que `main.tsx`/`index.html`
faziam tem destino: `installDiagnostics`, `applyFavicon`, `initGtag` e o tema por
cookie em `entry.client.tsx:11-26`; os 3 imports de CSS em `root.tsx:11-13`; o
script anti-flash de tema inline em `root.tsx:43-47`. Essa conferência existe
porque o item 7 desta mesma task já perdeu o `BackendStatusScreen` numa migração
sem ela.

`App.test.tsx` **migrou**, não foi apagado: virou
`src/components/BackendStatusScreen.test.tsx`, apontando para o módulo novo. O
componente continua sendo o que o visitante vê durante deploy.

**Bug de SEO achado ao remover o `index.html`, corrigido no mesmo trabalho.** O
`index.html` dava `<title>` e `description` a TODAS as rotas; no framework mode
só herda quem não define o seu, e o `root.tsx` não tinha `meta`. Medido com o
SSR de pé (`PORT=3999 node server.js` + `curl`): `/` devolvia
`<title>Artifício Mesas — Encontre mesas de RPG online</title>`, mas **`/login` e
`/jogador/alguem` devolviam nenhum `<title>`** — aba sem nome, e rota pública
indexável sem título no resultado de busca. São 21 rotas sem `meta` próprio.
Corrigido com `export function meta()` em `root.tsx`, com o título e a descrição
que o `index.html` trazia. As rotas com identidade própria (`catalogo`, `mesa`,
`mestre`) continuam sobrescrevendo.

**Validação deste item RODOU em 2026-09-12:** `rtk tsc -b` limpo,
`BackendStatusScreen.test.tsx` **2/2**, `rtk pnpm build` gerando
`build/server/index.js` (2.094 kB) e `build/client` completo. Medido no SSR local
(`PORT=3994`): `/` responde `200` com `<title>` do `meta` default de `root.tsx`, e
`/mesas/<slug>` responde `200` com o `<title>` da própria mesa — o default pegou
sem regredir quem já tinha o seu.

**Fragilidade medida, não bloqueante:** `apps/mesas/frontend/src/utils/sanitize.ts`
ainda usa `DOMPurify` e quebraria no SSR pelo mesmo motivo do item 10. Hoje **não
é alcançado**: seu único consumidor (`useProfileQuery`) só roda sob
`ProfileProvider`, montado apenas em `/perfil` — rota sem `loader` e com
`enabled: isAuthenticated`, que no servidor é falso. Confirmado por medição:
`/perfil` responde `200`. Vira `500` no dia em que alguém puser `loader` nessa
rota ou `ProfileProvider` no `root.tsx`.

**DECISÃO TOMADA (mantenedor, 2026-09-12): opção (b), só o Node.** Critério que
ele nomeou, textual: "escalonável, que realmente funcione para como o repositório
está e robusto". Aplicado às opções medidas abaixo, (b) ganha nos três.

**O padrão do repositório, medido em 2026-09-12 — é o que decide entre as
opções.** Levantados os 9 `Dockerfile` de app (última linha `FROM` + `CMD`):
**nenhum container roda nginx e Node juntos**; cada imagem tem um processo só.

| padrão | apps |
|---|---|
| Node puro (`CMD ["node", ...]`) | `accounts`, `site`, `links`, `mesas/backend`, `downloads/backend`, `glossario/backend` |
| nginx puro (`CMD ["nginx", ...]`) | `glossario/frontend`, `downloads/frontend` |

nginx aparece **só onde o frontend é estático** — que é o que o `mesas/frontend`
deixa de ser nesta task.

E o IP real atrás do Cloudflare **já é problema resolvido em Express**: 6 apps
rodam a mesma linha, `app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR ||
'172.18.0.0/16')` (`site/server/server.ts:32`, `links/server/server.ts:28`,
`accounts/src/app.ts:215`, `mesas/backend/src/server.ts:70`,
`downloads/backend/src/server.ts:67`, `glossario/backend/src/index.ts:34`).
**Zero usam `http-proxy-middleware`** — e a medição de por que (abaixo) é o que
define o contrato do `server.js`.

O análogo mais próximo do que o `mesas/frontend` vira agora é o `site`
(Astro Node SSR): `site-prod-app` é **Node puro recebendo direto do tunnel**, sem
nginx no compose, fazendo `trust proxy`, `express.json({ limit })`, rate limit e
CSRF no próprio Express.

**(a) Manter o nginx na frente do Node.** Container roda os dois; nginx escuta 80
e faz `proxy_pass` para `127.0.0.1:3000` no lugar do `try_files`. **Seria a nona
variante de topologia do repo e o único container com dois processos** — caso
particular, que o AGENTS.md trata como dívida até prova em contrário.

**(b) — ESCOLHIDA. Só o Node, no padrão dos 6 apps Express.**
Contra os três critérios do mantenedor: *como o repo está* — é o padrão de 6 dos
9 apps, enquanto (a) seria a nona variante; *escalonável* — app novo copia o
`server.js`, não ganha nginx e config próprios; *robusto* — um processo por
container, contra dois pontos de falha em (a), onde o healthcheck do nginx passa
com o Node morto.

### Contrato do `server.js` sob (b) — medido em 2026-09-12

**Por que o `mesas` precisa de proxy e o `site`/`links` não.** Os dois montam a
API no mesmo Express (`site/server/server.ts:239,248`; `links/server/server.ts:71,455`)
porque **não têm `backend/`** — medido por `ls apps/site/`, `ls apps/links/`: um
`server/`, um container, um processo. O `mesas` tem `apps/mesas/backend/` com
container (`mesas-api:3000`), banco e cron próprios. Fundir seria unir dois
deploys, escopo muito maior que T4.2. Logo `/api/` **atravessa container**, e em
Express isso é `http-proxy-middleware`.

**O frontend chama a API por caminho relativo, mesma origem.** `apiClient.ts:4`
→ `API_BASE = import.meta.env.VITE_API_URL || ''`; `:85` → `${API_BASE}${endpoint}`.
`VITE_API_URL` está **vazia em produção**: o bundle servido hoje
(`index-Cnat_Kks.js`, 1,49 MB) não contém nenhuma URL absoluta de `/api/` — as 11
ocorrências de `/api/v1` são relativas. Confirmado end-to-end:
`curl https://mesas.artificiorpg.com/api/v1/health` → **200**, atravessando o
`proxy_pass` do nginx. **O proxy não é resíduo: carrega todo o tráfego de API.**

Descartada a via de URL absoluta (`VITE_API_URL=https://mesas.../api`): quebraria
o cookie de sessão `.artificiorpg.com` em cross-origin e exigiria CORS novo —
mexe em auth, que o AGENTS.md trata como sagrado.

**O que o `server.js` tem — ESCRITO em 2026-09-12** (`frontend/server.js`, 84
linhas):

1. `app.set('trust proxy', process.env.TRUSTED_PROXY_CIDR || '172.18.0.0/16')` —
   linha idêntica à dos 5 outros apps (medido: `links/server/server.ts:28`,
   `site:32`, `downloads/backend/src/server.ts:67`, `glossario:34`,
   `mesas/backend:70`).
2. Um `createProxyMiddleware` para as **6 rotas**, montado na raiz.
3. **NÃO leva `express.json`.** Num app que só faz proxy, parsear o body o
   **consome**, e o upload multipart de banner (12 MB) chegaria vazio ao backend.
   Quem parseia JSON é o `mesas-api`, que já tem o seu
   `express.json({ limit: '12mb' })` — e é lá que o limite de tamanho fica. Sem
   body parser o corpo passa direto, sem bufferizar, então não há teto a
   configurar no proxy.

**O alvo é `${API_UPSTREAM}:3000`, NÃO `mesas-api:3000` fixo.** Correção do que
esta seção registrava: prod define `API_UPSTREAM=mesas-api`, beta define
`mesas-beta-api` (`docker-compose.*.yml:23`). Hardcodar faria **o beta proxiar
para o banco de produção**. O `server.js` lê a mesma env que o `nginx.conf` lia.

**São 6 rotas no `server.js`, não 7.** Os 7 `proxy_pass` do nginx incluíam o
`@og_proxy` (`nginx.conf:138`), que morre com o dynamic rendering. As 6 que
migram: `/api/` (prefixo) e `/auth/google`, `/auth/google/callback`,
`/auth/discord/connect`, `/auth/discord/callback`, `/sitemap.xml` (exatas).

**Três defeitos medidos antes de chegarem a produção — armadilhas para o próximo
agente**, todas encontradas com um backend de eco que devolve `req.originalUrl`:

1. **`app.use('/api', proxy)` corrompe o path.** O Express **remove** o prefixo
   do `req.url` antes do middleware: `/api/v1/health` chegava ao backend como
   `/v1/health`. Seria `404` em toda a API. Por isso o proxy é montado na raiz
   (`app.use(apiProxy)`) com `pathFilter`, e não num prefixo.
2. **`pathFilter` em array não aceita glob misturado com caminho plano.**
   `['/api/**', '/auth/google']` lança `HPM_INVALID_PATH_FILTER_ARRAY_CONFIG`
   (medido em `dist/path-filter.js`) e o resultado observado é **pior que o
   defeito 1**: nada casa, e a API inteira cai no SSR.
3. **Caminho plano casa por prefixo, não por igualdade** (`indexOf(…) === 0`).
   `/auth/google` capturaria `/auth/googlezinho`. O nginx usava `location =`
   (exato) em 5 das 6 rotas; só `/api/` era prefixo.

A forma que sobreviveu às três é `pathFilter` **em função**:
`pathname === '/api' || pathname.startsWith('/api/') || EXACT_ROUTES.has(pathname)`.

**Validação do roteamento: 13/13 casos** contra o backend de eco — 7 proxiados
com o path íntegro (incluindo query string) e 6 corretamente ao SSR, entre eles
`/auth/googlezinho`, `/apitoken` e `/sitemap.xml.bak`, que não vazam para a API.

Demais opções do `createProxyMiddleware`, com o que cada uma substitui:
`changeOrigin: false` (era `proxy_set_header Host $host`), `xfwd: true`
(`X-Forwarded-For`/`-Proto`), `proxyTimeout`/`timeout` 60 s
(`proxy_read_timeout 60s`).

**Validação de T4.2 item 2** (2026-09-12): `rtk tsc -b` verde em
`mesas/frontend` e `mesas/backend`; `docker compose config` **exit 0** nos dois
composes (a falha inicial era segredo ausente na máquina local —
`SERVICE_CREDENTIAL`, `CATALOG_INTERNAL_TOKEN` —, nenhum erro no `mesas-app`);
`og.seo.test.ts` **15/15**.

**(c) Mover as rotas de borda para o tunnel.** Custo: mexe em tunnel de produção
(§Autorização) e espalha a topologia entre repo e painel — o `nginx.conf` é
revisável em PR, a rota no painel não.

**Medição do tunnel — FEITA em 2026-09-12 (MCP Cloudflare, read-only).** Tunnel
único `Artificio` (`6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`), `healthy`, 4
conexões. Config **remota** (`source: "cloudflare"`, versão 26), sem `config.yml`
na VM: o `cloudflared` roda `tunnel run --token`.

**O ingress tem 11 regras e `path: null` em TODAS as 11 — não existe rota por
path no tunnel.** Cada regra é hostname → um serviço:

```
mesas.artificiorpg.com      → http://mesas-app:80
mesasbeta.artificiorpg.com  → http://mesas-beta-app:80
(catch-all)                 → http_status:404
```

**Consequência, e ela corrige o registro anterior desta seção:** o tunnel manda
*todo* o tráfego de `mesas.` para um container só. Quem separa `/api/`,
`/auth/*` e `/sitemap.xml` é o nginx **dentro** do container — o tunnel nunca
soube que essas rotas existem. A versão anterior deste bloco afirmava que as
rotas "precisam de entrada no ingress do painel, ação do mantenedor"; **isso
estava errado, e foi afirmado sem ler o ingress**. Sob (b) o roteamento continua
dentro do container, só troca de nginx para Express, e o mantenedor **não tem
ação a fazer no painel** além da porta (abaixo).

Custo real de (b) no tunnel: **uma linha**, `mesas-app:80` → `mesas-app:3000`
(mais a do beta). Não é opcional — `USER node` não abre porta <1024.

**PACOTE NOVO AUTORIZADO E INSTALADO (mantenedor, 2026-09-12):**
`http-proxy-middleware@4.2.0` em `apps/mesas/frontend/package.json:38`, **+9
pacotes** no `pnpm-lock.yaml`. O lockfile mudou → a trava de `deploy-flow.md` §1
vale no commit.

**Correção de registro:** ao pedir a autorização, o agente afirmou que o pacote
"já estava na árvore como transitivo, usado pelo Vite". **Falso** — medido depois:
`grep -c http-proxy-middleware pnpm-lock.yaml` → **0** antes da instalação. O
custo foi apresentado menor do que era. A escolha do pacote continua sustentada
pelas medições acima; o argumento de "já está lá" não existia.

**ORDEM DE DEPLOY — inverter derruba `mesas.` por mais tempo.** O ingress aponta
hoje para `:80`, onde o nginx ouve. Trocar para `:3000` antes do container novo
subir faz o `cloudflared` bater em porta sem ouvinte: **502 imediato**, e a
config é remota, propaga em segundos, sem janela de graça.

1. Código local (`server.js`, os dois composes, `nginx.conf` removido)
2. PR → review → merge
3. Deploy: `mesas-app` sobe como Node em 3000 — **`mesas.` cai aqui**, ingress
   ainda em 80
4. Ingress `80` → `3000` (prod e beta) — volta

Entre 3 e 4 há downtime real, segundos a ~1 min. **Não é eliminável trocando a
ordem**: fazer o ingress primeiro só antecipa e alonga a queda. O passo 4 é
escrita em tunnel de produção (§Autorização) — aprovação nominal, no momento do
deploy, não antes.

Alternativa que zera o downtime e foi **descartada**: `server.js` ouvir em 80 via
`CAP_NET_BIND_SERVICE` ou root-drop. Diverge dos 6 apps Express, que ouvem em
3000/4322/4324 e nunca em 80 — reintroduz o caso particular que (b) elimina. A
queda de segundos é o mesmo perfil de qualquer `docker compose up -d`, que
reinicia o container no passo 3 de todo jeito.

**Aviso operacional para o próximo agente:** `docker inspect` neste container
imprime o token do tunnel em claro — `Config.Cmd` **é** a credencial. Nunca pedir
`{{json .Config.Cmd}}` aqui; usar `--format` de campo específico. Já aconteceu
nesta sessão (token completo, 184 chars, foi para o log do `rtk` e para o
transcript). Mantenedor avaliou e dispensou limpeza: a preocupação é commit, e
nada com o token está rastreado no git.

**Volume `frontend_dist_*` — saiu do `mesas-app` em 2026-09-12; segue no
`mesas-api`, vazio.** Detalhe e motivo em DEB-102-1. Removido o `@og_proxy`,
**nada mais chama `/og/*`**. `grep -rn "/og/" apps packages scripts .github`
devolve 7 ocorrências e nenhuma é chamador de produção:
`nginx.conf:137` (o `rewrite`, único real), 10 linhas de `og.seo.test.ts`
(`supertest`), a string de `console.error` em `og.ts:328` e seu compilado em
`dist/`, e `scripts/api/{generate-openapi,inventory}.ts` (geração de OpenAPI).

O cron **não** lê o `index.html`: `og:cron` → `cronRunner.js`, que só dispara
`og:worker` (`processLinkMetadataJobs`) e `og:cleanup`
(`cleanupLinkMetadataCache`) — cache de metadata de **link externo**, não Open
Graph do site; o prefixo `og:` engana. `grep -rn "INDEX_HTML\|frontend-dist\|
readFile" apps/mesas/backend/src/scripts/` devolve 4 hits, todos import de
JSON/markdown, nenhum do `index.html`.

Logo `INDEX_HTML_PATH` (`og.ts:17`) fica **sem leitor** em produção, e o volume
(`frontend_dist_prod` / `frontend_dist_beta`) não alimenta mais nada.

**`routes/og.ts` NÃO é removido nesta task** (decisão do mantenedor,
2026-09-12). F1/F2 desta mesma spec acabaram de corrigi-lo (`404`/`410`,
canonical, 14 casos em `og.seo.test.ts`). Fica órfão e registrado como débito no
fim deste arquivo.

**Lint do `mesas/frontend` estava vermelho e foi corrigido (2026-09-12): 55 erros
→ 0.** A migração para framework mode introduziu os cinco defeitos abaixo; nenhum
foi silenciado com `eslint-disable`.

| defeito | correção |
|---|---|
| 40 erros em `.react-router/` | diretório **gerado** pelo `typegen`: entrou em `globalIgnores` do eslint (`eslint.config.js:14`). **A linha do `.gitignore` só entrou em 2026-09-13** — este registro afirmava as duas desde o início, mas `git check-ignore` devolvia "NAO IGNORADO" e os 29 arquivos apareciam em todo `git add -A`, que é o que a armadilha do fim deste documento descreve |
| 8 `only-export-components` em `root.tsx`/`routes/*` | rota **tem** que exportar `loader`/`meta` ao lado do componente — exceção por caminho, a regra segue valendo no resto do app |
| `entry.server.tsx:25` `_loadContext` | `argsIgnorePattern: '^_'`, mesmo padrão de `apps/accounts/eslint.config.js:24`; é parâmetro posicional da assinatura do React Router |
| 4 `react-hooks/refs` em `useUrlState.ts` | `useRef` lido/escrito durante o render → `useState` com ajuste no render |
| `useMestre.ts:256` `set-state-in-effect` | efeito → ajuste durante o render com chave de identidade |

**Dois eram bug real, não só ruído de lint:**

1. **Tema piscava no cookie errado.** `root.tsx:68` tinha `\s` dentro de template
   string, que colapsa para `s` literal: a regex chegava ao browser como
   `(?:^|;s*)` e **não casava `; artificio_theme=…`** — a forma como o browser
   serializa todo cookie depois do primeiro. Quem tivesse qualquer outro cookie
   antes deste caía no default e via o flash de tema que o script inline existe
   para evitar. Corrigido para `\\s`.
2. **Perfil do mestre anterior aparecia por um quadro.** O `useEffect` que
   sincronizava `seeded` só roda depois da pintura, então navegar entre mestres
   no cliente mostrava o perfil antigo sob a URL nova até o efeito rodar. O
   ajuste durante o render faz o React descartar e refazer antes de pintar.

**Suítes verdes (2026-09-12):** `mesas/frontend` **84 arquivos / 1139 testes**
(+1 arquivo, +17 casos: `tableMeta.test.ts`, de T4.3/T4.5); `content-editor`
120/120. Build SSR gera `build/server/index.js` (2.094 kB).

**Isomorphic rendering — pergunta do mantenedor (2026-09-12), respondida por
medição.** IR **é** o que a T4.1 decidiu: "SSR universal" e "isomorphic
rendering" são o mesmo mecanismo (a comunidade React trocou o termo por volta de
2016). Não é alternativa pendente. Verificado no código, não presumido: 3
`loader` isomórficos nas rotas públicas, **0** `clientLoader` (que quebraria o
modelo servindo dado só no cliente), e guarda de ambiente concentrada em um único
módulo (`lib/apiUrl.ts`, 2 ocorrências de `typeof document`).

`lib/apiFetch.server.ts` foi renomeado para `lib/apiUrl.ts`: o sufixo `.server` é
convenção que o React Router **impõe** para módulo inalcançável pelo cliente, e o
build falhava com `Server-only module referenced by client` — o módulo é
isomórfico por natureza e a separação correta é em runtime, não em build.

O que IR **não** resolve, e segue sendo o risco a medir: o primeiro request custa
CPU de render. A alternativa que zeraria isso é SSG/`prerender` (build-time), já
descartada por servir dado congelado — incompatível com vagas e preço, que a
regra pétrea de T4.3 exige no HTML visível.

**Depende de.** T4.1. **Exige autorização nominal** (obra de arquitetura).

**Aceite — MEDIDO em 2026-09-12** (SSR local `PORT=3994`, stub servindo payload de
mesa paga com 3 de 5 vagas):

| item | medição |
|---|---|
| 1. crawler recebe conteúdo real | `ClaudeBot/1.0` e `GPTBot/1.1` → `200`, **26.602 B**, `ld+json` = **1** (era 3.328 B de casca) |
| 3. crawler ≡ navegador | `diff` bot/navegador e bot/GPTBot: **idênticos**, byte a byte |

Item 2 (perfil de mestre) medido na rodada anterior desta task: `/mestre/<inexistente>`
→ `404`, `/perfil` → `200`, conteúdo real e não casca.

**Armadilha de medição, para o próximo agente não repetir:** `getServerApiBase()`
lê `API_UPSTREAM_PORT` (default `3000`), não só `API_UPSTREAM`. Stub local em
outra porta sem essa env produz `ECONNREFUSED` e a rota devolve `500` — que lê
como defeito do SSR e não é. O `500` é o comportamento correto: erro de upstream
não pode virar `200` com página vazia.

---

### [~] T4.3 — Schema `Product`+`Offer` no `@graph` — APLICADO E MEDIDO; falta só Rich Results Test (pós-deploy)

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

**Estado em 2026-09-12: APLICADO, coberto por teste e commitado.**
`features/table/seo/tableMeta.ts:79` (`buildTableJsonLd`) emite o `@graph` com um
`Product`+`Offer`, derivado do **mesmo** `TableViewModel` que a página renderiza —
não de uma segunda leitura do dado cru. É a derivação única que torna o
espelhamento impossível de quebrar por edição futura, e não a disciplina de quem
edita.

**A regra 3 já estava satisfeita pelo backend, e a leitura anterior desta task
errava o alvo.** Medido em `apps/mesas/backend/src/routes/tables.ts:50`:
`sql\`t.banner_url\`.as('cover_url')` — o `cover_url` do payload **é** o
`banner_url` do banco, nas colunas compartilhadas pelos dois `select` (`:336`
detalhe, `:763` lista). Logo `vm.coverUrl` já entrega a cobertura de 145/168 que a
regra pedia; não há fallback a escrever no frontend. As 23 mesas sem imagem
nenhuma caem no ramo que **omite** `image`, nunca em placeholder.

**Aceite medido** (`tableMeta.test.ts`, 11 casos + SSR local em `PORT=3994` com
payload real, 2026-09-12):

| item do aceite | medição |
|---|---|
| 2. um `Product`, zero `Event` | `"@type":"Product"` → **1**; `"@type":"Event"` → **0** |
| 3. `ClaudeBot` recebe o JSON-LD | `200`, **26.602 B**, `ld+json` → **1** (era 3.328 B de casca) |
| 4. `price` de `price_value` | mesa paga → `"price":"50.00"`; gratuita → `"0"`, nunca ausência |
| 5. **espelhamento** | `InStock` no JSON-LD **e** `R$ 50,00` + `3 de 5 vagas` no HTML visível, da mesma página |

O espelhamento é asserido em teste contra o ViewModel, não só medido no HTML:
`TableActionPanel.tsx:44` renderiza o preço e `:178` as vagas do mesmo `vm` que
alimenta o schema. Teste cobre também preço vindo de rótulo de contato ("Ticket /
Inscrição" com mesa `gratuita` → `price` continua `"0"`), que é o defeito de 95%
dos casos que a regra 1 previne.

**Falta.** Rich Results Test (item 1) — exige URL pública, roda depois do deploy.

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

### [x] T4.5 — `description` por mesa — APLICADO E COMMITADO

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

**Estado em 2026-09-12: APLICADO, coberto por teste e commitado.**
`features/table/seo/tableMeta.ts:22` (`buildTableDescription`) monta
`<sinopse truncada> | <sistema> • <modalidade> • <nível> • <preço> • <vagas>` a
partir do mesmo `TableViewModel` que a página renderiza. O orçamento de 160
caracteres corta a **sinopse**, nunca a cauda de facetas: a cauda é o dado que a
pessoa procura, a sinopse é o que sobra.

**Aceite medido** (`tableMeta.test.ts`, 6 casos): duas mesas distintas produzem
descriptions distintas; nenhuma contém a frase institucional; a cauda carrega
sistema, modalidade, preço e vagas; o truncamento respeita 160 caracteres
preservando a cauda; mesa sem sinopse não produz string vazia.

---

### [x] T4.6 — `robots.txt`: nomear crawlers de IA — APLICADO E COMMITADO

**Entregue em 2026-09-12.** `apps/mesas/frontend/public/robots.txt` (76 B → 789 B)
nomeia **cinco** agentes com `Allow: /`: `GPTBot`, `OAI-SearchBot`, `ClaudeBot`,
`PerplexityBot`, `Google-Extended`.

São cinco e não os quatro do aceite original: `OAI-SearchBot` é o agente de busca
da OpenAI, distinto do `GPTBot` de treino — nomear só um dos dois deixaria metade
do tráfego da OpenAI dependendo do curinga, que é justamente o que esta task
existe para não fazer. `Claude-Web` do MesaQuest foi substituído por `ClaudeBot`,
que é o agente que a Anthropic de fato envia (e o que a medição de T4.1 mediu
recebendo casca).

**Aceite medido (SSR local, `PORT=3994`, 2026-09-12):**

| medição | resultado |
|---|---|
| `curl -A GPTBot/1.1 /robots.txt` | `200`, 789 B, 5 agentes nomeados |
| `curl -A GPTBot/1.1 /mesas/<slug>` | `200`, **26.602 B** com conteúdo real (era 3.328 B de casca) |
| `build/client/robots.txt` | 789 B, idêntico ao `public/` — o Vite copia, o `express.static` serve |

Nomear não muda a permissão (o curinga já permitia): documenta a intenção e
protege contra um `Disallow` futuro sob `User-agent: *` que os derrubaria sem
ninguém perceber o efeito colateral. O que dá conteúdo a estas linhas é o SSR de
T4.2 — nenhum destes agentes executa JavaScript.

**Depende de.** T4.1 → T4.2 → T4.3 → T4.6 (cumprida nesta ordem).

---

## F5 — Facetas e guards

### [x] T5.1 — Medir e tratar facetas de filtro — ENTREGUE POR CONSEQUÊNCIA DE T4.2 (medido em beta, 2026-09-13)

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
catálogo com parâmetro.

**Esta task não teve código próprio — foi entregue pelo SSR de T4.2.** A dependência
registrada aqui ("canonical injetado por JS não é lido") era a causa inteira: o
canonical já era o certo, mas chegava por JS e o crawler não o via. Com o SSR, ele
sai no HTML inicial e os três aceites passam sem uma linha nova. **Não abrir esta
task como trabalho pendente.**

**Aceite — medido em 2026-09-13 contra `mesasbeta`** (mesmo código de prod; o
canonical emitido aponta para `mesas.`, que é o correto — beta não disputa índice):

| aceite | comando | resultado |
|---|---|---|
| 1 | `curl 'https://mesasbeta…/?system=castles-crusades'` | `<link rel="canonical" href="https://mesas.artificiorpg.com/"/>` ✅ |
| 2 | idem com `&modality=online&price=gratuita` (3 params) | mesmo canonical limpo ✅ |
| 3 | `curl 'https://mesasbeta…/' \| grep -c canonical` | **1**, auto-referente ✅ |

Revalidar contra `mesas.artificiorpg.com` depois do deploy de prod é confirmação, não
nova implementação.

---

### [ ] T5.2 — Guards em CI

Nenhum dos defeitos desta spec quebra teste algum e todos são invisíveis em code
review — foi por isso que sobreviveram. Guard que falha o CI se voltarem:

**Esta task é uma das duas que NENHUM deploy fecha — medido em 2026-09-14 ao montar
`mapa-deploys.md`.** O critério **G1** do `spec.md` §4 ("guard automatizado cobre A1,
C1, B1 e F1") depende de G-B/G-C/G-D, e os três **não dependem de deploy**: o job pode
subir `node server.js` em `127.0.0.1`. O que falta é **banco com dado em CI**, que é
desenho próprio e não existe. Consequência para o fechamento da spec: mesmo com os
deploys de `site` e `mesas` em prod e todos os `curl` verdes, G1 continua aberto — e com
ele a classe inteira de "sitemap anuncia o que o SSR nega", que volta sem quebrar teste
algum. Não contar G1 como consequência de deploy em planejamento nenhum.

| Guard | Trava | estado |
|---|---|---|
| **G-A** | post com canonical ≠ URL real (sobre `posts.json` gerado) | ✅ **FEITO em 2026-09-13** — `smoke:post-canonical` |
| G-B | URL do sitemap que o SSR nega (equivalência sitemap ↔ crawler) | pendente — exige HTTP, ver nota abaixo |
| G-C | slug inexistente sob `/mesas/` respondendo 200 | pendente — exige HTTP |
| G-D | rota pública de mesa sem conteúdo/schema no HTML inicial (varre com UA de crawler de IA) | pendente — exige HTTP |
| **G-E** | regra de visibilidade duplicada: predicado objeto ≠ SQL, ou espelho frontend ≠ backend | ✅ **FEITO em 2026-09-13** — `smoke:visibility-mirror` |
| **G-F** | `price` do schema ≠ `price_value` do banco (trava a derivação pelo rótulo do contato) | ✅ **FEITO em 2026-09-13** — `smoke:jsonld-price-source` |

**Os três estáticos estão prontos; os três restantes são de outra natureza.** G-B, G-C
e G-D exigem requisição HTTP contra a aplicação rodando. **Não dependem de deploy** — o
job pode buildar e subir `node server.js` em `127.0.0.1`, e isso é preferível a apontar
para beta: gate que chama a rede fica vermelho quando a rede cai, sem defeito nenhum.
O que eles exigem de fato é **banco com dado** (o sitemap sai de query), que é desenho
próprio e ainda não foi feito.

**G-F — `scripts/ci/check_jsonld_price_source.mjs`.** Verifica que `priceForJsonLd` lê
`vm.price`/`vm.priceType` e nada de contato/rótulo, que `buildTableJsonLd` alimenta
`offers.price` por ela (e não inline), e que o mapper segue derivando de
`price_value` — a ponta de origem. Estático de propósito: o defeito é de ORIGEM DO
DADO, e fixture provaria o valor de hoje, não de onde ele vem.

Detecta 5 sabotagens (todas exit 1; limpo exit 0): preço pelo rótulo do contato;
`offers.price` montado inline; **condição literal** (`if (true) return '0'`); mapper
lendo outro campo; e **`offers.price` recebendo literal com a chamada intacta**.

> O último era furo da primeira versão (achado P2 do Codex, PR #320, reproduzido):
> mantendo `const price = priceForJsonLd(vm)` e trocando só a propriedade por
> `price: '999'`, o guard saía exit 0 com preço fixo publicado. Verificar que a chamada
> EXISTE não prova que o valor CHEGA ao schema — agora são duas checagens, origem e
> destino, ligadas pelo nome da variável capturada.

> O cenário da condição literal **passou verde na primeira versão** e obrigou a
> acrescentar um check: `codigo.includes('vm.price')` prova que o texto existe, não que
> o dado decide — com `if (true)` as menções sobrevivem no corpo e o preço já é
> constante. Mesma classe do furo que o Codex achou no G-E (helper local), encontrada
> aqui por sabotagem própria antes de ir a review.

**G-A — `scripts/ci/check_post_canonical.mjs`.** A trava é *"canonical presente **E**
com caminho diferente do post"*: ausência é o caso CORRETO, porque
`blog/[slug].astro:21` (`post.seo.canonical || …`) cai no fallback auto-referente.
Canonical explícito **vence** o fallback, então canonical errado no dado é emitido como
está — por isso a trava é sobre `posts.json`, não sobre o template.

> **A primeira versão deste guard estava INVERTIDA** (achado P2 do Codex, PR #320,
> reproduzido): comparava contra `/<slug>/` e apontava para `pages/[slug].astro`, que é
> a rota **institucional** (sobre, contato, políticas) e nem consome `posts.json` — ela
> lê `pages` de `lib/content.ts`. Medido: canonical CORRETO (`/blog/x/`) saía **exit 1**
> e o ERRADO (`/x/`) saía **exit 0**. O guard reprovava o certo e aprovava o defeito que
> existe para travar.
>
> A rota de post é `/blog/<slug>/`, preservada no cutover do WordPress (D047/D019). **A
> spec já tinha a resposta e eu não a li antes de escrever:** `spec.md:36` cita
> literalmente `apps/site/src/pages/blog/[slug].astro:21` como ponto de emissão, e
> `spec.md:58` traz o critério em SQL — `regexp_replace(canonical,'^https?://[^/]+','')
> <> '/blog/'||slug||'/'`, a mesma query que mediu os 105 divergentes.

**Compara CAMINHO, não host**, porque `SITE.origin` vem de `PUBLIC_SITE_URL` e difere
entre beta e prod. Validado: canonical auto-referente apontando para
`beta.artificiorpg.com` **passa** (configuração legítima), enquanto caminho divergente
falha.

Detecta 4 sabotagens: canonical para outro caminho (o defeito dos 105); `posts.json`
vazio (export não rodou — lista vazia passaria verde provando nada); template perdendo
o fallback; e o caso de beta, que corretamente **não** falha.

Estado hoje, medido: **8 posts, zero canonicals emitidos** — pós-T3.2. O guard nasce
verde e existe para a 106ª ocorrência não voltar em silêncio.

**G-E — `scripts/ci/check_table_visibility_mirror.mjs`, ligado no `ci.yml` como
`pnpm smoke:visibility-mirror`.**

**Correção de afirmação minha, apontada pelo CodeRabbit na PR #320.** Eu havia escrito
aqui, no guard, no `ci.yml` e na mensagem do `fc2f617` que "nenhum gate obrigatório
compara as formas da regra". **Falso.** O `ci.yml:173-176` tem o passo "Mesas
visibility equivalence on PostgreSQL 16", que fornece `MESAS_TEST_DATABASE_URL` e roda
`tableVisibility.equivalence.test.ts` — a trava objeto↔SQL está ATIVA, e o comentário
ao lado dela registra que isso foi resolvido por achado de review da PR #315.

O erro foi de meia medição: li o `describe.skipIf` no arquivo de teste e **não medi se
o CI provê a variável**. O `skipIf` só desliga o teste localmente.

**O escopo real de G-E é o espelho, e só ele:** backend ↔ frontend, o único lado sem
gate. Não substitui nem duplica o teste de equivalência.

Compara o TEXTO NORMALIZADO de `importedTableExpiryDate` e `isImportedTableExpired`
nas duas raízes (comentário e espaço fora; nome, operador e literal dentro). Não
valida semântica — isso é do teste contra Postgres; valida que as duas cópias
continuam sendo a mesma cópia, que é o que falhou 3×.

**Provado em 3 cenários de sabotagem, não só no verde** (gancho que só passa não é
guard — AGENTS.md §Compartilhado por padrão). Todos saem **exit 1**; o código limpo,
**exit 0**:

1. divergência direta no corpo (`+ 5` → `+ 7` dias)
2. **delegação a helper local** — `expiryDays()` em cada raiz devolvendo 5 e 7, com os
   corpos idênticos ao byte
3. função renomeada/removida do espelho

**O cenário 2 era um furo real, achado pelo Codex (P2) na PR #320 e reproduzido aqui.**
A versão do `fc2f617` comparava só o texto dos dois corpos nomeados, então qualquer
refatoração que movesse parte da regra para um helper passava verde com a regra
divergindo em 2 dias. A correção é a lista `CHAMADAS_PERMITIDAS`: chamada que o guard
não compara vira falha, com a instrução de espelhar a função ou justificar a exceção.
Falso-positivo ali custa uma entrada com motivo escrito; falso-negativo é o que este
guard existe para não ter.

**E teve um 4º cenário, da MESMA classe, numa segunda rodada do Codex:** corrigido o
helper CHAMADO, o identificador **não chamado** continuava passando — extraindo o prazo
para uma constante local `EXPIRY_DAYS` (5 no backend, 7 no frontend), os corpos ficavam
idênticos ao byte e o guard saía exit 0. Agora a varredura é de identificador livre, não
só de `nome(`: o que não for declarado no corpo, parâmetro, propriedade, palavra-chave
ou permitido é dependência não verificada.

Dois falso-positivos meus nessa mudança, ambos medidos e corrigidos antes de entrar:
palavras-chave (`const`, `new`, `return`) entrando como identificador — separadas numa
lista própria, porque são ruído de parser e não decisão sobre regra; e **literal de
string** (`table.origin !== 'imported'` fazia o guard exigir que `imported` fosse
espelhado) — literais saem antes da varredura.

**Também do review da mesma PR** (Sonar): complexidade cognitiva de `extrairCorpo` era
18 > 15 — os dois laços de contagem eram o mesmo algoritmo duplicado inline, extraído
para `indiceDoFechamento`; e a regex da assinatura passou a usar `String.raw`.

**Defeito do próprio guard, corrigido antes de entrar:** ele nasceu vermelho porque o
extrator pegava a primeira `{` depois da assinatura — que abre o **tipo inline do
parâmetro**, não o corpo. Comparava declaração de tipo e acusava divergência onde a
diferença é legítima (`DateValue` no backend, `string` no frontend, que recebe JSON).
Corrigido fechando a lista de parâmetros por contagem de parênteses; o motivo está
comentado no arquivo.

**Medição que muda G-A:** `apps/site/src/data/posts.json` tem **8 posts** e o objeto
`seo` só carrega `description` — **zero canonicals emitidos**. É o estado pós-T3.2,
que limpou os 105 divergentes no banco. G-A segue válido, mas nasce verde e a trava
real é *"canonical presente E diferente da URL"*, não *"canonical ≠ URL"*.

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

## F7 — Header mobile unificado nos 6 apps · **PR PRÓPRIA**

**Origem.** Achado P1 do Codex na PR #322 (header estoura abaixo de ~400px, já em
produção) + determinações do mantenedor em 2026-09-15 sobre a estrutura do header no
celular. O diagnóstico medido que sustenta esta fase está em T3.5e (F3), no bloco marcado
"ESTE BLOCO É DIAGNÓSTICO, NÃO ESPECIFICAÇÃO"; **não repetir as medições aqui** — esta
fase é o que fazer, aquele bloco é por quê.

**Escopo:** header mobile + tokens + subnav, numa PR só (decisão do mantenedor). Desktop
**não muda** em nenhuma task.

**Estrutura alvo em ≤860px** (decisão do mantenedor; o desktop permanece como está):

```
┌──────────────────────────────────┐
│ [☰púb]  logo  [🔍]  [☰sessão]   │   4 slots, 290px mínimo
└──────────────────────────────────┘
```

- **`☰púb`** (esquerda): nav entre módulos + subnav do módulo + rodapé com changelog e tema
- **`logo`**: centro
- **`🔍`**: navega para a busca daquele módulo
- **`☰sessão`** (direita): "Entrar" quando deslogado; conta + **notificações** quando logado

**Exclusão mútua:** abrir um fecha o outro. O mecanismo já existe entre avatar e painel
(`Header.tsx:141-153`, `toggleUserMenu`/`toggleNav`) — **estender, não reescrever**.

**Custo medido em 2026-09-15** (o mantenedor perguntou antes de autorizar):

| onde | arquivos | tamanho |
|---|---|---|
| `packages/ui` | `Header.tsx` · `styles.css` · `theme.tsx` | 421 · 2240 · 155 linhas |
| `site` | `SiteHeaderIsland.tsx` · `SiteHeader.astro` · `Base.astro` · `busca/index.astro` · `astro.config.mjs` | 367 · 45 · 126 linhas |
| consumidores | `mesas` 90 · `glossario` 85 · `downloads` 94 + `App.tsx` 106 · `links` 39 · `accounts` 552 | só tiram o cálculo de `variant`; `downloads` ganha a rota |
| guards | `styles.contract` 16 testes · `Header.paineis` 6 · `Header.acesso` 11 · `SiteHeader.estrutura` 6 | estendidos |

**Validação automatizada:** **6 suítes, 2.400 testes** — `mesas` **1152** · `accounts`
**602** (+52 skipped, 87s) · `downloads` **315** · `site` **190** (18s) · `ui` **104**
(5s) · `glossario` **37**. Um comando por vez (trava do T0).

O `accounts` entra porque consome o `Header` (`main.tsx:539`, `variant={theme}`) e é o
app com **menos rede de segurança** aqui: nenhum dos seus 602 testes toca o header
(medido — os arquivos que citam `Header` são de credencial e rotas de comunidade).

**O custo real é o smoke visual, e é do mantenedor:** 6 apps × 4 larguras
(320/360/375/390) × logado/deslogado × claro/escuro = **96 combinações**. Guard de CSS
prova regra, guard de árvore prova estrutura; **nenhum prova pixel**.

**Ganho, para comparar:** header de 394px (logado) / 406px (deslogado) passa a **290px**,
cabendo em 320. O FOUC do tema some. `/busca/` sai do índice. Seis escritas de
`data-variant` viram uma.

**Duas formas de baratear, se o smoke de 96 combinações for caro demais de uma vez:**
T7.4 sozinha primeiro reduz a conferência a "o header ficou igual nos 6?", sem misturar
com mudança de estrutura; e **T7.7 é independente de tudo** — 2 linhas, sem smoke visual.

**Aritmética que valida:** 40+90+40+40 (slots) + 3×16 (gaps) + 32 (padding) = **290px**,
cabe em 320px com 30px de folga. Hoje: 394px logado / 406px deslogado, estourando em 360,
375 e 390.

---

### [x] T7.1 — Estrutura de 4 slots no `packages/ui` — **FEITA (2026-09-15)**

`Header.tsx` + `styles.css`. O grid de ≤860px passou de `1fr auto auto` para
`auto 1fr auto auto`. A marca é o único item elástico; os três controles ficam em `auto`,
do tamanho do alvo de toque.

**Entregue.**
- **Hambúrguer público** (`.artificio-nav-toggle`), filho direto do grid e **antes da
  marca no DOM** — ordem do documento é a do leitor de tela e do Tab, e ele está à
  esquerda na tela. Resolver por `order` do CSS divergiria as duas ordens. Nasce
  `display: none`; aparece só em ≤860px. Hoje abre o painel atual (`toggleNav`); T7.2 é
  quem lhe dá os três blocos de conteúdo.
- **Só a busca exposta** na barra. Changelog e tema descem por
  `.artificio-header-tools > *:not([aria-label="Buscar"])` — regra por EXCLUSÃO, para que
  ferramenta futura também desça: o default seguro numa barra de 320px é sair, não entrar.
- **Container de ferramentas some junto** quando não sobrou busca nele
  (`:not(:has(...))`). Caso real do `accounts`, que liga só o tema: esconder apenas os
  filhos deixaria um `<div>` vazio cobrando os 2×16px de `gap`, ou seja 32px dos 30px de
  folga que a aritmética de 320px tem.
- **Desktop inalterado**: a regra de `:root` continua `auto 1fr auto auto`. Mesmo valor do
  mobile por coincidência — os papéis das faixas são outros (lá: brand, nav, ferramentas,
  sessão).

**⚠️ Desvio do aceite 2, deliberado — o hambúrguer de SESSÃO fica escondido em ≤860px.**
Os dois botões chamam o mesmo `toggleNav` (medido em `Header.tsx`), porque só **T7.3**
converte o da direita em painel de sessão. Mostrar ambos agora daria ao usuário dois
controles idênticos lado a lado, e o 4º slot já tem o avatar (ou o "Entrar"), que é a
porta da conta. A regra `.artificio-menu-toggle { display: none }` dentro do `@media` é
**o ponto de entrada de T7.3**, que a reativa com `display: inline-flex` e troca o
`onClick`. Há guard travando o estado atual, e ele é temporário por construção.

**Aceite — medido em 2026-09-15.**
1. ✅ `grid-template-columns: auto 1fr auto auto` no `@media`; guard existente reescrito
   (ele pegou a mudança, que é a função dele).
2. ⚠️ Cumprido para changelog e tema; o hambúrguer de sessão saiu da barra em vez de
   ficar — ver o desvio acima.
3. ✅ Desktop intacto, com guard próprio.
4. ✅ `tsc` 0, `eslint` 0, **121 testes** no `packages/ui` (eram 104 antes da F7).
5. ✅ **Guard novo de contagem de slots**: `Header.slots.test.tsx` renderiza e conta os
   filhos DIRETOS do grid, no padrão de `SiteHeader.estrutura.test.tsx` do `site`. O
   aceite 1 prova as faixas; este prova os filhos. As duas metades juntas é que impedem a
   volta de T3.5e (5 filhos para 4 faixas empurra a sessão para fora da tela).
6. ⬜ **Smoke visual pendente** — 320/360/375/390px. Guard de CSS prova regra, guard de
   árvore prova estrutura; nenhum prova pixel.

**Regressão conferida nos consumidores:** `site` 191 · `mesas` 1152 · `accounts` 602 ·
`downloads` 315 · `glossario` 37, todas verdes.

#### Achados de review na PR #323, corrigidos no mesmo trabalho

**P1 (2ª rodada) — a aritmética de 320px do comentário estava errada, e o header
estourava.** O comentário do `@media` contava 40px para a faixa de sessão, que é o
tamanho do BOTÃO. Medido depois do apontamento: `.artificio-session` tem
`min-width: 96px` na regra base (`styles.css`) e o `@media` **não o ajustava**. A soma
real, nos consumidores com lupa: 40 (☰) + 90 (marca) + 40 (🔍) + **96** (sessão) + 3×16
(gaps) + 32 (padding) = **346px** — estourando 26px justamente em 320, a largura que
T7.1 existe para suportar.

Duas correções: o `min-width` da sessão cai para 40px no `@media` (o conteúdo lá é o
avatar de 32px ou o "Entrar"), e o texto de carregamento ganha `max-width` + reticência
— "Verificando acesso…" em 14px passa de 130px sozinho e esticava a faixa acima de
qualquer piso enquanto a sessão não resolvia.

**⚠️ O guard que faltava:** a aritmética vivia só num comentário, e comentário não
falha. Agora `styles.contract.test.ts` **soma as parcelas lidas do CSS** e reprova se
passar de 320 — se alguém subir um piso, estoura no teste antes de estourar na tela.
Cada parcela é validada contra `NaN`, porque leitura que falha passaria calada por uma
comparação `<=`.

**Duplicação (Sonar): o mesmo botão em três lugares.** 6,6% em código novo, 44% no
`Header.tsx`, 46% no island. Medido: a marcação do hambúrguer (botão + SVG de 3 linhas)
estava idêntica em `Header.tsx` (público e sessão) e no `SiteHeaderIsland`. Extraída
para `packages/ui/src/NavToggle.tsx` e consumida nos três pontos — é a regra de
compartilhado do `AGENTS.md`, não cosmética de métrica: com três cópias, mudar o ícone
deixa duas para trás em silêncio.

**⚠️ Editar o barrel do `packages/ui` NÃO basta para os consumidores.** O
`package.json` do pacote aponta `exports` para `./dist/index.d.ts`, então o `site`
consome o BUILD, não o fonte. Sintoma medido: `tsc` do `site` deu
`TS2305: Module '@artificio/ui' has no exported member 'NavToggle'` com o export já
escrito no `index.ts`, e a suíte do `site` quebrou junto — enquanto o `packages/ui`
passava verde nos seus 121 testes. A correção é `pnpm --filter @artificio/ui build`
antes de rodar os consumidores. **Vale para toda task da F7 que exporte símbolo novo
do pacote.**

#### Achados do Codex em `f15346f`

**P1 — regra de CSS compartilhado deixou o `site` sem navegação no celular.** O commit
`f15346f` escondeu `.artificio-menu-toggle` em ≤860px porque, no `Header` do pacote, ele
duplicava o hambúrguer público. Medido depois do relato: `apps/site` tem header PRÓPRIO,
com **0 ocorrências** de `.artificio-nav-toggle` e só aquele botão acionando `toggleNav`.
Com o mesmo `@media` já escondendo os navs inline, os 11 links de projetos e as categorias
do blog ficaram **inalcançáveis no mobile do `artificiorpg.com`**.

Correção: o `SiteHeaderIsland` ganhou o `.artificio-nav-toggle` no 1º slot e perdeu o
`menu-toggle` da faixa de sessão — alinhando com o pacote, que é a direção da F7 e o que
T7.2 vai exigir de qualquer forma.

**⚠️ Por que passou:** as **6 suítes estavam verdes**. Nenhuma perguntava se um app
consumidor ainda tinha controle de navegação depois do colapso — falha em silêncio, sem
erro de tipo nem de lint. O guard que faltava agora existe em
`SiteHeader.estrutura.test.tsx` ("tem um controle de navegação que sobrevive ao colapso de
≤860px"), e há nota cruzada no `styles.contract.test.ts`: **toda regra nova de ≤860px
precisa ser conferida contra o `site`**, que é consumidor divergente do CSS compartilhado.

**P2 — o menu do avatar não seguia o header, e faltava nos DOIS sentidos.** As 5 regras
de tema escuro do dropdown foram escritas sem passar pelo header, e cada revisor viu uma
metade do mesmo defeito:

- **Codex:** casavam `:root[data-theme="dark"] .artificio-usermenu-*` solto. Num
  consumidor com `variant="light"` sob documento escuro — caso suportado por
  `HeaderProps` — o header ficava claro e o menu dentro dele, escuro.
- **CodeRabbit:** faltava também a porta da prop. Medido antes de corrigir:
  `data-variant="dark"` + `usermenu` = **0 ocorrências**. Um app com `variant="dark"`
  sob documento CLARO teria header navy com o dropdown branco — o espelho exato do
  anterior.

Corrigido com as duas portas, como no resto do chrome:
`:root[data-theme="dark"] .artificio-header:not([data-variant="light"])` **e**
`.artificio-header[data-variant="dark"]`.

**O buraco era do guard, e foi fechado.** O guard "pareia TODA regra de `data-variant`
com a de `data-theme`" varre num sentido só — regra de prop sem tema. Regra de tema sem
prop passava batido, que é exatamente o caso do dropdown. Agora existe o guard do sentido
inverso, restrito ao chrome (`header`/`footer` e o que vive dentro deles): componente de
página não tem por que seguir a prop do header.

**Aprendizado do guard (custou duas tentativas):** varredura por regex sobre o CSS cru
**casa dentro de comentário**. O comentário que escrevi acima dessas regras cita o seletor
errado como exemplo, e o guard enganchava nele, reprovando a própria correção que deveria
aprovar. Guard que lê texto de CSS tem de remover os comentários antes
(`styles.replace(/\/\*[\s\S]*?\*\//g, "")`) — ler só o que o navegador lê.

#### Achados do Codex em `1ed9e42`

**P1 — a ocultação da marca perdia na CASCATA, e as duas apareciam.** `.logo-neg` tem
especificidade (0,1,0), igual a `.artificio-brand-logo{display:block}` e
`.artificio-footer-logo{display:block}`, que estão **depois** no arquivo (linhas ~690 e
~1029) e venciam por ordem. Com `Header`/`Footer` emitindo as duas `<img>` desde T7.4, as
duas renderizavam no tema claro: a marca do header ia de 90px para **180px** e o total
batia **380px** — estourando os mesmos 320px que a correção anterior tinha acabado de
consertar, e duplicando a área do logo no rodapé.

Corrigido casando a classe da imagem junto (`.artificio-brand-logo.logo-neg`), o que sobe
para (0,2,0). **Especificidade, não reordenação**: mover o bloco para o fim do arquivo
funciona hoje e quebra na próxima regra que alguém acrescentar abaixo.

**⚠️ Por que passou, e é o mesmo padrão de novo:** a regra funcionava enquanto morava em
`apps/site/src/styles/global.css`, importado DEPOIS do pacote — ganhava por acaso de
ordem. Ao subir para `packages/ui` em T7.4, perdeu o acaso que a sustentava. **Toda regra
promovida de app para pacote muda de posição na cascata**, e o que a fazia vencer pode
não existir mais.

O guard antigo assertava `cssRule(".logo-neg")`, que prova que a regra EXISTE e não que
ela GANHA — passava verde com as duas marcas na tela. Agora ele proíbe a forma frágil
(seletor de marca sem a classe da imagem) e exige a forte.

**P2 — changelog e tema ficaram inacessíveis no celular.** Registrado como bloqueador no
cabeçalho de **T7.2**, que é quem conserta, por decisão do mantenedor.

### [ ] T7.2 — Hambúrguer público (esquerda) com nav + subnav + rodapé

> 🚩 **BLOQUEADOR EM PRODUÇÃO ABERTO POR T7.1 — esta task é o conserto.**
>
> T7.1 tirou changelog e tema da barra em ≤860px (`.artificio-header-tools > *:not(...)`),
> mas o painel que deveria recebê-los **ainda não existe**: `Header.tsx` e
> `SiteHeaderIsland.tsx` renderizam só `Nav` dentro de `.artificio-mobile-nav`.
> Medido a partir do commit `1ed9e42`: **no celular, changelog e tema estão inacessíveis
> nos 6 apps**, e no `accounts` — que liga só `showThemeToggle` — o usuário perde o
> ÚNICO jeito de trocar para escuro. Achado P2 do Codex na PR #323.
>
> **Decisão do mantenedor (2026-09-15):** deixar para T7.2 resolver, em vez de reverter
> a ocultação ou antecipar o rodapé para a PR da T7.1. A dívida é conhecida e tem dono.
>
> Enquanto T7.2 não entrar, **o header mobile é uma regressão de uso**: nenhum deploy
> dos 6 apps deve ser tratado como "T7.1 pronta" sem esta task junto.

O painel (`.artificio-mobile-nav`) ganha três blocos, nesta ordem: navegação entre
módulos · **opções daquele módulo** (a `moduleNav`, que hoje some no mobile) · rodapé
separado por linha com "Novidades" e alternador de tema.

**Os dois headers precisam do rodapé**, não só o do pacote: o `apps/site` tem marcação
própria (`SiteHeaderIsland.tsx`) e é consumidor divergente do mesmo CSS — foi assim que
o P1 da navegação passou. Fazer só um lado repete o erro.

**Aceite.**
1. Com `moduleNav` preenchido, o painel renderiza os três blocos; sem ela, dois.
2. O rodapé é irmão dos navs, com separador visual — não item de lista.
3. Changelog e tema **não** aparecem na barra em ≤860px (já é o estado desde T7.1).
4. **Changelog e tema ESTÃO no painel, nos dois headers** — é o que fecha o bloqueador
   acima. Guard que abra o painel e encontre os dois controles, em `Header.paineis.test.tsx`
   e no guard do `site`.
5. `accounts` recupera o controle de tema no celular: abrir o painel e achar o toggle.

### [ ] T7.3 — Hambúrguer de sessão (direita) absorve avatar e notificações

O menu do avatar vira o painel de sessão. **Dentro dele:** itens de conta, notificações
(`NotificationBell`) e "Sair"; deslogado, o botão "Entrar".

**Aceite.**
1. Logado: o sino está DENTRO do painel de sessão, não na barra.
2. Deslogado: só "Entrar"; nenhum item de conta no DOM.
3. **Exclusão mútua medida:** abrir o público fecha o de sessão e vice-versa — teste com
   clique real (jsdom), no padrão de `Header.paineis.test.tsx`.
4. O nome do usuário continua nomeando o botão (nome acessível), sem `display:none`.

### [x] T7.4 — Unificar `data-variant`, que é o que diverge de fato — **FEITA (2026-09-15)**

**Decisão do mantenedor:** header idêntico nos 6 apps.

**⚠️ A causa NÃO são os tokens sem prefixo — medido em 2026-09-15, corrigindo a primeira
versão desta task.** As classes estruturais do header usam **só `--artificio-*`**
(`surface`, `line`, `ink`, `muted`, `brand`, `navy`, `focus`), e **nenhum app redefine
esses**. Os 4 tokens sem prefixo (`--fg`, `--fg-muted`, `--line`, `--surface-subtle`)
aparecem em **4 lugares, todos dentro da busca embutida** (`.artificio-header-search*`) —
não afetam a cor do header. Trocá-los, como a versão anterior mandava, ainda **quebraria o
tema escuro**: `--fg-muted` é `rgba(11,18,32,0.66)` no claro e `--artificio-dark-muted` no
escuro, enquanto `--artificio-muted` é `#5a6172` fixo.

**A causa real é `data-variant`**, que troca fundo para `--artificio-navy`, texto para
branco e o acento dos links (**25 regras** em `styles.css` dependem dele). Cada app
escreve o mesmo contrato de um jeito:

| app | como passa | forma |
|---|---|---|
| `mesas` | `variant={theme === 'light' ? 'light' : 'dark'}` | prop |
| `downloads` | `variant={theme === 'light' ? 'light' : 'dark'}` | prop |
| `glossario` | `variant={theme === 'dark' ? 'dark' : 'light'}` | prop, condição invertida |
| `links` | `variant={theme === "dark" ? "dark" : "light"}` | prop |
| `accounts` | `variant={theme}` | prop, sem normalizar |
| **`site`** | **não passa** — `SiteHeader.astro` renderiza sem `data-variant`; o island chama `applyHeaderVariant(theme)` por JS (`SiteHeaderIsland.tsx:109`) | **efeito colateral** |

Seis escritas do mesmo contrato, incluindo uma que só existe depois da hidratação. O
default do `Header.tsx` é `variant = "light"` (linha 101).

**⚠️ E há um FOUC em produção pela mesma causa — relato do mantenedor em 2026-09-15:** "o
site sempre carrega o branco e troca para o escuro, do nada, a cada F5". Medido:

| medição | valor |
|---|---|
| script de tema no `<head>` servido | pos **2380** (antes do CSS) |
| CSS (`Base.C_mgSmoV.css`) | pos **5712** |
| o que o script aplica | só `document.documentElement.dataset.theme` |
| `--bg` do body (site) | reage ao tema: `#f6f7fa` → `#131d33` |
| `--artificio-surface` (fundo do header) | **`#ffffff`, sem redefinição em `[data-theme="dark"]`** |
| quem pinta o header escuro | **só** `data-variant="dark"` — 25 regras |
| quem aplica `data-variant` no site | `applyHeaderVariant` no island, **após `client:idle`** |

São duas causas somadas: (a) o header não reage a `data-theme`, só a `data-variant`; e
(b) no `site` o `data-variant` só chega depois da hidratação. Resultado: com tema escuro,
o corpo escurece imediatamente e o header fica branco até o JS rodar.

`applyHeaderVariant` (`theme.tsx:54-60`) ainda **remove** o atributo no tema claro
(`delete dataset.variant`), então no claro ele nunca existe no DOM — consistente com o
medido em produção.

**Escopo:** derivar `data-variant` do tema dentro do `packages/ui` (o `useTheme` já existe
lá), em vez de cada app calcular. A prop continua aceita para quem precisar forçar. **No
`site`, o atributo tem de sair no HTML SERVIDO** — o mesmo script inline que já define
`data-theme` antes do paint pode marcar o header, ou o header passa a reagir a
`[data-theme="dark"]` diretamente. Sem isso o FOUC continua, mesmo com a prop unificada.

**Entregue — e a FORMA mudou em relação ao previsto acima.**

A spec deixava duas saídas para o FOUC ("o mesmo script inline pode marcar o header,
**ou** o header passa a reagir a `[data-theme="dark"]` diretamente"). Foi a segunda, por
uma medição que só apareceu na implementação: o CSS **já tinha** um bloco
`:root[data-theme="dark"]` (`styles.css:294`) com `--fg`/`--surface`/`--line` virando por
tema desde a spec 022, e o header simplesmente não consumia nenhum deles — usava
`--artificio-surface` (`#ffffff` fixo). O tema correto já chega no `<html>` antes da
primeira pintura em todos os 6 apps; faltava só o CSS do chrome reagir.

Escolhida por ser CSS puro: resolve os 6 apps de uma vez, sem JS e sem esperar
hidratação — que era a causa. A alternativa (marcar o header pelo script inline) só
serviria ao `site` e manteria o mecanismo em JS.

**Duas portas, com precedência:**
- `:root[data-theme="dark"] .artificio-header:not([data-variant="light"])` — o tema.
- `[data-variant="dark"]` — força o chrome escuro num documento claro. A prop continua.

O `:not([data-variant="light"])` é o que deixa a prop vencer o tema nos dois sentidos.

**Correções na raiz que a implementação exigiu** (sem elas a mudança não funcionaria):
- `Header`/`Footer` emitiam `data-variant="light"` LITERAL por default. Bloqueava o
  seletor de tema nos 5 apps SPA. `variant` virou opcional de verdade — sem a prop, o
  atributo é omitido.
- O logo era escolhido em JS (`variant === "dark" ? neg : navy`). Sem `variant`, o React
  não sabe o tema antes de hidratar e o wordmark navy ficava sobre o navy. Passou a ser
  as duas `<img>` + CSS, padrão que o `site` já usava. As regras subiram para o pacote e
  a cópia do `apps/site/global.css` foi removida.
- **Bug achado e corrigido junto:** o dropdown do avatar tinha o mesmo defeito — fundo
  `--artificio-surface` fixo e texto `--artificio-ink` fixo, abrindo um retângulo branco
  sobre o navy no tema escuro. Nenhum smoke o pegava: só existe depois do clique. O
  vermelho do "Sair" (`#b3261e`, 3,4:1 sobre navy) também clareou para AA.
- `SiteHeaderIsland` não chama mais `applyHeaderVariant` — era a chamada pós-`client:idle`
  que causava o FOUC no `site`.

**Aceite — medido em 2026-09-15.**
1. ✅ `rg "variant=\{theme" apps` → **0** (a única ocorrência é dentro de um comentário).
2. ⚠️ **Prejudicado, e de propósito.** Pedia `data-variant` no HTML servido do `site`.
   Com a solução por CSS o atributo deixou de ser o mecanismo: o header escurece por
   `data-theme`, que o script inline do `Base.astro` já escreve antes do CSS carregar
   (medido antes: script na pos. 2380, CSS na 5712). Exigir o atributo agora seria
   travar a implementação antiga. O que substitui este aceite é o item 5.
3. ✅ Guard novo em `styles.contract.test.ts` varre **todas** as regras `data-variant` e
   reprova qualquer uma sem par por tema — mais forte que conferir as 25 à mão.
4. ✅ **2.404 testes verdes**, `tsc` 0 e `eslint` 0 nos 6: `ui` 108 · `site` 190 ·
   `mesas` 1152 · `accounts` 602 · `downloads` 315 · `glossario` 37. (`links` não tem
   suíte — o script `test` é um `echo`.) O warning de `react-hooks/exhaustive-deps` no
   `mesas` é preexistente: o arquivo não está no diff e sua última mudança é `463dc65`.
5. ⬜ **Smoke visual pendente — exige o mantenedor.** F5 com tema escuro nos 6 apps: o
   header tem de nascer escuro, sem piscar branco. É o que prova a correção do FOUC, e
   nenhum guard alcança.

### [ ] T7.5 — Subnav de módulo com diferenciação visual

Hoje o CSS é um só (`styles.css:597`: `border-top` + fonte 13px) e não distingue navegação
COMPARTILHADA de opção DAQUELE módulo. Dar tratamento próprio à `moduleNav`, no desktop e
dentro do painel público.

**Aceite.**
1. `.artificio-subnav` tem tratamento visual distinto do nav de módulos (não só tamanho de
   fonte), verificável no `styles.contract.test.ts`.
2. Dentro do painel público, o bloco do módulo tem rótulo próprio.
3. `mesas` (único consumidor de `moduleNav` hoje) sem regressão: suíte verde.

### [ ] T7.6 — Busca uniforme: lupa navega para a busca do módulo

**Estado medido (2026-09-15):** `mesas` e `glossario` já usam lupa (`onSearch`); o `site`
usa lupa própria na ilha; o `downloads` é o único com campo embutido.

- **`downloads`:** ganha rota `/busca` que **redireciona** para `/catalogo` preservando
  `?q=`. **Não criar página própria:** `CatalogoPage.tsx:49` tem `useCanonicalUrl('/')`
  deliberado, e uma URL nova diluiria o sinal de indexação. O campo embutido continua no
  desktop.

  **⚠️ Mecanismo diferente do `mesas` — medido, corrigindo a primeira versão desta task.**
  O `mesas` usa React Router em framework mode com `loader` (`routes/redirect.tsx` →
  `replace()`); o `downloads` usa `<BrowserRouter>` + `<Routes>` clássico, onde `loader`
  não existe. Ali a forma é `<Route path="/busca" element={<Navigate to="/catalogo"
  replace />} />`, padrão que o próprio app já usa em `App.tsx:91`. O `replace` é o que
  importa nos dois casos: sem ele, o Voltar cai em `/busca` e redireciona de novo (achado
  do Codex na #319).
- **`site`:** ganha busca explícita na home, que hoje não tem.

**Aceite.**
1. Os 4 apps: lupa no header em ≤860px leva à busca do próprio módulo.
2. `downloads`: `/busca?q=x` resolve em `/catalogo?q=x` com `replace` (o Voltar não
   cai em loop — achado do Codex na #319).
3. `downloads`: canonical de `/catalogo` continua `/`; **nenhuma URL nova no sitemap**.
4. `site`: busca alcançável a partir da home.

### [ ] T7.7 — `/busca/` do `site` sai do índice

**Achado preexistente, em produção** (medido em T3.5e): a página não tem `robots` nem
`X-Robots-Tag`, e **está no `sitemap-0.xml`**. Doc do Google: página de busca interna deve
levar `noindex`.

**Aceite.**
1. `curl -s https://artificiorpg.com/busca/ | grep -c 'noindex'` → ≥ 1 (via prop
   `noindex` do `Base.astro`, mesmo padrão do `404.astro`).
2. `curl -s …/sitemap-0.xml | grep -c '/busca/'` → **0** (via `filter` do
   `@astrojs/sitemap`, hoje não usado).
3. Nenhuma outra URL sai do sitemap: contagem de `<loc>` cai em exatamente 1.

---

**Estado (2026-09-15):** T7.4 e T7.1 FEITAS e entregues na **PR #323**
(`feat/102-f7-header-mobile-unificado`, commit `f15346f`, base `dev`). Faltam o smoke
visual das duas e as 5 tasks restantes.

**T7.3 tem um débito herdado de T7.1:** o hambúrguer de sessão está escondido em ≤860px
(`.artificio-menu-toggle { display: none }` no `@media`) porque duplicava o público. T7.3
o reativa e troca o `onClick` — ver o desvio registrado em T7.1.

**⚠️ Branch nova desta fase: conferir o upstream antes do `push`.** `git switch -c <nome>
origin/dev` deixa o upstream apontando para **`origin/dev`**, não para a branch nova.
`git push` sem argumento tenta então empurrar para `dev`, que só aceita merge de PR.
Medido na entrega de T7.1: `git rev-parse --abbrev-ref @{u}` devolveu `origin/dev` numa
branch recém-criada. A forma correta é `git push -u origin HEAD`, que cria a branch remota
com o nome dela e corrige o rastreamento. Vale para T7.2, T7.3, T7.5, T7.6 e T7.7.

**Ordem sugerida:** ~~**T7.4** (`data-variant` + FOUC)~~ → ~~**T7.1** (estrutura)~~ → **T7.2** e
**T7.3** (painéis) → **T7.5** (subnav) → **T7.6** (busca) → **T7.7** (noindex).

T7.4 primeiro por dois motivos: ela resolve o FOUC que o mantenedor vê a cada F5 (ganho
imediato, independente do resto), e mudar cor depois de mexer na estrutura misturaria duas
causas no mesmo smoke visual. **T7.7 pode sair a qualquer momento** — não depende de
nenhuma outra e não tem smoke visual.

**Arquivos previstos:** `packages/ui/src/Header.tsx` · `packages/ui/src/styles.css` ·
`apps/site/src/components/SiteHeaderIsland.tsx` (código próprio, mesma mudança) ·
`apps/site/src/pages/busca/index.astro` · `apps/site/astro.config.mjs` ·
`apps/downloads/frontend/src/` (rota `/busca` + header) · `apps/mesas` e `apps/glossario`
(só se `actions` precisar mudar) · guards em `styles.contract.test.ts`,
`Header.paineis.test.tsx` e `SiteHeader.estrutura.test.tsx`.

**O que NÃO está medido e exige o mantenedor:** o layout renderizado em navegador a 320,
360, 375 e 390px, nos 6 apps, logado e deslogado. Guard de CSS e de árvore prova
estrutura, não pixel.

---

## Achado lateral (fora do escopo da spec, registrado por medição)

### Raiz do `site` se declara duplicata de `/blog/` — MOVIDO PARA T3.5 (F3)

Nasceu aqui como achado lateral e foi promovido a task por determinação do mantenedor
(2026-09-14): *"É DA SPEC, E SERÁ RESOLVIDO ANTES DO DEPLOY"*. O registro completo —
medição, formas que não funcionam, correção proposta e aceite — vive em **T3.5**, na
fase F3 (`site`: canonical legado). Não duplicar aqui.

---

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

## Débito registrado (a mando do mantenedor, 2026-09-12)

### DEB-102-1 — `routes/og.ts` fica órfão depois de T4.2

**O que é.** Com o SSR, o `@og_proxy` do `nginx.conf` morre e **nenhum caminho de
produção chama `/og/*`**. `og.ts` (montado em `/og`, `backend/src/server.ts:159`)
continua no código, compilado e testado, sem tráfego.

**Medição que sustenta** (2026-09-12): `grep -rn "/og/" apps packages scripts
.github` → 7 ocorrências, zero chamadores de produção (única real:
`nginx.conf:137`; resto é teste, `console.error` e geração de OpenAPI). O cron
não toca: `og:worker`/`og:cleanup` são cache de metadata de **link externo**.

**Por que não foi removido agora.** Decisão do mantenedor. F1/F2 **desta mesma
spec** acabaram de corrigi-lo (`404`/`410`, canonical, 14 casos em
`og.seo.test.ts`); jogar fora esse trabalho na mesma spec que o produziu é
escopo que ele não pediu.

**O que arrasta junto, se um dia sair:** `INDEX_HTML_PATH` (`og.ts:17`), os
volumes `frontend_dist_prod`/`frontend_dist_beta`, `og.seo.test.ts`, e as
entradas de `/og/` em `scripts/api/{generate-openapi,inventory}.ts`.

**Risco de deixar:** baixo e contido. Código morto que responde só a quem chamar
`/og/` diretamente. **Não é bug**: o comportamento dele está correto, apenas sem
consumidor.

**Estado do volume depois de T4.2 item 2 (aplicado em 2026-09-12).** O volume
`frontend_dist_*` **saiu do `mesas-app`** (quem o populava, via `cp` do nginx) e
**continua montado no `mesas-api`** (`prod:105`, `beta:95`). Fica vazio: nada
mais escreve nele. Correção do que este bloco registrava — ele não "sai em T4.2"
por completo, e desmontá-lo do `mesas-api` seria pior, porque `og.ts` voltaria a
quebrar no dia em que alguém religasse a rota.

O backend **sobe normalmente** com o volume vazio: `og.ts:29` lê o `index.html`
dentro de `loadIndexHtml()`, por request, não no boot (medido). A consequência é
a já aceita — `/og/*` responde erro em vez de HTML, e ninguém chama.

---

## Entrega de F1+F3+F4 — estado real das PRs

> ## ⛔ NADA DESTE TRABALHO PODE SER PERDIDO
>
> São horas de trabalho do mantenedor. **Antes de qualquer `git` que descarte estado**
> — `reset --hard`, `checkout -f`, `clean`, `stash drop`, `branch -D`, `push --force`,
> fechar ou deletar branch remota — **parar e perguntar**. Não existe caso nesta spec
> em que descartar seja a saída óbvia.
>
> **Onde o trabalho vive, medido em 2026-09-12:**
>
> | conteúdo | onde está | como recuperar |
> |---|---|---|
> | **os 133 arquivos completos** (F1+F3+F4) | commit **`4bb3108`**, branch `fix/102-f3-canonical-lastmod`, **PR #316 aberta no GitHub** | `git checkout 4bb3108 -- <caminho>` |
> | imports + canonical/lastmod | commits `7ed7782` e `58305fb`, branch `chore/102-imports-react-router`, **PR #317**, pushada | já no remoto |
> | duplicata do canonical/lastmod | branch `fix/102-f3-site-canonical-lastmod`, **PR #318** | já no remoto |
>
> **Nada está em `git stash`.** A divisão foi feita COPIANDO do `4bb3108`
> (`git checkout <commit> -- <arquivos>`), nunca movendo: o commit original está
> intacto e no remoto. `origin/dev` segue em `bcfe722`, intocado.
>
> Arquivo que "não existe nesta branch" (`server.js`, `entry.client.tsx`,
> `src/routes/*`, `contactUrls.ts`) **não sumiu** — está no `4bb3108`, aguardando a
> PR 3. Nunca concluir perda a partir de um `ls` numa branch parcial.

**A #317 e a #319 mergearam. `origin/dev` está em `a7ea7e1`** (merge da #319,
2026-09-13). A trava que impedia fechar a #316 — "não fechar até a PR 3 existir e
conter tudo" — **está cumprida e medida**: `git diff origin/dev 4bb3108
--name-status` devolve 44 arquivos e **nenhum deles é conteúdo que falte em `dev`**.
São 9 `D` (arquivos que existem em `dev` e não no `4bb3108`: `formatDate.ts`,
`redirect.test.ts`, `contactUrls.test.ts`, `hidratacao.test.tsx`, `sanitizeServer.ts`
e testes) e 35 `M` em que a versão do `4bb3108` é a **anterior** às correções.

| PR | estado | conteúdo | arquivos |
|---|---|---|---|
| **#319** | **MERGED** (`a7ea7e1`) | a PR 3: `catalog-table` + SSR do `mesas` + 7 commits de review | 88 |
| **#317** | **MERGED** (`49ac4b1`) | imports + canonical/`lastmod` + DOMPurify/segurança | 69 |
| #318 | aberta, **sem conteúdo próprio** | `comm -23` contra a #317 devolve vazio | 14 |
| #316 | aberta, **já pode fechar** | o monólito; `4bb3108` está contido em `dev` | 133 |

**O plano de 3 PRs deixou de existir na prática (2026-09-13).** Era: (1) imports,
(2) canonical/`lastmod`, (3) SSR. O mantenedor pediu que o conteúdo da #318 fosse
para a #317 por `cherry-pick`, e o agente executou **sem avisar que isso desmontava
a separação que ele mesmo propusera** — o mantenedor só descobriu ao pedir "prepare a
PR 2" e não haver PR 2. Medido: os 9 arquivos de `apps/site` + `packages/content`
estão dentro da #317, e a #318 não tem um arquivo sequer que a #317 não tenha.

A separação existia por causa do teto de 100 arquivos do CodeRabbit, e a #317 cumpre
esse objetivo com 62. **Resta uma PR, não duas:** a PR 3 (`catalog-table` + migração
SSR do `mesas`), com **71 arquivos** depois de descontar o que já está na #317.

**Provado, não afirmado** (2026-09-12): `comm -23` entre as listas de arquivos das
branches da #318 e da #317 devolveu **vazio** — não existe um arquivo sequer na #318
fora da #317. Fechá-la não perde nada. E `origin/dev` continua em `bcfe722`, o mesmo
commit do início da sessão: **nada disto chegou perto de `dev`**.

Commits da #317, na branch `chore/102-imports-react-router`:

| commit | o quê |
|---|---|
| `7ed7782` | import unificado `react-router` (39 arquivos) + `package.json`/override/`eslint.config.js` que o build exigiu + este registro |
| `58305fb` | canonical do site + `lastmod` no sitemap (14 arquivos), vindo da #318 por `cherry-pick` |
| `57270d0` | DOMPurify de volta no rich text (3 camadas), credencial barrada no canonical, override `qs@6.16.0`, hook de registro trazido do `4bb3108`, `AGENTS.md` enxugado (13 arquivos). **Quebrou o build de todos os frontends e introduziu 10 CVEs — corrigido pelo commit seguinte, não usar como referência** |
| `5c8c3e5` | overrides de `undici` nas duas majors e os 2 achados do Codex (comentário do `ContentEditor.tsx`, 2 testes do hook que passavam por acidente). **A tentativa de tirar o `jsdom` do bundle por `createRequire` NÃO funcionou — levou de 4 para 7 checks vermelhos** |
| `892c22d` | separação por entrada: `sanitizeServer.ts` server-only com DOMPurify+JSDOM, `sanitize.ts` puro. É o commit que de fato fecha o problema — `pnpm build` 26/26 e `pnpm lint` 26/26 rodados antes de pushar (9 arquivos) |
| `db59da8` | `colher.sh`: contador `RECUSAS` separado de `FALHAS` (recusa de review não é consulta que falhou), e registro do falso-positivo do Sonar e dos 2 achados recusados (2 arquivos) |

Commits da PR **#319**, na branch `feat/102-f4-mesas-ssr` (criada de `origin/dev`
`49ac4b1`, o merge da #317):

| commit | o quê |
|---|---|
| `b7a03ed` | a migração SSR: `catalog-table`, 24 rotas, entrypoints, `server.js`, Dockerfile, composes na porta 3000, e as 4 deleções (`index.html`, `nginx.conf`, `App.tsx`, `main.tsx`) — 83 arquivos. **NÃO levou as 4 correções do Sonar**: foram editadas depois do `git add` e ficaram de fora |
| `b75a224` | as 4 correções do Sonar que faltaram (`RegExp.exec`, `String.raw`, `export…from` nas 3 rotas, optional chain). Quem pegou o buraco foi o `pre-push`, não o commit |
| `1b666d7` | 7 achados dos dois ciclos de review, 5 deles bugs invisíveis em log (ver blocos acima) + os overrides de `qs`/`undici` restaurados — 13 arquivos |
| `abd773c` | 3 achados do terceiro ciclo (dev local quebrado, preço zero em mesa paga, data sem fuso no SSR) + a linha do `.react-router/` que faltava no `.gitignore` — 11 arquivos |
| `57abff8` | 4 achados do quarto e quinto ciclos, **2 deles em `packages/ui`** (snapshot de tema e badge do changelog, ambos divergindo na hidratação), o `replace()` nos 6 aliases e o DDD 55 no WhatsApp — 8 arquivos |
| `3d6ff5c` | `description` estourando 160 com cauda longa, `Product` sem propriedade qualificadora (correção de uma correção do `abd773c`) e o smoke de ingress morto por `ENOENT` desde `b7a03ed` + a reescrita desta seção (−207/+109) — 4 arquivos |
| `32da301` | o `null` que o `3d6ff5c` introduziu em `buildTableJsonLd` quebrou o `typecheck` do CI (13 × `TS18047`, run `34776296657`): helper do teste devolvia `null` sem ninguém estreitar. Passou local porque `vitest` não checa tipo — 2 arquivos |

**Validação medida antes de cada commit:** `mesas/frontend` 1148/1148 (86 arquivos),
`site` 155/155, `content` 22/22, `content-editor` 120/120, `tsc` limpo, lint 0 erros,
`verify:api` exit 0 com breaking=0 nos 6 apps.

### Por que a divisão existiu

A #316 reunia F1+F3+F4 em 133 arquivos e foi recusada:
`SUCCESS - Review skipped: 123 files exceed the limit of 100`. Os `path_filters` do
`.coderabbit.yaml` já descontam 10 (`.md`, `.claude/`, `docs/api/`), por isso 123 e
não 133 — ampliar esses filtros para caber no teto seria enganar a contagem, **não é
caminho**.

### Três erros de execução medidos — não repetir

**1. Abrir duas PRs em sequência queima a janela do CodeRabbit.** Medido: a #317 saiu
`Review completed`, a #318 caiu em `SUCCESS - Review rate limited`, com
`Next included review available in 55 minutes`. **Abrir UMA PR por vez e esperar a
review sair** antes da seguinte. Foi o erro que custou uma review inteira e o tempo
do mantenedor.

**2. A conta roda na cota open-source, não no plano da organização.** O próprio bot
disse: *"This review ran on the open-source allowance, not this organization's plan,
because the pull request author doesn't have an assigned seat. Waiting won't change
this"*. É isso que aperta o teto. A saída é atribuir um seat no painel do CodeRabbit
— **ação do mantenedor**, fora do alcance do agente. Esperar não resolve.

**3. Estar no lockfile NÃO é estar resolvível.** O plano dizia que a troca de import
compilava sozinha porque `react-router@7.18.0` estava no lock de `dev`. Falso: o pnpm
isola por workspace e `node_modules/react-router` **não existia** no `mesas` — `tsc`
acusou `Cannot find module 'react-router'` em 33 arquivos. Foi preciso declarar a
dependência no `package.json` e o override `react-router@<7.18.3` no
`pnpm-workspace.yaml`, senão `@artificio/analytics` arrasta a 7.18.0 pela transitiva.

**4. O corte por "uma linha de diff" parte o grafo de contexto do Router.**
`useUrlState.ts`, `App.tsx`, `CatalogoPage`, `MesaPage` e `MestrePage` têm diff maior
que uma linha e ficaram de fora, mas o teste de `useCatalogFilters` já criava o router
por `react-router`: duas instâncias, e `useLocation() may be used only in the context
of a <Router> component` em 2 testes. **Ou todo o app importa do mesmo pacote, ou
nenhum** — não há corte parcial. Por isso 39 arquivos, não 33.

### CHECKLIST DA PR 3 — EXECUTADO E MERGEADO (`a7ea7e1`)

**Os 7 itens abaixo estão cumpridos. Nada aqui é trabalho pendente.** O registro
permanece porque as armadilhas que ele mede continuam valendo para quem tocar estes
caminhos — não porque falte executá-las.

**A medição que responde "falta algo do monólito em `dev`?" em uma linha:**

```
git diff origin/dev 4bb3108 --diff-filter=A --name-status   # devolve 0
```

`A` lista o que existe no `4bb3108` e **não** existe em `dev`. Zero. Conferido também
por presença direta (`git cat-file -e origin/dev:<arquivo>`) nos 10 arquivos mais
caros da migração — `server.js`, `entry.server.tsx`, `entry.client.tsx`, `routes.ts`,
`tableMeta.ts`, `contactUrls.ts`, `tableViewMapper.ts`, `sanitizeServer.ts`,
`formatDate.ts` — todos presentes, mais **25** arquivos em `src/routes/` e **15** em
`packages/catalog-table/`.

**Use SEMPRE o `--diff-filter=A`, e não o diff cru, para responder essa pergunta.** O
diff sem filtro devolve 44 e já foi lido ao contrário duas vezes: ele mostra 35 `M`
que são o `4bb3108` desatualizado, não `dev` incompleta.

**NÃO EXISTE PR 4, e trazer o `4bb3108` para uma branch nova é DESTRUTIVO.** Medido
em 2026-09-13, depois do merge: `git diff origin/dev 4bb3108 --name-status` = 44
arquivos, **todos na direção errada** — o monólito é anterior a tudo que entrou pelas
#317/#319. Trazê-los reverteria em silêncio os 3 overrides de CVE
(`qs` 6.16.0 → 6.15.2, `undici` 7.29.1 → 7.29.0 e 8.10.2 → 8.10.0, uma **CVSS 9.1**)
e as 13 correções de review: `tableMeta.ts` sem o limite de 160 e sem o `null`,
`contactUrls.ts` com o bug do DDD 55, `theme.tsx` com snapshot `light`, o smoke de
ingress lendo o `nginx.conf` já removido, `AGENTS.md` de volta a 10.076 palavras.
É a própria armadilha descrita logo abaixo, agora com a direção confirmada por
medição em vez de prevista.

**PR 3 — branch `feat/102-f4-mesas-ssr`, criada de `origin/dev` (`49ac4b1`, merge da
#317) em 2026-09-13: 88 arquivos, 80 contra o teto.**

Composição: 24 em `src/routes/`, 14 no `catalog-table`, 9 na raiz do frontend
(`Dockerfile`, `server.js`, `vite.config`, `react-router.config`), 14 em
`pages`/`hooks`/`features`/`utils`/`services`/`components`, 4 de entrypoint, 3 de infra
(`docker-compose` prod+beta, `backend/src/server.ts`), 4 deleções da migração
(`index.html`, `nginx.conf`, `App.tsx`, `main.tsx`), 4 renames de teste para o
`catalog-table`, e 12 de resto.

**ARMADILHA QUE FALHA EM SILÊNCIO — o `4bb3108` é ANTERIOR ao trabalho de segurança
da #317.** Trazer o diff inteiro contra `dev` **reverteria**, sem erro nenhum, tudo o
que entrou depois: os arquivos simplesmente voltam à versão velha.

São **18 arquivos**, em três grupos, e cada grupo foi descoberto DEPOIS do anterior —
o terceiro só apareceu quando o Snyk reclamou na PR já aberta:

| grupo | arquivos | prova medida |
|---|---|---|
| `packages/content` + `content-editor` | 9 | `sanitizeServer.ts` **não existe** no `4bb3108`; `canonical.ts` de lá tem 0 ocorrências de "credencial embutida" |
| governança | 7 — `AGENTS.md`, `.gitignore`, os 2 do hook `registro-anti-compactacao`, `ciclo-de-review/{SKILL.md,colher.sh}` | `AGENTS.md` tinha **10.076 palavras** contra **6.781** em `dev`; o hook voltava ao limiar 4; o `colher.sh` perdia `RECUSAS` |
| **resolução de dependência** | 2 — `pnpm-workspace.yaml`, `pnpm-lock.yaml` | **reverteu 3 overrides de CVE**: `qs` 6.16.0 → **6.15.2** (2 CVEs), `undici` 7.29.1 → **7.29.0** e 8.10.2 → **8.10.0** (10 CVEs, uma **CVSS 9.1 crítica** de validação de certificado) |

**Conferir "arquivo por arquivo" NÃO basta — foi o que falhou.** O grupo 3 passou
mesmo depois de o grupo 2 ter sido pego, porque a conferência foi por lista nomeada e
o lock não estava na lista. O certo é `git diff --cached origin/dev --stat` e olhar
**tudo** que difere, sem lista prévia.

**E o lock de `dev` não serve puro:** ele não conhece pacote novo criado na branch
(`packages/catalog-table` → 0 ocorrências). Restaurar de `dev` e **regenerar** com
`pnpm install --lockfile-only`, conferindo depois que os overrides sobreviveram
(`grep -nE "^  (qs|undici)@"`) e que `@babel/core` continua com as entradas base
(canário do E021).

**E `git add` de novo depois de editar arquivo já staged.** Medido nesta PR: as 4
correções do Sonar foram escritas DEPOIS do `git add`, e o commit `b7a03ed` levou a
versão anterior a elas. Quem pegou foi o `pre-push` (`verify:api` acusou arquivos
versionados alterados e recusou o push), não o commit — que saiu verde.

Duas outras armadilhas medidas ao montar a lista:

- `git diff origin/dev...4bb3108` (três pontos) devolve **133**; o número real é o de
  **dois pontos** (`origin/dev 4bb3108`), que compara conteúdo e devolve 98. Três
  pontos lista tudo desde o ancestral comum, inclusive o que já entrou por outra PR.
- `git checkout <sha> -- <lista>` **aborta o lote inteiro** se qualquer caminho for
  deleção ou origem de rename. Separar: `awk '$1=="D"{next} $1 ~ /^R/{print $3} ...'`
  para os que existem, `git rm` para as 4 deleções da migração e para as 4 origens dos
  renames que vieram de `dev`.

**Nada aqui é opcional e nada se descobre sozinho.** Cada item abaixo foi medido
nesta spec; quem criar a PR 3 executa a lista, não a redescobre. A ordem importa:
os itens 1 e 2 são os que fazem a PR builda/subir, o 3 é o que impede o Sonar de
reencontrar os mesmos achados e queimar outra janela de review.

- [x] **1. Criar a branch de `origin/dev` JÁ COM A #317 MERGEADA.** Trazer os
      arquivos com `git checkout 4bb3108 -- <caminhos>` (nunca mover: o `4bb3108` é
      a fonte e fica intacto).
- [x] **2. `apps/mesas/frontend/src/utils/sanitize.ts` — BUG LATENTE, quebra o SSR.**
      Importa `dompurify` **puro** (L1) e é consumido por `useProfileQuery.ts` em 4
      pontos (L43, L89, L128, L196). No servidor: `sanitize is not a function` →
      `500` no perfil. **Nenhum bot apontou isto**; sem tratar, a PR 3 troca um `500`
      por outro. A correção depende da decisão do item 3 (mesmo sanitizador).
- [x] **3. Fechar a decisão do DOMPurify** (§"Estudo do caminho de sanitização").
      Recomendação do agente: **opção (a)**, manter DOMPurify e corrigir a
      inicialização no SSR. Se (a) for escolhida, junto vem:
      `test -d packages/*/node_modules/jsdom` no Dockerfile do app que passar a
      depender de `isomorphic-dompurify` — dependência de 2º nível podada por
      `pnpm install --prod --filter` é o que derrubou o SSO por 5h (E016/E017).
- [x] **4. Reparar os 11 achados do Sonar** da tabela "Ficam para a PR 3" (abaixo),
      **antes de pedir review**. São arquivos que só existem no `4bb3108`:
      `server.js`, `MesaPage.tsx`, `entry.client.tsx`, `root.tsx`, as 3 rotas,
      `Dockerfile` (2x), `tableMeta.ts`, `contactUrls.ts`.
- [x] **5. Conferir que o hook de registro veio junto:**
      `grep -c registro-anti-compactacao .claude/settings.json` deve devolver **1**,
      e `.claude/hooks/registro-anti-compactacao.js` deve existir. Eles viveram
      apenas no `4bb3108` até 2026-09-12 (ver §Registro anti-compactação).
- [x] **6. Conferir o override `qs@<6.16.0`** no `pnpm-workspace.yaml` (entrou pela
      #317; se a base mudar, confirmar que sobreviveu ao merge).
- [x] **7. Validar antes de pushar:** `mesas/frontend` (suíte + `tsc -b` + build
      SSR), `catalog-table`, `verify:api`. Conferir a contagem de arquivos contra o
      teto de 100 ANTES de abrir (`git diff --name-only origin/dev...HEAD | grep -cvE '\.md$|^\.claude/'`).
- [ ] **8. Abrir UMA PR e esperar a review sair** antes de qualquer outra. Abrir duas
      em sequência queima a janela do CodeRabbit — medido nesta spec: a segunda saiu
      `rate limited`, `Next included review available in 55 minutes`.

**Onde a divisão PARA.** Se 76 ainda for demais, o próximo corte dentro do `mesas` é
ruim: `src/routes/` (24 arquivos novos) não builda sem `routes.ts`, `root.tsx` e
`entry.server.tsx`, que **são** a migração. **PR que não builda não é revisável** —
perde-se a review de novo, por outro motivo. Nesse caso a decisão do corte é do
mantenedor, não do agente.

### Achados de review em aberto — onde cada um entra

Sonar e Snyk rodaram sobre o commit `4bb3108` (o monólito da #316), então a lista
cobre arquivos das DUAS entregas. O que decide o destino é **em qual branch o arquivo
existe hoje**, não onde o bot o encontrou.

**Achados do Codex na #317 (2026-09-12) — 2 corrigidos, 1 é decisão do mantenedor:**

| achado | destino |
|---|---|
| **P2 — `sanitize.ts`: links relativos e `mailto:` apagados.** `RENDERED_MARKDOWN_OPTIONS` reusava o `transformTags.a` do sanitizador LEGADO, que exige HTTPS **absoluto** (`isHttpsUrl`): `[b](/rota)` virava âncora sem `href` e `mailto:` sumia, apesar de os dois estarem em `allowedSchemes`. O legado trata comentário importado do WordPress, onde só há link externo; este caminho é o markdown de TODOS os apps, onde link interno é a norma (`commentLinks.test.ts:108-113` e `:169` definem root-relative como válido) | **CORRIGIDO** — `classificarHrefRenderizado` próprio: HTTPS e `mailto:` como externos (com `rel`/`target`), root-relative como interno (sem `target`, que arrancaria o leitor da SPA), e descarte de `http:`, protocol-relative (inclusive `/\` e `/%2f`) e relativo sem barra. Coberto por 11 casos novos, idempotência inclusa |
| **P2 — `colher.sh` contradizia a própria `SKILL.md`.** A mensagem de recusa por tamanho mandava comentar `@coderabbitai review` "para forçar a review ignorando o limite"; a `SKILL.md`, no mesmo commit, registra o oposto — recomentar não adianta, só gasta a janela | **CORRIGIDO** — a saída agora diz "Recomentar NAO resolve" e aponta reduzir a PR ou trocar a base. **Bug meu, introduzido nesta sessão**: escrevi a orientação certa na skill e a errada no script |
| **P1 — `ContentEditor.tsx`: DOMPurify removido do caminho de rich text.** O `AGENTS.md` é literal: *"HTML de conteúdo de usuário/rich-text é hostil: sanitizar sempre (DOMPurify)"*. A troca por `sanitize-html` foi necessária porque o DOMPurify quebra no SSR (`DOMPurify.sanitize is not a function`, `500` em `/mesas/<slug>`) | **PENDENTE — decisão do mantenedor.** Estudo do código feito (abaixo); **recomendação: opção (a), manter DOMPurify.** Não escolher sozinho |

#### Estudo do caminho de sanitização (2026-09-12) — a recomendação MUDOU

A primeira recomendação do agente foi **(b)**: manter `sanitize-html` e alterar a
linha do `AGENTS.md`. **Medido como errado.** O que o código mostra:

**1. Três lugares declaram que a última defesa do conteúdo legado é EXATAMENTE o
DOMPurify que foi removido.** O comentário importado do WordPress **entra sem
sanitização na escrita** — decisão registrada, para não arrastar `content-editor`
para a imagem do `accounts` (E016/E017, SSO fora 5h) — e é sanitizado **só no
render**:

- `apps/accounts/src/communityCommentRead.ts:77` — *"essa defesa é o
  `DOMPurify.sanitize()` com que `renderMarkdown` termina"*
- `packages/comments/src/conversation.ts:166` — *"a 'defesa adicional na saída sem
  regravar' que `spec.md:444` exige é o `DOMPurify.sanitize()` de `renderMarkdown`"*
- `packages/ui/src/GmReviewPanel.test.tsx:5` — *"este componente exige DOM em
  runtime"* (sob ambiente `node`: `default.sanitize is not a function`)

Trocar o sanitizador ali não é mudar implementação: é trocar a **única** defesa de um
acervo inteiro, em três apps, por uma que nunca foi auditada para esse conteúdo.

**2. O repo já resolveu este mesmo problema, e o precedente é o oposto de (b).**
`apps/downloads/backend/src/services/sanitizeRichHtml.ts` roda em backend puro e usa
`isomorphic-dompurify` — adotado por achado P2 do Codex na PR #203, cobrando esta
mesma política. E precisou de hook próprio: *"`ALLOWED_URI_REGEXP` do DOMPurify não
cobre `img[src]` neste build — `data:image/...` sobrevive à sanitização"*. Essa
fronteira já custou uma rodada de descoberta de vetor real; a `sanitize-html` posta no
lugar nunca passou por isso.

**3. Aceitar (b) seria transformar erro de execução em mudança de política.** O
DOMPurify foi removido por um problema de **inicialização** no SSR, e a proposta era
reescrever a regra do repo para caber na solução — caminho feliz, nomeado assim pelo
mantenedor.

**Custo real de (a), medido no lock:** `isomorphic-dompurify@3.22.0` arrasta
**`jsdom@30.0.1`**. Peso em imagem de produção, e o `Dockerfile` do `accounts`
(L52-103) mostra que dependência de segundo nível podada por
`pnpm install --prod --filter` é precisamente o que derrubou o SSO por 5h. Então (a)
exige um `test -d packages/*/node_modules/jsdom` novo no Dockerfile — custo conhecido,
com procedimento escrito, não risco de segurança.

#### RESOLVIDO (2026-09-13): DOMPurify de volta, em cadeia de TRÊS passagens

Forma 3, escolhida pelo mantenedor: `DOMPurify(new JSDOM('').window)`, sem pacote
novo e sem adotar o `isomorphic-dompurify` depreciado. `purify` é criado UMA vez no
módulo: `new JSDOM()` por chamada custa caro num caminho que roda a cada render.

**NENHUM truque de import resolve — a separação tem de ser de ENTRADA. Três formas
medidas, três falhas (2026-09-13, PR #317):**

| forma | sintoma |
|---|---|
| `import { JSDOM } from 'jsdom'` + `jsdom` em `dependencies` | `Cannot find module '../data/patch.json'` em TODOS os frontends (cadeia `app → @artificio/ui → content-editor → jsdom → css-tree`, que carrega o JSON por require relativo). 4 checks vermelhos |
| `createRequire(import.meta.url)` | `TS1343` — `import.meta` não existe sob `module: CommonJS`, e `sanitize.ts` entra no build CJS (`tsconfig.cjs.json`) que `accounts` e `downloads` consomem. Build do PACOTE quebra, e com ele **7** checks |
| `createRequire(process.cwd())` com `import { createRequire } from 'node:module'` | `"createRequire" is not exported by "__vite-browser-external"` — o bundler externaliza `node:module` e o símbolo vira `undefined`. Trocar um import Node por outro não muda nada |

**A raiz:** `packages/ui/src/GmReviewPanel.tsx:2` importa `content-editor` no topo, e
`ui` é consumido por todos os frontends. Qualquer referência a módulo Node nesse
arquivo entra no grafo de browser, seja ela `import`, `createRequire` ou `eval`.

**RESOLVIDO com separação por entrada**, que é o que o Codex apontou no achado P2 e
foi ignorado por três tentativas de import:

- `sanitize.ts` voltou a ser puro — só `sanitize-html`, string-based, roda nos dois
  lados. É o que `ContentEditor.tsx` (e portanto `packages/ui` e todos os frontends)
  importa.
- `sanitizeServer.ts` é novo e **server-only**: carrega DOMPurify + JSDOM e exporta
  `sanitizeRenderedMarkdownServer`. Entra em `exports` como `./sanitize-server` e no
  `tsconfig.cjs.json` (backend consome por `require`). **NÃO** é reexportado por
  `index.ts` nem por `sanitize.ts` — é essa ausência que tira o `jsdom` do bundle.

Os dois testes das camadas DOMPurify passaram a chamar
`sanitizeRenderedMarkdownServer`: contra `sanitizeRenderedMarkdown` eles passariam
pelo motivo errado (a política sozinha já remove `onerror`) e o nome mentiria sobre o
que provam — mesmo defeito que o Codex pegou nos testes do hook.

Validação com os comandos que o CI roda: `pnpm build` **26/26**, `pnpm lint` **26/26
com 0 erros**, `content-editor` 132/132 e build ESM+CJS limpos.

**Erro de método que produziu as três voltas:** validar com `test` e `typecheck` em
vez de `build`. O `typecheck` usa `tsconfig.json`; o `build` usa
`tsconfig.build.json` + `tsconfig.cjs.json`, e só ele reproduz o CI. Rodar `build` do
pacote E dos apps consumidores antes de pushar.

Os três checks de build da #317 caíram por esta única causa — `lint + build + test`,
`CI links` e `CI site`, todos com `Cannot find module '../data/patch.json'`.

**O quarto vermelho, `security/snyk`, era a mesma raiz com dano maior: 10 CVEs de
`undici`**, todas `Introduced through @artificio/content-editor` — o `jsdom` em
`dependencies` arrastava `undici` para os frontends. A pior é `CVE-2026-84961`
(CWE-295, **CVSS 9.1 crítica**), validação imprópria de certificado; junto vêm
smuggling de request, cookie persistente com dado sensível e três de exceção não
capturada.

**BUG LATENTE ACHADO NO CAMINHO, independente do erro acima:** o override
`undici@<7.28.0` que já existia trava numa versão **anterior** à correção das 10 CVEs,
e `apps/downloads/backend` declara `undici@^8.10.0` **direto** — faixa que o teto `<8`
daquele override nem alcança. Ou seja, as 10 CVEs estavam abertas no `downloads`
**antes** desta spec, e o override dava impressão de cobertura. Corrigido com DUAS
entradas, porque uma não cobre as duas majors: `undici@<7.29.1` e
`undici@>=8.0.0 <8.10.2`. Mesmo padrão do `nanoid@<3.3.17` da mesma lista.

**Armadilha de diagnóstico, medida:** `pnpm --filter <pacote> test` e o build dos
PACOTES passam — o defeito só aparece no build dos APPS. Validar mudança em
`packages/*` rodando só a suíte do pacote é o erro que produziu isto; a matriz de
impacto nos consumidores (§Escopo) existe exatamente para este caso. Ao mexer em
dependência de `content-editor`, rodar `build` de `links`, `mesas-frontend`,
`downloads-frontend` e `ui` antes de pushar.

`sanitizeRenderedMarkdown` = `sanitize-html` → `DOMPurify` → `sanitize-html`. **Nenhuma
das três é redundante**, e quem remover uma reabre um defeito:

1. Política: quais tags passam, o `<input>` de task list, e o `transformTags.a` que
   decide destino de link. O DOMPurify não faz isso — não reescreve atributo por regra
   de negócio.
2. Segurança pelo DOM real: mutation XSS, namespace SVG/MathML, entidade que só vira
   tag depois do parse. É o que o `AGENTS.md` exige para rich text.
3. Serialização: o DOMPurify normaliza `<br />` → `<br>` e `disabled` → `disabled=""`,
   e essa forma foi escolhida para a hidratação (`ContentEditor.test.tsx:274`). HTML do
   servidor diferente do cliente faz o React **descartar o do servidor** — o conteúdo
   que o crawler lê. A terceira passagem só re-serializa árvore já limpa.

**ARMADILHA MEDIDA — `ALLOWED_URI_REGEXP` estraga atributo que não é URI.** O
DOMPurify aplica esse regex a todo atributo que considera URI-like, não só ao `href`:
com ele, `target="_blank"` e `type="checkbox"` reprovam e **são removidos** (sonda
direta: sem o regex os dois sobrevivem, com ele somem). Não usar — o default já aceita
`https:` e `mailto:`, e quem decide destino de link é a camada 1. Foi o que quebrou 5
testes na primeira tentativa, e o sintoma (atributo sumindo) não aponta para a causa.

`input` **não** está no `allowedTags` default da `sanitize-html`, então precisa entrar
nas duas allowlists.

Validação: `content-editor` 132/132 (2 casos novos travam as camadas 2 e 3), `content`
26/26, `tsc` limpo. XSS conferido na sonda: `onerror`, `<script>` e `svg onbegin` saem
como string vazia.

**A FORMA ÓBVIA DE (a) NÃO SERVE COMO ESTÁ — medido no lock (2026-09-12).** Copiar o
precedente do `downloads` (`isomorphic-dompurify@3.22.0`) traz um pacote que o próprio
registro marca como **`deprecated`**: *"Raised the minimum Node.js version (breaking)
without a major bump. Use 4.x for the same code with correct semver, or pin 3.19.0 for
Node < 22.22.2"*. E ele declara `engines: node ^22.22.2 || ^24.15.0 || >=26.0.0`.

Ou seja, (a) tem **três formas** e elas não são equivalentes — escolher no meio da
implementação seria decidir por conta própria:

1. `isomorphic-dompurify@3.22.0` — igual ao `downloads`, mas depreciado e com piso de
   Node que precisa bater com a imagem de produção.
2. `isomorphic-dompurify@^4` — o próprio upstream aponta como a versão com semver
   correto; diverge do que o `downloads` usa hoje (duas versões do mesmo pacote no
   monorepo, que é o defeito que `prosemirror-*` e `react-router` já custaram).
3. `DOMPurify(new JSDOM('').window)` direto, sem o wrapper — `jsdom` já é
   devDependency de `content-editor`; viraria dependência de runtime. Mais código
   próprio, menos camada de terceiro.

**Antes de implementar, medir as três** (versão de Node das imagens, o que o
`downloads` passaria a resolver, peso real) e trazer a escolha ao mantenedor. Não
decidir durante a implementação.

**BUG LATENTE que nenhum bot apontou e que a PR 3 vai disparar:**
`apps/mesas/frontend/src/utils/sanitize.ts:1` importa `dompurify` **puro** e é
consumido por `useProfileQuery.ts` em 4 pontos (L43, L89, L128, L196). Sob SSR ele
quebra pelo mesmo motivo do `renderMarkdown` — `sanitize is not a function`. **A PR 3
precisa tratar este arquivo**, senão troca um `500` por outro, agora no perfil.

**FALSO-POSITIVO do Sonar, não investigar de novo:**
`INFO | packages/content-editor/src/sanitize.ts:735 | Complete the task associated to
this "TODO" comment`. Não existe TODO no pacote — o Sonar casa a palavra **portuguesa
"TODOS"** com o marcador. Medido: 5 ocorrências em `sanitize.ts`, `sanitizeServer.ts`,
`commentLinks.test.ts` e `sanitize.test.ts`, todas em frases como "TODOS os apps" e
"TODOS os frontends". Vai reaparecer a cada colheita enquanto os comentários
estiverem em português.

**Achados do CodeRabbit RECUSADOS (2026-09-13), com o motivo medido** — registrados
para não voltarem a ser investigados:

- **`sanitize.ts:725` — acrescentar `src`/`alt`/`title` ao `ALLOWED_ATTR` do
  DOMPurify, "para preservar imagem de markdown".** Premissa falsa: `img` **não** está
  no `allowedTags` da política (`sanitize-html.defaults` não o inclui, e
  `RENDERED_MARKDOWN_OPTIONS` só acrescenta `input`), então a camada 1 descarta a
  imagem antes de o DOMPurify vê-la. Medido: `<p><img src="..." alt="gato"></p>` sai
  como `<p></p>`. Acrescentar o atributo não faria imagem nenhuma aparecer — a
  mudança teria de ser no `allowedTags`, e isso é decisão de produto (UGC com imagem
  remota), não ajuste de sanitizador.
- **`ModeracaoSection.tsx` — "rodar o build do frontend antes do merge".** Já rodado:
  `pnpm build` repo-wide 26/26, que inclui `tsc -b && vite build` do `mesas-frontend`.

**CORRIGIDO no `colher.sh` (2026-09-13):** a detecção de recusa por tamanho testava
`rc -eq 0` — status da CONSULTA, não do check. Um check `PENDING` ou `FAILURE` cuja
descrição mencionasse o limite contaria como recusa consumada, e o agente pararia de
esperar uma review que ainda podia sair. O padrão passou a ancorar `SUCCESS` no início
da linha. Validado contra os quatro casos (SUCCESS+skipped conta; PENDING, FAILURE e
SUCCESS+completed não).

**CORRIGIDOS na #317** (2026-09-12):

| arquivo | achado | natureza |
|---|---|---|
| `packages/content/src/canonical.ts:42` | `String(input)` produzia `[object Object]` para objeto, e o erro culpava o formato da URL quando o problema era o tipo. Agora não-string é rejeitado com `"canonical deve ser texto"` | **comportamento** — único da lista que não é estilo |
| `packages/content/src/canonical.test.ts:13` | 3 testes de host externo viraram `it.each`; acrescentado caso para entrada não-string | estilo + cobertura |
| `packages/content/src/canonical.ts:63` | **credencial embutida era persistida.** `https://user:senha@artificiorpg.com/x` passava: `hostname` é o domínio permitido, `isAllowedHost` aprovava, e `url.toString()` gravava a senha no canonical — campo público. Rejeição agora vem ANTES da validação de host, e cobre também `https://artificiorpg.com@evil.example/x`, onde o `@` disfarça o destino real. Divergência entre pacotes: `commentLinks.test.ts:104-105` já barrava a mesma forma no outro caminho. Achado do CodeRabbit | **bug latente, falhava em silêncio** |
| `pnpm-workspace.yaml` | override `qs@<6.16.0` — os 2 CVE do Snyk (ver abaixo) | segurança |

**Sem validação rodada**: o mantenedor determinou não gastar tokens em teste/lint/tsc
nesta rodada (2026-09-12). As três correções entram sem suíte executada; o CI da PR é
quem mede.

**Condição cumprida — nada pendente aqui.** Estes arquivos ficaram para a PR 3 por
decisão do mantenedor (2026-09-12), a serem restaurados de `4bb3108` assim que a #317
mergeasse. A #317 mergeou em 2026-09-13 (`49ac4b1`), a PR 3 é a **#319**, e os arquivos
entraram nela pelo commit `b7a03ed`. O bloco fica como registro da armadilha, não como
instrução a executar.

### Achados de review da #319 — o que ainda decide alguma coisa

Seis rodadas de review (Codex, CodeRabbit, Sonar, Snyk). O *porquê* de cada correção
vive no comentário do código que ela tocou, com o achado e a PR citados — aqui fica só
o que a doc precisa guardar: o que entregou, o que bloqueia e o que precisa da sua
conferência. A tabela de estado abaixo lista os arquivos, um por linha.

**O padrão que se repetiu, e é o aprendizado transferível:** dos 13 defeitos
corrigidos, **10 falhavam em silêncio** — nenhum erro em log, nenhum teste vermelho.
Cache vazando entre visitantes, WhatsApp abrindo conversa com a pessoa errada, tela de
mesa encerrada sem nenhum campo, overlay cobrindo a aplicação com o backend saudável,
oferta gratuita publicada para mesa paga. O que os une: **eram caminhos sem teste
nenhum**. O CTA de WhatsApp não tinha um único caso; os aliases de rota não tinham; o
JSON-LD sem preço não tinha. Review de bot encontrou o que o CI não tinha como
encontrar.

**Dois foram regressões introduzidas pela própria migração F4**, não defeitos
herdados: o `replace` perdido nos 6 aliases de rota (`<Navigate replace />` virou
`redirect()`, que empilha histórico e prende o Voltar) e o smoke de ingress morto por
`ENOENT` (a F4 removeu o `nginx.conf` que o script lia na primeira linha, anulando 14
asserções de `accounts`, `site`, `glossario` e dos dois backends).

**Um foi correção de correção:** ao tirar o preço `"0.00"` de mesa paga sem valor,
deixei um `Product` sem `offers` — e `Product` exige `name` MAIS uma propriedade
qualificadora (`offers`/`review`/`aggregateRating`); `brand` e `image` não servem.
Trocar preço errado por markup inválido é troca ruim. A saída é não emitir JSON-LD
nesse estado.

**Recusas, com a medição que sustenta cada uma.** Estão aqui porque a tabela de
estado não as carrega, e porque bot que repete o pedido a cada rodada precisa de uma
resposta estável — se o achado voltar, a resposta é esta, sem reinvestigar:

- **`useUrlState.ts` com `ref` (o CodeRabbit pediu três vezes).** O arquivo **não está
  no diff desta PR** e o comportamento pedido já existe em `:110-127`, feito com
  `useState`. A versão `useRef` foi REJEITADA e consta em `:1592` desta spec como um
  dos 55 erros de lint corrigidos (`react-hooks/refs`: ler/escrever ref durante o
  render quebra a pureza e, sob renderização concorrente, devolve valor de passagem
  descartada). Aceitar desfaria a correção.
- **Loader SSR em `/mestres/:masterId`.** A rota **não é indexável**: `sitemap.ts:28-29`
  publica só a raiz e `/mesas/:slug`. A rota pública de mestre é `/mestre/:slug`, que
  já tem loader e é a canônica que o `og.ts:210` emite. Rota por ID, fora do sitemap,
  sem link interno — nenhum crawler chega nela. Escopo novo, não correção de review.
- **Snapshot de tema derivado do cookie da requisição.** O Codex afirmou que fixar
  `dark` regrediu o `site` via `client:idle`. **Medido: não regrediu.**
  `SiteHeader.astro:10` emite `class="artificio-header"` SEM `data-variant` e traz os
  dois logos alternados por CSS (`.logo-navy`/`.logo-neg`); o `ThemeToggle` só existe
  dentro da ilha. No `site` o chrome sempre dependeu do `data-theme` do `<html>`,
  nunca do snapshot. O fundo do achado continua válido para o `mesas` — ver pendências.
- **`formatWhatsAppDisplay` com o mesmo defeito do DDD 55** — sondado, não presumido:
  a regex é ancorada nas duas pontas, então `55999999999` devolve
  `DDD=55 numero=999999999` e `5532221234` devolve `DDD=55 numero=32221234`, ambos
  corretos. Nenhuma edição.
- **Fundir os `RUN` do `Dockerfile` (Sonar)** e **o CIDR `172.18.0.0/16` "hardcoded"
  no `server.js:20`** — os dois recusados com medição na tabela de estado abaixo.

**Pendências que precisam de decisão do mantenedor** (nenhuma é bloqueio de merge):

1. **Foco não contido no overlay de indisponibilidade** (`root.tsx:129`). Procede: não
   há `role`, `aria-modal`, `inert` nem focus trap, e o teclado tabula por controles
   invisíveis sob a camada. Não entrou como remendo porque mexe em comportamento de
   foco de componente compartilhado (`BackendStatusScreen`) e é mudança de UI, que o
   `AGENTS.md` manda passar pela `wcag-accessibility-audit`.
2. **Snapshot de tema no SSR** (`packages/ui/src/theme.tsx`). Fixar `dark` — o default
   do script inline sem cookie — resolve para quem não tem cookie e inverte o público
   afetado para quem tem `light`, em vez de eliminar a divergência. A saída definitiva
   é o markup inicial não depender do snapshot, o que **exige contexto por requisição
   e muda contrato nos 6 apps consumidores**. Pendência também no comentário do
   próprio `theme.tsx`.

**Armadilha de validação que derrubou o CI da #319 (run `34776296657`): `pnpm test`
verde NÃO implica `typecheck` verde.** O `vitest` não checa tipo, e o script
`typecheck` do `mesas-frontend` é `react-router typegen && tsc -b`, que **inclui os
arquivos de teste**. O `3d6ff5c` foi pushado com `1152/1152` e build verde, e o CI
reprovou com **13 erros `TS18047`** em `tableMeta.test.ts` — o helper `jsonLdOf`
devolvia `{ product: null, offer: null }` desde que `buildTableJsonLd` passou a poder
devolver `null`, e nenhum `expect` estreitava. Corrigido fazendo o helper lançar: o
ramo sem markup tem teste próprio, que chama `buildTableJsonLd` direto. **Rodar
`typecheck` além de `test`/`lint`/`build` antes de pushar mudança de assinatura.**

**Armadilhas do ambiente de teste do `packages/ui`** (custaram 2 rodadas vermelhas;
quem for escrever teste com DOM aqui precisa das três):

- **`window.localStorage` do jsdom 29 deste pacote é objeto liso** — sondado:
  `proto: Object`, `setItem: undefined`, `clear: undefined`. `Storage` existe como
  função global mas não está ligado a essa instância, então espiar `Storage.prototype`
  também não a alcança. O teste instala o próprio por `Object.defineProperty`.
- **Sem `setupFiles`, o auto-cleanup do testing-library não é registrado** — o DOM
  acumula entre casos e `getByTestId` falha com "Found multiple elements". `cleanup()`
  explícito no `afterEach`. A ausência de `setupFiles` é decisão registrada no
  `vitest.config.ts` do pacote, não descuido.
- **O header que o helper `replace()` emite é `X-Remix-Replace: 'true'`**, não
  `'yes'` — afirmei `'yes'` sem medir, e o teste falhou por isso.

Estado em 2026-09-13, na branch `feat/102-f4-mesas-ssr`. A coluna diz onde cada
correção está: **em commit pushado** ou **só no working tree** (não commitada).

| arquivo | achado | estado |
|---|---|---|
| `src/features/table/seo/tableMeta.ts:41` | `description` estourava 160 com cauda longa: o piso de 60 para a sinopse era incondicional. Medido com dado real — "Little Fears – The Role-playing Game of Childhood Terror" (56 chars, um dos 682 sistemas) + modalidade/nível/preço/vagas dá cauda 108 e description **172**. O teste que existia usava `Dungeons & Dragons` (18 chars) e nunca chegava lá | `3d6ff5c` — piso só vale enquanto cabe; cauda longa trunca a sinopse até sumir. Medido depois: 172 → 108, nenhum caso estoura |
| `scripts/ci/check_ingress_realip_contract.mjs:9` | guard morria com `ENOENT` desde `b7a03ed` (lia o `nginx.conf` removido), anulando 14 asserções | `3d6ff5c` — inspeciona `server.js`; medido `ENOENT` → `smoke OK` |
| `src/features/table/seo/tableMeta.ts` | omitir só a `Offer` deixava `Product` sem propriedade qualificadora — inválido no Rich Results | `3d6ff5c` — sem preço publicável não sai JSON-LD nenhum. O `null` no retorno é o que quebrou o `typecheck` do CI (ver armadilha acima); teste corrigido em `32da301` |
| `packages/catalog-table/src/contactUrls.ts:114` | DDD 55 (Santa Maria/RS) confundido com código de país | `57abff8` — decisão por comprimento (10-11 local, 12-13 com país), 7 testes |
| `packages/ui/src/theme.tsx:120` | snapshot SSR `"light"` fixo contra `dark` do script inline | `57abff8` — snapshot `dark`; leitura do cookie na requisição segue pendente |
| `packages/ui/src/hooks.ts:6` | badge lia `localStorage` no primeiro render, divergindo do servidor | `57abff8` — leitura movida para `useEffect` |
| `src/routes/redirect.tsx` | `redirect()` empilhava histórico; era `<Navigate replace />` antes da F4 | `57abff8` — helper `replace()`, 4 testes novos |
| `src/lib/apiUrl.ts:25` | dev local resolve `mesas-api`, que não existe fora do Docker | `abd773c` — padrão por `import.meta.env.DEV` |
| `src/features/table/seo/tableMeta.ts:88` | mesa paga sem preço publicava `"0.00"` | `abd773c` — corrigido pela metade; refeito em `3d6ff5c` (ver 2ª linha) |
| `src/pages/MesaPage.tsx:100`, `TableSchedules.tsx:88` | data sem `timeZone` diverge entre SSR e hidratação | `abd773c` — `utils/formatDate.ts` com `America/Sao_Paulo` |
| `src/root.tsx:129` | overlay sem foco contido nem semântica modal | **pendente de decisão** — ver pendência 1 acima |
| `src/entry.client.tsx:23` | usar `RegExp.exec()` | `b75a224` |
| `src/root.tsx:73` | usar `String.raw` | `b75a224` — de quebra elimina a pegadinha do `\\s`, que já custara um bug de tema piscando |
| `src/routes/{catalogo,mesa,mestre}.tsx` | `export…from` para re-exportar `default` | `b75a224` nos três |
| `src/features/table/seo/tableMeta.ts:31` | optional chain | `b75a224` (`parte?.trim()`) |
| `server.js:20` | "IP `172.18.0.0/16` hardcoded" | **RECUSADO — falso-positivo.** Medido: a linha é `process.env.TRUSTED_PROXY_CIDR \|\| '172.18.0.0/16'`, env var com fallback, e o CIDR é o da rede interna do Docker. Mesma linha dos outros 6 apps Express do monorepo. É hotspot, não defeito |
| `src/pages/MesaPage.tsx:25` | complexidade cognitiva 16 > 15 | pendente — refatoração de função |
| `packages/catalog-table/src/contactUrls.ts:164` | complexidade de regex 21 > 20 | pendente — mexe em pacote compartilhado |
| `Dockerfile:76,111` | fundir `RUN` consecutivos | **RECUSADO — pediria para reintroduzir defeito já corrigido.** O próprio arquivo registra na L118: *"Asserção separada do install de propósito (achado de review, PR #268): no encadeamento `pnpm install && test … \|\| echo ERRO`, falha de rede ou de lockfile caía no mesmo `\|\|` e era reportada como 'dependência ausente' — diagnóstico errado num build que quebra por outro motivo."* O par L76/L82 tem motivo análogo: fundir `apk add` com `corepack enable` invalida a camada de patch de segurança a cada troca de versão do pnpm |

Validação, por pacote — as correções alcançaram `packages/ui` e
`packages/catalog-table`, então o blast radius inteiro foi rodado: `packages/ui`
**85/85** (eram 79), `packages/catalog-table` **36/36** (eram 29), `mesas-frontend`
**1152/1152** em 86 arquivos (eram 1139), `downloads-frontend` **315/315**, `accounts`
**602/602** (52 skipped pré-existentes), `site` **155/155**, `glossario-frontend`
**37/37**. `site-admin` e `links` têm `test` stub (`echo`), sem suíte a rodar. Lint 0
erros nos pacotes tocados (1 aviso pré-existente em `useBannerScrim.ts`, não tocado),
`build` verde, `verify:api` exit 0 com breaking=0 nos 6 apps,
`smoke:ingress-realip` OK.

**Snyk — `qs@6.15.2` (2 CVE médios): CORRIGIDO na #317.** `CVE-2026-82562` (CWE-770,
CVSS 6.3, parser sem limite efetivo) e `CVE-2026-82417` (CWE-248, CVSS 6.9, exceção
não capturada derruba o processo), ambos com PoC público, corrigidos em `qs@6.16.0`.

Medido antes: `qs@6.15.2` resolvido no lock; `qs@6.16.0` publicado como `latest`.

Override `"qs@<6.16.0": ">=6.16.0 <7"` no `pnpm-workspace.yaml`. **Entrou na #317 e
não na PR 3** por decisão do mantenedor (2026-09-12): `qs` é transitiva de
`express@5.2.1`, que alcança **todo backend do monorepo** — não só o `mesas/frontend`,
onde o `express` só chega com o SSR. O override na raiz vale para todos os
consumidores, presentes e futuros, então adiá-lo para a PR 3 deixaria os outros apps
expostos sem motivo.

### Armadilhas de git já pagas nesta entrega

- **`git switch -c <nova> origin/dev` aborta SÓ quando a branch nova nasce em commit
  DIFERENTE do HEAD** (`Please commit your changes or stash them before you switch
  branches`). A advertência aqui era absoluta e não é: **medido em 2026-09-13, com
  `tasks.md` e mais 4 arquivos modificados, `git switch -c chore/102-t52-…` levou
  tudo intacto** — porque `origin/dev` (`a7ea7e1`) já contém o trabalho mergeado, e a
  branch nasce no mesmo ponto do HEAD. Não há árvore para reescrever, logo não há o
  que conflitar.

  **Consequência prática: NÃO stashar.** Com `dev` atualizada, a saída é só
  `git switch -c <nova>` — omitindo o `origin/dev`, que é redundante quando o HEAD já
  está lá. Stashar por precaução é o que leva ao item seguinte.

- **`git stash pop` depois do switch CONFLITA** quando o switch de fato muda de
  commit: `tasks.md` tinha **1388 linhas em `origin/dev`** contra **2231 em
  `4bb3108`**. O stash nasce sobre a versão nova e tenta aplicar sobre a antiga → 3
  conflitos (`UU`), um deles de 119 linhas. Resolver os marcadores à mão reconstrói a
  spec errada. **Saída medida:** `git checkout <commit> -- specs/.../tasks.md` e
  reaplicar as edições por cima.
- **`git add -A` sobre `apps/mesas/frontend` leva o `.react-router/` gerado** (27
  arquivos) mesmo ele estando no `.gitignore`, porque o `-A` sobre caminho explícito
  vence o ignore. Conferir `git diff --cached --name-only` antes de commitar.

---

## Ações que exigem aprovação nominal

Cada uma com rollback próprio. **Uma executada** (item 1); as outras quatro pendentes.

1. ✅ **`UPDATE posts SET canonical = NULL`** nos 105 divergentes, em `site` (T3.2).
   **Executada em 2026-09-12** com autorização nominal: `UPDATE 105`, 105 → 0
   divergentes. *Rollback:* dump pré-escrita em
   `~/backups/spec102/posts_pre_t32_20260912_021453.sql` (VM) e em
   `C:\projetosrtificiobackup\spec102\`, verificado nos dois lados. A coluna é
   restaurável isoladamente por `UPDATE … FROM` sobre o dump.
2. **`INSERT` de 105 linhas em `redirects`**, em `site` (T2.2).
   *Rollback:* `DELETE FROM redirects WHERE from_path IN (…)` pelos `from_path`
   inseridos. O cache recarrega a cada 30 s (`redirect-cache.ts`), então a reversão
   vale sem restart.
3. **Deploy do `mesas`** — status HTTP é comportamento observável (T1.2/T1.3), e é o
   que leva o sitemap corrigido (T1.4) ao Google.
   *Rollback:* redeploy da imagem anterior (tag do commit prévio), pelo fluxo de
   `deploy-flow.md`. Sem migration envolvida: nada a reverter no banco.
4. **Export + rebuild + deploy do `site`** (T3.3, e T3.4 no mesmo ciclo).
   **Autorizado em 2026-09-12, não executado.** O motivo do bloqueio MUDOU: o código
   da T3.4 está em `dev` desde o merge da #317 (`49ac4b1`, commit `58305fb`). O
   deploy lê de `main` (`deploy-flow.md:373` — `--ref main … -f env=prod`), então
   **resta só promote `dev`→`main` + dispatch**, cada um com autorização própria.
   Não falta mais commit, push nem PR.
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

6. **Ingress do tunnel: `mesas-app:80` → `mesas-app:3000`** (T4.2).
   **O par do beta JÁ FOI FEITO** em 2026-09-13 (autorizado nominalmente): config
   remota v26 → **v27**, `mesasbeta` → `mesas-beta-app:3000`. **Resta só a linha de
   prod.** **Passo 4 da ordem de deploy de T4.2** — nunca antes do container novo
   subir, sob pena de `502` mais longo; e o smoke da esteira falha ANTES dele (ver
   a armadilha de sequência em T4.2). Uma linha, via MCP Cloudflare ou painel.
   *Rollback:* reescrever a porta de volta para `80`, mesma chamada. A config é
   versionada pela Cloudflare, e o estado anterior está registrado aqui.
   **Cuidado medido:** o `PUT` de configuração SUBSTITUI o ingress inteiro — as 11
   regras precisam ser reenviadas juntas; omitir uma a apaga.

**Fora desta lista, por não exigirem autorização:** as tasks de F6 são operação manual
do mantenedor no Search Console (o agente não tem acesso) e não têm rollback técnico —
Request Indexing não se desfaz, apenas não se repete (T6.2).

**Saíram da lista em 2026-09-11** (achado de auditoria, T2.1): `Dockerfile`/nginx para
os 301 e mudança em Cloudflare. O mecanismo de redirect já existe no repo
(`server.ts:287-294` + tabela `redirects`), então a F2 é `INSERT`, não mudança de
infra — e não aciona a trava de `deploy-flow.md` §1.

7. **F7 — header mobile unificado, em PR PRÓPRIA** (decisão do mantenedor, 2026-09-15).
   Toca `packages/ui` (pacote compartilhado: §Autorização exige aprovação + verificação
   de impacto nos consumidores) e os 4 apps que consomem o header. *Rollback:* `git
   revert` da PR — é mudança de CSS e markup, sem migration nem estado persistido. O
   risco real não é reverter, é o smoke visual: guard de árvore e de CSS prova estrutura,
   não pixel, e só o mantenedor pode conferir em navegador a 320/360/375/390px nos 6 apps.

Aprovação é por ação e não acumula (§Autorização).
