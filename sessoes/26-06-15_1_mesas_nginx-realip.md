# Sessao 26-06-15_1 — Spec 023 RealIP Cloudflare Tunnel

- Data: 2026-06-15
- Escopo: infra + apps/mesas + apps/glossario + apps/accounts + apps/site
- Spec: `specs/023-infra-real-ip-contract/`
- Tipo: SDD Completo (contrato compartilhado de ingress/infra; sem VM write/deploy)
- Gate: D
- Estado: concluída

## Objetivo
Corrigir D-NGINX2 e elevar para contrato unico: todo `*.artificiorpg.com` na VM deve aceitar IP real do visitante somente pelo caminho confiavel Cloudflare Tunnel -> `cloudflared` -> `artificio_net` -> app.

## Plano
- Auditar apps publicos com nginx/Express direto e dependencias de `req.ip`.
- Configurar RealIP no nginx para confiar na subnet interna Docker/Tunnel via env `TRUSTED_REAL_IP_FROM`.
- Configurar Express direto para confiar somente no CIDR interno via `TRUSTED_PROXY_CIDR`.
- Adicionar smoke local que bloqueia retorno a `$proxy_add_x_forwarded_for`, `CF-Connecting-IP` cru e `trust proxy = 1`.
- Registrar contrato em docs canonicas.

## Arquivos a modificar
- `apps/mesas/frontend/nginx.conf`
- `apps/mesas/docker-compose.prod.yml`
- `apps/mesas/docker-compose.beta.yml`
- `apps/glossario/frontend/nginx.conf.template`
- `apps/glossario/docker-compose.prod.yml`
- `apps/glossario/docker-compose.beta.yml`
- `apps/accounts/src/app.ts`
- `apps/accounts/src/env.ts`
- `apps/accounts/src/app.test.ts`
- `apps/accounts/docker-compose.yml`
- `apps/site/server/server.ts`
- `apps/site/docker-compose.beta.yml`
- `apps/mesas/backend/src/server.ts`
- `apps/glossario/backend/src/index.ts`
- `scripts/ci/check_ingress_realip_contract.mjs`
- `scripts/ci/check_mesas_nginx_realip.mjs`
- `apps/mesas/package.json`
- `package.json`
- `.specify/arquiteture.md`
- `docs/agents/infra-map.md`
- `docs/agents/deploy-runbook.md`
- `.specify/memory/decisions.md`
- `.specify/memory/errors.md`
- `.specify/memory/project-state.md`
- `specs/023-infra-real-ip-contract/{spec.md,plan.md,tasks.md}`
- `sessoes/index.md`
- esta sessao

## Criterio de conclusao
- Smoke local passa.
- `rg` confirma sem padroes proibidos em configs ativas.
- Docs canonicas registram causa, impacto, solucao e prevencao.
- Sessao registra evidencia e pendencias de deploy aprovado.

