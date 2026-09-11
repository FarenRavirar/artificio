# Spec 093 — Mesas: draft, parser e gestão

**App:** `mesas` · **Status:** aberta · **Criada:** 2026-08-19
**Origem:** demanda direta do mantenedor (2026-08-19), 7 pontos, foco em "melhorar a parte de draft".

---

## Problema

Sete achados, todos no fluxo de importação/revisão de mesa do `mesas`. Três são **defeito**
(parser produz dado errado ou não produz), quatro são **lacuna de gestão** (função existe
num lugar e falta noutro, ou existe no backend e não tem UI).

O fio comum: o admin que revisa rascunho de mesa não consegue fechar o trabalho sem sair da
tela — copia anúncio noutro lugar, corrige vaga que o parser leu de uma data, procura estilo
que ficou preso na descrição, e não tem onde ver o que descartou.

### Gap 1 — "Copiar anúncio" não existe no draft

`CopyAnnouncementButton` é usado em **dois** pontos (`TableCardDashboard.tsx:225`,
`TableActionPanel.tsx:27`). `ConteudoSection.tsx` **não** usa o componente: importa as
funções e reimplementa a lógica inline (`:158-182`) — já é uma divergência. O preview de
draft (`DiscordDraftPreview.tsx`) não tem nenhum, então quem acabou de sincronizar precisa
sair da revisão, achar a mesa no catálogo e copiar de lá.

*(Correção da auditoria, transversal 10: a spec dizia "reusado em dois pontos + terceira
variante" e o plano dizia "três pontos de uso / quarta divergência" — duas contagens que
não batiam entre si nem com o código. O preview seria o **terceiro** uso do componente.)*

**Medição que restringe o desenho:** `isTableAnnounceable` (`whatsappAnnouncement.ts:19`)
exige `status === 'active' && !archived_at`. Sincronizar um draft cria mesa com status
`draft`; só o botão "Publicar mesa" (`DiscordDraftPreview.tsx:406-415`) a torna `active`.
Logo **não existe anúncio válido para draft sincronizado e não publicado** — o link do
anúncio apontaria para mesa que o público recebe como 404.

### Gap 2 — Aliases de VTT cobrem 6 de 10 plataformas

`VTT_ALIASES` (`shared.ts:60-73`) é um `Record` hardcoded. A lista canônica de VTTs tem
**10** plataformas — fonte: o seed de `006_create_vtt_platforms.sql:32-41` e
`frontend/public/vtt-logos/README.md`.

*(Correção da auditoria, Fase 3 achado 4 / transversal 6: a versão anterior citava
`migration_106_vtt_logo_filenames.sql` como confirmação das 10. **Ela lista 9** — omite
`tableplop`. Medido: 9 cláusulas `WHEN`, zero ocorrência de `tableplop`. Achado lateral
junto: `tableplop.webp` **não existe** no diretório de logos, que tem 9 `.webp`.)*

Rodam hoje com `aliases: []`:

| VTT | slug | aliases hoje |
|---|---|---|
| Roll20 | `roll20` | **nenhum** |
| TaleSpire | `talespire` | **nenhum** |
| Quest Portal | `quest-portal` | **nenhum** |
| Tableplop | `tableplop` | **nenhum** |

E o Fantasy Grounds (`fantasy-grounds-unity`) tem só `['Fantasy Grounds', 'FGU']` — falta a
linha Classic, que é o ponto que o mantenedor citou nominalmente.

O defeito não é a lista curta, e sim **onde ela vive**: um `Record` no código, enquanto o
repo já tem o padrão de alias em tabela (`system_aliases`, `scenario_aliases`). Com CRUD
admin de VTT ativo (`vttPlatforms.ts:202`), toda plataforma criada pelo painel nasce sem
alias e sem como ganhar um. Ver **D2**.

**Ressalva medida depois (2026-08-19, ver `tasks.md` §A3):** em 1030 linhas de anúncios
reais, `Roll20` aparece 6 vezes **na grafia exata do `name` do banco** — logo é reconhecido
hoje, apesar de ter zero alias. As variantes `Roll 20`, `R20`, `TS`, `FG`, `FGU`,
`TaleSpire` e `Tableplop` têm **zero** ocorrência. A lacuna de cobertura é real, mas o
impacto operacional que se poderia supor não foi medido em nenhum anúncio da amostra. A
correção segue valendo como defesa para grafias que ainda não apareceram — não como conserto
de falha observada.

### Gap 3 — Aba "Mesas" duplicada entre duas rotas de gestão

`/gestao/catalogo` (`ConteudoSection.tsx`) tem **4** abas de taxonomia — `systems`,
`platforms`, `scenarios`, `setting-styles` — **mais** uma aba `tables` rotulada "Mesas"
(linha 33), totalizando 5 em `CatalogTab` (`:25`). A aba `tables` lista mesas de **qualquer
status** via `GET /api/v1/admin/tables` — o comentário do próprio handler diz isso
(`adminTables.ts:301-304`, "Lista mesas de qualquer status (spec 060)"), e a faceta Status
(`:270-274`) oferece draft/active/full/cancelled/ended.

