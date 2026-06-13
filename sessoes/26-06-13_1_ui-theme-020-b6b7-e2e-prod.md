# Sessao 26-06-13_1 — Spec 020 B6/B7: E2E autenticado lua/sol em PROD

- **Data:** 2026-06-13
- **Tipo:** Sem SDD (validacao/evidencia — ZERO codigo se passar)
- **Modulo/Pacote:** `apps/glossario` (dark) + `apps/mesas` (light) — somente verificacao em PROD
- **Gate relacionado:** nenhum. WP raiz/DNS/VM/deploy/producao fora de escopo. Sem commit/push/deploy.
- **Spec vinculada:** `specs/020-ui-theme-artificio-padrao/` (B6, B7), checklist `dark-readiness-checklist.md` (T4)
- **Estado:** ABERTA — guiando E2E com o mantenedor logado em prod

## Objetivo
Fechar B6 e B7 com E2E autenticado em PRODUCAO. lua/sol JA esta em prod como opt-in
(D065 glossario dark, D066/D067 mesas light, tema compartilhado cross-subdominio).
Falta a unica coisa que o smoke local nao alcancou: as telas COM DADOS (auth-gated).

Regra petrea (R4/R8): so se considera dark/light-readiness fechada quando a variante
faltante passa o checklist nas telas reais com dados. Se passar = ZERO codigo. Se falhar
= registrar achado AA + decidir fatia de correcao (sem codigo nesta sessao salvo autorizacao).

