# 26-07-13_2 — mesas: OG scrape automático + busca de catálogo incompleta

**App/projeto:** mesas (+ catálogo central/glossario)
**Gate:** D (ativo)
**Objetivo:** registrar 2 achados novos do mantenedor, pós-fechamento da sessão `26-07-13_1`. Só investigação/registro nesta etapa — sem corrigir ainda.

## Vínculos

- Segue `26-07-13_1_mesas_draft-importado-7-achados.md` (fechada, PR #156 merged + deploy prod).
- Catálogo compartilhado: `apps/mesas/backend/src/services/catalogClient.ts` consome `GET /api/catalog/v1/systems` (fonte central, provavelmente glossario).

## Achado A — Open Graph nunca aparece no WhatsApp real ("nunca funcionou")

**Print do mantenedor:** postou mesa no WhatsApp, preview não veio. Facebook Sharing Debugger reporta: *"Essa URL não foi compartilhada no Facebook antes. Buscar informações novas."*

**Investigação feita nesta conversa:**
- Confirmado (curl com UA `WhatsApp/2.23.20.0` e `Discordbot/2.0`, direto na URL pública `https://mesas.artificiorpg.com/mesas/:slug`): servidor responde **200 com título/imagem corretos da mesa** (Cloudinary, banner real). `Cf-Cache-Status: DYNAMIC` (não cacheado no Cloudflare).
- `apps/mesas/frontend/nginx.conf`: `map $http_user_agent $is_crawler` detecta WhatsApp/Discordbot/facebookexternalhit/etc., delega pra `@og_proxy` → backend `/og/mesas/:slug`. Confirmado funcionando de fora.
- **Causa real, não é bug de servidor:** WhatsApp/Facebook não crawleia proativamente a primeira vez que uma URL existe — só busca metadata quando (a) alguém compartilha o link e o app tenta pré-carregar, ou (b) alguém dispara manualmente via Sharing Debugger (`developers.facebook.com/tools/debug`). "Nunca foi compartilhado" no debugger = nunca rodou esse scrape pra aquela URL específica.
- Testei também: sem UA de bot, sem UA de bot 2x seguidas — `Cf-Cache-Status: DYNAMIC` em ambos, sem cache/bloqueio aparente do lado de fora.
- Não tentei login no Facebook Debugger real (exige sessão pessoal do mantenedor — fora do escopo do agente sem autorização).

**Pedido do mantenedor:** criar ferramenta que, após publicar ou atualizar uma mesa, dispare automaticamente o scrape do Facebook/WhatsApp pra aquela URL (evitar precisar rodar manualmente no Debugger toda vez).

**Caminho técnico provável:** [Sharing Debugger API](https://developers.facebook.com/docs/sharing/webmasters/) — `POST https://graph.facebook.com/?id=<url>&scrape=true` autenticado com App Token do Facebook (não é o mesmo OAuth de login de usuário; precisa de App ID + App Secret próprios, registrados no Meta for Developers). Isso é **integração nova com API externa**, exige:
- App próprio no Meta for Developers (ou usar app existente se já houver um pra outro fim, ex. login social).
- Token/segredo novo — nunca commitar, vive em `.env`/secrets do Actions.
- Chamada disparada no backend, no evento de publicação/atualização de mesa (`sync-to-mesa`, edição de mesa ativa).

**Status: IMPLEMENTADO (2026-07-13, mesma sessão).** Mantenedor criou App próprio no Meta for Developers ("Artificio OG", tipo "sem caso de uso" — só App ID + App Secret, sem Login/produto/App Review). Escopo isolado em `apps/mesas/backend` (SDD Lite — não toca `packages/*`/auth, só integração nova server-to-server).

**Implementação:**
- `apps/mesas/backend/src/services/metaScrapeClient.ts` (novo): `triggerMetaScrape(url)` dispara `POST https://graph.facebook.com/?id=<url>&scrape=true&access_token=<META_APP_ID>|<META_APP_SECRET>`. Fire-and-forget (nunca bloqueia/derruba o fluxo de publish/edit que chama); sem credencial configurada, só loga aviso e sai (`console.warn`) — nunca lança erro.
- Hook 1 — `PATCH /api/v1/gm/tables/:id/status` (`gmPanel.ts`): dispara scrape na 1ª publicação real (`draft/outro -> active`), junto da notificação de admins já existente.
- Hook 2 — `PUT /api/v1/gm/tables/:id` (`gmPanel.ts`): `existingTable` agora seleciona também `slug`/`banner_url`/`status`; dispara scrape só quando `banner_url` muda de fato **e** a mesa já está `active` (edição de rascunho não dispara à toa).
- `.env.example` do backend mesas ganhou `META_APP_ID`/`META_APP_SECRET` (documentado, sem valor real).
- Validado: `tsc --noEmit` limpo, `pnpm --filter @artificio/mesas-backend lint` limpo, `pnpm --filter @artificio/mesas-backend build` verde.
- **Credencial:** mantenedor colou o App Token em texto no chat durante a criação do App ("Artificio OG", App ID `1672654770507526`) — tratado como potencialmente exposto, guia próprio publicado (sem passo de reset, por decisão do mantenedor) orientando a configurar `META_APP_ID`/`META_APP_SECRET` manualmente no `.env` da VM. **Confirmado configurado** (`grep` read-only em `/opt/artificio/apps/mesas/.env`, valores não impressos).
- `apps/mesas/docker-compose.prod.yml` (`mesas-api`): adicionadas `META_APP_ID`/`META_APP_SECRET` opcionais (`${VAR:-}`) no bloco `environment:` — sem isso as vars do `.env` não chegariam ao container mesmo estando no host.

**Review do bot (`chatgpt-codex-connector`) na PR #157, corrigido na mesma sessão (2 rodadas):**

**Rodada 1** — achado real: hook do scrape só existia no branch **GM** do `PATCH /gm/tables/:id/status`; 3 caminhos de publish ficavam sem scrape: (a) branch **admin** do mesmo PATCH (retornava antes do hook), (b) `POST /gm/tables` quando mesa já nasce `status='active'`, (c) `PUT /api/v1/admin/tables/:id` (ação administrativa de status, `adminTables.ts`). Adicionado disparo nos 3 pontos (duplicando a condição `newStatus==='active' && previousStatus!=='active'` inline).

**Rodada 2** — 2 novos achados do mesmo bot, verificados contra o código antes de corrigir:
1. **Válido** — duplicação: a condição de disparo estava repetida em 4 call-sites. Extraída `triggerMetaScrapeOnPublish(slug, newStatus, previousStatus)` em `metaScrapeClient.ts`, usada nos 4 pontos (`POST /gm/tables`, `PATCH /gm/tables/:id/status` × 2 branches, `PUT /admin/tables/:id`).
2. **Válido** — `catalog-backup.yml` gravava `pg_dump` direto no arquivo final (dentro do glob usado pela poda de `KEEP=10`); falha no meio do dump deixaria backup truncado contado como válido. Corrigido: dump em arquivo temp fora do glob, `trap` de limpeza em qualquer saída, valida não-vazio, só então `mv` atômico pro nome final.

Validado após cada rodada: `tsc --noEmit`, `pnpm --filter @artificio/mesas-backend lint`, `build`, **449 testes backend** (nenhuma regressão), `pnpm verify:api` (0 breaking changes).

**Backfill retroativo (pedido do mantenedor):** mesas já `active` antes desta feature nunca tiveram scrape disparado — código novo só cobre eventos futuros. Criado `apps/mesas/backend/src/scripts/backfillOgScrape.ts` (mesmo padrão dos demais scripts one-off do backend mesas, não é rota/serviço permanente — inicialmente criado fora de `src/`, movido pra dentro por exigência do ESLint/`tsconfig.json` do pacote, que só inclui `src/**/*`): lista `tables WHERE status='active'`, chama `triggerMetaScrape` pra cada uma com 500ms de intervalo (não martela o Graph API), idempotente. Uso: `docker exec mesas-api node_modules/.bin/tsx src/scripts/backfillOgScrape.ts`, só depois do deploy do PR #157 em prod. `tsc --noEmit`/lint/build verdes. Incluído no PR #157 (autorizado pelo mantenedor: "coloca no próximo commit").

**Estado do PR:**
- [PR #157](https://github.com/FarenRavirar/artificio/pull/157) aberta contra `dev`, branch `feat/mesas-og-scrape-catalog-backup` (criada a partir de `origin/dev` sincronizado, conforme trava pétrea).
- Commit 1 (`369bf35`): implementação inicial (scrape OG achado A + backup catálogo + restauração achado B + ajuste CSS solto do draft).
- Commit 2 (`10ebb7f`): correção dos 2 achados do bot review da rodada 2 (helper único + fix do backup atômico). Ambos commits com autorização nominal própria (commit+push separados).
- `backfillOgScrape.ts` **não commitado ainda** — pendente decisão de escopo.
- Deploy prod do mesas **não disparado ainda** — só depois disso o scrape (novo e retroativo) entra em uso real.

## Achado B — Busca de sistema no catálogo não encontra "sistemas antigos do compartilhado"

**Print do mantenedor:** no `SystemPicker` do draft, busca por "dung" (esperado: Dungeons & Dragons) retorna "Nenhum sistema encontrado". Mantenedor relata que funciona pra uns sistemas e não pra outros — suspeita de sistemas antigos do catálogo compartilhado que não estão sendo buscados.

**Investigação feita nesta conversa:**
- `filterCatalogTree` (`apps/mesas/backend/src/services/catalogClient.ts:192-204`) busca em `name`, `slug`, `path_slug` e `aliases`, normalizando com `.trim().toLowerCase()` (`normalizeText`, linha 385-386) — sem remoção de acento/diacrítico nessa função (diferente de `slugifyCatalogSegment`, que usa `.normalize('NFD')` + remoção de diacríticos).
- Fonte de dados: `loadCatalogTree` (linha 141-161) busca de `GET /api/catalog/v1/systems` — API do catálogo central (fora de `apps/mesas`, provável `glossario` ou serviço próprio de catálogo). Cache local de 60s (`CATALOG_CACHE_TTL_MS`).
- **Não confirmado ainda:** se "dungeons and dragons" (ou variante) existe na resposta real dessa API. Não fiz chamada real à API do catálogo nem inspecionei o banco por falta de acesso/tempo nesta sessão.
- Hipótese A (dado): sistema "D&D"/"Dungeons & Dragons" nunca migrou pro catálogo central, ou está cadastrado só com nome divergente (ex.: só "D&D 5e" sem o nome completo nem alias "dungeons").
- Hipótese B (busca): `normalizeText` não normaliza NFD/diacríticos como `slugifyCatalogSegment` faz — mas "dung" é ASCII puro, não explicaria por si só.
- Sem reprodução completa: não é possível confirmar causa raiz sem consultar a API/banco do catálogo central diretamente.

**Status:** investigação parcial, registrada conforme pedido do mantenedor ("registre a busca"). Não corrigido. Próximo passo: consultar `GET /api/catalog/v1/systems` real (ou banco do catálogo) pra confirmar se "Dungeons & Dragons"/"D&D" existe e com quais aliases.

## Achado B — ATUALIZAÇÃO CRÍTICA: catálogo central em produção esvaziou (não é bug de busca)

**Investigação read-only concluída (2026-07-13, continuação desta sessão).** Causa raiz confirmada: não é bug de filtro/busca. O **catálogo central em produção perdeu quase todos os registros**.

**Evidência:**
- `GET https://mesas.artificiorpg.com/api/v1/systems?view=tree` retorna hoje só **9 nós** (CAIN RPG, Call of Cthulhu+1e+7e, Daggerheart, Feiticeiros & Maldições, Harry Potter RPG+5e, Order e Chaos).
- Catálogo central vive em `site-prod-db` (banco `site`, tabela `catalog_nodes`), consumido via `CATALOG_API_URL` apontando pra `site.artificiorpg.com` (`packages/catalog-client`), **não é o glossario**.
- `docker exec site-prod-db psql -U admin -d site -c "select count(*) from catalog_nodes"` → 9. Todos os 9 com `created_at`/`updated_at` **hoje, 2026-07-13, entre 16:20 e 20:19** — ou seja, são recriação manual recente (provável teste do fluxo de criação em cascata da spec 062 PR #144), não o catálogo histórico.
- Volume `pgdata_site_prod` **não foi resetado** (criado 2026-06-18, Gate C) — `posts` no mesmo banco tem 125 linhas históricas desde 2026-06-06 intactas. Ou seja, só `catalog_nodes` esvaziou; causa exata de COMO/QUANDO isso aconteceu **não identificada** (sem log de DROP/DELETE nas últimas 72h de `site-prod-app`; logs mais antigos não disponíveis/rotacionados).
- **Nenhum backup do banco `site` com catálogo populado existe** — nem em `C:\projetos\artificiobackup`, nem na VM (`/tmp/*.dump`, `/opt/artificio/_deploy_backups`, `/home/ubuntu/bk/*`, `/home/ubuntu/backups/*`). Único dump relacionado (`spec-062/site_beta_pre_catalog_import_20260711-131159.sql`, ambiente BETA) já era **pré-import**, tem só 1 linha em `catalog_nodes` — não serve.
- **Dado NÃO está perdido de verdade.** `mesas-db` prod (`mesas_rpg`), tabela local `systems` (legado, pré-migração pro catálogo central), tem **1269 linhas intactas**, incluindo `Dungeons & Dragons`, `Advanced Dungeons & Dragons`, `Dungeons & Dragons 3.0` com hierarquia (`parent_id`) preservada. Essa é a mesma fonte que populou o catálogo central originalmente.
- Existe script de import pronto e idempotente: `apps/site/scripts/import-mesas-catalog.ts` — lê de `mesas.systems`/`system_aliases` (via `MESAS_DATABASE_URL` ou JSON), faz upsert em `catalog_nodes` via tabela de mapeamento `catalog_legacy_mappings` (dedup por checksum).
- **Risco de reimport direto agora:** `catalog_legacy_mappings` no site-prod está com **0 linhas**. Os 6 sistemas raiz + 3 edições recriados manualmente hoje **não têm mapping** — rodar o import agora vai criar **duplicatas** desses 9 nós (novo UUID cada) em vez de reconhecer que já existem. Precisa de decisão: (a) apagar os 9 nós manuais antes do reimport [teria que ser feito com aprovação nominal, é DELETE em prod], ou (b) rodar o import e depois mesclar/arquivar os 6+3 duplicados manualmente, ou (c) pré-popular `catalog_legacy_mappings` mapeando os 9 IDs manuais aos IDs legados correspondentes em `mesas.systems` antes do import.

**Status:** causa raiz do esvaziamento não 100% explicada (sem log de DROP/DELETE disponível — logs de `site-prod-app` só cobrem 72h). Caminho de recuperação executado e validado.

**RECUPERAÇÃO EXECUTADA (2026-07-13, aprovação nominal do mantenedor):**
1. Snapshot pré-mudança: `pg_dump` de `site-prod-db` → `/tmp/artificio-backup-062/site-prod-pre-catalog-reimport-20260713.sql` na VM, copiado off-VM pra `C:\projetos\artificiobackup\spec-062\site-prod-pre-catalog-reimport-20260713.sql`.
2. Apagados os 9 nós manuais (+ `catalog_audit_events`/`catalog_aliases` filhas via FK) criados hoje antes do reimport, pra evitar duplicata.
3. Dry-run (`CATALOG_IMPORT_DRY_RUN=true`) do `apps/site/scripts/import-mesas-catalog.ts` rodado dentro do container `site-prod-app` (mesma rede docker `artificio_net` que `mesas-db`, `MESAS_DATABASE_URL` apontando pro `mesas-db:5432/mesas_rpg`): relatório limpo, **1269 sistemas / 409 aliases**, 1269 seriam criados, 0 unchanged/updated. Só warnings de `slug_diff` (formato de slug com "e" vs "&" — não bloqueante, cosmético).
4. Import real (commit) rodado: **1269 nós criados**, `nodes_count: 1269`, `dry_run: false`.
5. Validado na API pública: `GET /api/v1/systems?view=tree&search=dung` agora retorna Dungeons & Dragons, Advanced Dungeons & Dragons, Dungeons & Dragons 3.0/3.5e/4e etc. — busca funcionando.
6. Reports temporários (`/tmp/catalog-import-report-*.json`) e nenhum processo auxiliar deixado rodando na VM.

**Causa raiz do esvaziamento original permanece não identificada** (sem log). Débito registrado abaixo pra decidir se vale investigar mais fundo (auditoria de deploy history do site, versão anterior do compose, etc.) — não bloqueia o catálogo já estar restaurado.

## Checklist de fechamento

- [x] Achado A (OG) — **IMPLEMENTADO E COMMITADO.** `metaScrapeClient.ts` dispara scrape automático nos 4 pontos de publish + hook de troca de banner. PR #157 aberta, 2 commits (implementação + correção de review), push confirmado.
- [x] Achado B (busca catálogo) — **RESOLVIDO.** Catálogo central em prod estava esvaziado (só 9 nós manuais de teste); reimportado de `mesas.systems` (fonte legada intacta, 1269 linhas). Aprovação nominal do mantenedor obtida. Snapshot pré-mudança feito e copiado off-VM. 9 nós manuais + filhas (audit/aliases) apagados, dry-run validado, import real rodado: 1269 nós criados. Confirmado na API pública que busca "dung" agora encontra D&D.
- [x] Causa raiz do esvaziamento original — **não identificada** (sem log disponível de DROP/DELETE; logs do `site-prod-app` só cobrem 72h). Não bloqueia — dado já restaurado da fonte legada. Registrado como débito aberto (`BL-CATALOG-EMPTY-ROOT-CAUSE`) caso o mantenedor queira investigar mais fundo depois.
- [x] Backup semanal automático do catálogo central — `.github/workflows/catalog-backup.yml` no PR #157, corrigido (dump atômico via temp+trap+rename) na rodada 2 de review.
- [x] Review do bot (`chatgpt-codex-connector`) — 2 rodadas, 4 achados no total, todos verificados contra código atual e corrigidos (nenhum descartado). Validado com testes/lint/build/verify:api a cada rodada.
- [ ] Script de backfill retroativo (`backfillOgScrape.ts`) — criado, `tsc` verde, **decisão pendente**: incluir no PR #157 ou rodar à parte, não commitado ainda.
- [ ] Deploy prod do mesas — só depois disso o scrape (automático e retroativo) entra em uso real; nenhum deploy disparado nesta sessão.
- [ ] `specs/backlog.md` — pendente registrar: (1) débito `BL-CATALOG-EMPTY-ROOT-CAUSE`, (2) status do PR #157 (OG scrape + backup catálogo) quando mergeado/deployado

## Codex 2026-07-13 — remover Serena dos agentes
- Escopo ampliado pelo mantenedor: remover Serena das instruções ativas e configurações MCP de Codex, Claude Code e OpenCode. Histórico em specs/sessões permanece como registro.
- Plano: retirar regras/referências operacionais de Serena, remover os três registros MCP locais e validar as configurações restantes.
- Feito: removidos os registros MCP em `C:\Users\paulo\.codex\config.toml`, `C:\Users\paulo\.claude.json` e `opencode.json`; T0 e `AGENTS.md` atualizados. JSON de Claude/OpenCode válido; nenhuma referência ativa a Serena ficou.
