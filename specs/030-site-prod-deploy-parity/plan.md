# Plano — 030 Site deploy PROD próprio (paridade)

## Estratégia

Trazer o site ao mesmo shape de deploy de mesas/glossario: 1 entrada no `deploy-manifest.json` com env derivado do ref, `docker-compose.prod.yml` próprio, container+DB prod isolados do beta. A raiz passa do redirect→beta para o `site-prod-app`. Beta volta a staging e recebe `noindex` (fecha T9 da 029).

Tudo o que é código/compose/manifest entra em `dev` via **branch+PR** (D072/D073, check `lint + build + test` verde). Deploy/VM-write/seed/rota = **aprovação nominal por ação**; rota Tunnel = **mantenedor**.

## Modo de trabalho

Claude planeja; OpenCode (DeepSeek) executa via MCP `opencode` (escopo local). Cada ação = aprovação nominal do mantenedor.

## Fases

### Fase 0 — código (PR, sem deploy)
- F0a: `apps/site/docker-compose.beta.yml:30` → `PUBLIC_SITE_URL=https://beta.artificiorpg.com` (R11). Hoje hardcoded raiz — após separação, beta precisa gerar canonical/OG/sitemap com hostname beta.
- F1: `apps/site/docker-compose.prod.yml` (espelha beta, nomes prod, `PUBLIC_SITE_URL` raiz, volume `pgdata_site_prod`, memory limits ≈512m, `start_period` ≥180s, comentário `SITE_FORCE_REBUILD`).
- F2: `deploy-manifest.json` entrada `site` → shape paridade (R2, todos os campos: `db_name`, `db_user`, `push_branches`, `deploy_paths`, `reconcile_same_project_orphans=true`, `critical_routes` provisórias internas).
- F3: `beta` emite `noindex` (R8) — `X-Robots-Tag` no server por env (`SITE_NOINDEX=true`), default prod ausente.
- Gate F0: PR verde (`lint + build + test`), `actionlint`/manifest válido, build site/site-admin OK. Sem tocar VM.

### Fase 1 — stand-up prod na VM (dispatch, sem flip de rota)
- F4: secrets do GitHub Environment prod do site (mantenedor): `POSTGRES_PASSWORD`, `DATABASE_URL`→`site-prod-db`, `JWT_SECRET`, `CLOUDINARY_*`, `PUBLIC_GA_ID`.
- F4b: **(mantenedor) bootstrap do arquivo `apps/site/.env` no disco da VM** (R12). `_deploy-module.yml:325` lê do disco — sem o arquivo, deploy aborta. Conteúdo: `POSTGRES_PASSWORD`, `JWT_SECRET`, `CLOUDINARY_*`, `PUBLIC_GA_ID`, `DATABASE_URL=postgres://admin:<pwd>@site-prod-db:5432/site`, `POSTGRES_USER=admin`. `JWT_SECRET` deve casar com `apps/accounts/.env` (SSO D042).
- F5: deploy prod dispatch: `gh workflow run deploy.yml -f module=site -f mode=deploy --ref main` (env deriva automaticamente de `refs/heads/main` → prod; `--ref main` obrigatório porque default branch = `dev` (D073) → sem `--ref` rodaria em `dev`=beta). Sobe `site-prod-app`+`site-prod-db`. **Raiz ainda no redirect→beta** (rota intocada). `critical_routes` prod no manifest = internas (health container), não URL pública.
- Gate F1: containers `healthy`; smoke INTERNO (via container/health, NÃO pela raiz pública que ainda redireciona pro beta = falso-positivo).

### Fase 2 — seed do conteúdo (VM write, mantenedor)
- F6: snapshot `site-beta-db` + `site-prod-db`. Congelar autoria no beta.
- F7: `pg_dump site-beta-db` → `psql site-prod-db`. Migrations já rodaram no entrypoint.
- Gate F2: contagens posts/pages/taxonomies/media_map/redirects em prod == beta; `/healthz` do prod retorna posts>0.

### Fase 3 — flip da rota (mantenedor) + aposentar redirect
- F8: mantenedor reaponta Tunnel `artificiorpg.com`+`www` → `site-prod-app`; remove redirect interno beta→raiz. Atualizar `critical_routes` prod no manifest para URLs públicas da raiz (`https://artificiorpg.com/healthz`, `/`, `/blog/`, `/admin/status`).
- Gate F3: `https://artificiorpg.com/` servido por prod: `/healthz` 200, home/blog/post/page 200, canonical/sitemap/RSS raiz, grep `wp-content/uploads`=0. Editar no beta NÃO muda a raiz (prova de isolamento).

### Fase 4 — fechar T9 + staging real
- F9: validar `beta.` retorna noindex, raiz não. Beta documentado como staging.
- F10: registro: sessão + tasks 029 (T9 done) + backlog (BL-SITE-CUTOVER-029 follow-up T9 fechado; novo BL se sobrar) + project-state. Via PR/ff conforme regra.

## Pontos de decisão (mantenedor)

- **Fonte de verdade pós-cutover:** prod vira canônico de conteúdo; beta = descartável/sincronizável a partir do prod (definir sentido do sync, se houver).
- **noindex beta — mecanismo:** `X-Robots-Tag` no server por env (simples, runtime) vs flag de build `PUBLIC_SITE_ENV=beta`→meta. Recomendo `X-Robots-Tag` por env no compose beta (sem condicional de host, já que agora são containers separados).
- **auto_deploy_on_push:** habilitar `push:dev`→beta após estável (hoje dispatch-only).

## Rollback

- Pré-flip: nada a reverter (raiz segue no redirect→beta).
- Pós-flip com falha: mantenedor reaponta rota de volta ao redirect→beta; prod fica parado para diagnóstico. Snapshots de F6 protegem dados.

## Dependências externas

- Mantenedor: secrets prod (F4), seed/VM-write (F6/F7), rota Tunnel (F8). DNS autoritativo intocado.
