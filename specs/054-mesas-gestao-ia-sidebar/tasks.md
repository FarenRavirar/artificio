# 054 — Tasks

> Reorganização da `/gestao` do mesas: sidebar persistente + nova IA + renomeações.
> **Investigação Fase 0 concluída (Claude, 2026-06-27); Fases 1–4 detalhadas para implementação por agente frio (DeepSeek).**
> Ancorado no código real `apps/mesas` (2026-06-27). **Pétrea de banco: nenhum valor persistido renomeia sem migration online-safe + aprovação nominal.**
> Implementação sob autorização nominal por ação (commit/push/PR/merge/deploy cada um pede aprovação própria).

---

## Fase 0 — Investigação/decisão (CONCLUÍDA — sem código)

- [x] **T0.1 — Mapa nó-IA → aba atual → componente → rota.** Ver §A abaixo.
- [x] **T0.2 — Classificação de identificadores (a)/(b)/(c).** Ver §B abaixo. **Veredito: rename ampliado (decisão 4) = balde (a) FE só; ZERO valor persistido renomeado; rotas BE ficam (rename = débito opcional); toda a IA-alvo resolve com label de exibição + filtros de status/origin já existentes.**
- [x] T0.3 — Decisões 1–4 fechadas pelo mantenedor: 1=recomendado, 2=detalhado, 3=rotas aninhadas, 4=rename ampliado.
- [x] T0.4 — Sequência: **054 = gate de bloqueio** (054 → 053 → 052); 053 Frente A roda depois.
- [x] **T0.5a — R-Q1/Q2/Q3 RESOLVIDOS** (mantenedor 2026-06-27; ver §D). Moderação=2 visões; Caixa de entrada derrubada (6 grupos); `AdminWorkspaceLayout` fica (inspector, sem conflito). `InboxPanel`/`InboxDraftReviewTable`/`AdminWorkspaceLayout` lidos e confirmados.
- [x] **T0.5b — verificação restante CONCLUÍDA (achados que simplificam a impl):**
  - **`DiscordDraftReviewTable.tsx` JÁ É a fila unificada.** Tem `originFilter: 'discord'|'inbox'|'all'` (`:65`, select all/discord/inbox `:131-139`), deriva origem por FK (`draftOrigin = discord_message_id ? 'discord' : 'inbox'`, `:28-30`), **já exibe badge de origem** (`ORIGIN_LABELS`/`ORIGIN_COLORS`: Discord azul, Inbox roxo, `:31-32,199-201`), e aceita `api`/`listDrafts` injetáveis (`Props :11-16`). → **Dedup R-A9 = DELETAR `InboxDraftReviewTable.tsx`** e usar `DiscordDraftReviewTable` com **API default** (`discordSyncApi`, `origin=all` cobre Discord+Inbox no mesmo endpoint — não injeta api do inbox). Único extra do inbox = `onBeforeSync`/`registerCorrection` (`InboxDraftReviewTable:79-99`) → preservar como prop opcional (ver §D R-A9). **Não há componente novo de fila a construir.**
  - **SIGNATURE já existe** como badge de origem (`ORIGIN_COLORS`). Reusar; o "filete" §C vira refinamento visual opcional sobre o badge, NÃO infra nova. **Manter convenção azul/roxo existente** (evita 3ª cor + colisão com âmbar "capa baixa"/laranja `needs_review`). Atualiza §C abaixo.
  - **`PlatformsPage` JÁ separa VTT/Comunicação** via estado `kind` interno + 2 botões (`:66-67,244-269`). Subnav VTTs/Comunicação (T2.1) só precisa dirigir `kind` (lift p/ rota/prop). Forms usam hex cru `bg-[#0F1A2E]` (`:284`+) → migrar p/ tokens na passagem (R-A12).
  - **Payload `origin=all` traz os 2 FKs** (tipo `DiscordDraft` já tem `discord_message_id`/`import_message_id`; `draftOrigin` consome). Filete/badge viável sem mudar backend.

### §A — Mapa componente↔rota (verdade material do código)

Shell hoje = `GestaoPage.tsx`, **rota única** `/gestao` (`App.tsx:55`, `<ProtectedRoute requiredRole="admin">`). Sem subrotas. Estado de aba 100% FE (`useState`, nada persistido):
- `activeTab: 'systems'|'crud'|'activity'|'hydration'|'discord'|'inbox'|'dev'` (`GestaoPage.tsx:141`)
- `crudSubTab: 'systems'|'platforms'|'scenarios'|'tables'` (`:142`)
- `filter: 'all'|'pending'|'approved'|'rejected'` (sugestões; `:140`)
- `PanelTab: 'configuracao'|'fontes'|'mensagens'|'drafts'|'import-json'` (Discord; `useDiscordSync.ts:24`)

