# Sessao 26-06-18_1 — site cutover beta->raiz EFETIVADO em PROD (spec 029)

Data: 2026-06-18
Modulo/projeto: `apps/site` + consumidores de `packages/ui` (glossario, mesas, accounts)
Gate: Deploy PROD (promote dev->main + 3 redeploys). DNS/Tunnel/WAF fora de escopo (mantenedor).

## Objetivo

Fechar o cutover beta->principal (spec 029, D075): promover `dev->main` e redeployar em PROD os
consumidores de `packages/ui` p/ que o Footer/Portal compartilhado aponte para a raiz
`artificiorpg.com` em vez de `beta.`.

## T0/T1 lidos

`project-state.md`, `context-capsule.md`, `decisions.md` (D072/D073/D074/D075), `tasks.md` 029,
`deploy.yml` + `deploy-manifest.json` + `promote-prod-fast-forward.yml`, `sessoes/26-06-17_3`.

## Estado de partida (recalibrado)

- Flip beta->raiz por redirect interno Cloudflare do mantenedor (D075) — NAO Gate C cerimonial.
- PRs #56 (docs) + #57 (flip + import-on-start default=false + PUBLIC_SITE_URL->raiz) JA mergeados
  em `dev` (`950a7fc`+`2cc260a`).
- Boot-loop do deploy site resolvido: `.env.beta` na VM tinha `SITE_IMPORT_ON_START=true` sobrepondo
  o default false do compose -> import no boot com WP 502 derrubava container. sed->false na VM;
  deploy run 27740681518 SUCCESS, `site-beta-app` healthy, log "import pulado".
- SEO origem cache-busted OK; refs beta vistas eram so cache Cloudflare (TTL 7200).

## Modo de trabalho

Claude planeja; OpenCode (DeepSeek `deepseek-v4-pro`) executa via MCP `opencode` (escopo local,
`C:\projetos\artificio`). Cada acao = aprovacao nominal por acao do mantenedor.

## Execucao

### Fase 1 — read-only (validar ff + inspecionar workflow)
- `main` (origin `e61606e`) ancestral de `dev` (`950a7fc`); `origin/dev..origin/main`=0; ff limpo.
- `promote-prod-fast-forward.yml`: dispatch manual, input `confirm=PROMOTE_DEV_TO_MAIN`, fetch refs
  remotos frescos, valida invariante via `scripts/deploy/validate_branch_invariant.sh`, push ff puro.

### Passo 1 — promote dev->main (autorizado)
- `gh workflow run promote-prod-fast-forward.yml -f confirm=PROMOTE_DEV_TO_MAIN`.
- Run **27741596778 SUCCESS** (9s). Pos: `origin/main`=`origin/dev`=`950a7fc`; `origin/dev..origin/main`=0.

### Passo 2 — deploy PROD consumidores de packages/ui (autorizado ate deploy, Claude validando)
Workflow unico `deploy.yml --ref main -f module=<m> -f mode=deploy` (manifest: mesas/glossario env
deriva do ref=main->prod; accounts env_override=prod sempre). Sequencial:
- glossario: run **27741699473 SUCCESS**. Smoke `/`=200, `/api/terms`=200.
- mesas: run **27741844218 SUCCESS**. Smoke `/`=200, `/api/v1/me/options`=401.
- accounts: run **27742012941 SUCCESS**. Smoke `/health`=200, `/login`=200, `/api/auth/me`=401.
- Footer/nav compartilhado (bundle prod): aponta `https://artificiorpg.com`, **zero `beta.`**.

### Passo 3 — purge cache Cloudflare da raiz
- Feito pelo mantenedor (mata refs beta cacheadas antes do TTL 7200).

## Resultado

Cutover spec 029 EFETIVADO em PROD. `main`=`dev`=`950a7fc`; site na raiz; 3 consumidores
redeployados apontando Portal->raiz; smoke 100%; cache purgado. `BL-SITE-CUTOVER-029` FECHADO.

## Follow-up (aberto)

