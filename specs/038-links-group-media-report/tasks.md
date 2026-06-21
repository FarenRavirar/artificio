# Tasks — 038 (links: mídia dos grupos + reportar + cron)

> **SDD Completo.** Tudo entra por **branch + PR** (`git switch -c fix/038-<slice>` → push → `gh pr create --base dev`). `dev` tem branch protection: push direto **falha**; PR exige check `lint + build + test` verde, 0 approvals. Promoção `dev→main` por fast-forward (`promote-prod-fast-forward.yml`). Commit/push/PR/deploy = **aprovação nominal por ação** (não acumula). Não pular etapas.

---
## CONTEXTO PARA AGENTE FRIO (ler antes de tocar código)

**T0 obrigatório primeiro:** `.specify/memory/project-state.md` + `docs/agents/context-capsule.md` + `.specify/memory/decisions.md`. Depois esta spec (`spec.md` + `plan.md`) e a sessão `sessoes/26-06-21_1_links_deploy-038-media.md`.

**Estado atual (2026-06-21):** `links.artificiorpg.com` **no ar** (Gate D em curso). DB prod tem 13 grupos curados, **todos com `logo_url: null`**. Cloudinary **está configurado** no `links-app` (`CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET` presentes). WhatsApp **serve og:image real** (avatar de `pps.whatsapp.net`) pro nosso UA — pipeline é viável.

**O que JÁ EXISTE (reusar, não reinventar):**
- `apps/links/server/lib/og.ts` — `parseInviteUrl(raw)` (allowlist `chat.whatsapp.com` / `whatsapp.com/channel`) + `fetchOgImage(inviteUrl): Promise<string|null>` (fetch + extrai `og:image`, defesa de redirect por host). ⚠️ **BUG conhecido (T1):** não decodifica entidades HTML — devolve URL com `&amp;` literal → download falha.
- `apps/links/server/lib/cloudinary.ts` — `uploadLogoFromUrl(sourceUrl)` (folder `artificio/links`, max 2MB, idempotente por sha256 do conteúdo via `@artificio/media`), `deleteLogo(publicId)`, `cloudinaryEnabled()`.
- `apps/links/server/server.ts` — `resolveLogo(inviteUrl)` (server.ts:176; `fetchOgImage`→`uploadLogoFromUrl`, não-fatal). Já chamado em `POST /groups/:id/accept` (:189) e `PATCH /groups/:id` ao trocar invite (:208). `deleteLogo` em `DELETE /groups/:id` (:270). Router admin: `admin.use(adminLimiter); admin.use(requireAuth, requireAdmin)` (:160) montado em `/api/admin/v1` (:358). Padrão de job assíncrono: `POST /rebuild` (:348) + `GET /rebuild/status` (:354) usando `runJob`/`jobBusy`/`jobState` de `server/jobs.ts`.
- `apps/links/db/seed.ts` — já tem `resolveLogo` próprio (seed.ts:12) e chama em grupo sem logo (`needLogo ? resolveLogo(g.href) : null`, :55). Os 13 ficaram null porque no momento do seed o `fetchOgImage` retornou null (provável BUG `&amp;` de T1, ou Cloudinary ainda não pronto).
- `apps/links/server/repo/groups.ts` — `listGroups(filter)`, `findById(id)`, `updateGroup(id, patch)`, `deleteGroup(id)`. Tipos em `apps/links/db/types.ts` (`Group`, `GroupStatus='pending'|'active'|'archived'|'rejected'`).
- `packages/media/src/index.ts` — `uploadFromUrl`, `uploadBuffer`, `deleteAsset`, `isConfigured`. **Compartilhado → não mudar sem smoke dos consumidores (site/mesas/glossario).**
- `packages/ui/src/modules.ts:13` — nav já lista `{ label: "WhatsApps", href: "https://links.artificiorpg.com" }`.
- Cron de referência: `.github/workflows/mesas-auto-archive.yml` (schedule + job `guard` de branch, D073).

