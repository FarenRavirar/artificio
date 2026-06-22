# 043 — Revisões de bots do PR #84

> **Docs irmãos:** `tasks.md` · `debitos.md` · `spec.md`
> **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI.

---

## Status do PR

- **Branch:** `feat/043-links-visual-audit`
- **PR:** [#84](https://github.com/FarenRavirar/artificio/pull/84)
- **Commits:** `5b4f461` (T5), `8354af0` (T6-T8), `286c1ba` (T9-T10) + commits posteriores (DEB-001 a DEB-013)
- **Estado:** aberto — todos os 6 reviews resolvidos (aplicados / descartados / débitos fechados)

---

## Achados

| # | Bot | Arquivo:linha | Severidade | Achado | Veredicto | Débito |
|---|---|---|---|---|---|---|
| REV-001 | coderabbit | Sidebar.astro:15,19,24 | 🟠 Major | Âncoras locais `#cat-*`/`#regra-*` quebram fora da home (/busca/, /admin/, /grupo/) | **aplicado** → `href="/#..."` | DEB-014 ✅ |
| REV-002 | coderabbit | ReportButton.tsx:100-104 | 🟠 Major | Erro do undo não renderizado no estado `done` | **já resolvido** (T10) | — |
| REV-003 | coderabbit | global.css:627-640 | 🟡 Minor | `.report-trigger` sem `:focus-visible` | **descarta** (falso positivo) | — |
| REV-004 | coderabbit | global.css:510,565 | 🟡 Minor | `"Arial Narrow"` sem `@font-face`/@import | **aplicado** → `var(--artificio-font-display)` | — |
| REV-005 | coderabbit | global.css:650 | 🟡 Minor | `clip: rect(0,0,0,0)` depreciado | **aplicado** → `clip-path: inset(50%)` | — |
| REV-006 | amazon-q | ReportButton.tsx:194 | 🟢 Low | Ternário `error ? error : default` → `??` | **aplicado** → `error ?? "Obrigado!..."` | — |

---

## Detalhamento

### REV-001 — Sidebar: âncoras locais quebram fora da home 🟠 ✅

- **Origem:** coderabbitai · PR #84
- **Status:** resolvido (2026-06-22) · Débito: **DEB-014** (detalhes em `debitos.md`)
- **Task vinculada:** T8 (shell busca + Sidebar)
- **Páginas afetadas:** `/busca/` + `/404.html` — sidebar com 11 links quebrados (3 categorias + 1 comunidade + 7 regras). `/admin/` e `/grupo/[slug]/` não usam Sidebar (não afetados).
- **Correção aplicada:** prefixo `/` em 3 `href` do `Sidebar.astro` — `#cat-*` → `/#cat-*`, `#comunidade` → `/#comunidade`, `#regra-*` → `/#regra-*`. 3 caracteres, 3 linhas. Zero lógica condicional. Build ✅ 17 páginas, 3.59s. `/#cat-`, `/#comunidade`, `/#regra-` confirmados em `dist/index.html` e `dist/busca/index.html`.

### REV-002 — ReportButton: erro do undo sem renderização ✅

- **Status:** já resolvido pelo T10 — refatoração separou modais e adicionou renderização de `error` no estado `done` (linha 194)

### REV-003 — `.report-trigger` sem `:focus-visible` ❌

- **Status:** descarta (falso positivo) — `button:focus-visible` em `global.css:618` já cobre todos os botões incluindo `.report-trigger`. CodeRabbit analisou só o diff, não o arquivo inteiro.

### REV-004 — `"Arial Narrow"` sem carregamento ✅

- **Status:** aplicado — `global.css:510,565` → `font-family: var(--artificio-font-display)`. Token já definido em `packages/ui/src/styles.css:41`. Build ✅.

### REV-005 — `clip: rect()` depreciado ✅

- **Status:** aplicado — `global.css:650` → `clip-path: inset(50%)`. Build ✅.

### REV-006 — Ternário → `??` ✅

- **Status:** aplicado — `ReportButton.tsx:194` → `error ?? "Obrigado! A moderação vai analisar."`. `error` é `string | null`, nunca `""`. Build ✅.

---

## Gate de merge

- [x] Todos os achados com veredicto registrado (REV-001 a REV-006)
- [x] REV-001 → DEB-014 resolvido (`Sidebar.astro` prefixo `/`)
- [ ] Mantenedor autorizou merge nominalmente
