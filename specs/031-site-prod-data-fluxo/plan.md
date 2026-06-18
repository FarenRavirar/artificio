# Plano — 031 Site: direção do fluxo de dados (prod canônico, beta staging)

## Estratégia

Corrigir o fluxo de dados do site em 3 fases: (1) seed bootstrap beta→prod, (2) flip de autoria para prod, (3) sync prod→beta + flip rota. A spec 030 já criou a infra (compose prod, manifest, .env). Esta spec povoa o DB prod e corrige a direção.

Tudo o que é código entra em `dev` via branch+PR (D073, check `lint + build + test` verde). Deploy/VM-write/seed/rota = **aprovação nominal por ação**.

## Pré-condições verificadas (2026-06-18)

| Condição | Status | Evidência |
|---|---|---|
| Schema parity beta↔prod | ✅ | 10 tabelas idênticas (pg_tables) |
| Container status | ✅ | `site-prod-db` healthy, `site-prod-app` restart loop (DB vazio), `site-beta-app`/`site-beta-db` healthy |
| `.env` prod na VM | ✅ | `/opt/artificio/apps/site/.env`, 7 keys, chmod 600 |
| `JWT_SECRET` prod == accounts | ✅ | Hexdump byte-identical (CRLF vs LF irrelevante) |
| `DATABASE_URL` wiring | ✅ | `getDb()` lê `DATABASE_URL` do `.env` → aponta `site-prod-db:5432/site` |
| `CLOUDINARY_*` prod | ✅ | Copiados do beta (URLs absolutas → mídia serve igual) |
| Max WP ID no beta | 18.625 (media) | Bem abaixo de `site_content_id_seq` start=1.000.000 |
| `redirects` / `dev_feedback` beta | 0 rows | Tabelas vazias — sem dados a migrar, sem risco de sequência |
| Simulação seed com rollback | ✅ | 4MB restore sem erro, `session_replication_role=replica` resolve FK circular, rollback limpo |
| `schema_migrations` ambos DBs | 5 entradas idênticas | `--exclude-table-data=schema_migrations` evita duplicate key |

## Modo de trabalho

Claude planeja; OpenCode (DeepSeek) executa via MCP `opencode` (escopo local). Cada ação = aprovação nominal do mantenedor.

## Arquitetura da solução

```
ANTES (fluxo invertido):                    DEPOIS (corrigido):
┌──────────────┐                            ┌──────────────┐
│ site-beta-db │ ← autoria (admin/rebuild)  │ site-prod-db │ ← autoria (admin/rebuild)
│  125 posts   │                            │  125 posts   │
└──────┬───────┘                            └──────┬───────┘
       │ seed (R1)                                  │ sync manual (R4)
       ▼                                             ▼
┌──────────────┐                            ┌──────────────┐
│ site-prod-db │ (vazio)                    │ site-beta-db │ (cópia, read-only)
│   0 posts    │                            │  125 posts   │
└──────────────┘                            └──────────────┘
```

## Arquivos afetados

| Arquivo | Mudança | Fase |
|---------|---------|------|
| `site-prod-db` (VM) | Seed: pg_dump beta → psql prod + reset sequences | 1 |
| `site-beta-db` (VM) | Snapshots pré/pós seed | 1 |
| `apps/site-admin` | Verificar se tem URL hardcoded (provável que não — usa `getDb()` via `DATABASE_URL`) | 2 |
| `apps/site/server/admin-api.ts` | Nenhuma mudança — já usa `getDb()` que deriva de `DATABASE_URL` | — |
| `deploy-manifest.json` | `critical_routes` prod → URLs públicas raiz (só após flip rota R6) | 3 |
| `docker-compose.beta.yml` | `SITE_NOINDEX=true` (já aplicado na Fase 0 da 030) | 4 |
| `specs/031-site-prod-data-fluxo/` | Commit spec + docs → branch+PR (T0) | 0 |

## Contratos/interfaces tocados

- **Nenhum contrato público** alterado. Rotas, API, SSO, cookie — tudo igual.
- **DATABASE_URL** no `.env` já aponta para o DB correto em cada ambiente (prod→site-prod-db, beta→site-beta-db).
- **Admin/rebuild** usa `getDb()` que lê `DATABASE_URL` — sem mudança de código. O isolamento é arquitetural (DBs distintos), não por código.
- **Sync prod→beta:** `pg_dump site-prod-db --data-only --exclude-table-data=schema_migrations | psql site-beta-db` com `session_replication_role=replica`. Comando manual documentado, executado a cada deploy do beta. Sem script dedicado nesta spec.

## Impacto em consumidores

- **Nenhum.** Site é isolado. Mesas, glossário, accounts — zero impacto.
- **SEO:** após flip de rota (Fase 3), raiz servida por prod com conteúdo idêntico ao atual. Sem regressão.

## Fases

### Fase 0 — commit da spec (código/docs, branch+PR)
- **T0:** Commitar `specs/031-site-prod-data-fluxo/*` + docs atualizados → branch `feat/031-site-prod-data-fluxo` → PR para `dev` (D073).
- Gate F0: PR verde (`lint + build + test`). Spec versionada antes de executar.

