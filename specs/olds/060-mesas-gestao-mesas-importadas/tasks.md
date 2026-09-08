# Tasks — 060

- [x] T1 — `TableRepository.findById(tableId)` (sem gm scope) · feito quando: método existe, testado isoladamente, mesmo shape de retorno de `findByIdAndGm`.
- [x] T2 — `GET /api/v1/admin/tables` (lista, filtro `?status=`, `role===admin`) · feito quando: retorna mesas de qualquer status, 403 para não-admin, teste automatizado cobre draft.
- [x] T3 — `GET /api/v1/admin/tables/:id` (detalhe, sem gm scope) · feito quando: retorna mesa com `gm_id: null`, 403 para não-admin, 404 para ID inexistente.
- [x] T4 — `ConteudoSection.tsx`: trocar fonte de dados para `GET /admin/tables` · feito quando: aba de mesas lista mesas em qualquer status.
- [x] T5 — `ConteudoSection.tsx`: dropdown de filtro por status · feito quando: usuário filtra draft/active/cancelled/ended na UI.
- [x] T6 — `ConteudoSection.tsx`: remover guard que bloqueia `draft` em `handleToggleTableStatus` · feito quando: botão de publicar funciona a partir de `draft`.
- [x] T7 — `pnpm run lint` + `pnpm run build` verdes (mesas backend + frontend) · validado pelo mantenedor.
- [x] T8 — Smoke manual completo (sync draft → achar na gestão admin → publicar → confirmar no catálogo público) · validado pelo mantenedor.
- [x] T9 — Atualizar `specs/backlog.md` e `project-state.md` conforme resultado.
