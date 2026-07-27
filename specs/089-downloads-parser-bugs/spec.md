# 089 — Correção dos bugs de parser e ingest achados na Fase 2 da spec 088

- **Módulo/Pacote:** apps/downloads
- **Gate relacionado:** D (Downloads em produção — bloqueia o cutover da spec 088)

## Problema

A Fase 2 da spec 088 foi medida em beta em 2026-07-27, sobre acervo limpo e recoletado
(148 materiais apagados, 141 recoletados das três fontes acessíveis). **Dois critérios de
aceite passaram, três falharam**, e a medição revelou quatro defeitos distintos.

Baseline (antes) e resultado (depois), no banco de beta:

| Métrica | Baseline | Esperado | Real | Veredito |
|---|---|---|---|---|
| `total` | 148 | ~144 | 141 | ok |
| `com_credito` | 0 | ~119+ | 90 | ✅ passou |
| `com_publicante` | 119 | ~10 | 23 | ✅ passou |
| `com_sistema` | 0 | > 0 | **0** | ❌ falhou |
| `hint_bruto` | 0 | > 0 | **0** | ❌ falhou |
| `material_type` distintos | 1 linha | várias | **1 linha** | ❌ falhou |

O que a Fase 2 **entregou**: a correção do requisito 40a funcionou. `com_publicante` caiu de
119 para 23 e `com_credito` subiu de 0 para 90 — o autor deixou de ser gravado no campo da
editora.

O que a Fase 2 **não entregou**: a extração de sistema, que era sua razão de ser.

### Defeito 1 — nenhum parser produz `systemHint` (causa de `com_sistema`=0 e `hint_bruto`=0)

`resolveSystemHint` (`scraperIngest.ts:123`) está correto e testado: casa contra o catálogo e,
não casando, preserva o texto bruto em `raw_system_hint`. O problema é que **ele nunca recebe
valor**. Busca por `systemHint` em `operaRpgScraper.ts`, `itchIoScraper.ts` e
`grimoriosEDadosScraper.ts` retorna **zero ocorrências nas três**.

`hint_bruto` em 0 é a prova decisiva: se o parser tentasse extrair e falhasse em casar, o hint
bruto estaria preenchido. Zero nas duas colunas significa que o caminho de extração não é
exercitado — a `migration_031` criou a coluna, o ingest a consome, e ninguém a alimenta.

### Defeito 2 — nenhum parser produz `materialTypeHint` (causa de 100% em `nao-classificado`)

Mesma raiz do defeito 1, outro campo. `resolveMaterialTypeHint` resolve o hint contra a
taxonomia central e cai no tipo neutro quando não casa. Como nenhuma fonte produz o hint,
**141 de 141 materiais caem no default**.

O resultado prático é que a Fase 2 trocou "tudo é Aventura" por "tudo é Não classificado" — a
mesma distribuição de uma linha só, com outro rótulo. Decisão do mantenedor (2026-07-27): o
default neutro **permanece** como rede de segurança; o que se corrige é a ausência de extração
que o transformou em caminho único.

### Defeito 3a — corpus do `itch_io` é de VIDEOGAMES, não de RPG de mesa

Achado da revisão do Codex (Fase 0, 2026-07-27), **verificado no código**.

`itchIoScraper.ts:15` usa `LISTING_URL = 'https://itch.io/games/genre-rpg/lang-pt-BR'`. O
caminho `/games/` é o catálogo de **videogames** do itch.io. A rota de RPG de mesa é
`/physical-games/genre-rpg/lang-pt-BR` — o itch.io distingue videogame, tabletop game e book
na própria classificação de projeto.

Isso explica o conteúdo observado no acervo de beta: `Pigeon Ascent`, `Dungeon Raid`,
`Wagotabi: Learn Japanese [Demo]`, `Violet and the Lost Colors` são jogos digitais, não
materiais de RPG.

**Consequências, todas confirmadas:**

- Os 14 itens do `itch_io` não formam corpus válido para um catálogo de RPG.
- A baseline de 141 materiais precisa ser refeita depois da correção da fonte.
- `materialTypeHint` classificaria videogame como material de mesa.
- O diagnóstico do defeito 3 estava contaminado por esse corpus.

### Defeito 3b — `lang-pt-BR` significa "tem versão em português", não "página em português"

Achado da revisão do Codex (Fase 0, 2026-07-27).

O filtro `lang-pt-BR` do itch.io marca projetos que **possuem tradução** portuguesa — a
diretriz da plataforma orienta o autor a declarar os idiomas suportados. `World's Doom` e
`Grimm's Hollow` têm versão pt-BR de fato, apesar de título e descrição em inglês.

Isso torna o critério original de T2.1 factualmente errado: exigia barrar três títulos
ingleses conhecidos, mas pelo menos dois são materiais legitimamente traduzidos.

Decisão do mantenedor (2026-07-27): **exigir texto em português**. Material cuja página está em
inglês não entra, mesmo tendo tradução disponível — o acervo é de material em português, não de
material que possui versão em português.

### Defeito 3 — filtro de idioma não roda no `itch_io` (bypass por `sourceLanguageHint`)

O filtro de idioma **funciona nas outras fontes**: `opera_rpg` barrou 14 de 132,
`grimorios_e_dados` barrou 5 de 14. Já `itch_io` barrou **0 de 14**.

**Diagnóstico corrigido após a revisão do Codex (2026-07-27).** A hipótese original — detector
falhando em textos curtos — está errada. A causa real é bypass por desenho:

```ts
// scraperIngest.ts:226
if (item.sourceLanguageHint !== 'pt') {
  const detection = await detectPortuguese(combinedText);   // ← nunca executa no itch_io
  ...
}
```

`ItchIoScraper` passa `sourceLanguageHint: 'pt'` fixo (`itchIoScraper.ts:26`), porque confia no
filtro `lang-pt-BR` da URL como "fonte primária de decisão de idioma". Com o hint em `'pt'`, o
detector **nunca é chamado** e `detectedLanguage` fica `'pt'` sem verificação alguma.

Não há detecção falhando: não há detecção. E o pressuposto que justificava o bypass está errado
pelo defeito 3b — `lang-pt-BR` não garante que o texto esteja em português.

Agravante independente: `language: 'pt'` é **hardcoded** em `scraperIngest.ts:323` ao criar o
material, então mesmo onde o detector roda, o resultado não chega à coluna.

### Defeito 4 — entidades HTML não decodificadas, em todo campo de texto vindo de scraper

Entidade crua chega à tela do usuário. Achado pelo mantenedor no catálogo de beta, em três
campos distintos:

- **Título:** `World&#039;s Doom: Mission Salvation`, `Machados &amp; Bruxarias` (3 materiais com `&#039;`)
- **Descrição/resumo:** `Adaptação das raças do D&amp;D`, `pink &amp; cutesy game` (6 materiais)
- **Editora:** `Editora Grimórios &amp; Dados Editora`

O texto vem de regex direta sobre o HTML (`TITLE_RE`, `operaRpgScraper.ts:49`) sem passar por
decodificação — `decodeHtmlEntities` existe (`sanitizeRichHtml.ts:100`) mas só a descrição
rica passa por ela.

Dois agravantes que elevam a prioridade deste defeito:

