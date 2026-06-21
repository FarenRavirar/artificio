# 041 — Shell único: nav, botões e menu de conta de fonte única (cross-projeto)

- **Módulo/Pacote:** `packages/ui` (fonte) + consumidores `apps/site` (Astro), `apps/glossario`, `apps/mesas`, `apps/accounts`, `apps/links`
- **Gate relacionado:** nenhum (Fase 3, débito de arquitetura UX). SDD **Completo** obrigatório (toca `packages/ui` + auth/SSO no menu de conta).
- **Débitos que esta spec fecha:** `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`. Relacionados (não fecha, registra dependência): `D-PROMOTE-033-UPGRADES-REGRESSION`.
- **Status:** ABERTA — investigação concluída 2026-06-21, aguardando execução. Esta spec é **planejamento**; nenhuma linha de código foi escrita.

---

## 1. Contexto e intenção do mantenedor (texto leigo, fonte de verdade do "porquê")

O mantenedor quer que o cabeçalho (nav) seja **realmente compartilhado** — como um snippet/plugin único. A regra é:

> **"Se eu adicionar um botão no código compartilhado, ele espelha para todos os demais automaticamente. Todos puxam de UM lugar. Não é sincronizar toda vez — é puxar da fonte."**

Se um projeto precisar de algo a mais, **só ele** ganha esse extra (via injeção aditiva). O resto vem do central.

Itens que TODOS devem ter, vindos do central:

- **Links de nav** (idênticos em todos): Portal, Glossário, Mesas, Downloads, Esferas, SRD, WhatsApps.
- **Botão dark/light** funcional.
- **Botão de changelog** (hidratado a partir das mudanças de cada site; WhatsApps e Portal ainda não têm changelog).
- **Botão de pesquisar** que funciona naquele site/serviço.
- **Botão "Entrar"** que loga em todos (SSO — já funciona hoje).

Depois de logado, o **menu de conta** deve ter, em todos:

- **Gerenciar conta** com:
  - **Perfil Artifício** → conta global do `accounts.artificiorpg.com` (hoje quebrado/ausente em alguns).
  - **Conta &lt;Serviço&gt;** → a conta local daquele serviço (ex.: "Conta Glossário", "Conta Mesas").
- Além disso, cada projeto acrescenta seus itens **locais/específicos** (ex.: mesas → Painel; glossário → Revisão de Sugestões, Importação).

---

## 2. Estado atual investigado (achados — file:line)

### 2.1 O que JÁ é fonte única (funciona)

| Coisa | Fonte | Quem consome | Evidência |
|---|---|---|---|
| Lista de links do nav | `packages/ui/src/modules.ts:6` `defaultNavItems` | React via `<Header>`; Astro via `apps/site/src/lib/content.ts:75` (`MODULES = defaultNavItems`) e `@artificio/ui/static` | Links já são 1 fonte; "WhatsApps" existe na lista |
| Logos / favicon | `packages/ui/src/brand.ts` (data-URI) | todos | spec 017 |
| Footer (rodapé) | `packages/ui/src/Footer.tsx` | React apps; Astro re-renderiza markup próprio | spec 017/027 |
| Cookie de tema cross-subdomínio | `packages/ui/src/theme.tsx:23` `writeThemeCookie` (`artificio_theme`, `Domain=.artificiorpg.com`) | todos | D067 |
| Componente `<Header>` React | `packages/ui/src/Header.tsx` | glossario, mesas, accounts, links | — |
| Login/logout no header | `Header.tsx:125` `renderSession()` (SSO `@artificio/auth/client`) | React apps | — |

### 2.2 O que NÃO é fonte única (o problema)

