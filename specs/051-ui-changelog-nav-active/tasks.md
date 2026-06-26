# 051 — tasks.md

> Tarefas de execução. Marcar `[x]` ao concluir. Implementação só após autorização nominal do mantenedor (esta fase = só planejamento).
>
> **Ordem por ondas** (evita retrabalho — ver `spec.md` §Estratégia): **Onda 0** (F0 discovery) → **Onda A** (F4+F5, depois F1) → **Onda B** (F6) → **Onda C** (F2) → **Onda D** (F3). Ondas A/B/C tocam pacotes compartilhados = SDD Completo; cada PR/commit/push exige autorização nominal própria.

## T0 — Manutenção do mapa (pétrea)
- [x] T0.1 Registrar spec 051 em `specs/README.md`.
- [x] T0.2 Registrar pendência em `specs/backlog.md` (`BL-051-UI-CHANGELOG-NAV` + DEB-050-02 absorvido).
- [x] T0.3 Marcar em `specs/050-.../debitos.md` que DEB-050-02 foi absorvido pela 051.
- [x] T0.4 Marcar G01/G02 em `specs/049-.../debitos.md` como absorvidos pela 051.
- [x] T0.5 Atualizar `.specify/memory/project-state.md`.
- [ ] T0.6 Ao fechar: reconfirmar backlog + project-state; marcar G01/G02 (049) e extração (020) executados.

---

## Onda 0 — Discovery (F0): varredura de duplicação ANTES de extrair ✅ (2026-06-25)
- [x] T-F0.1 Varredura executada (`rg` + leitura direta; `jscpd` dispensado — dup localizada). Mapa em `f0-discovery.md`.
- [x] T-F0.2 Mapa classificado escrito (`f0-discovery.md` §1-4): extrair / consolidar / manter local / nulo.
- [x] T-F0.3 Escopo F4/F5/F6 fechado (`f0-discovery.md` §4). **Vereditos:** F6=**nulo** (Onda B cai); F4=pequeno; F5 redimensionado (ConfirmDialog extrair / StateWrapper consolidar / FileDropzone extrair / ImportResultGrid+StatCard manter local).
- [x] T-F0.4 Achados fora de escopo listados (`f0-discovery.md` §6); registro em backlog quando Onda A for autorizada (não criar débito especulativo antes).

## Onda A — `packages/ui` consolidation ✅ (2026-06-25, DeepSeek)

### F4 — Colapsar wrappers de changelog (escopo F0: PEQUENO — pesado já na 041)
- [x] T-F4.1 Auditado (`f0-discovery.md` §1): site+links idênticos (13 linhas); mesas/glossario já no mínimo (fetch vs axios + labels).
- [x] T-F4.2 Colapsar site+links (idênticos) num consumo único do `StaticChangelogModal` (aceitar `rawChangelogs` direto, normalizar interno) — elimina 2 wrappers. **Evidência:** `packages/ui/src/ChangelogModal.tsx` — `StaticChangelogModal` ganhou prop `rawChangelogs?: unknown` que normaliza internamente via `normalizeChangelogEntries`. `apps/site/.../SiteHeaderIsland.tsx` e `apps/links/.../LinksHeader.tsx` importam `StaticChangelogModal`+`rawChangelogs` direto. Wrappers `SiteChangelogModal.tsx` e `LinksChangelogModal.tsx` deletados.
- [x] T-F4.3 Atualizar nota da spec 020 (`header-nav-actions.md`) marcando extração executada (R-F4.6). **Evidência:** `specs/020-.../header-nav-actions.md:99` atualizado com referência à spec 051.

