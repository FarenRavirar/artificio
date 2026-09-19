# Mapa de deploys da spec 102

Para que serve: antes de cada deploy, saber **o que ele fecha**, **o que ele destrava**
e **o que ainda não é medível**. A âncora é a tabela de critérios A1…H1 do `spec.md` §4
— é ela que fecha a spec, não a lista de tasks. Estado medido em 2026-09-14. Reescrever
este arquivo quando um deploy rodar, nunca anexar bloco novo.

## Regras que governam o mapa (medidas)

- Deploy só sai por `workflow_dispatch`. Todo módulo tem `auto_deploy_on_push: false`
  no `.github/deploy-manifest.json` — merge em `dev` **não** deploya beta sozinho.
- `promote-prod-fast-forward.yml` só move o ponteiro Git. Prod só muda com dispatch:
  `gh workflow run deploy.yml --ref main -f module=<m> -f mode=deploy -f env=prod`.
- `deploy.yml` só deploya se um `deploy_paths` do módulo mudar. **`packages/*` não está
  em `deploy_paths` de módulo algum** — mudança em `packages/ui` não dispara nada; ela
  chega ao app pelo build do app, no deploy que aquele app tiver por outro motivo.
- `accounts` e `links` são prod-only (`env_override: prod`); dispatch `env=beta` neles
  é bloqueado pelo `build-matrix`.
