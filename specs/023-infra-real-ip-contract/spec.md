# 023 — Contrato Real IP do Ingress Cloudflare Tunnel
- **Modulo/Pacote:** infra + apps/accounts + apps/site + apps/glossario + apps/mesas
- **Gate relacionado:** D

## Problema
Os servicos publicos em `*.artificiorpg.com` rodam atras de um Cloudflare Tunnel unico na VM e dependem de IP real do visitante para rate-limit, logs e auditoria. A correcao pontual anterior usava `CF-Connecting-IP` direto em alguns nginx, mas isso deixa o contrato distribuido por app e pode permitir spoofing se algum caminho futuro expuser o container fora do Tunnel.

## Requisitos
1. Todo servico publico na VM deve documentar e aplicar um contrato unico de IP real para a topologia `Cloudflare Tunnel -> artificio_net -> app`.
2. Apps com nginx devem aceitar `CF-Connecting-IP` somente de uma origem confiavel configurada por `TRUSTED_REAL_IP_FROM`.
3. Apps Express, diretos ou atras de nginx interno, devem confiar somente no CIDR interno configurado por `TRUSTED_PROXY_CIDR`.
4. Backends devem receber/logar/rate-limitar pelo IP validado, nao por `CF-Connecting-IP` cru nem por cadeia poluida de `X-Forwarded-For`.
5. CI/smoke local deve bloquear regressao para `$proxy_add_x_forwarded_for` e repasse cru de `$http_cf_connecting_ip`.
6. A documentacao canonica deve registrar a regra em `.specify/arquiteture.md`, `docs/agents/infra-map.md`, `.specify/memory/decisions.md` e `.specify/memory/errors.md`.

## Criterios de aceite
1. `apps/mesas` e `apps/glossario` usam RealIP do nginx com `TRUSTED_REAL_IP_FROM`.
2. `apps/accounts`, `apps/site`, `apps/mesas/backend` e `apps/glossario/backend` usam `TRUSTED_PROXY_CIDR` em vez de `trust proxy = 1`.
3. Smoke local de ingress passa e procura todos os arquivos relevantes.
4. Busca final nao encontra `$proxy_add_x_forwarded_for` nem `proxy_set_header X-Forwarded-For $http_cf_connecting_ip` em configs ativas.
5. Docs registram causa, impacto, solucao e prevencao.

## Fora de escopo
- Alterar DNS, rotas do Cloudflare Zero Trust ou token do Tunnel.
- Deploy beta/prod, commit, push, PR ou merge.
- Reestruturar `_deploy-module.yml`.
- Mudar WordPress raiz ou Gate C.

## Riscos e impacto em outros modulos
- `accounts` e `site` sao sensiveis porque recebem trafego direto no Express; validacao deve cobrir rotas de health e auth/admin protegidas.
- `glossario` e `mesas` dependem de nginx; erro no RealIP pode voltar ao balde unico de rate-limit.
- Se a subnet da `artificio_net` mudar, `TRUSTED_REAL_IP_FROM`/`TRUSTED_PROXY_CIDR` deve ser ajustado via env sem mudar codigo.
- `accounts` ainda publica `ports: "3000:3000"` no compose; isso e debito de hardening a avaliar antes de alterar, pois pode afetar fluxo especial de deploy/smoke do SSO.
