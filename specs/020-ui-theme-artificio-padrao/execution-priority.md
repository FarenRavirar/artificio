# Prioridade de Execução — Spec 020

> Definida em 2026-06-13 a partir da revisão de todos os docs da spec (token-contract, theme-consolidation, header-nav-actions, primitives-form-state, page-recipes, astro-zero-js, rollout-pilots, brand-static-shell, backlog-b2-b7-review). Pondera: (a) validar/proteger o que já está em prod, (b) desbloquear o máximo, (c) custo baixo cedo.
>
> **Caminho crítico atualizado:** B4/B3 sao as proximas fatias. B6, B7 e B2 foram fechados; B11+B10b ja foram feitos.

## Estado de partida (já em produção)

- **Fonte única de tokens** (D064) + paridade (`check-token-parity.mjs`, 11 papéis com `navy`/B10a) — no ar.
- **lua/sol opt-in** em prod: glossário **dark** (D065) + mesas **light** (D066); tema **compartilhado** cross-subdomínio (D067, cookie só escrito em escolha explícita; mesas honra cookie, default-dark). PRs #24/#25.
- Toggle vivo = injetado via `actions` + `variant` reativo (NÃO `showThemeToggle`).
- Docs de spec T3–T11 fechados como especificação/planejamento.

## Tier 0 — AGORA (valida o que já está no ar; custo ~zero; não-bloqueante)

### B6 + B7 — E2E autenticado
- **Estado:** fechado por validacao do mantenedor. B6 glossario dark tem evidencia em `sessoes/26-06-13_1`; B7 mesas light foi validado em prod em 2026-06-15.
- **Proximo:** nao repetir E2E salvo nova suspeita de regressao.

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
- **Estado:** fechado em 2026-06-15. `@artificio/ui/static` data-only existe; site Astro consome favicon/logos/nav por esse subpath; build do site segue static.
- **Proximo:** nao reabrir salvo novo drift de shell static.

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
Tier 0  B6+B7 E2E ────────────────► fechado por mantenedor
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