*(Correções da auditoria, Fase 7 achados 1 e 2: a versão anterior dizia "5 abas de
taxonomia" listando 4 nomes, e descrevia a aba como de "mesas publicadas" — o que
contradizia a própria R5, que manda migrar a faceta de 5 status.)*

`/gestao/mesas` (`ModeracaoSection.tsx`) tem 3 sub-abas — `rascunhos`, `mensagens`,
`duplicatas` — e **não lista mesas publicadas**.

A listagem de mesas está pendurada dentro do catálogo de taxonomia, enquanto a rota chamada
"Mesas" cuida só de rascunho. O admin procura mesa em `/gestao/mesas` e não acha.

### Gap 4 — Parser lê data como par de vagas (BUG)

**Proveniência da evidência (auditoria, achado transversal 1).** O anúncio Kingmaker
(`message_id 1539593774265671751`) foi observado em produção pelo mantenedor, que colou no
chat o `parsed_payload` resultante. O texto original **não existe no repositório**
(`rtk rg "1539593774265671751"` → zero) e **não será recuperado** — decisão do mantenedor,
2026-08-19.

**Fixture sintética, obrigatória** (`apps/mesas/backend/src/discord/__tests__/fixtures/`).
Não é o texto original: é um caso mínimo reconstruído que reproduz **as duas condições
medidas** do defeito. Foi verificada antes de entrar aqui — ver o quadro de validação
abaixo.

```
**Mesa:** Kingmaker — Pathfinder 2e
**Vagas:** 1 disponível de 4 jogadores
**Dia:** terça · **Horário:** 20:00

Por conta da saída recente de um jogador, essa chamada é para ter jogo já
dia 25/08, os jogadores apenas tiveram a Sessão 0 e Sessão 1.
```

Validação da fixture (rodada em 2026-08-19, antes de fixá-la):

| Linha | Passa o filtro `:1008`? | Par `/` capturado `:1009` | `RE_SLOT_X_DE_Y` `:913` |
|---|---|---|---|
| `Vagas: 1 disponível de 4 jogadores` | sim | — | **não casa** |
| `…jogo já dia 25/08, os jogadores…` | sim | **`[25, 08]`** | não casa |

As duas condições que produzem o bug estão presentes: a linha de prosa entrega o par
`25/08` que vira `slots_total`, e a linha da vaga real **não é reconhecida por estratégia
alguma**. O resultado esperado do parser hoje é `slots_total: 25` com
`_slots_ambiguity: {first: 25, second: 8, source: "x_slash_y"}` — idêntico ao observado em
produção.

**Limite honesto desta fixture:** ela prova o mecanismo, não a incidência. Não substitui o
anúncio real para responder "quantas mesas em produção têm o mesmo defeito" — essa pergunta
segue sem medição.

Cadeia causal medida em `slotsLabeledNumericPair` (`parseDiscordAnnouncement.ts:1003-1018`):

1. Linha 1008 aceita qualquer linha que contenha `vagas?|lugares?|jogadores?`. A linha de
   prosa `"…essa chamada é para ter jogo já dia 25/08, os jogadores apenas tiveram a
   Sessão 0…"` contém "jogadores" → passa.
2. Linha 1009 casa `25/08` como par `N/M` → `first=25, second=8`.
3. Linha 1013 só rejeita `> 100` → `25` e `8` passam. **Não há guard de data.**
4. `classifySlotPairLine` não acha sinal semântico (`disponíveis`/`ocupadas`) nessa linha →
   devolve `generic` (linha 994).
5. `slotsFromNumericPair` com `generic` cai em `ambiguous()` (linha 969) → `total = max(25,8)`.
6. **Linha 1015 é `return`, não `continue`** — a primeira linha que casa encerra a varredura.

**Correção do diagnóstico (auditoria adversarial, 2026-08-19).** A versão anterior desta
seção afirmava que o passo 6 era "o mais grave", porque impediria a linha
`"1 disponível de 4"` de ser avaliada. **Mecanismo falso.** A regex do par (linha 1009)
exige `/` literal — `"1 disponível de 4"` não tem `/` e **nunca** seria candidata desta
função, com `return` ou `continue`. O `return` continua sendo defeito de robustez (dois
pares `/` no mesmo texto, o primeiro vence), mas não explica este bug.

**O defeito maior é outro, e não estava na spec:** nenhuma das 9 estratégias da cascata
reconhece a forma `"N disponível de M"`. Medido:

