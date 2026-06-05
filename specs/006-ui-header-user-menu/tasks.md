# Tasks — 006 (CDX-312)

- [ ] T1 — `logout()` em `@artificio/auth/client` · feito quando: chama `POST {accountsOrigin}/api/auth/logout` (credentials include) + redirect; unit test cobre endpoint+redirect.
- [ ] T2 — Dropdown no `@artificio/ui` Header · feito quando: avatar logado é botão que abre menu (não navega); renderiza `userMenu` + Sair; fecha com Esc/clique-fora; `aria-haspopup/expanded`; degrada sem `userMenu` (Conta+Sair).
- [ ] T3 — Estilos dropdown (marca D040, AA) · feito quando: menu segue paleta/contraste; sem regressão visual no header.
- [ ] T4 — `apps/mesas` monta `userMenu` · feito quando: Perfil/Painel/Gestão(admin)/Conta(external) passados ao Header; Sair→home do módulo; rotas linkadas.
- [ ] T5 — Não quebrar accounts · feito quando: Header em `accounts` (sem `userMenu`) mostra Conta+Sair, sem erro.
- [ ] T6 — Build + unit · feito quando: turbo build verde; testes ui/auth passam.
- [ ] T7 — Deploy beta + E2E · feito quando: push `dev` → `mesasbeta.` avatar abre dropdown; itens corretos; Gestão só admin; Conta→accounts; Sair limpa sessão + cai na home + rota privada 401.
- [ ] T8 — Promover prod (FF) + revalidar · feito quando: após beta OK, `promote-prod-fast-forward`; `mesas.` e `accounts.` revalidados (dropdown/logout/marca); doc + sessão atualizados.
