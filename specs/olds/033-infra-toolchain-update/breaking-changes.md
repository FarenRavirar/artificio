# Breaking changes por major — Spec 033 (T5b)

> Investigação read-only (Claude, 2026-06-18). Mapeia, por dep com major bump, o que muda
> e **quais arquivos reais** do monorepo são impactados (rg/grep). Base da migração das Fases 3/4/4B.
> NÃO executa migração — especifica. Cada item: mudança · uso real (arquivos) · impacto no nosso código · ação · teste · rollback.
>
> Legenda de risco no NOSSO código: 🟢 nenhum/ínfimo · 🟡 ajuste localizado · 🔴 mudança estrutural.

---

## Resumo executivo

| Dep | De → Para | Risco nosso | Por quê |
|---|---|---|---|
| express-rate-limit | 7.5.1 → 8.5.2 | 🟢 | só `max`+`message` string; sem `keyGenerator`/store custom |
| dotenv | 16.4.x → 17.4.2 | 🟢 | só `config()`/`import 'dotenv/config'`; assinatura intacta |
| kysely | 0.28 → 0.29 | 🔴 | **ESM-only** (sem CJS); só mesas+accounts; bloqueio = jest do mesas → migrar p/ vitest (D078) |
| multer | 2.1 → 2.2 | 🟢 | 2 arquivos; minor sem breaking |
| lucide-react | 0.363 → 1.21 (glossario) | 🟡 | 18 arquivos; confirmar nomes de ícones |
| zod | 3 → 4 | 🟢 | **sem** `.email()`/`errorMap`; só `.url()` (segue válido) |
| typescript | 5.x → 6.0.3 | 🟡 | 18 tsconfigs; checagem mais estrita |
| vite | 5/6 → 8.0.16 | 🟡 | 4 configs; `@vitejs/plugin-react` precisa subir |
| tailwindcss | 3 → 4 (glossario) | 🔴 | CSS-first; config.ts→`@theme`; mesas/site já v4 |
| eslint | 8 → flat 10 (glossario) | 🔴 | **glossario NÃO tem config nenhum hoje** (ver achado) |
| astro | 5 → 6 (site) | 🟡 | config mínima; revisitar D054 |

---

## 1. express-rate-limit 7.5.1 → 8.5.2 🟢

**Mudança 7→8:** opção `max` renomeada para `limit` (`max` segue como alias deprecado, ainda funciona). `keyGenerator` custom deve normalizar IPv6 (default já normaliza). Interface de `Store` mudou (só afeta store custom). `message` string segue aceita.

**Uso real:**
- `apps/mesas/backend/src/middleware/rateLimit.ts` — 4 limiters (`publicRateLimiter`, `globalRateLimiter`, `authRateLimiter`, `strictRateLimiter`); todos usam `max:` + `message:` string + `standardHeaders/legacyHeaders`. Tem shim `asExpress4Handler` (linha 4) — **removível pós-Express 5**.
- `apps/glossario/backend/src/routes/feedbackRoutes.ts`, `migrationRoutes.ts` — usa `rateLimit` direto (já Express 5).

**Impacto:** nenhum custom store, nenhum `keyGenerator`. `max` funciona com warning de deprecação.

**Ação:** (T26a) bump; opcional renomear `max:`→`limit:` (4 ocorrências mesas + as do glossario) para zerar warning; remover `asExpress4Handler` (T15b). `message` string OK — não mexer.

**Teste:** T18 (testes de rate-limit), `tsc --noEmit` mesas+glossario backend.
**Rollback:** reverter lockfile + package.json.

---

## 2. dotenv 16.4.x → 17.4.2 🟢

**Mudança 16→17:** passa a imprimir dica/tip no stderr no boot (pode silenciar com `DOTENV_CONFIG_QUIET=true` ou `{ quiet: true }`). `config()` e `import 'dotenv/config'` mantêm assinatura e retorno.

**Uso real (só `config()` sem args ou side-effect import):**
- `apps/mesas/backend/src/{server.ts:40, db/index.ts:6, db/prod.ts:6, scripts/syncDiscordChannels.ts}`
- `apps/glossario/backend/src/{index.ts:21, config/database.ts:4}`
- `apps/site/{server/server.ts:3, db/connection.ts:4}` (`import "dotenv/config"`)

**Impacto:** zero em comportamento. Só ruído de log no boot.

**Ação:** (T26b) bump. Opcional `DOTENV_CONFIG_QUIET=true` no env dos containers para suprimir banner. Sem mudança de código.
**Teste:** boot backend mesas/glossario/site carrega `.env`; build.
**Rollback:** lockfile.

---

## 3. kysely 0.28 → 0.29 🔴 (re-investigado 2026-06-19)

