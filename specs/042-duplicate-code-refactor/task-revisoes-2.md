# Revisões — Spec 042 (PR #83)

> Revisores: Amazon Q Developer
> Data: 2026-06-21
> Branch: `feat/042-duplicate-code-refactor` → `dev`
> PR: https://github.com/FarenRavirar/artificio/pull/83

---

## R042-001 — Logic Error: Missing kindGuard em devFeedbackValidator.ts

**Severidade:** 🛑 Logic Error requiring fix
**Escopo:** `apps/mesas/backend/src/validators/devFeedbackValidator.ts`
**Origem:** Amazon Q Developer review no PR #83

### Descrição

A função `parseDevFeedbackInput` chama `parseFeedbackInput<DevFeedbackKind>(raw, { limits: {...} })` **sem** passar `kindGuard`. Embora a validação padrão do `parseFeedbackInput` cheque `'bug' | 'suggestion'` (mesmo que `DevFeedbackKind`), a ausência do `kindGuard` cria risco de manutenção: se a validação padrão do pacote compartilhado mudar no futuro, o type assertion `kindRaw as TKind` na linha 100 de `packages/feedback/src/parse.ts` torna-se inseguro.

### Evidência (file:line)

`apps/mesas/backend/src/validators/devFeedbackValidator.ts:38-40`:
```ts
export function parseDevFeedbackInput(raw: unknown): ParseResult {
  return parseFeedbackInput<DevFeedbackKind>(raw, {
    limits: { ...FEEDBACK_LIMITS },
  });
}
```

`packages/feedback/src/parse.ts:98-100` (type assertion inseguro sem guard):
```ts
  } else if (kindRaw !== 'bug' && kindRaw !== 'suggestion') {
    return { ok: false, error: 'Tipo de feedback invalido. Use "bug" ou "suggestion".' };
  }
  // ... depois:
  kind: kindRaw as TKind,  // linha ~100 — sem kindGuard, isso é unsafe cast
```

### Sugestão do revisor

```ts
export function parseDevFeedbackInput(raw: unknown): ParseResult {
  const kindGuard = (value: string): value is DevFeedbackKind => 
    value === 'bug' || value === 'suggestion';
  
  return parseFeedbackInput<DevFeedbackKind>(raw, {
    kindGuard,
    limits: { ...FEEDBACK_LIMITS },
  });
}
```

### Status

- [x] **Fechado** — `kindGuard` adicionado inline em `devFeedbackValidator.ts:32-34`. Build + testes 114/114 verdes.

---

## R042-002 — P1: Dockerfiles não copiam `packages/feedback/dist`

**Severidade:** 🛑 P1 Badge (quebra deploy)
**Escopo:** `apps/glossario/backend/Dockerfile`, `apps/mesas/backend/Dockerfile`, `apps/site/Dockerfile`
**Origem:** chatgpt-codex-connector review no PR #83

### Descrição

Os Dockerfiles de glossario, mesas e site têm lista fixa de `COPY --from=builder` para pacotes compartilhados. O commit adiciona `@artificio/feedback` como dependência dos 3 backends, mas nenhum Dockerfile foi atualizado para copiar `packages/feedback/dist`. No deploy, o container sobe sem `packages/feedback/dist` e o servidor falha ao importar o validador de feedback.

### Evidência (file:line)

`apps/glossario/backend/Dockerfile:38-39` (copia só changelog, falta feedback):
```dockerfile
COPY --from=builder /repo/packages/changelog/dist ./packages/changelog/dist
COPY --from=builder /repo/packages/changelog/dist-cjs ./packages/changelog/dist-cjs
```

O mesmo padrão se repete em `apps/mesas/backend/Dockerfile` e `apps/site/Dockerfile` (listas fixas de pacotes, sem `feedback`).

### Sugestão do revisor

Adicionar em cada Dockerfile:
```dockerfile
COPY --from=builder /repo/packages/feedback/dist ./packages/feedback/dist
COPY --from=builder /repo/packages/feedback/dist-cjs ./packages/feedback/dist-cjs
```

