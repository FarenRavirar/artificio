# 26-06-21_2 — Spec 039: auditoria e remediação de deps vulneráveis

- **Objetivo:** executar spec `039-sec-audit-deps` (remediar `pnpm audit`) com testes, sem commit.
- **App/escopo:** monorepo (raiz `pnpm-workspace.yaml` overrides + `apps/mesas/frontend`).
- **Gate:** D (higiene de segurança transversal).
- **Modo:** SDD Lite.
- **Vínculos:** `specs/039-sec-audit-deps/`, débito `BL-SEC-AUDIT-DEPS`, `BL-AUDIT-033`, spec 034 (xlsx).

## Baseline (pnpm audit 2026-06-21)
16 advisories: 6 HIGH, 6 MOD, 4 LOW.
- Runtime: xlsx 2×HIGH, form-data HIGH, dompurify MOD+LOW, nanoid MOD, uuid MOD.
- DevDeps: undici 7×, esbuild LOW (Windows dev), @opentelemetry/core MOD.

## Execução
1. **dompurify** `^3.3.3` → `^3.4.11` (dep direta `apps/mesas/frontend`). Instalado 3.4.11.
2. **pnpm.overrides** — descoberta: `pnpm@11.8` **não lê** `pnpm.overrides` em `package.json` (`[WARN] ... no longer read`). Overrides movidos para `pnpm-workspace.yaml` (novo home). Bloco final:
   ```yaml
   overrides:
     "form-data@<4.0.6": ">=4.0.6"
     "undici@<7.28.0": ">=7.28.0 <8"
     "@opentelemetry/core@<2.8.0": ">=2.8.0"
     "nanoid@>=4.0.0 <5.0.9": ">=5.0.9"
     "uuid@<11.1.1": ">=11.1.1"
     "esbuild@<0.28.1": ">=0.28.1"
   ```
3. **Regressão tratada (undici):** override inicial `>=7.28.0` resolveu undici para **8.5.0**; undici 8.x removeu `lib/handler/wrap-handler.js` → jsdom 29 (`jsdom-dispatcher.js`) quebrou com `MODULE_NOT_FOUND` nos testes de mesas-frontend/analytics. Fix: travar no 7.x patcheado → `>=7.28.0 <8`. jsdom passou a resolver undici@7.28.0 (tem o handler + patcheado). Regressão eliminada.

## Resultados
- **`pnpm audit` final: 16 → 2.** Restam só os 2 HIGH do `xlsx` (abandonado no npm em 0.18.5) → **fora de escopo, spec 034**. 0 HIGH/MOD/LOW de form-data, dompurify, undici, otel, nanoid, uuid, esbuild.
- **`turbo run build --force`: 15/15 verde.** nanoid 5 + uuid 11 + esbuild 0.28.1 **não** quebraram build (riscos R5/R6 não materializaram).
- **Testes (dep-relevantes) verdes:** glossario-backend 22✓ (uuid override OK via exceljs), mesas-backend 114✓, analytics 17✓ (undici), auth 3✓, content 6✓, ui 8✓, accounts 8✓.
- **Smoke DOMPurify 3.4.11:** input hostil (`onerror`/`<script>`/`javascript:`) → sanitizado, conteúdo seguro preservado. PASS.

## Bugs PRÉ-EXISTENTES encontrados (não causados pela spec 039)
Provados pré-existentes: stash dos arquivos de deps (`pnpm-workspace.yaml`/`package.json`/lockfile) → falha **idêntica** em ambos.

1. **`apps/mesas/frontend/src/test/ssoRedirect.test.ts` — 3 falhas.** `getMesasReturnUrl` via `getMesasPublicOrigin` prioriza `VITE_PUBLIC_SITE_URL` (que vaza do env de teste = `mesas.artificiorpg.com`) sobre `VITE_API_URL`. Os 3 testes que stubam só `VITE_API_URL` (beta) recebem URL prod. Mismatch teste×source/env.
2. **`apps/site/importer/media.test.ts` — 14 falhas.** `buildMediaMap`: mock `vi.mock` do Cloudinary não intercepta upload → retorna URL original (`artificiorpg.com/wp-content/...`) em vez de `res.cloudinary.com/demo/`; casos fatais resolvem em vez de rejeitar. Provável quebra de mock após mudanças do importer (spec 036/site). Falha em mock/teste, não em dep.

→ Registrados em `specs/backlog.md` (ver `BL-TEST-MESAS-SSO-ENV`, `BL-TEST-SITE-MEDIA-MOCK`).

### Resolução dos 2 débitos (2026-06-21, sem commit)
Investigados a fundo (causa-raiz confirmada empiricamente) e **resolvidos 1 por 1**:

1. **BL-TEST-MESAS-SSO-ENV** — fix em `apps/mesas/frontend/vitest.config.ts`: `test.env: { VITE_PUBLIC_SITE_URL:'', VITE_API_URL:'' }` zera a baseline poluída pelo `.env`; `vi.unstubAllEnvs` passa a restaurar para vazio. `ssoRedirect.test.ts` 6/6; mesas-frontend 19/19.
2. **BL-TEST-SITE-MEDIA-MOCK** — fix em `apps/site/importer/media.test.ts`: helper `enableCloudinary()` seta as 3 vars Cloudinary (contrato `isConfigured()` de `@artificio/media`), substitui os 14 sets de var única; `afterEach` limpa as 3. `media.test.ts` 22/22.

**`turbo run test --force`: 21/21 tasks verde** (monorepo inteiro limpo). Ambos os débitos passam para `local (resolvido, aguarda commit)`.

## Estado
- **Sem commit** (autorização não dada). Working tree modificado: `pnpm-workspace.yaml`, `package.json` (revertido — sem `pnpm` field), `apps/mesas/frontend/package.json`, `pnpm-lock.yaml`, specs/039, backlog, este arquivo.
- Próximo: decisão do mantenedor sobre commit/branch+PR `fix/039-sec-audit-deps`. xlsx segue spec 034. Tratar os 2 bugs de teste pré-existentes em fatias próprias.

## Backlog
- `BL-SEC-AUDIT-DEPS`: remediação local concluída (16→2, xlsx→034); aguarda commit/PR.
- `BL-AUDIT-033`: absorvido por `BL-SEC-AUDIT-DEPS`/spec 039.
- Novos: `BL-TEST-MESAS-SSO-ENV`, `BL-TEST-SITE-MEDIA-MOCK`.
