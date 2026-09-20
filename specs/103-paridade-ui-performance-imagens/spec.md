# Spec 103 — Paridade de header, performance de imagem e defeitos visíveis

**Status:** aberta · **Criada:** 2026-09-16 · **Apps:** `apps/site`, `apps/mesas`,
`apps/downloads`, `apps/links`, `apps/glossario`, `packages/ui`, `packages/media`
**Origem:** complemento da spec 102. Achados reportados pelo mantenedor depois da
rodada de deploy de produção de 2026-09-16, com o Lighthouse do `mesas` em anexo.

---

## 1. Problema

Quatro defeitos, todos visíveis para o usuário final, nenhum coberto por teste do repo:

1. O header **não** tem a mesma aparência entre os módulos, embora a lista de projetos
   seja a mesma em todos.
2. A busca do portal exibe `` `}{` `` literal na página.
3. O `mesas` entrega imagens sem nenhuma transformação — 15.807 KiB por carregamento,
   LCP de 5,9 s no Lighthouse móvel.
4. Dois botões reprovam contraste na auditoria de acessibilidade.

O alvo de paridade é o **`mesas`**, definido pelo mantenedor: os demais módulos
convergem para ele, não o contrário.

---

## 2. Evidência medida

Todas as medições desta seção são de **2026-09-16, contra produção**, com
`?cb=$(date +%s%N)` onde a medição foi por HTTP (a borda da Cloudflare serve
`max-age=7200`, e sem o cache-buster o que se mede é o cache, não a origem).

A geometria foi medida com Playwright (browser próprio, sem a sessão do mantenedor),
viewport **1440×900**, `getComputedStyle` + `getBoundingClientRect` no DOM já
hidratado — `curl` não alcança: `glossario` e `downloads` são SPAs que servem
1.852 e 2.136 bytes de HTML inicial, com `<div id="root">` vazio e zero `<nav>`.

### 2.1 Achado A — a lista do nav é idêntica; a aparência não

**O que NÃO é o defeito** (hipótese medida e descartada, para ninguém reinvestigar):

- A lista de itens é a **mesma** nos 5 apps: Portal, Glossário, Mesas, Downloads,
  Esferas, SRD, WhatsApps. Fonte única em `packages/ui/src/modules.ts:8`
  (`defaultNavItems`).
- **Nenhum app sobrescreve `navItems`**: `rtk rg "navItems" apps --type ts` (excluindo
  testes) devolve **zero** linhas. Todos caem no default.
- Todos usam o `Header` de `packages/ui` — inclusive o `glossario`, cujo
  `GlossarioHeader.tsx` apenas o embrulha (`import { Header } from '@artificio/ui'`,
  linha 3). Não há header duplicado.
- A geometria do nav principal é **idêntica ao centésimo de pixel** em `site`,
  `mesas`, `links` e `glossario`:

  ```
  grid-template-columns: 90px 1015px 128px 96px   (os 4 iguais)
  gap: 16px · padding: 0 24px · min-height: 64px · altura real: 64px
  .artificio-nav-list: display flex, gap 4px, padding 0
  link: padding 10px 12px, font-size 14px, border-radius 6px 6px 0 0
  larguras: 61.69 / 82.36 / 63.77 / 94.8 / 68.08 / 50.39 / 96.39
  brand x:24 w:90 · tools x:1161 w:128
  ```

**O que É o defeito**, medido:

| app | grid do header-main | altura | peso | cor do link | subnav |
|---|---|---|---|---|---|
| **`mesas` (alvo)** | `90px 1015px 128px 96px` | 64px | 500 | `rgba(255,255,255,.75)` | 1 item |
| `site` | `90px 1015px 128px 96px` | 64px | **600** | `rgb(2,7,64)` | 4 itens |
| `links` | `90px 1015px 128px 96px` | 64px | 500 | `rgb(90,97,114)` | nenhuma |
| `glossario` | `90px 1015px 128px 96px` | 64px | 500 | `rgb(90,97,114)` | nenhuma |
| `downloads` | **`96px 789px 360px 84px`** | **100px** | 500 | `rgba(255,255,255,.75)` | nenhuma |

Três divergências distintas, com causas distintas:

**A1 — `downloads`: o botão "Entrar" quebra para a segunda linha, à esquerda.**

```
downloads:  .artificio-session  x:24   y:60   (2ª linha, canto esquerdo, sob a marca)
mesas/site: .artificio-session  x:1305 y:12   (1ª linha, à direita)
```