| Grupo IA-alvo (054) | Aba/sub atual | activeTab/tab | Componente | Rota(s) API |
|---|---|---|---|---|
| Conteúdo › Sistemas de RPG | Gerenciar Conteúdo › Sistemas | `crud`+`systems` | `SystemsAdminView` (`./SystemsAdminView`) | `/api/v1/admin/systems*` |
| Conteúdo › Plataformas (VTTs/Comunicação) | … › Plataformas | `crud`+`platforms` | `PlatformsPage` (`modules/admin/platforms`) | `/api/v1/admin/platforms*` |
| Conteúdo › Cenários | … › Cenários | `crud`+`scenarios` | `ScenariosAdminView` | `/api/v1/admin/scenarios*` |
| Conteúdo › Mesas | … › Mesas | `crud`+`tables` | inline `GestaoPage:576-646` | `GET /api/v1/tables`; `PUT/DELETE /api/v1/admin/tables/:id` |
| Comunidade › Sugestões (receb./aprov./rejeit.) | Sugestões de Sistemas | `systems` | inline `GestaoPage:670-795` + `SystemSuggestionResolutionDrawer` | `GET /api/v1/admin/system-suggestions`, `…/scenario-suggestions`, `PATCH …/:id/approve\|reject` (`getSuggestionEndpoint :130`) |
| Comunidade › Histórico de decisões | (não existe) | — | NOVO/stub | — |
| **Moderação › Mensagens capturadas** (entidade `discord_import_messages`, Discord-only) | Discord › Mensagens | `discord`+`mensagens` | `DiscordSyncPanel` bloco `:69-247` | `/api/v1/admin/discord-sync/messages*` |
| ↳ filtros desta visão: Ignorados/Conferidos | filtro status msg | — | `?status=ignored` etc. (R-A6: são status de MENSAGEM, não subitens) | idem |
| **Moderação › Rascunhos** (entidade `discord_import_table_drafts`, **UNIFICADO** Discord+Inbox; origem = FK não-nulo, NÃO `source_type` — R-A1/A2) | Discord › Drafts + Inbox › Drafts | `discord`+`drafts` | **`DiscordDraftReviewTable` reusado** (origin=all; dedup R-A9 deleta `InboxDraftReviewTable`) | `GET /api/v1/admin/discord-sync/drafts?origin=all&status=`, `…/drafts/:id/sync` |
| ("Fila de revisão" = nome do GRUPO, não tela) | — | — | — | — |
| Integrações › Discord › Configuração | Discord › Configuração | `discord`+`configuracao` | `DiscordSettingsPanel` | `/api/v1/admin/discord-sync/settings` |
| Integrações › Discord › Canais monitorados | Discord › Fontes | `discord`+`fontes` | `DiscordSourceList` | `/api/v1/admin/discord-sync/sources*` |
| Integrações › Discord › Importar histórico | Discord › Importar JSON | `discord`+`import-json` | `DiscordJsonImportPanel` | `/api/v1/admin/discord-sync/import*` (preview/file) |
| **Integrações › Importação de dados** ← move TextPasteArea | Inbox › Importar | `inbox` | `TextPasteArea` (`features/inbox`) — R-Q2 | `/api/v1/admin/inbox/import` |
| Integrações › Enriquecimento de dados | Hidratação de Dados | `hydration` | `HydrationAdminPanel` (`modules/admin/hydration`) | `/api/v1/admin/hydration*` |
| Integrações › Logs de integração | (não existe) | — | NOVO/stub | — |
| ~~Caixa de entrada~~ **DERRUBADO (R-Q2)** | Inbox | `inbox` | `InboxPanel` desmembrado: `TextPasteArea`→Integrações›Importação; `InboxDraftReviewTable`→Moderação›Rascunhos (dedup R-A9). Sem grupo próprio. | — |
| Sistema › Ferramentas de desenvolvimento | Desenvolvimento | `dev` | `DevFeedbackPanel` (`modules/admin/dev-feedback`) | `/api/v1/admin/dev-feedback*` |
| Sistema › Jobs/Logs/Erros/Config | (não existe) | — | NOVO/stub honesto | — |
| Dashboard (todos subitens) | (não existe) | — | NOVO/stub honesto | — |
| **Dashboard › Últimas atividades** | Atividades | `activity` | `ActivityPanel` (`modules/admin/activity`) | `/api/v1/admin/activity*` |

> **DECIDIDO (mantenedor 2026-06-27):** aba `Atividades` → **Dashboard › Últimas atividades**. `ActivityPanel` vira o subitem "Últimas atividades" do Dashboard (rota `/gestao/dashboard/atividades`). Sem tocar componente/rota de API — só posicionamento na sidebar.

### §B — Classificação de identificadores (T0.2)

**Balde (a) — interno-FE: renomeia DIRETO** (useState/string FE, não trafega nem persiste):
- `activeTab`/`crudSubTab`/`filter`/`PanelTab` → viram segmentos de rota.
- Nomes de componente/arquivo (`HydrationAdminPanel`→ ex. `EnrichmentAdminPanel`) → renomeia + atualiza imports.
- testids/asserts de rótulo em `GestaoPage.test.tsx` → migrar (T3.3).

**Balde (b) — contrato FE↔BE sem persistência (rota de API): renomeia rota+consumidor no MESMO PR.**
**Recomendação: NÃO renomear rotas** — `/api/v1/admin/{discord-sync,hydration,inbox,system-suggestions,scenario-suggestions}*` são contrato interno estável; rename só agrega risco sem ganho de UX (label é UI). Se mantenedor quiser, vira DEB-054-02 (par atômico). **Default da spec: rotas BE ficam.**

**Balde (c) — valor PERSISTIDO em DB/JSONB: SÓ com migration online-safe + aprovação nominal — PÉTREA. Veredito: ZERO rename nesta spec.**
| Valor | Coluna | Valores atuais | Veredito |
|---|---|---|---|
| status msg Discord | `discord_import_messages.status` | `pending/parsed/needs_review/synced/ignored/error` (`types.ts:4`) | **NÃO renomear.** "Ignorados/conferidos" = **filtros** sobre estes. |
| status draft | `discord_import_table_drafts.status` | `draft/ready/needs_review/synced/rejected` (`types.ts:5`, `inbox/utils.ts:34`) | **NÃO renomear.** Label PT via `MESSAGE_STATUS_LABELS`. |
| origem/fonte | `import_messages.source_type` (`db/types.ts:666`) | **só `'manual_paste'`** (`inbox/import.ts:45`); Discord NÃO passa por `import_messages` | **NÃO renomear.** ⚠️ NÃO é o eixo de origem da fila unificada (REVISÃO R-A2) — origem = FK não-nulo em `discord_import_table_drafts`. |
| source_kind Discord | `discord_import_messages.source_kind` (`db/types.ts:579`) | discord-only | **NÃO renomear.** |
| status mesa | `tables.status` | `active/cancelled/published/draft` | **NÃO renomear** (fora de escopo). |
| status sugestão | suggestion `status` | `pending/approved/rejected` | **NÃO renomear** — "recebidas/aprovadas/rejeitadas"=labels. |

**Conclusão Fase 0:** toda a IA-alvo se resolve com **(a) FE + labels de exibição + filtros de status/origin já existentes**. Renomeações do `spec.md` (Hidratação→Enriquecimento, Fontes→Canais monitorados, Drafts→Rascunhos, Mensagens→Mensagens capturadas, Importar JSON→Importar histórico; "Inbox→Caixa de entrada" MOOT — grupo derrubado R-Q2) são **100% rótulo de UI** (+ opcional nome de componente/segmento de rota FE). **Nenhuma migration nesta spec.** Moderação unificada tem backend = **`discord-sync/drafts?origin=all`** (`discord/drafts.ts:27-34`), origem por FK. ⚠️ Corrigido pela REVISÃO (§D): a claim original apontava `inbox/drafts` — endpoint ERRADO (inner join exclui Discord).

---

## §D — REVISÃO INDEPENDENTE (2026-06-27) — corrige Fase 0 antes de implementar

