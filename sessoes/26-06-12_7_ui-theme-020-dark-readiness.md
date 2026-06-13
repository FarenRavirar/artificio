# Sessao 26-06-12_7 — Spec 020: lua/sol dark-readiness (R4/R8, D-UX2)

- **Data:** 2026-06-12
- **Tipo:** SDD Completo (vai tocar `packages/ui` + app piloto)
- **Modulo/Pacote:** `packages/ui` (theme) + 1 piloto (`glossario` ou `mesas`, a decidir)
- **Gate relacionado:** nenhum. WP raiz/DNS/VM/deploy/producao fora de escopo.
- **Spec vinculada:** `specs/020-ui-theme-artificio-padrao/` (R4, R8, R9/R10, T4, B6/B7)
- **Estado:** aberta — T4 (checklist) feito; piloto + navy aguardam decisao do mantenedor antes de codar

## Objetivo
Habilitar lua/sol onde hoje NAO funciona (glossario e mesas, debito D-UX2). Cada app tem so METADE do tema:
- **glossario** = so light → falta dark.
- **mesas** = so dark → falta light.
Regra petrea (R4/R8): so habilita `Header showThemeToggle` DEPOIS que a variante faltante passar no
checklist de dark-readiness (`dark-readiness-checklist.md`). Sem variante completa = toggle quebrado.

## Mecanismo de tema (confirmado, canonico — NAO reinventar)
`packages/ui/src/theme.tsx`: cookie unico `artificio_theme` (`Domain=.artificiorpg.com`);
`applyTheme()` seta `documentElement.dataset.theme` → `<html data-theme="dark|light">`;
`resolveTheme`/`setTheme`/`ThemeToggle`/`ThemeIcon`. Header tem prop `showThemeToggle` (default off).
Referencia de CSS por variante: `apps/accounts/frontend/src/styles.css` e `apps/site/src/styles/global.css`
ja usam `[data-theme="dark"]`.

## T4 — Checklist de variant-readiness (FEITO)
Criado `specs/020-ui-theme-artificio-padrao/dark-readiness-checklist.md`: criterio objetivo e simetrico
(contraste AA texto/foco/disabled, estados hover/active/selected, forms/select/validacao, modais/drawers/toasts,
header/footer/toggle, mobile, troca claro↔escuro sem flash, evidencia + builds). Gate de fechamento explicito.
Marcar T4 done em tasks.md.

## Diagnostico de escopo dos dois pilotos (para a decisao)
Levantado por grep de cor hardcoded + infra de tema:

| | glossario (+dark) | mesas (+light) |
|---|---|---|
| arquivos .tsx | 21 | 134 |
| cor hardcoded em componentes | ~500 utilities padrao Tailwind (`bg-white`×77, `text-gray-500`×56, `border-gray-200`×50, `text-white`×45, `text-gray-400`×42, `bg-laranja`/`text-laranja`/`border-laranja`…) | ~90 hexes arbitrarios; 3 surfaces dominam (`#13213f`×33, `#0F1A2E`×32, `#1B2A4A`×12) |
| Tailwind | **v3** (config-driven, `tailwind.config.ts`) | **v4** (`@theme` + CSS vars) |
| infra de token semantico | **nao** (`:root` tem poucos vars, componentes usam utilities cruas) | **sim** (`--surface-*`/`--fg-*`/`--border-*` ja existem em `index.css`) |
| `darkMode` config | **AUSENTE** — v3 default = media-query, ignora nosso `data-theme`; precisa setar `darkMode:['selector','[data-theme=dark]']` + varrer `dark:` OU folha de override gigante | n/a |
| blast radius | **baixo** — app de leitura (glossario), 21 telas | **alto** — app operacional em PROD (mesas), 134 telas dark-assumed + muitos `rgba(255,255,255,…)` de fg |

### Leitura
- **mesas** tem infra de token melhor (light = sobrescrever bloco de vars sob `[data-theme="light"]`), MAS os ~90 hexes
  arbitrarios nao respondem a `data-theme` (precisam virar token), e e o app de PRODUCAO mais pesado → flip pra light = risco alto, superficie grande.
- **glossario** nao tem infra darkMode e usa centenas de utilities cruas, MAS e menor (21 telas), e a "base clara" designada da spec,
  e e app de baixo risco (leitura) → adicionar dark e o caminho natural, blast radius baixo, escopo bounded.

