# Sessão 26-06-13_2 — D-FEEDBACK1: feedback (bug/sugestão) no site e glossário

- **Data:** 2026-06-13
- **Tipo:** SDD Completo (toca `packages/ui` + contrato compartilhado + migration glossário)
- **Módulo/Pacote:** packages/ui · apps/site · apps/site/server · apps/site-admin · apps/glossario (front/back/db)
- **Gate relacionado:** nenhum (SDD Completo por `packages/*`/contrato).
- **Spec vinculada:** `specs/021-feedback-site-glossario/` (spec.md, plan.md, tasks.md)
- **Débito:** D-FEEDBACK1 (`sessoes/26-06-12_2_debitos_ux-marca.md`)
- **Estado:** ABERTA — spec criada e confirmada; aguardando início da implementação (T1).

## Objetivo
Levar a ferramenta de **reportar bug / sugerir melhoria** do `apps/mesas` para `apps/site`
e `apps/glossario`, com experiência e linguagem iguais. accounts fora de escopo.

## Decisões do mantenedor (AskUserQuestion, 2026-06-13)
1. **Arquitetura: Híbrido B+** — port por app + contrato **data-only** compartilhado em
   `packages/ui` (`./feedback`: enum kind, tipo payload, limites, copy PT). Runtime não
   pode ser único (site público é Astro zero-JS; glossario/mesas React; 3 backends divergem).
2. **Site público: island vanilla mínima** (não quebra zero-JS D048; mesmo padrão dos
   scripts vanilla já usados — tema/TOC/Pagefind/GA4).
3. **Dados: paridade total com mesas** — console/network capture + screenshot + contexto.

## Achados de mapeamento
- mesas (referência): front React (button+modal+api+diagnostics) acoplado a useAuth/apiClient/
  ErrorTracker/toast/html2canvas; back Express **kysely** + Cloudinary não-fatal + notifyAdmins/
  logActivity; migration 125/126; admin GET/PATCH/DELETE/merge.
- glossario: SPA React + Express **pg cru** (`db.query`), DB `glossario_v2`, migration própria
  (D059, próxima = `migration_16`).
- **site/server NÃO tem Postgres** (só file/media store) → persistência do site precisa decisão
  (default proposto: store JSON/arquivo no molde media-store; confirmar no T9).
- Cloudinary = credencial por app; screenshot degrada sem ela (já é não-fatal no mesas).

## Plano de execução
Ver `specs/021-feedback-site-glossario/tasks.md` (T1–T15). Ordem: contrato `packages/ui` →
glossário (back+front) → site (persistência+island+admin) → validação/changelog/fechamento.

## Restrições
- packages/* = SDD Completo + smoke de todos consumidores; mudança é aditiva (novo subpath).
- D048 zero-JS inegociável: island não vaza JS pro shell (validar `_astro`).
- glossário migration pelo fluxo próprio (D059), não runner do mesas.
- Auth sagrado; feedback público (optionalAuth/anônimo + email opt-in).
- Sem commit/push/PR/deploy sem aprovação nominal por ação.

## Log
- 2026-06-13 — Sessão aberta. Lido T0 (project-state, débito), estudada referência mesas
  (front/back/db/validator/admin), mapeados backends de site/glossario. Recomendação A/B +
  escopo de dados levados ao mantenedor via AskUserQuestion → Híbrido B+ / island vanilla /
  paridade total. Spec 021 criada (spec/plan/tasks).
- 2026-06-13 — **T1/T2 ✅** `@artificio/ui/feedback` (data-only: enum, `SubmitFeedbackPayload`,
  `FEEDBACK_LIMITS`, `FEEDBACK_COPY` PT exata do mesas) + subpath export. turbo 13/13 + parity OK.
- 2026-06-13 — **T3–T6 ✅ glossário backend.** migration_16 (tabela `public.dev_feedback`, fluxo
  D059); `feedbackValidator` (port `unknown`, 8 testes vitest verdes); `optionalAuthMiddleware`
  novo; `POST /api/feedback` público (rate-limit 20/15min, screenshot Cloudinary não-fatal gated);
  admin `/api/admin/feedback` GET/PATCH/DELETE (auth→refreshRole→admin). dep `cloudinary` add.
  Notificação omitida (FR-009: enum `user_notifications` restrito). build backend clean.
- 2026-06-13 — **T7/T8 ✅ glossário frontend.** `features/dev-feedback/` (button+modal+api+
  diagnostics) consumindo copy/tipos do contrato; cor `var(--artificio-brand)`; deps
  `react-hot-toast`+`html2canvas-pro` (versões = mesas); diagnostics no boot + interceptor axios
  rede≥400; `AdminFeedbackPage` + rota `/admin/feedback` + link menu admin. build front verde.
- 2026-06-13 — **T9–T12 ✅ site.** Achado: `apps/site/server` TEM Postgres (`getDb()` pg/pglite,
  `apps/site/db`) — T0 supunha sem-DB. Persistência revista → migration 005 `dev_feedback` (runner
  D039), não JSON. `db/repo/feedback.ts` + `server/lib/feedback-validator.ts` (port `unknown` +
  `decodeScreenshotDataUri`); `POST /api/feedback` público no `server.ts` (rate-limit memória, sessão
  opcional `verifyToken`, screenshot via `storeUpload` + `deleteStoredMedia`); admin em `admin-api.ts`.
  Island `FeedbackWidget.astro` (markup+copy do contrato, 1 script hoisted, html2canvas lazy) +
  diagnóstico `is:inline` no `<head>` do `Base.astro`. Triagem `FeedbackPage` no `site-admin`. dep
  `html2canvas-pro`. build static 45p (shell zero-JS; island + html2canvas code-split em `_astro`).
- 2026-06-13 — **T13–T15 ✅ fechamento.** `turbo build` 13/13 + parity OK + vitest glossário 22/22 +
  `git diff --check` limpo. Copy single-sourced (site+glossário consomem `@artificio/ui/feedback`).
  Changelog glossário `migration_17`. project-state + débito D-FEEDBACK1 atualizados.
  **Estado: implementado LOCAL, SEM commit/push/deploy. Aguardando autorização para publicar.**
