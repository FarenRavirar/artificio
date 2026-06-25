# 051 — plan.md (como resolver)

> Plano técnico das 3 frentes. **Nenhuma linha de código escrita nesta fase** — isto descreve a abordagem a executar quando o mantenedor autorizar a fase de implementação.

## Princípios

- Mudança mínima, reversível, na fonte compartilhada quando a causa for comum.
- `packages/ui` é compartilhado → SDD Completo: verificar impacto em **todos** os consumidores do `Header`/`ChangelogModal` (mesas, glossário, site, links) + smoke proporcional.
- Investigar causa-raiz com preview/inspeção antes de editar (anti-retrabalho). Confirmar no DOM real, não no chute.
- **Pré-lançamento:** extrair o compartilhado **antes** de consumir/corrigir. Nenhuma frente cria local o que já tem (ou terá) versão em `packages/ui`/`packages/content`.

## Ordem por ondas (resumo)

Onda 0 (F0 discovery) → Onda A (`packages/ui`: F4+F5, depois F1) → Onda B (`packages/content`: F6) → Onda C (nav: F2) → Onda D (shell: F3). Racional na tabela de estratégia do `spec.md`. Onda A agrupa todo toque em `packages/ui` num review/smoke só, e o fix do bug (F1) vem por último na fonte já consolidada.

---

## F0 — Varredura de duplicação (discovery)

Antes de extrair qualquer coisa, mapear o que **de fato** duplica para não extrair pela metade e retrabalhar.

1. `jscpd` no monorepo (ou nos apps + packages) p/ clones estruturais; `rg`/`ast-grep` p/ componentes React com mesma cara entre apps e schemas Zod repetidos.
2. Cruzar com o que já se sabe: wrappers de changelog (F4), primitivas de admin do mesas (F5), schemas Zod (F6).
3. Classificar cada achado: **extrair agora** (vai p/ F4/F5/F6) · **manter local** (motivo: domínio específico, 1 consumidor) · **rollout futuro** (débito em `backlog.md`).
4. O mapa fecha o escopo de F4/F5/F6 **antes** de tocar código compartilhado.

---

## F1 — Changelog

### Diagnóstico a confirmar (preview/inspeção)

1. **Mesas (sobreposição):** abrir o changelog em preview e inspecionar empilhamento.
   - Hipótese A: o backdrop `bg-black/60` do `ChangelogModal` é semitransparente e o conteúdo de fundo "vaza" visualmente — esperado por design, mas as imagens sugerem que **elementos de fundo renderizam acima** (z-index local do hero/busca > `z-[9999]`? `position: fixed`/`transform` criando contexto de empilhamento concorrente?).
   - Hipótese B: o changelog do mesas não é o modal `packages/ui`, e sim uma **rota/página** renderizada inline sob o hero → empilhamento sem isolamento. Confirmar qual caminho o mesas usa (`AppShell.tsx` + `apps/mesas/.../ChangelogModal.tsx`).
   - Verificar **scroll lock**: quando o modal abre, travar scroll do body evita o "fundo passando por trás".
2. **Glossário (topo escondido):** inspecionar o header do app.
   - Hipótese: header `sticky`/`fixed` do glossário sobrepõe o topo do conteúdo do changelog quando este é renderizado **dentro do fluxo** (não no portal `document.body`), ou o container do modal tem `align-items: flex-start` + `p-4` insuficiente sob um header alto. O `ChangelogModal` compartilhado usa `items-start ... p-4`; se o glossário injeta header fixo fora do portal, o topo é coberto.

### Correção proposta (a validar)

- **Causa comum (fonte):** se o problema for do `ChangelogModal` compartilhado (scroll lock ausente, padding-top insuficiente, contexto de empilhamento), corrigir em `packages/ui/src/ChangelogModal.tsx` / `styles.css` — beneficia os 4 apps. Candidatos: garantir scroll lock no `body` enquanto aberto; aumentar `padding-top` responsivo do container; confirmar que o portal vai para `document.body` (já vai) e que nenhum ancestral cria stacking context conflitante.
- **Causa específica (app):** se o glossário tiver header fixo próprio que cobre o portal, ajustar offset no wrapper do glossário, **não** na fonte.
- Registrar no fechamento qual hipótese se confirmou e onde o fix entrou.

