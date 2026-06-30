# Inventário — 057 (Fase 0)

> Fonte back = MCP `artificio-api-governance` (bundle `docs/api/generated/artificio-api.bundle.json`, 163 rotas mesas). Fonte front = `rg` sobre `apps/mesas/frontend/src`. Bundle tem `consumers:[]` em todas as rotas (linkagem não populada) → classificação "usado/órfão" feita por cruzamento manual front×back, não pelo campo `consumers`.

## 1. Estrutura de telas `/gestao` (roteamento)

`App.tsx:61` — `/gestao` → `GestaoLayout` (ProtectedRoute role=admin, outlet) com 6 rotas filhas:

| Rota | Componente | Árvore | Subnav local |
|---|---|---|---|
| `dashboard` | `DashboardSection` | features/admin | visao-geral · pendencias · atividades · alertas · atalhos |
| `conteudo` | `ConteudoSection` | features/admin | systems · platforms(vtt/comm) · scenarios · tables |
| `comunidade` | `ComunidadeSection` | features/admin | sugestões (system/scenario) |
| `moderacao/:sub?` | `ModeracaoSection` | features/admin | mensagens · rascunhos |
| `integracoes` | `IntegracoesSection` | features/admin | 8 subtabs (discord-config/canais/mensagens/rascunhos/import/importacao/enriquecimento/logs) |
| `sistema` | `SistemaSection` | features/admin | ferramentas · jobs · logs · erros · config |

`GestaoLayout` (`features/admin/components/GestaoLayout.tsx`) busca pendências (`system-suggestions` + `scenario-suggestions`) p/ badge da sidebar.

## 2. Duas árvores admin (DEB-057-01)

| `features/admin/components/` (novo, 049/054) | `modules/admin/` (velho) |
|---|---|
| AdminSidebar, AdminMain, GestaoLayout, Breadcrumb | activity/ (ActivityPanel/Feed/Filters/Item + useActivityLog) |
| 6 `*Section.tsx` (Dashboard/Conteudo/Comunidade/Moderacao/Integracoes/Sistema) | hydration/ (EnrichmentAdminPanel) |
| AliasesEditor, CatalogTree*, EntityInspector, CommandPalette, EntityCounters, Field, NodeTypeBadge, ScenariosList | platforms/ (PlatformsPage) |
| AdminWorkspaceLayout | systems/ (SystemsList, useSystems, types) |
| | dev-feedback/ (DevFeedbackPanel) |

Painéis Discord vivem numa **terceira** pasta: `features/discord-sync/` (DiscordSettingsPanel→ChatExporterAutomationPanel, DiscordSourceList, MessagesView, DiscordDraftReviewTable, DiscordJsonImportPanel, IntegrationLogsView, hook useDiscordSync, api discordSyncApi). Inbox: `features/inbox/` (TextPasteArea, inboxApi).

## 3. Endpoints admin × consumo (classificação)

Legenda: ✅ usado (com consumidor) · 👻 órfão (sem consumidor de UI) · 🔧 não-UI legítimo (cron/spec 052) · ⚠️ wrapper definido sem caller.

### Discord (`/api/v1/admin/discord/*`)
| Rota | Status | Consumidor |
|---|---|---|
| GET `/settings`, PUT/DELETE `/settings/bot-token` | ✅ | DiscordSettingsPanel via discordSyncApi |
| GET/PUT `/chat-exporter/config`, POST `/chat-exporter/test`, `/run` | ✅ | ChatExporterAutomationPanel |
| GET `/discovery/guilds`, `/discovery/guilds/:id/channels` | ✅ | DiscordSourceList |
| GET/POST/PATCH/DELETE `/sources*`, POST `/sources/:id/reingest-force` | ✅ | DiscordSourceList / useDiscordSync |
| POST `/fetch` | ✅ | useDiscordSync |
| GET `/messages`, PATCH `/messages/:id`, `/messages/batch`, POST `/messages/:id/parse`, `/parse-batch`, `/messages/:id/diagnose-content` | ✅ | MessagesView / useDiscordSync |
| GET `/drafts`, `/drafts/:id`, PATCH `/drafts/:id`, `/drafts/batch`, DELETE `/drafts/rejected`, POST `/drafts/:id/{sync,reparse,correction}` | ✅ | DiscordDraftReviewTable / ModeracaoSection |
| POST `/drafts/:id/refresh-image` | 👻 | sem caller no front |
| POST `/import-json`, `/import-json/preview`, `/import-json/file`, `/import-json/preview/file` | ✅ | DiscordJsonImportPanel |
| POST `/import-json/reparse` | 👻 | sem wrapper/caller |
| POST `/sync-ready` | ✅ | DiscordDraftReviewTable |
| GET `/metrics` | ✅ | IntegrationLogsView |
| GET `/metrics/shadow` | 🔧 | spec 052 (shadow mode), sem UI |
| GET `/automation/config`, `/automation/eval`, POST `/automation/auto-approval/guard` | 🔧 | spec 052 (IA), sem UI |

