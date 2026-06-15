# Tasks — 022 — Paleta e fontes globais via tokens semânticos

> Regra: **investigar antes de migrar, proibido chute.** Tasks pequenas e verificáveis.
> Nada de código sem autorização nominal; cada fatia segue branch→PR→beta→validação→prod.

## Fase 0 — Fundação em `packages/ui` (não muda apps)

- [x] **T1 — Inventário canônico de mapeamento.** (feito 2026-06-14 → `mapping.md`) Levantar TODAS as utilities cruas de cor em uso
  (mesas + glossário) com contagem por classe (`text-white/NN`, `bg-white/NN`, `border-white/NN`,
  `bg-[#hex]` distintos, `text/bg-{gray,slate,purple}-NNN`) e classes CSS próprias com cor
  (`LinksDisplay.css`, `MestrePage.css`, `index.css`). Produzir tabela "utility → var semântica".
  · feito quando: anexo `mapping.md` lista cada classe usada e seu destino, sem ambiguidade.
- [ ] **T2 — Definir e validar a camada de vars semânticas.** Decidir nomes finais (espelhar o
  `site`: `--fg/--fg-muted/--surface/--surface-subtle/--surface-strong/--canvas/--line/--fill-*`
  + estados) e técnica de consumo (classes no preset vs var direta) por engine (mesas TW v4 /
  glossário TW v3). **Decisão (2026-06-14): vocabulário único SEM alias** — conjunto canônico em
  `mapping.md` §1; técnica de consumo (arbitrary `*-[var(--…)]`) em §5. Resta validar a cascata por
  engine no T3/T5/T8. · feito quando: decisão registrada em `plan.md`/anexo com justificativa de
  cascata por engine.
- [ ] **T3 — Implementar as vars semânticas em `packages/ui/styles.css`** derivando dos tokens
  base, virando por `:root` (light) e `:root[data-theme="dark"]`. Estender
  `check-token-parity.mjs` para travar os novos nomes. · feito quando: `pnpm turbo run build`
  13/13 + parity verde; vars têm valor nos 2 temas; nenhum app consome ainda (inerte).
- [ ] **T4 — Checklist de contraste AA por tela** (reusar `dark-readiness-checklist.md` da 020):
  lista das telas/elementos a medir em mesas e glossário nos 2 temas, com os elementos-gatilho da
  MestrePage no topo. · feito quando: checklist objetivo commitável existe.

## Fase 1 — Glossário piloto (light-default; menor superfície: 24 tsx, remap dark 94 linhas)

- [x] **T5 — Migrar consumo do glossário às vars semânticas** (feito 2026-06-15). Scripts
  `migrate-glossario.mjs` (inequívocas) + `migrate-glossario2.mjs` (blocos por contexto/linha) +
  ajustes manuais. Inclui: tints semânticos→`--state-*`, botão navy→`--btn-primary-*`, banner/
  ribbon navy→`--navy-block-*`, marca→`--artificio-brand`, tokens locais `--color-*`→canônico.
  · grep utilities cruas de cor → 0 (só backdrops `bg-black/NN` = exceção). build glossário verde.
- [x] **T6 — Remover o remap `[data-theme="dark"]` (94 linhas) do `glossario/index.css`** (feito
  2026-06-15). `index.css` reescrito enxuto (fontes + cor/bg via `--fg`/`--canvas`); bloco de remap
  e `--color-*` órfãos removidos. Dark e light vêm 100% das vars canônicas. build verde.