Causa medida: o `downloads` liga a busca embutida do header
(`.artificio-header-search` presente, 360px de largura em `x:941`). A regra
`.artificio-header-main[data-has-search="true"]` (`packages/ui/src/styles.css:555`)
troca o grid para `auto minmax(0,1fr) minmax(220px,360px) auto`. Em 1440px as quatro
colunas não cabem, e a coluna de sessão é empurrada para a linha de baixo — o que
também explica a altura de 100px em vez de 64px.

É **defeito de layout, não escolha de produto**: nenhuma configuração pede que o login
mude de canto.

**A2 — peso e cor do link divergem.** Peso 600 no `site` contra 500 nos outros quatro.
Cor em três valores: `rgba(255,255,255,0.75)` (mesas, downloads), `rgb(2,7,64)` (site),
`rgb(90,97,114)` (links, glossario).

A cor não vem de `variant` no `Header` — medido: `data-variant` é `null` em todos, e
nenhum app passa a prop. Vem do token `--artificio-surface`/`--artificio-ink` do tema
do documento (`data-theme`), que difere por app.

**A3 — a subnav tem conteúdo de natureza diferente.** A caixa é a mesma
(`y:64`, altura ~39px, pílula `border-radius:999px`, 13px, padding `8px 10px`), o
conteúdo não:

```
site:   4 itens — Notícias, Análises, Guias, Downloads
        peso 500 · bg rgb(246,247,250) · aria-label "Seções do blog"
mesas:  1 item  — Catálogo
        peso 600 · bg rgba(255,255,255,.06) · aria-label "Mesas"
links / glossario / downloads: sem subnav
```

O `site` usa a faixa para navegar o acervo; o `mesas` gasta a faixa inteira com um
único link. **Decisão de produto pendente** — ver §4.

### 2.2 Achado B — `` `}{` `` literal na busca do portal

Medido no HTML servido de `https://artificiorpg.com/busca/`, dentro de
`<script type="text/pagefind-template">`:

```
        {`<li class="pf-result">
          ...
        </li>`}
```

As chaves e os backticks chegam ao usuário como texto. Causa, confirmada nas duas
docs oficiais:

- **Pagefind** (`pagefind.app/docs/components/results/`): o corpo do template é HTML
  **cru**. O exemplo oficial não tem backtick nenhum.
- **Astro** (`docs.astro.build/en/reference/directives-reference/`): *"The `is:inline`
  directive is implied whenever any attribute other than `src` is used on a `<script>`
  or `<style>` tag."* O nosso script tem `type`, logo é inline, logo o Astro **não
  avalia** `{...}` ali — copia caractere por caractere.

Falha em **silêncio**: build verde, `dist` gerado, defeito só visível no resultado
renderizado. Nenhum teste do repo alcança.

Arquivo: `apps/site/src/pages/busca/index.astro:87` e `:96`.

### 2.3 Achado C — imagens do `mesas` sem transformação

Lighthouse móvel (Moto G Power emulado, 4G lento), `mesas.artificiorpg.com`,
2026-09-16 14:42 BRT: **Desempenho 70**, LCP **5,9 s**, FCP **3,6 s**,
payload total **15.807 KiB**, economia estimada em imagens **10.644 KiB**.

Medido no HTML de produção: **nenhuma** URL do Cloudinary carrega transformação. O
caminho é sempre `/image/upload/v<versão>/<pasta>/<id>`, sem `f_auto`, `q_auto` nem
`w_`. O original é entregue inteiro — PNG de 3.424,7 KiB num slot de 735×413.

Ganho medido num avatar real do acervo (`artificio_avatars/kvhuqt6nbmeti1szb5pq.jpg`,
715×893 servido num slot de 39×39):

```
original                      200  69.899 bytes  image/jpeg
f_auto,q_auto,w_78 (vírgula)  200   2.008 bytes  image/webp
q_auto/f_auto/w_78 (barra)    200   2.008 bytes  image/webp
```

**97% de redução** num único arquivo. As duas sintaxes devolvem bytes idênticos; a
doc do Cloudinary usa a forma com barra.

`packages/media` já aplica transformação — mas só no **upload**
(`storageTransformation`, `packages/media/src/imageKinds.ts`). Na **entrega**, nada.

Ponto de render único: `apps/mesas/frontend/src/components/CroppedImage.tsx:73`, um
`<img src>` sem `srcset`.

