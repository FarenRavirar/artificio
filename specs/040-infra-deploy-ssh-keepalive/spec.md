# 040 — infra: deploy resiliente a queda de SSH (sem deixar serviço down nem pular rollback)
- **Módulo/Pacote:** infra (`.github/workflows/_deploy-module.yml`, passo "Deploy module on VM")
- **Gate relacionado:** D (afeta deploy de qualquer projeto)

> **Nota de nome:** o slug é `040-infra-deploy-ssh-keepalive` por causa do diagnóstico inicial (keepalive). A spec evoluiu: keepalive é só a **camada 1** (reduz probabilidade). O alvo real é **deploy resiliente a queda de SSH**. Slug mantido para não quebrar links já registrados.

## Problema
O deploy de `links` (run `27894032104`, prod, 2026-06-21) falhou com:

```
#18 [13/13] RUN chown -R node:node /repo
client_loop: send disconnect: Broken pipe
Error: Process completed with exit code 255.
```

Timeline: `#18 RUN chown -R node:node /repo` inicia `04:56:51`, broken pipe `05:01:07` → **4m16s de silêncio total**. O build do docker **completou 13/13** — não é erro de build.

### Causa imediata (gatilho)
`chown -R node:node /repo` varre todos os `node_modules` do workspace (pnpm store hardlinked, centenas de milhares de inodes), é lento e **não emite stdout**. O `ssh` do passo "Deploy module on VM" roda sem keepalive → conexão TCP ociosa por ~4min é dropada por middlebox (Cloudflare/NAT Oracle) → `broken pipe` → cliente `ssh` retorna 255.

### Causa de fundo (fragilidade estrutural — o que torna isto grave)
O deploy é **acoplado à vida da sessão SSH**: o script remoto roda como filho do `sshd`; se a conexão cai, o script recebe SIGHUP e morre no meio. Pior, a ordem do script remoto é:

```
snapshot → migrations → down --remove-orphans → build --no-cache → up -d → health → smoke
                         ^^^^                    ^^^^^ broken pipe ocorreu aqui
```

No instante da queda os containers antigos já estavam **derrubados** (`down`) e os novos ainda **não tinham subido** (`up`) → **serviço fica DOWN**. E o `trap rollback ERR` **não captura SIGHUP** → o rollback **não dispara**. Num módulo já em produção, uma queda de SSH nessa janela = **outage até o próximo deploy manual**. No links foi 1ª subida (nada a derrubar), por isso só "falhou" sem causar outage — mas a fragilidade é geral.

### Por que keepalive sozinho não basta
`ServerAliveInterval`/`CountMax` reduzem a **probabilidade** do drop por ociosidade, mas mantêm o caminho feliz: assumem que a conexão sobrevive. Queda real de rede, reciclagem do runner ou hang da VM ainda matam o `ssh` (exit 255) e reintroduzem o cenário "serviço down sem rollback". Robustez de verdade exige que o deploy **sobreviva à queda da conexão**.

### Confirmações (descarta hipóteses concorrentes)
- VM saudável no diagnóstico: 23Gi RAM (21Gi livre), disco 14% → **não é OOM nem disco cheio**.
- `apps/site/Dockerfile` tem `chown -R node:node /repo` idêntico e deploya (`site-prod` up 32h) → o `chown` funciona; o que varia é a janela de silêncio + estabilidade transiente da rede.
- `_deploy-module.yml` é **reutilizável e compartilhado** por todos os módulos → o bug e o fix valem para a classe inteira.

**Co-descoberta:** o gatilho (`chown -R` lento) também foi apontado por outro agente. A proposta dele (mover `chown` antes do `pnpm install`) é **inválida**: o entrypoint builda o Astro em runtime como `USER node` e escreve `dist/`; com `node_modules`/`dist` root-owned o build em runtime falha com permission denied. Ver Fora de escopo.