### Status

- [x] **Fechado** — `COPY feedback/dist` + `dist-cjs` adicionados nos 3 Dockerfiles (glossario/mesas/site). Site Dockerfile também ganhou `--filter=@artificio/feedback` no turbo build. Build 17/17 verde.

---

## R042-003 — P1: `@artificio/feedback` não tem build CommonJS

**Severidade:** 🛑 P1 Badge (quebra runtime CJS)
**Escopo:** `packages/feedback/package.json`, `packages/feedback/tsconfig.json`
**Origem:** chatgpt-codex-connector review no PR #83

### Descrição

`packages/feedback` é `"type": "module"` e os exports apontam `"require": "./dist/index.js"` (ESM). Os backends glossario e mesas têm `module: "CommonJS"`, então `import` de `@artificio/feedback` vira `require('@artificio/feedback')` no JS emitido. Node rejeita com `ERR_REQUIRE_ESM`.

O pacote `@artificio/changelog` já resolve isso com build dual (ESM + CJS via `dist-cjs/`). Feedback precisa do mesmo tratamento.

### Evidência (file:line)

`packages/feedback/package.json:11-14`:
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist/index.js"       // ← aponta para ESM, quebra em CJS
  }
}
```

`@artificio/changelog/package.json` (referência de como fazer):
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.js",
    "require": "./dist-cjs/index.js"   // ← CJS separado
  }
}
```

### Sugestão do revisor

1. Criar `packages/feedback/tsconfig.cjs.json` (espelhar `packages/changelog/tsconfig.cjs.json`)
2. Adicionar build CJS no `package.json` scripts: `"build": "tsc -p tsconfig.json && tsc -p tsconfig.cjs.json && node -e \"require('fs').writeFileSync('dist-cjs/package.json', JSON.stringify({type:'commonjs'}))\"`
3. Atualizar `exports.require` para `"./dist-cjs/index.js"`

### Status

- [x] **Fechado** — `tsconfig.cjs.json` criado, `package.json` atualizado com build dual + `exports.require` → `dist-cjs/index.js`. Espelha `@artificio/changelog`. Build ESM+CJS verde.

---

## R042-004 — Nitpick: ParseResult redefinido localmente em devFeedbackValidator.ts

**Severidade:** 🔵 Trivial (nitpick)
**Escopo:** `apps/mesas/backend/src/validators/devFeedbackValidator.ts:28-30`
**Origem:** CodeRabbit review no PR #83

### Descrição

O tipo `ParseResult` é redefinido localmente no arquivo com a mesma estrutura do pacote compartilhado (`NormalizedFeedback<DevFeedbackKind>`). Isso cria risco de divergência de contrato: se o pacote mudar a definição de `ParseResult`, a cópia local fica desincronizada.

### Evidência (file:line)

`apps/mesas/backend/src/validators/devFeedbackValidator.ts:28-30`:
```ts
export type ParseResult =
  | { ok: true; value: NormalizedDevFeedback }
  | { ok: false; error: string };
```

### Sugestão do revisor

```ts
import type { ParseResult as SharedParseResult } from '@artificio/feedback';
export type ParseResult = SharedParseResult<DevFeedbackKind>;
```

### Status

- [x] **Fechado** — `ParseResult` agora é `SharedParseResult<DevFeedbackKind>` do pacote. Tipo local removido. Build verde.

---

## R042-005 — Nitpick: DEFAULT_LIMITS duplicado em parse.ts

**Severidade:** 🔵 Trivial (nitpick)
**Escopo:** `packages/feedback/src/parse.ts:36-50`
**Origem:** CodeRabbit review no PR #83

### Descrição

`DEFAULT_LIMITS` em `parse.ts` duplica `FEEDBACK_LIMITS` de `types.ts`, adicionando apenas `levelMax: 24`. Se alguém atualizar só um lado, o contrato público e o parser divergem. Deveria importar `FEEDBACK_LIMITS` e fazer spread.

