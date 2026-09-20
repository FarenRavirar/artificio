# Tasks — Spec 103

Convenção: `[ ]` aberta · `[x]` fechada com medição citada · `[~]` bloqueada.
Task só fecha com o comando que a mediu na mesma linha. "Local", "parcial" e
"falta deploy" não fecham (AGENTS.md §Erros que não podem se repetir).

---

## T1 — `` `}{` `` na busca do portal

Entregue no commit `fca55ef`, PR #327 (base `dev`), junto da T7. Falta só a T1.2,
que depende de deploy.

### [x] T1.1 — Template do Pagefind volta a ser HTML cru

Entregue em `apps/site/src/pages/busca/index.astro`: removidos `` {` `` e `` `} `` que
envolviam o corpo. `{{#if meta.categoria}}`, `{{+ excerpt +}}` e `{{ url | safeUrl }}`
ficaram — são sintaxe do Pagefind, resolvida no browser, não do Astro.

Causa registrada no comentário do bloco: `<script>` com qualquer atributo além de
`src` — aqui o `type` — é `is:inline` implícito, e o Astro NÃO avalia expressão
dentro de script inline. Por isso a expressão saía literal.

Medido no `dist` após `pnpm --filter @artificio/site build`: corpo do template com
0 backtick, 0 chave-de-expressão Astro (`{\`` ou `` \`}``), e `{{#if meta.categoria}}`
presente. Contar backtick no arquivo inteiro NÃO mede isto: a linha do
`astro-island` bundlado tem backtick próprio e devolve falso positivo — restringir
a contagem às linhas do corpo do template.

### [ ] T1.2 — Confirmar em produção depois do deploy

Bloqueado: depende de deploy, que exige autorização nominal.

**Aceite:** `curl -s "https://artificiorpg.com/busca/?cb=$(date +%s%N)"` e conferir o
bloco `text/pagefind-template` sem `` ` ``. Sem o cache-buster mede-se a borda da
Cloudflare (`max-age=7200`), não a origem.

### [x] T1.3 — Buscar um termo e ver o resultado renderizado

Medido em preview local (`astro preview --port 4399`) via Playwright MCP em
`/busca/?q=regras`: 7 resultados renderizados, 0 backtick no texto visível, nenhuma
chave solta, nenhum separador `·` órfão. Dos 7, 2 posts sem categoria abrem na data
e 5 trazem `categoria · data` — o `{{#if}}` da PR #326 continua fazendo efeito.

Os 2 erros de console são CORS de `accounts.artificiorpg.com/api/auth/refresh`
contra `localhost:4399`, que não está na allowlist do SSO. Artefato do preview, não
da busca.

**Playwright RODA** — contradiz T6.2, que o dava como não instalado. O MCP
`mcp__plugin_playwright_playwright__*` responde e navega. T6.2 abaixo foi corrigida.
Restrição medida: `browser_take_screenshot` só grava sob `C:\projetos\artificio` ou
`.playwright-mcp`; caminho no scratchpad devolve `outside allowed roots`.

---

## T2 — Imagens do `mesas`

### [ ] T2.1 — Função de URL de entrega em `packages/media`

Recebe a URL do Cloudinary e a largura desejada; devolve a URL com
`q_auto/f_auto/w_<n>` inserido entre `/image/upload/` e o segmento de versão.

Requisitos medidos:
- URL que não seja do Cloudinary volta **intacta** (o mestre pode colar link de
  terceiro — `isArtificioHostedImage`, `imageKinds.ts:178`);
- URL que já tenha transformação não recebe outra;
- a forma é `q_auto/f_auto` separada por barra (doc oficial). Medido: vírgula dá o
  mesmo resultado (2.008 bytes), mas seguimos a doc.

**Aceite:** teste de unidade cobrindo os três casos + `pnpm --filter @artificio/media test`.

### [ ] T2.2 — `CroppedImage` emite `srcset` e `sizes`

`apps/mesas/frontend/src/components/CroppedImage.tsx:73`. As larguras saem de
`IMAGE_KINDS`, não de números escolhidos à mão.

**`object-position` continua** — é o enquadramento escolhido pelo dono. Não trocar
por `c_fill`/`g_auto` (motivo em `plan.md` §3.3).

**Aceite:** `pnpm --filter @artificio/mesas test` verde + o `<img>` renderizado com
`srcset` de ao menos 3 larguras.

### [ ] T2.3 — Medir o ganho em produção

**Aceite:** Lighthouse móvel em `mesas.artificiorpg.com`, mediana de **3** rodadas.
Economia de imagem < 1.000 KiB (era 10.644) e LCP < 2,5 s (era 5,9 s). Uma rodada só
não fecha — o Lighthouse varia.

### [ ] T2.4 — Cruzar com os outros apps

`downloads` e `links` também exibem imagem do Cloudinary. A pergunta é por que eles
não quebraram (AGENTS.md §Compartilhado por padrão).

**Aceite:** medir o payload de imagem dos dois; se servirem original, aplicar a mesma
função.

### [!] T2.5 — ACHADO NOVO: toda capa de post do blog é 404 em produção

Descoberto em 2026-09-19 ao conferir o card renderizado da T1.3 — as 7 capas saíram
como placeholder cinza. Não é artefato do preview local.

Medido com cache-buster (`?cb=$(date +%s%N)`), 3 URLs, 3 × **404**, enquanto o HTML
do post devolve **200**:
- `/wp-content/uploads/2026/01/old-school-vs-new-school-consistencia-decisoes-do-mestre-banner-1200x680-1.webp`
- `/wp-content/uploads/2026/01/cold-open-no-rpg-capa-design-narrativo.webp`
- `/wp-content/uploads/2026/03/Glossario-Unificado-para-Traducoes-de-DD.webp`

Causa medida: `apps/site/src/data/posts.json` guarda URL **absoluta** do WordPress
legado (`https://artificiorpg.com/wp-content/uploads/...`). Não existe `wp-content`
no `dist` nem em `apps/site/public/` (só `og-default.png`) — o WordPress foi
desligado e os arquivos não vieram. Nenhum rewrite serve a rota.

**Alcance maior que a busca:** a mesma URL está no `<img>` do corpo do post e no
`og:image` (medido no `dist` de `/blog/old-school-vs-new-school-rules-vs-rulings/`),
então atinge o blog inteiro e o preview de link em rede social.

**Falha em silêncio.** Build verde, HTML válido, CSP permitindo — só o arquivo não
existe. Nenhum teste cobre URL de imagem externa.

**Contradiz comentário no código:** `apps/site/astro.config.mjs:66-70` afirma que em
produção `'self'` "cobriria por acaso". A CSP cobre; o arquivo não existe. O
comentário descreve a CSP corretamente e a existência do arquivo incorretamente.

**Bloqueada — decisão de produto pendente.** Onde as capas passam a morar muda o que
o usuário vê. Medido como viável: Cloudinary (o repo já usa com signed preset, e a
CSP já libera `res.cloudinary.com`) ou `apps/site/public/`. **Não medi** se os
arquivos originais ainda existem em algum lugar — sem eles nenhuma das duas roda.
Perguntado ao mantenedor em 2026-09-19; aguardando resposta.

---

## T3 — Contraste e ordem de heading

### [ ] T3.1 — Medir antes de corrigir

Extrair o par fundo/texto de `#btn-anunciar-mesa-home`
(`CatalogoPage.tsx:417`) e `#catalog-search-submit` (`CatalogFiltersBar.tsx:282`),
calcular a razão e comparar com WCAG 2.2 (4.5:1 texto normal, 3:1 componente de
interface).

**Aceite:** a razão medida de cada botão, escrita aqui.

### [ ] T3.2 — Corrigir na origem certa

Os dois usam token `--color-*` de `packages/ui`. Se o token reprova, o defeito é dos
6 apps e a correção é no token — com verificação nos consumidores. Se só o uso local
reprova, corrige local.

**Aceite:** Lighthouse Acessibilidade sem reprovação de contraste + os outros
consumidores do token conferidos.

### [ ] T3.3 — Ordem de heading no catálogo

`<h3>` sem `<h2>` antes, nos cards. **Não investigado.**

**Aceite:** Lighthouse sem o achado de ordem de heading.

---

## T4 — Login do `downloads` na linha errada

### [ ] T4.1 — Medir em três larguras

`downloads` em 1280px, 1440px e 1920px: posição de `.artificio-session`,
`grid-template-columns` e altura do header. Medido só 1440px até agora
(`x:24 y:60`, fora da linha).

**Aceite:** as três medições escritas aqui.

### [ ] T4.2 — Levantar os consumidores de `data-has-search`

A regra é `packages/ui/src/styles.css:555`, compartilhada. Antes de tocar, saber quem
mais liga a busca embutida.

**Aceite:** `rtk rg "data-has-search\|hasSearch" apps packages` com a lista.

### [ ] T4.3 — Corrigir o grid

Escolher entre as três saídas de `plan.md` §2 **com base nas medições de T4.1/T4.2**,
não por preferência.

**Aceite:** `.artificio-session` com `y < 60` nas três larguras, nos 5 apps, e nenhum
consumidor regredido.

---

## T5 — Paridade de cor, peso e subnav

### [~] T5.1 — BLOQUEADA por D2 (`spec.md` §4)

Qual cor de header vira padrão. `mesas` é branco sobre azul `rgb(27,42,74)`; `site` é
`rgb(2,7,64)` sobre branco. Convergir para o `mesas` muda o header do portal de
branco para azul escuro.

Pergunta feita ao mantenedor em 2026-09-16, **sem resposta** até a escrita desta
spec. Não há decisão registrada.

### [~] T5.2 — BLOQUEADA por D1 (`spec.md` §4)

Política da subnav. O `mesas` gasta a faixa inteira com 1 item ("Catálogo"); o `site`
usa 4 itens de conteúdo. Sendo o `mesas` o alvo, a faixa de um link vira o padrão, ou
o `mesas` passa a listar as seções do módulo?

Mesma pergunta, mesma data, **sem resposta**.

### [ ] T5.3 — Peso do link do `site`

Peso 600 no `site` contra 500 nos outros quatro. **Não depende de D1/D2** — é
divergência pura, e o alvo é o `mesas` (500).

**Aceite:** `getComputedStyle(link).fontWeight === "500"` nos 5 apps, viewport 1440px.

---

## T6 — Guard de paridade (parar de medir à mão)

### [ ] T6.1 — Contrato de CSS para a paridade entre módulos

Estender `packages/ui/src/styles.contract.test.ts`, que já roda no `ci.yml` e já
assere `styles.css` como texto. Cobre peso, cor, gap e padding do link do nav.

**Aceite:** o teste falha quando o peso do link diverge do alvo (`mesas`, 500), e
passa quando converge. Provar rodando com o valor errado ANTES de corrigir — guard
que nunca foi visto vermelho não é guard.

### [~] T6.2 — BLOQUEADA por D3 (`plan.md` §6.4) — layout em browser no CI

Contrato de CSS **não** cobre o achado A1: a quebra de linha do login é layout
computado, e jsdom não faz layout (`getBoundingClientRect()` devolve zero, media
query não é aplicada). Medido: nenhum dos 19 workflows em `.github/workflows/` roda
browser.

O bloqueio é do **CI**, não da sessão: medido em 2026-09-19, o MCP
`mcp__plugin_playwright_playwright__*` navega e avalia JS contra `astro preview`
local (usado para fechar T1.3). Então A1 e a geometria podem ser medidos agora,
à mão, sem esperar D3 — o que D3 decide é o guard automático, que é o que evita a
regressão voltar sem ninguém ver.

### [~] T6.3 — BLOQUEADA — tema vem do pacote, não do app

Inverter a origem do tema para a divergência não nascer (`plan.md` §6.3). Altera o
contrato de `packages/ui` e alcança os 6 apps: exige aprovação nominal.

---

## T7 — Feature extra: filtro por dia da semana (`spec.md` §6)

### Revisão da PR #327 — veredicto medido de cada achado

Duas rodadas. Achados 1-7 são de Codex e CodeRabbit sobre o commit `fca55ef`,
corrigidos no commit `4031ddc`, pushado na PR #327. Achados 11-12 são das duas
ferramentas sobre o `4031ddc`, corrigidos na árvore e ainda não commitados.

**Procedem, corrigidos:**

1. **Agenda placeholder casava o filtro** (P1 Codex). "Horário personalizado" (R20)
   grava linha com placeholder `segunda`/`19:00` e os dois status em `'to_define'`,
   porque `day_of_week`/`start_time` são NOT NULL e o enum do banco não tem
   `to_define` (`editorMapping.ts:130-180`). O filtro e o CTE das facetas liam a
   linha sem olhar o status, então `weekday=segunda` e `daypart=noite` devolviam
   mesa que o mestre nunca marcou. Corrigido com gate por eixo
   (`t.schedule_day_status`/`t.schedule_time_status = 'defined'`).
   Medido em produção 2026-09-19: 12 mesas com dia `to_define`, 21 com horário
   `to_define`, **0** com linha — o falso positivo é latente, não ativo. As 88
   mesas ativas seguem uma regra limpa: `defined/defined` sempre tem linha (66/66),
   qualquer `to_define` nunca tem (0 em 22).
   Guard visto vermelho: removido o gate do dia, só o caso P1 falha.
2. **Chips de agenda nunca apareciam** (P2 Codex). `CatalogFiltersBar` monta o
   objeto de `ActiveFiltersChips` campo por campo e não passava `weekdays`/
   `dayparts`, o que também tornava os ramos de `CatalogoPage.removeFilter`
   inalcançáveis — só "Limpar tudo" desfazia. Corrigido, com guard em
   `CatalogFiltersBar.test.tsx`.
3. **Badge de "Mais filtros" ignorava agenda** (P2 Codex). `advancedCount` somava
   4 campos e não os dois novos; com o painel fechado o usuário perdia a indicação.
   Corrigido.
4. **Opção marcada com zero ficava desabilitada** (CodeRabbit). Prendia o filtro
   ativo sem como desmarcar. `isEmpty` passou a exigir `!isSelected`. Guard novo em
   `ScheduleFacetPicker.test.tsx`.
5. **E2 não media ordem** (CodeRabbit). `expect(scheduleFilterSql()).not.toBe('')`
   passava igual com o filtro aplicado DEPOIS da contagem. Trocado por um log de
   eventos que assere `schedule-where` antes de `count`.
6. **Borda superior da faixa sem prova de exclusividade** (CodeRabbit).
   `toContain("'12:00:00'")` passava com `<=`, e aí 12:00 cairia em manhã e tarde.
   Acrescentado `toMatch(/<\s*.../)` + `not.toMatch(/<=\s*.../)`.

**Recusado, com medição:**

7. **`NOT EXISTS` no ramo do hint** (CodeRabbit). Proposta: considerar hint só
   quando não há linha em `table_schedules`. Medido em produção: 34 mesas ativas
   têm linha E hint de dia, com **0** divergências entre `schedule_day_hint` e
   `ts.day_of_week`. Não há hint obsoleto a desempatar, e o caso real que a
   proposta tentava alcançar — o placeholder — já é coberto pelo gate de status do
   item 1. Aplicar mudaria resultado sem defeito medido.

**Segunda rodada, sobre o `4031ddc` — procedem, corrigidos:**

11. **Payload malformado marcava a agenda como carregada** (P2 Codex,
    `useScheduleFacets.ts`). Resposta 200 sem `data`, ou com uma das listas fora
    de array, fazia `normalizeFacetList` devolver `{}`; `withExplicitZeros`
    convertia isso em zero para toda opção do registro e `loaded` virava `true`
    do mesmo jeito. `ScheduleFacetPicker.tsx:105` desabilita a opção com
    contador zero, então a lista inteira ficava inerte em cima de contagem que
    nunca foi medida. Agora a forma inválida é falha: `throw` antes do
    `setCounts`, o que cai no `catch` que já mantinha tudo clicável com
    `loaded: false`. Guard novo em `useScheduleFacets.test.ts` (5 casos),
    visto vermelho: removido o `Array.isArray`, os 2 casos de lista malformada
    falham.
12. **Scroll não resetava em mudança só de agenda** (CodeRabbit,
    `CatalogoPage.tsx:440`). A lista de dependências do efeito de scroll é
    campo por campo e não tinha `weekdays`/`dayparts` — mesma raiz do achado 2.
    Filtrar por dia com `page` em 1 deixava o usuário no meio da lista antiga.
    Os dois campos entraram na lista.

Validação da segunda rodada: frontend 1193 testes em 89 arquivos (era 1188),
`tsc --noEmit` sem erros.

Validação da primeira rodada: backend 1190 testes (era 1189), frontend 1188
(era 1186), lint 0 erros nos dois (1 warning pré-existente em
`useBannerScrim.ts`), `tsc -b` sem erros, `verify:api` breaking=0.

### SonarQube — 4 achados de manutenibilidade

Nenhum de correção. Três aplicados, um recusado.

8. **`decoded` como array** (`routes/tables.ts:117`). `includes` dentro de
   `filter` é checagem de pertencimento escrita como varredura. Virou `Set` +
   `has`, a mesma forma que `normalizeEnumMulti` já usa no frontend. Performance
   é irrelevante aqui (n ≤ 7); a razão é a forma única.
9. **Complexidade 17 em `ActiveFiltersChips`** (`:43`). Eram 7 blocos `if` +
   `push` idênticos e 3 listas idênticas. Extraídos `scalarChip` e `listChips`, e
   a cadeia virou lista declarativa. Isto ataca a causa do achado 2: com lista, um
   filtro novo é uma linha, e não há `push` a esquecer.
10. **Complexidade 17 em `buildCatalogParams`** (`utils/catalogFilters.ts:113`).
    Sete `if` iguais viraram a tabela `SCALAR_PARAM_NAMES` (campo → parâmetro da
    URL), onde a única divergência real (`priceType` → `price_type`) fica visível.
    `satisfies Partial<Record<keyof CatalogFilters, string>>` prende a chave ao
    tipo do filtro.

**Recusado:** "Replace these 4 tests with a single Parameterized one"
(`tables.schedule-filter.test.ts:174`). Os 4 casos de E4 têm ASSERÇÕES diferentes,
não só entradas: um exige SQL vazio, outro presença e ausência de substring, outro
contagem de `exists`. Parametrizar exigiria passar a asserção como parâmetro, o que
troca 4 testes legíveis por uma tabela pior de ler — e o nome de cada caso é o que
identifica a falha no output.

Cobertura do refactor provada: removido `scalarChip('seal', …)`, 3 testes de
`ActiveFiltersChips.test.tsx` falharam; restaurado, verdes. Refactor sem esse
vermelho seria verde por ausência de teste, não por comportamento preservado.

Duas facetas novas no catálogo, uma decisão só (2026-09-18): **dia da semana**,
sugerido por usuário anônimo em 2026-09-08, e **faixa de horário** (manhã, tarde,
noite, madrugada), pedida pelo mantenedor. Os dois dados já existem e já chegam ao
card; falta filtrar por eles.

**Ler `spec.md` §6.2 antes de T7.3.** A revisão adversarial de 2026-09-18 mediu que o
dado vive em **duas** tabelas: 21 das 88 mesas ativas não têm linha em
`table_schedules`, e 9 guardam o dia em `tables.schedule_day_hint`. Filtro só sobre
`table_schedules` esconde 8 mesas de sábado que o catálogo já mostra.

**Correção de duas medições da `spec.md` §6.2** (medido em produção 2026-09-18,
`mesas-db` read-only, na implementação de T7.3):

- **`schedule_day_hint` está preenchido em 42 mesas ativas, não 9.** A spec contou
  só as mesas *sem* linha em `table_schedules`. Quebra real:
  `sem linha + day_hint = 9` · `com linha + os dois hints = 33` · `com linha e sem
  hint = 34` · `sem linha e sem hint nenhum = 11` · `sem linha + só time_hint = 1`.
- **Nas 33 mesas em que hint e linha coexistem, os dois CONCORDAM** —
  `day_hint = day_of_week` e `time_hint = start_time` em 33 de 33, zero divergência.
  É o que torna o `OR` de T7.3 seguro: se divergissem, o ramo do hint traria a mesa
  num dia em que ela não joga. Quem mexer no `EXISTS` remede isto antes.
- **`sábado` tem 23 mesas, não 15.** `EXISTS` sozinho devolve 15; com o ramo do hint,
  23 — as 8 que a spec previu perdidas. Distribuição pelas duas fontes: sábado 23,
  sexta 14, segunda 10, domingo 10, quarta 9, quinta 5, terça 5. Nenhum dia com zero.
- Faixas pelas duas fontes, corte 06/12/18/00: noite 55, tarde 11, manhã 2,
  **madrugada 0**. `min(start_time)=08:00`, `max=22:00`.

### [x] T7.1 — Registro canônico de dia e faixa em `catalogFilterOptions.ts`

`WEEKDAY_VALUES`/`WEEKDAY_OPTIONS` com as 7 formas curtas do `CHECK` da migration 12,
com acento (`terça`, `sábado`). `DAYPART_VALUES`/`DAYPART_OPTIONS` com as 4 faixas
(`manha`, `tarde`, `noite`, `madrugada` — valor de URL sem acento, label com).
`CatalogFilters` ganha `weekdays: WeekdayOption[]` e `dayparts: DaypartOption[]`.

Os limites entraram junto (`DAYPART_RANGES`), porque D5 foi respondida em 2026-09-18
antes desta task rodar — ver T7.8b.

`normalizeEnumMulti` entrou aqui e **não** reusa `normalizeStyles`: aquela ordena por
`localeCompare`, correto para estilo (campo livre sem ordem natural) e errado para
dia, que tem ordem de calendário. Ordenar alfabeticamente devolveria
`domingo,sexta` para quem marcou `sexta,domingo`.

**O aceite original era infalsificável e foi substituído.** Ele pedia que
`rtk rg "segunda.*terça.*quarta" apps/mesas/frontend/src` devolvesse só
`catalogFilterOptions.ts`; medido em `origin/dev`, **antes** desta spec, a busca já
devolvia dois arquivos — `components/SessionRepeater.tsx` e
`features/discord-sync/draftFormUtils.ts`. Os dois são domínio de **escrita** de mesa
e incluem `to_define`, valor que o catálogo não filtra; não são segunda lista do
filtro. E `catalogFilterOptions.ts` nunca casaria esse padrão, porque escreve um dia
por linha. Padrão textual sobre lista multi-linha não mede R6.

**Aceite (medido 2026-09-18):** a fonte única do domínio de LEITURA é verificada por
import, não por texto — `rtk rg "WEEKDAY_VALUES|WEEKDAY_OPTIONS|DAYPART_VALUES|DAYPART_OPTIONS|DAYPART_RANGES" apps/mesas/frontend/src apps/mesas/backend/src -l`
devolve só consumidores que importam de `catalogFilterOptions.ts` (parser, builder,
mapper, hook de facetas, `ScheduleFacetPicker`, `ActiveFiltersChips`, teste) mais
`routes/tables.ts`, que mantém a sua própria cópia por ser outro pacote — ver T7.3.
`catalogSchedule.test.ts` assere os 7 dias literais e a cobertura de 24 h.

### [x] T7.2 — Parser e builder de URL

`utils/catalogFilters.ts`: `weekday` e `daypart`, ambos multivalor por vírgula, com a
mesma normalização de `styles` (decode, dedupe, ordem estável). Valor fora da lista é
descartado, não quebra — igual aos enums atuais.

**Aceite (medido 2026-09-18):** `pnpm --filter @artificio/mesas-frontend test` verde
(88 arquivos, 1186 testes). `catalogSchedule.test.ts` cobre
`weekday=sexta,funday,sexta` → `['sexta']`, `daypart=noite,brunch` → `['noite']`,
round-trip parse→build→parse estável, e a mesma seleção em ordem de clique diferente
produzindo URL idêntica.

Um teste preexistente precisou de ajuste, não de máscara: `catalogFilters.test.ts`
("URL vazia produz o estado default completo") compara o objeto inteiro com `toEqual`
e passou a faltar `weekdays`/`dayparts`. Os dois campos entraram no literal esperado.

### [x] T7.3 — Filtro no backend: duas fontes, um `EXISTS`, antes da contagem

`apps/mesas/backend/src/routes/tables.ts`, inserido antes do `COUNT(DISTINCT t.id)`
da linha 321:

```
(  EXISTS (SELECT 1 FROM table_schedules ts
           WHERE ts.table_id = t.id AND <dia> AND <faixa>)
   OR <mesma condição sobre t.schedule_day_hint / t.schedule_time_hint> )
```

Quatro exigências, cada uma com o sintoma medido que evita:

- **As duas fontes** — 21 das 88 mesas ativas não têm linha em `table_schedules`, e 9
  têm o dia real em `tables.schedule_day_hint` (`spec.md` §6.2). `EXISTS` sozinho
  esconde 8 mesas de sábado que o catálogo mostra sem filtro.
- **`EXISTS`, não join** — join duplica a linha da mesa com mais de um horário. A
  contagem esconderia a duplicata (`DISTINCT`), o `SELECT` da linha 332 não. Medido:
  hoje nenhuma mesa ativa tem 2 linhas (67 sessões / 67 mesas) — o erro é latente, e
  o schema permite o caso.
- **Um `EXISTS` só para dia e faixa** — as duas condições descrevem a **mesma**
  sessão. Em `EXISTS` separados, mesa de sexta de manhã + domingo à noite entraria em
  `weekday=sexta&daypart=noite`, que é resultado errado.
- **Antes da contagem** — filtro depois da paginação deixa buraco na página
  (`tables.ts:209-213`).

A faixa compara `ts.start_time` (ou `t.schedule_time_hint`) contra os limites de D5.
`end_time` é `nullable` (`db/types.ts:379`) e não entra: a faixa é do **início** da
sessão.

Sem índice sobre `start_time` (migration 12) nem sobre os hints (migration 124) — não
se cria por precaução com 88 mesas ativas. **Nenhuma migration nova.**

Decisões da execução (2026-09-18), com o sintoma medido de cada uma:

- **`24:00:00` não existe em `TIME`.** A faixa `noite` é `[18:00, 24:00)`, e comparar
  contra `'24:00:00'::time` dá erro de cast no Postgres. O limite superior do último
  intervalo do dia é omitido: só `>= '18:00:00'`. Um teste assere que o SQL gerado
  **não** contém `24:00:00`.
- **A lista de dias e os cortes estão DUPLICADOS no backend**, em `routes/tables.ts`,
  em vez de importados de `catalogFilterOptions.ts`. É divergência de R6 assumida:
  `apps/mesas/frontend` e `apps/mesas/backend` são pacotes distintos e o backend não
  depende do frontend; importar criaria dependência de runtime na direção errada. A
  fonte de verdade das duas cópias é o `CHECK` do banco, não uma das cópias. Subir
  isso para um pacote compartilhado (`packages/`) é o conserto certo e **não** foi
  feito: exige aprovação nominal (AGENTS.md §Pacotes compartilhados) e alcança outros
  consumidores. Débito não registrado em `backlog.md` — decisão do mantenedor.
- **`?weekday=a&weekday=b` (chave repetida) não filtra.** Express entrega array, que
  não é `string`, e o parser devolve `[]` — mesma política de `parseStylesQuery`
  (`tables.catalog.test.ts:219` já fixava isso para estilos). Só a forma
  `weekday=a,b` funciona.

**Aceite (medido 2026-09-18):** `tables.schedule-filter.test.ts`, 15 casos, verde —
`pnpm --filter @artificio/mesas-backend test` devolve 85 arquivos / 1189 testes.
O SQL é asserido pelo compilador real do dialeto (`DummyDriver` + `PostgresQueryCompiler`,
recurso que já existia em `apps/downloads/backend/src/routes/materials.list.test.ts`),
não pela estrutura interna do Kysely.

**Guard provado vermelho antes de valer verde** (AGENTS.md — guard nunca visto
vermelho não é guard): com o `EXISTS` único quebrado em um por eixo, o caso E11 falha
com `expected [ 'exists', 'exists' ] to have a length of 1 but got 2`. Restaurado e
reconferido verde.

**Contagens conferidas contra produção** (`mesas-db`, read-only), não só contra mock:
`weekday=sábado` → 23 com o ramo do hint e 15 sem ele; `daypart=noite` → 55;
`sábado` + `noite` no mesmo `EXISTS` → 12; `daypart=madrugada` → 0.

### [ ] T7.4 — Desktop: controle no painel de filtros avançados

Código escrito e verde em teste de componente; **não fecha** porque o aceite pede
verificação em browser e não há Playwright no repo (T6.2, bloqueada).

`ScheduleFacetPicker.tsx` novo, montado por `CatalogAdvancedFilters.tsx` nas duas
superfícies. `advancedCount` já conta dia e faixa: `activeCatalogFiltersCount` passou
a somar `weekdays.length + dayparts.length` junto de `styles.length`.

Posição no painel: agenda **antes** de experiência/tipo. Decisão técnica de UI
(AGENTS.md §Produto vs. técnico) — "quando posso jogar" filtra mais gente, e foi o
pedido original do usuário anônimo. Reverter é mover um bloco JSX.

**Falta para fechar:** Playwright 1440×900 — marcar "sexta" e "noite" mudam URL e
resultado sem clique extra; badge incrementa em cada um.

### [ ] T7.5 — Mobile: mesmo controle no `FilterDrawer`

O drawer é `md:hidden` (`FilterDrawer.tsx:84,95`) e usa draft + botões Aplicar/Limpar
(`CatalogoPage.tsx:476-497`). Dia e faixa entram no `mobileAdvancedDraft` junto de
`experience`, `type`, `seal` e `styles` — nenhuma lista nova, a mesma
`CatalogAdvancedFilters` com `idPrefix="catalog-advanced-mobile"`.

Duas superfícies, uma definição (R15). Componente duplicado aqui é o defeito.

Código escrito; **não fecha** sem browser (mesmo motivo de T7.4).

Dois pontos que a execução mudou, ambos para eliminar lista repetida — cada
repetição era um lugar onde dia e faixa seriam esquecidos em silêncio:

- `AdvancedFiltersDraft` é `Pick<CatalogFilters, ...>` e ganhou os dois campos; os
  dois call sites passam `filters={mobileAdvancedDraft}` / `filters={filters}`
  inteiros, em vez de reconstruir o objeto campo por campo.
- **"Limpar" tinha o estado vazio como literal inline** (`{ experience: '', type: '',
  seal: '', styles: [] }`). Mantido assim, dia e faixa **sobreviveriam ao "Limpar"** e
  nenhum tipo reclamaria — o literal era atribuído a um `Pick` mais largo via
  `setState`. Virou a constante `EMPTY_ADVANCED_DRAFT`, um lugar só.

**Falta para fechar:** Playwright 390×844 — abrir drawer, marcar "sexta" e "noite",
conferir que a URL **não** muda antes do clique em Aplicar e muda depois; "Limpar"
zera dia e faixa junto do resto.

### [x] T7.6 — Chip de filtro ativo

`ActiveFiltersChips.tsx`: um chip por dia e um por faixa, removíveis, nas duas
superfícies. `ActiveCatalogFilters` (`catalogFilterOptions.ts`) passa a conhecer os
dois.

`removeFilter` (`CatalogoPage.tsx`) ganhou ramo próprio para `weekdays` e `dayparts`.
Sem ele o `else` genérico atribuiria `''` ao campo, **trocando a lista por string** —
o chip "remover sexta" apagaria o filtro inteiro e deixaria o estado num tipo que o
resto do código não espera.

**Aceite (medido 2026-09-18):** `pnpm --filter @artificio/mesas-frontend test` verde;
os chips derivam de `WEEKDAY_OPTIONS`/`DAYPART_OPTIONS` (label da fonte única, valor
do banco), e o clique chama `onRemove` com a chave e só aquele valor.

### [ ] T7.7 — Acessibilidade e alvo de toque do controle novo

Dois grupos (dia e faixa), cada um com `fieldset`/`legend` ou `role="group"` +
`aria-label`, alvo ≥ 44×44 no mobile, foco visível com o mesmo token
`--artificio-focus` dos controles atuais (`FilterDrawer.tsx:105`).

Auditoria de contraste do T3 vale para estes controles também — token compartilhado.

Implementado: `fieldset`/`legend` por grupo (nativo, sem `aria-label` manual),
`min-h-11` (44px) em cada chip, e o mesmo anel de foco de `StyleFacetPicker` —
token `--artificio-focus`, sem valor próprio.

`@testing-library/user-event` **não** está instalado no repo (medido: erro
`Failed to resolve import "@testing-library/user-event"`). Pacote novo exige
aprovação, e os testes existentes usam `fireEvent` — os novos seguiram `fireEvent`,
sem pedir dependência.

**Aceite parcial (medido 2026-09-18):** `ScheduleFacetPicker.test.tsx` verde — grupos
com nome acessível, opção vazia fora da ordem de tabulação, controle acionável por
teclado. **Falta** o alvo de 44px medido em browser: jsdom não faz layout
(`getBoundingClientRect()` devolve zero — `plan.md` §6.2), então a classe está
escrita mas não verificada em pixel. Mesmo bloqueio de T6.2.

### [~] T7.8 — BLOQUEADA por D4 (`spec.md` §6.6)

Medido em produção: **11 mesas ativas** com dia **e** horário `to_define` e nenhum
hint — agenda desconhecida de fato. Não há valor para casar com filtro algum.

Somem em silêncio, ou o filtro ganha opção "A definir" que as traz? Escolha de
produto sobre expor mesa incompleta na busca. Pergunta feita em 2026-09-18,
**sem resposta** até a escrita desta task.

Não confundir com as 9 mesas `defined` + hint: essas têm dia conhecido e entram pelo
ramo do hint em T7.3. Não dependem de D4.

### [x] T7.8b — D5 RESPONDIDA (2026-09-18) — limites das faixas

**Corte adotado: 06/12/18/00.** madrugada `[00:00, 06:00)` · manhã `[06:00, 12:00)` ·
tarde `[12:00, 18:00)` · noite `[18:00, 24:00)`.

Não foi escolha do agente nem sugestão aceita por omissão: é a convenção brasileira
de período do dia (Manual de Comunicação do Senado — madrugada 0–6, manhã 6–12, tarde
12–18, noite 18–24), e coincide com o corte que plataformas de reserva por período
usam em produto (hotelSlots: Morning 6AM–12PM, Afternoon 12PM–6PM, Evening 6PM–12AM,
Overnight 12AM–6AM). Convergência entre uso linguístico e padrão de produto, então
não havia o que inventar — pesquisa, não decisão de produto.

Fonte única dos limites: `DAYPART_RANGES` em `catalogFilterOptions.ts` (frontend) e a
cópia em `routes/tables.ts` (backend, motivo em T7.3). A cobertura de 24 h sem
sobreposição e sem buraco é **asserida por teste**, não confiada à revisão:
`catalogSchedule.test.ts` percorre as faixas ordenadas e exige
`range.startHour === anterior.endHour`.

A sessão de `05:00` do beta cai em madrugada neste corte, como a spec previa. Fica
assim: o corte é o convencional, e `05:00` é madrugada em português.

### [x] T7.8c — D6 RESPONDIDA (2026-09-18) — madrugada com zero resultados

**Decisão do mantenedor: a faixa vazia APARECE, com o contador, e desabilitada.**
`madrugada (0)` em cinza, sem clique, voltando a ser clicável sozinha quando alguma
mesa cair na faixa.

É **exceção deliberada a R22**, e o motivo é a natureza da lista, não preferência:
dia e faixa são listas FECHADAS (7 e 4) que o usuário conhece de fora do produto, e
sumir com 1 de 4 faz o controle parecer quebrado — ele procura o que sabe que existe.
Estilo é lista ABERTA e longa (48 valores na medição de 2026-07-18), onde omitir o
vazio encurta uma lista que ninguém memorizou. R22 segue valendo lá.

Convergente com o NN/g para busca facetada: mostrar a faceta sem resultado com o
contador, ou desabilitá-la, em vez de removê-la — remover esconde que a dimensão
existe. Os três tratamentos que o NN/g aceita são mostrar todas as não-vazias, mostrar
só as essenciais, ou acinzentar as vazias sem permitir clique; remover não está entre
eles.

Consequência que virou trabalho novo: contador real exige contagem do banco, e não
havia nenhuma no catálogo. Ver **T7.12**.

Nos dias não há conflito: nenhum tem zero. A contagem da spec estava subestimada
(contava só `table_schedules`) — pelas duas fontes é sábado 23, sexta 14, segunda 10,
domingo 10, quarta 9, terça 5, quinta 5. O filtro de dia nasce com os 7.

### [x] T7.9 — Entrada no changelog do `mesas`, no merge

Escrever a entrada **no PR que leva a feature**, não depois: o arquivo viaja no build
do backend (`apps/mesas/backend/Dockerfile:137` copia `database/changelogs.json` para
a imagem) e é lido em runtime por `apps/mesas/backend/src/routes/changelog.ts:23`.
Entrada que não está no commit não está na imagem, e o deploy sai com a feature sem o
aviso.

Arquivo: `apps/mesas/database/changelogs.json`. Item **novo no topo do array**, no
formato medido dos existentes: `id` (`AAAA-MM-DD-slug`), `title`, `body` em Markdown,
`"type": "app"`, `"published": true`, `created_at` ISO com offset `-03:00`.

Conteúdo, em português normal e voltado ao jogador (não ao agente):

- o catálogo passou a filtrar por **dia da semana** e por **faixa de horário**
  (manhã, tarde, noite, madrugada);
- funciona no computador e no celular;
- **creditar a sugestão**: o filtro por dia veio de uma sugestão enviada por um
  usuário pelo formulário de reporte. Creditar sem nome — o reporte é
  `Anonimo (visitor)` e não há identidade a citar.

O `mesas` exige entrada no changelog para toda mudança visível ao usuário final —
`apps/mesas/docs/agents/context-capsule.md:77` e `operating-model.md:79`.

**Aceite (medido 2026-09-18):** `node -e` confirma `Array.isArray` true, 29 itens
(eram 28), `items[0].id = "2026-09-18-filtro-dia-horario"`, `published: true`,
`type: "app"`, texto citando a sugestão e sem nome próprio. `rtk git diff --stat`
devolve **8 inserções e 0 remoções** — o arquivo foi reserializado inteiro e nenhuma
das 28 entradas antigas mudou.

Marcada `[x]` quanto ao arquivo, mas a entrada só chega ao usuário no deploy: o
`changelogs.json` viaja na imagem do backend (`Dockerfile:137`). Ver T7.10.

### [x] T7.12 — Rota `GET /api/v1/tables/schedule-facets` (não prevista na spec)

Task que **não existia** no plano: nasceu da resposta de D6 em 2026-09-18. Exibir a
opção vazia com o contador (`madrugada (0)`) exige contagem real por dia e por faixa,
e nada no catálogo fornecia isso.

Por que não deu para reusar o que existia: as listas `PUBLIC_*_OPTIONS`
(`catalogFilterOptions.ts:82-94`) são o mecanismo de R22 no repo, e são **filtro
hardcoded contra uma medição de 2026-08-21** — `PUBLIC_SEAL_OPTIONS` é literalmente
`SEAL_OPTIONS.filter(() => false)`. Não há contagem viva em nenhum filtro do catálogo
hoje; a única faceta com número real era `style-facets`, e essa rota nova segue a
forma dela.

Forma: `UNION ALL` das duas fontes de agenda num CTE, `COUNT(DISTINCT t.id)` por dia
e por faixa, reusando `status='active' AND archived_at IS NULL AND
importedTableIsCurrentSql('t')` — se a contagem usasse predicado diferente do da
lista, prometeria resultado que o catálogo não mostra.

Opção do registro canônico que **não volta** do `GROUP BY` tem zero mesas: o hook
`useScheduleFacets` completa o zero a partir de `WEEKDAY_VALUES`/`DAYPART_VALUES`, em
vez de o backend devolver linha com contagem 0. O hook também descarta valor fora do
registro (dado de rede é `unknown` até normalizar) e mantém `loaded: false` em falha
de rede, para nenhuma opção ser desabilitada por dado ausente.

**Aceite (medido 2026-09-18):** SQL da rota rodado contra produção devolve
`sábado 23 · sexta 14 · segunda 10 · domingo 10 · quarta 9 · terça 5 · quinta 5` e
`noite 55 · tarde 11 · manha 2` (madrugada ausente = 0). `pnpm verify:api` verde:
`mesas breaking=0 non-breaking=1`, rota registrada como `add` em
`api-diff.generated.md` e presente em `api-index.generated.md` como `public`.

### [ ] T7.10 — Conferir em produção depois do deploy

**Aceite:** `curl -s "https://mesas.artificiorpg.com/api/tables?weekday=sexta&daypart=noite&cb=$(date +%s%N)"`
com resultado coerente, e a página de catálogo nos dois viewports com os dois filtros
funcionando. Sem cache-buster mede-se a borda da Cloudflare, não a origem.

### [ ] T7.11 — Reporte do `401 /api/auth/refresh` — nada a corrigir

Medido: `packages/auth/src/client.ts:31` chama `/api/auth/refresh` com
`credentials: "include"` no boot; visitante anônimo sem cookie recebe `401`, que é a
resposta correta do contrato (`apps/accounts/src/app.ts:479`).

Fecha como "não é defeito", sem alteração de código. Registrado para o próximo
reporte igual não virar investigação nova.

---

## Registro de medição — 2026-09-16

Hipóteses testadas e **derrubadas**. Ficam escritas para ninguém reinvestigar:

- **"Cada app tem uma lista de nav própria"** — falso. Fonte única em
  `packages/ui/src/modules.ts:8`; `rtk rg "navItems" apps --type ts` fora de teste
  devolve **zero**. Os 7 itens são idênticos nos 5 apps.
- **"O `glossario` tem header duplicado"** — falso. `GlossarioHeader.tsx:3` importa o
  `Header` de `@artificio/ui`; só embrulha.
- **"A diferença é de espaçamento/geometria"** — falso em 4 dos 5. `site`, `mesas`,
  `links` e `glossario` têm grid, gap, padding e larguras de link **idênticos ao
  centésimo de pixel**. Só o `downloads` diverge, e por causa da busca embutida.
- **"A cor vem da prop `variant`"** — falso. `data-variant` é `null` em todos, e
  nenhum app passa a prop. Vem do token de tema do documento.
- **`curl` não serve para medir header** — `glossario` e `downloads` são SPAs:
  1.852 e 2.136 bytes de HTML, `<div id="root">` vazio, zero `<nav>`. Só browser
  com JS alcança.

## Registro de medição — 2026-09-18 (T7)

- **"O filtro de dia é a primeira lista de dias da semana do `mesas`"** — falso, e o
  aceite original de T7.1 dependia disso. Medido em `origin/dev`, antes desta spec:
  `components/SessionRepeater.tsx` e `features/discord-sync/draftFormUtils.ts` já
  tinham as 7 formas acentuadas. São domínio de **escrita** de mesa e incluem
  `to_define`, que o catálogo não filtra — não são segunda lista do filtro, e não
  foram tocadas.
- **Terceira lista, com representação incompatível:** `pages/OnboardingPage.tsx:45`
  tem um `WEEKDAY_OPTIONS` local que usa **código numérico 0–6** (`{value: 0, label:
  'Dom'}`), para preferência de disponibilidade do usuário. É exatamente a tradução
  paralela que `spec.md` §6.4 proibiu no filtro, já existindo em outro lugar do app.
  Não é escopo de T7 e **não foi mexida**; fica registrado porque colide de nome com
  o `WEEKDAY_OPTIONS` canônico e engana busca textual. Unificar exige decidir o
  domínio (preferência de pessoa × agenda de mesa) — não é conserto óbvio.
- **Padrão textual não mede R6 em lista multi-linha** — `rtk rg "segunda.*terça.*quarta"`
  nunca casaria `catalogFilterOptions.ts`, que escreve um dia por linha. Fonte única
  se verifica por import (quem importa `WEEKDAY_VALUES`), não por regex de conteúdo.
- **`tsc -p tsconfig.json` dá falso-verde no `mesas/frontend`** — o `tsconfig.json` é
  agregador (`"files": []`), então `-p` checa zero arquivo e devolve "No errors found"
  com erro de tipo na árvore. O hook `rtk-enforce` barrou e exigiu `rtk tsc -b`, que
  é o que o CI roda. Quem for checar tipo neste app usa `-b`.
