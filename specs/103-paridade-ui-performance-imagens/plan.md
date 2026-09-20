# Plano — Spec 103

Toda solução aqui foi pesquisada na doc oficial antes de escrita, e conferida contra
o artefato real (AGENTS.md §Pesquisar antes de inventar). Onde doc e artefato
divergiram, o artefato prevaleceu, e a divergência está registrada.

---

## 1. Achado B — `` `}{` `` na busca (fazer primeiro)

**Solução:** remover `` {` `` da linha 87 e `` `} `` da linha 96 de
`apps/site/src/pages/busca/index.astro`. O corpo do `<script type="text/pagefind-template">`
passa a ser HTML cru, como o exemplo oficial do Pagefind.

**Por que é isso e não CSP, hash ou `set:html`:** as duas docs convergem no mesmo
ponto. O Pagefind quer HTML cru; o Astro não avalia `{...}` num script que tem
atributo além de `src`, porque `is:inline` fica implícito. Não há expressão a avaliar
— nunca houve.

**Risco:** baixo. Duas linhas, um arquivo.

**Verificação:** `pnpm --filter @artificio/site build`, depois `grep` no `dist` por
backtick dentro do bloco do template. Build verde **não** é evidência aqui: o defeito
atual passou build verde. A evidência é o artefato.

**Regressão a evitar:** o `{{#if meta.categoria}}` e o `{{+ excerpt +}}` continuam —
são sintaxe do Pagefind, não do Astro. Quem remover as chaves duplas reabre o
separador órfão que a PR #326 fechou.

---

## 2. Achado A1 — login do `downloads` quebrando de linha

**Causa:** grid de 4 colunas com a 3ª em `minmax(220px,360px)` quando
`data-has-search="true"`. Em 1440px não cabe.

**Solução — DECIDIDA pelo mantenedor (2026-09-17):** a busca do `downloads` sai do
header e vai para o corpo da página, **como no `glossario`**.

A referência foi medida em `glossario.artificiorpg.com`, viewport 1857px:

```
data-has-search:            null        (não usa a busca embutida)
.artificio-header-search:   ausente
grid do header-main:        90px 1432px 128px 96px   (4 colunas normais)
altura do header:           65px
.artificio-session:         x:1722 y:12  (1ª linha, à direita)
campo de busca:             582×64 em y:187, FORA do header
```

É por isso que o `glossario` não tem o defeito: sem a coluna de 360px, o grid cabe, e
a sessão fica na linha de cima.

**Descartadas**, com o motivo:

1. *encolher a coluna de busca (`minmax(0,360px)`)* — trata o sintoma. O header
   continuaria com uma coluna elástica que some ou espreme conforme a largura, e o
   campo de busca ficaria ilegível em telas médias.
2. *grid de 3 colunas com a busca em linha própria* — resolveria, mas cria uma
   terceira forma de header no monorepo, contra o objetivo da spec, que é reduzir
   variação.

A escolhida elimina o caso especial em vez de parametrizá-lo: o `downloads` passa a
usar exatamente o mesmo header dos outros quatro.

**Atenção na execução:** a busca do `downloads` é funcionalidade real, não decoração.
Mover o campo não pode perder o comportamento (debounce, sincronia com a URL, estado
do filtro). A lógica vai junto; só o lugar muda.

**Pendência de produto que isto ABRE:** o `glossario` põe a busca no corpo porque a
busca é a função principal da página. No `downloads` a busca convive com o catálogo e
a barra de filtros (`CatalogFilterSidebar`). Onde exatamente o campo entra na página
do `downloads` — acima do catálogo, dentro da barra de filtros — não foi dito, e não
infiro. Ver D4 em `spec.md` §4.

**Blast radius:** `packages/ui/src/styles.css:555`. Exige verificação nos consumidores
(AGENTS.md §Pacotes compartilhados).

---

## 3. Achado C — imagens do `mesas`

### 3.1 O que foi pesquisado

Doc do Cloudinary, três páginas (`image_optimization`, `responsive_images`,
`transformation_reference`), mais busca sobre `@cloudinary/react`.

- `f_auto` negocia o formato pelo `Accept` do browser (AVIF/WebP/JPEG).
- `q_auto` escolhe a compressão por análise da imagem.
- A doc escreve `q_auto/f_auto` separados por barra. **Medido:** vírgula
  (`f_auto,q_auto,w_78`) e barra (`q_auto/f_auto/w_78`) devolvem **2.008 bytes**
  idênticos. As duas funcionam; adotamos a forma da doc.