- **Distância até prod:** `origin/main..origin/dev` = **19 commits** (medido 2026-09-16,
  após o merge da #326 — `dev` em `93d5533`). `main` segue em `1c833b5` (merge da #321);
  o promote de 2026-09-14 levou os 40 commits anteriores, e o que sobrou é a F7 inteira
  mais os merges das #322/#323/#324/#325/#326. **Fast-forward confirmado:**
  `git merge-base origin/main origin/dev` == `origin/main`, então o promote não cria
  merge commit. Diff por módulo, medido com
  `git diff --name-only origin/main origin/dev -- <path> | grep -c .` (2026-09-16):
  `packages/ui` **15 arquivos**, `apps/site` **15**, `apps/downloads` **6**,
  `apps/mesas` **3**, `apps/glossario` **3**, `apps/links` **3**, `apps/accounts` **2**,
  `apps/site-admin` **0**. Uma contagem anterior deste bloco somava **1 a mais por app**:
  veio de `--stat`, cuja última linha é o rodapé `N files changed`, não um arquivo.
  `--name-only` contado por linha é o instrumento certo.

- **Gate E012 (migration) não entra neste promote.** `git diff --name-only origin/main
  origin/dev | grep -iE "\.sql$"` devolve **zero** (2026-09-16). Os três
  `*/database/changelogs.json` que aparecem no diff (`mesas`, `glossario`, `downloads`)
  são as entradas de changelog da F7 — dado de conteúdo, não DDL. Não confundir o
  diretório `database/` com migration: o gate olha `.sql`.

- **Cada um dos 5 apps não-`site` tem arquivo próprio em `apps/*` no diff** — `mesas`
  `frontend/src/components/AppShell.tsx`, `glossario` `GlossarioHeader.tsx`, `downloads`
  `App.tsx` + `AppShell.tsx` + 2 testes, `links` `LinksHeader.tsx`, `accounts`
  `main.tsx`. Logo o gate de `deploy_paths` **passa** em todos: um dispatch de cada app
  leva junto, pelo build, a correção de header em `packages/ui`. O que `packages/ui` não
  faz é **disparar** deploy sozinha; ela não fica presa quando o app tem deploy próprio.

- **Beta existe para 4 módulos apenas:** `site`, `mesas`, `glossario`, `downloads`.
  `links` e `accounts` têm `env_override: "prod"` no manifesto — o `build-matrix` bloqueia
  dispatch `env=beta` neles, e o header corrigido só chega nesses dois por deploy prod.

## Tabela-mestra: qual deploy fecha qual critério

19 critérios no `spec.md` §4. **8 já fecham sem deploy** (código/teste/banco), **9
dependem de deploy**, **2 dependem de ação manual no Search Console**.

| # | critério | fecha com | estado hoje |
|---|---|---|---|
| A1 | canonical divergente no banco → 0 | — (SQL, T3.2) | ✅ **fechado** 2026-09-12, `UPDATE 105` |
| A2 | varredura HTTP dos 126 posts → 0 mismatch | Deploy B | ✅ **fechado** — 30/30 |
| D1 | prefixo legado → 301 + `Location` certo | Deploy B | ✅ **fechado** — 12/12 |
| D2 | sem cadeia de redirect (1 hop até 200) | Deploy B | ✅ **fechado** — 12/12 |
| D3 | forma **sem barra final** também redireciona | Deploy B | ✅ **fechado** — 6/6 |
| D4 | query string preservada no redirect | Deploy B | ✅ **fechado** — query intacta |
| D5 | `lastmod` no sitemap do `site` ≥ 126 | Deploy B | ✅ **fechado** — 126 |
| C1 | mesa inexistente → 404 | **Deploy D** | código pronto |
| C2 | soft-404 não emite canonical auto-referente | **Deploy D** | código pronto, testado |
| B1 | sitemap ↔ SSR concordam 100% | **Deploy D** | 92 → 41 URLs no código |
| B2 | visibilidade em função única compartilhada | — (código, T1.1) | ✅ **fechado**; espelho do frontend segue divergente |
| E1 | facetas com canonical para URL limpa | **Deploy D** | ✅ medido em **beta**; prod é confirmação |
| F1 | crawler de IA recebe conteúdo real | **Deploy D** | beta: 3.328 → 193.502 B |
| F2 | `Product` sem erro crítico, zero `Event` | **Deploy D** + Rich Results Test | código pronto |
| F3 | `Offer` com preço, moeda, disponibilidade | **Deploy D** | código pronto |
| F4 | `description` por mesa, não institucional | **Deploy D** | código pronto |
| F5 | schema no HTML inicial, não por JS | **Deploy D** | beta ✅ |
| G1 | guard em CI cobre A1, C1, B1, F1 | — (CI) | ⚠️ **parcial**: G-A ✅, G-E ✅, G-F ✅; **G-B, G-C, G-D pendentes** |
| H1 | Validate Fix no GSC, nenhum "Failed" | **manual, pós B e D** | bloqueado (ver abaixo) |

**D3 e D4 são o achado que o mapa anterior não tinha.** Não são "nice to have": hoje,
em produção, o backlink que chega **sem barra final** devolve 404, e os UTMs somem do
`Location`, apagando a atribuição de campanha do GA4 em todo tráfego legado. As duas
correções estão em `redirect-cache.ts` (14/14 testes) e só valem após o Deploy B.

## Mapa por deploy

### Deploy A — `site` beta ✅ FEITO

Run `34903089436`, `success`, 2026-09-14. `-f module=site -f mode=deploy -f env=beta`.

**O que provou** (medido em `beta.artificiorpg.com`):

| aceite | resultado |
|---|---|
| recorte da paginação | `/blog/` e fatias 2–5 = **24 cards**; fatia 6 = **5** |
| `/blog/1/` e `/blog/7/` | **404** — a fatia 1 é `/blog/`, por construção |
| canonical auto-referente | raiz, `/blog/` e `/blog/2/` — cada um para si |
| home ≠ duplicata de `/blog/` | `title` e `h1` distintos; `<h1>` único na raiz |
| `rel=prev`/`next` | presentes na fatia 2 |
| "Página 2 de **6**" | confirma as 6 fatias |
| header | 11 `artificio-nav-link`, 2 × "Todos os Posts", nav antes de `.artificio-session` |

**Dois achados que mudam o que medir em prod:**

1. **Beta e prod têm bancos com conteúdo diferente** — `site-beta-db` = **125** posts
   `publish`, `site-prod-db` = **126**. O beta serviu 125, que é o conteúdo dele; não há
   post perdido no pipeline (descartadas por medição: status, slug numérico, slug
   duplicado, `published_at` nulo, `noindex` — todas 0). Em prod a aritmética dá as
   mesmas 6 fatias. **Ao conferir beta, o alvo é 125, não 126.**
2. **D5 não é medível em beta, por desenho.** `/sitemap-0.xml`, `/sitemap.xml` e
   `/sitemap-index.xml` → **404**; `robots.txt` → `Disallow: /`. A integração `sitemap`
   do Astro só entra quando `SITE_NOINDEX !== "true"` (PR #271: beta não emite convite a
   rastrear). O `lastmod` só tem leitura em prod.

**Fecha:** nenhum critério da tabela — os aceites são `curl` contra `artificiorpg.com`.
**Eliminou:** o risco de descobrir erro de recorte só em prod.

**⚠️ REPROVOU o aceite 16 de T3.5 (layout mobile) — JÁ CORRIGIDO, FALTA DEPLOYAR.**
Achado do mantenedor no beta; causa medida: ao hidratar, o Astro injeta um `<style>` e um
`<script>` como irmãos do componente, dentro do grid — 5 itens para 4 colunas (3 em
≤860px), mais a subnav derramada na barra. Correção feita em
2026-09-14: a ilha passou a ser dona do `<header>` inteiro (padrão do `apps/links`),
`.artificio-user-name` ganhou `display:none` em ≤860px no `packages/ui`, e entrou um
guard de estrutura com 6 testes. Detalhe completo e tabela de validação em `tasks.md`,
bloco T3.5e.

**Estado: PR #322 MERGEADA em `dev`** (2026-09-15 14:47Z), commits `0b65434` (correção do
header, 10 arquivos) e `af85545` (achados de review do Codex e do CodeRabbit, 5 arquivos).
**NÃO deployada** — merge em `dev` não deploya nada (`auto_deploy_on_push: false`).

