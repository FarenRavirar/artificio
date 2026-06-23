# Reviews2 — CodeRabbit pós-PR #89 (débitos finais)

> Reviews recebidos do CodeRabbit no PR #89 (`chore/047-debitos-finais`).
> Registro de investigação e implementação. Cada item contém análise, classificação e status.

**PR:** https://github.com/FarenRavirar/artificio/pull/89
**Branch:** `chore/047-debitos-finais`

---

## REV-027 — toNumberOrNull permite NaN/Infinity no contrato de confidence

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts:16-17` — `toNumberOrNull`
- **Resumo:** `toNumberOrNull` permite que `Number(v)` produza `NaN` (para strings como "abc") ou `Infinity` (para "Infinity"), violando o contrato de tipo `number | null`. Afeta respostas em 5 endpoints (linhas 119, 191, 249, 339, 410).
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ investigado — falso positivo (constraint NUMERIC(4,3) impede valores inválidos no DB). Ver investigação abaixo.
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-027

- **Classificação:** falso positivo — não se materializa no fluxo real
- **Severidade real:** 🟢 Info — defesa em profundidade opcional, não bug ativo
- **Impacto real:** Nenhum. Todos os 5 endpoints que usam `toNumberOrNull` recebem `confidence` exclusivamente de rows do banco (`draftRow.confidence`, `row.confidence`, `draft.confidence`). A coluna é `NUMERIC(4,3)` (migration_115:68) — constraint do PostgreSQL que rejeita qualquer valor NaN/Infinity na escrita. Os únicos pontos que escrevem confidence são INSERT/UPDATE com `normalized.draft.confidence`, que vem de `calcConfidence` (parseDiscordAnnouncement.ts:379-386) produzindo `Math.round((filled / fields.length) * 100) / 100` — sempre número finito entre 0 e 1.
- **Cadeia de evidências:**
  1. `adminImportInbox.ts:16-17` — `toNumberOrNull` usa `Number(v)` sem filtro de NaN/Infinity
  2. `adminImportInbox.ts:119` — `existingDraft.confidence` vem do banco (SELECT linha 101)
  3. `adminImportInbox.ts:191` — `draftRow.confidence` vem do banco (INSERT RETURNING linha 170)
  4. `adminImportInbox.ts:249` — `row.confidence` vem do banco (SELECT linha 222)
  5. `adminImportInbox.ts:339` — `row.confidence` vem do banco (SELECT linha 308)
  6. `adminImportInbox.ts:410` — `draft.confidence` vem do banco (UPDATE RETURNING linha 406)
  7. `adminImportInbox.ts:167` — INSERT usa `normalized.draft.confidence` (sempre número de calcConfidence)
  8. `migration_115_discord_import.sql:68` — `confidence NUMERIC(4,3)` — rejeita NaN/Infinity no DB
  9. `parseDiscordAnnouncement.ts:385` — `calcConfidence` retorna `Math.round(...)` — sempre número finito
- **Driver pg e NUMERIC:** node-postgres converte `NUMERIC` para string (docs oficiais: "strings by default — node-postgres will convert a database type to a JavaScript string if it doesn't have a registered type parser"). Então `Number("0.750")` em `toNumberOrNull` funciona corretamente. Strings não-numéricas só chegariam se o DB armazenasse algo inválido, o que a constraint `NUMERIC(4,3)` impede.
- **Cenário teórico de falha:** Se alguém fizer `UPDATE discord_import_table_drafts SET confidence = 'NaN'::text` (cast explícito), o PG rejeita com `invalid input syntax for type numeric: "NaN"`. Se fizer `UPDATE ... SET confidence = 'NaN'::numeric`, o PG rejeita porque NaN não cabe em `NUMERIC(4,3)` (PG trata NaN como domínio separado, rejeitado por `numeric`).
- **Risco de regressão:** Nenhum — adicionar `Number.isFinite()` em `toNumberOrNull` seria hardening, não correção de bug ativo
- **Já existe tratamento?** A constraint `NUMERIC(4,3)` no DB é a defesa primária. A injeção de confidence via PATCH (linha 350-354) é controlada por schema Zod (`patchDraftSchema`) que NÃO inclui `confidence` no corpo — não é editável. Rota de correction também não altera confidence.
- **Falso positivo?** Sim — a preocupação é tecnicamente válida (a função aceita NaN/Infinity), mas não há caminho de execução real que produza esses valores. A constraint `NUMERIC(4,3)` bloqueia na fonte.
- **Recomendação:** Adicionar `return (n !== null && Number.isFinite(n)) ? n : null` em `toNumberOrNull` como defesa em profundidade (hardening). Não é urgente.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-028 — Radios de interpretação sem `name` formam grupo não-semântico

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx:80-86`
- **Resumo:** Dois `<input type="radio">` sem atributo `name`. Sem `name`, não formam grupo semântico; navegação por teclado/leitores de tela fica inconsistente mesmo com `checked` controlado.
- **Severidade declarada:** 🟡 Minor
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-028

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — acessibilidade, não bloqueia funcionalidade
- **Impacto real:** Os dois radios (linhas 81, 85) não têm atributo `name`. Navegadores usam `name` para agrupar radios — sem ele:
  - Navegação por setas do teclado não funciona (Tab entra no grupo mas setas não alternam entre opções)
  - Leitores de tela (NVDA, VoiceOver, JAWS) não anunciam como grupo de opções relacionadas
  - O clique ainda funciona (cada input tem `onChange` próprio com o valor fixo), então o fluxo admin com mouse não é afetado
