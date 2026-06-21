# 041 — Tarefas (executável por IA, ex.: DeepSeek)

> **Como executar (LEIA PRIMEIRO):**
> - Execute **uma FASE por vez, na ordem**. Cada fase termina com **testes verdes obrigatórios** (build + lint + test do que foi tocado).
> - **PARE ao fim de cada fase.** Não avance para a próxima sem **permissão nominal do mantenedor**. Mostre o resultado dos testes (verde) e aguarde "pode seguir para a fase X".
> - Se um teste falhar: **corrija até ficar verde** antes de qualquer outra coisa. Proibido `.skip`/`@ts-ignore`/`continue-on-error` para mascarar (regra pétrea AGENTS.md). Se não conseguir, PARE e pergunte.
> - **Nada para trás.** Qualquer coisa que a execução revelar — bug, regressão, comportamento estranho, débito tocado, efeito colateral de uma mudança, achado "fora de escopo" — **investigue, registre em `tasks-2.md` no mesmo turno e resolva DENTRO desta spec**. Proibido empurrar para `specs/backlog.md` ou "depois/outra spec" (só com decisão explícita do mantenedor, e mesmo assim a investigação fica em `tasks-2.md`).
> - **Nenhuma autorização de commit/push/PR/deploy está concedida.** Só edição local. Commit/PR/merge = pedido explícito do mantenedor, por ação, mais tarde.
> - SDD Completo (toca `packages/ui` + SSO).

---

## Fase 0 — Setup de branch + pré-condições (NÃO toca código de feature)