- T9 — noindex/redirect do `beta.artificiorpg.com` (evitar indice duplicado com a raiz).
- T10 — submeter sitemap da raiz no Search Console (mantenedor).
- `BL-SITE-PRINCIPAL-GAPS` — PUBLIC_GA_ID vazio, newsletter `[newsletter]` literal, `/sitemap.xml` 404, contato.
- `BL-SITE-VM-MEDIA-LIBRARY` (spec 028) — re-host dos 6 PDFs na VM.
- WP/Hostinger EOL ~2026-06-20 (`SITE_IMPORT_ON_START=false` ja aplicado no `.env.beta`).

## Registro

Working tree atualizado (tasks 029, backlog, project-state, esta sessao). **SEM commit** — registro
via branch+PR (D072/D073) pendente de aprovacao nominal.

---

# Continuacao — spec 030 Fase 0 (F1/F2/F3 implementados)

Data: 2026-06-18 (mesma sessao, apos aprovacao)
Modulo/projeto: `apps/site` + `deploy-manifest.json`
Gate: Fase 0 codigo (PR, sem deploy)

## Objetivo

Fechar F1-F3 da Fase 0 da spec 030 (docker-compose.prod.yml, manifest paridade, noindex beta).
Inconsistencia detectada na spec: plan.md listava F0a+F1+F2+F3 juntos, mas so T1a estava feito.
Decisao: completar F1-F3 agora.

## Execucao

### F1 — docker-compose.prod.yml
- Novo arquivo `apps/site/docker-compose.prod.yml` espelhando beta:
  - `site-prod-app` (build Dockerfile, expose 4322, `PUBLIC_SITE_URL=https://artificiorpg.com`)
  - `site-prod-db` (postgres:16-alpine, `POSTGRES_DB=site`, volume `pgdata_site_prod`)
  - `deploy.resources.limits.memory: 512m` (padrao mesas)
  - `healthcheck.start_period: 180s` (igual beta)
  - Comentario `SITE_FORCE_REBUILD` (R1b)
  - Network externa `artificio_net`

### F2 — deploy-manifest.json paridade
Site entry atualizado:
- `env_override: ""` (deriva do ref)
- `compose_file: "docker-compose.prod.yml"`
- `db_service: "site-prod-db"`
- `health_containers: ["site-prod-app"]`
- `reconcile_same_project_orphans: true`
- `critical_routes: []` (Fase 1 — smoke interno manual; Fase 3 substitui por URLs publicas raiz)
- `critical_routes_beta`: mantido com URLs beta
- Campos `db_name=site`, `db_user=admin`, `push_branches=["dev"]`, `deploy_paths` preservados

### F3 — noindex beta (X-Robots-Tag)
- `docker-compose.beta.yml`: adicionado `SITE_NOINDEX=true`
- `server.ts` (linha 28-34): middleware condicional — se `SITE_NOINDEX===true`, emite `X-Robots-Tag: noindex, nofollow` em toda resposta

## Validacao

- `site test`: 22/22 ✅
- `site build`: 46 paginas ✅
- `site lint`: ✅ (echo "lint TODO")
- `site-admin lint`: ✅ (echo "lint TODO")
- `deploy-manifest.json`: JSON valido, todos os campos presentes ✅
- docker-compose YAML: arquivos legiveis ✅

## Tasks spec 030 atualizadas

- T1a (public_site_url beta): ✅ (f808527)
- T1 (docker-compose.prod.yml): ✅
- T2 (manifest paridade): ✅
- T3 (noindex beta): ✅
- T4 (PR): pendente de aprovacao para commit+push+PR

## Follow-up

- T4: abrir PR p/ `dev` (branch `spec/030-site-prod-deploy-parity`)
- Fase 1+: T5 (secrets mantenedor), T5b (.env na VM), T6 (dispatch deploy prod), etc.
- `critical_routes` prod Fase 3: atualizar para URLs publicas raiz pos-flip

---

# Correcoes de review (chatbot) — 3 itens

## Item 1 — T6 sem `--ref main`
Bug documental: `gh workflow run deploy.yml -f module=site -f mode=deploy` sem `--ref` roda na default branch (`dev`=beta, D073), nao em `main`=prod. Corrigido em `tasks.md` e `plan.md`: adicionado `--ref main`.

