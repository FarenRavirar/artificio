# Tasks — 020

- [x] T1 — Registrar decisao de marca/paleta · **D064** (2026-06-12): laranja canonico `#FF5722` supera `#FF9457` do D040; navy `#020740` mantido. Evidencia pixel em `sessoes/26-06-12_6`.
- [x] T2 — Mapear tokens atuais por consumidor · tabela em `sessoes/26-06-12_6_ui-theme-020-tokens.md` (tokens.ts/preset.js/glossario/mesas/accounts/target).
- [ ] T3 — Definir contrato de tokens · feito quando `tokens.ts`, CSS vars e Tailwind preset alvo estiverem especificados com nomes, papeis e aliases temporarios.
- [x] T4 — Definir checklist dark readiness · **FEITO** em `dark-readiness-checklist.md` (sessao `26-06-12_7`): criterio objetivo e simetrico — contraste AA, states, forms/select/validacao, modais/drawers/toasts, header/footer/toggle, mobile, troca sem flash, evidencia + builds. Gate de fechamento explicito.
- [ ] T5 — Planejar consolidacao de `artificio_theme` · feito quando duplicacoes locais, especialmente accounts, tiverem migracao e rollback descritos.
- [ ] T6 — Especificar header/nav/actions · feito quando nav base glossario e header actions estilo mesas tiverem API proposta, mantendo dados por app.
- [ ] T7 — Especificar primitives minimas · feito quando `Button`, `Field`, `Select`, `Badge`, `Panel`, `Toolbar`, `FilterPanel`, states, modal/drawer e header action tiverem fronteira e variantes.
- [ ] T8 — Especificar recipes de pagina · feito quando `PublicSearchPage`, `CatalogPage`, `AdminWorkspacePage`, `AuthPage`, `EditorialPage`, `DetailPage` estiverem descritos como composicao, nao layout forcado.
- [ ] T9 — Definir caminho Astro/zero-JS · feito quando site tiver estrategia static-friendly sem importar React/auth no publico.
- [ ] T10 — Planejar rollout piloto · feito quando ordem accounts → glossario → mesas → site/site-admin estiver com validacao e rollback.
- [ ] T11 — Resolver paridade brand/static shell · feito quando logos/Header/Footer/site Astro tiverem import/export static ou teste de paridade contra `packages/ui`.
- [ ] T12 — Atualizar backlog de debitos · feito quando D-UX2 e D-MARCA2 apontarem para esta spec, sem spec visual paralela.
- [x] T13 — Implementar Fase B em SDD proprio/continuidade autorizada · **feito** (`sessoes/26-06-12_6`, commits `a48a518`+`d9c6d8a`): tokens.ts/styles.css/tailwind-preset.js com laranja canonico `#FF5722` + paridade travada por `scripts/check-token-parity.mjs`; consumidores puxam `var(--artificio-brand)` (zero hex/rgba laranja duplicado em codigo vivo); turbo build 13/13; betas site/mesas/glossario verificados com `#FF5722`.
- [~] T14 — Implementar Fase C/D/E/F por fatias · **parcial** (feito quando cada consumidor migrado tiver build, smoke visual e contraste registrados): Fase C/D (accounts/glossario/mesas/site consumindo tokens) feita junto da fonte unica. **lua/sol (R4) DOIS pilotos feitos LOCAL** (`sessoes/26-06-12_7`): **glossário +dark** (D065: `[data-theme]`+remap, navy `#1a2744`→`#020740`) e **mesas +light** (D066: `[data-theme="light"]`+remap das ~1873 utilities brancas/hexes, **default-dark preservado** p/ prod). Ambos: toggle no Header (variant reativo), boot, zero-flash; build verde + smoke claro/escuro/mobile + AA medido. Sem commit/deploy. Residual: telas auth-gated (E2E mantenedor). Falta: primitives (E), recipes (F).

## Corte de escopo recomendado para primeira PR futura

- Tokens e paridade `tokens.ts`/CSS vars/Tailwind.
- Accounts consumindo `@artificio/ui/theme`.
- Nenhuma migracao grande de layout.
- `ThemeToggle` ainda opt-in por app.

## Backlog derivado

- [x] B1 — Teste de paridade entre `tokens.ts`, `styles.css` e `tailwind-preset.js` · `packages/ui/scripts/check-token-parity.mjs`.
- [ ] B2 — Export static-friendly para site Astro, incluindo brand/logo/header/footer parity.
- [ ] B3 — HeaderAction/changelog/notification shell em `@artificio/ui`.
- [ ] B4 — Primitives de formulario e estado.
- [ ] B5 — Recipes de pagina documentadas.
- [~] B6 — Dark readiness glossario · **piloto feito LOCAL** (`sessoes/26-06-12_7`, D065): variante dark completa via remap `[data-theme="dark"]`, AA medido nos estados principais (hero 13.9 / muted 5.2 / input 13.9 / modal 8.84 / empty 5.18), smoke claro+escuro+mobile+modal+login. Residual: telas com dados (cards de termo/admin/forms com validacao) = E2E autenticado do mantenedor. Sem commit/deploy.
- [~] B7 — Dark readiness mesas (variante **light**) · **piloto feito LOCAL** (`sessoes/26-06-12_7`, D066): folha `[data-theme="light"]` (tokens + remap das ~1873 utilities brancas + hexes hardcoded), **default-dark preservado** (boot só vira light com escolha explícita — prod não regride). Build verde; smoke landing pública `/` claro+escuro+mobile + troca ao vivo + AA (hero 17.32 / muted 4.85). Residual: telas operacionais auth-gated (catálogo/painel/gestão/forms/modais) = E2E autenticado do mantenedor. Sem commit/deploy.
