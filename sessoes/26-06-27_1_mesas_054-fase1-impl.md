# Sessão: 054 Fase Final — Correções de review (REV-001 a REV-025)

- **Data:** 2026-06-27 (início) → 2026-06-28 (finalização)
- **Objetivo:** Corrigir todos os reviews sem veredito em `reviews.md` (001-025) e validar spec 054.
- **App/Projeto:** `apps/mesas` (frontend + backend pontual)
- **Gate:** D (mesas)
- **Tipo:** SDD Completo (revisão pós-implementação)

## Vínculos
- Spec: `specs/054-mesas-gestao-ia-sidebar/`
- Tasks: `tasks.md`
- Reviews: `reviews.md` (itens 001-025)
- Branch: `feat/054-gestao-ia-sidebar`

## Plano
1. Corrigir sync de drafts Inbox na fila unificada (REV-001)
2. Corrigir deep links de moderação (REV-002, 005, 013)
3. Corrigir troca de filtro em ComunidadeSection (REV-003, 007)
4. Normalizar payload externo antes de estado/render (REV-008, 009)
5. Corrigir AdminMain com header vazio (REV-006)
6. Corrigir contagem falsa de pendências (REV-011, 012, 020)
7. Corrigir computePayloadDiff (REV-014)
8. Aplicar onBeforeSync no sync em lote (REV-016)
9. A11y mínima nas subnavs (REV-015)
10. Ajustes menores: adminEnrichment.ts 500 (REV-004)
11. Validar: lint, build, test, verify:api
12. Atualizar artefatos: reviews.md, tasks.md, debitos.md, sessão

## Critério de conclusão
- [x] REV-001: inboxApi adapter injetado no DiscordDraftReviewTable
- [x] REV-002/005/013: rota moderacao/:sub? + useParams em ModeracaoSection
- [x] REV-003/007: mounted.current removido de ComunidadeSection
- [x] REV-008: Array.isArray em maybePublishPendingDrafts
- [x] REV-009: normalização linha a linha em ConteudoSection.fetchAllTables
- [x] REV-006: AdminMain header condicional (hasHeader)
- [x] REV-011/012/020: booleano "há pendências" em DashboardSection+GestaoLayout
- [x] REV-014: computePayloadDiff restrito ao nível table + null/undefined equivalente
- [x] REV-016: onBeforeSync aplicado draft a draft no sync em lote
- [x] REV-015: aria-pressed/aria-selected em todas as 6 Sections
- [x] REV-004: mensagem 500 "hidratação"→"enriquecimento"
- [x] Lint ✅ (17/17)
- [x] Build ✅ (17/17)
- [x] Test backend ✅ (29 files, 285 tests)
- [x] Test frontend ✅ (13 files, 141 tests)
- [x] verify:api ✅ (exit 0, 0 órfãs, 0 duplicatas)
- [x] reviews.md preenchido com vereditos 001-025
- [x] tasks.md T4.1 e fechamento atualizados
- [x] debitos.md atualizado (DEB-054-05, DEB-054-06 ✅ falso alarme, DEB-054-10, DEB-054-03, DEB-054-04)
- [ ] Smoke visual do mantenedor em beta (TZ.3)

## Arquivos modificados (fase final)

| Arquivo | Mudança |
|---|---|
| `ComunidadeSection.tsx` | Remove `mounted.current` guard; `maybePublishPendingDrafts` normaliza com `Array.isArray`; `handleResolved` assinatura ajustada; `aria-pressed` nos filtros; remove `useRef` import |
| `ConteudoSection.tsx` | `fetchAllTables` normaliza linha a linha (validação de `id`, `title`, `status`, `created_at`, `is_covil`); `aria-pressed` na subnav |
| `AdminMain.tsx` | Header sticky condicional (`hasHeader`); só renderiza se houver conteúdo |
| `DashboardSection.tsx` | `pendenciaRascunhos` → `temPendenciaRascunhos` (booleano); rótulo "Há rascunhos a revisar"; `totalPendencias` ajustado; `aria-pressed` na subnav |
| `GestaoLayout.tsx` | `pendenciaCount` ajustado: rascunhos contribuem +1 se ≥1 (não número falso); comentário documenta `limit:1` |
| `App.tsx` | Rota `moderacao` → `moderacao/:sub?` |
| `ModeracaoSection.tsx` | `useParams` para deep-link; `inboxDraftApi` adapter injetado; `computePayloadDiff` refatorado (nível `table`, null/undefined equivalente); `aria-pressed` na subnav; `useEffect` com `setTimeout` |
| `DiscordDraftReviewTable.tsx` | Prop `inboxApi?: DraftApiOperations`; `resolveApi(draft)` roteia por origem; `handleSyncReady` aplica `onBeforeSync` draft a draft quando presente |
| `IntegracoesSection.tsx` | `aria-pressed` na subnav (8 botões) |
| `SistemaSection.tsx` | `role="tablist"` + `role="tab"` + `aria-selected` na subnav |
| `adminEnrichment.ts` (backend) | Mensagem 500: "hidratação" → "enriquecimento" |

## Arquivos de doc modificados

| Arquivo | Mudança |
|---|---|
| `reviews.md` | Vereditos 001-027 preenchidos |
| `tasks.md` | T4.1 contagem atualizada; TZ.1-TZ.4 atualizados; TZ.3 reordenado (merge → deploy → smoke) |
| `debitos.md` | DEB-054-05, DEB-054-06 ✅ falso alarme, DEB-054-10, DEB-054-03, DEB-054-04 registrados |
| `project-state.md` | Entrada 054 reescrita; "Próximo passo" renumerado 1–17; fluxo 054 corrigido |
| `C:\Users\paulo\.claude.json` | MCP `artificio-api-governance` adicionado ao projeto `C:/projetos/artificio` |

## Validação final (2026-06-28)

- `pnpm run lint`: 17/17 ✅
- `pnpm run build`: 17/17 ✅
- `pnpm run test --filter @artificio/mesas-backend --filter @artificio/mesas-frontend`: backend 285/285 ✅, frontend 141/141 ✅
- `pnpm verify:api`: exit 0, 0 órfãs, 0 duplicatas, 3 warnings pre-existentes de ambiguous paths ✅
- `artificio-api-governance` MCP: adicionado ao `.claude.json` do Claude Code (projeto `C:/projetos/artificio`) — antes só o OpenCode tinha

## Docs operacionais atualizados

- `project-state.md`: entrada 054 reescrita (código completo, 11 arquivos, validações, 053 destravada)
- `tasks.md`: TZ.3 detalhado com fluxo git real (commit → push → PR → CI → beta deploy → smoke → merge → promote → prod)
- DEB-054-06 fechado como falso alarme: rota de correção `/admin/discord/drafts/:id/correction` é compartilhada (discord/utils.ts `registerDraftCorrection`), funciona para ambas as origens

## Próximo passo

~~Smoke visual do mantenedor em beta (TZ.3). Depois: fechar spec 054 e liberar 053 Frente A.~~ ✅ CONCLUÍDO (2026-06-30).

## Item para project-state.md

Spec 054 ✅ ENCERRADA (2026-06-30). Fases 1-4 + 16 reviews de bot corrigidos. 11 arquivos de código + 3 artefatos. PR mergeada em `dev` → deploy beta + smoke + promote prod ✅. O que não foi feito foi descartado. `BL-054-GESTAO-IA` fechado. 053 Frente A destravada.