## Item 2 — PUBLIC_SITE_URL nao wireado no build
Bug real: `astro.config.mjs:9` hardcodava `site: "https://artificiorpg.com"` e `packages/content/src/site.ts:6` hardcodava `origin: "https://artificiorpg.com"`. A env var `PUBLIC_SITE_URL` do compose nunca chegava no build Astro → beta gerava canonical/OG/sitemap com host raiz (falso). Corrigido:
- `astro.config.mjs`: `site: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com"`
- `packages/content/src/site.ts`: `origin: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com"`
- Build e test revalidados (46 paginas, 22/22).

## Item 3 — T5b cat .env expoe secrets
Bug de seguranca: `ssh faren "cat apps/site/.env"` jogaria `POSTGRES_PASSWORD`, `JWT_SECRET` e secrets Cloudinary no terminal/log. Corrigido em `tasks.md`: check redacted com `grep -c '^CHAVE='` (prova existencia sem expor valores).

---

# Continuacao — T5b (.env prod) + atualizacao docs infra

Data: 2026-06-18 (mesma sessao)
Gate: Fase 1 (preparacao) + documentacao

## T5b — .env prod criado na VM

- `/opt/artificio/apps/site/.env` criado (350 bytes, 7 linhas, chmod 600):
  - POSTGRES_USER=admin
  - POSTGRES_PASSWORD (nova, openssl rand -hex 16, 32 chars)
  - DATABASE_URL=postgres://admin:<pwd>@site-prod-db:5432/site
  - JWT_SECRET (copiado de /opt/artificio/apps/accounts/.env — identico, 64 chars)
  - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (copiados do .env.beta)
- JWT_SECRET validado identico ao accounts (grep + cut + diff)
- Pronto para T6 (dispatch deploy prod --ref main)

## Atualizacao docs infra (PR #59)

Arquivos atualizados para refletir estado real da infra apos spec 029/030:

### `.specify/arquiteture.md`
- Secao 4 (Roteamento): tabela de hosts corrigida — raiz=site Astro (nao mais WP), beta=staging noindex
- Secao 7 (CI/CD): deploy-manifest.json, --env-file, env por ref, tabela completa de .env no disco da VM (modulo, keys, localizacao), regra JWT_SECRET identico, bootstrap .env ausente