- A transformação entra **entre** `/image/upload/` e o segmento de versão.

### 3.2 Solução: `srcset`/`sizes` no `<img>`, sem dependência nova

**Não instalar `@cloudinary/react`.** Dois motivos, ambos medidos:

1. A doc do Cloudinary diz que `srcset` nativo é o melhor caminho **para LCP**,
   justamente por não haver JS a carregar. LCP é a métrica quebrada aqui (5,9 s).
   O `AdvancedImage` põe uma biblioteca no caminho crítico da métrica que queremos
   consertar.
2. Existe **um** ponto de render (`CroppedImage.tsx`, um `<img>` só). Uma função que
   monte a URL alcança o app inteiro sem componente novo.

A função de URL vai para **`packages/media`**, não para o app: é lá que `IMAGE_KINDS`
já sabe a dimensão de cada tipo de imagem, e o `downloads`/`links` têm o mesmo
problema em potencial. Exceção por app é o defeito (AGENTS.md §Compartilhado por
padrão).

### 3.3 O que foi DESCARTADO, com o motivo

**`c_fill,g_auto` para recortar no mobile** — funciona (medido: 390×220 em 14.156
bytes, com `g_auto` escolhendo o assunto por IA), e **mesmo assim não entra**. O
`mesas` já deixa o dono da imagem escolher o enquadramento, e esse recorte vira
`object-position` em `CroppedImage.tsx:77`. Deixar o Cloudinary recortar sozinho
desfaria a escolha do dono — que é exatamente o defeito que o componente foi criado
para corrigir (comentário em `CroppedImage.tsx:24-31`, incidente de 2026-08-18, a
imagem chegava cortada duas vezes).

Redimensionar e converter formato **preserva** o enquadramento; recortar, não.

**`w_auto` / `dpr_auto`** — não entram: dependem de client hints, que a própria doc
do Cloudinary registra como não suportados em todos os browsers. `srcset` com larguras
explícitas não depende disso.

### 3.4 Ordem

1. função de URL em `packages/media`, com teste de unidade;
2. `CroppedImage.tsx` passa a emitir `srcset` + `sizes`;
3. medir Lighthouse antes/depois, mediana de 3 rodadas.

---

## 4. Achado D — contraste

**Não há solução pesquisada ainda** — não medi o contraste dos tokens, e sem o valor
não há o que corrigir. Primeiro passo é medição, não edição:

1. extrair o par fundo/texto de cada botão reprovado;
2. calcular a razão contra o mínimo da WCAG 2.2 (4.5:1 para texto normal, 3:1 para
   texto grande e componentes de interface);
3. só então decidir se muda o token (alcança os 6 apps) ou o uso local.

Skill `wcag-accessibility-audit` cobre o procedimento.

A ordem de heading (`<h3>` sem `<h2>`) fica junto, no mesmo trabalho — mesma
auditoria, mesmo arquivo de catálogo.

---

## 5. Achado A2/A3 — cor, peso e subnav

**Bloqueados por D1 e D2 da `spec.md`.** São decisão de produto, não técnica, e
inferir a resposta violaria AGENTS.md §Produto vs. técnico.

O que já está medido e não depende da resposta: a geometria é idêntica, a lista de
itens é a mesma, e nenhum app passa `navItems` ou `variant`. Quando D1 e D2 forem
respondidas, a execução é de tokens de tema, não de componente.

---

## 6. Como parar de depender de medição manual

Pergunta do mantenedor (2026-09-16): como garantir que o nav fique igual em todos os
módulos — exceto as exceções funcionais de cada um — sem alguém remedir a cada
sessão. **Sem mudar a lógica; o que está difuso é o visual.**

Hoje a única forma de saber que o `site` está com peso 600 e os outros com 500 é
abrir os cinco em produção com Playwright. Isso é medição manual, e some junto com a
sessão.

### 6.1 O mecanismo já existe no repo

`packages/ui/src/styles.contract.test.ts` lê `styles.css` como TEXTO e assere valor.
Roda no `ci.yml` (job `lint-build-test`), e a branch protection exige verde.

O comentário do próprio arquivo nomeia o motivo de existir:

