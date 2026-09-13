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

### [!] T3.3 — Export + rebuild + deploy do `site` — BLOQUEADA

Deploy **autorizado** pelo mantenedor em 2026-09-12; **não executável ainda**.

**Bloqueio, atualizado em 2026-09-12.** `deploy.yml` roda com `--ref main` e a VM faz
`git reset --hard origin/<branch>` (`deploy-flow.md` §6), então só chega a produção o
que estiver em `main`. O código de T3.4 já está commitado — o bloqueio deixou de ser
"não commitado" e passou a ser **a distância até `main`**: falta PR → merge em `dev` →
promote `dev`→`main` → dispatch.

O caminho até `dev` mudou: T3.4 entra pela **PR #317** (commit `58305fb`), não mais
pela PR #316 (§Entrega de F1+F3+F4). Como a #317 não depende da migração SSR do
`mesas`, T3.3 destrava com o merge dela — sem esperar a PR 3.

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

**Aceite.**

1. Varredura dos 126 posts: `<link rel=canonical>` == URL servida em **126/126**
   (hoje: 21/126).
2. `curl -s https://artificiorpg.com/sitemap-0.xml | grep -c "lastmod"` → ≥ 126
   (aceite 1 de T3.4, só mensurável aqui).

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

**Pendente de produção.** `curl … | grep -c "lastmod"` → ≥ 126 só é mensurável depois
do deploy (T3.3). Até lá o `posts.json` versionado (8 posts, nenhum com `updated`)
gera 0 `lastmod` — é o "não inventar data" funcionando, não falha.

**Depende de.** T3.3 — mesmo ciclo de export + build + deploy.

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
| Ingress `:80` → `:3000` (prod + beta) | **pendente de autorização nominal** — item 6 da §Ações |

**O código desta task está fechado.** O único item aberto é a porta do ingress,
que é escrita em tunnel de produção e roda no momento do deploy (§Autorização),
não antes.

Nada commitado. `pnpm-lock.yaml` e `Dockerfile` modificados → o
`deploy-contract-gate` cobra `deploy-flow.md` §1 no commit.

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
| 40 erros em `.react-router/` | diretório **gerado** pelo `typegen`: entrou em `globalIgnores` do eslint e no `.gitignore` (junto de `.astro/`) |
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

**Confiar na PR #317. É a única válida.** A #316 e a #318 estão superadas — mas
**a #316 NÃO pode ser fechada nem deletada** até a PR 3 existir e conter tudo: ela é
hoje o único lugar com os 133 arquivos juntos.

| PR | estado | conteúdo | arquivos |
|---|---|---|---|
| **#317** | **ABERTA, é esta que vale** | 2 commits: imports unificados + canonical/`lastmod` | **60** (56 contra o teto) |
| #318 | aberta, **redundante — pode fechar** | duplicata: tudo que ela tem está na #317 | 14 |
| #316 | aberta, **NÃO FECHAR** | o monólito de 133 arquivos; fonte da PR 3 | 133 |

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
| `5c8c3e5` | `jsdom` fora do bundle (`createRequire` + `devDependencies`), overrides de `undici` nas duas majors, e os 2 achados do Codex: comentário do `ContentEditor.tsx` que descrevia implementação removida, e 2 testes do hook que passavam por acidente (7 arquivos) |

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

### O que falta — CHECKLIST EXECUTÁVEL DA PR 3

**PR 3 — `packages/catalog-table` + migração SSR do `mesas`** (~76 arquivos), a ser
criada **de `origin/dev` depois do merge da #317**. Antes disso não: os 39 imports
reapareceriam no diff dela e ela voltaria a ultrapassar o teto.

**Nada aqui é opcional e nada se descobre sozinho.** Cada item abaixo foi medido
nesta spec; quem criar a PR 3 executa a lista, não a redescobre. A ordem importa:
os itens 1 e 2 são os que fazem a PR builda/subir, o 3 é o que impede o Sonar de
reencontrar os mesmos achados e queimar outra janela de review.

- [ ] **1. Criar a branch de `origin/dev` JÁ COM A #317 MERGEADA.** Trazer os
      arquivos com `git checkout 4bb3108 -- <caminhos>` (nunca mover: o `4bb3108` é
      a fonte e fica intacto).
- [ ] **2. `apps/mesas/frontend/src/utils/sanitize.ts` — BUG LATENTE, quebra o SSR.**
      Importa `dompurify` **puro** (L1) e é consumido por `useProfileQuery.ts` em 4
      pontos (L43, L89, L128, L196). No servidor: `sanitize is not a function` →
      `500` no perfil. **Nenhum bot apontou isto**; sem tratar, a PR 3 troca um `500`
      por outro. A correção depende da decisão do item 3 (mesmo sanitizador).
- [ ] **3. Fechar a decisão do DOMPurify** (§"Estudo do caminho de sanitização").
      Recomendação do agente: **opção (a)**, manter DOMPurify e corrigir a
      inicialização no SSR. Se (a) for escolhida, junto vem:
      `test -d packages/*/node_modules/jsdom` no Dockerfile do app que passar a
      depender de `isomorphic-dompurify` — dependência de 2º nível podada por
      `pnpm install --prod --filter` é o que derrubou o SSO por 5h (E016/E017).
