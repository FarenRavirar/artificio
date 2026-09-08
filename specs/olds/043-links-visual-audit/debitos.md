# Débitos — 043

> **Docs irmãos:** `tasks.md` · `reviews.md` · `spec.md`
> Débitos também devem aparecer em `specs/backlog.md`.

---

## Sumário

| ID | Título | Origem | Task | Status |
|---|---|---|---|---|
| DEB-001 | Modal ReportButton inline styles → @artificio/ui | T10 | T10 | resolvido |
| DEB-002 | Modal ReportButton sem Escape key | T10 | T10 | resolvido |
| DEB-003 | Token --error ausente (text-red-400 → state-danger-fg) | T9 | T9 | resolvido |
| DEB-004 | Inputs sem tratamento de estados visuais | T9 | T9/T32 | resolvido |
| DEB-005 | Spinner inline LinksSearch (loading state) | T9 | T9 | resolvido |
| DEB-006 | Drawer mobile sidebar (UI §1.1) | T30 | T30 | resolvido |
| DEB-007 | Breakpoint sidebar 900→220px (UI §7.1) | T31 | T31 | resolvido |
| DEB-008 | Chips categoria na busca (H7.3) | T33 | T33 | resolvido |
| DEB-009 | Página 404 customizada (H9.2) | T35 | T35 | resolvido |
| DEB-010 | Botão "voltar ao topo" (H3.3) | T36 | T36 | resolvido |
| DEB-011 | Transição CSS troca de tema (UI §10.1) | T37 | T37 | resolvido |
| DEB-012 | Accordion de regras (H8.3) | T38 | T38 | resolvido |
| DEB-013 | Onboarding/banner boas-vindas (H10.1) | T39 | T39 | resolvido |
| DEB-014 | Sidebar âncoras locais quebram fora da home | REV-001 | T8 | resolvido |

---

## DEB-001 — Modal ReportButton: inline styles + tokens errados (não usa @artificio/ui)

- **Origem:** T10 · **Status:** resolvido · **Severidade:** Medium
- **Problema:** Modal com 12 blocos `style={{...}}` + tokens inexistentes (`--color-surface`/`--color-fg`/`--color-border`). Tema dark quebrado (sempre fundo branco).

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/ReportButton.tsx` — 12 blocos `style={{...}}` → `<Modal>`, `<Field>`, `<Select>`, `<Textarea>`, `<Button>` do `@artificio/ui`.

Ganhos colaterais: tema dark funcional, Escape key (resolve DEB-002), foco visível, botão × no header, labels bold, submit disabled, erro `role="alert"`.

**Smoke:** ✅ 16 páginas. Zero `style={{...}}` e `--color-*` no dist.

---

## DEB-002 — Modal ReportButton sem Escape key handler

- **Origem:** T10 · **Status:** resolvido automaticamente por DEB-001

DEB-001 migrou para `<Modal>` do `@artificio/ui`, que chama `useEscapeClose()` internamente. Zero código adicional.

---

## DEB-003 — Token `--error` ausente (LinksSearch `text-red-400`)

- **Origem:** T9 · **Status:** resolvido · **Severidade:** Medium
- **Problema:** Tailwind `text-red-400` ≈ `#ec5a55` — contraste ~3.7:1 sobre `--page` (#f4f6fb), **falha WCAG AA** (< 4.5:1).

### Implementado (2026-06-22)

**Arquivo:** `LinksSearch.tsx:74` — 1 linha: `text-red-400` → `text-[var(--state-danger-fg)]`. Token `--state-danger-fg` do design system: `#b91c1c` (light, 8.2:1 AAA) / `#fca5a5` (dark, 6.1:1 AA).

**Smoke:** ✅ 16 páginas.

---

## DEB-004 — Inputs sem tratamento de estados visuais

- **Origem:** T9 · **Status:** resolvido · **Severidade:** Medium (ReportsSection) / Cosmetic (EditForm)

`@artificio/ui` já provê `.artificio-control[data-invalid]`/`:disabled`/`.field-error`. Criar classes paralelas seria duplicação. O débito real era migrar o `<select>` raw do AdminPanel.

### Implementado (2026-06-22)

**Arquivo:** `AdminPanel.tsx:665` — `<select style={{...}}>` com 7 props inline → `<Select value={filter} onChange={...}>` do design system. `<Select>` já estava importado.

**Smoke:** ✅ 16 páginas.

---

## DEB-005 — Spinner inline no LinksSearch

- **Origem:** T9 · **Status:** resolvido · **Severidade:** Cosmetic

