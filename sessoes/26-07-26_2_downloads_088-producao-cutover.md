# 26-07-26_2 — downloads — Spec 088: 1º cutover de produção

- **Spec:** `specs/088-downloads-producao-cutover/`
- **Módulo:** `apps/downloads` + infra (VM, banco de produção)
- **Gate:** D
- **Estado:** spec redigida; nenhuma fase executada

---

## Levantamento na VM (read-only, 2026-07-26)

Feito **antes** de redigir a spec, para não escrever plano em cima de suposição.

| Item | Estado real | Comando |
|---|---|---|
| `downloads-app` / `downloads-api` / `downloads-db` | **não existem** | `docker ps -a` |
| Volume `downloads_pgdata_downloads_prod` | **não existe** | `docker volume ls` |
| `/opt/artificio/apps/downloads/.env` | **não existe** | `ls -la` |
| `https://downloads.artificiorpg.com/` | **502** | `curl -o /dev/null -w %{http_code}` |
| `https://downloads.artificiorpg.com/api/v1/health` | **502** | idem |
| `https://downloadsbeta.artificiorpg.com/api/v1/health` | **200** | idem |
| Clone prod `/opt/artificio` | `main` em `90ec6ee`, 8 commits atrás de `dev` | `git log -1` |
| `apps/downloads/database/` no clone prod | **20 arquivos** (disco desatualizado) | `ls \| wc -l` |
| `apps/downloads/database/` em `dev` | **29 arquivos** | `ls \| wc -l` |
| `schema_migrations` beta | **29** | `psql -c 'select count(*)'` |
| DNS `downloads.artificiorpg.com` | resolve Cloudflare | `nslookup` |

### Leitura dos achados

**O 502 é informativo, não só sintoma.** Se fosse erro de DNS ou tunnel sem ingress, a resposta seria outra. 502 significa que o tunnel **roteia** o hostname e não encontra origem — ou seja, DNS e ingress já estão feitos. Isso tira mudança de DNS/tunnel do escopo e evita acionar a trava de aprovação de DNS de produção.

**O compose de produção já existe e já está correto.** `apps/downloads/docker-compose.prod.yml` já declara `downloads-db` próprio sobre volume `pgdata_downloads_prod`, no mesmo padrão do mesas (`mesas-db`/`pgdata_mesas_prod` versus `mesas-beta-db`/`mesas-beta_pgdata_mesas_beta`, ambos com `POSTGRES_DB` idêntico). O pedido "banco separado, estilo mesas" **já está implementado no arquivo** — falta executá-lo pela primeira vez.

**Isolamento no mesas vem do par container + volume, não do nome do banco.** Ambos os ambientes usam `mesas_rpg`; são dois processos Postgres distintos sobre volumes distintos. Downloads segue a mesma forma, com `downloads` nos dois lados.

**`.env` de produção não vem de secret do GitHub.** `gh secret list` mostra apenas `DEPLOY_*`, `ACCOUNTS_ENV` e `MESAS_CRON_SECRET`. Mesas, site e glossário têm `.env` posto à mão na VM, gitignored. Downloads precisará do mesmo — trabalho manual com escrita na VM, que exige aprovação nominal.

**Guard de migrations vai barrar o deploy automático.** Banco de produção nasce vazio, 29 migrations pendentes, `MAX_AUTO_PENDING=5` no script. O deploy abortaria com `Muitas migrations pendentes` — proteção funcionando, não bug (E012).

---

## Investigação de qualidade do acervo (2026-07-26)

Pedido do mantenedor no meio da redação da spec: padrão de capa, remover "Acervo Artifício", e investigar sistema/edição mal alimentados no parser. Investigado em código **e** em banco antes de escrever qualquer requisito.

### Dado real (beta, 103 materiais)

```
                     total | com_sistema | com_edicao | hint_bruto
download_material      103 |           0 |          0 |          0

                      meta | com_capa
download_material_metadata   103 |       21
```

### Causa arquitetural comum — explica autoria, sistema E tipo de uma vez

