# Tasks — 007 (CDX-314)

- [ ] T1 — `moduleNav` no Header · feito quando: prop `moduleNav?: NavItem[]` renderiza 2ª linha de nav (subnav) abaixo do portal; sem prop = 1 nav (retrocompat); `aria-current` ativo.
- [ ] T2 — Sticky + polish · feito quando: header sticky (top:0, z-index acima do conteúdo) com blur+shadow, fundo opaco no dark, sem cobrir conteúdo.
- [ ] T3 — Menu mobile · feito quando: abaixo do breakpoint, navs colapsam em hambúrguer acessível (aria-expanded, Esc/clique-fora, foco); itens navegáveis.
- [ ] T4 — Login copy · feito quando: botão deslogado = "Entrar com Google".
- [ ] T5 — mesas passa `moduleNav` + `currentHref` · feito quando: Início/Catálogo/Painel no subnav, ativo destacado por rota (`useLocation`).
- [ ] T6 — Remover dead code · feito quando: `SiteHeader.tsx`/`SiteFooter.tsx` removidos após grep zero-imports; build/lint verdes.
- [ ] T7 — Build + unit · feito quando: turbo build verde; testes ui (subnav/sticky/mobile) passam; CDX-312/313 intactos.
- [ ] T8 — Deploy beta + validar · feito quando: push `dev` → mesasbeta 2 navs/sticky/mobile/copy + menu/changelog/sino OK; accounts beta sem regressão. *(push/deploy só com autorização)*
- [ ] T9 — FF prod + revalidar + docs · feito quando: após beta OK e autorização, FF + deploy prod; mesas+accounts revalidados; project-state/roadmap/sessão atualizados.
