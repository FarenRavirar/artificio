# Tasks — 010 Nav cross-módulo + logo

- [x] **T1** — Spec/plan/tasks 010 + diagnóstico registrado.
- [ ] **T2** — 🔒 Mantenedor: teste em janela anônima (logo aparece?) → decide R2 (extensão vs deploy).
- [ ] **T3** — R1: `SiteHeader.astro` usa nav cross-módulo (`defaultNavItems`); categorias do blog → 2ª linha. Decidir R4 (A `.astro` zero-JS recomendado / B island React) antes.
- [ ] **T4** — R2: se logo quebrada em anônimo, corrigir render/deploy do `@artificio/ui` (garantir build atual nos módulos); senão documentar (extensão).
- [ ] **T5** — Verificar `packages/ui/modules.ts` (`Glossario`→`Glossário`? hrefs corretos) sem quebrar mesas/accounts.
- [ ] **T6** — Build site + `pr-checks` verdes; preview confere nav+logo (CA1/CA3).
- [ ] **T7** — 🔒 Mantenedor: autorizar push + redeploy p/ ver no ar (CA2). (Inclui aplicar R6 da spec 009 pendente, se quiser, no mesmo deploy.)

> Deploy/push **bloqueados** até autorização explícita do mantenedor (ver plan.md notas).