- [ ] **4. Reparar os 11 achados do Sonar** da tabela "Ficam para a PR 3" (abaixo),
      **antes de pedir review**. São arquivos que só existem no `4bb3108`:
      `server.js`, `MesaPage.tsx`, `entry.client.tsx`, `root.tsx`, as 3 rotas,
      `Dockerfile` (2x), `tableMeta.ts`, `contactUrls.ts`.
- [ ] **5. Conferir que o hook de registro veio junto:**
      `grep -c registro-anti-compactacao .claude/settings.json` deve devolver **1**,
      e `.claude/hooks/registro-anti-compactacao.js` deve existir. Eles viveram
      apenas no `4bb3108` até 2026-09-12 (ver §Registro anti-compactação).
- [ ] **6. Conferir o override `qs@<6.16.0`** no `pnpm-workspace.yaml` (entrou pela
      #317; se a base mudar, confirmar que sobreviveu ao merge).
- [ ] **7. Validar antes de pushar:** `mesas/frontend` (suíte + `tsc -b` + build
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

**Ficam para a PR 3 — REPARAR ASSIM QUE A #317 FOR MERGEADA.** Decisão do mantenedor
(2026-09-12). Estes arquivos não existem na branch da #317: eles vivem no commit
`4bb3108` e só reaparecem quando a PR 3 for criada. **Primeira coisa a fazer depois do
merge da #317**, antes de pedir review da PR 3 — senão o Sonar reencontra os mesmos 11
achados e queima outra janela de review.

Procedimento: criar a PR 3 de `origin/dev` já mergeado, trazer os arquivos com
`git checkout 4bb3108 -- <caminhos>`, **aplicar as correções da tabela abaixo** e só
então pushar.

| arquivo | achado |
|---|---|
| `apps/mesas/frontend/server.js:20` | IP `172.18.0.0/16` hardcoded (hotspot de segurança) |
| `apps/mesas/frontend/src/pages/MesaPage.tsx:25` | complexidade cognitiva 16 > 15 |
| `apps/mesas/frontend/src/entry.client.tsx:23` | usar `RegExp.exec()` |
| `apps/mesas/frontend/src/root.tsx:73` | usar `String.raw` no lugar do escape |
| `apps/mesas/frontend/src/routes/{catalogo,mesa,mestre}.tsx` | `export…from` para re-exportar `default` |
| `apps/mesas/frontend/Dockerfile:76,111` | fundir `RUN` consecutivos |
| `apps/mesas/frontend/src/features/table/seo/tableMeta.ts:31` | optional chain |
| `packages/catalog-table/src/contactUrls.ts:164` | complexidade de regex 21 > 20 |

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

- **`git switch -c <nova> origin/dev` ABORTA** com este `tasks.md` modificado no
  working tree (`Please commit your changes or stash them before you switch
  branches`). É a primeira coisa que o próximo agente tentará.
- **`git stash pop` depois do switch CONFLITA:** `tasks.md` tinha **1388 linhas em
  `origin/dev`** contra **2231 em `4bb3108`**. O stash nasce sobre a versão nova e
  tenta aplicar sobre a antiga → 3 conflitos (`UU`), um deles de 119 linhas. Resolver
  os marcadores à mão reconstrói a spec errada. **Saída medida:**
  `git checkout <commit> -- specs/.../tasks.md` e reaplicar as edições por cima.
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
   **Autorizado em 2026-09-12, não executado:** o deploy lê de `main` e o código da
   T3.4 não está commitado (`git log origin/dev..HEAD` → 0). Destrava com commit +
   push + PR + promote, cada um com autorização própria.
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

6. **Ingress do tunnel: `mesas-app:80` → `mesas-app:3000`** (T4.2, e o par do beta).
   Escrita em tunnel de produção, config remota versão 26. **Passo 4 da ordem de
   deploy de T4.2** — nunca antes do container novo subir, sob pena de `502` mais
   longo. Uma linha por ambiente, via MCP Cloudflare ou painel.
   *Rollback:* reescrever a porta de volta para `80`, mesma chamada. A config é
   versionada pela Cloudflare, e o estado anterior está registrado aqui.

**Fora desta lista, por não exigirem autorização:** as tasks de F6 são operação manual
do mantenedor no Search Console (o agente não tem acesso) e não têm rollback técnico —
Request Indexing não se desfaz, apenas não se repete (T6.2).

**Saíram da lista em 2026-09-11** (achado de auditoria, T2.1): `Dockerfile`/nginx para
os 301 e mudança em Cloudflare. O mecanismo de redirect já existe no repo
(`server.ts:287-294` + tabela `redirects`), então a F2 é `INSERT`, não mudança de
infra — e não aciona a trava de `deploy-flow.md` §1.

Aprovação é por ação e não acumula (§Autorização).