| Problema | Onde | Detalhe |
|---|---|---|
| **Site Astro tem header forkado** | `apps/site/src/components/SiteHeader.astro` | Reimplementa TODO o markup do header em Astro puro (zero-JS). Não usa `<Header>`. Botões tema/busca/login são `<button>`/`<a>` inline com JS inline próprio. Puxa só a LISTA (`MODULES`), não o desenho nem o comportamento. **É a causa raiz das dessincronizações** (perdeu botão/tema no promote). |
| **Toggle de tema duplicado** | `theme.tsx` (React) **vs** `SiteHeader.astro:36` + JS inline em `apps/site/.../Base.astro` (~4444 bytes) | Duas implementações da MESMA lógica lua/sol. Quando uma muda, a outra não acompanha. |
| **Botões recriados por app** | `apps/glossario/.../GlossarioHeader.tsx:78` (themeBtn), `apps/mesas/.../HeaderActions.tsx`, `apps/mesas/.../AppShell.tsx:42` (themeBtn) | Cada app constrói o PRÓPRIO botão de tema e de changelog à mão e injeta via prop `actions`. Não há botão padrão central — só o componente cru `ThemeToggle`/`ThemeIcon`. Resultado: "adicionar botão no central" NÃO espelha; cada app teria que copiar. |
| **Botão de busca inexistente/placeholder** | `SiteHeader.astro:33` (`title="Busca = Pagefind (Etapa 2)"`, sem ação) | Só o site tem o ícone, e é placeholder. React apps não têm busca. Nada central. |
| **Botão changelog inconsistente** | glossario e mesas têm (cada um o seu modal local); site, accounts e links **não têm** | Nenhum contrato central. |
| **Menu de conta divergente** | `AppShell.tsx:18` (mesas: tem `{label:'Conta', href: accounts, external}`), `GlossarioHeader.tsx:67` (glossário: só itens locais, **sem** link p/ accounts), `PortalHeader.astro:6` (links: só "Painel admin") | Não há padrão "Perfil Artifício + Conta &lt;Serviço&gt;". `accounts.artificiorpg.com` "gerenciar conta" não aparece padronizado; mantenedor diz que hoje está quebrado/ausente. |

### 2.3 Regressões de tema — papel desta spec (LER §9 antes de assumir causa)

- **`BL-UI-THEME-REACT-HEADER-VARIANT`** (já com fix local em `theme.tsx:54` `applyHeaderVariant`): o toggle **React** setava `data-theme` no `<html>` mas não `data-variant` no `.artificio-header`/`.artificio-footer`. CSS do nav dark usa `[data-variant=dark]` (confirmado em `styles.css:1119`). Fix local existe, **sem commit**. Esta spec absorve o commit. **Afeta só os apps React** (glossario/mesas/accounts/links), NÃO o site.
- **`BL-UI-THEME-TOGGLE-SITE-REGRESSION`** (site Astro): **CUIDADO — o mecanismo de tema do site NÃO está faltando nem quebrado por design.** Verificado: `Base.astro:53-69` (head, `is:inline`) **resolve o cookie compartilhado `artificio_theme` no boot** (lê cookie→localStorage→SO e seta `data-theme` antes do paint) e `Base.astro:108-184` faz `applyVariant`/toggle/grava cookie. O `data-theme="light"` em `Base.astro:42` é só o default SSR, sobrescrito no boot. Logo a regressão **mais provável é cache Cloudflare** (`Cf-Cache-Status: HIT`, `max-age=7200`) e/ou upgrade (`D-PROMOTE-033-UPGRADES-REGRESSION`), **não** ausência de leitura de cookie. Unificar **reduz risco futuro** (uma só implementação de tema em vez de JS inline forkado), mas **não presuma** que o site precisa do mecanismo reconstruído.

### 2.4 Histórico relevante (não re-decidir)

- Spec 007 — Header genérico ganhou `moduleNav` (2ª linha de rotas do app), sticky, menu mobile.
- Spec 010/014 — nav/logo/WhatsApps.
- Spec 017 — favicon/footer/toggle como fonte única; toggle adiado em glossario/mesas por falta de CSS dark (hoje já têm).
- Spec 020 B13 — origem do `BL-SHELL-B13` ("dividir por fonte única data/static e runtime React").
- D058 — Header/Footer = shell único. D062/D-SHELL1 — fonte única static-safe (`@artificio/ui/static`).

---

## 3. Decisões do mantenedor para esta spec (2026-06-21)

1. **Site Astro → abordagem Híbrida.** Markup do header desenhado **estático no build** (zero-JS, SEO intacto) + uma **ilha React mínima** só para os pedaços que dependem de sessão/interação (Entrar/menu de conta e o toggle de tema interativo). Não converter o header inteiro em ilha React (preservar SEO/peso do blog). Referência de ilha já existe: `apps/links/src/components/PortalHeader.astro` usa `<Header client:load>`.
2. **Centralizar TODOS os botões padrão** (tema, changelog, busca, login) no header central, cada um ligado/desligado por um **interruptor (flag/prop aditiva)**. App só injeta o que é EXCLUSIVO dele.
3. **Padronizar o menu de conta:** topo fixo com **Perfil Artifício** (global accounts.) + **Conta &lt;Serviço&gt;** (local), depois os itens específicos do app.

---

## 4. Requisitos (numerados, testáveis)

### Fonte única do shell
- **R1** — `packages/ui` expõe um shell de header que é a **única** fonte de markup + comportamento padrão. Nenhum app reimplementa o desenho do header. (Site Astro consome via ilha + markup gerado do mesmo contrato — ver R8.)
- **R2** — A lista de nav permanece em `modules.ts` (`defaultNavItems`) como única fonte; adicionar/editar um link lá reflete em TODOS (React e Astro) sem edição por-app.