> Auditoria read-only contra código real. Achados que derrubam claims da Fase 0. **Resolver os P0/P1 antes de T1.** Severidade: P0=quebra eixo da spec, P1=gap material, P2=risco, P3=limpeza.

| ID | Sev | Cat | Arquivo:linha | Achado | Ação |
|---|---|---|---|---|---|
| R-A1 | **P0** | contrato | `inbox/drafts.ts:27` | `inbox/drafts` faz `innerJoin import_messages` → **exclui todo draft de Discord** (FK `import_message_id` null neles). NÃO unifica. | Fila usa `discord-sync/drafts?origin=all` (✅ já corrigido em §A/T2.3). |
| R-A2 | **P0** | contrato | `inbox/import.ts:45`, `db/types.ts:666` | `import_messages.source_type` só vale `'manual_paste'`; Discord vive em `discord_import_messages.source_kind`. `origin=discord` em `source_type` = vazio. | Origem da fila = FK não-nulo, não `source_type` (✅ §B/§C corrigidos). |
| R-A3 | **P0** | usabilidade | `discord/drafts.ts:18-20` | Fila unificada faz `selectAll()` em `discord_import_table_drafts` — tabela **sem coluna `source_type`**. SIGNATURE "filete por `source_type`" inconstruível como descrito. | Derivar origem de `discord_message_id != null ? 'Discord' : 'Inbox'` (✅ §C corrigido). |
| R-A4 | **P1** | gap | `features/inbox/components/InboxPanel.tsx:5-40` | `InboxPanel` só tem abas **Importar / Drafts** (importação de mesa por texto colado). NÃO tem Feedbacks/Denúncias/Solicitações/Pendentes/Resolvidos/Arquivados. Grupo "Caixa de entrada" de 6 subitens = ~80% ficção. | Reescrever nó "Caixa de entrada" (ver R-A5/A9). InboxPanel.import → Integrações›Importação; drafts dele → fila de Moderação. |
| R-A5 | **P1** | gap | só `dev-feedback*` existe | Backend NÃO tem rota de denúncia/solicitação/erro-reportado. Só feedback técnico (`dev-feedback`). Subitens de Caixa de entrada e Sistema›Erros = telas inexistentes, não "filtro de status". | Marcar stub honesto explícito; não prometer como mapeável a backend. |
| R-A6 | **P1** | bug | `types.ts:583`, `discord/drafts.ts:36-39` | "Itens ignorados/conferidos" como filtro de **draft** não existe: `DiscordImportDraftStatus` = `draft/ready/needs_review/synced/rejected` (sem `ignored`/`conferido`). `ignored` é status de MENSAGEM (entidade diferente). Status inválido → `discord/drafts.ts` ignora filtro e retorna TUDO. | DEFINIR a entidade da Fila (mensagens vs drafts). Ignorados/Conferidos pertencem a MENSAGENS. Ver R-Q1. |
| R-A7 | **P1** | regressão (testes) | `GestaoPage.test.tsx:16-18` | Teste mocka `react-router-dom` só com `{useNavigate}`. Rotas aninhadas usam `NavLink`/`Outlet`/`useParams` — **arquivo inteiro quebra**. T3.4 subestima (não é troca de string). | T3.4 = reescrita estrutural (MemoryRouter real + 6 grupos). Estimar maior. |
| R-A8 | **P2** | duplicação | `features/admin/components/AdminWorkspaceLayout.tsx` | Já existe `AdminWorkspaceLayout` (sidebar/tree/command-palette próprios) usado por `SystemsAdminView`/`ScenariosAdminView`. `AdminSidebar` novo pode criar sidebar-dentro-de-sidebar no grupo Conteúdo. | Mapear `AdminWorkspaceLayout` na Fase 0; decidir aninhamento antes de T1.1. |
| R-A9 | **P2** | duplicação | `Inbox*` vs `Discord*DraftReviewTable` | Drafts de inbox e de discord são a MESMA entidade (`discord_import_table_drafts`, origem diferente). Mover InboxPanel→Caixa E criar fila em Moderação faria drafts de inbox aparecerem em 2 grupos — a duplicação que a Decisão 1 quer evitar. | InboxPanel.import → Integrações›Importação; drafts só na fila de Moderação. Sem segundo lugar. |
| R-A10 | **P2** | usabilidade | `useDiscordSync.ts:88-93` | Já existe `queueStats` (pending/review/checked/ignored) sobre MENSAGENS. Contador de sidebar `?status=pending` mistura métrica de mensagem com fila de drafts (`pending` não é status de draft). | Reusar `queueStats` p/ contadores OU contar draft por status válido. Não inventar `status=pending` em draft. |
| R-A11 | P3 | cognição | `App.tsx:55`, `GestaoPage.tsx:211-215,428-430` | Guard duplo: `ProtectedRoute requiredRole="admin"` (pai) + `useEffect navigate('/')` + early-return. Sob rota-pai protegida, o effect/early-return viram código morto. | Guard só no pai; Sections não replicam. Remover, não copiar (ajustar T1.3). |
| R-A12 | P3 | tokens | `GestaoPage.tsx:442` | Confirmado gradiente hex cru `from-[#0F1A2E] via-[#1B2A4A]…`. | Já flagrado; usar tokens admin §C. |

### Perguntas que travavam implementação — RESOLVIDAS (mantenedor 2026-06-27)

- **R-Q1 — RESOLVIDO: Moderação = 2 entidades, 2 visões** (não 5 subitens misturados). O pipeline tem 2 estágios no banco; a UI espelha:
  - **Moderação › Mensagens capturadas** — entidade `discord_import_messages`, **Discord-only**, status `pending/parsed/needs_review/ignored/synced/error`. Triagem bruta. Ações: Criar Draft · Ignorar mensagem · Marcar como conferida. = bloco `mensagens` do `DiscordSyncPanel`.
  - **Moderação › Rascunhos** — entidade `discord_import_table_drafts`, **UNIFICADO Discord+Inbox** via `discord-sync/drafts?origin=all`, status `draft/ready/needs_review/rejected/synced`. Ações: Editar · Sincronizar · Rejeitar. **Filete de origem vive aqui** (único lugar onde origens se misturam).
  - "Fila de revisão" = nome do grupo, NÃO 3ª tela. "Ignorados/Conferidos" = **filtros dentro de Mensagens** (status de mensagem), não subitens próprios. Mata R-A6.
