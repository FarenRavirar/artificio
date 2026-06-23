# Sessão 26-06-22 — Spec 047 Inbox de Importação

- **Data:** 2026-06-22
- **Projeto:** mesas
- **Gate:** D fechado; trabalho somente local/beta
- **Objetivo atual:** Fase B1 — revisão pré-deploy do backend mínimo da Inbox
- **Vínculos:** `specs/047-mesas-inbox-importacao/`

## Estado recebido

- Tasks A–D implementadas localmente.
- Migration 128 documentada como aplicada no banco beta.
- Branch `feat/mesas-047-inbox-importacao`.
- Sem commit, push, PR, deploy ou smoke autorizados.

## Plano B1

- [ ] Confirmar estado Git e escopo do diff.
- [ ] Revisar migration, tipos, guards, adaptador, segmentador e rotas.
- [ ] Rodar TypeScript, lint e testes pontuais pertinentes.
- [ ] Corrigir inconsistências locais encontradas dentro da Spec 047.
- [ ] Confirmar que backups não entrarão no futuro commit.
- [ ] Registrar riscos, evidências e situação do backlog.
- [ ] Apresentar conteúdo proposto do commit e pedir autorização separada.

## Arquivos previstos

- Código local já alterado sob `apps/mesas/backend/` e `apps/mesas/database/`.
- Documentação `specs/047-mesas-inbox-importacao/`.
- Esta sessão.

## Critério de saída da B1

- Diff revisado, validações locais verdes e escopo exato do futuro commit conhecido.
- Nenhum commit/push/PR/deploy executado.

## Backlog

- `BL-MESAS-INBOX-047` atualizado para refletir estado local/B1.
- `BL-CI-FEEDBACK-DIST-CJS-LINT` aberto: lint repo-wide analisa `packages/feedback/dist-cjs` gerado e falha.

## Evidência B1

- `pnpm --dir apps/mesas/backend exec tsc --noEmit`: ✅.
- Primeira execução dos testes novos: ❌ revelou split falso em linha `Sistema:`.
- Segmentador corrigido para usar só cabeçalhos seguros (`Título`, `Mesa`, heading `#`).
- `pnpm --filter @artificio/mesas-backend test`: ✅ 18 arquivos, 119 testes.
- `pnpm run build`: ✅ 17/17 pacotes.
- `pnpm run lint`: ❌ falha preexistente em artefatos `packages/feedback/dist-cjs/*.js`; código da Inbox não aparece nos erros.
- `git diff --check`: ✅.
- Migration 128 reforçada com `chk_discord_import_table_drafts_single_origin`, impedindo draft com ambas/nenhuma origem.
- Como migration 128 já foi aplicada manualmente no beta, a constraint nova ainda não existe lá; aplicar exige write na VM e nova autorização nominal.
- `spec047-backup/` permanece untracked e fora do conjunto proposto para commit.

## Estado da B1

- Revisão técnica executada.
- Não pronta para commit: lint obrigatório não está verde e constraint do beta está dessincronizada do SQL revisado.
- Nenhum commit, push, PR, deploy, smoke ou write adicional na VM executado.

## Retomada — fechamento pré-Git (2026-06-22)

- **Objetivo:** validar o diff final após resolução dos débitos/reviews e consolidar evidências canônicas da Spec 047.
- **Escopo autorizado:** inspeção, validações locais e atualização documental; sem commit, push, PR, merge, deploy ou write na VM.
- **A executar:** `pnpm run lint`, `pnpm run build`, suíte do backend Mesas e `git diff --check`.
- **A conferir:** coerência de `tasks.md`, `debitos.md`, `reviews.md`, sessão e backlog; exclusão de `spec047-backup/` do futuro commit.
- **Critério:** gates locais verdes, diff limpo e documentação refletindo exatamente o estado material.

## Evidência final — fechamento pré-Git