### Fase 1 — seed bootstrap (VM write, mantenedor/agente)
- **F1a:** Snapshots off-VM: `pg_dump` ambos DBs → `C:\projetos\artificiobackup\site-prod-seed\2026-06-18\`. (read-only, executado)
- **F1b:** Congelar autoria no beta. Avisar mantenedor: não editar conteúdo no beta durante a janela de seed (~2 min). Sem bloqueio técnico — coordenação humana.
- **F1c:** Simulação pré-seed: restore com `BEGIN...ROLLBACK`. Prova que o dump restaura sem erro. (read-only, executado 2026-06-18)
- **F1d:** Seed real: `(echo "BEGIN; SET session_replication_role = replica;"; pg_dump beta --data-only --exclude-table-data=schema_migrations; echo "SET session_replication_role = DEFAULT; COMMIT;") | psql site-prod-db`. VM write = aprovação nominal.
- **F1e:** Reset sequences: `SELECT setval('site_content_id_seq', GREATEST(1000000, COALESCE(MAX(id),0) FROM posts, ...))`. Higiênico — sequence já inicia acima dos WP IDs.
- Gate F1: contagens prod == beta (125p/10p/82t/444m); `/healthz` prod posts>0; `site-prod-app` healthy (build Astro 46 páginas).

### Fase 2 — validar prod healthy + flip autoria (validação, possivelmente doc-only)
- **F2a:** Smoke interno prod: `/healthz` 200 com `posts=125`; `/admin/status` 200 (login SSO) com contagens corretas. Admin rebuild funcional.
- **F2b:** Verificar se `site-admin` (SPA) tem URL de backend hardcoded. `server.ts` serve `site-admin/dist` como estático; a SPA chama o mesmo host (mesmo container). Provável que não haja hardcode — `getDb()` usa `DATABASE_URL` do ambiente. Se sem alteração de código, Fase 2 é doc-only.
- **F2c:** Prova de isolamento: (a) `POST /admin/rebuild` no beta → verificar que `/healthz` prod NÃO muda; (b) `POST /admin/rebuild` no prod → verificar que `/healthz` prod MUDA (timestamp/contagem). O isolamento é arquitetural: beta tem `DATABASE_URL`→`site-beta-db`, prod tem `DATABASE_URL`→`site-prod-db`. DBs distintos = isolamento garantido.
- Gate F2: admin prod funcional; isolamento comprovado. Se sem código alterado, PR pode ser doc-only com registro da validação.

### Fase 3 — sync prod→beta + flip rota (VM write + mantenedor)
- **F3a:** Definir/executar sync prod→beta: mecanismo = opção A (dump→restore manual a cada deploy do beta). Comando: `(echo "BEGIN; SET session_replication_role = replica;"; pg_dump site-prod-db --data-only --exclude-table-data=schema_migrations; echo "SET session_replication_role = DEFAULT; COMMIT;") | psql site-beta-db`. Executar sync inicial nesta fase.
- **F3b:** (mantenedor) Reapontar rota Tunnel: `artificiorpg.com`+`www` → `site-prod-app`. Remover redirect interno beta→raiz (D075 aposentado). `beta.artificiorpg.com` → `site-beta-app` (inalterado). **Ordem pétrea: F3b ANTES de F3c.** Se atualizarmos `critical_routes` antes do flip, smoke testa o beta (raiz ainda aponta para beta via D075).
- **F3c:** Atualizar `deploy-manifest.json`: `critical_routes` prod → URLs públicas da raiz (`https://artificiorpg.com/healthz`, `/`, `/blog/`, `/admin/status`). Só seguro após F3b confirmado.
- **F3d:** Smoke público raiz: home/blog/post/page 200, canonical/OG/sitemap/RSS raiz, `wp-content/uploads` servido=0.
- **F3e:** Validar noindex beta: `curl -sI https://beta.artificiorpg.com/` → `X-Robots-Tag: noindex, nofollow`. Raiz NÃO retorna `X-Robots-Tag`.
- Gate F3: raiz servida por prod; smoke público 100%; beta isolado com noindex.

## Rollback

- **Pré-seed:** snapshots off-VM permitem restaurar DBs ao estado original (`prod-full-pre-seed.sql` restaura prod vazio).
- **Pós-seed, pré-flip:** `pg_dump` prod → backup; restaurar snapshot pré-seed se necessário. Redirect D075 permanece ativo como fallback.
- **Pós-flip rota:** mantenedor reaponta rota de volta ao redirect→beta. Atenção: se prod foi editado pós-flip, beta fica desatualizado. Rollback completo exige re-sync prod→beta ou reversão ao estado pré-flip.
- **Autoria:** reverter `DATABASE_URL` no `.env` beta restauraria escrita no beta (inversão temporária do fluxo). Não recomendado como rollback normal.

## Mecanismo de sync prod→beta (decisão)

**Opção A — dump→restore manual a cada deploy do beta.** Escolhida pelo mantenedor (2026-06-18).

Comando:
```bash
(echo "BEGIN; SET session_replication_role = replica;";
 pg_dump site-prod-db --data-only --exclude-table-data=schema_migrations;
 echo "SET session_replication_role = DEFAULT; COMMIT;") | psql site-beta-db
```

Executar antes de cada `docker compose up -d` no deploy do beta. Beta é staging descartável — cada deploy puxa snapshot fresco do prod. Sem cron, sem script dedicado, sem risco de drift por automação.

## Dependências externas

- Mantenedor: seed DB (F1d, VM write), rota Tunnel (F3b). DNS autoritativo intocado.
- OpenCode (DeepSeek): execução de comandos SSH, validação, edição de arquivos locais.

## Pontos de decisão (mantenedor)

- **Mecanismo de sync:** opção A (dump manual no deploy do beta) — decidido.
- **Frequência de sync:** a cada deploy do beta. Beta é descartável, puxa snapshot fresco.
- **Autoria no beta:** permanece acessível (admin beta funcional) mas escreve em DB isolado (`site-beta-db`). Editar no beta não afeta prod. Útil para testar fluxos de autoria com segurança.