- [~] **T7 — AA + smoke glossário nos 2 temas** — preview build (porta 4324) verificado nos 2 temas:
  home/hero/cards/search/CTA OK, vars canônicas confirmadas (light fg #0b1220/canvas #f4f6fb;
  dark fg #eef1f8/canvas #0f1830), sem erro CSS (só API offline). FALTA: medição AA numérica
  formal por tela (admin/forms/modais) registrada. Default light preservado (R6). · feito quando:
  AA medido ≥4.5/≥3 registrado; preview/
  beta sem regressão; números no doc.

## Fase 2 — Mesas por áreas (dark-default; ~2000 ocorrências, 134 tsx; default-dark deve ficar pixel-igual)

- [x] **T8 — Área PERFIL/MestrePage (resolve o bug)** (feito 2026-06-15, branch
  `022-mesas-t8-perfil`). tsx via `migrate-mesas-t8.mjs` + 6 CSS reescritos (MestrePage.css,
  ProfileEditPage.css com blocos `[data-theme=light]` REMOVIDOS; LinksDisplay/LinksManager/
  UserSystemsSelector/SettingStylesField.css). Guia pétreo em `style-guide.md`. Build 13/13,
  parity OK. Vars resolvem nos 2 temas (light `--state-warning-fg`=#a16207 AA = bug corrigido por
  construção; dark unificado #eef1f8). Prova visual com dados vivos = beta (backend off no preview).
  Resto abaixo (descrição original):
- [ ] **T8 (orig) — Área PERFIL/MestrePage primeiro (resolve o bug reportado).** Migrar `.tsx`
  `features/table/components/{MasterCard,TableActionPanel,TableMaster}.tsx`,
  `components/{LinksDisplay,TableCardDashboard}.tsx` às vars semânticas **+ todo o CSS próprio da
  área** (decisão 2026-06-14: corrigir o `.css` hardcoded junto, senão refaz depois):
  `pages/MestrePage.css` (168 hex/rgba raw — raiz do bug), `pages/ProfileEditPage.css` (101),
  `components/{LinksDisplay,LinksManager,UserSystemsSelector}.css`, `styles/SettingStylesField.css`
  → trocar hex/rgba pelos papéis da §3 do `mapping.md` (preservar marca/plataforma da §4).
  · feito quando: MestrePage light com AA em "MESTRE", "PLATAFORMAS QUE USO",
  "Conteúdo/Presença/Autoridade", botões "Marcar como encerrada"/"Arquivar", contorno de card;
  CSS próprio da área sem hex de superfície/fg hardcoded (só exceções §4); dark pixel-igual; build verde.
- [ ] **T9 — Área CATÁLOGO público** (lista/cards/toolbar/filtros) + `pages/PlayerPage.css`.
  · feito quando: 2 temas AA + dark igual; PlayerPage.css sem hex de superfície/fg hardcoded.
- [ ] **T10 — Área PAINEL DO MESTRE / GESTÃO** (dashboard, ações, métricas). · feito quando: idem.
- [ ] **T11 — Área FORMS multi-step + MODAIS/DRAWERS/TOASTS** + `components/ui/{ConfirmDialog,
  ErrorState,LoadingState}.css`. · feito quando: idem (estados de validação incluídos;
  placeholder/select AA; CSS dos ui/* sem hex hardcoded fora das exceções §4).
- [ ] **T12 — Remover o remap `[data-theme="light"]` (77 linhas) do `mesas/index.css`** depois que
  todas as áreas migrarem. · feito quando: light vem das vars; arquivo sem o bloco; default-dark
  sem cookie inalterado; build verde.

## Fase 3 — Fontes, accounts e fecho

- [ ] **T13 — Fontes sistemáticas** (R5): aplicar Inter (corpo) e Oswald (headings) via fonte única
  de `packages/ui` (classe/token), garantindo Oswald nos headings dos 3 apps; consolidar o
  `@import`/`<link>` de fonte numa só origem (alinha com D-CSS1). · feito quando: headings Oswald
  em mesas/glossário/site; uma única declaração de fonte; build verde.
- [ ] **T14 — accounts (R7):** decidir importar `@artificio/ui/styles.css` (fonte única) ou
  documentar exceção. Se migrar, consumir as vars + **testar login SSO E2E**. · feito quando:
  decisão registrada; se migrado, accounts nos 2 temas + login OK.
- [ ] **T15 — Validação final + changelog + fecho.** `turbo build` 13/13, parity, testes, AA
  consolidado, smokes beta dos 3 apps (+ accounts) nos 2 temas, WP raiz 200. · feito quando:
  tudo verde + project-state/sessão atualizados; promote/prod só com autorização nominal por app.

## Notas de execução (proibido chute)

- Cada fatia: **investigar o arquivo real** antes de editar (cascata, especificidade, classes
  próprias) — não assumir que uma utility mapeia 1:1 sem conferir o contexto.
- `mesas` é app **operacional em prod (dark)** → qualquer fatia deve manter o dark **idêntico**;
  só o tema oposto muda. Provar com preview/screenshot antes de subir.
- Tailwind **v4 (mesas)** e **v3 (glossário)** tratam camadas diferente → validar a técnica de
  consumo em cada engine (T2) antes de migrar em massa.
- Sem big-bang, sem commit/push/deploy sem autorização nominal por ação.
