# WCAG Accessibility Audit Report

**Website/App**: Artificio RPG — Gestao (Admin) / Discord Sync UI
**URL**: `mesas.artificiorpg.com/gestao` (beta)
**Date**: 2026-06-23
**WCAG Version**: 2.1
**Target Conformance Level**: AA
**Auditor**: AI Agent (code review)
**Scope**: `apps/mesas/frontend/src/features/discord-sync/components/` + `apps/mesas/frontend/src/pages/GestaoPage.tsx`

**Files audited (8)**:
- `DiscordSyncPanel.tsx` — main panel with tabs (configuracao, fontes, mensagens, drafts, import-json)
- `DiscordJsonImportPanel.tsx` — JSON import with drag-and-drop + preview
- `DiscordSourceList.tsx` — source management (CRUD + discovery form)
- `DiscordDraftReviewTable.tsx` — draft review table
- `DiscordSettingsPanel.tsx` — bot token settings
- `DraftEditorTab.tsx` — draft editor form
- `DiscordDraftPreview.tsx` — draft preview modal with tabs
- `GestaoPage.tsx` — main admin page container

---

## Executive Summary

### Conformance Status
**Level A**: ❌ Not Conformant (12 issues)
**Level AA**: ❌ Not Conformant (10 issues)

### Critical Findings
- **Total Issues**: 26
  - Critical: 5 (blocks access, legal risk)
  - Serious: 11 (major barriers)
  - Moderate: 7 (some barriers)
  - Minor: 3 (small improvements)

### Top 3 Blockers
1. **No keyboard access to draft list items** — WCAG 2.1.1 (Level A)
2. **No visible focus indicators on textareas/inputs** — WCAG 2.4.7 (Level AA)
3. **Draft preview modal lacks role, focus trap, and Escape close** — WCAG 4.1.2, 2.1.2 (Level A)

### Estimated Remediation Effort
- **Quick Fixes** (1-2 days): 12 issues
- **Medium Effort** (1 week): 11 issues
- **Major Work** (1-2 weeks): 3 issues

---

## Detailed Findings by Principle

---

## 1. Perceivable

### ❌ FAIL: 1.1.1 Non-text Content (Level A)
**Severity**: Serious
**Impact**: Screen reader users cannot understand icon buttons and decorative images

**Issues Found:**

1. **Icon buttons without accessible names** (DiscordSettingsPanel.tsx:91-97, 139-143, 148-153)
   - **Location**: Status badge icons, Save/Remove buttons with lucide-react icons
   - **Example**: `<ShieldCheck size={16} />` inside a `<span>` — icon has no accessible name
   - **Example**: `<button><Save size={16} />Salvar token</button>` — the `Save` icon is decorative but duplicates the visible text. Use `aria-hidden="true"` on the icon.
   - **Fix**: Add `aria-hidden="true"` to decorative icons that duplicate visible text; use `aria-label` for standalone icon-only buttons (if any)

2. **Close button lacks accessible name** (DiscordDraftPreview.tsx:42-44)
   - **Location**: Modal close button
   - **Code**: `<button onClick={onClose}>X</button>`
   - **User Impact**: Screen reader announces "X button" — unclear purpose
   - **Fix**: Add `aria-label="Fechar"` to the close button

3. **Empty cover thumbnail has no text alternative** (DiscordDraftReviewTable.tsx:164)
   - **Location**: Draft list items without cover images
   - **Code**: `<div className="h-full w-full bg-white/5" />` — purely decorative, but inside an interactive area
   - **Fix**: Add `aria-hidden="true"` to the empty placeholder div

---

### ❌ FAIL: 1.3.1 Info and Relationships (Level A)
**Severity**: Serious
**Impact**: Screen reader users lose document structure and form context

**Issues Found:**

1. **No heading for Draft Review Table section** (DiscordDraftReviewTable.tsx:109)
   - The component renders directly into the tab content with no `<h3>` or heading
   - **Fix**: Add `<h3 className="text-white font-semibold mb-3">Drafts</h3>` at the top

2. **No heading for Settings section** (DiscordSettingsPanel.tsx:87)
   - **Fix**: Add `<h3 className="text-white font-semibold mb-3">Configuração do Bot</h3>`