```
RE_SLOT_X_DE_Y (linha 913):  "2 de 6" → [2,6]  ·  "3 de 5 vagas" → [3,5]
                             "1 disponível de 4 jogadores" → NULL
```

O regex exige o número imediatamente antes de `de`; o qualificador no meio quebra. Logo o
guard de data, sozinho, faz o parser cair em `{total: null, open: null}` — **remove o valor
errado sem produzir o certo**. Atender R9 exige capacidade nova (Camada D do `plan.md`).

### Gap 5 — Rótulo "Tema(s)" não é reconhecido (BUG)

No mesmo anúncio, `setting_styles` veio `null` e a linha
`"Tema(s): hexploração, gestão de reino, combate entre exércitos, aventura"` sobrou dentro
da descrição.

Causa única, dois sintomas:

- `extractLabelValue(body, ['estilo', 'indicado'])` (linha 2578) só conhece `estilo` e
  `indicado`. `Tema(s)` não casa → `settingStyles` fica `null` (linha 2579).
- `FALLBACK_DESCRIPTION_KNOWN_LABEL_KEYS` (linhas 1949-1960) também não tem `tema`. Pela
  regra documentada nas linhas 1972-1974 — só remove da descrição o label com destino
  confirmado — o `Tema(s)` **corretamente** permanece no texto, para não perder o dado.

Não são dois defeitos: reconhecer o rótulo nos dois conjuntos resolve os dois sintomas.

**Prova retirada (auditoria, Fase 3 achado 2).** A versão anterior usava
`Classificação Indicativa` como evidência de que o desenho é coerente — supostamente
extraído **e** removido da descrição. **Falso, nos dois lados:**

- A linha 1959 contém `'classificacao'` (uma palavra). `splitLabelLine` produz
  `"classificacao indicativa"` (duas), que **não** está no Set → a linha **não** é removida
  da descrição. E de fato ela aparece no texto que o mantenedor colou.
- `age_rating: "+18"` não vem do Set: vem de `extractAgeRating`, por regex `\+\s?18\b` sobre
  o corpo, independente de rótulo.

Ou seja, o caso citado como prova de coerência é **mais uma ocorrência do mesmo bug** —
rótulo ausente do Set, sobrando na descrição. Isso amplia o Gap 5: `classificacao
indicativa` entra junto com `tema`. (Medido: `faixa etaria` **já está** na linha 1959;
`classificacao` está, mas só na forma de uma palavra.)

Medição das chaves normalizadas, que também corrige outra afirmação da spec:

```
"Tema(s)"                  -> "tema s"                      ← normalize REMOVE parênteses
"Classificação Indicativa" -> "classificacao indicativa"     ← ausente do Set
"Faixa Etária"             -> "faixa etaria"                 ← presente (:1959)
```

A primeira linha refuta o que a spec afirmava (`normalizeLabelKey` preservaria parênteses):
`normalize:197` faz `.replace(/[^a-z0-9\s]/g,' ')`. A entrada no Set deve ser a chave
normalizada `"tema s"` — ou, melhor, `tema` e `temas`, já que `"tema s"` decorre delas por
outro caminho. Confirmar por teste **qual** forma o Set precisa conter, sem presumir.

### Gap 6 — Aba "Bruto"/"Normalizado" sem botão de copiar

`DiscordDraftPreview.tsx:362-366` renderiza as duas abas com **o mesmo bloco**: um `<pre>`
com `JSON.stringify(selectedPayload, null, 2)`, onde `selectedPayload` (linha 91) é
`parsed_payload` na aba Bruto e `normalized_payload ?? parsed_payload` na Normalizado.

Não há como copiar o JSON senão por seleção manual — e o `<pre>` vive dentro de
`div.flex-1.overflow-auto` (linha 317), que rola, então o conteúdo passa da tela.

### Gap 7 — Descartados não têm aba própria nem como voltar atrás

`/gestao/mesas` não tem aba "Descartados". O backend, porém, já está inteiro:

| Função | Onde | Estado |
|---|---|---|
| Listar por status | `GET /admin/discord/drafts?status=rejected` (`drafts.ts:69-72`) | pronto |
| Ver detalhe | `GET /admin/discord/drafts/:id` (`drafts.ts:84`) | pronto |
| Descartar em lote | `PATCH` status `rejected` (`drafts.ts:20`) | pronto |
| Limpar definitivo | `DELETE /admin/discord/drafts/rejected` (`drafts.ts:260-328`) | pronto |

E o frontend `DiscordDraftReviewTable` já tem `statusFilter` (linha 101) com seletor na UI
(linha 324), e `handlePurgeRejected` (linhas 263-281).

