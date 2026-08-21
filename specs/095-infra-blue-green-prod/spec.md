# Spec 095 — Blue-green nos ambientes de produção

**Status:** proposta pronta para gate de implementação
**Data:** 2026-08-21
**Escopo:** CI/CD, topologia Docker Compose e operação dos seis projetos em produção
**Ambientes abrangidos:** somente `prod`

## 1. Objetivo

Eliminar a indisponibilidade planejada causada pelo deploy dos projetos do Artifício RPG. Uma versão nova deve ser construída e validada em um slot sem tráfego enquanto a versão ativa continua servindo; o tráfego só muda depois de a candidata estar pronta, e a versão anterior permanece disponível para rollback.

Blue-green será ativado **somente em produção**. Beta mantém o fluxo in-place atual.

## 2. Problema medido

O workflow compartilhado atual executa, nesta ordem:

```text
docker compose ... down --remove-orphans
docker compose ... build --no-cache --pull
docker compose ... up -d --force-recreate
```

Fonte: `.github/workflows/_deploy-module.yml:497-499`, lida com `rtk rg -n` em 2026-08-21. Como banco e aplicação pertencem ao mesmo projeto Compose, o `down` também interrompe o Postgres.

Quatro deploys reais de produção foram medidos com `gh run view <run> --job <job> --log`, tomando o primeiro `Stopping` da aplicação e o primeiro estado saudável da nova aplicação:

| Projeto | Run / job | Início da interrupção | Nova aplicação saudável | Janela medida |
|---|---|---:|---:|---:|
| downloads | `32210111974` / `95941164856` | 02:53:54.998Z | 03:00:01.521Z | **6m06,5s** |
| site | `32211436426` / `95944952572` | 03:16:01.558Z | 03:21:21.500Z | **5m19,9s** |
| mesas | `32437326920` / `96641375889` | 01:45:55.405Z | 01:49:28.498Z | **3m33,1s** |
| accounts | `32437718327` / `96642379940` | 01:52:11.206Z | 01:54:26.741Z | **2m15,5s** |

Não foi medido o número de requisições afetadas em cada janela. Foi medido que app e banco ficaram parados nesses intervalos.

## 3. Decisão do mantenedor

Em 2026-08-21, o mantenedor definiu:

1. adotar blue-green;
2. aplicar blue-green apenas aos ambientes de produção;
3. preservar beta no modelo atual;
4. nesta fase de especificação, realizar somente leitura na VM.

## 4. Escopo

### 4.1 Incluído

- `accounts`, `site`, `links`, `glossario`, `downloads` e `mesas` em produção;
- workflow reutilizável e manifest de deploy;
- separação entre estado persistente, ingress estável e slots de release;
- imagens imutáveis identificadas pelo SHA do commit;
- readiness, smoke, cutover, drain, bake, rollback e limpeza;
- compatibilidade de migrations entre versão ativa e candidata;
- prevenção de jobs/cron duplicados durante a sobreposição;
- bootstrap controlado das rotas do Cloudflare Tunnel para ingress estável;
- documentação, testes do orquestrador e evidência operacional.

### 4.2 Excluído

- blue-green em beta;
- Kubernetes, Docker Swarm ou contratação obrigatória de Cloudflare Load Balancing;
- alta disponibilidade da VM, do daemon Docker, do Postgres ou do próprio `cloudflared`;
- replicação de banco;
- canary percentual entre azul e verde;
- mudança funcional dos projetos.

Blue-green remove a interrupção planejada de release, mas não transforma a VM única em infraestrutura altamente disponível.

## 5. Requisitos

### R-BG-01 — Produção somente

O caminho blue-green MUST executar apenas quando o ambiente resolvido pelo manifest for `prod`. Os deploys beta MUST manter o comportamento atual e não criar slots, ingress ou volumes blue-green.

### R-BG-02 — Serviço ativo preservado

O slot ativo MUST continuar recebendo tráfego durante checkout, build, migration compatível, startup, readiness e smoke interno do candidato. Nenhum passo anterior ao cutover pode parar, recriar ou renomear o slot ativo.

### R-BG-03 — Estado fora dos slots

Postgres, volumes persistentes e serviços singleton MUST ter ciclo de vida independente dos slots de aplicação. O deploy normal de uma release MUST NOT executar `down`, `stop`, `rm` ou `force-recreate` sobre o banco.

### R-BG-04 — Ingress estável e isolamento por projeto