**Mudança real (release 0.29.0 — https://github.com/kysely-org/kysely/releases/tag/v0.29.0):**
- **ESM-only:** deixou de shipar CommonJS. `dist/esm/` movido p/ `dist/`. `package.json` 0.29 só tem `exports.import` (0.28.17 ainda era dual: `import`+`require`). Runtime CJS depende de `require(esm)` (Node 22.12+/24 unflagged → mesas em `node:24-alpine` OK).
- target de build → `es2023`; TS mínimo → 5.4 (mesas `^5.4.5`, accounts `5.9.3` OK).
- `sql.value`/`sql.literal` removidos → `sql.val`/`sql.lit`. **Não usamos** (zero match no código).
- migration exports movidos p/ `kysely/migration`. **Não usamos** (sem `Migrator`/`FileMigrationProvider`).

**Uso real:** só `apps/mesas/backend` (25 arquivos src) + `apps/accounts`. glossario/site usam `pg` direto (não kysely). accounts não tem teste importando kysely.

**Impacto verdadeiro = ferramenta de teste, não código:**
- accounts + glossario-backend já usam **vitest** (ESM nativo) → 0.29 funciona sem mexer.
- mesas-backend é o **único em jest+ts-jest**; ts-jest só transpila `.ts`, não o `.js` ESM do kysely em `node_modules` → `Jest failed to parse`. Foi o que reverteu o T25c.

**Decisão (D078):** unificar kysely em `^0.29.2` e **migrar mesas-backend de jest → vitest** (elimina a exceção de runner; padroniza o monorepo num só test runner). Resolve `BL-KYSELY-029-ESM`. Em conjunto, adotar **lazy db Proxy** (Option 2 / T28b) em `db/index.ts` removendo o hack `jest.setup.ts`+dummy `DATABASE_URL`.

**Ação:** T28c (vitest mesas) + T28d (lazy db). Bump kysely `^0.29.2` em mesas+accounts.
**Teste:** `vitest run` mesas 16/16; `tsc --noEmit` 0; `turbo build`; deploy beta mesas (smoke).
**Rollback:** lockfile + `git checkout` (1 arquivo db/index.ts; config de teste).

---

## 4. multer 2.1 → 2.2 🟡→🟢

**Mudança:** minor; sem breaking documentado.
**Uso real:** `apps/site/server/admin-api.ts`, `apps/mesas/backend/src/routes/upload.ts`.
**Ação:** (T25d) bump; build + teste de upload se houver.
**Rollback:** lockfile.

---

## 5. lucide-react 0.363 → 1.21 (glossario) 🟡

**Mudança 0.x→1.x:** estável de API de ícones; alguns nomes de ícone renomeados/removidos entre versões. Tree-shaking igual.
**Uso real:** 18 arquivos em `apps/glossario/frontend/src/**` (pages + components: `GlossarioHeader`, `SearchBar`, `ResultCard`, `Admin*Page`, etc.).
**Impacto:** risco = ícone importado por nome que sumiu/renomeou → erro de build.
**Ação:** (T25h cobre mesas; glossario = `BL-033-LUCIDE-1X-GLOSSARIO` se sair dos minor) bump; `tsc`/build glossario-frontend; varrer imports `from 'lucide-react'` por nome inexistente.
**Teste:** build glossario-frontend.
**Rollback:** lockfile.

---

## 6. zod 3 → 4 (^4.4.3) 🟢

**Mudança 3→4:** `z.string().url()`/`.email()` deprecated → `z.url()`/`z.email()` nativos. `.parse/.safeParse` iguais. `errorMap`→`error` param (não usado).

**Uso real (rg `z.string().url` — 7 ocorrências, 3 arquivos):**
- `apps/accounts/src/env.ts:6,7,13` — `z.string().url()` (3×, sem mensagem custom)
- `apps/mesas/backend/src/validators/tableValidators.ts:28` — `z.string().url('URL do Discord inválida')` (com mensagem)
- `apps/mesas/backend/src/validators/tableValidators.ts:87,94` — `z.string().url().nullable().optional()` (2×)
- `apps/mesas/frontend/src/schemas/profileSchemas.ts:48` — `z.string().url().safeParse(val)` dentro de `.refine()`

**Achado:** **zero** `.email()`, `errorMap`, `invalid_type_error`, `required_error` no código.

**Substituição:** `z.string().url(...)` → `z.url(...)` (API: `z.url()`, `z.url('msg')`, `z.url({ message: 'msg' })`). `.nullable()`, `.optional()`, `.default()`, `.safeParse()` compatíveis.

**Ação:** (T61) bump config+accounts→`^4.4.3`; substituir 7 ocorrências.
**Teste:** `tsc --noEmit` accounts+mensas; `turbo build`; `pnpm why zod`=só `4.4.3`.
**Rollback:** `git tag pre-033-f4b-zod` + lockfile.

---

## 7. typescript 5.x → 6.0.3 🟡

**Mudança:** checagem mais estrita; possível remoção de flags legadas no `tsconfig`; defaults de `lib`/`moduleResolution`. Peer trava: `typescript-eslint@8.61.1` aceita TS `<6.1.0` → **não subir além de 6.0.x**.

**Uso real:** 18 `tsconfig*.json` versionados (root `tsconfig.base.json` + `packages/config/tsconfig.base.json` + cada app/pacote). TS em TODOS os manifests.

**Impacto:** erros de checagem novos pontuais; flags depreciadas a remover.
**Ação:** (T62) bump todos→`6.0.3`; revisar cada `tsconfig*.json` por flag removida; `turbo build --force` 13/13; corrigir/registrar erro a erro.
**Teste:** build 13/13 + `pnpm lint` + vitests.
**Rollback:** `git tag pre-033-f4b-ts` + lockfile.

---

## 8. vite 5/6 → 8.0.16 🟡 (investigado 2026-06-19)

**Mudança:** Node mínimo sobe (Node 24 OK); `build.target` default mais novo; plugins precisam de versão compatível. `@vitejs/plugin-react` v4 incompatível com Vite 8 → bump obrigatório para `^6.0.2` (plugin-react 6 exige Vite 8).

**Versões por app (lockfile + manifesto, 2026-06-19):**

| App/Pacote | Vite (lockfile) | Manifesto | Plugin-react (lockfile) | Manifesto |
|---|---|---|---|---|
| `accounts` | 6.4.3 | `^6.3.5` | 4.5.2 | `^4.5.2` |
| `mesas-frontend` | 8.0.16 | `^8.0.1` | 6.0.1 | `^6.0.1` |
| `site-admin` | 8.0.16 | `^8.0.16` | 6.0.2 | `^6.0.2` |
| `ui` | 6.4.3 | `^6.3.5` | 4.5.2 | `^4.5.2` |
| `glossario-frontend` | 5.4.21 | `^5.2.0` | 4.2.1 | `^4.2.1` |

**Configs (4 arquivos):**

| Config | Plugin-react | build.target | Outros |
|---|---|---|---|
| `apps/accounts/vite.config.ts` | `react()` | (default) | `root:"frontend"`, `outDir` |
| `apps/mesas/frontend/vite.config.ts` | `react()` | (default) | `tailwindcss()`, `manualChunks`, `chunkSizeWarningLimit` |
| `apps/site-admin/vite.config.ts` | `react()` | (default) | `base:"/admin/"`, `proxy` dev |
| `packages/ui` | — | — | **Sem `vite.config`** — vite usado só no script `preview`; build é `tsc` |

**Build target:** Nenhuma config especifica `build.target` → usa default. Vite 6 default `modules` (ES2015+), Vite 8 default `modules` (browserslist-to-esbuild). Compatível sem ajuste.

**Impacto:** configs simples; risco = plugin-react v4 (accounts/ui/glossario) incompatível com Vite 8 → bump obrigatório para `^6.0.2`. `@vitejs/plugin-react@6.0.2` é a última release.
**Ação:** (T63 accounts+ui+mesas; T64a glossario) bump Vite→`^8.0.16` + `@vitejs/plugin-react`→`^6.0.2` nos manifests; site-admin sem alteração.
**Teste:** build accounts/ui/mesas-frontend/site-admin + `ui test` 8/8; diff de bundle vs baseline.
**Rollback:** `git tag pre-033-f4b-vite` + lockfile.

**Resultado T63 (2026-06-19):** ✅ migração concluída. Vite `8.0.16` único (accounts, mesas-frontend, site-admin, ui); `@vitejs/plugin-react` `6.0.2` único (accounts, mesas-frontend, site-admin, ui). `turbo build --force` 13/13 verde; `@artificio/ui test` 8/8. glossario-frontend permanece em Vite 5/plugin-react 4 → T64a. Builds: accounts 4.3/203.9 KB (estável), mesas-frontend 208.2/1360.4 KB (Vite 8 usa rolldown nativo), site-admin 223.4/1749.6 KB (estável).

**Investigação T64a (glossario Vite, 2026-06-19):** `vite.config.ts` simples (`react()` + alias `@`, 13 linhas) — zero API deprecated, zero `build.target` custom, compatível com Vite 8 sem ajuste. Precedente accounts (T63, mesma config) migrou sem alteração de código.

**Resultado T64a (2026-06-19):** ✅ glossario-frontend Vite `^5.2.0`→`^8.0.16` + plugin-react `^4.2.1`→`^6.0.2` concluído. Config sem alteração (só adicionado plugin `@tailwindcss/vite`; 13→15 linhas). Vite `8.0.16` unificado nos 5 apps (accounts, glossario, mesas-frontend, site-admin, ui). `@vitejs/plugin-react` `6.0.2` unificado nos 5 apps. Build ✅ (vite 8, 982ms, 30 chunks, CSS 61.2 KB). `turbo build --force` 13/13 verde.

**⚠️ ARMADILHA — `apps/site` (Astro) NÃO usa vite 8 (2026-06-19, fix PR dependabot #73):**
- **Sintoma:** `@artificio/site#build` falha com `[@tailwindcss/vite:generate:build] Missing field 'tsconfigPaths' on BindingViteResolvePluginConfig.resolveOptions` (stack: rolldown@1.0.3 → vite@8 oxcResolvePlugin → @tailwindcss/vite). Reproduzível e determinístico (não flaky).
- **Causa-raiz:** `apps/site` é **Astro 6.4.8**, que usa **vite ^7.3.2** internamente — Astro 6 NÃO é rolldown/vite 8. Mas o site usa `@tailwindcss/vite`, que importa `vite` como peer. Como `apps/site` não declarava `vite`, a resolução dependia da topology de hoisting do lockfile: quando o lock muda (ex.: regen do dependabot), `@tailwindcss/vite` pode resolver o **vite@8 hoisted** (das SPAs React) em vez do vite@7 do Astro. vite@8 (rolldown 1.0.3) tem bug latente no `oxcResolvePlugin` que rejeita config sem `tsconfigPaths`.
- **Por que não dá pra "subir versão":** `@tailwindcss/vite` (4.3.1) e `vite` (8.0.16) já são latest. `rolldown` latest (1.1.2) é **API-incompatível** com vite@8.0.16 (remove `viteWasmFallbackPlugin`) — override de rolldown quebra o build das SPAs.
- **FIX (persistente):** declarar `vite: ^7.3.2` em `apps/site/package.json` devDeps (mesma faixa do Astro). `@tailwindcss/vite` do site passa a resolver vite@7.3.5 deterministicamente; `^7` capa <8, então dependabot não pode driftar p/ vite 8 (que quebraria o Astro de qualquer jeito). SPAs React seguem vite@8.0.16. **Vite 8 é APENAS das SPAs React (accounts, mesas-frontend, glossario-frontend, site-admin, ui); o site Astro é vite 7 por design.** Validado: site build ✅, `turbo build --force` 13/13, `pnpm@11.8.0 --frozen-lockfile` ✅. Diff: `apps/site/package.json` +1 linha, `pnpm-lock.yaml` +3.



---

## 9. tailwindcss 3 → 4 (glossario) 🔴

**Mudança (CSS-first):** `tailwind.config.{ts,js}` → `@theme` no CSS; `postcss.config.js` plugin → `@tailwindcss/postcss` (ou `@tailwindcss/vite`); `@tailwind base/components/utilities` → `@import "tailwindcss"`; `content` autodetectado.

**Uso real:**
- `apps/glossario/frontend/tailwind.config.ts` — v3, `darkMode:['selector','[data-theme="dark"]']`, custom colors (`azul-escuro #1B2A4A`, `laranja #FF5722`, `branco`, `cinza-fundo`, `cinza-texto`, `azul-medio`), `fontFamily.sans:Inter`.
- `apps/glossario/frontend/postcss.config.js` (v3 + autoprefixer)
- `apps/mesas/frontend` e `apps/site` — **já v4** (`@tailwindcss/vite`; `apps/site/astro.config.mjs:4,13` usa `@tailwindcss/vite`). Só bump 4.2→4.3 (minor, T24e/T64b).
  - **Resultado T64b (2026-06-19):** ✅ bump 4.3.0→4.3.1 em mesas-frontend (3 bumps: `tailwindcss`, `@tailwindcss/postcss`, `@tailwindcss/vite`) + site (2 bumps: `tailwindcss`, `@tailwindcss/vite`). `turbo build` 13/13 verde; mesas-frontend 1530.9 KB CSS+JS, site 46 pages OK. Patch release: bugfixes + CSS cosmetica (`calc(var(--spacing)*0)`→`0`, `calc(var(--spacing)*1)`→`var(--spacing)`); sem breaking, sem migração de config. glossario-frontend 3.4.19 → T64a.

**Impacto:** glossario = migração estrutural. Custom colors viram `@theme { --color-azul-escuro:#1B2A4A; ... }`; `darkMode selector` → `@custom-variant dark (&:where([data-theme="dark"] *))`; remap dark do D065 (folha `[data-theme="dark"] .bg-white/...`) **precisa continuar funcionando** — validar visualmente.
**Ação:** (T64a) `npx @tailwindcss/upgrade` + revisar diff; migrar config→`@theme`; trocar postcss→`@tailwindcss/postcss`; `@tailwind`→`@import`.
**Teste:** build glossario-frontend; smoke visual público+admin (estilos íntegros, dark D065 intacto); diff bundle CSS.
**Rollback:** `git tag pre-033-f4b-glossario` + cópia de `tailwind.config.ts`/`postcss.config.js` em `artifacts/033/`.

**CORREÇÃO (investigação T64a, 2026-06-19):** a ação diz "postcss.config.js → @tailwindcss/postcss". **ERRADO para Vite.** Glossario-frontend usa Vite → o correto é **deletar** `postcss.config.js` e usar plugin `@tailwindcss/vite` no `vite.config.ts` (como mesas-frontend/site). `@tailwindcss/postcss` é para projetos sem Vite. `autoprefixer` e `postcss` devDeps viram desnecessários (Tailwind v4 inclui autoprefixer; `@tailwindcss/vite` dispensa postcss standalone). 0 usos de `@apply`, 0 classes utilitárias Tailwind nativas — componentes usam CSS vars de `@artificio/ui` → baixo risco de quebra visual. 31 arquivos fonte.

**Resultado T64a (2026-06-19):** ✅ migração Tailwind 3→4 concluída. Removidos `postcss.config.js` + `tailwind.config.ts`. `index.css`: `@import 'tailwindcss'` + `@theme` (6 cores: azul-escuro, laranja, branco, cinza-fundo, cinza-texto, azul-medio) + `@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *))`. `@tailwindcss/vite` adicionado ao `vite.config.ts`. `autoprefixer`+`postcss` devDeps removidos. Tailwind `4.3.1` unificado (glossario, mesas-frontend, site). Build ✅ CSS 61.2 KB. **Fix pós-migração:** `--font-family-sans` → `--font-sans` (token Tailwind v4 correto; commit `315d483`). Dark mode D065 preservado.

---

## 10. eslint 8 → flat 10 (glossario) 🔴 — ⚠️ ACHADO

**ACHADO (contradiz tasks.md T64a):** o plano diz "glossario ainda em `.eslintrc` legado". **Realidade:** `apps/glossario/frontend` **não tem NENHUM config ESLint** — sem `.eslintrc*`, sem `eslint.config.js` (glob + `ls` confirmam). O script `lint` é `eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0`. Com ESLint 8 e sem config → `eslint` aborta com "No ESLint configuration found". Ou seja, **o lint do glossario-frontend provavelmente nunca rodou verde** (ou nunca foi executado no CI). → registrar débito.

**Deps atuais (glossario-frontend):** `eslint ^8.57.0`, `@typescript-eslint/{eslint-plugin,parser} ^7.2.0`, `eslint-plugin-react-hooks ^4.6.0`, `eslint-plugin-react-refresh ^0.4.6`. `--ext` flag é removido no flat config (ESLint 9+).

**Espelho para migração (já flat, ESLint 9):** `apps/mesas/frontend/eslint.config.js` e `packages/config/eslint.config.js`:
```
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
export default defineConfig([ globalIgnores(['dist']), { files:['**/*.{ts,tsx}'], extends:[js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite], languageOptions:{ ecmaVersion:2020, globals:globals.browser } } ])
```

**Ação:** (T64a) criar `apps/glossario/frontend/eslint.config.js` espelhando mesas; trocar deps: `eslint ^8.57`→`^10.5.0`, `@typescript-eslint/{eslint-plugin,parser}`→`typescript-eslint ^8.61.1`, `react-hooks ^4.6.0`→`^7.1.1`, `react-refresh ^0.4.6`→`^0.5.3`; adicionar `@eslint/js ^10.0.1` + `globals ^17.6.0`; remover `--ext ts,tsx` do script lint.
**Teste:** `pnpm --filter @artificio/glossario-frontend lint` roda e termina (sem "no config"); sem erro novo vs baseline.
**Rollback:** `git tag pre-033-f4b-glossario` + lockfile.
**Débito a abrir:** `BL-033-GLOSSARIO-LINT-NEVER-RAN` — lint do glossario-frontend sem config; confirmar se CI o ignora.

**Investigação T64a (2026-06-19):** versões verificadas no registry: eslint 10.5.0 ⬆️, typescript-eslint 8.61.1 ⬆️ (latest stable; sem 8.61.2 release), react-hooks 7.1.1 ⬆️ (não v5 como dizia breaking-changes), react-refresh 0.5.3 ⬆️, @eslint/js 10.0.1 ⬆️, globals 17.6.0 ⬆️. Todos com peer eslint `^10` ✅. typescript-eslint peer TS `<6.1.0` compatível com `~6.0.3` ✅. O template `eslint.config.js` do mesas (23 linhas) é copiável verbatim (mesma estrutura TS+React).

**Resultado T64a (2026-06-19):** ✅ migração concluída. `eslint.config.js` flat criado (23 linhas, espelho mesas-frontend: `defineConfig` + `globalIgnores(['dist'])` + `tseslint.configs.recommended` + `reactHooks.configs.flat.recommended` + `reactRefresh.configs.vite`). Deps unificados: `eslint` 10.5.0, `typescript-eslint` 8.61.1 (substitui `@typescript-eslint/{eslint-plugin,parser}` v7), `react-hooks` 7.1.1, `react-refresh` 0.5.3, +`@eslint/js` 10.0.1, `globals` 17.6.0. Script lint: removido `--ext ts,tsx` (flat config ignora). **Lint AGORA RODA** (antes abortava "No ESLint configuration found"). **52 problemas pré-existentes** (50 erros + 2 warnings): `set-state-in-effect`, `static-components`, `preserve-caught-error`, `no-explicit-any`, `no-unused-vars`, `react-refresh/only-export-components` — regras novas do ESLint 10 + código antigo; correção em T66. Revisor amazon-q alegou falso-positivo (`defineConfig`/`globalIgnores` inexistentes em `eslint/config`) — verificado com `node -e "import('eslint/config')"` retornou ambos; `pnpm lint` roda sem erro de módulo.

---

## 11. eslint 9 → 10 (root + mesas-frontend) 🟡 — T65

**Fonte canônica da investigação:** `tasks.md` T65 + `sessoes/26-06-18_3_infra_toolchain-update-spec.md` (T65).

**Investigação T65 (2026-06-19):** root em eslint `^9.28.0`/typescript-eslint `^8.33.1`; mesas-frontend em eslint `^9.39.4`/typescript-eslint `^8.57.0`/react-hooks `^7.0.1`/react-refresh `^0.5.2`. Ambos já flat config ✅.

**Target:** eslint `^10.5.0`, typescript-eslint `^8.61.1`, @eslint/js `^10.0.1`, react-hooks `^7.1.1`, react-refresh `^0.5.3`, globals `^17.6.0`.

**Peer deps (verificados via `npm view`, revisão 2026-06-19):** todos compatíveis ✅. typescript-eslint 8.61.1 peer eslint `^8.57||^9||^10` ✅ + TS `>=4.8.4 <6.1.0` → TS atual `6.0.3` ✅. react-hooks 7.1.1 peer eslint até `^10` ✅. eslint 10.5.0 engine `^20.19||^22.13||>=24` → Node `26.3.0` ✅. **jiti** = peer **OPCIONAL** (`peerDependenciesMeta.jiti.optional = true`) → pnpm NÃO warna; jiti só serve p/ config `.ts`; nossos configs são `.js` → irrelevante, **não adicionar**.

**Breaking changes ESLint 9→10 impactantes:**

1. **3 novas regras em `eslint:recommended`:** `no-unassigned-vars`, `no-useless-assignment`, `preserve-caught-error`. Ambos configs (root `packages/config/eslint.config.js` e `mesas-frontend/eslint.config.js`) usam `js.configs.recommended` → **novos erros esperados**.

2. **JSX reference tracking:** `<Component>` vira referência. Pode reduzir falsos-positivos de `no-unused-vars` no mesas-frontend (hoje um `<Card>` não era reconhecido como uso do `import Card`).

3. **`jiti` peer dep — NÃO é risco (revisão 2026-06-19):** eslint 10.5.0 lista `jiti: *` mas marcado `optional` em `peerDependenciesMeta` → pnpm não warna por ausência. Só usado p/ config `.ts`/`.mts`; configs do projeto são `.js`. **Não adicionar jiti.**

4. **Config lookup cwd→file-based:** cada package tem `eslint.config.js` na raiz, sem impacto.

5. **`eslint/config` (`defineConfig`/`globalIgnores`):** mantidos no ESLint 10, compatível.

6. **`eslint-env` comments:** zero ocorrências no código (rg confirmou).

7. **`no-shadow-restricted-names`** reporta `globalThis`: improvável impacto.

**Configs afetados:**
- `packages/config/eslint.config.js` (19 linhas) — sem deps próprios, depende do eslint hoisted do root.
- `apps/mesas/frontend/eslint.config.js` (23 linhas) — `defineConfig` + `globalIgnores`.

**Baseline lint pré-T65:**
- `turbo run lint` falha (3 packages sem config: auth/content/analytics — débito BL-033 pré-existente).
- mesas-frontend: **29 errors + 1 warning** (`react-hooks/set-state-in-effect` + `immutability` + `exhaustive-deps`).

**Verificação da investigação (revisão 2026-06-19 — testada):**
- Versões atuais root/mesas confirmadas em `package.json` ✅.
- Target versions todas existem (latest npm): eslint 10.5.0, @eslint/js 10.0.1, typescript-eslint 8.61.1, react-hooks 7.1.1, react-refresh 0.5.3, globals 17.6.0 ✅.
- Ambos configs usam `js.configs.recommended` (root array; mesas `defineConfig`/`globalIgnores`) ✅.
- `eslint-env`: zero ocorrências (grep) ✅. `jiti`: ausente do workspace ✅ (e irrelevante, ver ponto 3).
- Baseline mesas-frontend reconfirmado: **29 errors + 1 warning** (`✖ 30 problems`) ✅.
- **Único risco real = delta das 3 regras novas** do ponto 1. Nenhum risco de versão/peer (tudo verde).

**Ação (T65 migração):**
1. Bump root: `eslint ^10.5.0`, `@eslint/js ^10.0.1`, `typescript-eslint ^8.61.1`.
2. Bump mesas-frontend: idem + `eslint-plugin-react-hooks ^7.1.1`, `eslint-plugin-react-refresh ^0.5.3`, `globals ^17.6.0`.
3. `packages/config`: sem edição (hoisting). **Não** adicionar jiti.
4. `pnpm install`; confirmar zero erro de peer.
5. `pnpm why eslint`=`10.5.0` / `@eslint/js`=`10.0.1` / `typescript-eslint`=`8.61.1` único cada.
6. Lint **por pacote** (não turbo agregado, que cai por BL-033): `pnpm --filter @artificio/config lint` + mesas `eslint .`. Registrar delta vs baseline (mesas 29+1).
7. Triar erros das 3 regras novas: corrigir mínimo agora ou virar débito BL-033 documentado — nunca fechar escondendo regressão.

**Feito quando:** `pnpm why eslint`=`10.5.0` único; lint roda; delta documentado.

**Resultado T65 (2026-06-19):** ✅ migração executada. `pnpm install` limpo (zero peer warnings novos; jiti não adicionado). `pnpm why eslint`=10.5.0 único, `typescript-eslint`=8.61.1 único, `@eslint/js`=10.0.1 único. `packages/config` lint 0 erros (sem delta). `mesas-frontend` lint: **31 errors + 1 warning** (baseline 29+1; delta +2). Delta = `preserve-caught-error` em 2 arquivos (`profileSchemas.ts:159`, `apiClient.ts:180`). `no-unassigned-vars`/`no-useless-assignment` zero ocorrências. ZERO regressão.

**T65b — correção `preserve-caught-error` (2026-06-19):** ✅ 2 erros corrigidos com `{ cause: <erro original> }` ao `new Error()`. Lint final: **29 errors + 1 warning** = baseline pré-T65 (delta 0). `turbo build --force` 13/13 verde.

---

## 12. astro 5 → 6 (site) 🟢

**Mudança 5→6:** Node `>=22.12` (Node 24 OK); breaking de config/content collections/integrations; `@astrojs/check` compat. Per D054, "Astro 6 público usa Vite 7" — confirmar Vite que o Astro 6 traz (o site usa o Vite embutido do Astro, não o Vite standalone do toolchain).

**Uso real:**
- `apps/site/astro.config.mjs` — `defineConfig` com `site`, `trailingSlash:"always"` (D047, preserva permalink WP), `integrations:[sitemap()]`, `vite.plugins:[tailwindcss()]` (já `@tailwindcss/vite` v4).
- Integrations: `@astrojs/sitemap`. `@tailwindcss/vite`.
- Conteúdo: `src/data/posts.json`/`pages.json` via `src/lib/content.ts` — **sem Content Collections** (não há `src/content/`).
- Endpoints: `rss.xml.ts` + `robots.txt.ts` (com extensão de arquivo).
- 4 rotas com `getStaticPaths()` (blog/[slug], tag, categoria, [slug]) — **sem** `Astro.site`/`Astro.generator` dentro da função.

**Impacto:** LOW. Site usa Astro básico (zero adapters, zero islands React, zero content collections, zero SSR, zero ViewTransitions, zero Astro.glob). Riscos analisados item a item abaixo.

**Investigação T66 (2026-06-19):**

| Breaking change | Afeta? | Detalhe |
|---|---|---|
| Node 22.12+ | ✅ OK | Node 24 |
| Vite 7.0 | ✅ OK | `@tailwindcss/vite` peer: `^5 \|\| ^6 \|\| ^7 \|\| ^8` |
| Content Collections legacy removido | ✅ N/A | Site não usa `src/content/` — conteúdo = JSON fixtures |
| Zod 4 | ✅ OK | Já zod 4.4.3 no monorepo (T61); sem uso direto no site |
| Shiki 4.0 | ✅ N/A | Sem syntax highlighting no site |
| `Astro` em `getStaticPaths()` deprecado | ✅ OK | getStaticPaths só retorna `params`, não acessa `Astro` |
| `Astro.glob()` removido | ✅ N/A | Não usado |
| `<ViewTransitions />` removido | ✅ N/A | Não usado |
| `import.meta.env.ASSETS_PREFIX` deprecado | ✅ N/A | Não usado |
| `astro:schema` deprecado | ✅ N/A | Não usado |
| CommonJS config removido | ✅ OK | `.mjs` é ESM |
| Endpoints com extensão + trailing slash | ✅ OK | `rss.xml`/`robots.txt` linkados sem `/`; Astro 6 força sem `/` |
| `getStaticPaths()` params number | ✅ OK | Todos slugs = string |
| `import.meta.env` inline | ✅ OK | `process.env.PUBLIC_SITE_URL` usado só no config |
| `@astrojs/sitemap@3.7.3` | ✅ OK | Latest, sem peer deps, compatível Astro 6 |
| `@astrojs/rss@4.0.18` | ✅ OK | Latest, sem peer deps, compatível Astro 6 |
| `@astrojs/check` | ✅ N/A | Não instalado |
| D054 revisitar | ✅ OK | Astro 6 usa Vite 7 interno; site não mistura Vite próprio |

**Conclusão:** migração é **bump mecânico**: `astro ^5.5.0`→`^6.4.8`. Nenhuma integração `@astrojs/*` precisa bump (já no latest compatível). Nenhuma mudança de config necessária. Risco = **baixíssimo**.

**Resultado T66 (2026-06-19):** ✅ migração executada. `pnpm install` limpo (+31/-5, zero peer warnings novos). `astro@6.4.8` resolvido. `astro build` 46 páginas em 6.60s, sitemap OK, Pagefind OK. `turbo build --force` **13/13 verde** (1m15s). Vitest 22/22 pass. Dist verificado: `rss.xml` (5027B), `robots.txt` (76B), `sitemap-index.xml` (187B), canonical correto (`https://artificiorpg.com`). ZERO `.astro` legacy. **ZERO regressão. ZERO mudança de config.**

**Ação:** (T66) ✅ concluído.
**Teste:** `turbo build --filter=@artificio/site --force`; `pnpm --filter @artificio/site test`; verificar `dist` (blog, `/sitemap-index.xml`, páginas, canonicals).
**Rollback:** `git tag pre-033-f4b-astro` + cópia `astro.config.mjs` + `pnpm-lock.yaml.pre-astro.bak`.

### 12b. Features Astro 6 — análise de adoção (T66b, 2026-06-19)

Análise das novas funcionalidades estáveis do Astro 6 vs realidade do projeto:

| Feature | Aplicável? | Detalhe |
|---|---|---|
| **CSP Nativa** | ✅ implementado | Gera hashes para `<script is:inline>`. Site tem 5 inline scripts. Investigação inicial assumiu que exigia adapter HTTP — **corrigido**: CSP usa `<meta http-equiv>` tag, funciona em SSG sem adapter. Implementado: `security.csp` em `astro.config.mjs`, 5 hashes SHA-256 auto + diretivas, 46/46 páginas. `BL-ASTRO6-CSP` FECHADO. |
| **Fonts API** | ❌ N/A | Site usa fontes de sistema (sem Google/Fontsource) |
| **Live Content Collections** | ❌ N/A | Conteúdo = JSON estático, não collections |
| **Sätteri Markdown (Rust)** | ❌ N/A | Site não tem `.md` — melhoria de build automática, zero ação |
| **Queued Rendering** | ✅ auto | Melhoria interna de memória, zero ação |
| **Hono routing** | ❌ N/A | Experimental, não é nossa stack |
| **`@astrojs/cloudflare` adapter** | ❌ N/A | Não instalado. Cloudflare Tunnel (`cloudflared`) + Cloudinary = infra própria, sem relação com o adapter Astro |
| **`output: 'hybrid'` removido** | ✅ N/A | Site usa `static` (default) |

**Conclusão T66b:** Nenhuma feature Astro 6 demanda ação adicional. CSP implementado com sucesso via meta tag sem adapter. `BL-ASTRO6-CSP` FECHADO.

**CSP implementado (2026-06-19):** ✅ Descoberta crítica: Astro 6 CSP NÃO requer adapter — usa `<meta http-equiv="content-security-policy">` (funciona em SSG!). Config `security.csp` adicionada em `astro.config.mjs`:

```js
security: {
  csp: {
    directives: [
      "default-src 'self'",
      "img-src 'self' data: https://res.cloudinary.com",
      "connect-src 'self' https://accounts.artificiorpg.com https://www.google-analytics.com",
    ],
    scriptDirective: {
      resources: ["'self'", "https://www.googletagmanager.com"],
    },
  },
}
```

**Resultado:** 46/46 páginas geram `<meta http-equiv="content-security-policy">` com 5 hashes SHA-256 (Base.astro×3 + Analytics + SearchModal) + diretivas externas. `turbo build --force` 13/13 verde. Vitest 22/22. `BL-ASTRO6-CSP` FECHADO. **Revisão PR #70:** `styleDirective.resources` explícito, `media-src https://res.cloudinary.com`, inline `style=` → classes CSS, `markdown.syntaxHighlight: false`. Mergeado em dev (`c6f21cf`, 2026-06-19).

**Warning residual:** Shiki (syntax highlighting) emite warning de incompatibilidade com CSP — inofensivo (site não usa Shiki/syntax highlighting).

---

## Achados transversais (registrar em backlog/sessão)

1. **🔴 `BL-033-GLOSSARIO-LINT-NEVER-RAN` (AMPLIADO)** — baseline Fase 2 (2026-06-18) confirmou que **4 pacotes** não têm config ESLint flat: `apps/glossario/frontend`, `packages/content`, `packages/analytics`, `packages/auth` (todos falham "ESLint couldn't find an eslint.config file"). Lint nunca rodou verde nesses. T64a/T65 devem criar config do zero em cada (não "migrar legado"). Não é regressão do Node 24.
2. **zod risco rebaixado p/ 🟢** — sem `.email()`/`errorMap` no código; bump quase mecânico. Confirma viabilidade de T61.
3. **dotenv/multer 🟢** — bumps sem mudança de código.
4. **mesas já Tailwind v4 e Vite 8; site já Tailwind v4 mas Vite 7 (Astro)** — Fase 4B de Tailwind/Vite recai quase só no glossario (lanterna) + accounts/ui (Vite 6→8). **CORREÇÃO (2026-06-19):** esta nota dizia "site já Vite 8" — IMPRECISO. O `apps/site` é **Astro 6.4.8**, cujo engine de build é **Vite 7** (Astro 6 não é rolldown/Vite 8 — Astro declara `vite ^7.3.2`). O "Vite 8" visto na investigação era o vite@8 hoisted das SPAs, resolvido por acidente pelo `@tailwindcss/vite` do site — exatamente o que quebrou no lock regen do dependabot (ver §8 ARMADILHA). Vite 8 é APENAS das SPAs React; o site é Vite 7 por design do Astro.
5. **D054 a revisitar** após Astro 6 (já previsto em T40/T66).

---

## Correções pós-execução (Fase 3 — o que a investigação prévia NÃO previu)

### 6. 🔴 `express-rate-limit` 7→8 — risco real > previsto
**Previsão:** 🟢 só `max`+`message` string; sem `keyGenerator`/store custom.
**Realidade:** Além de `max`→`limit`, v8 **removeu default export** → quebrou `import rateLimit from 'express-rate-limit'` (TS1005 parse error). Correção: `import { rateLimit }`. `message` string OK (tipo `any | ValueDeterminingMiddleware`). **4 arquivos afetados** (mesas rateLimit.ts + glossario feedbackRoutes.ts + migrationRoutes.ts).

### 7. 🔴 `express-async-errors@3` — NÃO previsto no T5b
**Realidade:** Package é peer `express@^4.16.2`, requer `express/lib/router/layer` internamente (caminho inexistente no Express 5). Causa crash no boot com `Cannot find module`. Express 5 já encaminha rejeições de async handlers nativamente. **Remoção obrigatória** (import + package.json). _Descoberto no review do PR #63._

### 8. 🔴 `@types/express-serve-static-core@5` — `ParamsDictionary` — NÃO previsto
**Realidade:** `ParamsDictionary[key: string]` mudou de `string` para `string | string[]` (path-to-regexp v8 wildcards nomeados). **38 erros** de tipo em `req.params.*` por todo `apps/mesas/backend`. Module augmentation (`declare module`) NÃO funciona com parâmetros genéricos de interface. Fix: `pnpm patch` sobrescrevendo o tipo.

### 9. 🟡 `@types/multer@2.1.0` — dependência de `@types/express@4`
**Realidade:** Mesmo após remover o override `@types/multer>@types/express` do root, `@types/multer@2.1.0` (última versão) depende de `@types/express@4` → `RequestHandler` incompatível com Express 5. `as any` nos 2 pontos de uso (mesas `upload.ts` + site `admin-api.ts`).

### 10. 🟡 `pnpm patch` + Docker build — NÃO previsto
**Realidade:** `package.json` referencia `pnpm.patchedDependencies` → `patches/...`. Dockerfiles que rodam `pnpm install --frozen-lockfile` precisam de `COPY patches ./patches`. `.dockerignore` do projeto NÃO bloqueia `patches/`. **2 falhas de deploy** com ENOENT antes do fix.

**AGRAVANTE (2026-06-18, 3º deploy falho):** `COPY patches` precisa estar em **cada estágio** que roda `pnpm install --frozen-lockfile`. O `--frozen-lockfile` com `--prod` também falhou no mesas-backend porque a dep patchada (`@types/express-serve-static-core`) ainda era parte da árvore de resolução do estágio `--prod`. 

**Confirmado:** `pnpm --frozen-lockfile` com `--prod` **exige** os patches de todas as deps patchadas que fazem parte da árvore de instalação do estágio, independentemente de serem `dependencies` ou `devDependencies` no manifesto do pacote (a resolução via workspace/hoisting pode puxá-las). Adicionar `COPY patches ./patches` em cada estágio que executa `pnpm install --frozen-lockfile` **resolve o problema** — o deploy subsequente do mesas-backend ficou verde (run `27801765034`).

**Dockerfiles afetados (inventário 2026-06-18):**

| Dockerfile | Estágios com `pnpm install` | Tem `COPY patches`? |
|---|---|---|
| `apps/mesas/backend` | builder (L17) + production (L35) | ✅ ambos (L15 + L34, corrigido 2026-06-18) |
| `apps/mesas/frontend` | builder (L38) | ✅ (L36) |
| `apps/accounts` | deps (L7) + runtime (L19) | ❌ nenhum |
| `apps/glossario/backend` | builder (L16) + production (L30) | ❌ nenhum |
| `apps/glossario/frontend` | builder (L23) | ❌ |
| `apps/site` | único (L14) | ❌ |

**Tasks de investigação:** cada Dockerfile acima sem `COPY patches` precisa ser verificado ANTES do próximo deploy do respectivo app (built Docker na VM falha com ENOENT se o `pnpm.patchedDependencies` do root `package.json` estiver ativo). Ver tasks.md Fase 5.

### 11. 🔴 Express 5 `*` wildcard — CORRIGIDO pós-deploy (2026-06-18)
**Realidade:** path-to-regexp@8.4.2 (instalado no Docker build, `pnpm-lock.yaml`) **rejeita** `'*'` bare wildcard: `Missing parameter name at index 1`. O `'/{*splat}'` é a sintaxe correta do Express 5 (documentada em https://expressjs.com/en/guide/migrating-5/#path-syntax) e casa raiz `/`. O chatgpt-codex-connector **estava certo** ao apontar isso no review do PR — o doc anterior (item 11 original) estava errado.
**Fix:** `router.get('*', ...)` → `router.get('/{*splat}', ...)` em `apps/mesas/backend/src/routes/og.ts:201`.
**Impacto:** 4º deploy falho do mesas-beta — crash no boot `PathError: Missing parameter name at index 1: *`.

> Próximo passo (Fase 1 → Fase 2): este doc fecha T5b (mapa de impacto). Antes de QUALQUER migração, T6 (backup git tag + lockfile) — exige aprovação só no push; tag local não. Execução = DeepSeek por task, com ficha fechada Claude + g1-governance-reviewer no diff.

---

## 13. `pnpm audit --prod` — 7 vulnerabilidades (T67, 2026-06-19) 🔴

**Achado:** `pnpm audit --prod` retorna 7 vulnerabilidades (3 HIGH, 3 MODERATE, 1 LOW). Todas pré-existentes (não introduzidas pela Fase 4B). Investigadas uma a uma.

### 13a. `xlsx@0.18.5` — 2 HIGH 🔴 não corrigível

- **GHSA-4r6h-8v6p-xvw6** (Prototype Pollution), **GHSA-5pgg-2g8v-p4x9** (ReDoS)
- **Uso:** `apps/glossario/frontend/src/pages/ImportPage.tsx` — parse de Excel client-side no admin de importação
- **Cadeia:** dep direta do glossario-frontend
- **Status no npm:** última versão publicada = `0.18.5` (a mesma). Advisories citam `>=0.19.3`/`>=0.20.2` como patched, mas **essas versões não existem no npm**. Package aparenta estar abandonado (SheetJS).
- **Risco prático:** BAIXO. Funcionalidade admin-only, client-side. Um admin malicioso teria que fazer upload de xlsx crafted para explorar o próprio browser. Sem exposição a usuários públicos.
- **Mitigação:** aceitar risco ou substituir xlsx por alternativo (ex.: `exceljs` já usado no backend, mas é Node-only). **SDD Completo se substituir.**

### 13b. `form-data@4.0.5` via `axios@1.18.0` — 1 HIGH 🟡 corrigível

- **GHSA-hmw2-7cc7-3qxx** (CRLF injection em multipart field names/filenames)
- **Uso:** `apps/glossario/frontend` — axios é usado para chamadas HTTP (API glossario, feedback, etc.)
- **Cadeia:** `axios@1.18.0` → `form-data@^4.0.5` (resolvido: `4.0.5`)
- **Patch:** `form-data@4.0.6` já publicado. axios `^4.0.5` range aceita `4.0.6`.
- **Mitigação:** `pnpm.overrides` no root `package.json`: `"form-data": ">=4.0.6"`. **SDD Lite (override + pnpm install + smoke).**

### 13c. `nanoid@4.0.2` via `react-markdown-editor-lite@1.4.2` — 1 MOD 🟡 parcial

- **GHSA-mwcw-c2x4-8c55** (resultados previsíveis com valores não-inteiros)
- **Uso:** `apps/mesas/frontend` — editor markdown nos formulários de mesa
- **Cadeia:** `react-markdown-editor-lite@1.4.2` → `nanoid@^4.0.2` (resolvido: `4.0.2`)
- **Patch:** `nanoid@5.1.14` disponível, mas é **major** — não compatível com `^4.0.2`. `react-markdown-editor-lite` está ativo (último release 2026-01-21) mas não atualizou o range.
- **Risco prático:** BAIXO. Vulnerabilidade requer seed não-inteiro intencional. Uso interno no editor.
- **Mitigação:** aguardar update do upstream ou aceitar risco. Override forçado `nanoid@^5` pode quebrar.

### 13d. `uuid@8.3.2` via `exceljs@4.4.0` — 1 MOD 🟡 parcial

- **GHSA-w5hq-g745-h8pq** (Missing buffer bounds check)
- **Uso:** `apps/glossario/backend` — geração de Excel server-side
- **Cadeia:** `exceljs@4.4.0` → `uuid@^8.3.0` (resolvido: `8.3.2`)
- **Patch:** `uuid@11.1.1` disponível, major incompatível. `exceljs@4.4.1-prerelease.0` ainda usa `^8.3.0`.
- **Mitigação:** aguardar exceljs 4.4.1+ com uuid atualizado ou aceitar risco.

### 13e. `dompurify@3.4.8` — 1 MOD + 1 LOW 🟢 corrigível

- **GHSA-cmwh-pvxp-8882** (ALLOWED_ATTR pollution via setConfig bypass, MOD), **GHSA-vxr8-fq34-vvx9** (Trusted Types policy survives clearConfig, LOW)
- **Uso:** `apps/mesas/frontend/src/utils/sanitize.ts` — sanitização de HTML de conteúdo de usuário (descrições de mesa, etc.)
- **Cadeia:** dep direta do mesas-frontend
- **Patch:** `dompurify@3.4.11` já publicado. `^3.4.x` compatível.
- **Risco prático:** MÉDIO. Sanitização de user-content é fronteira de segurança. ALLOWED_ATTR pollution pode permitir bypass em cenários específicos.
- **Mitigação:** **bump `dompurify ^3.4.x` → `^3.4.11`** em `apps/mesas/frontend/package.json`. **SDD Lite.**

### Resumo e prioridade

| Vuln | Correção | Esforço |
|---|---|---|
| dompurify (mesas) | ✅ bump 3.4.8→3.4.11 | SDD Lite (1 arquivo) |
| form-data (glossario) | ✅ pnpm override → 4.0.6 | SDD Lite (1 linha) |
| xlsx (glossario) | ❌ sem patch publicado | Aceitar risco ou substituir lib |
| nanoid (mesas) | ❌ bloqueado por upstream | Aguardar react-markdown-editor-lite |
| uuid (glossario-back) | ❌ bloqueado por upstream | Aguardar exceljs 4.4.1+ |

**Recomendação:** corrigir dompurify + form-data agora (SDD Lite, 2 ações). xlsx/nanoid/uuid = débito documentado, aceitar risco.