### Evidência (file:line)

`packages/feedback/src/parse.ts:36-50`:
```ts
const DEFAULT_LIMITS = {
  title: 160,
  description: 4000,
  // ... 12 campos idênticos a FEEDBACK_LIMITS
  levelMax: 24,  // único campo extra
} as const;
```

### Sugestão do revisor

```ts
import { FEEDBACK_LIMITS } from './types.js';

const DEFAULT_LIMITS = {
  ...FEEDBACK_LIMITS,
  levelMax: 24,
} as const;
```

### Status

- [x] **Fechado** — `DEFAULT_LIMITS` agora usa spread de `FEEDBACK_LIMITS` + `levelMax: 24`. Fonte única no `types.ts`. Build verde.

---

## R042-006 — Condição de corrida no rejectHandler

**Severidade:** 🟠 Major (potential issue)
**Escopo:** `apps/mesas/backend/src/routes/suggestionHelpers.ts:24-79`
**Origem:** CodeRabbit review no PR #83

### Descrição

O fluxo de rejeição tem condição de corrida: dois admins podem simultaneamente ler `status='pending'` via `selectFrom`, ambos passar na checagem `if (!suggestion)`, e ambos executar `UPDATE` + `INSERT notification` + `logActivity`, gerando notificações e logs duplicados.

A correção: incluir `WHERE status='pending'` no próprio `UPDATE` e validar que uma linha foi realmente afetada (`returning('id')` + `executeTakeFirst()`), tornando a transição de estado atômica.

### Evidência (file:line)

`suggestionHelpers.ts:32-48` (SELECT e UPDATE separados):
```ts
// SELECT checa status='pending' mas não trava
const suggestion = await trx
  .selectFrom(config.tableName)
  .select(['id', 'user_id', 'name'])
  .where('id', '=', id)
  .where('status', '=', 'pending')
  .executeTakeFirst();

if (!suggestion) throw new Error('NOT_FOUND_OR_REVIEWED');

// UPDATE não verifica status — outro admin pode ter mudado entre SELECT e UPDATE
await trx
  .updateTable(config.tableName)
  .set({ ... })
  .where('id', '=', id)  // ← sem where('status','=','pending')
  .execute();
```

### Sugestão do revisor

```ts
const updated = await trx
  .updateTable(config.tableName)
  .set({ ... })
  .where('id', '=', id)
  .where('status', '=', 'pending')  // ← transição atômica
  .returning('id')
  .executeTakeFirst();

if (!updated) throw new Error('NOT_FOUND_OR_REVIEWED');
```

### Status

- [x] **Fechado** — UPDATE agora inclui `.where('status', '=', 'pending').returning('id').executeTakeFirst()` com verificação atômica. Transição de estado blindada contra race condition. Build + testes 114/114 verdes.

### Notas

- Bug pré-existente no código original (antes da refatoração). As rotas `scenarioSuggestionsAdmin.ts` e `systemSuggestionsAdmin.ts` já tinham o mesmo padrão SELECT→UPDATE separados. A factory function apenas herdou o comportamento — agora corrigido na fonte única.

---

## R042-007 — exports.require aponta para ESM (duplicado do R042-003)

**Severidade:** 🟠 Major (potential issue)
**Escopo:** `packages/feedback/package.json:10-14`
**Origem:** CodeRabbit review no PR #83

### Descrição

Mesmo diagnóstico do R042-003 (Codex). CodeRabbit confirma com análise de chain: os backends glossario e mesas são `"type": "commonjs"` com `"module": "CommonJS"`, mas `exports.require` aponta para `./dist/index.js` (ESM). Solução: dual build com `dist-cjs/` como `@artificio/changelog`.

### Status

- [x] **Fechado** — resolvido junto com R042-003. Build dual CJS + `exports.require` → `dist-cjs/index.js`.

---

