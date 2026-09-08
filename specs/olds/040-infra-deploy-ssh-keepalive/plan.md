# Plano — 040

## Arquitetura da solução

Defesa em profundidade, em camadas. O núcleo (camada 2+3) é o que torna o deploy robusto "sem caminho feliz"; o keepalive (camada 1) só reduz frequência de drops.

### Camada 1 — Keepalive (mitigação, já no workdir)
`ssh`/`scp` com `-o ServerAliveInterval=30 -o ServerAliveCountMax=10` → socket vivo por ~5min de silêncio, sem mascarar queda real. Reduz a probabilidade do drop por ociosidade. **Não** garante sobrevivência a queda real.

### Camada 2 — Execução remota destacada + monitoramento (núcleo, R1/R3)
Desacoplar o script remoto da sessão SSH:

1. `scp` do script para a VM (como hoje).
2. Disparar **destacado**: `setsid bash <script> > <logfile> 2>&1 & echo $! > <pidfile>` (ou `nohup`), de modo que o processo **não** seja filho da sessão SSH interativa e sobreviva ao SIGHUP da queda.
3. Ao terminar, o script escreve um **arquivo-sentinela** com o exit code (`echo $? > <rc-file>`), via `trap`/wrapper.
4. O step do runner faz **poll**: conexões SSH curtas que (a) dão `tail` incremental do logfile para observabilidade e (b) checam a sentinela. Loop com timeout global (ex.: 20min) e backoff.
5. Quando a sentinela existe, o runner lê o exit code e **propaga** (sai 0/!=0). Reconexões durante o poll só retomam o monitoramento; não afetam o deploy.

Cuidados: o disparo destacado deve ser **único** (já há `flock` de módulo e VM-wide — o script destacado precisa adquirir os locks ele mesmo, não a sessão de disparo); evitar dupla-execução em re-poll (idempotência por pidfile/lock); limpar pidfile/rc-file/logfile no fim (sem zumbi — R5).

### Camada 3 — Rollback resiliente a sinal (R2)
Estender o `trap` do script remoto de `ERR` para `ERR INT TERM HUP EXIT`, com a função de rollback **idempotente** (não rolar para trás após sucesso já confirmado — guard por flag de "deploy_ok"). Assim, mesmo se algo matar o processo na janela `down`→`up`, o rollback restaura snapshot+containers.

## Arquivos afetados (por módulo/pacote)
- `.github/workflows/_deploy-module.yml`, passo **"Deploy module on VM"** (e "Resumo do deploy" se a fonte do log mudar):
  - Camada 1: flags `-o ServerAlive*` em `ssh_base` (já aplicado no workdir) e no `scp`.
  - Camada 2: trocar a invocação síncrona `"${ssh_base[@]}" "...bash $remote_script"` por disparo destacado + loop de poll + leitura de sentinela; ajustar a captura de `deploy-out.txt` para vir do logfile remoto.
  - Camada 3: dentro do heredoc `REMOTE`, estender o `trap` e adicionar guard de idempotência + escrita da sentinela com exit code.
- Sem mudança em Dockerfiles, composes, scripts de migração ou lógica de health/smoke.

## Contratos/interfaces tocados
- Nenhum contrato de auth/accounts/DNS/schema/segredos. Só a mecânica de execução/monitoramento remoto do deploy.

## Impacto em consumidores
- `_deploy-module.yml` é `workflow_call` consumido por `deploy.yml` para todos os módulos → fix uniforme; nenhum caller muda. Por isso **validar em beta antes de prod**.

## Rollback (da própria mudança)
- Reverter o commit/PR restaura o passo síncrono atual. Sem estado persistido. Se o disparo destacado deixar artefatos (`pidfile`/`rc-file`/`logfile` em `/tmp`), são autolimpos; em falha, são inertes e some no `tmpreaper`/reboot.

## Validação (como provo que funciona — caminho feliz E infeliz)
1. **Caminho feliz:** deploy de um módulo em **beta** completa, health+smoke verdes, sentinela = 0, sem processo órfão (`ps`/`docker ps` na VM), locks liberados.
2. **Queda simulada:** durante o build/step longo em beta, **derrubar a conexão SSH** (cancelar o step / matar o `ssh` do runner) → confirmar na VM que o script destacado **prosseguiu** até `up`+health+smoke (sucesso) ou **rollback** (se falhou), e que o serviço **não ficou down órfão**.
3. **Sinal/rollback:** enviar SIGTERM/SIGHUP ao processo remoto na janela `down`→`up` → rollback restaura snapshot+containers; serviço volta ao estado pré-deploy.
4. **Propagação de status:** forçar falha de smoke → job do runner marca **failed** mesmo com reconexões do monitor.
5. Só após beta verde, promover para uso em prod (e então deploy real do módulo alvo com aprovação nominal).
