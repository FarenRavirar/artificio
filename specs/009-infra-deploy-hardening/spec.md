# 009 — Hardening da esteira de deploy (`_deploy-module`)

- **Módulo/Pacote:** infra (`.github/workflows/_deploy-module.yml`, `pr-checks.yml`, `scripts/`)
- **Gate relacionado:** nenhum (infra transversal; afeta deploy de mesas/accounts/glossário/site)
- **Origem:** 3 incidentes reais no 1º deploy do `site` (2026-06-06). Blindar as **classes**, não tapar buraco.

## Problema
O deploy do `site` falhou 3× por causas que a esteira deveria prevenir sozinha:
1. **Conflito de nome de container** (`site-beta-db` leftover de outro projeto compose) — `down --remove-orphans` roda DEPOIS do 1º `up`, tarde demais.
2. **`exec: ./docker-entrypoint.sh: permission denied`** — script `.sh` commitado sem bit executável (100644).
3. **Deploy de módulo novo falha antes do `.env`** — env-check antes do `git reset`; módulo ainda não materializado na VM; sem convenção de bootstrap.

São genéricos: qualquer módulo novo ou VM com estado sujo cai nos mesmos. `_deploy-module` é **compartilhado** (mesas prod+beta, accounts) → fix tem de ser **backward-compatible** e validado sem quebrar prod.

## Requisitos (numerados, testáveis)
- **R1 (reconcile de leftover)** — Antes do 1º `up`, o deploy remove containers cujo **nome == um nome esperado do módulo** (`db_service` + `health_containers`) **mas cujo `com.docker.compose.project` ≠ projeto alvo**. Logado. Não toca containers de outro nome (mesas/accounts intactos) nem volumes.
- **R2 (guard de exec-bit)** — `pr-checks` falha se um `ENTRYPOINT`/`CMD ["./*.sh"]` num `Dockerfile` referenciar arquivo que não está `100755` no git. Mensagem com a correção (`git add --chmod=+x …`).
- **R3 (bootstrap claro)** — Erro de `.env.<env>` ausente é acionável (instrui pull + criar env + re-rodar). Convenção de 1ª subida de módulo novo (dispatch-only → pull VM → `.env` → deploy) documentada (runbook + decisão).
- **R4 (observabilidade)** — Resultado de health/smoke/snapshot/jwt do deploy vai pro `GITHUB_STEP_SUMMARY` (tabela), best-effort (não quebra o fluxo se falhar).
- **R5 (backward-compat)** — Zero regressão no deploy de mesas/accounts: em VM limpa, R1 é no-op; R4 só adiciona summary. Validado por um deploy `mesasbeta` verde pós-mudança.

## Critérios de aceite
- **CA1** — `actionlint` + `shellcheck` verdes nos arquivos alterados.
- **CA2** — Guard R2 falha num Dockerfile de teste com `.sh` 100644 e passa quando 100755.
- **CA3** — Deploy `site` re-rodado com leftover proposital de outro projeto → reconcile remove e deploy segue verde (sem intervenção manual).
- **CA4** — Deploy `mesasbeta` pós-mudança verde (R5), sem reconcile removendo nada (no-op logado).
- **CA5** — Run de deploy mostra tabela no Summary (smoke/health).

## Fora de escopo
- Largar `container_name` fixo (nomes por projeto compose) — elimina colisão na raiz, mas toca health-check de mesas/accounts → **adiado** (decisão futura, documentar).
- Migração runner/banco (já frameworkado, D039).
- Rollback/secret model (inalterados).

## Riscos e impacto
| Risco | Mitigação |
|---|---|
| Quebrar deploy de **prod** (mesas/accounts) | mudança backward-compat; R1 no-op em VM limpa; validar mesasbeta antes; reconcile só remove nomes do próprio módulo |
| Reconcile remover container "certo" | só remove se `project label ≠ alvo`; mesmo projeto = skip (compose reusa) |
| Editar heredoc do remote script (quoting) | testar com `shellcheck` extraindo o script; revisar diff com cuidado |
| Guard R2 falso-positivo | só checa `["./*.sh"]` em Dockerfile; mode via `git ls-files -s` |