> *"Este guard existe porque NENHUM teste de comportamento pega a regressão:
> `Header.paineis.test.tsx` acha o avatar por `getByRole(...)` — que depende
> exatamente desse nome acessível — e passa verde com a regra errada, porque jsdom
> não aplica media query."*

Foi escrito para o header em ≤860px (T7.1, spec 102). Falta estendê-lo à paridade
ENTRE módulos.

### 6.2 Um teste de CSS NÃO cobre o defeito do `downloads` — medido

**Forma óbvia que não funciona**, registrada para ninguém tentar: asserir
`styles.css` não pega o achado A1.

O login do `downloads` quebra para a 2ª linha porque as 4 colunas do grid não cabem
em 1440px — `grid-template-columns: 96px 789px 360px 84px` soma mais que a largura
útil. Isso é **layout computado**, não texto de CSS. A regra
`.artificio-header-main[data-has-search="true"]` está correta no arquivo; o que falha
é o resultado dela naquela largura.

E jsdom não faz layout: `getBoundingClientRect()` devolve zero em tudo, e media query
não é aplicada. Um teste de unidade passa verde com o login fora do lugar — que é o
estado atual de produção.

Conclusão: **são dois mecanismos, não um.**

| mecanismo | pega | não pega | custo |
|---|---|---|---|
| contrato de CSS (vitest, já no CI) | token, peso, cor, gap, padding | posição, quebra de linha, altura real | zero |
| layout em browser (Playwright) | A1, geometria, o que o olho vê | — | infra nova |

Medido: **não há Playwright no CI** hoje (`.github/workflows/` tem 19 workflows,
nenhum roda browser).

### 6.3 A causa estrutural do "visual difuso"

Trava por teste é tardia: prende a divergência DEPOIS que ela aparece numa PR.

A divergência nasce porque o tema é escolhido por app — `data-theme` difere entre os
cinco, e daí saem as três cores de link (`rgba(255,255,255,.75)`, `rgb(2,7,64)`,
`rgb(90,97,114)`). Nenhum app passa `variant` ao `Header`; a cor vem do documento.

O que impede a divergência de nascer é inverter a origem: **o tema vem do pacote, e o
app declara só a exceção funcional** — tem busca embutida, tem subnav, tem item
próprio. Exatamente a distinção que o mantenedor fez: lógica não muda, visual não
diverge.

Isso altera o contrato de `packages/ui` e alcança os 6 apps, logo exige aprovação
nominal (AGENTS.md §Pacotes compartilhados). **Não decidido** — ver D3 abaixo.

### 6.4 Decisão pendente — D3, com o custo medido

**D3 — o CI passa a rodar Playwright?** Sem ele, A1 e a geometria continuam
verificados à mão, e a spec fecha com uma classe inteira de defeito sem guard.

#### Já se tentou antes, e travou — `DEB-048-08`

**Registro do que NÃO funcionou** (2026-06-26, spec 048). Houve um E2E com
`@playwright/test` em `apps/mesas/frontend/e2e/`. Foi **removido do `dev`**. O motivo
registrado:

> *"O smoke E2E aponta para `https://mesasbeta.artificiorpg.com` e pressupõe
> cookie/sessão admin válido. Sem estratégia de `storageState` segura, ele pode virar
> teste manual disfarçado, flaky ou dependente do Chrome/cookies reais do
> mantenedor."*
>
> Status: *"Reabrir só se houver estratégia de auth admin testável sem cookie
> pessoal."*

**Por que o escopo desta spec é diferente:** aquele teste exercitava tela LOGADA. O
guard que a 103 precisa mede header e posição em página **pública** — as mesmas cinco
URLs medidas em 2026-09-16 e 2026-09-17 sem sessão nenhuma. Sem login, sem cookie,
sem `storageState`. A condição que matou a tentativa de junho não se aplica.

Se o guard crescer para tela logada, cai no mesmo buraco. O escopo é a trava.

#### Custo medido

- **Não instalado hoje:** zero ocorrência de `playwright`/`@playwright/test` nos
  `package.json` do repo. Existe só uma referência opcional em
  `scripts/api/smoke-traffic.ts:loadPlaywright()`, que falha com instrução de
  instalar — nunca foi ativada.
- **Disco:** medido em `~/AppData/Local/ms-playwright`: **690 MB** no total —
  Chromium completo 416 MB, `chromium_headless_shell` 270 MB, ffmpeg 3,4 MB. Só o
  headless shell basta para medir geometria: **~270 MB**. No CI, baixado a cada
  execução sem cache.
