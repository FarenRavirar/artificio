# 053 — Tasks

Origem entre colchetes = spec/débito de onde o item foi transferido.

## Frente A — a11y/UI revisão de gestão (mesas) [049/D06]

- [ ] T-A0 — Pré-investigação: mapear estado atual de P1-5 e P1-7 (já cobertos por 049/051?). Registrar o que sobra. **Anti-retrabalho.**
- [ ] T-A1 — P1-1 modal preview: `role`/`aria-modal` + focus-trap + `Escape` + restaurar foco. [049 P1-1]
- [ ] T-A2 — P1-2 labels em checkbox/células de ação da tabela. [049 P1-2]
- [ ] T-A3 — P1-3 focus indicators visíveis (tokens de tema). [049 P1-3]
- [ ] T-A4 — P1-4 dirty-state guard ao fechar/navegar no editor de draft. [049 P1-4]
- [ ] T-A5 — P1-5 migrar `window.confirm` remanescente → `ConfirmDialog`. **Só se sobrar.** [049 P1-5]
- [ ] T-A6 — P1-6 remover navegação automática entre abas pós-ação. [049 P1-6]
- [ ] T-A7 — P1-7 trocar elementos crus por primitivas `packages/ui`. [049 P1-7]
- [ ] T-A8 — P1-8 erros com `role="alert"`/`aria-live`. [049 P1-8]
- [ ] T-A9 — Smoke a11y/teclado + consumidores visuais `packages/ui`; lint+build.

## Frente B — tema accounts [DEB-048-38]

- [ ] T-B1 — Investigar theme provider/persistência do `apps/accounts/frontend` (default light? toggle? `localStorage`/cookie?).
- [ ] T-B2 — Corrigir p/ respeitar preferência + persistir; alinhar com `packages/ui`. Sem tocar auth/SSO.
- [ ] T-B3 — Smoke visual (local/beta); lint+build.

## Frente C — smoke CJS no CI [DEB-048-37]

- [ ] T-C1 — Script runner CJS que `require()` cada subpath shared consumido em CJS (`@artificio/config`, `/secret-crypto`, `@artificio/media`, ...).
- [ ] T-C2 — Provar que falha no estado pré-fix (regressão simulada do DEB-048-36) e passa no atual.
- [ ] T-C3 — Plugar no CI (junto do build). lint+build verdes.

## Frente D — doc [REV-051-RABBIT-06]

- [ ] T-D1 — Incluir §13 da 051 no próximo PR (carona/doc-only). Sem código.

## Frente E — Ingestão diária na VM (DiscordChatExporter agendado) [ex-048 Fase E]

> Transferida da Fase E da 048 (T-E1..E6) por decisão do mantenedor (2026-06-27): fica **ao final da 053**. Exige aprovação nominal por ação (VM write, migration, job, segredo). Bloco A da 052 sobrepõe parte disto — coordenar para não duplicar; se a 053 não chegar aqui, segue p/ 052 Bloco A.

- [ ] T-E1 — [048 T-E1] Desenhar diretórios fora do git p/ extração/import.
- [ ] T-E2 — [048 T-E2] Definir comando DiscordChatExporter na VM (pinado/seguro).
- [ ] T-E3 — [048 T-E3] Criar job diário.
- [ ] T-E4 — [048 T-E4] Importador de pasta monitorada (idempotente).
- [ ] T-E5 — [048 T-E5] Logs e retenção.
- [ ] T-E6 — [048 T-E6] Métrica operacional. (048 T-F1: migration `discord_import_runs` — aprovação nominal + guard online-safe spec 050.)

## Fechamento

- [ ] T-Z1 — `debitos.md` das specs 047–051 marcam itens transferidos como "→ 053".
- [ ] T-Z2 — `specs/backlog.md` + `project-state.md` sincronizados.
- [ ] T-Z3 — Critérios de aceite da 053 satisfeitos; nada das 047–051 resta "pendente" fora da 053.