Estado loading tinha texto estático ("Carregando grupos..."), sem animação nem `aria-busy`. `<LoadingState variant="inline">` do `@artificio/ui` já era usado em SuggestForm e AdminPanel.

### Implementado (2026-06-22)

**Arquivo:** `LinksSearch.tsx` — `<p>Carregando grupos...</p>` → `<LoadingState message="Carregando grupos..." variant="inline" />` + `import { LoadingState }`.

**Smoke:** ✅ 16 páginas.

---

## DEB-006 — Drawer mobile sidebar (UI §1.1)

- **Origem:** T30 · **Status:** resolvido · **Severidade:** Medium
- **Problema:** Mobile ≤760px: sidebar virava bloco estático no topo (~30-40% da tela). Sem drawer/hambúrguer. Após scroll, navegação inacessível.

### Implementado (2026-06-22)

**Arquivos:** `Sidebar.astro` (+50 linhas) + `global.css` (+78 linhas)

- Botão hambúrguer SVG (3-linhas, `position: fixed` top-left) + backdrop escuro + botão fechar (X SVG)
- Script inline: toggle, backdrop click, Escape key, fecha ao navegar (clique em `<a>`)
- Sidebar vira overlay off-canvas: `transform: translateX(-100%)` → slide in 0.2s, `z-index: 100`
- `aria-expanded`/`aria-hidden`/`aria-label` sincronizados
- Desktop (>760px) **inalterado** — toggle/backdrop/close `display: none`

**Smoke:** ✅ 16 páginas, 4.34s.

**Relações:** atenua DEB-010 (botão voltar ao topo — toggle sempre visível). DEB-007 (opção 2) poderia estender drawer para <1024px.

---

## DEB-007 — Breakpoint intermediário sidebar 900→220px (UI §7.1)

- **Origem:** T31 · **Status:** resolvido · **Severidade:** Medium
- **Problema:** Sidebar fixa 280px. Tablets 761-900px perdem ~35% da viewport. Header breakpoint = 860px (mismatch com sidebar 760px).

### Implementado (2026-06-22)

**Arquivo:** `global.css:60-64` — 4 linhas CSS:
```css
@media (min-width: 761px) and (max-width: 1024px) {
  .shell { grid-template-columns: 220px minmax(0, 1fr); }
}
```

| Viewport | Antes | Depois | Economia |
|----------|-------|--------|----------|
| 800px | 280px (35%) | 220px (27.5%) | 7.5pp |
| 900px | 280px (31%) | 220px (24.4%) | 6.6pp |
| 1024px | 280px (27%) | 220px (21.5%) | 5.5pp |

**Smoke:** ✅ 16 páginas, 4.26s.

---

## DEB-008 — Chips de categoria na busca (H7.3)

- **Origem:** T33 · **Status:** resolvido · **Severidade:** Cosmetic
- **Problema:** Busca textual sem filtro por categoria. API já suportava `?category=` (`server.ts:75`). Classe `.chip` já existia em `global.css`.

### Implementado (2026-06-22)

**Arquivo:** `LinksSearch.tsx` (+25 linhas)

- `CATEGORY_LABELS` (4 categorias), estado `selectedCategory: string | null` (null = "Todos")
- Chips `<button className="chip">` abaixo do input, reutilizando `.chip` + `.chip-active` existentes
- Filtro client-side combinado: categoria + texto (intersecção)
- Mensagem composta quando ambos os filtros ativos

**Smoke:** ✅ 17 páginas, 4.49s.

---

## DEB-009 — Página 404 customizada (H9.2)

- **Origem:** T35 · **Status:** resolvido · **Severidade:** Minor
- **Problema:** `server.ts:478-484` servia `dist/404.html` se existir, senão fallback `"404"` texto puro. `src/pages/404.astro` não existia.

### Implementado (2026-06-22)

**Arquivo:** `src/pages/404.astro` (novo, 33 linhas)

Layout `Base.astro` completo: `<html lang="pt-BR">`, meta SEO/OG, `noindex=true`, `PortalHeader` + `Sidebar` + `LinksSearch client:load` + footer. h1 "Página não encontrada" + link home.

**Smoke:** ✅ 17 páginas, 4.32s. Excluído do sitemap. Infra `server.ts:480` sem mudanças.

---

## DEB-010 — Botão "voltar ao topo" (H3.3)

- **Origem:** T36 · **Status:** resolvido · **Severidade:** Cosmetic
- **Problema:** Home com ~3000-6000px de scroll, sem botão de retorno ao topo. `scroll-behavior: smooth` já existia no `<html>`.