- **R-Q2 — RESOLVIDO: grupo "Caixa de entrada" DERRUBADO** (é ficção — `InboxPanel` só tem Importar/Drafts; sem backend de denúncia/solicitação/feedback de usuário, só `dev-feedback`):
  - **Importar (TextPasteArea)** → **Integrações › Importação de dados** (irmão do Importar JSON do Discord).
  - **Drafts do inbox** → absorvidos em **Moderação › Rascunhos** (unificados, R-A9).
  - **dev-feedback** → **Sistema**.
  - **Resultado: 7 grupos → 6** (Dashboard, Conteúdo, Comunidade, Moderação, Integrações, Sistema). Caixa real de feedback/denúncia de usuário = spec futura com backend próprio.
- **R-Q3 — RESOLVIDO: `AdminWorkspaceLayout` fica.** É padrão inspector (main + painel direito 400px, `AdminWorkspaceLayout.tsx:14-31`), NÃO rail de navegação → zero conflito com a sidebar global. Vive dentro de Conteúdo; só ajustar `calc(100vh - var(--header-height))` ao novo shell.

### R-A9 — dedup obrigatório (CONFIRMADO via T0.5b — mais simples que o previsto)
`DiscordDraftReviewTable.tsx` **já é a fila unificada** (origin all/discord/inbox, badge de origem por FK, props `api`/`listDrafts` injetáveis). `InboxDraftReviewTable.tsx` é o redundante. **Dedup:**
- **Moderação›Rascunhos = `<DiscordDraftReviewTable />` com API DEFAULT** (`discordSyncApi.getDrafts({origin:'all'})` cobre Discord+Inbox no MESMO endpoint — não precisa injetar api do inbox aqui).
- **DELETAR `InboxDraftReviewTable.tsx`.** Único consumidor = `InboxPanel` (`InboxPanel.tsx:3,37`), que está sendo desmembrado (R-Q2) → some junto.
- **Preservar correction-tracking:** `InboxDraftReviewTable` chamava `inboxApi.registerCorrection` em `onBeforeSync` (`:79-99`) p/ o loop de eval (Fase G da 048). Hoje `DiscordDraftReviewTable` NÃO passa `onBeforeSync`. **Decisão p/ impl:** adicionar `onBeforeSync` opcional ao `DiscordDraftReviewTable`→`DiscordDraftPreview` e aplicar registro de correção em TODA origem (correção humana vale p/ Discord também), ou gate por origem. NÃO perder o registro silenciosamente.
- `buildInboxDraftApi()`/`inboxDraftToDiscordDraft` (`adapters/draftAdapter.ts`) só restam úteis se algum fluxo ainda injetar a API do inbox; se a fila unificada usa discord-sync default, avaliar se viram código morto (remover) — `rg` antes de deletar.

### Investigar antes de implementar — ✅ CONCLUÍDO (ver T0.5b)
Todos verificados: `DiscordDraftReviewTable` já exibe origem (badge); `PlatformsPage` já separa VTT/Comunicação (`kind`); payload `origin=all` traz os 2 FKs. **Nada pendente.**

---

## §C — Direção de design do shell admin (canônica — seguir na implementação)

> Vive DENTRO do design system (`packages/ui`, dark-default D066/D067, laranja `#FF5722`, navy `#020740`, sobriedade Google-suite). Risco concentrado em UM elemento; resto quieto. **Tokens, nunca hex hardcoded** — definir as vars admin abaixo em `index.css` do mesas a partir dos tokens existentes; proibido repetir o gradiente `from-[#0F1A2E]` cru do `GestaoPage:442`.

**Conceito:** o painel é uma **mesa de despacho** (triar fluxo: sugestões, mensagens Discord, rascunhos, denúncias), não dashboard de vaidade. Sóbrio, denso, escaneável.

**Paleta (novas CSS vars admin, derivadas dos tokens canônicos):**
- `--admin-canvas: #0B1430` — fundo geral (1 tom abaixo do app público, separa o chrome admin).
- `--admin-rail: #0E1A38` — sidebar.
- `--admin-surface: #16223E` / `--admin-surface-raised: #1B2A4A` — cards/listas (canônicos D065).
- `--brand: #FF5722` — **acento único**: marcador de rota ativa + botão primário. Nada mais usa laranja.
- `--edge: rgba(255,255,255,.10)` — hairlines/divisores.

**Tipografia (sem fonte nova — usa a sans condensada bold da marca + sans canônica):**
- Rótulo de grupo (sidebar) + eyebrow do header contextual: **uppercase, tracking +0.08em, 11px/600**. É o "carimbo de despacho".
- Título de tela `20px/700` · item de subnav `14px/500` · meta/contador `12px/500 tabular-nums`.

**Layout (sidebar fixa esquerda + área de trabalho):**
```
┌──────────────┬─────────────────────────────────────────┐
│ GESTÃO        │  MODERAÇÃO ›  Fila de revisão  [Revisar] │ ← header contextual + breadcrumb + ação
│ ▾ MODERAÇÃO  ●│  ┌ Fila  Mensagens  Rascunhos ──────────┐ │ ← subnav local
│   Fila       3│  │ ▎ Discord · @user · há 2h            │ │ ← ▎ filete de origem (cor por source_type)
│   Mensagens   │  │ ▎ Inbox   · denúncia · há 5h         │ │
│   Rascunhos  1│  │ ▎ Discord · @user · há 1d            │ │
│ ▸ Integrações │  └──────────────────────────────────────┘ │
└──────────────┴─────────────────────────────────────────┘
```

**SIGNATURE — origem visível na fila de Rascunhos (JÁ EXISTE — reusar, T0.5b):** `DiscordDraftReviewTable` já mostra **badge de origem** (`ORIGIN_LABELS`/`ORIGIN_COLORS`: Discord azul `bg-blue-700/30`, Inbox roxo `bg-purple-700/30`) derivado do FK (`draftOrigin`). O requisito "origem clara" **já está satisfeito**. O "filete" (`▎` 3px à esquerda do card) é **refinamento visual OPCIONAL** sobre o badge existente — não criar convenção nova. **Manter azul/roxo existentes** (índigo/âmbar do rascunho inicial DESCARTADOS: âmbar colide com "capa baixa" `:226` e laranja `needs_review`). Se aplicar filete, usar as mesmas cores do badge.
- **A11y:** badge já tem rótulo textual ("Discord"/"Inbox") — daltônico-safe. Manter.

**Contadores de pendência na sidebar:** dado real, `tabular-nums`, **somem quando zero** (nunca número falso). ⚠️ NÃO usar `status=pending` em draft (não existe — R-A10); reusar `queueStats` (mensagens) ou contar draft por status válido (`needs_review`/`draft`).

