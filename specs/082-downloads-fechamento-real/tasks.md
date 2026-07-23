# Tasks — Spec 082

## F0 — auditoria e backup

- [x] T0.0 — Auditoria live Beta: home visual abre; catálogo renderiza shell, mas falha ao carregar materiais. Front buildado servido; API/DB funcional não comprovado.
- [x] T0.0a — Auditoria visual de tema: mantenedor confirmou dark predominantemente navy e light funcionando só no Header; código confirma conteúdo com classes/tokens dark fixos.
- [x] T0.1 — Inventariar containers, volumes, labels Compose, env não secreto por nomes e runs de deploy. Resultado: app healthy, API unhealthy, DB healthy; volume atual `downloads-beta_*`, legado `downloads_*`; deploy `29759345736` falhou no guard de 19 migrations.
- [x] T0.2 — Comparar volumes Beta e identificar qual contém dados válidos das specs 070–075. `downloads-beta_pgdata_downloads_beta` (projeto `downloads-beta`, 46.1M) tem apenas `schema_migrations` vazia; `downloads_pgdata_downloads_beta` (projeto legado `downloads`, 46.9M) tem schema completo com 20 tabelas e as 19 migrations 001–019 aplicadas, mas zero registros de domínio. Cópias temporárias isoladas comparadas e removidas; originais intactos. Destino dos volumes foi decidido em T0.4.
- [x] T0.3 — Backup off-VM + hash + `pg_restore -l` + restore-test isolado. Datasets custom-format em `C:\projetos\artificiobackup\spec-082\20260723-172424`; hashes registrados na sessão. `pg_restore -l` passou na VM; restore-test passou: canonical 1 tabela, legado 20 tabelas/19 migrations. `pg_restore` não está instalado no Windows local; limitação registrada.
- [x] T0.4 — Decisão do mantenedor: `downloads-beta_pgdata_downloads_beta` permanece banco do ambiente Beta/dev; `downloads_pgdata_downloads_prod` será banco próprio de Produção. O legado `downloads_pgdata_downloads_beta` (projeto Compose errado `downloads`, schema completo porém sem dados) não será conectado a nenhum runtime; dump fica retido como auditoria/rollback até Beta e Prod passarem smoke, depois remoção exige autorização.
- [x] T0.5 — Comparar build servido com código local: frontend foi rebuildado em 2026-07-20; API dist servida coincide por hash com os arquivos locais críticos.
- [x] T0.6 — Auditar rotas/UX/storage/tema e registrar lacunas materiais em `investigacao-pre-implementacao.md`.

## F1 — corrigir Beta

- [x] T0.7 — Catálogo central validado em runtime real (Beta): `CATALOG_API_URL=http://site-beta-app:4322`, `CATALOG_INTERNAL_TOKEN` presente e aceito. `GET /api/catalog/v1/health` (autenticado, via rede interna do container `downloads-beta-api`) respondeu `{"ok":true,"catalog_version":1291,"nodes_count":1289,...}`. **Bug real achado e corrigido:** `apps/downloads/backend/src/services/catalogClient.ts` chamava `GET /api/catalog/v1/systems/:id` — rota inexistente no site (confirmado 404 real via HTTP), fazia `getCatalogNodeById` sempre cair no `catch` e retornar `null` silenciosamente (nunca hidratava sistema/edição do material). Rota real do site é `GET /api/catalog/v1/nodes/:idOrSlug` (`apps/site/server/catalog-api.ts:41`), confirmada funcionando por ID e por slug via HTTP real. Corrigido com aprovação do mantenedor; tsc/lint/build/76 testes backend verdes após o fix. Falha fechada (`catch → null`) preservada para Site indisponível — comportamento correto, só a rota estava errada.
- [x] T0.8 — Matriz de pacotes compartilhados confirmada. Backend usa `auth`, `catalog-client`, `changelog`, `config`, `media` (todos `workspace:*`); frontend usa `analytics`, `auth`, `catalog-client`, `config`, `ui` — igual ao inventário do plan.md. Backend: lint verde, build verde, 76/76 testes verdes (após fix T0.7). Frontend: lint verde, build verde (247 módulos), 6/6 testes verdes. Smoke runtime SSO/shell/tema/changelog já provado por T0.0/evidência live (home renderiza header/footer/nav/tema/changelog/auth do shell compartilhado); catálogo provado agora por T0.7. Upload real de mídia (Cloudinary) não exercitado nesta etapa — fora do escopo de matriz de compatibilidade, pertence a F2/F3 (fluxo funcional).

