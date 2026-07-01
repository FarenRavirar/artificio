# Investigação — Notificações + Config do Bot/Import (057)

## A. Notificações — funcionam? (evidência beta, read-only)

`docker exec mesas-beta-db psql` (2026-06-30):
```
total=42  unread=42  users=1  last=2026-06-29 12:16
por tipo: suggestion_approved=23, suggestion_rejected=19
admins=1
```

**Veredito: o sino do ADMIN está efetivamente morto, por design + single-user.**
- As 42 notificações são **resultado endereçado ao sugeridor** (`suggestion_approved/rejected`). O sino do admin (`NotificationBell.tsx:43-50`) só mostra `ADMIN_VISIBLE_TYPES` = {`system_suggestion`,`system`,`scenario_suggestion`,`table_published`,`member_joined`} → **nenhuma das 42 casa** → admin sempre vê "Nenhuma notificação".
- **Causa 1 (estrutural):** `notifyAdmins` (`services/adminNotifications.ts:26`) insere p/ cada admin **exceto `excludeUserId`** (o autor da ação). Tu és o **único admin E o único sugeridor** → toda sugestão tua se auto-exclui → 0 notificações de admin geradas.
- **Causa 2 (cobertura):** tipos `table_published`/`member_joined`/`dev_feedback` têm **0 linhas** — provavelmente nunca inseridos (sem call site de `notifyAdmins` p/ esses eventos). `dev_feedback` nem está nos tipos visíveis do sino.
- Mecanismo base OK: rota GET filtra por `user_id`, `read` tem default (migration 106), inserts acontecem. Não é bug de query; é **lógica de audiência + cobertura de eventos**.

**Correções propostas (R14):**
1. Decisão de produto: o que o admin quer ver? (a) eventos da plataforma (mesa publicada, novo membro, feedback) e/ou (b) as próprias sugestões mesmo sendo autor. Hoje (a) está sem emissor e (b) é auto-excluída.
2. Se single-admin: ou remover o `excludeUserId` quando o autor é admin, ou popular `table_published`/`member_joined`/`dev_feedback` de fato.
3. Incluir `dev_feedback` nos tipos visíveis (ou decidir que não aparece).
4. Sino usa `bg-blue-500/10` e `#1B2A4A` hardcoded → tokens (R11).

## B. Campos para Bot + Import funcionarem (tudo via frontend, sem VM write)

### Via A — Bot ao vivo (Discord API) — JÁ multi-canal, JÁ frontend
| Campo | Onde | Obrigatório | Persistência |
|---|---|---|---|
| Bot token | `PUT /admin/discord/settings/bot-token` (key `bot_token`, encriptado) | sim | `discord_settings` (DB) |
| Canais monitorados (N) | `POST /admin/discord/sources` (`guild_id`+`channel_id`+`channel_type`) | sim (≥1) | `discord_import_sources` (DB) — **vários** |
| Descoberta de guilds/canais | `GET /discovery/guilds[/:id/channels]` (usa bot token) | — | — |
| (legado, env) | `DISCORD_GUILD_ID`, `DISCORD_SYNC_ALLOWED_CHANNEL_IDS` | não | env (fallback) |

→ Via A já atende "perfis/multi-canal via frontend". Falta só **UI boa** (R5/R6).

### Via B — DiscordChatExporter (export histórico/agendado) — HOJE PERFIL ÚNICO
Config = 1 linha `discord_settings` (`guild_id=null`), chaves `chat_exporter_config`/`_token`/`_cookies`.
| Campo | Schema (`chatExporterAutomation.ts`) | Obrigatório | Persistência |
|---|---|---|---|
| `token` (Discord) | `min(10)`, encriptado | sim | DB (key `chat_exporter_token`) |
| `cookies` | `min(3)`, encriptado | não | DB (key `chat_exporter_cookies`) |
| `channelId` | `\d{5,30}` | sim | DB (config JSON) |
| `importDir` | path servidor, `min(1)` | sim | DB (config JSON) |
| `after` | data | não | DB |
| `enabled`/`frequency`/`time`/`timezone` | agenda | — | DB |
| Binário CLI | `DISCORD_CHAT_EXPORTER_BIN` | server-only | **env** (nunca payload — segurança) |
| Retention | `DISCORD_CHAT_EXPORTER_RETENTION` | server-only | const |

**Gap (R13):** Via B só guarda **1** `channelId`/`token`/`importDir`. Para múltiplos canais com perfis distintos (token/cookies/agenda por canal), precisa de **tabela de perfis** (ex.: `discord_chat_exporter_profiles`: id, label, channelId, token_enc, cookies_enc, importDir, schedule, enabled) em vez da linha única `guild_id=null`. Migração aditiva, sem VM write; UI = lista de perfis (criar/editar/testar/run por perfil). Token/cookies seguem encriptados no DB via frontend PUT.

**Importante:** `importDir` é uma pasta no servidor, mas é só um **nome** setado via frontend (o backend faz `mkdir -p incoming/`). Não há escrita manual na VM — o run cria a estrutura. Único pré-requisito de VM real = o **binário** `DiscordChatExporter.Cli` instalado + `DISCORD_CHAT_EXPORTER_BIN` no env (infra, fora do frontend por segurança). Isso é setup de deploy (spec 052 Bloco A / TA3-TA8), não config de uso diário.

## C. Impacto na spec 057
- Nova R13 (perfis multi-canal Via B) + R14 (notificações do admin) adicionadas a `spec.md`.
- Bot › Configuração (R5) passa a contemplar: Via A (bot token + sources) **e** Via B (lista de perfis ChatExporter).
- Débitos DEB-057-06 (notificações admin mortas) + DEB-057-07 (ChatExporter perfil único) registrados.
