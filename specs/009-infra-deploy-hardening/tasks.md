# Tasks — 009 Hardening da esteira

- [x] **T1** — Spec/plan/tasks 009 · feito quando: 3 arquivos criados.
- [ ] **T2** — R2 guard exec-bit: `scripts/ci/check_entrypoint_exec_bit.sh` + wire em `pr-checks.yml` · feito: falha em `.sh` 100644 referenciado por ENTRYPOINT, passa em 100755 (CA2).
- [ ] **T3** — R1 reconcile de leftover no remote script do `_deploy-module.yml` · feito: remove container de nome esperado com project ≠ alvo; no-op quando limpo; não toca volume (R1).
- [ ] **T4** — R3 erro acionável de `.env.<env>` ausente + `docs/agents/deploy-runbook.md` (bootstrap dispatch-first) · feito: msg instrui pull+criar+re-rodar; runbook escrito (R3).
- [ ] **T5** — R4 step-summary (smoke/health/snapshot/jwt) best-effort no `_deploy-module` · feito: tabela no `$GITHUB_STEP_SUMMARY` (R4/CA5).
- [ ] **T6** — D050 (hardening aplicado; container_name fixo adiado) em `decisions.md`.
- [ ] **T7** — Lint: `actionlint` + `shellcheck` verdes (CA1).
- [ ] **T8** — Validação R5: após push `dev`, deploy `mesasbeta` verde + reconcile no-op (CA4). 🔒 mantenedor dispara/confirma.
- [ ] **T9** — (futuro) refactor `container_name` → nomes por projeto compose (fora do escopo 009).
