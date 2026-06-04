# Mapa Canônico da API (backend/src/routes) vs Frontend

> **OBRIGATÓRIO:** Toda nova rota adicionada ou removida da API **deve** ser refletida neste documento. Agentes de IA estão proibidos de concluir tarefas de backend sem atualizar este arquivo.

### SERVER CORE (`server.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/health` | ❌ Pendente/Front | - |

### ADMINPROFILE (`routes/adminProfile.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **PATCH** | `/users/:id/covil` | ❌ Pendente/Front | - |
| **GET** | `/users` | ❌ Pendente/Front | - |
| **GET** | `/users/:id` | ❌ Pendente/Front | - |

### ADMINSETTINGSUGGESTIONS (`routes/adminSettingSuggestions.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ❌ Pendente/Front | - |
| **POST** | `/` | ❌ Pendente/Front | - |
| **PUT** | `/:id` | ❌ Pendente/Front | - |
| **DELETE** | `/:id` | ❌ Pendente/Front | - |

### AUTH (`routes/auth.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/google` | ✅ Em Uso | auth.ts (helper), LoginPage.tsx, SiteHeader.tsx — Query opcional: `frontend_redirect` (URL validada por allowlist no backend via `FRONTEND_URL`/`FRONTEND_URLS`) |
| **GET** | `/google/callback` | ✅ Em Uso | Fluxo OAuth do navegador (redirecionamento do Google) — seta cookie `am_session` e redireciona para frontend permitido |
| **POST** | `/logout` | ✅ Em Uso | AuthContext.tsx |

### CHANGELOG (`routes/changelog.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | ChangelogModal.tsx |

### DISCORD (`routes/discord.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/discord/connect` | ✅ Em Uso | ProfileEditPage.tsx (via `/auth/discord/connect`) |
| **GET** | `/discord/callback` | ✅ Em Uso | Fluxo OAuth do Discord (redirecionamento externo) |
| **DELETE** | `/discord/disconnect` | ✅ Em Uso | ProfileEditPage.tsx (via `/auth/discord/disconnect`) |
| **POST** | `/discord/verify-covil` | ❌ Pendente/Front | - |

### GM (`routes/gm.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:slug` | ✅ Em Uso | useMestre.ts (`MestrePage.tsx`) — `optionalAuth` aplicado; retorna `viewer_context { is_owner, is_admin }`, `closed_group`, `selling_points`, `features` em `tables`; NÃO retorna `metrics_*` |
| **GET** | `/:slug/insights` | ✅ Em Uso | useMestreInsights.ts (`MestrePage.tsx`) — protegido por `authMiddleware`; retorna `metrics` e `recommendations`; acesso apenas para dono/admin |

### GMPANEL (`routes/gmPanel.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **POST** | `/profile` | ✅ Em Uso | PainelMestrePage.tsx (CreateGmProfileForm) |
| **PUT** | `/profile` | ✅ Em Uso | VttPlatformsEditor.tsx, ContactMethodsEditor.tsx (via PainelMestrePage.tsx) — **Aceita:** `nickname`, `bio_long`, `languages`, `specialties`, `badges`, `avatar_url`, `banner_url`, `tagline`, `promo_badge_text`, `selling_points`, `closed_group_enabled`, `closed_group_systems`, `closed_group_description`, `closed_group_min_price_cents`, `preferred_vtt_platforms` (UUID[]), `contact_methods` (Array<{channel, value, label?, discord_server_url?}>) — **Validação:** WhatsApp formato internacional (+55XXXXXXXXXXX sem espaços/parênteses/hífens), Email formato válido |
| **GET** | `/me` | ✅ Em Uso | PainelMestrePage.tsx |
| **GET** | `/tables/:id` | ✅ Em Uso | PainelMestrePage.tsx — retorno inclui campos canônicos/legados da tabela (`banner_url`, `cover_url`), `vtt_platform_id`, `game_platform_custom`, `communication_platform_id` e `communication_platform` resolvida (`COALESCE(cp.name, t.communication_platform)`); não inclui alias `image_url` |
| **POST** | `/tables` | ✅ Em Uso | useCreateTableForm.ts, PainelMestrePage.tsx — submit corrigido em 15/04 para `${API_BASE}/api/v1/gm/tables` |
| **PUT** | `/tables/:id` | ✅ Em Uso | useCreateTableForm.ts, PainelMestrePage.tsx — submit corrigido em 15/04 para `${API_BASE}/api/v1/gm/tables/:id` |
| **GET** | `/tables` | ✅ Em Uso | PainelMestrePage.tsx, TableCardDashboard.tsx — retorna `image_url` (alias de `banner_url`) e objeto `vtt_platform` (`id`, `name`, `slug`, `logo_filename`, `website_url`) para cards do painel; inclui `communication_platform` resolvida |
| **PATCH** | `/tables/:id/status` | ✅ Em Uso | PainelMestrePage.tsx (handleToggleTableStatus) - **Aceita apenas:** 'active', 'full', 'cancelled', 'ended' |
| **DELETE** | `/tables/:id` | ✅ Em Uso | uiHelpers.ts, PainelMestrePage.tsx |
| **GET** | `/insights` | ✅ Em Uso | GmInsightsDashboard.tsx (via useGmInsights hook) — Dashboard de insights agregados |