- **Evidências de código:**
  1. `DraftEditorTab.tsx:81` — `<input type="radio" checked={...} onChange={() => onSetSlotsInterpretation('filled_total')}>` — sem `name`
  2. `DraftEditorTab.tsx:85` — `<input type="radio" checked={...} onChange={() => onSetSlotsInterpretation('open_total')}>` — sem `name`
- **Risco de regressão:** Nenhum — adicionar `name="slots-interpretation"` em ambos é puramente aditivo
- **Já existe tratamento?** Não
- **Falso positivo?** Não — a ausência de `name` é real e fere boas práticas de acessibilidade
- **Recomendação:** Adicionar `name="slots-interpretation"` em ambos os `<input type="radio">`. Correção de 1 linha cada, sem mudança de comportamento.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-029 — STATUS_OPTIONS exclui `synced` — select de edição omite status sincronizado

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/constants.ts:1-3` — `STATUS_OPTIONS`
- **Resumo:** `DiscordImportDraftStatus` inclui `synced`, mas `STATUS_OPTIONS` não. Para drafts já sincronizados, o valor atual fica fora das opções. Se `synced` não deve ser editável manualmente, usar tipo `EditableDiscordImportDraftStatus` em vez da union completa.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-029

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — edge case: admin quase nunca tenta editar status de draft synced
- **Impacto real:** Se admin abre um draft com status `synced` (ex: visualizando após sync) e clica "Editar status", o `<select>` (linha 43-46 de DiscordDraftPreview.tsx) renderiza opções `['draft', 'ready', 'needs_review', 'rejected']` — nenhuma delas é `synced`. O select fica com `value={h.newStatus}`. `h.newStatus` é inicializado com `draft.status` (useDraftForm.ts:23). Se draft.status é `synced` e não está nas opções, o select mostra o primeiro option (`draft`) como fallback visual do browser. Se admin salva, o PATCH backend (adminImportInbox.ts:352) aceita qualquer status que não `synced` via schema Zod — admin pode "des-sincronizar" um draft sem perceber.
- **Evidências de código:**
  1. `constants.ts:3` — `['draft', 'ready', 'needs_review', 'rejected']` — sem `synced`
  2. `discord-sync/types.ts:5` — `DiscordImportDraftStatus = 'draft' | 'ready' | 'needs_review' | 'synced' | 'rejected'` — inclui `synced`
  3. `DiscordDraftPreview.tsx:44` — select renderizado com `STATUS_OPTIONS`
  4. `DiscordDraftPreview.tsx:~113` — botão "Editar status" SEM guarda para `draft.status === 'synced'`
  5. `useDraftForm.ts:23` — `useState<DiscordImportDraftStatus>(draft.status)` — pode ser `synced`
- **Risco de regressão:** Baixo — mudanças localizadas no select ou na guarda do botão
- **Já existe tratamento?** Não há guarda no frontend para impedir edição de status de draft synced
- **Duas abordagens de correção:**
  - Opção A: ocultar botão "Editar status" para drafts `synced` no DiscordDraftPreview (mais simples, evita o cenário)
  - Opção B: criar tipo `EditableDiscordImportDraftStatus` excluindo `synced` e usar em vez da union completa (semântica mais clara)
- **Falso positivo?** Não — a falta de alinhamento entre tipo e opções do select é real
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

?> **Pergunta:** Opção A (ocultar botão) ou Opção B (tipo separado)? Ambas são compatíveis e podem ser combinadas. Recomendo Opção A como fix, Opção B como melhoria de tipo.

---

## REV-030 — Casts de enum sem allowlist em draftFormUtils (normalização de payload)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts:76-84`
- **Resumo:** Casts `as DraftTableType`, `as DraftModality`, `as DraftPriceType`, `as DraftFrequency` aceitam qualquer string não vazia. Depois `validateForm` passa e `buildUpdatedPayload` persiste valores fora da union. Violação da guideline: "All external/API/database/JSON/JSONB/query/localStorage/integration data must be typed as unknown and passed through a typed normalizer before entering React state, props, or render". Sugere allowlists por campo antes do cast.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ investigado — procede, mas débito no backend (PATCH sem validação de enum). Frontend é seguro (selects controlados). Ver investigação abaixo.
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-030