### Implementado (2026-06-22)

**Arquivos:** `global.css` (+33 linhas) + `Base.astro` (+22 linhas)

Botão flutuante (`position: fixed`, canto inferior direito, `z-index: 50`). SVG chevron-up. Oculto por padrão (`opacity: 0; translateY(16px)`), visível após `scrollY > 300` (classe `scroll-top--visible`). Click: `window.scrollTo({ top: 0, behavior: "smooth" })`. Scroll listener com `requestAnimationFrame`. `aria-label="Voltar ao topo"`.

**Smoke:** ✅ 17 páginas, 4.21s.

---

## DEB-011 — Transição CSS na troca de tema (UI §10.1)

- **Origem:** T37 · **Status:** resolvido · **Severidade:** Cosmetic
- **Problema:** Troca de `data-theme` instantânea — flash perceptível em ~10 tokens de cor.

### Implementado (2026-06-22)

**Arquivo:** `global.css:42-56` (+10 linhas)

```css
html {
  transition: background-color 0.2s ease, color 0.2s ease;
}
@media (prefers-reduced-motion: no-preference) {
  *, *::before, *::after {
    transition-property: background-color, border-color, color, fill, stroke;
    transition-duration: 0.15s;
    transition-timing-function: ease;
  }
}
```

`0.15s` no seletor universal minimiza latência em hover states. `prefers-reduced-motion` respeita WCAG 2.3.3.

**Smoke:** ✅ 17 páginas, 3.76s.

---

## DEB-012 — Accordion de regras (H8.3)

- **Origem:** T38 · **Status:** resolvido · **Severidade:** Cosmetic
- **Problema:** 7 seções de regras inline no `<main>` ocupavam ~40% do scroll vertical.

### Implementado (2026-06-22)

**Arquivos:** `index.astro` + `global.css:271-341`

**Opção escolhida:** Accordion no conteúdo principal (SEO preservado, `<details>` nativo).

- `<div class="regra">` → `<details class="regra">` com `<summary>` (7 seções)
- Cada regra ganhou card: `background: var(--surface); border; border-radius: 0.75rem`
- Chevron `›` rotaciona 90° no `[open]` (0.15s transition)
- `scroll-margin-top: 1rem` preservado (âncoras `#regra-*` funcionam)
- `<li>` trocados para `--surface-soft` (hierarquia dentro do card)

**Smoke:** ✅ 17 páginas, 4.17s.

---

## DEB-013 — Onboarding/banner boas-vindas (H10.1) ✅

- **Origem:** T39 · **Status:** resolvido (2026-06-22) · **Severidade:** Minor
- **Problema:** Visitante novo vê grade de grupos sem contexto. Lead de 1 frase (~200 caracteres). Sem explicação do que é o Artifício ou o que esperar ao entrar.

### Implementado (2026-06-22)

**Arquivos:** `index.astro` (+20 linhas) + `global.css` (+38 linhas)

**HTML (`index.astro:40-48`):**
- `<div class="onboarding-banner" id="onboarding-banner">` antes do `<h1>`
- Título: "Bem-vindo ao hub do Artifício RPG"
- Parágrafo: "Explore os grupos de WhatsApp da comunidade..." (2 frases)
- Botão: `<button class="onboarding-cta" id="onboarding-dismiss">Entendi</button>`

**Script inline (`index.astro:129-143`):**
- Lê `localStorage` key `artificio_onboarding_seen` — se `"1"`, retorna sem mostrar
- Adiciona classe `.onboarding-banner--visible` para exibir
- No clique "Entendi": remove a classe + grava `localStorage`

**CSS (`global.css`):**
- `.onboarding-banner`: `display: none` (padrão), `background: var(--surface-soft)`, `border: 1px solid var(--border)`, `border-radius: 12px`, `padding: 1.25rem`, `margin-bottom: 1.5rem`
- `.onboarding-banner--visible`: `display: block`
- `.onboarding-banner h2`: `font-size: 1.05rem`, `font-weight: 700`
- `.onboarding-banner p`: `font-size: 0.9rem`, `color: var(--muted)`, `max-width: 64ch`
- `.onboarding-cta`: `background: var(--brand)`, `color: #fff`, hover `var(--brand-deep)`, `transition: background-color 0.15s ease`

**Smoke:** ✅ 17 páginas, 4.19s. Banner + script confirmados em `dist/index.html`. Ausente em busca/admin (isolado à home).

---

## DEB-014 — Sidebar: âncoras locais quebram fora da home ✅

