# Tasks — 017

## Favicon (D-INFRA1, fonte única)
- [x] T1 — `packages/ui/src/brand.ts`: `faviconV2` data-URI (16×16) + `applyFavicon()`. tsc verde.
- [x] T2 — `packages/ui/src/index.ts`: reexport `faviconV2`/`applyFavicon`.
- [x] T3 — site `Base.astro`: favicon via `import { faviconV2 }`. Verificado: dist tem `<link rel=icon>` data-URI (preview :4321).
- [x] T4 — accounts/glossário/mesas `main.tsx`: `applyFavicon()` no boot; removidos `<link href="/faviconV2.png">` dos `index.html`.
- [x] T5 — removidas as 4 cópias `public/faviconV2.png`. Glob limpo.

## Rodapé (D-UX3)
- [x] T6 — `Footer.tsx` + `SiteFooter.astro`: frase "presente" emitida. Verificado no site (1×).
- [x] T7 — glossário `LandingSection.tsx`: frase removida (vive no Footer). Badge do hero `App.tsx` MANTIDO (decisão do mantenedor).

## Toggle de tema (D-UX2)
- [x] T8 — `packages/ui/theme.tsx` (mecanismo) + `Header.tsx` prop aditiva `showThemeToggle` + CSS. tsc verde.
- [~] T9 — glossário + mesas: **adiado** (sem CSS dark; backlog futuro). Em vez disso, **D-UX1 (accounts)** entregue: ícone lua/sol na login, validado em preview (:4323).

## Validação / fechamento
- [x] T10 — build smoke verde (packages/content + packages/ui + site + accounts + glossario-fe + mesas-fe).
- [x] T11 — validação preview: site (favicon data-URI + gift 1×), accounts (favicon injetado + toggle SVG flipa light↔dark).
- [ ] T12 — [APROVAÇÃO] commit/push/PR→dev → deploy beta → smoke → promote prod → smoke cross-módulo.
