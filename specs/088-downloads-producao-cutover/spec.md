# 088 — Downloads em produção: 1º cutover de `downloads.artificiorpg.com`

- **Módulo/Pacote:** `apps/downloads` + infra (VM, tunnel, banco de produção)
- **Gate relacionado:** **D** — "próximo projeto" só libera depois que o projeto atual passa smoke. Downloads é hoje o projeto que ocupa o Gate D e não passou pelo corte de produção.

---

## Problema

`downloads.artificiorpg.com` **não está no ar**. O DNS resolve, o Cloudflare responde, o tunnel já tem ingress configurado para o hostname — e a resposta é **HTTP 502**, porque não existe container algum atrás dele. Levantamento read-only na VM (2026-07-26):

| Item | Estado real |
|---|---|
| `downloads-app` / `downloads-api` / `downloads-db` (prod) | **não existem** — `docker ps -a` só lista `downloads-beta-*` |
| Volume `downloads_pgdata_downloads_prod` | **não existe** |
| `/opt/artificio/apps/downloads/.env` | **não existe** (mesas, site e glossário têm o seu) |
| `https://downloads.artificiorpg.com/` | **502** |
| `https://downloadsbeta.artificiorpg.com/api/v1/health` | 200 (beta saudável, 29 migrations aplicadas) |
| Clone prod `/opt/artificio` | `main` em `90ec6ee`, **8 commits atrás de `dev`** |
| `apps/downloads/database/` no clone prod | **20 arquivos** — disco desatualizado; `dev` tem 29 |

O efeito para o usuário é direto: o projeto Downloads existe, está pronto e validado em beta, mas **é inalcançável publicamente**. Todo material submetido, aprovado e catalogado só existe num ambiente de teste. O 502 é pior que um 404 — sinaliza serviço quebrado a crawler e a visitante, num hostname que já está publicado na navegação compartilhada dos outros projetos.

Há ainda um débito de indexação herdado da spec 087 que só importa de fato em produção: `/` e `/catalogo` servem exatamente o mesmo conteúdo, sem nenhuma tag `canonical`. Em beta isso é inócuo (ambiente não indexado); em produção, é diluição de sinal de SEO desde o primeiro dia de vida do domínio — e SEO é inegociável neste projeto.

### Qualidade do acervo que vai virar público

Ir para produção transforma o conteúdo de beta em conteúdo público. Cinco problemas de qualidade, hoje toleráveis num ambiente de teste, deixam de ser toleráveis no momento em que viram a primeira impressão do projeto. Levantamento no banco de beta (2026-07-26, 103 materiais):

```
                     total | com_sistema | com_edicao | hint_bruto
download_material      103 |           0 |          0 |          0
                      meta | com_capa
download_material_metadata   103 |       21
```

**Sistema e edição não estão sendo alimentados — em nenhum material.** `system_id` e `edition_id` são nulos nos 103. O número decisivo é o terceiro: `raw_system_hint` também é **zero**. Esse campo existe justamente para guardar o texto bruto quando o matcher não casa contra o catálogo — "não achei o sistema, mas tenho o texto". Estar zerado prova que o problema **não** é o matcher falhando: é `systemHint` nunca chegando ao ingest. A falha é anterior à resolução, nos scrapers.

**Todo material é rotulado "Aventura" — os 103.** Consulta em beta:

```
 material_type | count
---------------+-------
 Aventura      |   103
```

A causa não é o parser classificando errado: **não existe classificação alguma**. `scraperIngest.ts:22` declara `const DEFAULT_MATERIAL_TYPE_SLUG = 'aventura'`, resolvido **uma vez por execução** (linha 309, fora do laço de itens) e aplicado igualmente a todos. Nenhum item é avaliado.

Investigação do histórico confirma que **nunca funcionou** — não é regressão. A interface `ScrapedItem` (`scrapers/types.ts`), que define o contrato de saída de todo adapter, **não tem campo de tipo de material**. Existe `systemHint`, `scenario`, `sourceCategory`, `tags`, `sourceFilters` — nada de tipo. A constante entrou junto com o pipeline (`ef9efd6`) e permaneceu.

Agrava o quadro que a spec 086 **construiu a taxonomia central de tipo** exatamente para resolver isso: o requisito 25 daquela spec tirou `material_type` de texto livre e o tornou taxonomia com ID, slug, aliases e status; `getCatalogMaterialTypeBySlug` já resolve por slug **ou alias**. A infraestrutura de classificação existe, está pronta — e o scraper nunca foi ligado nela.

O efeito prático é que o filtro por tipo, construído na spec 086 (requisito 23, endpoint de facetas), é inútil para todo o acervo importado: oferece uma única opção que contém tudo. E o rótulo é uma **afirmação falsa** sobre 103 materiais, dos quais uma parte certamente não é aventura.

