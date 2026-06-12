# Tasks — 020

- [x] T1 — Registrar decisao de marca/paleta · **D064** (2026-06-12): laranja canonico `#FF5722` supera `#FF9457` do D040; navy `#020740` mantido. Evidencia pixel em `sessoes/26-06-12_6`.
- [x] T2 — Mapear tokens atuais por consumidor · tabela em `sessoes/26-06-12_6_ui-theme-020-tokens.md` (tokens.ts/preset.js/glossario/mesas/accounts/target).
- [ ] T3 — Definir contrato de tokens · feito quando `tokens.ts`, CSS vars e Tailwind preset alvo estiverem especificados com nomes, papeis e aliases temporarios.
- [ ] T4 — Definir checklist dark readiness · feito quando houver criterio objetivo para habilitar lua/sol por app: contraste, states, forms, modais, header/footer e mobile.
- [ ] T5 — Planejar consolidacao de `artificio_theme` · feito quando duplicacoes locais, especialmente accounts, tiverem migracao e rollback descritos.
- [ ] T6 — Especificar header/nav/actions · feito quando nav base glossario e header actions estilo mesas tiverem API proposta, mantendo dados por app.
- [ ] T7 — Especificar primitives minimas · feito quando `Button`, `Field`, `Select`, `Badge`, `Panel`, `Toolbar`, `FilterPanel`, states, modal/drawer e header action tiverem fronteira e variantes.
- [ ] T8 — Especificar recipes de pagina · feito quando `PublicSearchPage`, `CatalogPage`, `AdminWorkspacePage`, `AuthPage`, `EditorialPage`, `DetailPage` estiverem descritos como composicao, nao layout forcado.
- [ ] T9 — Definir caminho Astro/zero-JS · feito quando site tiver estrategia static-friendly sem importar React/auth no publico.
- [ ] T10 — Planejar rollout piloto · feito quando ordem accounts → glossario → mesas → site/site-admin estiver com validacao e rollback.
- [ ] T11 — Resolver paridade brand/static shell · feito quando logos/Header/Footer/site Astro tiverem import/export static ou teste de paridade contra `packages/ui`.
- [ ] T12 — Atualizar backlog de debitos · feito quando D-UX2 e D-MARCA2 apontarem para esta spec, sem spec visual paralela.
- [~] T13 — Implementar Fase B em SDD proprio/continuidade autorizada · **parcial** (`sessoes/26-06-12_6`): tokens.ts/styles.css/tailwind-preset.js com laranja canonico `#FF5722` + paridade travada por `scripts/check-token-parity.mjs`; turbo build 13/13. Falta migrar hexes locais dos consumidores.
- [ ] T14 — Implementar Fase C/D/E/F por fatias · feito quando cada consumidor migrado tiver build, smoke visual e contraste registrados.

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
- [ ] B6 — Dark readiness glossario.
- [ ] B7 — Dark readiness mesas revisado contra token canonico.
