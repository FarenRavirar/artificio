# Sessão 26-06-20_1 — Spec 035: Pequenos Débitos de Infra

- **Data:** 2026-06-20
- **Escopo:** infra — `apps/accounts`, `.github/`, `packages/auth`, `packages/content`, `apps/mesas/scripts/`
- **Gate:** D
- **Spec:** `specs/035-infra-small-debts/`
- **Autorização:** mantenedor pediu spec 035 + iniciar por BL-ACCOUNTS-PORT. Sem commit/push/deploy sem aprovação nominal.

## Objetivo

Fechar débitos pequenos de infra em série: BL-ACCOUNTS-PORT, BL-CI-ESLINT-FLAT-CONFIG, BL-DEP-MESAS-AUTO-PUSH, BL-DEP-MESAS-LEGACY-SCRIPTS, BL-MESAS-AUTO-ARCHIVE-CF.

## T0/T1 lidos

T0: `project-state.md`, `context-capsule.md`, `decisions.md`. T1: `specs/backlog.md`, `infra-map.md`, `AGENTS.md` (Git/Branch/Deploy, Aprovação).

## Plano

- [x] BL-ACCOUNTS-PORT (T1-T4 local concluído, T5 aguarda deploy com aprovação)
- [ ] BL-CI-ESLINT-FLAT-CONFIG (T7-T11)
- [ ] BL-DEP-MESAS-AUTO-PUSH (T12-T13)
- [ ] BL-DEP-MESAS-LEGACY-SCRIPTS (T14-T16)
- [ ] BL-MESAS-AUTO-ARCHIVE-CF (T17-T19)
- [ ] Fechamento documental (T20-T22)

## BL-ACCOUNTS-PORT — Executado

### Descobertas da investigação (read-only VM, 2026-06-20)

- `docker ps`: `accounts-api` é o ÚNICO container com host port binding (`0.0.0.0:3000->3000/tcp`). Todos os outros (mesas-api, glossario-api, site-prod-app, etc.) mostram apenas portas internas.
- `docs/agents/infra-map.md:48`: Cloudflare Tunnel roteia `accounts.artificiorpg.com` → `http://accounts-api:3000` (Docker DNS, NÃO localhost).
- `infra-map.md:120`: débito documentado desde 2026-06-04: *"O Tunnel usa accounts-api:3000 pela artificio_net; avaliar trocar para expose"*.
- Probe cross-container: `docker exec mesas-api wget --spider http://accounts-api:3000/health` → 200 (Docker DNS funciona).
- `ss -tlnp`: `LISTEN 0.0.0.0:3000` no host — docker-proxy do accounts, desnecessário.
- `docker inspect cloudflared`: na rede `artificio_net` (IP 172.18.0.2), pode resolver `accounts-api` via Docker DNS.
- Nenhum consumidor acessa `localhost:3000` ou `host-ip:3000` para o accounts. Todos usam `https://accounts.artificiorpg.com` (público via Tunnel).

### Alterações locais

1. `apps/accounts/docker-compose.prod.yml:61-62`: `ports: "3000:3000"` → `expose: ["3000"]`. Comentário atualizado.
2. `apps/accounts/docker-compose.yml:35-36`: idem.
3. Build local: `pnpm --filter @artificio/accounts build` ✅ verde (25 modules, 2.52s).
4. Compose syntax: `docker compose config` na VM — parse OK.
5. `docs/agents/infra-map.md:120`: débito removido, marcado como resolvido.
6. `specs/backlog.md`: `BL-ACCOUNTS-PORT` atualizado para status "local (aguarda deploy)".

### Pendente

- T5: Deploy prod com aprovação nominal (`module=accounts mode=deploy`, smoke health/login/me).
- T6: Já feito (infra-map atualizado).

## BL-DEP-MESAS-AUTO-PUSH — Investigado (2026-06-20)

### Descobertas

