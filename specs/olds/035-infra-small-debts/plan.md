> **⚠️ Nota GA4 (D117, 2026-07-20):** referência a `G-8XN5BGPJP3` abaixo é histórico. Ver D117.

# Plano — 035 (Débitos de Infra)

> Alinhado com `spec.md` (fonte única) e `tasks.md` (granular + descobertas). Ordem = bloqueio.
> **Cada débito tem etapa R0 = RE-INVESTIGAR** antes de agir (estado da VM/npm muda; sessão anterior pode estar desatualizada).
> Governança: [[no-auto-commit]], [[pr-obrigatorio]]. VM read-only sem aprovação; **write na VM = aprovação pétrea (D023)** + lock `/tmp/artificio-vm-mutate.lock` (D056).

## Princípios desta spec

- **Não confiar em sessão como verdade.** Toda afirmação ⚠️VM/🔁npm precisa re-probe antes de fechar.
- **Separar por blast radius** → 8 PRs sugeridos (spec.md §Sugestão de PRs).
- **Auth sagrado.** Qualquer toque em accounts → smoke login/me/logout.
- **Sem rewrite de histórico** — tracked em `artifacts/` não têm secrets (scan ✅), só prevenir futuro.

---

## FASE 1 — Higiene

### BL-033-SECRET-BLOCK
**R0 RE-INVESTIGAR:** `git ls-files artifacts/` (confirmar 16); re-scan secrets nos tracked; `git log --all --oneline -- artifacts/` (confirmar já pushados, repo público); checar untracked atuais com `git status artifacts/`.
**Abordagem:** preventiva. `.gitignore artifacts/` + `git rm --cached`. **NÃO** rewrite de histórico (scan=0 secrets). Registrar **E007** em `errors.md` (backlog pede).
**Estado:** 16 tracked em 7 commits públicos, zero secrets. Dump com tokens bloqueado GH013, fora do disco.
**Risco:** prospectivo (futuro `git add -A` estagiar dump/log). Atual = nenhum.

### BL-CI-ESLINT-FLAT-CONFIG — PARCIAL
**R0 RE-INVESTIGAR:** `git ls-files '**/eslint.config.js'` (3 tracked) + `git status` (5 untracked no tree); revisar conteúdo dos 5; rodar `pnpm -w turbo run lint` ANTES de remover flag.
**Abordagem:** finalizar o que já está no tree. Revisar 5 configs (Pattern A) → confirmar lint verde 13/13 → remover `continue-on-error` do `ci.yml`. Isolar em PR próprio (pode quebrar lint).
**Estado:** 3 já tracked (glossario-frontend, mesas-frontend, config); 5 criados no tree; `client.ts` já editado; `ci.yml` ainda com flag.

### BL-DEP-MESAS-AUTO-PUSH
**R0 RE-INVESTIGAR:** `grep auto_deploy .github/deploy-manifest.json` (confirmar mesas=único true); reler `deploy.yml:82-142`.
**Abordagem:** `true`→`false`. Manter dispatch manual (paridade glossario/site/accounts). 1 campo.
**Estado:** mesas único auto-deploy; incidente 033 (4/5 falhas).

### BL-CODERABBIT-CONFIG
**R0 RE-INVESTIGAR:** confirmar ausência `.coderabbit.yaml`; checar se CodeRabbit ativo no repo (app instalado).
**Abordagem:** criar `.coderabbit.yaml` (profile assertive, path_instructions, petreas). Zero impacto runtime.

---

## FASE 2 — Standalone

### BL-ACCOUNTS-PORT — PARCIAL (falta deploy)
**R0 RE-INVESTIGAR (VM, read-only):** `docker ps` (accounts único host-binding?); `docker exec mesas-api wget --spider accounts-api:3000/health`; **provar nenhum monitor/healthcheck externo bate host:3000** (não assumir); reler `infra-map.md:48,120`.
**Abordagem:** código já no tree (`ports`→`expose`). Build+config local → deploy prod (aprovação D023) → smoke auth obrigatório.
**Risco não-feliz:** `expose` corta docker-proxy; se algo externo dependia de host:3000 → quebra. Auth sagrado. Rollback testar tempo real (Tunnel pode cachear DNS).

### BL-AUDIT-033
**R0 RE-INVESTIGAR:** `grep dompurify apps/mesas/frontend/package.json`; `grep -n "form-data@\|dompurify@" pnpm-lock.yaml`; `pnpm view dompurify versions` + `pnpm view form-data versions` (🔁 confirmar 3.4.11/4.0.6 publicados); `pnpm why form-data` (quem herda override).
**Abordagem:** dompurify `^3.3.3`→`^3.4.11` (mesas); criar chave `overrides: {form-data: 4.0.6}` em `pnpm-workspace.yaml` (não existe hoje). axios só em glossario.
**Risco não-feliz:** override global pega todo transitive; confirmar axios aceita 4.0.6 e nada mais quebra. audit cai 7→4 (xlsx=034, nanoid/uuid upstream).