- **Classificação:** procede, mas é débito separado (validação de enums no backend PATCH)
- **Severidade real:** 🟡 Minor — o frontend só produz valores via `<select>` controlado; o vetor é o backend PATCH sem validação de enum
- **Impacto real:**
  - **Fluxo normal (parser Discord/Inbox):** `normalizeDiscordTableDraft` produz sempre valores válidos (`campanha`, `online`, `gratuita`, `semanal`) — zero risco
  - **Fluxo admin (frontend):** `<select>` com `<option>` fixas — usuário só pode escolher entre valores válidos
  - **Fluxo PATCH API direto:** schema Zod (`patchDraftSchema:350-354`) usa `z.record(z.string(), z.unknown()).optional()` para `normalized_payload` — **não valida enums**. Valor `"banana"` em `table.type` passa pelo Zod e persiste no banco. Quando carregado pelo frontend, `buildForm` na linha 76 faz `(asString(table.type) as DraftTableType)` — TypeScript aceita, runtime recebe `"banana"`, e o select (linha 111) fica sem option correspondente (mostra vazio).
- **Evidências de código:**
  1. `draftFormUtils.ts:76` — `(asString(table.type) as DraftTableType) || 'campanha'` — cast sem allowlist
  2. `draftFormUtils.ts:77` — mesmo padrão para modality
  3. `draftFormUtils.ts:78` — mesmo para price_type
  4. `draftFormUtils.ts:84` — mesmo para frequency
  5. `DraftEditorTab.tsx:111-132` — todos `<select>` com options fixos — frontend seguro
  6. `adminImportInbox.ts:350-354` — `patchDraftSchema.normalized_payload: z.record(z.string(), z.unknown()).optional()` — sem validação de enums
- **Risco de regressão:** Baixo — adicionar validação no backend PATCH (Zod schema para subcampos) ou allowlist no frontend (defesa extra) não muda caminho feliz
- **Já existe tratamento?** O frontend só produz valores via `<select>` controlado. Backend não tem validação de enums no PATCH.
- **Falso positivo?** Parcial — a preocupação com o cast em si é teórica (frontend controlado + backend já normalizou). O débito real (falta validação de enum no PATCH) é válido mas está no backend, não no frontend.
- **Recomendação:** Adicionar validação de enums no backend PATCH (`patchDraftSchema` ou normalizador separado). Alternativamente, adicionar allowlist no `buildForm` como defesa extra.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-031 — API_BASE duplicada e SystemTreeNode sem normalizador tipado

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts:199-206` — `loadSystems`
- **Resumo:** (1) A URL não remove `/api/v1`, mas `handleCoverUpload` faz isso — em ambientes com `VITE_API_URL` já versionado, o endpoint vira `/api/v1/api/v1/systems`. (2) `filter(isRecord) as unknown as SystemTreeNode[]` deixa objetos sem `id`/`name` entrarem no estado/render. Violação da guideline de normalização tipada.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-031

- **Classificação:** procede e deve ser implementado (ambos os problemas)
- **Severidade real:** 🟡 Minor — Problema 1 (API_BASE): só materializa se `VITE_API_URL` terminar com `/api/v1`. Problema 2 (normalizador): baixa probabilidade de falha (back-end próprio, schema estável)
- **Impacto real:**
  - **Problema 1 (URL duplicada):** `loadSystems` (linha 200) monta `${API_BASE}/api/v1/systems`. Se `VITE_API_URL` for `https://api.exemplo.com/api/v1`, o endpoint vira `https://api.exemplo.com/api/v1/api/v1/systems` — 404. `handleCoverUpload` (linha 120) faz `.replace(/\/api\/v1$/, '')` antes de montar a URL — não tem o problema. **Inconsistência entre funções.**
  - **Problema 2 (sem normalizador):** `filter(isRecord) as unknown as SystemTreeNode[]` (linha 206) — `isRecord` só valida que é `object && !null && !Array.isArray`. Objeto `{ foo: "bar" }` passa. `flattenSystems` depois acessa `.id`, `.name`, `.children` sem null-check — `undefined.id` crasha. `useDraftForm.ts:18` consome `systems` para renderizar o select de sistema.