`source_category` também está vazio nos 103 — mesmo padrão de `systemHint`: campo existe no contrato, nenhum scraper o popula.

**Capa existe em 21 de 103 materiais (20%).** Os outros 80% caem no placeholder "Sem capa", um retângulo cinza com texto. Numa página cujo modo padrão é vitrine — prateleiras horizontais de cards, desenhadas na spec 087 para dar sensação de acervo — quatro em cada cinco cards são placeholder. O componente foi construído para isso (a capa sangra até as bordas para que card com e sem capa tenham a mesma silhueta), mas mitigar a ausência não é o mesmo que ter um padrão definido para o que aparece quando não há capa.

**Autoria e editora não são identificadas pelo parser.** Consulta em beta:

```
 total | com_credito | com_publicante
-------+-------------+----------------
   103 |           0 |             87
```

`credits` é **zero** nos 103 — nenhum material tem autor. `publisher_name` (a **editora**, campo distinto de autoria) está preenchido em 87, vindo do JSON-LD que os adapters já leem.

A investigação revela que a causa é **arquitetural**, e explica de uma vez as três lacunas desta seção. Existem dois caminhos de ingestão no Downloads, com capacidades muito diferentes:

| Caminho | Extração | Usado por |
|---|---|---|
| `genericHtmlParser` + `platformOverrides` | **rica** — autor, artista, sistema, categoria, filtros, formato, páginas | importação **manual por URL** (`routes/scraper.ts`) |
| Adapters de descoberta (`ScraperAdapter`) | **mínima** — título, URL, preço, capa, editora, idioma | scraping **automático** em massa |

Os `platformOverrides` — único lugar do código que lê `details.get('authors')`, `details.get('artists')` e `details.get('ruleSystem')` — são invocados **apenas** por `genericHtmlParser`, ou seja, só na importação manual de uma URL. O pipeline automático (`scraperIngest`) nunca passa por eles.

E o acervo atual é inteiramente do pipeline automático:

```
  source_platform  | count
-------------------+-------
 opera_rpg         |    77
 itch_io           |    15
 grimorios_e_dados |     7
 dms_guild         |     4
```

**Zero materiais de OneBookShelf** — a única plataforma com override rico. Os 103 vêm de quatro fontes cujos adapters emitem só o mínimo. Por isso `credits`, `system_id` e a classificação de tipo estão todos zerados: não é que a extração falhe, é que **ela não é chamada** nesse caminho.

Fica claro também por que `publisher_name` é a exceção com 87: é um dos poucos campos que os adapters de descoberta já emitem por conta própria.

**"Acervo Artifício" aparece como autoria falsa.** `MaterialCard.tsx:41` usa `material.credits?.trim() || 'Acervo Artifício'` — quando o material não tem crédito, o card afirma que a autoria é do Artifício. O propósito declarado do produto (D107/D119) é **mandar o usuário para o site do autor**, o oposto de uma loja que esconde quem fez. Assumir autoria de material de terceiro contradiz isso frontalmente: o Artifício não é autor de material importado de DriveThruRPG ou itch.io. O comentário no código admite a intenção ("sem crédito, o acervo assume a autoria em vez de deixar buraco") — o problema é que evitar um buraco visual não justifica uma afirmação falsa de autoria.

### O que já está pronto (e não faz parte do problema)

`apps/downloads/docker-compose.prod.yml` **já existe e já segue o padrão do mesas**: serviço `downloads-db` próprio (`postgres:16-alpine`), volume dedicado `pgdata_downloads_prod`, `POSTGRES_DB: downloads`, healthcheck, rede `artificio_net` externa. O `.github/deploy-manifest.json` já traz a entrada `downloads` com `critical_routes` de produção e `db_service: downloads-db`. **Não é preciso criar arquitetura nova** — o isolamento de banco pedido já está descrito no compose. O que falta é executá-lo pela primeira vez, com os pré-requisitos que só existem fora do Git.

---

## Requisitos (numerados, testáveis)

### Banco de dados isolado

1. O banco de produção do Downloads roda em **container e volume próprios**, fisicamente separados do beta: `downloads-db` sobre `pgdata_downloads_prod`, enquanto o beta permanece em `downloads-beta-db` sobre `downloads-beta_pgdata_downloads_beta`. Nenhum dos dois compartilha volume, container ou processo com o outro.
2. O banco de produção **nasce vazio**. Nenhum dado é copiado do beta — nem material, nem usuário, nem métrica, nem log. Beta permanece como ambiente de teste independente e descartável; produção recebe conteúdo apenas pelo fluxo normal de submissão e aprovação.
3. As **29 migrations** de `apps/downloads/database/` são aplicadas ao banco de produção pelo **script oficial** `scripts/deploy/apply_required_migrations.sh`, nunca por `psql` avulso, arquivo por arquivo, ou SQL colado à mão.
4. Como 29 pendências excedem o guard `MAX_AUTO_PENDING=5`, a aplicação é feita em **uma execução manual controlada e única** com `MAX_AUTO_PENDING` elevado ao total pendente — o script compara o conjunto inteiro de uma vez, então **fatiar em lotes é proibido**.
5. Um `pg_dump` do banco de produção é gerado **antes** da aplicação das migrations, mesmo o banco estando vazio, e guardado fora do container. É o único rollback manual disponível se algo falhar no meio.
6. Ao final, `schema_migrations` do banco de produção contém **as mesmas 29 linhas** que o beta, e nenhuma migration fica pendente ou parcialmente aplicada.

