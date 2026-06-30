# 26-06-29_5 — site (CSP/busca) + accounts (página de conta)

- **Data:** 2026-06-29
- **Apps:** `apps/site` (Astro), `apps/accounts` (SSO frontend), `packages/analytics`
- **Gate:** D (por projeto)
- **Objetivo:** consertar busca do nav do site, erros de CSP em prod (artificiorpg.com), e problemas na página de conta (accounts).
- **Modo:** correção pontual virou SDD-ish (CSP = segurança transversal; accounts = SSO sagrado).
- **HANDOFF:** sessão deixada para OUTRA IA continuar. Ler este arquivo inteiro + T0 antes de agir.

---

## ESTADO ATUAL (resumo rápido)

| Thread | Estado |
|---|---|
| Site: busca do nav + CSP + avatar + analytics | ✅ **FEITO e EM PROD** (PR #112 merjada, promovida `dev→main`, deploy prod success, cache purgado) |
| Cloudflare: Detecções JS (script `jsd` injetado) | ⏳ usuário desligou no dashboard; ainda aparecia injetado no último curl (propagação). Único erro de console restante. NADA de código. |
| Accounts: "lateral branca" na página de conta | 🔴 **NÃO é bug de código** — prod roda build VELHO (pré-PR #110). Fix já está em `main`. Falta **deployar accounts em prod**. AGUARDA APROVAÇÃO. |
| Accounts: nav compartilhado da suíte na página de conta | 🔴 **feature nova, não existe no código**. Aguarda decisão do mantenedor (fazer ou não). |

---

## 1. SITE — CSP / busca do nav / avatar / analytics (CONCLUÍDO, EM PROD)

### Causa-raiz (verificada, não suposta)
Astro 6 CSP **só hasheia scripts que ele bundla**; `<script is:inline>` **nunca** é hasheado (confirmado na doc do próprio Astro: `apps/site/node_modules/astro/dist/types/public/config.d.ts §securitycsp`, linha ~675). Todos os scripts autorais do site usavam `is:inline` → theme, feedback, **SearchModal** e toc ficavam bloqueados pela CSP em prod. O script de controle do modal de busca era `is:inline` → bloqueado → **modal nunca abria** (era esse o "procurar no nav não funciona"). Pagefind ainda exige `'wasm-unsafe-eval'` (compila WebAssembly).

Diagnóstico inicial culpou Cloudflare (Rocket Loader/Email Obfuscation) — **estava ERRADO**. Rocket Loader estava off há 10 meses. O script injetado de fato é o **Bot Fight Mode / Detecções JS** (`window.__CF$cv$params` + `/cdn-cgi/challenge-platform/scripts/jsd/main.js`).

### Mudanças (commit `0bd63ca`, PR #112, já em `main`)
Arquivos: `apps/site/astro.config.mjs`, `apps/site/src/layouts/Base.astro`, `apps/site/src/components/SearchModal.astro`, `apps/site/src/components/Analytics.astro`, `specs/backlog.md`.
- `script-src`: `+ 'wasm-unsafe-eval'` (Pagefind/WASM) `+ https://static.cloudflareinsights.com` (beacon)
- `connect-src`: `+ https://cloudflareinsights.com` (envio do beacon)
- `img-src`: `+ https://*.googleusercontent.com` (avatar Google SSO)
- **SearchModal + toc**: removido `is:inline` → Astro bundla + auto-hasheia (vira `<script type=module src=/_astro/…>`)
- **theme + feedback** (precisam rodar inline cedo no `<head>`: anti-FOUC + captura cedo): seguem `is:inline` com **hash manual** em `scriptDirective.hashes`:
  - theme: `sha256-XPzs67qDe4wfXBJOkiFab5K9HDAPbNuLZRmMl1tKUho=`
  - feedback: `sha256-mySq/x1/tQ7F3zrM6N4ZGUNWaqt/Tsbz5v1uDvSJRUs=`
  - ⚠️ **FRÁGIL**: se editar o corpo desses 2 scripts, recalcular o hash (build + sha256 do inline) ou a CSP bloqueia. Sem guard de CI ainda.
- **Analytics.astro**: gtag deixou de ser `is:inline set:html` → virou `<script>` bundlado (auto-hasheado) usando `gtagSrc`/`ANALYTICS_DEFAULTS` de `@artificio/analytics`. GA4 fica pronto p/ qualquer `PUBLIC_GA_ID` sem hash manual.

### Validação (preview local, build real)
Busca abre + 5 resultados (Pagefind WASM ok); gtag dispara (gtag.js injetado, dataLayer populado, build com GA id de teste); theme/feedback rodam; **zero CSP violation** com e sem GA id. Em **beta** e **prod** confirmado por curl: CSP nova servida, SearchModal bundlado, sem inline cru.

### Deploy (feito)
- PR #112 → merge `dev` (FF, `903d1ce`).
- Promoção `dev→main` FF (workflow `promote-prod-fast-forward.yml`, run 28397263030, success). `main`==`dev`.
- Deploy site prod: `gh workflow run deploy.yml --ref main -f module=site -f mode=deploy -f env=prod` (run 28397288730, success).
- ⚠️ Auto-deploy no push NÃO subiu o site (`module=site deploy=false` — FF merge não casou `deploy_paths`). Precisou dispatch manual. **Mesmo gap atinge accounts** (ver thread 2).
- Cache do Cloudflare estava servindo HTML velho (`Cf-Cache-Status: HIT`); usuário fez **Purge Everything**. Pós-purge: `wasm=1` no cache → fix vivo.

### Pendência (lado Cloudflare, usuário) — INOFENSIVO
O card "Modo Bot Fight" mostra "Detecções JS: Ativado" como **status read-only** (tooltip: JS detections vêm junto com Bot Fight). Bot Fight já está OFF, mas o `jsd` ainda injeta. O toggle real do **JavaScript Detections standalone** fica em **Security → Settings** (Segurança → Configurações), não nesse card. **Não é bloqueante**: o erro do `jsd` é só barulho de console (script de bot bloqueado pela CSP, não roda, não quebra nada pro usuário). Pode ficar como está se não acharem o toggle. Não há fix de código (injeção na borda, conteúdo dinâmico, não hasheável).

### Analytics — situação real
- **GA4 não coleta em prod hoje**: `PUBLIC_GA_ID` NÃO está cabeado no build/deploy do site (`apps/site/Dockerfile` não recebe o ARG). Confirmado. Por isso o gtag nunca renderiza em prod → sem erro de gtag, mas também sem GA4. Código já está pronto p/ quando setarem o id (property canônica D020 = `G-8XN5BGPJP3`).
- **Beacon do Cloudflare (Web Analytics)** segue coletando — eu liberei no CSP. É o analytics que está vivo agora.
- Ligar GA4 de fato = cabear `PUBLIC_GA_ID` no Dockerfile/compose/Actions do site → é a `BL-ANALYTICS`/spec 032 (T9 = aprovação do mantenedor).

---

## 2. ACCOUNTS — "lateral branca" na página de conta (AGUARDA DEPLOY)

### Diagnóstico (verificado)
Página de conta = `apps/accounts/frontend/src/main.tsx` (`ContaView`), layout próprio `.accounts-page` (estilo tela de login). O fundo tem split proposital (`apps/accounts/frontend/src/styles.css` ~linha 51): `linear-gradient(90deg, var(--accounts-rail) 0 36%, var(--accounts-canvas) 36% 100%)`.
- O **CSS do repo já tematiza o rail** (light `#020740`; **dark `#070b1a`**) — em dark a faixa fica escura, sem branco.
- **CSS deployado em prod (`/assets/index-YGKCjD8_.css`) NÃO tem o rail dark** (`grep 070b1a` = 0; build novo = 1). Ou seja, **prod está com build velho (pré-PR #110)**. A correção já está em `origin/main` (commits `c051971`, `b7a43f1`).
- Verifiquei localmente: build de `main` + preview em dark → página toda escura (`--accounts-rail #070b1a` + `--accounts-canvas #080b18`), **sem faixa branca**.

### Conclusão: **deployar accounts em prod resolve a lateral branca.** Não precisa tocar código.

### Próximo passo (AGUARDA APROVAÇÃO NOMINAL — accounts é SSO sagrado, prod-only, sem beta)
```
gh workflow run deploy.yml --ref main -f module=accounts -f mode=deploy -f env=prod
```
Depois: smoke obrigatório login/me/logout + 1 app consumidor (AGENTS.md matriz de smoke accounts). Verificar `accounts.artificiorpg.com/assets/index-*.css` mudou de hash e tem `070b1a`.
Rollback: redeploy do commit anterior / restart container.

---

## 3. ACCOUNTS — nav compartilhado da suíte na página de conta (FEATURE NOVA, DECISÃO PENDENTE)

`main.tsx` só tem `AccountHeader`/`AccountBrand` internos — **não usa** o header da suíte (`@artificio/ui` `Header`, com links Glossário/Mesas/etc + tema + menu de conta). O usuário quer que o nav compartilhado apareça também na conta.
- É **feature nova**, não deploy. Some por design hoje.
- Toca `apps/accounts` (SSO) e possivelmente `packages/ui` → **SDD Completo + aprovação + smoke** (regra pétrea: accounts e packages/ui exigem isso).
- AGUARDA decisão: fazer ou não. Se sim, abrir tarefa/branch própria (não junto do deploy do item 2).

---

## 🚨 OUTAGE + HOTFIX DO SSO (2026-06-29, em andamento)

Ao deployar accounts em prod (run 28398923363) o **SSO caiu (502)** — `accounts-api` em crash-loop.

**Causa (confirmada na VM, read-only):**
```
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'cloudinary'
  imported from /app/packages/media/dist/index.js
```
accounts passou a usar `@artificio/media` (upload de avatar, PR #110), mas o `apps/accounts/Dockerfile` runtime só rodava `pnpm install --prod --filter @artificio/accounts` — e **pnpm `--prod` não instala deps de workspace packages no node_modules local**. `cloudinary` (dep de `packages/media`) ficou de fora → crash. Latente desde #110; só explodiu agora porque accounts estava com deploy stale (nunca subiu pós-#110).

**Não havia imagem anterior na VM** (`docker images` só tinha a quebrada) → rollback por imagem impossível → recuperação = **fix-forward**.

**Fix (commit `75f8910`, branch `fix/accounts-dockerfile-media-cloudinary`, pushada):**
Espelha o padrão JÁ EM PROD do `apps/mesas/backend/Dockerfile` — adiciona ao runtime:
```
RUN pnpm install --prod --filter @artificio/accounts --frozen-lockfile \
  && pnpm install --prod --filter @artificio/media --frozen-lockfile \
  && test -d packages/media/node_modules/cloudinary \
  || (echo "ERRO: cloudinary nao encontrado..." && exit 1)
```

**Deploy do hotfix:** `gh workflow run deploy.yml --ref fix/accounts-dockerfile-media-cloudinary -f module=accounts -f mode=deploy -f env=prod` → **run 28400194166** (mantenedor acompanha o resto).

### 2ª TENTATIVA TAMBÉM FALHOU (run 28400194166) — ROOT CAUSE REAL

O hotfix `75f8910` (adicionar `pnpm install --prod --filter @artificio/media` + `test -d`) **NÃO resolveu**. O build passou o guard (`test -d packages/media/node_modules/cloudinary` OK, build chegou no `chown` 9/10), mas o runtime quebra igual (`ERR_MODULE_NOT_FOUND 'cloudinary'`).

**Inspeção da imagem real na VM** (`docker run --rm --entrypoint sh accounts-accounts-api:latest -c '...'`, read-only):
```
/app/packages/media/node_modules/cloudinary -> ../../../node_modules/.pnpm/cloudinary@2.10.0/node_modules/cloudinary
ls .../cloudinary/package.json  ->  No such file or directory   (TARGET NÃO EXISTE)
/app/node_modules/.pnpm/  ->  tem pg-cloudflare@1.4.0, NÃO tem cloudinary@2.10.0
```
→ **Symlink pendurado.** O store `.pnpm` em `/app` reflete só o 1º install (`--filter accounts`, deps tipo pg-cloudflare). O cloudinary do 2º install (`--filter media`) NÃO ficou no store final. `test -d` é falso-positivo (segue o symlink num instante em que o alvo existia, mas não sobreviveu até a imagem final).

**Por que mesas funciona e accounts não** (comparar `apps/mesas/backend/Dockerfile` vs `apps/accounts/Dockerfile`):
- **mesas** runtime: `WORKDIR /repo`; copia **só os `package.json`** (root + `apps/mesas/backend/package.json`); roda os installs; e **copia explicitamente o `dist/` de CADA workspace package do builder** (`COPY --from=builder /repo/packages/<pkg>/dist ...`, incl. `packages/media/dist`). Store `.pnpm` limpo, criado do zero no runtime.
- **accounts** runtime: `WORKDIR /app`; faz `COPY --from=build /repo/packages ./packages` — **copia `packages` INTEIRO do build stage, com os `node_modules`/symlinks do build apontando p/ paths `/repo/.pnpm`** — e depois roda 2 `pnpm install --filter`. Isso deixa a árvore de symlink inconsistente → cloudinary fica pendurado.

**FIX RECOMENDADO (próxima IA — NÃO deployar no escuro de novo; validar com `docker build` LOCAL antes):**
Reestruturar `apps/accounts/Dockerfile` runtime stage para espelhar o padrão PROVADO do mesas:
1. Não copiar `packages` inteiro do build. Copiar só os `package.json` necessários (root + `apps/accounts/package.json` + os `package.json` dos packages, se o pnpm precisar) — slate limpo.
2. UM `pnpm install --prod` (resolver a closure inteira; evitar 2 installs `--filter` sequenciais que se sobrescrevem no `.pnpm`).
3. `COPY --from=build /repo/packages/<pkg>/dist ./packages/<pkg>/dist` para cada workspace package que o accounts usa em runtime: `config`, `auth` (dist + dist-cjs?), `ui`?, `media`. (Conferir o que `apps/accounts/dist` realmente importa.)
4. Validar LOCAL: `docker build -f apps/accounts/Dockerfile -t accounts-test .` e `docker run --rm --entrypoint sh accounts-test -c 'node apps/accounts/dist/index.js'` OU inspecionar `readlink -f /app/.../cloudinary` resolve. Só depois deployar.
   - Alternativa robusta: `pnpm deploy --filter @artificio/accounts --prod /out` (bundla closure isolada) — avaliar.

**ESTADO ATUAL:** SSO **DOWN (502)**, `accounts-api` em crash-loop. Sem imagem boa na VM. Branch `fix/accounts-dockerfile-media-cloudinary` (commit `75f8910`) tem a 1ª tentativa insuficiente — a próxima IA deve commitar a reestruturação real nessa branch (ou nova) e validar com docker build local antes de redeployar `gh workflow run deploy.yml --ref <branch> -f module=accounts -f mode=deploy -f env=prod`.

### PRÓXIMOS PASSOS (mantenedor / próxima IA)
1. Acompanhar run 28400194166 até success.
2. Verificar SSO de volta: `curl -o /dev/null -w "%{http_code}" https://accounts.artificiorpg.com/login` = 200; `/api/auth/me` sem cookie = 401; container `accounts-api` = `Up (healthy)` (`ssh faren 'docker ps --filter name=accounts-api'`).
3. Smoke SSO: login Google → /conta carrega → logout. Conferir 1 app consumidor (ex.: glossário) ainda loga.
4. Verificar de quebra que a **lateral branca sumiu** (era o objetivo original do deploy — o build novo tem `--accounts-rail #070b1a`): `curl https://accounts.artificiorpg.com/login | grep -o '/assets/index-[^"]*\.css'` mudou de `index-YGKCjD8_.css` e tem `070b1a`.
5. **Reconciliar `main`:** o hotfix está numa branch deployada direto em prod (break-glass manual). Abrir PR `fix/accounts-dockerfile-media-cloudinary` → `dev`, merge, promover `dev→main`, p/ prod == main + revisão. Sem isso, prod está à frente de main (Dockerfile).
6. Mesmo gap `BL-INFRA-AUTODEPLOY-FF`: o deploy stale de accounts escondeu esse build quebrado por semanas. CI (`lint+build+test`) NÃO builda a imagem Docker → não pegaria isso. Considerar build de imagem no CI dos apps com Dockerfile.

### DÉBITO NOVO
`BL-ACCOUNTS-DOCKERFILE-MEDIA` (registrar em backlog): Dockerfile do accounts não instalava deps de `@artificio/media` → outage de SSO. Fix em `75f8910`. Verificar se OUTROS apps que usam `@artificio/media` têm o mesmo gap (site? glossário?). Já checado: mesas OK (tem o passo). Conferir site/glossário se importam media.

## DÉBITOS / ACHADOS DE PROCESSO

- **`BL-SITE-CSP-INLINE`** já registrado em `specs/backlog.md` (parcial: fix em prod; pendências = Cloudflare Detecções JS + wiring GA4 + guard CI p/ hashes manuais).
- **Gap de auto-deploy**: merge/FF para `main` NÃO dispara deploy automático dos módulos (`deploy=false`, `deploy_paths` não casa em FF). Site precisou dispatch manual; accounts ficou stale desde o PR #110. Registrar como débito de infra (deploy.yml / fluxo de promoção). Ver `BL-SITE-CSP-INLINE` e adicionar item próprio se necessário.
- **GA4 nunca ligou em prod** (`PUBLIC_GA_ID` não cabeado) — confirma `BL-ANALYTICS`/spec 032.

---

## GIT / REFS

- Branch atual: `dev` (== `main`, == `origin/main`).
- PR #112 (site CSP): MERJADA, branch `fix/site-csp-inline-search` deletada.
- `main` em prod inclui site CSP fix. **accounts ainda não deployado.**
- Ruído de line-ending (CRLF) em `docs/api/generated/*` e `docs/api/openapi/*` aparece no `git status` — é só EOL, conteúdo idêntico ao commitado. **Não commitar.**

## PRÓXIMOS COMANDOS SUGERIDOS (para a próxima IA, após aprovação)
1. (se aprovado) deploy accounts prod — comando no item 2 acima + smoke SSO.
2. (se decidido) construir nav compartilhado na conta — branch própria, SDD.
3. Confirmar com usuário que Detecções JS propagou (curl `artificiorpg.com` → `grep jsd` deve dar 0).
4. (futuro) cabear `PUBLIC_GA_ID=G-8XN5BGPJP3` no deploy do site p/ ligar GA4 (spec 032, aprovação).

## CHECKLIST DE FECHAMENTO
- [x] Site CSP/busca/avatar/analytics: corrigido, verificado, em prod.
- [x] Backlog atualizado (`BL-SITE-CSP-INLINE`).
- [x] Sessão registrada (este arquivo) para handoff.
- [~] Accounts deploy prod — 1ª tentativa (run 28398923363) **DERRUBOU SSO (502)** por dep `cloudinary` faltando na imagem. Hotfix `75f8910` (branch `fix/accounts-dockerfile-media-cloudinary`) em deploy (run 28400194166). **Mantenedor acompanha.** Ver seção "OUTAGE + HOTFIX" acima.
- [ ] Nav compartilhado conta (aguarda decisão).
- [ ] Detecções JS confirmado off (lado usuário).
- [ ] `project-state.md` — atualizar se accounts deploy/nav avançarem.

---

## OUTAGE SSO — REGISTRO COMPLETO (handoff, 2026-06-29 ~21:20 UTC)

**SSO accounts.artificiorpg.com SEGUE EM 502 (DOWN). NÃO RESOLVIDO.** Mantenedor vai tentar com outra IA. Este registro é a verdade material; código prevalece sobre qualquer suposição abaixo.

### Linha do tempo do que foi feito (todas as ações deste chat)

1. **Diagnóstico raiz real (CONFIRMADO, com prova no log):** o deploy prod NÃO builda o branch dispatchado. `_deploy-module.yml` linhas 285-287: env=prod → `deploy_ref="origin/main"` → VM faz `git reset --hard origin/main`. Logo, dispatch `deploy.yml --ref <fix-branch>` builda CI do branch mas a **VM builda sempre `origin/main`** (prod) / `origin/dev` (beta). Os 3 primeiros deploys (runs 28400194166, 28401462019, 28402041335) buildaram `origin/main`=903d1ce (Dockerfile ANTIGO `WORKDIR /app`, sem cloudinary). Por isso davam erro idêntico — era literalmente o mesmo build, meus fixes no branch eram ignorados.

2. **Fix levado a origin/main (cadeia autorizada pelo mantenedor):**
   - PR #113 (`fix/accounts-dockerfile-media-cloudinary` → dev): Dockerfile runtime novo (`WORKDIR /repo`, double `pnpm install --prod --filter accounts && --filter media`, guard `test -f packages/media/node_modules/cloudinary/package.json`) + `cloudinary` dep direta em `apps/accounts/package.json` + `pnpm-lock.yaml`. Espelha `apps/mesas/backend/Dockerfile` (que roda em prod).
   - Check `lint + build + test` = PASS. Merge `--merge --admin` → `be7fafd` em dev.
   - Promote FF dev→main (run 28403036552) = success. `origin/main` = `be7fafd` (CONTÉM o fix; confirmado: package.json tem cloudinary, Dockerfile tem WORKDIR /repo + guard).
   - Deploy accounts prod do main (run **28403066320**) = **FAILURE**.

3. **ERRO ATUAL (run 28403066320) — MUDOU, mas ainda quebra:**
   - Build da imagem PASSOU desta vez (Dockerfile novo buildou: `#18 [runtime 8/15]` install media + guard OK; `#28 naming to docker.io/library/accounts-accounts-api:latest done`). Ou seja: **cloudinary foi resolvido no build** (guard `test -f` passou). O problema do cloudinary aparentemente foi resolvido pela imagem nova.
   - Container subiu e crashou em runtime com OUTRO módulo faltando:
     ```
     ERRO: accounts-api nao ficou healthy
     Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'jsonwebtoken' imported from /repo/packages/auth/dist/jwt.js
     ```
   - **NOVA causa provável (NÃO verificada a fundo / NÃO corrigida):** `packages/auth/dist/jwt.js` importa `jsonwebtoken`. O Dockerfile runtime novo copia `COPY --from=build /repo/packages/auth/dist` mas o `pnpm install --prod --filter @artificio/accounts` provavelmente NÃO instala `jsonwebtoken` no lugar que o `auth/dist/jwt.js` resolve. Mesmo padrão de bug do cloudinary, mas agora com `jsonwebtoken` (dep de `@artificio/auth`, workspace package). `jsonwebtoken` JÁ é dep direta de `apps/accounts/package.json` (linha ~"jsonwebtoken": "^9.0.2") — então a teoria "dep direta resolve" NÃO bateu aqui. Investigar como o ESM resolve a partir de `/repo/packages/auth/dist/jwt.js`: precisa de `jsonwebtoken` em `/repo/packages/auth/node_modules` ou `/repo/node_modules` (hoisted), e o install `--prod --filter accounts` pode não estar populando isso.

### Estado dos artefatos AGORA

- `origin/main` = `be7fafd` (tem o fix do cloudinary; **NÃO** tem fix do jsonwebtoken).
- `origin/dev` = `be7fafd` (sincronizado com main).
- Branch `fix/accounts-dockerfile-media-cloudinary` = `b6f886d` (merged, pode deletar).
- Working tree local: Dockerfile/package.json já em sync com main. Sujeira não-relacionada: `docs/api/generated/*`, `docs/api/openapi/*`, `sessoes/index.md`, `specs/backlog.md`, `.codex/config.toml` (todos M/?? pré-existentes, não tocados nesta correção).
- Container na VM: `accounts-api` crash-loop (502). Imagem nova foi buildada mas não fica healthy.

### PRÓXIMO PASSO sugerido para a próxima IA (NÃO executado)

O padrão correto é o `apps/mesas/backend/Dockerfile`. Comparar exaustivamente o Dockerfile do accounts contra o do mesas. Diferença suspeita: **mesas seta `ENV NODE_PATH=/repo/apps/mesas/backend/node_modules`** e copia `packages/auth/dist-cjs`, `changelog`, `feedback`. O accounts NÃO seta `NODE_PATH`. A resolução ESM de `jsonwebtoken` a partir de `packages/auth/dist/jwt.js` pode depender disso, OU de o `pnpm install --prod` rodar com o filtro que linke as deps de `@artificio/auth` no node_modules copiado. Hipótese a testar: o runtime precisa que `@artificio/auth` e suas deps (jsonwebtoken, google-auth-library, etc.) estejam instaladas — talvez falte um `--filter @artificio/auth` no install, OU copiar `packages/auth/node_modules`, OU o `node_modules` hoistado da raiz não está sendo preservado. **Verificar como mesas-backend faz auth funcionar** (mesas também usa @artificio/auth e está UP em prod) e replicar EXATO.

### Avisos pétreos para próxima IA

- Deploy prod SÓ builda `origin/main`. Beta SÓ builda `origin/dev`. Dispatch de branch de fix é INÚTIL para validar Docker — o build real só acontece com o código já em main/dev. Validar Dockerfile localmente com `docker build` ANTES de mexer em main (host atual NÃO tem docker — usar a VM via ssh faren ou outro ambiente).
- Cada commit/push/PR/merge/promote/deploy exige autorização nominal própria do mantenedor.
- NÃO repetir deploy às cegas. Diagnosticar a resolução de módulo ESM de verdade (qual node_modules o ESM busca a partir de cada `packages/*/dist/*.js`).

### Débito para backlog

- **BL-ACCOUNTS-DOCKERFILE-AUTH-ESM:** Dockerfile runtime do accounts não resolve `jsonwebtoken` (dep de `@artificio/auth`) em runtime ESM → `accounts-api` crash-loop → SSO 502. Mesmo padrão do cloudinary/media, agora com auth. Origem: extração de packages + Dockerfile não populando node_modules dos workspace packages. Evidência: run 28403066320, `Cannot find package 'jsonwebtoken' imported from /repo/packages/auth/dist/jwt.js`. Próximo passo: espelhar EXATO o `apps/mesas/backend/Dockerfile` (NODE_PATH, filtros de install, dist-cjs). Validar build na VM antes de tocar main.

---

## Retomada Codex — 2026-06-29 — lateral branca accounts

Escopo reduzido pelo mantenedor: **corrigir só a lateral branca**, sem nav compartilhado agora, sem commit/push/deploy.

Investigação:
- Causa CSS confirmada: `.accounts-page` usava `var(--accounts-ink)` no fundo lateral.
- Em dark, `--accounts-ink` é texto claro (`#f7f8ff`), então o rail virava branco.
- Conferido risco de deploy desta sessão: o problema grave anterior envolvia Dockerfile/runtime deps (`@artificio/media`, Cloudinary, `jsonwebtoken`). Este patch **não toca** Dockerfile, backend, `package.json`, `pnpm-lock.yaml`, API ou workspace deps. Impacto de deploy = rebuild frontend do `accounts`.

Correção aplicada:
- `apps/accounts/frontend/src/styles.css`
  - novo token `--accounts-rail`;
  - light: `#020740`;
  - dark: `#070b1a`;
  - desktop/mobile usam `var(--accounts-rail)` em vez de `var(--accounts-ink)`.

Validação local:
- `pnpm --filter @artificio/accounts build` ✅
- `pnpm --filter @artificio/accounts test` ✅ (8/8)
- `pnpm --filter @artificio/accounts lint` ✅

Estado:
- Diff local mínimo: apenas `apps/accounts/frontend/src/styles.css`.
- Nada commitado, nada pushado, nada deployado.

## Encaminhamento posterior — sessão 6

O item de accounts foi retomado e publicado na sessão `26-06-29_6_accounts_nav-compartilhado-conta`.

Resultado posterior:
- rail/lateral branca corrigido com `--accounts-rail`;
- nav/header compartilhado adicionado em `accounts`;
- PR #115 mergeado em `dev`;
- promoção `dev → main` concluída no run `28416447625`;
- deploy prod accounts disparado no run `28416458299`.

Por ordem do mantenedor, não houve acompanhamento/smoke depois do dispatch do deploy.