1. **O título contamina o slug.** `world-039-s-doom-mission-salvation` é URL pública
   permanente; corrigir depois de publicado exige redirect 301, o que colide com a regra
   pétrea de SEO. Em prod, o acervo nasce vazio — basta corrigir antes do cutover.
2. **`D&amp;D` sabota o casamento de sistema.** O texto correto é `D&D`, que é exatamente o
   nome que `resolveSystemHint` precisa casar contra o catálogo. A entidade crua faz o
   casamento falhar mesmo depois de o defeito 1 ser corrigido — os dois se cruzam.

Decisão do mantenedor (2026-07-27): decodificar **todo campo textual vindo de scraper**, por
padrão, em vez de enumerar campo a campo. Entidade crua é lixo visível ao usuário final;
listar campos deixaria o próximo esquecido.

**Refinamento após a 1ª revisão do Codex (Fase 1, 2026-07-27) — "todo campo textual" ≠ "todo
`string`".** `ScrapedItem` mistura semânticas incompatíveis (`scrapers/types.ts:6`):

| Campo | Semântica | Tratamento |
|---|---|---|
| `title`, `description`, `publisherName`, `systemHint`, `materialTypeHint`, `scenario` | texto humano | decodificar |
| `sourceUrl`, `coverImageUrl` | URL | **não** decodificar — decode altera a URL |
| `descriptionHtml` (metadata) | HTML rico | **só** DOMPurify; decode aqui pode transformar `&lt;script&gt;` em markup ativo |
| `isFreeOrPwyw`, `sourceLanguageHint` | booleano/enum | não se aplica |

Decode não é controle de XSS — é normalização de texto. Aplicá-lo a HTML rico depois do
DOMPurify desfaz a sanitização.

**Três correções factuais à versão anterior desta spec, achadas pela revisão:**

1. **`summary` não existe no contrato do parser.** Nasce de `description.slice(0, 500)` em
   `scraperIngest.ts:277`. Sanear `summary` "no parser" é impossível: ele deriva de um campo
   já saneado. O que resolve o `&amp;` observado em `summary` é sanear `description`.
2. **`TITLE_RE` está em `operaRpgScraper.ts:33`**, não 49 (49 é o uso).
3. **São dois parsers, não três.** `itch_io` e `grimorios_e_dados` compartilham
   `itchIoParser.ts:100` — e `plan.md` omitia esse arquivo dos afetados.

**Limite do decoder atual.** `sanitizeRichHtml.ts:7` conhece **5** entidades nomeadas (`amp`,
`apos`, `gt`, `lt`, `nbsp`, `quot`). O padrão HTML5 define milhares. `&copy;`, `&hellip;`,
`&mdash;` e afins sobreviveriam. Decisão do mantenedor: **adicionar `html-entities`** como
dependência do downloads — já existe no monorepo, então não é stack nova.

**Dupla decodificação é corrupção silenciosa.** Decode não é idempotente: `&amp;lt;` vira
`&lt;` na primeira passagem e `<` na segunda. `routes/scraper.ts:147` já transforma
`description` no `/ingest`. Somar outro decode ali criaria duas passagens sobre o mesmo texto —
daí o requisito de fronteira única.

### Defeito 5 — editora, autor e sistema não são clicáveis no card

Achado pelo mantenedor no catálogo de beta. Editora e autor renderizam como `<p>` puro
(`MaterialCard.tsx:44-45`), sem `<a>`. Clicar em "Grimórios & Dados Editora" não leva a lugar
nenhum.

O comportamento esperado é o padrão de catálogo de e-commerce: clicar numa faceta filtra o
acervo por ela. Hoje o catálogo aceita `q`, `material_type`, `system_id`, `edition_id`, `sort`
e `page` — **não existe filtro de editora nem de autor**. Tornar clicável exige construir a
busca antes; não é ligar um link a uma rota pronta.

`system_id` é o caso mais simples: o filtro já existe no catálogo, falta apenas o link.

**Complicador de modelagem:** `publisher_name` é texto solto na tabela de metadata. Sem
normalização, "Grimórios & Dados Editora" e "Grimorios e Dados" viram facetas distintas para
a mesma editora. Decisão do mantenedor (2026-07-27): **normalizar na gravação** (trim, decode,
colapsar espaço) e casar o normalizado — sem criar tabela/entidade própria nesta spec.

### Defeito 6 — rótulo "Em português" em 100% dos cards, inclusive nos que não estão

Achado pelo mantenedor. Todo card exibe "Em português", incluindo `Fight slimes. Argue with
villagers.`, `Learn Japanese in immersion from zero` e `decay together.` — o site **afirma
algo falso** ao usuário, não apenas guarda dado errado. É a manifestação visível do
`language: 'pt'` hardcoded (defeito 3).

Decisão do mantenedor (2026-07-27): **remover o rótulo do card**. O acervo é, por premissa, em
português — carimbar isso em todo card é ruído visual que não informa nada. O filtro de idioma
passa a garantir a premissa; a interface não precisa anunciá-la.

Achado lateral no mesmo elemento: `Editora Grimórios & Dados Editora` duplica a palavra
"Editora" — o prefixo do label colide com nomes de fonte que já a contêm.

### Defeito 7 — comentário não mostra quem comentou

Achado pelo mantenedor. `GET /comments/:materialId` devolve `user_id` cru
(`comments.ts:49`) — sem nome, sem avatar. A caixa de comentários não tem como exibir autor.

`downloads` não tem tabela de usuários própria (SSO direto via `accounts.`), então o
comentário guarda só o UUID.

**`download_creator` não serve como fonte de identidade**, apesar de ter `display_name`. Ela é
a tabela de **criador de material**, não de usuário do site. Estado real em beta (2026-07-27):
um único registro, `Indexação automática` — o creator sintético que o scraper usa para atribuir
material coletado, com `user_id` **nulo de propósito**, porque não é pessoa. O único comentário
existente tem `user_id` `cd3da8de…` (admin, via SSO) e não casa com creator nenhum. O `join`
não falharia por falta de dado: falharia por forçar semântica errada sobre a tabela.

Decisão do mantenedor (2026-07-27): **identidade vem do `accounts.` (SSO)**, que é o dono dela
no monorepo — mesmo caminho já usado para consumir o catálogo do site.

Precedente relevante: `mesas` resolve problema análogo em `services/actorNameResolver.ts`, com
cascata de fontes e try/catch para nunca derrubar a resposta por falha de identidade. O
tratamento de indisponibilidade serve de referência direta; a fonte, não — `mesas` tem tabelas
`users`/`profiles` locais que o `downloads` não tem nem deve criar.

### Defeito 7b — comentários não permitem responder outro comentário

Pedido do mantenedor junto ao defeito 7. A caixa de comentários é plana: não há como responder
a um comentário específico. É **feature nova**, não correção — exige `parent_id` na tabela
(migration), validação de profundidade e UI aninhada.

Decisão do mantenedor (2026-07-27): entra nesta spec, junto da exibição de autor, por mexerem
na mesma caixa.

### Defeito 8 — slug manual no formulário de novo material

Achado pelo mantenedor. `NovoMaterialPage.tsx:17` mantém `slug` como campo de texto manual
(`useState('')`), pedindo que o usuário o digite.

