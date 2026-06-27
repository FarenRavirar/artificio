# 054 — Débitos

> Começa vazio. Débito = só o que surgir na investigação/implementação real. Decisões em aberto vivem no `spec.md` §Decisões em aberto até serem fechadas pelo mantenedor.

## Dependências/coordenação registradas

- **054 = GATE DE BLOQUEIO (mantenedor 2026-06-27).** Specs que tocam as superfícies da 054 (`/gestao` do mesas, primitivas de nav em `packages/ui`, backend onde o rename tocar contrato) ficam **bloqueadas até a 054 fechar**. Ordem de prioridade: **054 → 053 → 052**.
- **053 Frente A** (a11y/UI da revisão de gestão) — mesma tela → **BLOQUEADA pela 054**. Roda depois, sobre a estrutura nova. Demais frentes da 053 (B/C/D/E) seguem livres.

## Novos (surgidos na 054)

- ~~**DEB-054-02 (opcional) — rename de rotas/componentes BE.**~~ ✅ **RESOLVIDO 2026-06-27.** Rotas de API renomeadas:
  - `/api/v1/admin/sync/hydrate` → `/api/v1/admin/sync/enrich` (BE: `adminHydration`→`adminEnrichment`; FE: URL)
  - `/api/v1/admin/discord-sync` → `/api/v1/admin/discord` (BE mount + FE `discordSyncApi` BASE + testes)
  - `/api/v1/admin/inbox` → `/api/v1/admin/import` (BE mount + FE `inboxApi` BASE + testes)
- ~~**DEB-054-03 (R-A9) — correction-tracking portado.**~~ ✅ **RESOLVIDO 2026-06-27.**
- ~~**Doc drift: MAPA_DE_API.md com 24 refs a `/admin/discord-sync/`.**~~ ✅ **RESOLVIDO 2026-06-27.** Corrigido para `/admin/discord/`. `ModeracaoSection` injeta `onBeforeSync` em `DiscordDraftReviewTable` que compara `parsed_payload` vs `normalized_payload` e chama `discordSyncApi.submitCorrection` com o diff antes de sync. Sempre retorna null para deixar o sync normal prosseguir.
