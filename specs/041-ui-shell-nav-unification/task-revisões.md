# 041 — Revisões de bots do PR

> **Propósito:** registrar e dar veredicto a CADA achado dos revisores automatizados (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, CodeQL, github-advanced-security, Scorecard) no PR #80. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/041-ui-shell-nav-unification`
- PR: [#80](https://github.com/FarenRavirar/artificio/pull/80)
- Checks GitHub (`lint + build + test`): pendente
- Estado das revisões: **aberto** — aguardando bots (amazon-q, codex, coderabbit, Snyk, CodeQL, Scorecard)

## Resumo do PR

**52 arquivos** (+1899/-481): `packages/ui` (Header com busca/changelog/tema/menu + hooks), `packages/config` (brand atoms), 5 consumidores (mesas/glossario/links/accounts/site), `/busca` em 4 apps, `/conta` no accounts, footer sync + auto-fix.

**Débitos fechados:** `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`

**Descobertas de execução:** 14 (D-041-01 a D-041-14), todas fechadas. Ver `tasks-2.md`.

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|
| 1 | amazon-q | `SiteHeaderIsland.tsx:106-113` | 🛑 crash | Logout fetch sem `.catch()` — erro de rede trava UX (`.then()` nunca roda) | **procede** | Certo. Raiz: código duplicava `packages/auth/client.ts:143` (canônico já tem `.catch()→.finally()`). `<a href>` caía em GET→POST quebrado. Fix: `logout(window.location.href)` canônico + `<button>` (= `Header.tsx`) | commit `(pendente)` |
| 2 | CI (lint check) | `BuscaPage.tsx:33` + `:17` | 🛑 lint error | `react-hooks/set-state-in-effect`: `buscar(q)` e `setResults([])` chamados no corpo síncrono do `useEffect` | **procede** | Correto: o rule existe p/ evitar cascading renders. Mas pattern data-fetching-in-effect é canônico. O lint não distingue async→sync. Fix robusto: `Promise.resolve().then(() => buscar(q))` sai do corpo síncrono + `ignoreRef` p/ cleanup cross-microtask. Race condition resolvida (digitação rápida não polui resultado). Sem `eslint-disable`. | commit `(pendente)` |
| 3 | CodeQL | `accounts/app.ts:165` | 🛑 DoS | `js/missing-rate-limiting`: `sendFile` + `express.static` sem rate limit — sujeito a exaustão de recursos | **procede** | Real: accounts é SSO — se cair, todos apps perdem auth. `express-rate-limit@^8.5.2` já usado em 4 apps (links, site, mesas, glossario), accounts era o ÚNICO backend sem. Global limiter 200/15min (dobro do site=100, p/ suportar tráfego cross-origin dos 5 apps). `standardHeaders: true`, `legacyHeaders: false`. Posicionado após `trust proxy` (IP real via Cloudflare Tunnel), antes de qualquer middleware/rota. | commit `(pendente)` |
| 4 | chatgpt-codex | `links/index.astro:3-19` | 🛑 build-err | 8 imports duplicados no frontmatter (ex.: `PortalHeader` importado nas linhas 3 e 12). Astro frontmatter = escopo único de módulo, duplicata bloqueia parse. | **procede** | Real: erro de edição na spec 041 (F3) ao adicionar `BRAND_*` imports — copiou bloco inteiro em vez de só a nova linha. Build passava por cache do Vite (dedup silencioso), mas é erro de sintaxe. 8 linhas removidas, diff -8. | commit `(pendente)` |
| 5 | chatgpt-codex | `links/package.json` + `server/lib/render.ts:5` | 🛑 crash-prod | `render.ts` importa `@artificio/config` mas `package.json` não declara dependência. Em Docker (install isolado) → `MODULE_NOT_FOUND` no startup do servidor. | **procede** | Real: `@artificio/config` é workspace package, resolvido por symlink em dev, mas ausente em deploy isolado (Docker). `accounts` já declara; links faltava. Adicionado `"@artificio/config": "workspace:*"` nas deps. | commit `(pendente)` |
| 6 | chatgpt-codex | `SiteHeaderIsland.tsx:42-45` + `SearchModal.astro:16-17,74` | 🛑 recursion+broken | 2 falhas encadeadas: (A) `handleSearch` clica `#search-toggle` = o próprio botão → recursão infinita (`onClick`→`.click()`→...); (B) `SearchModal.astro` usa `getElementById("search-toggle")` no load, mas elemento inexiste (React renderiza `client:idle` depois) → listener nunca anexado = botão de busca inoperante. | **procede** | Real: (A) removido `handleSearch` + `onClick` do componente React; (B) `SearchModal.astro` trocou `toggle.addEventListener` por `document.addEventListener` com `target.closest("#search-toggle")` — event delegation sobrevive ao render deferred. Botão sem React onClick não dispara recursão. | commit `(pendente)` |
| 7 | chatgpt-codex + coderabbit | `LinksSearch.tsx:17-21` | 🛑 logic-bug | GET `/api/groups?source=community` retorna envelope `{ data: rows }` (`server.ts:82`), mas código espera array top-level → `Array.isArray(data)` = false → `setGroups([])` sempre vazio. + `catch(() => {})` mascara erro de rede/HTTP. + sem normalizador tipado por item (slug/name). | **procede** | **Investigado 2026-06-21:** `server.ts:82` = `res.json({ data: rows })`. Cliente linha 19 faz `Array.isArray(data)` → `data` é `{ data: [...] }`, nunca array → SEMPRE `[]`. Contraprova: `CommunityGroups.tsx:58` (mesmo app, mesmo endpoint) já trata `"data" in groupBody` corretamente. **3 falhas:** (1) envelope — precisa extrair `body.data`; (2) normalização — cada item precisa type-guard `isGroup(item)`; (3) catch vazio — estado de erro separado p/ feedback distinto de "vazio". | commit `(pendente)` |
| 8 | chatgpt-codex + coderabbit | `accounts/main.tsx:12-26` | 🛑 logic-bug | `/conta` → redirect `/login?return=.../conta`, mas `getReturnUrl()`/`isAllowedReturnUrl` rejeita same-origin → usuário vai p/ portal em vez de voltar p/ `/conta` após login. | **procede** | **Investigado 2026-06-21:** Frontend `isAllowedReturnUrl:21` tem `url.origin !== window.location.origin` — bloqueia same-origin. Backend `app.ts:18-27` NÃO tem esse check (só verifica `*.artificiorpg.com`). Fluxo: anônimo em `/conta`→`/login?return=.../conta`→`getReturnUrl()`→origem igual→rejeita→fallback `PORTAL_URL`. Segurança já coberta por protocolo `https:` + hostname. Fix: removeu `url.origin !== window.location.origin`. | commit `(pendente)` |
| 9 | coderabbit | `BuscaPage.tsx:22-27,33` | 🟠 major | (A) Cast `(item: Termo)` sem validação runtime — payload de `/terms` é `unknown`, normalizador obrigatório (regra pétrea). (B) `.catch { setResults([]) }` mascara erro de rede como "nenhum resultado". | **procede** | **Investigado 2026-06-21:** `sanitizeTermForUi` sanitiza HTML mas não valida estrutura (id, name_*). Type-guard `isTermo(value: unknown)` adicionado — verifica `typeof value === "object"`, `id` (string|number), `name_en||nome_en` + `name_pt||nome_pt`. Linha 33 trocada de `.map((item: Termo) => ...)` p/ `.filter(isTermo).map((item) => ...)`. Estado `error` separado: `.catch` agora usa `setError(true)` em vez de `setResults([])`. UI mostra "Erro ao buscar" distinto de "Nenhum termo". | commit `(pendente)` |
| 10 | coderabbit | `accounts/main.tsx:134-141` | 🟠 major | `catch { /* noop */ }` no logout + redirect imediato mascara falha — sessão pode ficar válida no backend. | **procede** | **Investigado 2026-06-21:** Código duplicava `packages/auth/client.ts:143` (canônico tem `.catch(() => undefined).finally(() => redirect)`). Substituído por `logout(PORTAL_URL)` canônico — mesma robustez do fix #1 (SiteHeaderIsland). `handleLogout` inline removido (-7 linhas). | commit `(pendente)` |
| 11 | coderabbit | `site/busca/index.astro:24-27` | 🟠 major | `catch (e) {}` silencia falha na inicialização do PagefindUI — busca quebrada sem diagnóstico. | **procede** | **Investigado 2026-06-21:** `SearchModal.astro:56-58` (mesmo app) já tem fallback DOM visível. `busca/index.astro` alinhado: `console.error` + `host.textContent = "Não foi possível carregar a busca agora."`. | commit `(pendente)` |
| 12 | coderabbit | `site/rss.xml.ts:7` | 🟠 major | `s.replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2")` produz `yyyy-dd-mm` em vez de `yyyy-mm-dd`. Dia vira "mês" → `new Date()` invalida posts no RSS. | **procede** | **Investigado 2026-06-21:** Datas atuais são ISO (`2026-03-27T...`), código de conversão é dead path hoje. Mas bug latente: se `dd/mm/yyyy` aparecer (WP legado), `$3-$1-$2` = `2025-25-06` (mês 25→NaN→filtrado→RSS vazio). Fix: `"$3-$2-$1"` + regex `^(\d{1,2})\/(\d{1,2})\/(\d{4})$` com âncoras e quantificadores precisos. | commit `(pendente)` |
| 13 | coderabbit | `hooks.ts:5-18` | 🟡 minor | `catch { return false }` suprime qualquer erro em `localStorage.getItem/setItem`, não só `DOMException` (QuotaExceeded/SecurityError). | **procede** | **Investigado 2026-06-21:** Ambos catch suprimiam TODOS os erros. `DOMException` = esperado (storage indisponível). Outros (TypeError, ReferenceError) = bug real. Fix: `if (error instanceof DOMException) return false; throw error;` + guarda SSR `typeof window === "undefined"`. `packages/ui` → rebuild 15/15 ✅. | commit `(pendente)` |
| 14 | coderabbit | `theme.tsx:124-126` | 🟠 major | `getThemeSnapshot()`: fallback `"dark"` quando `data-theme` ausente — inversão: default do sistema (sem cookie) é `resolveTheme()`=sistema, não dark. | **procede** | **Investigado 2026-06-21:** Sem `data-theme` no `<html>`, snapshot retornava `"dark"` mas `resolveTheme():42` retorna `"light"`. Cold load sem cookie/script inline → `useSyncExternalStore` inicia com tema inconsistente → flash até re-render. Fix: `const current = dataset.theme; if (current === "light" || current === "dark") return current; return resolveTheme();`. `packages/ui` → rebuild 15/15 ✅. | commit `(pendente)` |
| 15 | coderabbit | `check-footer-sync.ts:7-19` | 🟠 major | `CANONICALS` hardcoded duplica `footer-content.ts` + `@artificio/config`. Auto-fix pode reintroduzir texto velho no `SiteFooter.astro` quando constantes oficiais mudarem. | **procede** | **Investigado 2026-06-21:** Script tinha 8 strings hardcoded que duplicavam `footer-content.ts`. Se `@artificio/config` mudar e esquecerem de atualizar script → auto-fix reverte p/ valor velho. Fix: importa `BRAND_NAME`, `BRAND_DOMAIN`, `BRAND_TAGLINE_FREE` de `../packages/config/src/brand.js` (leaf file, zero deps workspace, `tsx` resolve via path relativo). `CANONICALS` montado dinamicamente com template literals usando constantes canônicas. Script executado: "✅ Footer sincronizado". | commit `(pendente)` |
| 16 | github-advanced-security (CodeQL) | `accounts/main.tsx:49` | 🔴 High | `js/xss`: `globalThis.location.replace(returnUrl)` com valor originado de `params.get("return")` — possível XSS se valor injetar script. | **descarta (falso positivo)** | **Investigado 2026-06-21:** `getSafeReturnUrl()` (antes `getReturnUrl()`+`isAllowedReturnUrl()`) já valida via `new URL(value)` com check de protocolo `https:` + hostname `*.artificiorpg.com`. `javascript:`, `data:` e protocolos arbitrários são bloqueados pelo `url.protocol === "https:"`. Nenhum vetor XSS existe via `location.replace()` com URL validada e canonicalizada. Aplicado defesa-em-profundidade: unificadas `isAllowedReturnUrl`+`getReturnUrl` em `getSafeReturnUrl()` que retorna `url.toString()` (URL canonicalizada) + usa `BRAND_DOMAIN` (não string hardcoded). | commit `(pendente)` |
| 17 | github-advanced-security (CodeQL) | `accounts/main.tsx:49` | 🟠 Medium | `js/untrusted-url-redirect`: redirecionamento com valor de query param `?return=` sem validação suficiente. | **descarta (falso positivo)** | **Investigado 2026-06-21:** Mesmo raiz do #16. Redirect para domínio whitelisted (`https://*.artificiorpg.com`) é intencional (return URL pós-login SSO), não "untrusted". A validação `url.protocol === "https:"` + `url.hostname === BRAND_DOMAIN || url.hostname.endsWith('.'+BRAND_DOMAIN)` garante que o redirect só vai para subdomínios controlados do Artifício. Open redirect real exigiria ausência de whitelist — não é o caso. Canonicalização via `url.toString()` no fix do #16 cobre ambos os findings. | commit `(pendente)` |
| 18 | coderabbit | `SearchModal.astro:73-78` | 🟠 major | `e.target` é `EventTarget \| null`, não `Element` — chamar `.closest()`/`.hasAttribute()` sem guarda `instanceof Element` pode lançar `TypeError` se target não for Element. | **procede** | **Investigado 2026-06-21:** Embora eventos `click` no document virtualmente sempre recebam `Element` como target, a spec não garante. Fix: `if (!(target instanceof Element)) return;` antes de `.closest()`/`.hasAttribute()`. Remove também os checks `target &&` redundantes — `instanceof` já cobre `null` + não-Element. | commit `(pendente)` |
| 19 | coderabbit | `accounts/main.tsx:60-62` | 🟠 major | `catch {}` vazio no `redirectIfAlreadySignedIn()` mascara erros de rede/infra como "sem sessão" — login exibido sem diagnóstico. | **procede** | **Investigado 2026-06-21:** `fetch("/api/auth/me")` pode falhar por rede offline, DNS, 5xx. Catch vazio trata tudo como "sem sessão válida". Fix: filtra `AbortError` (cleanup esperado → return), outros erros → `console.error("Falha ao verificar sessao:", error)` + fall through para mostrar login (usuário não bloqueado). | commit `(pendente)` |

## Stale / Já resolvidos em revisões anteriores

| Review original | Motivo |
|---|---|
| coderabbit: `links/index.astro` duplicate imports | → Resolvido #4 |
| coderabbit: `SiteHeaderIsland.tsx` search recursion | → Resolvido #6 |
| coderabbit: `BuscaPage.tsx:32-34` stale results on empty q | → Código reestruturado no fix #2 (`Promise.then`+`ignoreRef`), lógica de limpeza já tratada |

## Verificações sem ação necessária

| Review | Conclusão |
|---|---|
| coderabbit: `pnpm-workspace.yaml` undici constraint `>=7.28.0 <8` | Confirmado: jsdom 29.1.1 é incompatível com undici 8.x (removeu `lib/handler/wrap-handler.js`). Nenhum pacote do workspace exige undici 8.x. Constraint correta. Documentar como débito técnico monitorado. |

## Code Smells (Sonar)

| # | Arquivo | Linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|---|
| S1 | `accounts/main.tsx` | L3 | Minor | Unused import: `resolveTheme` | **procede** | `resolveTheme` importado mas nunca chamado no arquivo. Removível. |
| S2 | `accounts/main.tsx` | L3 | Minor | Unused import: `setTheme` | **procede** | `setTheme` importado mas nunca chamado. `useTheme()` já cobre. Removível. |
| S3 | `accounts/main.tsx` | L3 | Minor | Unused import: `Theme` (type) | **procede** | Type `Theme` importado mas nunca usado como anotação. Removível. |
| S4 | `accounts/main.tsx` | L124 | Medium | Useless assignment to `theme` | **descarta** | Falso positivo. `theme` usado em `<ThemeIcon theme={theme} />` (L189). |
| S5 | `accounts/main.tsx` | L124 | Medium | Useless assignment to `toggleTheme` | **descarta** | Falso positivo. `toggleTheme` usado em `onClick={toggleTheme}` (L187). |
| S6 | `accounts/main.tsx` | L129 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.search` → `globalThis.location.search`. |
| S7 | `accounts/main.tsx` | L130 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.origin` → `globalThis.location.origin`. |
| S8 | `accounts/main.tsx` | L141 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.href` → `globalThis.location.href`. |
| S9 | `accounts/main.tsx` | L178 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.pathname` → `globalThis.location.pathname`. |
| S10 | `BuscaPage.tsx` | L47 | Major | Nested ternary (loading→error→results) | **procede** | Substituído por IIFE `if/else` (4 ramos). |
| S11 | `BuscaPage.tsx` | L55 | Major | Nested ternary (mesmo bloco) | **procede** | Mesmo bloco de S10, já coberto. |
| S12 | `LinksHeader.tsx` | L17 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.href` → `globalThis.location.href`. |
| S13 | `LinksSearch.tsx` | L52 | Major | Nested ternary (loading→error→empty) | **procede** | Substituído por IIFE `if/else`. |
| S14 | `SiteHeaderIsland.tsx` | L27 | Minor | Assertion unnecessary (`event.target as Node`) | **descarta** | TS strict mode exige o cast; `.contains()` aceita `Node | null`. Sem o cast, TS reclama. |
| S15 | `SiteHeaderIsland.tsx` | L42 | Major | Move `handleSearch` to outer scope | **stale** | Função já removida no fix #6. Análise do Sonar é pré-fix. |
| S16 | `SiteHeaderIsland.tsx` | L65 | Major | Nested ternary (loading→user→login) | **procede** | Substituído por IIFE `if/else`. |
| S17 | `SiteHeaderIsland.tsx` | L112 | Minor | Prefer `globalThis` over `window` | **procede** | `window.location.href` → `globalThis.location.href` (logout). |
| S18 | `Header.tsx` | L82 | Critical | Cognitive complexity 16 > 15 | **descarta** | `Header` é componente central com 20 props + 2 subnavs + menu + sessão. Complexidade é inerente à função, não acidental. Refatorar sem ganho real. |
| S19 | `footer-content.ts` | L13 | Minor | Use `export…from` p/ `FOOTER_BRAND` | **procede** | `export { BRAND_NAME as FOOTER_BRAND }` — re-export canônico. |
| S20 | `footer-content.ts` | L20 | Minor | Use `export…from` p/ `FOOTER_BASE_DOMAIN` | **procede** | `export { BRAND_DOMAIN as FOOTER_BASE_DOMAIN }` — re-export canônico. |
| S21 | `hooks.ts` | L6 | Minor | Prefer `globalThis` over `window` | **descarta** | SSR guard `typeof window === "undefined"`. Misturar `globalThis` quebraria (existe em Node). |
| S22 | `hooks.ts` | L15 | Minor | Prefer `globalThis` over `window` | **descarta** | Idem S21. |
| S23 | `theme.tsx` | L57 | Major | Prefer `.dataset` over `setAttribute("data-variant")` | **procede** | `el.dataset.variant = "dark"` é a API DOM canônica p/ data attributes. Mais legível e performático. |
| S24 | `theme.tsx` | L58 | Major | Prefer `.dataset` over `removeAttribute("data-variant")` | **procede** | `delete el.dataset.variant` (ou `el.dataset.variant = ""`) é a API canônica. |
| S25 | `check-footer-sync.ts` | L22 | Minor | `String.raw` p/ evitar escaping | **descarta** | `escapeRe` com `String.raw` seria `String.raw` + regex cru → mesma legibilidade. `\\$&` é idiomático em `replace`. |
| S26 | `check-footer-sync.ts` | L34 | Minor | `String.raw` p/ evitar escaping | **descarta** | Idem S25. |

**Resumo Sonar (aplicados):** 15 aplicados, 8 skip, 1 stale, 2 revertidos. Total 26 analisados, 15 corrigidos.

| # | Status | O que foi feito |
|---|---|---|
| S1 | ✅ | `resolveTheme` removido do import |
| S2 | ✅ | `setTheme` removido do import |
| S3 | ✅ | `Theme` (type) removido do import |
| S4 | skip | Falso positivo — `theme` usado em `<ThemeIcon>` |
| S5 | skip | Falso positivo — `toggleTheme` usado em `onClick` |
| S6 | ✅ | `window.location.search` → `globalThis.location.search` |
| S7 | ✅ | `window.location.origin` → `globalThis.location.origin` |
| S8 | ✅ | `window.location.href` → `globalThis.location.href` |
| S9 | ✅ | `window.location.pathname` → `globalThis.location.pathname` |
| S10 | ✅ | Nested ternary → IIFE if/else em `BuscaPage.tsx` |
| S11 | ✅ | (mesmo bloco de S10) |
| S12 | ✅ | `window.location.href` → `globalThis` em `LinksHeader.tsx` |
| S13 | ✅ | Nested ternary → IIFE if/else em `LinksSearch.tsx` |
| S14 | skip | Falso positivo — TS strict exige `as Node` p/ `.contains()` |
| S15 | stale | `handleSearch` já removido no fix #6 |
| S16 | ✅ | Nested ternary → IIFE if/else em `SiteHeaderIsland.tsx` |
| S17 | ✅ | `window.location.href` → `globalThis` em `SiteHeaderIsland.tsx` |
| S18 | skip | Cognitive complexity 16→15 exigiria refator arquitetural do `Header.tsx` |
| S19 | ✅ | `export { BRAND_NAME as FOOTER_BRAND }` (re-export) |
| S20 | ✅ | `export { BRAND_DOMAIN as FOOTER_BASE_DOMAIN }` (re-export) |
| S21 | skip | `hooks.ts` usa `typeof window === "undefined"` (SSR guard) — misturar `globalThis` quebraria |
| S22 | skip | Idem S21 |
| S23 | ✅ | `setAttribute("data-variant")` → `el.dataset.variant` |
| S24 | ✅ | `removeAttribute("data-variant")` → `delete el.dataset.variant` |
| S25 | revertido | `String.raw` + `new RegExp()` perde legibilidade vs regex literal |
| S26 | revertido | Idem S25 |

## Veredictos (legenda)
- **procede** → aplicar fix via novo commit (autorização nominal própria) e referenciar o sha.
- **descarta** → falso-positivo/decisão de design; justificar por que não se aplica.
- **fora de escopo** → procede mas não pertence ao foco do PR. **NÃO empurrar para o backlog / nada para trás.** Investigar, registrar em `tasks-2.md` desta spec e **resolver dentro da própria spec**. Linkar aqui o item de `tasks-2.md`.

## Critério de encerramento (gate de merge)
- [ ] Todos os achados com veredicto registrado.
- [ ] Todos os "procede" aplicados (commits referenciados) e checks verdes de novo.
- [ ] Mantenedor autorizou o merge nominalmente.
