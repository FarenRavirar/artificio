# Plano — 088

## Arquitetura da solução

A spec tem duas frentes que quase não se tocam. A **frente de infraestrutura** é a maior e não altera código de aplicação: ela executa, pela primeira vez, um `docker-compose.prod.yml` que já existe e já está correto. A **frente de código** cobre o débito de SEO herdado da spec 087 e três problemas de qualidade do acervo (capa, crédito, sistema/edição).

**A ordem entre elas não é negociável: todo o código vem antes do cutover.** O motivo é que o cutover transforma o conteúdo de beta em conteúdo público. Ir para produção primeiro significaria publicar um acervo em que 80% dos cards são placeholder cinza, 100% dos materiais não têm sistema, e cada material sem crédito afirma autoria falsa do Artifício — e depois corrigir. Como é a primeira impressão do domínio e o momento em que crawler indexa pela primeira vez, corrigir depois é caro de um jeito que corrigir antes não é.

### Como as quatro correções se relacionam

Três delas convergem no mesmo componente, o que é conveniente: `MaterialCard` renderiza a capa, o eyebrow de crédito e o `SystemChainBadge`. As mudanças são independentes entre si (nenhuma depende do resultado da outra), mas compartilham a mesma suíte de testes e o mesmo critério visual de não regredir a silhueta do card.

A quarta — sistema e edição — é a única que vive no **backend** e a única cuja causa raiz precisou de investigação. As outras três são decisões de produto com implementação direta.

### Frente 1 — Cutover de infraestrutura

O ponto central é que **nada de arquitetura precisa ser inventado**. O isolamento de banco pedido ("background pra teste, prod original, estilo mesas") já está escrito e versionado:

```
downloads-beta-db  →  volume downloads-beta_pgdata_downloads_beta  →  POSTGRES_DB: downloads
downloads-db       →  volume pgdata_downloads_prod                →  POSTGRES_DB: downloads
```

É exatamente o modelo do mesas — que roda `mesas-beta-db` sobre `mesas-beta_pgdata_mesas_beta` e `mesas-db` sobre `mesas_pgdata_mesas_prod`, **ambos com o mesmo nome lógico de banco** (`mesas_rpg`). O isolamento vem do par container + volume, não do nome do banco. Dois processos Postgres distintos, dois volumes distintos, zero compartilhamento. O nome igual é irrelevante e até desejável: mantém a `DATABASE_URL` estruturalmente idêntica entre ambientes, variando só host e senha.

A sequência de execução é rígida porque cada passo é pré-requisito do seguinte, e inverter dois deles produz falhas silenciosas:

```
1. Atualizar clone prod  ──►  disco passa a ter as 29 migrations
        │                     (sem isso, o passo 3 aplicaria só 20 e o schema
        │                      sairia incompleto SEM ERRO APARENTE)
        ▼
2. Criar .env prod       ──►  senha do Postgres fixada ANTES da 1ª init
        │                     (sem isso, E009: POSTGRES_PASSWORD nunca é
        │                      reescrito depois que o volume nasce)
        ▼
3. Subir SÓ downloads-db ──►  volume criado, banco vazio, healthy
        │
        ▼
4. pg_dump + aplicar 29  ──►  script oficial, MAX_AUTO_PENDING=29, execução única
        │                     (fatiar em lotes é proibido: o script compara o
        │                      conjunto inteiro de uma vez)
        ▼
5. workflow_dispatch     ──►  deploy encontra ZERO pendências e passa direto
        │
        ▼
6. Smoke real            ──►  502 vira 200, login funciona
```

O passo 4 é a resposta ao guard `MAX_AUTO_PENDING=5`. A escolha do mantenedor foi **aplicação manual controlada**, não afrouxar o guard: a variável é elevada por ambiente numa execução única e pontual, e o script de deploy continua com o limite `5` para todos os módulos. É o procedimento já documentado em `AGENTS.md` §Migrations item 4 exatamente para este caso — primeiro deploy de módulo novo com todas as migrations de uma vez.

### Frente 2 — Canonical route-aware

Restrição do `tasks.md` da spec 087, mantida aqui: **sem dependência nova**. Confirmado que `apps/downloads/frontend` não usa `react-helmet` nem equivalente, então a solução é um hook próprio que manipula `document.head` diretamente.

Duas armadilhas ditam o desenho:

**Canonical estática em `index.html` está proibida.** O Downloads é um SPA com fallback: qualquer rota desconhecida serve o mesmo `index.html`. Uma tag no HTML base apareceria em `/material/:id`, `/painel`, `/gestao` — marcando cada uma como duplicata da home. Seria pior que não ter canonical.

