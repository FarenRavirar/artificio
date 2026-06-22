# Plano — 042

## Arquitetura da solução

### Fase 1: `packages/feedback` (SDD Completo)

```
packages/feedback/
  src/
    types.ts        — FeedbackKind, FEEDBACK_LIMITS, ConsoleErrorEntry,
                      NetworkErrorEntry, NormalizedFeedback, ParseResult
    helpers.ts      — asRecord, readString, trunc, readTruncatedOrNull,
                      EMAIL_RE, SCREENSHOT_RE, LEVEL_MAX
    normalize.ts    — normalizeConsoleErrors, normalizeNetworkErrors,
                      normalizeScreenshot
    parse.ts        — parseFeedbackInput(kindGuard?, limitsOverride?)
    index.ts        — barrel export
  package.json
  tsconfig.json
  eslint.config.js
```

**Contrato de `parseFeedbackInput`:**
```ts
parseFeedbackInput(raw: unknown, opts?: {
  kindGuard?: (v: string) => v is TKind;
  limits?: Partial<typeof FEEDBACK_LIMITS>;
  screenshotLevelMax?: number;
}): ParseResult<TKind>
```

Permite mesas passar `kindGuard` para `DevFeedbackKind` e `limits` override para `DEV_FEEDBACK_LIMITS`.

### Fase 2: `resolveActorName` (mesas)

```
apps/mesas/backend/src/services/actorNameResolver.ts
```

```ts
resolveActorName(
  userId: string,
  options?: {
    trx?: Transaction<Database>;
    fallback?: string;       // default 'Usuário'
    logTag?: string;         // default 'actorNameResolver'
  }
): Promise<string>
```

### Fase 3: Rotas de sugestão (mesas)

Abordagem: **funções factory**, não classe/herança. Cada handler vira função pura que recebe dependências.

```
apps/mesas/backend/src/routes/suggestionHelpers.ts
```

Funções extraídas:
- `createSuggestionHandler(config)` — POST / (comum a scenario + system)
- `listMineHandler(tableName)` — GET /mine
- `listAdminHandler(tableName)` — GET / (admin list)
- `rejectHandler(config)` — PATCH /:id/reject
- `approveHandler(config)` — PATCH /:id/approve (esqueleto comum com callback de INSERT específico)

## Arquivos afetados

### Fase 1
| Arquivo | Ação |
|---------|------|
| `packages/feedback/src/types.ts` | NOVO |
| `packages/feedback/src/helpers.ts` | NOVO |
| `packages/feedback/src/normalize.ts` | NOVO |
| `packages/feedback/src/parse.ts` | NOVO |
| `packages/feedback/src/index.ts` | NOVO |
| `packages/feedback/package.json` | NOVO |
| `packages/feedback/tsconfig.json` | NOVO |
| `packages/feedback/eslint.config.js` | NOVO |
| `apps/glossario/backend/src/validators/feedbackValidator.ts` | EDIT (reduzir a re-export/import) |
| `apps/site/server/lib/feedback-validator.ts` | EDIT (reduzir a re-export/import) |
| `apps/mesas/backend/src/validators/devFeedbackValidator.ts` | EDIT (reduzir a re-export/import) |
| `packages/feedback/__tests__/parse.test.ts` | NOVO |
| `pnpm-workspace.yaml` | EDIT (adicionar pacote se necessário) |

### Fase 2
| Arquivo | Ação |
|---------|------|
| `apps/mesas/backend/src/services/actorNameResolver.ts` | NOVO |
| `apps/mesas/backend/src/routes/scenarioSuggestions.ts` | EDIT (remover def, importar) |
| `apps/mesas/backend/src/routes/systemSuggestions.ts` | EDIT (remover def, importar) |
| `apps/mesas/backend/src/routes/gmPanel.ts` | EDIT (remover def, importar) |
| `apps/mesas/backend/src/routes/vttPlatforms.ts` | EDIT (remover def, importar) |
| `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` | EDIT (remover def, importar) |
| `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | EDIT (remover def, importar) |

### Fase 3
| Arquivo | Ação |
|---------|------|
| `apps/mesas/backend/src/routes/suggestionHelpers.ts` | NOVO |
| `apps/mesas/backend/src/routes/scenarioSuggestions.ts` | EDIT (delegar a helpers) |
| `apps/mesas/backend/src/routes/systemSuggestions.ts` | EDIT (delegar a helpers) |
| `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` | EDIT (delegar a helpers) |
| `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` | EDIT (delegar a helpers, preservar resolve/candidates/relinkDiscordDrafts) |

## Contratos/interfaces tocados

- **`packages/feedback`**: novo contrato público — tipos exportados viram API estável
- **Auth:** intocado
- **Schema/DB:** intocado
- **Subdomínio/DNS:** intocado
- **`resolveActorName`**: assinatura muda (parâmetros opcionais aditivos, compatível)

## Impacto em consumidores

- **Fase 1:** glossario, site e mesas importam `@artificio/feedback` — smoke de feedback em cada app
- **Fase 2:** 6 rotas do mesas backend — smoke de cada rota
- **Fase 3:** 4 rotas de sugestão do mesas — smoke de create/list/approve/reject

## Rollback

- Fase 1: reverter import para definição local (código original preservado até validação)
- Fase 2: reverter para definição inline
- Fase 3: reverter para handlers inline
- Cada fase é independente — rollback de uma não afeta as outras

## Validação

1. `pnpm run build` — turbo build 15/15
2. `pnpm run lint` — zero erros
3. `pnpm run test` — 21/21 + novos testes do `packages/feedback`
4. `cpd` nos arquivos afetados — zero clones >= 20 impacto
5. Smoke local:
   - POST glossario/api/feedback, site/api/feedback, mesas/api/dev-feedback
   - POST scenario-suggestions, system-suggestions
   - GET scenario-suggestions/mine, system-suggestions/mine
   - PATCH scenario-suggestions/:id/reject, system-suggestions/:id/reject
