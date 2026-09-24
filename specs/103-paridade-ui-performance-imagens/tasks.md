# Tasks — Spec 103

Convenção: `[ ]` aberta · `[x]` fechada com medição citada · `[~]` bloqueada ·
`[!]` débito ou achado aguardando decisão do mantenedor.
Task só fecha com o comando que a mediu na mesma linha. "Local", "parcial" e
"falta deploy" não fecham (AGENTS.md §Erros que não podem se repetir).

---

## O que falta

T2.3 e T7.13 fecharam em produção em 2026-09-24. Favicon dos 5 apps e sinais de
anúncio do GA, achados no console da T7.13, fecham com deploy e console conferido.

### Débito e herança (decidido, não pendente)

- **T2.3b** — DÉBITO por decisão dele (2026-09-21): sem chave do Chrome UX Report ou
  Search Console, o número de SEO é laboratório. Não bloqueia o fechamento.
- **T5.1 / T5.2** — HERDADAS pela spec 104 por decisão dele (2026-09-22): cor de
  header e política de subnav se decidem lá, junto com a identidade.

### Aberto como trabalho técnico

- **T5.3 / T5.4** — enunciado incorreto (não há divergência de peso entre apps) e a
  restrição que o guard de T6.1 precisa respeitar.
- **T6.1** — contrato de CSS para a paridade; **T6.2** e **T6.3** bloqueadas por D3
  e pelo alcance de `packages/ui`.

Nenhuma decisão de produto segue pendente na 103. T2.5 saiu: medido em 2026-09-22
que produção serve 126/126 capas do Cloudinary — não era decisão, era medição no
lugar errado.

---

## T1 — `` `}{` `` na busca do portal

Fechada: a T1.2 foi confirmada em produção em 2026-09-21.

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

### [x] T1.2 — Confirmado em produção (2026-09-21)

`curl -s "https://artificiorpg.com/busca/?cb=$(date +%s%N)"` devolveu `200`, e o
bloco `text/pagefind-template` (559 caracteres) tem **0 backtick**, com
`{{#if meta.categoria}}` presente. O cache-buster é o que faz a medição valer: sem
ele mede-se a borda da Cloudflare (`max-age=7200`), não a origem.

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

### [x] T2.1 — Função de URL de entrega em `packages/media`

Recebe a URL do Cloudinary e a largura desejada; devolve a URL com
`q_auto/f_auto/w_<n>` inserido entre `/image/upload/` e o segmento de versão.

Requisitos medidos:
- URL que não seja do Cloudinary volta **intacta** (o mestre pode colar link de
  terceiro — `isArtificioHostedImage`, `imageKinds.ts:178`);
- URL que já tenha transformação não recebe outra;
- a forma é `q_auto/f_auto` separada por barra (doc oficial). Medido: vírgula dá o
  mesmo resultado (2.008 bytes), mas seguimos a doc.

**Aceite:** teste de unidade cobrindo os três casos + `pnpm --filter @artificio/media test`.

**Escrito** em `packages/media/src/deliveryUrl.ts` (`cloudinaryDeliveryUrl`,
`cloudinarySrcset`, `imageKindWidths`) + `deliveryUrl.test.ts`, 23 casos.
`pnpm --filter @artificio/media test`: 95 testes em 3 arquivos, verde. Subpath
`./delivery-url` acrescentado ao `exports` do pacote — sem dependência nova, o
lockfile não muda (`deploy-flow.md` §2 lido).

**A solução do Cloudinary foi medida e DESCARTADA.** O plugin oficial
`responsive()` (`@cloudinary/react` + `@cloudinary/url-gen`) não emite `srcset`:
medido no fonte do pacote (`packages/html/src/plugins/responsive.ts`) que ele lê
`element.parentElement.clientWidth` e reescreve `element.src` num listener de
`window.addEventListener('resize')` com debounce, sem `ResizeObserver`. Isso só
pede a imagem DEPOIS de layout mais JS, que é piorar exatamente o LCP que a T2.3
mede. Além disso exige o cloud name no cliente, e `VITE_CLOUDINARY_CLOUD_NAME`
não é lida por nenhuma linha de `src/` nem validada por nenhum workflow
(`imageKinds.ts:163-169`) — build sem a env esconderia a imagem de todo mundo.
`srcset`/`sizes` no HTML é o padrão que deixa o navegador escolher ANTES de
baixar.

