# Débitos — 043

Débitos acionáveis também devem aparecer em `specs/backlog.md`.

| ID | Título | Origem | Task | Review | Severidade | Prioridade | Status | Backlog |
|---|---|---|---|---|---|---|---|---|
| DEB-001 | Modal ReportButton — 14 inline styles, tokens errados, não usa @artificio/ui | T10 R5 | T10 | REV-001 | Medium | Média | resolvido | sim |
| DEB-002 | Modal ReportButton sem Escape key handler (WCAG 2.1 Keyboard) | T10 R6 | T10 | REV-002 | Minor | Baixa | resolvido | sim |
| DEB-003 | Token --error ausente no design system packages/ui | T9 R1 | T9 | REV-003 | Medium | Baixa | resolvido | sim |
| DEB-004 | Sistema de estados de input (.input-error, .input-disabled) ausente | T9 R4 | T9/T32 | — | Medium | Baixa | resolvido | sim |
| DEB-005 | Spinner inline durante digitação no LinksSearch | T9 R4 | T9 | — | Cosmetic | Baixa | resolvido | sim |

---

## DEB-001 — Modal ReportButton: inline styles + tokens errados (não usa @artificio/ui)

- **Origem:** T10, Registro 5 — achado novo durante investigação do ReportButton
- **Task vinculada:** T10 (ReportButton trigger + Desfazer)
- **Status:** resolvido
- **Severidade real:** Medium — funcional mas quebrava tema dark (tokens `--color-surface`, `--color-fg`, `--color-border` inexistentes, caíam em fallback `#fff`/`#0B1220`/`#ccc`)
- **Backlog geral:** sim

### Evidência

O modal (`ReportButton.tsx:84-203`) tinha 12 blocos de `style={{...}}` (53 propriedades CSS) com 3 tokens inexistentes:
- `--color-surface` → fallback `#fff` (correto: `--surface`)
- `--color-fg` → fallback `#0B1220` (correto: `--fg` ou `--text`)
- `--color-border` → fallback `#ccc` (correto: `--line` ou `--border`)

Consequência: modal SEMPRE tema claro (fundo branco) sobre overlay escuro. Nenhum componente do `@artificio/ui` usado, mesmo o `<Modal>` já estando disponível no mesmo app (`CommunityGroups.tsx`).

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/ReportButton.tsx`

**Mudança:** 12 blocos `style={{...}}` → 0. Substituídos por `<Modal>`, `<Field>`, `<Select>`, `<Textarea>`, `<Button>` do `@artificio/ui`.

Ganhos colaterais:
- Tema dark funcional (tokens `var(--surface)`, `var(--fg)`, `var(--line)` responsivos)
- Escape key fecha o modal (hook `useEscapeClose` do design system) — **resolve DEB-002 automaticamente**
- Foco visível completo: `box-shadow` + `outline` via `.artificio-control:focus-visible`
- Botão × no header do modal (`.artificio-modal-close`)
- Labels com `font-weight: 700` (`.artificio-field-label`)
- Select/textarea desabilitam durante submit (`disabled={busy}`)
- Erro de validação usa `.artificio-field-error` com `role="alert"` e `var(--state-danger-fg)` (resolve hardcode `#DC2626`)

**Smoke:** ✅ build verde (16 páginas, 4.40s). Zero `style={{...}}` e zero `--color-*` no chunk `ReportButton.*.js`.

**Regressão zero:** Trigger (`.report-trigger`), lógica de submit/undo/erro, timer 5s — intactos.

---

## DEB-002 — Modal ReportButton sem Escape key handler

- **Origem:** T10, Registro 6
- **Task vinculada:** T10
- **Status:** resolvido automaticamente por DEB-001
- **Severidade real:** Minor — modal era fechável por teclado (Tab + Enter em Cancelar/Fechar), faltava só o atalho Escape (WAI-ARIA best practice, não violação WCAG normativa)
- **Backlog geral:** sim

### Resolvido (2026-06-22)

DEB-001 migrou o modal para `<Modal>` do `@artificio/ui`. O componente chama `useEscapeClose(open, onClose)` internamente (`primitives.tsx:317`), registrando listener global de `keydown` que fecha o modal ao pressionar Escape. Zero código adicional necessário.

---

## DEB-003 — Token `--error` ausente no design system (LinksSearch `text-red-400`)

- **Origem:** T9, Registro 1 — H4.2 (cores hardcoded)
- **Task vinculada:** T9 (LinksSearch cores→tokens)
- **Status:** resolvido
- **Severidade real:** Medium — `text-red-400` falhava WCAG AA no tema claro (contraste ~3.7:1 < 4.5:1)
- **Backlog geral:** sim