- **Evidências de código:**
  1. `draftFormUtils.ts:199` — `const API_BASE = import.meta.env.VITE_API_URL || '';`
  2. `draftFormUtils.ts:200` — `` fetch(`${API_BASE}/api/v1/systems?view=tree`, ...) `` — sem remover `/api/v1` do base
  3. `useDraftForm.ts:120` — `const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1$/, '');` — com remoção
  4. `draftFormUtils.ts:206` — `Array.isArray(data) ? data.filter(isRecord) as unknown as SystemTreeNode[] : []` — sem normalizador
  5. `types/systems.ts:3-15` — `SystemTreeNode` tem 10 campos (id, name, name_pt, slug, parent_id, node_type, ...)
  6. `draftFormUtils.ts:187-197` — `flattenSystems` acessa `node.id`, `node.name`, `node.children`
- **Risco de regressão:** Baixo — corrigir URL é trivial. Adicionar normalizador Zod é aditivo.
- **Já existe tratamento?** Não para nenhum dos dois problemas.
- **Falso positivo?** Não — ambos são reais, embora o Problema 1 dependa de configuração específica.
- **Recomendação:**
  - Problema 1: unificar extração de `apiBase` em helper compartilhado (ex: `const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1$/, '')`). Usar em `loadSystems` e `handleCoverUpload`.
  - Problema 2: adicionar normalizador Zod para `SystemTreeNode` em `loadSystems`, validando `id` (string), `name` (string), `children` (optional array recursivo).
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-032 — useEffect-like síncrono em render do useDraftForm: capa e payload sem sincronização

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts:29-45`
- **Resumo:** `coverPreviewUrl` inicia como string vazia — capa existente não aparece ao abrir modal no primeiro render. O `if` na linha 36 ignora mudanças em `normalized_payload`/`parsed_payload` — se reparse ou atualização muda o payload mantendo `id`/`status`/`review_notes` iguais, formulário fica obsoleto. Chamar `setState` durante render viola padrões React e causa re-renders desnecessários.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-032

- **Classificação:** procede e deve ser implementado (Problema 1: bug real de capa. Problema 2: edge case de payload desatualizado. Problema 3: violação de padrão React)
- **Severidade real:** 🟠 Major — Problema 1 (capa não aparece) é bug visual real no primeiro render. Problema 2 pode causar form desatualizado silenciosamente.
- **Impacto real detalhado:**

  **Problema 1 — coverPreviewUrl vazio no primeiro render:**
  - `useState('')` na linha 29 não é inicializado a partir do `draft.normalized_payload`
  - `initialPayload` (linha 11-14) via `useMemo` calcula o form inteiro incluindo `cover_url`, mas `coverPreviewUrl` é estado separado
  - O if na linha 36 compara `draft.id !== prevDraftId` — no primeiro render, `prevDraftId` foi inicializado com `draft.id` (linha 31), então o if **não dispara**
  - Resultado: ao abrir preview de draft com capa, a capa não aparece (UI mostra input de upload vazio)
  - Cenário: admin abre inbox draft que já passou por PATCH de capa → capa invisível

  **Problema 2 — if ignora mudança de `normalized_payload`/`parsed_payload`:**
  - Condição na linha 36 só compara `id`, `status`, `review_notes`
  - Se PATCH mudar só o `normalized_payload` (ex: correção automática de sistema), o if não dispara
  - `initialPayload` (useMemo) recalcula com o novo payload, mas `form` (useState) não é re-inicializado — estado interno prevalece
  - Form exibe valores antigos mesmo com draft atualizado

  **Problema 3 — setState durante render (side effect):**
  - Linhas 38-44 chamam `setForm()`, `setNewStatus()`, `setReviewNotes()`, `setCoverPreviewUrl()`, etc durante a renderização
  - React permite setState durante render (desde React 18) mas causa re-render extra e é má prática
  - Padrão correto: `useEffect` para sincronizar estado derivado de props

- **Evidências de código:**
  1. `useDraftForm.ts:29` — `useState('')` — `coverPreviewUrl` sem valor inicial do draft
  2. `useDraftForm.ts:11-14` — `useMemo` calcula `initialPayload` com `cover_url` mas não alimenta `coverPreviewUrl`
  3. `useDraftForm.ts:31-33` — `prevDraftId`, `prevDraftStatus`, `prevDraftReviewNotes` todos espelham valores atuais
  4. `useDraftForm.ts:36` — if compara só `id`/`status`/`review_notes`, ignorando `normalized_payload`
  5. `useDraftForm.ts:38-44` — múltiplos `setState` durante render (side effect)
  6. `DraftEditorTab.tsx:55` — `<img src={coverPreviewUrl}>` (se vazio, não exibe capa)
- **Risco de regressão:** Médio — mudar de setState-em-render para `useEffect` requer cuidado para não alterar ordem de render
- **Já existe tratamento?** Não para nenhum dos 3 problemas
- **Falso positivo?** Não — os 3 problemas são reais. Problema 1 é o mais crítico (impacto visual imediato).
- **Recomendação:** Refatorar o bloco síncrono (linhas 36-45) para `useEffect` que depende de `draft.id`, `draft.status`, `draft.review_notes`, `draft.normalized_payload` e `draft.parsed_payload`. Inicializar `coverPreviewUrl` via `useState(() => ...)` com valor derivado do draft na criação do hook.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-033 — canSync permite sincronizar alterações locais não salvas

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts:65-66` — `canSync`
- **Resumo:** `canSync` valida o form local, mas `handleSync` envia o draft persistido. Se usuário edita um campo válido e clica em sincronizar sem "Salvar campos", a mesa é criada/atualizada com o payload antigo.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-033

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — cenário improvável (admin precisa ignorar fluxo natural), mas possível
- **Impacto real:** Admin edita campos no form local (ex: corrige título) e clica "Sincronizar como mesa" sem clicar "Salvar campos" primeiro. `canSync` (linha 66) valida `form` local (que tem os dados novos e completos) → botão fica habilitado. `handleSync` (linha 193) chama `syncDraft(draft.id)` que carrega o draft do banco (com dados antigos) → mesa criada com dados antigos. Admin acredita que suas edições foram sincronizadas.
- **Evidências de código:**
  1. `useDraftForm.ts:66` — `const canSync = draft.status === 'ready' && missingFields.length === 0` — valida form local
  2. `useDraftForm.ts:193-214` — `handleSync` não persiste `form` antes de sincronizar — chama `syncDraft(draft.id)` direto
  3. `DiscordDraftPreview.tsx:~131` — `<button disabled={!h.canSync} onClick={() => h.handleSync(onBeforeSync)}>` — botão habilitado com form local válido
