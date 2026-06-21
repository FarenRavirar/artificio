# 039 — Auditoria e remediação de dependências vulneráveis (`pnpm audit`)

- **Módulo/Pacote:** monorepo (raiz `pnpm.overrides` + `apps/mesas/frontend`); leitura em todos os apps
- **Gate relacionado:** D (sem impacto de gate; higiene de segurança transversal)
- **Modo:** SDD Lite (bump de deps + overrides; sem mudança de lógica de produto)
- **Débito:** `BL-SEC-AUDIT-DEPS` (superset de `BL-AUDIT-033`)
- **Relacionada:** spec `034-glossario-xlsx-replace` (cobre o `xlsx`, **fora de escopo aqui**)

## Problema

`pnpm audit` (2026-06-21) reporta **16 advisories** no monorepo: 6 HIGH, 6 MODERATE, 4 LOW. Nenhuma foi introduzida pela spec 038. Distribuição por origem:

### Runtime (`--prod`, 6 advisories)

| Mód | Sev | Faixa vulnerável | Patch | App(s) | Tipo dep | Vetor |
|---|---|---|---|---|---|---|
| `xlsx` | HIGH | `<0.19.3` | `>=0.19.3` | glossario/frontend | direta `^0.18.5` | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) |
| `xlsx` | HIGH | `<0.20.2` | `>=0.20.2` | glossario/frontend | direta `^0.18.5` | ReDoS (GHSA-5pgg-2g8v-p4x9) |
| `form-data` | HIGH | `<4.0.6` | `>=4.0.6` | accounts, glossario/frontend (`axios`), mesas/backend | transitiva | CRLF injection (boundary inseguro) |
| `dompurify` | MOD | `<=3.4.10` | `>=3.4.11` | mesas/frontend | direta `^3.3.3` | `ALLOWED_ATTR` pollution |
| `dompurify` | LOW | `<3.4.9` | `>=3.4.9` | mesas/frontend | direta `^3.3.3` | Trusted Types policy survives `clearConfig` |
| `nanoid` | MOD | `>=4.0.0 <5.0.9` | `>=5.0.9` | mesas/frontend (`react-markdown-editor-lite`) | transitiva | Predictable IDs em input não-inteiro |
| `uuid` | MOD | `<11.1.1` | `>=11.1.1` | glossario/backend (`exceljs`) | transitiva | Missing buffer bounds check v3/v5/v6 |

### DevDeps (10 advisories)

| Mód | Sev (n) | Faixa | Patch | Origem | Vetor resumido |
|---|---|---|---|---|---|
| `undici` | 2×HIGH, 3×MOD, 2×LOW (7) | `>=7.0.0 <7.28.0` | `>=7.28.0` | `vitest`/jsdom (todos os apps de teste) | TLS bypass, WS DoS, header injection, cross-origin routing, queue poisoning, SameSite |
| `esbuild` | LOW (1) | `>=0.27.3 <0.28.1` | `>=0.28.1` | `vite`/`vitest`/`astro`/`tsx` (quase todos) | dev-server arbitrary file read **(somente Windows, dev)** |
| `@opentelemetry/core` | MOD (1) | `<2.8.0` | `>=2.8.0` | `lighthouse` (raiz) | Unbounded memory allocation |

`xlsx@0.18.5` está **abandonado**: a última versão no npm público é a própria 0.18.5; as versões corrigidas só existem via CDN do SheetJS. Por isso o `xlsx` **não é remediável por bump/override** e tem spec própria (034) que o substitui por `read-excel-file` + `write-excel-file`. **Não tratar `xlsx` nesta spec.**

## Requisitos