## Log
- 2026-06-15 — Inicio. Contexto T0 lido. D-NGINX2 confirmado em project-state/sessao anterior. Sem VM, sem commit/push/deploy.
- 2026-06-15 — Implementado local primeiro em `mesas`: `nginx.conf` usa `set_real_ip_from ${TRUSTED_REAL_IP_FROM}`, `real_ip_header CF-Connecting-IP`, `real_ip_recursive on`; todos os proxies repassam `X-Real-IP`/`X-Forwarded-For` como `$remote_addr` validado. Compose beta/prod define `TRUSTED_REAL_IP_FROM=${TRUSTED_REAL_IP_FROM:-172.18.0.0/16}`. Evidencia read-only VM: `docker network inspect artificio_net` => `172.18.0.0/16`. Smoke local `pnpm --filter @artificio/mesas smoke:nginx-realip` OK. `git diff --check` OK. Docker local indisponivel, entao `nginx -t` fica para deploy/beta.
- 2026-06-15 — Escopo ampliado por pedido do mantenedor: nao deixar como contexto de chat nem fix so de `mesas`; estudar impacto em todos os `*.artificiorpg.com` da VM. Criada Spec 023 (SDD Completo). Aplicado contrato em `glossario` nginx, `accounts` Express e `site` Express. Docs atualizadas: arquitetura, infra-map, deploy-runbook, decisions D069, errors E006, project-state e sessoes/index. Debito registrado: `accounts` ainda publica `ports: 3000:3000`; avaliar trocar para `expose` apos validar impacto.
- 2026-06-15 — Busca final achou `trust proxy = 1` ativo nos backends de `mesas` e `glossario`; alinhado para `TRUSTED_PROXY_CIDR` tambem. Composes backend receberam env correspondente.
- 2026-06-15 — Validacao local verde: `node scripts/ci/check_ingress_realip_contract.mjs`; `pnpm --filter @artificio/accounts test` (8/8); `pnpm --filter @artificio/mesas-backend build`; `pnpm --filter @artificio/glossario-backend build`; `git diff --check`; busca ativa em `apps/.github/scripts` sem padroes proibidos. Limite: Docker local indisponivel, entao `nginx -t` e smoke runtime ficam para beta/prod apos deploy. Adicionado script raiz `pnpm smoke:ingress-realip`.
- 2026-06-15 — Revalidado apos adicionar script raiz: `pnpm smoke:ingress-realip` OK e `git diff --check` OK.
- 2026-06-15 — Pedido do mantenedor: criar mapa geral de debitos/tarefas em `specs/` e fazer specs futuras atualizarem esse mapa. Criados `specs/README.md` e `specs/backlog.md`; atualizado skill `.agents/skills/new-spec/SKILL.md`, `AGENTS.md` e `project-state.md`. Validacao: `rg specs/backlog.md...` encontra referencias; `git diff --check` OK. Mapa inicial e curado, nao grep bruto; deve ser mantido vivo por specs futuras.
- 2026-06-15 — Revisao do mantenedor: regras de manutencao nao podem ficar no fim porque agentes leem topo; movidas para "LEIA PRIMEIRO". Backlog ampliado com debitos nomeados da sessao `26-06-12_2` (`D-MESAS1`, `D-FEEDBACK1`, `D-CONT1`, `D-SYNC1`, `D-DEP1`, `D-DEP2`, etc.) e uma secao de debitos fechados/absorvidos para evitar reabrir coisa stale.
- 2026-06-15 — Pedido do mantenedor: ler da spec 015 ate a mais recente e colocar todos os debitos. Varredura feita em `specs/015` a `specs/023` (`spec.md`, `plan.md`, `tasks.md` e anexos relevantes da 020). `specs/backlog.md` atualizado com debitos de 015/019/020/021/022/023, incluindo Express 5 mesas, deploy legado mesas, copy publica, UI primitives/theme, feedback anti-drift, fatias restantes da 022 e hardening RealIP/accounts. `D-MESAS1` movido para fechados porque `project-state.md` registra promocao em 2026-06-14.
- 2026-06-15 — Pedido do mantenedor: reforcar em `AGENTS.md` a obrigatoriedade de atualizar `specs/backlog.md` para nao depender de memoria do chat. Regra adicionada em "Conclusao de Tarefas", como criterio antes de declarar trabalho concluido.
- 2026-06-15 — Retomada final Codex. T0, sessao, spec 023, backlog, arquitetura D069, infra-map, deploy-runbook e E006 lidos. Proximo: revisar diff local, revalidar smokes/testes/builds, rodar buscas anti-regressao e preparar pedido nominal para publicacao se verde.
- 2026-06-15 — Revisao local final: diff conferido em nginx, Express, compose e smoke. Corrigido apenas comentario stale em `apps/mesas/frontend/nginx.conf` que ainda citava `trust proxy 1`; comportamento ja estava em CIDR. Validacoes verdes: `pnpm smoke:ingress-realip`; `pnpm --filter @artificio/accounts test` (8/8); `pnpm --filter @artificio/mesas-backend build`; `pnpm --filter @artificio/glossario-backend build`; `git diff --check`. Buscas anti-regressao em config/codigo ativo deram zero achados para `$proxy_add_x_forwarded_for`, `proxy_set_header X-Forwarded-For $http_cf_connecting_ip` e `app.set("trust proxy", 1)`. Busca ampla ainda acha apenas o proprio script de smoke e doc historico antigo em `apps/mesas/docs/Realizados/Reformulacao_mestre_v4.md`. Backlog verificado: sem atualizar status, pois `BL-REALIP-023` segue local ate commit/push/PR/deploy aprovados.
- 2026-06-15 — PR #39 mergeado em `dev` (aprovado pelo mantenedor) e actions acompanhadas. `pr-checks`, `deploy-accounts`, `deploy-site`, `deploy-mesas` e CI/deploy beta mesas verdes; `deploy-glossario` teve CI verde mas job `Deploy glossario beta` ficou `skipped`. Validacao runtime read-only aprovada: `mesas-beta-app nginx -t` OK e config renderizada contem `set_real_ip_from 172.18.0.0/16`, `real_ip_header CF-Connecting-IP`, `X-Real-IP $remote_addr`, `X-Forwarded-For $remote_addr`. `glossario-beta-app nginx -t` OK, mas config renderizada ainda esta antiga (`X-Real-IP $http_cf_connecting_ip`, `X-Forwarded-For $http_cf_connecting_ip`) porque container foi criado em 2026-06-14 e nao redeployou. Proximo: pedir aprovacao nominal para dispatch/deploy beta do glossario e repetir `nginx -t`/config.
- 2026-06-15 — Dispatch/deploy beta do glossario aprovado e executado: `deploy-glossario.yml --ref dev -f mode=deploy`, run `27554166969`, verde. `glossario-beta-app` recriado em 2026-06-15T14:43:26Z. Validacao runtime: `docker exec glossario-beta-app nginx -t` OK; config renderizada contem `set_real_ip_from 172.18.0.0/16`, `real_ip_header CF-Connecting-IP`, `X-Real-IP $remote_addr`, `X-Forwarded-For $remote_addr`. Smoke HTTP beta: `glossario_beta_home=200`, `glossario_beta_terms=200`, `mesas_beta_home=200`, `mesas_beta_api_v1_me=200`. Observacao: chute inicial em `/api/v1/auth/me` deu 404 porque a rota correta do mesas e `/api/v1/me`.
- 2026-06-15 — Promocao `dev -> main` autorizada nominalmente e executada via `promote-prod-fast-forward.yml --ref dev -f confirm=PROMOTE_DEV_TO_MAIN`, run `27554918556`, verde. `origin/main == origin/dev == c785bb8`.
- 2026-06-15 — Deploy prod autorizado nominalmente e executado via Actions: `deploy-accounts` run `27554992761` verde; `deploy-mesas` run `27554992843` verde; `deploy-glossario` run `27554992730` verde. Site prod nao existe por Gate C/WP raiz. Smoke HTTP prod local: `accounts_login=200`, `accounts_me=401`, `mesas_home=200`, `mesas_me_options=401`, `glossario_home=200`, `glossario_terms=200`, `wp_root=200`.
- 2026-06-15 — Validacao runtime prod read-only autorizada e executada. `docker exec mesas-app nginx -t` OK; `docker exec glossario-app nginx -t` OK. Config renderizada prod: mesas e glossario contem `set_real_ip_from 172.18.0.0/16`, `real_ip_header CF-Connecting-IP`, `X-Real-IP $remote_addr` e `X-Forwarded-For $remote_addr`. `BL-REALIP-023` fechado em `specs/backlog.md`; `tasks.md` da spec 023 e `project-state.md` atualizados. Residual mantido: `BL-ACCOUNTS-PORT`.

## Fechamento local
- [x] Config RealIP adicionada no nginx do mesas.
- [x] Config RealIP adicionada no nginx do glossario.
- [x] Headers crus de `CF-Connecting-IP` removidos do repasse ao backend nos nginx.
- [x] `accounts`, `site`, backend `mesas` e backend `glossario` usam `TRUSTED_PROXY_CIDR` em vez de `trust proxy = 1`.
- [x] Smoke local anti-regressao criado.
- [x] Subnet real da rede Docker confirmada por leitura na VM.
- [x] Documentacao canonica atualizada.
- [x] Backlog `specs/` criado e curado com debitos das specs 015-023.
- [x] Smoke/testes finais desta rodada.
- [x] Commit/push/PR/deploy: PR #39 mergeado; `dev -> main`; deploys prod accounts/mesas/glossario verdes.
- [x] Smoke runtime em beta/prod apos deploy.
