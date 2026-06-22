# 041 — Tasks 2: descobertas durante a execução (D-041-NN)

> **Propósito:** registrar bugs, regressões, duplicações, efeitos colaterais e achados "fora de escopo" descobertos DURANTE a implementação (Fases 0-7). Cada entrada vira trabalho a fechar ANTES do PR.
>
> **NÃO é para revisões de bots do PR.** Revisões de bots (amazon-q, codex, coderabbit, Snyk, CodeQL, Scorecard) vão em `task-revisões.md`. Este arquivo fica congelado após o PR abrir — novas entradas só se a execução de um fix de revisão revelar algo novo.

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

**Status final (2026-06-21):** PR #80 mergeado (`8981c84`) → dev. Changelog cross-app centralizado. Auditoria independente concluída.

**Pós-#80 — saga de deploy beta→prod (fora do PR #80, registrada aqui por "nada para trás"):**
- Deploy beta **falhou 2x** após o merge do #80 (dev `88ac2ea`): site (`@artificio/config` não declarado — D-041-15) e glossário+mesas (`ERR_PACKAGE_PATH_NOT_EXPORTED ./changelog` — D-041-22).
- Fix do changelog: pacote leaf `@artificio/changelog` dual ESM+CJS → **PR #82** (mergeado `86e2811`). Achados de bot do #82 (coderabbit `.map`/`limit`; codex turbo `dist-cjs`) resolvidos no próprio #82.
- **Promoção dev→main** (fast-forward) + **deploy PROD** de glossário, mesas, accounts, links = todos ✅. **Site fica em beta** (prod = raiz `artificiorpg.com` = Gate C, adiado).
- **Conflito de merge (PR #83 / 042):** a resolução do conflito descartou o fix de `turbo.json` (`dist-cjs/**`). Detectado e restaurado no local — D-041-23.

### D-041-22 — Deploy beta glossário+mesas falhou: backend CJS importa `@artificio/ui/changelog` (ESM-only)
- Origem: deploy beta pós-#80 — runs [158 mesas](https://github.com/FarenRavirar/artificio/actions/runs/27920566629) + [159 glossário](https://github.com/FarenRavirar/artificio/actions/runs/27920567093). `<svc>-beta-api não ficou healthy`. Log: `Error [ERR_PACKAGE_PATH_NOT_EXPORTED]: Package subpath './changelog' is not defined by "exports" in @artificio/ui`.
- Causa-raiz: 041 centralizou `changelog.ts` (puro) em `packages/ui`, mas `@artificio/ui` é `"type":"module"` e `exports["./changelog"]` só tinha condição `import` (ESM). Backends glossário/mesas compilam CommonJS → `require()` não casa condição → erro. Contraprova: `@artificio/auth` (consumido por backend CJS) tem condição `require` + `dist-cjs`.
- Escopo: `packages/ui` + backends glossário/mesas; regressão do 041 (não pega bots — só estoura no boot do container CJS).
- Ação (PR #82, mergeado `86e2811`): extraído contrato puro p/ pacote leaf **`@artificio/changelog`** com build dual ESM+CJS (`dist` + `dist-cjs`, `exports {import,require,types}`). `@artificio/ui` re-exporta (frontend inalterado). Backends importam o leaf e **deixam de depender de `@artificio/ui`**. Dockerfiles dos 2 backends copiam `dist`+`dist-cjs`. Achados de bot do #82 (R1 `.map` no teste→`for...of`; R2 `limit` endurecido; codex turbo `dist-cjs/**`) resolvidos no #82.
- Verificação: `turbo build` ✅, testes ✅, smoke `require()` CJS do controller compilado ✅. Deploy beta + PROD verdes (glossário, mesas).
- Status: corrigido (mergeado em prod via PR #82)

### D-041-23 — Conflito de merge (PR #83/042) descartou o fix `turbo.json dist-cjs/**`
- Origem: PR #83 (`feat/042-duplicate-code-refactor`) → conflito com o código já em prod (PR #82). Resolução manual do conflito removeu `"dist-cjs/**"` de `turbo.json build.outputs`.
- Causa-raiz: `turbo.json` foi tocado por ambos (042 e o fix #82). O merge ficou com a versão sem `dist-cjs/**` → em cache hit o turbo não restaura `dist-cjs` de `@artificio/changelog`/`@artificio/auth` → Dockerfile `COPY .../dist-cjs` / runtime quebra (reintroduz o bug de deploy já corrigido em prod).
- Escopo: `turbo.json`; regressão de merge (perda de fix mergeado).
- Verificação: `git diff origin/main -- turbo.json` apontou a divergência; demais arquivos do fix changelog (leaf, ui re-export, imports, Dockerfiles) idênticos a prod. Backends `package.json` corretos (changelog de prod + feedback do 042).
- Ação: `"dist-cjs/**"` re-adicionado ao `turbo.json` local (sem commit, a pedido do mantenedor); `turbo.json` local == prod confirmado. Entra no commit do #83.
- Status: corrigido no local (aguardando commit do #83 pelo mantenedor)

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

### D-041-15 — Deploy beta falhou: `@artificio/config` não declarado em `apps/site` (gap de cobertura dos bots)
- Origem: deploy beta pós-PR (CI). Log: `Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@artificio/config' imported from /repo/apps/site/server/server.ts` → `site-beta-app não ficou healthy` → deploy abortado.
- Causa-raiz: 041 (`ba2b647`) adicionou `import { BRAND_ORIGIN } from "@artificio/config"` em `apps/site/server/server.ts:11` (uso `:42`) **sem** declarar a dependência em `apps/site/package.json`. Workspace package resolve por hoist/symlink em dev; container de produção poda deps (install isolado) → não linka → crash no boot do `tsx server/server.ts`.
- Idêntico ao achado de revisão **#5** (`apps/links/server/lib/render.ts` + `links/package.json`), que foi corrigido — mas `apps/site` tinha a MESMA falha e **passou batido**.
- Por que os bots não pegaram: revisores de PR (coderabbit/codex/Snyk/CodeQL) analisam diff estático, **não exercitam o boot do container**. Dep faltante só estoura em runtime de produção (deps podadas). Gap de cobertura: nenhum check de PR roda `docker build` + healthcheck do site.
- Fix aplicado: `"@artificio/config": "workspace:*"` em `apps/site/package.json` deps + `pnpm install --lockfile-only` (pnpm-lock atualizado, +3 linhas no bloco do site). Veredicto registrado em `task-revisões.md` #20.
- Recomendação (latente, não implementar sem decisão): grep de garantia "todo import `@artificio/*` em apps tem dep declarada" como check de CI, OU step de smoke `docker build`+healthz no pipeline de PR. Registrado aqui — nada para trás.
- Status: **resolvido** (fix + lockfile aplicados; aguardando autorização de commit/redeploy).

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

### D-041-16 — Glossario changelog migrado de DB para JSON (BL-GLOSSARIO-CHANGELOG-JSON)
- Origem: Pós-F8, revisão do mantenedor (padronização cross-app)
- Evidência: Glossario era o único app com changelog em DB (`public.update_log` no Postgres). Mesas/site/links usam JSON. Controller tinha 143 linhas com normalização/dedup/mojibake complexos.
- Escopo: `apps/glossario/backend`, `apps/glossario/database/`
- Causa-raiz: Decisão histórica pré-monorepo; glossario foi o primeiro app.
- Ação: (1) 13 entradas exportadas do DB + 1 nova (2026-06-21) → `changelogs.json`; (2) `changelogController.ts` reescrito (63→58 linhas, leitura JSON com cache 60s, sem DB); (3) `mergeUsers.ts:48` removido (sem `created_by` em JSON); (4) `LAST_SEEN_UPDATE` atualizado para `'2026-06-21-shell-unificado'`. Backlog: débito fechado.
- Status: corrigido (build ✅ 15/15)

### D-041-17 — Changelog system criado para site e links (JSON + badge + modal)
- Origem: Pós-F8, revisão do mantenedor ("site e links tem que ter changelog")
- Evidência: Site e links não tinham changelog. Nav já tem função de badge (`useChangelogBadge` no Header) mas nada estava wireado.
- Escopo: `apps/site`, `apps/links`
- Causa-raiz: Apps foram criados sem sistema de changelog.
- Ação: (1) `changelogs.json` criados com entrada 2026-06-21; (2) `SiteHeaderIsland.tsx` ganhou botão sino + badge + `SiteChangelogModal`; (3) `LinksHeader.tsx` ganhou `showChangelog`/`onOpenChangelog`/`changelogHasBadge` + `LinksChangelogModal`; (4) markers atualizados para `'2026-06-21-shell-unificado'`.
- Status: corrigido (build ✅ 15/15)

### D-041-18 — ChangelogModal centralizado em packages/ui (~500 linhas duplicadas eliminadas)
- Origem: Pós-D-041-17, análise de duplicação cross-app
- Evidência: 4 implementações de modal (mesas 277 linhas, glossario 155, site 56, links 56 clone) com ~400 linhas de lógica duplicada (agrupamento, timeline, truncate, loading, error, portal).
- Escopo: `packages/ui` + 4 consumidores
- Causa-raiz: Cada app implementou seu próprio modal; a spec 041 não cobriu centralização de changelog.
- Ação: (1) `packages/ui/src/changelog.ts` — tipo `ChangelogEntry`, `DEFAULT_CHANGELOG_LABELS`; (2) `packages/ui/src/ChangelogModal.tsx` — componente compartilhado (agrupamento, timeline, truncate, portal, loading/error/retry, renderBody slot, labels customizáveis); (3) 4 apps migrados para usar componente compartilhado (mesas com renderBody markdown, glossario com labels custom, site/links com JSON estático); (4) exports em `packages/ui/src/index.ts`.
- Status: corrigido (build ✅ 15/15, auditoria ✅)

### D-041-19 — Auditoria: AbortController sem signal no fetch do mesas ChangelogModal
- Origem: Auditoria independente do sistema changelog (T9.7)
- Evidência: `apps/mesas/frontend/src/components/ChangelogModal.tsx:74-77` — `const controller = new AbortController()` criado no useEffect mas `fetch()` na linha 56 não recebia `{ signal: controller.signal }`. Cleanup chamava `controller.abort()` que não abortava nada.
- Escopo: `apps/mesas/frontend`
- Severidade: Baixa — fetch completa normalmente; React 18+ ignora setState pós-unmount. É código morto (signal no-op).
- Ação: Fetch movido para dentro do useEffect com `{ signal: controller.signal }`. Retry separado com `useCallback` (sem AbortController — retry é ação explícita do usuário). `onRetry={retry}` atualizado.
- Status: corrigido (build ✅)

### D-041-21 — `useTheme()` quebra SSR do Astro (links `client:load`)
- Origem: Fix #22 (variant no LinksHeader), auditoria changelog
- Evidência: `LinksHeader` é renderizado via `client:load` no Astro. `useTheme()` de `@artificio/ui` usa `useSyncExternalStore` (React 19) sem `getServerSnapshot` → Astro tenta prerenderizar → `Error: Missing getServerSnapshot, which is required for server-rendered content`. Build quebrava em 16 páginas.
- Escopo: `apps/links`; o hook `useTheme()` não é SSR-safe (projetado para SPAs React, não Astro SSG)
- Causa-raiz: `useTheme()` usa `useSyncExternalStore(subscribe, getSnapshot)` sem 3º argumento `getServerSnapshot`. React 19 exige o 3º para SSR. Mesas/glossario são SPAs puras (sem SSR), então não acusam.
- Ação: Substituído `useTheme()` por `useEffect` + `useState<Theme>("light")` + `MutationObserver("data-theme")` inline no `LinksHeader`. Sem dependência do hook SSR-incompatível. Observa `html.dataset.theme` e atualiza estado local. Cleanup `observer.disconnect()`.
- Status: corrigido (build ✅ 16 páginas)