**Premissa anterior refutada (auditoria, Fase 5 achado 1).** A spec afirmava que restaurar
"não existe" e que o descarte é "mão única na UI". **Falso.** As linhas 426/505 escondem
apenas checkbox e botões **de linha**; o preview continua abrindo, e ali o botão "Editar
status" (`DiscordDraftPreview.tsx:299-303`) tem gate só em `synced` — logo **aparece para
`rejected`**. O caminho completo já funciona: linha → preview → Editar status →
`needs_review` → Salvar (`useDraftForm.ts:631-649` → `PATCH /drafts/:id`).

R13 passa a ser, portanto, **atalho de linha para um fluxo que já existe** — não capacidade
nova. Isso reduz o valor da fase, e o mantenedor precisa saber disso antes de aprová-la.

**Dois achados que restringiram R12** — ambos resolvidos por **D5** (2026-08-19), que trocou
"ver, editar, limpar" por **"ver, restaurar, limpar"**:

- **Editar campos de descartado é impossível hoje**, por decisão de backend:
  `POST /:id/correction` → `registerDraftCorrection` devolve **422** "Draft rejeitado não
  pode ser corrigido" (`routes/discord/utils.ts:184`). **Decidido (D5b): o guard fica.** Ele
  é simétrico ao `:183`, que protege `synced`; editar exige restaurar antes.
- **Existe um segundo vetor de "des-descartar" não mapeado:** `POST /:id/reparse`
  (`drafts.ts:372-386`) bloqueia apenas `synced`, re-deriva o status e **sobrescreve
  `rejected`**. O botão "Reparsar" no preview (linha 383) não tem gate de status.
  **Decidido (D5c): barrar** — mesmo gate do `:183` estendido a `rejected`, senão o reparse
  contradiz o guard acima.

### Gap 8 — Dois `.sql` fora do contrato de migration, invisíveis à esteira

Achado durante a investigação, não pedido. Existe um **segundo diretório de migrations** no
app mesas:

```
apps/mesas/backend/migrations/006_create_vtt_platforms.sql   (2.9K)
apps/mesas/backend/migrations/007_click_tracking.sql         (1.4K)
```

| Verificação | Fonte | Resultado |
|---|---|---|
| Na allowlist? | `.github/migration-dir-allowlist` | **Não** — só `apps/*/database/`, `apps/*/db/migrations/`, `specs/*/phase-*-measurement.sql` |
| Runner varre? | `scripts/deploy/apply_required_migrations.sh:13` | **Não** — `MIGRATIONS_DIR` default `./apps/mesas/database` |
| Casa o glob? | `scripts/deploy/lib_migrations.sh:157` | **Não** — glob é `migration_*.sql`; estes são `006_`/`007_` |
| Header de 5 campos? | `head -6` de cada | **Ausente** nos dois |
| Referenciados em algum lugar? | `rtk rg` no repo inteiro | **Zero** ocorrências fora deles mesmos |

`006_` cria `vtt_platforms`, `vtt_platform_suggestions`, semeia as 10 VTTs e adiciona
`tables.vtt_platform_id`. `007_` cria `table_click_events` e altera `table_metrics`.

**Os objetos existem em produção** — medido pelo código que os usa em runtime:
`tables.ts:830` faz `insertInto('table_click_events')` a cada clique de mesa, e o parser
consulta `vtt_platforms` (`shared.ts:77`). Se as tabelas não existissem, essas rotas
falhariam a cada uso. Logo os dois SQL **foram aplicados por fora do framework**, e
`schema_migrations` não os registra.

Por que o guard não pegou: `_enforce-migration-dir.yml:75` usa `--diff-filter=AM`, validando
só arquivos adicionados ou modificados no diff do PR. Arquivo pré-existente fora da
allowlist nunca dispara bloqueio — o guard tem ponto cego para o passivo, só protege o fluxo.

### Gap 9 — `communication_platforms` sem alias

`shared.ts:96` devolve `aliases: []` fixo para toda plataforma de comunicação, enquanto as
VTTs ao menos têm o mapa. Seed (`migration_105_communication_platforms.sql:22-29`): Discord,
Google Meet, Microsoft Teams, Telegram, Zoom.

Agravante: o backfill da mesma migration (linhas 36-51) **cria plataformas a partir de texto
livre legado** da coluna `communication_platform`, com `slug` derivado por regex do que o
mestre digitou — entradas de nome arbitrário, também sem alias.

Não medi caso real de falha de reconhecimento aqui, diferente do Gap 4. O defeito é
estrutural e simétrico ao Gap 2: o mesmo mecanismo, ausente num dos dois catálogos.

### Gap 10 — Painel de filtros do catálogo: desalinhado e visualmente poluído

Relato do mantenedor (2026-08-19): o painel de busca/filtros de `mesas.artificiorpg.com`
"está muito feio, não combina com o resto da página". Auditoria externa (Gemini) sobre o
**DOM renderizado** apontou 5 itens. Cruzados contra o **fonte real** — que não é markup
inline, e sim componentes (`CatalogSystemFilter`, `SealToggle`, `StyleFacetPicker`) —,
três procedem, um não existe, e um está diagnosticado errado.

