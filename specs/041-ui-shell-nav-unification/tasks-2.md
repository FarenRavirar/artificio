# 041 — Tasks 2: descobertas durante a execução (resolver DENTRO da spec)

> **Regra desta spec (mantenedor 2026-06-21): nada para trás.** Tudo que a execução revelar — bug, regressão, comportamento estranho, débito tocado, achado de revisão "fora de escopo", efeito colateral de uma mudança de código — é **investigado, registrado AQUI e resolvido dentro desta spec**. Proibido empurrar para `specs/backlog.md` ou "outra spec/depois". Backlog só recebe item se o mantenedor decidir explicitamente adiar (e mesmo assim o registro de investigação fica aqui).
>
> Este arquivo é um **log vivo**: a IA executora adiciona uma entrada assim que descobre algo, no mesmo turno, com evidência. Cada entrada vira trabalho a fechar antes do PR poder fechar.

## Como registrar (uma entrada por descoberta)

```
### D-041-NN — <título curto>
- Origem: <fase/tarefa/arquivo:linha ou run/comando que revelou>
- Evidência: <comando + saída, trecho, erro exato entre crases, screenshot/URL>
- Escopo: <app/pacote afetado; é regressão da minha mudança ou pré-existente?>
- Causa-raiz: <diagnóstico, não chute>
- Ação: <fix aplicado nesta spec / em andamento> — arquivo(s) + resultado de teste
- Status: aberto | corrigido (testes verdes) | aguardando decisão do mantenedor
```

Regras de preenchimento:
- **Erro = corrigir agora** dentro da spec; se não der, **PARAR e perguntar** ao mantenedor (oferecendo a opção de adiar, decisão dele).
- Proibido mascarar (`.skip`/`@ts-ignore`/`continue-on-error`) para "passar".
- Se a descoberta for pré-existente (não causada pela 041), corrigir mesmo assim — monorepo é um projeto só, "fora de escopo" não isenta. Marcar como pré-existente na entrada.
- Toda entrada precisa fechar (testes verdes) **antes** do gate de merge (Fase 8 / `task-revisões.md`).

## Gate de fechamento
- [x] Toda entrada deste arquivo com Status `corrigido (testes verdes)` ou `aguardando decisão do mantenedor` (explícita).
- [x] Nenhuma descoberta deixada só no chat / na cabeça da IA / empurrada ao backlog sem decisão do mantenedor.

**Status final (2026-06-21):** 14 descobertas, todas fechadas. **Aguardando Fase 8** (commit + PR + revisões de bots). Após merge, se revisões gerarem novos achados, registrar em `task-revisões.md`.

---

## Descobertas

### D-041-01 — `applyHeaderVariant` já absorvido (sem duplicação)
- Origem: Fase 1, `packages/ui/src/theme.tsx:54`
- Evidência: Fix local pré-existente de `BL-UI-THEME-REACT-HEADER-VARIANT` já incluía `applyHeaderVariant` em `setTheme()` e `applyTheme()`. Nenhuma mudança necessária além do que já estava no working tree.
- Escopo: `packages/ui`; pré-existente (já estava no diff local)
- Causa-raiz: O fix anterior já era correto e completo. T1.3 = sem ação nova de código.
- Ação: Nenhuma — consolidado. Tema central (`ThemeToggle`) chama `setTheme()` que chama `applyHeaderVariant`.
- Status: corrigido (testes verdes)

### D-041-02 — Ícones inline SVG (sem lucide-react em `packages/ui`)
- Origem: Fase 1, `Header.tsx`
- Evidência: `packages/ui` não tem dependência `lucide-react`. `ThemeIcon` usa SVGs inline. `HeaderAction` em `primitives.tsx` aceita `children` (ícone é injetado pelo app).
- Escopo: `packages/ui`; decisão de implementação
- Causa-raiz: Adicionar `lucide-react` como dep de `packages/ui` seria nova dependência desnecessária.
- Ação: Ícones de busca (lupa) e changelog (raio) como SVG inline no `Header.tsx`, mesmo padrão de `ThemeIcon`.
- Status: corrigido (build verde)