**A tag tem de ser única.** Se o hook adicionar sem antes remover, navegar catálogo → ficha → catálogo empilha tags. Duas canonical divergentes fazem o Google ignorar ambas. O hook remove qualquer `link[rel="canonical"]` pré-existente antes de inserir a sua, e limpa no cleanup do efeito.

O alvo é **fixo**, não derivado da rota atual: `/` e `/catalogo` apontam ambos para a raiz absoluta, e query string nenhuma entra no alvo. É isso que consolida o sinal — `?sort=popular` e `?q=dragao` não são páginas distintas, são recortes da mesma listagem.

### Frente 3 — Parser: uma causa, três lacunas

A investigação (2026-07-26) começou por "o matcher de sistema não casa" e terminou num achado maior: **autoria, sistema e tipo de material estão zerados pela mesma razão arquitetural**.

Existem dois caminhos de ingestão, com capacidades muito diferentes:

| Caminho | Extração | Usado por |
|---|---|---|
| `genericHtmlParser` + `platformOverrides` | **rica** — autor, artista, sistema, categoria, filtros, formato, páginas | importação **manual por URL** (`routes/scraper.ts`) |
| Adapters de descoberta (`ScraperAdapter`) | **mínima** — título, URL, preço, capa, editora, idioma | scraping **automático** em massa |

Os `platformOverrides` são o **único** lugar do código que lê `details.get('authors')`, `details.get('artists')` e `details.get('ruleSystem')` — e são invocados apenas por `genericHtmlParser`. O pipeline automático nunca passa por eles.

E o acervo inteiro veio do caminho automático:

```
  source_platform  | count        credits          → 0 de 103
-------------------+-------       system_id        → 0 de 103
 opera_rpg         |    77        material_type    → 103 "Aventura"
 itch_io           |    15        publisher_name   → 87 de 103  ← exceção
 grimorios_e_dados |     7
 dms_guild         |     4        onebookshelf     → 0 materiais
```

Zero materiais de OneBookShelf, a única plataforma com override rico. **Não é que a extração falhe — ela não é chamada nesse caminho.** `publisher_name` é a exceção com 87 justamente por ser um dos poucos campos que os adapters de descoberta já emitem sozinhos.

Isso reorganiza a correção: em vez de três consertos independentes, é **um** conserto — fechar a assimetria entre os dois caminhos — com três campos como beneficiários. Onde a plataforma já tem override, a lógica é reaproveitada, não reescrita em paralelo: duas implementações do mesmo parsing divergem no primeiro ajuste.

**Editora não é autoria.** `publisher_name` é quem publicou; `credits` é quem escreveu ou ilustrou. Um não substitui o outro nem serve de fallback: exibir a editora sob rótulo de autoria repetiria o erro do "Acervo Artifício" com outro nome. No card, a ordem é publicante primeiro, autor depois, cada um com rótulo que identifica o que é.

### Frente 3a — Sistema e edição

Dentro dessa causa comum, o hint de sistema tem um detalhe diagnóstico próprio que vale registrar.

O sintoma aparente é "matcher não casa sistema". O dado real contradiz isso:

```
total | com_sistema | com_edicao | hint_bruto
  103 |           0 |          0 |          0
```

`raw_system_hint` existe precisamente para o caso "o matcher não casou, mas eu tenho o texto" — `resolveSystemHint` o preenche em toda falha de casamento, e `openSystemSuggestion` abre triagem admin a partir dele. Se o matcher estivesse falhando 103 vezes, `hint_bruto` seria 103. Sendo **zero**, a conclusão é que `systemHint` chega `null` ao ingest em todos os casos, e o matcher nunca é exercitado.

Confirmação em código — busca por `systemHint` em cada scraper:

| Scraper | Emite `systemHint`? |
|---|---|
| `platformOverrides/onebookshelf.ts` | **sim** — `nullableText(details.get('ruleSystem'))` |
| `driveThruRpgScraper.ts` | **não** |
| `dmsGuildScraper.ts` | **não** |
| `itchIoScraper.ts` | **não** |
| `grimoriosEDadosScraper.ts` | **não** |
| `operaRpgScraper.ts` | **não** |

Cinco de seis caminhos de scraping nunca populam o campo. `ScrapedItem.systemHint` é opcional (`z.string().nullable().optional()`), então a ausência atravessa o pipeline inteiro sem erro, sem log e sem alarme — o material é criado com sistema nulo e nada indica que faltou algo.

**A correção é na extração, não no matcher.** Cada um dos cinco scrapers passa a ler o sistema da própria fonte, guiado por fixture real da plataforma. Onde a fonte não expõe sistema de forma confiável, o scraper emite `null` **explícito** — nunca deriva hint de título ou descrição, porque hint inventado alimenta o matcher com ruído e produz vínculo errado, que é pior que vínculo ausente (afirma ao usuário um sistema que o material não é, e contamina filtro e badge).

