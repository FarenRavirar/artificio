# Plano — 009 Hardening da esteira

## Arquivos afetados
| Caminho | Mudança |
|---|---|
| `.github/workflows/_deploy-module.yml` | R1 reconcile (antes do 1º `up`); R3 erro acionável; R4 step-summary (best-effort) |
| `scripts/ci/check_entrypoint_exec_bit.sh` (novo) | R2 guard de exec-bit |
| `.github/workflows/pr-checks.yml` | chama o guard R2 |
| `docs/agents/deploy-runbook.md` (novo/append) | R3 convenção de bootstrap de módulo novo |
| `.specify/memory/decisions.md` | D050 (hardening + container_name adiado) |

## Detalhe das mudanças
- **R1 reconcile** (no remote script, após `git reset`/`cd module_dir`, antes do `up -d $DB_SERVICE`):
  função `reconcile_container <name>`: se existe e `compose.project` ≠ `$COMPOSE_PROJECT` → `docker rm -f` (log). Aplica a `$DB_SERVICE` + cada item de `$HEALTH_CONTAINERS` (decodificar b64 antes). Nunca remove volume.
- **R2 guard**: script lê `git ls-files '*Dockerfile'`; p/ cada `"\./X.sh"` em ENTRYPOINT/CMD, checa `git ls-files -s` mode == 100755; senão `::error::` + exit 1. Wire em `pr-checks`.
- **R3**: melhorar a msg de `$env_file ausente` (instruir pull+criar+re-rodar); runbook com a sequência dispatch-first.
- **R4**: o passo "Deploy module on VM" faz `tee` da saída; passo seguinte (sempre roda) extrai `smoke_*`/`healthy_*`/`snapshot_created`/`jwt_secret_shared` e escreve tabela em `$GITHUB_STEP_SUMMARY`.

## Contratos / impacto
- `_deploy-module` é consumido por `deploy-mesas`/`deploy-accounts`/`deploy-site`. Mudanças **aditivas** (reconcile no-op limpo; summary extra; erro melhor). Inputs/outputs inalterados.
- Sem mudança de secret, rede, container_name, ou ordem de migração.

## Rollback
- Tudo é workflow/script versionado → reverter PR. Nada destrutivo. Se reconcile causar problema, remover a função (volta ao comportamento atual).

## Validação
- `actionlint` + `shellcheck` (já no `pr-checks`/`_lint-shell`).
- R2: Dockerfile de teste (ou o do site) — 100755 passa; simular 100644 falha.
- R1: extrair o remote script e `shellcheck`; lógica revisada (mesmo-projeto=skip).
- **R5 (chave):** após merge em `dev`, rodar `deploy-mesas` (mesasbeta) e confirmar verde + reconcile no-op. SÓ então confiar p/ prod.
- CA5: conferir o Summary do run.

## Sequência
1. spec/decisão (este passo). 2. R2 script+wire (isolado, testável). 3. R1 reconcile no remote script. 4. R3 msg+runbook. 5. R4 summary. 6. lint. 7. push dev → validar mesasbeta. 8. (futuro) container_name refactor.