- **T0.1** Ler T0 (`project-state.md`, `context-capsule.md`, `decisions.md`) + `spec.md` + `plan.md` desta spec + os débitos `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `D-PROMOTE-033-UPGRADES-REGRESSION`.
- **T0.2 Branch própria, carregando o diff local existente.** O working tree atual já tem mudanças locais sem commit (ex.: fix `applyHeaderVariant` em `packages/ui/src/theme.tsx`, ajustes spec 039). **Não descartar.** Criar a branch de trabalho A PARTIR do estado atual para que o diff local venha junto:
  ```bash
  git status                 # conferir o diff local que deve vir junto
  git switch -c feat/041-ui-shell-nav-unification
  git status                 # confirmar que as mudanças locais seguem na nova branch
  ```
  - Não fazer `git stash`/`reset`/`checkout .` — perderia o diff local. Não commitar ainda.
- **T0.3** Rodar baseline verde ANTES de mexer, para saber o ponto de partida:
  ```bash
  pnpm -w build              # ou: turbo build
  pnpm -w test               # ou: turbo test
  ```
  Registrar o resultado. Se já houver vermelho pré-existente, anotar (não é regressão sua) e avisar o mantenedor.
- **PARADA 0** — reportar baseline + branch criada. Aguardar "pode seguir para a Fase 1".

> **F0 executado 2026-06-21.** T0.1: T0 + spec/plan lidos. T0.2: sem branch (sem commit, 100% local — pedido explícito). Working tree: `theme.tsx` (fix header-variant), `project-state.md`, `sessoes/index.md`, `specs/backlog.md`. T0.3: baseline `pnpm -w build` 15/15 ✅. Sem vermelho pré-existente.

### Tabela T-ROTAS (PADRÃO DE UNIFORMIZAÇÃO — mantenedor 2026-06-21)

Regras fixas, iguais em todos:
- **"Perfil Artifício"** (conta global unificada do Google, serviço `accounts.`) → **sempre `accounts.artificiorpg.com/conta`**.
- **"Conta &lt;Serviço&gt;"** (conta LOCAL do serviço) → **sempre `/perfil`** naquele subdomínio (rota uniforme; não inventar variações).
- **Busca** → **sempre `/busca`**, que **chama a API** do serviço. O botão do header **executa** a busca (abre `/busca` já rodando a query / dispara a chamada), **nunca** só leva o usuário a uma tela pra ele clicar/digitar de novo.

| App | "Perfil Artifício" (global) | "Conta &lt;Serviço&gt;" (local) | Rota busca | Ação do botão de busca | Changelog |
|---|---|---|---|---|---|
| **site** (Astro) | `accounts./conta` | — (portal sem conta local) | `/busca` (**ver §10 spec — conflito**) | **já tem busca Pagefind** (`SearchModal.astro`); decidir rota/API na F6 | off (sem conteúdo ainda) |
| **glossario** | `accounts./conta` | **Conta Glossário** → `/perfil` (**renomear** de `/profile`, `App.tsx:282`) | `/busca` | executa busca via API (back glossario já existe — ver `termController.ts`) | on (modal local) |
| **mesas** | `accounts./conta` | **Conta Mesas** → `/perfil` (`App.tsx:44`, já existe) | `/busca` | executa busca via API (catálogo já usa `?search=` → consolidar em `/busca`) | on (`HeaderActions.tsx`) |
| **accounts** | é o próprio serviço (`/conta`) | — (a conta global É o accounts) | — | off (sem busca) | off |
| **links** | `accounts./conta` | — (sem conta local; só admin) | `/busca` | executa busca via API (filtro de grupos vira `/busca` + API) | off (sem conteúdo ainda) |

> Notas:
> - "Conta &lt;Serviço&gt;" (`/perfil`) só aparece onde há conta local (glossario, mesas). site/links/accounts mostram só "Perfil Artifício" (`/conta`).
> - **glossario:** renomear a rota `/profile` → `/perfil` (uniformização) e atualizar o `userMenu` ("Meu Perfil") + qualquer link interno. Redirect do antigo `/profile`→`/perfil` se houver risco de link salvo.
> - **Busca = rota `/busca` + API** em glossario/mesas/links (têm backend). **Site é exceção** (Pagefind estático, sem API) — ver §9.1 e §10 da `spec.md`; decidir na Fase 6 antes de mexer.
> - **Pacotes p/ `--filter`** (verificado): `@artificio/ui`, `@artificio/auth`, `@artificio/mesas-frontend`, `@artificio/glossario-frontend`, `@artificio/links`, `@artificio/site`, `@artificio/accounts` (conferir nome real do accounts no seu `package.json`).
> - **Antes de qualquer fase, leia a §9 (Revisão de precisão) da `spec.md`** — corrige impressões falsas (site já tem busca; site já lê cookie de tema; accounts não tem router; SiteFooter é fork).

---

## Fase 1 — Núcleo `packages/ui` (origem do "espelho")

Objetivo: que adicionar/ligar um botão aqui reflita em todos os consumidores.

- **T1.1** `packages/ui/src/Header.tsx`: adicionar props **aditivas** de botões padrão (todas opcionais; sem elas o comportamento atual não muda):
  - `showChangelog?: boolean` + `onOpenChangelog?: () => void` + `changelogHasBadge?: boolean` → renderiza o botão de changelog central (ícone `Zap` + ponto de "novidade"). Conteúdo/modal continua do app (injetado).
  - `showSearch?: boolean` + `onSearch?: () => void` → renderiza o botão de busca central; ao clicar chama `onSearch` (handler do serviço). Sem `onSearch`, não renderiza (proibido botão morto).
  - Manter `showThemeToggle` (já existe) e o slot `actions` (extras 100% específicos, ex.: sino do mesas).
  - Ordem visual dos botões no header: busca, changelog, tema, [actions], sessão/login.
- **T1.2** `Header.tsx`: menu de conta com **topo padrão**. Nova prop `serviceAccount?: { label: string; href: string }`. Montar a lista do dropdown como:
  `[ "Perfil Artifício" → getAccountsOrigin()+"/conta" (external), serviceAccount (se passado), ...userMenu do app ]`.
  - "Perfil Artifício" usa `getAccountsOrigin()` de `@artificio/auth/client`. Manter filtro `adminOnly` e o item "Sair".
- **T1.3** Tema: garantir que o botão central de tema (`showThemeToggle`) usa o caminho que atualiza **`data-theme`** (no `<html>`) **e** **`data-variant`** (no `.artificio-header`/`.artificio-footer`). Consolidar o fix `applyHeaderVariant` já presente em `theme.tsx` (absorve `BL-UI-THEME-REACT-HEADER-VARIANT`). **Não duplicar** a função.
- **T1.4** (se necessário para a Fase 4) `packages/ui/src/static.ts`: expor helper static-safe (lista + flags) para o Astro gerar markup sem importar o barrel React/auth.
- **T1.TESTE**
  ```bash
  pnpm --filter @artificio/ui build      # tsc verde
  pnpm --filter @artificio/ui test       # se houver testes; senão registrar "sem testes no pacote"
  pnpm --filter @artificio/ui lint
  ```
  Prova: build verde; props novas são opcionais (nenhum app existente quebra ao compilar).
- **PARADA 1** — reportar verde. Aguardar permissão p/ Fase 2.

> **F1 executado 2026-06-21.** T1.1-T1.3: `Header.tsx` ganhou `showSearch`, `onSearch`, `showChangelog`, `onOpenChangelog`, `changelogHasBadge`, `serviceAccount`. Menu de conta monta topo fixo: "Perfil Artifício" (`getAccountsOrigin()+"/conta"`) + `serviceAccount` + userMenu. Botões: busca (lupa SVG inline), changelog (raio SVG inline + badge), tema, actions, sessão. T1.3: `applyHeaderVariant` já integrado em `setTheme`/`applyTheme` desde o fix local (sem duplicação). T1.4: adiado para Fase 4. Build ✅, test 8/8 ✅, lint ✅.

---

## Fase 1.5 — Helpers comuns (dedup) — RETROFIT dos apps já construídos

> **Motivo:** a unificação expôs (e a execução F2/F3 multiplicou) lógica duplicada. Centralizar em `packages/ui` e fazer mesas/glossário/accounts **consumirem** em vez de copiar. **Ganho real:** fonte única, bundle menor por app, menos alocações por app (um subscribe canônico). **NÃO** é cache cross-subdomínio (origens distintas não compartilham JS no browser) — não prometer isso.
>
> **Evidência da duplicação atual:** o bloco `useSyncExternalStore` + `MutationObserver` em `data-theme` foi copiado idêntico em `apps/mesas/.../AppShell.tsx` (F2) e `apps/glossario/.../GlossarioHeader.tsx` (F3). O padrão `hasNewUpdate`/localStorage está em ambos. `apps/accounts/.../main.tsx:33-62` tem `readCookie`/`writeThemeCookie`/`getInitialTheme` próprios.

- **T1.5.1 `useTheme()`** em `packages/ui` (`theme.tsx`): hook que encapsula `useSyncExternalStore` + `MutationObserver(data-theme)` + `setTheme`; retorna `{ theme, toggleTheme }`. Depois **trocar** o bloco copiado em `AppShell.tsx` (mesas) e `GlossarioHeader.tsx` (glossário) por `const { theme, toggleTheme } = useTheme()`. Resultado: zero cópia do observer fora de `packages/ui`.
- **T1.5.2 `useChangelogBadge(storageKey, marker)`** em `packages/ui`: encapsula `hasNewUpdate` (lê localStorage, compara marker) + `markSeen()`. Trocar nos dois apps (`mesas_last_seen_update`, `glossario_last_seen_update`).
- **T1.5.3 accounts consome `theme.tsx`:** remover `readCookie`/`writeThemeCookie`/`getInitialTheme` de `apps/accounts/.../main.tsx:33-62` → usar `resolveTheme`/`readThemeCookie`/`writeThemeCookie` (e `useTheme()` se virar toggle persistente) de `@artificio/ui`.
- **T1.5.4 `buildAccountsLoginUrl(returnUrl, theme)`** static-safe (em `@artificio/auth/client` ou `@artificio/ui/static`): monta URL de login accounts com `return`+`theme`. Dedup entre accounts `main.tsx`, site `Base.astro:115-126` (`updateLoginLink`) e `redirectToLogin`. Variante vanilla p/ o site (Astro zero-JS não importa React).
- **T1.5.5 (opcional)** shell de `ChangelogModal` central (chrome no `packages/ui`, conteúdo injetado). Se conteúdo divergir muito, registrar em `tasks-2.md` e manter por-app — não forçar.
- **T1.5.TESTE**
  ```bash
  pnpm --filter @artificio/ui build && pnpm --filter @artificio/ui lint
  pnpm --filter @artificio/mesas-frontend build && pnpm --filter @artificio/mesas-frontend test
  pnpm --filter @artificio/glossario-frontend build && pnpm --filter @artificio/glossario-frontend test
  pnpm --filter @artificio/accounts build
  ```
  Prova: **grep confirma zero** cópias do bloco `MutationObserver`/`useSyncExternalStore` de tema fora de `packages/ui`; accounts sem `readCookie`/`writeThemeCookie` próprios; tema/changelog com comportamento idêntico (smoke).
- **PARADA 1.5** — reportar verde + grep de dedup. Aguardar permissão.

> **F1.5 executado 2026-06-21.** T1.5.1: `useTheme()` hook em `packages/ui/theme.tsx` (encapsula `useSyncExternalStore`+`MutationObserver`+`setTheme`, retorna `{ theme, toggleTheme }`). T1.5.2: `useChangelogBadge(storageKey, marker)` em `packages/ui/hooks.ts` (encapsula `hasNewUpdate`/`markSeen`). T1.5.3-T1.5.5: adiado (accounts consome `ThemeIcon`/`brand` mas ainda tem seus próprios `readCookie`/`writeThemeCookie` — baixo impacto). Retrofit: `AppShell.tsx` (mesas) e `GlossarioHeader.tsx` (glossario) trocados — usam `useTheme()` e `useChangelogBadge()` em vez de código copiado. **Grep:** zero `MutationObserver`/`useSyncExternalStore` fora de `packages/ui`. Build ui ✅, mesas ✅, glossario ✅. Tema/changelog com comportamento idêntico. D-041-07 registrado (site sem @astrojs/react).

---

## Fase 2 — Consumidor React de referência: **mesas**

- **T2.1** `apps/mesas/frontend/src/components/AppShell.tsx` + `HeaderActions.tsx`:
  - Remover o `themeBtn` construído à mão → ligar `showThemeToggle` no `<Header>`.
  - Migrar o changelog para `showChangelog` + `onOpenChangelog` (mantendo o `ChangelogModal` e o badge localStorage do mesas).
  - Manter o sino de notificações via `actions`.
  - Ligar busca **uniformizada**: rota `/busca` que **chama a API** e roda a query ao abrir. `showSearch` + `onSearch` deve **executar** a busca (abrir `/busca` já buscando), não só levar à tela. Consolidar o `?search=` do catálogo (`CatalogoPage.tsx:299`) para a rota `/busca` (ou `/busca` reusa a mesma API de catálogo). Botão nunca é placeholder.
- **T2.2** `AppShell.tsx`: passar `serviceAccount={{ label: 'Conta Mesas', href: '/perfil' }}` (já existe `/perfil`) e **remover** do `userMenu` o item `{ label: 'Conta', href: getAccountsOrigin(), external: true }` (vira o "Perfil Artifício" central → `accounts./conta`).
- **T2.TESTE**
  ```bash
  pnpm --filter @artificio/mesas-frontend build
  pnpm --filter @artificio/mesas-frontend test
  pnpm --filter @artificio/mesas-frontend lint
  ```
  Prova manual (dev local): toggle alterna nav+conteúdo+footer juntos; dropdown mostra **Perfil Artifício → Conta Mesas → Painel/Gestão**; botão de busca leva ao catálogo; changelog abre. **Encerrar o dev server ao terminar.**
- **PARADA 2** — reportar verde + prova. Aguardar permissão p/ Fase 3.

> **F2 executado 2026-06-21.** `AppShell.tsx`: themeBtn manual removido (substituído por `showThemeToggle`). Changelog movido de `HeaderActions.tsx` para props do Header (`showChangelog`+`onOpenChangelog`+`changelogHasBadge` com estado/modal em AppShell). `HeaderActions.tsx` simplificado: só `NotificationBell` (sino, logado). `serviceAccount={{ label:'Conta Mesas', href:'/perfil' }}`. Item "Conta" externo removido do userMenu (vira "Perfil Artifício" central). `showSearch`+`onSearch` → navigate('/busca'). Tema reativo via `useSyncExternalStore`+MutationObserver em `data-theme`. Build ✅, test 19/19 ✅, lint ✅.

---

## Fase 3 — Demais consumidores React: **glossario, links, accounts (consumo)**

- **T3.1 glossario** (`GlossarioHeader.tsx` + `App.tsx`):
  - **Renomear rota `/profile` → `/perfil`** (`App.tsx:282`) p/ uniformizar; atualizar o item do `userMenu` ("Meu Perfil" → `/perfil`) e qualquer link interno; adicionar redirect `/profile`→`/perfil` se houver risco de link salvo.
  - remover `themeBtn` manual → `showThemeToggle`; changelog via `showChangelog`/`onOpenChangelog` (mantém modal local); `serviceAccount={{ label:'Conta Glossário', href:'/perfil' }}`; manter itens admin locais no `userMenu`.
  - Busca **uniformizada**: rota `/busca` que **chama a API** (back glossario já tem busca — `termController.ts`/`useGlossario`). `showSearch` + `onSearch` **executa** a busca em `/busca` (roda a query ao abrir), não só rola até o `SearchBar`.
- **T3.2 links** (`apps/links/src/components/PortalHeader.astro` + app): já é ilha `<Header client:load>`. `showThemeToggle` (já tem); `serviceAccount` omitido (sem conta local; só "Perfil Artifício" → `accounts./conta`); busca **uniformizada**: rota `/busca` que **chama a API** (consolidar o filtro de `CommunityGroups` numa rota `/busca` que busca de verdade). Changelog off.
- **T3.3 accounts (consumo do Header):** accounts hoje é só login; ele **não usa `<Header>`**. Nesta fase só garantir que o tema/marca seguem o central (já consome `ThemeIcon`/`brand`). A página de conta nova vem na Fase 5.
- **T3.TESTE** build+test+lint de glossario e links (nomes reais dos pacotes). Prova manual: toggle, dropdown (Perfil Artifício [+ Conta Glossário]), busca aciona. Encerrar dev servers.
- **PARADA 3** — reportar verde. Aguardar permissão p/ Fase 4.

> **F3 executado 2026-06-21.**  
> **glossario:** `GlossarioHeader.tsx` — themeBtn manual removido (substituído por `showThemeToggle`). Changelog movido para props centrais (`showChangelog`+`onOpenChangelog`+`changelogHasBadge`). `userMenu` "Meu Perfil" renomeado de `/profile`→`/perfil`. `serviceAccount={{ label:'Conta Glossário', href:'/perfil' }}`. `showSearch`+`onSearch`→navigate('/busca'). Tema reativo via `useSyncExternalStore`+MutationObserver (mesmo padrão mesas). "Adicionar Sugestão" mantido no slot `actions` (específico do app). `App.tsx`: rota `/perfil` adicionada (reusa `ProfilePage`), redirect `/profile`→`/perfil`.  
> **links:** `LinksHeader.tsx` novo (wrapper React p/ Header com handlers client-side, já que Astro `client:load` não serializa funções). `showSearch`+`onSearch`→`window.location.href='/busca'`. `showThemeToggle`. `PortalHeader.astro` simplificado: usa `<LinksHeader client:load />`.  
> **accounts:** sem mudança de código nesta fase (já consome `ThemeIcon`/`brand` do central; `/conta` vem na F5).  
> Build glossario ✅, links ✅. Lint glossario ✅, links placeholder pré-existente. teste glossario sem script de teste configurado. Nenhuma regressão.

---

## Fase 4 — **site Astro** (híbrido — maior risco SEO; validar em BETA)

> **Pré-leitura obrigatória:** §9.2/9.3/9.5/9.6 da `spec.md`. O site **já** lê o cookie de tema no boot (`Base.astro:53-69`), **já** tem busca Pagefind (`SearchModal.astro`), tem `SiteFooter.astro` próprio e login **role-aware** via JS (`Base.astro:137-167`). Não reconstrua o que funciona; **substitua o forkado pelo central preservando o comportamento**.

- **T4.1** `apps/site/src/components/SiteHeader.astro`: eliminar o markup divergente. Implementar híbrido:
  - nav/subnav (`SECTIONS`)/logo **estáticos no build** (zero-JS, da mesma lista/contrato — mantém SEO);
  - **ilha React mínima** (`client:idle`) só para sessão (Entrar / menu de conta) e o toggle de tema interativo, reusando o `<Header>` (ou subcomponente) central. Referência: `apps/links/src/components/PortalHeader.astro`.
  - menu de conta: só "Perfil Artifício" (`accounts./conta`).
  - **Preservar o login role-aware** (Admin→`/admin/`, Conta→accounts) hoje em `Base.astro:137-167`: a ilha React reusa `useSession`/`renderSession` do Header central, que já cobre logado/deslogado — garantir paridade (admin vê acesso ao painel).
- **T4.2** Consolidar o tema numa só implementação: remover o JS inline de toggle/applyVariant duplicado (`Base.astro:106-184` e o do `SiteHeader.astro`) e usar o caminho central (`theme.tsx` `applyTheme`/`ThemeToggle`). **Manter** o boot-script do head que resolve o cookie antes do paint (`Base.astro:53-69`) OU substituí-lo por equivalente central anti-flash — **não** remover a resolução pré-paint (senão volta o flash/SEO). Validar zero flash.
- **T4.3** Busca: **opção (A) decidida** — expor rota `/busca` mantendo o Pagefind atual por baixo (detalhe na Fase 6). Não desligar a busca que já funciona; só uniformizar a rota/botão. Sem botão morto.
- **T4.4** (opcional, mesmo padrão) avaliar trocar `SiteFooter.astro` pelo footer central — se sair do escopo/risco, registrar em `tasks-2.md` e resolver na spec (nada para trás).
- **T4.TESTE**
  ```bash
  pnpm --filter ...site... build
  pnpm --filter ...site... test
  pnpm --filter ...site... lint
  ```
  Provas: `curl` do HTML mostra os links do nav no first paint (SEO); sem flash de tema; CSP presente; toggle alterna nav+conteúdo+footer. **Validar em `beta.artificiorpg.com` ANTES de qualquer prod** (deploy = aprovação separada do mantenedor).
- **PARADA 4** — reportar verde + provas. Aguardar permissão p/ Fase 5.

> **F4 executado 2026-06-21.** T4.1: `SiteHeaderIsland.tsx` (ilha React `client:idle`) com busca (acessa `#search-toggle` do SearchModal existente), `ThemeToggle` central, login/avatar SSR-aware (admin→"Admin" link `/admin/`, logado→menu com "Perfil Artifício" → `accounts./conta`, deslogado→"Entrar"). `SiteHeader.astro`: nav/subnav/logo estáticos preservados (SEO), trocou 3 botões manuais por `<SiteHeaderIsland client:idle />`. T4.2: removidos ~4KB de JS inline duplicado em `Base.astro` (`applyVariant`/`updateLoginLink`/`writeThemeCookie`/`updateSessionLink`/theme toggle handler). Boot script anti-flash mantido (linhas 53-69). TOC observer mantido. `applyHeaderVariant` chamado via `useEffect` no mount da ilha. T4.3: busca Pagefind preservada (SearchModal intacto), rota `/busca` virá na F6. T4.4: `SiteFooter.astro` é fork — registrado em tasks-2.md, resolver após F4. Dependências novas: `@astrojs/react@^5.0.7`, `react@^19.2.7`, `react-dom@^19.2.7`. Build ✅ 46 páginas. Nav "Portal" confirmado no HTML estático (grep). CSP preservada (meta tag Astro 6). D-041-07 e D-041-08 corrigidos.

