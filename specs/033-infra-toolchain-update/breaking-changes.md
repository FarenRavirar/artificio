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

---

## 11. astro 5 → 6 (site) 🟡

**Mudança 5→6:** Node `>=22.12` (Node 24 OK); breaking de config/content collections/integrations; `@astrojs/check` compat. Per D054, "Astro 6 público usa Vite 7" — confirmar Vite que o Astro 6 traz (o site usa o Vite embutido do Astro, não o Vite standalone do toolchain).

**Uso real:**
- `apps/site/astro.config.mjs` — `defineConfig` com `site`, `trailingSlash:"always"` (D047, preserva permalink WP), `integrations:[sitemap()]`, `vite.plugins:[tailwindcss()]` (já `@tailwindcss/vite` v4).
- Integrations: `@astrojs/sitemap`. `@tailwindcss/vite`.

**Impacto:** config enxuta → migração provavelmente leve. Risco = content collections API e `@astrojs/sitemap`/`@astrojs/check` major-compat.
**Ação:** (T66) bump `astro ^5.5.0`→`^6.4.8` + `@astrojs/*` compat; aplicar mudanças de config; **revisitar D054**.
**Teste:** `turbo build --filter=@artificio/site --force`; `pnpm --filter @artificio/site test`; verificar `dist` (blog, `/sitemap-index.xml`, páginas, canonicals).
**Rollback:** `git tag pre-033-f4b-astro` + cópia `astro.config.mjs`.

---

## Achados transversais (registrar em backlog/sessão)

1. **🔴 `BL-033-GLOSSARIO-LINT-NEVER-RAN` (AMPLIADO)** — baseline Fase 2 (2026-06-18) confirmou que **4 pacotes** não têm config ESLint flat: `apps/glossario/frontend`, `packages/content`, `packages/analytics`, `packages/auth` (todos falham "ESLint couldn't find an eslint.config file"). Lint nunca rodou verde nesses. T64a/T65 devem criar config do zero em cada (não "migrar legado"). Não é regressão do Node 24.
2. **zod risco rebaixado p/ 🟢** — sem `.email()`/`errorMap` no código; bump quase mecânico. Confirma viabilidade de T61.
3. **dotenv/multer 🟢** — bumps sem mudança de código.
4. **mesas/site já Tailwind v4 e Vite 8** — Fase 4B de Tailwind/Vite recai quase só no glossario (lanterna) + accounts/ui (Vite 6→8).
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