**Como buildar/validar local:**
- `pnpm --filter @artificio/links build` (Astro) · `pnpm --filter @artificio/links exec tsc --noEmit` se houver tsconfig de typecheck.
- Backend roda via `pnpm --filter @artificio/links serve` (tsx `server/server.ts`); migrate `... run migrate`; seed `... run seed`.
- Deploy: `gh workflow run deploy --ref dev -f module=links -f mode=deploy -f env=prod` (aprovação nominal).
- Smoke público (da VM, read-only): `ssh faren 'curl -sS -o /dev/null -w "%{http_code}" https://links.artificiorpg.com/healthz'` → 200.

**Gotcha de deploy (E009):** Postgres grava senha só na 1ª init do volume. Não recriar volume sem necessidade. Ver `errors.md` E009.

---
## Fatia A — Corrigir pipeline existente + reidratar os 13 (fecha Bug B)
- [x] **T1** — Bug `og.ts`: decodificar entidades HTML na og:image antes de retornar. Em `fetchOgImage`, após extrair `url`, aplicar decode mínimo (`&amp;`→`&`, `&#38;`, `&quot;`, `&#39;`, `&lt;`/`&gt;`) **antes** do `new URL(url)`. · ✅ validado: convite `BXY5PS8M1YeJkUFas6g6c3` → URL `pps.whatsapp.net/...` sem `&amp;`, protocolo https, `new URL()` ok. Build verde.
- [x] **T2** — Rotina de reidratação `server/lib/rehydrate-logos.ts`: `rehydrateLogos(opts?: { force?: boolean }): Promise<{updated:number; unchanged:number; failed:number; skipped:number}>`. Varre `Groups.listGroups({status:'active'})`; para cada usa `resolveLogo()` canônica (T3). Não-fatal por item (try/catch por grupo). · ✅ `tsc` limpo, build verde. **Bugs corrigidos:** (1) Cloudinary rejeita `public_id` duplicado (`overwrite: false`) → 2ª+ execução agora conta como `unchanged` em vez de `failed`; (2) `force:true` não deleta mais logo quando `public_id` inalterado. Teste funcional completo requer DATABASE_URL+Cloudinary (T4).
- [x] **T3** — Reusar `resolveLogo`: extrair o `resolveLogo` duplicado (server.ts:176 e seed.ts:12) para `server/lib/cloudinary.ts` e importar nos dois + `rehydrate-logos.ts`, evitando drift. Tag opcional para log (`"admin"`/`"seed"`/`"rehydrate"`). `server.ts`: removida import de `fetchOgImage` não mais usada. · ✅ 1 só definição; build verde.
- [x] **T4** — Reidratar prod: artefato `server/rehydrate-cli.ts` pronto. **Execução em prod bloqueada:** requer (1) commit+PR+merge+deploy de T1-T3; (2) aprovação nominal p/ rodar `docker exec links-app tsx server/rehydrate-cli.ts`. Critério: `curl https://links.artificiorpg.com/api/groups` → `logo_url` `res.cloudinary.com/...`.

## Fatia B — Admin: botão reidratar (R3+R4)
- [x] **T5** — Endpoint `admin.post("/groups/rehydrate-logos")` no router admin de `server.ts` (protegido por `requireAuth, requireAdmin, adminLimiter`). Espelha padrão `runJob` (single-flight) + script `"rehydrate-logos"` no `package.json`. Opcional implementado: `GET /groups/rehydrate-logos/status` (espelha `/rebuild/status`). · ✅ `tsc` limpo, build verde.
- [x] **T6** — Botão "Reidratar imagens" em `apps/links/src/components/admin/AdminPanel.tsx` (`RehydrateSection`): chama endpoint T5, desabilita enquanto roda, faz polling de status a cada 2s, exibe contadores (parse do `logTail`) ou erro inline. · ✅ build verde.

## Fatia C — Cron domingo (R5)
- [x] **T7** — Cron via **crontab da VM** (decisão mantenedor). Comando: `0 6 * * 0 docker exec links-app tsx server/rehydrate-cli.ts >> /var/log/links-rehydrate.log 2>&1`. Artefato `server/rehydrate-cli.ts` pronto (standalone, aceita `--force`). **Removidos:** workflow `links-logo-rehydrate.yml` (GitHub) e endpoint `/api/cron/rehydrate-logos` (`server.ts`) — cron agora parte direto da VM, sem depender de GitHub Secrets. · ✅ `tsc` limpo, build verde.

