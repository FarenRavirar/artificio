# Plano — 089

## Arquitetura da solução

Quatro defeitos, três eixos de correção. Os defeitos 1 e 2 têm **a mesma raiz** (parser não
produz hint) e se corrigem no mesmo lugar, por fonte.

### Eixo A — extração de hints nos parsers (defeitos 1 e 2)

O ingest já sabe resolver hint: `resolveSystemHint` e `resolveMaterialTypeHint` estão
implementados, testados e corretos. **Nada muda em `scraperIngest.ts` neste eixo** — a
correção é fazer os parsers preencherem os campos que a interface `ScrapedItem` já prevê.

Ordem obrigatória por fonte, derivada do requisito 7 (e do requisito 43 da spec 088):

1. Capturar DOM real de uma página de produto da fonte.
2. Observar se sistema/tipo aparecem, e onde.
3. Só então escrever extração + fixture de teste a partir do DOM observado.

Fonte que não expõe o dado recebe `null` explícito e uma constatação registrada — não uma
regex especulativa. Este é o ponto onde a spec 088 falhou (T2.5, itch.io): escrever parser
contra estrutura não observada foi explicitamente proibido, e a proibição continua valendo.

Prioridade por impacto: `opera_rpg` (118 de 141 materiais, 84%) antes das outras duas.

**Decisão T0.7 (mantenedor, 2026-07-27):** `systemHint` significa “compatível com”.
No OPERA, 133 itens dedicados recebem `OPERA RPG`; `Gaia 400X`, explicitamente
multi-sistema, recebe `null`, pois o campo guarda um único sistema. A extração continua na
Fase 3.

**Elegibilidade do itch.io:** a listagem correta é
`/physical-games/genre-rpg/lang-pt-BR`, mas continua parcial. O parser valida cada página:
`Category=Physical game` mais `Genre=Role Playing` ou tag inequívoca `ttrpg`/`rpg-de-mesa`.
Sinal ausente ou categoria diferente falha fechado. Título e descrição não decidem.

### Eixo B — idioma (defeito 3)

A causa estava estabelecida: **o detector não rodava**. O ingest pulava a detecção inteira
quando `sourceLanguageHint === 'pt'`. As hipóteses antigas (texto curto,
campo errado, `confident=false` tratado como aprovação) estão **descartadas** — nenhuma delas
chega a ser exercida.

Quatro frentes:

- **Fechar o bypass em todos os caminhos.** Não é só o `itchIoScraper.ts`. A evidência `'pt'`
  também nasce de `<html lang>` no parser genérico (`genericHtmlParser.ts:261`) e pode chegar
  direto pelo `/ingest`. Regra: **sinal da fonte nunca aprova, só rejeita** — `not_pt` corta
  cedo, `pt` e ausente caem no detector.
- **Preservar `language = 'pt'`, persistir a evidência.** `download_material_metadata.language`
  aceita **só** `'pt'` (tipo literal em `db/types.ts:104` + `CHECK` na migration 022, ambos
  `D119 (regra pétrea)`). O hardcode está correto: é a marca do catálogo, não o resultado da
  detecção. O que falta é gravar `detected_language`, `language_confident` e
  `language_checked_at` no material — colunas que já existem e que `routes/moderation.ts` já
  preenche, mas o caminho do scraper nunca tocou.
- **Padronizar o código em ISO 639-3.** `franc-min` devolve `por`/`eng`; o desempate DeepSeek é
  instruído a devolver `pt`/`en`. A mesma língua grava com dois códigos.
- **Medir contra corpus rotulado do endpoint certo.** O "0 de 14" não mede o detector: veio do
  bypass, e do endpoint de videogame. Otimizar **precisão** — zero falso positivo.

