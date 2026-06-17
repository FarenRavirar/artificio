# Tasks — 009 Hardening da esteira

> **FINALIZADA (2026-06-06):** R1–R5 live em origin/dev (`c488e77`) + validados nos betas (mesasbeta/accountsbeta verdes, reconcile no-op). R6 (restart-resilience) code-complete commit `2681612` **local, NÃO deployado** (aguarda autorização de push+redeploy). T9 (refactor container_name) = futuro. Commits locais pendentes de push: `861128d`, `2681612`.

- [x] **T1** — Spec/plan/tasks 009 · feito quando: 3 arquivos criados.
- [x] **T2** — R2 guard exec-bit: `scripts/ci/check_entrypoint_exec_bit.sh` + wire em `pr-checks.yml` · feito: falha em `.sh` 100644 referenciado por ENTRYPOINT, passa em 100755 (CA2).
- [x] **T3** — R1 reconcile de leftover no remote script do `_deploy-module.yml` · feito: remove container de nome esperado com project ≠ alvo; no-op quando limpo; não toca volume (R1).
- [x] **T4** — R3 erro acionável de `.env.<env>` ausente + `docs/agents/deploy-runbook.md` (bootstrap dispatch-first) · feito: msg instrui pull+criar+re-rodar; runbook escrito (R3).
- [x] **T5** — R4 step-summary (smoke/health/snapshot/jwt) best-effort no `_deploy-module` · feito: tabela no `$GITHUB_STEP_SUMMARY` (R4/CA5).
- [x] **T6** — D050 (hardening aplicado; container_name fixo adiado) em `decisions.md`.
- [x] **T7** — Lint CA1: `actionlint`+`ShellCheck` verdes no CI (pr-checks); guard CA2 testado local (falha 100644, passa 100755).
- [x] **T8** — **Validação R5 ✅** (push `c488e77`): `deploy-mesas` mesasbeta verde (healthy api+app, smoke 200/401/302), `deploy-accounts` verde, `guard-entrypoint-exec` ✓, `Resumo do deploy` (R4) rodou. **Reconcile no-op** em VM limpa (nenhuma remoção) = zero regressão (CA4). Esteira blindada confiável p/ prod.
- [x] **T10** — **R6 resiliência de restart** (`apps/site/docker-entrypoint.sh`): serve `dist/` direto se já existe (restart/OOM/reboot = instantâneo, sem re-importar WP/rebuildar); rebuild só em container novo (deploy) ou `SITE_FORCE_REBUILD=true`. Corrige downtime ~1-2min quando o site reiniciava sob pressão de build vizinho. **Código vivo em `origin/main`** (`apps/site/docker-entrypoint.sh`, commit `c2aaae9`). NOTA: o SHA antigo `2681612` citado em docs não existe mais — **reescrita de histórico** ao tornar o repo público (memória `repo-public-history-rewrite`), NÃO trabalho desfeito; verificar por estado atual, não reabrir por SHA ausente.
- [ ] **T9** — (futuro) refactor `container_name` → nomes por projeto compose (fora do escopo 009). Coberto no backlog como `BL-DEP-CONTAINER-NAMES`.