Slug é detalhe técnico de URL, não decisão editorial. O usuário não deveria vê-lo, muito menos
preenchê-lo — o backend já sabe derivar slug único de título (`generateUniqueSlug`, usado pelo
ingest do scraper). Decisão do mantenedor: **automático, sem nem sugerir ao usuário**.

### Defeito 9 — `<select>` ilegível no tema escuro

Achado pelo mantenedor, ao selecionar tipo de material: texto branco sobre fundo branco.

`NovoMaterialPage.tsx:73` aplica `bg-transparent` e `text-[var(--fg)]` ao `<select>`. O menu
suspenso nativo não herda `bg-transparent`: o navegador o pinta com o fundo branco do sistema,
enquanto o texto do `<option>` herda `var(--fg)`, que é claro no tema escuro. Branco sobre
branco.

O mantenedor relatou que o mesmo defeito já estaria registrado. Busca no `backlog.md` achou
itens de contraste de tema (`BL-QA-A11Y-SWEEP`, `BL-MESAS-081-POS-FECHAMENTO`, `BL-UI-B6-E2E`)
mas **nenhum específico deste `<select>` no downloads** — pode ser recorrência da mesma classe
de defeito em módulo novo, ou registro que a busca textual não alcançou. Vale conferir se a
correção cabe em `packages/ui` (afetaria todos os módulos) ou é local.

### Defeito 10 — `summary` e `description` sem suporte a HTML formatado

Pedido do mantenedor: resumo e descrição deveriam ser configuráveis com HTML, como já existe
em `mesas`.

Estado real, mais granular que "não tem HTML":

| Campo | Tipo | Editor | Render |
|---|---|---|---|
| `description_html` (metadata) | HTML sanitizado | `GestaoEditarDescricaoPage` | `MaterialPage` (`dangerouslySetInnerHTML`) |
| `description` (material) | texto puro | — | texto |
| `summary` (material) | texto puro | — | texto |

O backend **já tem a infraestrutura**: `sanitizeRichHtml` é aplicado a `description_html` na
escrita e na leitura (`materialMetadata.ts:48,79`). O que falta é estendê-la a `summary`/
`description` e trazer um editor ao frontend — `mesas` tem `RichTextArea.tsx` e
`MarkdownEditor.tsx` prontos, mas em `apps/mesas`, não em `packages/ui`.

Decisões do mantenedor (2026-07-27):

- **`summary` e `description` ficam ricos**, mas card do catálogo e meta description consomem
  versão **sem tags** — HTML vazando em snippet de busca ou em card é regressão de SEO e de
  layout, não recurso.
- **O editor é extraído para `packages/ui`**, em vez de duplicado no downloads. Isso torna
  `mesas` consumidor de um componente compartilhado e **exige aprovação própria + verificação
  de impacto** (`AGENTS.md` §Autorização), fora do que a abertura desta spec cobre.

### Defeito 11 — edição de material não cobre sistema nem capa

Achado pelo mantenedor em `/painel/materiais`. Verificação no código refina o relato:

- **Título É editável** — `EditarMaterialPage.tsx:111` tem o input, e a lista tem o link
  "Editar" (`MeusMateriaisPage.tsx:42`). Este ponto não é defeito.
- **Sistema não é editável** — nenhum campo de sistema na página de edição. O autor não tem
  como corrigir nem informar o sistema do próprio material, o que agrava o defeito 1: mesmo
  onde o parser falhar, não há caminho manual de correção.
- **Capa não é editável** — nenhum campo de imagem. O backend **já tem a infraestrutura**
  (`storage/cloudinaryAdapter.ts`, e `cover_image_url` na metadata), sem UI que a use.
- **Sem orientação ao usuário** — o formulário não informa formato, dimensão recomendada nem
  limite de tamanho para a capa.

Regra de produto aplicável (`AGENTS.md`): upload e processamento de imagem ocorrem sempre no
backend, via Cloudinary com signed preset, e nunca com credencial hardcoded. A infraestrutura
existente já segue isso.

### Defeito 12 — nav expõe "Início" e "Catálogo" em vez de "Catálogo" e "Perfil"

Achado pelo mantenedor. `AppShell.tsx:18-19` define a nav como `Início` (`/`) e `Catálogo`
(`/catalogo`).

**O defeito confirmado é a duplicação, não a ausência de "Perfil".** `App.tsx:51` e `:53`
renderizam **a mesma** `CatalogoPage` nos dois destinos: dois rótulos, uma página.

**Correção da versão anterior (3ª revisão do Codex, 2026-07-27).** Esta seção dizia que o
esperado era `Catálogo` e `Perfil`, e que `PerfilPage.tsx` já era "o destino pronto". Verificado
em código, não serve:

- `PerfilPage.tsx:7-19` mostra **apenas nome e e-mail vindos do SSO, somente leitura**. Não é
  perfil público de criador: não tem slug, bio nem página pública. O comentário do próprio
  arquivo (`:4-6`) já registrava isso — "edição de perfil público de criador fica em spec futura
  se vier a ser pedida (não há rota de escrita em `download_creator` hoje)".
- O Header já oferece **quatro** caminhos de conta: `Entrar` para anônimo, `Perfil Artifício`
  no `accounts.`, `Conta Downloads` (`AppShell.tsx:93`) e `Painel` (`:11`). A sidebar do painel
  tem um quinto, "Perfil" (`PainelShell.tsx:9`).

Acrescentar "Perfil" à nav criaria um sexto caminho, apontando para uma página que promete menos
do que o rótulo. **Decisão do mantenedor (2026-07-27):** remover o "Início" duplicado, manter
"Catálogo", não acrescentar "Perfil". O que "perfil de criador" significa neste produto vira
decisão própria (T9.2), não um rótulo pendurado na página errada.

### Defeito 13 — painel do autor não cobre a API disponível (falta onboarding)

Pedido do mantenedor: o fluxo de criar e editar material precisa de onboarding robusto, que dê
saída ou consuma todas as APIs aplicáveis.

Medição do alcance (2026-07-27): o backend tem **74 rotas em 21 routers montados**; o painel tem
11 rotas e 9 destinos na navegação lateral (`PainelShell.tsx:5-15`).

**Correção da versão anterior (3ª revisão do Codex, 2026-07-27).** A tabela anterior listava
seis domínios como "sem tela no painel" e concluía que faltavam seis telas. **Inferência falsa
por contagem de rotas:** todos os seis têm alguma superfície, e rota é contrato técnico, não
promessa de tela. Comparar 74 rotas com 11 páginas não mede lacuna. A lacuna real existe, mas
varia por **ator**:

| Domínio | Superfície que já existe | Lacuna real |
|---|---|---|
| `ratings` | avaliação na ficha pública | autor não acompanha média nem quantidade no painel |
| `comments` | lista e formulário na ficha | sem identidade, thread, caixa de entrada, resposta ou moderação visual |
| `creators` | página pública + leitura de papel | perfil local não edita o perfil público; API só lê |
| `destinations` | `/ir/:id`, redirecionamento fail-closed | infraestrutura — **não precisa de tela própria** |
| `systemSuggestions` | gestão administrativa completa (`GestaoSugestoesSistemaPage.tsx`, admin) | usuário comum não sugere nem acompanha `/mine` pela UI |
| `downloads` | registro integrado ao destino + `/obter/:fileId` | evento técnico não precisa de tela; falta métrica ao autor |