A investigação começou por "matcher de sistema não casa" e terminou num achado maior. Existem **dois caminhos de ingestão** com capacidades muito diferentes:

| Caminho | Extração | Usado por |
|---|---|---|
| `genericHtmlParser` + `platformOverrides` | **rica** — autor, artista, sistema, categoria, filtros, formato, páginas | importação **manual por URL** (`routes/scraper.ts`) |
| Adapters de descoberta (`ScraperAdapter`) | **mínima** — título, URL, preço, capa, editora, idioma | scraping **automático** em massa |

Os `platformOverrides` são o **único** lugar do código que lê `details.get('authors')`, `details.get('artists')` e `details.get('ruleSystem')` — e são invocados **apenas** por `genericHtmlParser`. O `scraperIngest` nunca passa por eles.

E o acervo inteiro veio do caminho automático:

```
  source_platform  | count        credits          → 0 de 103
-------------------+-------       system_id        → 0 de 103
 opera_rpg         |    77        material_type    → 103 "Aventura"
 itch_io           |    15        publisher_name   → 87 de 103  ← exceção
 grimorios_e_dados |     7
 dms_guild         |     4        onebookshelf     → 0 materiais
```

**Zero materiais de OneBookShelf**, a única plataforma com override rico. Não é que a extração falhe — **ela não é chamada nesse caminho**. `publisher_name` é a exceção com 87 por ser um dos poucos campos que os adapters de descoberta já emitem sozinhos.

Isso reorganiza a correção: em vez de três consertos independentes, é **um** — fechar a assimetria entre os caminhos — com três campos beneficiados.

**Correção do mantenedor:** editora (`publisher_name`) **não é** autoria (`credits`). São campos distintos, um não é fallback do outro. Ordem no card: publicante primeiro, autor depois, cada um rotulado. E o ponto central não é exibição: é o parser não identificar.

### Sistema/edição — detalhe diagnóstico próprio

O sintoma aparente é "matcher não casa sistema". O dado contradiz: **`raw_system_hint` também é zero**. Esse campo existe justamente para o caso "não casei, mas tenho o texto" — `resolveSystemHint` o preenche em toda falha de casamento, e `openSystemSuggestion` abre triagem admin a partir dele. Se o matcher falhasse 103 vezes, `hint_bruto` seria 103. Sendo zero, `systemHint` chega `null` ao ingest sempre, e o matcher nunca roda.

Confirmação em código — busca por `systemHint` scraper a scraper:

| Scraper | Emite `systemHint`? |
|---|---|
| `platformOverrides/onebookshelf.ts` | **sim** — `nullableText(details.get('ruleSystem'))` |
| `driveThruRpgScraper.ts` | **não** |
| `dmsGuildScraper.ts` | **não** |
| `itchIoScraper.ts` | **não** |
| `grimoriosEDadosScraper.ts` | **não** |
| `operaRpgScraper.ts` | **não** |

Cinco de seis caminhos nunca populam o campo. `ScrapedItem.systemHint` é opcional (`z.string().nullable().optional()`), então a ausência atravessa o pipeline sem erro, sem log e sem alarme.

**Correção é na extração, não no matcher.** `scraperIngest.ts`, `resolveSystemHint` e `matchSystemNameExact` estão corretos e passam a ser exercitados pela primeira vez.

### Tipo de material — 103/103 "Aventura", nunca funcionou

```
 material_type | count
---------------+-------
 Aventura      |   103
```

`scraperIngest.ts:22`: `DEFAULT_MATERIAL_TYPE_SLUG = 'aventura'`, resolvido **uma vez por execução** (linha 309, fora do laço) e aplicado a todos. Nenhum item é avaliado.

Não é regressão — a evidência é estrutural: `ScrapedItem` **não tem campo de tipo**. A constante entrou junto com o pipeline (`ef9efd6`) e ficou.