### Botões padrão centralizados (interruptores)
- **R3 — Tema:** o botão lua/sol é **parte do header central**, ligado por prop (`showThemeToggle`, já existe em `Header.tsx:83`). O botão deve atualizar `data-theme` (no `<html>`) **e** `data-variant` no header/footer (absorver fix `applyHeaderVariant`). Eliminar os `themeBtn` construídos à mão em glossario/mesas; eles passam a usar a versão central via flag.
- **R4 — Changelog:** o header central oferece um **botão de changelog padrão** (ícone + badge "novidade" via localStorage), ligado por prop. Conteúdo do changelog é injetado pelo app (fonte por-site), mas o BOTÃO e o comportamento de badge são centrais. Apps sem changelog (Portal, WhatsApps) simplesmente não ligam a flag — até terem conteúdo.
- **R5 — Busca (uniformizada):** o header central oferece um **botão de busca padrão** ligado por prop. **Rota uniforme `/busca` em todos os serviços**, que **chama a API** do serviço e **roda a query**. Clicar o botão **executa** a busca (abre `/busca` já buscando) — proibido redirecionar para o usuário clicar/digitar de novo, e proibido botão morto/placeholder. accounts não tem busca (flag off).
- **R6 — Entrar/SSO:** login/logout permanecem centrais (já em `renderSession()`), inalterados no contrato; só revisados para o site Astro consumir a mesma ilha.

### Menu de conta padronizado
- **R7 — Menu de conta (uniformizado):** o header central define o **topo padrão** do menu (quando logado), idêntico em todos:
  1. **Perfil Artifício** → **`accounts.artificiorpg.com/conta`** (conta global unificada do Google; `external: true`). Rota fixa, igual em todos.
  2. **Conta &lt;Serviço&gt;** → **`/perfil`** no subdomínio do serviço (rota local **uniforme** em todos os apps que têm conta local; label = nome do serviço).
  - Depois desses 2, o app concatena seus itens específicos (`userMenu` aditivo). `adminOnly` filtrado por `role==='admin'`.
  - **Uniformização de rotas:** global = `/conta` (no accounts.); local = `/perfil` (em cada serviço). glossario renomeia `/profile`→`/perfil`. Apps sem conta local (site/links/accounts) mostram só "Perfil Artifício".

### Site Astro (híbrido)
- **R8** — `apps/site` deixa de ter markup de header próprio divergente. O desenho é gerado a partir do mesmo contrato do shell (mesma lista, mesmos botões, mesmas classes CSS `artificio-*`), com:
  - parte estática (logo + nav + subnav de seções do blog) renderizada no build (zero-JS);
  - ilha React mínima (`client:load`/`client:idle`) só para sessão (Entrar/menu de conta) e toggle de tema interativo, reusando o componente central (padrão de `PortalHeader.astro`).
  - **Sem regressão de SEO:** nav continua em HTML no first paint; sem flash de tema; CSP preservada.
- **R9** — Remover/aposentar o JS inline de tema duplicado do site (`Base.astro`/`SiteHeader.astro`) em favor do mecanismo central de `theme.tsx`. Uma única implementação de lua/sol no projeto inteiro.

### Retrocompat e segurança
- **R10** — Todas as props novas são **aditivas e retrocompatíveis**; apps que não optarem por um botão não mudam. Auth/SSO é sagrado: nenhuma mudança no contrato de sessão (`sessionOverride`/`onLogout`/`onLoginClick`).

### Contrato de CSS/estilo (segue o site)
- **R11 — O padrão segue o contrato de CSS e estilo do site.** O `packages/ui/src/styles.css` já declara isso explicitamente (`styles.css:50` "Espelha o site (modelo provado)"). Toda peça nova (botões padrão, menu de conta, página `/conta`, telas `/perfil` e `/busca`) **reusa as classes `artificio-*` existentes** e o vocabulário de tokens, sem inventar CSS divergente:
  - botões do header: `.artificio-header-action` (+ `.artificio-header-action-badge` p/ "novidade"); toggle: `.artificio-theme-toggle` (`styles.css:310,328,353`).
  - **Contrato de tema (2 eixos, não confundir):** **conteúdo** reage a `:root[data-theme=dark]` (tokens `--fg`/`--surface`…); **header/footer** reagem a `[data-variant=dark]` (tokens fixos `--artificio-*`). Toda superfície nova respeita esse contrato. Ver §9.
  - cores/tipografia: tokens de `styles.css` (`--artificio-ink` navy `#020740`, `--artificio-brand` laranja `#FF5722`, fontes Oswald/Inter). Nada de cor/again hardcoded fora dos tokens (D040/D064).