### Ambiente e segredos

7. `/opt/artificio/apps/downloads/.env` existe na VM com **todas as chaves** que `docker-compose.prod.yml` exige, incluindo as quatro obrigatórias marcadas com `:?` que abortam o boot se ausentes: `DATABASE_URL`, `JWT_SECRET`, `VIEW_HASH_SECRET`, `SERVICE_SECRET`, `RESEND_API_KEY` e `CATALOG_INTERNAL_TOKEN`.
8. Os segredos de produção são **distintos dos de beta** onde o isolamento importa — em especial `VIEW_HASH_SECRET` (compartilhá-lo permitiria correlacionar visualizações entre ambientes) e `POSTGRES_PASSWORD`.
9. O arquivo tem permissão `600`, pertence ao usuário de deploy, e **nunca** é versionado, impresso em log, colado em PR ou ecoado em saída de comando.

### Aplicação no ar

10. `main` contém o código da spec 087 — a promoção `dev → main` é **fast-forward**, sem merge commit e sem squash.
11. Os três containers de produção sobem e ficam `healthy`: `downloads-app`, `downloads-api`, `downloads-db`.
12. As três `critical_routes` de produção já declaradas no manifesto respondem o esperado, verificadas por HTTP real contra o hostname público:
    - `https://downloads.artificiorpg.com/api/v1/health` → **200**
    - `https://downloads.artificiorpg.com/` → **200**
    - `https://downloads.artificiorpg.com/api/v1/materials/mine` (sem cookie) → **401**
13. O 502 desaparece: nenhuma rota pública do Downloads responde 5xx após o cutover.
14. O fluxo de login funciona ponta a ponta contra `accounts.artificiorpg.com`, com a sessão do cookie `.artificiorpg.com` sendo aceita pelo Downloads em produção.
15. O deploy de produção é disparado por **`workflow_dispatch` manual explícito** (`--ref main`, `env=prod`). Promover o ponteiro Git não atualiza produção — `promote-prod-fast-forward.yml` nunca dispara deploy.

### Capas: padrão definido

16. O placeholder atual (retângulo cinza com o texto "Sem capa") é substituído por um **placeholder desenhado**, com identidade visual coerente com o design system de `packages/ui`, usando os tokens semânticos existentes — nunca cor crua.
17. O placeholder **varia por `material_type`**, de modo que uma prateleira de materiais sem capa não seja uma fileira de retângulos idênticos. A variação usa o tipo já presente no payload da listagem, sem consulta nova ao backend.
18. O placeholder é **puramente CSS/SVG inline**, sem requisição de rede, sem arquivo de imagem novo e sem dependência nova. Um placeholder que falha ao carregar seria pior que o retângulo cinza atual.
19. **A proporção original da capa é preservada — nunca distorcida, nunca cortada.** Hoje o card usa altura fixa com `object-cover` (`h-32 w-full`), que recorta a imagem: capa vertical perde topo e base. Capa de material de RPG é caracteristicamente **vertical**, em proporções variadas (aproximadamente 3:4, 2:3, A4), e o recorte destrói justamente a parte que identifica o material.
20. A altura da capa é **dinâmica dentro de limites**: um piso e um teto verticais que a imagem respeita sem extrapolar. Dentro dessa faixa, a altura acompanha a proporção real do arquivo.
21. A **largura se ajusta** à altura resultante, centralizada, de modo que as laterais absorvam a diferença entre capas de proporções distintas. A imagem nunca ultrapassa a largura do card.
22. Capa **mais alta que o teto** é contida por ele, sem corte e sem distorção — reduz proporcionalmente até caber. Capa **mais baixa que o piso** não é esticada; o espaço vertical restante é absorvido pelo contêiner, não pela imagem.
23. Capa horizontal ou quadrada (minoria, mas existe) é tratada pela mesma regra, sem caso especial: respeita o teto de largura e fica centralizada.
24. Card com capa e card sem capa mantêm **silhueta compatível** na prateleira: a faixa entre piso e teto é o que impede que a altura variável quebre o alinhamento horizontal. O placeholder desenhado ocupa uma altura dentro da mesma faixa.
25. **A regra vale em todo lugar que exibe capa, sem exceção** — não só no card. Inventário verificado no código (2026-07-26), os pontos que hoje renderizam `<img>` de capa:
    - `MaterialCard.tsx:52` — `h-32 w-full object-cover` (altura fixa, **corta**)
    - `MaterialPage.tsx:126` — `w-full ... object-cover` (sem trava de altura, proporção livre)

    Ambos passam a usar a **mesma regra compartilhada**, não duas implementações paralelas que divergem no primeiro ajuste. Na ficha o corte é ainda mais custoso, porque ali a capa é o elemento visual principal. Note a incoerência atual: o *placeholder* da ficha já usa `aspect-[3/4]`, mas a *imagem real* ao lado dele não tem trava alguma.