## Fatia D — Reportar grupo (R6)
- [x] **T8** — Migration `apps/links/database/migration_002_group_reports.sql` (headers `@class: online-safe`, `@requires-backup: false`). Tabela `group_reports` (id uuid pk, group_id FK→groups CASCADE, reason CHECK, note, reporter_email, status CHECK, created_at) + index `(status, created_at)`. Tipos `GroupReportsTable`, `GroupReport`, `NewGroupReport`, `ReportReason`, `ReportStatus` em `db/types.ts`. `Database` atualizado. · ✅ `tsc` limpo, build verde. Aplicação em beta pendente de deploy.
- [x] **T9** — Rota pública `POST /api/groups/:slug/report` em `server.ts` (rate-limit `reportLimiter`: 5/15min; **sem** login obrigatório; se `req.user` existe, denormaliza email). Valida `reason` no enum; sanitiza `note` com `sanitize-html` máx ~1000 chars; resolve `group_id` por slug (`Groups.findBySlug`). Persiste via `Groups.insertReport`. Repo: funções `insertReport`, `listReports`, `updateReport` em `server/repo/groups.ts`. · ✅ sanitização validada: `<script>alert`→texto limpo, `<img onerror>`→texto limpo. `tsc` limpo, build verde.
- [x] **T10** — UI: ação "Reportar" no `GroupCard.astro` → nova ilha React `ReportButton.tsx` (`client:visible`) com modal: select de motivo (4 opções) + textarea opcional (máx 1000) + submit ao endpoint T9. CSRF: lê `xsrf_token` do cookie e envia como `x-xsrf-token` header. Sucesso/erro inline, modal fecha ao concluir. ReportButton fica fora do `<a>` do card (não navega). · ✅ `tsc` limpo, build verde.
- [x] **T11** — Admin: fila de reports. `admin.get("/reports")` (lista, filtro `?status=open|resolved|dismissed`) + `admin.patch("/reports/:id")` (status resolved/dismissed). UI: `ReportsSection` no `AdminPanel.tsx` — select de filtro, lista com nome do grupo (resolvido via map), badge de status, ações "Resolver"/"Dispensar" p/ abertas. · ✅ `tsc` limpo, build verde.

## Fatia E — Nav cross-app (R7, Bug A)
- [ ] **T12** — `modules.ts:13` já tem links; **rebuild + redeploy** dos consumidores p/ propagar o nav servido: `glossario`, `mesas`, `site`, `accounts`. Disparar `gh workflow run deploy --ref dev -f module=<mod> -f mode=deploy -f env=prod` por app. · feito quando: `ssh faren 'curl -sS https://<app>.artificiorpg.com/ | grep -c "links.artificiorpg.com"'` ≥ 1 em cada. **Aprovação nominal por deploy.**

## Validação final
- [ ] **T13** — Smoke E2E em prod e registro: home links com fotos Cloudinary reais; report ponta-a-ponta; cron `workflow_dispatch` verde; nav propagado nos 4 apps. Registrar evidência (runs/curls) na sessão + atualizar `project-state.md` e fechar `BL-LINKS-MEDIA-038`/`BL-LINKS-NAV-CROSSAPP`/`BL-LINKS-GROUP-LOGOS` no `backlog.md`.

---
### Ordem sugerida / dependências
A (T1→T2→T3→T4) é pré-requisito de B (T5 usa T2) e do cron C (T7 usa T2). D (report) é independente — pode paralelizar. E (nav) é independente, só deploy. Fechar T13 por último.

### Notas
- Grupos de WhatsApp **normalmente têm foto real** (confirmado 2026-06-21) — a heurística de "avatar genérico" é guard barato e opcional, **não** bloqueia entrega. Se a og:image vier, usa.
- WhatsApp é fonte hostil/read-only: nunca autenticar/entrar no grupo; só GET. Pipeline degrada gracioso (logo null → placeholder), nunca trava deploy/cron.
- Cada PR: rodar `pnpm --filter @artificio/links build` + lint local antes de pushar; sem `eslint-disable`/`@ts-ignore`/`continue-on-error` p/ mascarar.

---
## RESUMO DO ESTADO ATUAL (2026-06-21 ~17:00)

**Concluído (T1–T11):** Fatias A, B, C, D implementadas e validadas localmente. `tsc --noEmit` limpo, `astro build` verde em todas as etapas.

