# 043 — Revisões de bots do PR #84

> **Docs irmãos:** `tasks.md` · `debitos.md` · `spec.md`
> **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI.

---

## Status do PR

- **Branch:** `feat/043-links-visual-audit`
- **PR:** [#84](https://github.com/FarenRavirar/artificio/pull/84)
- **Commits:** `5b4f461` (T5), `8354af0` (T6-T8), `286c1ba` (T9-T10) + commits posteriores (DEB-001 a DEB-013)
- **Estado:** aberto — 9 reviews (REV-001 a REV-009 todos resolvidos)

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
| REV-007 | coderabbit | CommunityGroups.tsx:34-36 | 🟠→🟡 Minor | `catch { /* noop */ }` no `hideAdult` — erro silencioso | **aplicado** → `console.error` no par L30+L35 | — |
| REV-008 | coderabbit | Base.astro:109-111 | 🟡 Minor | `scrollTo({ behavior: "smooth" })` ignora `prefers-reduced-motion` | **aplicado** → JS `matchMedia` + CSS `@media reduce` | — |
| REV-009 | coderabbit | index.astro:132-135 | 🟡 Minor | Onboarding `catch (_) { return }` aborta banner se localStorage falhar | **aplicado** → `var seen` com fallback seguro | — |

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

### REV-007 — CommunityGroups: catch silencioso no hideAdult 🟠 → 🟡

- **Origem:** coderabbitai · PR #84
- **Tipo:** comentário
- **Referência:** `apps/links/src/components/CommunityGroups.tsx:34-36`
- **Resumo:** O bloco `catch { /* noop */ }` em `hideAdult` descarta erro de `localStorage.removeItem`, dificultando rastrear falhas reais de persistência. O coderabbit sugere registrar o erro com `console.error` com contexto em vez de suprimir silenciosamente.
- **Severidade declarada:** 🟠 Major
- **Severidade real:** 🟡 Minor
- **Status:** aplicado
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —

**Investigação (2026-06-22):**

- **Código alvo:** `CommunityGroups.tsx:34-36`
  ```ts
  const hideAdult = useCallback(() => {
    try { localStorage.removeItem("artificio_adult_gate"); } catch { /* noop */ }
    setAdultGate(false);
  }, []);
  ```

- **Função irmã idêntica (não flagada pelo revisor):** `confirmAdult` — `CommunityGroups.tsx:29-31`
  ```ts
  const confirmAdult = useCallback(() => {
    try { localStorage.setItem("artificio_adult_gate", "1"); } catch { /* noop */ }
    setAdultGate(true);
  }, []);
  ```

- **Impacto real de falha:** se `removeItem` lançar exceção:
  - `setAdultGate(false)` **ainda executa** (fora do try) → UI esconde conteúdo +18 corretamente
  - Único efeito colateral: flag `artificio_adult_gate` persiste em localStorage → gate adulto reaparece na **próxima visita** (mesma sessão ou nova)
  - Mesmo impacto no par `confirmAdult`: conteúdo aparece na sessão atual, mas gate reaparece na próxima visita

- **Projeto:** `catch {}` silencioso é **convenção do monorepo**, não exceção. 21 ocorrências em `apps/links/**` e `packages/**` (`SuggestForm.tsx`, `ReportButton.tsx`, `AdminPanel.tsx`, `packages/auth/src/client.ts`, `packages/ui/src/theme.tsx`).
- **AGENTS.md citado incorretamente:** a regra "Nunca mascarar erro" (§Erros que não podem se repetir) é sobre silenciar check de qualidade (`eslint-disable`, `@ts-ignore`, `continue-on-error`, `.skip`, `xfail`, flag advisory), não sobre runtime `catch` vazio. O catch aqui é decisão consciente de fallback silencioso para operação não-crítica de storage.
- **Cenários de falha do localStorage:** `SecurityError` (iframes cross-origin, storage bloqueado), `QuotaExceededError` (não se aplica a `removeItem`), ou `TypeError` em SSR. Todos raros e não-críticos para esta funcionalidade.

**Conclusão:** **Procede parcialmente.** O apontamento é tecnicamente correto (catch silencioso é antipattern), mas:
1. Severidade real é 🟡 Minor, não 🟠 Major — sem crash, sem perda de dados, sem segurança
2. Se aplicar, aplicar no par `confirmAdult` (L30) também, por consistência
3. Aplicar `console.error` como quick win é razoável, mas não muda comportamento do usuário

**Recomendação:** Quick win opcional — adicionar `console.error` com contexto em ambos `hideAdult` e `confirmAdult`. Não justifica débito próprio.

**Implementação (2026-06-22):** `console.error` com contexto em `confirmAdult` L30 e `hideAdult` L35. Build ✅ 17p, 6.35s.

### REV-008 — Base.astro: prefers-reduced-motion no scroll-to-top (JS) 🟡

- **Origem:** coderabbitai · PR #84
- **Tipo:** comentário
- **Referência:** `apps/links/src/layouts/Base.astro:109-111`
- **Resumo:** O clique de "voltar ao topo" usa `behavior: "smooth"` sempre. Para usuários com `prefers-reduced-motion: reduce`, o coderabbit sugere usar `"auto"` em vez de `"smooth"`.
- **Severidade declarada:** 🟡 Minor
- **Severidade real:** 🟡 Minor
- **Status:** aplicado
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —

**Investigação (2026-06-22):**

- **Código alvo:** `Base.astro:109-111`
  ```js
  btn.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  ```

- **Contexto CSS (não flagado):**
  - `global.css:36`: `html { scroll-behavior: smooth }` — smooth scrolling global, **sem** override para `prefers-reduced-motion: reduce`
  - `global.css:43-53`: `@media (prefers-reduced-motion: no-preference)` existente — mas cobre apenas `transition`, não `scroll-behavior`
  - `window.scrollTo({ behavior: "smooth" })` **sobrescreve** o CSS — mesmo que CSS fosse corrigido, este JS ainda forçaria smooth

- **Proteção parcial por browser:**
  - Firefox e Safari **respeitam** `prefers-reduced-motion` internamente e desabilitam smooth scroll automaticamente → usuários protegidos
  - Chrome/Edge **não** fazem isso — `behavior: "smooth"` é honrado mesmo com `reduce` → usuários **não** protegidos

- **WCAG:** SC 2.3.3 Animation from Interactions (Level AAA). Baixo custo de implementação, benefício claro para acessibilidade.

- **Escopo ampliado:** o CSS `html { scroll-behavior: smooth }` em `global.css:36` tem o mesmo problema e não foi flagado. Se implementar o JS, recomenda-se corrigir o CSS também (débito separado ou no mesmo quick win).

**Conclusão:** **Procede.** Quick win de 2 linhas com benefício real de acessibilidade. CSS complementar (`global.css:36`) é débito adicional de mesma natureza.

**Recomendação:** Aplicar a sugestão do coderabbit (JS). Opcional: adicionar override CSS `scroll-behavior: auto` para `prefers-reduced-motion: reduce` em `global.css`.

**Implementação (2026-06-22):** JS: `matchMedia("(prefers-reduced-motion: reduce)")` condicional em `Base.astro:110`. CSS: `@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto } }` em `global.css:43`. Build ✅ 17p, 6.15s. Ambos confirmados no dist.

### REV-009 — index.astro: onboarding bloqueado se localStorage falhar 🟡

- **Origem:** coderabbitai · PR #84
- **Tipo:** comentário
- **Referência:** `apps/links/src/pages/index.astro:132-135`
- **Resumo:** Se `localStorage.getItem` lançar exceção, o `return` no catch impede a exibição do banner de onboarding para usuários que bloqueiam storage. O coderabbit sugere fallback mais seguro: tratar falha como "não visto" e exibir o banner.
- **Severidade declarada:** 🟡 Minor
- **Severidade real:** 🟡 Minor
- **Status:** aplicado
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —

**Investigação (2026-06-22):**

- **Código alvo:** `index.astro:129-143` (inline script no final da página)
  ```js
  (function () {
    if (typeof window === "undefined") return;
    try {
      if (localStorage.getItem("artificio_onboarding_seen") === "1") return;
    } catch (_) { return; }  // ← L134: ABORTA o script inteiro
    // ... banner + dismiss nunca executam se o catch disparar
  })();
  ```

- **Fluxo com falha de localStorage:**
  1. `typeof window === "undefined"` → false (browser real) → passa
  2. `localStorage.getItem(...)` lança `SecurityError` (storage bloqueado/iframe cross-origin)
  3. `catch (_) { return; }` → **sai da IIFE inteira**
  4. Banner **nunca** exibido, dismiss **nunca** attachado
  5. Usuário perde o onboarding (mensagem de orientação + link para `artificiorpg.com`)

- **Padrão correto (já existe no projeto):** `CommunityGroups.tsx:26`
  ```ts
  const [adultGate, setAdultGate] = useState(() => {
    try { return localStorage.getItem("artificio_adult_gate") === "1"; } catch { return false; }
  });
  ```
  Trata falha como default seguro: "gate não visto" → mostra o modal. O onboarding deveria seguir o mesmo princípio: falha = "não visto" → mostrar banner.

- **Dismiss handler (L141):** `try { localStorage.setItem(...); } catch (_) {}` — **correto**. Fire-and-forget silencioso é aceitável para escrita de preferência não-crítica.

- **Comparação com REV-007:** mesmo domínio (localStorage + catch), mas aqui o catch tem **comportamento errado** (`return` aborta), não só silencioso — é um bug lógico, não cosmético.

**Conclusão:** **Procede.** Bug real: `catch { return }` transforma erro de storage em ausência completa de onboarding. O projeto já tem o padrão correto em `CommunityGroups.tsx:26`. 

**Recomendação:** Aplicar sugestão do coderabbit — substituir `catch (_) { return; }` por fallback `{ var seen = false; try { seen = ... } catch {}; if (seen) return; }`.

**Implementação (2026-06-22):** `var seen = false; try { seen = ... } catch {}; if (seen) return;` em `index.astro:132-134`. Build ✅ 17p, 6.28s. `var seen = false` confirmado no dist.

---

## Gate de merge

- [x] REV-001 a REV-006: veredicto registrado
- [x] REV-001 → DEB-014 resolvido (`Sidebar.astro` prefixo `/`)
- [x] REV-007, REV-008, REV-009: aplicados ✅
- [ ] Mantenedor autorizou merge nominalmente
