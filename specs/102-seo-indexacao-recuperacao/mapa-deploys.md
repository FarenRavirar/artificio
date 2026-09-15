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
- **Distância até prod:** `origin/main..origin/dev` = **49 commits** (medido 2026-09-14,
  após o merge da #321 — `1c833b5`). F1, F3 e F4 estão inteiras em `dev`; nada delas está
  em `main`. Diff por módulo: `apps/site`+`apps/site-admin` **24 arquivos**, `apps/mesas`
  **114**, `packages/ui` **11**.

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

**Estado: commitado na PR #322** (`0b65434`, branch `fix/102-header-mobile-estrutura`,
base `origin/dev` = `1c833b5`, 10 arquivos). **NÃO mergeada, NÃO deployada.** Produção
segue com o header quebrado no celular até: merge da #322 → promote `dev`→`main` → novo
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

### Deploy D — `mesas` prod

Pré: promote `dev`→`main`. `-f module=mesas -f mode=deploy -f env=prod`.

**⚠️ A run falha o smoke por construção.** O container novo escuta `:3000` (`USER node`
não abre <1024) e o ingress de prod ainda aponta `:80` → `ERRO: smoke home esperava 200
recebeu 502`. **Não é defeito; não fazer rollback.** Passo seguinte: trocar o ingress de
prod para `mesas-app:3000` (uma linha, aprovação nominal) e remedir. Em beta o `502`
durou ~4 min.

**Fecha 8 critérios:** C1, C2, B1, E1 (confirmação), F1, F2 (com o Rich Results Test),
F3, F4, F5.

**Destrava:** H1 linha F1 (Soft 404). Sem pré-requisito pendente — a propriedade de
Domínio já está verificada e cobre `mesas.`.

### O que nenhum deploy fecha

- **G1 está parcial e não depende de deploy.** G-B, G-C e G-D exigem HTTP, mas o job
  pode subir `node server.js` em `127.0.0.1`. O que falta é **banco com dado** (o
  sitemap sai de query) — desenho próprio, ainda não feito. Sem eles, G1 não fecha e a
  classe inteira de "sitemap anuncia o que o SSR nega" volta sem quebrar teste.
- **Aceite 16 de T3.5** (header em `mesas`, `downloads`, `glossario`, `links`,
  `site-admin`, `accounts`, desktop e ≤860px). É `packages/ui`: nenhum `deploy_paths` o
  cobre. O Deploy B leva o header a `artificiorpg.com` e mais nada; os outros 5 apps
  seguem com o header antigo até terem deploy próprio, **que esta spec não prevê**.
  Além disso é layout — exige navegador, nenhum teste alcança.
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

## O que fecha a spec

Os 19 critérios de `spec.md` §4. Hoje: **3 fechados** (A1, B2, e E1 em beta), **1 parcial**
(G1), **15 pendentes**. Depois de A+B+D e da troca de ingress, fecham 14 dos 19.

**Ficam abertos mesmo com todos os deploys feitos:**
1. **G1** — faltam G-B/G-C/G-D, que precisam de banco com dado em CI, não de deploy.
2. **H1** — manual no GSC (Validate Fix em 3 linhas). Não é mais bloqueio: a propriedade
   de Domínio está verificada. É ação sua, pós-Deploy B e pós-Deploy D.

**E não medir sucesso pela semana seguinte** (`plan.md` §9): reindexação leva semanas a
meses. O sinal é a queda de "Rastreada, mas não indexada" contra o baseline de 03/09,
não tráfego imediato.

## Ordem sugerida

1. ~~Merge da #321 (T3.5) em `dev`.~~ ✅ feito 2026-09-14 (`1c833b5`). O CI do push
   rodou build/test e **não** deployou nada: `auto_deploy_on_push: false` em todo módulo.

   ⚠️ **A branch `feat/102-t35-indexacao-raiz-header` está ESGOTADA — não commitar nela.**
   Medido em 2026-09-15: `git branch -r --contains HEAD` devolve `origin/dev` E
   `origin/main`; o HEAD local (`d181ebf`) está 1 commit atrás de `origin/dev`. Commitar
   aqui viola a regra de branch-sobre-branch (§PR, Commit e Push) e produz PR com diff
   errado para os bots. Trabalho novo desta spec sai de `git switch -c <tipo>/<escopo>
   origin/dev`.
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
   T3.5 medidos e verdes. **Pendente aqui: o header mobile foi para prod quebrado.**
6. Deploy D (`mesas` prod) → smoke falha → trocar ingress prod → medir C1, C2, B1, F1–F5.
7. H1: Validate Fix nas 3 linhas do GSC. T6.2: Request Indexing de ≤10 URLs.
8. G-B/G-C/G-D quando houver banco com dado em CI — independe de deploy.

Cada passo com autorização nominal própria. Autorização de um não vale para o seguinte.
