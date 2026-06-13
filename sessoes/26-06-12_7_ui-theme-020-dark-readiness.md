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
2. **Codex (default-dark furado por cookie implícito)** — `accounts` grava `artificio_theme` da pref do SO no boot, então o
   cookie compartilhado nao e opt-in confiavel. Fix no mesas: boot so vira light com **marcador proprio `mesas_theme==='light'`**
   (grava so ao alternar dentro do mesas); cookie compartilhado ignorado p/ o default. `main.tsx` + `index.html` (inline boot) +
   `AppShell` (toggle grava `mesas_theme`). **Verificado:** cookie `artificio_theme=light` SEM marcador → mesas boota **dark**
   (`#1B2A4A`); com `mesas_theme=light` → light; toggle ao vivo atualiza marcador. Causa-raiz accounts = **débito B9**.
3. **"Entrar com Google" → "Entrar"** — `packages/ui` Header `loginLabel` default. Verificado no mesas mobile.
4. **Logo deformada no mobile** — era flex-item espremido no grid `1fr` do header. Fix `packages/ui` `.artificio-brand-logo`:
   `object-fit:contain` + `flex-shrink:0` (mantem proporcao, nao estica). Verificado mobile 375: logo intacta + "Entrar" cabe.

**Débitos registrados:** B8 (dinamismo/animação da logo — precisa direção de design) · B9 (accounts grava cookie de tema do OS-pref no boot).
**Validação:** `turbo build` **13/13** + `check-token-parity` OK (packages/ui tocado = SDD/cross-módulo). **Sem commit/push/deploy.**
**ATENÇÃO:** beta (PR #24) ainda roda a versão PRÉ-fix (flash, "Entrar com Google", logo deformada, cookie). Subir os fixes ao beta = novo commit+push+deploy (aguardando autorização nominal).

## Estado
T4 (checklist) entregue. **DOIS pilotos implementados, validados LOCAL e NO BETA** ate o limite local:
glossario **+dark** (D065, navy migrado junto) e mesas **+light** (D066, default-dark preservado). lua/sol habilitado em
ambos no CODIGO LOCAL; **nenhum em prod** (cada um so habilita apos dark-readiness completo com dados = E2E mantenedor).
Build verde nos dois; smoke claro/escuro/mobile + AA medido; troca ao vivo sem flash; runtime de tema unico. Sem commit/push/deploy.
