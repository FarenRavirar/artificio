# Sessão 26-08-21_2 — Infra · Spec 095 blue-green em produção

## Pedido

Pesquisar práticas atuais, investigar a estrutura local e a VM somente em modo read-only e criar uma spec para blue-green apenas nos ambientes de produção.

## Escopo autorizado

- leitura local, GitHub Actions, Internet e VM;
- escrita documental local da spec 095 e seus registros;
- nenhuma escrita na VM, deploy, DNS/Tunnel, commit, push ou merge.

## Medições realizadas

### Repositório

- `.github/workflows/_deploy-module.yml:497-499`: `down` → `build --no-cache --pull` → `up --force-recreate`;
- seis módulos no `.github/deploy-manifest.json`;
- todos os Compose prod têm `container_name` fixo nos serviços de release;
- DB está no mesmo projeto Compose da aplicação;
- `downloads` e `mesas` compartilham volume de frontend entre front/API;
- `mesas-cron` está no Compose prod;
- defaults Compose e o hydrator de mesas dependem literalmente de `site-prod-app:4322`;
- downloads inicia três schedulers por réplica;
- links possui cron do host acoplado ao nome `links-app`;
- site executa migration no entrypoint.

Comandos principais: `rtk rg`, `rtk read`, graph `search_graph`/`trace_path`/`get_code_snippet` e `check_index_coverage`. Workflows/configs são cobertura parcial ou não indexada pelo grafo; foram lidos por fonte textual.

### Deploys reais

`gh run view <run> --job <job> --log` mediu janelas app stopping → app healthy:

- downloads: 6m06,5s;
- site: 5m19,9s;
- mesas: 3m33,1s;
- accounts: 2m15,5s.

### VM read-only

Via `ssh faren`:

- Compose v5.4.0;
- 23 GiB RAM total / 20 GiB disponível;
- 154 GiB livres;
- `cloudflared` singleton em `artificio_net`, remotamente gerenciado;
- imagens atuais mutáveis `:latest`;
- crontab links usa `docker exec ... links-app`.

Não foi medido o pico de build com dois slots; a spec exige essa medição no piloto.

## Decisão de arquitetura

- blue-green somente em prod; beta in-place;
- ingress NGINX estável por projeto;
- DB/jobs singleton separados dos slots;
- slots Compose blue/green com imagens SHA-tagged;
- migration expand/contract e runner singleton;
- piloto glossario; accounts por último;
- bootstrap de Tunnel separado e nominalmente aprovado;
- nenhum write externo realizado nesta sessão.

## Entregáveis

- `specs/095-infra-blue-green-prod/spec.md`;
- `specs/095-infra-blue-green-prod/plan.md`;
- `specs/095-infra-blue-green-prod/tasks.md`;
- reconciliação do débito `BL-DEP-CONTAINER-NAMES` no backlog;
- entrada no índice de sessões.

## Estado

Spec redigida; nenhuma implementação ou ação de produção executada. Aguarda gate do mantenedor para iniciar a Fase 1.