**Local:** `CatalogoPage.tsx:450-558`.

| # | Achado externo | Veredito medido |
|---|---|---|
| 1 | `<p>` "Cada nível é um nó…" quebra `items-center` | **Não existe no fonte.** `grep -rn "Cada nível"` em todo `apps/mesas/frontend/src` devolve zero. O `<p>` visto no DOM vem de dentro de `CatalogSystemFilter`, não do markup da section — o alvo apontado não é onde a correção cabe. |
| 2 | Alturas inconsistentes: `py-1.5` vs `py-2.5` | **Procede.** `SealToggle.tsx:22` (variante `toolbar`) usa `px-3 py-1.5 text-xs`; inputs e `.app-select` usam `py-2.5`/`0.5rem` com `text-sm`. Fileira em dente de serra. |
| 3 | "Estilos" desalinhado, trocar por `items-baseline` | **Procede parcialmente.** `StyleFacetPicker.tsx:63` usa `items-center` com rótulo `text-[11px]` ao lado de chips `text-xs` — alturas diferentes. `items-baseline` é uma solução; igualar a altura dos itens é outra, e mais consistente com o item 2. |
| 4 | Excesso de `border border-[var(--line)]` | **Procede.** Contados no fonte: input de busca (`:462`), `.app-select` (`index.css:153`), `SealToggle` (`:22`), botão Limpar (`:542`), cada chip de estilo (`StyleFacetPicker.tsx:72`) e o popover (`:100`). |
| 5 | Adicionar `capitalize` nos chips | **Diagnosticado errado — ver abaixo.** |

**Por que o item 5 está errado, e por que importa.** A proposta é CSS (`class="capitalize"`).
Mas a duplicação não é visual, é de dado:

- `StyleFacetPicker.tsx:78` renderiza `{style}` cru, sem normalização.
- As facetas vêm de `GET /api/v1/tables/style-facets` (`tables.ts:362-374`), que faz
  `GROUP BY style` — **agrupamento por string exata**. `exploração` e `Exploração` são duas
  linhas, com contagens separadas, logo **dois chips**.
- `capitalize` faria os dois chips ficarem idênticos na tela, lado a lado, com números
  diferentes — leitura pior que a de hoje, não melhor.

A causa raiz está na escrita: `splitFreeTextList`
(`parseDiscordAnnouncement.ts:1422-1428`) faz `split` + `trim` e **nada mais** — sem
capitalização, sem remover ponto final.

Isto já causou dano medido antes: `migration_152_normalize_setting_styles.sql` (spec 081,
2026-07-17) limpou à mão `'dark fantasy'→'Dark Fantasy'`, `'Exploração.'→'Exploração'`,
`'fantasia'`, `'sobrevivência'`, `'suspense'`, `'terror'`, `'Macabro.'` e o typo
`'Saobrevivência'`. O cabeçalho registra a origem: *"auditoria visual identificou via SELECT
em prod"*. A migration limpou o estoque; o produtor continuou produzindo. O mantenedor estar
vendo `exploração` de novo hoje é a prova de que dado sujo entrou depois — a forma canônica
do projeto é **Capitalizada**, definida por aquela migration.

Este gap conecta ao **Gap 5**: `Tema(s)` passará a alimentar `setting_styles` pelo mesmo
`splitFreeTextList`. Corrigir o Gap 5 sem normalizar aqui **aumentaria** a entrada de dado
sujo, porque abre uma fonte nova para o mesmo campo.

---

### Gap 11 — Página pública da mesa esconde campo que o mestre preencheu

Relato do mantenedor (2026-08-19), sobre `mesas.artificiorpg.com/mesas/kingmaker-mt0fk7lb`:
"a quantidade de jogadores e a quantidade de vagas nem sequer aparecem".

**Regra dada pelo mantenedor, que passa a valer para a página inteira:** *"no draft tem os
obrigatórios e os opcionais. Tudo que é preenchido tem que ser mostrado. O que não é
preenchido, não mostra."*

Levantamento completo: dos 78 campos do ViewModel, a maioria **já é exibida** e já segue
essa regra — `TableTechnical.tsx:34-45` é o padrão (`{vm.campaignLength && (…)}`). O buraco
é pontual: **6 campos de conteúdo que o mestre preenche e a página nunca mostra.**

| Campo | Situação |
|---|---|
| `slotsTotal`, `slotsFilled`, `slotsOpen` | nunca renderizados |
| `city`, `state` | nunca renderizados |
| `language` | nunca renderizado |
| `scenario` | nunca renderizado |
| `actualGmName` | já renderizado no card do mestre (`MesaPage.tsx:159`, para mesa `announcer`) — não é buraco desta fase |