1. **R1** — Eliminar `form-data` HIGH via `pnpm.overrides` → `>=4.0.6` (afeta accounts, glossario/frontend, mesas/backend).
2. **R2** — Eliminar os 2 `dompurify` (MOD+LOW) via bump da dep direta em `apps/mesas/frontend` para `^3.4.11`.
3. **R3** — Eliminar os 7 `undici` via `pnpm.overrides` → `>=7.28.0` (devDeps; afeta cadeia vitest/jsdom).
4. **R4** — Eliminar `@opentelemetry/core` MOD via `pnpm.overrides` → `>=2.8.0` (devDep lighthouse).
5. **R5** — `nanoid` (MOD) e `uuid` (MOD): tentar `pnpm.overrides` (`nanoid>=5.0.9`, `uuid>=11.1.1`); se quebrar build/runtime do consumidor (`react-markdown-editor-lite` é CJS e pode não aceitar nanoid 5 ESM; `exceljs` pina `uuid` v8), **reverter o override** e registrar bloqueio upstream com evidência. Não mascarar.
6. **R6** — `esbuild` (LOW, dev, Windows): tentar `pnpm.overrides` → `>=0.28.1`; se quebrar build de qualquer app (vite/astro pinam faixa de esbuild), reverter e registrar como bloqueado/aceito (LOW, dev-only, somente Windows). Não endurecer gate sobre falha mascarada.
7. **R7** — `xlsx` **fora de escopo** (spec 034). Documentar a remissão.
8. **R8** — Zero regressão de build: `turbo build --force` verde (13/13) e testes existentes dos apps tocados.
9. **R9** — Smoke proporcional: sanitização DOMPurify em mesas/frontend (HTML hostil → limpo) e, se `uuid`/`nanoid` overridados, fluxo do consumidor (import glossario via exceljs; editor markdown mesas).

## Critérios de aceite

- `pnpm audit` pós-fix: **0 HIGH, 0 MODERATE** atribuíveis a `form-data`, `dompurify`, `undici`, `@opentelemetry/core`.
- `xlsx` (2 HIGH) permanece listado **apenas** com remissão explícita à spec 034 na sessão/backlog.
- `nanoid`/`uuid`/`esbuild`: ou eliminados por override (audit limpo), ou revertidos com bloqueio upstream documentado (origem, versão consumidora, evidência do erro). Nenhum `eslint-disable`/skip/silenciamento.
- `turbo build --force` 13/13 verde.
- Testes dos apps tocados verdes; smoke DOMPurify mesas OK.
- `pnpm-lock.yaml` atualizado e coerente (sem deps fantasma).
- `specs/backlog.md` + `project-state.md` atualizados; `BL-AUDIT-033` reconciliado/absorvido por este item.

## Fora de escopo

- `xlsx` (SheetJS) — coberto pela spec 034.
- Atualização ampla de toolchain/Node/pnpm/imagens Docker — débito `D-DEP2`.
- Endurecer gate de CI para falhar em audit (só **depois** do verde comprovado; débito separado se desejado).
- Bumps majors não relacionados a advisory.

## Riscos

- **Override quebra build:** `vite`/`astro` pinam `esbuild`; `exceljs` pina `uuid` v8; `react-markdown-editor-lite` (CJS) pode não rodar com `nanoid` 5 (ESM-only). Mitiga: testar build+runtime por override, reverter individualmente, não em bloco.
- **Override global vaza para runtime indevido:** `pnpm.overrides` é global ao workspace; validar que a versão forçada satisfaz todos os consumidores (`pnpm why <pkg>`).
- **Falso "fechado":** audit deve rodar real pós-install; não declarar com base em lockfile diff.

---

## Anexo — débitos de teste PRÉ-EXISTENTES descobertos (não causados pela spec 039)

Durante a validação (`turbo run test`), 2 suites falham. **Provados pré-existentes**: com os arquivos de deps stashed (`pnpm-workspace.yaml`/`package.json`/`pnpm-lock.yaml`), a falha é idêntica. Nenhuma dep bumpada (dompurify/form-data/undici/nanoid/uuid/esbuild/otel) toca a lógica afetada. Investigados a fundo e confirmados empiricamente. **Fora do escopo de remediação da 039** (são bugs de teste/contrato, não vulnerabilidades), tratados em fatias próprias.

### D1 — `BL-TEST-MESAS-SSO-ENV` (3 falhas, `apps/mesas/frontend/src/test/ssoRedirect.test.ts`)