### F5 — Primitivas admin do mesas (escopo F0 fechado — ver `f0-discovery.md` §2)
- [x] T-F5.1 Consumidores confirmados. **Vereditos:** ConfirmDialog=extrair (3 apps); StateWrapper=consolidar c/ `primitives.tsx`; FileDropzone=extrair (2 apps); ImportResultGrid+StatCard=manter local (domínio mesas).
- [x] T-F5.2a **ConfirmDialog → `packages/ui` ✅ total (3/3 apps).** **Evidência:** `packages/ui/src/ConfirmDialog.tsx` criado (provider+ctx+hook unificados, CSS com tokens de tema). CSS em `styles.css` (`.artificio-confirm-*`). `index.ts` exporta `ConfirmProvider`/`useConfirm`/`ConfirmContext`/tipos. mesas: `App.tsx` importa de `@artificio/ui`; `LinksManager.tsx` importa `useConfirm`; `SystemSuggestionResolutionDrawer.tsx`/`ProfileEditPage.tsx`/`GestaoPage.tsx` substituem `window.confirm` por `useConfirm` (7 calls migradas com `confirm({title, message, variant})`). glossario: `ResultCard.tsx` (2 calls) + `AdminFeedbackPage.tsx` (1 call) migrados; `App.tsx` envolto em `<ConfirmProvider>`. site-admin (DEB-051-01, 2026-06-26): dep `@artificio/ui` adicionada, `<ConfirmProvider>` no root, 4 `window.confirm` → `await confirm({...})` (PostsList, PagesList, FeedbackPage, MediaLibrary). Arquivos locais deletados: `ConfirmDialog.tsx/.css`, `confirmDialogContext.ts`, `useConfirm.ts`.
- [x] T-F5.2b **StateWrapper → consolidar.** **Evidência:** `GestaoStateWrapper.tsx` e `LoadingState.tsx`/`.css` eram **código morto** (zero imports). Deletados. `index.ts` do `components/ui/` limpo (só `ErrorState` permanece pois é diferente do shared). Sem ação adicional.
- [x] T-F5.2c **FileDropzone → `packages/ui`.** **Evidência:** `packages/ui/src/FileDropzone.tsx` criado (genérico: `showTextarea` opcional, tokens de tema, props `accept`/`placeholder`/`label`/handlers). CSS em `styles.css` (`.artificio-dropzone-*`). `index.ts` exporta. mesas `DiscordJsonImportPanel.tsx` importa de `@artificio/ui` com props adaptadas. Arquivo local deletado: `apps/mesas/.../FileDropzone.tsx`. glossário ImportPage tem drag-drop inline próprio (não adaptado — rollout futuro).
- [x] T-F5.3 mesas importa de `packages/ui`; cópias locais removidas (R-F5.3). **Evidência:** 8 arquivos deletados do mesas (`ConfirmDialog*`, `confirmDialogContext`, `useConfirm`, `LoadingState*`, `GestaoStateWrapper`, `FileDropzone`).
- [x] T-F5.4 ImportResultGrid/StatCard = sem ação (domínio mesas, mantidos locais). site-admin ConfirmDialog rollout ✅ resolvido via DEB-051-01 (`BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT` fechado 2026-06-26).

### F1 — Bug visual do changelog (na fonte já consolidada por F4)
- [x] T-F1.1 Mesas: diagnosticado — `ChangelogModal` não fazia **scroll lock** no `body`. Fundo (hero, busca, cards) rolava por trás do backdrop semitransparente, causando sobreposição visual.
- [x] T-F1.2 Glossário: diagnosticado — mesma causa raiz (scroll lock ausente) + `z-[9999]` cobre header `z-50`. Com scroll lock, fundo não rola e header fica atrás do backdrop.
- [x] T-F1.3 Correção na **fonte compartilhada** (`ChangelogModal.tsx`) — scroll lock via `useEffect` que seta `document.body.style.overflow = "hidden"` e restaura no cleanup. Sem fix por app necessário.
- [x] T-F1.4 Implementado: `useEffect` adicionado em `ChangelogModal.tsx:96-104`. `useEffect` importado de React.
- [ ] T-F1.5 Validar light + dark; screenshot antes/depois (R-F1.5). **Pendente:** validação visual requer preview/smoke — adiado para fase de smoke (T-A.2). O fix é determinístico (scroll lock CSS) e funcionará em ambos temas.

### Fechamento Onda A
- [x] T-A.1 `pnpm run lint` + `pnpm run build` verdes. **Evidência:** lint 15/15 ✅, build 17/17 ✅ (2026-06-25).
- [ ] T-A.2 Smoke proporcional **um só** nos consumidores de `packages/ui` (changelog + primitivas extraídas): mesas, glossário, site, links — sem regressão (R-F4.4/R-F5.5/R-F5.6). **Pendente:** requer dev server/preview por app. Pode ser feito na fase de commit ou como validação separada.

## Onda B — `packages/content` schemas (F6 — G02/049) ❌ CANCELADA (F0: NULO)
- [x] T-F6.1 Auditado (`f0-discovery.md` §3): **TODO schema Zod vive só em `apps/mesas`**. Nenhum serve 2+ apps. `packages/content` não tem zod. **Veredito: nada a mover.**
- [x] T-F6.2/3/4 **Sem ação** — não tocar `packages/content` (mover poluiria com domínio mesas). Onda B cai; sequência de PRs vira A→C→D. Veredito = decisão de não-mover, não débito.

