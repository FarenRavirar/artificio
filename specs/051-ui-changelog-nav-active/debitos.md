# 051 — debitos.md

> **Começa zerado.** Débito = só o que **aparecer durante a implementação** (bug colateral, regressão, achado inesperado, divergência). O trabalho planejado das frentes F1–F4 vive em `spec.md`/`tasks.md`, não aqui.
>
> Formato ao registrar: `DEB-051-NN | origem | estado | evidência | escopo | próximo passo`.

- **2026-06-25 — Onda A concluída.** F4, F5 e F1 implementados com lint+build verdes. Ondas C/D pendentes.

---

## DEB-051-01 — ConfirmDialog extraído mas não adotado no site-admin (parte órfã)

- **Origem:** Onda A spec 051 (F5.2a). Cross-ref backlog `BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT`.
- **Estado:** aberto (débito de rollout). **Severidade: baixa-média.**
- **Evidência:** `ConfirmProvider`/`useConfirm` extraídos p/ `packages/ui`; mesas + glossario migrados. Mas `apps/site-admin` mantém **4 `window.confirm` crus** — todos ações destrutivas/irreversíveis:
  - `apps/site-admin/src/pages/PostsList.tsx:50` ("Apagar permanentemente")
  - `apps/site-admin/src/pages/PagesList.tsx:44` ("Apagar permanentemente")
  - `apps/site-admin/src/pages/FeedbackPage.tsx:46` ("Excluir definitivamente")
  - `apps/site-admin/src/media/MediaLibrary.tsx:40` ("Apagar")
- **Causa de não ter migrado junto:** `site-admin` não depende de `@artificio/ui` (ausente no `package.json`). Adicionar a dep puxa React/UI p/ o bundle → exige smoke de bundle próprio. Por isso virou rollout separado, não migração na Onda A.

### Riscos de qualidade de código

1. **Inconsistência de UX/marca (concreto):** `window.confirm` é popup nativo do SO — sem identidade Artifício, sem tema lua/sol. Admin que circula entre apps vê 2 padrões de confirmação destrutiva. Fere o design system (marca vem de `packages/ui`, pétrea).
2. **Acessibilidade desigual:** dialog compartilhado tem focus trap, `role=alertdialog`, ESC/Enter, restauração de foco; `window.confirm` depende da a11y do browser. Pior: as 4 são ações **irreversíveis** — justo onde prevenção de erro (Nielsen H5) mais importa.
3. **Divergência crescente (débito que apodrece):** estado "extraído mas não adotado em toda parte" = fonte única **e** cópia velha coexistem. Risco real = próximo dev do site-admin copiar o `window.confirm` vizinho em vez do shared → débito cresce. Mitigado por estar rastreado.
4. **Falsa conclusão:** F5.2a parece 100% mas 1 dos 3 apps-alvo ficou fora. **Por isso F5.2a deve ser marcada "parcial — site-admin pendente" no fechamento da spec, não total.**

### Mitigadores (por que é débito aceitável, não bug)
- Funcionalmente OK: `window.confirm` ainda bloqueia ação destrutiva. Falha de padrão, não de função. Não é segurança nem perda de dado.
- Escopo isolado e conhecido: 4 call-sites, 1 app, listados acima.
- Custo do fix não-trivial (dep nova + bundle smoke) justifica adiar.

- **Próximo passo:** adicionar `@artificio/ui` ao `site-admin` → `<ConfirmProvider>` no root → migrar os 4 `window.confirm` p/ `useConfirm({title, message, variant:'danger'})` → smoke de bundle (peso/Astro island). Fecha junto `BL-051-CONFIRMDIALOG-SITEADMIN-ROLLOUT`.