**Disciplina:** foco visível (não regredir 053), `aria-current` no item ativo, `prefers-reduced-motion` respeitado, responsivo (sidebar colapsa em drawer no mobile). Sem animação supérflua — no máximo transição de 120ms no hover/ativo.

---

## Fase 1 — Shell de navegação (sidebar + roteamento aninhado)

> Objetivo: trocar estado-de-aba por layout shell com sidebar fixa + rotas aninhadas reais. **Preservar todos os painéis existentes como conteúdo.** Sem tocar backend.

- [ ] **T1.1 — `<AdminSidebar>`** — ✅ **IMPLEMENTADO** (2026-06-27, lint+build verdes).
  Arquivo: `apps/mesas/frontend/src/features/admin/components/AdminSidebar.tsx`
  - 6 grupos (Dashboard, Conteúdo, Comunidade, Moderação, Integrações, Sistema) com `<NavLink>`.
  - `aria-current="page"` automático (react-router-dom NavLink).
  - Design §C: fundo `--admin-rail`, acento `--brand` (laranja), ícones lucide-react, `tabular-nums` p/ badges.
  - `<nav aria-label="Gestão administrativa">` + `<ul>/<li>` semântico.
  - R-A8 respeitado: `AdminWorkspaceLayout` mapeado (inspector, sem conflito com sidebar global).
- [ ] **T1.2 — `<AdminMain>`** — ✅ **IMPLEMENTADO** (2026-06-27).
  Arquivo: `apps/mesas/frontend/src/features/admin/components/AdminMain.tsx`
  - Header contextual (eyebrow uppercase + título `20px/700`) + `<Breadcrumb>` reusado do existente.
  - Slots: `actions` (botões à direita), `subnav` (subnavegação local), `<Outlet />` (conteúdo).
  - Fundo `--admin-canvas`.
- [ ] **T1.3 — Roteamento aninhado** — ✅ **IMPLEMENTADO** (2026-06-27).
  `App.tsx` convertido para rotas filhas em `/gestao`:
  ```text
  /gestao → ProtectedRoute (guard admin) → GestaoLayout
    index → Navigate to dashboard
    /gestao/dashboard → DashboardSection
    /gestao/conteudo → ConteudoSection
    /gestao/comunidade → ComunidadeSection
    /gestao/moderacao → ModeracaoSection
    /gestao/integracoes → IntegracoesSection
    /gestao/sistema → SistemaSection
  ```
  - Guard `requiredRole="admin"` SÓ no pai (R-A11). `useEffect navigate('/')` + early-return **não copiados** p/ Sections.
  - Deep-link/refresh funcionam (URL real, sem estado de aba interno).
- [ ] **T1.4 — Decisão extrair → `packages/ui`** — ✅ **IMPLEMENTADO** (decisão registrada).
  **Mantido LOCAL em `features/admin/components/`.** Nenhum outro app-admin consome hoje; extração = SDD Completo sem ganho atual. Construído com tokens de tema, pronto para extração futura.
- [ ] **T1.5 — Migrar `GestaoPage` → Sections** — ✅ **IMPLEMENTADO** (2026-06-27).
  Monólito `GestaoPage.tsx` (823 linhas) quebrado em 6 Sections:
  | Section | Arquivo | Conteúdo |
  |---|---|---|
  | Dashboard | `DashboardSection.tsx` | `ActivityPanel` + stub Visão geral |
  | Conteúdo | `ConteudoSection.tsx` | Systems/Platforms/Scenarios + **tabela Mesas** (lógica inline migrada de `GestaoPage:576-646`) |
  | Comunidade | `ComunidadeSection.tsx` | **Sugestões** (lógica inline migrada de `GestaoPage:138-439`: normalizadores, fetch, approve/reject, lote, drawer) |
  | Moderação | `ModeracaoSection.tsx` | `DiscordDraftReviewTable` + stub Mensagens capturadas |
  | Integrações | `IntegracoesSection.tsx` | `DiscordSettingsPanel`, `DiscordJsonImportPanel`, `HydrationAdminPanel`, `TextPasteArea` + stubs |
  | Sistema | `SistemaSection.tsx` | `DevFeedbackPanel` + stubs (Jobs/Logs/Erros/Config) |
  - `GestaoPage.tsx` mantido (testes existentes referenciam), mas não usado no roteamento.
  - `GestaoLayout` novo componente fino que monta `AdminSidebar` + `AdminMain` + `<Outlet/>`.

**Validação Fase 1:** ✅ `pnpm run lint` verde (6/6 pacotes, zero erros). ✅ `pnpm run build` verde (2255 modules, 2.07s). Smoke de navegação pendente (apenas mantenedor em beta).

---

## Fase 2 — Reorganização dos grupos (MOVER painéis, não reescrever)

> Encaixar os componentes existentes (§A) nos novos nós. Subnavegação local dentro de cada Section.

