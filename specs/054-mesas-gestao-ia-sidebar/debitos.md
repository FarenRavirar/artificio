# 054 — Débitos

> Começa vazio. Débito = só o que surgir na investigação/implementação real. Decisões em aberto vivem no `spec.md` §Decisões em aberto até serem fechadas pelo mantenedor.

## Dependências/coordenação registradas

- **054 = GATE DE BLOQUEIO (mantenedor 2026-06-27).** Specs que tocam as superfícies da 054 (`/gestao` do mesas, primitivas de nav em `packages/ui`, backend onde o rename tocar contrato) ficam **bloqueadas até a 054 fechar**. Ordem de prioridade: **054 → 053 → 052**.
- **053 Frente A** (a11y/UI da revisão de gestão) — mesma tela → **BLOQUEADA pela 054**. Roda depois, sobre a estrutura nova. Demais frentes da 053 (B/C/D/E) seguem livres.

## Resolvidos

- ~~**DEB-054-02 (opcional) — rename de rotas/componentes BE.**~~ ✅ **RESOLVIDO 2026-06-27.** Rotas de API renomeadas:
  - `/api/v1/admin/sync/hydrate` → `/api/v1/admin/sync/enrich` (BE: `adminHydration`→`adminEnrichment`; FE: URL)
  - `/api/v1/admin/discord-sync` → `/api/v1/admin/discord` (BE mount + FE `discordSyncApi` BASE + testes)
  - `/api/v1/admin/inbox` → `/api/v1/admin/import` (BE mount + FE `inboxApi` BASE + testes)
- ~~**DEB-054-03 (R-A9) — correction-tracking portado.**~~ ✅ **RESOLVIDO 2026-06-27.**
- ~~**Doc drift: MAPA_DE_API.md com 24 refs a `/admin/discord-sync/`.**~~ ✅ **RESOLVIDO 2026-06-27.** Corrigido para `/admin/discord/`. `ModeracaoSection` injeta `onBeforeSync` em `DiscordDraftReviewTable` que compara `parsed_payload` vs `normalized_payload` e chama `discordSyncApi.submitCorrection` com o diff antes de sync. Sempre retorna null para deixar o sync normal prosseguir.

## Novos (surgidos na implementação/revisão)

### DEB-054-05 — Expor `total` no endpoint de drafts (P2)

- **Origem:** REV-011, REV-012, REV-020 (CodeRabbit)
- **Evidência:** `DashboardSection.tsx` e `GestaoLayout.tsx` usam `getDrafts({ limit: 1 })` como booleano "há pendências". A contagem real de rascunhos `needs_review` não está disponível sem paginação completa.
- **Escopo:** `apps/mesas/backend` — adicionar campo `total` na resposta de `GET /api/v1/admin/discord/drafts` e `GET /api/v1/admin/import/drafts`.
- **Próximo passo:** Spec futura de melhoria de API. Baixa prioridade — booleano atual é suficiente para badge/sidebar.

### DEB-054-06 — ~~Confirmar que correction-tracking cobre ambas as origens~~ ✅ FALSO ALARME

- **Origem:** REV-001 (chatgpt-codex-connector), R-A9 (tasks.md)
- **Evidência:** `ModeracaoSection.onBeforeSync` chama `discordSyncApi.submitCorrection` (rota `/admin/discord/drafts/:id/correction`). Suspeita: drafts de Inbox precisariam de `inboxApi.registerCorrection` (rota `/admin/import/drafts/:id/correction`).
- **Veredito:** A rota `/admin/discord/drafts/:id/correction` usa `registerDraftCorrection` em `discord/utils.ts` que é **compartilhada entre ambas as origens**. A função checa `draft.import_message_id` (inbox) e `draft.discord_message_id` (discord) e insere na mesma tabela `import_corrections`. **`discordSyncApi.submitCorrection` funciona para drafts de ambas as origens.** Nenhuma ação necessária.
- **Status:** ✅ RESOLVIDO (2026-06-28).

### DEB-054-10 — Centralizar estado `kind` entre `ConteudoSection` e `PlatformsPage`

- **Origem:** REV-010 (CodeRabbit)
- **Evidência:** `ConteudoSection.tsx:153` renderiza `<PlatformsPage key={platformKind} initialKind={platformKind} />` forçando remount. `PlatformsPage` tem estado interno de `kind` independente. Seletor externo (VTT/Comunicação) e interno divergem.
- **Escopo:** `ConteudoSection.tsx` + `PlatformsPage.tsx` — lift `kind` state ou remover seletor externo.
- **Próximo passo:** Melhoria UX futura (P3). Não bloqueia funcionalidade atual.

### DEB-054-03 (SonarCloud) — Extrair `extractErrorMessage` duplicado em ConteudoSection

- **Origem:** REV-023, REV-024 (SonarCloud)
- **Evidência:** `ConteudoSection.tsx` linhas 59-71 e 96-108 têm blocos quase idênticos (~12 linhas cada) de extração de `errorMessage`. Padrão também aparece em `PainelMestrePage.tsx`.
- **Escopo:** `apps/mesas/frontend` — extrair helper `extractErrorMessage(response, defaultMessage)` para módulo compartilhado.
- **Próximo passo:** Refatoração futura (P3).

### DEB-054-04 (SonarCloud) — Extrair `resolveFkBySlug` duplicado em adminEnrichment

- **Origem:** REV-023, REV-025 (SonarCloud)
- **Evidência:** `adminEnrichment.ts` 4 blocos idênticos de resolução de FK por slug (~16 linhas cada).
- **Escopo:** `apps/mesas/backend` — extrair helper `resolveFkBySlug(trx, table, slugColumn, slugValue, recordId)`.
- **Próximo passo:** Refatoração futura (P3).