**Implementação Fase 2:** o campo interno/API chama-se `sourceLanguageEvidence`; `not_pt`
rejeita e nenhum valor aprova. O detector retorna método/motivo, usa ISO 639-3 e aplica
heurística curta versionada com dois sinais pt-específicos antes do desempate. Documentação
oficial de 2026-07-27 confirmou `deepseek-chat` depreciado; o fallback usa
`deepseek-v4-flash` com JSON mode e só aceita códigos presentes no conjunto ISO 639-3
suportado pelo detector. O detector recebe texto já normalizado na fronteira do parser e não
decodifica novamente. Matriz e consumidores: `phase-2-language.md`.

**Implementação Fase 3:** OPERA atribui `OPERA RPG` aos 133 itens dedicados e `null` à URL
real de Gaia 400X; tipo global só em `/aventuras` e `/cenarios`. itch.io/Grimórios extraem
uma vez no parser compartilhado, por allowlists de tags inequívocas dentro do painel
estruturado “More information”; conteúdo livre fora dele não participa. Regex foi mantida:
tabela curta/regular, fixtures reais e limite de HTML já reduzem o risco; `cheerio` não se justifica.
Detalhe: `phase-3-hints.md`.

### Eixo C — entidades HTML (defeito 4)

O decoder local de cinco entidades era incompleto. A Fase 1 usa `html-entities` em modo HTML5
e classifica **todo campo de `ScrapedItem`** como `plainText`, `url`, `richHtml` ou `opaque`
num mapa `satisfies Record<keyof ScrapedItem, Policy>`. Campo novo sem política quebra o
`tsc`; não existe default silencioso.

Uma função central percorre o objeto e decodifica recursivamente só `plainText`, incluindo
arrays/JSON (`sourceFilters`, `tags`). URLs permanecem byte a byte; `descriptionHtml` continua
exclusivo do DOMPurify; booleanos, números e sinais ficam opacos. Assim a enumeração é única e
exaustiva sem espalhar chamadas campo a campo.

A passagem ocorre na saída de cada parser, depois de JSON-LD/override convergirem e antes de
idioma, slug e taxonomia. `/ingest` não decodifica: apenas remove eventual marcação de
`description` preservando entidades. Isso mantém `parse-html → ingest` em uma passagem —
`&amp;lt;` vira `&lt;`, nunca `<`.

**Correção dos registros de beta foi descartada** (decisão do mantenedor, 2026-07-27, após a
revisão do Codex). A versão anterior deste plano afirmava que "beta não tem SEO a preservar" —
isso era inferência minha sobre uma regra que o mantenedor havia colocado como absoluta (slug
publicado é permanente), e não me cabia decidir. Além disso, a Fase 5 trunca e recoleta o
acervo inteiro: corrigir antes seria trabalho jogado fora.

**Prod nasce vazia** — nenhuma correção de dado é necessária lá, desde que o parser esteja
corrigido antes do cutover.

### Eixo D — facetas navegáveis e rótulo de idioma (defeitos 5 e 6)

Único eixo que toca frontend e contrato de API. Ordem obrigatória — o link não existe antes da
busca que ele abre:

1. **Normalizar `publisher_name`/`credits` na gravação** (trim, decode, colapso de espaço),
   para que grafias equivalentes casem como uma faceta só. Sem tabela nova: decisão do
   mantenedor foi normalizar o texto, não promover editora a entidade.
2. **Filtro de editora e autor na API** (`GET /materials`), no mesmo padrão dos filtros já
   existentes.
3. **Filtro no catálogo** (`CatalogoPage`), somando-se a `q`/`material_type`/`system_id`/
   `edition_id`/`sort`/`page`.
4. **Links no card** — editora, autor e sistema viram `<a>` para o catálogo filtrado.
   `system_id` já tem filtro pronto; só este passo o afeta.
5. **Remover o rótulo de idioma do card** e corrigir a duplicação de "Editora" no label.

Os passos 1-3 precisam considerar o acervo já gravado: normalizar só na gravação deixa os 141
materiais atuais com o valor antigo. Recoletar (Fase 4) resolve, já que o acervo de beta é
descartável e será limpo de qualquer forma para a medição.

### Eixo E — comentários: identidade e threads (defeitos 7, 7b, 14)