### 2.4 Achado D — contraste insuficiente em dois botões

Lighthouse, Acessibilidade **95**, categoria Contraste:

- `#btn-anunciar-mesa-home` — `apps/mesas/frontend/src/pages/CatalogoPage.tsx:417`
- `#catalog-search-submit` — `apps/mesas/frontend/src/components/CatalogFiltersBar.tsx:282`

Os dois pintam com tokens `--color-*` de `packages/ui`. Sendo token compartilhado, o
defeito alcança os 6 apps, não só o `mesas`. **Não medi** o valor de contraste de cada
token nem quais outros componentes usam os mesmos — fica para a execução.

Mesma auditoria aponta ordem de heading fora de sequência (`<h3>` sem `<h2>` antes)
nos cards do catálogo. **Não investiguei** a origem.

---

## 3. Fora de escopo

- **Reescrever o `Header` de `packages/ui`.** A medição mostra que ele já produz
  geometria idêntica; o defeito está nos tokens de tema e na coluna de busca.
- **Trocar `object-position` por crop do Cloudinary.** Ver §4 de `plan.md`.
- Demais itens do Lighthouse (JS não usado, cache TTL do beacon da Cloudflare,
  árvore de dependência crítica): **não medidos**, não entram sem medição.

---

## 4. Decisões de produto pendentes

Nenhuma destas se resolve medindo. Ambas foram feitas ao mantenedor em
2026-09-16 e **não respondidas até o momento da escrita desta spec**. Não há
decisão registrada — o que segue são as opções, não uma escolha.

**D1 — a subnav do `mesas` tem um item só.** Sendo o `mesas` o alvo de paridade, o
padrão do monorepo passa a ser "faixa dedicada a um link"? Ou a subnav do `mesas`
deveria listar as seções do módulo, como o `site` lista as do blog?

**D2 — qual cor de header vira padrão.** `mesas` é texto branco sobre azul
(`rgb(27,42,74)`); `site` é azul-escuro sobre branco. São temas opostos. Convergir
para o `mesas` muda o header do portal — a página que mais recebe gente — de branco
para azul escuro.

---

## 5. Critérios de aceite

Cada critério é medível, e a medição é a mesma da §2.

| # | Critério | Como se mede | Estado |
|---|---|---|---|
| A1 | `.artificio-session` na 1ª linha, à direita, nos 5 apps | `getBoundingClientRect().y` < 60 em 1440px | aberto |
| A2 | peso e cor do link do nav iguais aos do `mesas` nos 5 apps | `getComputedStyle` do link | **bloqueado por D2** |
| A3 | subnav com política única | definida por D1 | **bloqueado por D1** |
| B | zero `` ` `` e zero `{`/`}` soltos no template servido de `/busca/` | HTML de produção com cache-buster | aberto |
| C1 | toda URL do Cloudinary no `mesas` com `f_auto` e `q_auto` | HTML de produção | aberto |
| C2 | economia de imagem do Lighthouse < 1.000 KiB (era 10.644) | Lighthouse móvel | aberto |
| C3 | LCP móvel < 2,5 s (era 5,9 s) | Lighthouse móvel | aberto |
| D | zero reprovação de contraste | Lighthouse, Acessibilidade | aberto |

C2 e C3 dependem de execução em campo; o Lighthouse varia entre rodadas, então a
medição de fechamento é a mediana de 3 execuções, não uma.

---

## 6. Feature extra — filtros de dia da semana e faixa de horário no catálogo do `mesas`

**Origem:** sugestão de usuário anônimo enviada pelo formulário de reporte em
2026-09-08 12:01:02, página `/` do `mesas`, tela 3062×1550, Chrome 152 no Windows:
*"Sugiro que acrescentem um filtro para o dia da semana em que a mesa vai jogar."*

Não é defeito: o filtro nunca existiu. Entra na 103 como feature extra por decisão
do mantenedor em 2026-09-18, que na mesma decisão pediu também um filtro por **faixa
de horário** (manhã, tarde, noite, madrugada) — §6.4. O filtro por dia vem do
anônimo; o de horário, dele.

O mesmo reporte trazia duas falhas de rede `401 GET
https://accounts.artificiorpg.com/api/auth/refresh`. Não é defeito: o reporter é
`Anonimo (visitor)`, e `packages/auth/src/client.ts:31` chama `/api/auth/refresh`
com `credentials: "include"` no boot de todo app. Visitante sem cookie de sessão
recebe `401` — resposta correta do contrato, não erro a corrigir.

