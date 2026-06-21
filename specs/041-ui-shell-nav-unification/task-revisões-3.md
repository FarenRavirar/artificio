# 041 — Revisões de bots do PR #81 (Rodada 3)

> **Propósito:** registrar e dar veredicto a CADA achado dos revisores automatizados no PR #81. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/041-ui-shell-nav-unification`
- PR: [#81](https://github.com/FarenRavirar/artificio/pull/81)
- Commit revisado: `6639a36`
- Checks GitHub (`lint + build + test`): pendente
- Estado das revisões: **aberto** — aguardando bots

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|
| 44 | coderabbitai | `glossario/backend/src/index.ts:31-38` | 🟠 major | **Rate limit antes do CORS.** `app.use(rateLimit(...))` (L31-38) executa antes de `app.use(cors(...))` (L48-59). (1) OPTIONS preflight são rate-limited e consomem cota; (2) 429 para origens permitidas sai sem `Access-Control-Allow-Origin` → erro de CORS no navegador em vez de erro de rate-limit legível. Sugere: mover `rateLimit` para depois de `cors` + `skip: (req) => req.method === 'OPTIONS'`. | **aplicado** ✅ | Ordem corrigida: `trust proxy` → `cors` → `rateLimit(skip:OPTIONS)` → `json` → `cookieParser`. Build ✅. Comentários inline explicam o motivo da ordem. | `apps/glossario/backend/src/index.ts` — cors movido para L40-54, rateLimit para L56-66 com `skip: (req) => req.method === 'OPTIONS'`. |
| 45 | coderabbitai | `packages/ui/src/ChangelogModal.tsx:206-299` | 🟠 major / 🏗️ heavy | **`.map()` proibido.** Linha 208: `Object.entries(groupedLogs).map(...)` e linha 238: `dailyLogs.map(...)`. Viola regra pétrea de código: proibido `.map`/`.filter`/`.reduce`/`.forEach`/array spread. `groupedLogs` é construído de `changelogs` prop (dado externo). Sugere substituir ambos por `for...of` com acumuladores de JSX. | **aplicado** ✅ | Ambos `.map()` substituídos por `for...of`: loop externo itera `Object.entries()` com índice, loop interno itera `dailyLogs` com índice. JSX idêntico, acumulado em arrays `ReactNode[]`. Build ui + 5 consumidores ✅. | `Object.entries().map` → `for (let i; i < len; i++)` + `dailyLogs.map` → `for (let j; j < len; j++)` com `.push()`. |
| 46 | coderabbitai | `packages/ui/src/hooks.ts:30-106` | 🔵 trivial / ⚡ quick | **Lógica de fetch duplicada.** `fetchLogs` (useEffect, L50-67) e `retry` (useCallback, L87-102) têm o mesmo bloco try-catch-finally (setLoading → fetcher → normalizeChangelogEntries → setError). Sugere extrair para helper `executeFetch(controller)` compartilhado, chamado por ambos. | **aplicado** ✅ | Extraído `executeFetch(controller)` via `useCallback` (dep: `[fetcher]`). useEffect chama `executeFetch(controller)`. `retry` chama `await executeFetch(controller)`. 17 linhas duplicadas → 0. Build ui + 5 consumidores ✅. | `executeFetch` unificado em `useCallback`, chamado de `useEffect` e `retry`. |
| 47 | coderabbitai | `mesas/backend/src/routes/changelog.ts:48-49` | 🟠 major / ⚡ quick | **Normalização ausente antes do `.filter()`.** `JSON.parse` produz `unknown` (L35: `let changelogs;` tipado como `any`). `.filter((log: ChangelogEntry) => log.published === true && ...)` (L48) acessa campos de objeto sem type guard — se o array contiver `null` ou primitivo, `log.published` lança TypeError e derruba o endpoint. Campos truthy não-string escapam para resposta. Sugere: `isChangelogEntry()` type guard + `for...of` para normalizar cada item antes do `.sort()`. Alinhado à regra pétrea de normalização. | **aplicado** ✅ | **Fonte única atômica.** `isChangelogEntry()` + `ChangelogEntry` já existiam em `packages/ui/src/changelog.ts`. Endurecido com `.trim() !== ''` e `!Number.isNaN(new Date(...))`. Novo subpath `@artificio/ui/changelog` (sem React). Ambos backends importam de `@artificio/ui/changelog`. 2× `interface` + 2× `function` deletados. Cache, `for...of`, `.sort()`, `.slice()` mantidos. Build 13/13 ✅. | `packages/ui/src/changelog.ts` endurecido + `./changelog` export. Ambos backends: `import { isChangelogEntry, type ChangelogEntry } from '@artificio/ui/changelog'`. |

## Totais

| Categoria | Qtd | Status |
|---|---|---|
| Aplicado | 17 | #44–#61 (build/workflow ✅) |
| Descartado | 8 | #60, #62–#68 (falsos positivos) |
| **Total** | **25** | **100% resolvido** |

## Critério de encerramento (gate de merge)
- [x] Todos os achados com veredicto registrado (25/25).
- [x] Todos os "procede" aplicados (17/25 aplicados; 8 descartados como falso positivo).
- [ ] Mantenedor autorizou o merge nominalmente.

---

## Achados de Auditoria — Fonte Única (Changelog)

> Descobertos durante auditoria de duplicação. Nenhum veio de bot — são débitos de design detectados pelo agente.

| # | Severidade | Arquivos | Achado (resumo) | Veredicto | Justificativa |
|---|---|---|---|---|---|
| 48 | 🔴 crítica | `glossario/backend/changelogController.ts:40` vs `mesas/backend/routes/changelog.ts:55` | **Response shape inconsistente.** Glossario retorna array cru `res.json(published)`. Mesas retorna `res.json({ data: published })`. Força o frontend do mesas a fazer unwrap manual (`data.data`). | **aplicado** ✅ | Padronizado em `{ data: [...] }` nos dois backends. Glossario backend: `res.json({ data: published })` + cache return idem. Glossario frontend: `r.data.data` (unwrap do envelope). Mesas backend/frontend já estavam corretos. Build 4/4 ✅. | `apps/glossario/backend/src/controllers/changelogController.ts` L15, L48 → `{ data: ... }`. `apps/glossario/frontend/src/components/ChangelogModal.tsx` L19 → `r.data.data`. |
| 49 | 🟠 major | `site/SiteChangelogModal.tsx` + `links/LinksChangelogModal.tsx` (19 linhas cada) | **Wrappers 100% idênticos.** Dois arquivos com imports, normalização, props e JSX idênticos. Só muda o nome do export (`SiteChangelogModal` vs `LinksChangelogModal`). Diferença real: path do JSON import (`../data/changelogs.json` — mas ambos apontam para arquivos diferentes em cada app). | **aplicado** ✅ | `StaticChangelogModal` adicionado a `packages/ui/src/ChangelogModal.tsx` e exportado via `index.ts`. Ambos wrappers simplificados: importam `StaticChangelogModal` + `normalizeChangelogEntries`, fazem JSON import + normalize no módulo, renderizam `<StaticChangelogModal>`. JSX do modal centralizado em fonte única. Build ui + site + links ✅. | `packages/ui`: novo `StaticChangelogModal`. `site/SiteChangelogModal.tsx` + `links/LinksChangelogModal.tsx`: 19→12 linhas cada, fonte única de JSX. |
| 50 | 🔴 crítica | `glossario/backend/changelogController.ts` (55 linhas) + `mesas/backend/routes/changelog.ts` (67 linhas) | **Lógica de backend ~90% duplicada.** Ambos: cache check → readFile → JSON.parse → Array.isArray → for...of + isChangelogEntry → sort → slice(0,50) → cache store → response. Únicas diferenças reais: path do JSON (resolvido com parâmetro) e shape da resposta (#48). | **aplicado** ✅ | `normalizeChangelogEntries` ganhou parâmetro `limit?: number`. Ambos backends chamam `normalizeChangelogEntries(parsed, 50)` em vez do loop manual + sort + slice. glossario: 53→44 linhas. mesas: 66→56 linhas. `isChangelogEntry` removido dos imports (não mais usado direto). Cache + readFile + parse permanecem por backend (específicos de path). Build 13/13 ✅. Resolve também #55. | `packages/ui/changelog.ts`: `normalizeChangelogEntries(payload, limit?)`. Backends: `normalizeChangelogEntries(parsed, 50)`. |
| 51 | 🟡 minor | `glossario/backend/changelogController.ts:8` + `mesas/backend/routes/changelog.ts:11` | **Cache TTL duplicado.** `const CACHE_TTL = 60000` definido nos dois backends com mesmo valor e propósito. | **aplicado** ✅ | `CHANGELOG_CACHE_TTL = 60_000` exportado de `packages/ui/changelog.ts`. Ambos backends importam e usam `CHANGELOG_CACHE_TTL`. Constantes locais `CACHE_TTL` removidas. Build ✅. | `packages/ui/changelog.ts`: `export const CHANGELOG_CACHE_TTL = 60_000`. |
| 52 | 🟡 minor | `site/SiteHeaderIsland.tsx:6`, `links/LinksHeader.tsx:5`, `mesas/AppShell.tsx:9`, `glossario/GlossarioHeader.tsx:10` | **UPDATE_MARKER duplicado.** String `"2026-06-21-shell-unificado"` repetida em 4 arquivos. Cada app define `UPDATE_MARKER` (ou `LAST_SEEN_UPDATE`) com o mesmo valor. | **aplicado** ✅ | `CHANGELOG_UPDATE_MARKERS` (objeto `{ site, links, mesas, glossario }`) exportado de `packages/ui/changelog.ts` e re-exportado via barrel `index.ts`. 4 apps importam e usam `CHANGELOG_UPDATE_MARKERS.<app>`. Fonte única + badges independentes: atualizar marker do mesas não dispara badge no site. 4× `const` locais deletados. Build 10/10 ✅. | `packages/ui/changelog.ts`: `export const CHANGELOG_UPDATE_MARKERS = { site: "...", ... } as const`. |
| 53 | 🟡 minor | `mesas/backend/src/db/types.ts:813` | **`UpdateLogType = 'app' \| 'dados'` duplicado.** O tipo DB do Kysely replica o union literal do `ChangelogEntry['type']` canônico. | **aplicado** ✅ | `import type { ChangelogEntry } from '@artificio/ui/changelog'`. `UpdateLogType` agora deriva de `ChangelogEntry['type']` — se o contrato canônico ganhar novo valor, DB sincroniza automaticamente. Build ✅. | `apps/mesas/backend/src/db/types.ts:813`: `export type UpdateLogType = ChangelogEntry['type']`. |
| 54 | 🟠 major | `glossario/frontend/ChangelogModal.tsx` (35 linhas) + `mesas/frontend/ChangelogModal.tsx` (30 linhas) | **Wrappers dinâmicos ~80% idênticos.** Ambos: `useChangelogData(fetcher, isOpen)` + props `{logs, loading, error, retry}` → `SharedChangelogModal`. Diferenças: glossario usa `api.get("/changelog")` + labels customizados; mesas usa `fetch("/api/v1/changelog")` cru + unwrap manual. | **aplicado** ✅ | `DynamicChangelogModal` adicionado a `packages/ui` — aceita `fetcher` + `labels` opcionais, encapsula `useChangelogData` + `<ChangelogModal>`. Ambos wrappers simplificados: glossario 35→28 linhas, mesas 30→29 linhas. `useChangelogData` + JSX do modal centralizados em fonte única. Build 3/3 ✅. | `packages/ui`: novo `DynamicChangelogModal`. Ambos wrappers: `useCallback` para fetcher + `<DynamicChangelogModal>` one-liner. |
| 55 | 🟡 minor | `glossario/backend/changelogController.ts:34-43` + `mesas/backend/routes/changelog.ts:40-49` | **Backends replicam `normalizeChangelogEntries` manualmente.** Ambos fazem `for...of` + `isChangelogEntry` + push + `.sort()` + `.slice(0, 50)` — mesma lógica que `normalizeChangelogEntries()` em `packages/ui`, mas sem chamar a função. | **aplicado** ✅ | Absorvido por #50. `normalizeChangelogEntries(parsed, 50)` unificado nos dois backends. `isChangelogEntry` removido dos imports. | — |

### Itens NÃO duplicados (falsos positivos da busca)

| Item | Motivo |
|------|--------|
| `CACHE_TTL` em `benchmarkService.ts`, `systems.ts`, `og.ts` | Contextos diferentes (benchmark, systems, OG), valores diferentes — não é duplicação de changelog |
| `localStorage` keys diferentes por app | Proposital — cada app tem seu próprio badge de "novidade" |
| `renderMarkdown` | Definido só em `packages/ui/ChangelogModal.tsx`, exportado, sem duplicação |
| `ChangelogEntry` interface fora do canonical | Zero ocorrências — todos importam de `@artificio/ui` ou `@artificio/ui/changelog` |

---

## Achados Snyk / GitHub Advanced Security (Scan completo do monorepo)

> Scan de segurança automatizado. Achados fora do escopo do PR #81, mas capturados na mesma janela de auditoria.

### Script Injection em Workflows (🔴 Blocker — Security)

| # | Arquivo:linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|
| 56 | `.github/workflows/_deploy-module.yml:167` | 🔴 blocker | `inputs.module` interpolado direto em `run:` — `pnpm -w turbo run build --filter=@artificio/${{ inputs.module }}*`. Quem dispara o workflow pode injetar comandos shell via `module`. | **aplicado** ✅ | `MODULE_FILTER` env var criada com valor de `inputs.module`. `run:` usa `$MODULE_FILTER` (shell variable). Mesmo fix aplicado na step de test (L177, #57). |
| 57 | `.github/workflows/_deploy-module.yml:177` | 🔴 blocker | Mesmo padrão na step de test: `pnpm -w turbo run test --filter=@artificio/${{ inputs.module }}*`. | **aplicado** ✅ | Absorvido no fix de #56 — mesma step, mesmo `MODULE_FILTER` no env. |
| 58 | `.github/workflows/break-glass-deploy-prod.yml:33` | 🔴 blocker | `inputs.confirm` interpolado em shell: `if [ "${{ inputs.confirm }}" != "BREAK_GLASS" ]`. | **aplicado** ✅ | `CONFIRM` env var criada. `run:` usa `$CONFIRM` (shell variable). |
| 59 | `.github/workflows/promote-prod-fast-forward.yml:33` | 🔴 blocker | Mesmo padrão: `if [ "${{ inputs.confirm }}" != "PROMOTE_DEV_TO_MAIN" ]`. | **aplicado** ✅ | Idêntico a #58. `CONFIRM` env var. |

### Code Smell — Função sempre retorna o mesmo valor (Blocker — Maintainability)

| # | Arquivo:linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|
| 60 | `apps/links/server/repo/groups.ts:160` | 🔴 blocker | `deleteTag()`: `if (!removed) return removed;` é early-return que retorna o mesmo valor da linha final `return removed;`. | **descartado** | Falso positivo. O `if (!removed) return removed;` é um early return legítimo: se `removed` for `undefined` (tag não encontrada), sai da transação mais cedo sem executar o `UPDATE`. O scanner interpretou como "sempre retorna removed", mas é um padrão comum de short-circuit em transações. |
| 61 | `apps/mesas/backend/src/discord/uploadDiscordImage.ts:19` | 🔴 blocker | `categorizeFetchError()`: ambos `if` e `else` retornam `'network'`. Função não consegue distinguir tipos de erro. | **aplicado** ✅ | Fallback trocado de `'network'` para `'expired_url'` — reflete falha de download de URL expirada (Discord CDN). Network errors detectados pelo regex continuam retornando `'network'`. Build ✅. |

### Hardcoded Password em Testes (Blocker — Security)

| # | Arquivo:linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|
| 62 | `apps/mesas/backend/src/middleware/auth.test.ts:42` | 🔴 blocker | `jwt.sign(..., 'test-secret-only-for-sso', ...)` — senha hardcoded em teste. | **descartado** | Falso positivo. `'test-secret-only-for-sso'` é secret de teste, sem relação com credencial real. Usado em `authMiddleware` + `JWT_SECRET` de CI (`ci_dummy_jwt_secret_do_not_use`). Padrão normal em testes unitários — o scanner não distingue teste de produção. |
| 66 | `packages/auth/src/jwt.test.ts:17` | 🔴 blocker | `jwt.sign(..., 'test-secret', ...)` em teste `returns session for valid HS256 token`. | **descartado** | Falso positivo. Secret `'test-secret'` só existe em teste unitário do `verifyToken()`. Zero relação com segredo real (`JWT_SECRET` de `.env`). |
| 67 | `packages/auth/src/jwt.test.ts:39` | 🔴 blocker | Mesmo secret `'test-secret'` em teste `returns null for expired token`. | **descartado** | Mesmo caso de #66 — falso positivo de scanner. |
| 68 | `packages/auth/src/jwt.test.ts:54` | 🔴 blocker | Mesmo secret `'test-secret'` no lugar, com secret `'wrong-secret'` (teste de token forjado). | **descartado** | Mesmo caso de #66/#67. `'wrong-secret'` é valor de teste pra provar que token assinado com secret errado é rejeitado. |

### User-Controlled Data Reflected in Response (Blocker — Security)

| # | Arquivo:linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|
| 63 | `apps/mesas/backend/src/routes/og.ts:148` | 🔴 blocker | `return res.status(200).type('html').send(htmlNotFound)` — HTML contém `slug` de `req.params` injetado via `injectMetaTags()`. | **descartado** | Falso positivo. `injectMetaTags()` (L58-98) aplica `escapeHtml()` em todos os valores dinâmicos (title, description, imageUrl, canonicalUrl, extraProfile) antes de concatenar no HTML. `escapeHtml()` (L30-39) escapa `& < > " '`. Nenhum `req.params` vai cru para o HTML. |
| 64 | `apps/mesas/backend/src/routes/og.ts:185` | 🔴 blocker | `return res.status(200).type('html').send(htmlFallback)` — `type` e `slug` de `req.params` vão para `getFallbackMeta()`. | **descartado** | Mesmo caso de #63. `getFallbackMeta()` retorna `MetaFields` → `injectMetaTags()` → `escapeHtml()`. Seguro. |
| 65 | `apps/mesas/backend/src/routes/og.ts:205` | 🔴 blocker | `return res.status(200).type('html').send(output)` — `req.path` inteiro vai para `getFallbackMeta()`. | **descartado** | Mesmo caso de #63/#64. `req.path` → `getFallbackMeta()` → `injectMetaTags()` → `escapeHtml()`. Seguro. |

### Resumo Snyk/GHAS

| Categoria | Qtd | Status |
|---|---|---|
| Script injection (workflows) | 4 | #56–#59 — aplicados ✅ |
| Code smell (always same return) | 2 | #60 descartado, #61 aplicado ✅ |
| Hardcoded password (testes) | 4 | #62, #66–#68 — descartados (falsos positivos) |
| Reflected user data | 3 | #63–#65 — descartados (falsos positivos: `escapeHtml()` existe) |
| **Total** | **13** | **3 aplicados, 10 descartados** |

### Nota sobre falsos positivos de senha em teste

O scanner Snyk/GHAS flagga qualquer string que pareça senha em qualquer arquivo, sem distinguir teste de produção. `'test-secret'`, `'test-secret-only-for-sso'`, `'wrong-secret'` são valores de teste inofensivos — não são credenciais reais, não têm relação com `.env`, e são necessários para testar lógica de auth. **Nenhum segredo real foi exposto.**