Primeiro eixo com migration e com dependência de serviço externo.

**Identidade vem do `accounts.`**, não de `download_creator` — essa é tabela de criador de
material, e o único registro em beta é o creator sintético do scraper (`user_id` nulo). Usá-la
como fonte de identidade seria forçar semântica errada.

A trava de desenho é o requisito 19: a listagem de comentários é **rota pública**, e passar a
depender do `accounts.` para responder cria acoplamento novo. Indisponibilidade precisa
degradar a identidade (nome genérico, sem avatar), nunca derrubar a lista. Cache pelo mesmo
motivo que `catalogClient` cacheia a taxonomia por 60s.

Threads exigem `parent_id` + limite de profundidade explícito. Sem limite, encadeamento
indefinido quebra layout e dificulta a retirada por denúncia, que é o único caminho de remoção
(D111 item 6).

Permissões **não** entram neste eixo: `materials.ts:637-638` e `comments.ts:63` já autorizam
corretamente. O que falta é UI que as exerça.

### Eixo F — conteúdo rico e formulário (defeitos 8, 9, 10, 11)

O único eixo que sai de `apps/downloads`. Extrair o editor de `apps/mesas` para `packages/ui`
torna o `mesas` consumidor de componente compartilhado — **exige aprovação nominal própria e
verificação de impacto**, fora do que a abertura desta spec cobre. Mesmo se o defeito de
contraste do `<select>` se provar compartilhado.

`summary` e `description` ficam ricos, mas card e meta description consomem versão sem tags:
HTML vazando em snippet de busca é regressão de SEO, não recurso.

Slug e capa são o caminho oposto — o backend já tem tudo (`generateUniqueSlug`,
`storage/cloudinaryAdapter.ts`); falta só UI que use.

### Eixo G — Open Graph por material (defeito 15)

Não é correção de tag: é decisão de arquitetura de renderização. O downloads é SPA pura
(`main.tsx:26` usa `createRoot`, sem SSR nem hidratação), o crawler recebe sempre o
`index.html` estático (`nginx.conf:46` manda toda rota para ele), e nenhuma meta-tag adicionada
no React chega a ele.

**Arquitetura decidida (mantenedor, 2026-07-27): shell HTML dinâmico no origin.** O backend
renderiza **somente o `<head>`** de `/materiais/:slug`; o corpo continua `<div id="root"></div>`
com os bundles Vite reais, e a SPA monta normalmente. Não é SSR de React. Um ponto só resolve
OG, canonical, 404 real e `noindex` de beta. As alternativas foram avaliadas e descartadas:
SSR completo (refatoração larga de `main.tsx`, que depende de `document`, cookie e
`BrowserRouter`, para um problema de `<head>`); prerender (só gera HTML no build Docker, e
catálogo é mutável — material novo exigiria rebuild, sem gatilho existente); resposta por
User-Agent (*dynamic rendering*, classificado pelo Google como workaround, e forçaria
`Vary: User-Agent`); Cloudflare Worker (bom tecnicamente, mas cria app, rota, deploy e
observabilidade novos, e ação de infra exige aprovação nominal própria); reaproveitar o Astro
como serviço (`apps/site/astro.config.mjs:7` está em SSG sem adapter — rota dinâmica exigiria
adapter SSR e acoplamento entre subdomínios).

**Reaproveitamento válido do Astro: o utilitário, não o serviço.** `packages/content/src/meta.ts:6`
já produz `og:type`, `og:url`, `og:site_name`, `og:locale`, Twitter card e `noindex,nofollow`
(`:23`) — o contrato inteiro desta fase. Consumir o pacote não é modificá-lo, então não dispara
a trava de pacote compartilhado; se a implementação exigir mudar `meta.ts`, aí para e pede
aprovação própria.

Conta para o cutover porque a `og:image` é URL absoluta apontando para produção: o mesmo
`index.html` vai para lá e o comportamento será idêntico.

