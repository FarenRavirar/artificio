# 031 — Site: direção do fluxo de dados (prod canônico, beta staging)

- **Módulo/Pacote:** apps/site (+ site-admin) | infra (DB prod/beta, deploy, autoria)
- **Gate relacionado:** D (site) — sequência pós-030 Fase 0. Gate C segue adiado (D016).
- **Origem:** decisão do mantenedor 2026-06-18 — spec 030 Phase 2 planejava seed beta→prod, mas o modelo correto é prod = fonte de verdade canônica e beta se alimenta do prod.

## Problema

A spec 030 criou infra de deploy prod (`site-prod-app`+`site-prod-db`) mas o **fluxo de dados está invertido**:

1. **Conteúdo vive no beta.** Todo o import WP (125 posts, 10 pages, 82 taxonomies, 444 media_map) foi feito no `site-beta-db`. O `site-prod-db` está vazio — migrations rodaram, schema idêntico, zero dados.
2. **Autoria mira o beta.** O painel admin (`/admin/*`) e rebuild (`POST /admin/rebuild`) escrevem no beta. O mantenedor edita conteúdo no beta, não no prod.
3. **Beta é staging, mas tem os dados reais.** Após o flip da spec 029 (raiz → mesmo container do beta, D075), o beta deixou de ser staging isolado. A spec 030 resolve o isolamento de containers, mas o fluxo de dados ainda trata beta como primário.
4. **Prod não consegue subir.** `site-prod-app` em boot loop porque o build Astro quebra com DB vazio (`Card.astro:9` → `post.cats[0]` em `undefined`). Sem dados, o container nunca fica healthy.

**Modelo-alvo:** igual aos outros módulos (mesas/glossario) — cada ambiente tem seu próprio DB. Prod é o canônico onde a autoria acontece. Beta é staging que testa código novo com dados copiados do prod (one-shot ou periódico).

## Dependência pétrea de ordem

1. **Seed one-shot beta→prod** (bootstrap). `pg_dump site-beta-db` → `psql site-prod-db`. O conteúdo que está no beta é o único conteúdo existente — não há WP para re-importar (EOL ~2026-06-20).
2. **Validar prod healthy.** Com dados, o build Astro passa e o container sobe. Smoke interno (healthz, posts>0).
3. **Flip de autoria.** Admin/rebuild/export passam a mirar o prod. O beta vira read-only para conteúdo (só testa código).
4. **Mecanismo de sync prod→beta.** Definir como o beta obtém dados atualizados: dump manual no deploy do beta (opção A). Automação contínua = spec futura.
5. **Aposentar redirect D075.** Após prod validado, mantenedor reaponta rota Tunnel raiz → `site-prod-app`. Beta volta a ser staging isolado com noindex.

## Restrições de segurança do seed (DB)

### R0a — Excluir `schema_migrations` do dump
`pg_dump --exclude-table-data=schema_migrations`. Ambos os DBs já têm as 5 migrations aplicadas (schema idêntico). Incluir `schema_migrations` no dump causaria `duplicate key` no restore. · verificado: beta e prod têm 5 registros idênticos.

### R0b — Desabilitar FKs durante restore (circular FK)
`taxonomies` tem `parent_id REFERENCES taxonomies(id)` — FK auto-referencial circular. `pg_dump --data-only` não ordena linhas para satisfazer FKs. Solução: `SET session_replication_role = replica;` antes do restore, `SET session_replication_role = DEFAULT;` depois. · verificado: simulação com rollback executou sem erro.

### R0c — Reset de sequences pós-restore
`site_content_id_seq` existe para conteúdo nativo (posts/pages/media/taxonomies). `pg_dump --data-only` NÃO atualiza sequences. Após restore, executar `setval('site_content_id_seq', GREATEST(1000000, max_ids_das_tabelas), false)`. · verificado: max WP ID = 18.625, sequence inicia em 1.000.000 → sem risco de colisão, mas reset é higiênico.

