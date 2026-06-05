# Tasks — 006 (CDX-312)

- [x] T1 — `logout()` em `@artificio/auth/client` · POST accounts `/api/auth/logout` (credentials include) + redirect home do módulo.
- [x] T2 — Dropdown no `@artificio/ui` Header · avatar abre menu (não navega); `userMenu` + Sair; Esc/clique-fora; aria; degrada sem `userMenu`.
- [x] T3 — Estilos dropdown (marca D040, AA).
- [x] T4 — `apps/mesas` monta `userMenu` · Perfil/Painel/Gestão(admin)/Conta(external); Sair→home.
- [x] T5 — Não quebrar accounts · Header sem `userMenu` ok.
- [x] T6 — Build + unit · turbo verde; ui/auth/mesas-frontend ok.
- [x] T7 — Deploy beta + E2E · mesasbeta dropdown OK (validado mantenedor).
- [x] T8 — Promover prod + revalidar · PR #7 → `dev` → FF `main` → deploy prod mesas+accounts verdes; menu validado em `mesas.` prod.

> **Status 006: CONCLUÍDO em produção.** Menu de conta restaurado (Perfil/Painel/Gestão/Conta/Sair). Admin via `role` do accounts SSO (promoção por SQL; melhoria futura = `ADMIN_EMAILS` allowlist no accounts p/ bootstrap do 1º admin).