Cada projeto MUST possuir um ponto de entrada estável próprio, conectado a `artificio_net`, sem compartilhar processo de proxy com outro projeto. O Cloudflare Tunnel e consumidores internos devem apontar para esse ingress estável, nunca diretamente para um slot descartável.

Falha ou reload do ingress de um projeto MUST NOT alterar os demais projetos.

### R-BG-05 — Slots coexistentes

Os serviços de release MUST poder existir simultaneamente nos slots `blue` e `green`, com nomes, aliases, projetos Compose e volumes efêmeros que não colidam. `container_name` fixo é proibido nos serviços duplicáveis; pode permanecer em serviços singleton quando necessário e documentado.

### R-BG-06 — Release imutável

Cada imagem de aplicação MUST receber tag imutável derivada do SHA promovido. `latest` MUST NOT identificar o artefato que será ativado nem o artefato de rollback. O workflow MUST registrar módulo, SHA, tag, slot e horário.

### R-BG-07 — Readiness antes de tráfego

O candidato só pode receber tráfego após:

1. todos os containers esperados estarem `healthy`;
2. migrations aplicáveis terem concluído;
3. smoke interno atingir diretamente o slot candidato;
4. rotas críticas do manifest passarem;
5. identidade da release responder o SHA esperado.

Falha antes do cutover MUST destruir apenas o candidato e deixar o ativo intacto.

### R-BG-08 — Cutover atômico e drain

A troca MUST validar a configuração do ingress antes de aplicá-la e usar reload gracioso. Novas conexões passam ao candidato; conexões já aceitas pelo slot anterior devem concluir dentro do período de drain. O slot anterior só pode ser parado depois do drain e da janela de bake.

### R-BG-09 — Rollback de tráfego

Enquanto durar a janela de bake, rollback MUST consistir em redirecionar o ingress ao slot anterior e executar smoke, sem rebuild e sem restauração de banco. O workflow MUST manter a release anterior pronta e sua imagem protegida contra prune.

Se o smoke externo crítico falhar após o cutover, o rollback de tráfego MUST ser automático; qualquer restauração de banco continua sendo ação separada e nominalmente aprovada.

### R-BG-10 — Migrations compatíveis

Toda migration executada durante blue-green MUST ser compatível ao mesmo tempo com a versão ativa e a candidata. Mudanças destrutivas ou de contrato — remoção/rename de coluna, constraint que invalide escrita antiga, mudança incompatível de tipo ou semântica — MUST ser divididas em expandir, migrar/backfill e contrair em release posterior.

O guard de deploy MUST barrar migrations cuja compatibilidade simultânea não esteja demonstrada. A migration MUST rodar uma única vez fora do processo de startup replicável; runners atualmente embutidos em entrypoint devem ser separados antes de o módulo aderir ao blue-green.

### R-BG-11 — Jobs singleton

Cron, scheduler, importador e worker que causam efeito MUST executar no máximo uma vez durante a coexistência. Cada job deve adotar uma destas estratégias explicitamente:

- serviço singleton fora dos slots;
- habilitação apenas no slot ativo, com handoff no cutover;
- lock transacional compartilhado no Postgres, com teste concorrente.

Lock de sessão adquirido via pool e liberado por outra conexão é proibido.

### R-BG-12 — Assets e volumes de release isolados

Artefatos construídos por um slot MUST NOT sobrescrever conteúdo servido pelo outro. Volumes como `frontend_dist_prod` devem ser slot-scoped ou eliminados em favor de artefatos contidos na imagem.

### R-BG-13 — Contratos internos e SSO preservados

URLs internas estáveis, cookie `.artificiorpg.com`, login/me/logout, allowlist de retorno, headers de proxy e IP real MUST manter seus contratos. `accounts` só pode ser ativado depois dos consumidores e exige smoke SSO completo.

### R-BG-14 — Concorrência e capacidade

Deve existir no máximo um deploy de produção em fase de build/cutover por VM. Antes de iniciar o candidato, o workflow MUST medir memória, disco e Docker storage contra limites configurados; insuficiência aborta sem tocar o ativo.

Os limites finais serão definidos a partir da medição do piloto, pois a VM tinha 23 GiB de RAM, 20 GiB disponíveis e 154 GiB livres em 2026-08-21, mas o pico de build com dois slots ainda não foi medido.

### R-BG-15 — Observabilidade e auditoria