26. Qualquer ponto **futuro** que passe a exibir capa consome a mesma regra. Ela vive num único lugar — componente ou utilitário compartilhado — de modo que exibir capa fora do padrão exija sair do caminho, em vez de ser o que acontece por descuido. As telas de gestão (`GestaoMidiasPage`, `GestaoImportarPage`) hoje só têm campo de texto com a URL, sem preview visual; se ganharem preview, ele nasce sob esta regra.
27. Capa que falhe ao carregar (`onError`) cai no placeholder desenhado — nunca em imagem quebrada.
28. O placeholder é **decorativo** para leitor de tela: não anuncia "sem capa" nem compete com o título do material na navegação por acessibilidade.

### Crédito: editora e autoria

29. `MaterialCard` **deixa de exibir "Acervo Artifício"** como autoria de material sem crédito. O Artifício não é autor de material importado de terceiro, e afirmar isso contradiz o propósito declarado do produto (D107/D119: mandar o usuário ao site do autor).
30. **Editora e autor são campos distintos, nunca intercambiáveis.** `publisher_name` é a **editora** que publicou o material; `credits` é quem o **escreveu/ilustrou**. Um não substitui o outro nem serve de fallback do outro — exibir a editora sob rótulo de autoria seria o mesmo erro do "Acervo Artifício", só com outro nome.
31. A ordem de exibição no eyebrow é **publicante (editora) primeiro, autor depois** — decisão do mantenedor (2026-07-26). Cada um aparece com rótulo que identifica o que é, de modo que o leitor nunca confunda editora com autoria.
32. Quando **nenhum** dos dois existe, o eyebrow **não é renderizado**. Nenhum texto substituto ocupa o lugar.
33. A verificação trata `""` e `"   "` como ausência, não apenas `null`/`undefined` — os dois campos vêm de scraper e de formulário, então string vazia chega até o componente (achado de review da PR #214).
34. O card sem eyebrow permanece visualmente coerente na prateleira: sem colapso de layout, sem título encostando na borda da capa, sem salto de alinhamento entre cards vizinhos.
35. **Exibir corretamente não fecha o problema — o parser precisa passar a identificar.** Que 87 materiais tenham editora e **zero** tenham autor é falha de extração, não de apresentação. Requisitos de correção na seção do parser abaixo.

### Parser: causa comum das três lacunas

36. **As três lacunas — autoria, sistema e tipo — têm uma única causa arquitetural.** A extração rica vive nos `platformOverrides`, invocados **apenas** por `genericHtmlParser` (importação manual por URL). O pipeline automático (`scraperIngest`) nunca passa por eles, e os adapters de descoberta emitem só o mínimo: título, URL, preço, capa, editora, idioma. Todo o acervo atual (103 materiais, de `opera_rpg`/`itch_io`/`grimorios_e_dados`/`dms_guild`) veio pelo caminho automático — **zero de OneBookShelf**, a única plataforma com override rico. Não é que a extração falhe: **ela não é chamada** nesse caminho.

37. Os adapters de descoberta passam a extrair também os campos ricos que a fonte expõe, encerrando a assimetria entre importar uma URL manualmente e descobrir em massa. Onde a plataforma já tem override, a lógica é **reaproveitada**, não reescrita em paralelo — duas implementações do mesmo parsing divergem no primeiro ajuste.

38. Onde a fonte genuinamente não expõe um campo, o adapter emite `null` explícito. **Nunca** derivar autor, editora, sistema ou tipo de título ou descrição: dado inventado é pior que dado ausente, porque contamina crédito, filtro e badge com afirmação falsa.

### Parser: autoria e editora

39. Os cinco adapters passam a extrair **autoria** (`authorsCredits`/`artistsCredits`) quando a fonte a expõe, a partir de fixture real da plataforma.
40. `publisher_name` (**editora**) continua sendo extraído e gravado como campo próprio, sem se misturar a autoria em nenhum ponto do pipeline.
41. A correção é comprovada em beta: `count(credits)` sai de **zero** após reprocessamento. Se uma plataforma específica de fato não publica autoria, isso é registrado como constatação da fonte — não confundido com falha de extração.

### Parser: sistema e edição

42. **Sintoma e causa.** `raw_system_hint` zerado nos 103 prova que `systemHint` não chega ao ingest — a falha é anterior ao matcher. Cinco scrapers (`driveThruRpgScraper`, `dmsGuildScraper`, `itchIoScraper`, `grimoriosEDadosScraper`, `operaRpgScraper`) **não emitem `systemHint` em nenhum ponto**; apenas o override do OneBookShelf o faz, lendo `details.get('ruleSystem')` — e o acervo não tem nenhum material dessa origem.
43. Cada um dos cinco scrapers passa a extrair o sistema quando a fonte o expõe, a partir de fixture real da plataforma — não de suposição sobre o HTML dela.
44. Quando a fonte **não** expõe sistema de forma confiável, o scraper emite `null` explicitamente. Inventar hint a partir de título ou descrição é proibido: alimentaria o matcher com ruído e produziria vínculo errado, pior que vínculo ausente.
45. Hint extraído que **não casa** contra o catálogo central preserva o texto bruto em `raw_system_hint` e abre entrada na fila de triagem admin — comportamento que `resolveSystemHint` já implementa e que hoje nunca é exercitado por falta de entrada.
46. O matcher permanece **conservador**: igualdade exata normalizada contra nome/`name_pt`/aliases. Fuzzy continua reservado à triagem admin, onde um humano decide (decisão registrada na spec 086, T4.5). Esta spec corrige a alimentação, não afrouxa o casamento.
47. A correção é comprovada por **reprocessamento real em beta**, com o número de materiais com `system_id` preenchido saindo de zero — evidência no banco, não em teste unitário isolado.
48. Nenhum vínculo de sistema é escrito diretamente no catálogo central pelo scraper. Só a triagem admin faz isso (requisito 8 da spec 086), e essa fronteira não muda.

### Parser: tipo de material

49. **Causa raiz identificada:** a classificação de tipo **nunca existiu**. `ScrapedItem` não tem campo de tipo, e `DEFAULT_MATERIAL_TYPE_SLUG = 'aventura'` é resolvido uma vez por execução e aplicado a todos os itens. Não é regressão de algo que funcionava; é lacuna desde a origem do pipeline.
50. `ScrapedItem` ganha um campo de **hint de tipo de material**, no mesmo desenho de `systemHint`: opcional, `null` explícito quando a fonte não expõe.
51. Cada scraper passa a emitir esse hint quando a fonte o expõe, a partir de **fixture real** da plataforma — a mesma disciplina exigida para o hint de sistema.
52. O ingest resolve o hint contra a **taxonomia central de tipo** já existente, via `getCatalogMaterialTypeBySlug`, que já aceita slug **ou alias**. A infraestrutura criada pela spec 086 (requisito 25) passa a ser usada; nada de taxonomia nova.
53. A resolução acontece **por item**, dentro do laço — não uma vez por execução como hoje.
54. Hint que **não casa** contra a taxonomia preserva o valor bruto e abre triagem, no mesmo padrão de `raw_system_hint`: o material nunca perde a informação nem finge que ela não existe.
55. Item sem hint ou com hint não resolvido cai num **default explícito**, e esse default deixa de ser "Aventura" — rotular como aventura um material não classificado é afirmação falsa. O default é um tipo neutro da taxonomia central, e o fato de ser default fica registrado, não confundido com classificação real.
56. Inventar tipo a partir de título ou descrição é proibido, pela mesma razão do hint de sistema: classificação errada contamina filtro e badge, e é pior que classificação ausente.
57. A correção é comprovada por **reprocessamento real em beta**: a distribuição de `material_type` deixa de ser uma única linha com 100% do acervo.

### Acesso ao material em nova aba

58. O botão "Acessar material" da ficha (`MaterialPage`) abre o destino em **nova aba**, preservando a ficha na aba original. Hoje ele navega na mesma aba e o usuário perde o contexto do material que estava lendo.
59. A abertura é feita por **navegação nativa** — âncora com `target="_blank"` — e não por `window.open` chamado após resposta de API. Chamar `window.open` depois de um `await` perde o gesto do usuário e é bloqueado por popup blocker.
60. A âncora carrega `rel="noopener noreferrer"`: sem `noopener`, a página de destino recebe `window.opener` e pode manipular a aba de origem; sem `noreferrer`, o `Referer` vaza a URL de origem para o site de terceiro.
61. `Ctrl+clique`, botão do meio e "abrir em nova aba" do menu de contexto passam a funcionar, e o destino aparece na barra de status ao passar o mouse — comportamentos que um `<button>` não oferece.
62. O evento de funil `download_cta_click` e o registro de download continuam disparando no clique, **antes** da navegação, exatamente como hoje. Trocar o elemento não pode perder a instrumentação.
63. O desenho **fail-closed** da rota `/ir/:destinationId` permanece intacto: a resolução do destino continua acontecendo lá, e destino que não resolve mostra aviso em vez de redirecionar às cegas (critério da spec 073, T4.1).
64. O `destination_id` continua **opaco**: a URL externa real não é pré-resolvida nem embutida no HTML da ficha. O identificador desacoplado do slug (DEB-073-02) é o que faz o link sobreviver a troca futura de slug.
65. Material sem destino configurado continua mostrando o aviso de indisponibilidade, sem link clicável.

### Avaliação por estrelas clicáveis

66. O controle de avaliação em `RatingSection` deixa de ser um `<select>` com opções de 1 a 5 e passa a ser **cinco estrelas clicáveis**.
67. As estrelas de entrada são elementos **focáveis e operáveis por teclado**: navegáveis por `Tab`, acionáveis por `Enter`/`Espaço`, com indicador de foco visível. Um controle que só responde ao mouse é regressão de acessibilidade em relação ao `<select>` que substitui.
68. Cada estrela tem **nome acessível próprio** que comunica o valor que representa (por exemplo, "3 de 5 estrelas"), e o estado selecionado é exposto a tecnologia assistiva — não apenas por cor ou preenchimento.
69. O estado de seleção é visível sem depender de cor isolada: estrela escolhida e não escolhida diferem em preenchimento, e não apenas em matiz.
70. As estrelas de entrada respeitam o alvo de toque mínimo de 44px já adotado no projeto, sem que isso as faça colidir visualmente umas com as outras.
71. A **nota já enviada pelo usuário** é refletida no controle ao carregar a ficha — o usuário vê o que avaliou antes, e reavaliar parte desse estado em vez de partir de um valor arbitrário. Hoje o `<select>` sempre inicia em `5`, independentemente do que a pessoa tenha avaliado.
72. O guard de permissão permanece: quando o backend responde `403` (conta sem download registrado do material), a explicação visível continua aparecendo. A mudança é de controle de entrada, não de regra de negócio.
73. As estrelas **somente-leitura** do card e do topo da ficha (`MaterialRating`) permanecem `<span>`, **não** viram `<button>`. O card inteiro é um alvo de clique único (`before:absolute before:inset-0` no `<Link>`), e qualquer elemento focável ali roubaria o clique e quebraria a navegação para a ficha — trava explícita da spec 087. Só o controle de **entrada** da `RatingSection` se torna interativo.

### Canonical (T4.4, herdada da spec 087)

74. O alvo canônico único do catálogo é a **raiz**: `https://downloads.artificiorpg.com/`.
75. `/`, `/catalogo` e **todas** as suas query strings (`?q=`, `?sort=`, `?page=`, e combinações) emitem exatamente **uma** tag `<link rel="canonical">` apontando para a raiz absoluta.
76. A tag é montada **apenas** na página de catálogo, nunca em `index.html`: canonical estática no HTML base vazaria pelo fallback do SPA para ficha de material, painel e telas de gestão, marcando-as todas como duplicata da home.
77. Rotas alheias ao catálogo **não herdam** a tag, e o cleanup a remove ao desmontar — navegar do catálogo para uma ficha e voltar não deixa tag órfã nem duplicada.
78. O ciclo completo (criação, unicidade, alvo correto, ausência em rota alheia, remoção no cleanup) é coberto por teste automatizado em JSDOM. `view-source` e `curl` **não** servem como validação: não executam React e não veriam a tag.

---

## Critérios de aceite

A spec só está concluída quando **todos** os itens abaixo têm evidência real registrada — comando executado com saída, não afirmação:

1. `docker ps` na VM lista `downloads-app`, `downloads-api` e `downloads-db` como `Up ... (healthy)`.
2. `docker volume ls` lista `downloads_pgdata_downloads_prod`, e `downloads-beta_pgdata_downloads_beta` continua existindo, intacto.
3. `SELECT count(*) FROM schema_migrations` no banco de produção retorna **29**, idêntico ao beta.
4. As três `critical_routes` de produção retornam os códigos do Requisito 12, verificadas por `curl` contra o hostname público.
5. Nenhuma rota pública responde 5xx.
6. O run de `deploy.yml` em `--ref main` com `env=prod` conclui com `conclusion: success`.
7. `origin/main` aponta para o mesmo commit que `origin/dev` apontava no momento da promoção, alcançado por fast-forward.
8. Login real via `accounts.` conclui e a sessão é reconhecida pelo Downloads em produção.
9. Suíte de testes do frontend e do backend do Downloads verde, incluindo os testes novos de canonical, placeholder de capa, ausência de eyebrow sem crédito e extração de `systemHint` por scraper.
10. `pnpm run lint` e `pnpm run build` verdes.
11. `pnpm verify:api` verde (a spec toca `apps/**`).
12. `specs/backlog.md` e `.specify/memory/project-state.md` atualizados; débito residual da 087 fechado ou explicitamente reaberto com motivo.
13. **Nenhum card renderiza "Acervo Artifício"** — verificado por busca no código (a string deixa de existir como fallback) e no DOM renderizado.
14. **Nenhum card renderiza o placeholder cinza "Sem capa"** — materiais sem capa mostram o placeholder desenhado, variando por tipo.
15. **Sistema deixa de ser zero em beta:** após corrigir os scrapers e reprocessar, `select count(system_id) from download_material` retorna valor maior que zero, com evidência no banco. Materiais cujo hint não casou têm `raw_system_hint` preenchido e entrada na fila de triagem — provando que o caminho de não-casamento também passou a ser exercitado.
16. **Autoria deixa de ser zero:** `select count(credits) from download_material_metadata` retorna valor maior que zero após o reprocessamento. Plataforma que genuinamente não publica autoria é registrada como constatação da fonte, com evidência — nunca confundida com falha de extração.
17. **Editora e autoria permanecem campos distintos** no banco e na exibição: nenhum caminho de código copia `publisher_name` para `credits` ou o exibe sob rótulo de autoria.
18. **Tipo deixa de ser 100% "Aventura":** `select material_type, count(*) from download_material group by 1` retorna mais de uma linha, e nenhuma delas concentra o acervo inteiro. Nenhum material fica rotulado "Aventura" por default — o default passa a ser um tipo neutro e distinguível de classificação real.
19. **"Acessar material" abre em nova aba**, verificado no DOM renderizado: o elemento é uma âncora com `target="_blank"` e `rel="noopener noreferrer"`, e o evento `download_cta_click` continua disparando no clique.
20. **Avaliação é por estrelas clicáveis**, operáveis por teclado, com nome acessível por estrela e estado selecionado exposto a tecnologia assistiva. Nenhum `<select>` de nota permanece na `RatingSection`.

---

## Fora de escopo

- **Copiar dados do beta para produção.** Decisão do mantenedor (2026-07-26): produção nasce vazia. Material de teste não vira conteúdo público.
- **Habilitar `auto_deploy_on_push` para o Downloads.** Permanece `false` (dispatch-only) até o primeiro deploy de produção fechar verde. Mudar isso é decisão posterior, com evidência de estabilidade.
- **Alterar o guard `MAX_AUTO_PENDING` no script de deploy.** A proteção continua em `5` para todos os módulos; o primeiro corte usa elevação pontual por variável de ambiente numa execução única, não mudança permanente de código.
- **Redesign, nova feature ou mudança de comportamento do Downloads.** Esta spec é cutover de infraestrutura mais um débito de SEO já especificado. Nada de produto novo entra.
- **Smoke visual e de viewport (T3.4/T4.1/T4.3 da spec 087).** Continuam abertos como débito; dependem de inspeção em browser real e não são desbloqueados por este cutover.
- **`mesas-cron` ou equivalente para o Downloads.** O mesas tem um serviço de cron em produção; o Downloads não tem e não ganha um aqui.
- **Backfill de sistema/edição nos 103 materiais de beta.** Decisão do mantenedor: a correção é dos scrapers, validada por reprocessamento. Produção nasce vazia, então o acervo de beta é descartável — backfill não traria ganho além da validação, que o reprocessamento já dá.
- **Extrair capa faltante nos 80% de materiais sem `cover_image_url`.** Decisão do mantenedor: esta spec define o **padrão de exibição** quando não há capa (placeholder desenhado), não a busca de imagem nova. Corrigir a extração de capa nos scrapers é trabalho próprio, com fixture real por plataforma, e vira spec separada.
- **Afrouxar o matcher de sistema para fuzzy no scraper.** Permanece igualdade exata; fuzzy segue reservado à triagem admin com humano no circuito (decisão da spec 086, T4.5).
- **Criar tipos novos na taxonomia central de material.** A taxonomia existe (spec 086, requisito 25) e o scraper passa a consumi-la. Se um hint legítimo não tiver tipo correspondente, o caso vai para triagem — o scraper nunca escreve no catálogo central, mesma fronteira já valendo para sistema.
- **Reclassificar manualmente os 103 materiais de beta.** Mesma razão do sistema: produção nasce vazia, o acervo de beta é descartável, e o reprocessamento já valida a correção.
- **Avaliar material direto do card do catálogo.** As estrelas do card permanecem somente-leitura. Torná-las interativas quebraria o alvo de clique único do card, e é mudança de comportamento fora deste escopo.
- **Redesign do `MaterialCard` além dos pontos citados.** Capa, eyebrow de crédito e badge de sistema são os únicos elementos tocados. Estrutura, tipografia e alvo de clique permanecem como a spec 087 os deixou.

---

## Riscos e impacto em outros módulos

### Risco alto

**Guard de migrations abortando o deploy (E012).** 29 pendências contra um limite de 5 fazem o deploy automático abortar com `Muitas migrations pendentes`. O rollback automático preserva o estado, sem dano — não é bug, é a proteção funcionando. Mitigação: aplicar as migrations manualmente **antes** de disparar o deploy, pelo script oficial, com `MAX_AUTO_PENDING=29` numa execução única. Depois disso o deploy encontra zero pendências e passa direto.

**Ausência de `.env` em produção derruba o boot.** Seis variáveis usam `:?` no compose e abortam o container se faltarem. Sem o `.env` posto na VM **antes** do deploy, `downloads-api` nem sobe e o 502 persiste — agora com container em crash loop em vez de container ausente. Mitigação: criar e conferir o `.env` como passo bloqueante anterior ao deploy, validando chave por chave contra o compose.

**Rotação de senha em volume Postgres (E009).** Se o volume `pgdata_downloads_prod` for criado com uma senha e o `.env` depois alterado, `POSTGRES_PASSWORD` **não** é reescrito — só grava em `pg_authid` na primeira init. Sintoma: `28P01 password authentication failed` em loop com `.env` aparentemente correto. Agravante: testar por `psql -h 127.0.0.1` engana, porque localhost é `trust` e aceita qualquer senha. Mitigação: fixar a senha **antes** de subir o banco pela primeira vez e testar sempre pela rede Docker, nunca por localhost.

**Correção de scraper produzindo vínculo errado é pior que vínculo ausente.** Um `system_id` incorreto afirma ao usuário que o material é de um sistema que ele não é, e alimenta filtro e badge com dado falso — enquanto o estado atual (nulo) apenas não informa. Mitigação: extração baseada em fixture real por plataforma, nunca em heurística sobre título ou descrição; fonte que não expõe sistema de forma confiável emite `null` explícito; matcher permanece igualdade exata, então hint duvidoso cai na triagem admin em vez de virar vínculo automático.

### Risco médio

**Reprocessar scraper em beta pode duplicar material.** O dedupe é por `(source_platform, source_url)` e existe justamente para isso, mas um scraper alterado que mude a URL de origem escaparia da chave e criaria duplicata. Mitigação: conferir a contagem de materiais antes e depois do reprocessamento; crescimento inesperado indica dedupe furado, não sucesso de extração.

**Drift de migrations por intervenção manual.** A aplicação manual das 29 é feita pelo script oficial justamente para registrar tudo em `schema_migrations` e não gerar drift. Qualquer `psql` avulso fora do script criaria divergência entre banco e disco, bloqueando o próximo deploy automático. Mitigação: script oficial sempre; se houver qualquer intervenção fora dele, reconciliar com `reconcile_migrations.sh --mark-applied` antes de considerar a fase fechada.

**Clone de produção desatualizado.** `/opt/artificio` está 8 commits atrás e tem só 20 dos 29 arquivos de migration em disco. O deploy faz `git fetch/reset`, o que resolve — mas se a aplicação manual das migrations rodar **antes** do clone ser atualizado, ela só enxergaria 20 arquivos e aplicaria um schema incompleto, sem erro aparente. Mitigação: atualizar o clone de produção **antes** de contar ou aplicar migrations, e conferir que `ls apps/downloads/database/migration_*.sql | wc -l` retorna 29 na VM.

**Dependência de `packages/ui` fora do `deploy_paths` do Downloads.** O manifesto declara `deploy_paths: ["apps/downloads"]`, sem `packages/ui`. Mudanças no Header compartilhado feitas na spec 087 chegam ao Downloads porque o build é do monorepo inteiro, mas **não** disparam deploy dos outros consumidores. O contrato é aditivo, então consumidores não migrados não quebram — mas mesas, glossário e site só recebem o Header novo no próprio deploy. Impacto benigno, registrado para não virar surpresa.

### Impacto em outros módulos

- **`accounts.` (SSO):** consumido, não alterado. Downloads em produção passa a ser mais um cliente do cookie `.artificiorpg.com`. Nenhuma mudança de código em `packages/auth`; o smoke de login valida a integração do lado do Downloads.
- **`site` (catálogo canônico de sistemas):** `downloads-api` consome `CATALOG_API_URL=http://site-prod-app:4322` pela rede Docker interna, com `CATALOG_INTERNAL_TOKEN`. Em produção isso aponta para o container de produção do site, que já existe e está saudável. Requer que o token de produção esteja correto no `.env` — token errado degrada a resolução de sistemas sem derrubar o app.
- **Cloudflare Tunnel:** o ingress do hostname de produção **já existe** (é o que produz o 502 em vez de erro de DNS). Nenhuma mudança de DNS ou de tunnel é necessária. Se ao final do cutover o 502 persistir com containers saudáveis, aí sim há problema de roteamento — e mexer em tunnel de produção exige aprovação nominal própria.
- **Recursos da VM:** três containers novos, um deles Postgres. A VM já roda 25 containers, dos quais 8 são Postgres. Convém conferir memória e disco disponíveis antes de subir, para não degradar módulos vizinhos.
