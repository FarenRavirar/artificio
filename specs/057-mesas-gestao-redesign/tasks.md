# Tasks — 057 Redesign da gestão do mesas

> Fase 0 e 1 = entregável desta abertura (investigação+plano). Fases 2+ ficam **bloqueadas** até aprovação nominal do plano/IA.

## Fase 0 — Mapeamento (investigação) — ✅ CONCLUÍDA → `inventario.md`

- [x] T0.1 — Inventário de telas/painéis de `/gestao`. · `inventario.md` §1/§2 (6 Sections + 3 árvores: features/admin, modules/admin, features/discord-sync+inbox).
- [x] T0.2 — Mapa de endpoints admin (back via api-governance) × chamadas reais (front via rg). · `inventario.md` §3/§4: 163 rotas mesas, classificação ✅/👻/🔧/⚠️. Órfãos: `admin/users*`, `setting-suggestions*`, `discord/drafts/:id/refresh-image`, `import-json/reparse`, `import/metrics` (wrapper sem caller).
- [x] T0.3 — Ruído `Cancelando requisição duplicada`. · `inventario.md` §6: 3 GETs no mount do DashboardSection/GestaoLayout; corrigir centralizando pendências numa query única.
- [x] T0.4 — 2 sistemas de draft. · `inventario.md` §5: `discord_import_messages` (mensagens) vs `discord_import_table_drafts` unificado consumido por discordSyncApi + inboxApi.
- [x] T0.5 — Duplicação features/admin × modules/admin. · `inventario.md` §2/§7.

## Fase 1 — Proposta de IA + melhores práticas — ✅ CONCLUÍDA → `proposta-ia.md`

- [x] T1.1 — Sidebar nova completa (Cloudflare-like), Moderação→Mesas, Integrações→Importação. · `proposta-ia.md` §2/§3.
- [x] T1.2 — Bot de Discord (Configuração/Importação/Relatórios) com endpoints por aba. · §4.
- [x] T1.3 — Mesas central = fila unificada (filtros/status/lote/origem). · §5.
- [x] T1.4 — Dashboard (Visão geral) enxuto. · §3 + cards em §1/§6.
- [x] T1.5 — Unificação das 2 árvores (§9) + disposição dos órfãos (§6, R10). 
- [x] T1.6 — Fases 2+ rascunhadas (abaixo).
- [x] T1.7 — Backlog + project-state atualizados (`BL-057-GESTAO-REDESIGN`).

## Gate de aprovação
- [x] G1 — **APROVADO (mantenedor, 2026-06-30):** IA 7 grupos ✅; R13 perfis multi-canal ✅; R14 notificações (sino só eventos de OUTROS: mesa publicada/membro/feedback) ✅; R15 tabela padrão ✅; Usuários = construir ✅; setting-suggestions = construir UI (não remover) ✅; import/metrics = remover ✅; ChatExporter = solução completa `chatexporter-solucao.md` ✅.
- [ ] G2 — Autorização nominal para **iniciar implementação** (Fase 2). Cada commit/push exige aprovação própria.

---

## Fases 2+ — Implementação (BLOQUEADAS até G1)

> Ordem evita retrabalho: fundação (tokens+árvore) → grupos um a um → limpeza de contrato → smoke. Cada fase = branch+PR próprio, lint+build verde, smoke beta. Nada de "parcial" como conclusão.