- [x] **T2.1 — Conteúdo** (`ConteudoSection`): subnav Sistemas de RPG / Plataformas (VTTs/Comunicação) / Cenários / Mesas. Renderiza `SystemsAdminView`, `PlatformsPage`, `ScenariosAdminView`, bloco Mesas (migrado de `GestaoPage:576-646`). **`PlatformsPage` já separa VTT/Comunicação** via estado `kind` (T0.5b) — subnav VTTs/Comunicação dirige `kind` (lift p/ rota/prop). ⚠️ migrar forms hex cru `bg-[#0F1A2E]` → tokens (R-A12).
- [x] **T2.2 — Comunidade** (`ComunidadeSection`): subnav Sugestões recebidas/aprovadas/rejeitadas (= filtro `pending/approved/rejected` da lógica `GestaoPage:138-346`, migrada) + Histórico de decisões (**dado real, não stub**: sugestões já decididas — `status != pending` + `reviewed_at/reviewed_by/rejection_reason`; reusa a mesma fonte/normalizadores, só filtro distinto). `SystemSuggestionResolutionDrawer` preservado.
- [x] **T2.3 — Moderação** (`ModeracaoSection`): **2 visões (R-Q1)**, subnav: **Mensagens capturadas** + **Rascunhos**.
  - ⚠️ **PRÉ-REQUISITO — desmontar `DiscordSyncPanel`** (`DiscordSyncPanel.tsx`): hoje é UM container de 5 tabs (`configuracao/fontes/mensagens/drafts/import-json`) que a Fase 2 distribui entre Integrações (configuracao/fontes/import-json) e Moderação (mensagens/drafts). `DiscordSettingsPanel`/`DiscordSourceList`/`DiscordJsonImportPanel`/`DiscordDraftReviewTable` já são componentes; **o bloco `mensagens` NÃO é — está inline `:69-247` (~180 linhas)**. **Extrair `MessagesView`** (lista + detalhe/apuração + `MessagesToolbar`). `DiscordSyncPanel` container é aposentado.
  - ⚠️ **`useDiscordSync` (hook) é consumido por mensagens E fontes** (estado `sources`/`messages`/`selectedMessage` juntos). Ao separar visões em rotas distintas, cada uma instancia o hook → `sources` busca 2×. Aceitável (não quebra), mas se incomodar: passar slice por prop ou Context. Decidir na impl, registrar.
  - **Mensagens capturadas** = `MessagesView` extraído (entidade `discord_import_messages`, Discord-only). Filtros = status de mensagem (`pending/needs_review/ignored/synced/...`). "Itens ignorados/conferidos" = filtros DESTA visão (R-A6), não subitens.
  - **Rascunhos** = entidade `discord_import_table_drafts`, **UNIFICADA** via `GET /api/v1/admin/discord-sync/drafts?origin=all&status=`. Render = **`DiscordDraftReviewTable` reusado tal-qual** (já faz origin=all + badge + filtros — T0.5b/R-A9). **DELETAR `InboxDraftReviewTable`**; preservar `onBeforeSync` do inbox como prop opcional. Filtros: origem (já tem) + status de draft.
  - **Design §C — origem:** badge de origem **já existe** no `DiscordDraftReviewTable` (Discord azul / Inbox roxo). Reusar. Filete = refinamento opcional, mesma cor do badge.
- [x] **T2.4 — Integrações** (`IntegracoesSection`): subnav Discord (Configuração `DiscordSettingsPanel` / Canais monitorados `DiscordSourceList` / Importar histórico `DiscordJsonImportPanel` / **Mensagens capturadas** + **Rascunhos** = LINKS p/ Moderação, não painel — T2.7/Decisão 1) + **Importação de dados** (`TextPasteArea` movido do ex-Inbox — R-Q2; colar texto → cria draft que aparece em Moderação›Rascunhos) + Enriquecimento de dados (`HydrationAdminPanel`) + Logs de integração (stub honesto).
- [x] **T2.5 — ~~Caixa de entrada~~ DERRUBADO (R-Q2).** Sem grupo. `InboxPanel` desmembrado: `TextPasteArea`→T2.4 (Integrações›Importação); `InboxDraftReviewTable`→T2.3 (Moderação›Rascunhos, dedup). `dev-feedback`→T2.6 (Sistema). Caixa real de feedback/denúncia de usuário = spec futura com backend.
- [x] **T2.6 — Sistema** (`SistemaSection`): subnav Ferramentas de desenvolvimento (`DevFeedbackPanel` — único com backend real). Jobs/Logs/Erros reportados/Config = **stub honesto "em breve"** (R-A5: não há backend de erro-reportado/jobs/logs). Feedbacks técnicos = `dev-feedback`.
- [x] **T2.7 — Resolver duplicação Moderação×Discord (Decisão 1).** Painel de Mensagens/Rascunhos renderiza **só em Moderação**. Em Integrações›Discord, os itens "Mensagens capturadas"/"Rascunhos" são **links contextuais** para a rota de Moderação (`<NavLink to="/gestao/moderacao/mensagens">`), NÃO re-render do painel.

**Validação Fase 2:** todos os painéis antigos acessíveis nas novas posições; nenhum painel renderizado em 2 lugares; lint+build verdes.

---

## Fase 3 — Renomeações (rótulo + identificadores FE) + padrão de botões + limpeza dos mortos

> Aplicar a tabela de renomeações do `spec.md`. **Por Fase 0: tudo é balde (a) FE — zero migration, rotas BE intactas.**
>
> ### ESTADO REAL (investigação Claude 2026-06-27, código vivo `apps/mesas/frontend/src`)
> Fases 1–2 + **nível-rótulo da Fase 3 JÁ ENTREGUES**. Verificado direto no código:
> - `App.tsx:61-68` = rotas aninhadas reais (`GestaoLayout` + 6 Sections); `GestaoPage` **NÃO** está roteado.
> - `AdminSidebar.tsx:23-30` = grupos IA-corretos (Dashboard/Conteúdo/Comunidade/Moderação/Integrações/Sistema).
> - Subnavs das Sections **já com rótulos finais**: `ConteudoSection` "Sistemas de RPG/Plataformas/Cenários/Mesas"; `ModeracaoSection` "Mensagens capturadas/Rascunhos"; `IntegracoesSection` "Discord/Canais monitorados/Mensagens capturadas/Rascunhos/Importar histórico/Importação de dados/Enriquecimento de dados/Logs de integração"; `SistemaSection` "Ferramentas de desenvolvimento/Jobs e filas/Logs/Erros reportados/Configurações".
> - `ModeracaoLinks` (T2.7 links contextuais) já existe em `IntegracoesSection:113-114`.
>
> **O QUE FALTA na Fase 3** = (T3.1) verbos de ação dentro do feature `discord-sync` (não migrados na Fase 2); (T3.2) rename de componente `Hydration→Enrichment`; (T3.3) 2 verbos vivos a alinhar; (T3.4) **deletar os mortos** + testes. Os rótulos de grupo/subnav **já estão prontos — não retrabalhar**.

- [x] **T3.1 — Verbos de ação restantes (feature `discord-sync`).** ⚠️ **VERIFICADO 2026-06-27: JÁ APLICADO no código vivo** — `rg "Apurar|Marcar conferida|Mandar para revisão|aba Drafts"` retorna vazio; `useDiscordSync.ts:26-30` já tem `'Enviar para revisão'`/`'Marcar como conferida'`. Ação restante = só **confirmar** e marcar feito. Tabela abaixo = referência do que era esperado (NÃO mexer em status/enum — balde c):
  | Arquivo:linha | De | Para |
  |---|---|---|
  | `features/discord-sync/components/MessagesView.tsx:94` | `'Apurar'` (label do botão por mensagem; `'Aberta'` fica) | `'Revisar'` |
  | `features/discord-sync/components/MessagesToolbar.tsx:72` | `'✦ Apurar todas pendentes'` / `'Apurando...'` | `'✦ Revisar pendências'` / `'Revisando...'` |
  | `features/discord-sync/hooks/useDiscordSync.ts:27` | `label: 'Mandar para revisão'` | `'Enviar para revisão'` |
  | `features/discord-sync/hooks/useDiscordSync.ts:28` | `label: 'Marcar conferida'` | `'Marcar como conferida'` |
  | `features/discord-sync/hooks/useDiscordSync.ts:196` | toast `'…Acesse a aba Drafts para revisar…'` | `'…Acesse Moderação › Rascunhos para revisar…'` (não há mais aba "Drafts") |
  - **Badge de origem `'Inbox'`/`'Discord'`** (`DiscordDraftReviewTable.tsx:31,138`) = **MANTER** (convenção §C azul/roxo, daltônico-safe). NÃO renomear "Inbox" aqui — é rótulo de origem consolidado, não label de aba.