**Pendente (T12–T13):** Deploy cross-app do nav + smoke E2E em prod. T12 e T13 são operações de deploy (aprovação nominal).

**Bloqueios:**
- T4: reidratação em prod depende de deploy de T1–T3 + aprovação p/ execução
- T12: redeploy dos 4 consumidores (aprovação nominal por app)

### Escolhas de design

| Escolha | Motivo |
|---|---|
| `resolveLogo` canônica em `cloudinary.ts` | Evitar drift, 1 só definição, tag opcional p/ log contextual |
| `decodeHtmlEntities` em `og.ts` | Corrigir `&amp;` do WhatsApp; decode mínimo (6 entidades), não lib pesada |
| `runJob` (single-flight) no endpoint admin T5 | Espelha rebuild, evita concorrência, polling de status já existe |
| Cron via **crontab da VM** (decisão mantenedor 2026-06-21) | Execução parte da VM (`docker exec links-app tsx server/rehydrate-cli.ts`), sem depender de GitHub Actions/Secrets/workflow. `rehydrate-cli.ts` standalone. Workflow e endpoint cron removidos. |
| `reportLimiter` 5/15min (não publicLimiter 120/1min) | Denúncia é ação rara; rate-limit mais restritivo evita abuso |
| `xsrf_token` cookie → `x-xsrf-token` header no ReportButton | CSRF para endpoint público com usuário logado; cookie `httpOnly:false` legível via JS |
| Migration `online-safe`, sem backup | Tabela nova sem dados prévios; `ON DELETE CASCADE` limpa automático |
| ReportButton fora do `<a>` do card | Evita navegação acidental ao clicar "Reportar" |
| `sanitize-html` com `allowedTags:[]` | Remove TODO markup; mantém só texto puro |

### Arquivos modificados/criados (visão de código)

```
apps/links/
├── server/lib/og.ts                          # +decodeHtmlEntities (T1)
├── server/lib/cloudinary.ts                  # +resolveLogo canônica (T3)
├── server/lib/rehydrate-logos.ts             # NOVO — rehydrateLogos() (T2)
├── server/rehydrate-cli.ts                   # NOVO — CLI standalone (T4)
├── server/server.ts                          # 6 novas rotas + imports (T5,T7,T9,T11)
├── server/jobs.ts                            # (intocado)
├── server/repo/groups.ts                     # +insertReport,listReports,updateReport (T8-T9)
├── db/types.ts                               # +GroupReportsTable,ReportReason,ReportStatus (T8)
├── db/seed.ts                                # resolveLogo → import canônica (T3)
├── database/migration_002_group_reports.sql   # NOVO — tabela group_reports (T8)
├── src/components/ReportButton.tsx           # NOVO — ilha modal (T10)
├── src/components/GroupCard.astro            # +ReportButton + wrapper (T10)
├── src/components/admin/AdminPanel.tsx       # +RehydrateSection + ReportsSection (T6,T11)
└── package.json                              # +script "rehydrate-logos" (T5)
```

---
## SESSÃO DE REVISÕES 1 (PR #78 — em andamento)

Fixes aplicados a partir dos bots (Amazon Q, CodeQL, Codex, CodeRabbit, github-advanced-security). Documentado o que foi alterado e por quê. Sujeito a novas revisões enquanto PR aberta.

### Fixes aplicados