- **Risco de regressão:** Baixo — adicionar guarda no `handleSync` para só permitir sync se form == persisted (ou salvar antes de sync) é aditivo
- **Já existe tratamento?** Não — o fluxo assume que admin sempre salva antes de sincronizar
- **Falso positivo?** Não — o gap entre form local e persisted state é real
- **Recomendação:** No `handleSync`, antes de chamar `syncDraft`, persistir o form local via `handleSaveFields` primeiro (ou verificar dirty state). Alternativa: desabilitar sync se houver dirty fields não salvos.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-034 — reviewNotes || undefined impede limpar notas de revisão

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts:237-239`
- **Resumo:** `reviewNotes || undefined` — salvar nota vazia omite o campo no PATCH, impedindo limpar notas existentes. Deve enviar a string normalizada explicitamente.
- **Severidade declarada:** 🟡 Minor
- **Status:** ✅ implementado — 2026-06-23
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-034

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — UX frustrante (nota não some ao limpar), não perda de dados
- **Impacto real:** Admin abre draft com nota antiga, apaga o texto no campo, clica "Salvar". `handleSaveStatus` (linha 234) chama `draftApi.updateDraft` com `review_notes: reviewNotes || undefined`. `reviewNotes` é `""` → `"" || undefined` → `undefined`. O PATCH não envia `review_notes`. Backend (adminImportInbox.ts:352: `review_notes: z.string().optional()` — schema não exige) não atualiza a coluna. A nota antiga persiste no banco. Admin precisa recarregar a página para perceber que a nota não foi removida.
- **Evidências de código:**
  1. `useDraftForm.ts:239` — `review_notes: reviewNotes || undefined` — falsy string vazia vira undefined
  2. `adminImportInbox.ts:352` — `review_notes: z.string().optional()` — se omitido, não atualiza
  3. `adminDiscordSync.ts:44` — mesmo schema para Discord Sync
- **Risco de regressão:** Nenhum — corrigir para `reviewNotes === '' ? '' : (reviewNotes || undefined)` é puramente aditivo
- **Já existe tratamento?** Não
- **Falso positivo?** Não — o `||` com string vazia é um padrão bugado clássico
- **Recomendação:** Trocar `reviewNotes || undefined` por `reviewNotes === '' ? '' : (reviewNotes || undefined)` ou `reviewNotes || null` (se o schema aceitar null). Verificar schema Zod do PATCH — se aceitar null, enviar null em vez de undefined.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23

---

## REV-035 — z.coerce.number() mascara valores de contrato inválidos em confidence

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/api/inboxApi.ts` — schemas de confidence (linhas 37, 52, 64)
- **Resumo:** `z.coerce.number().nullable()` aceita strings vazias `""` e apenas espaços `" "` como `0`, além de `true` como `1` e `false` como `0`. Para campo semântico como `confidence`, mascara erro de contrato em vez de rejeitar payload malformado.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ investigado — falso positivo (correção adequada para o problema real)
- **Task vinculada:** REV-025 (confidence string→number)
- **Débito vinculado:**

