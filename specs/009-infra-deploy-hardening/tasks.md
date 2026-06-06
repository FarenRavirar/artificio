# Tasks — 009 Hardening da esteira

- [x] **T1** — Spec/plan/tasks 009 · feito quando: 3 arquivos criados.
- [ ] **T2** — R2 guard exec-bit: `scripts/ci/check_entrypoint_exec_bit.sh` + wire em `pr-checks.yml` · feito: falha em `.sh` 100644 referenciado por ENTRYPOINT, passa em 100755 (CA2).
- [ ] **T3** — R1 reconcile de leftover no remote script do `_deploy-module.yml` · feito: remove container de nome esperado com project ≠ alvo; no-op quando limpo; não toca volume (R1).
- [ ] **T4** — R3 erro acionável de `.env.<env>` ausente + `docs/agents/deploy-runbook.md` (bootstrap dispatch-first) · feito: msg instrui pull+criar+re-rodar; runbook escrito (R3).
- [ ] **T5** — R4 step-summary (smoke/health/snapshot/jwt) best-effort no `_deploy-module` · feito: tabela no `$GITHUB_STEP_SUMMARY` (R4/CA5).
- [ ] **T6** — D050 (hardening aplicado; container_name fixo adiado) em `decisions.md`.
- [x] **T7** — Lint CA1: `actionlint`+`ShellCheck` verdes no CI (pr-checks); guard CA2 testado local (falha 100644, passa 100755).
- [x] **T8** — **Validação R5 ✅** (push `c488e77`): `deploy-mesas` mesasbeta verde (healthy api+app, smoke 200/401/302), `deploy-accounts` verde, `guard-entrypoint-exec` ✓, `Resumo do deploy` (R4) rodou. **Reconcile no-op** em VM limpa (nenhuma remoção) = zero regressão (CA4). Esteira blindada confiável p/ prod.
- [x] **T10** — **R6 resiliência de restart** (`apps/site/docker-entrypoint.sh`): serve `dist/` direto se já existe (restart/OOM/reboot = instantâneo, sem re-importar WP/rebuildar); rebuild só em container novo (deploy) ou `SITE_FORCE_REBUILD=true`. Corrige downtime ~1-2min observado quando o site reiniciava sob pressão de build vizinho. Aplicar = redeploy do site.
- [ ] **T9** — (futuro) refactor `container_name` → nomes por projeto compose (fora do escopo 009).
