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
- [ ] T2.5 — **(R15 backend)** Criar endpoints faltantes de lote/arquivo conforme matriz §7.1 (mesas batch+archive, sugestões batch, notificações delete/archive, etc.); `verify:api` documenta breaking/non-breaking. **Nota (verificado 2026-06-30):** `tables` já tem `archived_at` + `status` + `tableArchiving.ts` → mesa só precisa de **batch** + UI, archive já existe. **Diferido p/ quando cada lista adotar `<AdminTable>` (fases 4-7) — cria-se o endpoint junto da UI que o usa.** · feito quando: cada lista da matriz tem apagar-lote e arquivar suportados no back.
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
- [ ] T6.1 — Grupo Importação: Bot de Discord (3 tabs) + Importar texto + Importar arquivo + Enriquecimento. · feito quando: cada item alcançável e funcional.
- [ ] T6.2 — Bot › Configuração: form completo `chat-exporter/config` + bot-token + canais; **persistência round-trip** (re-GET reflete `updated_at`). · feito quando: salvar→recarregar mantém valores.
- [ ] T6.3 — Bot › Importação: dry-read "a atualizar/desatualizados" por canal antes do `run`; filtros. · feito quando: contagem aparece antes de executar.
- [ ] T6.4 — Bot › Relatórios: `discord/metrics` com filtro/ordenação manipulável. · feito quando: ordenar/filtrar runs funciona.
- [ ] T6.5 — **(R13)** Perfis multi-canal ChatExporter: migração aditiva `discord_chat_exporter_profiles` (ver `chatexporter-solucao.md` §3) substituindo perfil único; rotas CRUD; `<AdminTable>` de perfis. token encriptado, importDir gerado pelo backend. · feito quando: 2+ perfis persistem/testam/rodam isolados; `verify:api` ok; sem VM write. **SDD Completo.**
- [ ] T6.6 — **(ChatExporter na VM — Opção A)** Dockerfile `mesas-api`(+base `mesas-cron`) multi-stage: stage sdk .NET faz `dotnet publish -r linux-musl-x64 --self-contained` da DCE na tag pinada → COPY p/ image Alpine + `apk add icu-libs libstdc++` + `DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli`. · feito quando: deploy beta + `POST /test` acha o binário e roda (sem ENOENT/erro de runtime). **SDD Completo (image/deploy). Coordenar spec 052 Bloco A.** Ver `chatexporter-solucao.md` §2.
- [ ] T6.7 — **(Wizard leigo)** Bot › Configuração = fluxo guiado: Conectar (validar bot token → `discoverGuilds`, estados explicativos + guia "como obter token") → Canais (perfis via dropdown servidor/canal) → Agenda. · feito quando: leigo conecta e cria perfil sem digitar ID cru; erros explicam causa+solução. `chatexporter-solucao.md` §1/§5/§7.
- [ ] T6.8 — **(Saúde)** Por perfil: última run, "a atualizar" (delta), erros + botões Testar/Importar agora. · feito quando: cada perfil mostra estado real e dispara run/test.
- [ ] T6.9 — **(Runner agendado — absorvido da 052 Bloco A)** Job no `mesas-cron` lê perfis `schedule_enabled` e dispara export+import na frequência/hora/timezone (agenda = dado no DB, não crontab na VM). · feito quando: perfil agendado roda sozinho no beta sem disparo manual; coordenado com 052 (sem duplicar runs). **SDD Completo (cron/deploy).** Ver `chatexporter-solucao.md` §4.

### Fase 4b — Notificações do admin (R14)
- [ ] T4.3 — **(R14 DECIDIDO)** Sino = {`table_published`,`dev_feedback`} (`member_joined` fora — sem mecanismo de membro no back). Implementar emissor real p/ `table_published` (na publicação de mesa) + `dev_feedback`; manter auto-exclusão do autor; `dev_feedback` nos tipos visíveis; remover `system_suggestion`/`scenario_suggestion` do sino; tokens no `NotificationBell` (remove `#1B2A4A`/`bg-blue-500/10`). · feito quando: sino mostra evento real no beta (smoke) e sem hardcode.

### Fase 7 — Catálogo + Comunidade + Sistema
- [ ] T7.1 — Catálogo (Sistemas/Plataformas/Cenários/Mesas publicadas) com PageHeader+tabs. · feito quando: paridade funcional com Conteúdo atual.
- [ ] T7.2 — **Sistema › Usuários (DECIDIDO: construir)**: lista `admin/users` com `<AdminTable>` (filtros, abrir/editar) + marcar Covil do Lich (`users/:id/covil`). · feito quando: lista real funciona.
- [ ] T7.3 — Sistema › Erros reportados (DevFeedback). Remover stubs jobs/logs/erros/config. · feito quando: sem "em breve".
- [ ] T7.4 — **Catálogo › Estilos por cenário (DECIDIDO: construir)**: UI de `setting-suggestions` (`setting_style_suggestions`, CRUD já existe) com `<AdminTable>`. · feito quando: criar/editar/apagar estilos por cenário funciona.

### Fase 8 — Limpeza de contrato (R10)
- [ ] T8.1 — Remover endpoints órfãos confirmados: **`import/metrics`** (redundante), `import-json/reparse` (se redundante com `drafts/:id/reparse`). **`setting-suggestions` NÃO remove** (vira UI, T7.4); **`admin/users` NÃO remove** (vira UI, T7.2). · feito quando: rotas removidas no back + `docs/api/openapi/mesas.yaml` atualizado.
- [ ] T8.2 — `pnpm api:bundle` + `pnpm verify:api` (api-diff breaking documentado). · feito quando: `verify:api` exit 0 ou breaking aprovado.

### Fase 9 — Validação
- [ ] T9.1 — `pnpm run lint` + `pnpm run build` + testes afetados verdes.
- [ ] T9.2 — Smoke beta `mesasbeta` por grupo (navegação, persistência config, fila de drafts, importação). · feito quando: smoke registrado na sessão.
- [ ] T9.3 — Promote (gated por aprovação nominal).