## Escopo do E2E (telas que o smoke local NAO cobriu)
**glossario PROD (https://glossario.artificiorpg.com) — variante DARK:**
- cards de resultado de termo (busca com dados)
- telas admin
- AddTermModal (adicionar termo)
- forms / selects / validacao de formulario

**mesas PROD (https://mesas.artificiorpg.com) — variante LIGHT:**
- catalogo com dados
- detalhe de mesa
- painel
- gestao
- forms multi-step (criar mesa)
- modais / sino de notificacao

## Como medir (do checklist T4)
- AA WCAG 2.1: >=4.5:1 texto normal; >=3:1 texto grande (>=18.66px bold / >=24px) e UI/foco.
- Amostra de cor REAL sobre superficie REAL (nao "deveria dar"). Registrar par cor/fundo + razao.
- Mantenedor manda prints; eu meco AA dos pares texto/fundo e estados (texto/muted/foco/disabled/botao/input).

## Procedimento
1. Mantenedor loga em PROD e ativa a variante faltante via toggle lua/sol (icone no header).
   - glossario: alternar para DARK.
   - mesas: alternar para LIGHT (default e dark; precisa clicar).
2. Navega pelas telas com dados acima; manda print de cada.
3. Eu meco contraste dos pares principais por print, marco itens do checklist.
4. Fecho B6/B7 se todos os itens obrigatorios passarem; senao registro achado.

## Checklist de fechamento (T4 — itens obrigatorios)
Ver `specs/020-ui-theme-artificio-padrao/dark-readiness-checklist.md`:
1. Contraste texto AA (corpo/muted/card/sobre laranja)
2. Estados interativos (hover/active/focus/disabled/selected)
3. Formularios (input/select+dropdown/check-radio/validacao/label)
4. Modais/drawers/overlays (backdrop/superficie/fechar/toasts)
5. Header/footer (variante coerente, toggle AA, auth vs anon)
6. Mobile/responsivo (360-414px, alvo >=44px, foco teclado)
7. Troca de tema runtime (sem flash, persistencia, cookie unico cross-subdominio)
8. Evidencia (prints claro+escuro desktop+mobile, medicoes AA, rg theme unico, builds)

## Evidencia (preencher durante o E2E)
### glossario DARK
- **Print 1 — home logado, DARK (desktop ~1350px).** Chrome + landing.
  - Hero "O GRANDE GLOSSÁRIO" (branco ~#FFFFFF / navy #0F1830) ≈ **16:1** ✓ (grande)
  - "DE RPG DE MESA" (laranja #FF5722 / #0F1830) ≈ **5.5:1** ✓ (grande/marca)
  - Subtitulo muted ("A maior base…") cinza-claro / navy ≈ **8.6:1** ✓
  - Tagline faint ("The Witcher · …") ≈ **5.5:1** ✓
  - Search placeholder cinza / input dark #16223E ≈ **5:1** ✓ (placeholder)
  - Botao busca: icone branco / laranja #FF5722 ≈ **3.3:1** ✓ (UI ≥3)
  - Badge "UM PRESENTE…" (laranja / pill translucido) ≈ **5.5:1** ✓
  - Header: logo branco + nav branca / navy ✓; toggle (icone sol = trocar p/ light) visivel ✓ → itens 5 (header) + 1 (texto) OK no chrome.
  - **BORDERLINE (pré-existente, não-dark):** CTA "Cadastre-se e contribua" texto branco / laranja #FF5722 ≈ **3.3:1** → OK só como texto grande/bold (D064: laranja=acento, texto branco/navy). Vale nos DOIS temas; não bloqueia dark.
  - **BUG funcional (não-AA):** CTA logado vai p/ `/login` e mantém rótulo de cadastro → **D-GLOS-CTA** (backlog `26-06-12_2`). Não bloqueia dark-readiness.
- **Telas com DADOS (1-5) — REVISADAS PELO MANTENEDOR em PROD: OK.** cards de resultado, detalhe de termo, AddTermModal, select/foco/validação, admin, mobile → dark legível, sem quebra. **B6 dark-readiness das telas com dados = aprovado por revisão do mantenedor.**

## Correção de bug encontrado no E2E — D-GLOS-CTA (autorizada: "ajustar o que falei acima")
- **Bug:** CTA hero logado ia p/ `/login` (via `/register`) + rótulo "Cadastre-se e contribua".
- **Fix (LOCAL, só `apps/glossario`, zero `packages/*`):**
  - `components/LandingSection.tsx`: props novas `isAuthenticated`/`onContribute`. Logado → `<button>` **"Contribua →"** que chama `onContribute` (abre `AddTermModal`). Anônimo → mantém `<Link to="/register">Cadastre-se e contribua →</Link>`.
  - `App.tsx` `HomePage`: `useUI().openAddTerm` + passa `isAuthenticated={!!user} onContribute={openAddTerm}`. Sem import circular (useUI vive no próprio App.tsx).
- **Validação:** `turbo build --filter=@artificio/glossario-frontend` **verde** (tsc + vite, 1582 módulos). tsc valida ligação das props.
- **Verificação browser:** ramo anônimo trivial (inalterado). Ramo **logado** depende de sessão SSO (`accounts.`) — não exercitável em preview local sem backend/cookie; mantenedor valida em prod pós-deploy (deploy NÃO autorizado nesta sessão).
- **Sem commit/push/deploy.**

### mesas LIGHT — B7 REPROVOU no E2E; fixes aplicados (LOCAL)
Mantenedor mandou 5 prints. 4 falhas reais de light (smoke local não pegava — auth-gated):
1. **Search da landing invisível** — `.glass` em light = `rgba(2,7,64,0.04)` (sumia sobre `#f4f6fb`); placeholder branco.
2. **Botões Editar/Desativar + status + preço** (`TableActionPanel` owner) — cores semânticas claras (`text-blue-300`/`text-yellow-300`/`text-orange-400`…) sobre tint pálido = invisível.
3. **Painel do catálogo "bugado" (cinza)** (`CatalogoPage`/`SystemTreeSelector`) — hexes COM opacidade `bg-[#0a1628]/90`, `/65`, `bg-[#10203a]/80` (Tailwind v4 = classe distinta, não coberta pelo remap de hex sólido).
4. **Página do mestre** (`MestreHero` + `MestrePage.css`) — usa classes CSS dedicadas `.hero-*`/`.trust-item`/`.stat-*` com cores dark hardcoded, fora de `[data-theme=light]`. Hero = gradient navy by-design.

**Fixes aplicados (só `apps/mesas/frontend/src/index.css`, zero `packages/*`):**
- `.glass` light → `#ffffff` + borda `rgba(2,7,64,.14)` (search visível).
- Placeholder light movido p/ DENTRO de `@layer base` — a regra dark base usa `!important` em layer; pela cascata de camadas `!important` layered vencia o unlayered → override nunca aplicava. Agora `rgba(11,18,32,.55)` aplica.
- Remap de cores semânticas dark-design → escuras p/ AA em light: `text-{blue,green,yellow,orange,red,purple}-{300,400,100}` + `/NN` → `-700/-800`; `text-gray-300`→slate-600.
- Remap dos hexes COM opacidade: `bg-[#0a1628]/90|/65`→`#eef2f8`; `bg-[#10203a]/80`→`#fff`.

**Validação (preview local mesas-build :4325, light):**
- `turbo build --filter=@artificio/mesas-frontend` **verde** (2x).
- `.glass` = `rgb(255,255,255)`; input ink; **placeholder** = `rgba(11,18,32,.55)` (era branco) ≈ 4.4:1 ✓.
- Sondas computadas em light: blue-700 `#1d4ed8` (6.3:1), yellow-700 `#a16207` (~5:1), green-700 `#15803d` (4.9:1), orange-700 `#c2410c` (5.0:1), red-700 `#b91c1c` (5.9:1), purple-700 `#7e22ce` (6.3:1), slate-600 (7:1) — **todos AA ✓**.
- `bg-[#0a1628]/90`→`#eef2f8`, `bg-[#10203a]/80`→`#fff` (painel cinza do catálogo **resolvido**).
- Screenshot landing light: search branca+borda+placeholder legível; erro "Não foi possível carregar as mesas" em vermelho-escuro legível (red remap num elemento real). Header/footer light.

**Limite de verificação:** catálogo/painel/detalhe/mestre são auth-gated/precisam backend → NÃO renderizam local. Bugs 2/3/4 validados deterministicamente (sondas computadas), não por screenshot da tela real. **B7 só fecha após re-verificação do mantenedor em prod** (pós-deploy autorizado) dessas telas.

**Bug 4 (página do mestre) — DECISÃO: clarear (identidade única, sem exceção por projeto).**
Mantenedor: "tem que fazer jus a todo o resto do projeto, incluindo cores e identidades
compartilhadas... não pode ficar abrindo exceções." Diagnóstico ampliado: a página INTEIRA
(`.mestre-page` + `.hero-*` + `.benefit-*`/`.tables-*`/`.insight-*`/`.recommendation-*`/
`.mestre-featured-table-*`/`.mestre-bio-*`/`.closed-group-*`/`.metric-*`) é CSS dedicado
dark-coded (`MestrePage.css`), não utilities → nada disso respondia a `[data-theme=light]`.
**Fix:** bloco `[data-theme="light"]` completo no `MestrePage.css` (só `apps/mesas`, zero `packages/*`):
page→`#f4f6fb`+ink; hero cover→gradient claro + scrim claro; cards glassy→branco+borda navy-alpha;
textos brancos→ink (corpo .78 / titulo full / muted .58); acentos semânticos escurecidos
(green-700/yellow-700/orange-700/red-700); laranja de marca (icones/CTA) preservado.
**Incidente:** 1º build quebrou — comentário continha `.hero-*/.mestre-*`, o `*/` fechou o
comentário cedo (CssSyntaxError). Corrigido (sem `*/` no texto).
**Validação (preview light, sondas computadas — página é auth-gated):** build verde; mestre-page
`#f4f6fb`+ink, hero-bio ink .82, stat-label ink .62, trust svg green-700 `#15803d`, benefit-card
branco+ink, cta-secondary navy-alpha+ink, badge-mestre `#c2410c`, featured-price `#a16207` — todos AA.

## Estado final da sessão
- **B6 (glossário dark): FECHADO em PROD.** Telas com dados revisadas pelo mantenedor em prod = OK; CTA logado `Contribua ->` abre `AddTermModal`; modal/form/selects dark legiveis; header/auth/toggle OK.
- **B7 (mesas light): REABERTO por achado posterior em `/perfil`; corrigido LOCAL, pendente commit/push/deploy/revalidacao.** 4 falhas originais corrigidas e revalidadas em producao autenticada: landing, catalogo, painel, pagina de mestre e detalhe de mesa em light. Em seguida, mantenedor achou `https://mesasbeta.artificiorpg.com/perfil` ainda ilegivel no light e P2 de hero com banner custom; ver Fatia 4.
- **Arquivos que subiram no PR #26:** `apps/glossario/frontend/src/{App.tsx,components/LandingSection.tsx,index.css}`; `apps/mesas/frontend/src/{index.css,pages/MestrePage.css}`; `packages/ui/{src/tokens.ts,src/styles.css,tailwind-preset.js,scripts/check-token-parity.mjs}`; docs/spec/sessoes.
- **GitHub:** branch `fix/020-b6-b7-readiness`; commit `160290e`; PR #26 draft criado, checks verdes, marcado ready e squash-mergeado em `dev` (`c573e09`).
- **Promocao/deploy:** `dev -> main` por `promote-prod-fast-forward.yml` verde; `origin/dev == origin/main == c573e090958f070a67cbcea1fc7ef46fff575891`. Deploy prod autorizado e verde: `accounts`, `glossario`, `mesas`.
- **WP raiz/DNS:** intocados; smoke `https://artificiorpg.com/` = 200.

---

## Fatia 2 — Tier 1: B11 + B10b parte 1 (SDD COMPLETO, `packages/ui`)
- **Modo:** SDD Completo (toca `packages/ui` = compartilhado). Autorização nominal do mantenedor ("sim") após verificação contra docs da spec (pedido explícito p/ evitar retrabalho).
- **Decisão p/ não conflitar:** verifiquei `token-contract.md` (§Planejamento + lista futura), `primitives-form-state.md` (§Dependências/passo 0, "variantes light/dark derivam de tokens"), `tasks.md` (B11/B10b). Confirmado: semânticos ancorados no mesas; escala dark ancorada no glossário `#0F1830`; light no mesas. Plano alinha, não diverge. Specs próximas (019-derivadas) não tocam tokens.
- **B11 (FEITO):** `success #10B981`/`successText #15803D`, `warning #F59E0B`/`warningText #A16207`, `danger #EF4444`/`dangerText #B91C1C`, `info #38BDF8`/`infoText #1D4ED8`. Acento = valor do mesas; `*Text` escurecido p/ AA sobre claro (lição B7). Em `tokens.ts`+`styles.css`+`preset`+trava (3-way).
- **B10b parte 1 (FEITO):** `darkCanvas #0F1830`/`darkSubtle #16223E`/`darkSurface #1B2A4A`(=navy)/`darkStrong #22325A`/`darkText #EEF1F8`/`darkMuted #AAB3C7` + `lightCanvas #F4F6FB`/`lightSubtle #EEF2F8`/`lightSurface #FFFFFF`/`lightStrong #E6EBF4`/`lightInk #0B1220`. Em `tokens.ts`+`styles.css`+trava (2-way tokens×styles, sem preset, padrão do `navy`).
- **B10b parte 2 (FEITO na retomada Codex):** migrado CSS de `apps/glossario`/`apps/mesas` p/ consumir os tokens (valores = aos hexes locais → mecânico, sem retrabalho visual).
- **Arquivos:** `packages/ui/src/tokens.ts`, `src/styles.css`, `tailwind-preset.js`, `scripts/check-token-parity.mjs` + docs (`tasks.md`, `token-contract.md`).
- **Validação:** `node check-token-parity.mjs` → **31 papéis OK** (era 11). `pnpm turbo run build` → **13/13 verde** (todos consumidores: site/glossario/mesas/accounts/site-admin). Sem mudança observável nos apps (tokens definidos, ainda não consumidos) → sem smoke visual.
- **Sem commit/push/deploy.** Zero `apps/*` tocado nesta fatia.

## Fatia 3 — B10b parte 2 retomada Codex (SDD COMPLETO, consumo dos tokens)
- **Contexto:** Claude parou por falta de tokens após iniciar a migração hex→token. Retomada leu T0, sessão ativa, `tasks.md`, `token-contract.md` e anexo da conversa.
- **Escopo:** completar consumo dos tokens dark/light já criados. Sem commit/push/deploy; WP raiz/DNS/VM intocados.
- **Mudanças:** `apps/glossario/frontend/src/index.css` consome `--artificio-dark-*` no bloco dark; `apps/mesas/frontend/src/index.css` consome `--artificio-light-*` em surfaces/ink, remaps de hex com opacidade e `.glass`; `apps/mesas/frontend/src/pages/MestrePage.css` consome `--artificio-light-*` em canvas/surface/subtle/strong/ink do bloco light da página do mestre.
- **Limite intencional:** hexes restantes nesses blocos são seletores Tailwind originais (`.bg-[#...]`), alphas derivados (`rgba(11,18,32,...)`), semânticos AA (`#15803d`, `#a16207`, etc.) ou comentários históricos; não são nova fonte de superfície/ink.
- **Validação:** `node packages/ui/scripts/check-token-parity.mjs` OK (31 papéis); `pnpm --filter=@artificio/glossario-frontend build` OK; `pnpm --filter=@artificio/mesas-frontend build` OK; `git diff --check` OK; `pnpm turbo run build` OK (13/13, warnings de chunk e `@import` de fonte já conhecidos/B12).
- **Estado:** B10b fechado localmente. B6/B7 ainda dependem de deploy autorizado + re-verificação autenticada em prod das telas com dados.

## Evidencia pos-deploy PROD (2026-06-13)
- **Checks PR #26:** Amazon Q, accounts build/test, glossario CI, mesas CI, site CI, lint/actionlint/ShellCheck/guard/enforce = verdes.
- **Betas pos-merge:** `deploy-accounts` run `27469895276`, `deploy-mesas` `27469895270`, `deploy-glossario` `27469895278`, `deploy-site` `27469895291`, `pr-checks` `27469895304` = verdes.
- **Prod:** `promote-prod-fast-forward` run `27470039839`; `deploy-accounts` `27470051792`, `deploy-mesas` `27470051852`, `deploy-glossario` `27470051853` = verdes.
- **Smoke HTTP prod:** `accounts_health=200`, `accounts_login=200`, `accounts_me_no_cookie=401`, `glossario_home=200`, `glossario_terms=200`, `mesas_home=200`, `mesas_me_options_no_cookie=401`, `wp_root=200`.
- **CSS prod servido:** glossario CSS `/assets/index-oEWP_f_7.css` com `glossario_dark_tokens=100`; mesas CSS `/assets/index-CjM622kE.css` com `mesas_light_tokens=157`, `mesas_mestre_light_selectors=39`, `mesas_glass_surface=11`.
- **Glossario autenticado/dark (Chrome):** sessao ativa `Faren Ravirar`; body dark `rgb(15,24,48)`; CTA logado `Contribua ->` e nao `Cadastre-se`; `AddTermModal` abre; inputs/selects/textarea dark com texto `rgb(238,241,248)` e bordas visiveis.
- **Mesas autenticado/light (Chrome):** sessao ativa `Paulo Henrique`; catalogo light `body=rgb(244,246,251)`, `darkPanelCount=0`, cards brancos/ink; painel light `darkPanelCount=0`, paineis navy-alpha/ink; mestre `/mestre/farenravirar` light `hasMestrePage=true`, `body=rgb(244,246,251)`, `darkPanelCount=0`; detalhe `/mesas/a-praga-de-valekar-mpvknfrz` light `notFound=false`, `darkPanelCount=0`.

## Criterio de conclusao
- B6 fechado: glossario dark passa itens 1-7 nas telas com dados; evidencia registrada.
- B7 ainda nao fechado depois do achado `/perfil`: precisa subir fix local e revalidar `/perfil` + mestre com banner custom em beta/prod.
- `project-state.md` atualizado localmente.
- Sem achado bloqueante restante para B6; B7 tem fix local pendente de publicacao.

## Restricoes
- Codigo ja promovido por autorizacao nominal do mantenedor nesta sessao. Novas alteracoes documentais pos-deploy ficam locais ate nova aprovacao de commit/push.
- WP raiz/DNS/VM intocados. Worktree de docs pos-deploy nao comitada.

---

## Fatia 4 — ajuste local pos-review: Mesas `/perfil` light + hero com banner
- **Pedido do mantenedor:** `https://mesasbeta.artificiorpg.com/perfil` em light ainda esta ilegivel (texto quase da cor do fundo no print). Tambem revisar achado P2: `MestreHero` com `banner_url` custom fica com texto dark sobre banner arbitrario e scrim claro fraco.
- **Escopo autorizado:** `apps/mesas/frontend` CSS local. Sem commit/push/deploy nesta fatia.
- **Plano de edicao:** padronizar `/perfil` light para usar `--artificio-light-*`/semanticos centrais; fortalecer hero light com overlay seguro sobre imagens reais, preservando contraste AA sobre banners custom.
- **Debito novo pedido, sem corrigir agora:** nav/footer do `apps/glossario` destoa de `beta.artificiorpg.com` e `mesas`; registrar debito para unificar shell (nav+footer) de todos os modulos via fonte compartilhada, sem implementacao nesta fatia.
- **Mudancas locais:** `ProfileEditPage.css` recebeu bloco `[data-theme="light"]` com `--artificio-light-*`/semanticos (`success/info/dangerText`) para header, tabs, tab-content, labels, inputs, hints, avatar actions e discord/playstyle. `MestrePage.css` recebeu regra light especifica para `.hero-section:has(.hero-banner)`: scrim dark forte + texto/CTA em `--artificio-dark-text`, preservando contraste sobre banner custom.
- **Debito criado:** D-SHELL1 em `sessoes/26-06-12_2_debitos_ux-marca.md` + B13 em `specs/020-ui-theme-artificio-padrao/tasks.md`. Sem alteracao no glossario.
- **Validacao local:** `pnpm --filter=@artificio/mesas-frontend build` OK; `node packages/ui/scripts/check-token-parity.mjs` OK (31 papeis); `git diff --check` OK (somente avisos CRLF). Browser sintético com CSS buildado: perfil light mostra header/tab-content/input em `rgb(255,255,255)` + ink `rgb(11,18,32)`; hints `rgba(11,18,32,.62)`; hero com banner custom usa texto `rgb(238,241,248)`/bio `.88`/stat `.72` e CTA dark-safe. Interacao: input preenchido com `Faren Ajustado`, foco/borda brand e texto ink.
- **Limite:** `/perfil` real beta/prod e banner real precisam revalidacao autenticada apos deploy. Sem commit/push/deploy nesta fatia.
- **Ajuste pedido pelo mantenedor:** o bloco novo de `ProfileEditPage.css` deve respeitar integralmente os tokens compartilhados. Refino local: substituir alphas hardcoded do bloco light por aliases locais derivados de `--artificio-light-*`, `--artificio-brand`, `--artificio-brand-deep`, `--artificio-success/danger/info` e variantes `*Text`.
- **Validação do refino:** bloco `[data-theme="light"]` novo de `ProfileEditPage.css` ficou sem `#`, `rgb()` ou `rgba()` literais; usa `--profile-*` derivados dos tokens compartilhados. `pnpm --filter=@artificio/mesas-frontend build` OK; `check-token-parity` OK; `git diff --check` OK (só avisos CRLF).
- **Handoff para continuação no Codex:** `C:\Users\paulo\AppData\Local\Temp\artificio-handoff-b7-perfil-light.md`. Próximo foco: revisar diff local, pedir aprovação nominal para commit/push/PR/deploy se for publicar, e revalidar `/perfil` light + mestre com banner custom após deploy.