Agravante: a spec 086 (requisito 25) **já construiu** a taxonomia central de tipo, com ID, slug, aliases e status, e `getCatalogMaterialTypeBySlug` já resolve por slug **ou alias**. A infraestrutura existe, pronta — o scraper nunca foi ligado nela. Efeito: o filtro por tipo da spec 086 (requisito 23) oferece uma opção só, contendo tudo.

### Capa — 21 de 103 (20%), e proporção destruída

Os outros 80% caem no placeholder cinza `<div>` com texto "Sem capa". Numa página cujo modo padrão é vitrine (prateleiras horizontais, spec 087), 4 em 5 cards são placeholder.

Achado adicional do mantenedor: a capa que existe é **cortada**. `MaterialCard.tsx:52` usa `h-32 w-full object-cover` — altura fixa de 128px com recorte. Capa de RPG é caracteristicamente vertical (3:4, 2:3, A4), então o corte come topo e base. `MaterialPage.tsx:126` usa `w-full object-cover` sem trava de altura. Incoerência interna: o *placeholder* da ficha já usa `aspect-[3/4]`, mas a *imagem real* ao lado não tem trava alguma.

Inventário verificado dos pontos que renderizam `<img>` de capa: **só dois** (`MaterialCard.tsx:52`, `MaterialPage.tsx:126`). Telas de gestão manipulam a URL como texto, sem preview.

### "Acervo Artifício" — autoria falsa

`MaterialCard.tsx:41`: `material.credits?.trim() || 'Acervo Artifício'`. O eyebrow é o elemento mais destacado do card (Oswald caixa-alta, acima do título), posição escolhida na spec 087 precisamente porque o propósito do produto é creditar o autor (D107/D119). Preenchê-lo com "Acervo Artifício" faz o card afirmar autoria que o Artifício não tem em material importado de terceiro.

Teste `MaterialCard.test.tsx:81-83` hoje **exige** essa string — a correção inverte o teste, não só o código.

---

## Decisões do mantenedor (2026-07-26)

Levantadas via `AskUserQuestion` **antes** de redigir a spec, conforme o Passo 2 da skill `new-spec`. Nenhuma decisão de arquitetura ficou pendente dentro dos arquivos finais.

| Pergunta | Decisão | Consequência |
|---|---|---|
| Como resolver o guard de 29 migrations? | **Aplicação manual controlada** | Script oficial, `MAX_AUTO_PENDING` elevado por variável de ambiente numa execução única, `pg_dump` antes. Guard permanece `5` no código versionado, para todos os módulos. |
| Dados no 1º corte? | **Produção nasce vazia** | Nenhuma cópia do beta. Beta segue ambiente de teste independente; conteúdo público entra pelo fluxo normal de submissão. |
| Escopo da spec? | **Cutover + resolver T4.4 canonical** | O débito de SEO da spec 087 entra, porque produção é exatamente onde indexação importa. |
| Alvo canônico único? | **`/` (raiz)** | `/`, `/catalogo` e todas as query strings apontam para a raiz absoluta. Consolida o sinal na URL mais curta, que é a que recebe link externo. |
| Material sem crédito mostra o quê? | **Publicante, depois autor; some se nenhum** | Revisada após o achado de `publisher_name` = 87. Editora **não** é fallback de autoria — são campos distintos, cada um rotulado. Sem nenhum dos dois, o eyebrow some. |
| Capas em outros pontos? | **Regra única, todo lugar** | `MaterialCover` compartilhada: `object-contain`, piso/teto vertical, largura derivada e centralizada. Dois pontos hoje, e qualquer futuro herda por padrão. |
| Botão "Acessar material" | **Âncora `target="_blank"`** | Navegação nativa para `/ir/:id`. `window.open` após `await` seria bloqueado por popup blocker. Fail-closed e `destination_id` opaco preservados. |
| Avaliação | **Estrelas clicáveis** | Substitui o `<select>`. Estrelas somente-leitura do card (`MaterialRating`) **não** mudam — trava da spec 087 contra elemento focável no alvo de clique único. |
| Tipo de material | **Classificar por hint, default neutro** | `ScrapedItem` ganha hint de tipo; resolução por item via taxonomia da spec 086. Default deixa de ser "Aventura". |
| Autoria nos scrapers | **Corrigir junto com sistema e tipo** | Mesma causa arquitetural, mesma fase, mesma disciplina de fixture real. |
| Padrão de capa? | **Placeholder desenhado por tipo** | CSS/SVG inline, sem rede, variando por `material_type`, em tokens semânticos. Resolve os 80% agora sem depender de buscar imagem nova. |
| Até onde vai a correção do parser? | **Investigar + corrigir os 5 scrapers** | Corrige a causa raiz e valida por reprocessamento em beta. Sem backfill (produção nasce vazia, acervo de beta é descartável). |