### D-041-03 — `useSyncExternalStore` para tema reativo no mesas
- Origem: Fase 2, `apps/mesas/frontend/src/components/AppShell.tsx`
- Evidência: `tsc` falhou: `setThemeState` declarada mas não usada. Com `showThemeToggle`, o estado de tema vive dentro do `ThemeToggle` (Header central) e `setTheme()` atualiza `data-theme` no `<html>`. Mas `AppShell` ainda precisa do valor de `theme` para `variant` do Header/Footer.
- Escopo: `apps/mesas`; regressão da minha mudança (remover themeBtn manual quebrou o `variant`)
- Causa-raiz: `useState<Theme>(initialTheme)` inicializava mas nunca atualizava ao trocar tema via toggle central.
- Ação: Substituído por `useSyncExternalStore` + `MutationObserver` em `data-theme` no `<html>`. Reativo a qualquer toggle (central ou outro).
- Status: corrigido (build ✅, test 19/19 ✅, lint ✅)

### D-041-04 — Changelog movido de `HeaderActions` para `AppShell` no mesas
- Origem: Fase 2, `HeaderActions.tsx` → `AppShell.tsx`
- Evidência: `HeaderActions.tsx` continha changelog (botão+modal+badge) + NotificationBell. Com `showChangelog`/`onOpenChangelog` no Header central, o changelog precisava do estado no nível do AppShell (fora de `HeaderActions`).
- Escopo: `apps/mesas`; refatoração para centralizar
- Causa-raiz: O contrato central exige que o estado do changelog (isOpen, hasNewUpdate) viva onde as props são passadas ao Header.
- Ação: Estado/modal de changelog movido para `AppShell.tsx`. `HeaderActions.tsx` simplificado para só `NotificationBell` (sino para logados, null para deslogados).
- Status: corrigido (build ✅)

### D-041-05 — Astro `client:load` não serializa funções → wrapper React p/ links
- Origem: Fase 3, `apps/links/src/components/PortalHeader.astro`
- Evidência: Astro serializa props de ilhas React via JSON. `onSearch`/`onOpenChangelog` são funções, não serializáveis. `<Header client:load onSearch={fn}>` quebraria na hidratação.
- Escopo: `apps/links`; decisão de implementação
- Causa-raiz: O contrato de props do `Header` usa callbacks, mas o consumidor Astro (`PortalHeader.astro`) precisa de handlers client-side que não podem vir do template `.astro`.
- Ação: Criado `LinksHeader.tsx` (componente React wrapper) que importa `Header` e provê os handlers (`onSearch`→`window.location.href='/busca'`). `PortalHeader.astro` usa `<LinksHeader client:load />`.
- Status: corrigido (build ✅)

### D-041-06 — glossario renomeia `/profile`→`/perfil` com redirect
- Origem: Fase 3, T3.1, `apps/glossario/frontend/src/App.tsx:282`
- Evidência: Rota legada `/profile` → renomeada para `/perfil` (uniformização cross-app: mesas já usa `/perfil`). Links salvos em `/profile` quebrariam sem redirect.
- Escopo: `apps/glossario`; mudança planejada na spec
- Causa-raiz: Uniformização de rotas (R7): conta local = `/perfil` em todos os apps.
- Ação: `App.tsx`: nova rota `/perfil` reusa `ProfilePage`. Redirect `<Navigate to="/perfil" replace />` em `/profile`. `userMenu` "Meu Perfil" → `/perfil`. Build ✅.
- Status: corrigido (build ✅)

### D-041-07 — Site não tem `@astrojs/react` (bloqueia ilha React na F4)
- Origem: Fase 4, `astro build` → erro `Rollup failed to resolve import "react/jsx-runtime"`
- Evidência: `astro.config.mjs` sem `react()` integration. `package.json` sem `@astrojs/react`/`react`/`react-dom`. Ilha `SiteHeaderIsland.tsx` precisa de React runtime para JSX.
- Escopo: `apps/site`; descoberta da Fase 4
- Causa-raiz: Site era zero-JS puro (spec 010). Spec 041 introduz ilha React → precisa da integração.
- Ação: Adicionar `@astrojs/react` ao config + deps. Executar na Fase 4.
- Status: corrigido (build ✅ 46 páginas, nav estático preservado)

### D-041-07b — Lógica de tema/changelog DUPLICADA entre apps (dedup → Fase 1.5)
- Origem: revisão pós-F3; `AppShell.tsx` + `GlossarioHeader.tsx` + `accounts/main.tsx`
- Evidência: bloco `useSyncExternalStore`+`MutationObserver(data-theme)` copiado idêntico em mesas (F2) e glossario (F3). Padrão `hasNewUpdate`/localStorage duplicado. `accounts/main.tsx` reimplementa `readCookie`/`writeThemeCookie`.
- Escopo: `packages/ui` (criar helpers) + apps (consumir)
- Causa-raiz: faltou helper comum; cada app reescreveu reatividade de tema/badge.
- Ação: Fase 1.5 executada — `useTheme()` em `theme.tsx`, `useChangelogBadge()` em `hooks.ts`. mesas e glossario retrofitados. Grep dedup: zero cópias de MutationObserver/useSyncExternalStore fora de ui. Build ✅.
- Status: corrigido (Fase 1.5 verde, grep limpo)

