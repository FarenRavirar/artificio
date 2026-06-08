# Tasks — 004

- [x] T1 — Abrir sessão/spec CDX-308 · feito quando: `spec.md`, `plan.md`, `tasks.md` existem e sessão aponta bloqueios.
- [x] T2 — Corrigir D037 open redirect em `accounts` · feito quando: unit tests cobrem host válido, `evil.com` e lookalike.
- [x] T3 — Definir/importar `apps/mesas` no monorepo · feito quando: app existe em `apps/mesas` com build local.
- [x] T4 — Integrar UI/auth no frontend mesas · feito quando: `Header`, `Footer`, `useSession`, `redirectToLogin` funcionam.
- [x] T5 — Integrar auth no backend mesas · feito quando: rota privada valida `artificio_session` com mesmo `JWT_SECRET`.
- [x] T6 — Validar env/compose sem segredo · feito quando: `JWT_SECRET` fonte única documentada e não impressa.
- [x] T7 — Deploy mesas com aprovação · feito quando: serviço sobe sem tocar dados.
- [x] T8 — Browser E2E · login real validado pelo mantenedor; rota privada sem cookie 401; login/return para `accounts` OK; allowlist prod validada por HTTP (`evil.com` sanitizado, `mesas.` preservado). Gate D mesas fechado em 2026-06-08.