## Requisitos (numerados, testáveis)
- **R1 — Deploy resiliente a queda de SSH (núcleo).** A execução remota do deploy é **desacoplada da vida da sessão SSH**: o script roda destacado na VM (`setsid`/`nohup`, log em arquivo, exit code persistido em sentinela). O passo do runner **monitora** (poll/tail via conexões curtas) até a sentinela; uma queda de SSH/rede/runner **não aborta nem deixa o serviço down**. Verificável: matar a conexão SSH no meio do build (teste em beta) → o deploy na VM **completa** (`up`+health+smoke) ou **rola para trás**; o módulo nunca fica down "órfão".
- **R2 — Rollback dispara também em sinal/saída anômala.** O `trap` de rollback cobre `ERR` **e** `INT TERM HUP EXIT` (idempotente), de modo que SIGHUP por queda de conexão restaura containers/snapshot em vez de deixar estado parcial. Verificável: interromper o script remoto durante a janela `down`→`up` → rollback executa e o serviço volta ao estado pré-deploy.
- **R3 — Propagação fiel de status.** O exit code real do script remoto (sucesso/falha) é propagado ao step do runner via sentinela, não via exit code do `ssh` de monitoramento. Verificável: deploy que falha no health/smoke marca o job como **failed**; deploy ok marca **success**; ambos independem de reconexões do monitor.
- **R4 — Keepalive como camada 1 (defesa em profundidade).** As invocações `ssh`/`scp` usam `ServerAliveInterval`/`ServerAliveCountMax` cobrindo ≥300s de silêncio, reduzindo a frequência de drops por ociosidade sem mascarar queda real. Verificável: flags presentes nas invocações de `ssh` (monitor) e `scp`.
- **R5 — Não compromete a VM nem outros serviços.** Nada de novo serviço/daemon persistente, nada de write fora do escopo do deploy já existente; os `flock` (lock VM-wide e lock de módulo) continuam respeitados; o detach não deixa processo zumbi entre deploys. Verificável: após o deploy, `docker ps`/process list na VM sem processos órfãos do deploy; locks liberados.
- **R6 — Cobertura uniforme.** Como o workflow é compartilhado, o fix vale para todos os módulos (links/site/mesas/glossario/accounts) sem edição por módulo. Verificável: mudança vive só em `_deploy-module.yml`.

## Critérios de aceite
- Queda de SSH durante o build/step longo (simulada em beta) **não** deixa o módulo down nem pula rollback; o deploy completa ou reverte na VM.
- Rollback dispara em SIGHUP/queda, não só em `ERR`.
- Job do runner reflete o resultado **real** do deploy remoto (não o status do túnel de monitoramento).
- `ssh`/`scp` com keepalive ≥300s.
- Health-check e smoke das rotas críticas continuam passando (sem regressão de deploy).
- Sem processo órfão na VM, locks liberados, nenhum serviço/daemon novo.
- Validado primeiro em **beta**, depois prod. Tudo entra por **branch + PR** (sem commit direto em `dev`).

## Fora de escopo
- **Mover `chown` para antes do `pnpm install`** (proposta de outro agente): inválida — quebra escrita de `dist/` em runtime como `USER node`. Não fazer sem redesenhar permissões.
- **Otimizar o custo do `chown`** (escopar a `apps/<modulo>` em vez de `/repo`, ou `COPY --chown=node:node`): follow-up opcional que **encurta a janela silenciosa** mas não remove a fragilidade estrutural (R1/R2). Mexeria em todos os Dockerfiles (blast radius maior) e exige teste de permissão de `dist/` em runtime → débito próprio, fora desta spec.
- **Build em CI → GHCR → VM `pull`** (`BL-INFRA-GHCR-F12`): elimina o build pesado na VM, mas é outra spec; reduz a janela mas não substitui R1/R2.
- Mudar topologia de deploy, lock VM-wide, snapshot ou smoke além do trap de rollback.

## Riscos e impacto em outros módulos
- `_deploy-module.yml` é compartilhado → a mudança afeta o deploy de **todos** os apps. Mitigação: validar primeiro em **beta** (dev→beta), só depois prod; manter diff restrito ao passo "Deploy module on VM".
- Execução destacada mal feita pode deixar processo zumbi ou perder o exit code → R3/R5 são critérios duros; cobrir com a simulação de queda.
- Trap em `EXIT` precisa ser idempotente para não rodar rollback após sucesso → testar caminho feliz e infeliz.
- Keepalive alto demais mascararia VM travada → `ServerAliveCountMax` finito mantém detecção de queda real.
- A correção é infra/CI/CD compartilhada → **SDD Completo**; smoke proporcional (health+smoke das rotas críticas do módulo de teste).

## Estado atual (2026-06-21)
- **Não implementado.** Camada 1 (keepalive, R4) foi aplicada no workdir como mitigação imediata (`ssh_base`+`scp` em `_deploy-module.yml`), **sem commit**; decisão de manter ou reverter junto com a implementação do núcleo (R1–R3).
- Núcleo (R1–R3) e trap estendido (R2) **a fazer**, com teste de simulação de queda em beta.
- Backlog: `BL-DEPLOY-SSH-KEEPALIVE` (P0).