## Onda C — Indicador de projeto ativo (F2) ✅ (2026-06-25)
- [x] T-F2.1 Levantar hrefs canônicos dos itens da nav cross-projeto (`packages/ui/src/modules.ts`). **Evidência:** 7 itens com hrefs absolutos (`https://glossario.artificiorpg.com`, etc.). **Centralizados** (ver T-F2.9): agora `MODULE_ORIGINS.<modulo>` em vez de URL crua.
- [x] T-F2.9 **Centralizar origins de módulo** (achado da revisão — antes hardcoded em 4 lugares). **Evidência:** `@artificio/config/brand.ts` ganhou `moduleOrigin(sub)` + `MODULE_ORIGINS` (glossario/mesas/downloads/esferas/srd/links derivados de `BRAND_DOMAIN`), reexportados em `index.ts`. Consumido em `modules.ts`, `GlossarioHeader.tsx`, `LinksHeader.tsx`, `mesas/utils/auth.ts` (`DEFAULT_MESAS_PUBLIC_ORIGIN`). Dep `@artificio/config` adicionada a glossario+mesas-frontend (já transitiva via ui; sem peso novo). Zero hardcode `*.artificiorpg.com` em src (fora de testes). Build config/ui/3 apps ✅, lint ✅, mesas test 163/163 ✅.
- [x] T-F2.2 Conferir/normalizar `currentHref` em mesas (`AppShell.tsx`); achar por que `publicOrigin` não casa. **Evidência:** `getMesasPublicOrigin()` retorna `https://mesas.artificiorpg.com` em produção — hostname casa. Normalização em Nav.tsx cobre trailing slash/origin. Sem ação necessária.
- [x] T-F2.3 Injetar `currentHref` no glossário (`GlossarioHeader.tsx` — hoje ausente). **Evidência:** `currentHref={MODULE_ORIGINS.glossario}` adicionado (mesmo valor do `brandHref`, também migrado p/ `MODULE_ORIGINS`).
- [x] T-F2.4 Conferir links (`LinksHeader.tsx`) e site (`Base.astro`/`SiteHeader.astro`). **Evidência:** links passa `currentHref={MODULE_ORIGINS.links}` (hostname casa). site usa header Astro próprio (`SiteHeader.astro`), não o React `Header` compartilhado — sem ação.
- [x] T-F2.5 Avaliar normalização de comparação em `Nav.tsx` (barra final/origin) — decidir e implementar se aprovado. **Evidência:** função `normalizeHref()` extrai hostname via `new URL(href).hostname`, fallback string lowercase + strip trailing slash. Comparação hostname-based.
- [x] T-F2.6 Avaliar reforço visual do marcador (peso do label) se o traço ficar fraco; manter `aria-current`. **Evidência:** CSS já tem `border-bottom: 2px solid` + `border-bottom-color: var(--artificio-brand)` + `font-weight: 600` no `aria-current="page"`. Traço laranja 2px + peso 600 — robusto em light e dark. Sem ação.
- [ ] T-F2.7 Smoke nos 4 apps; sem marcação dupla com `moduleNav`. **Pendente:** requer dev server por app — validação visual do mantenedor.
- [ ] T-F2.8 Validar light + dark; screenshot mesas + glossário (R-F2.7). **Pendente:** requer browser — validação visual do mantenedor.

## Onda D — Convergência scripts deploy (F3 — DEB-050-02) ✅ (2026-06-25)
- [x] T-F3.1 `rg` p/ listar todos `[ ... ]` single-bracket + `echo` de erro sem `>&2` nos scripts antigos. Confirmar/ampliar lista.
- [x] T-F3.2 Converter `[`→`[[` + erros `>&2`, preservando semântica (revisar cada conversão).
- [x] T-F3.3 ShellCheck (`_lint-shell.yml`) local verde.
- [x] T-F3.4 Self-tests verdes: `test_migration_guard.sh`, `test_migration_reconcile.sh`, `test_migration_lock.sh`.
- [x] T-F3.5 Marcar DEB-050-02 fechado no backlog ao concluir.

## Revisão CI PR #96 (2026-06-26)
- [x] T-REV.1 **CodeQL `js/polynomial-redos` (DEB-051-CODEQL-01, bloqueante)** — `Nav.tsx:14` regex `replace(/\/+$/, "")` → strip de barras finais por loop `charCodeAt` (sem backtracking). Comportamento idêntico (6/6 casos). build+lint ✅. Ver reviews.md §10.
- [x] T-REV.2 **CodeRabbit (DEB-051-RABBIT-04)** — `apply_required_migrations.sh` `load_header_vars` ganha allowlist fail-closed `online-safe|manual-risk`. shellcheck ✅, guard 39/39 ✅. Ver reviews.md §11.

## Fechamento geral
- [x] TZ.1 `pnpm run lint` + `pnpm run build` verdes (repo). ✅ (2026-06-25: 15/15 lint, 17/17 build — Ondas A+C+D)
- [ ] TZ.2 Zero duplicação remanescente do que foi extraído (re-rodar varredura F0).
- [ ] TZ.3 G01/G02 (049) e extração changelog (020) marcados executados nas fontes.
- [ ] TZ.4 Sessão + `project-state.md` + `specs/backlog.md` reconciliados.
- [ ] TZ.5 Nenhum processo/preview auxiliar deixado rodando.