Cada execução MUST emitir, sem segredos:

- slot e SHA ativos antes/depois;
- duração de build, readiness, cutover, drain e bake;
- resultado de cada healthcheck/smoke;
- migration aplicada ou ausência de pendência;
- decisão de rollback e seu resultado;
- inventário final dos slots, imagens protegidas e singleton services.

### R-BG-16 — Bootstrap separado da rotina

A criação do ingress e a mudança inicial da rota do Tunnel são bootstrap único, com plano e rollback por projeto e aprovação nominal. Após o bootstrap, deploys normais MUST NOT escrever em DNS ou Cloudflare Tunnel.

### R-BG-17 — Retomada após interrupção

O estado ativo MUST ser persistido e também inferível por inspeção do ingress. Reexecutar workflow interrompido deve detectar ativo/candidato, não alternar às cegas e escolher de forma determinística entre continuar, limpar candidato ou rollback.

### R-BG-18 — Rollout progressivo

A ativação deve ocorrer projeto por projeto, com gate próprio. Ordem inicial:

1. `glossario` — piloto representativo sem scheduler interno conhecido;
2. `links`;
3. `site`;
4. `downloads`;
5. `mesas`;
6. `accounts` — último, por ser o centro de SSO.

Cada projeto só libera o seguinte após deploy bem-sucedido, smoke e exercício de rollback do próprio slot.

## 6. Invariantes verificáveis

| ID | Invariante | Evidência mínima |
|---|---|---|
| V-BG-01 | Beta não entra no caminho blue-green | teste do workflow/dispatcher para `beta` e inspeção do plano de comandos |
| V-BG-02 | O ativo responde durante build e readiness | probe contínuo com zero falhas atribuíveis ao deploy piloto |
| V-BG-03 | Banco não é parado no release | log sem ação de lifecycle no DB + `StartedAt`/restart count inalterados |
| V-BG-04 | Dois slots coexistem sem colisão | `docker ps`/labels/projetos/aliases dos dois slots |
| V-BG-05 | Candidato inválido não recebe tráfego | teste de falha de healthcheck e SHA ativo inalterado |
| V-BG-06 | Cutover não derruba conexão em andamento | teste de request lento atravessando reload |
| V-BG-07 | Rollback não requer rebuild | troca ao SHA anterior e smoke verde com imagem já existente |
| V-BG-08 | Migration é compatível com ambas as versões | testes old+new contra schema expandido e gate online-safe |
| V-BG-09 | Jobs não duplicam efeito | execução concorrente de dois slots e contagem única no banco/log |
| V-BG-10 | Assets de slots não se misturam | marcador/SHA distinto servido diretamente por cada slot |
| V-BG-11 | Interrupção do workflow é retomável | testes em ao menos pré-cutover, pós-cutover e bake |
| V-BG-12 | SSO continua compartilhado | login/me/logout e consumidor real após rollout de accounts |
| V-BG-13 | Prune preserva atual e anterior | inventário de imagens antes/depois da limpeza |
| V-BG-14 | Não há escrita Cloudflare na rotina | logs e permissões do workflow regular sem token/ação de Tunnel |

## 7. Critérios de aceite do programa

1. os seis projetos usam blue-green em produção e beta permanece in-place;
2. um probe externo contínuo não registra indisponibilidade atribuível ao cutover em dois deploys consecutivos de cada projeto;
3. o banco de cada projeto permanece em execução durante deploy;
4. falha induzida antes do cutover mantém a release ativa;
5. falha induzida depois do cutover restaura tráfego à release anterior sem rebuild;
6. migrations incompatíveis são barradas antes de produção;
7. schedulers e cron não duplicam efeitos durante a sobreposição;
8. documentação permite descobrir slot/SHA ativo e fazer rollback sem memória de chat;
9. validação repo-wide final e auditoria de cobertura de testes passam;
10. cada bootstrap/deploy real recebeu a aprovação nominal exigida por `AGENTS.md`.

## 8. Limitações conhecidas

- A VM continua sendo ponto único de falha.
- O Tunnel observado é remotamente gerenciado; a mudança inicial de cada hostname depende de ação aprovada no painel/API Cloudflare.
- O pico real de CPU/RAM/storage durante build simultâneo ao slot ativo ainda precisa ser medido no piloto.
- A janela de bake e os limites de capacidade serão fixados após essa medição; até lá são parâmetros sem valor canônico.