- [x] **T3.2 — Rename componente `HydrationAdminPanel`→`EnrichmentAdminPanel` (balde a, recomendado).**
  - Arquivo/símbolo: `modules/admin/hydration/HydrationAdminPanel.tsx`. Consumidor VIVO único = `IntegracoesSection.tsx:124` (`<HydrationAdminPanel />`). Consumidor morto = `GestaoPage` (será deletado em T3.4).
  - Toast interno `HydrationAdminPanel.tsx:68`: `'Simulação de hidratação concluída!'`/`'Hidratação concluída…'` → `'…enriquecimento…'`.
  - Dir `modules/admin/hydration/` **pode ficar** (rename só do símbolo/arquivo evita churn de path); registrar a escolha. `rg "HydrationAdminPanel"` antes e depois = zero órfão. **NÃO** tocar rota `/api/v1/admin/hydration*` (balde b — fica; vira DEB-054-02 se mantenedor quiser).
- [x] **T3.3 — Varredura de verbos de botão (code vivo).** Achados reais:
  | Arquivo:linha | Atual | Veredito |
  |---|---|---|
  | `ComunidadeSection.tsx:308` | `'Descartar selecionadas (N)'` | **→ `'Rejeitar selecionadas (N)'`** — alinha com botão singular `'Rejeitar'` (`:367`); é rejeição em lote, mesmo verbo p/ mesma ação. |
  | `ConteudoSection.tsx:218` | `table.status==='active' ? 'Cancelar' : 'Ativar'` | **MANTER `'Cancelar'`** — NÃO é toggle Ativar/Desativar: transiciona `tables.status` p/ `'cancelled'` (ação de negócio real). Trocar p/ "Desativar" mentiria sobre o efeito. Registrar como decisão consciente (anti-chute). |
  | `Cancelar` em forms (`DiscordSettingsPanel:178`, `DiscordSourceList:301`, `DiscordDraftPreview:76`) | fechar modal/form | **MANTER** — "Cancelar" de formulário é correto. |
  - `'Aprovar'/'Rejeitar'/'Aprovando...'/'Rejeitando...'` (`ComunidadeSection:359,367`) já consistentes — nada a fazer.
- [x] **T3.4 — Deletar componentes mortos + testes (limpeza R-A9 + dead-code).** `rg` confirmou consumidor vivo = ZERO (só citação em comentário). Deletar e remover imports órfãos:
  - `pages/GestaoPage.tsx` — App.tsx não usa; `GestaoLayout.tsx:7` só cita em comentário. **DELETAR** + `GestaoPage.test.tsx`.
  - `features/discord-sync/components/DiscordSyncPanel.tsx` — container de 5 tabs aposentado na Fase 2; `MessagesView.tsx:8` só cita em comentário. **DELETAR** + `DiscordSyncPanel.test.tsx`.
  - `features/inbox/components/InboxPanel.tsx` — só `GestaoPage` (morto) consumia. **DELETAR**.
  - `features/inbox/components/InboxDraftReviewTable.tsx` — só `InboxPanel` consumia (dedup R-A9; fila unificada vive em `DiscordDraftReviewTable`). **DELETAR**.
  - `features/inbox/adapters/draftAdapter.ts` (`buildInboxDraftApi`/`inboxDraftToDiscordDraft`) — `rg` antes; se só `InboxDraftReviewTable` usava → morto → remover. Se outro fluxo injeta a API do inbox, manter.
  - ⚠️ **Preservar correction-tracking (R-A9):** antes de deletar `InboxDraftReviewTable`, garantir que `onBeforeSync`→`inboxApi.registerCorrection` (loop de eval, 048 Fase G) foi portado como prop opcional do `DiscordDraftReviewTable`, OU registrar débito explícito se ficar para depois. NÃO perder o registro silenciosamente.
  - ⚠️ **`DiscordJsonImportPanel` "ir para Drafts":** `onNavigateToDrafts` era `setTab('drafts')` do `DiscordSyncPanel` morto. `IntegracoesSection:115` renderiza `<DiscordJsonImportPanel />` SEM prop → botão "ir para Drafts" some (`ImportResultGrid:25` esconde se ausente). Decidir: passar handler que navega p/ `/gestao/moderacao/rascunhos` (NavLink/`useNavigate`) OU aceitar a omissão. Registrar.
  - **Testes:** os mocks de `GestaoPage.test.tsx`/`DiscordSyncPanel.test.tsx` morrem junto. NÃO recriar 1:1 (testavam troca de aba via `useState`, agora é roteamento). Cobertura de componente que sobrevive (`DiscordDraftReviewTable.test`, `DiscordSettingsPanel.test`, `DiscordSourceList.test`, `DiscordJsonImportPanel.test`) permanece. Avaliar 1 teste fino de smoke de rota por Section sob `MemoryRouter` só se agregar valor; registrar decisão na sessão.

**Validação Fase 3:** zero rótulo EN órfão em UI (exceto badge de origem "Discord/Inbox", intencional); `rg "Apurar|aba Drafts|HydrationAdminPanel|InboxPanel|DiscordSyncPanel|GestaoPage"` retorna só comentários/históricos esperados ou nada; `pnpm run lint` + `pnpm run build` + testes verdes.

---

## Fase 4 — Dashboard + telas novas (incremental, stub honesto)

