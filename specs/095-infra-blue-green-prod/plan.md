# Plano — Spec 095 · Blue-green nos ambientes de produção

## 1. Leitura da arquitetura atual

### 1.1 Fluxo compartilhado

`_deploy-module.yml` atende seis módulos descritos em `.github/deploy-manifest.json`. `mesas`, `glossario`, `site` e `downloads` têm beta e produção; `links` e `accounts` têm apenas produção. A bifurcação blue-green deve ocorrer depois da resolução do ambiente: `prod` segue o plano novo e `beta` continua no caminho atual.

O deploy atual faz snapshot, aplica migrations, derruba o projeto Compose inteiro, constrói imagens na VM e recria tudo. O rollback atual recria a mesma imagem recém-construída; `docker image prune -f` e `docker builder prune --all -f` encerram o workflow. Portanto não existe artefato anterior confiável para rollback de aplicação.

### 1.2 Topologia por módulo

| Projeto | Release duplicável | Estado/singleton | Riscos específicos |
|---|---|---|---|
| glossario | frontend nginx + API | Postgres | `container_name` fixo; API consome catálogo do site por `site-prod-app` |
| links | app Astro/Node | Postgres + cron semanal do host | crontab usa `docker exec ... links-app`; nome fixo |
| site | app Astro/Express | Postgres | migration/export/build no entrypoint; consumidores internos usam `site-prod-app` |
| downloads | frontend nginx + API | Postgres + três schedulers internos | volume compartilhado de frontend; um scheduler ainda usa advisory lock de sessão via pool |
| mesas | frontend nginx + API | Postgres + `mesas-cron` | volume compartilhado de frontend; cron seria duplicado; API consome catálogo do site e o hydrator valida literalmente `http://site-prod-app:4322` |
| accounts | API | Postgres | SSO central e maior blast radius |

Evidência textual: `rtk rg -n -g "docker-compose.prod.yml" "container_name:|CATALOG_API_URL|frontend_dist|mesas-cron|downloads-api|links-app" apps` em 2026-08-21.

### 1.3 Capacidade observada da VM

Inspeção read-only por `ssh faren` em 2026-08-21:

- Docker Compose `v5.4.0`;
- 23 GiB RAM total, 20 GiB disponível;
- 154 GiB livres no filesystem Docker;
- maior container de app observado: site, aproximadamente 259 MiB; links ~200 MiB; downloads API ~180 MiB;
- um único `cloudflared`, saudável, sem mount de configuração e conectado a `artificio_net`;
- imagens de aplicação atuais usam tags mutáveis `:latest`.

Essa fotografia sustenta testar um candidato por vez. Não prova capacidade para o pico de build; a Fase 1 adiciona medição e abort guard antes do piloto.

## 2. Arquitetura alvo

### 2.1 Três planos por projeto

```text
Cloudflare Tunnel
       |
       v
<modulo>-prod-ingress          (estável, singleton)
       |
       +------> slot blue      (release SHA A)
       |
       `------> slot green     (release SHA B)