Somam-se a isso os campos ausentes no formulário de edição (defeito 11: sistema, capa). O quadro
correto não é "seis telas faltando" — é **o autor sem caminho de UI para acompanhar o que
publicou**, mais dois domínios cuja ausência de tela é decisão legítima.

**Três lacunas adicionais, confirmadas em código (2026-07-27), todas entrando na correção por
decisão do mantenedor:**

1. **Dashboard omite os estados acionáveis.** `VisaoGeralPage.tsx:9-11` conta apenas
   `published`, `in_review` e `draft`. `rejected` e `withdrawn` — os dois que exigem ação do
   autor — só aparecem na lista, sem contador nem motivo visível. Material publicado tampouco
   ganha ação de ver no catálogo.
2. **Sugestão de sistema é privilégio de admin.** `App.tsx:86` restringe
   `/gestao/sugestoes-sistema` a admin. O usuário que não acha o próprio sistema não tem como
   sugerir nem acompanhar, embora a API exponha `/mine`.
3. **Autor não vê o retorno.** Nenhuma tela de painel mostra avaliações, comentários recebidos
   ou downloads dos próprios materiais. Notificações cobrem aprovação e rejeição, não
   comentário.

### Defeito 17 — código promete fluxo de denúncia de comentário que não existe

Achado da revisão do Codex (Fase 9), confirmado em código.

`comments.ts:58` documenta a decisão como "retirada só por denúncia/moderação, nunca
autoexclusão livre". Mas `download_report` referencia **apenas `material_id`**
(`migration_005_download_report.sql:11`) — não existe `comment_id` —, e não há UI para criar
denúncia em lugar nenhum do frontend. O endpoint direto de remoção existe e funciona
(`comments.ts:61`, restrito a moderador e admin); o fluxo de denúncia alegado, não.

É divergência entre comentário e código: o comentário descreve um desenho que nunca foi
modelado. Resolver de verdade significa **ou** modelar denúncia de comentário (migration mais
UI) **ou** corrigir o comentário para descrever o que o código faz — preservando a decisão que
ele registra, não apagando (`AGENTS.md` §Regras Gerais de Código).

**Isto não é correção de bug — é desenho de produto.** Exige mapear o fluxo do autor
(publicar → enriquecer → acompanhar), decidir o que entra no onboarding e o que fica no painel,
e só então implementar. O escopo é maior que o de todos os defeitos anteriores somados.

### Defeito 14 — permissões existem no backend, sem UI que as exerça

Achado pelo mantenedor. **Verificado no código, e o backend já faz o esperado:**

| Regra | Onde | Estado |
|---|---|---|
| Autor edita o próprio material | `materials.ts:637` (`isOwner`) | ✅ implementado |
| Moderador/admin edita qualquer material | `materials.ts:638` (`canEditAny`) | ✅ implementado |
| Moderador/admin retira comentário | `comments.ts:63` (`requireRole`) | ✅ implementado |

O que **não** existe:

- **Autor não vê nem responde comentários no próprio material** — não há tela que liste
  comentários recebidos, e não há `parent_id` para responder (defeito 7b).
- **Nenhuma distinção visual de papel no comentário** — autor do material, moderador e admin
  aparecem iguais a qualquer usuário. A API sequer devolve identidade (defeito 7), então não há
  o que distinguir hoje.
- **Admin não tem UI para editar material alheio nem moderar comentário**, apesar de as rotas
  aceitarem.

O trabalho aqui é de interface e de contrato de leitura (devolver papel junto do comentário),
não de autorização — essa parte está pronta e correta.

### Defeito 15 — sem OG por material: todo compartilhamento mostra imagem genérica

Achado pelo mantenedor, a partir de aviso do Facebook sobre `og:image` indisponível.

**Correção da versão anterior (3ª revisão do Codex, 2026-07-27).** Esta seção afirmava que "a
recomendação do aviso já está atendida na tag estática" porque `index.html:14-15` declara
`width` e `height`. **Falso.** O arquivo `og-default.png` apontado por `index.html:13` e `:22`
**nunca existiu no repositório**: `apps/downloads/frontend` não tem diretório `public/`, e o
nome não aparece em lugar nenhum da árvore. Dimensão declarada sobre imagem inexistente não
atende aviso nenhum — o aviso do Facebook tem **duas** causas simultâneas, OG genérico e asset
indisponível, e a segunda passou despercebida. Vale para material sem capa também, que cairia
nesse mesmo fallback quebrado.

O problema principal, esse, está confirmado e é maior:

`MaterialPage.tsx` **não define OG nenhum**, e o downloads é **SPA pura, sem SSR nem
prerender**. Consequência: todo material compartilhado em Facebook, WhatsApp, Discord ou
Telegram exibe a imagem genérica do site e o título do site — nunca a capa nem o nome do
material. O crawler recebe o `index.html` estático, porque não há HTML por rota.

É regressão de SEO e de alcance social por desenho, não por bug pontual: nenhuma correção de
tag resolve sem uma estratégia de renderização (SSR, prerender de rotas, ou rota de OG no
backend). Colide com a regra pétrea de SEO do projeto.

**Evidência material** — resposta ao User-Agent do crawler do Facebook em
`https://downloadsbeta.artificiorpg.com/materiais/red-sand-warriors-dominus-rpg`
(2026-07-27):

```
<title>Artifício Downloads — Materiais gratuitos de RPG em português</title>
<meta property="og:title" content="Artifício Downloads — Materiais gratuitos de RPG em português" />
<meta property="og:image" content="https://downloads.artificiorpg.com/og-default.png" />
```

Título do site em vez do material; imagem genérica em vez da capa.

**Não é artefato de beta.** A URL da imagem é absoluta e aponta para `downloads.artificiorpg.com`
(produção) mesmo servida a partir de beta — o mesmo `index.html` estático vai para prod, e o
comportamento lá será idêntico. Por isso este defeito conta para o cutover, apesar de ter sido
observado em beta.

### Defeito 16 — contrato de hint permite omissão silenciosa

Achado da revisão do Codex (Fase 0). `scrapers/types.ts:25` declara `systemHint?` e
`materialTypeHint?` como **opcionais**. Um adapter pode omitir os dois e compilar — que é
exatamente como os três chegaram ao estado do defeito 1 sem nenhum erro de tipo.

Os requisitos 1-6 exigem `null` explícito onde a fonte não expõe o dado, mas o tipo não obriga
a nada. Sem mudar o contrato, "esqueci de extrair" e "a fonte não tem" ficam indistinguíveis.

## Requisitos (numerados, testáveis)

