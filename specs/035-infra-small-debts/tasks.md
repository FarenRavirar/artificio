# Tasks — 035 (granular, por fase de bloqueio)

> Fonte única = `spec.md`. Estratégia = `plan.md`. Este arquivo = checklist executável + **descobertas completas** + **R0 RE-INVESTIGAR** por débito.
> Legenda: ✅repo (verificado no repo 2026-06-20) · ⚠️VM (sessão, re-checar VM) · 🔁npm (confirmar versão publicada) · 🟦decisão (mantenedor) · `[x]` feito · `[ ]` pendente.
> Governança: nenhuma task `[ ]` executa sem autorização nominal. VM write = aprovação pétrea (D023) + lock `/tmp/artificio-vm-mutate.lock` (D056). Tudo via PR ([[pr-obrigatorio]]).

---

# FASE 1 — Higiene

## BL-033-SECRET-BLOCK

**Descobertas (2026-06-20):**
- ✅repo `git ls-files artifacts/` = **16 tracked**: `033/glossario-{postcss,tailwind,vite}.config.*`, `033/lock.pre-zod`, `033/mesas-backend-package.json.pre-033-f3`, `033/pnpm-lock.yaml.pre-{033-f3,033-f4,033-f4b-glossario,033-f4b-tw}`, `033/pre-f{2,4}-{dep-list,outdated}.txt`, `033/pre-f5-docker-{images,ps}.txt`, `cloudinary/inventory-2026-06-17T14-21-49-005Z.json`.
- ✅repo **JÁ pushados:** aparecem em **7 commits** (`88dd0c1`, `041794e`, `11940b8`, `add03b6`, `2e7a960`, `72da8cb`, `5fd89fa`). Repo PÚBLICO → `git rm --cached` NÃO remove de histórico.
- ✅repo **scan secrets nos 16 = 0 matches** (disco atual). Cloudinary inventory: 0 `api_secret`/`secure_url`/`cloudinary://`.
- ✅repo **scan de HISTÓRICO completo (`git log -p --all` por arquivo, 2026-06-20) = 0 matches nos 16** (padrões: `refresh_token|client_secret|BEGIN|ghp_|github_pat_|xox[baprs]-|AKIA…|postgres://user:pass@|MESAS_CRON_SECRET=|JWT_SECRET=`). Confirma: nenhuma revisão antiga dos blobs continha segredo. Rewrite de histórico DESNECESSÁRIO.
- `eyJ` em lock backups = falso positivo (hash integridade pnpm).
- Dump `pre-f3-mesas-beta-dump.sql` (Google OAuth refresh tokens, 5 linhas — backlog BL-033) bloqueado GH013 ANTES do push; **não existe no disco**. Nunca exposto.
- ✅repo `.gitignore:45` = só `artifacts/lighthouse/`.
- 17+ untracked em `033/` (build/test logs) — `git add -A` os estagiaria.
- **Conclusão:** risco prospectivo. Tracked atuais públicos mas limpos → **sem rewrite de histórico**. Ação preventiva.

**R0 RE-INVESTIGAR (antes de agir):**
- [ ] R0a — `git ls-files artifacts/` → confirmar ainda 16
- [ ] R0b — re-scan secrets nos tracked (disco) → confirmar 0
- [ ] R0c — re-scan de HISTÓRICO: `git ls-files artifacts/ | while read f; do echo "$(git log -p --all -- "$f" | grep -icE 'refresh_token|client_secret|-----BEGIN|ghp_|github_pat_|xox[baprs]-|AKIA[0-9A-Z]{16}|postgres://[^ ]*:[^ @]*@|MESAS_CRON_SECRET=|JWT_SECRET=')  $f"; done` → todos 0 (feito 2026-06-20, re-confirmar se houve novos commits)
- [ ] R0d — `git status --short artifacts/` → ver untracked atuais

**Tasks:**
- [ ] T1a — `.gitignore`: trocar `artifacts/lighthouse/` (linha 45) por `artifacts/`
- [ ] T1b — `git rm --cached -r artifacts/033/ artifacts/cloudinary/` (16 destrackeados, ficam no disco)
- [ ] T1c — Validar: `git ls-files artifacts/` vazio; `git status` sem untracked de artifacts
- [ ] T1d — Registrar **E007** em `.specify/memory/errors.md` (backlog pede): dump com OAuth tokens estagiado por `git add -A`, bloqueado GH013, prevenção via gitignore
- [ ] T1e — Backlog: fechar BL-033-SECRET-BLOCK

**Rollback:** `git checkout .gitignore`; arquivos seguem no disco (rm --cached não apaga).

---

## BL-CI-ESLINT-FLAT-CONFIG — PARCIAL (código no tree)

**Descobertas (2026-06-20):**
- ✅repo já tracked: `apps/glossario/frontend/eslint.config.js`, `apps/mesas/frontend/eslint.config.js`, `packages/config/eslint.config.js` (3).
- ✅repo criados no tree (untracked): `packages/{auth,content,analytics,ui}/eslint.config.js`, `apps/accounts/eslint.config.js` (5).
- ✅repo `packages/auth/src/client.ts` já editado (`catch(error)`→`catch{}`, diff 1 linha).
- `ci.yml` lint ainda com `continue-on-error: true` (NÃO removido).
- Padrões: A (Node/backend) vs B (React frontend). Ignores por pacote: auth(`dist-cjs/**`), analytics+ui(`vitest.config.ts`), ui(+`preview/**`,`scripts/**`), accounts(`vite.config.ts`,`vitest.config.ts`,`frontend/**`,`argsIgnorePattern:^_`).
- backlog: SDD Lite, fatia própria, vai por PR.