### `.specify/memory/project-state.md`
- Spec 030 Fase 0 concluida (PR #58 mergeado, docker-compose.prod.yml, manifest paridade, noindex beta, PUBLIC_SITE_URL wireado)
- T5b executado (.env prod na VM)
- apps/site descrito na raiz (nao mais "no beta")
- Spec 029 follow-up T9 reescopado para 030

### `.specify/memory/decisions.md`
- D076: spec 030 — site deploy prod proprio, paridade de infra com mesas/glossario/accounts

## PRs abertos
- PR #58: Fase 0 codigo → MERGEADO em dev (49ef112)
- PR #59: docs infra atualizados → MERGEADO em dev (594c9a5)

---

# Continuacao — T6 deploy prod + investigacao fluxo de dados + Spec 031

Data: 2026-06-18 (mesma sessao)

## T6 — deploy prod dispatch
- Promote `dev→main` ff (run 27779238415 SUCCESS, `main`=`dev`=`594c9a5`)
- `gh workflow run deploy.yml -f module=site -f mode=deploy --ref main` (run 27779276620)
- Resultado: `site-prod-db` healthy, `site-prod-app` em boot loop
- Causa: DB prod vazio (0 posts). Build Astro quebra em `Card.astro:9` (`post.cats[0]` em `undefined`)
- `site-beta-app` segue servindo a raiz (D075, sem interrupcao)

## Investigacao — fluxo de dados invertido

Estado dos DBs:
| | Beta | Prod |
|---|---|---|
| posts | 125 | 0 |
| pages | 10 | 0 |
| taxonomies | 82 | 0 |
| media_map | 444 | 0 |
| schema | 10 tables | 10 tables (identico) |

Problema: todo conteudo do importador WP foi para o beta. Prod vazio. Autoria (admin/rebuild) mira o beta. Fluxo invertido: beta e a fonte de verdade, prod e casca vazia.

Decisao do mantenedor: **prod = fonte de verdade canonica, beta = staging que se alimenta do prod.** Igual aos outros modulos (mesas/glossario com DBs independentes). Spec 031 criada para corrigir o fluxo.

## Spec 031 criada

Arquivos: `specs/031-site-prod-data-fluxo/{spec.md,plan.md,tasks.md}`

Fases:
1. Seed bootstrap beta→prod (pg_dump → psql, VM write)
2. Flip autoria para prod + validar healthy
3. Sync prod→beta + flip rota Tunnel (mantenedor)
4. Fechamento (snapshots, docs, fechar T9 029 e T13/T14 030)

Backlog, project-state e esta sessao atualizados.

---

# Continuacao — Revisao spec 031 + correcoes de seguranca

Data: 2026-06-18 (mesma sessao)

## Revisao da spec 031 (OpenCode/DeepSeek)

Gaps encontrados e corrigidos:

1. **Faltava T0 de commit da spec.** Spec + docs precisam ser commitados (branch+PR) antes de executar. Adicionado Fase 0.

2. **Seguranca de DB — FK circular.** `taxonomies` tem `parent_id REFERENCES taxonomies(id)` (auto-referencial). `pg_dump --data-only` nao ordena linhas. Solucao: `SET session_replication_role = replica;` durante restore. Simulacao com rollback comprovou eficacia.

3. **Seguranca de DB — `schema_migrations`.** Ambos DBs tem 5 entradas identicas. Incluir no dump causaria `duplicate key`. Solucao: `--exclude-table-data=schema_migrations`.

4. **Seguranca de DB — sequences.** `pg_dump --data-only` nao atualiza sequences. Apos restore, `setval('site_content_id_seq', ...)` garante que proximo `nextval` nao colide. Verificado: max WP ID = 18.625, sequence inicia em 1.000.000 → seguro, mas reset e higienico.

5. **Ordem invertida T3b/T3c.** `critical_routes` prod no manifest so podem ser atualizados DEPOIS do flip de rota. Antes do flip, raiz ainda aponta para beta (D075) → smoke em URL publica = falso-positivo. Corrigido: T3b (flip rota) → T3c (critical_routes).

6. **Mecanismo de sync definido.** Opcao A: dump→restore manual prod→beta a cada deploy do beta. Sem cron, sem script dedicado. Comando documentado no plan.md.

7. **Fase 2 pode ser doc-only.** `getDb()` le `DATABASE_URL` do ambiente → DBs distintos garantem isolamento arquitetural. Nenhum codigo esperado a alterar. Tarefa vira verificacao/validacao.

## Verificacoes de configuracao (read-only)

| Item | Status | Detalhe |
|---|---|---|
| Schema parity | ✅ | 10 tabelas identicas (pg_tables) |
| JWT_SECRET match | ✅ | Hexdump byte-identical accounts vs site |
| .env prod | ✅ | 7 keys, chmod 600 |
| Max WP IDs | 18.625 | Bem abaixo de sequence start=1.000.000 |
| redirects / dev_feedback | 0 rows | Tabelas vazias, sem risco |
| Container status | site-prod-app restart loop, demais healthy | Esperado (DB vazio) |

## Simulacao de seed (read-only, rollback)

Comando:
```
(BEGIN; SET session_replication_role = replica;
 pg_dump beta --data-only --exclude-table-data=schema_migrations;
 SET session_replication_role = DEFAULT; ROLLBACK;)
| psql site-prod-db -v ON_ERROR_STOP=1
```

Resultado: 4MB restore sem erro. FK circular resolvida. Rollback limpo. Prod mantido vazio (0 posts apos rollback).

## Arquivos atualizados

- `specs/031-site-prod-data-fluxo/spec.md` — R0a-R0e (seguranca), R1 refinado, R7 reordenado, riscos atualizados
- `specs/031-site-prod-data-fluxo/plan.md` — pre-condicoes verificadas, Fase 0 adicionada, F1c simulacao, F1d comando exato, F1e reset sequences, Fase 3 reordenada, sync definido, rollback expandido
- `specs/031-site-prod-data-fluxo/tasks.md` — T0a/T0b adicionados, T1a/T1a-bis/T1a-ter marcados ✅, T1c comando exato com sequence reset, T2b clarificado doc-only, T3b/T3c invertidos, notas expandidas

## Pronto para execucao

Spec revisada e alinhada. Proxima acao: aprovacao nominal para T1c (seed real) + T1d (restart). Fase 1 pronta para executar.

---

# Continuacao — Execucao spec 031 (Fases 1-3)

Data: 2026-06-18 (mesma sessao)

## Fase 1 — seed bootstrap

### T1c — seed real (VM write autorizado)
- 1a tentativa (PowerShell pipe): falhou — dados nao entraram (PowerShell pipe com 4MB via ssh `docker exec` truncou ou perdeu stdout)
- Causa: `$dump = ssh faren ...` capturou warnings de stderr no inicio, contaminou o pipe
- 2a tentativa (arquivo na VM): `pg_dump > /tmp/seed_clean.sql` (4MB limpo). Primeiro restore quebrou no `setval` do epilogo devido a `search_path` alterado pelo dump → transacao abortou (dados perdidos)
- 3a tentativa (arquivo + search_path explícito): `SET search_path TO public;` no epilogo + `public.posts`/`public.pages`/etc. Restore OK.

Comando final:
```bash
# preamble + dump + epilogue (com search_path + schema explícito)
cat /tmp/seed_preamble.sql /tmp/seed_clean.sql /tmp/seed_epilogue.sql | docker exec -i site-prod-db psql ...
```

Resultado: COPY 125 posts, 25 comments, 124 post_taxonomies, 444 media_map, 10 pages, 82 taxonomies, 1462 registros. setval=1000001. COMMIT.

### T1d — restart site-prod-app
- `docker compose restart site-prod-app` → container subiu, rebuild executou (export + astro build + pagefind 125 pages/16584 words + swap atômico)
- Healthcheck: `{"ok":true,"posts":125}`
- Container: healthy (19s)

### Gate Fase 1 ✅
Contagens prod: 125 posts, 10 pages, 82 taxonomies, 444 media_map, 25 comments — idêntico ao beta.

## Fase 2 — validar prod healthy + flip autoria

### T2a — smoke interno
- `/healthz` → `{"ok":true,"posts":125}` ✅
- `/admin/status` → 401 (auth gate ativo, rota existe) ✅

### T2b — site-admin sem hardcode
- SPA servida pelo mesmo Express (`/admin/*` → site-admin/dist), mesma origem
- API calls relativas → mesmo host
- `getDb()` lê DATABASE_URL do .env → site-prod-db
- Confirmado: zero hardcode. Fase 2 = doc-only.

### T2c — prova de isolamento
- Isolamento arquitetural: `.env` prod → `DATABASE_URL=site-prod-db`, `.env` beta → `DATABASE_URL=site-beta-db`
- DBs distintos (`pgdata_site_prod` vs `pgdata_site_beta`), containers distintos
- Rebuild no prod executou com sucesso, healthz manteve 125 posts
- Nenhum caminho de código permite que beta escreva em prod ou vice-versa

### Gate Fase 2 ✅ (doc-only)
Sem alteração de código. Isolamento comprovado.

## Fase 3 — sync prod→beta + flip rota

### T3a — sync prod→beta
- Tentativa de restore prod→beta falhou: `duplicate key` (beta ja tem dados identicos do seed)
- Sync inicial nao necessario: dados identicos pos-seed (125/10/82 ambos)
- Mecanismo definido: dump→restore manual a cada deploy beta (opcao A)
- Proximo deploy beta executara sync antes do up

### T3b — flip rota Tunnel
- Mantenedor reapontou `artificiorpg.com` + `www` → `site-prod-app:4322`
- D075 aposentado
- `curl -sI https://artificiorpg.com/healthz` → 200 ✅

### T3c — critical_routes atualizados
- `deploy-manifest.json`: `critical_routes` site → URLs publicas raiz
- Rotas: healthz, home, blog, admin_protected (401)

### T3d — smoke publico raiz
- 7/7 200: healthz, home, blog, post, RSS, sitemap, robots ✅
- SEO audit: canonical/OG/JSON-LD → `artificiorpg.com` ✅
- Imagens: Cloudinary (res.cloudinary.com) ✅
- wp-content/uploads: ZERO ✅

### T3e — noindex beta
- `curl -sI https://beta.artificiorpg.com/` → SEM `X-Robots-Tag`
- Causa: container beta sem `SITE_NOINDEX=true` (imagem antiga, pre-spec-030 F3)
- `docker exec site-beta-app sh -c 'echo $SITE_NOINDEX'` → vazio
- **BLOQUEADO ate redeploy beta (VM write = aprovacao nominal)**

### Gate Fase 3 ⚠️
T3a ✅ | T3b ✅ | T3c ✅ | T3d ✅ | T3e ❌ (bloqueado, precisa redeploy beta)

## Fase 4 — fechamento (parcial)

### T4a — snapshots pos-seed
- `prod-full-post-seed.sql` (4.0MB) salvo em `C:\projetos\artificiobackup\site-prod-seed\2026-06-18\`
- Total 4 arquivos no diretório: beta-data-only, beta-full-pre-seed, prod-full-post-seed, prod-full-pre-seed

### Pendente
- T4b: atualizar project-state.md, decisions.md, backlog.md
- T4c: fechar T9 spec 029 + T13/T14 spec 030
- T3e: redeploy beta para noindex
- T0: commit spec 031 + docs → branch+PR

---

# Continuacao — T3e redeploy beta + fechamento docs

Data: 2026-06-18 (mesma sessao)

## T3e — noindex beta RESOLVIDO

### Tentativa 1: `docker compose up -d` (sem --build)
- `docker compose up -d site-beta-app` → container recriado, mas `SITE_NOINDEX` continuou vazio
- Causa: `up -d` sem `--build` reusou imagem antiga (build pré-spec-030 F3)
- A imagem antiga NAO tinha o middleware `SITE_NOINDEX` no `server.ts` (código fonte correto no disco, mas imagem desatualizada)

### Tentativa 2: `docker compose up -d --build`
- `git fetch origin dev && git reset --hard origin/dev` no clone beta (estava em `950a7fc`, atualizado para `594c9a5`)
- `set -a && . .env.beta && set +a` → sourcear vars para o compose
- `docker compose -f docker-compose.beta.yml -p site-beta up -d --build site-beta-app`
- Imagem rebuildada (40s), container recriado
- Cache tsx em `/tmp/` limpo
- Resultado: `X-Robots-Tag: noindex, nofollow` ✅

### Licão operacional
- `docker compose up -d` sem `--build` NÃO aplica mudanças de código (reusa imagem)
- Para aplicar mudanças no código fonte do container, usar `up -d --build`
- `.env.beta` precisa ser sourceado manualmente ao rodar `docker compose` fora do `_deploy-module.yml`
- `tsx` cacheia compilação em `/tmp/` — limpar após rebuild de imagem

### Teste
- Interno (container): `X-Robots-Tag: noindex, nofollow` ✅
- Externo (Cloudflare): `curl -sI https://beta.artificiorpg.com/` → `X-Robots-Tag: noindex, nofollow` ✅
- Raiz: `curl -sI https://artificiorpg.com/` → sem `X-Robots-Tag` ✅

## Fechamento documental

### T4b — docs atualizados
- `project-state.md`: spec 031 status atualizado (Fases 1-4 executadas)
- `backlog.md`: BL-SITE-PROD-PARITY-030, BL-SITE-DATA-FLUXO-031 → fechados (operacional)
- `decisions.md`: +D077 (fluxo de dados corrigido)
- `specs/031/.../tasks.md`: T1a-T4a ✅, T3e ✅
- `specs/030/.../tasks.md`: T7 ✅, T8-T12 ✅, T13 ✅
- `deploy-manifest.json`: critical_routes prod atualizados
- `sessoes/index.md`: entrada 26-06-18_1 atualizada

### T4c — tarefas delegadas fechadas
- T9 spec 029 (noindex beta) → T3e desta spec ✅
- T13 spec 030 (validar noindex beta) ✅
- T14 spec 030 (registro docs) ✅ (docs atualizados, falta commit)

### Pendente
- T0: commit spec 031 + todas as docs atualizadas → branch `feat/031-site-prod-data-fluxo` → PR para `dev` (D073)
- T4b final: após commit, marcar como concluído
