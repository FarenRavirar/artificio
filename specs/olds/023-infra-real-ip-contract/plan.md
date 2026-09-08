# Plano — 023

## Arquitetura da solucao
Contrato unico:

```text
Internet -> Cloudflare edge -> Cloudflare Tunnel -> cloudflared na artificio_net -> app
```

- Nginx (`mesas`, `glossario`): `set_real_ip_from ${TRUSTED_REAL_IP_FROM}` + `real_ip_header CF-Connecting-IP`; repassa `X-Forwarded-For $remote_addr`.
- Express (`accounts`, `site`, backends de `mesas`/`glossario`): `app.set("trust proxy", TRUSTED_PROXY_CIDR || "172.18.0.0/16")`.
- CIDR atual da VM: `172.18.0.0/16`, verificado por `docker network inspect artificio_net`.
- O valor fica configuravel por env para sobreviver a recriacao de rede.

## Arquivos afetados
- `apps/mesas/frontend/nginx.conf`
- `apps/mesas/docker-compose.{beta,prod}.yml`
- `apps/glossario/frontend/nginx.conf.template`
- `apps/glossario/docker-compose.{beta,prod}.yml`
- `apps/accounts/src/app.ts`
- `apps/accounts/docker-compose.yml`
- `apps/site/server/server.ts`
- `apps/site/docker-compose.beta.yml`
- `apps/mesas/backend/src/server.ts`
- `apps/glossario/backend/src/index.ts`
- `scripts/ci/check_ingress_realip_contract.mjs`
- `package.json`
- `.specify/arquiteture.md`
- `docs/agents/infra-map.md`
- `.specify/memory/{decisions,errors,project-state}.md`
- `sessoes/26-06-15_1_mesas_nginx-realip.md`

## Contratos/interfaces tocados
- Infra/ingress: contrato de confianca para IP real atras do Cloudflare Tunnel.
- Auth/accounts: somente `trust proxy` do Express; sem alterar JWT, cookie, OAuth ou retorno.
- Sem schema, sem banco, sem DNS, sem Cloudflare API.

## Impacto em consumidores
- `mesas`: rate-limit e logs passam a usar IP validado pelo nginx.
- `glossario`: feedback/migration rate-limit deixam de depender de header cru.
- `site`: feedback rate-limit passa a confiar no proxy interno por CIDR.
- `mesas`/`glossario` backends: `req.ip` passa a aceitar XFF somente do nginx/cloudflared na rede interna confiavel.
- `accounts`: rotas de auth continuam atras do Tunnel, mas Express nao confia em qualquer hop arbitrario.

## Rollback
- Reverter os arquivos alterados localmente ou por commit.
- Em deploy, rollback normal do workflow volta a imagem anterior.
- Se a subnet interna mudar, ajustar `TRUSTED_REAL_IP_FROM` e `TRUSTED_PROXY_CIDR` no env/secret sem rollback de codigo.

## Validacao
- `pnpm --filter @artificio/mesas smoke:nginx-realip`
- `node scripts/ci/check_ingress_realip_contract.mjs`
- `git diff --check`
- Busca final por `$proxy_add_x_forwarded_for`, `proxy_set_header X-Forwarded-For $http_cf_connecting_ip` e `app.set("trust proxy", 1)`.
- Pos-deploy beta/prod: `nginx -t` nos containers nginx, health 200/401 esperados, e inspecao de config renderizada.