### 6.1 O que já existe (medido em 2026-09-18)

O dado está no banco e já viaja até o card. O que falta é filtrar por ele — mas ele
não está **todo** em `table_schedules`, e §6.2 mede por quê. Ler as duas seções
juntas: esta sozinha leva ao filtro que perde 9 mesas.

- Coluna `table_schedules.day_of_week TEXT NOT NULL`, com
  `CHECK (day_of_week IN ('segunda','terça','quarta','quinta','sexta','sábado','domingo'))` —
  `apps/mesas/database/migration_12_table_schedules.sql:16`.
- Índice `idx_table_schedules_day ON table_schedules(day_of_week)` já criado na mesma
  migration, linha 29. **Nenhuma migration nova é necessária.**
- A lista do catálogo já lê `table_schedules` numa segunda query, depois da
  paginação, e compõe `next_schedule` por mesa — `apps/mesas/backend/src/routes/tables.ts:374-397`.
- O card já renderiza a agenda — `apps/mesas/frontend/src/components/TableCard.tsx:238`.

O que **não** existe, medido: `rtk rg "day_of_week|schedule" ` em
`CatalogFiltersBar.tsx`, `CatalogAdvancedFilters.tsx` e `FilterDrawer.tsx` devolve
**zero** linhas. `CatalogFilters` (`apps/mesas/frontend/src/services/catalogService.ts`)
tem `search, system, modality, priceType, experience, seal, styles, type, sort, page,
limit` — nenhum campo de dia. Nem parser, nem builder de URL
(`utils/catalogFilters.ts`), nem o registro canônico de opções
(`utils/catalogFilterOptions.ts`).

### 6.2 O dado NÃO está todo em `table_schedules` — medido em produção

Revisão adversarial de 2026-09-18, contra o banco de produção (`mesas-db`,
`psql -U admin -d mesas_rpg`, read-only). Derruba a premissa de §6.1 de que basta
filtrar `table_schedules`:

```
mesas ativas (status='active', archived_at IS NULL) ............ 88
  com linha em table_schedules ................................. 67
  SEM linha em table_schedules ................................. 21   (24%)
    dessas, com tables.schedule_day_hint preenchido ............. 9
    dessas, com tables.schedule_time_hint preenchido ............ 1
```

Quebra por status, nas 21 sem linha:

```
to_define / to_define · sem hint ............ 11
defined  / to_define · dia "sábado" .........  8
defined  / to_define · dia "sexta" ..........  1
to_define / defined  · hora 19:00:00 ........  1
```

A causa está em `apps/mesas/frontend/src/features/table-editor/utils/editorMapping.ts:186-202`
(`deriveSchedule`): uma linha de `table_schedules` exige dia **e** horário, porque as
duas colunas são `NOT NULL` (`migration_12:16-17`). Faltando um dos eixos, o editor
grava `schedules: []` e guarda o eixo conhecido em `tables.schedule_day_hint` /
`schedule_time_hint` — colunas criadas pela `migration_124_table_schedule_tbd.sql`,
posterior à 12.

A semântica do hint é o oposto do que o nome sugere: o `CHECK`
`tables_schedule_tbd_hint_check` (migration 124) **proíbe** hint no eixo `to_define`.
Hint preenchido significa eixo **`defined`** — é o dia real da mesa, exibido no card.

**Consequência para esta feature:** um filtro que consulte só `table_schedules` perde
**9 mesas ativas cujo dia é conhecido e está na tela**. O usuário filtra "sábado",
não vê 8 mesas de sábado que o catálogo mostra sem filtro, e conclui que o filtro
está quebrado — está: filtro que esconde resultado válido é pior que filtro ausente.

O filtro de dia precisa alcançar `table_schedules.day_of_week` **e**
`tables.schedule_day_hint`; o de horário, `table_schedules.start_time` **e**
`tables.schedule_time_hint`. Sem índice sobre os hints — medido, a migration 124 não
cria nenhum.

### 6.3 Onde o filtro entra no backend

A query da lista (`tables.ts:150-330`) não faz join com `table_schedules` — o
schedule só é buscado depois, para as mesas já paginadas. Um filtro por dia precisa
entrar **antes** da contagem (`tables.ts:321`), senão a contagem e a paginação
divergem do resultado. Mesmo motivo já registrado no comentário de
`importedTableIsCurrentSql` na linha 209: filtro de memória deixa buraco na página.

