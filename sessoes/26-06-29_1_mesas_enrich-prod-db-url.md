# Sessão 26-06-29_1 — mesas: enrich prod→dev 500 (PROD_DB_URL ausente)

- **Data:** 2026-06-29
- **App/escopo:** apps/mesas (backend infra/env beta)
- **Gate:** D (mesas em prod) · ambiente beta
- **Modo:** Sem SDD (correção pontual de infra/env; só sessão, sem spec — decisão do mantenedor)
- **Vínculos:** `BL-BETA-HYDRATE` / `T-HYDb` (spec 005/035, débito histórico nunca resolvido)

## Objetivo

Diagnosticar 500 em `POST /api/v1/admin/sync/enrich?dry_run=false` (botão "Sincronização Prod → Dev" em https://mesasbeta.artificiorpg.com/gestao/integracoes).

## Diagnóstico (investigação read-only na VM)

Causa-raiz: `.env.beta` **não tem** `PROD_DB_URL`.

- `apps/mesas/backend/src/db/prod.ts` → `getProdDb()` lê `process.env.PROD_DB_URL`; se vazio, lança `Error: PROD_DB_URL environment variable is required`.
- `docker-compose.beta.yml:56` liga `PROD_DB_URL=${PROD_DB_URL}` → vira vazio sem entrada no `.env.beta`.
- `adminEnrichment.ts:23` toca `prodDb` → lança → catch genérico (linha 457) → `500 "Erro durante o enriquecimento"`.
- Guard `NODE_ENV`: beta = `development` → passa (em prod retornaria 403, by design).

Log real `mesas-beta-api`:
```
[Enrichment] Error: PROD_DB_URL environment variable is required for production database connection
    at getProdDb (.../dist/db/prod.js:18:15)
```

Endpoint renomeado de `/sync/hydrate` (legado) → `/sync/enrich`; mesma raiz do débito antigo.

### Evidências de infra (read-only)

| Item | Resultado |
|---|---|
| Redes | `mesas-beta-api`, `mesas-db` (prod), `mesas-beta-db` todos em `artificio_net` |
| DNS | `mesas-db` resolve do beta-api → `172.18.0.11` |
| TCP | beta-api → `mesas-db:5432` conecta OK |
| DB prod | host `mesas-db`, porta 5432, DB `mesas_rpg`, user `admin` (RW) |
| Roles prod | **só `admin` (RW)** — sem user read-only |
| Schema prod | único `public`, 53 tabelas, PG 16.14 |
| Uso de prod no endpoint | só `selectFrom` (linhas 27, 57-73); escrita toda via `trx` no DB dev → **read-only de fato** |

## Decisão

Mantenedor escolheu a via **mais segura**: criar role read-only em prod (não usar `admin` RW no `.env.beta`).

## Plano de fix (write VM + segredo = mantenedor; NÃO executado pelo agente)

1. Criar role `mesas_ro` LOGIN com senha forte em prod (`mesas-db` / `mesas_rpg`).
2. GRANT CONNECT no DB + USAGE no schema public + SELECT em todas as tabelas public.
3. `ALTER DEFAULT PRIVILEGES FOR ROLE admin IN SCHEMA public GRANT SELECT ON TABLES TO mesas_ro` (cobre tabelas futuras).
4. Setar `PROD_DB_URL` no `.env.beta` apontando p/ a role `mesas_ro` (host `mesas-db`, DB `mesas_rpg`).
5. Recriar container: `docker compose -f docker-compose.beta.yml up -d mesas-beta-api`.
6. Smoke: dry_run=true primeiro, depois dry_run=false.

## Checklist de fechamento

- [x] Causa-raiz confirmada com log real + evidência de env
- [x] Investigação de rede/DNS/TCP/roles/schema (read-only)
- [x] Decisão do mantenedor registrada (via read-only role)
- [x] Fix aplicado (2026-06-29, autorização nominal do mantenedor)
- [x] Smoke técnico: health 200; `mesas_ro` SELECT OK (15 users); WRITE negado (`permission denied for table tags`); beta-api conecta no prod (14 tables)
- [x] Smoke da UI (botão "Sincronização Prod → Dev") — **OK confirmado pelo mantenedor (2026-06-29)**
- [x] `BL-BETA-HYDRATE` fechado no backlog
- [x] `project-state.md` log atualizado

## Status final: SESSÃO ENCERRADA (2026-06-29)

Bug resolvido em prod (beta). `BL-BETA-HYDRATE` fechado. Smoke UI verde confirmado pelo mantenedor.

## Execução (2026-06-29)

1. Role read-only criada em prod (`mesas-db`/`mesas_rpg`):
   `CREATE ROLE mesas_ro LOGIN` + `GRANT CONNECT/USAGE/SELECT ALL TABLES` + `ALTER DEFAULT PRIVILEGES FOR ROLE admin ... GRANT SELECT`.
2. `PROD_DB_URL` anexado ao `.env.beta` apontando p/ a role `mesas_ro` (host `mesas-db`, DB `mesas_rpg`; senha só no arquivo gitignored).
3. Container recriado: `docker compose -p mesas-beta -f docker-compose.beta.yml --env-file .env.beta up -d mesas-beta-api`
   (primeira tentativa sem `--env-file`/`-p` falhou: compose lê `.env` por default → `SERVICE_SECRET missing`).
4. Validação técnica read-only: ver checklist acima.

Senha do `mesas_ro` vive só no `.env.beta` (gitignored na VM). Não versionada.

## Critério de conclusão

Botão "Sincronização Prod → Dev" retorna 200 com payload de tabelas no beta; `T-HYDb` fechado.
