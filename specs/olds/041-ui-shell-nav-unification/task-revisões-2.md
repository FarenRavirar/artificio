# 041 — Revisões de bots do PR #81

> **Propósito:** registrar e dar veredicto a CADA achado dos revisores automatizados (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, CodeQL, github-advanced-security, Scorecard) no PR #81. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/041-ui-shell-nav-unification`
- PR: [#81](https://github.com/FarenRavirar/artificio/pull/81)
- Commit: `47dce57`
- Checks GitHub (`lint + build + test`): pendente
- Estado das revisões: **aberto** — aguardando bots

## Resumo do PR

**25 arquivos** (+829/-518): changelog cross-app — `changelogs.json` nos 4 apps, `<ChangelogModal>` centralizado em `packages/ui`, glossario migrado de DB para JSON, auditoria fixes.

**Débitos fechados:** `BL-GLOSSARIO-CHANGELOG-JSON`

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|
| 23 | amazon-q | `changelogController.ts:26` | 🛑 security | Path traversal risk: `join(__dirname, '../..', 'database', 'changelogs.json')` com múltiplos argumentos permite directory traversal se `__dirname` for manipulado. Sugere `join(__dirname, '../../database/changelogs.json')`. | **procede** ✅ `(pendente)` | Cosmético, mas aplicar. `path.join` com múltiplos argumentos é API canônica (não vulnerabilidade real — `__dirname` é constante de build), mas a sugestão unifica em string única. Resultado funcional idêntico. Absorvido pelo fix do #28 (path será corrigido no mesmo local). | `join(__dirname, '../../database/changelogs.json')` |
| 24 | amazon-q | `changelogController.ts:42-45` | 🛑 logic | Type validation gap: `.filter()` verifica `published`, `id`, `title`, `body` mas não valida `type`. Entradas com `type` inválido passam e quebram badges no frontend. Sugere adicionar `(entry.type === 'app' \|\| entry.type === 'dados')`. | **procede** ✅ `(pendente)` | Real, mas baixa severidade. Dados vêm de JSON próprio (não input externo). Frontend é defensivo: ternary `log.type === "dados" ? ... : ...` cai em branch "app" para qualquer valor não-dados — sem crash, só badge errado. Adicionar `type` no `.filter()` é correção barata e melhora consistência. | — |
| 25 | amazon-q | `changelogController.ts:42-45` | 🛑 crash | Missing `created_at` validation: `.sort()` usa `new Date(b.created_at).getTime()` sem validar que `created_at` existe ou é string de data válida. Datas inválidas → `Invalid Date`/`NaN` → ordenação quebrada. Sugere adicionar `entry.created_at` no `.filter()`. | **procede** ✅ `(pendente)` | Real. `new Date(undefined).getTime()` = `NaN`, `NaN - NaN` = `NaN` → sort instável. Entradas vêm de JSON próprio, mas validação é defesa barata. `typeof entry.created_at === 'string'` no `.filter()` resolve. | — |
| 26 | amazon-q | `ChangelogModal.tsx:36-38` | 🛑 logic | Invalid date string handling: `new Date(log.created_at).toLocaleDateString("pt-BR")` sem validar a string de data. Datas inválidas → `"Invalid Date"` como chave de agrupamento → timeline quebrada. Sugere `isNaN(date.getTime())` guard antes do agrupamento. | **procede** ✅ `(pendente)` | Real. Modal recebe dados de 3 fontes (API glossario, API mesas, JSON import site/links). Se qualquer fonte enviar `created_at` malformado, todas as entradas ruins agrupam sob chave `"Invalid Date"` poluindo a timeline. `isNaN(date.getTime())` → skip no `for...of` (ver #36) resolve. | — |
| 27 | CodeQL | `changelogRoutes.ts:6` | 🔴 high | Missing rate limiting: `router.get('/', getChangelogs)` acessa filesystem (`readFile` em `changelogs.json`) sem rate-limit. | **procede** ✅ `(pendente)` | Real. Glossario backend não tinha rate limiter global. CodeQL flag correto. Accounts já tem `rateLimit({ windowMs: 15*60*1000, max: 200, standardHeaders: true, legacyHeaders: false })` global. Aplicado mesmo padrão no `index.ts` (após `trust proxy`, antes das rotas). | — |
| 28 | chatgpt-codex | `changelogController.ts:26` | 🛑 crash | Path errado em produção: `__dirname` compilado = `dist/controllers`, `../..` = `backend/`, mas `changelogs.json` está em `database/` (fora de `backend/`). Dockerfile só copia `backend/dist` + package metadata → `changelogs.json` não vai p/ imagem → `ENOENT` em dev/prod → modal mostra erro. | **procede** ✅ `(pendente)` | **CRÍTICO. Corrigido.** Path trocado para 3 níveis (`../../../database/`) — resolve para `apps/glossario/database/changelogs.json` em dev (tsx) e prod (Docker). Dockerfile: adicionado `COPY --from=builder /repo/apps/glossario/database/changelogs.json ./apps/glossario/database/changelogs.json`. Verificado: `existsSync` true no path dev. | — |
| 29 | coderabbit | `project-state.md:20` | 🟡 minor | Divergência Sonar: resumo fala "16 Sonar aplicados" mas `task-revisões.md` fecha 15 corrigidos. Alinhar total ou explicitar revertido. | **procede** ✅ `(pendente)` | Corrigido. `project-state.md:20` e `tasks.md:227` atualizados de "16" para "15 Sonar aplicados (17 itens, S10+S11 e S23+S24 agrupados)". | — |
| 30 | coderabbit | `changelogController.ts:42-45` | 🟡 minor | Schema incompleto: `.filter()` não valida `type` nem `created_at`. Payload externo pode ter entradas malformadas quebrando UI downstream. | **procede** ✅ `(pendente)` | Redundante com #24 + #25. Já aplicado: `.filter()` agora inclui `entry.type` e `entry.created_at`. | — |
| 31 | coderabbit | `glossario/ChangelogModal.tsx:35,54` | 🟠 major | State sem normalização: `setLogs(Array.isArray(response.data) ? response.data : [])` — só verifica `Array.isArray`, não valida formato dos itens. Viola regra pétrea de normalização. | **procede** ✅ `(pendente)` | Corrigido. `isChangelogEntry()` + `normalizeChangelogEntries()` adicionados a `packages/ui/src/changelog.ts`. Glossario `ChangelogModal.tsx` importa `normalizeChangelogEntries` de `@artificio/ui` e usa em `setLogs(normalizeChangelogEntries(response.data))` nos 2 pontos (fetch inicial + retry). Reutilizável por #33 + #34 + #35. | — |
| 32 | coderabbit | `glossario/ChangelogModal.tsx:15` | 🟠 major | Cast inseguro: `changelogs as ChangelogEntry[]` sem normalização. | **procede** ✅ `(pendente)` | Coderabbit atribuiu ao arquivo errado (patch mostra `import changelogs from "../data/changelogs.json"` — padrão site/links). Glossario usa `api.get()`, não JSON import. Preocupação real, alvo correto: `SiteChangelogModal.tsx:15` + `LinksChangelogModal.tsx:15` → resolvido via #34 com `normalizeChangelogEntries()`. | — |
| 33 | coderabbit | `mesas/ChangelogModal.tsx:67,93` | 🟠 major | State sem normalização por item: `setLogs(Array.isArray(data) ? data : [])` deixa objetos inválidos entrarem. Sugere `normalizeChangelogList()` + `normalizeChangelogEntry()`. | **procede** ✅ `(pendente)` | Corrigido. Mesas `ChangelogModal.tsx` importa `normalizeChangelogEntries` de `@artificio/ui`. Dois `setLogs` (fetch inicial + retry) trocados para `setLogs(normalizeChangelogEntries(data))`. | — |
| 34 | coderabbit | `site/SiteChangelogModal.tsx:15`, `links/LinksChangelogModal.tsx:15` | 🟠 major | Cast direto: `changelogs as ChangelogEntry[]` sem normalização. JSON import é `unknown` → cast mascara risco. Viola regra pétrea. | **procede** ✅ `(pendente)` | Corrigido. Ambos wrappers: `import rawChangelogs` + `const changelogs = normalizeChangelogEntries(rawChangelogs)` em escopo de módulo. Sem cast, sem type import desnecessário. | — |
| 35 | coderabbit | `packages/ui/ChangelogModal.tsx:172` | 🟠 major | Props sem normalização runtime: `log.body.length` (linha 172) assume `body` é string. Se caller passar payload inválido, quebra em runtime. | **procede** ✅ `(pendente)` | Corrigido. `ChangelogModal` importa `normalizeChangelogEntries` de `./changelog.js`. Prop `changelogs` normalizado em `const safeChangelogs = normalizeChangelogEntries(changelogs)` antes de `.reduce()`/`.length`. Safety net para todos os consumidores. | — |
| 36 | coderabbit | `packages/ui/ChangelogModal.tsx:29,34` | 🟠 major | Padrões proibidos: `.reduce()` (linha 34, agrupamento por data) + spread `{...DEFAULT, ...custom}` (linha 29, merge de labels). Regra pétrea: proibido `.reduce`/spread sobre payload externo. | **procede** ✅ `(pendente)` | Corrigido. (1) Labels: spread substituído por merge explícito campo-a-campo com `??`. (2) Agrupamento: `.reduce()` substituído por `for...of` com acumulador manual + `continue` para datas inválidas. | — |
| 37 | coderabbit | `packages/ui/ChangelogModal.tsx:48-55,94-96` | 🟠 major | Acessibilidade incompleta: falta `role="dialog"`, `aria-modal="true"`, `aria-labelledby` no `<h2>`, `onKeyDown` Escape, `tabIndex={-1}`. Viola Nielsen/ISO 9241-11. | **procede** ✅ `(pendente)` | Corrigido. Div interna ganhou `role="dialog" aria-modal="true" aria-labelledby="changelog-modal-title" onKeyDown` Escape → `onClose()` `tabIndex={-1}`. `<h2>` ganhou `id="changelog-modal-title"`. Cobre também S37-S40 (Sonar a11y). | — |
| 38 | coderabbit | `sessoes/...26-06-21_4...md:97` | 🟡 minor | Critério desatualizado: fecha em "D-041-01 a D-041-20" mas D-041-20 não existe e `tasks-2.md` tem D-041-21. | **procede** ✅ `(pendente)` | Corrigido. Sessão atualizada: "D-041-01 a D-041-19, D-041-21" + "15 Sonar aplicados" (alinhado com #29). | — |
| 39 | coderabbit | `specs/.../tasks.md:244` | 🟡 minor | F9 não listava D-041-21 (useTheme SSR, descoberto durante auditoria T9.7). | **procede** ✅ `(pendente)` | Corrigido. F9 agora lista "(D-041-16 a D-041-19, D-041-21)" e menciona D-041-21 como descoberta de T9.7. | — |

## Code Smells (Sonar)

| # | Arquivo | Linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|---|
| S27 | `changelogController.ts` | L2 | Medium | Prefer `node:fs/promises` over `fs/promises` (consistency) | **procede** ✅ | `import { readFile } from 'node:fs/promises'` |
| S28 | `changelogController.ts` | L3 | Medium | Prefer `node:path` over `path` (consistency) | **procede** ✅ | `import { join } from 'node:path'` |
| S29 | `glossario/ChangelogModal.tsx` | L18 | Low | Mark the props of the component as read-only | **procede** ✅ | `readonly` em `isOpen` e `onClose` |
| S30 | `links/LinksChangelogModal.tsx` | L10 | Low | Mark the props of the component as read-only | **procede** ✅ | `readonly` em `isOpen` e `onClose` |
| S31 | `links/LinksHeader.tsx` | L2 | Low | `@artificio/ui` imported multiple times — merge into single import | **procede** ✅ | `import { Header, useChangelogBadge, type Theme, type UserMenuItem }` unificado |
| S32 | `mesas/ChangelogModal.tsx` | L40 | Medium | Do not use Array index in keys (`key={`e-${lineIndex}`}`) | **procede** ✅ | `key={`e-${lineIndex}-${line.length}`}` — inclui conteúdo |
| S33 | `mesas/ChangelogModal.tsx` | L43 | Medium | Do not use Array index in keys (`key={`l-${lineIndex}`}`) | **procede** ✅ | `key={`l-${lineIndex}-${line.slice(0, 10)}`}` — inclui partial content |
| S34 | `mesas/ChangelogModal.tsx` | L47 | Low | Mark the props of the component as read-only | **procede** ✅ | `readonly` em `isOpen` e `onClose` |
| S35 | `site/SiteChangelogModal.tsx` | L10 | Low | Mark the props of the component as read-only | **procede** ✅ | `readonly` em `isOpen` e `onClose` |
| S36 | `packages/ui/ChangelogModal.tsx` | L18 | Low | Mark the props of the component as read-only | **procede** ✅ | `readonly` nos 8 campos de `ChangelogModalProps` |
| S37 | `packages/ui/ChangelogModal.tsx` | L48 | Major | Avoid non-native interactive elements — `<div onClick={onClose}>` backdrop | **procede** ✅ | Coberto por #37 (a11y dialog) |
| S38 | `packages/ui/ChangelogModal.tsx` | L48 | Minor | Visible non-interactive w/ click must have keyboard listener — backdrop | **procede** ✅ | `onKeyDown` Escape adicionado ao backdrop |
| S39 | `packages/ui/ChangelogModal.tsx` | L52 | Major | Avoid non-native interactive elements — inner `<div onClick={stopPropagation}>` | **procede** ✅ | Coberto por #37 (a11y dialog) |
| S40 | `packages/ui/ChangelogModal.tsx` | L52 | Minor | Visible non-interactive w/ click must have keyboard listener — inner div | **procede** ✅ | Coberto por #37 (a11y dialog) |
| S41 | `packages/ui/ChangelogModal.tsx` | L216 | Critical | Refactor to not nest functions more than 4 levels deep — `setExpandedLogs((prev) => ({...prev}))` dentro de `.map()` dentro de JSX | **procede** ✅ | Extraído `toggleExpand` via `useCallback` com `for...in` explícito (sem spread). `onClick` chama `() => toggleExpand(log.id)`. |

## Auditoria independente (pós-implementação)

| # | Severidade | Arquivo:linha | Achado |
|---|---|---|---|
| F1 | 🟠 medium | glossario/site/links `ChangelogModal` | `**bold**` renderizado como texto literal — só mesas tem `renderBody` markdown | ✅ | `renderMarkdown` movido para `ChangelogModal.tsx`, exportado, tornado default (fallback de `renderBody`). 4 apps herdam bold automaticamente. |
| F2 | 🟠 medium | `mesas/ChangelogModal.tsx:93` | `retry` pula `normalizeChangelogEntries` (usa `Array.isArray` cru) | ✅ | Resolvido por `useChangelogData` — hook encapsula normalização + AbortController + estados |
| F3 | 🟠 medium | `glossario/ChangelogModal.tsx:54` | `retry` pula `normalizeChangelogEntries` (idem F2) | ✅ | Idem F2 |
| F4 | 🟠 medium | `glossario/ChangelogModal.tsx:53` | `retry` sem `AbortController` — request não cancelável ao fechar modal | ✅ | Idem F2 |
| F5 | 🟠 medium | `mesas/ChangelogModal.tsx:86` | `retry` sem `AbortController` — idem F4 | ✅ | Idem F2 |
| F3 | 🟠 medium | `glossario/ChangelogModal.tsx:54` | `retry` pula `normalizeChangelogEntries` (idem F2) | ✅ | Idem F2 — `useChangelogData` |
| F4 | 🟠 medium | `glossario/ChangelogModal.tsx:53` | `retry` sem `AbortController` — request não cancelável ao fechar modal | ✅ | Idem F2 |
| F5 | 🟠 medium | `mesas/ChangelogModal.tsx:86` | `retry` sem `AbortController` — idem F4 | ✅ | Idem F2 |
| F6 | 🟠 medium | `mesas/backend/changelog.ts:39` | Filtro menos restrito que glossario — não valida `type`/`created_at` | ✅ | `.filter()` alinhado: adicionado `log.created_at` e `(log.type === 'app' \|\| log.type === 'dados')` |
| F7 | 🟡 low | `mesas/ChangelogModal.tsx:43` | Key collision: `line.slice(0,10)` pode colidir entre linhas idênticas | ✅ | Trocado para `line.length` (mais único que prefixo de 10 chars). Aplicado na versão compartilhada (`ChangelogModal.tsx`). |
| F8 | 🟡 low | `LinksHeader.tsx:18-24` | `MutationObserver` manual duplica `useTheme()` de `packages/ui` | ✅ | Fechado via F2-01 — `useTheme()` SSR-safe + LinksHeader unificado |
| F9 | 🟡 low | `mesas/backend/changelog.ts:2` | `fs/promises` sem prefixo `node:` (glossario já usa) | ✅ | `'fs/promises'` → `'node:fs/promises'` + `'path'` → `'node:path'` |
| F10 | 🟡 low | `ChangelogModal.tsx:110` | Escape handler duplicado (backdrop + dialog) → `onClose` 2× | ✅ | Removido `onKeyDown` Escape do backdrop. Dialog interno já trata. |
| F12 | 🟡 low | `changelogController.ts:5-12` | `ChangelogEntry` interface duplicada (backend vs `packages/ui`) | 📋 documentado | Backend não pode importar de `packages/ui` (Node vs React). Duplicação é necessária. Monitorar drift se o tipo shared mudar. |
| F13 | ⚪ cosmetic | `mesas/ChangelogModal.tsx:1` | Mixed runtime + type imports em uma linha | ✅ | Refatorado: arquivo agora só importa `useCallback` de `react` (hook eliminou useEffect/useState). |
| F14 | 🟡 low | `glossario/frontend/.env` | `VITE_API_URL` ausente — novo consumidor `api.get("/changelog")` depende do fallback `localhost:3000` | 📋 documentado | Pré-existente, não introduzido pela spec 041. Fallback funciona em dev; em produção Docker, nginx faz proxy same-origin (a API está no mesmo container). Verificar em deploy beta. |

## Auditoria secundária (pós-correções F1-F14)

| ID | Severidade | Arquivo:linha | Achado | Status |
|---|---|---|---|---|
| F2-01 | 🟠 medium | `LinksHeader.tsx:16-26` | `MutationObserver` manual — deveria usar `useTheme()` de `packages/ui` | ✅ | `useTheme()` ganhou `getServerThemeSnapshot` (3º arg `useSyncExternalStore`). `LinksHeader` refatorado: `useEffect`+`MutationObserver`+`useState<Theme>` removidos → `const { theme } = useTheme()`. Fecha F8 + D-041-21. |
| F2-02 | 🟡 low | `hooks.ts:53,76` | Mismatch abort: hook captura `DOMException`/`AbortError` mas axios (glossario) lança `AxiosError`/`ERR_CANCELED`; `retry` sem guarda de unmount | ✅ | `cancelledRef` unificado (substitui `let cancelled` local). `retry` reseta ref + checa após await. Removido check de `DOMException` — `cancelledRef` cobre fetch e axios. |
| F2-03 | ⚪ very low | `ChangelogModal.tsx:8` | `let match` sem tipo explícito (inferido `any`) | ✅ | `let match: RegExpExecArray \| null;` |
| F2-04 | ⚪ very low | `mesas/backend/changelog.ts:8` | Cache `any[]` vs interface tipada — inconsistente com glossario | ✅ | Interface `ChangelogEntry` local adicionada. Cache tipado `ChangelogEntry[]`. `.filter()`/`.sort()` sem `any`. |
| F2-05 | ⚪ very low | glossario `:50` vs mesas `:47` | Formato de resposta divergente: array puro vs `{data: [...]}` | 📋 documentado | Intencional. Cada consumer (glossario axios `.data`, mesas `fetch` + desempacotamento) lida com seu formato. |
| F2-06 | ⚪ very low | ambos backends `.filter()` | `.published` truthy em vez de `=== true` — inconsistente com `isChangelogEntry` | ✅ | `entry.published === true` em ambos backends |
| F2-07 | ⚪ very low | ambos backends `.sort()` | Sem validação de formato `created_at` no backend sort | ✅ | `!isNaN(new Date(entry.created_at).getTime())` adicionado ao `.filter()` em ambos backends |
| F2-08 | ⚪ very low | `ChangelogModal.tsx:80-91` | `toggleExpand` faz `for...in` manual O(n) em vez de spread `{...prev}` (state local, não payload externo) | ✅ | Spread `{...prev, [logId]: !prev[logId]}` (state local React, spread permitido) |

## Auditoria de tema (unificação atômica)

| ID | Severidade | Arquivo:linha | Achado | Status |
|---|---|---|---|---|
| F2-09 | 🟠 medium | `site/SiteHeaderIsland.tsx:29-32` | Lê `dataset.theme` direto em `useEffect` estático (não reativo a toggle). Não usa `useTheme()`. | ✅ | `const { theme } = useTheme()` + `useEffect(() => applyHeaderVariant(theme), [theme])` — reativo a mudanças de tema. |
| F2-10 | 🟡 low | `mesas/frontend/src/main.tsx:25-29` | Reimplementa `resolveTheme()` próprio com fallback `"dark"` (D067). Não usa `applyTheme()` canônico. | 📋 documentado | Fallback `"dark"` é intencional (D067 — mesas operacional/dark, ignora OS-prefers). `applyTheme()` canônico usa fallback `"light"` → conflito. Boot script vanilla JS necessário (pré-React). |
| F2-11 | ⚪ very low | `site/Base.astro:54-69` | Anti-flash vanilla JS duplica `resolveTheme()` — inevitável (pré-React), mas fallback `"light"` inconsistente com mesas `"dark"` (D067) | 📋 documentado |
| F2-12 | ⚪ very low | `links/Base.astro:34-46` | Anti-flash vanilla JS duplica `resolveTheme()` — inevitável. OK. | 📋 documentado |

## Auditoria terciária (3ª rodada)

| ID | Severidade | Arquivo:linha | Achado | Status |
|---|---|---|---|---|
| F3-01 | 🟠 medium | `hooks.ts:71-89` | `retry` cria `AbortController` órfão — race condition: fetch órfão pode sobrescrever state fresco ao reabrir modal | ✅ | `controllerRef` compartilhado entre `useEffect` e `retry`. Retry aborta controller anterior. Cleanup aborta + limpa ref. Sem fetch órfão. |
| F3-02 | 🟡 low | `theme.tsx:92-116` | `ThemeToggle` usa `useState` próprio, não `useTheme` — ícone stale em mudanças externas de tema | ✅ | `ThemeToggle` refatorado: `const { theme, toggleTheme } = useTheme()`. Remove `useState`/`useEffect`/`toggle()` próprios. Ícone reativo a mudanças externas. |
| F3-03 | 🟡 low | site/links `ChangelogModal` | `published: false` não filtrado por `normalizeChangelogEntries` — drafts podem vazar na UI | ✅ | `isChangelogEntry` alterado: `typeof rec.published === "boolean"` → `rec.published === true`. Alinhado com backends. |
| F3-04 | 🟡 low | `changelog.ts:23-30` | `normalizeChangelogEntries` não ordena por `created_at` — ordem errada para apps com JSON direto | ✅ | `.sort()` descendente por `created_at` adicionado, alinhado com backends. |
| F3-05 | 🟡 low | `hooks.ts:51` | Resposta não-array do `fetcher` silenciada como lista vazia — mascara bugs de API | ✅ | `console.warn` adicionado em `normalizeChangelogEntries` quando payload não-nulo não é array. |
| F3-06 | 🟡 low | `ChangelogModal.tsx:6-41` | `renderMarkdown` achata parágrafos — `\n\n` não gera espaçamento entre blocos | ✅ | Linhas vazias puladas (`continue`). Divs ganham `mb-1 last:mb-0`. `for...of` substitui `.map()`. Retorna fragmento direto. |

## Veredictos (legenda)
- **procede** → aplicar fix via novo commit (autorização nominal própria) e referenciar o sha.
- **descarta** → falso-positivo/decisão de design; justificar por que não se aplica.
- **fora de escopo** → procede mas não pertence ao foco do PR. **NÃO empurrar para o backlog / nada para trás.** Investigar, registrar em `tasks-2.md` desta spec e **resolver dentro da própria spec**. Linkar aqui o item de `tasks-2.md`.

## Resumo da investigação

| # | Veredicto | Severidade real | Bloco |
|---|---|---|---|
| 23 | procede | cosmética | `changelogController.ts` — string única (absorvido: path final = `../../../` via #28) |
| 24 | procede | baixa | `changelogController.ts` — adicionar `type` ao `.filter()` |
| 25 | procede | baixa | `changelogController.ts` — adicionar `created_at` ao `.filter()` |
| 26 | procede | média | `ChangelogModal.tsx` — guard `isNaN(date)` no agrupamento |
| 27 | procede | alta | `index.ts` — rate limiter global no glossario (como accounts) |
| 28 | procede | **crítica** | `changelogController.ts` path + `Dockerfile` copy — rota quebrada em dev E prod |
| 29 | procede | baixa (docs) | `project-state.md` + `tasks.md` — corrigir "16" → "15" |
| 30 | procede | baixa | Idem #24 + #25 (redundante) |
| 31 | procede | média | `glossario/ChangelogModal.tsx` — normalizador antes de `setLogs()` |
| 32 | procede | média | Redundante com #34 — normalizador nos wrappers site/links |
| 33 | procede | média | `mesas/ChangelogModal.tsx` — normalizador antes de `setLogs()` |
| 34 | procede | média | `site/SiteChangelogModal.tsx` + `links/LinksChangelogModal.tsx` — normalizador do JSON import |
| 35 | procede | baixa | `packages/ui/ChangelogModal.tsx` — normalização defensiva interna |
| 36 | procede | média | `packages/ui/ChangelogModal.tsx` — `for...of` + merge explícito |
| 37 | procede | média | `packages/ui/ChangelogModal.tsx` — a11y dialog |
| 38 | procede | baixa (docs) | `sessoes/` — corrigir intervalo D-041 |
| 39 | procede | baixa (docs) | `tasks.md` F9 — incluir D-041-21 no escopo |
| S27 | procede | Medium | `changelogController.ts` — `node:fs/promises` |
| S28 | procede | Medium | `changelogController.ts` — `node:path` |
| S29 | procede | Low | `glossario/ChangelogModal.tsx` — props read-only |
| S30 | procede | Low | `links/LinksChangelogModal.tsx` — props read-only |
| S31 | procede | Low | `links/LinksHeader.tsx` — merge duplicate imports |
| S32 | procede | Medium | `mesas/ChangelogModal.tsx` — no array index in keys L40 |
| S33 | procede | Medium | `mesas/ChangelogModal.tsx` — no array index in keys L43 |
| S34 | procede | Low | `mesas/ChangelogModal.tsx` — props read-only |
| S35 | procede | Low | `site/SiteChangelogModal.tsx` — props read-only |
| S36 | procede | Low | `packages/ui/ChangelogModal.tsx` — props read-only |
| S37 | procede | Major | `packages/ui/ChangelogModal.tsx` — non-native interactive L48 (→ #37) |
| S38 | procede | Minor | `packages/ui/ChangelogModal.tsx` — click sem keyboard L48 (backdrop) |
| S39 | procede | Major | `packages/ui/ChangelogModal.tsx` — non-native interactive L52 (→ #37) |
| S40 | procede | Minor | `packages/ui/ChangelogModal.tsx` — click sem keyboard L52 (→ #37) |
| S41 | procede | Critical | `packages/ui/ChangelogModal.tsx` — nesting >4 níveis L216 |

**Totais:** 17 reviews + 15 Sonar = 32 implementados. + 14 auditoria. 0 descartados.

### Achados agrupáveis (mesma correção)
- **Bloco A — Filtro do backend:** #24 + #25 + #30 → 1 `.filter()` estendido em `changelogController.ts:42`
- **Bloco B — Normalização nos consumidores:** #31 + #33 + #34 → normalizador `isChangelogEntry()` compartilhado + aplicado em 4 consumidores
- **Bloco C — Normalização defensiva no shared:** #35 → normalizador interno no `ChangelogModal` (safety net)
- **Bloco D — Regras de código no shared:** #26 + #36 → `for...of` substitui `.reduce()` (já cobre #26)
- **Bloco E — Acessibilidade:** #37 + S37 + S38 + S39 + S40 → atributos ARIA + Escape + keyboard listeners + role
- **Bloco F — Infra/rate-limit:** #27 → rate limiter global glossario
- **Bloco G — Path/Dockerfile (crítico):** #28 → corrigir caminho + Dockerfile copy
- **Bloco H — Documentação:** #29 + #38 + #39 → corrigir contagens Sonar e D-041
- **Bloco I — node: imports:** S27 + S28 → `node:fs/promises` + `node:path`
- **Bloco J — Props read-only:** S29 + S30 + S34 + S35 + S36 → `Readonly<Props>` nos 5 componentes
- **Bloco K — Import duplicado:** S31 → merge imports em `LinksHeader.tsx`
- **Bloco L — Array index keys:** S32 + S33 → chaves únicas em `renderMarkdown` do mesas
- **Bloco M — Auditoria (retry divergente):** F2 + F3 + F4 + F5 → normalização + AbortController nos `retry` de glossario/mesas
- **Bloco N — Auditoria (markdown):** F1 → `renderBody` markdown nos wrappers glossario/site/links
- **Bloco O — Auditoria (filtro mesas):** F6 → alinhar `.filter()` do mesas backend com glossario
- **Bloco P — Auditoria (low/cosmético):** F7 + F8 + F9 + F10 + F11 + F12 + F13 + F14

## Critério de encerramento (gate de merge)
- [ ] Todos os achados com veredicto registrado.
- [ ] Todos os "procede" aplicados (commits referenciados) e checks verdes de novo.
- [ ] Mantenedor autorizou o merge nominalmente.
