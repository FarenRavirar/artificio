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
| kysely | 0.28 → 0.29 | 🟡 | 30 arquivos usam; checar tipos no `tsc --noEmit` |
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

## 3. kysely 0.28 → 0.29 🟡

**Mudança:** refinamentos de tipo (mais estritos em alguns helpers); checar changelog oficial p/ remoção de APIs. Runtime estável.

**Uso real:** 30 arquivos — núcleo `apps/mesas/backend/src/{db,routes,services,repositories,discord,scripts}/*` + `apps/accounts/src/{app,users,db}.ts`. `PostgresDialect`/`new Kysely` em `db/index.ts`, `db/prod.ts`, `accounts/src/db.ts`.

**Impacto:** provável só tipo; runtime de query não muda. Risco = `tsc` mais rígido em query builders complexos.

**Ação:** (T25c) bump accounts+mesas-backend; `tsc --noEmit` em ambos; corrigir erro de tipo a erro de tipo (ou registrar débito se cascata).
**Teste:** build accounts+mesas-backend; `tsc --noEmit`.
**Rollback:** lockfile.

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

**Mudança 3→4:** top-level `z.email()`/`z.url()`/`z.uuid()` preferidos; formas `z.string().email()/.url()` **deprecadas mas funcionais**. `errorMap` → `error` param. `.parse/.safeParse` iguais.

**Uso real (rg `from 'zod'` + validadores):**
- `apps/accounts/src/env.ts` — `z.string().url()` (3×)
- `packages/config/src/env.ts`
- `apps/mesas/backend/src/validators/tableValidators.ts` — `z.string().url()` (2×)
- `apps/mesas/backend/src/{routes/adminDiscordSync, discord/ingestMessages, discord/discovery}.ts`
- `apps/mesas/frontend/src/{schemas/profileSchemas, features/discord-sync/api/discordSyncApi}.ts`

**Achado:** **zero** `.email()`, `errorMap`, `invalid_type_error`, `required_error` no código. Único padrão tocado = `.url()`, que segue válido em zod 4.

**Impacto:** ínfimo. Bump praticamente mecânico.
**Ação:** (T25g mesas; T61 unificação) bump config/accounts/mesas→`^4.4.3`; opcional migrar `.url()`→`z.url()` (cosmético). `tsc`+build.
**Teste:** build dos 4; smoke validação (criar mesa, login).
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

## 8. vite 5/6 → 8.0.16 🟡

**Mudança:** Node mínimo sobe (Node 24 OK); `build.target` default mais novo; plugins precisam de versão compatível. `@vitejs/plugin-react` deve subir (plugin-react 6 exige Vite 8 — ver D054).

**Uso real (configs):**
- `apps/accounts/vite.config.ts` — `@vitejs/plugin-react` `^4.2.1`, `react()`, `root:"frontend"`
- `apps/mesas/frontend/vite.config.ts` (Vite já `^8.0.1`)
- `apps/site-admin/vite.config.ts` (já `^8.0.16` — D054)
- `apps/glossario/frontend/vite.config.ts` (Vite `^5.2.0`, plugin-react `^4.2.1` — lanterna)
- `packages/ui` (Vite `^6.3.5`)

**Impacto:** config simples (accounts/glossario só `react()`); risco = plugin-react v4 incompatível com Vite 8 → subir plugin junto.
**Ação:** (T63 accounts+ui; T64a glossario) bump Vite→`^8.0.16` + `@vitejs/plugin-react` p/ versão Vite8-compat; revisar `build.target`.
**Teste:** build accounts/ui/mesas-frontend/site-admin + `ui test` 8/8; diff de bundle vs baseline.
**Rollback:** `git tag pre-033-f4b-vite` + lockfile.

---

## 9. tailwindcss 3 → 4 (glossario) 🔴

**Mudança (CSS-first):** `tailwind.config.{ts,js}` → `@theme` no CSS; `postcss.config.js` plugin → `@tailwindcss/postcss` (ou `@tailwindcss/vite`); `@tailwind base/components/utilities` → `@import "tailwindcss"`; `content` autodetectado.

**Uso real:**
- `apps/glossario/frontend/tailwind.config.ts` — v3, `darkMode:['selector','[data-theme="dark"]']`, custom colors (`azul-escuro #1B2A4A`, `laranja #FF5722`, `branco`, `cinza-fundo`, `cinza-texto`, `azul-medio`), `fontFamily.sans:Inter`.
- `apps/glossario/frontend/postcss.config.js` (v3 + autoprefixer)
- `apps/mesas/frontend` e `apps/site` — **já v4** (`@tailwindcss/vite`; `apps/site/astro.config.mjs:4,13` usa `@tailwindcss/vite`). Só bump 4.2→4.3 (minor, T24e/T64b).

**Impacto:** glossario = migração estrutural. Custom colors viram `@theme { --color-azul-escuro:#1B2A4A; ... }`; `darkMode selector` → `@custom-variant dark (&:where([data-theme="dark"] *))`; remap dark do D065 (folha `[data-theme="dark"] .bg-white/...`) **precisa continuar funcionando** — validar visualmente.
**Ação:** (T64a) `npx @tailwindcss/upgrade` + revisar diff; migrar config→`@theme`; trocar postcss→`@tailwindcss/postcss`; `@tailwind`→`@import`.
**Teste:** build glossario-frontend; smoke visual público+admin (estilos íntegros, dark D065 intacto); diff bundle CSS.
**Rollback:** `git tag pre-033-f4b-glossario` + cópia de `tailwind.config.ts`/`postcss.config.js` em `artifacts/033/`.

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

**Ação:** (T64a) criar `apps/glossario/frontend/eslint.config.js` espelhando mesas; trocar deps: `eslint ^8.57`→`^10.5.0`, `@typescript-eslint/*`→`typescript-eslint@8.61.1`, `react-hooks`→v5 (flat), `react-refresh`→`^0.5.3`; remover `--ext` do script lint; adicionar `@eslint/js` + `globals`.
**Teste:** `pnpm --filter @artificio/glossario-frontend lint` roda e termina (sem "no config"); sem erro novo vs baseline.
**Rollback:** `git tag pre-033-f4b-glossario` + lockfile.
**Débito a abrir:** `BL-033-GLOSSARIO-LINT-NEVER-RAN` — lint do glossario-frontend sem config; confirmar se CI o ignora.

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

1. **🔴 `BL-033-GLOSSARIO-LINT-NEVER-RAN`** — glossario-frontend sem config ESLint algum; lint script quebraria sob ESLint 8. T64a deve criar config do zero (não "migrar legado"). Corrigir texto de T64a (não há `.eslintrc` a remover).
2. **zod risco rebaixado p/ 🟢** — sem `.email()`/`errorMap` no código; bump quase mecânico. Confirma viabilidade de T61.
3. **dotenv/rate-limit/multer 🟢** — bumps sem mudança de código; só limpeza opcional (`max`→`limit`, `DOTENV_CONFIG_QUIET`).
4. **mesas/site já Tailwind v4 e Vite 8** — Fase 4B de Tailwind/Vite recai quase só no glossario (lanterna) + accounts/ui (Vite 6→8).
5. **D054 a revisitar** após Astro 6 (já previsto em T40/T66).

> Próximo passo (Fase 1 → Fase 2): este doc fecha T5b (mapa de impacto). Antes de QUALQUER migração, T6 (backup git tag + lockfile) — exige aprovação só no push; tag local não. Execução = DeepSeek por task, com ficha fechada Claude + g1-governance-reviewer no diff.