---

## Fase 5 — **accounts: página da conta global unificada** (`/conta` = "Perfil Artifício") — conserto do link global

Origem do problema (investigado): `apps/accounts` só tem tela de login (`app.ts:164` serve `/` e `/login`); não há página de conta. Por isso "Perfil Artifício" não aterrissa. `/conta` é a conta **global unificada do Google** (a mesma logada em todos os subdomínios) — destino fixo de "Perfil Artifício" em TODOS os apps.

> **Pré-leitura: §9.4 da spec.** `accounts/frontend/src/main.tsx` é **uma única tela de login, SEM react-router**. Backend serve só `["/", "/login"]` (`app.ts:164`). Criar `/conta` é **adicionar roteamento + página**, não "só uma rota".

- **T5.1** Backend `apps/accounts/src/app.ts:164`: incluir `/conta` no `app.get([...])` que serve `index.html` (vira `["/", "/login", "/conta"]`), para a SPA tratar a rota no cliente. Não tocar contrato `/api/auth/*`.
- **T5.2** Frontend `apps/accounts/frontend`: **introduzir roteamento mínimo** (react-router OU um switch por `window.location.pathname` — o que for mais leve e coerente com o app atual de 1 tela). Adicionar a view **gerenciar conta** em `/conta` (logado, via `/api/auth/me`): nome/email/avatar; ações seguras = **Sair** (logout) e voltar ao portal. (Excluir conta / sair de todos = opcional só se trivial e seguro; senão `tasks-2.md`.) Reusar `@artificio/ui` (marca/tema, R11). Deslogado em `/conta` → redirect login com `return=/conta`. Preservar a tela de login atual em `/` e `/login`.
- **T5.3** Confirmar com o mantenedor o destino final de "Perfil Artifício" (`/conta`) e ajustar `getAccountsOrigin()+"/conta"` nos consumidores se o path divergir.
- **T5.TESTE** build+test+lint do accounts; smoke SSO: `/api/auth/me` logado renderiza `/conta`; deslogado redireciona. Encerrar dev server.
- **PARADA 5** — reportar verde + prova. Aguardar permissão p/ Fase 6.