### Fase 2 — Fundação (tokens + componentes + sidebar)
- [x] T2.1 — **Tokens admin** em `index.css`: `--admin-rail`/`--admin-surface`/`--admin-hover` (dark + variante light), nomeando as cores de-facto (zero mudança visual). **Remoção dos hardcodes das Sections foi movida p/ as fases que reescrevem cada Section** (4-7) — evita mass-sed em arquivo que vai morrer (anti-retrabalho). tsc+lint ✅.
- [x] T2.2 — Primitivas `features/admin/components/ui/`: `PageHeader` (breadcrumb+título+ação), `MetricCard` (link opcional), `SectionCard`, `StatusPill` (tons semânticos) + `cn`. Tokens, sem hardcode. tsc+lint ✅. (Toolbar de filtro foi absorvida pelo `<AdminTable>`.) · adotadas nas fases dos grupos.
- [x] T2.4 — **(R15)** `<AdminTable>` canônico em `ui/AdminTable.tsx`: busca+facetas com **estado na URL** (namespace `tableId`), seleção múltipla + lote (`bulkDelete`/`bulkArchive` helpers), ações por linha `onOpen`/`onEdit`+extras, estados loading/erro/empty. Genérico (`<T>`), presentacional/controlado. tsc+lint ✅. Adoção por listas reais nas fases dos grupos.
- [x] T2.5 — **(R15 backend)** `POST /api/v1/admin/tables/batch` (`archive`/`unarchive`/`delete` por lista de ids, idempotente, logActivity) + `bulkActions` na tabela Mesas publicadas do Catálogo (arquivar/desarquivar/apagar-lote com confirm). Drafts/messages já tinham `/batch`; sugestões usam rejeição-em-lote por N chamadas (aceitável). `verify:api`: mesas +non-breaking. tsc+lint+build ✅. · feito (2026-06-30).
- [x] T2.3 — `AdminSidebar` nova (6 grupos §2: Visão geral·Mesas·Catálogo·Comunidade·Importação·Sistema) com token de marca correto (`--color-artificio-orange`; o antigo usava `--brand` inexistente → ativo quebrado) + roteamento novo em `App.tsx` (`visao-geral`/`mesas/:sub?`/`catalogo`/`importacao`; antigas `dashboard`/`conteudo`/`moderacao`/`integracoes` → `<Navigate replace>`). Sections atuais reusadas como conteúdo interino (sem stub, sem link morto). tsc+lint ✅. · **smoke beta** na T9.2 (rota auth-gated, precisa backend+sessão admin).

### Fase 3 — Unificar árvores (R9)
- [x] T3.1 — Mover `modules/admin/{activity,hydration,platforms,systems,dev-feedback}` p/ `features/admin/`; corrigir imports. · feito: árvore antiga removida, imports canônicos em `features/admin`, lint+build+test frontend ✅ (2026-06-30).

### Fase 4 — Visão geral (Dashboard) (R8)
- [x] T4.1 — Página única: MetricCards (mesas ativas via `/api/v1/tables`; drafts por status via `discord/metrics.totals`; última importação via `metrics.runs[0]`; pendências sugestões) + `ActivityPanel`. · feito: Dashboard sem abas/stubs/Alertas/Atalhos; cards reais + pendências + última importação + feed único (2026-06-30).
- [x] T4.2 — Centralizar contagem de pendências em `useQuery(['pendencias'])` compartilhada (corrige DEB-057-03). · feito: `useAdminPendencias` com `queryKey ['admin','pendencias']` consumido por `GestaoLayout` e `DashboardSection`; fetch duplicado removido (2026-06-30).

### Fase 5 — Mesas central (R4)
- [x] T5.1 — Grupo Mesas: tab Rascunhos (fila unificada origem/status/lote) + tab Mensagens. Reusa DiscordDraftReviewTable+MessagesView. · feito: `ModeracaoSection` virou página Mesas com PageHeader/SectionCard, tabs `rascunhos`/`mensagens`, deep links preservados, rascunhos com origem Bot/Exporter/Texto, status e lote via `drafts/batch`/`drafts/rejected`; mensagens com filtros e lote via `messages/batch` (2026-06-30). Smoke beta fica na T9.2.
- [x] T5.2 — Ligar `refresh-image` na ação por linha do Rascunho (órfão→usado). · feito: `discordSyncApi.refreshDraftImage` consome `POST /admin/discord/drafts/:id/refresh-image`; preview de draft Discord ganhou botão `Rebaixar imagem` com toast e re-GET do draft após sucesso/tentativa (2026-06-30). Smoke beta fica na T9.2.

> **Fronteira 052↔057 DECIDIDA (mantenedor, 2026-06-30):** 057 é dona de **tudo** no DiscordChatExporter — UI/perfis (T6.5/T6.7/T6.8) + bundle no image (T6.6) + **runner agendado** (T6.9, abaixo). O Bloco A da spec 052 referente a ingestão DCE é **absorvido aqui**; coordenar para não duplicar `discord_import_runs`/`_ai_suggestions` (a 052 segue dona da camada IA/shadow).