**Causa das vagas — remoção deliberada, com raciocínio incompleto.** `TableActionPanel.tsx:128-129`
traz o comentário: *"Vagas removida daqui (T4.3) — duplicava o aviso de urgência acima
(`vm.urgency.label`, '🔥 Últimas N vagas') que já cobre o mesmo dado com mais contexto."*

O aviso de urgência (`tableViewMapper.ts:96-141`) é uma escada de 6 ramos, e **três deles
não citam vaga alguma**:

| Condição | Rótulo | Mostra número? |
|---|---|---|
| `status === 'cancelled'` | ⏸️ Mesa desativada | **não** |
| `status === 'ended'` | 🏁 Mesa encerrada | **não** |
| `slotsLeft === 0` | ❌ Mesa lotada | **não** |
| `slotsLeft <= 2` | 🔥 Últimas N vagas | sim |
| `slotsLeft <= 5` | ⚠️ N vagas restantes | sim |
| resto | N vagas disponíveis | sim |

Quem removeu olhou os três últimos ramos. Nos três primeiros a informação some.

**E o total nunca existiu na página, em ramo nenhum.** O mestre declara "mesa de 5
jogadores, 2 vagas abertas"; a página, no melhor caso, diz "🔥 Últimas 2 vagas". O leitor
não descobre se entra num grupo de 3 ou de 8 — `slotsTotal` não é renderizado em lugar
nenhum (`vm.slotsTotal` → zero ocorrências fora do mapper).

**O caso mais grave não é vaga, é `city`/`state`:** mesa presencial sem local publicado é
inútil para quem lê — a pessoa não tem como saber se é na cidade dela.

**Não medido:** quantas mesas em produção têm cada campo preenchido, e se o Kingmaker
citado tem os dados. Exigiria `SELECT` em produção (leitura). Isso muda a prioridade de
cada campo, não a decisão de exibi-lo.

---

## Requisitos

| ID | Requisito | Gap |
|---|---|---|
| **R1** | O preview de draft oferece "Copiar anúncio" reusando `CopyAnnouncementButton`, sem terceira reimplementação do gerador. | 1 |
| **R2** | O botão de R1 só é renderizado quando a mesa vinculada está publicada (`status === 'active'`), coerente com `isTableAnnounceable` e com `ConteudoSection.tsx:298`. | 1 |
| **R3** | As 10 VTTs da lista canônica têm alias válido, incluindo Roll20, TaleSpire, Quest Portal e Tableplop, hoje com zero. | 2 |
| **R4** | Fantasy Grounds reconhece as formas curtas e a linha Classic, não só `Fantasy Grounds`/`FGU`. | 2 |
| **R5** | Todas as 10 funções da aba "Mesas" de `/gestao/catalogo` passam a existir em `/gestao/mesas`, sem perda: busca, 2 facetas, 3 ações em lote, 4 ações por linha. | 3 |
| **R6** | Não resta aba "Mesas" duplicada entre as duas rotas ao fim da spec; quem acessar o caminho antigo não encontra link morto. | 3 |
| **R7** | Data no corpo do anúncio (`DD/MM`, `DD/MM/AAAA`) nunca é lida como par de vagas. | 4 |
| **R8** | Linha com sinal semântico de vaga (`disponíveis`, `ocupadas`) vence linha genérica, independentemente da ordem de aparição no texto. | 4 |
| **R9** ‡ | O anúncio do Gap 4 produz as vagas declaradas no texto (`1 disponível de 4`), não `25`. | 4 |
| **R10** | O rótulo `Tema(s)`/`Tema`/`Temas` alimenta `setting_styles` e deixa de sobrar na descrição. | 5 |
| **R11** | As abas Bruto e Normalizado têm botão de copiar o conteúdo integral exibido, acessível sem rolar. | 6 |
| **R12** | `/gestao/mesas` ganha aba "Descartados" listando `status='rejected'`, com ver, **restaurar** e limpar definitivo. Editar exige restaurar antes — guard 422 mantido (D5b). | 7 |
| **R13** | Draft descartado pode ser restaurado pela UI, reexecutando a normalização — `ready` sem campo faltando, `needs_review` com; nunca `draft` (D5a). | 7 |
| **R14** | Nenhum `.sql` do app mesas vive fora dos diretórios da allowlist; `006_create_vtt_platforms.sql` e `007_click_tracking.sql` passam a existir sob o contrato, com header de 5 campos e forma idempotente. | 8 |
| **R15** | O guard `_enforce-migration-dir.yml` deixa de ter ponto cego para arquivo pré-existente fora da allowlist. | 8 |
| **R16** | As 5 plataformas de `communication_platforms` têm alias, pelo mesmo mecanismo das VTTs. | 9 |
| **R17** | Todos os controles da fileira principal de filtros têm a mesma altura; nenhum elemento fica em dente de serra. | 10 |
| **R18** | O painel de filtros reduz o ruído de borda, delimitando área clicável por superfície em vez de traço, sem perder foco visível nem contraste de acessibilidade. | 10 |
| **R19** | `setting_styles` é normalizado **na escrita** — nos **4** pontos que gravam o campo, não só no parser. **Entregue na Fase 3**, junto da mudança que abre `Tema(s)` como fonte nova. | 5, 10 |
| **R20** | Estilo já sujo no banco é normalizado — capitalização, pontuação **e typo** —, e o filtro deixa de exibir dois chips para o mesmo estilo. | 10 |
| **R21** | A página pública da mesa exibe **todo** campo que o mestre preencheu, e omite o que ficou vazio — regra do mantenedor, valendo para a página inteira, não só para os campos abaixo. | 11 |
| **R22** | Vagas aparecem com o total, não só o restante: quem lê sabe que a mesa é de N jogadores e tem M abertas, inclusive quando ela está lotada, cancelada ou encerrada. | 11 |
| **R23** | Mesa presencial ou híbrida publica cidade e estado. | 11 |
| **R24** | Idioma, cenário e nome real do mestre aparecem quando preenchidos. | 11 |

