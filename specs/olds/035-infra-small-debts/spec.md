> **⚠️ Nota GA4 (D117, 2026-07-20):** referências a `PUBLIC_GA_ID=G-8XN5BGPJP3` abaixo são histórico. Property GA4 mudou de única (D020) para 1-por-app; ver `.specify/memory/decisions.md` D117.

# 035 — Débitos de Infra: Plano de Resolução (doc único)

- **Propósito:** Documento ÚNICO e completo para resolver todos os débitos abertos em série, ordenados por bloqueio. Cada item tem estado real verificado, ação, arquivos, validação e rollback.
- **Gate:** D
- **Atualizado:** 2026-06-20
- **Regra:** investigação registrada. Nenhuma resolução aplicada hoje além do que já consta em "JÁ APLICADO" abaixo. Execução = fim de semana, com autorização nominal por ação ([[no-auto-commit]], [[pr-obrigatorio]]).

> `plan.md` e `tasks.md` desta pasta são notas de trabalho anteriores. **Este `spec.md` é a fonte única.**

---

## Legenda de verificação

| Marca | Significado |
|---|---|
| ✅ repo | Verificado contra o repositório local em 2026-06-20 (factual, auditável em PR) |
| ⚠️ VM | Afirmação vem de sessão/probe na VM. **NÃO auditável no PR** (`.env`/estado runtime). Re-checar na VM antes de fechar |
| 🔁 npm | Depende de versão publicada no npm. Confirmar com `pnpm view <pkg> versions` antes do bump |
| 🟦 decisão | Precisa decisão do mantenedor antes de executar |

---

## ⚠️ ESTADO ATUAL DO WORKING TREE (já modificado, não commitado)

Estes arquivos **já foram alterados** em sessão anterior e estão no working tree. Decidir: incluir no 1º PR ou reverter.

| Arquivo | Mudança | Débito |
|---|---|---|
| `apps/accounts/docker-compose.prod.yml` | `ports`→`expose` (8 linhas) | BL-ACCOUNTS-PORT |
| `apps/accounts/docker-compose.yml` | `ports`→`expose` (4 linhas) | BL-ACCOUNTS-PORT |
| `packages/auth/src/client.ts` | `catch(error)`→`catch{}` (1 linha) | BL-CI-ESLINT |
| `packages/auth/eslint.config.js` | novo (untracked) | BL-CI-ESLINT |
| `packages/content/eslint.config.js` | novo (untracked) | BL-CI-ESLINT |
| `packages/analytics/eslint.config.js` | novo (untracked) | BL-CI-ESLINT |
| `packages/ui/eslint.config.js` | novo (untracked) | BL-CI-ESLINT |
| `apps/accounts/eslint.config.js` | novo (untracked) | BL-CI-ESLINT |

Outros modificados no tree (specs/docs/lock/ci/site) são de trabalho paralelo — separar por PR.

---

## Ordem de ataque (por bloqueio)

```
FASE 1 — Higiene (desbloqueia trabalho seguro)
├── BL-033-SECRET-BLOCK         artifacts/ tracked (já em histórico público, sem secrets)
├── BL-CI-ESLINT-FLAT-CONFIG    lint advisory → gate obrigatório (PARCIAL: código já no tree)
├── BL-DEP-MESAS-AUTO-PUSH      auto-deploy sem revisão
└── BL-CODERABBIT-CONFIG        .coderabbit.yaml ausente

FASE 2 — Pequenos standalone (independentes)
├── BL-ACCOUNTS-PORT            ports→expose (PARCIAL: código já no tree, falta deploy)
├── BL-AUDIT-033                dompurify bump + form-data override
├── BL-DEP-MESAS-LEGACY-SCRIPTS remover scripts mortos (CUIDADO: não é duplicata simples)
└── BL-SITE-ADMIN-TS-VARIANCE   no-op (zero erro real)

FASE 3 — Funcionalidade quebrada
├── BL-MESAS-AUTO-ARCHIVE-CF    cron 403 → SSH+docker exec
├── BL-SITE-PRINCIPAL-GAPS      newsletter, sitemap 301, data json, contato
└── BL-SITE-ADMIN-WP-PUBLISH-GUARD  guard link WP no admin

FASE 4 — Spec própria / decisão maior
├── Spec 032 (analytics)        ~85% — falta deploy mesas + docs
├── Spec 028 (media library)    0% — 14 tasks
├── D-DEP2                       ~95% — bumps cosméticos
├── BL-GLOSSARIO-LEGACY-CLEAN    migration 2 users
├── BL-CONFIG-AUTH               ~20 hardcodes — SDD Completo
└── BL-INFRA-GHCR-F12            VM ARM64 — decisão GHCR vs cache incremental

FASE 5 — Bloqueados externamente
├── BL-BETA-HYDRATE             falta PROD_DB_URL no .env.beta
├── BL-LINKS-013 / BL-NAV-LINKS-014  CÓDIGO CONCLUÍDO LOCAL (🟦 deploy mantenedor)
└── BL-SITE-GATED               Gate D site

FASE 6 — Grandes (SDD próprio)
├── BL-SITE-CMS-PARITY (Spec 011)
├── Spec 022 (UI tokens)
├── Spec 025 (qualidade)
└── Shared debts (SEO, normalizers, copy)
```

