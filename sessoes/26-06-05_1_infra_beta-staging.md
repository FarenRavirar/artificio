# Sessão 26-06-05_1 — Esteira beta/staging (spec 005)

- **Data:** 2026-06-05 · **Módulo:** infra / CI-CD / `mesas` · **Gate:** D mesas / D041
- **Objetivo:** projetar e specar a esteira beta genérica (dev→beta, main→prod) que ressuscita `mesasbeta.` e serve de padrão p/ glossário e site.

## Contexto de entrada
- CDX-311 / PR #2 DEPLOYADO + marca validada no ar (accounts+mesas servem `#FF9457`/`#020740`; hex velho sumiu). Gate D mesas marca ✅.
- Próximo passo escolhido pelo mantenedor: **tratar mesasbeta**, que é staging essencial (mudança vai a beta antes de prod; recriar container não derruba prod; compartilha DB "de forma específica").

## Decisões da sessão (→ D041)
- Branch model = **A** (branch `dev` integração/beta + clone separado), com gate **divergência-proof** corrigindo o legado.
- Escopo = **genérico** (mesas, glossário, site precisam de beta).
- DB beta = **legado** (DB próprio + hydrate on-demand prod→beta, gate NODE_ENV).
- Invariante: `main ⊆ dev`; push direto em `main` proibido; promo `dev→main` = 1 merge (PR standing).
- Consequência: trabalho normal passa a `feat→dev` (Codex muda alvo dos PRs).

## Investigação legado (`C:\projetos\mesas_rpg_artificio`)
- `deploy-beta.yml` (push `dev`) → `/opt/mesas-beta`, `docker-compose.beta.yml`, `mesas-beta-{frontend,api,db}`, `mesasbeta.`.
- `promote-to-prod.yml` (dispatch+versão) → exige PR dev→main mergeado, bloqueia se `dev` à frente.
- DB beta próprio (`pgdata_mesas_beta`); `PROD_DB_URL` = conexão read usada só por `/sync/hydrate` ([adminHydration.ts](C:\projetos\mesas_rpg_artificio\backend\src\routes\adminHydration.ts) + [db/prod.ts](C:\projetos\mesas_rpg_artificio\backend\src\db\prod.ts)), gate `NODE_ENV=production`.
- Cicatrizes: E144 (nunca `down` por prefixo global), flock host, snapshot, rollback banco+containers, health `healthy`, smoke.
- `deleted_client` = OAuth próprio do beta morto → some no rebuild (G1 usa accounts SSO).

## Plano
Spec `005-infra-beta-staging-pipeline` (spec/plan/tasks T1–T13). Parametrizar `_deploy-module.yml` com input `env` (beta|prod) sem regressão no prod; `docker-compose.beta.yml` do mesas; clone `/opt/artificio-beta` em `dev`; hydrate religado; gate invariante + PR standing.

## Log
- 2026-06-05 — Confirmado deploy CDX-311 (PR #2 merged, deploy-accounts/mesas verdes, marca servida validada). project-state/roadmap atualizados.
- 2026-06-05 — Investigado mesasbeta no legado; mapeado fluxo branch + DB sharing + cicatrizes.
- 2026-06-05 — Decisões A+genérico+legado fixadas → D041. Spec 005 criada (spec/plan/tasks). Próximo: Codex executa T2+ (branch dev/protection, parametrizar reusável, compose beta).
- 2026-06-05 — Codex T2-T7 código: branch `dev` criada de `main`; `_deploy-module.yml` parametrizado `env=prod|beta`; gate prod `main ⊆ dev` + self-test; workflow PR standing `dev→main`; `deploy-mesas.yml` dispara beta em push path-filtered para `dev`; `docker-compose.beta.yml` usa `mesas-beta-{api,app,db}` sem OAuth próprio; PDF indevido removido do repo.
- 2026-06-05 — T2 branch protection/rulesets tentou via GitHub API e falhou com 403: recurso indisponível para repo privado sem GitHub Pro ou repo público. Não fingir proteção. Compensações atuais: T3 gate prod + T4 PR standing; pendência externa = habilitar plano/recurso ou tornar repo público para proteger `dev`/`main`.
- 2026-06-05 — Validação local: `test_branch_invariant.sh` OK via Git Bash; `git diff --check` OK. `docker compose config` não rodou porque Docker local ausente; `test_migration_lock.sh` não roda no Git Bash Windows por falta de `flock` (Actions Ubuntu cobre).
- 2026-06-05 — Feedback Amazon Q/Codex PR #3 endereçado: removido fallback beta→prod para `apps/accounts/.env`; deploy beta agora exige `apps/accounts/.env.beta` explícito; gate `main ⊆ dev` roda em todo deploy (prod e beta); `docker compose` recebe `-p mesas`/`-p mesas-beta` para isolar projects e impedir `down --remove-orphans` do beta tocar prod.

## Bloqueios / aprovações pendentes
- T8 (clone beta na VM) e T9 (hostname Cloudflare beta) = write na VM → aprovação do mantenedor.
- T2 branch protection = bloqueado pelo plano/recurso do GitHub (API 403 em branch protection e rulesets).
