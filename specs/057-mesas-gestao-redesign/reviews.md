# Reviews — 057

> Só reviews externos: mantenedor, bots, PRs, checks. Achados internos vão em `debitos.md`.

## PR #120 (Fase 2) — Codex, commit `b04e5b7` (2026-06-30)

| # | Sev | Achado | Veredicto | Fix |
|---|---|---|---|---|
| C1 | P2 | Redirect `moderacao/:sub?` → `/gestao/mesas` dropava o `sub`; deep links/bookmarks `/gestao/moderacao/rascunhos` (DashboardSection:154,177) caíam na aba `mensagens`. | **PROCEDE** (verificado: links reais existiam) | `LegacyModeracaoRedirect` lê `:sub` e navega p/ `/gestao/mesas/${sub}`; + repoint dos 2 links internos da DashboardSection p/ `/gestao/mesas/rascunhos`. |
| C2 | P2 | `someSelected`/contagem do lote em `selected.size`, mas `runBulk` intersecta com `filteredIds` → toolbar mostra N mas roda em 0 quando filtro esconde selecionados. | **PROCEDE** | `visibleSelectedIds = filteredIds ∩ selected`; `someSelected`/`allSelected`/contagem/`runBulk` derivados dele. |

Ambos corrigidos no mesmo escopo. tsc+eslint verdes. Sem resposta no PR (trava pétrea).

## PR #120 (Fase 2) — CodeRabbit, 17 comentários (2026-06-30)