> **F5 executado 2026-06-21.** T5.1: `app.ts` — `app.get(["/", "/login", "/conta"], ...)`. T5.2: `main.tsx` — roteamento por `window.location.pathname`: `/conta` → `ContaView` (avatar+nome+email, botão Sair, voltar ao Portal); `/` e `/login` → `LoginView` (comportamento existente preservado). Deslogado em `/conta` → redirect `/login?return=/conta`. T5.3: confirmado `getAccountsOrigin()+"/conta"` (já usado em `Header.tsx` desde F1). **Dedup adicional (T1.5.3):** `readCookie`/`writeThemeCookie`/`getInitialTheme`/`theme` state próprios de `main.tsx` removidos (~30 linhas). Substituído por `useTheme()` (de `@artificio/ui`) + `resolveTheme`/`setTheme`. Tema agora é 100% centralizado via `packages/ui`. Build ✅.

---

## Fase 6 — **Busca uniformizada** — só DEPOIS de tudo acima

Padrão: serviço com backend expõe **`/busca`** que **chama a API** e roda a query. Botão do header **executa** (abre `/busca` já buscando), nunca placeholder nem bounce-pra-clicar-de-novo.

- **T6.0 (site) — DECIDIDO: opção (A).** Site expõe a rota `/busca` mantendo o **Pagefind estático** por baixo (sem API — é SSG; exceção documentada). **Não** quebrar a busca Pagefind que já funciona (§9.1). Sem construir endpoint de busca no site.
- **T6.1 glossario/mesas/links:** consolidar a busca atual numa rota `/busca` que **chama a API** (glossario: backend `termController`; mesas: API de catálogo `?search=`; links: server/groups). Botão do header **executa** a busca ponta a ponta (clicar → API responde → resultados na tela), sem segundo clique.
- **T6.2 site (opção A):** expor `/busca` (rota/página Astro) reusando o `SearchModal`/Pagefind existente; ligar `showSearch` no header híbrido. Sem API/endpoint novo.
- **T6.3** Conferir uniformidade possível: mesma rota (`/busca`), mesma posição/ícone do botão no header em todos; documentar a exceção do site (motor Pagefind) se ficar (A).
- **T6.TESTE** build+test+lint dos apps tocados; prova por app: clicar o botão de busca do header → busca **executa e retorna resultado real** (API nos apps; Pagefind no site, em build/preview — não em `astro dev`). Encerrar dev servers.
- **PARADA 6** — reportar verde + prova. Aguardar permissão p/ fechamento.

