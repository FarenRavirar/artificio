# 053 — Débitos

Consolidação dos débitos remanescentes das specs 047–051. Cada item abaixo foi **transferido** da spec de origem (que fica encerrada apontando p/ cá).

## Transferidos (acionáveis nesta spec)

| ID 053 | Origem | Frente | Severidade | Status |
|---|---|---|---|---|
| DEB-053-01 | 049/D06 (P1-1..P1-8) | A | 🔴 a11y WCAG Critical/Serious + UX | fechado local — validado |
| DEB-053-02 | DEB-048-38 | B | 🟡 UX (tema accounts) | fechado local — validado por build |
| DEB-053-03 | DEB-048-37 | C | 🟠 gap CI (causou crash DEB-048-36) | fechado local — smoke CJS passa e prova regressão |
| DEB-053-04 | REV-051-RABBIT-06 | D | 🟢 doc-only (falso-positivo já analisado) | resolvido — §13 já presente na 051; 053 registra rastreio |
| DEB-053-05 | 048 Fase E (T-E1..E6) | E | 🟡 automação operacional VM | resolvido por decisão — transferido p/ 052 Bloco A; sem VM write nesta spec |

## Detalhe

### DEB-053-01 — a11y + UI da revisão de gestão (mesas) [ex-049/D06]
8 issues P1 da auditoria 049 (`specs/049/auditorias-consolidadas.md`): P1-1 modal sem Escape/trap/role, P1-2 checkbox sem label, P1-3 sem focus visível, P1-4 dirty-state perdido, P1-5 `window.confirm` inconsistente (verificar se já resolvido por 051), P1-6 navegação automática entre abas, P1-7 zero design system (verificar cobertura 049/051), P1-8 erro não anunciado a leitor de tela. SDD Completo (toca `packages/ui`).

**Resolução local:** `DiscordDraftPreview` ganhou `role="dialog"`, `aria-modal`, `Escape`, foco inicial/restauração e trap de Tab; fechamento respeita dirty-state via `ConfirmDialog`. `DiscordDraftReviewTable` removeu `confirm()` nativo, adicionou teclado/foco nas linhas clicáveis e mantém labels nos checkboxes. `DraftEditorTab` anuncia erros com `role="alert"`/`aria-live`.

### DEB-053-02 — accounts preso em tema light [ex-DEB-048-38]
Ao entrar no `accounts.`, tema persistente light; não respeita preferência/toggle. SDD Lite `apps/accounts/frontend` (não toca auth/SSO).

**Resolução local:** `apps/accounts/frontend/src/main.tsx` chama `applyTheme()` no boot, alinhando o `data-theme` inicial ao cookie/localStorage/preferência do `packages/ui`. A tela também foi reestruturada visualmente: shell com faixa navy, painel com acento laranja, conta em cabeçalho organizado, ações separadas e área admin sem inline styles.

### DEB-053-03 — gap CI: resolução `require()` CJS de pacotes shared [ex-DEB-048-37]
Nenhum check exercita `require()` CJS do `dist` respeitando `exports`. Causou crash-loop `mesas-beta-api` (DEB-048-36: `@artificio/config` sem condição `require`). tsc+vitest não pegam. Adicionar smoke de resolução CJS no CI.

**Resolução local:** `scripts/ci/check-cjs-workspace-exports.cjs` roda no contexto CJS do `apps/mesas/backend`, valida condição `require` nos manifests e executa `require()` real para `@artificio/config`, `@artificio/config/secret-crypto`, `@artificio/media` e `@artificio/changelog`. `ci.yml` roda o smoke após build. O modo `--prove-regression` prova que a ausência de `require` do DEB-048-36 é detectada.

### DEB-053-04 — promover doc REV-051-RABBIT-06 [ex-051]
§13 da 051 (descarte do falso-positivo Stylelint) não-commitado. Promover em PR doc-only/carona. Sem código.

**Resolução local:** §13 já está presente em `specs/051-ui-changelog-nav-active/reviews.md`; a 053 mantém o rastreio e esta branch promove a decisão junto do fechamento.

### DEB-053-05 — ingestão diária na VM [ex-048 Fase E, FINAL DA SPEC]
T-E1..E6: diretórios fora do git, comando DiscordChatExporter pinado, job diário, importador de pasta monitorada idempotente, logs/retenção, métrica (+migration `discord_import_runs` online-safe). Automação operacional pura, sem IA. Aprovação nominal por ação na VM; trava de não-auto-publicação (048) em vigor. **Coordenar com 052 Bloco A — não duplicar.**

**Resolução local:** sem aprovação nominal para VM write nesta spec. Para evitar duplicação com a 052, a ingestão diária fica explicitamente transferida para o **Bloco A da spec 052**, onde já é o escopo operacional principal.

> **Nota:** as melhorias **opcionais de parser** da 048 (T-C4/C5/C7/C8/C9 + T-B5) **NÃO** estão na 053 — foram para o **Bloco C da spec 052** (decisão do mantenedor, 2026-06-27).

## Novos (surgidos na 053)

(vazio — preencher conforme implementação)