1. `operaRpgScraper` extrai `systemHint` do HTML da fonte quando ele existir; ausente, retorna `null` explícito.
2. `itchIoScraper` extrai `systemHint` quando o DOM real expuser sistema; não expondo, registra a constatação e retorna `null`.
3. `grimoriosEDadosScraper` extrai `systemHint` quando o DOM real expuser sistema; não expondo, registra a constatação e retorna `null`.
4. `operaRpgScraper` extrai `materialTypeHint` do HTML da fonte quando ele existir.
5. `itchIoScraper` extrai `materialTypeHint` quando o DOM real expuser tipo.
6. `grimoriosEDadosScraper` extrai `materialTypeHint` quando o DOM real expuser tipo.
7. Todo `systemHint`/`materialTypeHint` extraído vem de estrutura **observada em DOM real**, nunca de suposição sobre o HTML (mesma trava do requisito 43 da spec 088).
7a. Um sinal só vira hint quando é **inequívoco**, nesta ordem: campo estruturado explícito; tag inequivocamente de sistema ou tipo; seção de origem comprovadamente homogênea. Múltiplos candidatos ou dúvida resultam em `null`; título e descrição nunca viram heurística aberta. `null` é resultado correto — hint inventado, não.
7b. Seção de origem heterogênea **não** recebe tipo global. No OPERA, `/aventuras` e `/cenarios` são homogêneas, mas `/regras/`, `/personagens` e `/outros` reúnem naturezas diferentes: descem à subseção ou ficam `null`.
7c. `sourceCategory`, `tags` e `materialTypeHint` são campos distintos e não viram sinônimos. O alvo válido é só a taxonomia do catálogo (`016_catalog_material_types_seed.sql`): Aventura, Suplemento, Cenário, Ficha, Mapa, Regras, Não classificado.
7d. As rotas de seção do OPERA são validadas contra o site real antes da extração. Rota morta significa seção nunca coletada — e o OPERA é 118 dos 141 materiais.
7e. `Multi-sistema` é um sistema válido da taxonomia e pode ocupar `systemHint`; não significa ausência de sistema. Decisão do mantenedor em 2026-07-27. Na origem OPERA, item explicitamente multi-sistema recebe esse hint; os demais recebem `OPERA RPG` quando a origem sustenta compatibilidade.
8. `detectPortuguese` decide com confiança sobre os textos do `itch_io`, ou a causa da indecisão é identificada e corrigida.
9. A evidência da detecção de idioma é persistida no material criado pelo scraper (`detected_language`, `language_confident`, `language_checked_at` — colunas já existentes), hoje gravada só no log do item. `download_material_metadata.language` **continua `'pt'`**: aceita exclusivamente esse valor por regra pétrea D119 (`CHECK` na migration 022), e é a marca do catálogo, não o resultado da detecção.
10. Existe **política exaustiva por semântica** dos campos de `ScrapedItem` — `plainText`, `url`, `richHtml`, `opaque` — de modo que campo novo **quebre a compilação** até ser classificado (via `satisfies Record<keyof ScrapedItem, Policy>` ou equivalente). Só `plainText` é decodificado.
10a. `sourceUrl` e `coverImageUrl` **não** passam por decode; `descriptionHtml` passa **só** por DOMPurify.
10b. A decodificação usa decoder HTML5 completo (`html-entities`), não a tabela local de 5 entidades.
10c. A decodificação ocorre **exatamente uma vez**, na saída do parser — nenhuma segunda passagem no ingest ou no `/ingest` (`routes/scraper.ts:147`).
11. `slugify` recebe título já decodificado, de modo que nenhum slug novo contenha resíduo de entidade.
11a. O texto chega normalizado **antes** de idioma, slug e resolução de taxonomia (`scraperIngest.ts:228, 260, 264, 268`) — ordem verificada por teste, não só por valor final persistido.
12. ~~Corrigir os materiais de beta já gravados~~ — **descartado por decisão do mantenedor (2026-07-27)**: a Fase 5 trunca e recoleta o acervo inteiro com o parser já corrigido. Corrigir antes seria trabalho descartado, e mexer em slug publicado colide com a regra pétrea de SEO.
13. Editora tem **chave normalizada de comparação** separada do nome de exibição: `publisher_name` preserva o nome oficial; a chave (coluna própria, com índice) governa comparação e URL, sob política explícita — Unicode, caixa, espaço, pontuação, `&`/`e`, sufixos societários. Sem essa separação, "Grimórios & Dados Editora" e "Grimorios e Dados" nunca casam. **Sem `decode`**: a Fase 1 já decodificou, e texto digitado não é HTML.
13a. A normalização é uma função só, aplicada nas **duas** fronteiras de escrita — scraper (`scraperIngest.ts:324`) e formulário/API (`materialMetadata.ts:118`). Normalizar só uma deixa o acervo divergente conforme a origem.
13b. Autores e artistas passam a ser **campos estruturados** com múltiplos valores, não o blob `credits` que `combineCredits` (`scraperIngest.ts:48`) produz juntando os dois com `\n`. Sem isso, "filtro por autor" faria artista virar autor e filtraria a combinação inteira. Decisão do mantenedor (2026-07-27).
14. O catálogo aceita filtro **exato pela chave** por editora e por autor, além dos filtros já existentes. Nunca `ILIKE '%valor%'` — isso é busca textual, não faceta.
14a. `/facets` devolve editora e autor com valor, rótulo e contagem — hoje expõe só tipos, sistemas e edições. É onde a unificação de grafias se torna observável. Decisão do mantenedor: facetas reais, não apenas links contextuais.
14b. O OpenAPI gerado documenta **todos** os query params de `GET /materials`, atuais e novos, com limites e semântica. Hoje não documenta nenhum, e mantém contrato antigo do `POST`. A correção vai no gerador (`scripts/api/`), não no artefato.
14c. O filtro tem índice na chave normalizada — com o acervo crescendo, comparação normalizada sem índice vira scan.
15. Editora, autor e sistema são clicáveis no card e levam ao catálogo filtrado por aquele valor. O link não pode colidir com o link estendido do título, precisa ser alcançável por teclado, e leva a recorte limpo (página 1, sem herdar filtro oculto do contexto).
15a. Filtros **não são indexáveis**; materiais individuais são. Links reais tornam combinações de filtro descobertas pelo crawler — espaço quase infinito. Exige `robots.txt` versionado, que hoje **não existe** (o nginx o espera em `nginx.conf:40` e devolve 404).
16. O rótulo "Em português" é removido do card (o acervo é em português por premissa; o filtro de idioma garante, a interface não anuncia).
17. O prefixo do label de editora não duplica a palavra quando o nome da fonte já a contém.
18. `GET /comments/:materialId` devolve nome e avatar do autor, obtidos do `accounts.` (SSO) a partir do `user_id`.
19. Indisponibilidade do `accounts.` **não derruba a listagem de comentários** — o comentário aparece com identidade degradada, nunca erro.
20. A caixa de comentários exibe o autor (nome e avatar) de cada comentário.
21. Comentário pode responder outro comentário, com `parent_id` persistido e profundidade limitada.
22. A interface exibe a hierarquia de resposta de forma legível, sem aninhamento infinito.
23. Slug de material novo é derivado do título automaticamente, sem campo visível ao usuário no formulário.
24. `<select>` e `<option>` são legíveis nos temas claro **e** escuro, com contraste conforme a meta de acessibilidade do projeto.
25. O conteúdo rico vive em `description_html` (já sanitizado na escrita e na leitura); `summary` e `description` permanecem **texto plano**, derivados do rico pelo backend na mesma operação. Aceitar HTML neles vazaria tag para a detecção de idioma (`moderation.ts:47`), o card (`MaterialCard.tsx:100`), a página do criador (`CreatorPage.tsx:46`) e integrações. Correção da versão anterior deste requisito, que mandava o oposto.
25a. Os três campos de conteúdo têm limite de tamanho **no backend** — hoje o `PATCH` não tem teto (`materials.ts:51`), e conteúdo rico sem limite incha histórico e custo de sanitização. Contador visual no formulário não substitui validação no schema.
25b. O slug tem limite **único** entre API e banco. Hoje a API aceita 200 (`materials.ts:90`) e o banco 160 (`migration_001:13`): entrada entre 161 e 200 estoura. Slug é gerado só na criação — editar título não muda URL publicada (SEO).
26. Card do catálogo e meta description consomem `summary` **sem tags** — nenhuma tag HTML chega a snippet de busca ou a layout de card.
27. O destino do editor rico é **decidido antes de implementado**, não pressuposto. O `downloads` já tem editor TipTap/HTML em produção (`RichTextEditor.tsx:71`) e o `mesas` usa Markdown (`MarkdownEditor.tsx`) — dois formatos incompatíveis, e unificar muda contrato **persistido**, não só componente. Pôr TipTap em `packages/ui` afeta o bundle de **todos** os consumidores; a alternativa é pacote dedicado. Requisito reescrito: a versão anterior já dava a resposta ("vive em `packages/ui`") sem a decisão ter sido tomada.
27a. O `mesas` sanitiza rich text **na escrita**, antes desta spec tocar conteúdo rico. Hoje o preview renderiza `markdown-it` com `html: true` sem sanitizar (`MarkdownEditor.tsx:15`, 6 telas) e o backend não sanitiza — violação corrente da regra pétrea. Não é XSS ativo (nenhuma tela pública renderiza como HTML), mas passa a ser no momento em que esta fase renderizar conteúdo rico. **A correção vive na spec 090** (`Fase 7`, decisão do mantenedor de 2026-07-27, revista no mesmo dia): a 090 já é a spec que trata conteúdo de usuário e sanitização (requisito 10), e o `mesas` é consumidor dela — corrigir lá evita duas frentes tocando o mesmo arquivo. Esta fase **depende** de a correção estar fechada; não presume.
28. O autor edita o sistema do próprio material em `/painel/materiais/:id/editar`, com seleção contra o catálogo central.
29. O autor envia e substitui a capa do próprio material, via backend com signed preset do Cloudinary (nunca credencial no frontend). A infra citada na versão anterior **não serve**: `storage/cloudinaryAdapter.ts` gerencia arquivo raw/PDF (`resourceType: 'raw'`), e `@artificio/media` não recebe `upload_preset` (`packages/media/src/index.ts:65`). Hoje o metadata aceita qualquer URL HTTP (`materialMetadata.ts:33`).
29a. O upload valida extensão, MIME **e assinatura real do arquivo**, além de dimensão e tamanho — `Content-Type` sozinho não basta. Falha de banco após upload bem-sucedido faz rollback do ativo.
29b. Capa persiste `public_id` e provedor **separados** da URL. Sem identidade do ativo não há como saber se ele pertence ao projeto, e a remoção da capa anterior não é segura. Exige migration.
30. O formulário de capa informa formato aceito, dimensão recomendada e limite de tamanho antes do envio.
31. A nav principal expõe **um rótulo por destino**: sai o `Início` duplicado, fica `Catálogo`. Hoje `AppShell.tsx:18-19` oferece os dois apontando para a mesma `CatalogoPage` (`App.tsx:51` e `:53`). **Não** ganha `Perfil`: o Header já tem quatro caminhos de conta e a sidebar do painel um quinto, e `PerfilPage.tsx:7-19` é só nome e e-mail do SSO, somente leitura — não o perfil público de criador que o rótulo sugeriria.
31a. O significado de "perfil de criador" neste produto é **decidido**, não presumido: `download_creator` tem slug, bio e página pública, mas a API de criadores só lê. Decidir que o autor não edita o próprio perfil público é saída legítima, desde que registrada.
32. O autor vê, no painel, os comentários recebidos nos próprios materiais.
33. O autor responde comentário recebido a partir do painel.
34. Comentário exibe o papel do autor quando aplicável — autor do material, moderador ou admin —, sem rotular usuário comum.
35. Moderador e admin exercem pela UI as permissões que o backend já concede: editar material alheio e retirar comentário.
36. Toda rota de material publicado serve o `<head>` do **próprio material** — não o genérico do site — no **HTML fonte**, igual para crawler e para humano. A arquitetura é **shell HTML dinâmico no origin** (decisão do mantenedor, 2026-07-27): o backend renderiza somente o `<head>`, o corpo continua `<div id="root"></div>` com os bundles Vite, e a SPA monta normalmente. Não é SSR de React, não é prerender, não varia por User-Agent e não passa por edge function — as quatro foram avaliadas e descartadas (justificativa na Fase 8 de `tasks.md`).
36a. O `<head>` traz o contrato completo, **exatamente uma ocorrência de cada tag singular**: `<title>`, `meta[name=description]`, canonical absoluto autorreferente, `og:type`, `og:title`, `og:description`, `og:url`, `og:image`, `og:image:alt`, `og:site_name`, `og:locale`, e Twitter card/title/description/image. O OGP define `og:type` e `og:url` como básicos junto com title e image — a versão anterior deste requisito exigia só três e esquecia os dois. O canonical vive no HTML fonte, sem JavaScript alterá-lo depois.
36b. `og:image:width` e `og:image:height` são declarados **apenas quando o valor é real**. A API devolve só `cover_image_url` (`db/types.ts:120`), sem largura, altura ou MIME, e capa real é externa (`img.itch.zone`) — declarar 1200×630 para qualquer capa seria inventar dado. O fallback próprio sempre declara; capa de dimensão desconhecida omite. `og:image:alt` sempre presente. OGP trata width/height como opcionais e recomenda alt.
36c. Todo valor vindo do banco é escapado para contexto HTML antes de entrar no `<head>`: título com `"`, `<` ou `&` não fecha o `content=""` nem abre tag nova. A descrição OG é **texto plano** derivado de `summary`, com limite e fallback explícitos, nunca HTML rico — coerente com o requisito 25.
36d. O status HTTP corresponde ao caso: material publicado 200; slug inexistente **404 real**; material em rascunho, rejeitado ou retirado 404, porque OG não pode vazar conteúdo não publicado; banco indisponível **503 com `Retry-After`**, nunca 404 cacheável; erro responde `noindex` sem metadata privada; `HEAD` coerente com `GET`.
36e. **Beta não é rastreado** (decisão do mantenedor, 2026-07-27): beta não precisa de OG por material funcionando, prod precisa. O renderer emite `noindex,nofollow` em beta, e um `robots.txt` bloqueando indexação é versionado — `nginx.conf:40` já tenta servi-lo, mas o arquivo não existe no repositório. `plan.md:217` afirmava que beta já era `noindex`: falso, nenhum código emitia meta robots nem `X-Robots-Tag`.
36f. Slug inexistente em `/materiais/:slug` devolve 404 real, não soft 404. Hoje `nginx.conf:47` devolve 200 `index.html` para qualquer caminho e `App.tsx:89` redireciona `*` para `/`; o Google manda devolver 404/410 real para conteúdo inexistente. As demais rotas inválidas ficam como débito registrado nesta spec.
36g. O shell tem política de cache declarada: sem `Vary: User-Agent`, cache curto ou invalidação por material, `ETag`/`Last-Modified` coerentes, edição publicada refletida dentro da janela declarada, e erro do renderer nunca cacheado como HTML falso.
36h. Existe sitemap dos materiais publicados, referenciado no `robots.txt` de produção e ausente em beta. Hoje não existe nenhum — a descoberta depende só de link interno.
37. A capa do material é a `og:image` quando existir; sem capa, cai na imagem padrão do site. **A imagem padrão precisa existir primeiro:** `og-default.png` é referenciado por `index.html:13` e `:22` mas nunca foi versionado, e `apps/downloads/frontend` não tem `public/`. Enquanto faltar, material sem capa cai num 404 e nenhuma correção de tag resolve o aviso do Facebook.
38. Existe uma **matriz ator → necessidade → rota → superfície atual → decisão** cobrindo os domínios de API, e cada linha tem decisão nomeada pelo mantenedor. Substitui a comparação "74 rotas × 11 páginas", que não mede lacuna — rota é contrato técnico, não promessa de tela. "Nenhuma tela" é saída legítima para infraestrutura (`destinations` já roda em `/ir/:id`; `downloads` é evento técnico), desde que registrada.
38a. O usuário comum sugere sistema faltante e acompanha as próprias sugestões pela UI. Hoje `systemSuggestions` só existe em `/gestao/sugestoes-sistema`, restrito a admin (`App.tsx:86`), embora a API exponha `/mine`.
38b. O dashboard do autor mostra os **cinco** estados editoriais, não três: `VisaoGeralPage.tsx:9-11` conta só `published`, `in_review` e `draft`, deixando de fora `rejected` e `withdrawn` — justamente os acionáveis. Material rejeitado exibe o motivo; material publicado oferece ação de ver no catálogo.
38c. O autor acompanha, no painel, avaliações, comentários recebidos e downloads dos próprios materiais. Hoje nenhuma tela mostra isso, e as notificações cobrem aprovação e rejeição, não comentário.
38d. Código e comentário concordam sobre a remoção de comentário: ou a denúncia de comentário é modelada (`download_report` hoje só referencia `material_id`, `migration_005:11`, e não há UI de denúncia), ou o comentário de `comments.ts:58` passa a descrever o que o código faz de fato — preservando a decisão registrada, não apagando.
39. O fluxo do autor é guiado por **checklist por material derivado dos dados reais**, não por tour modal nem wizard rígido: o fluxo é interrompível e não linear, e o autor sai e retoma sem perder progresso. Cobre criação curta (título e tipo, slug automático), enriquecimento (descrição e créditos, sistema, capa, destino), prévia, envio para revisão, e pós-publicação com link público, comentários, avaliações e downloads. Estado persistente inclui rejeitado **com motivo**.
39a. A validação de usabilidade é por **cenário executado**, não por checklist conferido: primeira publicação, abandonar e retomar, corrigir rejeição, acompanhar publicação, moderar comentário. Cada achado registra evidência, heurística, severidade e correção. Acessibilidade verificada junto (WCAG 2.2): navegação só por teclado, foco visível e não encoberto, erro associado ao campo e descrito em texto, mudança de estado anunciada. Eficácia, eficiência e satisfação medidas (ISO 9241-11).
40. Cada fonte tem endpoint validado quanto à **elegibilidade semântica**: devolve material de RPG de mesa, não videogame nem outro tipo de projeto.
40a. Fonte parcial aplica corte conservador **por produto**: itch.io exige `Category=Physical game` e `Genre=Role Playing` ou tag inequívoca `ttrpg`/`rpg-de-mesa`. Card game, board game, wargame ou produto sem sinal inequívoco não entra; título e descrição não servem de chute.
41. O `itch_io` coleta de `https://itch.io/physical-games/genre-rpg/lang-pt-BR`, rota verificada em DOM real antes da troca.
42. Material cuja página está em inglês **não entra**, mesmo com tradução portuguesa declarada pela fonte (decisão do mantenedor sobre o defeito 3b).
43. Nenhuma fonte confia em filtro de URL como prova de idioma: o texto real é verificado, sem bypass por `sourceLanguageHint`. Sinal da fonte **nunca aprova, só pode rejeitar** — vale para todos os caminhos (adapter, `<html lang>` do parser genérico, e `/ingest` direto), não só o `itch_io`.
43a. O código de idioma é **ISO 639-3** em todo o pipeline de detecção e log. Hoje `franc-min` devolve 639-3 (`por`) e o desempate DeepSeek devolve 639-1 (`pt`) — a mesma língua grava com dois códigos.
43b. O log do item registra **método e motivo** da decisão de idioma (sinal negativo da fonte, franc, heurística de texto curto, desempate externo, baixa confiança ou indisponibilidade), não só o veredito.
43c. A qualidade do detector é medida contra **corpus rotulado à mão** do endpoint correto, com matriz de confusão, otimizando **precisão**: zero falso positivo (material não-português aprovado). Falso negativo é aceitável — vai para revisão manual.
44. `systemHint` e `materialTypeHint` deixam de ser opcionais no contrato **interno** (`string | null` obrigatórios) — omitir passa a ser erro de tipo, não silêncio (requisito derivado do defeito 16). Entrada externa (`/ingest`) pode seguir opcional, normalizada com `?? null` na fronteira. Teste contratual **não** substitui o contrato: decisão do mantenedor (2026-07-27).
44a. O fallback de catálogo `MATERIAL_TYPES_ROLLOUT_FALLBACK` (`catalogClient.ts:107`) deixa de ser incompatível com o pipeline: hoje tem só `aventura`, e sem `nao-classificado` o ingest aborta quando o catálogo responde 404. Ou inclui o tipo neutro, ou é removido — o rollout isolado que o motivou já terminou.
45. Fixture de parser é artefato versionado com proveniência: URL, data, status HTTP, modo de aquisição e hash — não trecho inline.
46. Cada fonte tem fixture do **template real que ela consome**, não "uma página de produto" genérica.

