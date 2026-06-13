# Prioridade de Execução — Spec 020

> Definida em 2026-06-13 a partir da revisão de todos os docs da spec (token-contract, theme-consolidation, header-nav-actions, primitives-form-state, page-recipes, astro-zero-js, rollout-pilots, brand-static-shell, backlog-b2-b7-review). Pondera: (a) validar/proteger o que já está em prod, (b) desbloquear o máximo, (c) custo baixo cedo.
>
> **Caminho crítico:** B6/B7 (valida) ∥ B11+B10b (destrava) → B4+B3 (constrói). B2 e B12 correm de lado sem bloquear.

## Estado de partida (já em produção)

- **Fonte única de tokens** (D064) + paridade (`check-token-parity.mjs`, 11 papéis com `navy`/B10a) — no ar.
- **lua/sol opt-in** em prod: glossário **dark** (D065) + mesas **light** (D066); tema **compartilhado** cross-subdomínio (D067, cookie só escrito em escolha explícita; mesas honra cookie, default-dark). PRs #24/#25.
- Toggle vivo = injetado via `actions` + `variant` reativo (NÃO `showThemeToggle`).
- Docs de spec T3–T11 fechados como especificação/planejamento.

## Tier 0 — AGORA (valida o que já está no ar; custo ~zero; não-bloqueante)

### B6 + B7 — E2E autenticado (glossário dark / mesas light)
- **O que faz:** logar em PROD e testar as telas com dados que o smoke local não alcançou — glossário (cards de termo, admin, AddTermModal, forms/selects/validação) no dark; mesas (catálogo com dados, detalhe de mesa, painel, gestão, forms multi-step, modais/notificações) no light. Medir AA, registrar prints/medições. Checklist `dark-readiness-checklist.md` completo p/ esses fluxos.
- **Por que primeiro:** o lua/sol **já está em produção** como opt-in; é a única coisa que fecha a dark/light-readiness (regra pétrea) e confirma que nenhuma tela real quebrou. **Zero código** se passar. Se adiar, um usuário acha a tela quebrada antes. 
- **Fecha:** B6, B7.

## Tier 1 — FUNDAÇÃO DE TOKENS (barato, desbloqueia o resto)

### B11 — tokens semânticos canônicos (`success/warning/danger/info` + shadow/spacing)
- **O que faz:** leva os valores que hoje só existem locais no mesas (`--success/--warn/--danger/--info`) para `tokens.ts` + `styles.css` + `preset` + trava de paridade.
- **Por que cedo:** **bloqueia** todas as variantes coloridas de `Button/Badge/Panel/State` → bloqueia primitives (B4) → bloqueia HeaderAction (B3) e recipes runtime. Custo ínfimo. Sem ele, primitive colorida nasce meio-implementada (mesmo bug que originou a trava).
- **SDD Completo** (toca `packages/ui`).

### B10b — tokenizar superfícies dark/light dos pilotos (junto do B11)
- **O que faz:** os hexes ad-hoc dos remaps D065/D066 (glossário `#0F1830/#16223E/#22325A/#EEF1F8…`, mesas light `#F4F6FB/#EEF2F8/#E6EBF4/#0B1220`) viram `dark.*`/`light.*` estruturados em `tokens.ts` + entram na trava.
- **Por que junto:** mesma fatia de tokens; dá base pros primitives terem variante dark/light por token, não hex repetido por app. `navy` (B10a) já é a âncora.

## Tier 2 — ANTI-DRIFT (paralelo ao Tier 0/1; benefício prático imediato; independe da cadeia)

### B2 / T11 — `@artificio/ui/static` + paridade do site
- **O que faz:** subpath static-only (`faviconV2`/logos/`defaultNavItems`) que o site Astro consome; OU teste de paridade `brand.json`/`MODULES` × `packages/ui` que falha no CI em drift. Detalhe em `brand-static-shell.md`.
- **Por que cedo/paralelo:** risco de drift é **live** — `Base.astro` puxa `faviconV2` pelo barrel React e `brand.json`/`MODULES` são espelhos sem trava; logo/nav podem divergir em silêncio. Protege o público SEO. Não bloqueia nada.
- **Fecha:** B2, T11.

### B12 — limpeza do `@import` de fontes
- **O que faz:** tira o Google Fonts do `@import url()` em `packages/ui/src/styles.css` (self-host das fontes Oswald/Inter OU `preconnect`+`link`).
- **Por que cedo/paralelo:** perf real (fetch externo render-blocking no caminho crítico do público) + privacidade + mata o warning `@import must precede all rules`. Independente, baixo risco. **SDD** (CSS compartilhado).

## Tier 3 — PRIMITIVES (o grosso; depende do Tier 1)

### B4 — primitives
- **O que faz:** componentes visuais compartilhados em `packages/ui`, baixos de opinião, sem domínio. Ordem: `Button`/`Field`/`TextInput`/`Textarea`/`Select`/`Badge` neutros primeiro; depois `Panel`/`Toolbar`/`FilterPanel`/`State`/`Modal`/`Drawer`. Contrato em `primitives-form-state.md`.
- **Por que aqui:** SDD Completo + build/smoke de todos os consumidores = caro. Variantes coloridas **só após B11**. Piloto = `site-admin` (rollout-pilots). Só vale com tokens prontos e B6/B7 fechados (sem retrabalho).

### B3 — HeaderAction (junto do B4)
- **O que faz:** helper visual-only do botão de action do header (aria/badge/classes), mantendo fetch/changelog/notificação por app. Contrato em `header-nav-actions.md`.
- **Por que com B4:** mesma natureza (visual-only em `packages/ui`), pequeno, reusa o padrão de badge.

## Tier 4 — CONSOLIDAÇÃO / OPORTUNÍSTICO (baixa urgência)

### T5 — dedup dos helpers de tema (accounts/site → API `@artificio/ui/theme`)
- **O que faz:** remove cópia de `THEME_COOKIE`/cookie/localStorage/matchMedia em `accounts`/`site`. Plano em `theme-consolidation.md`.
- **Por que depois:** depende do subpath static (B2) p/ o site; é cleanup — comportamento **já correto** (D067). Baixo risco, baixa urgência.

### B5 — recipes runtime (`PublicSearchPage`/`CatalogPage`/…)
- **O que faz:** extrair composição de página p/ `packages/ui`.
- **Por que último:** só quando **2 apps** repetirem a mesma composição com baixa divergência. Oportunístico — `page-recipes.md` já serve de guia de design p/ telas novas. Não agendar.

## Resumo

```
Tier 0  B6+B7 E2E ───────────────► fecha lua/sol (já em prod)        [já!]
Tier 1  B11 semânticos + B10b ────► DESTRAVA primitives              [barato, blocker]
Tier 2  B2/T11 static · B12 fonts ► anti-drift + perf (paralelo)     [independente]
Tier 3  B4 primitives + B3 HeaderAction ► o grosso (precisa B11)     [caro, SDD]
Tier 4  T5 dedup tema · B5 recipes runtime ► cleanup/oportunístico   [baixa urgência]
```

## Regras de execução (pétreas)

- Qualquer `packages/*` = **SDD Completo** + build/smoke de TODOS os consumidores.
- `commit`/`push`/`deploy`/VM/prod só com **autorização nominal** por ação.
- Respeitar worktree suja; não reverter mudança alheia.
- WP raiz/DNS/Gate C intocados.