### BL-DEP-MESAS-LEGACY-SCRIPTS — CUIDADO
**R0 RE-INVESTIGAR:** `ls apps/mesas/scripts/ scripts/deploy/` (comparar conjuntos — NÃO duplicata simples); `rg "mesas/scripts|deploy-beta|preflight_prod|reconcile_migrations"` viva; provar `_deploy-module.yml:441` usa root (não app-level); `diff` dos 2 nomes coincidentes.
**Abordagem:** após decisão escopo (A=só `deploy/` 6 arq | B=`scripts/` inteiro). app-level e root são DISJUNTOS (só 2 nomes batem). Remover o legado divergido.
**Risco não-feliz:** se algum workflow referencia app-level → quebra deploy. Provar canonicidade antes.

### BL-SITE-ADMIN-TS-VARIANCE — no-op
**R0 RE-INVESTIGAR:** `cd apps/site && npx tsc --noEmit` (confirmar 0 erro); checar `as any` em `admin-api.ts:220`.
**Abordagem:** nenhuma ação. Futuro: tipar ao refatorar.

---

## FASE 3 — Funcionalidade quebrada

### BL-MESAS-AUTO-ARCHIVE-CF
**R0 RE-INVESTIGAR (VM, read-only — NÃO disparar archive de novo):** `docker exec mesas-api sh -c 'env | grep MESAS_CRON_SECRET'` (confirma secret no container); reler `mesas-auto-archive.yml` + `docker-cleanup.yml` (padrão SSH); NÃO repetir POST que arquiva (mutação prod — D056 lock).
**Abordagem:** trocar curl público por SSH + `docker exec mesas-api wget localhost:3000/...`. Secret fica no container. Validar via `workflow_dispatch` (1º run pode arquivar — autorização).
**Alerta:** "teste" anterior arquivou 13 mesas em prod. Próximo POST real = mutação; tratar como write VM.

### BL-SITE-PRINCIPAL-GAPS
**R0 RE-INVESTIGAR:** (A) `ssh faren` → ler `apps/site/.env` prod, confirmar `PUBLIC_GA_ID` (⚠️ não-auditável em PR); (C) `grep -rn wp-content/uploads apps/site/src/data/`; (D) `curl -sI https://artificiorpg.com/sitemap.xml` (404?) + `/sitemap-index.xml` (200?); (B)(E) `grep newsletter\|contato apps/site/src/data/pages.json`.
**Abordagem por gap:** (A) verificar VM, não fechar por sessão; (B) template `newsletter.astro` ou remover; (C) gitignore ou regenerar limpo; (D) redirect 301 Astro; (E) `contato.astro`.

### BL-SITE-ADMIN-WP-PUBLISH-GUARD
**R0 RE-INVESTIGAR:** `grep -n pruneWpAssets apps/site/importer/media.ts`; checar `cleanHtml` (server/lib/sanitize-html.ts) não filtra wp-content; confirmar admin sem autoria ativa.
**Abordagem:** mover `pruneWpAssets`→`server/lib/` + chamar em `buildPost`/`buildPage`, OU rejeitar wp-content no save (400). Baixa prioridade (admin não autora hoje, WP EOL).

---

## FASE 4-6 — Specs próprias / decisão / grandes

Cada um exige R0 de re-investigação no início da sua própria sessão. Resumo:

| Débito | R0 RE-INVESTIGAR | Abordagem |
|---|---|---|
| **Spec 032 analytics** | curl 3 hosts (site/glossario/mesas) por `G-8XN5BGPJP3`; data do container mesas prod | deploy mesas + docs + GA4 admin |
| **Spec 028 media** | `grep ALLOWED_MIME`, multer limit, volume nos composes; `ls` rescued PDFs | SDD Completo 14 tasks |
| **D-DEP2** | `pnpm outdated`; `ssh faren docker images` | bumps patch opcionais + prune |
| **BL-GLOSSARIO-LEGACY-CLEAN** | query DB: count users, sso_user_id NOT NULL, hash legado | migration 2 users + pg_dump |
| **BL-CONFIG-AUTH** | `rg accounts.artificiorpg.com\|artificiorpg.com` hardcodes; estado `packages/config` | SDD Completo, auth sagrado |
| **BL-INFRA-GHCR-F12** | `ssh faren uname -m` (arm64?); imagens/cache na VM | decisão GHCR+QEMU vs cache incremental |
| **BL-BETA-HYDRATE** | `.env.beta` tem PROD_DB_URL?; endpoint+compose wiring | mantenedor seta segredo + decisão user RO |
| **BL-LINKS-013/014** | CÓDIGO LOCAL CONCLUÍDO (2026-06-20): app completo Astro+Express+Kysely/PG+Cloudinary+SSO, 15p build verde. 🟦 deploy/tunnel/.env = mantenedor. Fonte: `specs/013-links-regras-restore/`. | — |
| **BL-SITE-GATED** | estado dos 4 débitos filhos | resolver filhos + E2E mantenedor |
| **BL-SITE-CMS-PARITY (011)** | estado T20/T26/T27/T29 | 4 bloqueadores Gate D |
| **Spec 022 / 025 / shared** | reler specs | um por vez com baseline |

---

## Validação geral (por PR)

- `pnpm -w turbo run lint` + build dos pacotes tocados.
- JSON válido (`python -m json.tool`) para manifest.
- Smoke auth para qualquer deploy accounts.
- Idempotência para auto-archive (2º run count:0).