- `pnpm run lint`: ✅ 15/15 tasks.
- `pnpm run build`: ✅ 17/17 tasks.
- `pnpm --filter @artificio/mesas-backend test`: ✅ 21 arquivos / 159 testes.
- `git diff --check`: ✅ após remoção de whitespace em `reviews.md`.
- `spec047-backup/`: permanece untracked; proibido incluir no futuro commit.
- Documentação reconciliada: `spec.md`, `tasks.md`, `debitos.md`, backlog e `project-state.md` agora refletem o estado material.
- Backlog atualizado: `BL-MESAS-INBOX-047` = local, pronto para Git; nenhuma pendência nova descoberta.
- **Estado:** fechamento técnico local concluído. Nenhum commit, push, PR, merge, deploy ou write na VM executado.

## Deploy beta — 2026-06-22

- PR #87 já havia sido mergeada em `dev` (`d9c3192`) por outro agente.
- Autorização nominal recebida para deploy beta do módulo `mesas`.
- Workflow canônico: `deploy.yml`, run `27989371155`, `module=mesas`, `mode=deploy`, ref `dev`: ✅.
- Clone beta: `d9c3192`; `mesas-beta-app`, `mesas-beta-api` e `mesas-beta-db`: healthy.
- Migration 129: tabela `import_corrections` existente, 10 colunas e 10 constraints.
- Smoke público: `/` 200, `/healthz` 200, `/api/v1/health` 200.
- Guards sem sessão: `/api/v1/admin/inbox/metrics` 401; `/api/v1/admin/inbox/drafts` 401.
- Próximo: smoke autenticado do fluxo de produto; uso do Chrome/perfil real exige autorização nominal própria.

## Smoke autenticado via Chrome — 2026-06-22

- Autorização nominal recebida; perfil Chrome logado usado.
- Sessão confirmada no beta: usuário `Paulo Henrique`; rota `/gestao` abriu `Gestão Administrativa` com controles admin.
- Navegação disponível: Gerenciar Conteúdo, Sugestões, Atividades, Hidratação, Discord Sync, Desenvolvimento, Sistemas, Plataformas, Cenários e Mesas.
- **Inbox ausente na UI:** T1.8-T1.12 ainda não implementadas; não há textarea/aba/ações para importar, revisar, corrigir ou sincronizar anúncios.
- Resultado: autenticação e shell admin ✅; smoke E2E de produto bloqueado pela etapa frontend planejada, não por falha de deploy/backend.
- Próximo: implementar T1.8-T1.12; redeploy beta; então executar T1.13-T1.16 pelo Chrome.

## Handoff ao pedreiro — frontend

- `tasks.md` recebeu seção "Handoff executável — pedreiro independente".
- Escopo detalhado: contratos backend faltantes T1.8A, API/Zod, textarea, preview por injeção de client, painel/lista, integração na Gestão e gates.
- Gap material documentado: `GET/PATCH /drafts/:id` e `POST /drafts/:id/reparse` não existem no Inbox e são pré-requisito da revisão visual.
- Regras de produto, testes, fora de escopo e parada antes de Git/deploy registrados.

## Protocolo OpenCode autorizado

- Mantenedor autorizou delegação por subprocesso OpenCode para etapas grandes antes de cada commit.
- Sessão canônica: `ses_10e6e1846fferwRBG9UEUfLWX2`.
- Fluxo: delegar → aguardar conclusão → revisão Codex → devolver correções → repetir → entregar etapa ao mantenedor.
- Sem autorização automática para Git/deploy/Chrome/write VM.
- Regra detalhada registrada em `tasks.md`.

## Ajuste de coordenação multi-IA

- Por decisão do mantenedor, MCP/subprocesso OpenCode não será usado nesta spec.
- Coordenação passa a ser manual e centralizada nos `.md`: Codex entrega prompt; mantenedor repassa ao DeepSeek V4 Pro.
- Tentativa MCP interrompida antes de qualquer correção material; `inboxApi.ts` permanece com a falha original de Promise sem `await`.
- Seis grupos de correção pré-commit registrados em `tasks.md`.

## Handoff executado — UI Inbox implementada localmente (2026-06-22)