A forma é `EXISTS (SELECT 1 FROM table_schedules ts WHERE ts.table_id = t.id AND
...) OR <condição sobre os hints de `t`>` — §6.2 mede por que o `EXISTS` sozinho
perde 9 mesas.

`EXISTS`, não join: join com `table_schedules` duplica a linha da mesa com mais de um
horário, e o `COUNT(DISTINCT t.id)` da linha 324 mascara a duplicata na contagem mas
não no `SELECT` da linha 332.

Medido em produção: hoje **não existe** mesa ativa com 2 linhas — 67 sessões para 67
mesas distintas. O `EXISTS` continua sendo a forma certa: nada no schema impede a
segunda linha (a tabela existe justamente para "múltiplos horários por mesa", comentário
da migration 12), e o editor preserva linhas extras de mesa legada
(`editorMapping.ts:162-165`). Escolha por correção sob o schema, não por sintoma
observado.

### 6.4 Contrato do filtro

Segue R6 da spec 094: valor válido vive só em `catalogFilterOptions.ts`, e parser,
builder, mapper e UI importam de lá. Segunda lista em qualquer outro arquivo é
proibida.

- Query param: `weekday`, multivalor separado por vírgula, mesma forma de `styles`
  (`catalogFilters.ts`: split, decode, dedupe, sort).
- Valores: as 7 formas curtas canônicas do `CHECK` da migration 12, exatamente como
  gravadas, com acento (`terça`, `sábado`). Não inventar código numérico — o banco
  guarda texto, e um id paralelo criaria tradução (AGENTS.md §Compartilhado por padrão).
- Semântica de múltipla escolha: OU (mesa que joga em qualquer um dos dias marcados),
  igual a `styles` (`tables.ts:258`).

### 6.5 Filtro por faixa de horário

Pedido do mantenedor em 2026-09-18, junto do filtro por dia: quatro faixas —
**manhã, tarde, noite e madrugada**.

Mesma tabela, coluna irmã: `table_schedules.start_time TIME NOT NULL`
(`migration_12_table_schedules.sql:17`), tipada como `string` `"HH:MM:SS"` em
`apps/mesas/backend/src/db/types.ts:378`. `end_time` existe e é `nullable` (linha 379)
— a faixa se decide pelo **início** da sessão, que é o campo obrigatório. Mesa que
começa 23h e varre a madrugada conta como noite, não como duas faixas.

Índice: `migration_12` cria `idx_table_schedules_day` sobre `day_of_week` (linha 29)
e `idx_table_schedules_table_id` sobre `table_id` (linha 28); **não** cria índice
sobre `start_time` — medido. A `migration_124` não cria índice sobre os hints.
Com 88 mesas ativas e 67 sessões, **não se cria índice sem medir** que a query
precisa dele.

**Distribuição real das faixas** (produção, mesas ativas, corte 06/12/18/24):

```
noite     54 sessões / 54 mesas
tarde     11 sessões / 11 mesas
manhã      2 sessões /  2 mesas
madrugada  0 sessões /  0 mesas
```

`min(start_time)=08:00`, `max=22:00`. **Madrugada tem zero mesas** — ver D6.

Os limites das quatro faixas são decisão de produto, não de medição — ver D5.

O filtro de horário compartilha o `EXISTS` do filtro de dia (§6.2). Dia e faixa
marcados juntos são **a mesma sessão**: mesa que joga sexta de manhã e domingo à
noite **não** entra em `weekday=sexta` + `daypart=noite`. Duas condições em `EXISTS`
separados dariam o resultado errado — é a mesma armadilha do join da §6.2, com outro
sintoma.

### 6.6 Decisões de produto pendentes — D4, D5 e D6

**D4 — mesa com dia ou horário realmente "a definir".** Medido em produção: **11
mesas ativas** com `schedule_day_status='to_define'` **e**
`schedule_time_status='to_define'`, sem hint nenhum — dia e horário desconhecidos de
fato (§6.2).

Essas 11 não têm o que casar com filtro algum. Somem em silêncio, ou o filtro ganha
uma opção "A definir" que as traz? Escolha de produto sobre expor ou esconder mesa
incompleta na busca. **Não respondida.**

Atenção ao que **não** é D4: as 9 mesas com `defined` + hint têm dia conhecido e
entram no filtro normalmente. Isso é correção de §6.2, não decisão dele.