**Quatro defeitos adjacentes entram no eixo, confirmados em código:** (1) o fallback
`og-default.png` referenciado por `index.html:13` e `:22` **nunca foi versionado** — sem ele,
nenhuma correção de tag resolve o aviso do Facebook e material sem capa cai num 404; (2) beta
não é `noindex` (ver §Impacto em consumidores); (3) soft 404 global — `nginx.conf:47` devolve
200 para qualquer caminho e `App.tsx:89` redireciona `*` para `/`, e o renderer corrige ao
menos a rota de material; (4) não existe sitemap de materiais em `apps/downloads`. Decisão do
mantenedor: **beta não precisa de OG funcionando, prod precisa; beta não deve ser rastreado.**

### Eixo H — navegação e cobertura do fluxo do autor (defeitos 12, 13)

A nav é correção pequena, mas **não a que este plano descrevia**. A versão anterior dizia
"`PerfilPage` já existe, só não está exposta". Verificado: `PerfilPage.tsx:7-19` mostra só nome
e e-mail do SSO, somente leitura, e o comentário do próprio arquivo (`:4-6`) registra que perfil
público de criador ficou para spec futura — não há rota de escrita em `download_creator`. Somado
aos quatro caminhos de conta que o Header já oferece e ao "Perfil" da sidebar
(`PainelShell.tsx:9`), acrescentar outro seria o sexto. **O defeito real é a duplicação:**
`App.tsx:51` e `:53` renderizam a mesma `CatalogoPage` para "Início" e "Catálogo". Decisão do
mantenedor (2026-07-27): remove "Início", mantém "Catálogo", não acrescenta "Perfil". O que
"perfil de criador" significa vira decisão própria.

O resto **não é correção — é desenho de produto**, mas não pelo motivo que este plano dava. A
afirmação "6 domínios de API sem tela alguma" era **inferência falsa por contagem de rotas**:
todos os seis têm alguma superfície, e comparar 74 rotas com 11 páginas de painel não mede
lacuna. A lacuna real varia por **ator** e está tabelada no `spec.md` (defeito 13). Duas
ausências de tela são decisão legítima: `destinations` é infraestrutura que já roda em `/ir/:id`,
e `downloads` é evento técnico.

O trabalho é montar a matriz **ator → necessidade → rota → superfície → decisão** e fechar cada
linha com o mantenedor — inclusive as que terminam em "sem tela".

**Quatro lacunas confirmadas em código entram na correção** (decisão do mantenedor, 2026-07-27):
dashboard que conta só três dos cinco estados editoriais (`VisaoGeralPage.tsx:9-11`, sem
`rejected` nem `withdrawn`); sugestão de sistema restrita a admin (`App.tsx:86`) apesar da API
ter `/mine`; autor sem acompanhamento de avaliações, comentários e downloads dos próprios
materiais; e a divergência do defeito 17 — `comments.ts:58` promete retirada "por denúncia", mas
`download_report` só referencia `material_id` (`migration_005:11`) e não existe UI de denúncia.

**Ordem, não fatiamento.** O onboarding depende das Fases 6 e 7 terem fechado: sem threads e
identidade de comentário (090), e sem sistema, capa, conteúdo rico e slug automático, seria
construído sobre formulário temporário. O Codex propôs tirar a fase da 089; o mantenedor manteve
spec única, coerente com o decidido nas fases 5 e 8.

**Desenho: task list, não wizard.** O fluxo é interrompível e não linear — GOV.UK recomenda task
list quando as tarefas podem ser retomadas ou feitas fora de ordem, e o step indicator do USWDS
pressupõe sequência linear. Checklist por material derivado dos dados reais, sem tour modal, com
saída e retomada livres.

## Arquivos afetados (por módulo/pacote)