3. **Search input has no label** (GestaoPage.tsx:610-616)
   - **Location**: "Buscar mesas..." table search
   - **Code**: `<input type="text" placeholder="Buscar mesas..." ... />`
   - **User Impact**: Screen reader users don't know what this input is for
   - **Fix**: Add `<label htmlFor="table-search" className="sr-only">Buscar mesas</label>` or `aria-label="Buscar mesas"`

4. **Tab controls lack ARIA tab pattern** (DiscordSyncPanel.tsx:276-281, GestaoPage.tsx:479-550, DiscordDraftPreview.tsx:85-89)
   - Tab buttons use plain `<button>` elements without `role="tablist"`, `role="tab"`, `aria-selected`, or `tabpanel`
   - **User Impact**: Screen reader users don't know they're in a tab interface or which tab is selected
   - **Fix**: Wrap tabs in `<div role="tablist" aria-label="Seções de sincronização">`, add `role="tab" aria-selected={tab === 'x'}` to each button, add `role="tabpanel"` to content divs

5. **Form select elements partially use implicit `<label>` wrapping** (DiscordSourceList.tsx:215-248, DraftEditorTab.tsx:96-183)
   - Some use `<label>` wrapper (good), but the `<select>` has no `id` + `<label htmlFor>` association
   - Implicit wrapping works with most screen readers but explicit `htmlFor` + `id` is more robust
   - **Fix**: Add `id` to each select and `htmlFor` on the label (DraftEditorTab has `<label><span>...</span><input/></label>` — implicit wrapping is acceptable but explicit is preferred)

---

### ❌ FAIL: 1.4.3 Contrast (Minimum) (Level AA)
**Severity**: Critical
**Impact**: Low vision users cannot read substantial portions of the UI

**Note**: These findings are based on Tailwind class analysis against dark theme `#0F1A2E` / `#1B2A4A` backgrounds. Actual contrast must be verified with a contrast checker tool.

**Issues Found:**