---

# FASE 1 — Higiene

## BL-033-SECRET-BLOCK

**Estado real (✅ repo):**
- `git ls-files artifacts/` = **16 arquivos tracked** (15 em `033/` + 1 `cloudinary/`). Lista exata:
  - `033/`: 3 configs glossario, `lock.pre-zod`, `mesas-backend-package.json.pre-033-f3`, 5× `pnpm-lock.yaml.pre-*`, 5× `pre-f*-*.txt`
  - `cloudinary/inventory-2026-06-17T14-21-49-005Z.json`
- **⚠️ CORREÇÃO de afirmação anterior:** esses 16 **JÁ foram pushados** — aparecem em **7 commits** no histórico (`88dd0c1`, `041794e`, `add03b6`, `2e7a960`, etc.). Repo é **PÚBLICO** ([[repo-public-history-rewrite]]). `git rm --cached` **não remove do histórico** — só do índice futuro.
- **Scan de secrets (✅ repo):** nos 16 tracked = **zero matches** (`refresh_token|client_secret|BEGIN|ghp_|github_pat_|password|DATABASE_URL|postgres://|JWT_SECRET|CRON_SECRET|api_key`). Cloudinary inventory = **zero** `api_secret`/`secure_url`/`cloudinary://`.
- `eyJ` em lock backups = falso positivo (hash de integridade pnpm).
- Dump `pre-f3-mesas-beta-dump.sql` (com OAuth tokens) foi bloqueado por GitHub GH013 **antes** do push e **não existe no disco** — nunca exposto. ✅
- `.gitignore:45` cobre só `artifacts/lighthouse/`, não `artifacts/`. ✅
- 17+ untracked em `033/` (build/test logs) seriam estagiados por `git add -A`.

**Conclusão:** risco é **prospectivo** (futuro `git add -A` estagiar dump/log com token). Os tracked atuais em histórico público **não contêm secrets** → rewrite de histórico **NÃO necessário**. Ação é preventiva.

**Ação:**
- [ ] T1a — `.gitignore`: substituir `artifacts/lighthouse/` por `artifacts/` (cobre tudo)
- [ ] T1b — `git rm --cached -r artifacts/033/ artifacts/cloudinary/` (destrackear 16)
- [ ] T1c — Validar: `git ls-files artifacts/` vazio; `git status` não mostra untracked de `artifacts/`

**Arquivos:** `.gitignore` (1 linha), índice git (16 destrackeados).
**Validação:** `git ls-files artifacts/` = vazio.
**Rollback:** `git checkout .gitignore` + os arquivos seguem no disco (rm --cached não apaga disco).

---

## BL-CI-ESLINT-FLAT-CONFIG — PARCIAL (código já no tree)

**Estado real (✅ repo):**
- Já tracked com `eslint.config.js`: `apps/glossario/frontend`, `apps/mesas/frontend`, `packages/config`. (3)
- **Já criados no tree (untracked):** `packages/auth`, `packages/content`, `packages/analytics`, `packages/ui`, `apps/accounts`. (5)
- `packages/auth/src/client.ts` **já editado** (`catch{}`) no tree.
- CI: `ci.yml` roda lint com `continue-on-error: true` (ainda presente — não removido).

