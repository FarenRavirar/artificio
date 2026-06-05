# Sessão 26-06-04_5 — CDX-309 CI/CD deploy módulos

- **Data:** 2026-06-04 · **Módulo:** CI/CD / `mesas` · **Gate:** D mesas / D039
- **Objetivo:** criar caminho canônico de deploy por GitHub Actions (`git fetch/reset` na VM), inspirado no legado `C:\projetos\mesas_rpg_artificio`, evitando deploy manual por bundle/SSH como operação normal.
- **Regra central:** codificação/deploy passam por branch/PR/checks/workflows/secrets. VM manual fica só para bootstrap do clone, instalação operacional, conexão, diagnóstico ou rollback aprovado.

## Plano
1. Portar framework de migrations do legado para `scripts/deploy/` generalizado.
2. Criar workflow reutilizável `_deploy-module.yml`.
3. Criar `deploy-mesas.yml` e `break-glass-deploy-prod.yml`.
4. Documentar GitHub-first em governança/docs.
5. Validar build/test/actionlint/shellcheck/scan segredo.
6. Publicar branch/PR.
7. Pedir aprovação antes da Parte C (converter VM para clone).

## Log
- 2026-06-04 — CDX-309 iniciado. Lidos `deploy-accounts.yml`, workflows/scripts legados (`deploy-prod`, `deploy-beta`, `promote`, `preflight`, `apply_required_migrations`, `lib_migrations`) e regra nova do mantenedor: deploy/código via GitHub; VM manual só para o que GitHub não cobre.
- 2026-06-04 — Criados `scripts/deploy/{lib_migrations.sh,apply_required_migrations.sh}` generalizados: DB name/user/migrations dir por args/env, lock PG, drift check, headers `online-safe|manual-risk`, bloqueio de destrutivas em online-safe, backup obrigatório para manual-risk.
- 2026-06-04 — Criados workflows `.github/workflows/_deploy-module.yml`, `deploy-mesas.yml`, `break-glass-deploy-prod.yml`. Padrões: CI antes de SSH, deploy via `git fetch/reset` em `/opt/artificio`, lock por módulo, snapshot DB, migrations, compose no-cache/pull, health `healthy`, smoke rotas críticas, rollback com snapshot.
- 2026-06-04 — Documentado GitHub-first em `AGENTS.md`, `docs/agents/{operating-model,context-capsule,infra-map}.md` e comentários dos workflows.
- 2026-06-04 — Validação parcial: `pnpm -w turbo run build --filter=@artificio/mesas` OK. Primeira tentativa de `turbo test --filter=@artificio/mesas*` falhou por `DATABASE_URL` ausente nos testes backend; workflow ajustado com env dummy CI não secreto.
- 2026-06-04 — CDX-309B: deploy/código confirmado como GitHub-first. Corrigir loops de health/smoke para process substitution (sem subshell de pipe), exigir `jq` como pré-requisito de bootstrap (sem `sudo apt` no deploy), adicionar Postgres real no job CI do workflow e rodar `deploy-mesas` em PR com deploy desligado.
- 2026-06-04 — Prova shell local (sem build/test app): Git Bash retornou `new_process_substitution=7` para `while ... done < <(...)` com `exit 7`, confirmando que falha sai não-zero no shell principal. Forma antiga também retornou não-zero neste Bash por o `while` ser o último comando do pipe; ainda assim foi removida para não depender de semântica de pipeline/subshell.
- 2026-06-04 — CDX-309B follow-up Amazon Q: removido `eval` de `apply_required_migrations.sh` (parse de header via `case`), troca de leitura JWT para `grep/cut` sem execução, e validação SQL agora não remove bloco `/* */`; destrutivas em comentários multi-linha ficam bloqueadas por segurança. Validações leves: `rg eval` sem achados, `bash -n` OK, stub SQL com `DROP TABLE` em comentário multi-linha retornou erro.
- 2026-06-05 — Docs consolidados: criado `docs/agents/deploy-flow.md` como fonte operacional longa D039, atualizado `github-actions-secrets.md`, T0 (`project-state`, `context-capsule`) e referências em `infra-map`/`operating-model`. Criado prompt Opus em `docs/agents/prompts/opus-review-cicd-flows.md` para revisar redundâncias, melhorar fluxo e preparar checklist Parte C.