- `deploy-manifest.json:17`: mesas `"auto_deploy_on_push": true`. Único app com deploy automático.
- `deploy.yml:131-147`: lógica — evento `push` + branch `dev` (única em `push_branches`) + `auto_deploy_on_push=true` + `git diff` em `apps/mesas/**` → `deploy=true` → beta redeployado.
- Incidente spec 033: 4 de 5 deploys automáticos falharam (PRs #63-#66): `ENOENT patches/` ×3 + wildcard `'*'` path-to-regexp v8. Beta offline entre falhas. Sem cancelamento.
- Contraste: glossario/site/accounts = `false` (dispatch manual).
- Causa histórica: herança do `deploy-mesas.yml` standalone pré-F4.

### Tasks registradas em `specs/035-.../tasks.md`

T12a (investigação confirmatória) ✅ — confirmado que `deploy.yml` é o único workflow de deploy do mesas. `break-glass` é prod manual. `mesas-auto-archive` é cron, não deploy.

T12b-T12e pendentes de autorização para editar código.

### Próximo

Aguardando autorização para continuar investigação do BL-DEP-MESAS-LEGACY-SCRIPTS.

## BL-DEP-MESAS-LEGACY-SCRIPTS — Investigado (2026-06-20)

### Descobertas

- `apps/mesas/scripts/` = 11 arquivos, zero referências no monorepo.
- **Duplicação crítica:** `apps/mesas/scripts/deploy/apply_required_migrations.sh` (SHA `DFF14843...`) NÃO é o mesmo que `scripts/deploy/apply_required_migrations.sh` (SHA `9FDD7EE9...`). O root-level é o canônico usado pelo `_deploy-module.yml:441`. O app-level é legado divergido.
- `deploy-prod.sh` referencia `/opt/mesas` (path pré-monorepo).
- `preflight_prod.sh` referencia `C:\\projetos\\config` (Windows do mantenedor).
- `ops/hydrate_beta.py`: relacionado a BL-BETA-HYDRATE (bloqueado). Nunca usado.
- `turbo.json` de mesas não cobre `scripts/` → remoção não afeta build.

### Tasks registradas em `specs/035-.../tasks.md`

T14a-T14c (investigação) ✅. T15a (decisão de escopo: opção A ou B) pendente do mantenedor.

### Próximo

Aguardando autorização para investigar BL-MESAS-AUTO-ARCHIVE-CF.

## BL-MESAS-AUTO-ARCHIVE-CF — Investigado (2026-06-20)

### Descobertas

- **Causa raiz:** workflow faz curl de IP público (GitHub runner) → Cloudflare challenge 403. Tráfego automatizado de data center bloqueado.
- **Teste read-only na VM:** `docker exec mesas-api wget http://localhost:3000/api/v1/admin/tables/auto-archive -H 'x-cron-secret: test'` → **401 Unauthorized**. Prova que endpoint interno funciona (401 = secret errado, esperado).
- **Gates do endpoint (adminTables.ts:15-49):** NODE_ENV=production ✅, MESAS_CRON_SECRET configurado ✅, timingSafeEqual ✅.
- **Secret na VM:** `/opt/artificio/apps/mesas/.env` contém `MESAS_CRON_SECRET` (64 chars hex).
- **Solução:** trocar curl público por SSH + curl interno (`source .env && curl http://mesas-api:3000/...`). Secret nunca sai da VM. Padrão SSH igual `docker-cleanup.yml`.
- **Idempotente:** `UPDATE ... WHERE archived_at IS NULL AND ...`. Rodar de novo = seguro.

### Tasks registradas

T17a-T17c ✅. T18a (decisão opção A/B) pendente. T18b-T19 (edição + teste) aguardam autorização.

## Checklist de fechamento

- [x] Spec 035 criada (spec/plan/tasks)
- [x] Sessão atualizada
- [x] `specs/backlog.md` atualizado (BL-ACCOUNTS-PORT)
- [ ] `project-state.md` atualizado
- [ ] Nenhum arquivo parcialmente modificado
- [x] Validação local registrada por débito (BL-ACCOUNTS-PORT, BL-DEP-MESAS-AUTO-PUSH)