## R042-008 — Validação de faixa HTTP no normalizeNetworkErrors

**Severidade:** 🟡 Minor (potential issue)
**Escopo:** `packages/feedback/src/normalize.ts:53-60`
**Origem:** CodeRabbit review no PR #83

### Descrição

`normalizeNetworkErrors` aceita qualquer número finito como `status` (após `Math.trunc`), incluindo códigos inválidos fora da faixa HTTP (ex.: -1, 0, 99999). Deveria validar faixa 100-599.

### Evidência (file:line)

`packages/feedback/src/normalize.ts:53-60`:
```ts
if (typeof row.status !== 'number' || !Number.isFinite(row.status)) continue;
// ...
out.push({
  status: Math.trunc(row.status),  // ← qualquer número finito entra
});
```

### Sugestão do revisor

```ts
const status = Math.trunc(row.status);
if (status < 100 || status > 599) continue;
```

### Status

- [x] **Fechado** — validação `status < 100 || status > 599` adicionada após `Math.trunc`. Build + testes verdes.

---

## R042-009 — ReDoS: EMAIL_RE vulnerável a backtracking

**Severidade:** 🟡 Medium (Security Hotspot)
**Escopo:** `packages/feedback/src/helpers.ts:1`
**Origem:** SonarCloud security hotspot no PR #83 — `typescript:S5852`

### Descrição

Regex `EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/` usa quantificadores `+` que permitem backtracking super-linear. Embora o input já seja limitado a 254 caracteres por `FEEDBACK_LIMITS.email` em `parse.ts:68`, o Sonar flaggeou como risco de DoS.

### Correção aplicada

```diff
- export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
+ export const EMAIL_RE = /^[^\s@]{1,254}@[^\s@]{1,253}\.[^\s@]{2,}$/;
```

Quantificadores explícitos com limite superior eliminam backtracking exponencial.

### Status

- [x] **Fechado** — regex endurecido com limites explícitos. Build + testes verdes.

---

## Resumo

| ID | Severidade | Arquivo | Origem | Status |
|----|-----------|---------|--------|--------|
| R042-001 | 🛑 Logic Error | `devFeedbackValidator.ts` | Amazon Q | fechado |
| R042-002 | 🛑 P1 (deploy) | Dockerfiles (glossario/mesas/site) | Codex | fechado |
| R042-003 | 🛑 P1 (runtime) | `packages/feedback` (CJS) | Codex | fechado |
| R042-004 | 🔵 Trivial | `devFeedbackValidator.ts` (ParseResult local) | CodeRabbit | fechado |
| R042-005 | 🔵 Trivial | `packages/feedback/src/parse.ts` (DEFAULT_LIMITS) | CodeRabbit | fechado |
| R042-006 | 🟠 Major | `suggestionHelpers.ts` (race condition) | CodeRabbit | fechado |
| R042-007 | 🟠 Major | `packages/feedback` (CJS — dup R042-003) | CodeRabbit | fechado |
| R042-008 | 🟡 Minor | `packages/feedback/src/normalize.ts` (HTTP range) | CodeRabbit | fechado |
| R042-009 | 🟡 Medium | `packages/feedback/src/helpers.ts` (ReDoS) | SonarCloud | fechado |
| R042-010 | 🔵 Minor | `devFeedbackValidator.ts:25` (re-export ConsoleErrorEntry) | SonarCloud | fechado |
| R042-011 | 🔵 Minor | `devFeedbackValidator.ts:25` (re-export NetworkErrorEntry) | SonarCloud | fechado |
| R042-012 | 🔵 Minor | `parse.ts:54` (assertion desnecessária guard) | SonarCloud | fechado |
| R042-013 | 🔵 Minor | `parse.ts:94` (assertion desnecessária kindRaw) | SonarCloud | fechado |

---

## R042-010 — Code Smell: Use `export…from` para re-exportar `ConsoleErrorEntry`

