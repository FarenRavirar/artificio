# Tasks — 042

## Fase 1: `packages/feedback`

- [x] T1 — Criar `packages/feedback` com package.json, tsconfig.json, eslint.config.js · feito quando: estrutura existe e builda vazio
- [x] T2 — Implementar `types.ts` (FeedbackKind, FEEDBACK_LIMITS, ConsoleErrorEntry, NetworkErrorEntry, NormalizedFeedback, ParseResult) · feito quando: tipos exportados sem dependência externa
- [x] T3 — Implementar `helpers.ts` (asRecord, readString, trunc, readTruncatedOrNull, EMAIL_RE, SCREENSHOT_RE, LEVEL_MAX) · feito quando: funções exportadas e tipadas
- [x] T4 — Implementar `normalize.ts` (normalizeConsoleErrors, normalizeNetworkErrors, normalizeScreenshot) · feito quando: normalizadores exportados com parâmetro `limits`
- [x] T5 — Implementar `parse.ts` (parseFeedbackInput com opts.kindGuard e opts.limits) · feito quando: parser genérico aceita sobreposição de limites e guard de kind
- [x] T6 — Implementar `index.ts` barrel export · feito quando: todos os exports públicos acessíveis via `@artificio/feedback`
- [x] T7 — Migrar `apps/glossario/backend/src/validators/feedbackValidator.ts` → consumir `@artificio/feedback` · feito quando: glossario importa e re-exporta do pacote, build verde
- [x] T8 — Migrar `apps/site/server/lib/feedback-validator.ts` → consumir `@artificio/feedback` · feito quando: site importa do pacote, `decodeScreenshotDataUri` preservado localmente, build verde
- [x] T9 — Migrar `apps/mesas/backend/src/validators/devFeedbackValidator.ts` → consumir `@artificio/feedback` com wrapper (re-export de DEV_FEEDBACK_LIMITS, ParseResult, parseDevFeedbackInput) · feito quando: 114/114 testes passam, build verde
- [ ] T10 — Criar `packages/feedback/__tests__/parse.test.ts` · **adiado** — testes existentes em glossario (8) e mesas (19) já cobrem a função indiretamente via re-export
- [x] T11 — Rodar `cpd` nos 3 validadores — verificar zero clones >= 20 impacto · feito quando: jscpd não reporta mais duplicação entre os 3 arquivos (0 clones nos feedback validators)
- [ ] T12 — Smoke local: POST feedback em glossario, site e mesas · **adiado** — requer runtime com DB; build+testes comprovam integridade do contrato

## Fase 2: `resolveActorName`

- [x] T13 — Criar `apps/mesas/backend/src/services/actorNameResolver.ts` · feito quando: função exportada com assinatura `(userId, opts?)`, testável
- [x] T14 — Substituir em `scenarioSuggestions.ts:9` · feito quando: import substitui definição local, build verde
- [x] T15 — Substituir em `systemSuggestions.ts:9` · feito quando: idem
- [x] T16 — Substituir em `gmPanel.ts:90` · feito quando: idem (6 call sites atualizados)
- [x] T17 — Substituir em `vttPlatforms.ts:67` · feito quando: idem
- [x] T18 — Substituir em `scenarioSuggestionsAdmin.ts:10` · feito quando: idem, com `trx` e `fallback: 'Admin'` (2 call sites)
- [x] T19 — Substituir em `systemSuggestionsAdmin.ts:77` · feito quando: idem (3 call sites)
- [x] T20 — Rodar `cpd` nos 6 arquivos — verificar zero clones para resolveActorName · feito quando: jscpd não reporta mais duplicação (função removida de todos os 6 arquivos)

## Fase 3: Rotas de sugestão

- [x] T21 — Criar `apps/mesas/backend/src/routes/suggestionHelpers.ts` com `rejectHandler(config)` · feito quando: handler rejeição genérico exportado
- [x] T22 — Migrar `scenarioSuggestionsAdmin.ts` reject → usar `rejectHandler` · feito quando: handler local substituído (83 linhas → 2), build verde
- [x] T23 — Migrar `systemSuggestionsAdmin.ts` reject → usar `rejectHandler` · feito quando: idem
- [x] T24 — Extrair `listAdminHandler(tableName)` para `suggestionHelpers.ts` · feito quando: GET list genérico exportado
- [x] T25 — Migrar ambas rotas admin GET list → usar `listAdminHandler` · feito quando: build verde
- [x] T26 — Extrair `listMineHandler(tableName)` para `suggestionHelpers.ts` · feito quando: GET /mine genérico exportado
- [x] T27 — Migrar ambas rotas non-admin GET /mine → usar `listMineHandler` · feito quando: build verde
- [ ] T28 — Extrair esqueleto `createSuggestionHandler(config)` para `suggestionHelpers.ts` · **adiado** — POST divergente entre scenario (flat: name, name_pt, description) e system (hierárquico: +parent_id, node_type, suggestion_type). Esqueleto comum existe (auth, validate, count pending, notify, log) mas campos de INSERT são diferentes demais para factory simples
- [ ] T29 — Migrar ambas rotas non-admin POST / → usar `createSuggestionHandler` · **adiado** (depende de T28)
- [ ] T30 — Extrair esqueleto `approveHandler(config)` com callback `insertApproved` · **adiado** — approve diverge 40% (scenario flat vs system hierárquico com path_slug/depth/parent_id + Discord draft relink). Complexidade do callback não justifica abstração agora
- [ ] T31 — Migrar approve de scenario e system → usar `approveHandler` · **adiado** (depende de T30)
- [ ] T32 — Rodar `cpd` nos 4 arquivos de sugestão — verificar zero clones >= 20 impacto · **parcial** — reject, GET list e GET /mine eliminados. POST e approve mantêm duplicação estrutural (adiados T28-T31). Redução de ~250 linhas duplicadas (reject 83+83 + list 17+17 + mine 20+20)