- **Tempo de CI hoje:** 2–3 min nas execuções de PR medidas
  (`gh run list --workflow=ci.yml`); as de ~10 min incluem deploy. O acréscimo é o
  download dos browsers mais o tempo dos testes. **Não medi** o acréscimo real — só
  medindo depois de instalado.
- **Nenhum dos 19 workflows** em `.github/workflows/` roda browser hoje.

#### Recomendação

Entra, restrito a **geometria de página pública**, escrito como guard de layout e não
como E2E. É o único mecanismo que pega A1 (jsdom não faz layout — §6.2). O limite de
escopo é o que impede repetir `DEB-048-08`.

**Sem resposta do mantenedor** até 2026-09-17.

---

## 7. Ordem de execução

| # | Trabalho | Depende de | Deploy |
|---|---|---|---|
| 1 | Achado B (`` `}{` ``) | — | `site` |
| 2 | Achado C (imagens) | — | `mesas` |
| 3 | Achado D (contraste) | medição da §4 | `mesas` + consumidores |
| 4 | Achado A1 (login) | medição da §2 | `downloads` + consumidores |
| 5 | Achados A2/A3 | **D1 e D2** | os 5 apps |
| 6 | Feature extra: filtros de dia e horário (§8) | D5 para fechar; D4 só bloqueia T7.8 | `mesas` |

1 e 2 são independentes e podem ir em paralelo. 5 é o maior blast radius e vai por
último, depois das respostas.

Cada item entra por branch + PR, base `dev` (AGENTS.md §PR, Commit e Push).

---

## 8. Feature extra — filtros de dia da semana e faixa de horário (`spec.md` §6)

Independente dos quatro achados: toca só o `mesas`, backend e frontend, sem
`packages/ui`. Pode ir em paralelo a 1 e 2; vai por último na ordem porque é feature,
não defeito.

Duas facetas, um trabalho só: saem da mesma tabela, entram na mesma query e nos
mesmos dois componentes de UI. Separar em dois PRs faria a segunda mexer em todo
arquivo que a primeira acabou de tocar.

### 8.1 A fonte do dado são DUAS tabelas, não uma

Revisão adversarial de 2026-09-18 contra produção: 24% das mesas ativas (21 de 88)
**não** têm linha em `table_schedules`, e 9 delas têm o dia real em
`tables.schedule_day_hint` (`spec.md` §6.2).

Causa: linha de `table_schedules` exige dia **e** horário (`NOT NULL`, migration 12).
Faltando um eixo, `deriveSchedule` (`editorMapping.ts:186-202`) grava zero linhas e
põe o eixo conhecido no hint de `tables`, colunas da `migration_124`.

O filtro consulta as duas fontes: `EXISTS` sobre `table_schedules` **OR** condição
sobre o hint da própria `tables`. Filtro só sobre `table_schedules` esconde 8 mesas de
sábado que o catálogo mostra sem filtro — defeito pior que a ausência da feature.

O hint só cobre mesa com **uma** agenda parcial, e é `defined` por construção: o
`CHECK` `tables_schedule_tbd_hint_check` proíbe hint em eixo `to_define`. Não há
ambiguidade a resolver em runtime.

### 8.2 Por que não há migration

`table_schedules.day_of_week` existe com `CHECK` dos 7 dias e índice
`idx_table_schedules_day` desde a migration 12
(`apps/mesas/database/migration_12_table_schedules.sql:16,29`).
`table_schedules.start_time TIME NOT NULL` existe na mesma migration, linha 17.
O trabalho é de query e UI.

`start_time` **não** tem índice — medido na migration 12; os hints da 124 também não.
Não se cria índice por precaução: são 88 mesas ativas e 67 sessões em produção.
Índice novo só depois de medir que a query precisa dele.

### 8.3 `EXISTS`, não join — decidido, com o motivo

A lista do catálogo conta com `COUNT(DISTINCT t.id)` (`tables.ts:324`) e só depois
pagina. Join com `table_schedules` duplica a linha da mesa que joga em mais de um
dia: o `DISTINCT` esconde a duplicata na **contagem**, e o `SELECT` da linha 332
devolve a mesa repetida no resultado. `EXISTS` filtra sem multiplicar linha.