### Fase 6 — Importação + Bot de Discord (R5/R6/R7)
- [x] T6.1 — Grupo Importação: Bot de Discord (3 tabs) + Importar texto + Importar arquivo + Enriquecimento. · feito: `IntegracoesSection` reorganizada com PageHeader/SectionCard, Bot (`Configuração`/`Importação`/`Relatórios`), arquivo JSON, texto colado e enriquecimento alcançáveis (2026-06-30). Smoke beta fica na T9.2.
- [x] T6.2 — Bot › Configuração: form completo `chat-exporter/config` + bot-token + canais; **persistência round-trip** (re-GET reflete `updated_at`). · feito: config legada preservada (`GET/PUT /chat-exporter/config`) e perfis multi-canal adicionados em `Configuração`; API retorna config pública após salvar (2026-06-30). Smoke beta fica na T9.2.
- [x] T6.3 — Bot › Importação: dry-read delta por canal antes do `run`. · feito: `GET /admin/discord/chat-exporter/profiles/:id/delta` — compara maior snowflake importado (`discord_import_messages`) vs Discord API (`/channels/:id/messages?after=`, 1 página, teto 100); retorna `{ newCount, capped, afterMessageId }`. `discoverChannelDelta` em `discovery.ts`. Runtime real (bot token + canal) fica no smoke T9.2 (2026-06-30).
- [x] T6.4 — Bot › Relatórios: `IntegrationLogsView` ganhou filtro por origem (`source_kind`) + ordenação (mais recentes/antigas/mais falhas). tsc+lint+build ✅ (2026-06-30).
- [x] T6.5 — **(R13)** Perfis multi-canal ChatExporter: migração aditiva `discord_chat_exporter_profiles` (ver `chatexporter-solucao.md` §3) substituindo perfil único; rotas CRUD; `<AdminTable>` de perfis. token encriptado, importDir gerado pelo backend. · feito: migration 134 + tipos Kysely + rotas CRUD/test/run por perfil + UI `ChatExporterProfilesPanel`; token por perfil encriptado, fallback no token global, importDir gerado pelo backend; `verify:api` ok, sem VM write (2026-06-30). Smoke beta fica na T9.2.
- [x] T6.6 — **(ChatExporter na VM — Opção A)** Dockerfile `mesas-api` multi-stage: stage `discord-chat-exporter` copia CLI self-contained da image oficial pinada `tyrrrz/discordchatexporter:2.47.3` para `/opt/dce` (`COPY --from=discord-chat-exporter /opt/app /opt/dce` + `chmod +x`), `DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli`, libs Alpine (`icu-libs icu-data-full tzdata libstdc++`). · feito: deploy beta disparado (`deploy.yml` run 28535317924, module=mesas env=beta, `deploy=true`) e binário provado em runtime real (`docker exec mesas-beta-api /opt/dce/DiscordChatExporter.Cli --version` → `v2.47.3`) (2026-07-01). SDD Completo (image/deploy) cumprido. Ver `chatexporter-solucao.md` §2.
- [x] T6.7 — **(Wizard leigo)** `ChatExporterProfilesPanel` virou fluxo guiado 3 passos: **Conectar** (validar token → `discoverGuilds`, spinner, estado "nenhum servidor → convide o bot", link Discord Developer Portal) → **Canais** (dropdown servidor/canal + nome, aviso "sem canais legíveis = falta permissão") → **Agenda** (frequência/hora/token-por-perfil/ativo). Stepper com Voltar/Próximo, guard de avanço. Sem digitar ID cru. tsc+lint+build ✅ (2026-06-30).
- [x] T6.8 — **(Saúde)** Ação "Ver novidades" por perfil chama `getChatExporterProfileDelta` → mostra "N nova(s) a importar"/"Nada a atualizar" na coluna Saúde + toast; delta limpo após Importar agora. Última run/status/erro já existiam. Runtime real T9.2 (2026-06-30).
- [x] T6.9 — **(Runner agendado — absorvido da 052 Bloco A)** `runDiscordChatExporterSchedule.ts` lê perfis `schedule_enabled`+`enabled`, seleciona os prontos via `isProfileDue` (pura, testada: 11 casos frequência/hora/timezone/intervalo-mínimo) e dispara `runProfileExport` (service extraído, reusado pela rota). Registrado no `cronRunner.ts` (tick 5 min) + script `discord:chat-exporter-schedule`. Agenda = dado no DB, não crontab. Coordenado com 052 (mesmo `discord_import_runs`). Runtime beta + deploy do `mesas-cron` ficam gated (T9.2 / aprovação nominal) (2026-06-30).