blue/green ------> <modulo>-prod-db  (estável, singleton)
```

1. **Plano de estado:** DB, volume de dados e jobs que precisam ser singleton. Nunca é derrubado por release.
2. **Plano de ingress:** NGINX mínimo por projeto, estável em `artificio_net`. Mantém arquivo `active.conf` e faz reload gracioso.
3. **Plano de release:** um projeto Compose por slot, contendo apenas serviços duplicáveis e volumes efêmeros daquele slot.

Ingress por projeto foi escolhido em vez de um proxy global para preservar a fronteira modular: configuração ou falha de `mesas` não pode afetar `accounts`, por exemplo.

### 2.2 Identidade e nomes

Convenção proposta:

```text
Compose state:    artificio-<modulo>-prod-state
Compose slot:     artificio-<modulo>-prod-blue|green
Ingress:          <modulo>-prod-ingress
Alias do slot:    <modulo>-prod-blue-app|api
Image:            artificio/<modulo>-<service>:<git-sha>
State file:       /opt/artificio/deploy-state/<modulo>-prod.json
```

O state file contém somente metadados não secretos: active slot, current SHA, previous SHA, workflow run e timestamps. A fonte de verdade é reconciliada com a configuração carregada no ingress e os labels Docker; divergência aborta antes de qualquer troca.

### 2.3 Rede

- ingress e endpoints públicos dos slots entram em `artificio_net` externa;
- DB fica numa rede state privada; slots entram nela apenas para alcançar o DB;
- frontends e APIs pareados usam aliases slot-specific para impedir frontend verde → API azul;
- consumidores internos passam a usar o ingress estável do `site`, não `site-prod-app` descartável; isso inclui defaults Compose e a validação literal em `apps/mesas/backend/src/services/systemProjectionHydrator.ts:100`;
- IP nunca é persistido; resolução é por nome/alias Docker.

### 2.4 Imagens e volumes

- cada serviço de release declara `image: artificio/...:${RELEASE_SHA}`;
- build ocorre enquanto o ativo serve;
- labels registram SHA, slot, módulo e run;
- volumes de DB tornam-se `external`/state-owned;
- volumes `frontend_dist_*` são separados por slot ou removidos, preferindo assets dentro das imagens;
- cleanup protege SHA atual e anterior; só remove releases mais antigas depois do bake e por inventário explícito.

Não introduzir GHCR como pré-condição. A VM pode manter as imagens SHA-tagged localmente. Registro remoto pode ser uma evolução separada.

## 3. Algoritmo do deploy de produção

1. adquirir lock compartilhado de deploy da VM e concurrency de produção no GitHub Actions;
2. resolver módulo, ativo, inativo, SHA atual e SHA candidato;
3. reconciliar state file, ingress, containers e imagens; abortar em divergência;
4. medir RAM, disco, Docker storage e existência dos singletons;
5. snapshot read-only/backup conforme runbook, sem parar DB;
6. construir imagens SHA-tagged do candidato;
7. avaliar migrations; barrar incompatível; executar runner singleton compatível;
8. subir somente o slot inativo com `docker compose up -d --wait` e timeout;
9. executar smoke direto no candidato, incluindo endpoint que devolve SHA;
10. renderizar configuração do ingress para o candidato em arquivo temporário;
11. validar com `nginx -t`;
12. substituir atomicamente a configuração ativa e executar `nginx -s reload`;
13. executar smoke externo pelas URLs críticas do manifest;
14. em falha crítica, restaurar config anterior, reload e smoke do slot anterior;
15. em sucesso, aguardar bake observável e drain; manter slot anterior pronto;
16. promover metadados candidato→ativo e ativo→anterior;
17. parar/remover somente releases anteriores à anterior;
18. prune por allowlist, preservando atual e anterior;
19. emitir resumo auditável.

O caminho beta continua chamando o fluxo in-place. Ele não reutiliza state file nem ingress blue-green.

## 4. Migrations sem downtime

### 4.1 Regra expand/contract

Uma mudança incompatível vira no mínimo duas releases:

1. **expand:** adicionar estrutura compatível; old e new funcionam;
2. **migrate/backfill:** mover dados de forma retomável;
3. **contract:** remover legado somente quando nenhuma release rollbackável o usa.

O SHA anterior preservado define a fronteira de compatibilidade. Enquanto ele puder receber rollback, o schema deve atendê-lo.

### 4.2 Runners

- manter um runner singleton por módulo, chamado pelo workflow;
- remover migration de entrypoint replicável, especialmente no `site`;
- migrations devem terminar antes da readiness do candidato;
- failure de migration não troca tráfego;
- rollback de aplicação não restaura DB automaticamente;
- migration destrutiva exige release contract separada, backup e aprovação nominal existente na governança.

### 4.3 Gate executável

Estender `scripts/deploy/check_migration_online_safe.sh` e testes para classificar:

- permitido automaticamente;
- exige justificativa/compat test;
- bloqueado para blue-green.

Além de regex, cada PR com migration deve provar old+new contra schema expandido. O gate não deve prometer analisar toda semântica SQL; padrões desconhecidos falham fechados para revisão.

## 5. Jobs e side effects

### 5.1 Downloads

`server.ts:177-179` inicia link checker, scraper e metrics em toda réplica. Metrics e scraper usam helper de lock transacional; `linkCheckerScheduler.ts:18-65` ainda adquire `pg_try_advisory_lock` e libera com outra consulta via pool. PostgreSQL documenta que lock de sessão pertence à sessão; com pool, acquire e unlock podem usar conexões distintas.

Antes do rollout de downloads:

- migrar link checker para `withAdvisoryLock`/`pg_try_advisory_xact_lock`;
- adicionar teste com duas réplicas concorrentes;
- provar uma única rodada/efeito para os três schedulers.

### 5.2 Mesas

`mesas-cron` sai do Compose do slot e passa ao plano state. Handoff de release do cron ocorre separado do cutover HTTP, com uma instância e health/last-run observável.

### 5.3 Links

O crontab do host observado executa dentro de `links-app`. Substituir por serviço/runner singleton estável ou comando que resolve explicitamente o slot ativo. O cron não pode depender do nome descartável de um slot.

## 6. Bootstrap por projeto

Bootstrap é diferente de release rotineira e sempre exige aprovação nominal:

1. criar state plane sem recriar DB/volume;
2. criar ingress estável e verificar acesso interno;
3. subir slot que representa a versão atualmente ativa;
4. validar diretamente ingress→slot;
5. mudar a rota do Tunnel do container atual para `<modulo>-prod-ingress`;
6. executar smoke externo;
7. manter rollback de rota documentado até validar;
8. somente então remover o acoplamento ao container antigo.

Não mudar DNS. A única alteração Cloudflare planejada é o destino local do hostname no Tunnel. Depois do bootstrap, a rota não muda entre releases.

## 7. Rollout e gates

### Onda 1 — fundação sem tráfego

- orquestrador, proxy, state schema, testes de falhas e compatibilidade do manifest;
- nenhum deploy real;
- teste local com serviço sintético e conexão lenta.

### Onda 2 — piloto `glossario`

- medir pico de build, dois slots, reload, drain e rollback;
- fixar limites de capacidade e janela de bake com base nessa medição;
- dois deploys consecutivos sem falha no probe externo.

### Onda 3 — `links` e `site`

- resolver cron do links;
- externalizar migration/build runtime do site;
- estabilizar o alias interno do catálogo.

### Onda 4 — `downloads` e `mesas`

- volumes de frontend slot-scoped;
- schedulers/cron singleton;
- teste explícito contra execução duplicada.

### Onda 5 — `accounts`

- último rollout;
- smoke login/me/logout, cookie compartilhado, allowlist e ao menos um consumidor;
- rollback exercitado sem invalidar sessões.

Cada onda precisa de PR próprio e cada bootstrap/deploy real precisa de aprovação própria. Nenhum gate autoriza o seguinte automaticamente.

## 8. Arquivos previstos

| Área | Arquivos/caminhos esperados |
|---|---|
| workflow | `.github/workflows/_deploy-module.yml`, workflows chamadores |
| manifest | `.github/deploy-manifest.json` e schema/testes |
| orquestrador | `scripts/deploy/blue-green-*`, `scripts/deploy/tests/*` |
| proxy | template/config NGINX versionado em `infra/` ou `scripts/deploy/` |
| compose | `apps/{accounts,site,links,glossario,downloads,mesas}/docker-compose.prod.yml` e overlays state/slot |
| migrations | runners e guards de cada módulo afetado |
| jobs | schedulers downloads, `mesas-cron`, cron do links |
| docs | `docs/agents/deploy-runbook.md`, manifest/runbook de rollback |

A implementação pode ajustar nomes/caminhos, mas não os contratos da spec sem emenda explícita.

## 9. Estratégia de testes

### 9.1 Orquestrador

Testes shell determinísticos com Docker/NGINX fake ou fixture devem cobrir:

- resolução blue/green e caminho beta;
- candidato unhealthy;
- migration falha;
- `nginx -t` falha;
- smoke externo falha e auto-rollback;
- interrupção em cada checkpoint;
- state file divergente;
- cleanup preservando atual/anterior;
- concorrência de dois deploys;
- filtro de segredos nos logs.

### 9.2 Integração local

- dois slots simultâneos;
- request lento durante reload;
- identidade SHA por slot;
- DB singleton sem restart;
- volumes/assets separados;
- retorno ao slot anterior sem rebuild.

### 9.3 Por módulo

- health e rotas críticas do manifest;
- migrations old+new;
- schedulers/cron quando aplicável;
- consumers internos do catálogo;
- SSO completo para accounts.

### 9.4 Final

Somente quando o mantenedor disser que não há mais reviews: `test`, `lint` e `build` repo-wide, um por vez, com cache, além de `pnpm verify:api` se arquivos cobertos pelo gate forem alterados. Fazer auditoria explícita de cobertura dos novos caminhos de falha; não aceitar apenas happy path.

## 10. Rollback da própria iniciativa

Por projeto, antes de remover a topologia antiga:

- preservar Compose/config anterior;
- documentar a rota Tunnel anterior;
- poder devolver Tunnel ao origin antigo durante o bootstrap;
- não renomear/deletar volume do DB;
- não limpar imagem atual/anterior;
- só considerar migração irreversível concluída após dois deploys verdes e gate do mantenedor.

## 11. Pesquisa externa — §R

Somente documentação primária/oficial foi usada.

| ID | Achado | Consequência para a spec | Fonte |
|---|---|---|---|
| R-EXT-01 | Compose usa project name para isolar cópias do mesmo app. | slots usam project names distintos. | [Docker — Specify a project name](https://docs.docker.com/compose/how-tos/project-name/) |
| R-EXT-02 | `container_name` impede escalar o serviço além de um container. | remover nome fixo dos serviços duplicáveis. | [Docker — Services / container_name](https://docs.docker.com/reference/compose-file/services/) |
| R-EXT-03 | `docker compose up --wait` aguarda serviços running/healthy. | readiness inicial usa healthcheck + timeout, seguida de smoke. | [Docker — compose up](https://docs.docker.com/reference/cli/docker/compose/up/) |
| R-EXT-04 | Compose oferece `healthcheck` e `stop_grace_period`; default de grace é 10s. | declarar health real e drain explícito, sem depender do default. | [Docker — Services](https://docs.docker.com/reference/compose-file/services/) |
| R-EXT-05 | Rede Compose resolve serviços por nome; IP muda ao recriar container. | ingress e slots usam aliases, nunca IP persistido. | [Docker — Networking in Compose](https://docs.docker.com/compose/how-tos/networking/) |
| R-EXT-06 | Volume external tem lifecycle fora do app Compose. | DB/volumes state-owned não são removidos pelo slot. | [Docker — Volumes](https://docs.docker.com/reference/compose-file/volumes/) |
| R-EXT-07 | Reload NGINX valida config; novos workers entram, antigos param de aceitar e concluem requests; config inválida mantém a anterior. | cutover por `nginx -t` + reload gracioso e slot anterior vivo. | [NGINX — Beginner’s Guide / reload](https://nginx.org/en/docs/beginners_guide.html) |
| R-EXT-08 | Tunnel publica hostname mapeando-o a um serviço local. | hostname passa a mapear ingress estável; slots não exigem mudança Cloudflare. | [Cloudflare — Tunnel routing](https://developers.cloudflare.com/tunnel/routing/) |
| R-EXT-09 | `httpHostHeader` permite controlar Host enviado ao origin. | bootstrap deve medir/preservar Host esperado por cada ingress. | [Cloudflare — Origin parameters](https://developers.cloudflare.com/tunnel/advanced/origin-parameters/) |
| R-EXT-10 | Expand/contract mantém consistência e reduz downtime em mudanças de schema. | migrations incompatíveis são divididas entre releases. | [Prisma — Expand-and-contract migrations](https://docs.prisma.io/docs/guides/database/data-migration) |
| R-EXT-11 | Lock advisory de sessão dura até unlock na mesma sessão; lock transacional termina no commit/rollback. | jobs sobre replicas usam lock transacional ou conexão dedicada, nunca acquire/unlock soltos via pool. | [PostgreSQL — Advisory lock functions](https://www.postgresql.org/docs/17/functions-admin.html) |
| R-EXT-12 | GitHub Actions permite limitar a um deploy por concurrency group. | serializar produção por VM e não cancelar cutover em andamento. | [GitHub — Deployments and concurrency](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments) |

## 12. Perguntas fechadas pelo piloto

Estes itens não bloqueiam a fundação, mas precisam de valor medido antes do rollout pós-glossario:

1. qual limite mínimo de RAM/disco aborta o candidato;
2. qual janela de bake captura regressões relevantes sem manter slot antigo além do necessário;
3. qual `stop_grace_period` atende requests longos reais de cada projeto;
4. qual pico de build e duração máxima admissível por serviço;
5. se o Host atual do Tunnel chega inalterado ou exige `httpHostHeader` em cada rota.

Até a medição, esses valores permanecem parâmetros sem default canônico; não devem ser inventados no workflow.