- [x] T1.1 — `downloads-beta` confirmado projeto Compose canônico dos containers vivos (`downloads-beta-app/api/db`, todos labelados `com.docker.compose.project=downloads-beta`). Script de migration exige `COMPOSE_PROJECT=downloads-beta` explícito (achado: `compose_project_flag()` só aplica `-p` se a env var estiver setada; sem ela, compose usa nome do diretório e não enxerga os containers do projeto certo — documentado para não repetir erro).
- [x] T1.2 — Bootstrap executado via SSH em `/opt/artificio-beta` seguindo precedente `E012`: `COMPOSE_PROJECT=downloads-beta MAX_AUTO_PENDING=19 bash scripts/deploy/apply_required_migrations.sh apps/downloads/docker-compose.beta.yml downloads-beta-db downloads admin apps/downloads/database`. Snapshot pré-migration (`pg_dump`, 1.786 bytes, banco vazio) salvo em `/tmp/downloads-beta-predeploy-manual-20260723.dump` na VM antes de rodar. `.env.beta` copiado para `.env` temporário (docker compose não lê `.env.beta` sem `--env-file` explícito, ausente no script de migration) e removido logo após a execução. As 19 migrations aplicaram limpo (`[migrations] schema em conformidade`), sem erro/DROP destrutivo. Guard não é bug — comportamento normal de proteção; volta a `MAX_AUTO_PENDING=5` no próximo `deploy.yml`.
- [x] T1.3 — Confirmado: `schema_migrations` tem 19 linhas; `\dt` lista 20 tabelas (19 domínio + tracking). `docker restart downloads-beta-api` após bootstrap ficou `healthy`. `GET /api/v1/health` → `{"status":"ok","db":"connected","sampled":false}`. `GET /api/v1/materials` → `{"items":[],...,"total":0}` (schema correto, banco sem dados de domínio — esperado, nenhum material cadastrado ainda).
- [x] T1.4 — Migrations 001–019 registradas em `schema_migrations` no banco correto `downloads-beta_pgdata_downloads_beta` (volume ativo do container `downloads-beta-db`, confirmado T0.4).
- [x] T1.5 — Containers `downloads-beta-app`/`downloads-beta-api`/`downloads-beta-db` todos `healthy`. Schema esperado presente (20 tabelas).

## F2 — fechar produto antes do smoke

- [ ] T2.1 — Implementar tela/fluxo de criação usando `POST /api/v1/materials`.
- [ ] T2.2 — Implementar ação de submissão usando `POST /api/v1/moderation/:id/submit`.
- [ ] T2.3 — Decidir storage: provider gerenciado real ou MVP somente-link-externo.
- [ ] T2.4 — Persistir binário de evidência se upload gerenciado permanecer no contrato.
- [ ] T2.5 — Implementar `/obter/:fileId` conforme contrato decidido.
- [ ] T2.6 — Migrar dark/light integralmente para tokens semânticos, incluindo estados e responsividade.
- [ ] T2.7 — Implementar ou reclassificar, com decisão do mantenedor, gestão de mídias, gestão de publicadores e link checker agendado.

## F3 — smoke Beta

- [ ] T3.1 — Validar health, catálogo, ficha, criador, redirect/download e respostas 401/404.
- [ ] T3.2 — Executar criação→submissão→moderação→publicação→download real.
- [ ] T3.3 — Validar storage/provider, checksum, auditoria e rollback.
- [ ] T3.4 — Validar dark/light ponta a ponta e screenshots desktop/mobile.

## F4 — Prod e fechamento

- [ ] T4.1 — Rodar lint/build/test/verify:api; atualizar 070–076/backlog com evidência, sem mascarar gaps.
- [ ] T4.2 — Commit/push/PR somente com autorização nominal.
- [ ] T4.3 — Promote `dev→main` somente com autorização nominal.
- [ ] T4.4 — Deploy Prod via `workflow_dispatch` manual, somente com autorização nominal.
- [ ] T4.5 — Smoke Prod e registrar run IDs/URLs/timestamps.
- [ ] T4.6 — Fechar 082/076 apenas após todos os critérios verdes; reabrir e perguntar se qualquer falha surgir.