**D5 — os limites das quatro faixas.** Manhã, tarde, noite e madrugada não têm
fronteira técnica; a que a execução adotar vira contrato de URL e de resultado. A
proposta abaixo é **sugestão não aprovada**, escrita para haver o que confirmar ou
corrigir:

| faixa | `start_time` |
|---|---|
| manhã | `[06:00, 12:00)` |
| tarde | `[12:00, 18:00)` |
| noite | `[18:00, 24:00)` |
| madrugada | `[00:00, 06:00)` |

Cobrem as 24 h sem sobreposição e sem buraco — requisito técnico, não escolha: faixa
que se sobrepõe faz a mesma mesa aparecer em duas, e buraco faz mesa sumir de todas.
Os **horários de corte** são a escolha dele. **Não respondida.**

Dado novo para a decisão: o corte `06:00` da manhã não é neutro. Produção vai de
`08:00` a `22:00`, mas o **beta** tem sessão às `05:00` — que no corte proposto cai
em "madrugada". O banco aceita qualquer `TIME`; nada no schema impede `03:00`.

**D6 — a faixa "madrugada" entra com zero resultados?** Medido: 0 sessões em
produção, contra 54 noite, 11 tarde, 2 manhã. A política R22/D0.2 da spec 094 já
decidiu o caso geral — *"opções com zero resultados não aparecem"*
(`specs/olds/094-mesas-filtros-catalogo/spec.md:135`) — e ela também alcançaria a
manhã se o critério for "dois valores úteis".

Aplicar R22 aqui significa que o filtro nasce com **2 opções** (noite, tarde) das 4
pedidas. Manter as 4 contraria uma política aprovada. Ele pediu as quatro por nome,
então a contradição vai para ele resolver, não para o agente escolher.

Mesmo caso nos dias: `quinta` e `terça` têm 5 sessões cada; nenhum dia tem zero.
O filtro de dia nasce com os 7.

### 6.7 Critérios de aceite da feature

| # | Critério | Como se mede | Estado |
|---|---|---|---|
| E1 | `weekday=sexta` devolve só mesas com sessão na sexta | teste de rota contra `tables.ts`, asserindo o `EXISTS` no SQL gerado | aberto |
| E2 | contagem e paginação batem com o filtro | `COUNT` e `data.length` da mesma query filtrada, mesa com 2 dias no fixture | aberto |
| E3 | `weekday=sexta,domingo` é OU, sem linha duplicada | mesa que joga sexta E domingo aparece uma vez | aberto |
| E4 | valor inválido na URL é ignorado, não quebra | `weekday=funday` cai no vazio, igual aos outros enums | aberto |
| E5 | filtro funciona no desktop (aplica direto) | Playwright 1440×900, marcar dia, URL e resultado mudam sem clicar Aplicar | aberto |
| E6 | filtro funciona no mobile (draft + Aplicar) | Playwright 390×844, drawer abre, marca dia, só aplica no botão | aberto |
| E7 | chip do filtro ativo aparece e remove nas duas superfícies | `ActiveFiltersChips` com o dia, clique remove | aberto |
| E8 | contador de filtros avançados conta o dia | badge `advancedCount` (`CatalogFiltersBar.tsx:268`) incrementa | aberto |
| E9 | alvo móvel ≥ 44px e foco visível nos controles novos | `getBoundingClientRect` + `:focus-visible`, padrão dos controles atuais | aberto |
| E10 | `daypart=noite` devolve só mesas com `start_time` na faixa | teste de rota com fixture nos 4 limites e nas bordas (`05:59`, `06:00`, `23:59`) | aberto |
| E11 | dia + faixa casam na MESMA sessão | mesa de sexta manhã + domingo noite **não** entra em `weekday=sexta&daypart=noite` | aberto |
| E13 | mesa com `schedule_day_hint` e sem `table_schedules` entra no filtro | `weekday=sabado` traz as 8 mesas medidas em §6.2 | aberto |
| E14 | contagem de `weekday=sabado` bate com a do catálogo sem filtro | soma de linhas + hints, medida no banco antes e depois | aberto |
| E12 | entrada no changelog do `mesas` publicada junto do deploy | `curl` em `/api/changelog` com a entrada nova | aberto |
| D4 | política de mesa com dia/horário "a definir" | resposta do mantenedor | **bloqueado** |
| D5 | limites das 4 faixas de horário | resposta do mantenedor | **bloqueado** |
| D6 | madrugada (0 resultados) entra, contra R22? | resposta do mantenedor | **bloqueado** |