| Arquivo | Eixo | Natureza |
|---|---|---|
| `apps/downloads/backend/src/services/scrapers/operaRpgScraper.ts` | A, C | extração de hints + decode de título |
| `apps/downloads/backend/src/services/scrapers/itchIoScraper.ts` | A, C | idem |
| `apps/downloads/backend/src/services/scrapers/grimoriosEDadosScraper.ts` | A, C | idem |
| `apps/downloads/backend/src/services/languageDetector.ts` | B | ISO 639-3 no desempate, fallback de texto curto, modelo DeepSeek + JSON mode |
| `apps/downloads/backend/src/services/scraperIngest.ts` | B | fim do bypass (`:223`), evidência de detecção no material, método/motivo no log |
| `apps/downloads/backend/src/services/scrapers/types.ts` | B | `sourceLanguageEvidence`: evidência da fonte, nunca decisão positiva |
| `apps/downloads/backend/src/services/scrapers/genericHtmlParser.ts` | B | `<html lang>` deixa de aprovar (`:261`) |
| `apps/downloads/backend/src/routes/scraper.ts` | B | schema do `/ingest` — hint recebido não pode aprovar |
| testes que passavam `sourceLanguageHint: 'pt'` | B | migrados para `sourceLanguageEvidence`; sinal positivo agora exerce o detector |
| `apps/downloads/backend/src/services/scraperIngest.test.ts` | — | fixture que exercite catálogo real, não mock permissivo |
| `apps/downloads/backend/src/services/scrapers/itchIoParser.ts` | A, C | **parser compartilhado** por `itch_io` e `grimorios_e_dados` — omitido na versão anterior deste plano |
| fixtures de teste dos 2 parsers | A, C | DOM real observado, com proveniência |
| `apps/downloads/backend/src/routes/materials.ts` | D | filtro exato por chave, `leftJoin` antes do count (`:227`), editora/autor em `/facets` (`:108`) |
| `apps/downloads/backend/src/routes/materialMetadata.ts` | D | **2ª fronteira de escrita** (`:118`) — omitida na versão anterior; normalizar só o scraper deixa material humano divergente |
| `apps/downloads/backend/src/services/scraperIngest.ts` | D | 1ª fronteira (`:324`) + fim do `combineCredits` (`:48`) |
| `apps/downloads/database/migration_*.sql` | D | chave normalizada de editora + índice; campos estruturados de autor/artista |
| `scripts/api/**` | D | gerador de OpenAPI — `GET /materials` não documenta nenhum query param, e o `POST` está com contrato antigo |
| `apps/downloads/frontend/public/robots.txt` | D | **não existe**; nginx já o espera (`nginx.conf:40`) e devolve 404 |
| `apps/downloads/frontend/src/pages/CatalogoPage.tsx` | D | leitura dos filtros novos + `isBrowsing` (`:88`), que hoje ignora filtro novo e desliga a consulta |
| `apps/downloads/frontend/src/types/material.ts` | D | `MaterialListFilters` (`:68`) |
| `apps/downloads/frontend/src/hooks/useMaterialsCatalog.ts` | D | serialização dos filtros (`:5`) |
| `apps/downloads/frontend/src/hooks/useMaterialFacets.ts` | D | consumir editora/autor das facetas |
| `apps/downloads/frontend/src/components/MaterialCard.tsx` | D | links em camada própria sobre o link estendido (`:92`), remoção do rótulo de idioma (`:111`), label de editora |
| `apps/downloads/frontend/src/components/SystemChainBadge.tsx` | D | `<span>` (`:24`) vira link para o `system_id` raiz, com nome acessível |
| `apps/downloads/backend/src/routes/comments.ts` | E | identidade do autor, papel, `parent_id` |
| `apps/downloads/database/migration_032_*.sql` | E | `parent_id` em `download_comment` — **não é a única migration da spec**: a Fase 4 traz chave de editora + autores/artistas estruturados, e a Fase 7 traz identidade do ativo de capa (`public_id`/provedor) |
| `apps/downloads/frontend/src/pages/painel/EditarMaterialPage.tsx` | F | campo de sistema, envio de capa |
| `apps/downloads/frontend/src/pages/painel/NovoMaterialPage.tsx` | F | slug automático, contraste do `<select>` |
| `packages/ui` | F | editor rich text extraído — **aprovação nominal própria** |
| `apps/downloads/frontend/index.html` | G | remover as metas genéricas que o shell dinâmico passa a injetar — hoje duplicariam |
| `apps/downloads/frontend/public/og-default.png` | G | **não existe**; `index.html:13` e `:22` o referenciam. Diretório `public/` também precisa nascer; `Dockerfile:44` copia `dist` inteiro, e o Vite emite `public/` para lá sem config extra |
| `apps/downloads/frontend/nginx.conf` | G | encaminhar `GET /materiais/:slug` ao backend, **antes** do `location /` (`:46`) e sem capturar os assets (`:34`) |
| `apps/downloads/backend/src/**` (renderer de `<head>`) | G | consulta o material pela **mesma função da API pública**, obtém e cacheia o `index.html` real do frontend interno, injeta as tags. Corpo intocado |
| `packages/content/src/meta.ts` | G | **consumido, não modificado** — já produz o contrato completo, inclusive `noindex` (`:23`). Modificar exigiria aprovação nominal própria |
| sitemap de materiais publicados | G | **não existe** em `apps/downloads`; servido em prod, ausente em beta |
| `apps/downloads/frontend/src/components/AppShell.tsx` | H | remover o `Início` duplicado de `moduleNav` (`:18`); **não** acrescentar `Perfil` |
| `apps/downloads/frontend/src/pages/painel/VisaoGeralPage.tsx` | H | `rejected` e `withdrawn` nos contadores (`:9-11` cobre só três dos cinco), motivo da rejeição, link público |
| `apps/downloads/frontend/src/pages/painel/**` (telas de acompanhamento) | H | avaliações, comentários recebidos e downloads dos próprios materiais |
| `apps/downloads/frontend/src/**` (sugestão de sistema fora da gestão) | H | usuário comum sugere e acompanha `/mine`; hoje só admin (`App.tsx:86`) |
| `apps/downloads/backend/src/routes/comments.ts` | H | defeito 17 — `:58` promete denúncia que não existe no modelo; ou modelar ou corrigir o comentário |
| `apps/downloads/database/` (denúncia de comentário) | H | **condicional à decisão da T9.7**: `download_report` só tem `material_id` (`migration_005:11`) |