### Validação F1

- Preview (mesas + glossário), light + dark, screenshot antes/depois.
- `pnpm run lint` + `pnpm run build`.

---

## F2 — Indicador de projeto ativo

### O que já existe (não reescrever)

- `Nav.tsx`: `aria-current="page"` em `item.href === currentHref`.
- `styles.css:254` (light) + `:1197` (dark): `border-bottom-color: var(--artificio-brand)` — o traço laranja pedido **já está pronto**.

### O trabalho real = consertar os dados `currentHref`

1. Levantar o `href` **canônico** de cada item da nav cross-projeto (`defaultNavItems`/`navItems` em `packages/ui/src/modules.ts`).
2. Para cada app, garantir que passa `currentHref` = o href canônico do **seu próprio** item:
   - **glossário:** `GlossarioHeader.tsx` passa a injetar `currentHref={<href canônico do item Glossário>}` (hoje não passa).
   - **mesas:** `AppShell.tsx` passa `currentHref={publicOrigin}` — conferir se `publicOrigin` casa **exatamente** (barra final, `https://`) com o href do item Mesas; normalizar para casar.
   - **links / site:** conferir os valores já passados (`LinksHeader.tsx`, `Base.astro`/`SiteHeader.astro`).
3. Considerar **normalização de comparação** no `Nav.tsx` (ex.: comparar ignorando barra final) para tornar o casamento robusto a divergências triviais — decisão registrada aqui antes de implementar (risco: não marcar item errado).

### Reforço visual (decisão de design)

- Ponto de partida: traço laranja inferior já existente atende ao pedido ("traço laranja embaixo do nome").
- Avaliar em preview se o traço sozinho é perceptível em light e dark; se fraco, reforçar com peso do label (`font-weight`) no `[aria-current="page"]` — **sem** introduzir o "círculo" alternativo salvo se o traço reprovar (evita divergir do design system).
- Light/dark: laranja `#FF5722` como acento; não usar como cor de texto de corpo.

### Validação F2

- Preview por app: navegar/abrir e confirmar item correto marcado, light + dark, screenshot.
- Conferir que `moduleNav` (subnav) não gera marcação dupla.
- `pnpm run lint` + `pnpm run build`.

---

## F4 — Consolidar wrappers de changelog (extração spec 020)

### Por que agora

Spec 020 adiou extrair `ChangelogAction`/modais "até duplicação real em 2+ apps". Hoje há **4 wrappers** (`mesas`, `glossario`, `site`, `links`) sobre o mesmo `ChangelogModal` de `packages/ui`. Gatilho cumprido → consolidar.

### Abordagem

1. Diff dos 4 wrappers; isolar o que varia (fetcher/endpoint, labels, badge key). A base já está em `packages/ui` (`DynamicChangelogModal` + `useChangelogData` + `useChangelogBadge`) — provavelmente cada wrapper vira só uma config/props.
2. Onde a variação couber em props, **eliminar o wrapper** e consumir direto o componente compartilhado; onde não couber, reduzir ao mínimo.
3. **F1 entra aqui:** o fix do bug visual vai na fonte consolidada, não replicado.
4. Não reescrever o modal nem trocar stack (fora de escopo).

### Coordenação F1↔F4

Executar F4 primeiro/junto; corrigir F1 na fonte única. Evita corrigir o bug 4× e depois apagar os wrappers.

### Validação F4

- Smoke nos 4 apps: abrir changelog, badge "novidade", erro/retry, truncamento, light/dark.
- `pnpm run lint` + `pnpm run build`.

---

## F5 — Extrair primitivas de admin do mesas → `packages/ui` (G01/049)

### Por que agora