O matcher permanece intocado: igualdade exata normalizada, fuzzy reservado à triagem admin com humano decidindo. Esta spec conserta a alimentação; o casamento continua conservador por decisão da spec 086.

**Efeito colateral desejado:** com hint chegando, o caminho de não-casamento passa a ser exercitado pela primeira vez — `raw_system_hint` preenchido e fila de triagem recebendo entradas. Código que existe, está testado e nunca rodou em produção de fato.

### Frente 3b — Tipo de material

Mesma família de falha do hint de sistema, um grau pior. Consulta em beta:

```
 material_type | count
---------------+-------
 Aventura      |   103
```

`scraperIngest.ts:22` declara `DEFAULT_MATERIAL_TYPE_SLUG = 'aventura'`. A linha 309 resolve esse slug **uma vez por execução**, fora do laço de itens, e passa o mesmo objeto para todo `processItem`. Nenhum item é avaliado — não existe caminho de código que classifique material.

A investigação do histórico mostra que **nunca funcionou**, e a evidência é estrutural, não anedótica: a interface `ScrapedItem`, contrato de saída de todo adapter, **não tem campo de tipo**. Tem `systemHint`, `scenario`, `sourceCategory`, `tags`, `sourceFilters`, `format`, `pageCount` — nada de tipo de material. A constante entrou junto com o pipeline (`ef9efd6`) e ficou.

O agravante é que a peça que falta **já foi construída**. A spec 086, requisito 25, tirou `material_type` de texto livre e o transformou em taxonomia central com ID, slug, aliases e status — precisamente para acabar com "aventura"/"Aventura"/"aventuras" como valores distintos. E `getCatalogMaterialTypeBySlug` já resolve por slug **ou alias**, com normalização `pt-BR`. A infraestrutura de classificação está pronta, testada e nunca foi ligada ao scraper.

Consequências que só se manifestam em produção: o filtro por tipo da spec 086 (requisito 23, endpoint de facetas) oferece uma única opção contendo todo o acervo — inútil; e o rótulo é uma afirmação falsa sobre 103 materiais.

**A correção espelha a do hint de sistema**, o que é conveniente: mesma fase, mesmo padrão, mesma disciplina.

```
ScrapedItem ganha hint de tipo  ──►  scrapers emitem (fixture real; null explícito)
                                          │
                                          ▼
              ingest resolve POR ITEM ──►  getCatalogMaterialTypeBySlug (slug OU alias)
                                          │
                        ┌─────────────────┴─────────────────┐
                        ▼                                   ▼
                    casou                            não casou / ausente
              material_type real              default NEUTRO + valor bruto p/ triagem
                                              (nunca mais "Aventura" por omissão)
```

Duas travas herdadas do desenho de sistema: **nunca** derivar tipo de título ou descrição (classificação errada contamina filtro e badge, pior que ausente), e o scraper **nunca** escreve na taxonomia central — hint sem correspondente vai para triagem, como já acontece com sistema.

A mudança do default de `'aventura'` para um tipo neutro é o que impede que a ausência de classificação continue se disfarçando de classificação.

### Frente 5 — Acesso ao material em nova aba

O botão hoje **não é um link**:

```tsx
<button type="button" onClick={handleAccess}>Acessar material</button>
// handleAccess: trackEvent(...) → registerDownload.mutate(...) → navigate(`/ir/${destination_id}`)
```

A rota `/ir/:destinationId` (`RedirectDestinationPage`) resolve o destino por API e só então faz `window.location.replace`. Esse desenho é deliberado — spec 073, T4.1: **fail-closed**, nunca redireciona às cegas; e `destination_id` é opaco por decisão registrada (DEB-073-02), sobrevivendo a troca futura de slug.

Isso cria uma armadilha para "abrir em nova aba": `window.open` chamado **depois** do `await` da API perde o gesto do usuário e é bloqueado por popup blocker. A saída escolhida evita o problema em vez de contorná-lo — trocar o `<button>` por uma **âncora nativa** para a mesma rota interna:

```tsx
<a href={`/ir/${material.destination_id}`} target="_blank" rel="noopener noreferrer" onClick={handleAccess}>
```

Navegação nativa nunca é bloqueada. E como o `href` aponta para a rota interna, tudo que a torna segura permanece: o destino continua sendo resolvido lá dentro, o fail-closed continua valendo, o `destination_id` continua opaco e a URL externa real não aparece no HTML da ficha.