- **Origem:** REV-001 (coderabbit, PR #84) · **Task vinculada:** T8 · **Status:** resolvido (2026-06-22) · **Severidade:** Medium
- **Problema:** Sidebar usa `href="#cat-*"`, `href="#regra-*"`, `href="#comunidade"`. Esses IDs só existem na home (`index.astro`). Em `/busca/` e `/404.html`, os links não navegam para lugar algum.

### Implementado (2026-06-22)

**Arquivo:** `apps/links/src/components/Sidebar.astro` — 3 linhas, 3 caracteres cada.

| Linha | Antes | Depois |
|-------|-------|--------|
| 30 | `href={`#cat-${c.id}`}` | `href={`/#cat-${c.id}`}` |
| 34 | `href="#comunidade"` | `href="/#comunidade"` |
| 39 | `href={`#regra-${s.id}`}` | `href={`/#regra-${s.id}`}` |

**Comportamento:**
- Na home (`/`): `href="/#cat-xxx"` = mesmo path, hash diferente → navegação in-page sem reload
- Em `/busca/`: navega para `/#cat-xxx` → carrega home e scrolla para a âncora
- Em `/404.html`: navega para `/#cat-xxx` → carrega home e scrolla para a âncora

**Smoke:** ✅ 17 páginas, 3.59s. `/#cat-`, `/#comunidade`, `/#regra-` confirmados em `dist/index.html` e `dist/busca/index.html`.

### Evidência

**Páginas com Sidebar:**
| Página | Sidebar | IDs alvo (`#cat-*`, `#regra-*`, `#comunidade`) | Links funcionam? |
|--------|---------|------------------------------------------------|-------------------|
| `/` (index.astro) | ✅ | ✅ Presentes (3 cats + 7 regras + comunidade) | ✅ |
| `/busca/` (busca/index.astro:14) | ✅ | ❌ Ausentes | ❌ |
| `/404.html` (404.astro:19) | ✅ | ❌ Ausentes | ❌ |
| `/admin/` | ❌ | N/A | N/A |
| `/grupo/[slug]/` | ❌ | N/A | N/A |

**Links afetados por página (Sidebar.astro):**
- Linha 30: `href={`#cat-${c.id}`}` — 3 categorias (Do Artifício RPG, Temáticos, Parceiros)
- Linha 34: `href="#comunidade"` — "Grupos de RPG"
- Linha 39: `href={`#regra-${s.id}`}` — 7 seções (Proibido, Divulgação, Vendas, Off-topic, Etiqueta, Finais, Adicionais)
- Linha 46: `defaultNavItems` → links absolutos (artificiorpg.com, glossario., etc.) — ✅ funcionam em qualquer página

**IDs alvo na home (index.astro):**
- Linha 49: `id={`cat-${cat.id}`}` — gera `#cat-artificio`, `#cat-tematicos`, `#cat-parceiros`
- Linha 78: `id="comunidade"`
- Linha 101: `id={`regra-${s.id}`}` — gera `#regra-proibido`, ..., `#regra-adicionais`

**Cenários problemáticos:**
1. `/busca/` — usuário digita busca, não acha grupo, clica "Grupos do Artifício" na sidebar → nada acontece. Experiência confusa.
2. `/404.html` — usuário em URL inexistente, sidebar oferece links "Regras"/"Grupos" que levam a lugar nenhum. Agravado pelo estado de erro (usuário já perdido).

**`/busca/` com sidebar não é meramente decorativo** — o usuário pode chegar via URL direta, marcador, ou link externo. A sidebar deve prover navegação de volta à home com contexto (seção correta).

### Recomendação

Prefixar `href` com `/` em 3 locais do `Sidebar.astro`:

```diff
linha 30: href={`#cat-${c.id}`}       → href={`/#cat-${c.id}`}
linha 34: href="#comunidade"           → href="/#comunidade"
linha 39: href={`#regra-${s.id}`}     → href={`/#regra-${s.id}`}
```

**Por que funciona:**
- Na home (`/`): `href="/#cat-artificio"` = mesmo path + hash diferente → navegação in-page sem reload (comportamento padrão de navegadores)
- Em `/busca/`: navega para `/#cat-artificio` → carrega home e scrolla para a âncora
- Em `/404.html`: navega para `/#cat-artificio` → carrega home e scrolla para a âncora

**3 caracteres** (`/` antes de `#`), **3 linhas**, zero lógica condicional. Sem `Astro.url`, sem `basePath`, sem edge case com `<base>` (não usado no projeto).