### Fase 4b — Notificações do admin (R14)
- [x] T4.3 — **(R14 DECIDIDO)** Sino = {`table_published`,`dev_feedback`} (`member_joined` fora — sem mecanismo de membro no back). Implementar emissor real p/ `table_published` (na publicação de mesa) + `dev_feedback`; manter auto-exclusão do autor; `dev_feedback` nos tipos visíveis; remover `system_suggestion`/`scenario_suggestion` do sino; tokens no `NotificationBell` (remove `#1B2A4A`/`bg-blue-500/10`). · feito: `gmPanel` já emitia `table_published` com auto-exclusão para mestre não-admin; `devFeedback` já emitia `dev_feedback` com auto-exclusão e agora aponta para `/gestao/sistema`; `NotificationBell` mostra só `table_published`/`dev_feedback` para admin e usa tokens semânticos, sem os hardcodes citados (2026-06-30). Smoke beta fica na T9.2.

### Fase 7 — Catálogo + Comunidade + Sistema
- [x] T7.1 — Catálogo (Sistemas/Plataformas/Cenários/Mesas publicadas) com PageHeader+tabs. · feito: `ConteudoSection` virou Catálogo com tabs Sistemas/Plataformas/Cenários/Estilos por cenário/Mesas publicadas, preservando views existentes e CRUD de mesas publicadas (2026-06-30). Smoke beta fica na T9.2.
- [x] T7.2 — **Sistema › Usuários (DECIDIDO: construir)**: lista `admin/users` com `<AdminTable>` (filtros, abrir/editar) + marcar Covil do Lich (`users/:id/covil`). · feito: backend `GET /admin/users` lista usuários reais com filtros `role`/`covil_verified`/`search`; `AdminUsersPanel` usa `<AdminTable>` e toggle Covil via `PATCH /users/:id/covil` (2026-06-30). Smoke beta fica na T9.2.
- [x] T7.3 — Sistema › Erros reportados (DevFeedback). Remover stubs jobs/logs/erros/config. · feito: `SistemaSection` ficou só com Usuários + Erros reportados, sem stubs "em breve", reusando `DevFeedbackPanel` real (2026-06-30).
- [x] T7.4 — **Catálogo › Estilos por cenário (DECIDIDO: construir)**: UI de `setting-suggestions` (`setting_style_suggestions`, CRUD já existe) com `<AdminTable>`. · feito: `SettingSuggestionsPanel` cria/edita/apaga sugestões de estilos por cenário via CRUD existente e usa `<AdminTable>` (2026-06-30). Smoke beta fica na T9.2.

### Fase 8 — Limpeza de contrato (R10)
- [x] T8.1 — **`import/metrics` removido** (`GET /admin/import/metrics`): mount em `adminImportInbox.ts` + arquivo `inbox/metrics.ts` + bloco de teste + path no `mesas.openapi.yaml`. Verificado órfão (0 caller frontend) e redundante com `GET /admin/discord/metrics` (mesma `total_corrections`/campos). **`import-json/reparse` MANTIDO:** não é redundante com `drafts/:id/reparse` — reprocessa `discord_import_messages` em lote (mensagens cruas por `messageIds`), não draft único; funcional (DEB-048). `setting-suggestions`/`admin/users` mantidos (viraram UI, T7.4/T7.2). backend build+330 tests+lint ✅ (2026-06-30).
- [x] T8.2 — `pnpm api:bundle` (281 ops) + `pnpm verify:api` exit 0: mesas **breaking=1** = remoção intencional/aprovada do `import/metrics` (`path.remove`), non-breaking=6 (rotas novas das fases 5-7). Modo relatório, não bloqueia (2026-06-30).

### Fase 9 — Validação
- [ ] T9.1 — `pnpm run lint` + `pnpm run build` + testes afetados verdes.
- [ ] T9.2 — Smoke beta `mesasbeta` por grupo (navegação, persistência config, fila de drafts, importação). · feito quando: smoke registrado na sessão.
- [ ] T9.3 — Promote (gated por aprovação nominal).