**Não tocar:** `packages/catalog-matching`, `packages/catalog-client` (leitura apenas),
`resolveSystemHint`/`resolveMaterialTypeHint` (corretos).

## Contratos/interfaces tocados

- **Auth/accounts:** nenhum.
- **Subdomínio/DNS:** nenhum.
- **Schema:** as colunas `raw_system_hint` (030) e `raw_material_type_hint`/`material_type_id`
  (031) já existem — esta spec as **preenche**, não as cria. Mas a Fase 4 traz migration,
  ao contrário do que este plano afirmava: a revisão do Codex mostrou que `trim` + colapso de
  espaço **não** unifica "Grimórios & Dados Editora" e "Grimorios e Dados" (acento, `&`/`e`,
  sufixo), e que `credits` é um blob de autor **+** artista. Decisões do mantenedor
  (2026-07-27): **chave normalizada de editora** em coluna própria com índice, e **modelo
  estruturado** de autores/artistas — as duas exigem migration e migração do dado existente.
  Editora segue sem virar entidade: é chave de comparação, não tabela.
- **Contrato de catálogo:** `GET /api/catalog/v1/material-types` é consumido, não alterado.
- **`GET /materials` ganha parâmetros de filtro** (editora, autor). Aditivo: chamada existente
  sem os parâmetros continua com o mesmo comportamento. Exige `pnpm verify:api` e atualização
  do OpenAPI.

## Impacto em consumidores

- **`ScrapedItem`** é interna ao downloads; preencher campos já previstos não quebra consumidor.
- **Coluna `language` não muda** — segue `'pt'` por regra pétrea D119 (`CHECK` na migration 022).
  Quem assume `language = 'pt'` continua correto. A evidência da detecção passa a viver em
  `detected_language`/`language_confident`/`language_checked_at`, que hoje só o fluxo de
  moderação preenche.