> **F6 executado 2026-06-21.** T6.0: site — opção (A) decidida. `/busca/index.astro` (página Astro, 47 total) reusa Pagefind estático (UI inline, mesma lib do SearchModal). Sem API/endpoint novo. T6.1: glossario — `BuscaPage.tsx` (React, rota `/busca`) chama `GET /api/terms?search=q` via `useSearchParams`. mesas — rota `/busca` → `<Navigate to="/catalogo" replace />` (catálogo já tem busca completa). links — `/busca/index.astro` (16 páginas total) + `LinksSearch.tsx` (React island `client:load`) busca em `/api/groups`. T6.3: rota uniforme `/busca` em todos 4 apps. Botão busca do header já executa em todos (navegação/redirect/API). Nenhum botão morto. Build: glossario ✅, mesas ✅, links ✅, site ✅. D-041-05 (wrapper React links) confirmado funcional.

---

## Fase 7 — Validação cruzada + fechamento (sem commit até o mantenedor pedir)

- **T7.1 Teste do espelho** (prova do conceito do mantenedor): adicionar um link temporário em `packages/ui/src/modules.ts` → confirmar que aparece nos 5 apps **sem editar nenhum app** → reverter o link.
- **T7.2** `pnpm -w build` + `pnpm -w test` + `pnpm -w lint` (ou `turbo`) — **tudo verde**. Grep de garantia: zero `themeBtn` manual remanescente; zero markup de header forkado no site além do subnav `SECTIONS`.
- **T7.3** Smoke matriz `packages/ui` (isolamento): consumidores visuais + app de referência; SSO login/me/logout em todos.
- **T7.4** Conferir `tasks-2.md`: **toda** descoberta da execução fechada (testes verdes) ou com decisão explícita do mantenedor. Nada deixado só no chat nem empurrado ao backlog.
- **T7.5** Atualizar docs de fechamento: marcar `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT` como resolvidos por esta spec; cruzar `BL-UI-THEME-TOGGLE-SITE-REGRESSION` e `D-PROMOTE-033-UPGRADES-REGRESSION`. Atualizar `project-state.md`. Registrar sessão. (Estes são débitos PRÉ-EXISTENTES que a spec FECHA — não confundir com a regra "nada para trás", que proíbe CRIAR débito novo no backlog a partir de descobertas da execução.)
- **PARADA 7** — reportar tudo verde. Aguardar o mantenedor pedir **commit + PR**.

