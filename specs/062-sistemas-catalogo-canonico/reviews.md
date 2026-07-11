# Reviews — Spec 062

> Reviews externas: bots (CodeRabbit, Codex, Amazon Q, Sonar), PRs, mantenedor.
> Achados internos (lint, build, investigação) → `debitos.md`.

## PR #143 — I0a/I0b unificação frontend (2026-07-10)

**Escopo:** `useSystemsCatalog.ts`, `SystemPicker.tsx`, migração de 7 telas, `SystemSuggestionModal.tsx`, `CatalogoPage.tsx`, `DraftEditorTab.tsx`.

**Revisores:** CodeRabbit, Codex, Amazon Q, Sonar.

### Achados aplicados

1. **Contadores como string:** `children_count`/`tables_count`/`aliases_count` serializados como `int8` pelo `pg` → `z.coerce.number()` no schema Zod de `useSystemsCatalog.ts`. Teste cobre payload com contadores string.
2. **forceRefresh rejection não tratada:** `forceRefresh()` não relança erro após gravar `state.error`, evitando rejection não tratada em retry de UI.
3. **Tipo de erro:** payload inesperado agora usa `TypeError` em vez de `Error` genérico.
4. **aria-label no input de busca:** `SystemPicker` recebeu `aria-label={searchPlaceholder}`.
5. **Props Readonly:** props do `SystemPicker` marcadas como `Readonly`.
6. **Ternário aninhado:** lógica de expandir/recolher extraída para função separada.
7. **Bloco duplicado CatalogoPage:** loading/erro/SystemPicker de desktop/mobile extraídos para `CatalogSystemFilter` local.
8. **Prefill de busca no editor de draft:** termo digitado no `SystemPicker` propagado para `SystemSuggestionModal.initialName`.

### Achados não aplicados (com justificativa)

Nenhum.

## PR #144 — I6 administração contextual (2026-07-10)

**Escopo:** `SystemSuggestionModal.tsx` — admin cria nó central com aliases, Logo, Website Oficial pelo fluxo contextual do Mesas.

**Revisor:** Mantenedor.

### Achado

Fluxo de sugestão no editor de draft Discord é contraprodutivo para admin: permite criar só nome/nome PT/descrição/tipo/pai, sem aliases, URL oficial, logo, nem edição/variante encadeada. Admin precisa sair para `site-admin` pra completar.

### Decisão

Rota 1 adotada (I6): ampliar `SystemSuggestionModal.tsx` com campos que o backend já aceita (`aliases`, `logo_filename`, `website_url`). Sem duplicar lógica de API (já central). Criação encadeada admin direta (sistema→edição→variante) fica como gap de menor prioridade.
