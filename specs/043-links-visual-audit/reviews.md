# 043 — Revisões de bots do PR #84

> **Propósito:** registrar e dar veredicto a CADA achado dos revisores automatizados (amazon-q-developer, chatgpt-codex-connector, coderabbit, Snyk, Sonar, CodeQL, github-advanced-security) no PR #84. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/043-links-visual-audit`
- PR: [#84](https://github.com/FarenRavirar/artificio/pull/84)
- Commits: `5b4f461` (T5), `8354af0` (T6-T8), `286c1ba` (T9-T10)
- Checks GitHub (`lint + build + test`): pendente
- Estado das revisões: **aberto** — aguardando bots

## Resumo do PR

**13 arquivos** — T5 (logo base64→asset, `packages/ui`), T6 (shimmer SSO, `packages/ui`), T7 (menu SVG, `packages/ui`), T8 (shell busca + Sidebar, `apps/links`), T9 (cores→tokens `LinksSearch`), T10 (trigger button + Desfazer `ReportButton`).

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|
| REV-001 | coderabbitai | Sidebar.astro:15,19,24 | Major | Sidebar usa âncoras locais `#...` — quebram fora da home (ex.: /busca/ sem os IDs) | aguardando | — | — |
| REV-002 | coderabbitai | ReportButton.tsx:100-104,+151-166 | 🟠 Major | Erro do undo não exibido ao usuário no estado `done`. `setError` chamado no catch do `onUndo`, mas o parágrafo de erro só existe no branch do formulário. | **já resolvido** | T10 refatorou o estado `done` em `<Modal>` próprio e adicionou renderização de `error` na linha 194. | Nenhuma. |
| REV-003 | coderabbitai | global.css:627-640 | 🟡 Minor | `.report-trigger` sem estilo `:focus-visible`. Usuários via teclado podem não perceber foco. | **descarta** | `.report-trigger` é `<button>` (ReportButton.tsx:120). O seletor `button:focus-visible` em global.css:618 já aplica `outline: 3px solid var(--brand-deep)`. Zero `outline: none` no stylesheet. Bot analisou só o diff (+627..+640), não o arquivo inteiro. | Nenhuma. |

## Code Smells (Sonar)

| # | Arquivo | Linha | Severidade | Achado | Veredicto | Justificativa |
|---|---|---|---|---|---|---|

## Veredictos (legenda)
- **procede** → aplicar fix via novo commit (autorização nominal própria) e referenciar o sha.
- **descarta** → falso-positivo/decisão de design; justificar por que não se aplica.
- **fora de escopo** → procede mas não pertence ao foco do PR. Investigar, registrar débito e resolver dentro da própria spec.

---

## REV-001 — Sidebar: âncoras locais quebram fora da home

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (comentário)
- **Referência:** `apps/links/src/components/Sidebar.astro:15,19,24` · [PR #84](https://github.com/FarenRavirar/artificio/pull/84)
- **Resumo:** A sidebar usa `href="#cat-${c.id}"`, `href="#comunidade"` e `href="#regra-${s.id}"`. Essas âncoras locais só funcionam quando os IDs dos elementos existem na página atual. Em `/busca/`, `/admin/` ou `/grupo/[slug]/`, esses IDs não estão presentes → links da sidebar ficam quebrados (clicam mas não navegam para lugar algum). O coderabbit sugere tornar o prefixo de rota configurável (ex.: `basePath`) e montar links como `/${...}#id` quando o componente for usado fora da home.
- **Severidade declarada:** Major (🟠) · Quick win
- **Status:** aguardando investigação
- **Task vinculada:** T8 (shell busca + Sidebar)
- **Débito vinculado:** —

---

## REV-002 — ReportButton: erro do undo não renderizado no estado `done`

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (comentário)
- **Referência:** `apps/links/src/components/ReportButton.tsx:100-104,151-166` · [PR #84](https://github.com/FarenRavirar/artificio/pull/84)
- **Resumo:** Quando `onUndo` falha (linha 101), `setError("Não foi possível desfazer.")` é chamado, mas no estado `done` (linhas 151-166) não há renderização do `error`. O parágrafo de erro só existe no branch do formulário (linhas 218-222). O usuário fica sem feedback visual de que o undo falhou.
- **Severidade declarada:** 🟠 Major · Quick win
- **Status:** já resolvido (T10)
- **Task vinculada:** T10 (trigger button + Desfazer `ReportButton`)
- **Débito vinculado:** —

**Investigação (2026-06-22):**

O código do `ReportButton.tsx` foi significativamente refatorado pelo T10 do PR #84 (commit `286c1ba`). O estado `done` agora é um `<Modal>` separado (linhas 176-199), não mais um branch condicional dentro do mesmo modal. A linha 194 renderiza `error` condicionalmente:

```tsx
<span className="artificio-modal-description">
  {error
    ? error
    : "Obrigado! A moderação vai analisar."
  }
</span>
```

Fluxo no undo com falha:
1. `setError(null)` no início de `onUndo` (linha 90)
2. DELETE falha → catch dispara `setError("Não foi possível desfazer.")` (linha 103)
3. Modal `done` continua aberto (`open && done === true`)
4. `<span>` da linha 194 re-renderiza com `error` → exibe "Não foi possível desfazer."

**Conclusão:** O bug apontado pelo CodeRabbit foi corrigido pela refatoração do T10, que separou os modais e adicionou renderização de erro em ambos os estados. Nenhuma ação necessária.

---

## REV-003 — global.css: `:focus-visible` ausente em `.report-trigger`

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (comentário)
- **Referência:** `apps/links/src/styles/global.css:627-640` · [PR #84](https://github.com/FarenRavirar/artificio/pull/84)
- **Resumo:** O botão `.report-trigger` não possui estilo de foco visível. Usuários navegando via teclado podem não perceber quando o elemento está focado. Conforme Nielsen H10 e WCAG 2.4.7, indicadores de foco devem ser visíveis. Sugestão: adicionar `.report-trigger:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }`.
- **Severidade declarada:** 🟡 Minor · Quick win
- **Status:** descarta (falso positivo)
- **Task vinculada:** T10 (trigger button + Desfazer `ReportButton`)
- **Débito vinculado:** —

**Investigação (2026-06-22):**

O `.report-trigger` é um elemento `<button>` (`ReportButton.tsx:120`). O seletor `button:focus-visible` em `global.css:618` já aplica `outline: 3px solid var(--brand-deep); outline-offset: 2px` a TODOS os botões da página — incluindo `.report-trigger`.

Evidências:
- `button:focus-visible` na lista de seletores das linhas 614-621 — cobre botões
- Única definição de `outline` no arquivo inteiro (linha 622) — sem `outline: none` concorrente
- `appearance: none` ausente em todo o stylesheet — sem reset que remova foco nativo
- O `border: 0` em `.report-trigger` (linha 632) afeta `border`, não `outline` — o anel de foco renderiza fora da border box

O CodeRabbit analisou apenas as linhas do diff (`+627..+640`) e não enxergou a regra `button:focus-visible` pré-existente na linha 618, que já cobre o elemento.

**Conclusão:** Falso positivo. O foco via teclado já é visível. Nenhuma ação necessária.

---

## Critério de encerramento (gate de merge)
- [ ] Todos os achados com veredicto registrado.
- [ ] Todos os "procede" aplicados (commits referenciados) e checks verdes de novo.
- [ ] Mantenedor autorizou o merge nominalmente.
