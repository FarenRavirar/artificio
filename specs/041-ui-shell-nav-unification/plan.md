# 041 — Plano de implementação

> Companheiro de `spec.md`. Descreve COMO entregar a unificação do shell. Para IA executora (ex.: DeepSeek): siga `tasks.md` na ordem; este arquivo dá o desenho e as armadilhas.

## A. Princípio de arquitetura

**Uma fonte, dois renderizadores, contrato compartilhado.**

- **Fonte de dados/contrato** (única): `packages/ui` define o que o shell É — lista de links (`modules.ts`), conjunto de botões padrão (tema/changelog/busca/login), e o contrato do menu de conta (Perfil Artifício + Conta &lt;Serviço&gt; + extras). Isto é o "um lugar" do mantenedor.
- **Renderizador React** (`Header.tsx`): consumido por glossario/mesas/accounts/links e pela ilha do site. É o caminho rico/interativo.
- **Renderizador Astro estático** (site): gera o markup no build a partir do MESMO contrato (mesmas classes `artificio-*`, mesma lista, mesmas flags de botão). As partes que precisam de sessão/JS viram ilha React reusando `Header.tsx` (ou um subcomponente dele). Zero divergência de comportamento porque ambos leem o mesmo contrato.

Por que não "tudo ilha React no site": o blog é SEO-crítico (D019); nav precisa estar no HTML do first paint e sem flash. Por isso **híbrido** (decisão do mantenedor).

## B. Mudanças por camada

### B1. `packages/ui` (núcleo — onde nasce o "espelho")

1. **Botões padrão como peças do header**, ligados por flag aditiva. Hoje só existe `showThemeToggle`. Adicionar contrato análogo para:
   - `showChangelog` + `changelogContent`/`onOpenChangelog` (botão central + badge "novidade" via localStorage com `updateMarker` por app; conteúdo injetado).
   - `showSearch` + `onSearch`/`searchHandler` (botão central; ação do serviço injetada).
   - Tema já tem flag; consolidar para que glossario/mesas parem de construir `themeBtn` à mão e passem a ligar a flag.
   - Manter `actions` como slot para extras 100% específicos do app (ex.: sino de notificações do mesas).
2. **Menu de conta com topo padrão.** O `Header` passa a montar, antes do `userMenu` do app, dois itens fixos:
   - `Perfil Artifício` → `getAccountsOrigin()` (de `@artificio/auth/client`), `external`.
   - `Conta <Serviço>` → label e href vindos de uma prop nova (ex.: `serviceAccount={{ label, href }}`), porque a rota local varia por app.
   - Ordem: [Perfil Artifício, Conta &lt;Serviço&gt;, ...userMenu do app]. Filtro `adminOnly` mantém.
3. **Tema:** absorver o fix de `BL-UI-THEME-REACT-HEADER-VARIANT` (já aplicado local em `theme.tsx:54` `applyHeaderVariant`, integrado em `setTheme`/`applyTheme`). Garantir que o toggle central chama esse caminho. **Não duplicar** o fix.
4. Tudo **aditivo/retrocompatível**: apps que não passam as novas props não mudam.

### B1.1. Helpers comuns (dedup) — Fase 1.5

A unificação expôs lógica copiada entre apps. Centralizar em `packages/ui` e fazer os apps consumirem (não copiar):
- **`useTheme()`** — `useSyncExternalStore` + `MutationObserver(data-theme)` + `setTheme`. Hoje copiado idêntico em mesas `AppShell` e glossário `GlossarioHeader`.
- **`useChangelogBadge(key, marker)`** — padrão `hasNewUpdate`/localStorage duplicado em mesas+glossário.
- **accounts** consome `theme.tsx` em vez dos próprios `readCookie`/`writeThemeCookie`/`getInitialTheme`.
- **`buildAccountsLoginUrl(return, theme)`** static-safe — dedup entre accounts/site/`redirectToLogin`.

Ganho: fonte única, bundle por app menor, menos alocações por app (um subscribe canônico). **Não** é cache cross-subdomínio — origens distintas não compartilham JS no browser; não confundir esse benefício.

### B2. `apps/site` (Astro — o fork a eliminar)

