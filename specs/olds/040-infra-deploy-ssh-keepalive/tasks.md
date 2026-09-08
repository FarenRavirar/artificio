# Tasks — 040

> Não implementar agora (decisão mantenedor 2026-06-21). Spec/plan refletem o caminho robusto; executar quando priorizado. SDD Completo (infra compartilhada) → validar em beta antes de prod, branch+PR, sem commit direto em `dev`.

## Camada 1 — Keepalive (mitigação)
- [~] T1 — `-o ServerAliveInterval=30 -o ServerAliveCountMax=10` no `ssh_base` e no `scp` de `_deploy-module.yml` · feito quando: flags presentes nas 2 invocações. **Estado: aplicado no workdir, não commitado** — decidir manter/reverter junto do núcleo.

## Camada 2 — Execução remota destacada + poll (núcleo, R1/R3)
- [ ] T2 — Disparar o script remoto destacado (`setsid`/`nohup`, logfile + pidfile na VM) em vez de síncrono na sessão SSH · feito quando: processo remoto sobrevive ao fim da sessão de disparo.
- [ ] T3 — Loop de poll no runner (conexões curtas: `tail` incremental + check de sentinela, timeout global + backoff) · feito quando: runner acompanha o log e detecta término sem manter sessão longa aberta.
- [ ] T4 — Sentinela com exit code real + propagação ao job (R3) · feito quando: job marca success/failed conforme o exit code remoto, independente de reconexões.
- [ ] T5 — Aquisição de `flock` (módulo + VM-wide) pelo processo destacado, não pela sessão de disparo; guard de idempotência contra dupla execução · feito quando: locks corretos e sem dupla-run em re-poll.
- [ ] T6 — Limpeza de pidfile/rc-file/logfile no fim; sem processo órfão (R5) · feito quando: pós-deploy `ps`/`docker ps` na VM limpos, locks liberados.

## Camada 3 — Rollback resiliente a sinal (R2)
- [ ] T7 — Estender `trap` de `ERR` para `ERR INT TERM HUP EXIT`, função de rollback idempotente (guard `deploy_ok`) · feito quando: SIGHUP/SIGTERM na janela `down`→`up` dispara rollback; sucesso não dispara rollback no EXIT.

## Validação
- [ ] T8 — Caminho feliz em **beta**: deploy completo, health+smoke verdes, sem órfão · feito quando: evidência (run URL + `ps`/`docker ps` VM) na sessão.
- [ ] T9 — Queda simulada em beta (matar SSH do runner no meio) · feito quando: script destacado completa/rola-back na VM; serviço não fica down órfão; evidência registrada.
- [ ] T10 — Sinal/rollback + propagação de status (forçar falha de smoke) · feito quando: rollback restaura estado e job marca failed.
- [ ] T11 — Branch + PR para `dev`, validar em beta, depois prod · feito quando: PR com check `lint + build + test` verde; beta verde antes de prod. (requer autorização nominal de commit/push/PR/deploy)

## Follow-ups (débito próprio, fora desta spec)
- [ ] T12 — Registrar/atualizar no backlog: otimizar `chown` (escopar `apps/<mod>` / `COPY --chown`, testar `dist/` em runtime) e `BL-INFRA-GHCR-F12` (build CI→GHCR→pull) como redutores da janela silenciosa · feito quando: itens com origem/evidência/escopo/próximo passo no `specs/backlog.md`.
