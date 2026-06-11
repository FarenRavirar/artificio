# Tasks — 016

- [ ] T1 — Auditar rotas/handlers do mesas-backend p/ padrões express-4-only (wildcard/regex em path-to-regexp, `req.query/params` reatribuídos, `app.del`/`res.json(status,obj)`/`req.param`, `express-async-errors`) · feito quando: lista de pontos de quebra na sessão.
- [ ] T2 — Bump `express`/`@types/express` → 5 em `apps/mesas/backend/package.json` + `pnpm install` · feito quando: lock converge serve-static-core p/ v5 único.
- [ ] T3 — Ajustar os pontos de T1 · feito quando: `turbo build --filter=@artificio/mesas-backend` (sem cache) verde; `upload.ts` compila.
- [ ] T4 — Testes mesas verdes (front+back, CI postgres/env dummy) · feito quando: suites passam ou falhas ambientais documentadas.
- [ ] T5 — Smoke local backend (health/upload/auth) · feito quando: rotas respondem igual.
- [ ] T6 — Grep `"express": "^4` no monorepo = 0 · feito quando: nenhuma dep express 4 restante.
- [ ] T7 — [APROVAÇÃO] deploy mesasbeta → smoke → prod · feito quando: betas/prod verdes; E004 fechado em errors.md; project-state/roadmap atualizados.
