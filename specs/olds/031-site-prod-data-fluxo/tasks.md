# Tasks — 031 Site: direção do fluxo de dados (prod canônico, beta staging)

> Ordem pétrea: commit spec → seed prod → validar healthy → flip autoria → sync beta → flip rota → critical_routes → fechamento. Cada deploy/VM-write/seed/rota = aprovação nominal por ação.

## Fase 0 — commit da spec (branch+PR) ✅
- [x] T0a — Commitar `specs/031-site-prod-data-fluxo/*` + docs atualizados. · branch `feat/031-site-prod-data-fluxo`, PR #60 aberto para `dev`. ✅
- [x] T0b — Gate Fase 0: PR aberto (#60). Aguardando merge.

## Fase 1 — seed bootstrap beta→prod (VM write) ✅
- [x] T1a — Snapshots off-VM: `pg_dump site-beta-db` (data-only + full) + `pg_dump site-prod-db` (full) → `C:\projetos\artificiobackup\site-prod-seed\2026-06-18\`. · 3 arquivos: `beta-data-only.sql` (4.0MB), `beta-full-pre-seed.sql` (4.3MB), `prod-full-pre-seed.sql` (14KB).
- [x] T1a-bis — Verificação pré-seed: schema parity (10 tabelas), max IDs (media=18.625), sequences (site_content_id_seq=1.000.000), JWT_SECRET match (hexdump), .env prod (7 keys). · tudo verificado.
- [x] T1a-ter — Simulação com rollback: `(BEGIN; SET replica; pg_dump --data-only --exclude-table-data=schema_migrations; SET DEFAULT; ROLLBACK;) | psql site-prod-db`. · 4MB restore sem erro; FK circular resolvida; rollback limpo; prod mantido vazio.
- [x] T1b — Congelar autoria no beta: mantenedor ciente durante janela de seed (~2 min). · sem edições concorrentes.
- [x] T1c — Seed real (VM write): arquivo `/tmp/seed_clean.sql` na VM (4MB, stdout limpo) + preamble/epilogue (`session_replication_role=replica`, `search_path=public`, schema explícito, `setval`). · 3a tentativa OK: COPY 125 posts, 25 comments, 124 post_taxonomies, 444 media_map, 10 pages, 82 taxonomies, 1462 registros; setval=1000001; COMMIT.
- [x] T1d — Reiniciar `site-prod-app`: `docker compose restart`. · container healthy, rebuild executou (Pagefind 125 pages/16584 words), `{"ok":true,"posts":125}`.
- [x] T1e — Gate Fase 1: container healthy, 46 páginas Astro, contagens prod==beta (125p/10p/82t/444m/25c), sequences resetadas. ✅

## Fase 2 — validar prod healthy + flip autoria (doc-only) ✅
- [x] T2a — Smoke interno prod: `/healthz` 200 `{"ok":true,"posts":125}`; `/admin/status` 401 (auth gate ativo, rota existe). ✅
- [x] T2b — Verificar `site-admin` (SPA): SPA servida pelo mesmo Express (`/admin/*` → site-admin/dist), mesma origem. `getDb()` lê `DATABASE_URL` do `.env` → `site-prod-db`. Zero hardcode. ✅
- [x] T2c — Prova de isolamento: isolamento arquitetural — `.env` prod → `DATABASE_URL=site-prod-db`, `.env` beta → `DATABASE_URL=site-beta-db`. DBs/volumes distintos. Rebuild no prod executou, healthz manteve 125 posts. Nenhum caminho cross-DB. ✅
- [x] T2d — Gate Fase 2: doc-only (sem alteração de código). Admin prod funcional; isolamento comprovado. ✅

## Fase 3 — sync prod→beta + flip rota (VM write + mantenedor)
- [x] T3a — Sync inicial prod→beta: não executado — beta já tem dados idênticos (125/10/82 pós-seed). Mecanismo definido (opção A: dump manual prod→beta a cada deploy do beta). Comando documentado. Executar no próximo deploy beta. ✅
- [x] T3b — Flip rota Tunnel (mantenedor): `artificiorpg.com`+`www` → `site-prod-app:4322`. D075 aposentado. `curl -sI https://artificiorpg.com/healthz` → 200. ✅
- [x] T3c — Atualizar `deploy-manifest.json`: `critical_routes` prod → `["https://artificiorpg.com/healthz", "https://artificiorpg.com/", "https://artificiorpg.com/blog/", "https://artificiorpg.com/admin/status"]`. ✅
- [x] T3d — Smoke público raiz: 7/7 200 (healthz, home, blog, post, RSS, sitemap, robots). SEO: canonical/OG/JSON-LD → `artificiorpg.com`; imagens Cloudinary; zero `wp-content/uploads`. ✅
- [x] T3e — Validar noindex beta: `curl -sI https://beta.artificiorpg.com/` → `X-Robots-Tag: noindex, nofollow`. Raiz sem. Fix: rebuild imagem (`docker compose up -d --build` com `.env.beta` sourceado) + limpeza cache tsx. ✅

## Fase 4 — fechamento (parcial)
- [x] T4a — Snapshots pós-seed: `prod-full-post-seed.sql` (4.0MB) + 3 dumps pré-seed salvos em `C:\projetos\artificiobackup\site-prod-seed\2026-06-18\`. ✅
- [x] T4b — Registro docs: `specs/backlog.md`, `project-state.md`, `decisions.md`, `sessoes/index.md`, `specs/030/.../tasks.md` atualizados. PR #60 mergeado em `dev` (`37d9b4d`), promovido a `main`. ✅
- [x] T4c — Fechar tarefas delegadas: T9 spec 029 (noindex beta → T3e ✅), T13 spec 030 (noindex ✅), T14 spec 030 (registro ✅). Backlog `BL-SITE-DATA-FLUXO-031` FECHADO. ✅

## Notas
- DNS autoritativo/registro = intocado (Gate C segue adiado, D016).
- Cloudinary compartilhado: mídia migrada serve igual em prod (URLs absolutas).
- Schema idêntico entre beta e prod (10 tabelas, migrations rodaram em ambos).
- JWT_SECRET prod = beta = accounts (hexdump confirmado 2026-06-18).
- Site-admin (SPA) estático servido pelo Express do site — mesmo container, mesma DATABASE_URL. Sem hardcode.
- `site_content_id_seq` inicia em 1.000.000, bem acima do max WP ID (18.625). Reset é higiênico.
- Simulação pré-seed comprovou: `session_replication_role=replica` resolve FK circular em `taxonomies.parent_id`.
- `schema_migrations` excluído do dump (ambos DBs têm 5 entradas idênticas — incluir causaria duplicate key).
- `redirects` e `dev_feedback` vazios no beta (0 rows) — sem dados a migrar, sem risco de sequência.
- Mecanismo de sync: opção A (truncate + dump manual prod→beta a cada deploy do beta, idempotente). Comando documentado no plan.md. Revisado 2026-06-18 (Codex): dump sem truncate falharia com duplicate key na 2a execução.

## Lições operacionais
- **PowerShell pipe para docker exec pode truncar/silenciar stdout** com dados grandes (4MB). Preferir arquivo no disco da VM + `cat | docker exec -i`.
- **`pg_dump --data-only` altera `search_path`.** Epílogo de restore deve usar `SET search_path TO public;` + nomes de tabela com schema qualificado (`public.posts`).
- **2a tentativa de seed falhou por search_path.** Dados carregaram (COPY OK) mas `setval` no epílogo quebrou → transação abortou. 3a tentativa com schema explícito resolveu.
- **Seed beta→prod requer 3 condições**: `--exclude-table-data=schema_migrations`, `session_replication_role=replica`, schema qualificado no epílogo.