‡ **R9 exige capacidade nova, não só o guard.** A auditoria (Fase 1 achado 2) mediu que
nenhuma das 9 estratégias reconhece `"N disponível de M"`. Com o guard de data, o parser
deixa de errar mas passa a devolver `{null, null}` — R9 só é atendido com a **Camada D**
(`plan.md` §Fase 1).

---

## Decisões

### Do mantenedor (2026-08-19) — produto

**D1 — Botão de anúncio no draft: só após publicar.** Perguntado com três opções medidas,
o mantenedor escolheu renderizar o botão apenas quando a mesa está `active`. Alternativas
descartadas: sempre visível desabilitado com tooltip; e afrouxar `isTableAnnounceable`
(esta última geraria anúncio com link para mesa 404). → **R2**

**D4 — Escopo: tudo nesta spec.** Perguntado se os achados laterais (Gaps 8 e 9) entravam
aqui, viravam spec própria ou débito, o mantenedor respondeu "tudo nessa spec". → **R14, R15, R16**

### Do agente — técnicas, decididas por medição

Registradas aqui porque mudam o desenho, **não** porque exijam resposta do mantenedor.
`AGENTS.md` §"O mantenedor não é programador" e §Bug achado item 203: escolha cuja resposta
está no repositório é medição pendente, não pergunta. As duas abaixo foram inicialmente
levadas ao mantenedor por erro do agente; ele respondeu, e as respostas coincidem com o que
a medição indica — ficam registradas com o fundamento técnico que deveria tê-las decidido.

**D2 — Aliases em tabela, não no mapa hardcoded.** Revisada após o Gap 8. Fundamento
medido, em três pontos:

1. O padrão do repo para alias já existe e é tabela: `system_aliases`
   (`migration_02`), `scenario_aliases` (`migration_107`), ambas com
   `alias`/`alias_slug`/índice. Manter um `Record` hardcoded para VTT é a
   "exceção por app" que `AGENTS.md` §Compartilhado por padrão nomeia como defeito.
2. Existe CRUD admin de VTT (`vttPlatforms.ts:202/265/359`). Com mapa hardcoded, **toda VTT
   criada pelo painel nasce sem alias e sem como ganhar um** — o defeito se reproduz por
   uso normal do produto, não por regressão.
3. O próprio código admite o risco que só a tabela elimina (`shared.ts:57-59`): se slug ou
   name divergir do banco, o alias vira `[]` **em silêncio**.

Como o Gap 8 já obriga a mexer em migration (R14), o argumento de "evitar migration" que
sustentava o mapa deixou de valer. → **R3, R4, R16**

**D3 — Aba Descartados: reusar `DiscordDraftReviewTable`.** Fundamento medido: o componente
já tem `statusFilter` (linha 101), seletor (linha 324) e `handlePurgeRejected` (263-281).
Componente próprio duplicaria listagem, paginação e filtro de origem — o defeito que o Gap 3
existe para corrigir. **Esta parte permanece decisão técnica.** → **R12**

*(Correção da auditoria, Fase 5 achado 1: a versão anterior afirmava "restaurar é o único
item ausente". Falso — restaurar **já funciona** pelo preview. R13 é atalho, não capacidade
nova.)*

**D5 — Destino da restauração, e o que "editar descartado" significa.** **Respondida pelo
mantenedor em 2026-08-19:** seguir a melhor prática de mercado para moderação — *soft-delete
com restauração ao estado anterior*, em que descartar não destrói informação e restaurar
devolve o item ao fluxo sem inventar estado que ele nunca teve. Reclassificada de técnica
para produto pela auditoria (transversal 8); o `CHECK` da `migration_118` só restringe
`ready` (`status <> 'ready'`), então não decidia nada. Os três pontos, decididos:

1. **Destino: recalcular a normalização, não fixar status.** A task fixava `needs_review`
   para todo restaurado. Contradiz a semântica medida em `normalizeDiscordTableDraft.ts:92`
   (`status: missingFields.length === 0 ? 'ready' : 'needs_review'`): `needs_review` é estado
   **derivado** de "faltam campos", não fila de moderação. Fixá-lo fabrica pendência
   inexistente e manda o revisor procurar campo que nunca faltou. Restaurar reexecuta a
   normalização: sem campo faltando → `ready`; com → `needs_review`. `draft` fica de fora —
   é estado de entrada do pipeline, não de retorno.
2. **R12 vira "ver, restaurar e limpar"; o guard 422 permanece.** `registerDraftCorrection`
   (`routes/discord/utils.ts:184`) recusa correção em `rejected`, simétrico ao `:183` que
   protege `synced`. Editar descartado produz registro que ninguém revisou naquele conteúdo —
   exatamente o que o padrão evita. O caminho correto já existe e custa um clique: restaurar,
   depois editar, com o item de volta sob revisão. Afrouxar o guard trocaria trava deliberada
   por conveniência.
3. **`POST /:id/reparse` sobre `rejected`: barrar.** Hoje (`drafts.ts:381`) bloqueia só
   `synced`, então sobrescreve `rejected` sem gate — segundo caminho de des-descartar,
   silencioso, que contradiz o item 2: o guard de correção recusa 422 enquanto o reparse
   reescreve o mesmo registro. Passa a exigir restauração explícita antes, estendendo a
   `rejected` o mesmo gate do `:183`.

→ **R12, R13**

---

## Fora de escopo

- Qualquer alteração no gerador de texto do anúncio (`buildWhatsAppTableAnnouncement`).
- Reescrita do parser fora dos dois defeitos nomeados (Gap 4 e Gap 5).
- Reaplicar `006_`/`007_` como migrations novas: os objetos **já existem em produção**
  (medição no Gap 8), então a correção é reconciliação, não reexecução.
- Outros apps que possam ter `.sql` fora da allowlist — R15 fecha o ponto cego do guard
  para o repo todo, mas o passivo de outros apps não foi levantado nesta spec.

---

## Critérios de aceite

1. Draft sincronizado **e publicado** mostra "Copiar anúncio" no preview; o texto copiado é
   idêntico ao produzido pelo mesmo botão na aba Mesas do catálogo. Draft sincronizado e
   **não** publicado não mostra o botão.
2. Teste do parser com o texto real do Gap 4 devolve as vagas declaradas no corpo, e
   `_slots_ambiguity` não registra `first: 25`.
3. Teste com `"Tema(s): a, b, c"` devolve `setting_styles` com os três itens e descrição sem
   a linha do rótulo.
4. Anúncio contendo `"Roll 20"`, `"R20"`, `"TaleSpire"`, `"Quest Portal"`, `"Tableplop"`,
   `"FG"` e `"Fantasy Grounds Classic"` resolve a VTT correta.
5. `/gestao/mesas` expõe as 10 funções da aba Mesas do catálogo, e `/gestao/catalogo` não tem
   mais a aba duplicada.
6. Abas Bruto e Normalizado copiam o JSON integral em um clique, com o botão alcançável sem
   rolagem.
7. `/gestao/mesas/descartados` lista, permite ver/editar, restaurar e limpar definitivamente.
8. Nenhum `.sql` sob `apps/mesas/backend/migrations/`; os dois arquivos existem sob
   `apps/mesas/database/` com header de 5 campos válido, e `_enforce-migration-dir.yml`
   passa. A migration de reconciliação roda **duas vezes sem erro** (idempotência,
   `AGENTS.md` §Migrations item 2) e não recria objeto que já existe em produção.
9. O guard de diretório falha quando existe `.sql` fora da allowlist, mesmo sem ele ter sido
   tocado no diff do PR.
10. Anúncio citando "Google Meet", "Teams", "Telegram" ou "Zoom" resolve a plataforma de
    comunicação correta.
11. Todos os controles da fileira principal de filtros medem a mesma altura; verificação
    visual com o mantenedor antes do PR (aparência de página pública é decisão dele).
12. Duas mesas com `exploração` e `Exploração` produzem **um** chip no filtro após a
    migration, e o parser passa a gravar a forma canônica — sem uso de `capitalize` como
    correção do dado.
13. Na página da mesa, todo campo preenchido pelo mestre aparece e todo campo vazio some —
    incluindo vagas com total ("2 de 5"), local de mesa presencial, idioma, cenário e nome
    real do mestre. Mesa lotada, cancelada ou encerrada continua mostrando as vagas.
14. `rtk pnpm run lint`, `build` e `test` verdes; `pnpm verify:api` verde.