### Em arquivos do 057 (no #120) — tratados nesta rodada
| # | Sev | Arquivo | Achado | Veredicto/Fix |
|---|---|---|---|---|
| CR1 | Major | `App.tsx:73` | redirect perde `:sub` | **JÁ CORRIGIDO** (= Codex C1). |
| CR2 | Major | `ui/AdminTable.tsx:146-157,317-332` | `onRun` (lote/linha) sem catch → rejeição não tratada, sem feedback | **PROCEDE** → try/catch + estado `actionError` + banner `role="alert"`; `runRowAction` wrapper. |
| CR3 | Minor | `AdminSidebar.tsx:25` | badge global de pendências no item Comunidade mistura domínios | **PROCEDE** → badge movido p/ `visao-geral` (overview) + tooltip "total". |
| CR4 | Minor | `project-state.md:84` | "Sem código." stale | **PROCEDE** → atualizado (G1✅ G2 Fase 2 em PR #120). |
| CR5 | Minor | `sessoes/index.md:78` | status "G1 pendente" stale | **PROCEDE** → atualizado. |
| CR6 | Minor | `chatexporter-solucao.md:97` | §8 dizia `linux-x64` (glibc) contradizendo §2 musl | **PROCEDE** → corrigido p/ `linux-musl-x64 --self-contained`. |
| CR7 | Minor | `spec.md:49-52` | R14/R15 fora de ordem | **PROCEDE** → reordenado R13·R14·R15. |

### Em arquivos da 052 (NÃO estão no #120) — DÉBITO deferido p/ a 052/Fase 6
CodeRabbit revisou arquivos do backend DCE (`chatExporterCliRunner`, `chatExporterFolderImportService`, `routes/discord/{automation,chatExporterAutomation,import}`, `ChatExporterAutomationPanel`) que pertencem à spec 052 (e ao salvage `d2390ef` em `backup/057-pre-rebase`), **fora do diff do #120**. Não corrijo aqui (escopo errado); registro como débito acionável — vão para a Fase 6 do 057 (que absorve o DCE) ou para a PR própria da 052:

| # | Sev | Arquivo | Achado |
|---|---|---|---|
| D1 | **Major** | `chatExporterCliRunner.ts:26-48` | `export` do DCE **não aceita `--cookies`** → flag inválida quebra o processo quando `config.cookies` preenchido. Remover ramo `--cookies`. |
| D2 | **Major** | `chatExporterCliRunner.ts` | validar `channelId` (só dígitos) antes de compor `outputPath` — usado também por `scripts/exportDiscordChatExporter.ts` (só `min(1)`) → path traversal possível. |
| D3 | Major | `chatExporterCliRunner.ts:74-77` | timeout só manda SIGTERM; adicionar fallback SIGKILL p/ processo órfão. |
| D4 | **Major** | `chatExporterFolderImportService.ts:26-52` | `allowedBaseDir` opcional → rota admin (`chatExporterAutomation.ts:181`) chama sem contenção → `importDir` do config escapa da base. Tornar obrigatório/validar. (Toca o salvage.) |
| D5 | Major | `chatExporterFolderImportService.ts:165-172` | `cleanup` de retenção sem try/catch mascara resultado já processado se FS falhar. |
| D6 | Minor | `routes/discord/automation.ts:28-32` | `limit` inválido (`abc`/`0`/`1001`) cai em fallback 100 — schema devia rejeitar (400). |
| D7 | Minor | `routes/discord/chatExporterAutomation.ts:24` | regex de `time` aceita `99:99`; restringir 00:00–23:59. |
| D8 | **Major** | `routes/discord/chatExporterAutomation.ts:31-36` | `updateSchema` herda defaults do `configSchema` → PUT parcial sobrescreve `enabled/frequency/time/timezone` salvos. Separar schema de update sem `.default()`. |
| D9 | Major | `routes/discord/import.ts:64-74` | auto-parse processa só 500 de até 2000 e retorna sucesso sem sinalizar truncamento. Lote ou flag `truncated/remaining`. |
| D10 | Minor | `ChatExporterAutomationPanel.tsx:67-87,136-155` | `after` removido do payload não limpa filtro; `decrypt_error` nunca exibido ao admin (visibilidade de status). |

→ Ação: registrar em `specs/052-.../debitos.md` quando a 052 retomar / na Fase 6 do 057. Vários (D1/D4/D8) são pré-condição p/ o ChatExporter funcionar de verdade — alinham com T6.5/T6.6.

## Review CodeRabbit PR #120 — Fases 5-8 (2026-06-30)

Regra pétrea: sem resposta no PR; veredicto + porquê aqui. Corrigidos via código.

**Corrigidos (procedem):**
- **CR-01 🔴 Critical** `chatExporterAutomation.ts` `publicProfile` vazava `token_enc` (`...row`) → destructure omitindo `token_enc`.
- **CR-02 🟠 Major** `adminProfile.ts` `meta.total = users.length` (teto 200, sem paginação) → `page`/`per_page` reais (`limit`+`offset`) + `COUNT(DISTINCT u.id)` com os mesmos filtros; teste atualizado (mock `offset`/`executeTakeFirst`, asserção de args do filtro).
- **CR-03 🟠 Major** `ConteudoSection` delete de mesa sem confirmação → `confirm({variant:'danger'})`.
- **CR-04 🟠 Major** `ConteudoSection` toggle status reativava `full`/`ended` → guard (só `active`/`cancelled`).
- **CR-05 🟠 Major** `useAdminDashboardMetrics` `fetchActiveTablesCount` mascarava erro como 0 → `throw`.
- **CR-06 🟠 Major** `useAdminPendencias` counts mascaravam erro como 0 → `throw` nos dois.
- **CR-07 🟡 Minor** `placeholderData` deixava `isLoading` sempre false → removido dos 2 hooks (DashboardSection volta a mostrar loading; consumidor inalterado, guarda `?.`/`?? 0`).
- **CR-08 🟠 Major** `ChatExporterProfilesPanel` sem UI de `media`/`include_threads` → select "Tópicos" + checkbox "Baixar mídia".
- **CR-09 🟡 Minor** sem forma de limpar token salvo → checkbox "Remover token salvo" (`clearToken`) ao editar.
- **CR-10 🟡 Minor** `onEdit` não populava servidores → chama `discoverGuilds()` se lista vazia.
- **CR-11 🟠 Major** `deleteProfile` sem try/catch nem busy → try/catch + `setBusyProfileId`.
- **CR-12 🟡 Minor** `DiscordDraftPreview` `toast.error` p/ status intermediário → só erro quando há `result.error`; senão `toast()` neutro.
- **CR-13 🟡 Minor** OpenAPI `POST /profiles` 200→**201**, `DELETE`→**204** (bate com o backend).
- **CR-14 🔵 z.uuid** `z.string().uuid()` depreciado → `z.uuid()`.
- **CR-15 🔵** `POST /profiles` escrevia 2× (import_dir provisório) → `id` gerado no código, INSERT único.
- **CR-16 🔵 dedup** `formatDate`/`formatDateTime` extraídos p/ `features/admin/utils/format.ts` (ConteudoSection, AdminUsersPanel, ChatExporterProfilesPanel).
- **CR-17 🔵 dedup** `tabButtonClass` extraído p/ `ui/` (ConteudoSection, SistemaSection, IntegracoesSection, ModeracaoSection).
- **CR-18 i18n** (pedido do mantenedor) traduzido: "Threads"→"Tópicos", "Última run"→"Última execução", status `success/error/running`→`sucesso/erro/em execução/sem execução`.
- **CR-19 🔵** `adminProfile.test` passou a asserir argumentos do filtro (`u.role`,`=`,`gm`) além da contagem.

**Não aplicados (com motivo, não é adiamento por preguiça):**
- **CR-20 🧹 run síncrono → background job:** MANTIDO síncrono. Resultado imediato é a UX correta p/ ferramenta de uso pessoal; converter em fire-and-forget removeria o feedback de contagem e exigiria polling/UI de job novo (pioraria). Volume já é mitigado pelo `after` incremental + delta (T6.3). Se exports crescerem, vira spec própria de job assíncrono.
- **CR-21 🔵 schema vs interface `ChatExporterProfile`:** MANTIDOS ambos de propósito. CLAUDE.md exige normalizador Zod tipado no boundary de dado externo (schema runtime) + tipo estático — ter os dois é o padrão mandatório, não duplicação acidental.
- **CR-22 doc sessão checklist:** aplicado abaixo.
