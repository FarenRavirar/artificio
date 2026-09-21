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

### [ ] T2.3 — Medir o ganho em produção

**Aceite:** Lighthouse móvel em `mesas.artificiorpg.com`, mediana de **3** rodadas.
Economia de imagem < 1.000 KiB (era 10.644) e LCP < 2,5 s (era 5,9 s). Uma rodada só
não fecha — o Lighthouse varia.

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

**Medido nos dados: a otimização do `site` é no-op hoje**, e já era antes.
`apps/site/src/data/posts.json` tem 8 posts, 8 com `image`, e o hostname de
**todos** é `artificiorpg.com` — zero Cloudinary. É a T2.5 (capas 404 do
WordPress legado). A versão antiga também não transformava nada, porque exigia
`res.cloudinary.com`. Logo: nenhuma regressão visual na unificação.

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

### [ ] T3.2 — Corrigir na origem certa — código pronto, aceite espera deploy

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

### [ ] T3.3 — Ordem de heading no catálogo — código pronto, aceite espera deploy

`<h3>` sem `<h2>` antes, nos cards.

**Aceite:** Lighthouse sem o achado de ordem de heading.

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
consumidor regredido. **Falta a metade de aceite que exige deploy** — a medição
em produção acima é do CSS ANTES da correção, e `beta.downloads` respondeu `000`
(sem deploy). O guard cobre o contrato; a confirmação na tela pede o deploy.

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

**Não medido:** aparência em browser real e o comportamento em ≤860px. Os guards cobrem
estrutura e HTML servido, não layout computado — é o mesmo vão que T6.2 registra (jsdom
não faz layout).

### [~] T5.1 — BLOQUEADA por D2 (`spec.md` §4) **e agora pela spec 104**

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

### [~] T5.2 — BLOQUEADA por D1 (`spec.md` §4)

Política da subnav. O `mesas` gasta a faixa inteira com 1 item ("Catálogo"); o `site`
usa 4 itens de conteúdo. Sendo o `mesas` o alvo, a faixa de um link vira o padrão, ou
o `mesas` passa a listar as seções do módulo?

Mesma pergunta, mesma data, **sem resposta**.

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
commit `1f6f639`; o resto da spec segue na branch
`feat/103-imagens-contraste-login`, criada de `origin/dev` nesse commit.

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
