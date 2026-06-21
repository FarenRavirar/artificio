# 039 — Tasks

> Manutenção do mapa: ao fechar, **atualizar `specs/backlog.md` + `project-state.md`** (T11) e reconciliar `BL-AUDIT-033`.
> Status: remediação + correções **LOCAIS concluídas 2026-06-21, SEM commit**. Falta só T3/T12 (branch+PR, aprovação nominal) + T11 project-state.

## Baseline
- [x] **T1** — `pnpm audit --json` baseline salvo na sessão. Confirmado: 16 advisories (6H/6M/4L).
- [x] **T2** — Sessão `sessoes/26-06-21_2_sec_audit-deps.md` aberta (plano, baseline, evidência).
- [ ] **T3** — Criar branch `fix/039-sec-audit-deps` a partir de `dev` (sob autorização). *(pendente: sem commit)*

## Remediação baixo risco
- [x] **T4** (R2) — `dompurify` `^3.3.3` → `^3.4.11` em `apps/mesas/frontend/package.json`. Instalado 3.4.11.
- [x] **T5** (R1/R3/R4) — Overrides adicionados. **Descoberta:** pnpm@11.8 NÃO lê `pnpm.overrides` de `package.json` → movido para `pnpm-workspace.yaml`. `form-data>=4.0.6`, `undici>=7.28.0 <8`, `@opentelemetry/core>=2.8.0`.
- [x] **T6** — `pnpm install` + `pnpm audit`: form-data/dompurify/undici/otel zerados. `pnpm why` confirmou resolução.

## Remediação condicional (testar → reverter se quebrar)
- [x] **T7** (R5) — Override `uuid>=11.1.1`: install + build `@artificio/glossario-backend` verde + testes 22/22 (exceljs). **NÃO bloqueado** (previsão de bloqueio upstream não se confirmou).
- [x] **T8** (R5) — Override `nanoid>=5.0.9`: install + build mesas/frontend verde. **NÃO bloqueado** (`react-markdown-editor-lite` aceitou nanoid 5).
- [x] **T9** (R6) — Override `esbuild>=0.28.1`: `turbo build --force` 15/15 verde. **NÃO quebrou** build de nenhum app.

## Regressão tratada (descoberta na validação)
- [x] **T9b** — Override `undici>=7.28.0` resolveu para 8.5.0; undici 8.x removeu `lib/handler/wrap-handler.js` → jsdom 29 quebrou testes (mesas-frontend/analytics, `MODULE_NOT_FOUND`). Fix: travar `>=7.28.0 <8`; jsdom passou a usar 7.28.0 (patcheado + tem o handler).

## Validação final
- [x] **T10** (R8/R9) — `turbo run build --force` **15/15** verde; smoke DOMPurify 3.4.11 (HTML hostil → sanitizado) PASS; `pnpm audit` final **16→2** (só xlsx, →spec 034). Evidência na sessão.
- [x] **T11a** — `specs/backlog.md` atualizado: `BL-SEC-AUDIT-DEPS` = local/remediado; `BL-AUDIT-033` = absorvido por 039.
- [x] **T11b** — `project-state.md` atualizado: item 10 do "Próximo passo" + entrada de Log 2026-06-21 (audit 16→2, overrides, 2 débitos de teste resolvidos).

## Débitos de teste PRÉ-EXISTENTES (descobertos na validação, resolvidos)
- [x] **T13** (`BL-TEST-MESAS-SSO-ENV`) — Investigado: `.env` (VITE_PUBLIC_SITE_URL) vazava no modo teste. Fix: `test.env: { VITE_PUBLIC_SITE_URL:'', VITE_API_URL:'' }` em `apps/mesas/frontend/vitest.config.ts`. ssoRedirect 6/6, mesas-frontend 19/19. Anexo D1.
- [x] **T14** (`BL-TEST-SITE-MEDIA-MOCK`) — Investigado: drift de contrato spec 036 (`isConfigured()` exige 3 vars Cloudinary). Fix: helper `enableCloudinary()` (3 vars) substitui os 14 sets de var única + `afterEach` limpa as 3 em `apps/site/importer/media.test.ts`. media.test 22/22. Anexo D2.
- [x] **T15** — `turbo run test --force` **21/21 tasks verde** (monorepo inteiro). Os 2 débitos registrados no backlog como `local (resolvido, aguarda commit)`.

## Final
- [ ] **T12** — PR `fix/039-sec-audit-deps` → `dev` (sob autorização nominal). Revisão de bots tratada **só na doc**, nunca no PR.

## Definição de pronto
- [x] `pnpm audit` sem HIGH/MOD de form-data, dompurify, undici, @opentelemetry/core.
- [x] `xlsx` remetido à spec 034; `nanoid`/`uuid`/`esbuild` **eliminados** por override (não precisaram de bloqueio).
- [x] Build 15/15 + testes 21/21 + smoke DOMPurify verdes; lockfile coerente; backlog atualizado.
- [ ] Commit + branch + PR (aprovação nominal) + `project-state.md`.