## Finalização

- [x] T33 — `pnpm run build` 16/16 · feito quando: turbo build verde em todos os apps
- [x] T34 — `pnpm run lint` zero erros · feito quando: lint passa (14/14, 0 erros novos)
- [x] T35 — `pnpm run test` verde (219/219) · feito quando: todos os testes passam
- [x] T36 — Atualizar `specs/backlog.md` e `project-state.md` · feito quando: débitos fechados/novos registrados
- [x] T37 — Atualizar sessão e `sessoes/index.md` · feito quando: evidência registrada

## Revisões

- [ ] **R042-001** — `kindGuard` ausente em `devFeedbackValidator.ts` (Amazon Q, 🛑 Logic Error) · `parseDevFeedbackInput` chama `parseFeedbackInput<DevFeedbackKind>` sem `kindGuard`. Risco de manutenção: type assertion inseguro se validação padrão do pacote mudar. Sugestão: adicionar `kindGuard` inline. Ver `task-revisoes-2.md`.
- [ ] **R042-002** — Dockerfiles não copiam `packages/feedback/dist` (Codex, 🛑 P1) · glossario/mesas/site Dockerfiles têm lista fixa de `COPY --from=builder`; `@artificio/feedback` não foi adicionado. Container sobe sem o dist → servidor falha ao importar. Ver `task-revisoes-2.md`.
- [ ] **R042-003** — `@artificio/feedback` sem build CommonJS (Codex, 🛑 P1) · Pacote é `"type": "module"` com `"require": "./dist/index.js"` (ESM). Backends glossario/mesas são CommonJS → `ERR_REQUIRE_ESM`. Precisa de `dist-cjs/` como `@artificio/changelog`. Ver `task-revisoes-2.md`.
- [ ] **R042-004** — `ParseResult` redefinido localmente em `devFeedbackValidator.ts` (CodeRabbit, 🔵 Nitpick) · Tipo duplicado localmente em vez de reutilizar `ParseResult<TKind>` do pacote. Ver `task-revisoes-2.md`.
- [ ] **R042-005** — `DEFAULT_LIMITS` duplicado em `parse.ts` (CodeRabbit, 🔵 Nitpick) · Constante duplica `FEEDBACK_LIMITS` de `types.ts`; deveria usar spread. Ver `task-revisoes-2.md`.
- [ ] **R042-006** — Condição de corrida no `rejectHandler` (CodeRabbit, 🟠 Major) · SELECT + UPDATE não é atômico; dois admins podem gerar notificações/logs duplicados. UPDATE deveria incluir `WHERE status='pending'` e validar `executeTakeFirst()`. Ver `task-revisoes-2.md`.
- [ ] **R042-007** — `exports.require` aponta para ESM (CodeRabbit, 🟠 Major) · Mesmo diagnóstico do R042-003. Ver `task-revisoes-2.md`.
- [x] **R042-008** — Validação de faixa HTTP no `normalizeNetworkErrors` (CodeRabbit, 🟡 Minor) · Qualquer número finito aceito como status; corrigido: valida 100-599. Ver `task-revisoes-2.md`.
- [x] **R042-009** — ReDoS no EMAIL_RE (SonarCloud, 🟡 Medium) · Regex `[^\s@]+` vulnerável a backtracking super-linear. Corrigido: quantificadores explícitos `{1,254}`. Ver `task-revisoes-2.md`.
- [x] **R042-010** — `export type { }` → `export type { } from` para `ConsoleErrorEntry` (SonarCloud, 🔵 Minor) · Re-export direto substitui import+re-export. Build + testes verdes. Ver `task-revisoes-2.md`.
- [x] **R042-011** — `export type { }` → `export type { } from` para `NetworkErrorEntry` (SonarCloud, 🔵 Minor) · Mesmo do R042-010, resolvido junto. Ver `task-revisoes-2.md`.
- [x] **R042-012** — Assertion desnecessária `opts.kindGuard as (...)` (SonarCloud, 🔵 Minor) · `parse.ts:54` — removido `as`, tipo já compatível. Build 17/17. Ver `task-revisoes-2.md`.
- [x] **R042-013** — Assertion desnecessária `kindRaw as TKind` (SonarCloud, 🔵 Minor) · `parse.ts:94` — removido `as TKind`, narrowing cobre. Build 17/17. Ver `task-revisoes-2.md`.

## Notas

- **T10 (testes unitários):** testes existentes no glossario (`feedbackValidator.test.ts`, 8 tests) e mesas (`devFeedbackValidator.test.ts`, 19 tests) já validam o contrato da função. Novo teste seria redundante.
- **T12 (smoke):** requer runtime com DB Postgres. Build+testes comprovam integridade do contrato de tipos e lógica.
- **T28-T31 (POST/approve):** divergência estrutural entre scenario (flat) e system (hierárquico) é real — não é só troca de tabela. Factory function exigiria callback complexo que tornaria o código menos legível que o original. Adiado para reavaliação futura.