**`w_auto` também descartado, medido.** A doc de responsive images do Cloudinary
lista 5 abordagens e recomenda nenhuma ("Choose the one that best suits your
environment"). `w_auto` depende de client hints (`Sec-CH-Width`/`Sec-CH-DPR`), e
a própria doc admite "incomplete browser support": Safari não implementa client
hints e o Firefox nunca implementou — só Chromium. Além disso `w_auto` ainda
exigiria o `sizes`, então não elimina o trabalho que evitaria.

**A forma com barra é a da doc, confirmada na fonte certa.** A página de
image optimization diz literalmente: "as with any transformation action
parameter, they should be specified as separate components. In a delivery URL,
that means separating them with a slash (`/`), not a comma", com o exemplo
`https://res.cloudinary.com/demo/image/upload/q_auto/f_auto/docs/shoes.jpg`. A
ordem entre os dois é indiferente ("The order of these two parameters doesn't
matter"). Isso torna `apps/site/src/lib/images.ts` divergente da doc, não só do
nosso módulo.

**Bug latente, falha em silêncio:** `isArtificioHostedImage` devolve `false` para
URL com transformação. Medido com as três formas da mesma imagem:

```
ja transformada:  false   (…/upload/w_1200,c_fill/v1788537783/artificio_profile_banners/…)
nossa produzida:  false   (…/upload/q_auto/f_auto/w_800/v1788537783/artificio_profile_banners/…)
crua:             true    (…/upload/v1788537783/artificio_profile_banners/…)
```

A função procura a pasta em `posUpload + 1`, pulando só `v\d+`; o segmento de
transformação desloca a pasta e o predicado falha. Hoje não dói porque nada serve
URL transformada. Ao servir, `ImageUploader.tsx:146` passa a exibir o campo de
link cru como se a imagem fosse de terceiro — regressão da spec 100 F6.4c, com
build verde e nenhum teste cobrindo o caso.

**Corrigido** (autorização nominal do mantenedor para tocar pacote
compartilhado): o predicado agora pula os segmentos de transformação além da
versão, via `isCloudinaryTransformationSegment`, exportada do mesmo módulo. Ela
reconhece transformação pela GRAMÁTICA (`<sigla até 3>_<valor>`, vírgula dentro
do componente) e não por lista de siglas, que envelheceria em silêncio a cada
parâmetro novo da API — parâmetro desconhecido viraria "pasta" e a imagem
deixaria de ser reconhecida como nossa.

`isArtificioHostedImage` **não tinha teste nenhum**; agora tem 14, e a guarda foi
provada vermelha: desligando o `while`, falham exatamente os 3 casos da
regressão (`3 failed | 117 passed`), nada mais.

Isso também torna útil a guarda de idempotência de `cloudinaryDeliveryUrl`, que
antes era código morto — a URL transformada nem chegava nela, e o teste passava
pelo motivo errado (provado: com a guarda desligada, 95 testes seguiram
passando). Hoje é ela que impede empilhar `w_` sobre `w_`.

### [x] T2.2 — `srcset` e `sizes` nos `<img>` que carregam a capa

**A spec apontava o componente errado.** Medido: `CroppedImage` NÃO renderiza o
card do catálogo. `rtk rg "CroppedImage" apps/mesas/frontend/src` devolve só
`AvatarField`, `ImageUploader` e os testes — telas de EDIÇÃO, que não estão no
caminho do LCP. A capa do catálogo é um `<img>` cru em
`apps/mesas/frontend/src/components/TableCard.tsx:354`, sem `srcset`, sem
`sizes`, sem `loading` e sem `decoding`.

O alvo real, medido (`applyTableImageFallback`, 4 consumidores):
- `TableCard.tsx:354` — card do catálogo, 12 por página;
- `TableHero.tsx:42` — herói da página da mesa, LCP maior que o card;
- `TableCardDashboard.tsx:109`;
- `MestreFeaturedTable.tsx:54`.

`sizes` derivado do grid real (`CatalogoPage.tsx:628`,
`grid-cols-1 md:grid-cols-2 xl:grid-cols-[repeat(auto-fill,minmax(280px,420px))]`),
com breakpoint padrão do Tailwind 4.3.1 (`@theme` em `index.css` não sobrescreve
`screens`): `(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw`. O teto
de 420px vem do `minmax`, não de número escolhido à mão.

O card recorta em `16/10`, proporção DIFERENTE do banner (`1200/650`) — as
larguras continuam saindo de `IMAGE_KINDS`, porque o que limita é o arquivo
gravado, não a caixa.

**`object-position` continua** — é o enquadramento escolhido pelo dono. Não trocar
por `c_fill`/`g_auto` (motivo em `plan.md` §3.3).

**Bug que `srcset` INTRODUZ se entrar sozinho.** Medido na spec do HTML: com
`srcset` de descritor `w`, o `src` **não é considerado** ("If srcset uses width
descriptors, src is not considered"), e trocar só `src` por JS não muda nada —
é preciso limpar `srcset` também. `applyTableImageFallback`
(`utils/tableImage.ts:9`) faz exatamente isso: `img.src = bannerPlaceholder`,
manipulando o DOM direto. Com `srcset`, a capa quebrada continuaria quebrada, em
silêncio, nos 4 consumidores. O helper precisa zerar `img.srcset` antes do
`src`, e **não existe teste nenhum** cobrindo esse fallback hoje
(`rtk rg` sobre os 4 consumidores: zero arquivo de teste).

`CroppedImage` não sofre do mesmo: ele troca a origem por estado React
(`failedSrc`), então o re-render sai sem `srcset`.

**Aceite:** `pnpm --filter @artificio/mesas test` verde + o `<img>` renderizado com
`srcset` de ao menos 3 larguras + teste provando que a capa quebrada cai no
placeholder COM `srcset` presente.

**Entregue.** `tableImageAttrs` em `apps/mesas/frontend/src/utils/tableImage.ts`
monta `src`, `srcSet`, `sizes`, `loading`, `decoding` e `fetchPriority` numa
decisão só, consumida pelos 4 `<img>`. O `sizes` é do CHAMADOR, porque descreve
o layout dele: `srcset` acompanhado de `sizes` mentiroso é pior que `srcset`
nenhum — o navegador acredita na declaração e pode escolher variante menor que a
caixa. Marcar tudo como prioritário tira do navegador o critério de fila.

**`priority` estava errado nos três pontos, e a correção mudou de forma: quem
prioriza é o CONSUMIDOR, não o componente.** A primeira versão fixava
`priority: true` dentro de `TableHero` e `MestreFeaturedTable` e não expunha a
prop no card; os três achados vieram da review da PR #328 e os três foram
medidos procedentes:

- **`MestreFeaturedTable` não é o LCP do perfil.** O comentário dela afirmava
  "é a primeira imagem da página" — falso. Medido em `MestrePage.tsx`:
  `MestreHero` renderiza na linha 111 com banner (`MestreHero.tsx:227`) e avatar
  (`:266`); a seção de mesas só entra na linha 169, depois do grupo "Sobre"
  inteiro. Eager+high competia com as duas imagens de fato visíveis. `priority`
  removido.
- **`TableHero` tem TRÊS consumidores, e um deles é um `.map`.**
  `MesaPage.tsx:183` (herói singular da rota), `DecisionBlock.tsx:16` e
  `MasterTables.tsx:61`, que renderiza um herói por mesa do perfil. Fixo, toda
  capa da lista saía `eager`+`high`. Virou prop com default `false`; só
  `MesaPage` passa. Não se deriva de `variant`: `DecisionBlock` também é `full`
  e não é herói de rota.
- **O primeiro card do catálogo saía `lazy`.** `CatalogoPage.tsx:103` mapeava
  sem índice e o card não tinha a prop, então o default `false` alcançava o
  candidato a LCP da rota — a métrica que esta task existe para reduzir (5,9 s).
  `TableCardComponent` recebe `priority`, e o catálogo passa `idx === 0`. Só o
  primeiro, não a primeira fila: em `xl` a grade é
  `auto-fill,minmax(280px,420px)` e o número de colunas depende da janela;
  marcar 3 ou 4 por garantia gastaria prioridade em imagem fora da tela no
  móvel, que é o perfil onde o LCP reprovava.

**`sizes` da mesa destacada mentia por 2x.** Declarava
`(min-width: 1200px) 1200px` — a largura do container — mas
`.mestre-featured-table-link` é `grid-template-columns: 1fr 1fr`
(`MestrePage.css:441`), uma coluna só em `max-width: 768px` (`:589`). A caixa
real acima de 1200px é 600px, então um navegador DPR 1 escolhia a variante de
1200w e transferia ~4x mais pixels numa mudança feita para reduzir payload.
Agora `(min-width: 1200px) 600px, (min-width: 769px) 50vw, 100vw`.

**Guarda:** `apps/mesas/frontend/src/utils/prioridadeCapa.test.ts`, 7 testes.
Afirma sobre a FONTE dos consumidores, não sobre o DOM: a decisão que importa
está na chamada, e montar `MestrePage` inteira exigiria react-query, router e
`useAuth` para provar uma linha de JSX. Inclui um teste sobre o CSS, porque o
`sizes` acima só está certo enquanto a grade tiver duas colunas — trocá-la faz o
teste falhar apontando os dois arquivos. Provado vermelho: revertendo o `sizes`
para `1200px`, falha 1 de 7.

`applyTableImageFallback` agora zera `srcset` e `sizes` antes do `src`. Provado
vermelho: removendo `img.srcset = ''`, falha exatamente 1 teste
(`× limpa `srcset` ao aplicar o placeholder`).

Medido: `mesas-frontend` 1231 testes em 93 arquivos (era 1193 em 89),
`tsc --noEmit` sem erro, `eslint` com 1 aviso pré-existente em
`useBannerScrim.ts:251` (arquivo intocado, `git diff` vazio — mesma família de
dep list incompleta desta spec, não introduzido aqui).

### [x] T2.3 — Fechada em produção: LCP mediana 1,43 s, desperdício de imagem 282 KiB

**Medido em produção (2026-09-24)**, Lighthouse 13.4.0, `--throttling-method=devtools`,
móvel, 3 rodadas com cache-buster em `mesas.artificiorpg.com`: LCP **1.427 / 1.318 /
1.545 ms**, mediana **1,43 s** (alvo 2,5 s). `render-blocking-insight` com **0** itens
e **0** `Stylesheet` na lista de requisições — todo o CSS chega no documento.
`image-delivery-insight` soma **282 KiB** de desperdício nas três rodadas (alvo
1.000 KiB; era 10.644). O histórico abaixo explica como se chegou aqui.

**Aceite:** Lighthouse móvel em `mesas.artificiorpg.com`, mediana de **3** rodadas.
Economia de imagem < 1.000 KiB (era 10.644) e LCP < 2,5 s (era 5,9 s). Uma rodada só
não fecha — o Lighthouse varia.

**O número do aceite depende do método de throttling, e isso precisa estar escrito
antes de qualquer tabela.** Medido em 2026-09-21, a mesma página, no mesmo build:

| `--throttling-method` | LCP (mediana de 3) | o que a medida é |
|---|---|---|
| `simulate` (padrão) | **8,27 s** | projeção do Lantern sobre um trace sem throttling |
| `devtools` | **3,69 s** | Slow 4G aplicado de verdade (request-level) |
| `provided` | 1,5 s | banda da máquina, sem throttling — não serve de alvo |

Os três medem a mesma página. A rede real terminou em **911 ms** nas rodadas
`simulate`; os 8,27 s são o que o Lantern calcula que aconteceria a 1.638 kbps, não
tempo observado. A doc do projeto diz que `simulate` "suffers from edge cases" e que
investigação de performance deve usar throttling real
(`GoogleChrome/lighthouse/docs/throttling.md`).

**Número adotado para o aceite: `devtools`**, porque aplica os mesmos 1.638 kbps de
Slow 4G que o alvo pressupõe, sem inventar o resto. Reprova igual — 3,69 s contra
2,5 s — mas a distância é 1,2 s, não 5,8 s, e é sobre ela que o trabalho se dimensiona.

**O que o Google usa para ranquear NÃO é nenhum destes três.** O sinal de
ranqueamento é CrUX, dado de campo do usuário real, no percentil 75; Lighthouse é
diagnóstico (`web.dev/articles/lab-and-field-data-differences`). **Não medi o CrUX
deste domínio** — a API pede chave que não temos, e o PageSpeed Insights anônimo
devolveu `429 Quota exceeded`. Sem isso não se sabe se `mesas.artificiorpg.com` já
passa ou não passa a avaliação de Core Web Vitals.

**O LCP não é imagem.** Medido no browser com `PerformanceObserver` em viewport de
412×823: o elemento LCP é o **`<h1>`** ("Encontre uma mesa de RPG em 30 segundos",
`size: 24320`), e ele pinta no MESMO instante do FCP — 456 ms na rede local, e nas
rodadas `devtools` FCP e LCP saem idênticos nas três (3,71 / 3,61 / 3,69 s). Cortar
KiB de imagem não move este LCP; o que o move é o que atrasa o primeiro paint.

**Causa raiz medida, e ela não estava no enunciado da task.** O HTML servido traz
**52 `<link rel="preload">`**, dos quais **13 de imagem**, e o primeiro deles está na
**posição 134** do documento — contra a **posição 5684** do primeiro `stylesheet`. O
preload scanner dispara logos de VTT (20 px) e avatares (24 px) antes de enxergar o
CSS que libera o paint, e `root-CXpPGPMT.css` só termina em 229 ms disputando banda
com eles. É a contenção que `web.dev/articles/preload-critical-assets` descreve:
"if too many resources are prioritized, effectively none of them are".

**Quem emite os preloads é o React 19, não o nosso código.** `rtk rg` por `preload`
em `apps/mesas/frontend/src` e em `packages` devolve **zero**; não há `links()` de
rota. O React 19 injeta um `<link rel="preload" as="image">` no `<head>` para cada
`<img>` EAGER que o SSR renderiza (`facebook/react#34217`). **Verificado no React
instalado neste repo**, não aceito da issue: `renderToStaticMarkup` de um `<img>`
sem `loading` produz 1 preload; o mesmo `<img>` com `loading="lazy"` produz **0**.

O HTML de produção tinha **38 `<img>` sem `loading="lazy"`**, quase todos decoração
abaixo da dobra: 20 logos de VTT e 11 avatares.

**Corrigido:** o logo de VTT do `TableCard` passou a `loading="lazy"` +
`decoding="async"` (o avatar do mesmo card já tinha recebido isso junto de
`avatarSrc`). O logo da marca segue eager de propósito — está acima da dobra, e mora
em `packages/ui`, cujo alcance é de 6 apps.

`mesas-frontend` 1239/1239 depois da mudança.

**O `srcset` da T2.2 está no ar e correto**, medido no HTML servido: 21 `<img>` com
`srcSet` de `600w, 1200w, 1600w` e `sizes="(min-width: 1280px) 420px, (min-width: 768px) 50vw, 100vw"`.
Em 412 CSS px com DPR 1,75 o navegador precisa de ~721 px e escolhe **1200w**, a
candidata imediatamente acima — comportamento correto do navegador, não defeito do
atributo. A lacuna é de largura disponível: `imageKindWidths`
(`packages/media/src/deliveryUrl.ts:183`) parte de `minWidth` dobrando, o que dá
600 → 1200 e nenhuma candidata entre as duas. **Isso não afeta o LCP** (que é texto),
mas afeta payload: 1.242 KiB em 18 imagens, de 1.997 KiB totais.

**Não use a auditoria `uses-responsive-images` como prova aqui.** Ela não existe no
JSON do Lighthouse 13.4.0, e ler a chave ausente devolve economia `0 KiB` — zero por
ausência de medição, não por ausência de desperdício (AGENTS.md §Evidência item 8).

**Remedido em produção depois do deploy (2026-09-23), e a hipótese dos preloads de
imagem está REFUTADA.** Lighthouse 13.4.0, `--throttling-method=devtools`, móvel,
3 rodadas com cache-buster: LCP **3.721 / 3.829 / 3.521 ms**, mediana **3,72 s** — os
mesmos 3,69 s de antes. FCP idêntico ao LCP nas três. O HTML servido mudou como
previsto — preload de imagem 13 → **3**, `<img>` eager 38 → **5**, peso total 1.997 →
**1.316 KiB** — e o LCP não se mexeu. Os preloads de imagem não eram o gargalo.

**Causa medida agora:** `lcp-breakdown-insight` dá TTFB 155 ms e **render delay
3.565 ms**. O que segura o primeiro paint é `root-CXpPGPMT.css` (28 KiB, prioridade
VeryHigh): começa em 731 ms e só termina em **3.085 ms**. Até ele terminar, **47
requisições** disputam a banda (633 KiB), das quais **40 são scripts**. A 1.638 kbps,
633 KiB custam ~3,2 s — é o tempo inteiro. A ordem do `<head>` servido é
`modulepreload ×39` **antes** de `stylesheet ×2`: o React Router 7 (framework mode)
emite um `modulepreload` por chunk da rota, e eles saem na frente do CSS que libera o
paint.

**Por que os 39 `modulepreload` saem antes do CSS**, lido no `react-router` 7.18.3
instalado: o `<Scripts>` os renderiza no `<body>`, e o React 19 sobe `<link>` que não
seja stylesheet para o `<head>` como recurso — e recurso sai antes do `<link
rel="stylesheet">` sem `precedence` que o `<Links>` gera para CSS importado por
efeito colateral.

**Correção: CSS global embutido no HTML** (`apps/mesas/frontend/src/root.tsx`,
`<style precedence>` com `?inline`). Três formas medidas localmente — mesmo build SSR
servido por `server.js`, Lighthouse `devtools`, sem compressão nas três:

| forma | LCP |
|---|---|
| original (import de efeito colateral) | 6.478 / 6.425 ms |
| `links()` com `precedence` (remix-run/remix#6685) | 4.006 / 3.875 / 3.887 / 4.039 ms |
| CSS embutido | **2.874 / 3.102 ms** |

A forma com `precedence` põe o CSS antes no `<head>`, mas as requisições começam
juntas (~650 ms) e dividem a banda; embutido, o CSS chega com o documento.
Cascata conferida: 8 propriedades de `h1`, `body`, `header`, `.artificio-nav-link`,
seção, botão "Anunciar Mesa" e busca idênticas entre o build local e produção.
`mesas-frontend` 1245/1245; typecheck limpo. Não há CSP no `mesas` (resposta sem
`Content-Security-Policy`), então `<style>` embutido não é bloqueado. Custo: o CSS vai
no HTML de cada carga completa e no JS do `root` (425 KB cru, 72 KB br).

**Medido em `mesasbeta` depois do deploy (2026-09-23)**, mesma infra de produção
(Cloudflare com `br`), Lighthouse `devtools`, 3 rodadas com cache-buster: LCP
**2.352 / 2.491 / 2.370 ms**, mediana **2,37 s** — passa o alvo de 2,5 s (produção,
antes da correção: 3,72 s). HTML servido: 1 `<style data-precedence>` antes dos
`modulepreload`, documento de 53 KiB transferidos. O último recurso de CSS a
terminar é o `dist-*.css` do `content-editor`, em ~1,95 s.

**Medido em PRODUÇÃO depois do deploy (2026-09-23), mesmo método: LCP 2.633 /
2.273 / 2.614 ms, mediana 2,61 s — REPROVA por 0,11 s** (antes: 3,72 s; o beta deu
2,37 s, e a diferença entre os dois ambientes cabe na variação das rodadas). O
`<style data-precedence>` está no ar, antes dos `modulepreload`. O que sobra no
caminho, medido na rodada 1: documento termina em 993 ms; `dist-*.css` (1,8 KiB, do
`content-editor`) começa em 919 ms e só termina em **1.981 ms** —
`render-blocking-insight` o aponta como único bloqueio, 811 ms; em seguida vem uma
tarefa longa do próprio documento em **2.001 ms, de 478 ms** (estilo e layout), e o
paint sai em ~2,6 s. Sem esse CSS no caminho, a tarefa de estilo começaria logo depois
do documento (~1,0 s). O `dist-*.css` entrava em todo app que importa `@artificio/ui` (o barrel exporta
`GmReviewPanel`, que importa `@artificio/content-editor`, cujo `index.ts:1` fazia
`import './content-editor.css'`).

**Correção nos pacotes (autorizada pelo mantenedor condicionada à medição):**
`content-editor` não importa mais o próprio CSS e o exporta como `./styles.css`;
`comments/styles.css` o traz por `@import`. Só `mesas`, `downloads` e `site`
renderizam componentes do editor, e os três já carregam `comments/styles.css`.
Medido: os 18 seletores distintos do editor (`.artificio-content-editor*`,
`.artificio-markdown-content*`) estão 18/18 no build de cada um dos três (no `mesas`,
embutidos no `root`); zero `@import` sobrando nos CSS gerados; build verde nos 7
apps que importam `@artificio/ui`; testes `content-editor` 132/132, `comments`
293/293, `ui` 148/148, `downloads` 326/326, `site` 203/203. No `mesas` local o
`<head>` fica com 0 `<link rel="stylesheet">` e o Lighthouse sem nenhum recurso
bloqueante: LCP **1.898 / 1.899 ms**, contra 2.874 / 3.102 ms sem a mudança (mesmo
servidor local, sem compressão). Em produção deu 1,43 s (medição no topo).

O peso de imagem é payload, não LCP: entra por custo de dado do visitante, não por
este aceite.

### [!] T2.3b — DÉBITO: sem acesso ao CrUX, o SEO é medido às cegas

Registrado por decisão do mantenedor em 2026-09-21 ("o que precisar da API do Chrome
UX Report, deixe como débito dentro da fase da spec").

**O problema:** o sinal de ranqueamento do Google é CrUX — dado de campo, percentil
75 de usuário real. Lighthouse, em qualquer `--throttling-method`, é laboratório e
serve para diagnosticar, não para saber se o site passa
(`web.dev/articles/lab-and-field-data-differences`). Enquanto o aceite da T2.3 for um
número de laboratório, ele não responde à pergunta de SEO que motivou a task.

**Por que não medi:** a API do CrUX exige chave
(`chromeuxreport.googleapis.com/v1/records:queryRecord` devolveu
`API_KEY_INVALID`), e o PageSpeed Insights sem chave devolveu
`429 Quota exceeded for quota metric 'Queries'`. Sem uma das duas, não se sabe se
`mesas.artificiorpg.com` passa ou reprova a avaliação de Core Web Vitals, nem se tem
tráfego suficiente para aparecer no relatório.

**Para destravar, o mantenedor escolhe uma:** chave da API do Chrome UX Report
(gratuita, console do Google Cloud) ou acesso ao Search Console do domínio. A
primeira é a que automatiza; a segunda dá o mesmo dado pela interface.

**Enquanto isso:** T2.3 segue medindo com `--throttling-method=devtools`, que é o
laboratório mais honesto disponível, e o número dela **não** é o número do Google.

**Achado lateral, CORRIGIDO no mesmo trabalho (AGENTS.md §Bug achado):** 6 URLs do
Cloudinary (**507 KiB**) saíam sem transformação nenhuma
(`/upload/v17…/artificio_avatars/…`), a maior com 217 KiB para renderizar em
`w-6 h-6` (24 px). `cloudinaryDeliveryUrl` já tratava `artificio_avatars`
(`deliveryUrl.test.ts:66-67`), mas o único consumidor de
`@artificio/media/delivery-url` no `mesas` era `utils/tableImage.ts`, que só cobre
capa — quem renderizava avatar importava `image-kinds` (`cropToObjectPosition`) e
montava o `src` cru. É a exceção por app que §Compartilhado por padrão nomeia.

`avatarSrc(src, larguraDeLayout)` entrou em `utils/tableImage.ts`, ao lado de
`tableImageAttrs`, e os **7** pontos que renderizavam avatar passaram a usá-lo, com
a largura que o CSS de cada um declara: `TableCard.tsx:188` (24 px),
`MasterCard.tsx:44` e `TableMaster.tsx:26` (64 px, `w-16`),
`ProfileEditPage.tsx:162` (80 px, `ProfileEditPage.css:38`), `MestreHero.tsx:267`
(96 px, `MestreHero.css:139`), `PlayerPage.tsx:146` (120 px, `PlayerPage.css:73`) e
`MestreBio.tsx:36` (280 px, `MestrePage.css:358`).

**Foram 5 na primeira volta; a revisão da PR #330 achou os outros 2 e um valor
errado, ambos procedentes:**

- `MasterCard` e `TableMaster` recebem o avatar por `vm.masterAvatar`, do view model
  em `packages/catalog-table`, e a varredura inicial buscou por `avatar_url}` — que
  não casa com quem recebe via prop. Corrigido nos dois consumidores, e não no
  mapper: o mapper fixaria UMA largura para caixas de tamanhos diferentes, e quem
  sabe o tamanho é o layout. `packages/catalog-table` tem consumidor único
  (`mesas-frontend`), então normalizar lá seria possível — só não é o lugar certo.
- a bio usava **240 px**, que é o `max-width` do MOBILE (`MestrePage.css:427`,
  dentro de `@media`). No desktop a coluna é de **280 px** (`MestrePage.css:358`), e
  é o caso maior que manda: com 240 o `w_480` gerado ficava abaixo dos 560 px que uma
  tela 2x pede, e a foto do perfil público perderia nitidez.

- e, na terceira rodada, a própria coluna desktop era o eixo errado. `.mestre-bio-photo img`
  tem `aspect-ratio: 3 / 4` e `object-fit: cover` (`MestrePage.css:363-366`), então a
  caixa mede **280×373** e é a ALTURA que manda: um bitmap quadrado mais estreito que
  373 px é ampliado pelo `cover`.

**Três erros no mesmo lugar em três rodadas não são três descuidos — são o desenho
errado.** `avatarSrc(url, largura)` pedia que cada call site copiasse um número do CSS
para o TypeScript, e número copiado é segunda fonte de verdade: diverge na primeira vez
que alguém mexe no CSS, sem nada acusar. A "guarda" que a segunda rodada criou era uma
tabela ligando consumidor a valor de CSS, mantida à mão — ela documentava a divergência
em vez de impedi-la.

**A forma certa já estava no mesmo arquivo:** `tableImageAttrs` resolve a capa com
`srcset` + `sizes` e não tem número mágico nenhum. `avatarSrc` virou **`avatarAttrs`**,
com a mesma forma — `srcset` com as larguras do registro, `sizes` descrevendo a caixa, e
a escolha feita pelo NAVEGADOR, com a geometria real que só ele conhece.

`sizes` é a mesma linguagem do CSS, avaliada contra o viewport real: a media query que
muda o layout muda o `sizes` junto (`PlayerPage`: `(max-width: 768px) 100px, 120px`;
`MestreBio`: `(max-width: 768px) 320px, 373px`). O que era número mágico virou
descrição.

**A justificativa que eu dera para não usar `srcset` era falsa, e foi medida:**
`imageKindWidths('profile_avatar')` devolve `[140, 280, 560, 1024]` — cobre de 24 px em
tela 1x até os 373 px da bio em DPR 2. Não eram "candidatas grandes demais".

`MestreBio` declara `373px` onde a coluna mede 280 px, e isso é proposital: a seleção de
candidata é só por **largura × DPR** (spec do HTML), sem olhar `object-fit`. Declarar 280
faria o navegador pegar um bitmap que o `cover` depois ampliaria para preencher os 373 px
de altura. 373 é a largura equivalente que cobre o eixo limitante.

**A quarta rodada achou um terceiro consumidor perdido, e o `kind` fixo virou
parâmetro.** `MasterHero.tsx` (rota `/mestres/:masterId`, `routes.ts:23`) renderizava
`vm.avatar` e `vm.banner` crus. O avatar cabia em `avatarAttrs`; o banner é
`profile_banner`, kind que a função com `'profile_avatar'` fixo não servia — caso
particular virando duplicação na primeira vez que o segundo caso aparece
(§Compartilhado por padrão). A função virou **`uploadImageAttrs`**, com `kind`
parametrizado.

**Três consumidores perdidos em três varreduras é sintoma do método, não azar.** As
buscas anteriores filtravam por nome (`avatar_url}`, depois `avatar`), e perdiam quem
recebe por prop (`masterAvatar`) ou com outro nome (`vm.avatar`). A varredura que
fechou o assunto enumerou **todos os 48 `<img>` do app** e classificou cada um pela
ORIGEM da URL, não pelo nome da variável. Resultado: 36 sem helper, dos quais 5 eram
upload nosso.

Ficaram fora, com motivo medido:

- **`MestreReviewsSection`** alimenta `GmReviewList` (`packages/ui`), que aceita uma
  URL e não `srcSet`/`sizes`. Sem controlar a tag não há `srcset`, então ali se escolhe
  uma largura só — derivada de `imageKindWidths('profile_avatar')[0]`, não escrita à mão;
- **`MestreHero.tsx:228`** (banner do perfil): `useBannerScrim` mede o pixel com um
  `new Image()` próprio alimentado por `profile.banner_url` CRU (`:204-205`). Pôr
  `srcSet` faria o navegador baixar uma variante enquanto a medição baixa a original —
  **duas requisições da mesma imagem**, e a economia viraria custo. Otimizar pede o
  scrim medir `currentSrc`, que é mudança no hook;
- os demais 31 não são upload nosso: asset estático (`/vtt-logos`, `/sys-logos`),
  imagem de terceiro (`covildolich.com`), metadado OpenGraph de link externo
  (`thumbnail_url`) e screenshot de feedback. `cloudinarySrcset` devolveria string
  vazia para todos.

Entraram na mesma passada dois consumos de capa que ninguém tinha visto:
`DiscordDraftReviewTable` (thumb de 40 px baixando a capa inteira) e `DraftEditorTab`
(160 px), ambos `table_banner`.

**Duas medições derrubaram premissas que estavam no código (CONTRATO ALTERADO):**

**Avatar NÃO é 1:1 no arquivo.** `imageKinds.ts:104` declara "avatar é SEMPRE 1:1", e
isso é verdade para o EDITOR de recorte, não para o que fica gravado:
`storageTransformation` usa `crop: "limit"` (`imageKinds.ts:376`), que preserva a
proporção do que o dono subiu. Medido em produção com `fl_getinfo`, 6 avatares:
**715×893, 768×1024, 683×1024, 800×800, 1024×1024, 241×250** — só dois quadrados.

**`cloudinaryDeliveryUrl` fazia upscale, em silêncio.** Sem modo de corte o Cloudinary
aplica `c_scale`, que AMPLIA quando a largura pedida passa do arquivo
(`cloudinary.com/documentation/resizing_and_cropping`). Medido contra o Cloudinary real
no avatar de 241×250: `w_746` devolveu **746×774 com 127 KiB**, contra **24 KiB** do
original — 5× o peso, zero pixel de detalhe a mais, e um `srcset` declarando largura que
o bitmap não tem. Falha que não quebra nada: a imagem aparece, só pesada.

Corrigido na raiz, em `packages/media/src/deliveryUrl.ts`: o ramo sem recorte passou a
emitir `w_<n>,c_limit`. `c_limit` reduz quando cabe e devolve o original quando não
cabe, então o teto passa a ser o arquivo e não a URL. **Alcança os 7 consumidores de
avatar e o `srcset` das capas**, não só o call site que o revisor apontou. O ramo com
`c_fill` ficou intacto — ali recortar é a intenção declarada por `recortarNaProporcao`.

`onError` de `MestreHero` segue recebendo `profile.avatar_url` cru de propósito: ali
a URL é chave de falha, não fonte de exibição.

**Guarda:** em `tableImage.test.ts`, o `srcset` é comparado contra
`imageKindWidths('profile_avatar')` em vez de contra números fixos — fixá-los recriaria
a segunda fonte de verdade que a refatoração removeu. Mais `c_limit` presente e
`c_scale` ausente em cada candidata, `sizes` acompanhando o `srcset`, URL de terceiro
saindo intacta e sem `srcSet`, e só o avatar prioritário em `eager`. Em
`deliveryUrl.test.ts`, o pedido de 4000 px provando que largura acima do original não
vira upscale. As asserções que fixavam `w_<n>/` sem modo de corte foram reescritas —
eram o contrato antigo.

**Não mexido, medido:** `recommendedWidth: 280` de `profile_avatar`
(`imageKinds.ts:111`) tem o comentário "exibido a 140px no perfil público", que o layout
atual contradiz — a bio renderiza a 373 px de altura. Mudar isso altera o `og:image` e o
`srcset` de todos os apps, e `profile_avatar` é decisão pétrea do mantenedor
(2026-08-18). Fica como divergência documental para ele decidir.

**Validação:** `media` **144/144**, `mesas-frontend` **1244/1244**, `mesas-backend`
1190/1191 (1 skip pré-existente), `site` 203/203, `catalog-table` 36/36,
`image-editor` 15/15, `tsc -b` exit 0, `lint` 0 erro. **Falta a medição em produção**, que
depende de deploy.

### [x] T2.4 — Cruzar com os outros apps

`downloads` e `links` também exibem imagem do Cloudinary. A pergunta é por que eles
não quebraram (AGENTS.md §Compartilhado por padrão).

**Aceite:** medir o payload de imagem dos dois; se servirem original, aplicar a mesma
função.

**Por que o `site` não quebrou, medido:** ele já tem a solução, divergente e
invisível para os outros apps — `apps/site/src/lib/images.ts`
(`optimizedImageUrl`, `responsiveSrcSet`), consumida só por
`apps/site/src/components/Card.astro`. É o defeito que a regra §Compartilhado por
padrão nomeia: a mesma decisão escrita duas vezes, com cinco divergências
medidas contra `deliveryUrl.ts`:

- usa `c_fill`, que RECORTA no servidor. Aceitável no `site` (capa de post não tem
  crop do dono); proibido no `mesas`, onde jogaria fora o `object-position` do
  enquadramento escolhido (`plan.md` §3.3);
- larguras `[360, 540, 720, 960]` escritas à mão, não derivadas de `IMAGE_KINDS`;
- `isCloudinaryImage` aceita QUALQUER `res.cloudinary.com`, inclusive conta de
  terceiro — reescreve o caminho alheio e produz 404;
- vírgula em vez de barra;
- sem guarda de idempotência: duas chamadas empilham transformação.

**Unificado** (decisão dele: "corrija todos e unifique o que precisar
unificar... nessa spec e nessa PR"). `apps/site/src/lib/images.ts` virou camada
fina sobre `@artificio/media/delivery-url`; as duas funções públicas
(`optimizedImageUrl`, `responsiveSrcSet`) mantiveram nome e assinatura, então
`Card.astro` não mudou.

O recorte no servidor virou opção explícita do pacote
(`DeliveryOpts.recortarNaProporcao`), e é a razão pela qual a cópia existia: no
`site` o `c_fill` é a INTENÇÃO (capa de post não tem enquadramento de dono),
enquanto no `mesas` ele destruiria o `object-position`. `ar_` e `c_fill` saem no
mesmo componente separados por vírgula — são parâmetros da mesma ação, e a doc
reserva a barra para ações encadeadas. Proporção malformada é ignorada em vez de
produzir `ar_undefined`.

**Medição que corrigiu meu próprio erro:** eu ia usar `1200/630` (a do
`og:image`). `Card.astro:10-11` declara `720×405` e `360×203` — **16/9**. Usar a
proporção errada mudaria o recorte de toda capa. `203` é o arredondamento de
`202.5`, pré-existente, e `Card.astro` segue intocado.

**Medido nos dados: a otimização do `site` é no-op no build de fixture.**
`apps/site/src/data/posts.json` tem 8 posts, 8 com `image`, hostname de **todos**
`artificiorpg.com` — zero Cloudinary. A versão antiga também não transformava nada,
porque exigia `res.cloudinary.com`. Logo: nenhuma regressão visual na unificação.

**Corrigido em 2026-09-22:** este parágrafo atribuía o no-op à "T2.5 (capas 404)".
Produção serve 126/126 do Cloudinary e é transformada normalmente — ver T2.5. O
no-op vale só para o fixture de 8 posts, não para o site no ar.

**O que este bloco afirmava e a medição desmentiu:** que o caminho do `site`
"passa a funcionar sozinho quando a T2.5 for decidida". **Não passava.** Achado
de review (Codex, PR #328) e medido com uma URL da pasta real do `site`:
`optimizedImageUrl` devolvia a URL **INTACTA** e `responsiveSrcSet` devolvia
**string vazia**.

A causa é `ARTIFICIO_UPLOAD_FOLDERS`, que não tinha `artificio/uploads` — a pasta
onde `apps/site/server/lib/media-store.ts:26` grava a capa enviada pela
biblioteca do admin, e que `apps/site/db/export.ts:61` entrega ao card como
`image`. Sem a pasta na lista, `isArtificioHostedImage` devolve `false` e as duas
funções não fazem nada.

Latente e silencioso: hoje nenhum post usa Cloudinary, então nada aparece. A
primeira capa nativa do blog nasceria sem `srcset` e sem transformação, sem erro
em lugar nenhum — exatamente o que T2.4 existe para dar.

**A varredura achou 5 pastas fora da lista, não 1.** `rtk rg "folder:" apps packages`:
`artificio/uploads` (`site`), `downloads-materials`
(`downloads/backend/src/storage/cloudinaryAdapter.ts:16`), `discord-imports`
(`mesas/backend/src/discord/uploadDiscordImage.ts:32`), `mesas_rpg/dev_feedback`
(`mesas/backend/src/services/cloudinary.ts:57`) e `glossario_rpg/dev_feedback`
(`glossario/backend/src/services/cloudinary.ts:35`). Entraram **quatro**:
`downloads-materials` não é imagem, e o parágrafo seguinte é sobre isso.

**A causa raiz é a lista ser mantida à mão**, não o esquecimento de quem criou a
pasta. `imageKinds.test.ts` ganhou guarda que varre `folder:` em `apps/` e
`packages/` e falha se alguma pasta não estiver na lista — lê o CÓDIGO dos apps,
não uma segunda lista paralela, que só moveria o problema. Provado vermelho:
removendo `artificio/uploads`, falha apontando
`artificio/uploads (apps/site/server/lib/media-store.ts)`.

**O contrato da lista inclui RESOURCE TYPE**, e essa primeira guarda cobrou a
coisa errada. Ela varria `folder:` sem olhar `resourceType`, então cobrou
`downloads-materials` — PDF de material, gravado com `resourceType: 'raw'`
(`cloudinaryAdapter.ts:18`), servido em `/raw/upload/…` (linha 34 do mesmo
arquivo) — e a pasta foi incluída na lista de IMAGENS só para calar o teste.
Guarda que cobra a coisa errada produz a correção errada. Achado de review
(Codex, PR #328), e o defeito era da própria correção da volta anterior.

Duas causas somadas, e o conserto é nas duas porque cada uma esconde a outra:

- `isArtificioHostedImage` procurava `indexOf("upload")`, **sem exigir o
  segmento `image` antes** — embora o comentário da própria função declarasse
  `/<cloud>/image/upload/…` desde o início. `/raw/upload/downloads-materials/x.pdf`
  passava, e `cloudinaryDeliveryUrl` inseria `q_auto/f_auto/w_*` numa URL de PDF.
  Agora o `image` é exigido na posição imediatamente anterior.
- `downloads-materials` saiu de `ARTIFICIO_UPLOAD_FOLDERS`.

`artificio/uploads` **fica** na lista, e é o caso limítrofe: o `site` grava lá com
`resourceType: "auto"` e a allowlist de `admin-api.ts:26-29` aceita `audio/mpeg`,
`audio/ogg`, `audio/wav`, `video/mp4` e `video/webm` além de imagem. O Cloudinary
entrega esses como `/video/upload/`, e a exigência do `image` os recusa sem
precisar de lista separada por pasta — o resource type está na própria URL.

A guarda passou a ler o `resourceType` irmão no mesmo literal de opções (ausente
= `image`, que é o default de `uploadBuffer` em `index.ts:293`) e alimenta duas
asserções, provadas vermelhas uma a uma:

- pasta de imagem fora da lista → `downloads-materials (apps/downloads/…/cloudinaryAdapter.ts)`
  quando a exclusão por tipo é removida;
- pasta `raw`/`video` DENTRO da lista de imagens →
  `downloads-materials (raw, apps/downloads/…/cloudinaryAdapter.ts)`.

A segunda existe porque sem ela recolocar a pasta não deixa nada vermelho: o
predicado novo recusa a URL `/raw/upload/` pelo resource type, então a primeira
asserção continuaria verde com a lista errada. Defesa em duas camadas exige teste
em duas camadas.

**Dano em produção era zero, medido:** `rtk rg "isArtificioHostedImage|cloudinaryDeliveryUrl"`
dá 4 consumidores (`site/src/lib/images.ts`, `links/src/lib/groupLogo.ts`,
`mesas/frontend/src/components/ImageUploader.tsx`, `packages/media/src/deliveryUrl.ts`)
e nenhum recebe URL de material. Bug latente, não ativo.

`images.ts` **não tinha teste nenhum**, o que deixou as cinco divergências
passarem sem ruído. Agora tem 11. `site`: 203 testes em 19 arquivos verdes,
`tsc --noEmit` sem erro, `eslint` limpo.

**Esses 11 testes não exercitavam o `site`, medido.** Usavam uma URL de
`mesas_rpg` — pasta de OUTRO app —, então passavam sem depender de
`artificio/uploads` estar na lista. Foi assim que o defeito acima nasceu coberto
por teste verde: o arquivo testava o pacote, não o caminho do `site`. Achado de
review (Codex, PR #328); a URL passou a ser a da pasta real.

**Trocar a URL revelou uma armadilha de ambiente.** Com a pasta real, 3 dos 11
falharam mesmo com `imageKinds.ts` já corrigido: o `exports` de
`@artificio/media` aponta para `./dist/*.js`, e o `dist` local estava velho. Só
ficou verde depois de `pnpm --filter @artificio/media build`.

No CI isso não acontece — `ci.yml:78` roda `turbo run build` antes dos testes, e
`dist` é ignorado (`.gitignore:7`). É falso-verde LOCAL, e da pior espécie: se a
URL tivesse continuado em `mesas_rpg`, os 3 nunca falhariam e a correção seria
declarada pronta sem nunca ter sido exercitada. Regra registrada no cabeçalho de
`images.test.ts`: editou o pacote e o teste do consumidor não mudou de resultado
— buildar o pacote antes de concluir.

**`links` servia o original, medido em produção.** `links.artificiorpg.com/api/groups`:
13 grupos publicados, 12 com logo na nossa conta Cloudinary, 1 sem, **zero de
terceiro**. Peso somado das 12: **955.063 bytes (932 KiB)** para preencher caixas
de **52px** (`global.css:230-232`, `.card .logo` — não os 104 do atributo
`width`). As mesmas 12 com `q_auto/f_auto/w_208` e `Accept: image/avif,image/webp`:
**94.626 bytes (92 KiB)**. Economia **840 KiB, 90%**. A maior logo sozinha passava
de 143 KiB.

Corrigido com `apps/links/src/lib/groupLogo.ts`, camada fina sobre o pacote (sem
dependência nova: `@artificio/media` já era `workspace:*` no
`apps/links/package.json`). Três consumidores passaram a pedir tamanho:
`GroupCard.astro`, `CommunityGroups.tsx` (card, 52px) e `grupo/[slug].astro`
(ficha, 128px). O `og:image` de `[slug].astro:40` segue com a URL crua de
propósito — plataforma social recorta e reexibe em tamanho próprio, e mandar a
versão de 128px daria preview rebaixado.

**Defeito na RAIZ, achado ao aplicar a função:** `isArtificioHostedImage`
devolvia `false` para a URL real do `links`. Medido nas três formas:
`artificio/links` `false`, `artificio/accounts/avatars` `false`,
`downloads-covers` `false`, `mesas_rpg` `true`. Duas causas independentes, as
duas em `packages/media/src/imageKinds.ts`:

1. a lista de pastas vinha só de `IMAGE_KINDS`, e `ImageKind` é contrato de
   **upload** (proporção, recorte, validação). Três origens gravam na mesma conta
   sem `ImageKind` nenhum — `apps/links/server/lib/cloudinary.ts:5`,
   `apps/accounts/src/app.ts:105`, `coverStorage.ts:6` (`COVER_FOLDER`);
2. a comparação era de UM segmento (`spec.folder === pasta`), e duas dessas
   pastas têm barra, então nunca casariam nem se estivessem na lista.

Consertado com `ARTIFICIO_UPLOAD_FOLDERS` (as cinco pastas reais, cada uma com a
linha da fonte no comentário) e comparação por prefixo de caminho. A falha era
**silenciosa**: `cloudinaryDeliveryUrl` devolve a URL intacta, e o app segue
servindo o original acreditando estar otimizado.

O outro consumidor do predicado é `ImageUploader.tsx:146`, que esconde o campo de
link quando a imagem é nossa. Não é regressão: o critério declarado ali é "a
pasta, que só o nosso backend escreve", e as três pastas novas também são
escritas só pelo nosso backend. Mesma regra, origens que faltavam.

Guarda de prefixo provada vermelha: trocar `caminho.startsWith(`${pasta}/`)` por
`caminho.startsWith(pasta)` deu **2 falhas**, exatamente `artificio/linksxyz` e
`downloads-covers-antigo`.

**`downloads` não tem correção pela URL, e isso foi medido.**
`/api/v1/materials?limit=200`: 16 materiais, 15 com capa, somando **4.207.820
bytes (4.109 KiB)** — a maior 621 KiB — para exibir dentro de 176px de altura
(`max-h-44`). Só que **todas as 15 estão em `img.itch.zone`**, host de terceiro;
zero em `downloads-covers`. A variante de tamanho do itch é **assinada por
asset**, não parâmetro livre: `110x87#` responde 200 num asset que o itch publica
e **404** nas nossas URLs, e `original` responde 200 nas nossas e **404** na dele.
Montar a variante daria 404 — o mesmo defeito que `images.ts` tinha com conta de
terceiro. `cloudinaryDeliveryUrl` devolve essas URLs intactas por projeto.

Aplicado no `downloads` o que **não** depende do host: `MaterialCover.tsx` (ponto
único de exibição de capa, dois consumidores) ganhou `loading`/`decoding`/
`fetchPriority` — `lazy`/`async`/`auto` no card, `eager`/`sync`/`high` na ficha,
onde a capa é o LCP. Sem `loading`, o navegador buscava as 15 capas no primeiro
paint. Sem `width`/`height`: a regra do componente é `object-contain` sem
distorcer, e capa de RPG varia (3:4, 2:3, A4) — o `min-h` do frame já reserva o
espaço. O componente **não tinha teste nenhum**, que é como os atributos ficaram
de fora; agora tem 5, provados vermelhos (remover `loading` → 3 falhas, os 3
casos).

`@artificio/media` **não** é dependência de `apps/downloads/frontend`, e
acrescentá-la mexeria em `package.json` e Dockerfile
(`check_dockerfile_workspace_deps`). Como as 15 capas de hoje são todas de
terceiro, otimizar URL ali não economizaria byte nenhum — fica para quando
`downloads-covers` servir capa de fato (`DOWNLOADS_CLOUDINARY_COVERS_ENABLED`).

**Validado:** `@artificio/media` 139 testes em 3 arquivos (era 132), build e
`eslint` limpos; `downloads-frontend` 326 em 55 (era 321/54), `tsc --noEmit` e
`eslint` limpos; `downloads-backend` 570; `links` build 17 páginas, `tsc` e
`eslint` limpos (`"test"` do app é `echo "(links) no tests"`, então a cobertura
fica no pacote); `mesas-frontend` 1209; `site` 203 em 19; `accounts` 602 (52
skipped, pré-existentes — `git diff apps/accounts` vazio); `pnpm verify:api`
`breaking=0` nos 6 apps.

As URLs do `srcset` foram conferidas servidas, não só montadas: `w_52` 1.240 B,
`w_104` 2.472 B, `w_208` 4.800 B, `w_256` 6.804 B, todas HTTP 200 e
`image/webp`.

### [x] T2.5 — NÃO HÁ 404: produção serve as capas do Cloudinary (2026-09-22)

O achado original (2026-09-19) mediu o **lugar errado** e concluiu por ele. Fica
registrado porque o erro é de método, e a busca custou uma sessão inteira.

**Onde a capa do blog mora de verdade — medir sempre aqui:**

| Camada | Onde | O que tem |
|---|---|---|
| Produção | `site-prod-db`, tabela `posts`, colunas `featured_url` e `og_image` | 126 posts, **126 Cloudinary, 0 `wp-content`** |
| Mapa do import | `site-prod-db`, `media_map` (`wp_url` → `cloudinary_url`, ambos `NOT NULL`) | 444 linhas |
| Acervo | `site-prod-db`, `media` (`wp_url`, `cloudinary_url`, `cloudinary_public_id`) | 125 linhas |
| Snapshot do repo | `apps/site/src/data/posts.json` | **8 posts**, fixture de teste, `wp-content` congelado |

Comandos que medem (read-only, §Autorização permite):

```
ssh faren "docker exec site-prod-db psql -U admin -d site -c \"select count(*) filter (where featured_url like '%wp-content%') as feat_wp, count(*) filter (where featured_url like '%cloudinary%') as feat_cdn, count(*) as total from posts;\""
```

devolveu `feat_wp 0 | feat_cdn 126 | total 126`. O usuário do container é `admin`,
a base é `site` (`POSTGRES_USER`/`POSTGRES_DB` do `docker inspect`); `-U postgres`
falha com `FATAL: role "postgres" does not exist`.

**HTML de produção, com cache-buster:** `/blog/glossario-unificado-para-traducoes-de-dnd/`
devolve `wp-content` **0 vezes**, `res.cloudinary.com` **10 vezes**, e o `og:image` é
`res.cloudinary.com/dnln0btbo/.../Glossario-Unificado-para-Traducoes-de-DD.webp`.
As duas capas citadas como 404 respondem **200** no Cloudinary
(`curl -o /dev/null -w '%{http_code}'` com `?cb=$(date +%s%N)`).

**Por que o achado de 2026-09-19 errou:** mediu `posts.json`, que é fixture de 8
posts (`content.test.ts:4` já dizia "`posts.json` versionado tem 8 posts"), e tratou
como fonte de produção. `content.ts:1-3` marca a etapa: lê o JSON no build local,
"Etapa futura: vira Content Layer loader lendo o store Postgres (D005/D048)". O
`wp-content` do snapshot é real e está morto — só não é o que produção serve.

**Regra que fica:** estado de conteúdo do blog se mede no `site-prod-db`, nunca no
`posts.json`. Contar `"slug"` no JSON também engana — devolve 46 porque taxonomia
usa a mesma chave; `len(json)` devolve 8.

**Não medido:** se os 8 registros do fixture devem ser regerados a partir do banco.
Não afeta produção; afeta só o que o teste e o build local exercitam.

---

## T3 — Contraste e ordem de heading

### [x] T3.1 — Medir antes de corrigir

Extrair o par fundo/texto de `#btn-anunciar-mesa-home`
(`CatalogoPage.tsx:417`) e `#catalog-search-submit` (`CatalogFiltersBar.tsx:282`),
calcular a razão e comparar com WCAG 2.2 (4.5:1 texto normal, 3:1 componente de
interface).

**Aceite:** a razão medida de cada botão, escrita aqui.

**Os dois usam o MESMO par**, medido no código: fundo
`--color-artificio-orange`, que é alias de `--artificio-brand` (`#ff5722`,
`packages/ui/src/styles.css:4`), com `text-white`. Razões pela fórmula normativa
do WCAG 2.x (luminância relativa, não brilho percebido):

- repouso `#ff5722` + `#ffffff` — **3,16:1**;
- hover `#e64a19` (`--artificio-brand-deep`) + `#ffffff` — **3,92:1**.

**O limite é 4,5:1, não 3:1**, e isso foi medido em vez de suposto: o rótulo dos
dois é `text-sm font-semibold`, ou seja 14px/600. "Texto grande" no WCAG 2.2
começa em 18,66px bold ou 24px, e o `@theme` do app (`index.css:7-16`) só
redefine cores — não sobrescreve `--text-sm`. Os dois estados reprovam.

### [x] T3.2 — Corrigido na origem certa, confirmado em produção (2026-09-21)

**Aceite fechado:** Lighthouse Acessibilidade em `mesas.artificiorpg.com` com
cache-buster devolveu categoria **1,0** e `color-contrast` com **score 1 e lista de
achados vazia**. Os dois botões que a spec nomeava estão na página medida, com o par
de token no HTML servido: `#btn-anunciar-mesa-home` sai
`bg-[var(--brand-solid)] … text-[var(--brand-solid-fg)] hover:bg-[var(--brand-solid-hover)]`,
e `#catalog-search-submit` está presente. Zero ocorrência de `ff5722` cru no HTML
contra 75 de `brand-solid`.

Os dois usam token `--color-*` de `packages/ui`. Se o token reprova, o defeito é dos
6 apps e a correção é no token — com verificação nos consumidores. Se só o uso local
reprova, corrige local.

**Aceite:** Lighthouse Acessibilidade sem reprovação de contraste + os outros
consumidores do token conferidos.

**O token NÃO precisa mudar — ele já existe e está correto.** Medido:
`packages/ui/src/styles.css:257-263` define `--brand-solid` / `--brand-solid-fg`
/ `--brand-solid-hover` exatamente para "laranja de marca em papel SÓLIDO", com
o cálculo registrado no próprio comentário. As razões conferem com o que medi:

| | claro | escuro |
|---|---|---|
| repouso | **4,70:1** (`#cf4317` + branco) | **6,00:1** (`#ff5722` + navy `#020740`) |
| hover | **6,07:1** (`#b03a14` + branco) | **4,84:1** (`#e64a19` + navy) |

O par **vira junto** por tema, e é isso que resolve: no escuro o fundo volta a
ser o laranja puro e o TEXTO passa a navy. Por isso `text-white` fixo não serve
como correção — o defeito seria só empurrado para o outro tema.

Uma correção do pacote está registrada errada nele: o comentário da linha 354 diz
que navy sobre `#ff5722` dá "7.4:1"; medido, dá **6,00:1**. Passa AA de sobra, mas
o número da doc do pacote está acima do real. Divergência documental, não de
código — `packages/ui` não foi tocado.

**A spec nomeava 2 botões; a varredura achou 22.** Todos no `mesas`, todos com o
mesmo par medido:

- **14** com fundo sólido laranja + `text-white` — `TableCard.tsx:441`,
  `SystemSuggestionModal.tsx:498`, `SessionRepeater.tsx:103`,
  `SealToggle.tsx:41`, `ScenarioSuggestionModal.tsx:138`,
  `ScenarioSelector.tsx:206` e `:215`, `FilterDrawer.tsx:131`,
  `CatalogFiltersBar.tsx:279`, `ImageUploader.tsx:270`,
  `ParsePreviewTextArea.tsx:151`, `uiHelpers.ts:11`,
  `admin/AdminSidebar.tsx:57`, `SettingSuggestionsPanel.tsx:186`;
- **1** com `text-[var(--fg)]` — `PainelMestrePage.tsx:632`. Este é o pior caso e
  estava invisível: fundo fixo com texto que vira por tema dá **5,92:1 no claro**
  e **2,80:1 no ESCURO**, porque ali `--fg` clareia para `#eef1f8`. É o defeito
  que o comentário de `TableCard.tsx:502` já descrevia;
- **7** herdando a cor do ancestral (`MesaPage.tsx:112` e `:145`,
  `CatalogoPage.tsx:90`, `OnboardingPage.tsx:462`, `MestreNotFound.tsx:12`,
  `MestreError.tsx:16`, `MasterProfilePage.tsx:84` e `:110`) — sem `text-` na
  linha, a razão depende do contexto, e o par sólido a torna independente dele.

Os 22 passaram a usar o par. `hover:bg-[…]/90` virou `--brand-solid-hover`:
opacidade sobre fundo desconhecido não tem contraste garantido, o token tem.

**Dois pontos seguem com laranja sólido, de propósito:** a asserção negativa do
teste novo, e `TableEditor.tsx:508`, que é barra de progresso — sem texto por
cima, o critério é o 3:1 de componente contra a trilha, outro par.

**A varredura de `brightness` achou 4 fora dos 22, dos quais 3 NÃO foram
corrigidos.** `rtk rg "brightness" apps packages` — `hover:brightness-*` não
casa com nenhum dos padrões que acharam os 22, porque o defeito ali não é a
classe de fundo, é o hover. Filtro de brilho clareia ou escurece o fundo sem que
ninguém meça a razão resultante contra a cor do texto, então o estado
interativo perde a garantia que o repouso tem.

Corrigidos: `ParsePreviewTextArea.tsx:151` (já usava o par no repouso, só o
hover era filtro) e `TextPasteArea.tsx:82`, que era o defeito inteiro —
`bg-[var(--artificio-brand)]` + `text-white` fixo, **3,16:1** medido, o mesmo
laranja cru dos 22.

Os outros 3 **ficam com o filtro porque não existe par de token que os
conserte**, medido com a fórmula normativa do WCAG:

| ponto | fundo | texto | claro | escuro |
|---|---|---|---|---|
| `TableCardDashboard.tsx:246` | `--artificio-bronze` `#9c6b43` | `--fg` | **4,10:1** | **4,04:1** |
| `VttPlatformsEditor.tsx:158` | `--special` | `--fg` | 2,68:1 | **3,50:1** |
| `MestreContactForm.tsx:138` | `--special` | `--on-solid-fg` `#ffffff` | 6,98:1 | **3,96:1** |

O rótulo dos três é texto normal, que pede 4,5:1. Bronze reprova nos DOIS temas
com a única cor de texto que o pacote oferece. `--special` passa no claro com
branco (`#7e22ce`) e reprova no escuro (`#a855f7`) com branco E com `--fg`.

**NÃO escurecer os dois tokens, e não criar par para eles.** Essa era a saída
que este bloco registrava (bronze para ~`#8a5c39`, roxo escuro para ~`#8b30d9`,
os valores mais próximos dos atuais que passam 4,5:1). Foi retirada: o mantenedor
declarou a identidade da marca, e a medição confirma que bronze e roxo não
pertencem a ela.

**Identidade, palavras dele:** `#020740` (navy), `#222222` (carvão), `#FF5722`
(laranja) e branco. Confirmada em `midias/telaprincipal.png` (site antigo) e
`midias/Logo-PNG-Negativo-2.png` — laranja, navy, branco e cinza neutro, zero
bronze e zero roxo, e o único botão sólido da página antiga é o de busca, em
laranja. Ele acrescentou: "botões normalmente são laranjas".

Todas as combinações úteis das quatro passam AA, medido:

| fundo | texto | razão |
|---|---|---|
| `#ff5722` | `#020740` navy | **6,00:1** |
| `#ff5722` | `#222222` carvão | **5,03:1** |
| `#ff5722` | branco | 3,16:1 — reprova |
| `#020740` | branco | **18,97:1** |
| `#020740` | `#ff5722` | **6,00:1** |
| `#222222` | branco | **15,91:1** |
| `#222222` | `#ff5722` | **5,03:1** |

O único par que reprova é laranja puro + branco, que é exatamente o defeito que
`--brand-solid` já resolve: laranja escurecido (`#cf4317`, 4,70:1) + branco no
tema claro, laranja puro + navy (6,00:1) no escuro. **Nenhuma cor nova é
necessária** — a identidade declarada já cobre os três botões.

**`#222222` não existe no pacote.** `rtk rg "222222|#222\b" packages/ui/src/styles.css`
devolve **zero**. O mais próximo é `--artificio-charcoal: #0f1014` (`:9`), que é
outro valor.

**NÃO trocar `--artificio-light-ink` por `#222222` — não nesta PR.** O mantenedor
disse que `#222222` era "a fonte e links de menus e outros" sobre branco, e que
"o tema light está muito estranho sem o 222222". Hoje esse papel é `--fg`, que no
claro resolve para `--artificio-light-ink: #0b1220`. A troca é de uma linha e
**quebraria o tema**, medido:

- **`11, 18, 32` está escrito 27 vezes em RGB CRU, nenhuma derivada do token:**
  `styles.css:143` e `:369`, `admin.css:41-44`, e `index.css` com 21 linhas — a
  escada `--fg-muted`/`soft`/`low`/`faint`/`ghost` (`:191-195`) mais as 12 regras
  `[data-theme="light"] .text-white\/NN` (`:242-253`). Trocar só o token deixaria
  o texto principal em `#222222` e os 27 pontos em `#0b1220`: duas cores de texto
  quase iguais no mesmo tema, pior que hoje.
- **A escada reprovaria AA:** `#222222` a 66% sobre branco compõe `#7a7a7a` e
  mede **4,29:1**, abaixo de 4,5:1. O `rgba(11,18,32,.66)` atual dá **6,21:1**.
- **Há trava de paridade:** `check-token-parity.mjs:178-182` exige `lightInk`
  idêntico em `tokens.ts:57` e `styles.css:44`. Mudar um só falha o script.
- **Não é problema de contraste:** `#0b1220` mede **18,72:1** sobre branco e
  `#222222` **15,91:1** — os dois passam AAA. A diferença é de tom, não de
  legibilidade: `#0b1220` é navy escuro, `#222222` é cinza neutro. O navy
  `#020740` É cor de marca declarada, então o texto puxar para navy é coerente;
  o que ele reconhece do site antigo é o cinza.

Fazer certo é PR própria: `tokens.ts` + `styles.css` + recalcular a escada de 5
níveis + as 12 regras `.text-white\/NN` + `admin.css`, com verificação nos apps
que consomem `--fg`. **Virou a spec 104, T1** — medição completa e o que falta
investigar estão lá.

**`--special` reprova como TEXTO no tema escuro — defeito maior que o dos
botões, e atinge outro app.** O comentário do pacote declara "acento especial
(roxo) — **AA sobre claro**" (`styles.css:160`). O claro cumpre: `#7e22ce` mede
**6,98:1** sobre branco. O escuro (`#a855f7`, `:310`) **não**: **3,59:1** sobre
`--artificio-dark-surface` `#1b2a4a` e **4,45:1** sobre `--artificio-dark-canvas`
`#0f1830`. São **14 usos de texto e ícone** roxo (`MasterCard.tsx` 7,
`TableMaster.tsx`, `TableActionPanel.tsx:298`, `ProfileEditPage.css:579`,
`VttPlatformsEditor.tsx:116` e `:123`, e `ImportPreview.tsx:133` no
**glossário**), fora os 2 de `focus:border` em `MestreContactForm.tsx:86` e
`:102`, onde o critério é 3:1 de componente.

O comentário do token diz o que ele foi projetado para fazer e não o que ele
faz — a metade escura nunca foi medida. Falha em silêncio: passa build, passa
teste, e o único sinal é o Lighthouse do tema escuro. **Virou a spec 104, T2**,
junto com os 8 RGB crus, as 38 classes `purple-NNN` e o segundo consumidor de
bronze.

`packages/ui/src/styles.css:1` declara "paleta real (D038). Laranja = acento;
navy = texto". `--artificio-bronze` (`:13`) está no bloco da paleta **sem
comentário** que o justifique, e tem **1 consumidor** — `TableCardDashboard.tsx`.
`--special` não está na paleta: nasce direto no bloco semântico (`:161` claro,
`:310` escuro), também sem comentário. Roxo não aparece em nenhuma declaração de
marca. Escurecer os dois seria gastar trabalho preservando duas cores que a marca
não tem, e ainda deixaria o padrão ausente para o 4º ponto.

A correção é o par que JÁ existe: os três botões passam a `--brand-solid` /
`--brand-solid-fg` / `--brand-solid-hover`, mesmo papel dos 22 corrigidos acima
— são botões de ação, não elementos de outra família. Sem cor nova, sem token
novo, e a guarda existente passa a cobri-los.

**Os 5 estão aplicados** — 3 botões mais 2 pontos que a própria guarda achou:

- `TableCardDashboard.tsx` botão "Arquivar" (era bronze, 4,10:1 / 4,04:1);
- `VttPlatformsEditor.tsx` botão "Salvar" (era roxo + `--fg`, 2,68:1 / 3,50:1);
- `MestreContactForm.tsx` (era roxo + `--on-solid-fg`, 6,98:1 claro mas
  **3,96:1** escuro — defeito num tema só, que é a razão de o par precisar virar
  junto);
- `TableCardDashboard.tsx` badge "🗄️ Arquivada" (era bronze, mesmas razões do
  botão irmão) — **não estava em lista nenhuma**, apareceu na varredura;
- `VttPlatformsEditor.tsx` fundo do checkmark de seleção (era roxo, 2,68:1 /
  3,50:1). Ali o conteúdo é um `<Check>`, então o critério é o **3:1** de
  componente (WCAG 1.4.11), e reprovava mesmo nesse limite mais baixo. Também
  achado pela varredura.

Os cinco perderam o `brightness` no hover onde havia. O par mede 4,70:1 no claro
e 6,00:1 no escuro — acima do 4,5:1 de texto e do 3:1 de componente.

`--artificio-bronze` ficou **sem nenhum consumidor**: `rtk rg "artificio-bronze"
apps packages` devolve só a declaração, o `check-token-parity.mjs:80` e
comentários. Remover é mudança de contrato de `packages/ui` — fica na 104 T2.4,
com autorização própria.

O que sobra de roxo e de bronze **não** é débito solto: virou a **spec 104, T2**,
com a medição completa. Em particular, `--artificio-bronze` tem **2** consumidores e
não 1 — `:246` (corrigido) e `:103`, o badge "🗄️ Arquivada", que segue bronze
com o mesmo par reprovando e não foi tocado, porque badge não é botão.

**Guarda:** `apps/mesas/frontend/src/utils/contrasteMarca.test.ts`, 9 testes. Ele
**calcula** a razão a partir do valor do token lido de
`packages/ui/src/styles.css`, em vez de conferir se a classe cita
`--brand-solid` — conferir o nome passaria mesmo se o pacote trocasse o valor por
um que reprova, que é como este defeito nasceu (`--color-artificio-orange` é nome
correto apontando para cor insuficiente). Inclui varredura do app inteiro, para
que o 23º ponto não entre. Mesmo padrão de `TableEditor.test.tsx:428`.

Provado vermelho duas vezes: voltar um botão ao laranja cru → 1 falha, o botão
exato; voltar `MestreError.tsx` → 1 falha, com arquivo e linha no output.

**Erro meu, corrigido:** a primeira versão do teste recortou o bloco do tema
escuro na MENÇÃO em prosa (`:root = light, [data-theme="dark"] = dark`, linhas
134-136) em vez do seletor real da linha 294, e `--brand-solid` não resolveu.
Comentários fora antes de casar — a mesma pegadinha já registrada em
`TableEditor.test.tsx:444`.

Falta o Lighthouse do aceite, que exige deploy.

### [x] T3.3 — Ordem de heading no catálogo, confirmada em produção (2026-09-21)

`<h3>` sem `<h2>` antes, nos cards.

**Aceite fechado:** Lighthouse Acessibilidade em `mesas.artificiorpg.com` não reprova
`heading-order` (categoria 1,0, nenhuma auditoria binária em falha). Medido no HTML
servido: **1 `<h1>`, 1 `<h2>`, 24 `<h3>`**, com o `<h2>` sendo a contagem de
resultados (`37+ mesas encontradas`, `class="text-sm font-normal"`) entre o `<h1>` e
os cards — a hierarquia que a correção criou, e com o `font-normal` que mantém o
texto visível inalterado.

**Investigado e confirmado.** A rota do catálogo tem exatamente dois níveis:
`<h1>` em `CatalogoPage.tsx:481` e `<h3>` no título da mesa em
`TableCard.tsx:467`. Nenhum `<h2>` — e o `<h2>Filtros</h2>` de
`FilterDrawer.tsx:99` não conta, porque o componente faz `if (!isOpen) return
null` (linha 72) e não entra no DOM no carregamento.

A `<section>` que envolve o grid (`CatalogoPage.tsx:585`) não tinha heading
nenhum, nem visual nem acessível — é a origem, não o card.

Corrigido promovendo a contagem de resultados a `<h2>` em `ResultsHeader.tsx`.
Rebaixar o `<h3>` do card seria o remédio errado: o título da mesa É subordinado
à lista, e rebaixar destruiria a hierarquia em vez de corrigi-la. **O texto
visível não mudou** — nem palavras, nem tamanho, nem peso (`font-normal`
neutraliza o bold que `<h2>` traz por padrão); mudar o que o visitante lê é
decisão de produto, e aqui só a tag mudou.

**Erro meu, corrigido antes de fechar:** pus um `aria-label="Mesas encontradas"`
fixo no heading, para o nome não oscilar entre "Carregando..." e "12 mesas
encontradas". Buscado na WAI-ARIA APG (§Names and Descriptions): `aria-label` em
papel que nomeia a partir do conteúdo "hides descendant content from assistive
technology users and replaces it with the value of `aria-label`" — a contagem
desapareceria justamente para quem usa leitor de tela. Removido; o nome
acessível é o texto visível, como a regra manda.

**Guarda:** `ResultsHeader.test.tsx`, 6 testes (o componente não tinha nenhum) —
nível 2, texto inalterado, ausência de `aria-label`, nome acessível vindo do
texto, estado de carregamento e ausência de `<h1>`/`<h3>` no componente. Provado
vermelho: voltar a `<div>` → 5 falhas.

Falta o Lighthouse do aceite, que exige deploy.

---

## T4 — Login do `downloads` na linha errada

### A causa NÃO é a largura da faixa de busca

`plan.md` §2 e o T4.2 original apontavam `packages/ui/src/styles.css:555`
(`grid-template-columns: auto minmax(0,1fr) minmax(220px,360px) auto` quando
`data-has-search="true"`). Medido: essa regra só troca a LARGURA da 3ª coluna.
Ela não cria coluna nenhuma, então não explica `y:60`.

O que explica é **contagem de slots**. `renderToStaticMarkup` do `Header` com as
props reais do `downloads` no desktop (`showSearch` + `onSearchChange` +
`showChangelog` + `onOpenChangelog` + `showThemeToggle`) devolve **6 filhos
diretos** de `.artificio-header-main`:

```
button.artificio-nav-toggle · a.artificio-brand · nav. ·
label.artificio-header-search · div.artificio-header-tools · div.artificio-session
```

`.artificio-nav-toggle` é `display: none` no desktop e sai do grid, então sobram
**5 itens para 4 colunas**. O 5º cai em linha implícita, e o último filho do DOM
é `.artificio-session` — é ela que desce. É o mesmo defeito que `styles.css:2322`
já avisa por escrito ("Coluna `auto` NÃO encolhe… um 5º filho direto aqui cai em
coluna implícita"), só que ali o aviso foi escrito olhando o mobile.

`downloads` é o ÚNICO app que combina busca embutida com ferramentas: é o único
que passa `onSearchChange` ao `Header` compartilhado
(`apps/downloads/frontend/src/components/AppShell.tsx:146`) e também liga
changelog e tema. Nos outros 4, ou a coluna de ferramentas colapsa, ou não há
busca embutida — 4 itens, 4 colunas, sessão na linha 1.

O guard `Header.slots.test.tsx` não pegou porque o caso da busca embutida
(linha 135) passa só `showSearch`+`onSearchChange`, sem changelog nem tema, e
assere `toContain` em vez de contar. A combinação do `downloads` não tem caso.

### [x] T4.1 — Medir em três larguras

Medido em `https://downloads.artificiorpg.com/` (produção, deslogado) em
2026-09-21, Chrome do mantenedor autorizado nominalmente. O defeito é
pré-existente, então produção serve para medir a causa.

| largura | `grid-template-columns` | `grid-template-rows` | itens visíveis | `.artificio-session` | altura do grid |
|---|---|---|---|---|---|
| 1280px | `139.906px 600.094px 360px 84px` | `44px 44px` | 5 | `x:24 y:60` | 104px |
| 1440px | `139.906px 760.094px 360px 84px` | `44px 44px` | 5 | `x:24 y:60` | 104px |
| 1920px | `139.906px 1240.09px 360px 84px` | `44px 44px` | 5 | `x:24 y:60` | 104px |

**As três são idênticas no que importa.** `grid-template-rows` tem DUAS faixas —
a 2ª é implícita, o grid declara só 4 colunas e nenhuma linha. Só a 2ª coluna
(`1fr`) muda com a largura; `minmax(220px,360px)` fica saturado em 360px nas
três, então a hipótese de que a faixa cederia em 1280px está descartada por
medição. A altura do header foi 105px contra os `min-height: 64px` do contrato.

No viewport real (1817px, `innerWidth` medido) o grid ao vivo dá o mesmo:
`rows: "44px 44px"`, `.artificio-session` em `x:24 y:60`, `data-has-search="true"`,
e `.artificio-nav-toggle` em `display: none` — 5 dos 6 filhos disputam 4 colunas.

⚠️ Ferramenta, para a próxima medição: `mcp__claude-in-chrome__resize_window`
NÃO alcança o viewport. Dois resizes (1280 e 743) e `window.innerWidth` seguiu
1817, com `outerWidth: 0`. As três larguras saíram clonando
`.artificio-header-main` dentro de um container de largura fixa — as faixas do
grid são relativas ao container, e as três larguras alvo estão todas acima do
`max-width: 860px`, o único media query que reescreve este grid.
`plugin:playwright:playwright` devolveu `CONNECT_TIMEOUT` em dois boots.

**Aceite:** as três medições escritas aqui. ✅

### [x] T4.2 — Levantar os consumidores de `data-has-search`

`rtk rg "data-has-search|hasSearch" apps packages` → o atributo nasce em UM
lugar só, `packages/ui/src/Header.tsx:333`, a partir de
`hasEmbeddedSearch = showSearch && Boolean(onSearchChange)` (`Header.tsx:163`).
Consumido por `styles.css:555`, `:2330`, `:2334` e pelos guards
`Header.test.tsx:29,43`.

Zero app lê o atributo. Os `hasSearchQuery` de
`apps/glossario/frontend/src/App.tsx:53,81,92,117` são estado de busca do
glossário, sem relação. Dos `onSearchChange` em `apps/`, só o do `downloads`
(`AppShell.tsx:146`) vai ao `Header`; os de `accounts/AdminRolesPanel.tsx:324`,
`mesas/SystemsAdminView.tsx:164` e `mesas/ScenariosAdminView.tsx:165` são
toolbars de admin.

Consequência para T4.3: mexer na regra de busca afeta só o `downloads`, mas
mexer na CONTAGEM de colunas afeta os 5 consumidores.

### [x] T4.3 — Corrigir o grid

As três saídas de `plan.md` §2 foram escritas contra a causa errada (largura de
faixa) e nenhuma delas foi usada. A correção é a 5ª faixa em
`packages/ui/src/styles.css`, dentro da regra de `[data-has-search="true"]` que
já existia para este caso:

```css
grid-template-columns: auto minmax(0, 1fr) minmax(220px, 360px) auto auto;
```

**A correção mora no pacote, e não no app, porque o defeito é do pacote.** O
`Header` OFERECE `onSearchChange` desde a spec 087, com CSS e guards próprios, e
essa prop quebrava o layout que o próprio pacote declara. Medido: `glossario`
(`GlossarioHeader.tsx:56-59`), `links` (`LinksHeader.tsx:25-30`) e `mesas`
(`AppShell.tsx:61-64`) passam as MESMAS três ferramentas do `downloads`
(`showThemeToggle` + `showSearch` + `showChangelog`) e não quebram — eles usam
`onSearch`, a lupa, que entra DENTRO de `.artificio-header-tools`. `downloads` é
só o primeiro consumidor da forma embutida, não um caso particular.

Corrigir no app seria tampar buraco: a prop seguiria quebrada para o próximo
consumidor.

A regra base (4 faixas) ficou intocada, e nenhum dos outros 6 consumidores casa
este seletor — `data-has-search` só é emitido com `hasEmbeddedSearch`
(`Header.tsx:163`, `:333`). O override dentro de `@media (max-width: 860px)`
segue com 4 faixas de propósito: lá a busca vira `grid-column: 1 / -1; grid-row: 2`
e não disputa coluna, então a 5ª sobraria vazia comendo `gap`.

**Dois guards, cada um provado vermelho em separado:**

`styles.contract.test.ts` — "dá à busca EMBUTIDA uma faixa própria, sem linha
implícita". Conta as faixas em vez de fixar a string (`minmax(220px, 360px)` é
UMA faixa: a vírgula interna é neutralizada antes do `split`) e exige
`comBusca === base + 1`. Vermelho ao reverter a 5ª faixa:
`expected 4 to be 5`. Mais "devolve as 4 faixas em ≤860px", que trava o override
e o `grid-row: 2` juntos.

`Header.slots.test.tsx` — "conta 6 filhos com busca EMBUTIDA mais ferramentas",
a combinação real do `downloads`, com igualdade da lista inteira em vez de
`toContain`. Vermelho ao remover a busca do render:
`expected [ …(4) ] to deeply equal [ …(5) ]`. Mais "a lupa NÃO cria filho a mais",
que trava o contraste que explica por que só o `downloads` quebrava.

O guard antigo não pegou porque o caso de busca embutida (linha 135) passa só
`showSearch`+`onSearchChange`, sem changelog nem tema, e assere `toContain` em
vez de contar.

**Validação:** `packages/ui` 148/148 · `downloads-frontend` 326/326 ·
`mesas-frontend` 1234/1234 · build do pacote exit 0.

**Aceite:** `.artificio-session` com `y < 60` nas três larguras, nos 5 apps, e nenhum
consumidor regredido.

**Fechado em produção (2026-09-21), via Playwright contra os domínios reais:**
`downloads` mede `y = 12` em **1280, 1440 e 1920 px**, com
`grid-template-columns` de **5 faixas** nas três (`90px 523px 360px 84px 96px` em
1280). Os outros quatro consumidores também medem `y = 12`, e nenhum deles emite
`data-has-search` — confirmação de que a 5ª faixa só alcança quem usa a busca
embutida, como o seletor promete.

---

## T5 — Paridade de cor, peso e subnav

### [x] T5.0 — Causa raiz: o `site` não usava o `Header` do pacote — **CORRIGIDA (2026-09-21)**

T5 foi escrita como três divergências de aparência entre apps. Medido, é **uma**
causa: seis apps importam `Header` de `@artificio/ui` — `links`
(`LinksHeader.tsx:2`), `site-admin` (`App.tsx:2`), `glossario`
(`GlossarioHeader.tsx:3`), `downloads` (`AppShell.tsx:3`), `mesas`
(`AppShell.tsx:3`) e `accounts` (`main.tsx:3`). O `site` **não**: importa só peças
soltas (`ChangelogButton`, `NavToggle`, `NotificationBell`, `ThemeToggle`) e abre
`<header className="artificio-header">` + `.artificio-header-main` à mão em
`SiteHeaderIsland.tsx:324-325` — o mesmo markup que `packages/ui/src/Header.tsx:324,333`
já produz.

Pelo AGENTS.md §"Compartilhado por padrão; exceção por app é o defeito", isso é
defeito, não escolha: o app reimplementa o componente compartilhado usando as classes
CSS dele. Toda divergência que T5.1/T5.2/T5.3 mediram nasce daí, e cada uma seria
corrigida app a app enquanto a origem seguiria de pé.

**O comentário que justifica a duplicação está desatualizado — medido, não inferido.**
`SiteHeaderIsland.tsx:296-319` declara como contrato que "a ilha é dona do `<header>`
inteiro", com o motivo de que a subnav precisa ser 2ª linha e irmã de
`.artificio-header-main`. O `Header` do pacote já faz exatamente isso:
`.artificio-header-main` fecha em `Header.tsx:462` e `.artificio-subnav` abre em
`:465`, fora dele e dentro do `<header>` — irmã, como o comentário pede. Vem por prop
(`hasModuleNav`/`moduleNav`, `:464`, com `moduleCurrentHref` e `moduleLabel` em
`:469-473`) e tem suíte própria (`packages/ui/src/Header.subnav.test.tsx`). Nasceu na
spec 102 T7.5, citada em `Header.tsx:466-468`; o comentário da ilha descreve o estado
anterior a ela.

**Aplicado.** `SiteHeaderIsland.tsx` virou adaptador e devolve `<Header>` de
`@artificio/ui`: −351/+78 linhas (379 → 143). Mapeamento, sem prop nova no pacote:
`modules` → `navItems`; `sections` → `moduleNav` + `moduleCurrentHref` + `moduleLabel`;
hambúrguer público, marca, painel mobile e rodapé de ferramentas → internos do `Header`;
`showThemeToggle`/`showSearch`+`onSearch`/`showChangelog`+`onOpenChangelog`+`changelogHasBadge`;
`sticky` default true. **Contrato de `packages/ui` intocado — os outros 6 apps não foram
tocados.**

Três pontos que a troca exigiu resolver, cada um medido:

1. **Destaque da categoria do blog.** `Nav.normalizeHref` compara por igualdade; as
   categorias precisam de PREFIXO (`/blog/categoria/guias/` destaca "Guias"). O item
   ativo passou a ser resolvido na ilha (`secaoAtiva`) e chega ao `Nav` como href exato.
   Medido no `dist`: `/blog/categoria/guias/` emite `aria-current="page"` na categoria
   certa; `/blog/` não emite em nenhuma, que é o correto.
2. **Busca.** O botão do pacote não emite `id="search-toggle"`, e `SearchModal.astro:104`
   casa por ele — falha silenciosa, sem quebrar build nem teste. Medido que `:106` já
   escuta `artificio:open-search`, o evento que `openSearch` dispara: o `id` era caminho
   redundante. `onSearch={openSearch}` cobre, sem prop nova.
3. **Marca.** `logoNavy`/`logoNeg`/`brandName` saíram da interface e do `.astro`: o
   `Header` importa de `packages/ui/src/brand.ts` e emite as duas `<img>` com `src`,
   `width`, `height` e `alt` (`Header.tsx:353-368`) — a mesma fonte dos outros 6 apps.

**Verificação.** Linha-base antes da edição: 19 arquivos, 203 testes, verde. Depois:
19/203 verde, `SiteHeader.estrutura.test.tsx` 7/7 — e esse guard roda o `.astro` REAL
pela Container API, cobrindo os 5 filhos diretos do grid, `<style>`/`<script>` fora dele,
subnav irmã, `artificio-nav-toggle` de ≤860px e os 11 links do SSR. `eslint` 0 erros,
`build` completo, `verify:api` breaking=0. Medido no `dist/index.html`: 11
`artificio-nav-link`, 1 `artificio-subnav`, 1 `artificio-nav-toggle`, 2
`artificio-brand-logo`, 1 `artificio-header-tools`.

**Achado P1 do Codex na PR #329 — procede, corrigido.** A primeira versão da troca não
passou `actions` ao `Header`, e o sino sumiu do portal: o header antigo montava
`<NotificationBell sourceApp="site" />` direto no dropdown, enquanto o compartilhado só
renderiza conteúdo de módulo que chega por `actions` (`Header.tsx:281`). Usuário logado
ficava sem sino, sem contagem de não lidas e sem acesso às notificações. Medido no
`dist/index.html` daquele commit: **zero** ocorrências de "otification". Corrigido com
`actions={<NotificationBell sourceApp="site" />}`, o mesmo caminho de `downloads`
(`AppShell.tsx:154`). Provado no artefato: `dist/_astro/SiteHeaderIsland.*.js` passou a
conter `sourceApp:"site"` e as rotas `/api/v1/notifications`, `/unread`.

**Vão de teste que deixou o P1 passar — ABERTO.** Nenhuma das 6 suítes do `site` cobre o
sino, e não é descuido: ele vive dentro do painel de sessão, que exige usuário logado E
clique no avatar (`Header.tsx:260`, estado `open` interno). O guard de estrutura
renderiza o `.astro` real, mas em SSR `useSession` devolve `user: null` e o dropdown nem
existe — a mesma limitação que `Header.sessao.test.tsx` registra no pacote ("o HTML
servido mostra a barra, nunca o menu aberto"). Um guard de verdade precisa de jsdom mais
`@testing-library/react`, que está em 8 pacotes do monorepo mas **não** no `apps/site`
(`package.json` não o lista). Acrescentá-lo é pacote novo e mexe no `pnpm-lock.yaml` —
exige autorização nominal (AGENTS.md §Autorização). O guard foi escrito e removido da
árvore; falta a decisão sobre a dependência.

**Não medido:** aparência em browser real e o comportamento em ≤860px. Os guards cobrem
estrutura e HTML servido, não layout computado — é o mesmo vão que T6.2 registra (jsdom
não faz layout).

### [!] T5.1 — HERDADA PELA SPEC 104 (decisão do mantenedor, 2026-09-22)

Decisão: **"ainda vamos fazer a 104, fechar deixando para a 104 resolver"**. A 103
não escolhe cor de header. O bloqueio abaixo é o material que a 104 recebe pronto.

#### Registro do bloqueio (D2, `spec.md` §4)

Qual cor de header vira padrão. `mesas` é branco sobre azul `rgb(27,42,74)`; `site` é
`rgb(2,7,64)` sobre branco. Convergir para o `mesas` muda o header do portal de
branco para azul escuro.

Pergunta feita ao mantenedor em 2026-09-16, **sem resposta** até a escrita desta
spec. Não há decisão registrada.

**Bloqueio novo, medido em 2026-09-21:** o azul do `mesas` é
`--artificio-navy: #1b2a4a` (`packages/ui/src/styles.css:10`), e a spec 104 §2
declara a identidade em quatro cores com navy `#020740` — o do `site`. A §7 da 104
fecha: "nenhuma cor nova além das quatro declaradas, salvo variação de luminosidade
das próprias". `#1b2a4a` não é variação de luminosidade de `#020740`. Decidir T5.1
pelo `mesas` fixaria como padrão de header uma cor que a 104 pode declarar inválida.

A resposta passou a pertencer à 104: decidir aqui é adiantar decisão de cor daquela
spec. **Não medido:** nenhuma task da 104 cita `--artificio-navy`, então não se sabe
se ela pretende redefinir o token ou só o texto do tema claro (T1).

### [!] T5.2 — HERDADA PELA SPEC 104 (decisão do mantenedor, 2026-09-22)

Política da subnav. O `mesas` gasta a faixa inteira com 1 item ("Catálogo"); o `site`
usa 4 itens de conteúdo. Sendo o `mesas` o alvo, a faixa de um link vira o padrão, ou
o `mesas` passa a listar as seções do módulo?

Perguntado em 2026-09-16. Em 2026-09-22 o mantenedor decidiu **não responder na 103**:
vai junto com T5.1 para a 104, porque subnav e header são a mesma faixa visual e
decidir um sem o outro fixa metade do desenho.

### [ ] T5.3 — Peso do link do nav — **o enunciado estava errado**

Escrita como "peso 600 no `site` contra 500 nos outros quatro". Medido em 2026-09-21,
**não existe divergência de peso entre apps**. Os cinco usam a mesma regra do pacote:
`.artificio-nav-link` é `font-weight: var(--weight-medium)`
(`packages/ui/src/styles.css:791`), com `--weight-medium: 500` (`:86`).
`rtk rg "artificio-nav-link" apps packages` não devolve override de peso fora do
pacote, e `rtk rg "--weight" apps/site/src` devolve zero. Os `font-weight: 600` do
`apps/site/src/styles/global.css` são `.chip` (`:83`), `.paginador-*` (`:383`) e
`.notfound a` (`:395`) — nenhum alcança o nav.

**De onde veio o 600:** `packages/ui/src/styles.css:803-806`,
`.artificio-nav-link[aria-current="page"]` usa `var(--weight-strong)` = 600. O link da
página ATUAL é mais grosso; os demais ficam em 500. O `site` tem várias seções no
menu e quase sempre uma delas está ativa, então há sempre um 600 na tela; o `mesas`
tem um item só (T5.2). Quem mediu comparou o link ativo de um app com o link inativo
de outro e leu como divergência entre apps. É a mesma regra nos cinco.

Não há o que corrigir aqui, e **baixar para 500 seria regressão**: apagaria a
marcação de "você está aqui" no peso. Sobreviveria só a borda inferior colorida
(`:803-804`), que é distinção por cor sozinha — WCAG 1.4.1.

**Fica pendente** de qual correção sair da causa raiz acima: se o `site` passar a
consumir o `Header` do pacote, o peso continua vindo da mesma regra e a task some por
construção.

**Aceite:** nenhum. Task reclassificada como enunciado incorreto, não como trabalho.

### [ ] T5.4 — Guard do peso não pode congelar cor (achado de 2026-09-21)

T6.1 pede contrato cobrindo "peso, cor, gap e padding" do link do nav, e a 104 T1 vai
trocar `--artificio-light-ink: #0b1220` por `#222222`. Guard que assere hexadecimal de
cor congela o que a 104 precisa mudar; guard que assere o token (`var(--fg)`,
`var(--weight-medium)`) não. Vale para o eixo cor de T6.1 — os outros três eixos não
têm essa restrição.

As duas specs estendem o mesmo arquivo (`packages/ui/src/styles.contract.test.ts`,
104 T3.2). Suítes disjuntas: 103 mede peso/cor/gap/padding do nav, 104 mede razão de
contraste de pares `*-solid`. Conflito possível é de merge, não de contrato.

O contrato hoje alcança só a subnav (`styles.contract.test.ts:210`,
`.artificio-subnav .artificio-nav-link[aria-current="page"]`); o nav principal não tem
nenhuma assertiva.

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
corrigidos no commit `4031ddc`. Achados 11-12 são das duas ferramentas sobre o
`4031ddc`, corrigidos no commit `b9d7e82`. PR #327 mergeada em `dev` no merge
commit `1f6f639`. O resto da spec entrou depois pela PR #330, mergeada em
`9d8208c` (2026-09-22).

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

### [x] T7.4 — Desktop: controle no painel de filtros avançados

**Fechado em 2026-09-21**, Playwright a 1440×900 contra `mesas.artificiorpg.com`: com
o painel aberto, clicar "Sexta" leva a URL a `?weekday=sexta` **sem clique extra**, e
"Noite" a `?weekday=sexta&daypart=noite`. O resultado passa de `37+ mesas
encontradas` para `4 mesas encontradas` com 4 cards, o badge do botão vira
`Mais filtros2` e os dois chips ficam com `aria-pressed="true"`. As 4 mesas batem com
o `total: 4` que a API devolve para a mesma combinação (T7.10).

`ScheduleFacetPicker.tsx` novo, montado por `CatalogAdvancedFilters.tsx` nas duas
superfícies. `advancedCount` já conta dia e faixa: `activeCatalogFiltersCount` passou
a somar `weekdays.length + dayparts.length` junto de `styles.length`.

Posição no painel: agenda **antes** de experiência/tipo. Decisão técnica de UI
(AGENTS.md §Produto vs. técnico) — "quando posso jogar" filtra mais gente, e foi o
pedido original do usuário anônimo. Reverter é mover um bloco JSX.

### [x] T7.5 — Mobile: mesmo controle no `FilterDrawer`

O drawer é `md:hidden` (`FilterDrawer.tsx:84,95`) e usa draft + botões Aplicar/Limpar
(`CatalogoPage.tsx:476-497`). Dia e faixa entram no `mobileAdvancedDraft` junto de
`experience`, `type`, `seal` e `styles` — nenhuma lista nova, a mesma
`CatalogAdvancedFilters` com `idPrefix="catalog-advanced-mobile"`.

Duas superfícies, uma definição (R15). Componente duplicado aqui é o defeito.

**Fechado em 2026-09-21**, Playwright a 390×844 contra produção: o drawer traz os
mesmos dois `fieldset` ("Dia da semana" com 7 chips, "Horário" com 4) mais os botões
`Limpar`/`Aplicar`. Marcar "Sexta" e depois "Noite" **não** mexe na URL (segue
vazia); o clique em `Aplicar` a leva a `?weekday=sexta&daypart=noite`, com
`4 mesas encontradas` e badge `2`. Reabrindo o drawer, `Limpar` zera os dois grupos
junto do resto (nenhum `aria-pressed="true"` sobra) e o `Aplicar` seguinte devolve a
URL limpa — a constante `EMPTY_ADVANCED_DRAFT` fazendo efeito.

Dois pontos que a execução mudou, ambos para eliminar lista repetida — cada
repetição era um lugar onde dia e faixa seriam esquecidos em silêncio:

- `AdvancedFiltersDraft` é `Pick<CatalogFilters, ...>` e ganhou os dois campos; os
  dois call sites passam `filters={mobileAdvancedDraft}` / `filters={filters}`
  inteiros, em vez de reconstruir o objeto campo por campo.
- **"Limpar" tinha o estado vazio como literal inline** (`{ experience: '', type: '',
  seal: '', styles: [] }`). Mantido assim, dia e faixa **sobreviveriam ao "Limpar"** e
  nenhum tipo reclamaria — o literal era atribuído a um `Pick` mais largo via
  `setState`. Virou a constante `EMPTY_ADVANCED_DRAFT`, um lugar só.

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

### [x] T7.7 — Acessibilidade e alvo de toque do controle novo

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

**Aceite (medido 2026-09-18):** `ScheduleFacetPicker.test.tsx` verde — grupos com nome
acessível, opção vazia fora da ordem de tabulação, controle acionável por teclado.

**O pixel que faltava foi medido em 2026-09-21**, Playwright contra produção, que é o
que jsdom não alcança (`getBoundingClientRect()` devolve zero — `plan.md` §6.2). Os
**11** chips dos dois grupos medem **44 px de altura** nas duas superfícies (desktop
1440×900 e drawer mobile 390×844); a largura varia com o rótulo (71–105 px). Os dois
`fieldset` trazem `legend` "Dia da semana" e "Horário", nome acessível nativo, sem
`aria-label` manual. O foco vem do token compartilhado: `focus-visible:outline-[3px]`
com `outline-[var(--artificio-focus)]`, e `--artificio-focus` resolve para `#e64a19`
no documento; `tabIndex` é 0.

Como efeito colateral útil, a contagem de cada chip confere com a API: "Sexta(5)",
"Domingo(3)", "Noite(24)", "Manhã(2)" batem com `/api/v1/tables/schedule-facets`.

### [x] T7.8 — D4 RESPONDIDA (2026-09-22): opção "A definir" no filtro

Decisão do mantenedor: **"filtro a definir"** — a agenda desconhecida vira opção
explícita, não some em silêncio.

**Implementado em três pontos, porque o valor atravessa URL, query e contador:**

`catalogFilterOptions.ts` ganha `WEEKDAY_TO_DEFINE = 'to_define'`, último item de
`WEEKDAY_OPTIONS` com label "A definir". O literal repete
`SCHEDULE_DEFINITION_STATUSES` (`tableValidators.ts:38`), que é o que
`schedule_day_status` guarda — sentinela paralelo criaria tradução entre URL e
coluna, e tradução diverge.

`routes/tables.ts` separa `to_define` dos dias **antes** de montar SQL
(`namedWeekdays`): o CHECK de `day_of_week` e o de `schedule_day_hint` não conhecem
esse literal, então deixá-lo num `IN (...)` devolveria zero linhas em silêncio. O
filtro ganha um **terceiro ramo**, `schedule_day_status = 'to_define' AND
schedule_day_hint IS NULL`. Mesa com hint fica fora dele de propósito: já é
alcançável pelo dia do hint, e entraria nas duas opções.

`/schedule-facets` ganha um `SELECT` próprio, **fora do CTE `agenda`** — a mesa de
agenda desconhecida não tem linha lá, porque os dois ramos do `UNION` exigem dia ou
hint. Sem ele a opção voltaria com contagem 0 e a UI a ofereceria como filtro que
não traz nada.

**Pesquisado antes de projetar (AGENTS.md §Pesquisar):** a faceta "sem valor" é
padrão estabelecido — Solr expõe como parâmetro `missing`, que conta os documentos
que casam a query mas não têm valor no campo; o Azure AI Search resolve por valor
default no índice. Os dois confirmam o formato adotado: valor próprio na mesma
faceta, não faceta separada. A diferença aqui é ser opt-in — marcar "A definir"
traz as mesas; filtrar por `sábado` continua sem trazê-las, porque ausência de dado
não é correspondência (mesma regra do ramo do hint).

**Medição que corrigiu o número desta task (2026-09-22, `mesas-db` read-only):**
a task dizia "11 mesas ativas". Hoje são **12** com `schedule_day_status='to_define'`
e sem hint — mas **só 1 é visível no catálogo**. As outras 11 são
`origin='imported'` fora da janela de `importedTableIsCurrentSql`, e o catálogo já
não as mostra em filtro nenhum. Quebra medida: `manual 1` (visível 1),
`imported 11` (visíveis 0). O predicado de visibilidade entrou no terceiro ramo e no
contador justamente por isso — sem ele, o filtro prometeria 12 e a lista mostraria 1.

**Correção dos dois achados P1 do Codex (PR #331)** — o mesmo defeito visto dos dois
lados do `OR` em `weekday=to_define&daypart=noite`:

- O ramo do `to_define` entrava **sem a condição de faixa** e trazia qualquer mesa
  de dia indefinido, inclusive de outro horário. A faixa passou a entrar nele com
  `AND`.
- Os ramos de agenda conhecida (sessão e hint) entravam **só com a faixa**, porque
  `to_define` sai da lista de dias antes do SQL, e traziam qualquer mesa noturna de
  dia **definido**. Agora só entram com dia nomeado na URL ou sem filtro de dia
  (`knownAgendaApplies`). Teste conferido invertido: forçando o comportamento
  antigo, o caso falha.

Medido em produção ao corrigir, e o caso é real, não teórico: existe **1 mesa** com
`schedule_day_status='to_define'` e `schedule_time_status='defined'`. Ela tem
`schedule_time_hint='19:00'` e **zero linhas em `table_schedules`** — conferir só
`ts.start_time` a perderia em silêncio. A condição cobre as duas colunas
(`schedule_time_hint` OU `EXISTS` sobre `table_schedules`).

**Testes diretos do predicado** (achado do CodeRabbit, mesma PR), em
`tables.schedule-filter.test.ts`: `weekday=to_define` sozinho; combinado com dia
nomeado; combinado com `daypart` (o caso do P1); e o contador de
`/schedule-facets`. O teste do contador compila o SQL real pelo dialeto — medido
que o executor recebe o nó cru (`kind`/`sqlFragments`/`parameters`), não um objeto
compilado, então ler `.sql` direto devolvia string vazia e a asserção passava sem
medir nada. Verificado invertendo a asserção: falha com o SQL real na mensagem.

**Não confundir** com as mesas `defined` + hint: têm dia conhecido, entram pelo ramo
do hint em T7.3, não dependem de D4.

**Aceite medido em produção (2026-09-23, cache-buster em cada chamada):**
`/api/v1/tables/schedule-facets` devolve `to_define: 1`; `/api/v1/tables?weekday=to_define`
devolve `pagination.total` 1 (`where-is-charlie-mtbqaj4j`, com `schedule_day_status` e
`schedule_time_status` = `to_define`, sem hint e sem `schedules`). A união fecha:
`weekday=sábado` 6, `weekday=sábado,to_define` 7. `to_define` combinado com
`manha`/`tarde`/`noite`/`madrugada` devolve 0 — o comportamento do P1 corrigido, porque
a única mesa visível não tem horário. Na interface (Playwright, sem sessão,
`/?weekday=to_define`): botão "A definir (1)" `pressed` no grupo "Dia da semana", chip
"Remover filtro A definir" e "1 mesa encontrada". Console: só os 2 `401` de
`/api/auth/refresh` esperados sem sessão (T7.11).

Cuidado ao remedir: `weekday=sabado` sem acento é valor inválido, descartado em
silêncio pelo contrato, e devolve o catálogo inteiro (31) — parece filtro quebrado e
não é.

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

### [x] T7.10 — Conferido em produção (2026-09-21)

**A rota do enunciado estava errada:** é `/api/v1/tables`, não `/api/tables`
(`apps/mesas/backend/src/routes/tables.ts:346`).

Medido com cache-buster em cada chamada — sem ele mede-se a borda da Cloudflare, não
a origem. O campo que conta é `pagination.total`; o tamanho de `data` é o limite de
página (12) e daria falso positivo:

| query | total |
|---|---|
| sem filtro | 37 |
| `weekday=sexta` | 5 |
| `weekday=domingo` | 3 |
| `weekday=sexta,domingo` | 8 |
| `daypart=noite` | 24 |
| `daypart=manha` | 2 |
| `daypart=noite,manha` | 26 |
| `weekday=sexta&daypart=noite` | 4 |

Os totais fecham com `/api/v1/tables/schedule-facets`, que devolve os mesmos números
por valor, e a soma de união confere (5 + 3 = 8; 24 + 2 = 26). Valor inválido é
descartado em silêncio como o contrato promete: `weekday=funday` devolve 37 e
`weekday=sexta,funday` devolve 5.

`weekday=sexta&weekday=domingo` (chave repetida) devolve 37, ou seja filtro vazio.
**É o comportamento documentado**, não defeito: `parseEnumCsvQuery` exige `string` e
Express entrega array na chave repetida (`tables.ts:110-116`). O formato multivalor é
o CSV, e ele funciona.

A metade de interface fechou junto de T7.4 (desktop 1440×900) e T7.5 (mobile
390×844), com os mesmos 4 resultados que a API devolve.

### [x] T7.11 — Reporte do `401 /api/auth/refresh` — nada a corrigir

Medido: `packages/auth/src/client.ts:31` chama `/api/auth/refresh` com
`credentials: "include"` no boot; visitante anônimo sem cookie recebe `401`, que é a
resposta correta do contrato (`apps/accounts/src/app.ts:479`).

Fecha como "não é defeito", sem alteração de código. Registrado para o próximo
reporte igual não virar investigação nova.

Reconfirmado em 2026-09-21: o `401` aparece no console de `mesas`, `links` e dos
demais consumidores, e some quando há cookie de sessão. Em preview local ele vem
acompanhado de erro de CORS, porque `localhost` não está na allowlist do SSO — também
artefato, não defeito.

### [x] T7.13 — ACHADO NOVO no `links`: CSP matava 5 comportamentos em produção

Encontrado ao conferir o header do `links` para a T4.3, e corrigido no mesmo trabalho
(AGENTS.md §Bug achado). **Não tem relação com o resto da spec 103** — é defeito de
produção que estava no caminho.

**Medido em 2026-09-21** em `links.artificiorpg.com` com cache-buster: **9 erros de
console**, dos quais 7 de CSP. Batendo o SHA-256 de cada `<script>` inline do HTML
servido contra os 7 hashes da `<meta http-equiv="content-security-policy">`, **5 não
constavam** e eram recusados com `The action has been blocked`:

- tema anti-FOUC (`Base.astro`);
- toggle da sidebar mobile (`Sidebar.astro`);
- banner de onboarding (`index.astro`);
- gate de conteúdo +18 (`Base.astro` e `grupo/[slug].astro`);
- botão de voltar ao topo (`Base.astro`).

**Falhavam em silêncio:** build verde, HTML válido, página renderizando. Medido no
browser: o clique em `.sidebar-toggle` não mudava `aria-expanded` nem tirava a barra
de `x: -280`, e `#scroll-top` ficava com `opacity: 0` mesmo a 900 px de rolagem. Mais
2 atributos `style=""` recusados — hash **não** cobre atributo de estilo, só
`unsafe-hashes` cobriria.

**Causa, já registrada no repo e não aplicada aqui:** a CSP do Astro 6 só hasheia o
que ele **bundla**; `<script is:inline>` nunca entra no `script-src`. É o
`BL-SITE-CSP-INLINE` de `specs/backlog.md:202`, resolvido no `site` e nunca no
`links`, cujo `astro.config.mjs` não tinha `scriptDirective`.

**Correção, na forma que o `site` já usa:** os 5 scripts pós-carga perderam o
`is:inline` e passaram a ser bundlados — o Astro os hasheia sozinho, e hash manual
que quebra a cada edição deixa de existir para eles. Só o anti-FOUC continua inline,
porque precisa rodar antes da primeira pintura, e entra por hash em
`scriptDirective.hashes`. Os 4 `style=""` (2 na home, 1 na 404, 1 na página de grupo)
viraram classes em `global.css`.

`.section-title--espacada` precisou de **dois nomes no seletor**: o `<h2>` alvo é o
primeiro do tipo na página, e `.section-title:first-of-type` (0,2,0) vencia uma
classe sozinha. Medido no preview: 8 px em vez dos 56 px pretendidos, antes da
correção.

**Validação:** build do `links` verde (17 páginas); varredura do `dist` inteiro
devolve **0** script inline fora da CSP e **0** atributo `style=`. No preview, o
console cai de 9 erros para 1 (favicon 404) mais o CORS do SSO contra `localhost`, e
as funcionalidades voltam: sidebar abre (`x: -280` → `0`) e fecha, banner visível,
`#scroll-top` com `opacity: 1`, espaçamentos em 56 px e 24 px, 404 e página de grupo
idênticas ao original. `lint` verde; o `links` não tem suíte de teste.

**Gate +18 não estava exposto:** a API devolve **0** grupos com `is_adult` hoje, e o
blur é CSS, então a falha fechava segura — o que não funcionava era o desbloqueio.

**Conferido em produção (2026-09-23, Playwright sem sessão, 390×844,
cache-buster):** `aside#sidebar` vai de `x: -280` a `0` no toggle e volta a `-280`
no `.sidebar-close`; `aria-expanded` vira `true`; `#scroll-top` passa de `opacity:
0` a `1` com 900 px de rolagem. **Resta 1 violação de CSP no console**, e ela não
vem do nosso HTML: `static.cloudflareinsights.com/beacon.min.js`, o beacon do
Cloudflare Web Analytics que a Cloudflare injeta na borda. O `site` o libera
(`apps/site/astro.config.mjs:86-91`); o `links` não, então hoje o RUM do `links`
morre bloqueado. **Mantenedor autorizou ligar (2026-09-23).** A injeção já estava
ativa na Cloudflare (Web Analytics da conta com `auto_install: true`, sem regra por
host, lido pela API), então a correção é só a CSP: `apps/links/astro.config.mjs`
ganhou `https://static.cloudflareinsights.com` no `script-src`. O `connect-src` NÃO
precisa de nada: com instalação automática o beacon envia para `/cdn-cgi/rum` do
próprio domínio, coberto por `'self'` (doc da Cloudflare; medido no `site` em
produção, `https://artificiorpg.com/cdn-cgi/rum`). O `site` tinha
`cloudflareinsights.com` no `connect-src` sem uso e perdeu a entrada no mesmo
trabalho (achado do CodeRabbit na PR #333).

**Fechada em produção (2026-09-24, Playwright sem sessão, cache-buster):** zero
violação de CSP no console; `beacon.min.js` carrega (200) e envia para
`links.artificiorpg.com/cdn-cgi/rum` (204); `#scroll-top` com `opacity: 1` a 400 px;
em 412×823, `aside#sidebar` de `x: -280` a `0` no `.sidebar-toggle`. Sobram no console
o `401` de `/api/auth/refresh`, esperado sem sessão e igual no `mesas` e no `site`, e
o `favicon.ico` 404 — o `links` não tinha `<link rel="icon">` nenhum. Corrigido em
`apps/links/src/layouts/Base.astro` com o `faviconV2` de `@artificio/ui/static`, como
o `site`; build conferido (`/_astro/faviconV2.D-Cr6Urt.png`, coberto por `img-src
'self'`). O mesmo 404 aparece em `mesas`, `downloads` e `accounts` (e no `glossario`
o `favicon.ico` devolve o `index.html` com 200), porque os quatro só injetavam o ícone
por JS (`applyFavicon()`). O SSR do `mesas` (`root.tsx`) e o `index.html` dos três
apps Vite passaram a emiti-lo no HTML; build de cada um sai com
`/assets/faviconV2-D-Cr6Urt.png`.

No mesmo console, o `site` mostrou o GA tentando `stats.g.doubleclick.net` e
`ga-audiences`, barrados pela CSP. `@artificio/analytics` passou a mandar
`allow_google_signals: false` e `allow_ad_personalization_signals: false` em todo
`config` (`GA_PRIVACY_CONFIG`, `packages/analytics/src/config.ts`), por decisão do
mantenedor (2026-09-24).

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

## T8 — MOVIDA para a spec 104

Aberta aqui em 2026-09-20 e promovida a spec própria no mesmo dia, por decisão do
mantenedor: "Pr e espec própria". O conteúdo inteiro — medição, blast radius e o
que falta investigar — vive em `specs/104-cor-identidade-tema-claro-familia-roxa/`.

Nada dela entra na PR #328. O que esta spec deixou de propósito para lá:

- os **14 usos de texto e ícone** de `--special`, os **8 em RGB cru**
  (`rgba(168,85,247,…)`, que não viram de tema) e as **38 classes `purple-NNN`**
  do Tailwind fora do token (104 T2.1/T2.3);
- decidir se `--artificio-bronze` sai do pacote (104 T2.4): depois desta spec o
  token ficou **sem nenhum consumidor**, mas remover token é mudança de contrato
  de `packages/ui` e exige autorização nominal própria;
- a troca de `--artificio-light-ink` para `#222222` (104 T1).

Todo fundo SÓLIDO de bronze e de roxo ficou aqui, em T3.2 — os 3 botões, o badge
"🗄️ Arquivada" e o checkmark de seleção. São a mesma correção dos outros 22, e
deixar parte deles na árvore seria estado inconsistente.

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
