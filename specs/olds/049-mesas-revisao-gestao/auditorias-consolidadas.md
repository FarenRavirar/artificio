# Auditorias Consolidadas — /gestao

> Compilado das 4 auditorias: Nielsen Heuristics, UI Design Review, WCAG Accessibility, UX Audit & Rethink

## Matriz de Sobreposição

| Issue | Nielsen | UI Design | WCAG | UX Audit |
|-------|---------|-----------|------|----------|
| Modal sem acessibilidade (Escape, trap, role) | H3 (sev 2) | ✅ | ✅ Critical | ✅ |
| window.confirm() vs inline UI misturados | H4 (sev 3) | — | — | ✅ Critical |
| Sem guarda de saída no editor dirty | H5 (sev 3) | — | — | ✅ Critical |
| Sync irreversível sem rollback | H3 (sev 3) | — | — | ✅ |
| 3 estilos de tabs diferentes | H4 (sev 2) | ✅ | ✅ Serious (ARIA) | ✅ |
| Zero uso do design system packages/ui | H8 (sev 2) | ✅ 0/10 | — | ✅ |
| Fonte 12px (text-xs) abaixo do mínimo | H8 (sev 2) | ✅ | — | ✅ |
| Acento blue-600 em vez de laranja D064 | H4 (sev 2) | ✅ | — | ✅ |
| Sem headings/landmarks | H4 (sev 2) | ✅ | ✅ Serious | ✅ |
| Sem focus indicators | — | ✅ | ✅ Critical | ✅ |
| Sem labels em formulários | — | — | ✅ Serious | ✅ |
| Font display Oswald não usada | — | ✅ | — | — |
| Painel de métricas nunca usado | H7 (sev 1) | — | — | ✅ |
| Estados vazios inconsistentes | H4 (sev 2) | ✅ | — | ✅ |
| Loading states inconsistentes | H1 (sev 2) | — | — | ✅ |
| Erro não anunciado para leitores de tela | H9 (sev 2) | — | ✅ Critical | — |
| Tabela de drafts sem ordenação | H4 (sev 1) | — | — | ✅ |
| Navegação automática desorientadora | H3 (sev 2) | — | — | ✅ Critical |
| Sem aria-label em ícones | — | — | ✅ Minor | — |

## Issues P0 (Catastrófico)

Nenhuma issue P0 foi encontrada. Nenhum fluxo está completamente quebrado ou causa perda de dados irreversível sem confirmação.

## Issues P1 (Alto) — 8 issues

| # | Issue | Fontes | Impacto |
|---|-------|--------|---------|
| P1-1 | Modal de preview sem Escape/trap/role | WCAG Critical + Nielsen H3 | Bloqueia usuário de teclado |
| P1-2 | checkbox/cell em <td> sem label associado | WCAG Serious + UX | Leitores não identificam ação |
| P1-3 | Sem focus indicators visíveis | WCAG Critical + UI Design | Navegação teclado impossível |
| P1-4 | Dirty state do editor perdido ao fechar | Nielsen H5 + UX Critical | Perda de trabalho não salvo |
| P1-5 | window.confirm() inconsistente com inline confirmation | Nielsen H4 + UX Critical | Usuário confunde destrutivo |
| P1-6 | Navegação automática entre abas após ação | UX Critical + Nielsen H3 | Desorientação do usuário |
| P1-7 | Zero uso do design system (Button, Badge, etc.) | UI Design 0/10 + Nielsen H8 | Inconsistência visual severa |
| P1-8 | Erro não anunciado para leitores de tela | WCAG Critical + Nielsen H9 | Barreira de acessibilidade |

## Issues P2 (Médio) — 17 issues

| # | Issue | Fontes |
|---|-------|--------|
| P2-1 | 3 estilos de tabs diferentes | Nielsen H4 + UI Design + WCAG |
| P2-2 | Fonte 12px (text-xs) abaixo do mínimo | Nielsen H8 + UI Design |
| P2-3 | Acento blue-600 em vez de laranja D064 | Nielsen H4 + UI Design |
| P2-4 | Sem headings/landmarks | Nielsen H4 + UI Design + WCAG |
| P2-5 | Estados vazios inconsistentes | Nielsen H4 + UI Design + UX |
| P2-6 | Loading states inconsistentes | Nielsen H1 + UX |
| P2-7 | Painel de métricas nunca usado | Nielsen H7 + UX |
| P2-8 | Tabela de drafts sem ordenação | Nielsen H4 + UX |
| P2-9 | Sync irreversível sem rollback | Nielsen H3 + UX |
| P2-10 | Modal implementado do zero sem acessibilidade | UI Design + WCAG |
| P2-11 | Font display Oswald não usada | UI Design |
| P2-12 | Erro de validação exibido como toast em vez de inline | Nielsen H9 |
| P2-13 | Grid de resultados sem contraste de borda suficiente | WCAG Moderate |
| P2-14 | Target size de 24x24px em alguns botões de ação | WCAG Moderate |
| P2-15 | Campo de mensagens sem label | WCAG Serious |
| P2-16 | Duplicação de handlers drafts em 2 arquivos diferentes | UX |
| P2-17 | Navegação inconsistente entre /gestao e /painel | Nielsen H4 |

## Issues P3 (Baixo) — 27 issues

Detalhes nos relatórios individuais. Categorias:
- Cosmético: padding/margin inconsistente, cores não exatas do design system
- Tipografia: font-size em rem vs px misturado
- Iconografia: ícones sem aria-label
- Cores de status definidas inline em vez do tema
- Botão de fechar sem `aria-label="Fechar"`
- Sem atributo `lang` em porções traduzidas
- Falta de `role="alert"` em mensagens de erro
- Tempo de debounce do preview poderia ser configurável

## Recomendações Priorizadas (impacto x esforço)

| Prioridade | Tarefa | Esforço | Impacto | Issues resolvidas |
|------------|--------|---------|---------|-------------------|
| 🔴 Imediata | Adicionar focus visível + aria-labels + role modal | 2h | Alto | P1-1, P1-2, P1-3, P1-8 |
| 🔴 Imediata | Guarda de saída no editor de draft com dirty | 1h | Alto | P1-4 |
| 🔴 Imediata | Unificar confirmações destrutivas (componente ConfirmDialog) | 2h | Alto | P1-5 |
| 🟡 Alta | Substituir componentes por primitives do packages/ui | 8h | Alto | P1-7, P2-1, P2-3, P2-5, P2-6, P2-10, P2-11 |
| 🟡 Alta | Adicionar headings e landmarks semânticos | 2h | Médio | P2-4 |
| 🟡 Alta | Unificar estilos de tabs | 3h | Médio | P2-1 |
| 🟢 Média | Aumentar font-size para 14px (text-sm) mínimo | 1h | Médio | P2-2 |
| 🟢 Média | Adicionar ordenação na tabela de drafts | 4h | Médio | P2-8 |
| 🟢 Média | Adicionar role="alert" em erros | 0.5h | Médio | P2-12 |
| 🔵 Baixa | Remover painel de métricas não usado | 1h | Baixo | P2-7 |
| 🔵 Baixa | Ajustes cosméticos de padding/margin | 2h | Baixo | P3 |
| 🔵 Baixa | Adicionar aria-label em ícones | 1h | Baixo | P3 |
