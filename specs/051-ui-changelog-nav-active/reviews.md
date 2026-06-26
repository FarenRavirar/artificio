# 051 — reviews.md

> **Só reviews externos:** mantenedor, bots de PR (CodeRabbit, Amazon Q, Sonar, Snyk, CodeQL), checks de CI. Achados internos de investigação/lint/build/auditoria vão para `debitos.md`.
>
> Pétrea: o agente **não** responde/comenta/reage a revisores no PR. Veredito (procede/descarta/backlog) vive aqui + `debitos.md` + `project-state.md`.

| ID | Origem | Data | Achado | Veredito | Ação |
|---|---|---|---|---|---|
| REV-051-CI-01 | CI `lint + build + test` + `CI mesas` (PR #96, run 28199522636/28199522778) | 2026-06-25 | `GestaoPage.test.tsx` **15/15 fail**: `Error: useConfirm deve ser usado dentro de um ConfirmProvider`. | **Procede** (regressão real da Onda A) | Corrigir harness de teste (envolver em `<ConfirmProvider>`). Ver §1. |
| REV-051-CI-02 | CI `lint + build + test` + `CI mesas` (PR #96) | 2026-06-25 | `DiscordJsonImportPanel.test.tsx` **5/7 fail**: `Found multiple elements with the text of: JSON do DiscordChatExporter`. | **Procede** (bug de a11y no `FileDropzone` compartilhado) | `FileDropzone` aplica o mesmo `label` como `aria-label` no textarea **e** no input file → 2 elementos com mesmo nome acessível. Ver §2. |
| REV-051-CODEX-01 | chatgpt-codex-connector (PR #96, P2) | 2026-06-25 | `ConfirmDialog.tsx` L62: `onKeyDown` do overlay chama `handleConfirm()` em qualquer Enter; com Cancel auto-focado (non-danger), Enter no Cancel **aprova** em vez de cancelar. | **Procede** (bug UX/a11y) | Tratar Enter no nível do botão (ou só quando target = confirmar). Ver §3. |
| REV-051-CODEX-02 | chatgpt-codex-connector (PR #96, P2) | 2026-06-25 | `FileDropzone.tsx` L76-86: modo `showTextarea={false}` mostra "clique para selecionar" mas o clickarea não chama `fileInputRef.current?.click()` e o input é hidden → picker inacessível (só drag-drop). | **Procede (latente)** — nenhum consumidor usa `showTextarea={false}` hoje | Adicionar handler click/teclado no clickarea (ou botão explícito). Ver §4. |
| REV-051-RABBIT-01 | coderabbitai (PR #96, 🟡 Minor/🟠 Major) | 2026-06-25 | `ConfirmDialog.tsx:140` + `styles.css:1261` `.artificio-confirm-message`: mensagem renderizada em `<p>` com `white-space: normal` → `\n` vira espaço. Mensagens multiline dos novos consumidores (ex.: `GestaoPage.maybePublishPendingDrafts` monta lista com quebras) achatam numa linha. | **Procede** (regressão de conteúdo) | `white-space: pre-line` em `.artificio-confirm-message` (quick win). Ver §5. |
| REV-051-RABBIT-02 | coderabbitai (PR #96, 🟠 Major) | 2026-06-25 | `ConfirmDialog.tsx:58-66` Enter no overlay confirma com Cancel focado. | **Duplicado de REV-051-CODEX-01** (CodeRabbit confirma severidade Major) | Mesmo fix §3. |
| REV-051-RABBIT-03 | coderabbitai (PR #96, 🟠 Major) | 2026-06-25 | `FileDropzone.tsx:76-95` clickarea sem comportamento (`showTextarea={false}` morto + sem acesso teclado). | **Duplicado de REV-051-CODEX-02** (CodeRabbit confirma Major) | Mesmo fix §4. |
| REV-051-SONAR-01 | SonarCloud (PR #96, Minor) | 2026-06-25 | `glossario/frontend/src/App.tsx:4-5` — `@artificio/ui` importado 2× (linhas separadas p/ `Footer` e `ConfirmProvider`). | **Procede** (consistência) | Unificar: `import { Footer, ConfirmProvider } from '@artificio/ui'`. Ver §6. |
| REV-051-SONAR-02 | SonarCloud (PR #96, Minor) | 2026-06-25 | `ChangelogModal.tsx:355` — `rawChangelogs != null ? normalize() : fallback` é "unexpected negated condition". | **Procede** (readability) | Inverter: `rawChangelogs == null ? fallback : normalize()`. Ver §7. |
| REV-051-SONAR-03 | SonarCloud (PR #96, Major) | 2026-06-25 | `FileDropzone.tsx:81` — nested template literal `...${className ? ` ${className}` : ""}`. | **Procede** (maintainability, "brain-overload") | Extrair `dropzoneClass` via array+filter+join antes do JSX. Ver §8. |
| REV-051-SONAR-04 | SonarCloud (PR #96, Medium, a11y/react) | 2026-06-25 | `FileDropzone.tsx:104` — `<div role="button" tabIndex={0} onClick/onKeyDown>` (clickarea adicionado no fix §4). Sonar: usar `<button>` nativo (ou `<input type=button/image/reset/submit>`) em vez de `role="button"` p/ a11y consistente em todo dispositivo. | **Procede** (a11y/consistency) | Trocar `<div role="button">` por `<button type="button">` nativo no clickarea → remove `role`/`tabIndex`/handler de teclado manual (botão nativo já trata Enter/Space). **Corrigido** — ver §9. |
| REV-051-CODEQL-01 | CodeQL `js/polynomial-redos` (PR #96) | 2026-06-26 | `Nav.tsx:14` — regex `replace(/\/+$/, "")` sobre parâmetro `href` não controlado. CodeQL alerta ReDoS: `/` com backtracking polinomial em strings com muitas barras. | **Procede (gate bloqueante)** — ver §10. **Corrigido** | Risco prático nulo, mas CodeQL é check de CI bloqueante. Strip de barras finais sem regex de repetição (loop `charCodeAt`) elimina o ReDoS. |
| REV-051-RABBIT-04 | coderabbitai (PR #96, 🟠 Major) | 2026-06-26 | `apply_required_migrations.sh:+45-48` — `CLASS` validado só com `-z`. Valor não vazio mas inválido (typo) passa e `validate_sql_against_class` não bloqueia classes desconhecidas. | **Procede** — ver §11. **Corrigido** | Allowlist explícita `online-safe|manual-risk` em `load_header_vars` (fail-closed). |
| REV-051-RABBIT-05 | coderabbitai (PR #96, 🟢 Low) | 2026-06-26 | `Nav.tsx:17` — `String#charCodeAt()` deveria usar `String#codePointAt()`. Consistency/Reliability, es2015, internationalization. | **Procede** — ver §12. **Corrigido** | `charCodeAt` → `codePointAt` (guarda `end > 0` garante índice válido). Build+lint ✅. |
| REV-051-SMOKE-01 | smoke beta do mantenedor (2026-06-26, pós-deploy 051) | 2026-06-26 | Changelog quebrado: glossariobeta topo cortado, mesasbeta mistura com home, beta.artificiorpg não aparece. Marcador nav (F2) OK. | **Procede** (regressão F1, bloqueia prod) → **DEB-051-02** | Causa: Tailwind v4 dos consumidores não escaneia `packages/ui` → utilitários do `ChangelogModal` (`z-[9999]`, `max-h-[calc]`, `fixed`/`bg-black` no site) não gerados. Fix: `@source 'packages/ui'` nos 4 entry CSS. |

---

## §1 — REV-051-CI-01: `useConfirm` sem `ConfirmProvider` no teste

**Causa-raiz:** a Onda A migrou `GestaoPage` (e outros) de `window.confirm` → `useConfirm()`. O `useConfirm` lança se não houver `<ConfirmProvider>` ancestral (proteção correta). Em runtime o provider está no `App.tsx`, mas **`GestaoPage.test.tsx` renderiza a página isolada, sem o provider** → 15 testes quebram já no render.

**Evidência:** `[lint+build+test] FAIL src/pages/GestaoPage.test.tsx (15 tests | 15 failed)` + `Error: useConfirm deve ser usado dentro de um ConfirmProvider`. Mesma falha no check `CI mesas`.

**Fix aplicado (2026-06-25):** todos os 15 `render(<GestaoPage />)` envoltos em `<ConfirmProvider>` (`GestaoPage.test.tsx:4` import + L78-L249). `pnpm run test` → 163 pass (frontend), 223 pass (backend).

**Nota de processo:** o claim "build 17/17" da sessão da Onda A **não cobriu vitest** — lint passou, testes não foram rodados. Rodada 2 corrigiu: `pnpm run test` → 386 pass (f:163, b:223). T-A.1 fechado com evidência verde.

## §2 — REV-051-CI-02: `FileDropzone` duplica nome acessível

**Causa-raiz:** em `packages/ui/src/FileDropzone.tsx`, tanto o `<textarea>` (`aria-label={label ?? placeholder}`) quanto o `<input type="file">` (`aria-label={label ?? "Selecionar arquivo"}`) usam o **mesmo `label`**. Quando o consumidor passa `label="JSON do DiscordChatExporter"`, os dois elementos ficam com nome acessível idêntico → `getByLabelText(...)` acha 2 e o teste quebra. É bug de a11y real (2 controles distintos com mesmo rótulo), não só do teste.

**Evidência:** `FAIL src/features/discord-sync/components/DiscordJsonImportPanel.test.tsx` × 5 — `TestingLibraryElementError: Found multiple elements with the text of: JSON do DiscordChatExporter`.

**Fix aplicado (2026-06-25):** prop `fileLabel` separada em `FileDropzone.tsx` (L11); textarea usa `label`, input file usa `resolvedFileLabel` (distintos). Consumidor (`DiscordJsonImportPanel.tsx`) passa `fileLabel="Selecionar arquivo JSON do DiscordChatExporter"`. Teste usa `getByRole("textbox", ...)` (sem ambiguidade). `pnpm run test` → 7/7 pass.

## §3 — REV-051-CODEX-01: Enter no overlay confirma mesmo com Cancel focado

**Causa-raiz:** `handleKeyDown` no `<div className="artificio-confirm-overlay" onKeyDown=...>` (`ConfirmDialog.tsx:58-67`) faz `Enter → handleConfirm()` independentemente do elemento focado. Em diálogos non-danger o Cancel é auto-focado (`autoFocus={options.variant !== "danger"}`); um Enter borbulha até o overlay e **confirma** antes do botão focado agir. Em prompts destrutivos (publish-pending-drafts, warnings) o usuário de teclado aprova sem querer. Herdado do `ConfirmDialog` original do mesas, agora amplificado por ser compartilhado (4+ call-sites).

**Fix aplicado (2026-06-25):** removido o `Enter → handleConfirm` do nível do overlay em `ConfirmDialog.tsx:58-67`; mantido só `Escape → handleCancel`. Cada `<button>` responde ao próprio Enter (comportamento nativo). `handleConfirm` removido das deps do `useCallback`.

## §4 — REV-051-CODEX-02: clickarea do `FileDropzone` não abre o picker

**Causa-raiz:** no modo `showTextarea={false}` (`FileDropzone.tsx:76-86`) o clickarea exibe "ou clique para selecionar", mas o `<div>` não tem `onClick`/`onKeyDown` chamando `fileInputRef.current?.click()`, e o `<input type="file">` é hidden (`.artificio-dropzone-file-input`). Resultado: só drag-drop funciona; clique não abre o seletor. Bug real, porém **latente** — o único consumidor atual (mesas `DiscordJsonImportPanel`) usa `showTextarea` default (true), então o caminho quebrado não está em uso em produção.

**Fix aplicado (2026-06-25):** adicionado `role="button"`, `tabIndex={0}`, `onClick→openFilePicker`, `onKeyDown→handleClickareaKeyDown` (Enter/Space) no clickarea de `FileDropzone.tsx:103-119`. Funções auxiliares `openFilePicker` e `handleClickareaKeyDown` extraídas no topo do arquivo.

## §5 — REV-051-RABBIT-01: mensagem do ConfirmDialog colapsa quebras de linha

**Causa-raiz:** `.artificio-confirm-message` (`styles.css:1261-1266`) não define `white-space`, então herda `normal` — `\n` na `options.message` vira espaço. Consumidores que montam mensagem multiline (lista de drafts em `GestaoPage.maybePublishPendingDrafts`) perdem a formatação. Regressão de conteúdo introduzida ao centralizar (antes cada app podia ter CSS próprio).

**Fix aplicado (2026-06-25):** `white-space: pre-line;` em `.artificio-confirm-message` (`styles.css`). 1 linha.

## §6 — REV-051-SONAR-01: import duplicado `@artificio/ui`

**Causa-raiz:** `App.tsx` importa `Footer` (L4) e `ConfirmProvider` (L5) em linhas separadas do mesmo módulo. Semântica idêntica, mas inconsistente com o resto do monorepo (que unifica imports).

**Fix aplicado (2026-06-25):** `import { Footer, ConfirmProvider } from '@artificio/ui';`

## §7 — REV-051-SONAR-02: condição negada em `StaticChangelogModal`

**Causa-raiz:** `rawChangelogs != null ? normalize() : fallback` — o operador `!= null` é uma negação dupla conceitual (não-nulo). Inverter para `== null` põe o caminho default (fallback) primeiro, melhorando a leitura.

**Fix aplicado (2026-06-25):**
```ts
const resolved = rawChangelogs == null
  ? (changelogs ?? [])
  : normalizeChangelogEntries(rawChangelogs);
```

## §8 — REV-051-SONAR-03: nested template literal em className

**Causa-raiz:** `className={`artificio-dropzone${isDragOver ? " artificio-dropzone-active" : ""}${className ? ` ${className}` : ""}`}` — template literal com interpolação condicional dentro de template literal externo. Trocar por array+filter+join simplifica e elimina nesting.

**Fix aplicado (2026-06-25):**
```ts
const dropzoneClass = ["artificio-dropzone", isDragOver && "artificio-dropzone-active", className]
  .filter(Boolean)
  .join(" ");
// ... className={dropzoneClass}
```

## §9 — REV-051-SONAR-04: `role="button"` em `<div>` no clickarea

**Causa-raiz:** o fix §4 (REV-051-CODEX-02) adicionou acesso por clique/teclado ao clickarea via `<div role="button" tabIndex={0} onClick onKeyDown>` — reimplementa manualmente o que `<button>` nativo já entrega. Sonar (regra a11y/react) prefere elemento nativo: `<button type="button">` (ou `<input type=button/image/reset/submit>`) garante semântica, foco e Enter/Space em todo dispositivo sem `role`/`tabIndex`/handler manual.

**Fix aplicado (2026-06-25):** `<div role="button" tabIndex onKeyDown>` → `<button type="button" onClick={openFilePicker}>` em `FileDropzone.tsx:94`. Removidos `role`, `tabIndex`, `onKeyDown` e o helper `handleClickareaKeyDown` (botão nativo trata Enter/Space); import `KeyboardEvent` removido. CSS `.artificio-dropzone-clickarea` ganhou reset de button nativo (`background:none; border:none; color/font:inherit; width:100%`). `pnpm --filter @artificio/ui lint+build` ✅; `mesas-frontend test` 163/163 ✅.

## §10 — REV-051-CODEQL-01: regex polinomial `replace(/\/+$/, "")` em `normalizeHref`

**Causa-raiz:** `packages/ui/src/Nav.tsx:14`, função `normalizeHref()`:

```ts
function normalizeHref(href: string): string {
  try {
    const url = new URL(href);
    return url.hostname.toLowerCase();
  } catch {
    return href.toLowerCase().replace(/\/+$/, "");
  }
}
```

CodeQL `js/polynomial-redos` alerta que `replace(/\/+$/, "")` usa backtracking que escala polinomialmente com repetições de `/`. Em teoria, string `////...///` (N barras) causa O(N²) no engine de regex V8.

**Risco prático baixo (mas check bloqueante):**
1. O `catch` só é atingido quando `new URL(href)` lança — `href` **não é** URL válida. Acontece apenas com paths relativos (`/catalogo`, `/painel`) vindos de `moduleCurrentHref` (moduleNav interno), strings curtas/estáticas de `modules.ts` ou do código do app — nunca input externo/usuário.
2. Pior caso (string hostil forjada) = performance local no browser do atacante, não DoS no servidor.

Apesar do risco prático nulo, **CodeQL `js/polynomial-redos` é check de CI bloqueante** (falhou no PR #96). Não há ganho em discutir o gate: o fix é trivial e elimina a regex de repetição ancorada de vez.

**Veredito: procede (desbloqueio de gate + defense-in-depth). Corrigido (2026-06-26).**

Fix aplicado — remove `replace(/\/+$/, "")` por strip não-regex (sem backtracking):

```ts
} catch {
  // Fallback sem regex de repeticao ancorada (evita ReDoS polinomial — CodeQL/Sonar):
  let end = href.length;
  while (end > 0 && href.charCodeAt(end - 1) === 47 /* "/" */) end--;
  return href.slice(0, end).toLowerCase();
}
```

Comportamento idêntico ao regex antigo (6/6 casos: `/Busca/`→`/busca`, `/x///`→`/x`, `///`→``, `HTTPS://A.COM/`→`a.com`, etc.). `packages/ui` build+lint ✅.

---

## §11 — REV-051-RABBIT-04: `CLASS` sem validação de domínio em `apply_required_migrations.sh`

**Causa-raiz:** `apply_required_migrations.sh:45-48` (commit `971bc3f`, Onda D):

```bash
if [[ -z "$CLASS" || -z "$REQUIRES_BACKUP" ]]; then
  echo "::error::$path falhou ao carregar cabecalho parseado." >&2
  return 1
fi
```

`load_header_vars` extrai `CLASS` do header `-- @artificio/class: <valor>` do arquivo SQL. A validação atual só rejeita vazio (`-z`). Se o header tiver um typo (ex.: `-- @artificio/class: online-sfe`), `CLASS="online-sfe"` passa — não é vazio, mas é inválido. Em seguida, `validate_sql_against_class` só age para `online-safe`; para qualquer outro valor (válido ou não), retorna 0 silenciosamente e a migration é aplicada sem entrar em `MANUAL_PENDING`.

**Risco real, mas baixo:** exige typo humano no header da migration. Nenhum typo conhecido no repositório atual. Na prática, `parse_header` (`lib_migrations.sh:24`) já constrange `CLASS` ao regex `(online-safe|manual-risk)$` — header inválido faz `parse_header` retornar 1 antes. Mas `load_header_vars` confia cego nesse contrato; se `parse_header` mudar, a falha fica silenciosa.

**Veredito: procede (defense-in-depth). Corrigido (2026-06-26).**

Fix aplicado — allowlist explícita fail-closed em `load_header_vars` (domínio real do header = `online-safe|manual-risk`, não `offline-safe/requires-backup` do fix proposto pelo bot):

```bash
if [[ "$CLASS" != "online-safe" && "$CLASS" != "manual-risk" ]]; then
  echo "::error::$path: CLASS invalida '$CLASS' (esperado online-safe ou manual-risk)." >&2
  return 1
fi
```

shellcheck ✅, `test_migration_guard.sh` 39/39 ✅.

---

## Próximo passo
- **Achados §1–§9 corrigidos (2026-06-25).** `packages/ui` lint+build ✅, `mesas-frontend` test 163/163 ✅.
- **§10 corrigido (2026-06-26).** CodeQL ReDoS era check bloqueante; `normalizeHref` fallback sem regex de repetição. `packages/ui` build+lint ✅.
- **§11 corrigido (2026-06-26).** Allowlist `CLASS` em `load_header_vars`. shellcheck ✅, guard 39/39 ✅. DEB-051-RABBIT-04 fechado.
- T-A.2 (smoke visual cross-app, light+dark) pendente — não bloqueia merge.
- Pétrea: **nenhuma resposta aos bots no PR** — veredito só aqui.

---

## §12 — REV-051-RABBIT-05: `charCodeAt` → `codePointAt` ✅ corrigido

**Achado:** CodeRabbit sugere trocar `href.charCodeAt(end - 1) === 47` por `codePointAt()` (`Nav.tsx:17`). Severidade Low (3), esforço 5min.

**Correção (2026-06-26):** `charCodeAt` → `codePointAt`. A guarda `end > 0` já garante que `end - 1 ≥ 0` (índice válido), então `codePointAt()` sempre retorna `number`. Build `@artificio/ui` ✅, lint 15/15 ✅. 1 linha alterada.