### D-041-08 — `SiteFooter.astro` é fork do `packages/ui/Footer.tsx` (T4.4)
- Origem: Fase 4, §9.5 da spec — confirmado ao revisar
- Evidência: `apps/site/src/components/SiteFooter.astro` reimplementa markup do footer em Astro puro, separado do `Footer.tsx` central. Mesmo padrão do header forkado pré-041.
- Escopo: `apps/site`; dívida pré-existente
- Causa-raiz: Site foi zero-JS desde spec 010; footer nunca foi unificado.
- **Investigação F7:** Footer é 100% estático (sem interatividade). Converter p/ React island adicionaria JS a TODA página do site sem ganho funcional. Mas o TEXTO pode ser sincronizado sem peso: extrair strings para módulo compartilhado `footer-content.ts` (sem React), ambos importam das mesmas constantes.
- Ação: **Sincronização via fonte única de texto.** Criado `packages/ui/src/footer-content.ts` com 8 constantes de texto (`FOOTER_TAGLINE`, `FOOTER_GIFT_TEXT`, etc.). `Footer.tsx` e `SiteFooter.astro` importam das mesmas constantes via `@artificio/ui/static`. Script `scripts/check-footer-sync.ts` verifica que ambos importam as constantes (build quebra se divergirem). Zero JS extra no site. `import.meta.dirname` corrigido p/ `process.cwd()`. Ano do SiteFooter corrigido: `const year = 2026` → `new Date().getFullYear()`.
- Status: corrigido (build ✅, teste de sincronização ✅)

### D-041-13 — `footer-content.ts` redefine atômicos que já têm fonte canônica
- Origem: F7 (revisão do mantenedor), investigação de duplicação cross-pacote
- Evidência:
  - `FOOTER_BRAND = "Artifício RPG"` — já definido em `brand.ts:10` (alt), `packages/content/src/site.ts:5` (`SITE.name`), `apps/links/src/layouts/Base.astro`, `apps/links/server/lib/render.ts`, `apps/site/src/components/SiteHeader.astro`
  - `FOOTER_BASE_DOMAIN = "artificiorpg.com"` — referenciado em 47 arquivos; canonical = `SITE.origin` (`packages/content`) e `DEFAULT_ACCOUNTS_ORIGIN` (`packages/auth`)
  - `FOOTER_TAGLINE = "Hub de projetos... Gratuito, sem anúncios..."` — "Gratuito, sem anúncios, sem coleta desnecessária" também aparece em `apps/accounts/frontend/src/main.tsx:177` e `apps/links/src/pages/index.astro`
  - `FOOTER_GIFT_TEXT`, `FOOTER_COPYRIGHT`, `FOOTER_TERMS_LABEL` — específicos do footer, sem duplicação externa
- Escopo: `packages/ui`, `packages/content`, `packages/config`, `apps/accounts`
- Causa-raiz: `footer-content.ts` criou uma 3ª fonte de verdade para strings que já têm canônicos em outros pacotes. O pacote leaf correto para constantes cross-pacote é `@artificio/config` (sem deps circulares: `config` ← `auth` ← `ui`; `config` ← `content`).
- **Decisão de arquitetura (mantenedor 2026-06-21):** 
  1. Mover `BRAND_NAME`, `BRAND_DOMAIN`, `BRAND_TAGLINE_FREE` (atômicos cross-pacote) para `@artificio/config`
  2. `footer-content.ts` importa de `@artificio/config` em vez de redefinir
  3. `SITE.name` em `packages/content` importa de `@artificio/config`
  4. `apps/accounts` consome `BRAND_TAGLINE_FREE` de `@artificio/config`
  5. Strings específicas do footer (`FOOTER_GIFT_TEXT`, `FOOTER_COPYRIGHT`, `FOOTER_TERMS_LABEL`) permanecem em `footer-content.ts` (sem duplicação externa — OK)