---

## 5. Critérios de aceite

- `turbo build` verde em `packages/ui` + 5 consumidores (site/glossario/mesas/accounts/links).
- **Teste do "espelho":** adicionar um link em `modules.ts` aparece nos 5 projetos sem editar nenhum app. Adicionar/ligar um botão padrão no header central aparece em todos que ligam a flag, sem copiar código.
- Tema: em CADA app (incluindo site Astro), clicar o toggle alterna **conteúdo + nav + footer** juntos (`data-theme` e `data-variant`), e persiste cross-subdomínio (cookie `artificio_theme`). Zero JS de tema duplicado no site.
- Menu de conta logado: os 2 itens globais ("Perfil Artifício" + "Conta &lt;Serviço&gt;") aparecem idênticos em todos; itens locais seguem após.
- Botão de busca: presente só onde a flag está ligada; **executa** busca real do serviço; nenhum botão morto.
- Botão de changelog: presente onde ligado; badge "novidade" funciona; conteúdo é do app.
- Site Astro: nav no HTML do first paint (SEO), sem flash de tema, CSP presente; Lighthouse/SEO sem regressão vs beta.
- Smoke SSO em todos os consumidores (login/me/logout) — nada quebra.

## 6. Fora de escopo

- Backend de changelog/notificações (motor de conteúdo; o BOTÃO e o badge são centrais).
- Redesign visual de marca/logo (D040 mantém).
- Deploy/promote (cada um exige aprovação por ação, etapa separada).
- Cutover Gate C / WP raiz (intocável).

> **Entrou no escopo** (decisão do mantenedor 2026-06-21): (a) **conserto do "gerenciar conta global"** — accounts. não tem página de conta hoje (só login); esta spec constrói `/conta` no accounts (Fase 5). (b) **busca uniformizada `/busca`+API** em todos os serviços, com botão que executa (Fase 6). **Atenção:** o site **já tem busca** (Pagefind estático), e ela **não usa API** — há um conflito real com "/busca+API" a decidir (ver §9 e §10).

## 7. Riscos e impacto

- `packages/ui` Header/Footer = shell de TODOS (D058). Toda mudança redeploya os 5 apps. Props **aditivas** obrigatórias.
- Site é SEO-crítico (blog na raiz, D019). Híbrido escolhido para não injetar JS pesado; validar sem flash e com nav no HTML.
- Ilha React no site adiciona hidratação — manter mínima (só sessão + toggle), `client:idle` se possível.
- Auth sagrado: não tocar contrato de sessão.
- `D-PROMOTE-033-UPGRADES-REGRESSION`: se o toggle do site quebrou por upgrade (Node24/Vite8/Tailwind4) e não por cache, a unificação precisa rodar sobre o build novo — validar em BETA antes de prod.
- Carona com fix pendente `BL-UI-THEME-REACT-HEADER-VARIANT` (local, sem commit): esta spec deve **absorver** esse fix, não duplicá-lo.

## 8. Perguntas resolvidas (mantenedor, 2026-06-21)

1. **"Gerenciar conta global" do accounts.** → **conserto entra nesta spec.** Investigação confirmou que accounts. só tem tela de login (`app.ts:164`), sem página de conta — por isso "quebrado". Esta spec constrói a página `/conta` (Fase 5 da `tasks.md`).
2. **Rotas (PADRÃO DE UNIFORMIZAÇÃO):** conta global = **`/conta`** no `accounts.` (igual em todos); conta local = **`/perfil`** em cada serviço (glossario **renomeia** `/profile`→`/perfil`; mesas já é `/perfil`). site/links/accounts sem conta local.
3. **Busca (uniformizada):** rota **`/busca`** em todos, **chamando a API**, e o botão **executa** a busca (não redireciona pra clicar de novo). glossario/mesas/links têm backend de busca (feasible). **Site = exceção a decidir** (já tem Pagefind estático, sem API — ver §9/§10). Nunca placeholder/botão morto.

---

## 9. Revisão de precisão — fatos verificados contra o código (NÃO induzir a IA executora a erro)

Esta seção corrige impressões falsas. **DeepSeek: confie nestes fatos verificados, não na intuição.**