- **Sintoma:** 3 testes esperam URL beta/localhost mas recebem `https://mesas.artificiorpg.com`.
- **Causa-raiz:** `apps/mesas/frontend/.env` (criado 2026-06-18) define `VITE_PUBLIC_SITE_URL="https://mesas.artificiorpg.com"`. O Vite **carrega `.env` no modo de teste** (vitest usa o pipeline do Vite), então `import.meta.env.VITE_PUBLIC_SITE_URL` está sempre populado. `getMesasReturnUrl`→`getMesasPublicOrigin` (`src/utils/auth.ts:16`) prioriza `VITE_PUBLIC_SITE_URL` sobre `VITE_API_URL` e sobre `window.location.origin`. Os 3 testes que assumem essa var **vazia** (2 stubam só `VITE_API_URL` beta; 1 espera fallback `localhost:3000`) sempre perdem para o valor do `.env`. Os testes quebraram quando o `.env` passou a existir (18/jun), não por código.
- **Confirmação empírica:** limpar `VITE_PUBLIC_SITE_URL` nos testes beta → 2 dos 3 passam; o 3º (fallback origin) também depende da mesma poluição.
- **Fix proposto (1 ponto, não 6 edits):** neutralizar o `.env` no ambiente de teste — `vi.stubEnv('VITE_PUBLIC_SITE_URL', '')` no `src/test/setup.ts` (global), ou config `test.env` no `vitest.config.ts`, ou `.env.test` vazio. Testes que precisam da var (prod/redirect) já a setam explicitamente. SDD Lite, app isolado.
- **✅ RESOLVIDO 2026-06-21 (sem commit):** aplicado `test.env: { VITE_PUBLIC_SITE_URL: '', VITE_API_URL: '' }` em `apps/mesas/frontend/vitest.config.ts` (baseline zerada; `vi.unstubAllEnvs` restaura para vazio). `ssoRedirect.test.ts` 6/6; suite mesas-frontend 19/19 verde.

### D2 — `BL-TEST-SITE-MEDIA-MOCK` (14 falhas, `apps/site/importer/media.ts` ↔ `importer/media.test.ts`)

- **Sintoma:** `buildMediaMap` devolve a URL WP original em vez da URL Cloudinary; casos "fatais" resolvem em vez de rejeitar. `migrated=0`.
- **Causa-raiz:** **drift de contrato da spec 036** (`@artificio/media`). O gate `mediaMigrationEnabled()` = `cloudinaryEnabled() && SITE_MIGRATE_MEDIA==="true"`, e `cloudinaryEnabled = isConfigured` (importado de `@artificio/media`). O `isConfigured()` compartilhado exige **as 3** vars: `CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET` (`packages/media/src/index.ts:58`). Os 14 testes setam **só** `CLOUDINARY_CLOUD_NAME="test"` → `isConfigured()=false` → migração desligada → upload injetado (`__setUploadForTest`) nunca é chamado → URL fica a original. O teste foi escrito contra o `isConfigured` local antigo (pré-036) que exigia menos vars; ao extrair pro pacote compartilhado, o contrato endureceu e o teste não acompanhou.
- **Confirmação empírica:** setar as 3 vars (`CLOUDINARY_CLOUD_NAME`+`CLOUDINARY_API_KEY`+`CLOUDINARY_API_SECRET`) no `beforeEach`/casos → **22/22 passam**.
- **Fix proposto:** no `importer/media.test.ts`, setar as 3 vars onde hoje seta só `CLOUDINARY_CLOUD_NAME` (centralizar num helper/`beforeEach`). Alinha o teste ao contrato de `@artificio/media`. SDD Lite, app isolado.
- **✅ RESOLVIDO 2026-06-21 (sem commit):** helper `enableCloudinary()` (seta `CLOUDINARY_CLOUD_NAME`+`API_KEY`+`API_SECRET`) substitui os 14 sets de var única; `afterEach` limpa as 3. `media.test.ts` 22/22 verde.

> Ambos registrados em `specs/backlog.md` (`BL-TEST-MESAS-SSO-ENV`, `BL-TEST-SITE-MEDIA-MOCK`) e em `sessoes/26-06-21_2_sec_audit-deps.md`.