Produção segue com o header quebrado no celular até: promote `dev`→`main` → novo
Deploy B. Cada passo com autorização nominal própria.

**Isto é defeito de layout, não de indexação — nenhum critério A1…H1 depende dele.**

### Deploy B — `site` prod ✅ FEITO

Run `34907514215`, `success`, 2026-09-14, precedido do promote (run `34907438221`).
`main` = `1c833b5`. **Rollback: `main` estava em `31ff668`.**

**Os 6 critérios fecharam, medidos em `artificiorpg.com` com cache-buster:**
A2 **30/30** · D1 **12/12** · D2 **12/12** (1 hop) · D3 **6/6** (sem barra final) ·
D4 query intacta · D5 **126** `lastmod`. Sitemap com 126 posts, fatias 5×24+6 = 126
cards, raiz com `h1` e canonical próprios.

**Duas armadilhas de medição, as duas encontradas aqui e documentadas em T3.3:**
1. `grep -c` num XML de uma linha conta **linhas**, não ocorrências — devolve 1 com 126
   `lastmod`. Usar `grep -o "<lastmod>" | wc -l`.
2. Cache de borda do Cloudflare (`max-age=7200`) serve mistura de versões logo após o
   deploy. **Toda conferência deste app precisa de `?cb=$(date +%s%N)`.**

**Fecha 6 critérios:** A2, D1, D2, D3, D4, D5.
**Fecha, além da tabela, os aceites de T3.5:** canonical/`h1`/`title` próprios da raiz
(a home sai de "duplicata de `/blog/`"), 2 links "Todos os Posts", `/blog/2…6/` servindo
200 e `/blog/7/` → 404, 11 `artificio-nav-link` visíveis em ≤860px, ferramentas antes
de `.artificio-session`.

**Destrava:**
- **T2.3** — varredura 105/105 (hoje 100/105, as 5 são cache de borda + 1 transitória).
- **H1, linhas F2 e F3** do GSC — Validate Fix em "Not found (404)" e "Alternate page
  with proper canonical tag".
- **T6.2** — Request Indexing das ≤10 URLs de maior valor. Antes do deploy, submeter URL
  ainda errada queima cota sem ganho.

**Não fecha:** nada de `mesas` (paths disjuntos), e nada do header nos outros 5 apps.

### Deploy C — `mesas` beta

**Já rodado** em 2026-09-13 (run `34778898181`) + ingress beta `:80`→`:3000` (tunnel
v26→v27). E1, F1, F5 e os aceites de T4.2/T4.3/T4.5 medidos ali.

