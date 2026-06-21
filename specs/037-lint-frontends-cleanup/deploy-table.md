# Tabela de PR, Merge, Deploy e Promoção — 2026-06-21

> PR #76 **MERGEADA** (`c12167e`). `dev` = `c12167e`. VM beta em `f319aac` (PR #75, código bugado).

## 1. PR #76 ✅ MERGEADA

| # | Arquivo | Ação | Status |
|---|---------|------|--------|
| F1 | `packages/media/package.json` | `"type": "module"` (já no HEAD) | ✅ |
| F2 | `apps/mesas/backend/Dockerfile` | fail-fast cloudinary | ✅ |
| F3 | `apps/site/Dockerfile` | fail-fast cloudinary | ✅ |
| F4 | `apps/links/Dockerfile` | fail-fast cloudinary | ✅ |
| F5 | `.github/deploy-manifest.json` | `auto_deploy_on_push: false` | ✅ |
| F6 | `specs/037/tasks.md` | documentação do incidente | ✅ |

- Merge commit: `c12167e` → `dev`

## 2. Deploy beta — AGORA (dispatch manual, 4 módulos)

> **VM beta:** clone em `f319aac` (PR #75, com bug cloudinary). `dev` em `c12167e` (fix).
> `auto_deploy_on_push: false` em efeito → merge NÃO disparou deploy. Precisa dispatch manual.

**Pré-voo (read-only VM):**
```
mesas-beta-db       Up 47 min (healthy)     ← banco OK
mesas-beta-app      Up 47 min (healthy)     ← frontend OK
mesas-beta-api      Restarting (crash)      ← 🔴 bug cloudinary
site-beta-*         Up 28h (healthy)        ← 🟢
glossario-beta-*    Up 28h (healthy)        ← 🟢
```

**O que muda por módulo:**

| # | Módulo | Delta (`f319aac`→`c12167e`) | Risco | Comando |
|---|--------|------|-------|---------|
| B1 | **mesas** | Fix cloudinary ESM + fail-fast Dockerfile + `x-powered-by` + csrf/json order + globalLimiter + `auto_deploy_on_push: false` | Baixo | `gh workflow run deploy.yml -f module=mesas -f mode=deploy -f env=beta` |
| B2 | **glossario** | `x-powered-by` (1 linha no server.ts) | Baixo | `gh workflow run deploy.yml -f module=glossario -f mode=deploy -f env=beta` |
| B3 | **site** | `x-powered-by` + CSRF allowlist + globalLimiter + fail-fast Dockerfile + `express-rate-limit` dep | Baixo | `gh workflow run deploy.yml -f module=site -f mode=deploy -f env=beta` |
| B4 | **accounts** | `x-powered-by` + cookieParser/json order | Baixo | `gh workflow run deploy.yml -f module=accounts -f mode=deploy` (prod-only) |

**Nada toca:** migrations, schema, auth, contratos compartilhados, DNS/tunnel, prod.

**Critério de sucesso B1:** `mesas-beta-api` healthy + smoke `home=200`, `me_no_cookie=401`, `auth_redirect=302`.

## 3. Pós-deploy beta

Após B1-B4 verdes:
- Verificar `mesas-beta` no ar com fix cloudinary
- Smoke glossario/site/accounts beta

## 4. Commits restantes (working tree sujo)

| # | Arquivo | Ação | Status |
|---|---------|------|--------|
| D1 | `specs/backlog-audit-map.md` | Corrigido (PR #75 merged, PR #76, auto-push) | 📝 local |
| D2 | `specs/backlog.md` | BL-DEP-MESAS-AUTO-PUSH atualizado | 📝 local |
| D3 | `.specify/memory/project-state.md` | Reescrito | 📝 local |

## 5. Promoção dev → main (após beta verde)

| # | Ação | Comando | Status |
|---|------|---------|--------|
| P1 | Verificar invariante `main ⊆ dev` | `git merge-base --is-ancestor origin/main origin/dev` | ✅ OK |
| P2 | Disparar promote | `gh workflow run promote-prod-fast-forward.yml` | 🟦 mantenedor |
| P3 | Confirmar `main` = `dev` | `git log --oneline origin/main..origin/dev` vazio | ⏳ após P2 |

**Commits a promover (41):** PRs #63-#72, #73, #74, #75, #76.

## 6. Deploy prod (main) — após promover

| # | Módulo | Delta | Status |
|---|--------|-------|--------|
| R1 | mesas | Dockerfile fail-fast + media ESM + server.ts (csrf, x-powered-by, limiter) | 🔴 pendente |
| R2 | glossario | server.ts (x-powered-by) | 🔴 pendente |
| R3 | site | Dockerfile fail-fast + server.ts (x-powered-by, csrf, limiter) | 🔴 pendente |
| R4 | accounts | server.ts (x-powered-by, csrf/json order) | 🔴 pendente |
| R5 | links | App TODO (1º deploy) | 🟦 precisa tunnel/secrets |