**Detalhes de `GET /insights`:**
- **Middleware:** `authMiddleware` (apenas dono do perfil GM)
- **Resposta:**
  ```json
  {
    "overview": {
      "total_views": number,
      "total_clicks": number,
      "total_contacts": number,
      "total_favorites": number,
      "ctr": number,
      "contact_rate": number
    },
    "tables": [
      {
        "id": string,
        "slug": string,
        "title": string,
        "status": string,
        "system_name": string | null,
        "views": number,
        "clicks": number,
        "contacts": number,
        "favorites": number,
        "ctr": number,
        "click_breakdown": {
          "refactored_v4": number,
          "cta_entrar": number,
          "link_vtt": number
        }
      }
    ],
    "recommendations": [
      {
        "severity": "high" | "medium" | "low",
        "table_slug": string,
        "table_title": string,
        "message": string
      }
    ]
  }
  ```
- **Comportamento:**
  - Busca todas as mesas ativas/full do GM
  - Agrega métricas (views, clicks, contacts, favorites)
  - Calcula CTR (click-through rate) e taxa de contato
  - Busca breakdown de cliques por variant (refactored_v4, cta_entrar, link_vtt)
  - Gera recomendações baseadas em performance
- **Resposta erro:** `{ error: string }` (404 se perfil não encontrado)

### GM - Perfil Público (`routes/gm.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:slug` | ✅ Em Uso | useMestre.ts, MestrePage.tsx |
| **POST** | `/:slug/view` | ✅ Em Uso | MestrePage.tsx |
| **GET** | `/:slug/insights` | ✅ Em Uso | useMestreInsights.ts, MestrePage.tsx |
| **POST** | `/:slug/contact` | ✅ Em Uso | MestreContactForm.tsx |
| **POST** | `/:slug/contact-click` | ✅ Em Uso | useTracking.ts |

**Campos retornados por `GET /:slug`:**
- Perfil: `id`, `slug`, `display_name`, `bio_long`, `tagline`, `avatar_url`, `banner_url`, `languages`, `specialties`, `badges`, `selling_points`, `promo_badge_text`
- Prova social: `discord_connected`, `discord_username`, `covil_verified`, `experience_years`, `average_price`, `tables_count`, `avg_rating`, `reviews_count`
- Grupo fechado: `closed_group` (objeto com `enabled`, `systems`, `description`, `min_price_cents`)
- **VTT Platforms preferidas:** `preferred_vtt_platforms` (Array<{id, name, slug, logo_filename, website_url}>) — Plataformas que o mestre usa/prefere
- **Contatos:** `contact_methods` (Array<{channel, value, label?, discord_server_url?}>) — Múltiplos contatos do mestre (WhatsApp, Email, Discord, Formulário)
- Links: `links` (Array com metadata Open Graph enriquecida)
- Mesas: `tables` (Array com `system_name`, `system_slug`, `system_logo_filename`, `system_website_url`, `vtt_platform` completo, `contacts`)
- Contexto: `viewer_context` ({is_owner, is_admin})