**R0 RE-INVESTIGAR:**
- [ ] R0a — `git ls-files '**/eslint.config.js'` (3) + `git status` (5 untracked)
- [ ] R0b — revisar conteúdo dos 5 configs vs ignores listados
- [ ] R0c — `pnpm -w turbo run lint` → estado atual (com flag ainda) antes de mexer

**Tasks:**
- [ ] T2a — Revisar `packages/auth/eslint.config.js` (Pattern A + `dist-cjs/**`)
- [ ] T2b — Revisar `packages/content/eslint.config.js` (Pattern A)
- [ ] T2c — Revisar `packages/analytics/eslint.config.js` (A, ignore `vitest.config.ts`)
- [ ] T2d — Revisar `packages/ui/eslint.config.js` (A, ignore `vitest.config.ts`+`preview/**`+`scripts/**`)
- [ ] T2e — Revisar `apps/accounts/eslint.config.js` (A, ignores + `argsIgnorePattern:^_`)
- [ ] T2f — Confirmar `client.ts:112` `catch{}` correto
- [ ] T2g — `pnpm --filter <pkg> lint` exit 0 nos 5
- [ ] T2h — `pnpm -w turbo run lint` → 13/13 verde (site/site-admin stubs OK)
- [ ] T2i — SÓ ENTÃO remover `continue-on-error: true` do step Lint em `ci.yml` + atualizar comentário
- [ ] T2j — Backlog: fechar BL-CI-ESLINT-FLAT-CONFIG

**Risco:** sem flag, erro de lint novo quebra PR (intencional). Confirmar verde ANTES.
**Rollback:** restaurar flag, deletar configs, reverter client.ts.

---

## BL-DEP-MESAS-AUTO-PUSH