### Import/Inbox (`/api/v1/admin/import/*`)
| Rota | Status | Consumidor |
|---|---|---|
| POST `/import-text` | ✅ | TextPasteArea (inboxApi) |
| GET `/drafts`, `/drafts/:id`, PATCH `/drafts/:id`, POST `/drafts/:id/{reparse,correction,sync}` | ✅ | ModeracaoSection (inboxDraftApi adapter) |
| GET `/metrics` | ⚠️ | `inboxApi.getMetrics` definido, **sem caller** |

### Sugestões / Conteúdo
| Rota | Status | Consumidor |
|---|---|---|
| GET `/system-suggestions`, `:id/{approve,reject,candidates,resolve}` | ✅ | ComunidadeSection / SystemSuggestionResolutionDrawer / GestaoLayout / DashboardSection |
| GET `/scenario-suggestions`, `:id/{approve,reject}` | ✅ | ComunidadeSection / GestaoLayout / DashboardSection |
| GET/POST/PUT/DELETE `/setting-suggestions*` (4) | 👻 | sem consumidor de UI |
| POST/PUT/DELETE `/systems/admin*`, `/scenarios/admin*`, `/vtt-platforms/admin*`, `/communication-platforms/admin*` | ✅ | useSystems / ScenariosAdminView / PlatformsPage / modais |
| PUT/DELETE `/admin/tables/:id` | ✅ | ConteudoSection / TableActionPanel / PainelMestrePage |
| POST `/admin/tables/auto-archive` | 🔧 | cron `mesas-auto-archive.yml`, sem UI |

### Outros admin
| Rota | Status | Consumidor |
|---|---|---|
| GET `/admin/activity` | ✅ | useActivityLog → ActivityPanel |
| POST `/admin/sync/enrich` | ✅ | EnrichmentAdminPanel |
| GET/PATCH/DELETE/POST `/admin/dev-feedback*` (4) | ✅ | DevFeedbackPanel (devFeedbackApi) |
| GET `/admin/users`, `/admin/users/:id`, PATCH `/admin/users/:id/covil` | 👻 | **sem UI de usuários em `/gestao`** |

## 4. Órfãos / pendências (resumo acionável)

- **👻 Sem UI (avaliar remover / `legacy` / construir tela):**
  - `/admin/users` GET + `/admin/users/:id` GET + `/admin/users/:id/covil` PATCH → não há tela de Usuários (covil hoje é setado em `tables`/`is_covil`, não por usuário). **Decisão R10.**
  - `/admin/setting-suggestions` (GET/POST/PUT/DELETE) → órfão; "setting" ≠ "system/scenario suggestions" usados. Verificar se é morto ou feature inacabada.
  - `/admin/discord/drafts/:id/refresh-image` POST → sem caller.
  - `/admin/discord/import-json/reparse` POST → sem wrapper/caller.
  - `/admin/import/metrics` GET → wrapper `inboxApi.getMetrics` sem caller (⚠️ usar nos Relatórios do Bot ou remover).
- **🔧 Não-UI legítimo (manter):** `tables/auto-archive` (cron); `automation/*` + `metrics/shadow` (spec 052, expor nos Relatórios quando a 052 ativar).

## 5. Duas filas de draft (DEB-057-04)
- `discord_import_messages` (Discord-only) → "Mensagens capturadas".
- Drafts unificados `discord_import_table_drafts` consumidos por DOIS APIs: `discordSyncApi` (rota `/admin/discord/drafts`) e `inboxApi` (rota `/admin/import/drafts`). `ModeracaoSection` já mistura os dois via adapter `inboxDraftApi`. **A "Mesas central" (R4) deve absorver essa fila unificada com filtro de origem.**

## 6. Stubs / redundância (DEB-057-03/05)
- `DashboardSection`: "visao-geral" = stub + `<ActivityPanel/>`; "atividades" = mesmo `<ActivityPanel/>`; "alertas" = stub; "atalhos" = NavLinks. Pendência (3 GETs no mount) gera ruído de dedup em Conteúdo→Mesas.
- `SistemaSection`: 4 de 5 subtabs são stub `em breve` (jobs/logs/erros/config); só "ferramentas" (DevFeedbackPanel) é real.
- `IntegracoesSection`: 8 subtabs, 2 deles ("mensagens"/"rascunhos") são só links p/ Moderação.

## 7. Sobreposição de IA a resolver (Fase 1)
- "Mesas central" (fila de drafts) × "Moderação › Rascunhos" × "Integrações" (canais/mensagens) → tudo toca o mesmo pipeline Discord. Consolidar em `proposta-ia.md`.
- Hardcodes de cor (`#0E1A38`, `#16223E`, `bg-blue-600`) espalhados nas Sections → R11 (tokens de tema).
