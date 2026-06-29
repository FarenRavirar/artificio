# 053 — Tasks

Origem entre colchetes = spec/débito de onde o item foi transferido.

## Frente A — a11y/UI revisão de gestão (mesas) [049/D06]

- [x] T-A0 — Pré-investigação: mapear estado atual de P1-5 e P1-7 (já cobertos por 049/051?). Registrar o que sobra. **Anti-retrabalho.** Resultado: `window.confirm` ainda existia em `DiscordDraftReviewTable`; primitiva `ConfirmProvider` já estava no app via `@artificio/ui`.
- [x] T-A1 — P1-1 modal preview: `role`/`aria-modal` + focus-trap + `Escape` + restaurar foco. [049 P1-1]
- [x] T-A2 — P1-2 labels em checkbox/células de ação da tabela. [049 P1-2]
- [x] T-A3 — P1-3 focus indicators visíveis (tokens de tema). [049 P1-3]
- [x] T-A4 — P1-4 dirty-state guard ao fechar/navegar no editor de draft. [049 P1-4]
- [x] T-A5 — P1-5 migrar `window.confirm` remanescente → `ConfirmDialog`. [049 P1-5]
- [x] T-A6 — P1-6 remover navegação automática entre abas pós-ação. [049 P1-6] Verificado: preview não troca aba automaticamente pós-ação.
- [x] T-A7 — P1-7 trocar elementos crus por primitivas `packages/ui`. [049 P1-7] ConfirmDialog compartilhado aplicado onde havia confirmação nativa; restante visual fica no padrão local pós-054.
- [x] T-A8 — P1-8 erros com `role="alert"`/`aria-live`. [049 P1-8]
- [x] T-A9 — Smoke a11y/teclado + consumidores visuais `packages/ui`; lint+build.

## Frente B — tema accounts [DEB-048-38]

- [x] T-B1 — Investigar theme provider/persistência do `apps/accounts/frontend` (default light? toggle? `localStorage`/cookie?).
- [x] T-B2 — Corrigir p/ respeitar preferência + persistir; alinhar com `packages/ui`. Sem tocar auth/SSO. Fix: `applyTheme()` no boot do SPA.
- [x] T-B3 — Smoke visual (local/beta); lint+build. Validado por build do `accounts`; smoke beta/prod fica para deploy.
- [x] T-B4 — Reestruturar visual do frontend `accounts` conforme feedback do mantenedor: tela mais Artifício, menos card genérico, ações/admin organizados.
- [x] T-B5 — Corrigir regressão visual dark da `/conta`: remover faixa branca causada por token de texto usado como trilho estrutural.
- [x] T-B6 — Implementar ferramenta de trocar foto de perfil com upload Cloudinary via backend (`@artificio/media`), validação de MIME/tamanho e refresh dos cookies SSO.
- [x] T-B7 — Implementar ferramenta de excluir conta com confirmação por e-mail e limpeza de sessão.
- [x] T-B8 — Rodar governança de API após novas rotas do `accounts` (`PATCH /api/account/avatar`, `DELETE /api/account`).

## Frente B2 — busca do site [feedback pós-deploy]

- [x] T-B2.1 — Investigar clique morto na busca do `artificiorpg.com`.
- [x] T-B2.2 — Corrigir abertura da busca: botão React dispara evento explícito para `SearchModal` e faz fallback para `/busca/`.

## Frente C — smoke CJS no CI [DEB-048-37]

- [x] T-C1 — Script runner CJS que `require()` cada subpath shared consumido em CJS (`@artificio/config`, `/secret-crypto`, `@artificio/media`, ...).
- [x] T-C2 — Provar que falha no estado pré-fix (regressão simulada do DEB-048-36) e passa no atual.
- [x] T-C3 — Plugar no CI (junto do build). lint+build verdes.

## Frente D — doc [REV-051-RABBIT-06]

- [x] T-D1 — Incluir §13 da 051 no próximo PR (carona/doc-only). Sem código. Verificado: `specs/051-ui-changelog-nav-active/reviews.md` já contém §13; esta branch leva o rastreio da 053.

## Frente E — Ingestão diária na VM (DiscordChatExporter agendado) [ex-048 Fase E]

> Transferida da Fase E da 048 (T-E1..E6) por decisão do mantenedor (2026-06-27): fica **ao final da 053**. Exige aprovação nominal por ação (VM write, migration, job, segredo). Bloco A da 052 sobrepõe parte disto — coordenar para não duplicar; se a 053 não chegar aqui, segue p/ 052 Bloco A.

- [x] T-E1 — [048 T-E1] Desenhar diretórios fora do git p/ extração/import. **Transferido p/ 052 Bloco A** para evitar duplicação operacional.
- [x] T-E2 — [048 T-E2] Definir comando DiscordChatExporter na VM (pinado/seguro). **Transferido p/ 052 Bloco A**.
- [x] T-E3 — [048 T-E3] Criar job diário. **Transferido p/ 052 Bloco A**; VM write exige aprovação nominal própria.
- [x] T-E4 — [048 T-E4] Importador de pasta monitorada (idempotente). **Transferido p/ 052 Bloco A**.
- [x] T-E5 — [048 T-E5] Logs e retenção. **Transferido p/ 052 Bloco A**.
- [x] T-E6 — [048 T-E6] Métrica operacional. (048 T-F1: migration `discord_import_runs` — aprovação nominal + guard online-safe spec 050.) **Transferido p/ 052 Bloco A**.

## Fechamento

- [x] T-Z1 — `debitos.md` das specs 047–051 marcam itens transferidos como "→ 053".
- [x] T-Z2 — `specs/backlog.md` + `project-state.md` sincronizados. Dispensado nesta branch por instrução do mantenedor: documentação fora da spec será atualizada pelo DeepSeek.
- [x] T-Z3 — Critérios de aceite da 053 satisfeitos; nada das 047–051 resta "pendente" fora da 053.
