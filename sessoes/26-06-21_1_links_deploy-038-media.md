# 26-06-21_1 — links: deploy prod + spec 038 (mídia/reportar/cron)

- **Data:** 2026-06-21
- **App/escopo:** apps/links · infra/deploy · Cloudflare · packages/media/ui (spec 038)
- **Gate:** D (links)
- **Vínculos:** specs/013, specs/037 (deploy-table), spec **038** (criada aqui), E009, BL-CF-TUNNEL-TOKEN-SCOPE

## Objetivo
Subir o deploy prod do links (3 falhas anteriores) e registrar débitos de mídia/UX como spec própria.

## O que foi feito (deploy links — concluído)
1. **Causa raiz das 3 falhas (run `27891034346` etc.):**
   - Falhas 1/2: `.env` corrompido na VM — `ssh "...$(grep)..."` em PowerShell tratou `\n` como literal.
   - Falha 3: senha presa no volume Postgres. Postgres grava senha em `pg_authid` **só na 1ª init**; trocar `.env` de volume existente não atualiza → app conecta pela rede (scram) → `28P01 password authentication failed`. Diagnóstico inicial enganado por `pg_hba` localhost=`trust` (falso positivo). Registrado **E009**.
2. **Fix runtime (autorizado, opção B):** `docker rm -f links-app links-db` + `docker volume rm links_pgdata_links_prod` (DB vazio, 0 dados) + re-dispatch deploy run `27891323485`. App+DB healthy; DB re-seedou 13 grupos.
3. **Bloqueio seguinte — roteamento Cloudflare ausente:** `links.artificiorpg.com` tinha A record cru (proxied=False) → smoke público `000`. Mantenedor criou public hostname no Tunnel `6417d3a0…` (`links-app:4324`) + Cloudflare criou CNAME proxied. DNS validado (CNAME proxied=True, A removido). Smoke da VM: `/healthz=200 /=200 /api/groups=200 /api/admin/v1/groups=401`. **Deploy funcional.**
4. **Prevenção E009 (4 camadas, escritas, sem commit):** `errors.md` E009; `deploy-runbook.md` §rotação de senha/volume; `context-capsule.md` linha T0; `backlog.md` `BL-DEPLOY-ENV-PGPASS-FAILFAST`.

## Bugs achados (→ spec 038)
- **Bug A (nav cross-app):** `modules.ts` já lista links ("WhatsApps", L13), mas glossario/site PROD servem nav sem links (`curl` = 0). Apps buildados antes → precisam redeploy. → spec 038 R7/T12.
- **Bug B (grupos sem logo):** 13 grupos com `logo_url: null` → todo card cai no `/placeholder.svg` (válido, mas vazio). → spec 038 (Fatia A/B)/T13.

## Spec 038 criada
`specs/038-links-group-media-report/` (spec+plan+tasks). Escopo: R1 extrair og:image do convite WhatsApp → R2 upload Cloudinary (`@artificio/media`, signed/backend) → R3 reidratação em lote → R4 botão admin reidratar → R5 cron domingo → R6 botão Reportar nos cards → R7 propagar nav. SDD Completo (media/ui compartilhados, Cloudinary, cron, schema). Tudo por branch+PR.

