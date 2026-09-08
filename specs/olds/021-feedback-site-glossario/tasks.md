# Tasks — 021

## Fase 0 — Contrato compartilhado (packages/ui)
- [x] T1 — Criar `packages/ui/src/feedback.ts` data-only: enum `kind`, `SubmitFeedbackPayload`, limites (espelho `DEV_FEEDBACK_LIMITS`), copy PT canônica (extraída do mesas). · ✅ sem React/auth; emite `dist/feedback.{js,d.ts}`.
- [x] T2 — Adicionar subpath export `./feedback` em `packages/ui/package.json` (molde `./brand`/`./modules`). · ✅ `pnpm turbo run build` 13/13 + parity OK.

## Fase 1 — Glossário (backend)
- [x] T3 — Migration `migration_16_dev_feedback.sql` (fluxo D059, aditiva/online-safe, header completo): tabela `public.dev_feedback` + constraints kind/status + índices + colunas triagem (archived_at/screenshot_public_id/reviewed_*) + pós-condição. · ✅
- [x] T4 — `feedbackValidator.ts` (port de `parseDevFeedbackInput`, entrada `unknown`) + teste vitest. · ✅ 8 testes verdes.
- [x] T5 — Rota pública `POST /api/feedback` (anônimo + email opt-in + rate-limit 20/15min + optionalAuth novo) + controller; insere via `db.query`; screenshot Cloudinary não-fatal (gated por `isCloudinaryConfigured`). Notificação omitida (FR-009: `user_notifications` tem enum restrito; admin vê via triagem). · ✅
- [x] T6 — Rotas admin `/api/admin/feedback`: GET (filtros status/kind/archived), PATCH (status/notas/arquivar), DELETE (limpa screenshot). Guard auth→refreshRole→admin. · ✅ build clean.

## Fase 2 — Glossário (frontend)
- [x] T7 — Port `features/dev-feedback/` (FeedbackButton+FeedbackModal+feedbackApi+diagnostics) adaptado (axios/AuthContext; copy+tipos de `@artificio/ui/feedback`; cor via `var(--artificio-brand)`); deps `react-hot-toast`+`html2canvas-pro`; `installDiagnostics()` no boot + interceptor axios captura rede ≥400; botão+Toaster no shell. · ✅ build verde.
- [x] T8 — `AdminFeedbackPage` (lista/filtro status·kind·archived/status/notas/arquivar/excluir) + rota `/admin/feedback` + link no menu admin do header. · ✅ build verde.

## Fase 3 — Site (persistência + público + admin)
- [x] T9 — **Decisão de persistência:** descoberto que `apps/site/server` TEM Postgres (`getDb()` pg/pglite, `apps/site/db`) — não é sem-DB como o T0 supunha. Decisão revista: tabela no **DB do site via migration 005** (runner próprio D039), não JSON. · ✅
- [x] T10 — `db/repo/feedback.ts` + `server/lib/feedback-validator.ts` (port `unknown` + `decodeScreenshotDataUri`) + rota pública `POST /api/feedback` no `server.ts` (sem auth, rate-limit em memória 20/15min, sessão opcional via `verifyToken`, screenshot via `storeUpload` cloudinary/local não-fatal) + admin GET/PATCH/DELETE em `admin-api.ts` (gated requireAuth+requireAdmin) + `deleteStoredMedia`. · ✅ feedback files typecheck clean; migration 005 aplica (pglite).
- [x] T11 — `FeedbackWidget.astro` island vanilla (markup+copy server-side de `@artificio/ui/feedback`; 1 script hoisted: open/close/kind/submit + screenshot `html2canvas-pro` lazy-import) + instalador de diagnóstico `is:inline` no `<head>` do `Base.astro` (buffer global console/rede) + mount no body. · ✅ build static 45 páginas verde; chunk da island + chunk lazy html2canvas em `_astro`; shell sem JS extra; `af-feedback-trigger` no HTML.
- [x] T12 — `FeedbackPage` no `apps/site-admin` (lista/filtro status·kind·archived/status/notas/arquivar/excluir) + métodos na `api.ts` + rota/nav. · ✅ build verde.

## Fase 4 — Validação e fechamento
- [x] T13 — Validação global: `pnpm turbo run build` **13/13** + `check-token-parity` OK + site static OK + vitez glossário **22/22** + `git diff --check` limpo (só avisos LF/CRLF). · ✅
- [x] T14 — Copy single-sourced: site (`FeedbackWidget.astro`) + glossário (modal/button/api/diagnostics) consomem `@artificio/ui/feedback`; validadores de backend referenciam o mesmo contrato (limites locais por segurança). mesas inalterado (FR-010 opcional). · ✅
- [x] T15 — Changelog glossário `migration_17_changelog_feedback.sql` (idempotente, `update_log`). Site = sem mecanismo de changelog público (blog), nada a registrar. project-state.md + débito D-FEEDBACK1 atualizados. · ✅ (publicar = fluxo branch→PR→dev autorizado).

## Notas
- mesas → consumir `@artificio/ui/feedback` é **opcional** (FR-010), fatia anti-drift posterior.
- Merge de feedbacks = fora de escopo (fatia posterior).
- accounts = fora de escopo.
- Sem commit/push/deploy sem aprovação nominal por ação.