## Critérios de aceite

Medidos no banco de beta, após recoleta completa das três fontes acessíveis:

> **Critérios reescritos após a revisão do Codex (2026-07-27).** Os anteriores eram absolutos
> herdados de um corpus **inválido**: 141 itens que incluíam 14 videogames do endpoint errado.
> A Fase 0 troca esse endpoint e corrige as rotas do OPERA — tamanho e composição mudam, e
> comparar contra `90/23` reprovaria melhoria ou aprovaria regressão. Além disso, os limiares
> `> 0` e `> 1` não provavam o que afirmavam: um item basta para satisfazer três fontes.

- **Taxas por fonte e por template**, contra limites declarados **antes** da medição, derivados da matriz T0 e das fixtures — nunca de números históricos. Por fonte: encontrados, criados, rejeitados, sistema casado, sistema bruto, tipo casado, tipo bruto, neutros, e os percentuais.
- **Regra crítica que falha reprova o conjunto** — não há aprovação por agregado favorável.
- **Cobertura de sistema e tipo por template**, não contagem global: cada template da matriz T0 que T0.2 declarou expor o campo produz casamento; template que não expõe produz `null` — e isso é o resultado correto.
- **`nao-classificado` é minoria**, medido como percentual do acervo, não como "existe mais de um tipo distinto" (140 neutros e 1 classificado satisfariam o critério antigo).
- **Nenhuma entidade crua nos campos `plainText`** definidos pela política da Fase 1 — incluindo arrays e JSON (`scenario`, `tags`, `file_size_text`, `source_category`, `source_filters`), não apenas cinco campos. Excluídos URLs e `description_html`, onde entidade pode ser HTML legítimo. Cobrir as três formas — nomeada, decimal e hexadecimal: `&(#[0-9]+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);`
- **Slug conferido contra o esperado das fixtures** que continham entidade. A regex `slug ~ '-[0-9]{3}-'` do critério anterior é falso positivo: reprovaria "Edição 100 do..." — título legítimo.
- **Idioma: zero falso positivo no corpus rotulado** (T2.7), e as decisões persistidas em beta conferidas item a item contra esse ground truth. O critério anterior — "barrar pelo menos 1 dos 14" — contradizia a própria T2.7, que o rejeita como medida fraca, e se referia a itens do endpoint errado.
- **Crédito e editora medidos por taxa**, com o limite declarado antes da recoleta. Os absolutos `90/23` deixam de ser referência.