---

## Estrutura da spec

Oito fases, ordem rígida — inverter duas produz **falha silenciosa**, não erro visível:

| Fase | Conteúdo |
|---|---|
| **0** | Canonical route-aware (hook próprio; `react-helmet` não existe no projeto) |
| **1** | Capa (regra de proporção + placeholder), crédito (publicante/autor), acesso em nova aba, avaliação por estrelas |
| **2** | Parser: autoria, editora, sistema/edição e tipo de material — causa arquitetural comum |
| **3** | Commit, PR, merge, promoção `dev → main` por fast-forward |
| **4** | Atualizar clone de produção e criar `.env` |
| **5** | Subir só o banco, `pg_dump`, aplicar as 29 migrations pelo script oficial |
| **6** | `workflow_dispatch` de produção e smoke real |
| **7** | Fechamento e atualização de backlog/estado |

**Todo o código (0–2) vem antes do cutover (4–6).** O cutover transforma o acervo de beta em conteúdo público. Publicar primeiro exporia um catálogo com 80% de cards em placeholder cinza, 100% dos materiais sem sistema e autoria falsa nos sem crédito — na primeira indexação do domínio.

### Dois pontos de ordem que não podem ser invertidos

**Clone antes de migrations.** Com 20 dos 29 arquivos em disco, a aplicação criaria schema incompleto **sem erro aparente** — o script aplicaria o que encontrasse e reportaria sucesso.

**`.env` antes de subir o banco.** `POSTGRES_PASSWORD` só grava em `pg_authid` na primeira init do volume (E009). Trocar depois no `.env` não reescreve nada e produz `28P01 password authentication failed` em loop, com o arquivo aparentemente correto. Agravante: testar por `psql -h 127.0.0.1` engana, porque localhost é `trust` e aceita qualquer senha — validação sempre pela rede Docker.

---

## Backlog

`specs/backlog.md` **ainda não atualizado** — será feito na Fase 5 (T5.5), quando houver resultado real do cutover. Registrar agora seria registrar intenção, não estado.

Débitos da spec 087 que esta spec **resolve**: T4.4 (canonical) e T6.4 (promoção para produção).

Débitos da 087 que **continuam abertos** e não são desbloqueados por este cutover: T3.4/T4.1/T4.3 (smoke visual e de viewport, dependem de browser real) e T5.3 (smoke manual local).

Débito **novo** identificado nesta investigação, deliberadamente fora do escopo: **extração de capa faltante nos scrapers** (80% dos materiais sem `cover_image_url`). Esta spec define o padrão de exibição na ausência, não a busca da imagem — corrigir a extração exige fixture real por plataforma e é spec separada. Registro formal em T7.5.

---

## Aprovações pendentes

Nenhum comando de escrita foi executado. Todo o levantamento acima é read-only. As ações abaixo exigem autorização nominal **separada, por ação** — autorizar uma não autoriza a seguinte:

1. Commit e push do canonical (Fase 1)
2. Promoção `dev → main` (Fase 1)
3. Atualizar clone de produção na VM (Fase 2)
4. Criar `.env` de produção na VM (Fase 2)
5. Subir `downloads-db` (Fase 3)
6. Aplicar as 29 migrations (Fase 3)
7. `workflow_dispatch` de deploy de produção (Fase 4)