O filtro entra antes da contagem. Filtro aplicado depois da paginação deixa buraco na
página — a mesma armadilha já documentada no comentário de `importedTableIsCurrentSql`
(`tables.ts:209-213`).

**Dia e faixa dividem um `EXISTS` só.** As duas condições descrevem a mesma sessão.
Em `EXISTS` separados, mesa que joga sexta de manhã e domingo à noite satisfaria
`weekday=sexta` num e `daypart=noite` no outro, e entraria num resultado onde não
deveria estar. É a mesma classe de erro do join, com outro sintoma.

Medido: hoje nenhuma mesa ativa tem 2 linhas (67 sessões, 67 mesas). O erro é latente,
não observável — e o schema existe para múltiplas sessões por mesa. Escrever contra o
schema, não contra a amostra de hoje.

No ramo do hint a questão não aparece: o hint é uma agenda só, e dia e horário nunca
estão ambos preenchidos ali (a mesa com os dois teria linha em `table_schedules`).

A faixa compara `ts.start_time`. `end_time` é `nullable` (`db/types.ts:379`) e fica
fora: a faixa é do **início** da sessão, e mesa que começa 23h e varre a madrugada
conta como noite.

### 8.4 Os limites das faixas são decisão dele — D5 e D6

Manhã, tarde, noite e madrugada não têm fronteira técnica. `spec.md` §6.6 propõe
06/12/18/24 como sugestão **não aprovada**, para haver o que confirmar ou corrigir.

Duas medições que a decisão precisa ter à mão:

- **madrugada tem 0 mesas** em produção (54 noite, 11 tarde, 2 manhã;
  `min=08:00`, `max=22:00`). A política R22/D0.2 da spec 094, já aprovada, manda
  omitir opção com zero resultado — o filtro nasceria com 2 das 4 faixas pedidas.
  Contradição entre o pedido e uma política aprovada: **D6**, dele.
- o corte `06:00` **não** é neutro: o beta tem sessão às `05:00`, que cairia em
  madrugada. O banco aceita qualquer `TIME`.

O que **não** é escolha: as quatro faixas cobrem 24 h sem sobreposição e sem buraco.
Faixa sobreposta faz a mesma mesa aparecer em duas; buraco faz mesa sumir de todas.
Isso a execução garante sozinha, qualquer que seja o corte.

### 8.5 Duas superfícies, uma definição

O catálogo tem dois caminhos de filtro avançado, com comportamentos deliberadamente
diferentes:

- **desktop** — `CatalogAdvancedFilters` com `idPrefix="catalog-advanced-desktop"`
  dentro da `CatalogFiltersBar` (`CatalogFiltersBar.tsx:339`); aplica a cada mudança.
- **mobile** — mesmo componente com `idPrefix="catalog-advanced-mobile"` dentro do
  `FilterDrawer` (`CatalogoPage.tsx:483-496`), que é `md:hidden`
  (`FilterDrawer.tsx:84,95`) e trabalha sobre `mobileAdvancedDraft` com botões
  Aplicar e Limpar.

Dia e faixa entram nos dois pelo **mesmo** componente e pelo mesmo registro canônico
de valores (R15/R6). Escrever um seletor próprio para o drawer é o defeito que a
regra proíbe, não um atalho.

O `plan` não fecha a forma do controle (checkbox em linha, pílulas, segmented). É
decisão técnica de UI: quem executa escolhe, respeitando o padrão dos controles
vizinhos, alvo ≥ 44px no mobile e o token `--artificio-focus`.

### 8.6 Changelog entra no mesmo PR

`apps/mesas/database/changelogs.json` viaja na imagem do backend
(`apps/mesas/backend/Dockerfile:137`) e é lido em runtime
(`backend/src/routes/changelog.ts:23`). Entrada escrita depois do merge não está na
imagem que subiu: o deploy sai com a feature e sem o aviso, e só um segundo deploy
corrige.

Por isso a entrada é parte do PR da feature (T7.9), não tarefa de pós-deploy. O
texto credita a sugestão do usuário anônimo, sem nome — o reporte é
`Anonimo (visitor)`.

### 8.7 Pesquisa

Não há lib nem API externa envolvida: Postgres `EXISTS` + `ANY` e comparação de
`TIME` sobre coluna já existente, e componente React já existente no repo. Nada a
pesquisar fora do próprio código — a medição de §6.1 da `spec.md` é a fonte.