- **T1.8A ✅ (backend):** 3 novas rotas em `adminImportInbox.ts` — `GET /drafts/:id` (full draft, só Inbox), `PATCH /drafts/:id` (Zod, rejeita Discord/synced/published), `POST /drafts/:id/reparse`. 16 novos testes.
- **T1.8 ✅ (frontend types+api):** `features/inbox/types.ts` + `features/inbox/api/inboxApi.ts` (8 métodos, Zod em todas respostas).
- **T1.10 ✅ (TextPasteArea):** Textarea, botão, 5 estados, `<10 chars` bloqueado, `aria-live`.
- **T1.12A ✅ (generalização):** `DraftApiOperations` em `types.ts`. `DiscordDraftPreview` aceita prop `api`. `DiscordDraftReviewTable` aceita `api`/`listDrafts`/`syncReadyAction`/`showSyncReady`.
- **T1.9 ✅ (InboxPanel):** `InboxPanel.tsx` (abas Importar/Drafts) + `InboxDraftReviewTable.tsx` (lista, filtro, preview com `inboxApi` injetada).
- **T1.11 ✅ (GestaoPage):** Aba "Inbox" adicionada, `'inbox'` no union de `activeTab`, render condicional.
- **T1.12B ✅ (validação):** `pnpm run lint` 15/15, `pnpm run build` 17/17, backend 21/178 testes ✅, frontend 4/19 ✅.
- **Arquivos criados:** 6 (`types.ts`, `inboxApi.ts`, `TextPasteArea.tsx`, `InboxPanel.tsx`, `InboxDraftReviewTable.tsx`).
- **Arquivos modificados:** 6 (`adminImportInbox.ts`, `adminImportInbox.test.ts`, `DiscordDraftPreview.tsx`, `DiscordDraftReviewTable.tsx`, `discord-sync/types.ts`, `GestaoPage.tsx`).
- **Sem commit, push, PR, merge ou deploy.** Próximo: autorizações separadas para fluxo Git.

## Retomada Codex — revisão pré-commit

- Documentação reconciliada: T1.8-T1.12 marcadas concluídas; T1.13-T1.16 bloqueadas até revisão + Git + redeploy.
- Trabalho sujo removido de `dev` para branch `feat/047-inbox-ui-review`.
- Etapa atual: revisão integral Codex → correções via OpenCode → nova revisão → gates finais → entrega ao mantenedor.
- Sem autorização para commit/push/PR/deploy nesta etapa.

## Revisão Codex — handoff DeepSeek validado (2026-06-22)

- Handoff das 6 correções foi verificado contra o diff local da branch `feat/047-inbox-ui-review`.
- Correções aceitas:
  - `inboxApi.ts` corrigido com `async` + `await apiFetch(...)` nos métodos que passam por Zod.
  - Fluxo Inbox registra correção humana antes do sync apenas quando há diff real e não altera o fluxo Discord.
  - `POST /drafts/:id/reparse` atualiza draft + `import_messages` dentro de `db.transaction().execute`.
  - `GET /drafts/:id` retorna `raw_text` via `import_messages` e bloqueia draft Discord/cross-origin.
  - Cast `as unknown as DiscordDraft` removido; criado adaptador tipado `features/inbox/adapters/draftAdapter.ts`.
  - Guards e erros 400/404/422/500 rechecados; sync Inbox preserva `tables.status='draft'`.
- Observação técnica aceita: `GET /drafts/:id` retorna 500 quando draft Inbox aponta para `import_message` ausente; tratado como corrupção/inconsistência interna, não erro de input do operador.
- Gates executados por Codex:
  - `git diff --check`: ✅.
  - `pnpm --filter @artificio/mesas-backend test -- adminImportInbox`: ✅ 45/45.
  - `pnpm --filter @artificio/mesas-backend test`: ✅ 21 arquivos / 178 testes.
  - `pnpm --filter @artificio/mesas-frontend test`: ✅ 4 arquivos / 19 testes.
  - `pnpm --filter @artificio/mesas-backend build`: ✅.
  - `pnpm --filter @artificio/mesas-frontend build`: ✅.
  - `pnpm run lint`: ✅ 15/15.
  - `pnpm run build`: ✅ 17/17.
  - `pnpm run test`: ✅ 24/24 tasks.
- `spec047-backup/` continua untracked e deve ficar fora do commit.
- Nenhum commit, push, PR, merge, deploy, Chrome ou write na VM executado.
- Próxima etapa: pedir autorização nominal para `git commit` local da branch de trabalho; depois autorizações separadas para push/PR/deploy.