Recomendacao (alinhada ao retomada): **glossario ganha dark** como piloto unico. Confirmar com mantenedor (regra petrea).

## Decisao pendente acoplada — navy do glossario (R9/R2)
glossario usa navy proprio `#1a2744` (`--color-brand-navy`/`--color-input-text`/`--color-text-primary`), nao o canonico `#020740`.
A migracao `#1a2744`→`#020740` e fatia SEPARADA. Pergunta ao mantenedor: entra JUNTO do dark (faz sentido pois o dark vai
redefinir superficies de qualquer jeito) ou DEPOIS (isolar dark de mudanca de marca)? Se faltar decisao de paleta dark do
glossario (superficies escuras), registrar em decisions.md antes do codigo.

## Decisao do mantenedor (AskUserQuestion 2026-06-12) → D065
- **Piloto = glossario ganha DARK** (não mesas).
- **Navy migra JUNTO**: `#1a2744`→`#020740` (canonico) na mesma fatia.
Registrado **D065** em `decisions.md` (paleta dark + tecnica de remap).

## Implementacao (glossario dark) — LOCAL, sem commit
Mudancas (todas em `apps/glossario`, zero `packages/*` — isolamento; so consome `@artificio/ui`):
1. `tailwind.config.ts`: `darkMode: ['selector','[data-theme="dark"]']` (v3 default = media-query, ignoraria o cookie).
2. `src/index.css`: navy `#1a2744`→`#020740` (3 tokens light) + bloco `:root[data-theme="dark"]` (canvas `#0F1830`,
   surface `#1B2A4A`, sutil `#16223E`, texto `#EEF1F8`, muted/faint, foco→`--artificio-brand`) + **folha de remap**
   das utilities cruas → tokens dark: grays (bg/text/border + hover), customs (`azul-escuro`/`azul-medio`/`cinza-fundo`),
   tints semanticos (blue/green/red/amber/cyan/orange/yellow `-50/-100` translucido + texto `-600..900` clareado + bordas)
   e variantes de **opacidade** (`bg-white/60`, `bg-gray-50/30`…). Sem `!important` (especificidade `[data-theme] .util` vence).
   Backdrops `bg-black/NN` e `hover:bg-black` preservados de proposito.
3. `GlossarioHeader.tsx`: estado de tema (`resolveTheme` no mount) + botao lua/sol nas `actions` (`ThemeIcon`+`setTheme`
   canonicos) + `variant` reativo (logo navy↔negativo). NAO usa `Header showThemeToggle` (built-in nao re-renderiza o
   variant do logo); usa as MESMAS funcoes canonicas.
4. `main.tsx`: `applyTheme()` no boot.
5. `index.html`: inline boot script (espelha `resolveTheme`) p/ zero-flash antes do paint.

## Validacao (evidencia)
- **Build** `turbo run build --filter=@artificio/glossario-frontend` → verde (tsc + vite, 1582 modulos). Repetido 3x apos ajustes.
- **Smoke visual** (preview vite `dist`, porta 4324), claro E escuro, desktop E mobile (375px):
  - Home dark: canvas navy, hero claro, search dark + borda laranja, CTA laranja, cards dark. Light = identico ao original.
  - Modal (Notas de Atualizacao) dark: header navy, banda do corpo escura, botao ENTENDIDO, backdrop escuro.
  - Login dark: card "ACESSAR GLOSSARIO" navy, botao Google, callout de migracao, **footer compartilhado** dark.
  - Mobile dark: home + **drawer de nav** (Portal/Glossario/Mesas/…) legivel.
  - **Troca AO VIVO** (toggle) dark↔light sem reload e sem flash; boot script aplica antes do paint.
- **Contraste AA medido** (WCAG, sobre superficie efetiva): hero h2 **13.94**, subtitulo 18px **9.56**, muted 14px **5.18**,
  card h3 **12.58**, input text **13.94**, botao modal **8.84**, empty-state do modal **5.18** (corrigido — era 2.91 por
  `bg-gray-50/30` nao coberta; remap de opacidade resolveu). Todos ≥4.5 (texto) / ≥3 (grande/UI).
- **rg `artificio_theme`**: unica ocorrencia no glossario = inline boot que **le** o cookie canonico (mesmo nome = contrato
  compartilhado, espelha `resolveTheme`/site Base.astro). Runtime segue unico em `packages/ui/theme.tsx`. Sem reimplementacao.
- **git status**: mudancas isoladas em `apps/glossario/*` + docs/specs/decisions. `packages/*` intocado. **Sem commit/push/deploy.**

