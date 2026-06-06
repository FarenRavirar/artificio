# Tasks — 010 Nav cross-módulo + logo

- [x] **T1** — Spec/plan/tasks 010 + diagnóstico registrado.
- [x] **T2** — Diagnóstico fechado por código (anon test ficou redundante): **R2 = bug real, não extensão.** O `brandLogoNeg.src` em `packages/ui/src/brand.ts` (e a cópia em `apps/site/src/data/brand.json`) estava **corrompido** — header PNG válido (IHDR 300×100) mas body lixo logo após IHDR (CRC IHDR mismatch, chunk seguinte overrun) → browser falha decode → `naturalWidth=0` → mostra `alt` (`⬚Artifício`). Reproduzido no preview local (não só no browser do mantenedor). Navy OK. (Anon test no AR ainda confirmaria, pois asset corrupto está deployado.)
- [x] **T3** — R1 (R4=A): `SiteHeader.astro` nav primário = `MODULES` (Portal/Glossário/Mesas/Downloads/Esferas/SRD, cross-subdomínio, zero-JS); categorias do blog → 2ª linha (`.artificio-subnav` + `SECTIONS`). `MODULES` definido em `content.ts` (espelha `defaultNavItems`; sem puxar barrel React/auth no Astro). `SiteFooter` deduplicado (importa `MODULES`).
- [x] **T4** — R2 corrigido: re-encodado `packages/ui/src/_logo_neg.png` (fonte válida 300×100 RGBA) → novo data-URI em `brand.ts`; `brand.json` regenerado via `prep`. Preview confirma `logo-neg` `naturalWidth=300` e wordmark branco visível no header dark.
- [x] **T5** — `packages/ui/src/modules.ts` `Glossario`→`Glossário` (acento). Builds de mesas (front+back) e accounts verdes (sem quebrar consumidores).
- [x] **T6** — `pnpm --filter @artificio/site build` verde; ui/mesas/accounts verdes; preview confere nav cross-módulo + subnav + logo (CA1/CA2/CA3). `pr-checks` roda no PR.
- [x] **T7** — Push + deploy autorizados e feitos (2026-06-06). `c488e77..7f2fbd1 dev` (inclui R6 da spec 009 / `2681612`). Runs verdes: `deploy-site` dispatch `27066789645` (beta), `deploy-mesas` push `27066781539` (mesasbeta), `deploy-accounts` dispatch `27066790328` (accountsbeta); `pr-checks`+`promote-dev-to-main` verdes. Smoke AR 200 (beta/mesas/accounts) + WP raiz 200 intocável. HTML servido em beta confirma nav unificado + `logo-navy`/`logo-neg` 300×100 decode OK (asset corrompido eliminado). Prod (`mesas.`/`accounts.`/raiz) segue logo velho até promote `main`.

> **010 concluída.** Nav cross-módulo unificado + logo neg corrigido, no ar nos betas.

> Deploy/push **bloqueados** até autorização explícita do mantenedor (ver plan.md notas).
