# Sessão 26-11-07_2 — Mesas: feedback ao adicionar sistema

## Objetivo

Investigar dois defeitos relatados no editor de mesa: a validação não leva o usuário ao erro e a ação “Sugerir sistema” não permite concluir a sugestão. Propor uma correção baseada no fluxo real, nas capturas fornecidas, na produção e nas convenções de acessibilidade e usabilidade aplicáveis.

## Evidências de entrada

- Relato de usuário recebido em 2026-11-07: ao clicar em “Adicionar sistema”, “não acontece nada”; depois percebeu que o formulário apareceu no topo da página, mas a página não subiu.
- Capturas fornecidas: `.tmp/51eb3470-c77e-423b-bb6e-62d48a49e2f8.jpg` e `.tmp/a79c5974-c60c-403f-a8f1-d2c1b18be132.jpg`.
- Busca inicial: o acionador “Adicionar sistema” está em `packages/catalog-ui/src/CatalogTree.tsx`; o formulário de sugestão está em `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx`.

## Diagnóstico medido

### 1. O erro existe, mas o foco e a rolagem falham no campo Sistema

`TableEditor.tsx:203-210` tenta focar o primeiro erro com `document.getElementById(target)?.focus()`. Para o erro `selectedSystemId`, o alvo procurado é `id="selectedSystemId"`. O seletor composto não cria esse id: `IdentityPart.tsx:285-299` usa `idPrefix="table-editor-system"`, e `CatalogSystemSelector.tsx:447-448` produz `id="table-editor-system-system-search"`. A busca dos ids no seletor confirmou essa divergência.

Resultado: a validação troca para a parte Identidade, mas o `focus()` usa um alvo inexistente. Sem foco, o contêiner `.table-editor-document` não rola até “Sistema da mesa”. A mensagem inline fica fora da viewport e o usuário só percebe os avisos já visíveis no topo. O teste A4 existente usa `slotsOpen`, um input cujo id coincide com o campo, portanto não cobre controles compostos.

Severidade Nielsen: 3, major; viola H1 (visibilidade de estado) e H9 (diagnóstico e recuperação). Evidência estática de WCAG 2.2: o fluxo não atende ao comportamento esperado por 3.3.1 (identificar o item com erro) nem 2.4.11 (foco não oculto), porque nenhum controle recebe foco.

### 2. O modal de sugestão abre atrás do editor

`SystemSuggestionModal.tsx:269-272` cria um portal em `document.body`, mas o overlay usa `z-50`. `TableEditor.css:36-56` posiciona o editor em `z-index: 60`. O próprio contrato de camadas documentado nesse CSS reserva `100` para modal/drawer; `packages/ui/src/styles.css:1800-1804` confirma `.artificio-modal-root { z-index: 100; }`.

O histórico confirma a regressão: o modal usa `z-50` desde `be7fafd` (2026-06-29); o editor subiu para `z-index: 60` em `e9a89c1` (2026-08-27). Desde então, o clique muda o estado e monta o portal, mas o editor cobre o modal.

Logs read-only da API de produção, no intervalo do relato, registraram `POST /api/v1/gm/parse-preview` às 22:03:23Z e buscas de sistema até `search="melt"` às 22:04:30Z. A busca por `system-suggestions` encontrou somente três chamadas administrativas posteriores; encontrou zero `POST /api/v1/system-suggestions` do usuário. Portanto a falha ocorre antes da API. A mesma sessão realizou ações autenticadas, refutando falta de login como causa deste caso.

Severidade Nielsen: 4, catastrófica; a tarefa não pode ser concluída e o sistema não mostra feedback, violando H1, H3 e H4. O modal próprio também não implementa `role="dialog"`, `aria-modal`, foco inicial, contenção de foco, Escape nem restauração de foco. O padrão oficial WAI-ARIA exige esses comportamentos para diálogo modal.

### Cobertura existente

O comando de teste executou 100 arquivos e 1.281 testes, todos verdes. `suggestionModals.test.tsx` cobre somente usuário autenticado e POST bem-sucedido; `ParserSignalsPanel.test.tsx` prova apenas que o callback é chamado; `TableEditor.test.tsx` mede a escala do modal compartilhado, não o `z-50` do modal próprio. O verde atual não exercita os dois defeitos.

## Correção aplicada

1. `SystemSuggestionModal` passou a usar o `Modal` de `@artificio/ui`, ainda dentro de um portal em `document.body`. O formulário, os payloads e os endpoints permaneceram iguais. A casca agora usa a camada canônica `.artificio-modal-root`, com `z-index: 100`, acima do editor em `z-index: 60`.
2. O `Modal` compartilhado passou a usar o `useFocusTrap` que já atendia o `Drawer`. Ao abrir, ele preserva um `autoFocus` definido pelo consumidor ou foca o primeiro controle visível; controles ocultos, desabilitados e fora da ordem de tabulação não viram limites; foco externo é recapturado; `Escape` fecha; o foco retorna ao acionador. A alteração em `packages/ui` foi autorizada nominalmente pelo mantenedor nesta sessão.
3. O foco do primeiro erro no `TableEditor` agora tenta o id direto e, para controles compostos, procura o wrapper de validação `[data-field]` e seu primeiro controle operável. `IdentityPart` liga os rótulos aos ids reais de sistema, descrição e regras; o erro de descrição chega ao `textarea`, não à aba “Escrever”.
4. As regressões cobrem foco no seletor composto e no `ContentEditor` real, preservação de `autoFocus` no rascunho, contenção e restauração de foco, controles ocultos, fechamento por `Escape`, contrato numérico das camadas e exatamente um `POST` para o caminho `/api/v1/system-suggestions`.

O backend, o contrato da API e `packages/catalog-ui` não mudaram.

## Validação

- `rtk pnpm test` em `packages/ui`: 26 arquivos e 152 testes verdes.
- Testes focados do Mesas: 2 arquivos e 40 testes verdes.
- `rtk pnpm exec tsc -b` reproduziu a falha do CI em `suggestionModals.test.tsx:99`; depois da correção terminou com exit code 0.
- `lint` e `build` passaram em `packages/ui` e `apps/mesas/frontend`.
- O build de `apps/links`, outro consumidor medido de `Modal`, gerou 17 páginas.
- `rtk pnpm verify:api` encontrou 607 rotas, terminou com exit code 0 e registrou zero breaking changes.
- A auditoria dirigida pelas 10 heurísticas de Nielsen não encontrou nova regressão no fluxo. A correção resolve H1, H3, H4 e H9; as demais heurísticas não mudaram.
- A prova estática e os testes cobrem WCAG 2.2 2.1.1, 2.4.3, 2.4.11 e 3.3.1 no trecho alterado. Não foram executados smoke autenticado em navegador nem teste manual com leitor de tela.

## Escopo

Correção do feedback de validação e do fluxo de sugestão de sistema no editor de mesas, incluindo o contrato de foco do `Modal` compartilhado. Sem mudança de produto, backend ou API.

## Estado atual

Concluída: os dois comportamentos foram corrigidos e os gates registrados acima passaram.