**Detalhes de `POST /:slug/contact`:**
- **Middleware:** `publicRateLimiter` (proteção contra spam)
- **Body obrigatório:** `{ name: string, email: string, message: string }`
- **Validações:**
  - `name`: obrigatório, máximo 100 caracteres
  - `email`: obrigatório, formato válido (regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`)
  - `message`: obrigatório, máximo 1000 caracteres
- **Comportamento:**
  - Busca email do mestre via slug
  - Retorna 404 se mestre não encontrado
  - Retorna 400 se validação falhar
  - **Status atual:** Apenas registra no console (TODO: implementar envio real de email)
- **Resposta sucesso:** `{ success: true, message: string }`
- **Resposta erro:** `{ error: string }`

**Detalhes de `POST /:slug/contact-click`:**
- **Middleware:** `publicRateLimiter`
- **Body obrigatório:** `{ channel: string }`
- **Validações:**
  - `channel`: deve ser um de: 'whatsapp', 'email', 'discord', 'form'
  - `slug`: formato válido (alfanumérico com hífens)
- **Comportamento:**
  - Busca perfil GM pelo slug
  - Registra clique no console (TODO: salvar em tabela gm_contact_clicks para analytics)
  - Retorna 404 se mestre não encontrado
- **Resposta sucesso:** `{ success: true }`
- **Resposta erro:** `{ error: string }`

### TABLES - Tracking (`routes/tables.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **POST** | `/:slug/click` | ✅ Em Uso | TableCard.tsx, TableActionPanel.tsx, useTracking.ts, uiHelpers.ts |
| **POST** | `/:slug/view` | ✅ Em Uso | MesaPage.tsx |
| **POST** | `/:slug/contact` | ❌ Não existe no Back | - |
| **POST** | `/:slug/favorite` | ❌ Não existe no Back | - |
| **POST** | `/tables/:slug/click` | ❌ Não existe no Back (path legado incorreto) | - |
| **POST** | `/tables/:slug/view` | ❌ Não existe no Back (path legado incorreto) | - |
### ADMIN (`routes/adminTables.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **PUT** | `/admin/tables/:id` | ✅ Em Uso | GestaoPage.tsx, PainelMestrePage.tsx |
| **DELETE** | `/admin/tables/:id` | ✅ Em Uso | GestaoPage.tsx |

### ADMIN DISCORD SYNC (`routes/adminDiscordSync.ts`)
> Auth: `authMiddleware` + `role === 'admin'` em todas as rotas.

| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/admin/discord-sync/settings` | 🔧 Impl. | DiscordSettingsPanel.tsx — status mascarado do token do bot |
| **PUT** | `/admin/discord-sync/settings/bot-token` | 🔧 Impl. | DiscordSettingsPanel.tsx — salva token cifrado |
| **DELETE** | `/admin/discord-sync/settings/bot-token` | 🔧 Impl. | DiscordSettingsPanel.tsx — remove token salvo |
| **GET** | `/admin/discord-sync/discovery/guilds` | 🔧 Impl. | DiscordSourceList.tsx — lista servidores acessíveis ao bot |
| **GET** | `/admin/discord-sync/discovery/guilds/:guildId/channels` | 🔧 Impl. | DiscordSourceList.tsx — lista canais textuais/announcement/forum do servidor; retorna `kind` (`text`, `announcement`, `forum`) |
| **GET** | `/admin/discord-sync/sources` | 🔧 Impl. | DiscordSourceList.tsx |
| **POST** | `/admin/discord-sync/sources` | 🔧 Impl. | DiscordSourceList.tsx — aceita `channel_type` opcional (`text`, `announcement`, `forum`) |
| **PATCH** | `/admin/discord-sync/sources/:id` | 🔧 Impl. | DiscordSourceList.tsx |
| **DELETE** | `/admin/discord-sync/sources/:id` | 🔧 Impl. | DiscordSourceList.tsx |
| **POST** | `/admin/discord-sync/fetch` | 🔧 Impl. | DiscordSyncPanel.tsx — dispara ingestão REST de canal textual/anúncio ou varredura de posts/threads de fórum; aceita `since`/`until` para janela temporal |
| **POST** | `/admin/discord-sync/sources/:sourceId/reingest-force` | 🔧 Impl. | DiscordSyncPanel.tsx — reingere uma fonte após apagar mensagens não sincronizadas |
| **GET** | `/admin/discord-sync/messages` | 🔧 Impl. | DiscordSyncPanel.tsx — filtros: `source_id`, `status`, `limit`, `offset`; mensagens de fórum incluem `discord_thread_id`, `discord_parent_channel_id`, `discord_thread_name` |
| **PATCH** | `/admin/discord-sync/messages/:id` | 🔧 Impl. | DiscordSyncPanel.tsx — atualiza status de triagem da mensagem importada |
| **POST** | `/admin/discord-sync/messages/:id/diagnose-content` | 🔧 Impl. local | DiscordSyncPanel.tsx — consulta a API Discord para comparar tamanho do corpo no banco vs API e diagnosticar `MESSAGE_CONTENT`/permissões sem expor token |
| **POST** | `/admin/discord-sync/messages/:id/parse` | 🔧 Impl. | DiscordSyncPanel.tsx — parseia uma mensagem e cria/atualiza draft idempotente |
| **POST** | `/admin/discord-sync/messages/parse-batch` | 🔧 Impl. | DiscordSyncPanel.tsx — processa mensagens pendentes/erro em lote |
| **GET** | `/admin/discord-sync/drafts` | 🔧 Impl. | DiscordDraftReviewTable.tsx — filtros: `status`, `limit`, `offset` |
| **GET** | `/admin/discord-sync/drafts/:id` | 🔧 Impl. | DiscordDraftPreview.tsx |
| **GET** | `/admin/discord-sync/image-uploads/summary` | 🔧 Impl. | DiscordDraftPreview.tsx — resumo operacional dos uploads de imagem (`pending`, `success`, `expired_url`, `network`, `cloudinary`, `permanent_fail`) |
| **PATCH** | `/admin/discord-sync/drafts/:id` | 🔧 Impl. | DiscordDraftPreview.tsx — edita `normalized_payload`, `status`, `review_notes`; usado pelo editor estruturado para salvar campos e marcar `ready` somente quando completo |
| **POST** | `/admin/discord-sync/drafts/:id/refresh-image` | 🔧 Impl. | DiscordDraftPreview.tsx — força novo download da imagem Discord e upload para Cloudinary; atualiza `cover_url` e `banner_url` se houver mesa sincronizada |
| **POST** | `/admin/discord-sync/drafts/:id/reparse` | 🔧 Impl. | DiscordDraftPreview.tsx — reprocessa mensagem pelo parser e atualiza draft |
| **POST** | `/admin/discord-sync/drafts/:id/sync` | 🔧 Impl. | DiscordDraftPreview.tsx — sincroniza draft para `tables` em status `draft`; retorna 422 se status não for `ready` ou se faltarem título, descrição, sistema, tipo, modalidade, preço, vagas, contato, dia ou horário |
| **POST** | `/admin/discord-sync/sync-ready` | 🔧 Impl. | DiscordSyncPanel.tsx — sincroniza todos os drafts `ready` em lote, respeitando a mesma validação de campos obrigatórios |

### ACTIVITYLOG (`routes/activityLog.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/admin/activity` | ✅ Em Uso | ActivityPanel.tsx via useActivityLog.ts |

### LINKS (`routes/links.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/links` | ✅ Em Uso | useLinks.ts, LinksManager.tsx — retorna `metadata_status`, `metadata_fetched_at`, `metadata_last_accessed_at` para exibição de estados de cache OG |
| **POST** | `/links` | ✅ Em Uso | useLinks.ts, LinksManager.tsx — cria link com `metadata_status = 'pending'` e aciona worker assíncrono via trigger "fire-and-forget" |
| **DELETE** | `/links/:id` | ✅ Em Uso | useLinks.ts, LinksManager.tsx |
| **PATCH** | `/links/reorder` | ✅ Em Uso | useLinks.ts, LinksManager.tsx |

**Campos de Metadata Open Graph (migration_109 - Abril/2026):**
- `metadata_status` — Estado do processamento: `pending` (aguardando), `success` (enriquecido), `failed` (erro após retries), `stale` (expirado por inatividade)
- `metadata_fetched_at` — Timestamp do último fetch bem-sucedido
- `metadata_last_accessed_at` — Última exibição do link (throttle de 6h para evitar sobrecarga no banco)
- `metadata_fail_count` — Contador de falhas consecutivas (retry escalonado: 1h → 6h → 1d → 3d → 1w → 2w)
- `metadata_next_retry_at` — Próxima tentativa de retry (backoff exponencial)
- `title` — Título extraído via Open Graph ou fallback (hostname)
- `description` — Descrição extraída via Open Graph (não exibida para redes sociais protegidas)
- `thumbnail_url` — URL da thumbnail (filtrada para `fbcdn.net`, `cdninstagram.com`, `twimg.com`, `tiktokcdn.com`)

**Worker Assíncrono:**
- Script: `backend/src/scripts/processLinkMetadataJobs.ts`
- Trigger: "fire-and-forget" em `POST /links`, `GET /links` e `GET /gm/:slug`
- Timeout: 2s por requisição HTTP
- Limite: 128KB de body
- Cleanup: `cleanupLinkMetadataCache.ts` (diário em produção) — remove cache pesado após 30 dias de inatividade

### ME (`routes/me.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | AuthContext.tsx, OnboardingPage.tsx |
| **GET** | `/options` | ✅ Em Uso | AuthContext.tsx, OnboardingPage.tsx |
| **PUT** | `/preferences` | ✅ Em Uso | AuthContext.tsx, OnboardingPage.tsx |

### NOTIFICATIONS (`routes/notifications.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | NotificationBell.tsx |
| **PATCH** | `/:id/read` | ✅ Em Uso | NotificationBell.tsx |

### PROFILE (`routes/profile.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:username` | ❌ Não existe no Back | PlayerPage.tsx usa `/api/v1/profile/${username}` |
| **GET** | `/me` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts |
| **PATCH** | `/me` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **PATCH** | `/me/profile` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **PATCH** | `/me/player` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **PATCH** | `/player` | ✅ Em Uso | useProfileQuery.ts, PlayerPage.tsx |
| **PATCH** | `/me/gm` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **PATCH** | `/gm` | ✅ Em Uso | useProfileQuery.ts, PlayerPage.tsx |
| **POST** | `/me/systems` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **POST** | `/systems` | ✅ Em Uso | useProfileQuery.ts, PlayerPage.tsx |
| **DELETE** | `/me/systems/:id` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **DELETE** | `/systems/:id` | ✅ Em Uso | useProfileQuery.ts, PlayerPage.tsx |
| **GET** | `/me/discord` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **POST** | `/me/connect/discord` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **DELETE** | `/me/connect/discord` | ✅ Em Uso | useProfile.ts, useProfileQuery.ts, PlayerPage.tsx |
| **POST** | `/me/google-picture` | ✅ Em Uso | ProfileEditPage.tsx — Busca foto atual do Google OAuth usando refresh_token e atualiza avatar_url automaticamente |

### SCENARIOS (`routes/scenarios.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | ScenarioEditModal.tsx, ScenarioSelector.tsx, CreateTableForm.tsx, GestaoPage.tsx |
| **GET** | `/:id` | ✅ Em Uso | ScenarioEditModal.tsx, ScenarioSelector.tsx, CreateTableForm.tsx, GestaoPage.tsx |
| **POST** | `/admin` | ✅ Em Uso | ScenarioEditModal.tsx, ScenarioSelector.tsx, CreateTableForm.tsx, GestaoPage.tsx |
| **PUT** | `/admin/:id` | ✅ Em Uso | ScenarioEditModal.tsx, ScenarioSelector.tsx, CreateTableForm.tsx, GestaoPage.tsx |
| **DELETE** | `/admin/:id` | ✅ Em Uso | ScenarioEditModal.tsx, ScenarioSelector.tsx, CreateTableForm.tsx, GestaoPage.tsx |

### SETTINGS (`routes/settings.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/suggest-styles` | ✅ Em Uso | SettingStylesField.tsx |

### SYSTEMS (`routes/systems.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | SystemEditModal.tsx, UserSystemsSelector.tsx, CreateTableForm.tsx, SystemsPage.tsx, SystemsTree.tsx, useSystems.ts, CatalogoPage.tsx — Query params: `view` (tree/flat), `search`, `limit`, `cursor`; retorna contadores agregados: `children_count`, `tables_count`, `aliases_count` (adicionados em 18/04/2026 para UX BigTech) |
| **POST** | `/admin` | ✅ Em Uso | SystemEditModal.tsx, UserSystemsSelector.tsx, CreateTableForm.tsx, SystemsPage.tsx, SystemsTree.tsx, useSystems.ts, CatalogoPage.tsx — Aceita `logo_filename` e `website_url` (apenas para `node_type='system'`) **[NOVO 18/04/2026]** |
| **PUT** | `/admin/:id` | ✅ Em Uso | SystemEditModal.tsx, UserSystemsSelector.tsx, CreateTableForm.tsx, SystemsPage.tsx, SystemsTree.tsx, useSystems.ts, CatalogoPage.tsx — Aceita `logo_filename` e `website_url` (apenas para `node_type='system'`) **[NOVO 18/04/2026]** |
| **DELETE** | `/admin/:id` | ✅ Em Uso | SystemEditModal.tsx, UserSystemsSelector.tsx, CreateTableForm.tsx, SystemsPage.tsx, SystemsTree.tsx, useSystems.ts, CatalogoPage.tsx |

**Divergência Front x Back (confirmada):**
- Frontend (`CatalogoPage.tsx`) ainda chama `GET /api/v1/systems/tree`.
- Backend **não** expõe `/api/v1/systems/tree`; a forma suportada é `GET /api/v1/systems?view=tree`.

**Campos retornados por `GET /`:**
- `id`, `name`, `name_pt`, `slug`, `parent_id`, `node_type`, `depth`, `path_slug`
- `logo_filename` — String | null (nome do arquivo em `/sys-logos/`, ex: `dnd.svg`) **[NOVO 18/04/2026]**
- `website_url` — String | null (URL oficial do sistema) **[NOVO 18/04/2026]**
- `aliases` — Array de strings (aliases do sistema)
- `has_children` — Boolean (se tem filhos)
- `children_count` — Number (quantidade de sistemas filhos) **[NOVO 18/04/2026]**
- `tables_count` — Number (quantidade de mesas usando o sistema) **[NOVO 18/04/2026]**
- `aliases_count` — Number (quantidade de aliases cadastrados) **[NOVO 18/04/2026]**
- `children` — Array recursivo (só em `view=tree`)

**Campos aceitos por `POST /admin` e `PUT /admin/:id`:**
- **Obrigatórios:** `name` (string), `node_type` (string: 'system' | 'edition' | 'variant' | 'subsystem')
- **Opcionais:** `name_pt` (string | null), `parent_id` (uuid | null), `aliases` (string[])
- **Opcionais (apenas `node_type='system'`):** `logo_filename` (string | null), `website_url` (string | null)

### SYSTEMSUGGESTIONS (`routes/systemSuggestions.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **POST** | `/` | ✅ Em Uso | SystemSuggestionModal.tsx, StepSystem.tsx |
| **GET** | `/mine` | ❌ Pendente/Front | - |

### SCENARIOSUGGESTIONS (`routes/scenarioSuggestions.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **POST** | `/` | ✅ Em Uso | ScenarioSuggestionModal.tsx, StepSystem.tsx |
| **GET** | `/mine` | ❌ Pendente/Front | - |

### SYSTEMSUGGESTIONSADMIN (`routes/systemSuggestionsAdmin.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/system-suggestions` | ✅ Em Uso | GestaoPage.tsx — Query params: `status` (pending/approved/rejected/all); retorna sugestões com `node_type`, `rejection_reason`, `user_notified` |
| **PATCH** | `/system-suggestions/:id/approve` | ✅ Em Uso | GestaoPage.tsx — Materializa sugestão em `systems` + `system_aliases`, cria notificação com `action_url` e `metadata`; retorna `{ success: true, data: { suggestion_id, system_id, path_slug } }` |
| **PATCH** | `/system-suggestions/:id/reject` | ✅ Em Uso | GestaoPage.tsx — Atualiza status para 'rejected' + `rejection_reason` opcional, cria notificação; aceita `{}` para descarte rápido individual ou em lote; retorna `{ success: true }` |

**Campos de notificação (migration_106 - Abril/2026):**
- `action_url` — URL de ação (ex: `/catalogo?system=[path_slug]`)
- `metadata` — JSONB com `suggestion_id`, `suggestion_kind`, `system_id`, `path_slug`, `reason` (em rejeição)

### SCENARIOSUGGESTIONSADMIN (`routes/scenarioSuggestionsAdmin.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/scenario-suggestions` | ❌ Pendente/Front | - |
| **PATCH** | `/scenario-suggestions/:id/approve` | ❌ Pendente/Front | - |
| **PATCH** | `/scenario-suggestions/:id/reject` | ❌ Pendente/Front | - |

### TABLES (`routes/tables.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | TableCard.tsx, uiHelpers.ts, useFetchTables.ts, GestaoPage.tsx, MesaPage.tsx, PainelMestrePage.tsx, catalogService.ts — retorna `cover_url` (alias de `banner_url`) + objeto `vtt_platform` (`logo_filename` incluso) para render da logo no catálogo |
| **GET** | `/:slug` | ✅ Em Uso | TableCard.tsx, uiHelpers.ts, useFetchTables.ts, GestaoPage.tsx, MesaPage.tsx, PainelMestrePage.tsx, catalogService.ts — retorna `cover_url` (alias de `banner_url`), `vtt_platform` completo e comunicação resolvida (`COALESCE(cp.name, t.communication_platform)`) |
| **POST** | `/:slug/view` | ✅ Em Uso | TableCard.tsx, useFetchTables.ts, GestaoPage.tsx, MesaPage.tsx, PainelMestrePage.tsx, catalogService.ts |
| **POST** | `/:slug/click` | ✅ Em Uso | TableCard.tsx, uiHelpers.ts, useFetchTables.ts, GestaoPage.tsx, MesaPage.tsx, PainelMestrePage.tsx, catalogService.ts |

### TABLESCHEDULES (`routes/tableSchedules.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:tableId/schedules` | ❌ Pendente/Front | - |
| **POST** | `/:tableId/schedules` | ❌ Pendente/Front | - |
| **PUT** | `/:tableId/schedules/:id` | ❌ Pendente/Front | - |
| **DELETE** | `/:tableId/schedules/:id` | ❌ Pendente/Front | - |

### TABLES - Rotas Públicas (`routes/tables.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | CatalogoPage.tsx, useTables.ts, useFetchTables.ts, catalogService.ts — Catálogo público de mesas ativas. Query params: `system`, `modality`, `type`, `audience`, `price_type`, `experience_level`, `state`, `city`, `featured`, `search`, `seal`, `sort`, `page`, `limit`, `styles` |
| **GET** | `/:slug` | ✅ Em Uso | MesaPage.tsx, useMesa.ts, TableCard.tsx — Detalhes de mesa individual |
| **POST** | `/:slug/view` | ✅ Em Uso | MesaPage.tsx — Registra visualização para métricas |
| **POST** | `/:slug/click` | ✅ Em Uso | TableCard.tsx, useTracking.ts, uiHelpers.ts — Registra clique para CTR tracking |
| **POST** | `/:id/contact` | ❌ Não existe no Back | - |
| **POST** | `/:id/favorite` | ❌ Não existe no Back | - |

**Campos retornados por `GET /` (catálogo):**
- Identificação: `id`, `slug`, `title`, `description`
- Sistema: `system_name`, `system_slug`, `system_logo_filename` **[NOVO 18/04/2026]**, `system_website_url` **[NOVO 18/04/2026]**
- Mestre: `gm_slug`, `gm_avatar_url`, `gm_display_name`, `gm_badges`
- Vagas: `slots_total`, `slots_filled`, `slots_open`
- Preço: `price_type`, `price_value`
- Modalidade: `modality`, `vtt_platform` (objeto com `id`, `name`, `slug`, `logo_filename`, `website_url`), `game_platform_custom`
- Metadados: `status`, `type`, `audience`, `experience_level`, `language`, `featured`, `is_ddal`, `is_covil`
- Cenário: `setting_name`, `setting_styles`, `synopsis_narrative`
- Imagem: `cover_url`, `cover_crop_data`
- Contatos: `contacts[]` (array de objetos com `channel`, `value`, `label`, `discord_server_url`, `sort_order`)

**Campos retornados por `GET /:slug` (detalhes):**
- Todos os campos do catálogo +
- Detalhes: `price_frequency`, `starts_at`, `city`, `state`, `content_warnings`, `safety_tools`
- Cenário: `scenario_name`
- Horários: `schedules[]` (array de objetos TableSchedule)
- Comunicação: `communication_platform`
- Campos avançados: `master_display_name`, `campaign_length`, `level_range`, `billing_text`, `session_zero_free`, `synopsis`, `style_text`, `listing_excerpt`, `technical_requirements`, `requires_pc`, `requires_camera`, `requires_microphone`
- Campos editoriais: `synopsis_narrative`, `benefits_text`, `table_gm_bio`
- DDAL: `ddal_code`, `ddal_name`, `ddal_tier`, `ddal_season`, `ddal_duration`, `ddal_format`, `ddal_org_code`, `ddal_setting`, `ddal_rules_notes`

### COMMUNICATIONPLATFORMS (`routes/communicationPlatforms.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | useCommunicationPlatforms.ts, StepConfig.tsx, CreateTableForm.tsx |
| **GET** | `/admin` | ✅ Em Uso | PlatformsPage.tsx (GestaoPage.tsx > subaba Plataformas) |
| **POST** | `/admin` | ✅ Em Uso | PlatformsPage.tsx (criação) |
| **PUT** | `/admin/:id` | ✅ Em Uso | PlatformsPage.tsx (edição + toggle de status) |
| **DELETE** | `/admin/:id` | ✅ Em Uso | PlatformsPage.tsx (remoção) |

### VTTPLATFORMS (`routes/vttPlatforms.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/` | ✅ Em Uso | useVttPlatforms.ts, StepConfig.tsx, CreateTableForm.tsx, PlatformsPage.tsx — catálogo retorna `logo_filename` para render da identidade visual (`/vtt-logos/{logo_filename}`) |
| **POST** | `/suggest` | ❌ Pendente/Front | - |
| **GET** | `/admin` | ✅ Em Uso | PlatformsPage.tsx (GestaoPage.tsx > subaba Plataformas) |
| **POST** | `/admin` | ✅ Em Uso | PlatformsPage.tsx (criação) |
| **PUT** | `/admin/:id` | ✅ Em Uso | PlatformsPage.tsx (edição + toggle de status) |
| **DELETE** | `/admin/:id` | ✅ Em Uso | PlatformsPage.tsx (remoção) |

### UPLOAD (`routes/upload.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **POST** | `/upload` | ✅ Em Uso | ImageUploader.tsx, AvatarUploader.tsx, ProfileEditPage.tsx — upload de imagem via backend com Cloudinary signed (substitui upload direto unsigned) |

### OG (`routes/og.ts`)
| Metodo | Endpoint | Status | Chamado por (Frontend) |
|---|---|---|---|
| **GET** | `/:type/:slug` | ✅ Em Uso | Crawlers de redes sociais (Facebook, Twitter, WhatsApp, Discord) via proxy Nginx — rota extensível com switch case para diferentes tipos de entidades |
| **GET** | `*` | ✅ Em Uso | Fallback para rotas não mapeadas — retorna meta tags genéricas do site |

**Tipos suportados em `/:type/:slug`:**
- `mestre` — Perfil de mestre (`/og/mestre/:slug`) — consulta `gm_profiles` e injeta meta tags OG dinâmicas
- Futuros: `mesa`, `evento`, etc.

**Fluxo:**
1. Nginx detecta user-agent de crawler (facebookexternalhit, Twitterbot, etc.)
2. Nginx redireciona `/mestre/:slug` → `/og/mestre/:slug` via proxy
3. Backend consulta banco de dados baseado no `type`
4. Backend injeta meta tags Open Graph dinâmicas no `index.html`
5. Retorna HTML completo com meta tags personalizadas

**Referência:** Ver `.specify/arquiteture.md` §17 para detalhes completos da implementação.