**Descobertas (2026-06-20):**
- ✅repo `deploy-manifest.json:17` mesas `"auto_deploy_on_push": true` — único `true` (linhas 47/75/107 = false p/ glossario/site/accounts).
- ✅repo `deploy.yml:82-142`: push + ref em `push_branches` (`dev`) + `auto=true` + `git diff` toca `deploy_paths` → `deploy=true`.
- backlog: incidente 033, 4/5 deploys auto falharam (runs `27801096700` fail etc., PRs #65/#66): ENOENT patches/ + wildcard `'*'` path-to-regexp v8. Sem válvula humana.

**R0 RE-INVESTIGAR:**
- [ ] R0a — `grep -n auto_deploy_on_push .github/deploy-manifest.json` (mesas ainda true?)
- [ ] R0b — reler `deploy.yml:82-142`

**Tasks:**
- [ ] T3a — `deploy-manifest.json`: mesas `true`→`false`
- [ ] T3b — `python -m json.tool .github/deploy-manifest.json` (válido)
- [ ] T3c — Smoke: push branch com dummy em `apps/mesas/README.md` → CI sem deploy; dispatch manual funciona
- [ ] T3d — Backlog: fechar BL-DEP-MESAS-AUTO-PUSH

**Rollback:** `false`→`true`.

---

## BL-CODERABBIT-CONFIG (novo)

**Descobertas:** ✅repo `.coderabbit.yaml` ausente na raiz → defaults genéricos.

**R0 RE-INVESTIGAR:**
- [ ] R0a — confirmar ausência do arquivo; confirmar CodeRabbit app ativo no repo

**Tasks:**
- [ ] T-CR1 — Criar `.coderabbit.yaml` (spec.md Apêndice A: profile assertive, path_instructions, petreas)
- [ ] T-CR2 — Validar no próximo PR (profile assertive + path_instructions aplicados)

**Impacto:** zero runtime.

---

# FASE 2 — Standalone

## BL-ACCOUNTS-PORT — PARCIAL (falta deploy)

**Descobertas (2026-06-20):**
- ✅repo composes já alterados no tree: `docker-compose.prod.yml` (`ports`→`expose`, 8 linhas), `docker-compose.yml` (4 linhas).
- ⚠️VM (sessão): `docker ps` accounts-api ÚNICO host-binding `0.0.0.0:3000`; Tunnel usa Docker DNS `accounts-api:3000` (`infra-map.md:48`); débito documentado desde 2026-06-04 (`infra-map.md:120`); probe `accounts-api:3000/health`=200, `172.18.0.1:3000/health`=200 (gateway, consequência do binding); `cloudflared` na `artificio_net`.
- backlog: status "local (spec 035, aguarda deploy)".

**R0 RE-INVESTIGAR (VM read-only):**
- [ ] R0a — `ssh faren docker ps` → accounts-api ainda único host-binding?
- [ ] R0b — `docker exec mesas-api wget --spider http://accounts-api:3000/health` → 200
- [ ] R0c — **provar nenhum monitor/healthcheck externo bate host:3000** (uptime/cron/etc.) — não assumir
- [ ] R0d — reler `infra-map.md:48,120`

**Tasks:**
- [x] T4a — `docker-compose.prod.yml`: `ports`→`expose` ✅ (no tree)
- [x] T4b — `docker-compose.yml`: idem ✅ (no tree)
- [ ] T4c — `pnpm --filter @artificio/accounts build` verde
- [ ] T4d — `docker compose config` parse OK (na VM)
- [ ] T4e — 🟦 Deploy prod (aprovação nominal D023): `module=accounts mode=deploy`
- [ ] T4f — Smoke OBRIGATÓRIO: health + login + me + logout (auth sagrado)
- [ ] T4g — `infra-map.md:120`: marcar resolvido; backlog: fechar

**Risco não-feliz:** `expose` corta docker-proxy; se algo externo dependia → quebra. Rollback medir tempo real (Tunnel pode cachear DNS).
**Rollback:** `expose`→`ports`, redeploy.

---

## BL-AUDIT-033 (residual — xlsx é spec 034)

**Descobertas (2026-06-20):**
- ✅repo dompurify: `apps/mesas/frontend/package.json:25` = `"^3.3.3"`. Lock = `3.4.8`. Vulnerável `<=3.4.10`. Uso `sanitize.ts` só `DOMPurify.sanitize()` (`ALLOWED_TAGS:[]`), sem `setConfig/clearConfig`.
- ✅repo form-data: lock = `4.0.5`. Vulnerável `>=4.0.0 <4.0.6`. **CORREÇÃO (pnpm why, 2026-06-20):** form-data tem **3 caminhos**, NÃO só axios:
  - `axios@1.18.0` → `glossario-frontend` (dependency, prod)
  - `superagent@10.3.0` → `supertest@7.2.2` → **accounts + mesas-backend** (devDeps, test infra)
  - `@types/superagent` → `@types/supertest` → accounts + mesas-backend (devDeps, tipos)
  - **Override `form-data: 4.0.6` é GLOBAL** → bumpa também o form-data do supertest. `pnpm audit --prod` não pega (dev), mas a resolução de teste muda. Risco: supertest/superagent quebrar em runtime de teste.
- ✅repo 🔁npm `dompurify@3.4.11` e `form-data@4.0.6` **confirmados publicados** (`pnpm view`, 2026-06-20).
- ✅repo `pnpm-workspace.yaml` SEM chave `overrides` (só `patchedDependencies`, `allowBuilds`). Criar a chave.
- nanoid/uuid: patched existem mas parents pinam (uuid MAJOR 8→11). Bloqueado upstream.
- backlog: dompurify bump + form-data override = SDD Lite; xlsx = spec 034.

**R0 RE-INVESTIGAR:**
- [ ] R0a — `grep dompurify apps/mesas/frontend/package.json` + `grep -n "form-data@\|dompurify@" pnpm-lock.yaml`
- [ ] R0b — 🔁 `pnpm view dompurify@3.4.11 version` + `pnpm view form-data@4.0.6 version` (feito 2026-06-20: ambos existem; re-confirmar se yanked)
- [ ] R0c — `pnpm why form-data` (feito: 3 caminhos — axios/glossario + superagent/supertest accounts+mesas-backend). Re-confirmar se deps mudaram
- [ ] R0d — `pnpm audit --prod` (baseline atual, confirmar 7)

**Tasks:**
- [ ] T5a — Bump `apps/mesas/frontend/package.json` dompurify `^3.3.3`→`^3.4.11`
- [ ] T5b — `pnpm-workspace.yaml`: adicionar
  ```yaml
  overrides:
    form-data: 4.0.6
  ```
- [ ] T5c — `pnpm install` (regenera lock)
- [ ] T5d — `pnpm audit --prod` → 7→4 (2 xlsx + nanoid + uuid)
- [ ] T5e — `pnpm --filter @artificio/mesas-frontend build` verde (sanitize.ts)
- [ ] T5f — `pnpm --filter @artificio/glossario-frontend build` verde (axios→form-data)
- [ ] T5g — **Smoke de TESTE (override pega supertest):** `pnpm --filter @artificio/accounts test` + `pnpm --filter @artificio/mesas-backend test` verdes — provar que supertest/superagent não quebrou com form-data 4.0.6
- [ ] T5h — `pnpm why form-data` pós-install: confirmar resolução única em 4.0.6, sem duplicata
- [ ] T5i — Backlog: atualizar BL-AUDIT-033 (dompurify+form-data fechados; xlsx/nanoid/uuid pendentes)

**Risco não-feliz:** override global pega 3 caminhos, incluindo **supertest** (test infra accounts+mesas-backend) — NÃO só axios. Se supertest 7.2.2/superagent 10.3.0 exigir form-data <4.0.6, testes quebram. T5g é gate obrigatório antes de fechar.
**Rollback:** reverter bump+override, `pnpm install`.

---

## BL-DEP-MESAS-LEGACY-SCRIPTS — 🟦 CUIDADO (não é duplicata simples)

**Descobertas (2026-06-20):**
- ✅repo `apps/mesas/scripts/`: `deploy/` (6), `ops/`, `sdd/`, `deploy-beta.ps1`, `pre-commit`, `README.md`.
- ✅repo `apps/mesas/scripts/deploy/` (6): `apply_required_migrations.sh`, `apply_required_migrations.sh.bak` (11854B), `deploy-prod.sh`, `lib_migrations.sh`, `preflight_prod.sh`, `reconcile_migrations.sh`.
- ✅repo root `scripts/deploy/` (5): `apply_required_migrations.sh`, `lib_migrations.sh`, `test_branch_invariant.sh`, `test_migration_lock.sh`, `validate_branch_invariant.sh`.
- ✅repo **CONJUNTOS DISJUNTOS** — só 2 nomes coincidem (`apply_required_migrations.sh`, `lib_migrations.sh`), divergem em tamanho/SHA. App tem deploy-prod/preflight/reconcile+.bak; root tem testes branch invariant. NÃO é "app duplica root".
- sessão (⚠️ re-verificar): zero refs vivas; `turbo.json` mesas não cobre `scripts/`; paths pré-monorepo (`/opt/mesas`, `C:\projetos\config`); sem segredos; `_deploy-module.yml:441` usa migrations.
- backlog: limpar depois que `_deploy-module` for fonte única.

**R0 RE-INVESTIGAR:**
- [x] R0a — `ls apps/mesas/scripts/ apps/mesas/scripts/deploy/ scripts/deploy/` (re-comparar conjuntos) ✅ spec 050 T8
- [x] R0b — `rg -n "mesas/scripts|deploy-beta|hydrate_beta|preflight_prod|reconcile_migrations|pre-commit" --glob '!node_modules' --glob '!pnpm-lock.yaml'` → 0 vivas ✅ spec 050 T8
- [x] R0c — `grep -n apply_required_migrations .github/workflows/_deploy-module.yml` → confirma usa root (path) ✅ spec 050 T8
- [x] R0d — `diff apps/mesas/scripts/deploy/apply_required_migrations.sh scripts/deploy/apply_required_migrations.sh` (confirmar divergência) ✅ spec 050 T9
- [x] R0e — scan segredos nos scripts (`rg -i "secret|token|password|BEGIN" apps/mesas/scripts/`) ✅ spec 050 T10

**Tasks:**
- [x] T6a — 🟦 Decisão escopo: **A** = só `apps/mesas/scripts/deploy/` (6) | **B** = `apps/mesas/scripts/` inteiro ✅ escopo A escolhido (spec 050 T12)
- [x] T6b — Remover conforme escopo ✅ spec 050 T12
- [x] T6c — `pnpm --filter @artificio/mesas-backend build` + `--filter @artificio/mesas-frontend build` verdes ✅ spec 050 T13
- [x] T6d — Backlog: fechar BL-DEP-MESAS-LEGACY-SCRIPTS ✅ spec 050 T14

**Risco não-feliz:** se workflow referencia app-level → quebra deploy. Provar canonicidade (R0c) antes.
**Rollback:** `git revert`.

---

## BL-SITE-ADMIN-TS-VARIANCE — no-op

**Descobertas (2026-06-20):** sessão `tsc --noEmit --strict`=0 erros; `admin-api.ts:220` tem `as any` que suprime mismatch multer×express; site sem script `typecheck` (tsc nunca roda; `build`=astro build). `@types/multer@^2.1.0`, `multer@^2.2.0`. Sem erro real.

**R0 RE-INVESTIGAR:**
- [ ] R0a — `cd apps/site && npx tsc --noEmit` → confirmar 0 erro
- [ ] R0b — checar `as any` em `admin-api.ts:220`

**Tasks:**
- [ ] T7a — (Opcional, futuro) tipar `req/res` corretos quando `admin-api.ts` for refatorado

---

# FASE 3 — Funcionalidade quebrada

## BL-MESAS-AUTO-ARCHIVE-CF

**Descobertas (2026-06-20):**
- Causa: `mesas-auto-archive.yml` curl público (runner GitHub) → Cloudflare 403 challenge (`Just a moment...`). backlog run `27607245699`.
- ⚠️VM (sessão): `docker exec mesas-api sh -c 'wget ... -H "x-cron-secret: $MESAS_CRON_SECRET" ...'` → **200 `count:13`** (arquivou 13 mesas em PROD — mutação, não read-only). `curl` ausente no Alpine; Docker DNS não resolve no host. Gates `adminTables.ts:15-49`: NODE_ENV=prod + secret + timingSafeEqual. Secret no `.env` da VM + ambiente do container (64 hex). Idempotente (`WHERE archived_at IS NULL`).
- backlog: mover execução para caminho interno seguro; validar com dispatch sem expor segredo.

**⚠️ ALERTA:** próximo POST real arquiva mesas (mutação prod) → tratar como write VM (D023 aprovação + D056 lock). NÃO repetir em re-investigação.

**R0 RE-INVESTIGAR (read-only, NÃO disparar POST):**
- [ ] R0a — `ssh faren "docker exec mesas-api sh -c 'env | grep MESAS_CRON_SECRET >/dev/null && echo SET'"` → SET
- [ ] R0b — reler `mesas-auto-archive.yml` + `docker-cleanup.yml` (padrão SSH)
- [ ] R0c — confirmar endpoint vivo SEM mutar: GET ou secret errado → 401 (não 200)

**Tasks:**
- [ ] T8a — Editar `mesas-auto-archive.yml`: SSH + `docker exec mesas-api sh -c 'wget -qO- --post-data="" --header="x-cron-secret: $MESAS_CRON_SECRET" --header="content-type: application/json" http://localhost:3000/api/v1/admin/tables/auto-archive'`. Padrão SSH=`docker-cleanup.yml`. Remover `env.CRON_SECRET`, manter `permissions: {}`.
- [ ] T8b — 🟦 `workflow_dispatch` (aprovação — pode arquivar): confirmar HTTP 200 + `count`
- [ ] T8c — 2º dispatch idempotente (`count:0`)
- [ ] T8d — Backlog: fechar BL-MESAS-AUTO-ARCHIVE-CF

**Rollback:** `git revert` ou re-dispatch workflow antigo.

---

## BL-SITE-PRINCIPAL-GAPS

**Descobertas (2026-06-20):**
- (A) ⚠️VM `PUBLIC_GA_ID=G-8XN5BGPJP3` no `.env` prod da VM (NÃO auditável em PR). Beta sem tracking por design.
- (B) ✅repo `[newsletter]` literal em `pages.json`, sem template Astro.
- (C) ✅repo `posts.json` (14 refs) + `pages.json` (6 refs) com `wp-content/uploads`, tracked. Live site limpo (VM regenera). Repo = build antigo.
- (D) ⚠️ `/sitemap.xml` 404; `/sitemap-index.xml` 200 (Astro `@astrojs/sitemap`).
- (E) ✅repo sem página contato dedicada (WP Contact Form 7 não migrado).
- backlog BL-SITE-CUTOVER-029 follow-up; (A) desbloqueia Spec 032.

**R0 RE-INVESTIGAR:**
- [ ] R0a — (A) `ssh faren "grep PUBLIC_GA_ID /opt/artificio/apps/site/.env"` → valor
- [ ] R0b — (C) `grep -rn wp-content/uploads apps/site/src/data/` → refs
- [ ] R0c — (D) `curl -sI https://artificiorpg.com/sitemap.xml` (404?) + `/sitemap-index.xml` (200?)
- [ ] R0d — (B)(E) `grep -n "newsletter\|contato" apps/site/src/data/pages.json`

**Tasks:**
- [ ] T9a — (A) re-confirmar `PUBLIC_GA_ID` na VM (não fechar por sessão)
- [ ] T9b — (D) redirect 301 `/sitemap.xml`→`/sitemap-index.xml` no Astro
- [ ] T9c — (C) `apps/site/src/data/`→`.gitignore` OU regenerar limpo e commitar
- [ ] T9d — (B) `newsletter.astro` (form real) OU remover página
- [ ] T9e — (E) `contato.astro` (form ou email link)
- [ ] T9f — Backlog: fechar gaps resolvidos

---

## BL-SITE-ADMIN-WP-PUBLISH-GUARD

**Descobertas (2026-06-20):**
- ✅repo `pruneWpAssets` em `importer/media.ts:152` (remove `<a>/<img>/<audio>/<video>/<source>` com `/wp-content/uploads/`) — só no import, não no server.
- `cleanHtml` (server/lib/sanitize-html.ts) sanitiza XSS mas NÃO remove wp-content. `export.ts` também não filtra.
- Risco mínimo HOJE: admin sem autoria (site migrado); uploader=Cloudinary; WP EOL ~2026-06-20.

**R0 RE-INVESTIGAR:**
- [ ] R0a — `grep -n pruneWpAssets apps/site/importer/media.ts`
- [ ] R0b — confirmar `cleanHtml`/`export.ts` não filtram wp-content
- [ ] R0c — confirmar admin sem autoria ativa

**Tasks:**
- [ ] T10a — Mover `pruneWpAssets`→`server/lib/` + chamar `buildPost`/`buildPage`, OU rejeitar `wp-content/uploads` no save (400)

**Prioridade:** sobe quando admin voltar a autoria com editor de blocos.

---

# FASE 4 — Spec própria / decisão maior

> Cada um abre sessão própria. R0 obrigatório no início.

## Spec 032 (BL-ANALYTICS) — ~85%
**Descobertas:** site+glossario servem `G-8XN5BGPJP3` (✅); mesas NÃO (container prod 2026-06-18 sem GA). Código T1-T8b pronto. T9 (GA_ID) ⚠️VM resolvido.
**R0:** curl 3 hosts por `G-8XN5BGPJP3`; data do container mesas (`ssh faren docker ps`).
- [ ] T-032a — 🟦 Deploy mesas prod: `module=mesas mode=deploy env=prod`. Smoke: home 200, `/api/v1/me/options` 401, HTML serve `G-8XN5BGPJP3`
- [ ] T-032b — Docs: fechar BL-ANALYTICS no backlog, nota D020, project-state
- [ ] T-032c — 🟦 (mantenedor) GA4 admin: referral interno, data streams, aposentar `G-XMRHY3FE58`

## Spec 028 (BL-SITE-VM-MEDIA-LIBRARY) — 0%
**Descobertas:** 7 rescued em `C:\projetos\artificiobackup\site-cloudinary\rescued-pdfs\` (6 PDF 16-22MB + avatar 140KB); `ALLOWED_MIME` sem `application/pdf`; multer 15MB; sem volume Docker persistente nos composes; `media-store.ts` local efêmero; sem UI biblioteca. 14 tasks.
**R0:** `grep ALLOWED_MIME` + multer limit + volume composes; `ls` rescued PDFs.
- [ ] T-028 — Executar spec 028 (14 tasks: volume VM, MIME+pdf, multer ≥25MB, destino VM×Cloudinary, migration pastas, CRUD, UI, ações, serviço público, upload PDFs, reescrever links, validação, re-host avatar, docs). SDD Completo ~3-5 sessões.

## D-DEP2 — ~95%
**Descobertas:** spec 033 resolveu Docker 29.6.0, containerd 2.2.5, apt 0 sec, Node 24.17.0, pnpm 11.8.0. Pendente opcional: turbo 2.9.16→18, @types/react 19.2.16→17 (patch); pular @types/node 24→25, vitest 3→4 (MAJOR); `node:20-alpine` órfão na VM.
**R0:** `pnpm outdated`; `ssh faren docker images | grep node`.
- [ ] T-DEP2a — (Opcional) bump turbo + @types/react patches
- [ ] T-DEP2b — (Opcional) 🟦 `docker image prune -f` na VM (write)

## BL-GLOSSARIO-LEGACY-CLEAN
**Descobertas (⚠️DB):** 38 users; 2 com `sso_user_id NOT NULL` + hash BCRYPT obsoleto (paulohenriquercc, rodovalhomf); 36 sem SSO mantêm hash p/ `/api/migration/verify`. Nenhum `password_hash='SSO_NO_PASSWORD'`. Migration afeta 2.
**R0:** query DB count + grupos (re-verificar números antes de UPDATE).
- [ ] T-GLCa — `pg_dump` glossario off-VM (backup)
- [ ] T-GLCb — 🟦 `UPDATE users SET password_hash=NULL WHERE sso_user_id IS NOT NULL AND password_hash IS NOT NULL AND password_hash!='SSO_NO_PASSWORD'` (write VM)
- [ ] T-GLCc — Smoke: login Google dos 2 + `/api/migration/verify` de email não-linkado (36 ainda funcionam)
- [ ] T-GLCd — Backlog: fechar

## BL-CONFIG-AUTH — SDD Completo
**Descobertas:** `@artificio/config` só `parseEnv`; `@artificio/auth` `authFetch` básico; ~20 hardcodes (`accounts.artificiorpg.com` 6×, `authFetch`+refresh 3×, `artificiorpg.com` ~10×, `getAccountsOrigin` local mesas, `module.manifest.ts` só mesas). Auth sagrado.
**R0:** `rg "accounts.artificiorpg.com|artificiorpg.com"` re-contar; estado `packages/config`.
- [ ] T-CFGA1..9 — domains.ts catálogo; buildLoginUrl/sanitizeReturnUrl/isArtificioHttpsUrl/publicOriginForModule; HTTP client unificado; consumir config no auth; migrar site-admin/mesas/glossario/Astro; smoke SSO cross-subdomínio TODOS.

## BL-INFRA-GHCR-F12 — decisão
**Descobertas:** VM ARM64 (Oracle Ampere); runners x86 → buildx+QEMU (2-4x lento, risco bcrypt/sharp). Build atual na VM `--no-cache --pull` (`_deploy-module.yml:444`). 6 Dockerfiles, 29 imgs 8.8GB, cache 9.3GB. GHCR nunca usado. Alt: remover `--no-cache` + BuildKit cache mounts (1 sessão, baixo risco).
**R0:** `ssh faren uname -m`; imagens/cache VM.
- [ ] T-F12a — 🟦 Decisão: GHCR+QEMU (5-8 sessões, alto risco) vs cache incremental VM (1, baixo)
- [ ] T-F12b — Implementar conforme decisão

---

# FASE 5 — Bloqueados externamente

## BL-BETA-HYDRATE
**Descobertas:** endpoint `POST /api/v1/admin/sync/hydrate` (`adminHydration.ts`) + `prodDb` (`db/prod.ts` lazy via `PROD_DB_URL`) + compose beta `PROD_DB_URL=${PROD_DB_URL}` prontos. `.env.beta` NÃO tem a var (4× 500 em 2026-06-05). Beta 14 users vs Prod 15. `mesas-db:5432` via Docker DNS. ⚠️ usa creds admin RW p/ op read-only.
**R0:** `ssh faren "grep PROD_DB_URL /opt/artificio/apps/mesas/.env.beta"`.
- [ ] T-HYDa — 🟦 Decisão: admin creds vs criar user read-only
- [ ] T-HYDb — 🟦 (mantenedor/write) setar `PROD_DB_URL` no `.env.beta`
- [ ] T-HYDc — Redeploy mesas beta + testar hydrate
- [ ] T-HYDd — Smoke beta: home 200, `/api/v1/me/options` 401
## BL-LINKS-013 + BL-NAV-LINKS-014 — CÓDIGO CONCLUÍDO LOCAL (atualizado 2026-06-20)

**⚠️ Mudança de escopo (D085):** o mantenedor expandiu de "página Astro estática" para **diretório comunitário com moderação** (SSO + DB + Cloudinary + submissão da comunidade + admin). **SDD Completo.** Fonte canônica = **`specs/013-links-regras-restore/{spec,plan,tasks}.md`**. Aqui fica só o ponteiro.

**Estado:** código F0–F5+TC5+UX+limpezas CONCLUÍDO LOCAL. Build 15 páginas verde. NADA commitado. Dockerfile/compose Express+DB + entrada `deploy-manifest.json` + `"links"` no enum `deploy.yml` feitos.

**🟦 Bloqueios (mantenedor):** Tunnel `links.` (token CF sem escopo), `.env`/secrets VM, deploy dispatch. Smoke nav consumidores pós-deploy.

## BL-SITE-GATED
**Descobertas:** 9 critérios Gate D concluídos; 4 débitos filhos pendentes + E2E mantenedor.
**R0:** estado dos 4 filhos.
- [ ] T-GATED1..4 — Resolver CMS-PARITY, PRINCIPAL-GAPS, MEDIA-LIBRARY, WP-GUARD
- [ ] T-GATED5 — 🟦 (mantenedor) E2E autenticado: login admin→criar post→publicar→ver no site

---

# FASE 6 — Grandes (SDD próprio)

## BL-SITE-CMS-PARITY (Spec 011)
**Descobertas:** Fases 0-2 deployadas; T20 (taxonomias P0), T26 (lista editorial P1), T27 (agendamento P1), T29 (roles P1) bloqueiam Gate D. D051 BlockNote, D052 roles no site, D053 SSG atômico.
**R0:** estado T20/T26/T27/T29.
- [ ] T-CMS1 — T20 CRUD taxonomias
- [ ] T-CMS2 — T26 lista editorial
- [ ] T-CMS3 — T27 agendamento real
- [ ] T-CMS4 — T29 roles editoriais

## Spec 022 / 025 / Shared
- [ ] Spec 022 — 12 itens UI tokens (T8→T15)
- [ ] Spec 025 — 4 itens (perf mesas, security headers, a11y sweep, third-party), baseline cada
- [ ] Shared — BL-SEO-SHARED, BL-NORMALIZERS, BL-COPY-PUBLICA quando app público novo precisar

---

# Fechamento (após cada fase)

- [ ] TF1 — `specs/backlog.md`: marcar débitos fechados
- [ ] TF2 — `.specify/memory/project-state.md`
- [ ] TF3 — `.specify/memory/errors.md` (E007)
- [ ] TF4 — `sessoes/index.md` + sessão da execução
- [ ] TF5 — Confirmar nenhum arquivo parcialmente modificado entre PRs

---

## Resumo de verificação pendente (re-checar antes de fechar)

| Item | Tipo | Comando R0 |
|---|---|---|
| accounts host:3000 sem consumidor externo | ⚠️VM | `ssh faren docker ps` + provar monitores |
| `PUBLIC_GA_ID` no `.env` site prod | ⚠️VM | `ssh faren grep PUBLIC_GA_ID .../site/.env` |
| mesas prod container tem GA | ⚠️VM | curl host + `docker ps` data |
| glossario 38 users / 2 com SSO | ⚠️DB | query count |
| `MESAS_CRON_SECRET` no container | ⚠️VM | `docker exec mesas-api env` |
| scripts mesas: 0 ref viva + canonicidade root | ✅repo | `rg` + `diff` + `_deploy-module.yml` |
| dompurify@3.4.11 / form-data@4.0.6 publicados | 🔁npm | ✅ feito 2026-06-20 |
| `pnpm why form-data` (3 caminhos) | 🔁npm | ✅ feito 2026-06-20 |
| VM é ARM64 | ⚠️VM | `ssh faren uname -m` |
| `.env.beta` tem PROD_DB_URL | ⚠️VM | `ssh faren grep PROD_DB_URL .../mesas/.env.beta` |

---

# RUNBOOK — Re-verificação na execução (residuais ⚠️VM)

> Estes itens NÃO foram verificáveis no planejamento (sem acesso VM/DB daqui). São **gates de abertura** de cada débito VM. Rodar NA HORA, read-only, antes de qualquer write. `ssh faren` = acesso read-only sem aprovação (D023). Caminho VM base: `/opt/artificio/`. Ajustar path se diferir — confirmar com `ssh faren "ls /opt/artificio/apps"`.

## RV-1 — accounts host:3000 (BL-ACCOUNTS-PORT)
- **Onde olhar:** VM `docker ps`; `apps/accounts/docker-compose.prod.yml`; `infra-map.md:48,120`; Cloudflare Tunnel config.
- **Comandos:**
  ```
  ssh faren "docker ps --format '{{.Names}}\t{{.Ports}}' | grep -E 'accounts|3000'"
  ssh faren "docker exec mesas-api wget -qS --spider http://accounts-api:3000/health 2>&1 | head -1"
  ssh faren "ss -tlnp | grep ':3000'"
  ssh faren "docker exec cloudflared sh -c 'wget -qO- http://accounts-api:3000/health' 2>&1 | head -c100"
  ```
- **Esperado:** accounts-api binding `0.0.0.0:3000`; `accounts-api:3000/health`=200 de outro container; cloudflared resolve `accounts-api`.
- **Negativa ilimitada (host:3000 sem consumidor):** não há prova absoluta. Mitigar: `ssh faren "grep -rE '172\\.|localhost:3000|:3000' /opt/artificio/**/.env* 2>/dev/null"` + revisar crons (`crontab -l`, `ls /etc/cron*`) + uptime/monitor externo. Se algum bate host:3000 → NÃO trocar p/ expose.
- **PASS:** Tunnel via Docker DNS confirmado + nenhum consumidor de host:3000 encontrado.
- **FAIL:** qualquer cron/monitor/env aponta host:3000 → reavaliar, não deployar.
- **Pós-deploy (write, aprovação):** smoke `https://accounts.artificiorpg.com/health` 200 + login + `/me` + logout. Se falhar → rollback `expose`→`ports` imediato.

## RV-2 — MESAS_CRON_SECRET no container (BL-MESAS-AUTO-ARCHIVE-CF)
- **Onde olhar:** ambiente do container mesas-api; `apps/mesas/backend/.../adminTables.ts:15-49`; `mesas-auto-archive.yml`; `docker-cleanup.yml` (padrão SSH).
- **Comandos (read-only, NÃO dispara archive):**
  ```
  ssh faren "docker exec mesas-api sh -c 'test -n \"\$MESAS_CRON_SECRET\" && echo SET || echo MISSING'"
  ssh faren "docker exec mesas-api sh -c 'wget -qO- --post-data=\"\" --header=\"x-cron-secret: ERRADO\" --header=\"content-type: application/json\" http://localhost:3000/api/v1/admin/tables/auto-archive; echo'"
  ```
- **Esperado:** `SET`; secret errado → **401** (endpoint vivo, não muta).
- **PASS:** SET + 401 com secret errado.
- **FAIL:** MISSING (secret não no container → editar workflow não resolve) ou 200 (mutou! não era pra arquivar).
- **⚠️ NÃO** rodar POST com secret correto na re-verificação — arquiva mesas (write prod, D056 lock). Só no `workflow_dispatch` autorizado (T8b).

## RV-3 — PUBLIC_GA_ID site prod (BL-SITE-PRINCIPAL-GAPS / Spec 032)
- **Onde olhar:** `.env` prod do site na VM; HTML servido pelo host público.
- **Comandos:**
  ```
  ssh faren "grep PUBLIC_GA_ID /opt/artificio/apps/site/.env"
  curl -s https://artificiorpg.com/ | grep -oE 'G-[A-Z0-9]{8,}' | sort -u
  ```
- **Esperado:** `.env` = `G-8XN5BGPJP3`; HTML público serve o mesmo ID.
- **PASS:** ambos = `G-8XN5BGPJP3`.
- **FAIL:** `.env` vazio ou HTML sem `G-` → gap (A) NÃO fechado; reabrir.

## RV-4 — mesas prod serve GA (Spec 032)
- **Onde olhar:** container mesas prod (data de build), HTML público mesas.
- **Comandos:**
  ```
  ssh faren "docker ps --format '{{.Names}}\t{{.CreatedAt}}' | grep mesas-api"
  curl -s https://mesas.artificiorpg.com/ | grep -oE 'G-[A-Z0-9]{8,}' | sort -u
  ```
- **Esperado:** se HTML NÃO tem `G-8XN5BGPJP3` → deploy mesas pendente (T-032a).
- **PASS (p/ fechar 032):** HTML mesas serve `G-8XN5BGPJP3` pós-deploy.

## RV-5 — glossario users / migration (BL-GLOSSARIO-LEGACY-CLEAN)
- **Onde olhar:** DB glossario (`glossario-db` na `artificio_net`); `migrationController.ts`.
- **Comandos (read-only):**
  ```
  ssh faren "docker exec glossario-db psql -U <user> -d <db> -tc \"SELECT count(*) total, count(*) FILTER (WHERE sso_user_id IS NOT NULL) com_sso, count(*) FILTER (WHERE sso_user_id IS NOT NULL AND password_hash IS NOT NULL AND password_hash!='SSO_NO_PASSWORD') alvo_migration FROM users;\""
  ssh faren "docker exec glossario-db psql -U <user> -d <db> -tc \"SELECT email FROM users WHERE sso_user_id IS NOT NULL AND password_hash IS NOT NULL AND password_hash!='SSO_NO_PASSWORD';\""
  ```
- **Esperado:** total 38, com_sso 2, alvo_migration 2 (paulohenriquercc, rodovalhomf).
- **PASS:** números batem com planejamento.
- **FAIL:** alvo ≠ 2 → re-derivar WHERE antes de UPDATE. **NUNCA** UPDATE sem `pg_dump` antes (T-GLCa).
- **Write (aprovação D023 + backup):** após pg_dump, rodar UPDATE; smoke login Google dos 2 + `/api/migration/verify` de email não-linkado (36 ainda BCrypt).

## RV-6 — .env.beta PROD_DB_URL (BL-BETA-HYDRATE)
- **Onde olhar:** `.env.beta` mesas na VM; compose beta; `db/prod.ts`.
- **Comandos:**
  ```
  ssh faren "grep -c PROD_DB_URL /opt/artificio/apps/mesas/.env.beta"
  ssh faren "docker exec mesas-db pg_isready"
  ```
- **Esperado:** se count=0 → bloqueado (mantenedor seta segredo). DB reachable.
- **PASS p/ desbloquear:** PROD_DB_URL presente + mesas-db pronto.

## RV-7 — VM ARM64 (BL-INFRA-GHCR-F12)
- **Comando:** `ssh faren "uname -m"`
- **Esperado:** `aarch64` → confirma decisão GHCR+QEMU vs cache incremental. Se `x86_64` → reavaliar premissa toda.

## RV-8 — scripts mesas refs vivas (BL-DEP-MESAS-LEGACY-SCRIPTS) — ✅repo, re-confirmar
- **Comandos:**
  ```
  rg -n "mesas/scripts|deploy-beta|hydrate_beta|preflight_prod|reconcile_migrations" --glob '!node_modules' --glob '!pnpm-lock.yaml' --glob '!specs/**'
  grep -n "scripts/deploy" .github/workflows/_deploy-module.yml
  ```
- **Esperado:** 0 refs vivas (fora de specs/docs); `_deploy-module.yml:441` = `../../scripts/deploy/` (root). App-level mesas NÃO referenciado.
- **PASS:** 0 vivas + root confirmado → remoção segura.
- **FAIL:** qualquer workflow/código vivo referencia `apps/mesas/scripts/` → NÃO remover esse arquivo.
