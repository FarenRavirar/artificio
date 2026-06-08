# Sessão 26-06-07_1 — infra/CI-CD — Docker cleanup semanal (SDD Lite)

- **Data:** 2026-06-07
- **Módulo/Escopo:** infra/CI-CD — limpeza periódica de Docker na VM
- **Gate:** D (manutenção operacional; não destrutivo de dados)
- **Modo:** SDD Lite → **elevado a SDD Completo** na rev 2 (o lock RW toca o pipeline
  compartilhado `_deploy-module.yml` + `deploy-accounts.yml` → exige smoke de mesas/site/accounts).
- **Vínculos:** D041 (esteira deploy/locks), D050 (hardening `_deploy-module`), D055, D056 (lock RW)

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

## Atualização rev 2 (2026-06-07) — review Amazon Q + Codex (PR #11)

PR #11 mergeado em `dev` (CI verde). Dois bots revisaram. Veredito + ação:

| Achado | Fonte | Veredito | Ação |
|---|---|---|---|
| Q1 `GITHUB_RUN_ID` injeção | Amazon Q | parcial (é inteiro do GitHub) | guard numérico `^[0-9]+$` (defense-in-depth) |
| Q2 "sem lock = estado inesperado" | Amazon Q | **rejeitado** (sem lock = ocioso; abortar travaria VM rebootada) | mantido; guard de `flock` ausente add |
| Q3 sort `{{.CreatedAt}}` timezone | Amazon Q | válido (robustez) | keep-3 passa a usar ordem-default do docker (sem parsear TZ) |
| C1 race pós-checagem | Codex | válido (janela check→prune) | **lock RW** segura exclusive durante prune |
| C2 accounts sem lock | Codex | válido (deploy-accounts não criava lock) | accounts passa a pegar o lock shared |

**D056 — lock RW VM-wide** `/tmp/artificio-vm-mutate.lock`:
- Deploys (`_deploy-module` mesas/site + `deploy-accounts`) pegam **shared** (`flock -s -w 600`,
  FD 8) → continuam concorrendo entre si; só esperam se a manutenção segura exclusive.
- Cleanup pega **exclusive** (`flock -n -x`, FD 8), polling 5/5 min, e **segura durante todo o
  prune** → nunca prune durante deploy. Fecha C1 + C2.
- Sem deadlock: cleanup só pega FD8; deploy pega FD8(shared)→FD9(por-módulo). Sem inversão.
- Risco: se o prune segurar exclusive >600s, um deploy concorrente dá timeout (raro; domingo 03h).

**Arquivos tocados na rev 2:** `docker-cleanup.yml`, `_deploy-module.yml` (SHARED), `deploy-accounts.yml` (SHARED).

**Validação rev 2:** YAML dos 3 ok; `bash -n` do corpo remoto (acquire exclusive + keep-3) e do
snippet `_deploy-module` ok; semântica RW do `flock` é padrão util-linux (sem flock local p/ teste
empírico — **smoke real na VM**). Merge em `dev` redeploya **mesasbeta + sitebeta** (path inclui
`_deploy-module.yml`) = smoke do lado deploy automático no beta.

## Critério de conclusão (rev 2)

- [x] Aprovação p/ push (toca pipeline compartilhado = SDD Completo).
- [x] Merge `dev` → smoke beta verde (mesasbeta + sitebeta deployam COM o lock shared).
- [x] Smoke real do cleanup via `workflow_dispatch` em `main` (`27097763454`) verde.
- [x] artificio → ff `main` (cron + dispatch só valem em `main`) — `origin/main=origin/dev=22fe461`.
- [x] mesas: stub na `dev` (default) p/ parar cron legado, APÓS artificio em `main`.
- [x] `project-state.md` atualizado no fechamento.

## Fechamento (2026-06-08)

Retomada para fechar rastreabilidade. Validações read-only feitas:

- `artificio`: `origin/main` e `origin/dev` apontam para `22fe461`; `main ⊆ dev` OK; worktree limpa.
- GitHub Actions: `promote-prod-fast-forward`, `deploy-site`, `deploy-mesas`, `deploy-accounts`,
  `pr-checks` e `Docker Cleanup` verdes em 2026-06-07.
- `docker-cleanup.yml` no monorepo tem `schedule`, `workflow_dispatch`, `permissions: {}`,
  `timeout-minutes: 45`, `docker system df` antes/depois, `builder prune` e lock RW
  `/tmp/artificio-vm-mutate.lock`.
- `mesas_rpg_artificio`: `dev` limpo e alinhado com `origin/dev`; workflow legado sem
  `schedule`, só `workflow_dispatch`, job `if: false`.

**Estado:** concluída. Próximo bloco recomendado: fechar Gate D do `mesas`
(E2E logout + allowlist prod) antes de abrir módulo novo.

## Sugestão futura (separada — write na VM, aprovação à parte)

Log de container sem rotação é vilão de disco recorrente que prune NÃO resolve.
Fix durável = `daemon.json` com `log-driver json-file` + `max-size`/`max-file` na VM.
Tarefa à parte (não entra neste workflow).