> **Nota:** REV-025 (confidence string→number) foi implementado localmente antes deste PR. Ver `reviews.md` para histórico. Este review (REV-035) é continuação da correção de REV-025 — refina a defesa do frontend.

#### 🔍 INVESTIGAÇÃO REV-035

- **Classificação:** falso positivo — `z.coerce.number()` é a ferramenta correta para o problema real (pg devolve string para NUMERIC). O mascaramento de tipos inválidos é teórico porque o backend controla a serialização via `toNumberOrNull`.
- **Severidade real:** 🟢 Info — defesa em profundidade opcional, não bug ativo
- **Impacto real:** Nenhum. `z.coerce.number().nullable()` foi introduzido como correção de **REV-025** (onde `z.number().nullable()` quebrava porque o driver `pg` devolve `NUMERIC` como string — docs oficiais: "strings by default"). O backend Inbox serializa `confidence` via `toNumberOrNull` (adminImportInbox.ts:16-17) que só retorna `number | null` (nunca `true`, `false`, `""`). Cadeia de dados: banco `NUMERIC(4,3)` → pg devolve string → `toNumberOrNull` converte → JSON serializa como number → frontend recebe number.
- **Evidências de código:**
  1. `inboxApi.ts:37` — `confidence: z.coerce.number().nullable()` no `inboxImportDraftSchema`
  2. `inboxApi.ts:52` — `confidence: z.coerce.number().nullable()` no `inboxDraftSummarySchema`
  3. `inboxApi.ts:64` — `confidence: z.coerce.number().nullable()` no `inboxDraftSchema`
  4. `adminImportInbox.ts:16-17` — `toNumberOrNull` — só retorna `number | null` (filtra null/undefined, coage string via Number(), mas não filtra NaN/Infinity — ver REV-027 para análise)
  5. `adminImportInbox.ts:119,191,249,339,410` — todos os 5 endpoints usam `toNumberOrNull` antes da serialização JSON
  6. `migration_115_discord_import.sql:68` — `confidence NUMERIC(4,3)` — constraint rejeita valores não-numéricos no banco
- **Risco de regressão:** Nenhum — `z.coerce.number()` é uma solução comprovada e testada
- **Já existe tratamento?** Backend garante que `confidence` serializado é sempre `number | null` via `toNumberOrNull`. O schema Zod atual é defensivo e aceita qualquer coercível.
- **Falso positivo?** Sim — a preocupação é tecnicamente correta (`z.coerce.number()` aceita mais tipos que `z.number()`), mas no fluxo real o backend nunca produz esses tipos. `z.coerce.number()` foi a escolha deliberada para resolver o mismatch de tipo do driver pg de forma pragmática.
- **Recomendação:** Manter `z.coerce.number()`. Para defesa extra (opcional): `z.coerce.number().refine(v => v === null || (Number.isFinite(v) && v >= 0 && v <= 1))` — mas isso adicionaria complexidade sem benefício real, dado que o backend controla a serialização.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-23**