1. Parar de manter markup divergente em `SiteHeader.astro`. Opções de implementação (executor escolhe a mais limpa, mesmo resultado):
   - (a) Extrair o markup do header para ser gerado de um helper compartilhado em `@artificio/ui/static` (lista + flags) que o `.astro` renderiza no build; OU
   - (b) Tornar o header do site uma ilha React `<Header client:idle>` para as partes interativas, com o nav estático ainda em HTML para SEO.
   - Recomendado: **híbrido (a)+(b)** — nav/subnav/logo estáticos no build; ilha React só p/ sessão (Entrar/menu de conta) e toggle interativo.
2. **Remover o JS inline de tema** do site (`Base.astro`/`SiteHeader.astro`, ~4444 bytes) e usar o `theme.tsx` central (boot via `applyTheme()` + toggle via componente central). Uma só implementação de lua/sol.
3. Preservar: nav no HTML do first paint, sem flash de tema, CSP presente, subnav de seções do blog (`SECTIONS`) — esse subnav é específico do site e continua injetado por ele (equivale a `moduleNav`).

### B3. Consumidores React (glossario, mesas, accounts, links)

- Trocar `themeBtn` manual pela flag central (`showThemeToggle`).
- Trocar botão de changelog manual pela flag/contrato central (mantendo o conteúdo/modal do app).
- Passar `serviceAccount={{ label:'Conta <Serviço>', href:'<rota local>' }}` para padronizar o menu.
- Remover do `userMenu` o item de conta global divergente (ex.: mesas `{label:'Conta', external}`) — vira o "Perfil Artifício" central.
- `links` (`PortalHeader.astro`): já é ilha React; só adicionar as flags/props novas.

## C. Ordem de execução (blast radius controlado)

1. **Núcleo primeiro** (`packages/ui`): flags + menu de conta + tema consolidado. Build verde isolado.
2. **Um consumidor React de referência** (ex.: `mesas`) adota tudo. Smoke.
3. **Demais React** (glossario/accounts/links) adotam.
4. **Site Astro** por último (maior risco SEO) — validar em **beta.artificiorpg.com** antes de prod.
5. Smoke cross-app do tema + menu de conta + "teste do espelho".

## D. Validação

- `turbo build` em ui + 5 apps.
- Grep de garantia: zero `themeBtn` manual remanescente; zero markup de header forkado no site além do permitido (subnav de seções).
- Smoke manual (sessão): login/me/logout em cada app; toggle alterna nav+conteúdo+footer; menu de conta mostra os 2 itens globais.
- Site: Lighthouse/SEO sem regressão vs build beta; nav no HTML (curl); sem flash; CSP presente.
- **Teste do espelho** (prova do conceito do mantenedor): adicionar um link temporário em `modules.ts` → aparece nos 5 sem editar app → reverter.

## E. Armadilhas conhecidas

- **Não** converter o header inteiro do site em ilha React (mata SEO/peso — D019). Híbrido obrigatório.
- **Não** duplicar o fix `applyHeaderVariant` — ele já existe em `theme.tsx`, só consolidar.
- Auth sagrado: props de sessão (`sessionOverride`/`onLogout`/`onLoginClick`) **inalteradas**.
- `accounts.` "gerenciar conta" pode estar quebrado por trás do link (mantenedor reportou). Esta spec entrega o LINK padronizado; se o destino estiver quebrado, registrar débito próprio (não silenciar).
- Promote recente trouxe upgrades (Node24/Vite8/Tailwind4 — `D-PROMOTE-033-UPGRADES-REGRESSION`). Rodar a unificação sobre o build atual e validar em beta antes de prod.
- Cloudflare cache (`max-age=7200`) pode mascarar resultado no site — purgar (token = mantenedor) ao validar prod.

## F. Modo de trabalho e governança

- **SDD Completo** (toca `packages/ui` + SSO no menu). `spec.md` + `plan.md` + `tasks.md` + validação + sessão.
- Branch + PR (`feat/041-ui-shell-nav-unification` ou fatias). Nada commita direto em `dev` (branch protection D073).
- Cada commit/push/PR/merge/deploy exige **aprovação nominal por ação** (regra pétrea). Esta spec NÃO autoriza nada — é planejamento.
- Smoke proporcional ao blast radius (matriz de `packages/ui` código: consumidores visuais + app de referência).