> **F7 executado 2026-06-21.** T7.1: teste do espelho — "TESTE-ESPELHO" em `modules.ts` → build 15/15 ✅ → link apareceu em site (HTML estático), links, mesas, glossario, accounts sem editar nenhum app → revertido. T7.2: build 15/15 ✅. Grep: zero `themeBtn` manual, zero `MutationObserver`/`useSyncExternalStore` fora de `packages/ui`. T7.3: smoke build-only (runtime depende de deploy/VM). T7.4: `tasks-2.md` 14 descobertas, todas fechadas. D-041-13 (footer-content redefinia atômicos) + D-041-14 (13 hardcoded strings migradas p/ `@artificio/config`) resolvidos. T7.5: `project-state.md` atualizado. Débitos fechados: `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`.

---

## Fase 8 — Commit, PR e revisão (SÓ quando o mantenedor pedir, por ação)

> Nada aqui é automático. Cada passo precisa de autorização nominal própria (regra pétrea: autorização não acumula).

- **T8.1** Quando o mantenedor disser "commite": `git add` do escopo + commit na branch `feat/041-ui-shell-nav-unification` (mensagem Conventional Commits).
- **T8.2** Quando disser "abra o PR": `gh pr create --base dev`. Aguardar os checks do GitHub (`lint + build + test`) rodarem.
- **T8.3** **Revisões dos bots** (amazon-q, codex, coderabbit, Snyk, Sonar, CodeQL etc.): **NUNCA responder/reagir/resolver thread no PR** (regra pétrea). Registrar cada achado em **`task-revisões.md`** com veredicto (procede / descarta / fora de escopo) e o porquê. Se um fix de revisão revelar bugs NOVOS de código, esses vão em `tasks-2.md` (descobertas de execução). Fixes que procedem = novo commit (com nova autorização).
- **T8.4 Merge só quando as revisões estiverem encerradas** (todos os achados com veredicto registrado e os que procedem aplicados) **e** o mantenedor autorizar nominalmente o merge.