### Evidência

Tailwind v4 compila `text-red-400` → `oklch(70.4% 0.191 22.216)` ≈ `#ec5a55`. Contraste sobre `--page: #f4f6fb` (light) = ~3.7:1 — **falha WCAG AA**.

O token `--state-danger-fg` do `@artificio/ui` já estava disponível no CSS do app e é responsivo: `#b91c1c` (light, 8.2:1 AAA) / `#fca5a5` (dark, 6.1:1 AA). Único uso de vermelho hardcoded restante: `LinksSearch.tsx:74` + `AdminPanel.tsx:555` (`#DC2626`, débito separado).

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/LinksSearch.tsx:74`

**Mudança:** 1 linha — `text-red-400` → `text-[var(--state-danger-fg)]`.

**Smoke:** ✅ build verde (16 páginas, 4.67s). Zero `text-red-400` no dist.

---

## DEB-004 — Inputs sem tratamento de estados visuais (escopo revisado)

- **Origem:** T9, Registro 4 — UI Design Review §8.2
- **Task vinculada:** T9 (LinksSearch cores→tokens), T32 (F4 backlog)
- **Status:** resolvido
- **Severidade real:** Medium (ReportsSection `<select>`) / Cosmetic (EditForm) / N/A (SuggestForm, já resolvido)
- **Backlog geral:** sim

### Evidência

A recomendação original era "criar classes `.input-error`/`.input-disabled` em `global.css`". Porém, `@artificio/ui` já provê:
- `.artificio-control[data-invalid="true"]` → `border-color: var(--artificio-danger)`
- `.artificio-control:disabled` → `background: var(--surface-subtle); cursor: not-allowed; opacity: 0.7`
- `.artificio-field-error` → `color: var(--state-danger-fg)` + `role="alert"`
- Componentes `TextInput`/`Textarea`/`Select` com prop `invalid` → `data-invalid="true"` + `aria-invalid`

Criar classes paralelas seria **duplicação**. O débito real era migrar inputs raw restantes.

### Diagnóstico por componente

| Componente | Status | Ação |
|---|---|---|
| SuggestForm | ✅ Já usa @artificio/ui (`Field`, `TextInput`, `Textarea`) | Nenhuma |
| AdminPanel EditForm | ✅ Usa @artificio/ui; `err` global no campo invite (Cosmetic) | Nenhuma |
| AdminPanel ReportsSection `<select>` | ❌ Raw, tokens errados (`--color-border`/`--color-surface`/`--color-fg`) | Migrar para `<Select>` |
| LinksSearch input | ⚠️ T9 corrigiu tokens; foco via `focus:border-[var(--brand)]` | Cosmetic opcional |

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/admin/AdminPanel.tsx:665`

**Mudança:** `<select style={{...}}>` com 7 props inline + 3 tokens errados → `<Select value={filter} onChange={...}>`. `<Select>` já estava importado. Aplica `.artificio-control.artificio-control-md`: `font-size: 14px`, `min-height: 40px`, `border-radius: 8px`, tokens `var(--surface)`/`var(--line)`/`var(--fg)`, `transition`, `:focus-visible` com `outline` + `box-shadow`.

**Smoke:** ✅ build verde (16 páginas, 4.35s). Zero `--color-*` no dist.

---

## DEB-005 — Spinner inline no LinksSearch

- **Origem:** T9, Registro 4 — UI Design Review §8.2
- **Task vinculada:** T9
- **Status:** resolvido
- **Severidade real:** Cosmetic — estado loading já tinha texto ("Carregando grupos..."), faltava animação + `aria-busy`
- **Backlog geral:** sim

### Evidência

`LinksSearch.tsx:73`: `<p className="text-[var(--muted)]">Carregando grupos...</p>` — texto estático, sem animação, sem `aria-busy`. O `<LoadingState variant="inline">` do `@artificio/ui` provê spinner 28px animado (`artificio-spin` 760ms) + mesma mensagem + `aria-busy="true"`. Já usado em SuggestForm e AdminPanel (mesmo app).

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/LinksSearch.tsx:2,74`

**Mudanças:**
1. Adicionado `import { LoadingState } from "@artificio/ui"`
2. `<p>Carregando grupos...</p>` → `<LoadingState message="Carregando grupos..." variant="inline" />`

**Smoke:** ✅ build verde (16 páginas, 4.35s). Chunk confirma `<LoadingState>` com spinner `.artificio-state-spinner`.