**Severidade:** 🔵 Minor (code smell)
**Escopo:** `apps/mesas/backend/src/validators/devFeedbackValidator.ts:25`
**Origem:** SonarCloud — `es2015` convention

### Descrição

Linha 25 usa import-then-re-export (`export type { ConsoleErrorEntry, NetworkErrorEntry }`) em vez de `export type { ... } from '...'`. Sonar sugere re-export direto para consistência.

### Evidência (file:line)

`devFeedbackValidator.ts:15-25`:
```ts
import type {
  ConsoleErrorEntry,   // ← importado
  NetworkErrorEntry,   // ← importado
  ...
} from '@artificio/feedback';

export type { ConsoleErrorEntry, NetworkErrorEntry };  // ← re-export separado
```

### Sugestão

```ts
export type { ConsoleErrorEntry, NetworkErrorEntry } from '@artificio/feedback';
```

### Status

- [x] **Fechado** — `export type { ConsoleErrorEntry, NetworkErrorEntry } from '@artificio/feedback';` substitui import+re-export. Build + testes 114/114 verdes.

---

## R042-011 — Code Smell: Use `export…from` para re-exportar `NetworkErrorEntry`

**Severidade:** 🔵 Minor (code smell)
**Escopo:** `apps/mesas/backend/src/validators/devFeedbackValidator.ts:25`
**Origem:** SonarCloud — `es2015` convention

### Descrição

Mesmo diagnóstico do R042-010, flaggeado separadamente para `NetworkErrorEntry`. Resolvido na mesma linha.

### Status

- [x] **Fechado** — resolvido junto com R042-010. `export type { ConsoleErrorEntry, NetworkErrorEntry } from '@artificio/feedback';`

---

## R042-012 — Code Smell: Assertion desnecessária em `opts.kindGuard`

**Severidade:** 🔵 Minor (code smell)
**Escopo:** `packages/feedback/src/parse.ts:54`
**Origem:** SonarCloud — `redundant` `type-dependent`

### Descrição

`const guard = opts.kindGuard as ((v: string) => v is TKind) | undefined;` — o `as` é redundante porque `opts.kindGuard` já é tipado como `((value: string) => value is TKind) | undefined` via interface `ParseOptions`.

### Evidência (file:line)

`parse.ts:17-18` (interface):
```ts
export interface ParseOptions<TKind extends string = FeedbackKind> {
  kindGuard?: (value: string) => value is TKind;
```

`parse.ts:54` (uso):
```ts
const guard = opts.kindGuard as ((v: string) => v is TKind) | undefined;  // ← as desnecessário
```

### Sugestão

```ts
const guard = opts.kindGuard;
```

### Status

- [x] **Fechado** — `const guard = opts.kindGuard;` (sem `as`). Tipo já compatível com a interface `ParseOptions`. Build 17/17 verde.

---

## R042-013 — Code Smell: Assertion desnecessária em `kindRaw as TKind`

**Severidade:** 🔵 Minor (code smell)
**Escopo:** `packages/feedback/src/parse.ts:94`
**Origem:** SonarCloud — `redundant` `type-dependent`

### Descrição

`kind: kindRaw as TKind` — o `as TKind` é redundante porque `kindRaw` já foi validado pelo `kindGuard` (branch `guard(kindRaw)`) ou pelo else branch (`'bug' | 'suggestion'`). O tipo já é restrito.

### Evidência (file:line)

`parse.ts:53-94`:
```ts
const kindRaw = readString(body.kind).trim();
// ... validado por guard(kindRaw) ou === 'bug'/'suggestion'
return {
  ok: true,
  value: {
    kind: kindRaw as TKind,  // ← as desnecessário após validação
```

### Sugestão

Remover `as TKind` — o fluxo de validação já garante o tipo.

### Status

- [x] **Fechado** — `kind: kindRaw` (sem `as TKind`). TypeScript narrowing via `guard(kindRaw)` type predicate + else-if literal já restringe corretamente. Build 17/17 verde.