> Estrutura + placeholder honesto. **Nunca número falso.** Widgets que dependem de dado inexistente = "em breve" rotulado.
>
> ### ESTADO REAL (investigação Claude 2026-06-27, código vivo)
> - `App.tsx:62` `<Route index element={<Navigate to="dashboard" replace />} />` → **landing de `/gestao` JÁ pronto** (T4.1 parte "tela inicial" feita).
> - `DashboardSection.tsx` atual = **sem subnav**; só um card "Visão geral — Em breve" (stub) + `<ActivityPanel />` renderizado direto. Falta a subnav de 5 itens.
> - `ActivityPanel` (`modules/admin/activity/components/ActivityPanel.tsx`) = **dado real completo** via `useActivityLog` (feed + filtros + load-more). Reusar tal-qual em "Últimas atividades". ⚠️ Tem `<h2>Atividade Administrativa</h2>` próprio — pode duplicar título do header `AdminMain`; aceitar ou esconder header contextual nesse subitem (decidir, registrar).
> - **Stubs honestos JÁ existem:** `SistemaSection` (Jobs e filas/Logs/Erros reportados/Configurações via helper `stub()` "em breve") e `IntegracoesSection` (Logs de integração). **T4.2 essencialmente pronto** — só confirmar zero número falso.
> - `AdminSidebar` aceita prop `pendenciaCount` (badge `tabular-nums`, some quando 0) mas `GestaoLayout.tsx:19` renderiza `<AdminSidebar />` **sem passar** → badge de pendência da sidebar está desligado. T4.1 pode religar com dado real.

- [x] **T4.1 — Dashboard** (`DashboardSection`): adicionar subnav local (mesmo padrão de botões `subTab`/`subTabClass` das outras Sections — NÃO usar `AdminMain.subnav`, manter consistência) com 5 itens: **Visão geral / Pendências / Últimas atividades / Alertas / Atalhos rápidos**.
  - **Últimas atividades** = `<ActivityPanel />` existente — **mover para baixo deste subitem, não reescrever**.
  - **Pendências = DADO REAL** (cheap): contar via API, sem fabricar.
    - Sugestões pendentes: `authGet(...)` → `Array.isArray` + `.length`. Listar c/ link p/ `/gestao/comunidade`.
    - Rascunhos a revisar: `discordSyncApi.getDrafts({ origin: 'all', status: 'needs_review', limit: 1 })` → **booleano `temPendenciaRascunhos`** (≥1). ⚠️ **Não é contagem real** — backend não expõe `total`. Rótulo "Há rascunhos a revisar" sem número falso. **DEB-054-05 registrado.**
    - ⚠️ **NÃO** instanciar `useDiscordSync` só p/ `queueStats` (mensagens): o hook carrega TODAS as mensagens e filtra client-side — caro p/ um contador.
  - **Atalhos rápidos = REAL** (sem stub): grade de `<NavLink>` p/ destinos comuns. São links, não dado fabricado.
  - **Visão geral / Alertas** = stub honesto "Em breve".
  - ✅ **Badge da sidebar religado:** `GestaoLayout` passa `pendenciaCount` (sugestões + ≥1 rascunho) p/ `AdminSidebar`. Some quando 0.
- [x] **T4.2 — Sistema/Integrações: Jobs/Logs/Erros/Config** — **JÁ STUBADO** (`SistemaSection` helper `stub()` + `IntegracoesSection` logs). Ação = **confirmar honestidade**: zero número/lista fabricada, rótulo "em breve" explícito. Sem backend (`R-A5`: só `dev-feedback` existe) → não prometer dado. Se algum stub mostrar valor falso, corrigir; senão, marcar feito.

**Validação Fase 4:** Pendências/Atalhos = dado/links reais; Visão geral/Alertas/Jobs/Logs/Erros = stub "em breve" sem número falso; Dashboard é landing de `/gestao`; `pnpm run lint` + `pnpm run build` verdes.

---

## Fechamento

- [x] TZ.1 — `pnpm run lint` + `pnpm run build` verdes ✅ (17/17 tasks ambos, 2026-06-28). `pnpm run test --filter @artificio/mesas-backend --filter @artificio/mesas-frontend`: backend 285/285 ✅, frontend 141/141 ✅. `pnpm verify:api`: exit 0, 0 órfãs, 0 duplicatas ✅.
- [x] TZ.2 — a11y não regride: `aria-current` na sidebar via NavLink; `aria-pressed` nos botões de subnav de todas as 6 Sections + `role="tablist"`/`aria-selected` em `SistemaSection`. Alinhado c/ 053 Frente A (que roda depois, sobre esta estrutura).
- [ ] TZ.3 — Smoke visual do mantenedor em beta antes do merge em `dev`. Fluxo: (1) commit local na branch `feat/054-gestao-ia-sidebar` → (2) push → (3) abrir PR para `dev` (branch protection exige check `lint+build+test` verde) → (4) CI verde → (5) deploy beta mesas (`gh workflow run deploy.yml --ref dev -f module=mesas -f mode=deploy -f env=beta`) → (6) smoke autenticado em `mesasbeta.artificiorpg.com/gestao` → (7) merge PR em `dev` → (8) promote `dev→main` ff → (9) deploy prod mesas (gated por aprovação nominal). **Não pular etapas.**
- [x] TZ.4 — `debitos.md` atualizado com DEB-054-05, DEB-054-10, DEB-054-06 (correction-tracking). `reviews.md` preenchido com vereditos 001-025. `project-state.md` a atualizar no próximo passo.

---

## Débitos descobertos na Fase 0

- **DEB-054-02 (opcional) — rename de rotas/componentes BE.** Alinhar nomes técnicos à IA (ex.: `/api/v1/admin/hydration`→`…/enrichment`) é seguro mas opcional; rota = par atômico FE+BE no mesmo PR; valor persistido NUNCA (balde c). Default da spec = só rótulo/UX + segmento de rota FE. Materializar só se mantenedor pedir.

## Notas para o agente frio (DeepSeek)

1. **Ler T0** (`project-state.md` + `context-capsule.md` + `decisions.md`) antes de tocar código.
2. **Escopo travado:** só `apps/mesas/frontend` (+ possível `packages/ui` se T1.4 decidir extrair, que exige SDD Completo). NÃO tocar backend (rotas/enums ficam — Fase 0). NÃO renomear valor de DB.
3. **Mover, não reescrever** a lógica dos painéis existentes. Preservar comportamento.
4. **Tokens de tema** (`packages/ui`), nunca cor hardcoded; mesas é dark-default (D066/D067).
5. **Autorização por ação:** nenhum commit/push/PR/merge/deploy sem pedido nominal próprio do mantenedor.
6. **Validar cada fase** com `pnpm run lint` + `pnpm run build` antes de declarar concluída. Registrar evidência na sessão.
</content>