`rel="noopener noreferrer"` não é adorno: sem `noopener`, a página de destino recebe `window.opener` e pode manipular a aba de origem; sem `noreferrer`, o `Referer` entrega a URL de origem ao terceiro. Ganho colateral: `Ctrl+clique`, botão do meio e "abrir em nova aba" passam a funcionar, e o destino aparece na barra de status — coisas que um `<button>` nunca ofereceu.

`handleAccess` continua no `onClick`, agora sem o `navigate` final. O evento de funil e o registro de download disparam antes da navegação, como hoje — trocar o elemento não pode custar a instrumentação.

### Frente 6 — Avaliação por estrelas clicáveis

`RatingSection` usa hoje um `<select>` com `<option>` de 1 a 5 e `useState(5)` fixo. Dois defeitos além da aparência: o controle sempre inicia em 5 **independentemente do que o usuário já avaliou**, e um menu suspenso para escolher entre cinco valores ordinais é mais interação do que o necessário.

A substituição por estrelas clicáveis tem uma sutileza que precisa ser explicitada, porque a base de código contém uma trava aparentemente contrária. `MaterialRating.tsx` documenta:

> os glifos são `<span>`, NUNCA `<button>` — o card inteiro é um alvo de clique único (`before:absolute before:inset-0`), então qualquer elemento focável aqui roubaria o clique

Isso vale para as estrelas **somente-leitura** dentro do card, e permanece intacto. `RatingSection` é outro componente, na ficha do material, fora de qualquer alvo de clique envolvente — ali estrelas focáveis são corretas. **Só o controle de entrada vira interativo; `MaterialRating` não muda.**

O controle novo precisa ser pelo menos tão acessível quanto o `<select>` que substitui — trocar um controle nativo por glifos é onde acessibilidade costuma se perder. Isso significa: focável por `Tab`, acionável por `Enter`/`Espaço`, foco visível, nome acessível por estrela comunicando o valor, estado selecionado exposto a tecnologia assistiva (não só por cor), e alvo de toque de 44px. O estado inicial passa a refletir a nota já enviada, não um `5` arbitrário.

O guard de `403` (conta sem download registrado) permanece igual: a mudança é de controle de entrada, não de regra de negócio.

### Frente 4 — Capa e crédito no card

**Capa.** O placeholder atual é `<div>` cinza com o texto "Sem capa" — literal, funcional e feio, aparecendo em 80% dos cards. Substituição por placeholder desenhado, com três restrições que vêm do próprio problema:

*CSS/SVG inline, sem rede.* Um placeholder que depende de arquivo de imagem pode falhar ao carregar — e o placeholder é justamente o que trata a falha da capa real. Fallback que precisa de fallback não serve.

*Variação por `material_type`.* Uma prateleira de materiais sem capa não pode ser uma fileira de retângulos idênticos. O tipo já vem no payload da listagem (`material.material_type`, hoje renderizado como pílula), então a variação não custa consulta nova.

*Tokens semânticos, nunca cor crua.* Mesma disciplina que a spec 087 aplicou ao `SystemChainBadge`: o placeholder tem de virar com o tema claro/escuro sozinho.

**Proporção da capa — o defeito mais visível.** Hoje o card usa `h-32 w-full object-cover`: altura fixa de 128px, largura total, e `object-cover` **recortando** o que não couber. Capa de RPG é caracteristicamente vertical (perto de 3:4, 2:3, A4), então o recorte come topo e base — justo onde ficam título e arte de identificação. Na ficha, `MaterialPage.tsx:126` usa `w-full ... object-cover` sem trava de altura, deixando a proporção livre. Há até uma incoerência interna: o *placeholder* da ficha já usa `aspect-[3/4]`, mas a *imagem real* ao lado dele não tem trava alguma.

O desenho pedido inverte a lógica: em vez de forçar a imagem numa caixa fixa, a caixa se adapta à imagem **dentro de limites**.

```
                    ┌─ teto vertical ──────────┐
                    │                          │  capa mais alta que o teto:
   piso ≤ altura ≤ teto   altura acompanha a    │  reduz proporcionalmente,
                    │    proporção real         │  NUNCA corta
                    └─ piso vertical ──────────┘
   largura: derivada da altura, centralizada
            → as laterais absorvem a diferença entre proporções
            → nunca ultrapassa a largura do card
```

`object-contain` no lugar de `object-cover` é o núcleo da mudança: contém em vez de cobrir, então nada é cortado. Piso e teto verticais impedem que a altura variável destrua o alinhamento da prateleira — é o que reconcilia "respeitar a proporção" com "cards alinhados". Capa mais baixa que o piso não é esticada; o espaço restante fica no contêiner, não na imagem. Capa horizontal ou quadrada cai na mesma regra, sem caso especial.