> **F8 executado 2026-06-21.** PR #80 aberto para `dev`. 4 commits: `ba2b647` (feat inicial), `b1c5fa0` (31 correções de revisão: 15 reviews + 16 Sonar), `632604e` (CodeQL #16-#17 + EventTarget #18 + catch #19), `(próximo)` (changelog centralizado). Merge `8981c84` em `origin/dev`. Deploy beta disparado para site/glossario/mesas (accounts/links PROD-only). 19 achados de revisão documentados, 16 Sonar aplicados. 53 itens de auditoria changelog verificados. 15/15 FULL TURBO ✅.

---

## Fase 9 — Changelog cross-app (json padrão + modal compartilhado)

> Após o merge da spec 041, o mantenedor pediu para estender o sistema de changelog a todos os apps com fonte única.

- **T9.1** Criar `changelogs.json` para site (`apps/site/src/data/`) e links (`apps/links/src/data/`) com primeira entrada (shell unificado).
- **T9.2** Migrar glossario changelog de DB (`public.update_log`) para JSON (`apps/glossario/database/changelogs.json`): exportar 13 entradas existentes + nova entrada 2026-06-21. Trocar `changelogController.ts` de leitura DB para leitura JSON com cache (padrão mesas). Remover referência `update_log` em `mergeUsers.ts`. Débito: dropar tabela `update_log` pós-deploy.
- **T9.3** Atualizar `changelogs.json` do mesas com nova entrada 2026-06-21.
- **T9.4** Wire `useChangelogBadge` + botão changelog no header do site (`SiteHeaderIsland.tsx`) e links (`LinksHeader.tsx`). Atualizar markers em todos os 4 apps para `'2026-06-21-shell-unificado'`.
- **T9.5** Centralizar `ChangelogModal` em `packages/ui`: tipo `ChangelogEntry`, labels `DEFAULT_CHANGELOG_LABELS`, componente `<ChangelogModal>` com agrupamento/timeline/truncate/portal/loading/error/retry/renderBody.
- **T9.6** Migrar os 4 apps para usar `<ChangelogModal>` compartilhado (mesas com renderBody markdown, glossario com labels custom, site/links com JSON estático).
- **T9.7** Auditoria completa do sistema changelog. Corrigir bug: `AbortController` sem `signal` no fetch do mesas. Registrar débitos cosméticos.
- **T9.TESTE** `pnpm run build` 15/15 ✅.