| # | Arquivo | Bot | Bug real? | O que foi feito |
|---|---|---|---|---|
| 1 | `ReportButton.tsx` | Amazon Q | Não (slug já é slugify) | `encodeURIComponent(slug)` — defesa em profundidade |
| 2 | `og.ts` | CodeQL | Não (WhatsApp nunca double-encode) | Ordem canônica: `&quot;/&lt;/&gt;` antes de `&amp;` |
| 3 | `server.ts` (report) | Codex | **SIM** — `reporter_email` sempre `null` | `verifyToken()` manual no cookie em vez de `req.session` (não populado sem `requireAuth`) |
| 4 | `server.ts` (CSRF) | CodeQL | Não (CSRF global existe na linha 42) | Comentário documentando corrente: `cookieParser → limiter → csrfProtection` |
| 5 | `CommunityGroups.tsx` | Codex | **SIM** — grupos da comunidade sem Reportar | `<ReportButton>` adicionado nos cards comunitários (wrapper `card-wrapper`) |
| 6 | `migration_002_group_reports.sql` | CodeRabbit | Governança | Headers `@approval`, `@dry-run`, `@rollback` |
| 7 | `rehydrate-logos.ts` | CodeRabbit | Governança | `Array.isArray(raw)` antes de `.length`/`for..of` |
| 8 | `rehydrate-logos.ts` | CodeRabbit | **SIM** — órfão Cloudinary se updateGroup falhar | Try/catch interno: `deleteLogo(stored.logo_public_id)` antes de re-throw |
| 9 | `rehydrate-cli.ts` | CodeRabbit | **SIM** — falha parcial mascarada | `exitCode = 1` se `failed > 0` (antes só se `updated === 0`) |
| 10 | `server.ts` (PATCH reports/:id) | CodeRabbit | Boa prática | Validação UUID inline (substituída pelo refactor #12) |
| 11 | `AdminPanel.tsx` (RehydrateSection) | CodeRabbit | **SIM** — UI trava em busy sem recovery | `!res.ok` → `setError` + `setBusy(false)` no pollStatus e start |
| 12 | `server.ts` (admin.param) | Refactor próprio | Boa prática (DRY) | `admin.param("id")` substitui 7 validações UUID inline; 1 definição cobre todas as rotas admin com `:id` |
| 13 | `AdminPanel.tsx` (RehydrateSection) | CodeRabbit | Boa prática (AGENTS.md) | `normalizeJobState` tipado + validação runtime de `busy`/`started` antes de React state; remove `as` cast direto |
| 14 | `AdminPanel.tsx` (RehydrateSection) | CodeRabbit | **SIM** — timer de polling sem cleanup | `useRef` + `useEffect` cleanup; `clearTimeout` no unmount evita setState em componente desmontado |
| 15 | `AdminPanel.tsx` (ReportsSection) | CodeRabbit | **SIM** — loading infinito se API retornar formato errado | `!Array.isArray` → `setReports([])` + `setError(true)`; UI mostra erro em vez de "Carregando…" eterno |
| 16 | `AdminPanel.tsx` (ReportsSection) | CodeRabbit | Não (Array.isArray já validado acima; render usa estado normalizado) | Comentário justificando `.map/.filter`: `Array.isArray` validado antes, `normalizeReport` valida cada item, render opera sobre estado tipado |
| 17 | `ReportButton.tsx` | CodeRabbit | **SIM** — modal reabre preso em "done" | `closeModal()` reseta reason/note/done/error antes de fechar; reutilizado em Cancelar, Fechar e overlay |
| 18 | `ReportButton.tsx` | CodeRabbit | Não (REASONS é const interna hardcoded, não payload externo) | Comentário justificando que REASONS é tipada e imutável — `.map` seguro |

### Débitos abertos

| ID | Origem | Escopo | Falta | Próximo passo |
|---|---|---|---|---|
| — | — | — | Nenhum débito aberto nesta revisão. | — |

#### D-LINKS-ADMIN-UUID-VALIDATION — investigação (✅ concluído)

7 rotas admin com `:id` validavam UUID inline. **Solução final:** `admin.param("id", callback)` — Express valida automaticamente antes de cada handler. 1 definição → 7 rotas cobertas. PG erro `22P02` → 400 limpo. `tsc` limpo, build verde.

### Arquivos alterados na revisão

```
apps/links/
├── server/lib/og.ts                          # Fix #2 — ordem decode entities
├── server/lib/rehydrate-logos.ts             # Fix #7, #8 — Array.isArray + orphan cleanup
├── server/rehydrate-cli.ts                   # Fix #9 — exitCode para qualquer failed
├── server/server.ts                          # Fix #3, #4, #12 — verifyToken + CSRF doc + admin.param
├── database/migration_002_group_reports.sql   # Fix #6 — headers operacionais
├── src/components/ReportButton.tsx           # Fix #1, #17 — encodeURIComponent + closeModal
├── src/components/CommunityGroups.tsx         # Fix #5 — ReportButton nos cards comunitários
├── src/components/admin/AdminPanel.tsx        # Fix #11, #13, #14 — !res.ok + normalizeJobState + timer cleanup
specs/backlog.md                               # (não alterado na revisão; débito resolvido no próprio server.ts)
```
</content>
