# Tasks — 007 (CDX-314)

- [x] T1 — `moduleNav` no Header · 2ª linha de nav (subnav) + `moduleCurrentHref` highlight; sem prop = 1 nav (retrocompat).
- [x] T2 — Sticky + polish · header sticky (top:0, z-index 50, shadow); dark opaco.
- [x] T3 — Menu mobile · hambúrguer acessível (aria-expanded, Esc), navs colapsam.
- [x] T4 — Login copy · "Entrar com Google".
- [x] T5 — mesas passa `moduleNav` + `moduleCurrentHref` · Início/Catálogo/Painel, ativo por `useLocation().pathname`.
- [x] T6 — Remover dead code · `SiteHeader.tsx`/`SiteFooter.tsx` removidos (grep zero-imports); build verde.
- [x] T7 — Build + unit · turbo build 5/5; ui/mesas-frontend/accounts ok; CDX-312/313 intactos.
- [x] T8 — Deploy beta + validar · PR #8 (313+314) → `dev` → deploy beta `27040048340` verde; servido contém `artificio-subnav/menu-toggle/mobile-nav/data-sticky` + "Entrar com Google"+"Catálogo"; **validado pelo mantenedor** (2 navs/sticky/mobile/sino/changelog/menu).
- [x] T9 — FF prod + revalidar + docs · **absorvido por releases posteriores**: CDX-312/313/314 e specs 017/020 chegaram a prod; header/nav/menu seguiram evoluindo em `@artificio/ui`. Reabrir apenas com regressao nova.

> **Status 007: CONCLUÍDA/absorvida.** Follow-up documentado: unificar fonte de sessão (`@artificio/auth useSession` × mesas `useAuth`) entra em backlog futuro se voltar a doer.