Spec 049 criou `GestaoStateWrapper`/`ResultGrid`/`ConfirmDialog`/`FileDropzone` **locais no mesas** e marcou como candidatos a `packages/ui` (G01), mas deixou a extração para SDD próprio. Pré-lançamento é a hora: extrair antes que outros apps copiem.

### Abordagem

1. Usar o mapa de F0 p/ confirmar consumidores reais (2+) por componente. Extrair só o justificado; o resto vira rollout futuro (débito), não extração especulativa.
2. Mover p/ `packages/ui` com **API genérica** (props da tabela §3 da proposta 049). Regra dura: **nenhum tipo/label de domínio mesas/Discord** entra no pacote compartilhado — se o componente depende disso, generalizar via props ou não extrair.
3. mesas troca a cópia local por `import` do pacote, no mesmo PR. Cópia some.
4. Reuso nos outros apps (glossário/site-admin/links) só quando trivial; senão débito de rollout.

### Risco

- Generalização vazando domínio → mitigado por R-F5.2 + review.
- Tocar `packages/ui` = blast radius nos consumidores → mitigado pelo smoke único da Onda A (junto com F4).

### Validação F5

- Gestão do mesas funcional (loading/error/empty, grids, confirm destrutivo, upload).
- `pnpm run lint` + `pnpm run build`; smoke consumidores.

---

## F6 — Centralizar schemas Zod cross-app → `packages/content` (G02/049)

### Cuidado (não duplicar o erro inverso)

D17/D18 da 049 **já** deduplicaram schemas dentro do backend do mesas. F6 **não** é re-dedup; é mover p/ `packages/content` só o que serve 2+ apps. Schema de domínio mesas/Discord que só o mesas usa **fica no mesas** — mover poluiria `packages/content`.

### Abordagem

1. Auditar cada candidato (`updateDraftSchema`/`patchDraftSchema`, `discordChatExporterExportSchema`, schemas de sugestão): contar consumidores reais por app/pacote.
2. Veredito por schema: **mover** (cross-app) vs **manter local** (domínio mesas) — registrar o porquê.
3. Migrar o que mover p/ `packages/content`, exportar tipos, consumidores importam, def. local removida no mesmo PR.

### Validação F6

- `pnpm run lint` + `pnpm run build` + testes dos backends afetados verdes.

---

## F3 — Convergência scripts deploy (DEB-050-02)

1. `rg -n "\[ " scripts/deploy` + revisão manual para listar **todos** os `[ ... ]` (test single-bracket) e `echo ... >&2` ausentes nos scripts antigos. Confirmar a lista de `spec.md` R-F3.1 e ampliar se necessário.
2. Converter `[`→`[[`, erros para `>&2`, **preservando semântica** (atenção a `[[` mudando word-splitting/glob — revisar cada conversão).
3. Rodar `_lint-shell.yml` localmente (ShellCheck) + os 3 self-tests de shell.
4. Refactor isolado: pode ser commit/PR próprio dentro da branch da spec; **zero mudança de comportamento**.

### Validação F3

- ShellCheck limpo; `test_migration_guard.sh`, `test_migration_reconcile.sh`, `test_migration_lock.sh` verdes.

---

## Ordem sugerida (PRs)

- **Onda 0 (F0):** discovery, sem código de produção — alimenta as ondas seguintes.
- **PR Onda A — `packages/ui`:** F4 + F5 + F1 juntos (todo toque em `packages/ui`, um review + um smoke de consumidores).
- **PR Onda B — `packages/content`:** F6 (se a auditoria justificar; pode ser pequeno/nulo).
- **PR Onda C — nav:** F2.
- **PR Onda D — shell:** F3 (ortogonal).

Cada PR/commit/push exige autorização nominal própria (pétrea). Ondas A/B = `packages/*` compartilhado → SDD Completo + smoke dos consumidores.

## Risco / Rollback

- F1/F2: CSS/props aditivos, reversíveis por reverter o commit. Risco = regressão visual cross-app → mitigado por smoke nos 4 consumidores.
- F3: estilístico, reversível; risco = `[[` alterar avaliação de teste → mitigado pelos self-tests.
