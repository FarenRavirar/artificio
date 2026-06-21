# Tabela de PR, Merge, Deploy e Promoção — 2026-06-21

> PRs #76 e #77 **MERGEADAS**. `mesas-beta` ✅ NO AR. `dev` pronto para promote.

## 1. PRs mergeadas

| PR | Branch | O que | Status |
|----|--------|-------|--------|
| #76 | `fix/037-cloudinary-media-esm` | ESM + fail-fast + auto-deploy | ✅ mergeada (`c12167e`) |
| #77 | `fix/037-cloudinary-pnpm-prod-media` | pnpm --prod fix + docs | ✅ mergeada |

## 2. Deploy beta — ✅ CONCLUÍDO

| # | Módulo | Run | Resultado |
|---|--------|-----|-----------|
| B1 | **mesas** | `27890193745` | ✅ **SUCCESS** — 3/3 healthy, smoke 200/401/302 |
| B2 | **glossario** | `27889891463` | ✅ SUCCESS |
| B3 | **site** | `27889891603` | ✅ SUCCESS |
| B4 | **accounts** | `27889892103` | ✅ SUCCESS |

**Evidência mesas-beta:**
```text
mesas-beta-app   Up (healthy)
mesas-beta-api   Up (healthy)   ← estava em crash loop
mesas-beta-db    Up (healthy)
Smoke: home=200, me_no_cookie=401, auth_redirect=302
```

## 3. Promote dev→main ✅

| # | Ação | Run | Status |
|---|------|-----|--------|
| P1 | `promote-prod-fast-forward.yml` | `27890320975` | ✅ SUCCESS — `main` = `dev` = `df4336e` |

## 4. Deploy prod

| # | Módulo | Run | Status |
|---|--------|-----|--------|
| R1 | mesas | `27890382339` | ✅ |
| R2 | glossario | `27890383248` | ✅ |
| R3 | site | `27890383545` | ✅ |
| R4 | accounts | `27890383939` | ✅ |

## 5. Deploy links — 3 tentativas

| # | Run | Resultado |
|---|-----|-----------|
| 1 | `27890695988` | ❌ JWT_SECRET diverge — `source` quebrado (variáveis vazias) |
| 2 | `27890759220` | ❌ `links-app` unhealthy — `DATABASE_URL` corrompido (`\n` do PowerShell literal) |
| 3 | `27891034346` | 🔄 em andamento — .env reescrito localmente (bytes corretos) |

**Causa raiz:** Comandos `ssh` com `$(grep...)` dentro de double-quotes do PowerShell tinham `\n` tratado como literal, corrompendo o arquivo. `scp` + heredoc também não propagou variáveis. **Solução:** gerar senha no PowerShell, construir string com here-string (`@""@`), pipe para `ssh cat`.