**Rodado duas vezes em 2026-09-16:** run `35106228138` (`success`, 4m22s), que levou a F7
— o header mobile de `packages/ui` chega pelo build do app, já que `packages/*` não está
em `deploy_paths` — e depois a run `35119177098`, já com a #326. **A válida é a segunda**;
ver a rodada dos 4 betas abaixo.

### Rodada de betas de 2026-09-16 — os 4 módulos com beta, pós-#326

A #326 entrou em `dev` (merge `93d5533`, contendo `b73029d` e `e9c49d9`) e os **4 módulos
que têm beta** foram deployados em sequência, todos `success`:

| módulo | run | ambiente | smoke |
|---|---|---|---|
| `site` | `35118401318` (5m39s) | `beta.artificiorpg.com` | 200 |
| `mesas` | `35119177098` | `mesasbeta.artificiorpg.com` | 200 |
| `glossario` | `35120654608` | `glossariobeta.artificiorpg.com` | 200 |
| `downloads` | `35121138771` | `downloadsbeta.artificiorpg.com` | 200 |

Smoke medido com `curl -o /dev/null -w '%{http_code}'` e `?cb=$(date +%s%N)`. Foi o
**primeiro beta de `glossario` e de `downloads`** — nenhum dos dois falhou no bootstrap.

**A CSP da #326 chegou**, medida no `beta.artificiorpg.com` com cache-buster:
`connect-src` traz `https://www.google-analytics.com` e `https://analytics.google.com`
(GA4 deixa de ser mudo no beta); `img-src` traz `https://res.cloudinary.com` (capas).
A CSP é `<meta>` gerada no build — antes deste deploy o ambiente servia a diretiva antiga
por mais que o `dist` local estivesse correto. As runs anteriores (`35105075773` do `site`
e `35106228138` do `mesas`) são as que rodaram ANTES de `b73029d`; estão superadas.