Verificados na interface do catálogo de beta, com o acervo recoletado:

- **Clicar na editora de um card filtra o catálogo por aquela editora**; idem autor e sistema.
- **Duas grafias equivalentes da mesma editora produzem uma faceta só** (efeito da normalização).
- **Nenhum card exibe rótulo de idioma.**
- **Nenhum card exibe "Editora Editora"** ou duplicação equivalente no label.
- **Formulário de novo material não exibe campo de slug**, e o material criado recebe slug derivado do título.
- **`<select>` de tipo de material legível nos dois temas** — verificado no tema escuro, que é onde o defeito aparece.
- **Nav principal exibe só `Catálogo`**: sai o `Início` duplicado e não entra `Perfil`, que já tem caminho próprio no painel e não representa perfil público de criador.
- **O autor vê e responde, pelo painel, comentário recebido no próprio material.**
- **Comentário de autor do material, moderador ou admin exibe o papel**; usuário comum não recebe rótulo.
- **Admin edita material alheio e retira comentário pela UI**, sem chamada manual à API.
- **`GET /og-default.png` devolve 200 com `Content-Type: image/*`** e dimensão física igual à declarada, em beta e em prod. É pré-condição de tudo o mais: hoje o arquivo não existe.
- **`curl -A "facebookexternalhit/1.1" <url-de-material>` devolve `og:title` e `og:image` do material**, não do site. É a mesma verificação que expôs o defeito 15.
- **Requisição normal e `facebookexternalhit` recebem o mesmo `<head>`.** A leitura é do **HTML bruto**, nunca do DOM depois do JavaScript — o DOM esconderia justamente o defeito que a fase corrige.
- **Material com capa usa a capa como `og:image`**; material sem capa cai na imagem padrão.
- **Capa sem dimensão conhecida omite `width`/`height`** em vez de declarar valor inventado; `og:image:alt` presente nos três casos.
- **Título com `"`, `<` e `&` não quebra o `<head>`** nem cria tag nova.
- **Slug inexistente devolve 404 real**; material em rascunho, rejeitado ou retirado devolve 404; banco fora devolve 503 com `Retry-After`. Nenhum deles devolve shell genérico com 200.
- **Beta responde `noindex,nofollow` e serve `robots.txt`**; prod não emite `noindex` e serve sitemap dos materiais publicados.
- **Canonical e `og:url` corretos em beta e em prod**, com exatamente uma ocorrência de cada tag singular.
- **Edição de título, resumo ou capa aparece no preview** dentro da janela da política de cache declarada.
- **A SPA continua montando e navegando** depois da mudança — o corpo servido é idêntico ao do estático.