- **Teste de divergência — Nível 2 (auto-fix na build):** Script `scripts/check-footer-sync.ts` compara strings entre os dois arquivos fonte. Se encontrar hardcoding divergente no `.astro`, **substitui automaticamente** pela constante (ex.: `"Artifício RPG"` → `{FOOTER_BRAND}`) e segue o build. Saída: `❌ SiteFooter.astro:13 "Artifício RPG" → substituído por {FOOTER_BRAND}`. Se nada divergir: `✅ Footer sincronizado`. Falha SÓ se o auto-fix não conseguir resolver (ex.: estrutura de arquivo corrompida).
- Status: corrigido (build ✅ 15/15, auto-fix comprovado: quebrou de propósito → corrigiu sozinho)

### D-041-14 — Duplicação cross-app de `BRAND_NAME`, `BRAND_ORIGIN`, `BRAND_TAGLINE_FREE`
- Origem: F7 (revisão do mantenedor), investigação de strings hardcoded após D-041-13
- Evidência: grep em todo o código-fonte (excluindo `packages/config/src/brand.ts`, `dist/`, `node_modules/`):

  **`"Artifício RPG"` — 5 locais:**
  | Arquivo | Linha |
  |---|---|
  | `packages/ui/src/brand.ts` | `alt: "Artifício RPG"` (2 logos) |
  | `apps/links/src/layouts/Base.astro` | `<meta og:site_name>` |
  | `apps/links/server/lib/render.ts` | `<meta og:site_name>` (server) |
  | `apps/site/src/components/SiteHeader.astro` | `alt` das logos |
  | `scripts/check-footer-sync.ts` | mapa canônico (script) |

  **`"https://artificiorpg.com"` — 9 locais:**
  | Arquivo | Linha |
  |---|---|
  | `packages/ui/src/Header.tsx` | `brandHref` default |
  | `packages/ui/src/Footer.tsx` | `brandHref` default |
  | `packages/ui/src/modules.ts` | Portal href na nav |
  | `apps/accounts/frontend/src/main.tsx` | `const PORTAL_URL` |
  | `apps/accounts/src/app.ts` | cookie domain |
  | `apps/links/src/pages/index.astro` | link hardcoded |
  | `apps/site/src/pages/rss.xml.ts` | RSS `site` fallback |
  | `apps/site/src/pages/robots.txt.ts` | sitemap URL |
  | `apps/site/server/server.ts` | `PUBLIC_SITE_URL \|\| fallback` |

  **`"Gratuito, sem anúncios, sem coleta desnecessária"` — 1 local restante:**
  | Arquivo | Linha |
  |---|---|
  | `apps/links/src/pages/index.astro` | texto landing |
  | `scripts/check-footer-sync.ts` | mapa canônico (script) |

- Escopo: `packages/ui` (3 arquivos), `apps/accounts` (2), `apps/links` (3), `apps/site` (4), `scripts` (1)
- Causa-raiz: `@artificio/config` com `BRAND_NAME`/`BRAND_ORIGIN`/`BRAND_TAGLINE_FREE` é novo (D-041-13); código pré-existente nunca foi migrado.
- **Decisão pendente (mantenedor):** quais grupos implementar?
  - **Grupo 1 — Alto impacto (3 arquivos, 0 risco):** `ui/Header.tsx`, `ui/Footer.tsx`, `ui/modules.ts` → mudar domínio em 1 lugar propaga automaticamente para TODOS os apps (Header/Footer/nav são consumidos por 5 apps)
  - **Grupo 2 — Médio impacto (5 arquivos):** `accounts/main.tsx`, `site/SiteHeader.astro`, `site/rss.xml.ts`, `site/robots.txt.ts`, `links/Base.astro`
  - **Grupo 3 — Baixo impacto (4 arquivos):** `brand.ts` alt, `accounts/app.ts`, `links/index.astro`, `links/render.ts`, `site/server.ts`
  - **Grupo 4 — Script de sync (1 arquivo):** `check-footer-sync.ts` (mapa canônico já é a referência, não faz sentido auto-referenciar)

  Todos os 14 locais são seguros (sem circular deps: `ui`→`config`, `accounts`→`config`, `links`→`ui`→`config`, `site`→`ui`→`config`). Nenhum requer nova dependência.