## Foco (item 2 do checklist) — verificado
- Inputs de formulario (Notifications/Profile) usam `focus:outline-[var(--color-brand-navy)]`; no dark `--color-brand-navy`
  foi remapeado p/ `var(--artificio-brand)` (#FF5722) → **anel de foco laranja** sobre input dark (#16223E), ≥3:1.
- Search da home: borda laranja permanente (contraste 15.76 sobre bg), sempre visivel — foco nao depende de cor sutil.
- Medicao das telas Notifications/Profile com input real focado fica no E2E autenticado (sem auth local).

## Residual (verificar com dados / mantenedor)
- Paginas com dados (cards de resultado de termo, telas admin, AddTermModal) nao carregaram no smoke local (sem backend).
  O remap cobre as familias de cor usadas nelas (gray/custom/semanticos), mas a confirmacao visual AA dessas telas
  fica para E2E autenticado com dados (mantenedor), como nos Gates anteriores. Itens do checklist: select-dropdown aberto,
  disabled de campos, validacao de forms — cobertos por tokens mas nao screenshotados.
- Habilitacao em PROD/beta = so com commit/push/deploy autorizados nominalmente. Hoje fica LOCAL.

## Segundo piloto — MESAS +LIGHT (D066), pedido do mantenedor "parte para o mesas light"
mesas = Tailwind v4, dark-only operacional em PROD. Variante faltante = **light**.
Escopo medido: ~1873 ocorrencias de utilities brancas (~28 classes `text-white`/`/NN`, `bg-white/NN`, `border-white/NN`)
+ ~21 hexes hardcoded de superficie (`bg-[#13213f]`/`[#0F1A2E]`/`[#1B2A4A]`…) + tokens `--surface/--fg/--border/--fill`.

### Mudancas (LOCAL, so `apps/mesas`, zero `packages/*`):
1. `src/index.css`: folha `[data-theme="light"]` (nao toca os 134 componentes): override dos tokens `:root`
   (fg branco→ink `#0B1220`; borders/fills branco→navy-alpha `rgba(2,7,64,…)`; surfaces dark→`#FFFFFF`/`#EEF2F8`/`#E6EBF4`)
   + override `@layer base` (body→`#F4F6FB`, placeholder, `select color-scheme:light`, `.glass`/`.app-select`)
   + remap das utilities brancas → ink/navy-alpha proporcional a opacidade + remap dos hexes hardcoded e gradientes → light.
   `text-[#020740]` (navy) preservado (bom contraste em light). Regras unlayered vencem o Tailwind v4 (sem `!important`).
2. `main.tsx`: boot **DEFAULT-DARK** — `resolveMesasTheme()` = light SO se cookie/localStorage explicitamente `light`;
   ausencia/OS-prefers → **dark** (protege o app operacional de regressao em prod; desvio deliberado do resolveTheme canonico).
3. `AppShell.tsx`: estado de tema (init do dataset que o boot setou) + botao lua/sol nas `actions` (`ThemeIcon`+`setTheme`
   canonicos) + `variant` reativo de Header **e** Footer (navy↔light).
4. `index.html`: inline boot script default-dark (zero-flash).

### Validacao (evidencia)
- **Build** `turbo run build --filter=@artificio/mesas-frontend` → verde (tsc + vite/rolldown).
- **DEFAULT-DARK confirmado**: sem cookie `artificio_theme` → `data-theme=dark`, body `#1B2A4A`. **Prod nao regride.**
- **Smoke** (preview porta 4325) na **landing publica `/`** (unica rota sem auth):
  - Dark (default) inalterado: hero/search/chips/catalogo. Light: page `#F4F6FB`, hero navy `#0B1220`, search light + placeholder
    dark + Buscar laranja, chips light, "Ver catalogo" light, header/footer **variant light**. Mobile (375) light limpo.
  - **Troca AO VIVO** light↔dark sem reload (body `#F4F6FB`↔`#1B2A4A`).
  - Console: so erros `useFetchTables` (backend ausente — esperado), nada de tema.
- **Contraste AA (light)**: hero/chip/botao navy sobre `#F4F6FB` = **17.32**; texto muted (fg-low 0.60α composto) ≈ **4.85** (≥4.5). OK.
- **rg `artificio_theme`** no mesas = inline boot + `resolveMesasTheme` que LEEM o cookie canonico (default-dark proprio);
  escrita via `setTheme` canonico. Runtime segue unico em `packages/ui/theme.tsx`. Sem reimplementacao do mecanismo.
- **Isolamento:** zero `packages/*` tocado (so consome `@artificio/ui`). `git status` so `apps/mesas/*` + docs. **Sem commit/push/deploy.**

### Residual mesas (E2E mantenedor — auth+backend)
mesas auth-gateia as telas operacionais (catalogo com dados, detalhe de mesa, painel, gestao, forms multi-step de criar mesa,
modais, sino de notificacao). So a landing publica `/` renderiza local. O remap cobre as familias de cor dessas telas
(white-utils + hexes + tokens), mas a confirmacao visual AA delas no claro fica para E2E autenticado com backend (mantenedor).

## Deploy BETA (autorizado: "commit + push + deploy de todo o diff")
- Branch `feat/020-lua-sol-pilots` → commit `464b5e5` → PR **#24** → `pr-checks` verde (mesas/glossario/accounts CI + Amazon Q + lints) → **squash-merge em `dev`** (`69feb8e`).
- Deploys: `deploy-mesas` **auto** (mesasbeta) ✓ · `deploy-glossario` **dispatch mode=deploy** (glossariobeta) ✓ · `deploy-accounts` auto ✓ · `promote-dev-to-main` = invariante `main ⊆ dev` (NÃO é promote prod) ✓.
- **Smoke beta (CSS/HTTP servido):**
  - `glossariobeta` 200 · CSS `index-792W88UE.css` com `[data-theme=dark]` ×93 + remap `.text-azul-escuro` + `eef1f8` · inline boot `dataset.theme` presente · `/api/terms` **200** (dados carregam p/ E2E).
  - `mesasbeta` 200 · CSS `index-DcGhWdSo.css` com `[data-theme=light]` ×56 + `0b1220` ×23 · inline boot com fallback `: 'dark'` (**default-dark** confirmado) · `/api/v1/me/options` **401** (auth ok).
  - `accounts` 200 · **WP raiz `artificiorpg.com` 200 intocado**.
- **PROD intocado** (sem promote `dev→main` de código; sem deploy prod).
- **Pendente E2E mantenedor (provas com dados):** logar nos betas, alternar lua/sol, validar AA nas telas auth-gated — glossariobeta (cards de termo/admin/forms) no dark; mesasbeta (catálogo/painel/gestão/forms/modais) no light, confirmando que o default segue dark.

## Reviews do PR #24 corrigidos (LOCAL, pos-beta — aguardando permissao p/ commit)
Mantenedor: "corrija os reviews da amazon e codex e registre o resto como debito" + 2 ajustes de UI. **Sem commit.**
1. **Amazon Q (flash de tema)** — `GlossarioHeader`: init `useState<Theme>('light')`+useEffect → `useState(() => resolveTheme())`
   (sem flash de icone/logo no mount; useEffect redundante removido). Verificado: boot dark → ícone **sol** correto no 1º paint.
2. **Codex (default-dark furado por cookie implícito) — histórico, superado por D067** — `accounts` gravava `artificio_theme` da pref do SO no boot, então o
   cookie compartilhado nao e opt-in confiavel. Fix no mesas: boot so vira light com **marcador proprio `mesas_theme==='light'`**
   (grava so ao alternar dentro do mesas); cookie compartilhado ignorado p/ o default. `main.tsx` + `index.html` (inline boot) +
   `AppShell` (toggle grava `mesas_theme`). **Verificado naquele momento:** cookie `artificio_theme=light` SEM marcador → mesas boota **dark**
   (`#1B2A4A`); com `mesas_theme=light` → light; toggle ao vivo atualiza marcador. Depois D067 corrigiu a causa-raiz e removeu o marcador local.
3. **"Entrar com Google" → "Entrar"** — `packages/ui` Header `loginLabel` default. Verificado no mesas mobile.
4. **Logo deformada no mobile** — era flex-item espremido no grid `1fr` do header. Fix `packages/ui` `.artificio-brand-logo`:
   `object-fit:contain` + `flex-shrink:0` (mantem proporcao, nao estica). Verificado mobile 375: logo intacta + "Entrar" cabe.

**Débitos registrados naquela revisão:** B8 foi reclassificado pelo mantenedor em 2026-06-13 e está quitado: "dinamismo" = logo responsiva sem deformar no mobile, já resolvida com `object-fit:contain` + `flex-shrink:0`; sem débito de animação. B9 era "accounts grava cookie de tema do OS-pref no boot", mas foi corrigido depois por D067.
**Validação:** `turbo build` **13/13** + `check-token-parity` OK (packages/ui tocado = SDD/cross-módulo). **Sem commit/push/deploy.**
**ATENÇÃO:** beta (PR #24) ainda roda a versão PRÉ-fix (flash, "Entrar com Google", logo deformada, cookie). Subir os fixes ao beta = novo commit+push+deploy (aguardando autorização nominal).

## Estado
T4 (checklist) entregue. **DOIS pilotos implementados, validados LOCAL e NO BETA** ate o limite local:
glossario **+dark** (D065, navy migrado junto) e mesas **+light** (D066, default-dark preservado). lua/sol habilitado em
ambos no CODIGO LOCAL; **nenhum em prod** (cada um so habilita apos dark-readiness completo com dados = E2E mantenedor).
Build verde nos dois; smoke claro/escuro/mobile + AA medido; troca ao vivo sem flash; runtime de tema unico. Sem commit/push/deploy.

## Revisao T3 — contrato de tokens (2026-06-13)
Pedido do mantenedor: revisar 1 a 1 pendencias da Spec 020, comecando por **contrato de tokens**.

Pesquisa:
- Lidos `spec.md`, `plan.md`, `tasks.md`, sessoes `26-06-12_6`/`26-06-12_7`.
- Lidos `packages/ui/src/tokens.ts`, `src/styles.css`, `tailwind-preset.js`, `scripts/check-token-parity.mjs`, exports do pacote e consumidores principais.
- Rodado `node packages/ui/scripts/check-token-parity.mjs` → OK.

Decisao tecnica:
- Nao precisa alterar codigo para fechar T3: `dev` ja tem fonte unica, CSS vars, Tailwind preset e trava de paridade.
- Lacuna real era documental: nomes, papeis, aliases temporarios e limites do contrato nao estavam reunidos em uma pagina canonica.

Edicao planejada:
- Criar `specs/020-ui-theme-artificio-padrao/token-contract.md`.
- Marcar T3 como fechado apontando para esse contrato.
- Registrar lacunas futuras: estados semanticos, spacing/shadow completos e tokens dark estruturados continuam em primitives/recipes/T14, nao bloqueiam T3.

## Revisao T5 — consolidacao `artificio_theme` (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **consolidacao `artificio_theme`**.

Pesquisa:
- `packages/ui/src/theme.tsx` segue fonte canonica: `artificio_theme`, `readThemeCookie`, `writeThemeCookie`, `resolveTheme`, `applyTheme`, `setTheme`, `ThemeIcon`, `ThemeToggle`.
- `glossario` consome API canonica no runtime (`applyTheme`, `resolveTheme`, `setTheme`); o inline boot em `index.html` e espelho zero-flash.
- `mesas` consome `setTheme` no toggle e tem boot proprio deliberado: le cookie compartilhado; sem cookie cai em `dark` para preservar default operacional.
- `accounts` tem comportamento D067 correto (nao grava cookie no boot; grava so no toggle), mas ainda duplica helpers locais (`THEME_COOKIE`, cookie/localStorage/matchMedia/dataset).
- `site` Astro tem comportamento D067 correto, mas ainda duplica scripts inline de leitura/escrita por causa do requisito zero-JS/sem flash.
- Trechos anteriores desta sessao que falam em `mesas_theme` sao historico pre-D067; a verdade atual e D067: sem marcador local, cookie unico compartilhado, mesas default-dark sem cookie.

Decisao tecnica:
- T5 nao exige migrar codigo agora; exige plano de consolidacao com rollback.
- Fechar T5 por documento canonico e deixar a remocao real da duplicacao em `accounts`/`site` para T14 ou fatia futura autorizada.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/theme-consolidation.md`.
- Marcado T5 como fechado em `tasks.md`.

Validacao planejada:
- `rg` de `artificio_theme`/`matchMedia`/`dataset.theme` deve mostrar apenas ocorrencias permitidas enquanto a migracao nao ocorrer.
- Quando virar codigo: build de `accounts`/`site`, smoke sem flash, cross-subdominio e mesas sem cookie = dark.

## Revisao T6 — header/nav/actions (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **header/nav/actions**.

Pesquisa:
- Lidos `packages/ui/src/Header.tsx`, `Nav.tsx`, `modules.ts`, `styles.css`.
- Lidos consumidores: `apps/mesas/frontend/src/components/AppShell.tsx`, `HeaderActions.tsx`, `NotificationBell.tsx`; `apps/glossario/frontend/src/components/GlossarioHeader.tsx`; `apps/site/src/components/SiteHeader.astro`, `Base.astro`, `lib/content.ts`.
- `Header` ja expõe o contrato D058: `navItems`, `moduleNav`, `userMenu`, `actions`, `sessionOverride`, `onLogout`, `onLoginClick`, `showThemeToggle`.
- `mesas` e a referencia visual mais completa para actions: tema, changelog com badge, notificacoes logado. Dados ficam no app.
- `glossario` usa o mesmo shell e injeta tema, adicionar sugestao e changelog. Comentario de auth legado estava obsoleto pos-spec 015.
- `site` e excecao static/zero-JS: espelha `defaultNavItems` em `MODULES` e usa `SECTIONS` como subnav; paridade static continua em T9/T11.

Decisao tecnica:
- Nao mover fetch de changelog/notificacao/feedback para `packages/ui`.
- Fechar T6 por contrato escrito e propor helper futuro `HeaderAction` somente visual.
- Corrigir comentario obsoleto do `GlossarioHeader` (documentacao inline), sem alterar runtime.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/header-nav-actions.md`.
- Marcado T6 como fechado em `tasks.md`.
- Atualizado comentario em `apps/glossario/frontend/src/components/GlossarioHeader.tsx`.

Validacao:
- `rg "<Header|moduleNav|actions=|userMenu|artificio-header-action"` usado para inventario.
- `git diff --check` nos arquivos tocados.

## Revisao T7/B4 — primitives de formulario e estado (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **primitives de formulario/estado**.

Pesquisa:
- `packages/ui/src` hoje tem marca, Header/Footer/Nav, tema, tokens e CSS; nao tem primitives.
- `mesas` tem bons candidatos vivos: `features/admin/components/Field.tsx`, `CatalogToolbar.tsx`, `components/ui/LoadingState.tsx`, `ErrorState.tsx`, `FilterDrawer.tsx`, `SystemSuggestionModal.tsx`, `FeedbackModal.tsx`.
- `glossario` repete wrappers/classes de formulario em `AddTermModal.tsx`, `FilterPanel.tsx` e telas admin.
- `site-admin` ja possui CSS proprio para `.btn`, `.card`, `label`, `input`, `.badge`, `.modal`, counters e estados editoriais.
- `accounts` e tela compacta de auth; deve esperar `AuthPage`/recipe antes de puxar primitives.

Decisao tecnica:
- Nao implementar primitives agora: `packages/ui` e pacote compartilhado; codigo exige SDD Completo e smoke dos consumidores.
- Fechar T7 como especificacao, nao como runtime.
- B4 fica parcial: contrato pronto, implementacao pendente em T14/fatia propria.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/primitives-form-state.md`.
- Marcado T7 como fechado em `tasks.md`.
- Marcado B4 como parcial em `tasks.md`.

Validacao:
- Inventario por `rg --files` e leitura dos candidatos principais.
- `git diff --check` nos arquivos tocados.

## Revisao T8/B5 — recipes de pagina (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **recipes de pagina**.

Pesquisa:
- `PublicSearchPage`: `apps/glossario/frontend/src/App.tsx` (`HomePage`) usa busca, landing, filtros, resultados agrupados, loading/error/empty e footer.
- `CatalogPage`: `apps/mesas/frontend/src/pages/CatalogoPage.tsx` usa header de catalogo, filtros desktop/mobile, chips ativos, refresh, empty, grid e paginacao.
- `AdminWorkspacePage`: `apps/mesas/frontend/src/pages/GestaoPage.tsx` e `apps/site-admin/src/App.tsx`/`PostsList.tsx`/`PostEditor.tsx` mostram abas/sidebar, toolbar, tabelas, editor, modais/drawers, busy/toast.
- `AuthPage`: `apps/accounts/frontend/src/main.tsx`, `apps/mesas/frontend/src/pages/LoginPage.tsx` e `apps/glossario/frontend/src/pages/Login.tsx` cobrem painel curto, logo, CTA Google, retorno e validacao de sessao.
- `EditorialPage`: `apps/site/src/pages/blog/[slug].astro` e `apps/site/src/pages/[slug].astro` cobrem Astro/SSG, breadcrumb, meta/canonical/json-ld, prose sanitizado, capa, TOC, tags e relacionados.
- `DetailPage`: `apps/mesas/frontend/src/pages/MesaPage.tsx`, `features/table/TableView.tsx`, `features/master/MasterProfilePage.tsx` e `glossario/ResultCard.tsx` cobrem hero/detalhe, blocos, CTA/sidebar, owner/admin actions e estados.

Decisao tecnica:
- Recipes sao guias de composicao: slots, ordem, estados e fronteiras.
- Nao implementar agora em `packages/ui`: shared code exigiria SDD Completo + builds/smokes. T8/B5 pedem documentacao, nao runtime.
- `EditorialPage` precisa continuar static-friendly para Astro/zero-JS; isso conversa com T9, mas nao resolve T9.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/page-recipes.md`.
- Marcado T8 como fechado em `tasks.md`.
- Marcado B5 como fechado em `tasks.md`.

Validacao:
- Inventario por `rg --files` + leitura dos exemplos vivos.
- `rg` de `T8|B5|page-recipes|PublicSearchPage|CatalogPage|AdminWorkspacePage|AuthPage|EditorialPage|DetailPage`.
- `git diff --check` nos arquivos tocados.

## Revisao T9/B2 — caminho Astro/zero-JS (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **caminho Astro/zero-JS**.

Pesquisa:
- `apps/site/src/layouts/Base.astro`: compoe shell Astro, injeta favicon, meta/json-ld, scripts vanilla de tema/sessao/TOC.
- `SiteHeader.astro`/`SiteFooter.astro`: shell publico em `.astro`, reusando classes/CSS do design system, sem componente React.
- `SearchModal.astro`: Pagefind lazy-load apenas no abrir da busca.
- `Analytics.astro`: GA4 so quando `PUBLIC_GA_ID` existe.
- `lib/content.ts`: `MODULES` espelha `defaultNavItems` para nao puxar barrel React/auth no nav.
- `apps/site/server/*`: usa `@artificio/auth` server-side para admin; fora do publico SSG.
- `apps/site-admin`: React isolado em `/admin`; fora do blog publico.

Validacao executada:
- `pnpm --filter @artificio/site build` → verde; Astro `output: "static"`; 45 paginas; Pagefind indexou 8 paginas.
- `apps/site/dist/_astro` contem somente CSS (`_slug_*.css`), sem JS de shell.
- `rg --files apps/site/dist | rg '\.js$'` mostra apenas `/pagefind/*`.
- Grep do `dist` mostra scripts inline permitidos (`artificio_theme`, `api/auth/me`, Pagefind lazy), sem React.
- Aviso nao bloqueante: `@import rules must precede all rules` vindo de `packages/ui/src/styles.css`/font import apos compilacao.

Decisao tecnica:
- Fechar T9 por estrategia documentada: publico = Astro SSG + `.astro` shell + CSS vars/classes + vanilla JS curto.
- Nao implementar agora export static em `packages/ui` (shared code).
- B2 fica parcial: estrategia fechada, mas export/paridade real ainda depende de T11.
- Lacuna registrada: `Base.astro` importa `faviconV2` pelo barrel `@artificio/ui`; HTML segue sem React, mas contrato melhor e criar subpath static (`@artificio/ui/brand-static`/`static`) ou teste de paridade.
- Debito novo registrado: build T9 confirmou `output: static`, 45 paginas + Pagefind; aviso CSS antigo `@import rules must precede all rules` (font import depois de regra) nao quebra T9, mas deve virar limpeza futura (**B12 / D-CSS1**).

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/astro-zero-js.md`.
- Marcado T9 como fechado em `tasks.md`.
- Marcado B2 como parcial em `tasks.md`.
- Registrado B12 em `tasks.md` e D-CSS1 no backlog de debitos.

Validacao documental:
- `rg` de `T9|B2|astro-zero-js|zero-JS|Pagefind|brand-static`.
- `git diff --check` nos arquivos tocados.

## Revisao T10 — rollout piloto (2026-06-13)
Pedido do mantenedor: continuar pendencias da Spec 020, item **rollout piloto**.

Pesquisa:
- Estado real cruzado: tokens/paridade (T13), tema compartilhado D067, glossario+dark (B6 residual), mesas+light (B7 residual), site Astro/zero-JS (T9), B2/T11 static parity e T14 primitives/recipes.
- `accounts` ja funciona como canario de SSO/tema, mas ainda tem helper local de tema.
- `glossario` e `mesas` ja tiveram codigo promovido; o plano precisa separar "promovido" de "E2E autenticado com dados fechado".
- `site` nao deve receber React/auth client no publico; rollout dele e static parity/export.
- `site-admin` e React isolado; rollout dele deve esperar primitives reais.

Decisao tecnica:
- Fechar T10 como plano/documento, nao como execucao.
- Ordem canonica: accounts → glossario → mesas → site → site-admin.
- B6/B7 continuam parciais ate E2E autenticado com dados; B2/T11 continuam abertos ate export/paridade static; T14 continua para implementacao compartilhada futura.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/rollout-pilots.md`.
- Marcado T10 como fechado em `tasks.md`.

Validacao:
- `rg` de `T10|rollout-pilots|accounts|glossario|mesas|site-admin|rollback`.
- `git diff --check` nos arquivos tocados.

## Revisao T11/B2 — paridade brand/static shell (2026-06-13)

Pedido do mantenedor: continuar pendencias da Spec 020, item **paridade brand/static shell**, focado so em documentacao.

Pesquisa:
- `Base.astro` ainda importa `faviconV2` pelo barrel `@artificio/ui`.
- `SiteHeader.astro` e `SiteFooter.astro` continuam `.astro` e static-friendly.
- `global.css` consome `@artificio/ui/styles.css`, entao o CSS/tokens do shell ja vem da fonte comum.
- `lib/content.ts` ainda importa `brand.json` e declara `MODULES` local.
- `brand.json` espelha `brandLogoNavy`/`brandLogoNeg`.
- `prep-fixtures.mjs` gera `brand.json` lendo `packages/ui/src/brand.ts` por regex.
- `packages/ui/src/modules.ts` e `MODULES` local estao iguais hoje, mas sem teste/trava.

Decisao tecnica:
- Nao fechar T11 em rodada doc-only. O estado atual funciona, mas ainda permite drift.
- Fechar so quando houver `@artificio/ui/static` (subpath sem React/auth/theme) ou teste real de paridade.
- Manter o site sem React island no publico; Header/Footer seguem Astro.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/brand-static-shell.md`.
- `tasks.md`: T11 revisado, mas aberto; B2 segue parcial com referencia ao novo documento.

Validacao documental:
- `rg` de `T11|B2|brand-static-shell|@artificio/ui/static|brand.json|MODULES`.
- `git diff --check` nos arquivos tocados.

## Revisao B2-B7 — backlog 020 (2026-06-13)

Pedido do mantenedor: revisar, focado so em documentacao, os debitos **B2, B3, B4, B5, B6, B7**.

Pesquisa:
- B2: cruzado `astro-zero-js.md`, `brand-static-shell.md`, `Base.astro`, `SiteHeader.astro`, `SiteFooter.astro`, `lib/content.ts` e `brand.json`.
- B3: cruzado `header-nav-actions.md`, `packages/ui/src/Header.tsx`, actions do mesas (`HeaderActions`, `NotificationBell`) e glossario (`GlossarioHeader`, `ChangelogModal`).
- B4/B5: cruzado `primitives-form-state.md`, `page-recipes.md`, exemplos vivos em mesas/glossario/site-admin.
- B6/B7: cruzado D065/D066/D067, `rollout-pilots.md`, CSS/boot/toggle atuais de glossario e mesas.

Decisao tecnica:
- B2 continua parcial: estrategia fechada, mas sem `@artificio/ui/static`/teste real.
- B3 sai de aberto bruto para parcial: slot/classes/actions existem e API proposta esta documentada; falta componente `HeaderAction`.
- B4 continua parcial: contrato fechado, implementacao `packages/ui` pendente; variantes semanticas dependem de B11.
- B5 fica fechado: debito era documental, recipes estao descritas.
- B6 continua parcial: dark do glossario ja esta promovido, mas falta E2E autenticado com dados/admin/forms.
- B7 continua parcial: light do mesas ja esta promovido, mas falta E2E autenticado das telas operacionais.

Edicao feita:
- Criado `specs/020-ui-theme-artificio-padrao/backlog-b2-b7-review.md`.
- Atualizado `tasks.md` para refletir status real de B2-B7 e corrigir B6/B7 de "local/sem commit" para "implementado/promovido + residual E2E".

Validacao documental:
- `rg` de `B2|B3|B4|B5|B6|B7|backlog-b2-b7-review`.
- `git diff --check` nos arquivos tocados.