**`links` NÃO tem beta e ficou de fora, por decisão do mantenedor** ("rode só que tem
beta", 2026-09-16). Medido em `deploy.yml:184-187`: dispatch `env=beta` para `links` ou
`accounts` sai com `exit 1` ("ERRO: $m nao tem realm beta"), e o manifesto ainda tem
`env_override: "prod"` + `push_branches: ["main"]` nos dois. Deploy de `links` é
necessariamente produção, a partir de `main`, e exige promote + autorização própria.

**O smoke visual** do header em ≤860px e da `/busca/` exige navegador — nenhum teste
alcança, e nenhum `curl` acima o cobre. Segue pendente em beta e em prod.

### Rodada de prod de 2026-09-16 — ✅ COMPLETA, 6 de 6

Mantenedor autorizou os **6 módulos** ("todos", 2026-09-16), depois de recusar o recorte
de 4, e autorizou a troca de ingress do `mesas` no mesmo turno. **Tudo em produção.**

**Promote `dev`→`main`:** run `35122671173`, `success`. `main` `1c833b5` → **`93d5533`**,
fast-forward. **ROLLBACK: `main` estava em `1c833b5`.** O dispatch exige
`-f confirm=PROMOTE_DEV_TO_MAIN`; sem esse input a API devolve
`HTTP 422: Required input 'confirm' not provided` e nada roda.

| # | módulo | run | resultado | smoke prod |
|---|---|---|---|---|
| 1 | `site` | `35122756009` | ✅ `success` | `/` `/blog/` `/busca/` = 200 |
| 2 | `mesas` | `35123517986` | ❌ `failure` (502 previsto) | 200 **após ingress v28** |
| 3 | `glossario` | `35124797975` | ✅ `success` | 200 |
| 4 | `downloads` | `35125372846` | ✅ `success` | 200/200/401 |
| 5 | `links` | `35126396653` | ✅ `success` | 200 |
| 6 | `accounts` | `35127277894` | ✅ `success` | 200/200/401/401 |

**`site` prod medido** com cache-buster: `grep -o "<lastmod>" | grep -c .` no
`sitemap-0.xml` = **126**, igual ao Deploy B. Nenhuma regressão de SEO; a `/busca/` do
Component UI (T7.8) está no ar.

**`mesas`: a run falhou como previsto e o ingress resolveu.** Log confirmado palavra por
palavra: `ERRO: smoke home esperava 200 recebeu 502`. **Troca feita via MCP Cloudflare**
(escrita autorizada nominalmente): tunnel `6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`,
`PUT /cfd_tunnel/{id}/configurations`, **v27 → v28**, só a regra
`mesas.artificiorpg.com` de `http://mesas-app:80` para `http://mesas-app:3000`, as outras
10 preservadas. Depois: home 200 (3 medições), `/api/v1/me/options` **401**,
`/mesas/nao-existe-zzz` **404** → **critério C1 fechado em produção**, `/sitemap.xml` 200.
**ROLLBACK do ingress: voltar a regra para `http://mesas-app:80`.**

**O beta já estava em `:3000` desde 2026-09-13** (regra `mesasbeta` no mesmo ingress) —
era a prova de que `:3000` é o alvo certo, disponível por leitura antes de escrever.

**Duas armadilhas de medição desta rodada:**
1. `gh run view --log-failed | grep ERRO` devolve primeiro as linhas do **script ecoado**
   (`echo "ERRO: ..."`, com prefixo ANSI `^[[36;1m`), não a falha. A linha real vem sem
   escape de cor, no fim da saída. Filtrar por `grep -E "ERRO: smoke|Error: Process"`.
2. `curl /api/v1/auth/google` no `downloads` devolve **404, e isso é correto** — o app não
   expõe essa rota (`rtk rg "auth/google" apps/downloads --type ts` = **zero**). O 404 foi
   lido como regressão por um instante; o contrato de smoke dele é
   `/api/v1/health`, `/` e `/api/v1/materials/mine`, medidos 200/200/401. Conferir o
   manifesto antes de inventar rota de smoke.

### Deploy D — `mesas` prod ✅ FEITO

Run `35123517986` (`failure` no smoke, previsto) + ingress v27→v28. Detalhe da execução na
rodada de prod acima. **Medido em `mesas.artificiorpg.com` depois do ingress:**

| critério | medição | resultado |
|---|---|---|
| C1 | `/mesas/nao-existe-zzz` | **404** ✅ |
| C2 | `grep -c 'rel="canonical"'` no corpo do 404 | **0** ✅ |
| B1 | 44 URLs do `/sitemap.xml`, todas via `curl` | **0 não-200** ✅ |
| F1 | `curl -A GPTBot/1.1 <mesa> \| wc -c` | **37.330 B** (era 3.328) ✅ |
| F2 | `grep -c '"@type": "Event"'` | **0** ✅ |
| F5 | `grep -c 'ld+json'` com UA de crawler | **1** ✅ |

**Fecha 7 dos 8:** C1, C2, B1, E1 (confirmação), F1, F2, F5. **F3 e F4 não foram medidos
aqui** — F3 (`Offer` com preço/moeda/disponibilidade) e F4 (`description` por mesa) exigem
inspecionar o JSON-LD campo a campo, e **F2 só fecha de verdade com o Rich Results Test**,
que é manual. O `grep` acima prova apenas a ausência de `Event`, não a validade do
`Product`.

**Destrava:** H1 linha F1 (Soft 404). Sem pré-requisito pendente — a propriedade de
Domínio já está verificada e cobre `mesas.`.

### O que nenhum deploy fecha

- **G1 está parcial e não depende de deploy.** G-B, G-C e G-D exigem HTTP, mas o job
  pode subir `node server.js` em `127.0.0.1`. O que falta é **banco com dado** (o
  sitemap sai de query) — desenho próprio, ainda não feito. Sem eles, G1 não fecha e a
  classe inteira de "sitemap anuncia o que o SSR nega" volta sem quebrar teste.
- **Aceite 16 de T3.5** (header em `mesas`, `downloads`, `glossario`, `links`,
  `site-admin`, `accounts`, desktop e ≤860px). É `packages/ui`: nenhum `deploy_paths` o
  cobre, então ele nunca **dispara** deploy — chega a cada app pelo build daquele app.
  **Em beta isto deixou de ser bloqueio** para `mesas`, `glossario` e `downloads`: os três
  foram deployados em 2026-09-16 e servem o header novo (runs na rodada de betas acima).
  Segue aberto em **prod nos 5 apps** e em **`links`/`accounts` em qualquer ambiente**,
  que não têm beta. Além disso é layout — exige navegador, nenhum teste alcança.
- **Espelho `apps/mesas/frontend/src/utils/tableVisibility.ts`** segue divergente (B2
  fecha pelo backend). Unificar exige pacote compartilhado, aprovação nominal.
- **Aceite 4 de T1.3** — sugestões de mesas vigentes no corpo do `410`. Frontend, não
  afeta status HTTP.
- **T6.3** — decisão de não usar Removals. Fechada, não reabre.

## Search Console — propriedade de Domínio

**Resolvido.** A propriedade de Domínio `artificiorpg.com` existe e está verificada —
informado pelo mantenedor em 2026-09-14. A medição anterior desta seção (só prefixo de
URL, `mesas.` não cadastrado) está **superada**; não reabrir como bloqueio.

Consequência: **o Deploy D deixou de ter pré-requisito no Search Console.** A propriedade
de Domínio cobre todos os subdomínios, então `mesas.artificiorpg.com` entra em relatório
sem cadastro próprio — os soft-404 do `mesas`, antes só alcançáveis por `curl`, passam a
ter relatório. H1 tem referência de comparação.

A conferir ao abrir o GSC (não medido por mim, sem acesso): se `mesas.` já acumulou dado
próprio ou se a série começa na data da verificação. Se começar agora, o baseline do
`mesas` é a primeira leitura pós-Deploy D, não o de 03/09 — que é do `site`.

Baseline do `site`, 03/09/2026: 404 → **994** · Rastreada não indexada → **723** ·
Alternativa com canônica → **235** · 5xx → **1** · indexadas → **92**.

## Como conferir depois de cada deploy

Comandos do `plan.md` §7, agrupados por deploy.

Depois do **Deploy B**:

```bash
# A2 — varrer os 126 posts: canonical == URL servida (espera 0 mismatch)
# D1/D2 — 301 sem cadeia
curl -sIL https://artificiorpg.com/noticias/chris-perkins-aposentadoria-dnd/
# D3 — sem barra final (hoje 404)
curl -sI https://artificiorpg.com/blog/analises/dd-2024-orcs-
# D4 — query preservada
curl -sI 'https://artificiorpg.com/noticias/<slug>/?utm_source=fb'
# D5 — lastmod
curl -s https://artificiorpg.com/sitemap-0.xml | grep -c lastmod    # >= 126
# T3.5 — raiz
curl -s https://artificiorpg.com/ | grep -c '<h1'                   # 1
```

Depois do **Deploy D**:

```bash
# C1
curl -s -o /dev/null -w '%{http_code}\n' https://mesas.artificiorpg.com/mesas/nao-existe-zzz  # 404
# C2 — a resposta 404 não traz canonical para si
# B1 — varrer /sitemap.xml com UA Googlebot: 0 "não encontrada"
# F1 — crawler de IA recebe conteúdo real
for ua in GPTBot/1.1 ClaudeBot/1.0 PerplexityBot/1.0; do
  curl -s -A "$ua" https://mesas.artificiorpg.com/mesas/<slug> | wc -c
done
# F5
curl -s -A GPTBot/1.1 https://mesas.artificiorpg.com/mesas/<slug> | grep -c 'ld+json'  # >= 1
# F2 — Rich Results Test (manual): Product sem erro crítico
curl -s https://mesas.artificiorpg.com/mesas/<slug> | grep -c '"@type": "Event"'       # 0
```

## F7 — header mobile e busca uniforme (2026-09-15) · **não afeta os critérios A1…H1**

Criada a pedido do mantenedor depois do achado P1 do Codex na #322: o header estourava
abaixo de ~400px (394px logado / 406px deslogado, contra 360/375/390 reais) e **foi para
produção no `site`** pelo Deploy B, que levou T3.5e.

**A F7 inteira (T7.1 a T7.8) está MERGEADA em `dev` e NÃO deployada.** Três PRs:

| PR | tasks | estado | commits |
|---|---|---|---|
| #323 | T7.1, T7.2, T7.3, T7.4 | **MERGEADA** em `dev` 2026-09-15 18:04 (`5f3f4b3`) | `f15346f`, `c8fc650`, `1ed9e42`, `fc5a4fe`, `9042497` |
| #324 | T7.2, T7.3, T7.5, T7.6, T7.7 | **MERGEADA** em `dev` 2026-09-16 00:36 (`24bf887`) | `a3e1b0b`, `bab9031` |
| #325 | T7.8 | **MERGEADA** em `dev` 2026-09-16 10:46 (`8c2bbe1`) | `b22ec7e`, `287f279` |

`bab9031` é o P2 do Codex na revisão da #324: o painel de sessão não tinha `max-height`
nem `overflow`, e o que passava da viewport ficava inalcançável em landscape de celular.
Dos outros achados, o do `?q=` ignorado em `/busca/` era PROCEDENTE e foi corrigido em
T7.8; os demais ficaram improcedentes, com o motivo medido em `tasks.md` §F7 — não reabrir
sem remedir.

`287f279` é o P2 do Codex na revisão da #325: o fallback da lupa esperava 100ms fixos e
então checava `isOpen`, mas o bundle do Component UI tem 171 KB — sem cache ele ainda
está baixando aos 100ms, e o carregamento em andamento era lido como falha, abortando o
modal que ia abrir. Passou a esperar evento (`artificio:search-opened` /
`artificio:search-unavailable`), sem timer. O segundo achado dessa revisão, sobre o atalho
`/` e Shadow DOM, ficou improcedente com a medição em `tasks.md` §F7 — o bundle tem zero
`attachShadow`.

**Nenhum critério A1…H1 depende da F7.** É layout e tema, não indexação — exceto **T7.7**
(`/busca/` fora do sitemap e com `noindex`), que é SEO puro, já implementada e ainda **não
deployada**: o efeito só existe em prod, depois de promote + Deploy B.

**T7.8 mergeada em `dev`, NÃO deployada:** a busca do `site` saiu do `PagefindUI` (API
descontinuada na 1.5.0, com a 1.5.2 instalada) para o Component UI, e a `/busca/` passou a
ler o `?q=` da home. **Em produção ela ainda renderiza caixa vazia** — o conserto só existe
lá depois de promote + Deploy B, e merge em `dev` não deploya nada
(`auto_deploy_on_push: false`). Aceites medidos e as armadilhas da implementação:
`tasks.md` T7.8.

**⚠️ A F7 tem duas metades com gatilhos de deploy DIFERENTES, e confundi-las erra o
diagnóstico de "por que prod não mudou".**

A parte de header e tema vive em `packages/ui`, que **não está em `deploy_paths` de módulo
algum** (medido em `.github/deploy-manifest.json`: os 6 módulos listam só caminhos
`apps/*`). Nenhum deploy a leva sozinha: ela chega a cada app pelo build daquele app, no
deploy que ele tiver por outro motivo. Os 5 apps SPA (`mesas`, `glossario`, `downloads`,
`links`, `accounts`) seguem servindo o header anterior até terem deploy próprio — que esta
spec não prevê.

T7.6, T7.7 e T7.8 são a outra metade: vivem em **`apps/site`**, que ESTÁ em `deploy_paths`
(módulo `2`, junto com `apps/site-admin`). Um Deploy B do `site` as leva sozinho, sem
depender de nenhum outro app. São 13 arquivos de `apps/site` entre `main` e `dev`.

**O aviso de "não deployar antes de decidir sobre a F7" está SUPERADO.** Ele existia
enquanto a fase era proposta; agora o header corrigido está em `dev`, e um deploy desses
apps levaria a correção, não o estouro. O que resta é o smoke visual, que nenhum teste
alcança.

## O que fecha a spec

Os 19 critérios de `spec.md` §4. Depois de A+B+D e da troca de ingress (2026-09-16):
**15 fechados e medidos em produção** — A1, A2, B1, B2, C1, C2, D1, D2, D3, D4, D5, E1,
F1, F2 (parcial: só ausência de `Event`), F5. **1 parcial** (G1). **3 pendentes**: F3,
F4, H1.

**Ficam abertos, e nenhum depende de novo deploy:**
1. **G1** — faltam G-B/G-C/G-D, que precisam de banco com dado em CI.
2. **H1** — manual no GSC (Validate Fix em 3 linhas). Não é mais bloqueio: a propriedade
   de Domínio está verificada. É ação sua, agora liberada — o Deploy B e o D já rodaram.
3. **F3 e F4, e a validação real de F2** — exigem inspecionar o JSON-LD de uma mesa campo
   a campo (`Offer` com preço/moeda/disponibilidade, `description` por mesa) e passar a
   URL no **Rich Results Test**, que é manual. O código está em produção; falta a medição.

**E não medir sucesso pela semana seguinte** (`plan.md` §9): reindexação leva semanas a
meses. O sinal é a queda de "Rastreada, mas não indexada" contra o baseline de 03/09,
não tráfego imediato.

## Ordem sugerida

1. ~~Merge da #321 (T3.5) em `dev`.~~ ✅ feito 2026-09-14 (`1c833b5`). O CI do push
   rodou build/test e **não** deployou nada: `auto_deploy_on_push: false` em todo módulo.

   ⚠️ **A branch `feat/102-t35-indexacao-raiz-header` está ESGOTADA — não commitar nela.**
   Medido em 2026-09-15: `git branch -r --contains HEAD` devolve `origin/dev` E
   `origin/main`. Commitar aqui viola a regra de branch-sobre-branch (§PR, Commit e Push)
   e produz PR com diff errado para os bots. Trabalho novo desta spec sai de
   `git switch -c <tipo>/<escopo> origin/dev` — foi assim que nasceram
   `feat/102-f7-header-mobile-unificado` (#323, mergeada) e `feat/102-f7-busca-uniforme`
   (#324, aberta).
2. ~~Deploy A (`site` beta).~~ ✅ run `34903089436`, `success`, 2026-09-14. Recorte,
   canonical e header medidos; ver o bloco do Deploy A acima.
3. ~~Criar propriedade de Domínio no Search Console.~~ ✅ já existe e está verificada
   (mantenedor, 2026-09-14). **Deixou de bloquear o Deploy D.**
4. Promote `dev`→`main` (49 commits) — **disparado 2026-09-14, run `34907438221`**.
   **ROLLBACK: `main` estava em `31ff668`** (destino `1c833b5`). Fast-forward confirmado
   antes do disparo; nenhuma migration nova em `main..dev`, então o gate E012 não entra.
   Decisão do mantenedor registrada: *"quando falo faça o deploy, pode fazer o promote"*
   — o promote não exige mais autorização própria quando um deploy que o requer foi
   pedido.
5. ~~Deploy B (`site` prod).~~ ✅ run `34907514215`, `success`. A2, D1–D5 e os aceites de
   T3.5 medidos e verdes. O header mobile quebrado que este deploy levou foi corrigido e
   **está em prod desde a rodada de 2026-09-16** (run `35122756009`).
6. ~~Deploy D (`mesas` prod) → smoke falha → trocar ingress prod.~~ ✅ feito 2026-09-16.
   C1, C2, B1, F1, F2, F5 medidos verdes; ingress em v28. **F3 e F4 seguem sem medição.**
7. ~~Rodada de prod dos 6 módulos.~~ ✅ feita 2026-09-16 — ver a tabela de runs acima.
8. **Agora:** H1 (Validate Fix nas 3 linhas do GSC) e T6.2 (Request Indexing de ≤10 URLs).
   Os dois estavam bloqueados por deploy; não estão mais.
9. **Agora:** F3, F4 e o Rich Results Test numa URL de mesa — manual, sem dependência.
10. **Smoke visual pendente, nenhum teste alcança:** header em ≤860px e `/busca/` nos 6
    apps em produção. Exige navegador.
11. G-B/G-C/G-D quando houver banco com dado em CI — independe de deploy.

Cada passo com autorização nominal própria. Autorização de um não vale para o seguinte.