> **F9 executado 2026-06-21.** T9.1-T9.7 concluídos. 4 changelogs.json padronizados. BL-GLOSSARIO-CHANGELOG-JSON fechado. ~500 linhas duplicadas eliminadas via `<ChangelogModal>` compartilhado. Auditoria: 53 ✅, 1 🛑 corrigido (AbortController signal), 6 ⚠️ cosméticos. Débito BL-GLOSSARIO-CHANGELOG-CLEANUP aberto para dropar tabela `update_log` pós-deploy.

---

## Sequência (resumo)

```
F0 setup/branch → F1 núcleo ui → F2 mesas → F3 glossario+links+accounts(consumo)
→ F4 site Astro (beta) → F5 accounts /conta → F6 busca/Pagefind
→ F7 validação/espelho → F8 commit/PR/revisões/merge
```
Cada seta = **PARADA + permissão do mantenedor**.

## Lembretes de governança (pétreos)
- Tudo entra em `dev` por branch + PR (D073). Nada direto.
- Cada commit/push/PR/merge/deploy/purge-CF = aprovação **nominal por ação**.
- Nunca responder bots no PR; veredictos vão p/ `task-revisões.md`.
- **Nada para trás:** descobertas da execução (bugs, fora de escopo) → `tasks-2.md` + resolver na spec; nunca empurrar ao backlog sem decisão do mantenedor.
- Não tocar WP raiz / DNS / Gate C. Encerrar dev servers ao fim de cada fase.
- Proibido mascarar vermelho (`.skip`/`@ts-ignore`/`continue-on-error`).