| # | Impressão errada/risco | FATO verificado (arquivo:linha) |
|---|---|---|
| 9.1 | "Site não tem busca / implementar Pagefind do zero" | **Site JÁ tem busca Pagefind funcional.** `SearchModal.astro` (modal lazy, índice `/pagefind/*` gerado no postbuild `pagefind --site dist`), aberto pelo `#search-toggle` (`SiteHeader.astro:33`) via `Base.astro:104`. Funciona em **build/preview**, não em `astro dev`. **Não é placeholder.** O comentário "Etapa 2" no `SiteHeader.astro` está desatualizado. |
| 9.2 | "Site não lê o cookie de tema / theme quebrado por design" | **Falso.** `Base.astro:53-69` (head `is:inline`) resolve `artificio_theme`→localStorage→SO e seta `data-theme` **antes do paint**; `Base.astro:108-184` aplica variant + toggle + grava cookie. O `data-theme="light"` (`Base.astro:42`) é só default SSR. Regressão = cache/upgrade, não mecanismo ausente. |
| 9.3 | "Botão de busca do site é morto" | **Falso.** `#search-toggle` está ligado ao `SearchModal` (`Base.astro:104` + `SearchModal.astro:16,74`). |
| 9.4 | "accounts é SPA com router; só adicionar rota `/conta`" | **Falso.** `accounts/frontend/src/main.tsx` é **uma única tela de login, SEM react-router**. Backend serve só `["/", "/login"]` (`app.ts:164`). Criar `/conta` exige **adicionar roteamento/condição de render** no frontend **e** servir `/conta` no backend (`app.get` array). Não é "só uma rota". |
| 9.5 | "Footer do site = compartilhado" | **Falso.** Site tem `SiteFooter.astro` próprio (`Base.astro:103`), fork do `packages/ui/Footer.tsx`. Outra duplicação a considerar (mesmo padrão do header). |
| 9.6 | "Login do site é simples link Entrar" | Na verdade `#site-login-link` é **role-aware via JS inline** (`Base.astro:137-167`): vira "Admin"→`/admin/` ou "Conta"→accounts conforme `/api/auth/me`. A ilha React do híbrido (Fase 4) tem de **preservar** esse comportamento. |
| 9.7 | Tokens/cores hardcoded | Contrato CSS real em `styles.css`: navy `--artificio-ink #020740`, laranja `--artificio-brand #FF5722`, header via `data-variant`, conteúdo via `data-theme`. Reusar tokens; não hardcodar (R11). |
| 9.8 | Nomes de pacote para `--filter` | Confirmados: `@artificio/mesas-frontend`, `@artificio/mesas-backend`, `@artificio/glossario-frontend`, `@artificio/glossario-backend`, `@artificio/links`, `@artificio/site`, `@artificio/ui`, `@artificio/auth`. |
| 9.9 | `getAccountsOrigin()` | Existe em `@artificio/auth` (`client.ts:21`), retorna **origin sem path**. Logo `getAccountsOrigin() + "/conta"` é correto. |
| 9.10 | Ordem dos botões no header | Hoje o `Header.tsx:206-211` renderiza `actions` → `ThemeToggle` → sessão. Ao centralizar busca/changelog, manter ordem coerente e documentada (R3-R5); não quebrar o slot `actions`. |

## 10. Conflito em aberto a decidir (busca do site) — PERGUNTAR ao mantenedor

O padrão pede **`/busca` + API**. O site é **SSG estático** e a busca é **Pagefind (índice estático, sem API)** — conteúdo do blog não tem API de busca hoje (fixtures `posts.json`; futura Content Layer Postgres D005/D048). Forçar "API" no site contradiz o SSG/zero-JS e o SEO.

Opções (decisão do mantenedor, Fase 6):
- **(A) Uniformizar só a ROTA:** site expõe `/busca` (página/rota) mantendo o **motor Pagefind** estático por baixo. Uniformidade visual + rota; "API" não se aplica ao site (exceção documentada). Menor custo, preserva SEO.
- **(B) Busca por API também no site:** construir endpoint de busca de conteúdo do site (depende da Content Layer/Postgres). Maior custo; só faz sentido quando o conteúdo sair de fixtures.
- **(C) Manter o site como está** (modal Pagefind no `#search-toggle`) e uniformizar `/busca`+API só nos apps com backend (glossario/mesas/links).

Recomendação: **(A)** agora (rota `/busca` + Pagefind), migrar para (B) quando a Content Layer existir.

**DECIDIDO (mantenedor 2026-06-21): opção (A).** Site expõe a rota uniforme **`/busca`** mantendo o **motor Pagefind estático** por baixo (sem API — é SSG; "chamar a API" é exceção documentada só do site). Migrar para busca por API quando o conteúdo sair de fixtures para a Content Layer/Postgres (D005/D048). glossario/mesas/links seguem `/busca`+API.
