# Sessão 26-06-07_1 — infra/CI-CD — Docker cleanup semanal (SDD Lite)

- **Data:** 2026-06-07
- **Módulo/Escopo:** infra/CI-CD — limpeza periódica de Docker na VM
- **Gate:** D (manutenção operacional; não destrutivo de dados)
- **Modo:** SDD Lite (1 workflow novo + stub de desativação; isolado, reversível)
- **Vínculos:** D041 (esteira deploy/locks), D050 (hardening `_deploy-module`), D055 (esta sessão)

## Objetivo

Migrar a limpeza periódica de Docker do projeto legado `mesas_rpg_artificio`
(unificado no monorepo) para o `artificio`. Os dockers cresceram → precisa de
limpeza semanal. Desativar no legado, ativar no monorepo com o mecanismo SSH
canônico (`DEPLOY_*` + key file), e blindar contra corrida com deploy.

## Plano

1. Desativar cron no legado mesas (stub: sem `schedule`, job `if: false`).
2. Criar `artificio/.github/workflows/docker-cleanup.yml` (cron domingo 03:00 UTC).
3. Revisão profunda → corrigir falhas e aplicar melhorias.

## Decisões aplicadas (review com o mantenedor)

- **G1** (cron = write autônomo na VM toda semana sem aprovação humana) **NÃO viola**
  governança: manutenção via Actions é canônica + precedente do legado. (D055)
- **G2**: nível **SDD Lite** + registro de sessão (este arquivo).
- **R1** (corrida com deploy): cron fica 03:00 UTC; **+ espera de quiescência** —
  cleanup checa os locks por-módulo do deploy (`/tmp/artificio-*-deploy.lock`) via
  `flock -n` (testa sem bloquear) e re-checa a cada 5 min antes de iniciar.
  Padrão **reusável** pelos próximos workflows de manutenção.
- **Cache de build antigo**: tratado explicitamente (`builder prune --filter until=168h`
  remove cache ocioso >7d, preserva o recente).

## Melhorias da revisão (aplicadas)

- **I1** `timeout-minutes: 45` (SSH pendurado não roda até o default de 6h).
- **I2** `docker system df` antes/depois (reclaimable real, melhor que `df -h` palpite).
- **I3** `permissions: {}` (job não faz checkout nem chama API).
- ServerAlive* no SSH (segura conexão durante esperas de 5 min).
- Summary captura até 200 linhas no `GITHUB_STEP_SUMMARY`.

## Riscos residuais (aceitos)

- `rmi -f` poderia orfanar container parado <168h em imagem fora do top-3 — muito raro
  (deploy recria com imagem nova); `|| true` engole o erro.
- Leftover `/tmp/...sh` na VM se SSH cair antes do `trap EXIT` — nome único, inofensivo.
- TOCTOU mínimo entre checar quiescência e iniciar — operações são deploy-safe
  (image prune = só dangling; builder prune until=168h não toca cache fresco; rmi keep-3
  preserva a imagem mais nova).

## Arquivos

- `artificio/.github/workflows/docker-cleanup.yml` — NOVO (ativo).
- `mesas_rpg_artificio/.github/workflows/docker-cleanup.yml` — stub de desativação
  (repo separado; precisa chegar na default `dev` do mesas p/ parar o cron).

## Validação

- YAML válido (artificio + stub mesas).
- `bash -n` no corpo remoto (função de quiescência + pipeline keep-3) OK.
- actionlint não linta heredoc single-quote; corpo espelha `_deploy-module` (já verde).
- Heredoc dedent confirmado (`REMOTE` cai na coluna 0 após strip do `|`).

## Critério de conclusão

- [ ] Aprovação do mantenedor p/ commit/push (cada repo).
- [ ] artificio: `feat/infra-docker-cleanup` → `dev` → ff `main` (cron só vale em `main`).
- [ ] mesas: commit do stub na branch `dev` (default) p/ parar o cron legado.
- [ ] Ordem: artificio em `main` ANTES de desativar mesas (evita janela sem limpeza;
      sobreposição temporária = limpeza dupla idempotente, inofensiva).
- [ ] 1º run via `workflow_dispatch` validado (smoke: `docker system df` antes/depois, ps).
- [ ] `project-state.md` atualizado no fechamento.

## Sugestão futura (separada — write na VM, aprovação à parte)

Log de container sem rotação é vilão de disco recorrente que prune NÃO resolve.
Fix durável = `daemon.json` com `log-driver json-file` + `max-size`/`max-file` na VM.
Tarefa à parte (não entra neste workflow).