**A regra vive num único lugar.** Inventário verificado (2026-07-26) dos pontos que renderizam `<img>` de capa: `MaterialCard.tsx:52` e `MaterialPage.tsx:126` — só dois. As telas de gestão (`GestaoMidiasPage`, `GestaoImportarPage`) manipulam a URL como texto, sem preview visual. Ainda assim, a regra fica num componente/utilitário compartilhado em vez de duplicada nos dois: duas cópias divergem no primeiro ajuste, e qualquer ponto futuro que exiba capa deve herdá-la por padrão — exibir fora do padrão precisa exigir sair do caminho.

A silhueta compatível entre card com e sem capa é propriedade **existente** (a capa sangra até as bordas, sem padding em volta) e não pode regredir. O placeholder desenhado ocupa altura dentro da mesma faixa piso–teto, o que mantém a prateleira alinhada quando 4 em 5 cards são placeholder.

**Crédito.** `MaterialCard.tsx:41` faz hoje:

```
const creditLabel = material.credits?.trim() || 'Acervo Artifício';
```

O eyebrow é o elemento mais destacado do card — Oswald caixa-alta, acima do título, posição escolhida na spec 087 precisamente porque o propósito do produto é dar crédito ao autor. Preencher esse lugar com "Acervo Artifício" quando não há crédito faz o card mais proeminente afirmar autoria que o Artifício não tem, em material importado de terceiro.