## Fora de escopo

- **DriveThruRPG e DMs Guild** — bloqueio de acesso (403) documentado em T2.3a da spec 088. Nenhum número desta spec depende dessas duas fontes.
- **Edição e exclusão de comentário pelo autor** — a retirada segue por denúncia/moderação (D111 item 6). Threads não mudam essa regra.
- **Notificação de resposta** (e-mail ou in-app) — fora do escopo; a spec entrega a thread, não o aviso.
- **Página pública de perfil de usuário** — exibir nome/avatar no comentário não implica criar perfil navegável.
- **Reescrita do `scoreSystemCandidates`** (fuzzy/pontuado) — segue reservado à triagem admin por decisão anterior do mantenedor.
- **Remoção do tipo neutro `nao-classificado`** — decisão do mantenedor (2026-07-27): permanece como rede de segurança.
- **Escrita no catálogo central pelo ingest** — continua exclusiva da triagem admin (requisitos 48/56 da spec 088).
- **Promoção da spec 088 para produção** — bloqueada até esta spec fechar.

## Riscos e impacto em outros módulos

- **Slug é URL pública permanente.** Corrigir slug de material já publicado exige redirect 301 (regra pétrea de SEO). Em beta não há SEO a preservar; em prod, o acervo nasce vazio, então a correção precisa entrar **antes** do cutover.
- **`packages/catalog-matching` e `packages/catalog-client`** são lidos por esta spec, não alterados. Alteração neles ampliaria o escopo para outros consumidores e exigiria aprovação própria.
- **Dependência de deploy do site.** O downloads lê a taxonomia via `GET /api/catalog/v1/material-types` do site. Se o site responder 404, o downloads cai em `MATERIAL_TYPES_ROLLOUT_FALLBACK`, que contém apenas `aventura` — foi essa a causa do primeiro `catalog_material_type_not_found` em 2026-07-27, resolvido deployando o site beta. **O mesmo risco existe em produção** e precisa de ordem de deploy explícita: site antes de downloads.
- **O teste esconde o defeito.** `scraperIngest.test.ts:85` mocka o catálogo com `nao-classificado` presente, então passa verde enquanto o runtime quebra por ausência do tipo. Qualquer correção precisa de teste que exercite o caminho real, não o mock permissivo.
- **Dependência nova do `accounts.` para exibir comentário.** Hoje a listagem não depende de serviço externo; passar a depender cria acoplamento em rota pública. Daí o requisito 19: indisponibilidade degrada a identidade, nunca derruba a lista. Vale considerar cache, pelo mesmo motivo que `catalogClient` cacheia a taxonomia por 60s.
- **Migration nova para `parent_id`** (threads). Primeira desta spec — as demais correções não tocam schema. Segue o checklist pétreo de migrations (header de 5 campos, idempotência, diretório allowlisted).
- **`packages/ui` pode entrar no escopo.** Decisão do mantenedor foi investigar primeiro se o defeito de contraste do `<select>` atinge outros módulos. Se atingir, corrigir na origem compartilhada **exige aprovação própria + verificação de impacto nos consumidores** (`AGENTS.md` §Autorização) — não está coberto pela abertura desta spec.
- **Profundidade de thread não limitada** quebra layout e dificulta retirada por denúncia. Daí o limite explícito no requisito 21.