- **`detected_language` passa a gravar ISO 639-3** de forma consistente. Quem hoje lê esse campo
  esperando `pt`/`en` (639-1, o que o desempate DeepSeek devolve) precisa ser revisto.
- **Slug corrigido em beta** altera URL de 3 materiais. Link salvo por alguém quebra — aceitável
  em beta. **Correção (3ª revisão do Codex, 2026-07-27):** este item afirmava "sem impacto de SEO
  (beta é `noindex`)". **Beta não é `noindex` hoje** — nenhum código emite `meta[name=robots]`
  nem `X-Robots-Tag`, e a resposta real de beta veio `200 OK` sem os dois. Beta pode competir com
  produção na indexação. Passa a ser `noindex` na Fase 8 (T8.8, requisito 36e); até lá, a
  premissa que sustenta "sem impacto de SEO" não vale.

## Rollback

- **Código:** reverter o commit. A Fase 4 traz migrations (chave de editora, autores/artistas
  estruturados) — reverter código não desfaz schema; migration de correção, nunca reescrita da
  original.
- **Dados de beta:** o rollback aponta ao **dump novo de T5.3**, não ao
  `downloads_beta_20260727_161016.sql` — aquele é anterior ao estado que T5.3 deve preservar, e
  foi validado só por contagem de blocos `COPY`, o que prova que há dado no arquivo, não que ele
  restaura. O dump de T5.3 é `-Fc`, com checksum e `pg_restore --list` conferidos.
- **Alcance do `TRUNCATE ... CASCADE`:** esvazia **todas** as 16 tabelas com FK para
  `download_material` — inclusive as `ON DELETE SET NULL` (`migration_021:69`, `022:67`,
  `024:24`), que num `DELETE` apenas perderiam a referência. Atinge favorito, coleção,
  comentário, denúncia, sugestão, métrica, view e log por item. Decisão do mantenedor
  (2026-07-27): `TRUNCATE`, **condicionado** ao inventário de T5.3a provar que não há dado
  humano a preservar. O acervo de scraper é recoletável; dado humano não.
- **Prod:** intocada por esta spec.

## Validação (como provo que funciona)

Sequência obrigatória, sem pular etapa:

1. `rtk pnpm run lint`, `rtk pnpm run build`, `rtk pnpm run test` e `rtk pnpm verify:api` verdes.
2. Testes dos parsers verdes **com fixture de DOM real**, não mock inventado.
3. Deploy de beta com **SHA registrado e conferido** — `auto_deploy_on_push: false`, então "run
   verde" não diz qual código subiu.
4. **Preflight** do serviço dependente: `GET /api/catalog/v1/material-types` responde 200 e
   contém `nao-classificado`. Antes de apagar qualquer linha — foi a ausência disto que deixou
   beta vazio na rodada anterior.
5. **Inventário read-only** por `source_platform` e por cada uma das **16 tabelas** com FK para
   `download_material`, com veredito sobre dado humano a preservar.
6. `pg_dump -Fc` novo, com exit 0 sem warning, checksum e `pg_restore --list` legível.
7. Limpar o acervo (`TRUNCATE ... CASCADE`, decisão do mantenedor) e recoletar as três fontes,
   em runs **sequenciais**, validando os contadores de cada run — `status='completed'` não
   prova run saudável (`scraper.ts:64` marca sem olhar contador).
8. Executar o **SQL canônico versionado**, uma linha por regra com `pass`/`fail`, por fonte e
   agregado.
9. Aguardar ou invalidar o cache de 30s de `/facets` antes da evidência de UI.
10. Qualquer regra crítica falhando mantém a Fase 5 **aberta**.

Os passos 6-7 exigem autorização nominal **separada** da do deploy (escrita destrutiva em
banco). O passo 8 é a prova real — código verde sem esses números não fecha a spec, pelo mesmo
motivo que a Fase 2 da 088 não fechou: teste passando não provou runtime funcionando.