Decisão do mantenedor: **o eyebrow some** quando não há crédito. Nada o substitui. O `.trim()` permanece — `credits` vem de scraper e de formulário, então `""` e `"   "` chegam até aqui e passariam por um null-check ingênuo (achado de review da PR #214). A troca é de `|| 'Acervo Artifício'` para renderização condicional.

O custo aceito é altura variável entre cards com e sem crédito. Era exatamente o que o fallback evitava — o mantenedor escolheu honestidade sobre uniformidade. O plano trata isso garantindo que a ausência não colapse o layout nem faça o título encostar na capa.

## Arquivos afetados (por módulo/pacote)

### `apps/downloads/frontend` — código novo

| Arquivo | Ação | O que faz |
|---|---|---|
| `src/hooks/useCanonicalUrl.ts` | **criar** | Hook que insere/atualiza/remove a `<link rel="canonical">` única em `document.head`. Recebe o caminho canônico; monta a URL absoluta a partir de `VITE_PUBLIC_SITE_URL`. |
| `src/hooks/useCanonicalUrl.test.ts` | **criar** | Cobre criação, unicidade sob rerender, alvo correto, e remoção no cleanup. JSDOM. |
| `src/pages/CatalogoPage.tsx` | **editar** | Uma chamada do hook. `CatalogoPage` já é o componente servido por `/` e `/catalogo` (spec 087), então uma chamada cobre as duas rotas. |
| `src/pages/CatalogoPage.test.tsx` | **editar** | Asserção de que a tag existe com o alvo certo, e teste de rota alheia que prova a ausência. |
| `src/components/MaterialCover.tsx` | **criar** | **Regra única de exibição de capa**, consumida por todo ponto que mostra capa. Encapsula: piso/teto vertical, `object-contain` (nunca `cover`), largura derivada e centralizada, e o fallback para o placeholder no `onError`. |
| `src/components/MaterialCover.test.tsx` | **criar** | Prova que capa vertical não é cortada, que altura fica entre piso e teto, que capa horizontal/quadrada respeita a largura, e que `onError` cai no placeholder. |
| `src/components/CoverPlaceholder.tsx` | **criar** | Placeholder desenhado, CSS/SVG inline, variando por `material_type`, em tokens semânticos. `aria-hidden` — decorativo, não compete com o título na leitura de tela. Altura dentro da mesma faixa piso–teto. |
| `src/components/CoverPlaceholder.test.tsx` | **criar** | Variação por tipo, ausência de requisição de rede, ausência de nome acessível. |
| `src/components/MaterialCard.tsx` | **editar** | Duas mudanças: passa a usar `MaterialCover` (elimina o `h-32 w-full object-cover` que recorta e o `<div>` "Sem capa"); eyebrow passa a exibir **publicante (editora) e autor** como campos distintos e rotulados — nesta ordem — removendo o fallback `'Acervo Artifício'` e sumindo quando não há nenhum dos dois. |
| `src/components/MaterialCard.test.tsx` | **editar** | Substituir o teste que hoje **exige** `'Acervo Artifício'` (`MaterialCard.test.tsx:81-83`) por um que prova a **ausência** do eyebrow. Somar: placeholder aparece sem capa, `onError` da capa real cai no placeholder, card sem crédito não colapsa layout. |

### `apps/downloads/backend` — extração de sistema

| Arquivo | Ação | O que faz |
|---|---|---|
| `src/services/scrapers/driveThruRpgScraper.ts` | **editar** | Extrair `systemHint` da fonte; `null` explícito quando não exposto. |
| `src/services/scrapers/dmsGuildScraper.ts` | **editar** | Idem. |
| `src/services/scrapers/itchIoScraper.ts` | **editar** | Idem. |
| `src/services/scrapers/grimoriosEDadosScraper.ts` | **editar** | Idem. |
| `src/services/scrapers/operaRpgScraper.ts` | **editar** | Idem. |
| Testes dos cinco scrapers | **editar/criar** | Cada um prova extração de **sistema, autoria e tipo** a partir de **fixture real** da plataforma, e `null` explícito quando a fonte não expõe o campo. |
| `src/services/scrapers/types.ts` | **editar** | `ScrapedItem` ganha o campo de hint de **tipo de material** (opcional, `null` explícito), no mesmo desenho de `systemHint`. |
| `src/services/scraperIngest.ts` | **editar** | Resolver tipo **por item** dentro do laço, via `getCatalogMaterialTypeBySlug`; trocar o default `'aventura'` por tipo neutro; preservar valor bruto não resolvido para triagem. |
| `src/services/scraperIngest.test.ts` | **editar** | Prova resolução por item, casamento por alias, e que hint ausente cai no default neutro — nunca em "Aventura". |

`resolveSystemHint` e `matchSystemNameExact` **não mudam**. Estão corretos e passam a ser exercitados pela primeira vez. `scraperIngest.ts` muda **apenas** na resolução de tipo de material; o trecho de sistema fica intocado.

### `apps/downloads/frontend` — acesso e avaliação

| Arquivo | Ação | O que faz |
|---|---|---|
| `src/pages/MaterialPage.tsx` | **editar** | Duas mudanças: (a) trocar o `<button onClick={handleAccess}>` por `<a href={`/ir/${destination_id}`} target="_blank" rel="noopener noreferrer" onClick={handleAccess}>` — `handleAccess` perde o `navigate` final e mantém `trackEvent` e `registerDownload`; (b) passar a usar `MaterialCover` na capa (`:126` hoje é `w-full object-cover` sem trava de altura), eliminando também a incoerência de o placeholder ao lado já usar `aspect-[3/4]`. |
| `src/pages/MaterialPage.test.tsx` | **editar** | Prova que o elemento é âncora com `target="_blank"` e `rel="noopener noreferrer"`, que o `href` aponta para `/ir/:destinationId`, e que o evento de funil dispara no clique. |
| `src/components/RatingSection.tsx` | **editar** | Substituir o `<select>` por cinco estrelas clicáveis: focáveis, operáveis por teclado, nome acessível por estrela, estado exposto a tecnologia assistiva, alvo de 44px. Estado inicial passa a refletir a nota já enviada. |
| `src/components/RatingSection.test.tsx` | **criar/editar** | Cobre: seleção por teclado, nome acessível por estrela, estado selecionado exposto, nota já enviada refletida ao carregar, guard de `403` preservado. |

`MaterialRating.tsx` **não muda** — as estrelas somente-leitura do card seguem `<span>`, e a trava contra elementos focáveis dentro do alvo de clique único permanece.

### Infraestrutura — sem alteração de arquivo versionado

`docker-compose.prod.yml` e `deploy-manifest.json` **não mudam**. Já estão corretos. O trabalho é de execução na VM:

| Alvo | Ação | Natureza |
|---|---|---|
| `/opt/artificio` (clone prod) | `git fetch` + `reset` para `origin/main` | escrita na VM — **exige aprovação nominal** |
| `/opt/artificio/apps/downloads/.env` | criar, `chmod 600` | escrita na VM — **exige aprovação nominal** |
| `downloads-db` (container) | subir isolado | escrita na VM — **exige aprovação nominal** |
| Banco de produção | `pg_dump` + `apply_required_migrations.sh` | escrita no banco — **exige aprovação nominal** |
| `deploy.yml` | `workflow_dispatch --ref main -f env=prod` | deploy — **exige aprovação nominal** |

Cada linha dessa tabela é uma aprovação **separada**. Autorizar o `.env` não autoriza o deploy.

### Documentação

`specs/backlog.md`, `.specify/memory/project-state.md`, `sessoes/26-07-26_1_downloads_088-producao-cutover.md`, e o `tasks.md` da spec 087 (fechar T4.4 e T6.4, que esta spec resolve).

## Contratos/interfaces tocados

**Auth / accounts:** consumido, **não alterado**. Zero mudança em `packages/auth`. Downloads em produção vira mais um cliente do cookie `.artificiorpg.com` emitido por `accounts.artificiorpg.com` — que já roda PROD-only e não tem instância beta. O smoke de login valida o lado do Downloads; nada no SSO muda, então a matriz de smoke obrigatória de `packages/auth` não é acionada.

**Subdomínio / DNS / tunnel:** **nenhuma mudança**. `downloads.artificiorpg.com` já resolve para o Cloudflare e o tunnel já tem ingress para o hostname — é precisamente por isso que a resposta é 502 (roteia, não encontra origem) e não erro de DNS. Nenhum registro é criado ou alterado, o que mantém esta spec fora da trava de aprovação de DNS de produção. Se o 502 persistir com containers saudáveis, aí sim existe problema de roteamento — e mexer no tunnel exigiria aprovação nominal própria, fora do escopo atual.

**Schema de banco:** as 29 migrations são aplicadas a um banco **novo e vazio**. Nenhuma altera schema de outro módulo; todas vivem em `apps/downloads/database/` e o runner é escopado por `MIGRATIONS_DIR`. A `migration_029` é `online-safe` e idempotente. Nenhuma migration nova é escrita nesta spec.

**API:** nenhuma rota criada, removida ou alterada. `pnpm verify:api` roda por obrigação de path (`apps/**`), não porque o contrato muda.

**`CATALOG_API_URL`:** `downloads-api` de produção passa a chamar `http://site-prod-app:4322` pela rede Docker interna, com `CATALOG_INTERNAL_TOKEN`. É consumo de contrato existente e estável — o mesas já faz idêntico em produção. Token errado degrada resolução de sistemas sem derrubar o app, o que torna essa uma falha silenciosa a checar no smoke.

## Impacto em consumidores

**`packages/ui`** foi alterado pela spec 087 (busca no Header) e é consumido por mesas, glossário, site e downloads. Dois pontos:

O contrato é **aditivo** — `hasEmbeddedSearch` só liga com `showSearch && onSearchChange`, e nenhum consumidor atual passa `onSearchChange`. Consumidores não migrados renderizam exatamente como antes.

`deploy_paths` do Downloads é `["apps/downloads"]`, **sem** `packages/ui`. O Downloads recebe o Header novo porque o build é do monorepo inteiro; os outros módulos só recebem no próprio deploy. Isso é benigno dado o contrato aditivo, mas significa que após este cutover os módulos ficam temporariamente em versões diferentes do Header — registrado para não virar surpresa em investigação futura.

**Consumidores do canonical:** nenhum. O hook é local ao frontend do Downloads e não é exportado.

## Rollback

**Por fase, do mais barato ao mais caro:**

| Situação | Rollback |
|---|---|
| Canonical, capa ou crédito quebram teste ou build | Reverter os arquivos do frontend. Nada foi para a VM ainda. |
| Correção de scraper produz vínculo errado | Reverter o scraper específico. Materiais já criados com vínculo errado são corrigíveis pela triagem admin, e em beta são descartáveis (produção nasce vazia). |
| Reprocessamento duplica material | Dedupe é por `(source_platform, source_url)`. Duplicata indica que a URL de origem mudou — reverter a alteração do scraper e apagar os duplicados em beta, que não tem dado de valor. |
| Migrations falham no meio | `pg_restore` do `pg_dump` do passo 4. Banco novo e vazio, então o pior caso é destruir o volume e recomeçar — sem perda, porque não há dado de produção ainda. |
| `.env` incorreto, container em crash loop | Corrigir o `.env` e `docker compose up -d`. **Exceção crítica:** se o erro for `POSTGRES_PASSWORD`, corrigir o arquivo **não basta** (E009) — a senha só grava na primeira init do volume. Com o banco ainda vazio, destruir e recriar o volume é o caminho limpo; com dado dentro, seria `ALTER USER`. |
| Deploy falha | O `_deploy-module.yml` já tem rollback automático. Produção volta a não ter containers — o 502 retorna, que é o estado atual. Regressão zero. |
| Cutover completo precisa ser desfeito | `docker compose -p downloads down` derruba os três containers. Beta permanece intocado o tempo todo. |

**O que torna todo o rollback barato:** produção nasce vazia. Não há dado de usuário em risco em nenhum passo. O pior cenário realista é voltar ao 502 de hoje.

**O que não tem rollback:** o `promote` de `main`. Fast-forward de `dev` para `main` é apenas movimento de ponteiro e não dispara deploy — reverter exigiria `push --force` em `main`, que é proibido. Mitigação: promover só com o código já validado verde em beta, que é o caso.

## Validação (como provo que funciona)

**Regra que governa toda esta seção:** evidência é comando executado com saída registrada. "Deve funcionar", "está configurado" e "provavelmente sobe" não fecham nenhuma task.

### Canonical — antes de sair da máquina local

```bash
rtk vitest apps/downloads/frontend   # inclui os testes novos de canonical
rtk lint
rtk pnpm run build
rtk pnpm verify:api
```

O teste em JSDOM prova o ciclo: tag criada, **uma só** após rerender, alvo absoluto correto, ausente em rota alheia, removida no cleanup. `curl` e `view-source` **não** validam isso — não executam React e não veriam a tag. Esse ponto vem explícito do `tasks.md` da 087 e permanece.

### Capa e crédito — teste que falharia antes

O teste de crédito é uma **inversão**, não uma adição: `MaterialCard.test.tsx:81-83` hoje afirma `expect(screen.getByText('Acervo Artifício')).toBeInTheDocument()`. O teste novo prova a ausência do eyebrow. Se alguém reintroduzisse o fallback, o teste novo quebraria — que é a propriedade desejada.

Para a capa: o teste prova que material sem `cover_image_url` renderiza o placeholder desenhado (não o texto "Sem capa"), que o placeholder varia por tipo, e que `onError` na capa real cai no placeholder em vez de deixar imagem quebrada.

### Sistema — evidência no banco de beta, não em unitário

Unitário por scraper prova extração a partir de fixture real. Mas o critério de aceite é o **reprocessamento**:

```bash
# antes (baseline 2026-07-26)
select count(*) total, count(system_id) com_sistema, count(raw_system_hint) hint_bruto
  from download_material;                                    -- 103 | 0 | 0
select count(credits) com_credito, count(publisher_name) com_publicante
  from download_material_metadata;                           --   0 | 87
select material_type, count(*) from download_material group by 1;  -- Aventura | 103

# depois do reprocessamento — esperado:
#   com_sistema    > 0        (hint de sistema casou contra o catálogo)
#   hint_bruto     > 0        (não casou, texto preservado e triagem aberta)
#   com_credito    > 0        (autoria passou a ser extraída)
#   material_type  > 1 linha  (classificação real, nenhuma linha com 100%)
#   total          = estável  (crescimento inesperado = dedupe furado, não sucesso)
```

Os números importam **juntos**, não isoladamente. `com_sistema > 0` prova que o casamento funciona; `hint_bruto > 0` prova que o caminho de não-casamento também passou a ser exercitado — código que existe, está testado e nunca rodou de fato; `com_credito > 0` prova que a extração rica passou a ser chamada no pipeline automático; `material_type` com mais de uma linha prova classificação real; `total` estável prova que o reprocessamento não duplicou material.

`com_publicante` serve de **controle**: já era 87 antes e deve continuar em pelo menos isso. Cair indicaria regressão na extração que já funcionava.

### Migrations — evidência no banco, não no log do script

```bash
# na VM, após a aplicação
docker exec downloads-db psql -U admin -d downloads -c 'select count(*) from schema_migrations;'
# esperado: 29 — idêntico ao beta
```

Contagem igual à do beta é o critério. Contar arquivos em disco não prova aplicação; ler `schema_migrations` prova.

### Containers

```bash
docker ps --format '{{.Names}}\t{{.Status}}' | grep '^downloads-'
# esperado: downloads-app, downloads-api, downloads-db — todos "Up ... (healthy)"
docker volume ls | grep downloads
# esperado: pgdata_downloads_prod E downloads-beta_pgdata_downloads_beta (beta intacto)
```

### Rotas públicas — HTTP real contra o hostname

```bash
curl -s -o /dev/null -w "%{http_code}" https://downloads.artificiorpg.com/api/v1/health          # 200
curl -s -o /dev/null -w "%{http_code}" https://downloads.artificiorpg.com/                        # 200
curl -s -o /dev/null -w "%{http_code}" https://downloads.artificiorpg.com/api/v1/materials/mine   # 401
```

São exatamente as três `critical_routes` já declaradas no manifesto. O `401` importa tanto quanto os `200`: prova que a rota privada está protegida e não vazando sem cookie.

**Baseline registrada hoje, antes de qualquer mudança:** as duas primeiras retornam **502**. A transição 502 → 200 é a prova material do cutover.

### Deploy

```bash
gh run list --workflow=deploy.yml --branch=main --limit=5
```

`conclusion: success` no run de produção. Regra pétrea relevante: `promote-prod-fast-forward.yml` **nunca** dispara deploy de produção — mover `main` não coloca nada no ar. Declarar "em produção" sem o `workflow_dispatch` disparado e confirmado é violação explícita de `AGENTS.md`.

### Login

Fluxo real: acessar produção deslogado, autenticar via `accounts.`, confirmar que a sessão é reconhecida e que `/api/v1/materials/mine` passa de 401 para 200 com o cookie. Único ponto do plano que precisa de browser; sem browser disponível, vira débito registrado e nomeado, nunca conclusão presumida.