### R0d — Verificação de configuração pré-seed
- `JWT_SECRET` prod idêntico ao accounts (hexdump confirmado 2026-06-18). · sem match, SSO quebra.
- `DATABASE_URL` no `.env` prod aponta para `site-prod-db:5432/site`. · wiring correto.
- `CLOUDINARY_*` copiados do beta (URLs absolutas → mídia serve igual em prod).
- `.env` prod com 7 keys (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`).

### R0e — Simulação pré-seed com rollback
Executar restore dentro de `BEGIN...ROLLBACK` antes do seed real. Prova que o dump restaura sem erros. · executado 2026-06-18: dump 4MB restaurado sem erro, rollback limpo, prod mantido vazio.

## Requisitos (numerados, testáveis)

- **R1** — Seed one-shot: `pg_dump site-beta-db --data-only --exclude-table-data=schema_migrations` → pipe para `psql site-prod-db` com `session_replication_role=replica` + reset de sequences. Snapshots de ambos os DBs antes do seed. · feito quando: contagens prod == beta; `/healthz` prod retorna `posts>0`.
- **R2** — `site-prod-app` healthy após seed. Build Astro gera 46 páginas, `/healthz` 200 com `posts>0`. Fluxo SSO funcional (login → `/admin/status` 200). · feito quando: container healthy, smoke interno OK, admin acessível.
- **R3** — Autoria (admin) mira o prod. `POST /admin/rebuild` e `POST /admin/import` no container prod disparam rebuild/import no DB prod. `apps/site-admin` (SPA admin) conecta ao backend prod. · feito quando: editar no admin prod altera a raiz; editar no beta NÃO altera a raiz.
- **R4** — Beta sincroniza dados do prod. Mecanismo: dump→restore manual (`pg_dump site-prod-db --data-only --exclude-table-data=schema_migrations | psql site-beta-db`) executado antes de cada deploy do beta (opção A do plan.md). Automação contínua = spec futura. · feito quando: beta tem dados iguais ao prod após sync; editar no beta não afeta prod.
- **R5** — Isolamento de autoria comprovado. Rebuild no admin beta NÃO altera `/healthz` do prod (contagens estáveis). Rebuild no admin prod altera `/healthz` do prod (timestamp/contagem mudam). Prova por DBs distintos: beta escreve em `site-beta-db`, prod escreve em `site-prod-db`. · feito quando: verificação binária com rebuild real em cada ambiente.
- **R6** — Flip de rota Tunnel (mantenedor). Raiz `artificiorpg.com`+`www` → `site-prod-app`. Redirect interno D075 aposentado. `beta.artificiorpg.com` → `site-beta-app` (inalterado). · feito quando: `curl -sI https://artificiorpg.com/healthz` 200 servido por prod.
- **R7** — `critical_routes` prod atualizados para URLs públicas da raiz. **Ordem pétrea:** só após flip de rota (R6) confirmado. Antes do flip, `critical_routes` prod = `[]` (smoke interno manual — a raiz ainda aponta para beta via D075, testar URL pública = falso-positivo). · feito quando: deploy prod com `critical_routes` de raiz passa smoke.
- **R8** — Beta com noindex ativo (X-Robots-Tag) e `PUBLIC_SITE_URL=beta.artificiorpg.com`. Código já em `dev`/`main` (spec 030 F3). · feito quando: `curl -sI https://beta.artificiorpg.com/` retorna `X-Robots-Tag: noindex, nofollow`; raiz não retorna.

## Critérios de aceite

- `site-prod-app` healthy, `/healthz` 200 com posts>0
- `site-prod-db` com 125 posts, 10 pages, 82 taxonomies, 444 media_map (idêntico ao beta pré-seed)
- Sequences resetadas corretamente (`site_content_id_seq` >= 1000000)
- Build Astro prod gera 46 páginas (home, blog, posts, pages, categorias, tags, 404, robots, rss, sitemap-index)
- Admin prod funcional: login SSO → `/admin/status` mostra contagens, rebuild dispara e gera `/healthz` com posts>0
- Raiz `artificiorpg.com` servida por `site-prod-app` (pós-flip rota)
- Beta isolado: rebuild no beta não altera contagens do `/healthz` prod
- Beta com noindex; raiz sem noindex
- Snapshots de ambos os DBs salvos off-VM em `C:\projetos\artificiobackup\`

## Fora de escopo

- Cerimônia DNS Gate C (registro/provedor) — segue adiada (D016)
- Automação contínua de sync prod→beta (cron/trigger) — esta spec define o mecanismo manual (opção A); automação = spec futura
- Gaps de paridade de conteúdo (`BL-SITE-PRINCIPAL-GAPS`: GA_ID, newsletter, sitemap.xml, contato)
- Biblioteca de mídia/PDFs (spec 028)
- Importador WP (descartável, WP offline)

## Riscos e impacto em outros módulos

- **Circular FK em taxonomies (parent_id).** Mitigação: `SET session_replication_role = replica` durante restore. Simulação 2026-06-18 comprovou ausência de erros.
- **Drift de conteúdo na janela de seed:** se autoria mexer no beta entre o dump e o flip de autoria, prod nasce desatualizado. Mitigação: congelar autoria no beta durante a janela (avisar mantenedor). Sem mecanismo de bloqueio técnico — coordenação humana.
- **SSO:** `JWT_SECRET` prod = beta = accounts (hexdump confirmado 2026-06-18). Cookie `Domain=.artificiorpg.com` vale em ambos. Sem mudança.
- **Cloudinary:** URLs absolutas — mídia já migrada serve igual em prod. `CLOUDINARY_*` no `.env` prod copiados do beta.
- **Outros módulos:** zero impacto. Site é isolado. A direção do fluxo de dados é interna ao site.
- **Rollback:** snapshots pré-seed off-VM permitem restaurar estado anterior. Redirect D075 permanece como fallback até flip de rota validado. Pós-flip, rollback de rota exige re-sync prod→beta ou reversão manual do redirect.
- **Sequences:** o `site_content_id_seq` inicia em 1.000.000, acima de qualquer WP ID (max = 18.625). O reset com `setval` é higiênico, não crítico. Sequências implícitas (`redirects_id_seq`, `dev_feedback_id_seq`) não precisam de reset (tabelas vazias no beta).