**Pendente real:**
- [ ] T2a — Revisar os 5 configs criados (Pattern A backend) — conferir ignores: auth(`dist-cjs/**`), analytics+ui(`vitest.config.ts`), ui(`preview/**`,`scripts/**`), accounts(`vite.config.ts`,`vitest.config.ts`,`frontend/**`,`argsIgnorePattern:^_`)
- [ ] T2b — Remover `continue-on-error: true` do step Lint em `ci.yml` (atualizar comentário)
- [ ] T2c — `pnpm -w turbo run lint` → confirmar verde (site/site-admin = stubs OK)
- [ ] T2d — `pnpm --filter <pkg> lint` exit 0 para os 5

**Arquivos:** 5 configs + `ci.yml` + `client.ts`.
**Risco:** sem `continue-on-error`, qualquer erro novo de lint quebra PR (intencional). Confirmar 13/13 verde ANTES de remover a flag.
**Rollback:** restaurar `continue-on-error`, deletar configs, reverter client.ts.

---

## BL-DEP-MESAS-AUTO-PUSH

**Estado real (✅ repo):**
- `deploy-manifest.json:17`: mesas `"auto_deploy_on_push": true` — **único `true`** (glossario/site/accounts/site-admin = `false`).
- `deploy.yml:82-142`: lógica = evento `push` + ref em `push_branches` (`dev`) + `auto_deploy_on_push=true` + `git diff` toca `deploy_paths` → `deploy=true`.
- Incidente spec 033: 4/5 deploys auto falharam (PRs #63-66): `ENOENT patches/` ×3 + path-to-regexp v8. Beta offline entre falhas.

**Ação:**
- [ ] T3a — `deploy-manifest.json`: mesas `true` → `false`
- [ ] T3b — Validar JSON: `python -m json.tool .github/deploy-manifest.json`
- [ ] T3c — Smoke: push branch com mudança em `apps/mesas/README.md` → CI sem deploy. Dispatch manual ainda funciona.

**Arquivos:** `deploy-manifest.json` (1 campo).
**Rollback:** `false`→`true`.

---

## BL-CODERABBIT-CONFIG (novo)

**Estado real (✅ repo):** `.coderabbit.yaml` não existe na raiz → CodeRabbit usa defaults genéricos.

**Ação:**
- [ ] T-CR1 — Criar `.coderabbit.yaml` (profile `assertive`, `path_instructions` por tipo, `request_changes_on: critical`, tone alinhado a AGENTS.md/petreas). Conteúdo na seção Apêndice A.
- [ ] T-CR2 — Validar no próximo PR.

**Impacto:** zero em código/build/deploy. Só config de review.

---

# FASE 2 — Pequenos standalone

## BL-ACCOUNTS-PORT — PARCIAL (código no tree, falta deploy)

**Estado real:**
- ✅ repo: `docker-compose.prod.yml` e `docker-compose.yml` já alterados (`ports`→`expose`) no tree.
- ⚠️ VM (sessão): `accounts-api` era o único com host binding `0.0.0.0:3000`; Tunnel usa Docker DNS `accounts-api:3000` (`infra-map.md:48`); probe cross-container `accounts-api:3000/health`=200. **Re-confirmar na VM antes do deploy.**

**Risco não-feliz:** `expose` remove docker-proxy. Confirmar que **nenhum** healthcheck/monitor externo bate `host:3000` (afirmação "nenhum consumidor" não foi exaustivamente provada). Auth é sagrado.

**Pendente:**
- [ ] T4a — Build local: `pnpm --filter @artificio/accounts build`
- [ ] T4b — `docker compose config` parse OK
- [ ] T4c — 🟦 Deploy prod (autorização nominal): `module=accounts mode=deploy`
- [ ] T4d — Smoke OBRIGATÓRIO pós-deploy: health + login + me + logout (auth sagrado)
- [ ] T4e — `infra-map.md:120`: marcar débito resolvido

**Rollback:** `expose`→`ports`, redeploy (testar tempo real, não assumir <2min se Tunnel cachear DNS).

---

## BL-AUDIT-033 (residual — xlsx é spec 034)

**Estado real (✅ repo):**
- **dompurify:** `apps/mesas/frontend/package.json:25` = `"^3.3.3"` (não 3.4.x). Lock = `3.4.8`. Vulnerável `<=3.4.10`.
- **form-data:** lock = `4.0.5`. Vulnerável `>=4.0.0 <4.0.6`. **3 caminhos** (`pnpm why`, ✅repo): axios→glossario-frontend (prod) + superagent→supertest→**accounts+mesas-backend** (devDeps) + @types/superagent. Override `4.0.6` é **global** → pega supertest também, NÃO só axios.
- 🔁npm **dompurify@3.4.11 + form-data@4.0.6 confirmados publicados** (`pnpm view`, 2026-06-20).
- **`pnpm-workspace.yaml` NÃO tem chave `overrides`** (só `patchedDependencies`, `allowBuilds`). Precisa criar a chave.
- nanoid/uuid: patched existem mas parents pinam (uuid seria MAJOR 8→11). Manter bloqueado.

**Ação:**
- [ ] T5a — 🔁 npm: confirmar `dompurify@3.4.11` publicado (`pnpm view dompurify versions`). Se sim, bump `apps/mesas/frontend/package.json` → `^3.4.11`
- [ ] T5b — 🔁 npm: confirmar `form-data@4.0.6` publicado E que axios `^1.18.0` aceita 4.0.6. Adicionar em `pnpm-workspace.yaml`:
  ```yaml
  overrides:
    form-data: 4.0.6
  ```
- [ ] T5c — `pnpm install` (regenera lock)
- [ ] T5d — `pnpm audit --prod` → cai 7→4 (2 xlsx + nanoid + uuid restantes)
- [ ] T5e — `pnpm --filter @artificio/mesas-frontend build` verde (usa `sanitize.ts`)
- [ ] T5f — `pnpm --filter @artificio/glossario-frontend build` verde (axios→form-data)
- [ ] T5g — **Smoke teste:** `pnpm --filter @artificio/accounts test` + `--filter @artificio/mesas-backend test` verdes (override pega supertest — gate obrigatório)

**Risco não-feliz:** override `form-data` é global → atinge **supertest** (test infra accounts+mesas-backend), não só axios. Se quebrar testes, reverter. T5g obrigatório antes de fechar.
**Rollback:** reverter bump+override, `pnpm install`.

---

## BL-DEP-MESAS-LEGACY-SCRIPTS — 🟦 CUIDADO: não é duplicata simples

**Estado real (✅ repo) — correção importante:**
- `apps/mesas/scripts/` conteúdo: `deploy/` (6 arq), `ops/`, `sdd/`, `deploy-beta.ps1`, `pre-commit`, `README.md`.
- `apps/mesas/scripts/deploy/` (6): `apply_required_migrations.sh`, `apply_required_migrations.sh.bak` (11854 bytes), `deploy-prod.sh`, `lib_migrations.sh`, `preflight_prod.sh`, `reconcile_migrations.sh`.
- **root `scripts/deploy/` é CONJUNTO DIFERENTE** (5): `apply_required_migrations.sh`, `lib_migrations.sh`, `test_branch_invariant.sh`, `test_migration_lock.sh`, `validate_branch_invariant.sh`.
- **⚠️ Não é "app duplica root".** Só 2 nomes coincidem (`apply_required_migrations.sh`, `lib_migrations.sh`) e divergem em tamanho/SHA. O resto é disjunto: app tem `deploy-prod.sh`/`preflight_prod.sh`/`reconcile_migrations.sh`+`.bak`; root tem testes de branch invariant.
- Sessão (⚠️ re-verificar): zero referências no monorepo; `turbo.json` mesas não cobre `scripts/`; paths pré-monorepo (`/opt/mesas`, `C:\projetos\config`); nenhum segredo.

**Pendente:**
- [ ] T6a — 🟦 Decisão de escopo:
  - **A** — remover só `apps/mesas/scripts/deploy/` (6 arquivos)
  - **B** — remover `apps/mesas/scripts/` inteiro (deploy + ops + sdd + ps1 + pre-commit + README)
- [ ] T6b — ANTES de remover: `rg -n "mesas/scripts|deploy-beta|hydrate_beta|preflight_prod|reconcile_migrations|pre-commit-strict" --glob '!node_modules' --glob '!*.lock'` → confirmar 0 matches **vivos**
- [ ] T6c — Confirmar que `_deploy-module.yml:441` usa root `scripts/deploy/` (não o app-level) — provar canonicidade, não assumir
- [ ] T6d — Remover conforme escopo
- [ ] T6e — `pnpm --filter @artificio/mesas-backend build` + `--filter @artificio/mesas-frontend build` verdes

**Rollback:** `git revert`.

---

## BL-SITE-ADMIN-TS-VARIANCE — no-op

**Estado real (sessão, ⚠️ re-verificar):** `tsc --noEmit --strict` = zero erros; `admin-api.ts:220` já tem `as any` que suprime mismatch multer×express; site sem script `typecheck`. **Sem erro real.**

**Ação:** nenhuma necessária.
- [ ] T7a — (Opcional, futuro) tipar `req/res` corretamente quando `admin-api.ts` for refatorado.

---

# FASE 3 — Funcionalidade quebrada

## BL-MESAS-AUTO-ARCHIVE-CF

**⚠️ ALERTA:** o "teste real" da sessão **arquivou 13 mesas em produção** (`count: 13`) — isso **mutou prod**, não foi read-only. Efeito já aplicado e irreversível (mesas +30d arquivadas). Próximo run = idempotente (`count: 0`).

**Estado real:**
- Causa: workflow `mesas-auto-archive.yml` faz curl público (runner GitHub) → Cloudflare 403.
- ⚠️ VM (sessão): `docker exec mesas-api wget http://localhost:3000/...` com `$MESAS_CRON_SECRET` do container = 200. Secret já no ambiente do container. `curl` não existe no Alpine; Docker DNS não resolve no host.

**Ação:**
- [ ] T8a — Editar `mesas-auto-archive.yml`: trocar curl público por SSH + `docker exec mesas-api sh -c 'wget -qO- --post-data="" --header="x-cron-secret: $MESAS_CRON_SECRET" --header="content-type: application/json" http://localhost:3000/api/v1/admin/tables/auto-archive'`. Padrão SSH = `docker-cleanup.yml`. Manter `permissions: {}`, remover `env.CRON_SECRET`.
- [ ] T8b — `workflow_dispatch`: confirmar HTTP 200 + `count`
- [ ] T8c — 2º dispatch idempotente (`count: 0`)

**Rollback:** `git revert`.

---

## BL-SITE-PRINCIPAL-GAPS

**Estado real (sessão, ⚠️ VM para A/C):**
- **(A) `PUBLIC_GA_ID`** — ⚠️ VM: `G-8XN5BGPJP3` no `.env` prod da VM. **NÃO auditável em PR** (`.env` não versionado). Re-confirmar na VM. Beta sem tracking por design.
- **(B) Newsletter** — `[newsletter]` literal no `pages.json`, sem template Astro.
- **(C) `src/data/*.json`** — `posts.json` (14 refs) + `pages.json` (6 refs) com `wp-content/uploads`, tracked no git. Live site = limpo (VM regenera). Arquivos no repo = build antigo.
- **(D) `/sitemap.xml`** — 404; `/sitemap-index.xml`=200. Astro `@astrojs/sitemap` gera index.
- **(E) Contato** — sem página dedicada (WP usava Contact Form 7).

**Ação:**
- [ ] T9a — (A) re-confirmar `PUBLIC_GA_ID` na VM (não fechar só por sessão)
- [ ] T9b — (D) redirect 301 `/sitemap.xml`→`/sitemap-index.xml` no Astro
- [ ] T9c — (C) `apps/site/src/data/` → `.gitignore` OU regenerar limpo e commitar
- [ ] T9d — (B) criar `newsletter.astro` (form real) OU remover página
- [ ] T9e — (E) criar `contato.astro` (form ou email link)

**Dependência:** (A) confirmado → desbloqueia BL-ANALYTICS (Spec 032).

---

## BL-SITE-ADMIN-WP-PUBLISH-GUARD

**Estado real (sessão):** `pruneWpAssets` existe em `importer/media.ts:152` (só usado no import). `cleanHtml` (server) sanitiza XSS mas **não** remove `wp-content/uploads`. Admin pode publicar com link WP residual → quebrado no SSG.

**Risco não-feliz:** real mas mínimo HOJE — admin não usado para autoria; uploader usa Cloudinary; WP EOL ~2026-06-20. Sobe quando admin voltar a autoria com editor de blocos.

**Ação:**
- [ ] T10a — Mover `pruneWpAssets` p/ `server/lib/` e chamar em `buildPost`/`buildPage`, OU rejeitar `wp-content/uploads` no save (400).

---

# FASE 4 — Spec própria / decisão maior

| Débito | Estado | Próximo passo |
|---|---|---|
| **Spec 032 (analytics)** | ~85%. Código pronto. ⚠️ mesas prod container 2026-06-18 sem GA. (A) ⚠️ VM | Deploy mesas prod + docs + GA4 admin |
| **Spec 028 (media library)** | 0%. 14 tasks. 7 PDFs rescued. `ALLOWED_MIME` sem pdf, multer 15MB, sem volume Docker persistente | SDD Completo, ~3-5 sessões |
| **D-DEP2** | ~95% (spec 033 resolveu). Só `turbo`+`@types/react` patch (opcional) + `docker image prune` | Não justifica spec |
| **BL-GLOSSARIO-LEGACY-CLEAN** | ⚠️ DB: 38 users, migration afeta só 2 (com SSO). 36 mantêm hash p/ `/api/migration/verify` | Migration com pg_dump backup |
| **BL-CONFIG-AUTH** | ~20 hardcodes de domínio; `packages/config` só `parseEnv`; authFetch reimplementado 3× | SDD Completo, auth sagrado |
| **BL-INFRA-GHCR-F12** | VM ARM64 → GHCR exige QEMU (lento, risco bcrypt/sharp). Alt: cache incremental na VM | 🟦 decisão GHCR vs cache |

### BL-GLOSSARIO-LEGACY-CLEAN — detalhe (⚠️ re-verificar DB)
- Migration: `UPDATE users SET password_hash = NULL WHERE sso_user_id IS NOT NULL AND password_hash IS NOT NULL AND password_hash != 'SSO_NO_PASSWORD'` → afeta **2** (paulohenriquercc, rodovalhomf).
- [ ] pg_dump backup off-VM → executar → smoke login Google dos 2 + `/api/migration/verify` de email não-linkado.

### BL-CONFIG-AUTH — escopo (9 tasks)
- `packages/config/src/domains.ts` (catálogo hosts), `buildLoginUrl`/`sanitizeReturnUrl`/`isArtificioHttpsUrl`/`publicOriginForModule`; HTTP client unificado em `packages/auth`; migrar site-admin/mesas/glossario/Astro; smoke SSO cross-subdomínio em TODOS consumidores.

### BL-INFRA-GHCR-F12 — decisão
| Abordagem | Complexidade | Risco | Sessões |
|---|---|---|---|
| GHCR + QEMU | Muito alta | Alto (multi-arch, bcrypt/sharp) | 5-8 |
| Cache incremental VM (remover `--no-cache`, BuildKit cache mounts) | Baixa | Baixo | 1 |

---

# FASE 5 — Bloqueados externamente

| Débito | Bloqueio | Desbloqueio |
|---|---|---|
| **BL-BETA-HYDRATE** | `.env.beta` não tem `PROD_DB_URL` (4× 500 em 2026-06-05). Endpoint `POST /api/v1/admin/sync/hydrate` + compose wiring prontos | Mantenedor seta segredo. 🟦 decidir: admin creds vs criar user read-only |
| **BL-LINKS-013** | CÓDIGO LOCAL CONCLUÍDO (2026-06-20). `apps/links` app completo (Astro+Express+Kysely/PG+Cloudinary+SSO). 🟦 deploy/tunnel/.env = mantenedor. Fonte: `specs/013-links-regras-restore/`. | — |
| **BL-NAV-LINKS-014** | Nav "WhatsApps" em `modules.ts` ✅. Smoke consumidores pós-deploy `links.` no ar. | — |
| **BL-SITE-GATED** | Gate D site: 4 débitos pendentes + E2E mantenedor | Resolver CMS-PARITY, PRINCIPAL-GAPS, MEDIA-LIBRARY, WP-GUARD |

---

# FASE 6 — Grandes (SDD próprio)

| Grupo | Estado | Bloqueadores Gate D |
|---|---|---|
| **BL-SITE-CMS-PARITY (Spec 011)** | Fases 0-2 deployadas. Pendente: T20 (taxonomias P0), T26 (lista editorial), T27 (agendamento), T29 (roles) | ~4-6 sessões |
| **Spec 022 (UI tokens)** | 12 itens paleta/AA | T8→T15 em ordem |
| **Spec 025 (qualidade)** | 4 itens: perf mesas, security headers, a11y sweep, third-party | Um por vez com baseline |
| **Shared debts** | `BL-SEO-SHARED`, `BL-NORMALIZERS`, `BL-COPY-PUBLICA` | Quando app público novo precisar |

---

## Fora de escopo

- Deploy prod sem autorização nominal por débito
- Alterar Cloudflare/WAF/DNS
- Rewrite de histórico git (não necessário — sem secrets nos tracked)
- Itens marcados "spec própria" / "bloqueado"

## Riscos transversais

- **Auth sagrado:** qualquer deploy de accounts exige smoke login/me/logout.
- **CI gate:** remover `continue-on-error` quebra PR se houver erro de lint novo — confirmar verde antes.
- **VM write:** itens ⚠️ VM exigem autorização nominal e re-verificação na VM (não confiar só na sessão).
- **PR obrigatório:** tudo entra via branch+PR ([[pr-obrigatorio]]), nunca commit direto.

## Sugestão de PRs (separar por blast radius)

1. **PR-1 higiene segura:** BL-033-SECRET-BLOCK + BL-CODERABBIT-CONFIG (sem código de runtime)
2. **PR-2 CI gate:** BL-CI-ESLINT (5 configs + client.ts + ci.yml) — pode quebrar lint, isolar
3. **PR-3 manifest:** BL-DEP-MESAS-AUTO-PUSH (1 campo)
4. **PR-4 accounts:** BL-ACCOUNTS-PORT (compose) — exige deploy+smoke
5. **PR-5 audit:** BL-AUDIT-033 (dompurify+form-data)
6. **PR-6 scripts:** BL-DEP-MESAS-LEGACY-SCRIPTS (após decisão escopo)
7. **PR-7 archive:** BL-MESAS-AUTO-ARCHIVE-CF
8. **PR-8 site gaps:** BL-SITE-PRINCIPAL-GAPS (B/C/D/E)

---

## Apêndice A — `.coderabbit.yaml` proposto

```yaml
reviews:
  profile: assertive
  path_instructions:
    - path: "apps/**/*.ts"
      instructions: "SSO integration, API design, Express routes, security (auth is sacred)."
    - path: "apps/**/*.tsx"
      instructions: "React components, accessibility, design system (@artificio/ui), Nielsen heuristics."
    - path: "packages/**/*.ts"
      instructions: "Shared contracts, breaking changes, consumer impact (all apps), type safety."
    - path: ".github/workflows/*.yml"
      instructions: "CI/CD security, deploy safety, secrets handling, branch protection."
    - path: "*.sql"
      instructions: "Migration safety, online-safe, backup requirements, idempotency."
  request_changes_on: critical
  suggestions: true
tone_instructions: "Prioritize security, AGENTS.md rules, long-term maintainability. Flag violations of petreas (auth sacred, shared=SDD, no host port, branch protection). Portuguese comments OK."
```

---

> **Runbook de re-verificação na execução** (onde olhar + comando + PASS/FAIL por residual ⚠️VM): ver `tasks.md` §RUNBOOK (RV-1..RV-8). Rodar como gate de abertura de cada débito VM, read-only, antes de qualquer write.

## Checklist de verificação pendente (re-checar na VM antes de fechar cada um)

- [ ] ⚠️ accounts host:3000 sem consumidor externo (healthcheck/monitor)
- [ ] ⚠️ `PUBLIC_GA_ID` no `.env` prod da VM (site)
- [ ] ⚠️ mesas prod container tem/não tem GA (deploy date)
- [ ] ⚠️ glossario DB: 38 users, 2 com sso_user_id
- [ ] ⚠️ `MESAS_CRON_SECRET` no ambiente do container mesas-api
- [ ] ⚠️ scripts mesas: zero referência viva + canonicidade root
- [x] 🔁 dompurify@3.4.11 e form-data@4.0.6 publicados no npm — ✅ confirmado 2026-06-20
- [x] 🔁 `pnpm why form-data` — ✅ 3 caminhos (axios/glossario + supertest accounts+mesas-backend), override é global → T5g smoke teste obrigatório
- [x] ✅ scan secrets histórico completo dos 16 tracked — 0 matches, sem rewrite necessário (2026-06-20)
- [ ] ⚠️VM `_deploy-module.yml:441` usa root `../../scripts/deploy/` — ✅ provado no repo (app-level mesas não referenciado)