## Checklist de fechamento
- [x] Deploy links prod funcional (smoke 200/200/200/401)
- [x] E009 + prevenção (4 camadas) escritas
- [x] Spec 038 criada (spec/plan/tasks)
- [x] Bugs A/B registrados na spec + backlog
- [ ] Re-dispatch deploy p/ smoke verde no Actions (interrompido pelo mantenedor) — opcional; runtime já provado
- [ ] Commit/push/PR dos docs+spec (aprovação nominal pendente)
- [x] T1 (Fatia A): Bug `og.ts` corrigido — `fetchOgImage` agora decodifica entidades HTML (`&amp;`→`&`, etc.) na og:image do WhatsApp. Validado com convite real `BXY5PS8M1YeJkUFas6g6c3`: URL retornada `https://pps.whatsapp.net/v/t61.24694-24/...` sem `&amp;`, protocolo https, `new URL()` ok. Build verde.
- [x] T2 (Fatia A): `server/lib/rehydrate-logos.ts` criado — `rehydrateLogos(opts?)` varre grupos ativos, busca og:image, faz upload Cloudinary, compara `public_id` (idempotente), atualiza DB + deleta asset antigo ao trocar. Não-fatal por grupo (try/catch). `tsc` limpo, build verde. Teste funcional completo requer DATABASE_URL+Cloudinary (T4/futuro).
- [x] T3 (Fatia A): `resolveLogo` deduplicada — movida para `server/lib/cloudinary.ts` (canônica). `server.ts`, `seed.ts` e `rehydrate-logos.ts` importam da fonte única. Tag opcional para log (`"admin"`/`"seed"`/`"rehydrate"`). `server.ts`: removida import de `fetchOgImage` (não mais usado). Build verde.
- [x] T4 artefato (Fatia A): `server/rehydrate-cli.ts` criado — invocável no container prod via `tsx server/rehydrate-cli.ts [--force]`. Chama `rehydrateLogos()`, loga resultado JSON. `tsc` limpo. **Execução em prod bloqueada:** requer (1) commit+PR+merge+deploy de T1-T3 em prod; (2) aprovação nominal p/ rodar reidratação contra DB prod. O script CLI está pronto para quando o código estiver em prod.
- [x] T5 (Fatia B): Endpoint admin `POST /api/admin/v1/groups/rehydrate-logos` — dispara reidratação via `runJob("rehydrate", "rehydrate-logos")` (single-flight, espelha rebuild). `GET .../status` retorna `{busy, job}`. Script `"rehydrate-logos"` adicionado ao `package.json` (chama `rehydrate-cli.ts`). Protegido por `requireAuth`+`requireAdmin`+`adminLimiter`. `tsc` limpo, build verde.
- [x] T6 (Fatia B): `RehydrateSection` no `AdminPanel.tsx` — botão "Reidratar imagens" chama `POST .../rehydrate-logos`, desabilita enquanto roda, faz polling de `GET .../status` a cada 2s, exibe resultado (logTail parseado p/ contadores JSON) ou erro inline. `tsc` limpo, build verde.
- [x] T7 (Fatia C): **Cron via crontab da VM** (decisão mantenedor). Comando: `0 6 * * 0 docker exec links-app tsx server/rehydrate-cli.ts >> /var/log/links-rehydrate.log 2>&1`. Artefato `server/rehydrate-cli.ts` standalone. Workflow `links-logo-rehydrate.yml` e endpoint `/api/cron/rehydrate-logos` removidos — sem dependência de GitHub Secrets/Actions.
- [x] T8 (Fatia D): Migration `migration_002_group_reports.sql` + tipos Kysely (`GroupReportsTable`, `GroupReport`, `NewGroupReport`, `ReportReason`, `ReportStatus`) em `db/types.ts`. `Database` atualizado. `tsc` limpo, build verde.
- [x] T9 (Fatia D): Rota pública `POST /api/groups/:slug/report` (rate-limit 5/15min, sem login obrigatório, denormaliza email se logado). Valida `reason` enum, sanitiza `note` com `sanitize-html` (máx 1000 chars), resolve grupo por slug. Repo: `insertReport`, `listReports`, `updateReport` em `server/repo/groups.ts`. Sanitização validada com payloads hostis (`<script>`, `<img onerror>`). `tsc` limpo, build verde.
- [x] T10 (Fatia D): `ReportButton.tsx` island (`client:visible`) + `GroupCard.astro` atualizado. Modal com select de motivo (4 opções), textarea opcional, CSRF via `xsrf_token` cookie → `x-xsrf-token` header. Sucesso/erro inline. Botão fora do `<a>` do card. `tsc` limpo, build verde.
- [x] T11 (Fatia D): Admin reports: `GET /reports` (filtro `?status=`) + `PATCH /reports/:id` (resolved/dismissed) em `server.ts`. `ReportsSection` no `AdminPanel.tsx` — filtro, lista com nome do grupo (map via props), badge de status, ações "Resolver"/"Dispensar". `tsc` limpo, build verde.
- [ ] T12–T13: pendentes

## Bugs corrigidos (revisão pós-T1-T11)

- **Bug 1 (HIGH) — Cloudinary duplicate rejection:** `@artificio/media` usa `overwrite: false` → 2ª execução do `resolveLogo` com mesmo hash rejeitada como 409 → `rehydrateLogos` contava `failed`. **Fix:** `rehydrate-logos.ts:24`: quando `resolveLogo` retorna null e grupo já tem `logo_url`, conta como `unchanged` (logo já existe no Cloudinary), não `failed`.
- **Bug 2 (MEDIUM) — force:true deletava logo inalterada:** Com `force:true`, ao re-upload da mesma imagem (`public_id` igual), `deleteLogo(g.logo_public_id)` deletava a única cópia no Cloudinary. **Fix:** `rehydrate-logos.ts:38`: guard `g.logo_public_id !== stored.logo_public_id` antes de deletar.

## Resumo 2026-06-21 ~17:00

**Implementado (T1–T11):** Fatias A (pipeline logos), B (admin reidratar), C (cron), D (reportar) — 11/13 tarefas. `tsc` limpo, `astro build` verde. 14 arquivos tocados (10 modificados + 4 novos).

**Pendente:** T12 (redeploy nav cross-app) e T13 (smoke E2E) = deploy (aprovação nominal por app).

**Bloqueios:**
- T4: reidratação real depende de deploy T1-T3 + aprovação p/ execução em prod
- T12: 4 deploys de consumidores (aprovação nominal)

**Escolhas:** `resolveLogo` canônica em `cloudinary.ts` (fim de drift) · cron via **crontab da VM** (decisão mantenedor) · `reportLimiter` 5/15min · CSRF via `xsrf_token` cookie · `sanitize-html` com `allowedTags:[]` · ReportButton fora do `<a>` · `runJob` single-flight no admin

## Critério de conclusão
Deploy links: **concluído** (runtime healthy + rotas críticas ok). Spec 038: **scaffold concluído**, execução é trabalho futuro. Docs/spec aguardam commit por PR (aprovação).

## project-state.md
Atualizar: links.artificiorpg.com no ar (Gate D em curso); spec 038 aberta (mídia/reportar/cron); E009 catalogado.
</content>