1. **Low-opacity white text throughout** (Multiple files)
   - `text-white/40` on `#0F1A2E` (~#0F1A2E): luminance ≈ 0.008 (bg), text ≈ 0.008 + 0.4*(1-0.008) ≈ 0.405 → ratio ≈ (0.405+0.05)/(0.008+0.05) ≈ 7.8:1 — **passes** at 40% opacity
   - Wait — let me recalculate. White `#FFFFFF` has luminance 1.0. At 40% opacity over `#0F1A2E` (luminance ≈ 0.008): blended = 0.4*1 + 0.6*0.008 ≈ 0.405. Contrast with bg `#0F1A2E`: (0.405+0.05)/(0.008+0.05) ≈ 7.8:1. Passes.
   - `text-white/30` on `#0F1A2E`: blended luminance ≈ 0.306. Ratio ≈ 5.96:1. Passes.
   - **These pass**. But `text-white/20` or below would fail for normal text.
   - The real concern is:
     - `text-yellow-300` (#FDE047) on `bg-yellow-700/40` (≈ blended dark): need tool validation — likely borderline
     - `text-blue-300` (#93C5FD) on dark: luminance ≈ 0.470. On `#0F1A2E` (0.008): ratio ≈ 8.5:1. Passes.
     - `text-orange-300` (#FDBA74) on `#0F1A2E`: luminance ≈ 0.621. Ratio ≈ 11.6:1. Passes.
     - `text-red-300` (#FCA5A5) on `#0F1A2E`: luminance ≈ 0.539. Ratio ≈ 10.1:1. Passes.
   - **Most text passes in dark theme.** But need actual tool verification.

2. **Placeholder text contrast** (DiscordJsonImportPanel.tsx:215, GestaoPage.tsx:610, etc.)
   - `placeholder-white/40` and `placeholder-white/30`: placeholder text at low opacity. WCAG does not strictly require placeholder to meet 4.5:1 (it's considered "inactive UI"), but best practice is to meet at least 3:1.
   - **Verdict**: Potentially fails 1.4.11 (non-text contrast) if placeholder is relied upon as the sole label. Combined with the missing labels on some inputs, this becomes a 3.3.2 issue.

3. **Border contrast on inputs and panels** (All files)
   - `border-white/10` on dark bg: 10% white blend has luminance ≈ 0.107. Contrast with bg: (0.107+0.05)/(0.008+0.05) ≈ 2.7:1. **Fails 3:1 for UI components** (1.4.11).
   - This affects ALL input borders, panel borders, and card borders.
   - **Fix**: Increase border opacity to `border-white/20` (blended luminance ≈ 0.206, ratio ≈ 4.4:1) or use `border-white/15`.

---

### ⚠️ PASS (with caveat): 1.4.11 Non-text Contrast (Level AA)
**Status**: Partial — border contrast fails (see 1.4.3 issue 3 above)

**UI Component Contrast Issues:**

1. **Input/select borders at `border-white/10`** (~2.7:1) — fails 3:1 minimum
2. **Focus indicator on `app-select`**: `border-color: rgba(255,87,34,0.6)` — orange border on dark background. This is likely sufficient for the state change (regular border → orange border), but the regular border itself is already below 3:1.

---

## 2. Operable

### ❌ FAIL: 2.1.1 Keyboard (Level A)
**Severity**: Critical
**Impact**: Keyboard-only users cannot access draft list functionality

**Issues Found:**

1. **Draft list items are `<div>` with `onClick` — not keyboard accessible** (DiscordDraftReviewTable.tsx:155-193)
   - **Location**: Draft list entries
   - **Code**: `<div ... onClick={() => setSelectedDraft(draft)} ...>`
   - **User Impact**: Keyboard users cannot select a draft to preview/edit it
   - **Fix**: Change to `<button>` or add `role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSelectedDraft(draft)}`

2. **Source list items use `<div>` containers with buttons inside** (DiscordSourceList.tsx:319-410)
   - The container div is not clickable (only the buttons inside are interactive) — this is fine. But the entire row area could benefit from being a semantic list structure.

---

### ❌ FAIL: 2.1.2 No Keyboard Trap (Level A)
**Severity**: Critical
**Impact**: Keyboard users cannot escape the draft preview modal

**Issues Found:**

1. **Draft preview modal has no Escape key handler** (DiscordDraftPreview.tsx:34-145)
   - **Location**: Full-screen overlay modal
   - **Missing**: `onKeyDown` handler for `Escape` key
   - **Fix**: Add `onKeyDown={(e) => e.key === 'Escape' && onClose()}` to the overlay or the dialog container

2. **Modal has no focus trap**
   - When the modal opens, focus remains on the trigger element. When Tabbing through modal content, focus eventually moves to elements behind the overlay.
   - **Fix**: Move focus to the first focusable element inside the modal on open; trap focus within the modal using a focus-trap library or custom logic

3. **Modal overlay is not keyboard-dismissible beyond Escape**
   - Clicking the backdrop calls `onClose` but there's no keyboard equivalent

---

### ❌ FAIL: 2.4.1 Bypass Blocks (Level A)
**Severity**: Moderate
**Impact**: Keyboard users must tab through many controls to reach main content

**Issues Found:**

1. **No "Skip to main content" link** (GestaoPage.tsx:472)
   - **Fix**: Add a skip link at the top of the page:
   ```html
   <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 ...">
     Pular para o conteúdo principal
   </a>
   ```

2. **No landmark regions** (All files)
   - GestaoPage has no `<main>`, `<nav>`, or `<header>` elements
   - The entire page is a single `<div>` with nested content
   - **Fix**: Wrap main content in `<main id="main-content">` and navigation in `<nav aria-label="Gestão administrativa">`

---

### ❌ FAIL: 2.4.3 Focus Order (Level A)
**Severity**: Serious
**Impact**: Focus order becomes illogical when modals are open

**Issues Found:**

1. **Modal focus not managed** (DiscordDraftPreview.tsx)
   - When the draft preview modal opens, focus should move to the modal, not remain on the trigger element
   - When the modal closes, focus should return to the element that opened it
   - **Fix**: Use `useRef` + `useEffect` to move focus into the modal on mount and restore on unmount

---

### ❌ FAIL: 2.4.6 Headings and Labels (Level AA)
**Severity**: Serious
**Impact**: Screen reader users lack structural navigation aids

**Issues Found:**

1. **Sections without headings** — see 1.3.1 issues 1 and 2 (DiscordDraftReviewTable, DiscordSettingsPanel)

2. **"Buscar mesas..." input has no label** — see 1.3.1 issue 3

3. **"Notas de revisão..." input has no label** (DiscordDraftPreview.tsx:55-60)
   - `<input placeholder="Notas de revisão..." ... />` — no label, no aria-label
   - **Fix**: Add `aria-label="Notas de revisão"` or a visible `<label>`

4. **JSON textarea label is disconnected from visible label** (DiscordJsonImportPanel.tsx:211-218)
   - Visible label text is in the `<h3>` and `<p>` above the textarea
   - Textarea has `aria-label="JSON do DiscordChatExporter"` which partially matches
   - **Fix**: Add an explicit `<label htmlFor="discord-json-input">` or ensure `aria-labelledby` points to the heading

---

### ❌ FAIL: 2.4.7 Focus Visible (Level AA)
**Severity**: Critical
**Impact**: Keyboard users cannot see which element has focus

**Issues Found:**

1. **Textareas with `outline-none` and no replacement focus style** (DiscordJsonImportPanel.tsx:217, DiscordSyncPanel.tsx:503)
   - The JSON textarea and message content textarea remove the browser's default focus outline with `outline-none` but add no visible focus indicator
   - **User Impact**: Keyboard users cannot tell when these elements are focused
   - **Fix**: Add `focus:ring-2 focus:ring-blue-500 focus:border-blue-500` or equivalent visible focus style

2. **Draft editor form inputs have no focus styles** (DraftEditorTab.tsx:27)
   - `const inputClass = 'w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30';`
   - No `focus:` modifier — browser default outline may still appear, but only if Tailwind preflight doesn't reset it
   - **Fix**: Add `focus:border-blue-500 focus:ring-1 focus:ring-blue-500` to `inputClass`

3. **Clickable `<div>` in draft review table has no focus indicator** (DiscordDraftReviewTable.tsx:155)
   - Since it's not a button and has no `tabIndex`, it doesn't receive focus — but once converted to a button/role="button", it needs a visible focus style
   - **Fix**: Add `focus-visible:ring-2 focus-visible:ring-blue-500` after converting to interactive element

---

### ⚠️ 2.5.3 Label in Name (Level A)
**Severity**: Minor
**Impact**: Voice control users may have difficulty activating controls

**Issues Found:**

1. **Close button "X"** (DiscordDraftPreview.tsx:42)
   - Visible text is "X", accessible name is only "X" — voice control users saying "click Fechar" won't work
   - **Fix**: Add `aria-label="Fechar"` so accessible name contains "Fechar"

2. **"+ Adicionar canal" button** (DiscordSourceList.tsx:202-207)
   - Uses `+` prefix in visible text. The `+` symbol is part of the visible label. Accessible name matches visible text — OK.

---

### ❌ FAIL: 2.5.7 Dragging Movements (Level AA — WCAG 2.2)
**Severity**: N/A (WCAG 2.1 audit target, but noted for forward compatibility)

**Note**: DiscordJsonImportPanel's drag-and-drop already has a file selection button alternative (`Selecionar arquivo` button). This passes 2.5.7.

---

### ⚠️ 2.5.8 Target Size (Minimum) (Level AA — WCAG 2.2)
**Severity**: Moderate
**Impact**: Users with motor impairments may struggle to tap small buttons

**Issues Found:**

1. **Small action buttons** (Multiple files)
   - "Remover", "Sim", "Não" buttons: `px-2 py-1` — effective target height ≈ 20-22px (below 24px minimum)
   - "Editar status", "Cancelar" buttons: `px-3 py-1` — borderline
   - "Apurar" / "Aberta" indicator: `text-xs` inside a button — small target
   - **Fix**: Increase minimum padding to `px-3 py-2` for interactive controls, or ensure spacing between adjacent targets meets the spacing exception

---

## 3. Understandable

### ❌ FAIL: 3.1.1 Language of Page (Level A)
**Severity**: Minor
**Impact**: Screen readers may mispronounce Portuguese content if language is not declared

**Note**: Cannot verify from component code alone — this depends on the `<html lang="pt-BR">` attribute in the document. If missing, screen readers will default to the user's system language.

---

### ✅ PASS: 3.2.1 On Focus (Level A)
No automatic context changes on focus detected. All state changes are triggered by explicit user actions (clicks, Enter key) or select changes (which follow the expected filter/list pattern).

---

### ✅ PASS: 3.2.2 On Input (Level A)
Select dropdown changes trigger data reloads in the filter pattern, which is an expected and predictable behavior. Checkbox toggles trigger API calls with toast feedback — acceptable since the action and result are clear.

---

### ✅ PASS: 3.2.3 Consistent Navigation (Level AA)
Tab-based navigation in GestaoPage is consistent throughout the admin section. Same navigation pattern used across sub-tabs (crud sub-tabs, systems filters).

---

### ❌ FAIL: 3.3.1 Error Identification (Level A)
**Severity**: Serious
**Impact**: Screen reader users are not notified of validation errors

**Issues Found:**

1. **Inline validation errors lack `role="alert"`** (Multiple files)
   - DiscordSettingsPanel.tsx:128 — `{validationMessage && <p className="text-sm text-red-300">{validationMessage}</p>}` — no `role="alert"`
   - DiscordJsonImportPanel.tsx:346-349 — error state displayed without `role="alert"`
   - DiscordJsonImportPanel.tsx:126-128 — file validation errors without `role="alert"`
   - DraftEditorTab.tsx:39-43 — missing fields warning without `role="alert"`
   - DiscordDraftPreview.tsx:60 — `coverError` without `role="alert"`
   - **Fix**: Add `role="alert"` to all error/validation message containers

2. **Toast notifications may not be properly announced**
   - `react-hot-toast` has some aria-live support built in, but this should be verified with a screen reader test
   - Custom `aria-live` regions may be needed for critical notifications

---

### ✅ PASS: 3.3.2 Labels or Instructions (Level A)
**Note**: Partially passes. Issues documented under 2.4.6 (missing labels on search input, review notes input). Form fields in DraftEditorTab and DiscordSourceList generally have labels.

---

### ⚠️ PASS: 3.3.3 Error Suggestion (Level AA)
Error messages provide specific guidance:
- DiscordSettingsPanel: "Informe o token antes de salvar.", "O token não pode conter espaços.", "O token precisa ter pelo menos 50 caracteres."
- DiscordJsonImportPanel: "Formato inválido. Selecione um arquivo .json.", "Arquivo muito grande (X). O limite é 10 MB."
- **OK** — error messages are specific and actionable.

---

### ⚠️ PASS: 3.3.4 Error Prevention (Level AA)
Critical actions have confirmation:
- Source deletion: two-step confirmation ("Remover" → "Sim"/"Não")
- Token removal: confirmation with warning message
- Reingest: `window.confirm()` with detailed warning
- Bulk sync: `window.confirm()` before synchronizing
- **OK** — reversible/checkable/confirmable pattern used for destructive actions.

---

## 4. Robust

### ❌ FAIL: 4.1.2 Name, Role, Value (Level A)
**Severity**: Critical
**Impact**: Assistive technology cannot interpret UI state or purpose

**Issues Found:**

1. **Tab controls lack ARIA roles and states** — see 1.3.1 issue 4

2. **Clickable `<div>` lacks button role** — see 2.1.1 issue 1

3. **Draft preview modal lacks dialog role** (DiscordDraftPreview.tsx:34-145)
   - No `role="dialog"`, no `aria-modal="true"`, no `aria-labelledby` pointing to the title
   - **Fix**: Add `role="dialog" aria-modal="true" aria-labelledby="draft-preview-title"` to the modal container

4. **Loading/empty states lack status role**
   - "Carregando..." text: add `role="status"` or `aria-busy="true"`
   - "Nenhuma mensagem encontrada.", "Nenhum canal cadastrado.": add `role="status"`

5. **Status badges lack semantic role** (DiscordSyncPanel.tsx:388-395)
   - Status pill `<span>` elements use color + text but provide no programmatic status indication
   - **Fix**: Not strictly required since the text label is present, but could benefit from `role="status"`

6. **Checkboxes in GestaoPage suggestions list** (GestaoPage.tsx:783-786)
   - Has `aria-label={`Selecionar sugestão ${suggestion.name}`}` — good

7. **Form validation in DraftEditorTab** (DraftEditorTab.tsx:39-43)
   - The missing fields warning uses `aria-atomic="true"` or `aria-live="polite"` could help
   - **Fix**: Add `role="alert"` to the missing fields container

---

### ❌ FAIL: 4.1.3 Status Messages (Level AA)
**Severity**: Serious
**Impact**: Dynamic content changes are not announced to screen readers

**Issues Found:**

1. **Loading states are not announced** (All files)
   - When "Carregando..." appears, screen readers don't know
   - **Fix**: Add `role="status" aria-live="polite"` to loading indicators

2. **Preview results in JSON import panel are not announced** (DiscordJsonImportPanel.tsx:260-344)
   - When the preview loads or import completes, the DOM changes but nothing is announced
   - **Fix**: Add `aria-live="polite"` to the preview/result containers

3. **Message list and draft list updates are silent**
   - When filters change and the list reloads, screen reader users get no feedback
   - **Fix**: Add `aria-live="polite"` to the list container or use a status region to announce "X resultados encontrados"

4. **Tab content switching is not announced**
   - When switching tabs, the new content appears but nothing is announced
   - **Fix**: Use `aria-live="polite"` on tab panels or manage focus to the new heading

---

### ⚠️ PASS: 4.1.1 Parsing (Level A)
No duplicate IDs detected. HTML structure is valid JSX. Button elements are properly used (no `<div>` acting as button except the draft list items, noted in 2.1.1). `<label>` elements use either implicit wrapping or explicit `htmlFor`.

---

## Positive Findings (What's Done Well)

1. **Drag-and-drop has keyboard alternative** (DiscordJsonImportPanel.tsx:238-243)
   - File selection button provides an alternative to drag-and-drop — satisfies 2.5.7

2. **Semantic use of `<aside>`** (DiscordSyncPanel.tsx:424)
   - The message detail panel uses `<aside>` appropriately for complementary content

3. **Proper use of `<label>` elements on most form inputs** (DiscordSourceList, DraftEditorTab)
   - Most form fields have visible, persistent labels

4. **Color is not the sole differentiator for status**
   - Status badges use both color AND text labels (Pendente, Parseada, Revisar, etc.)

5. **Confirmation dialogs for destructive actions**
   - Delete, reingest, and bulk sync all use confirmation steps

6. **`autoComplete="new-password"` on token input** (DiscordSettingsPanel.tsx:126)
   - Prevents browser from autofilling the bot token field

7. **File input is visually hidden but keyboard-accessible** via the "Selecionar arquivo" button

8. **`aria-label` on time window select** (DiscordSourceList.tsx:352)
   - Each source's time window has a descriptive aria-label

---

## Prioritized Remediation Plan

### Phase 1: Critical Blockers (Must Fix) — 1-2 days
**Legal Risk**: High | **User Impact**: Severe

| # | Issue | WCAG | Files | Effort |
|---|-------|------|-------|--------|
| 1 | Convert draft list `<div>` to `<button>` or add keyboard handlers | 2.1.1 (A) | DiscordDraftReviewTable.tsx:155 | 1h |
| 2 | Add visible focus indicators to all inputs/textarea/buttons | 2.4.7 (AA) | DiscordJsonImportPanel, DiscordSyncPanel, DraftEditorTab | 2h |
| 3 | Add `role="dialog"`, `aria-modal`, Escape handler, focus trap to modal | 4.1.2, 2.1.2 (A) | DiscordDraftPreview.tsx | 3h |
| 4 | Add `aria-label="Fechar"` to close button | 1.1.1 (A) | DiscordDraftPreview.tsx:42 | 5min |
| 5 | Add label to "Buscar mesas..." search input | 3.3.2 (A) | GestaoPage.tsx:610 | 10min |
| 6 | Add `role="alert"` to all inline error/validation messages | 3.3.1 (A) | 5 files | 1h |
| 7 | Add ARIA tab pattern to all tab groups | 1.3.1 (A) | DiscordSyncPanel, GestaoPage, DiscordDraftPreview | 2h |

**Total Phase 1 Effort**: ~10 hours (1-2 days)

---

### Phase 2: Serious Issues (Should Fix) — 1 week
**Legal Risk**: Medium | **User Impact**: Significant

| # | Issue | WCAG | Files | Effort |
|---|-------|------|-------|--------|
| 8 | Add headings to sections without them (Drafts, Settings) | 2.4.6 (AA) | DiscordDraftReviewTable, DiscordSettingsPanel | 30min |
| 9 | Add `aria-live` regions for dynamic content changes | 4.1.3 (AA) | All files | 3h |
| 10 | Add skip-to-main-content link and landmark regions | 2.4.1 (A) | GestaoPage.tsx | 1h |
| 11 | Manage focus when modal opens/closes | 2.4.3 (A) | DiscordDraftPreview.tsx | 2h |
| 12 | Add `role="status"` to loading indicators | 4.1.3 (AA) | All files | 1h |
| 13 | Verify and fix border contrast (`border-white/10` → `border-white/15` or higher) | 1.4.11 (AA) | All files | 30min |
| 14 | Add labels to "Notas de revisão..." input | 3.3.2 (A) | DiscordDraftPreview.tsx:55 | 15min |
| 15 | Add explicit `htmlFor`+`id` to select elements with wrapping labels | 1.3.1 (A) | DraftEditorTab, DiscordSourceList | 1h |
| 16 | Add `aria-hidden="true"` to decorative lucide-react icons | 1.1.1 (A) | DiscordSettingsPanel, DiscordDraftPreview | 30min |
| 17 | Verify `<html lang="pt-BR">` is set on the document | 3.1.1 (A) | index.html | 5min |
| 18 | Add announcement for filter/list results count | 4.1.3 (AA) | DiscordSyncPanel, DiscordDraftReviewTable | 1h |

**Total Phase 2 Effort**: ~12 hours (1 week)

---

### Phase 3: Moderate/Minor Issues (Nice to Have) — 1-2 weeks
**Legal Risk**: Low | **User Impact**: Usability improvements

| # | Issue | WCAG | Effort |
|---|-------|------|--------|
| 19 | Increase minimum touch target size to 24×24px | 2.5.8 (AA) | 2h |
| 20 | Add `aria-current="page"` to active navigation items | 1.3.1 (A) | 30min |
| 21 | Replace `window.confirm()` with custom accessible modal dialogs | 3.3.4 (AA) | 4h |
| 22 | Add `aria-describedby` to inputs with helper text | 3.3.2 (A) | 1h |
| 23 | Implement accessible toast notification system with proper aria-live | 4.1.3 (AA) | 4h |
| 24 | Add keyboard shortcut help (if any shortcuts are implemented) | 2.1.4 (A) | 1h |
| 25 | Test and verify all contrast ratios with a contrast checker tool | 1.4.3 (AA) | 2h |
| 26 | Add `<ul>/<li>` structure to message and draft lists | 1.3.1 (A) | 1h |

**Total Phase 3 Effort**: ~16 hours (1-2 weeks)

---

## Testing Tools Used

This audit was conducted via **static code review** of React/TypeScript JSX source with Tailwind CSS classes. The following should be used for validation:

### Automated Tools (Recommended for verification)
- [ ] axe DevTools — run against live beta deployment
- [ ] WAVE — visual overlay on beta pages
- [ ] Lighthouse (Chrome DevTools) — Accessibility audit in beta
- [ ] WebAIM Contrast Checker — verify suspect color combinations
- [ ] W3C Markup Validation Service — validate rendered HTML

### Manual Testing (Recommended)
- [ ] Keyboard navigation (Tab, Enter, Space, Escape, Arrow keys) — full flow test
- [ ] Screen reader (NVDA Windows / VoiceOver Mac) — test all workflows
- [ ] Zoom to 200% — verify responsive behavior
- [ ] Mobile reflow at 320px — verify content doesn't overflow

---

## Quick Wins (High Impact / Low Effort)

These 5 fixes can be done in under 2 hours:

1. **`aria-label="Fechar"` on modal close button** — 5 min, fixes 1.1.1
2. **`role="alert"` on error messages** — 15 min, fixes 3.3.1 for 5+ locations
3. **Label on "Buscar mesas..." input** — 10 min, fixes 3.3.2
4. **`focus:border-blue-500` on textarea inputs** — 15 min, fixes 2.4.7 on 3 inputs
5. **`role="dialog" aria-modal="true"` on draft preview modal** — 10 min, fixes 4.1.2

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices: Tabs](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)
- [ARIA Authoring Practices: Dialog Modal](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe-core React integration](https://www.npmjs.com/package/@axe-core/react)

---

**Version**: 1.0
**Date**: 2026-06-23
**Methodology**: Static code review of React/TSX source, Tailwind class analysis, ARIA/semantic audit. Should be validated with automated tools + manual testing on a live beta deployment.