- **Implementado 2026-06-21 (Grupos 1+2+3, 13 arquivos):**  
  | Arquivo | Mudança |
  |---|---|
  | `packages/ui/src/Header.tsx` | `brandHref` ← `BRAND_ORIGIN` |
  | `packages/ui/src/Footer.tsx` | `brandHref` ← `BRAND_ORIGIN`, `copyrightHref` ← template |
  | `packages/ui/src/modules.ts` | Portal href ← `BRAND_ORIGIN` |
  | `packages/ui/src/brand.ts` | `alt` ← `BRAND_NAME` (2 logos) |
  | `apps/accounts/frontend/src/main.tsx` | `PORTAL_URL` ← `BRAND_ORIGIN` |
  | `apps/accounts/src/env.ts` | `COOKIE_DOMAIN` default ← `.${BRAND_DOMAIN}` |
  | `apps/accounts/src/app.ts` | hostname check + CSRF allowlist ← `BRAND_DOMAIN`/`BRAND_ORIGIN` |
  | `apps/site/src/components/SiteHeader.astro` | `alt` ← `BRAND_NAME` |
  | `apps/site/src/pages/rss.xml.ts` | title + site fallback ← `BRAND_NAME`/`BRAND_ORIGIN` |
  | `apps/site/src/pages/robots.txt.ts` | sitemap URL ← `BRAND_ORIGIN` |
  | `apps/site/server/server.ts` | CSRF origin fallback ← `BRAND_ORIGIN` |
  | `apps/links/src/layouts/Base.astro` | `og:site_name` ← `BRAND_NAME` |
  | `apps/links/src/pages/index.astro` | portal URL + tagline ← `BRAND_ORIGIN`/`BRAND_TAGLINE_FREE` |
  | `apps/links/server/lib/render.ts` | `og:site_name` ← `BRAND_NAME` |
  | `packages/ui/src/static.ts` | Re-exporta `BRAND_NAME`, `BRAND_ORIGIN`, `BRAND_TAGLINE_FREE`, `BRAND_DOMAIN` de `@artificio/config` |
  - **Ajuste técnico:** Arquivos `.astro`/`.ts` processados pelo Vite do Astro não resolvem `@artificio/config` diretamente → imports trocados para `@artificio/ui/static` (barrel que já re-exporta de config). Arquivos React/Node mantêm import direto de `@artificio/config`.
- Status: corrigido (build ✅ 15/15)

### D-041-09 — accounts `readCookie`/`writeThemeCookie`/`getInitialTheme` próprios (T1.5.3)
- Origem: Fase 5, `apps/accounts/frontend/src/main.tsx:33-62`
- Evidência: accounts reimplementava `readCookie`/`writeThemeCookie`/`getInitialTheme` (~30 linhas) que já existem em `@artificio/ui` `theme.tsx`.
- Escopo: `apps/accounts`; dívida pré-existente
- Causa-raiz: accounts foi escrito antes da centralização de tema em `packages/ui`.
- Ação: T1.5.3 executado na Fase 5. `readCookie`/`writeThemeCookie`/`getInitialTheme`/estado `theme` próprios removidos (~30 linhas). Substituído por `useTheme()` + `resolveTheme`/`setTheme` de `@artificio/ui`. `ContaView` usa `useTheme()` para toggle. Build ✅. Verificado F7: `grep "readCookie\|writeThemeCookie\|getInitialTheme" apps/accounts` = zero (só importa `resolveTheme`/`setTheme` de `@artificio/ui`).
- Status: corrigido (build ✅, 100% centralizado)

### D-041-10 — site `/busca` era conflito Pagefind vs API (opção A aplicada)
- Origem: Fase 6, §10 da spec
- Evidência: Site é SSG estático com Pagefind (sem API de busca). Padrão `/busca`+API não se aplica. Decisão do mantenedor: opção (A) — expor `/busca` com Pagefind.
- Escopo: `apps/site`
- Ação: `busca/index.astro` carrega Pagefind UI inline. Sem endpoint novo. Exceção documentada.
- Status: corrigido (build ✅, Pagefind funcional)

### D-041-11 — mesas `/busca` via redirect ao catálogo
- Origem: Fase 6, T6.1
- Evidência: mesas já tem busca completa no `CatalogoPage` (com `?search=` via URL params). Criar página duplicada seria retrabalho.
- Escopo: `apps/mesas`
- Ação: `<Route path="/busca" element={<Navigate to="/catalogo" replace />} />`. Botão do header → `/busca` → `/catalogo` (busca visível e funcional).
- Status: corrigido (build ✅)

### D-041-12 — links `/busca` precisou de React island (busca client-side)
- Origem: Fase 6, T6.3
- Evidência: links é SSG (Astro). Grupos vêm de `GET /api/groups` (API server). Busca é client-side (filtro sobre dados carregados).
- Escopo: `apps/links`
- Ação: `LinksSearch.tsx` (React island `client:load`) + `busca/index.astro`. Usa `fetch` (não `authFetch` — API pública). Sem `lucide-react` → SVG inline.
- Status: corrigido (build ✅, 16 páginas)
