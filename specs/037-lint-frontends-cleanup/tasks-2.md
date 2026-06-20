# Tasks-2 — Revisão CodeRabbit (PR #74)

> Sugestões do CodeRabbit na PR #74 (`feat/links-013-app`). Levantadas e categorizadas em 2026-06-20.
> **Regra:** não descartar nenhuma. Validar sem caminho feliz. Corrigir se proceder, em qualquer prioridade.

---

## Resumo

- **Total:** 21 sugestões catalogadas (+8 embutidas no review body 18:27, inacessíveis via API individual)
- **ADDRESSED (já corrigidas em commits):** 6 (CR-C1..C5, CR-C6 cosmetica)
- **EXECUTADAS (037 Fase 2):** 13 (CR-A1..A7 + CR-D1..D7, via T21-T33) ✅
- **FALSO POSITIVO:** 1 (CR-B1)

---

## Categoria A — Pendentes · Código (7)

### CR-A1 · `apps/links/server/lib/render.ts:64` — Escape de JSON-LD em `<script>`
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `JSON.stringify(jsonLd)` injetado direto em `<script type="application/ld+json">`. Se algum campo contiver `</script>`, quebra o bloco.
- **Status:** ✅ T25 — defense-in-depth aplicado (ver investigação completa abaixo).

#### Investigação profunda

**1. Mecanismo de ataque (HTML spec)**

O HTML parser usa um algoritmo de "script data state" (HTML Living Standard §4.12.1.3) que termina o bloco `<script>` ao encontrar a sequência `</script` (case-insensitive), **independentemente do atributo `type`**. Mesmo com `type="application/ld+json"` (data block, não executável), o parser encerra o elemento ao ver `</script`. O spec recomenda explicitamente escapar `</script` como `\x3C/script` em literais dentro de scripts.

**2. Análise de fluxo de dados (todas as entradas → JSON-LD)**

Campos no `jsonLd` de `renderGroupPage()`:
| Campo | Origem | Sanitização de entrada |
|-------|--------|----------------------|
| `name` | `g.name` (DB) | `cleanText(name, 80)` → `sanitize-html` com `allowedTags:[]` — **remove toda tag HTML incluindo `</script>`** |
| `description` | `g.description` (DB) | `cleanText(description, 500)` — idem acima |
| `logo` / `image` | `g.logo_url` (DB) | URL Cloudinary (estrutura controlada) |
| `url` | `canonical` (construído) | `SITE` + `slug` → slug via `slugify`/`ensureUniqueSlug` (só alfanumérico) |
| `sameAs` | `g.invite_url` (DB) | `parseInviteUrl` → só WhatsApp URLs (`chat.whatsapp.com` / `whatsapp.com`) |

Caminhos de entrada para o DB:
1. **Sugestão da comunidade** → `POST /api/groups/suggest` → `parseSuggestion()` → `cleanText(name,80)` + `cleanText(description,500)`
2. **Edição admin** → `PATCH /api/admin/v1/groups/:id` → `cleanText(name,80)` + `cleanText(description,500)` (linhas 184, 192 de server.ts)
3. **Seed** → `seed.ts` insere strings hardcoded de `groups.ts` (source control, sem `cleanText`, mas desenv-controlado)

**3. Teste do `sanitize-html`**

`sanitize-html@2.17.4` com `{ allowedTags: [], allowedAttributes: {} }`:
- Usa `htmlparser2` (parser HTML conforme spec)
- Remove TODAS as tags, abertura e fechamento
- `sanitizeHtml("hello </script> world", { allowedTags: [] })` → `"hello  world"` (fechamento removido)
- Decodifica entidades HTML antes de strip (`&lt;/script&gt;` → `</script>` → removido)
- Unicode escapes (`\u003c/script>`) → JS já converteu para `<` antes de chegar ao sanitize

**4. Caminho Astro (também afetado)**

Além de `render.ts`, o mesmo padrão existe em `apps/links/src/layouts/Base.astro:65`:
```astro
set:html={JSON.stringify(jsonLd)}
```
Usado por `index.astro` e `[slug].astro`. Mesma classe de vulnerabilidade com os mesmos dados de entrada — sem escape de output. Registrado separadamente como CR-A7.

**5. Conclusão**

| Aspecto | Evidência |
|---------|-----------|
| Explorável hoje? | **NÃO** — todas as entradas passam por `sanitize-html` (remove `</script>`) ou são construídas (URL/slug) |
| Defense-in-depth? | **SIM** — falta camada de escape no output. Se um dia: (a) `cleanText` for removido; (b) novo campo sem sanitização entrar no JSON-LD; (c) seed com dado hostil for commitado → vira vulnerabilidade real |
| Custo da correção? | 1 linha: `.replace(/</g, '\\u003c')` após `JSON.stringify` |
| Referência spec | HTML Living Standard §4.12.1.3: *"The easiest and safest way to avoid the rather strange restrictions... is to always escape... `</script` as `\x3C/script`"* |
| OWASP | XSS Prevention Rule #3: não por dado não-confiável em `<script>`. Se inevitável, hex-encode caracteres problemáticos |

**6. Veredito**

Correção recomendada como **defense-in-depth de baixíssimo custo**. Não é uma vulnerabilidade explorável hoje, mas a ausência de output encoding é um gap que qualquer auditor de segurança sinalizaria. Aplicar nas 2 localizações (CR-A1 + CR-A7).
- **Ação T25:** ✅ EXECUTADO — `.replace(/</g, "\\u003c")` em `render.ts:64` + `Base.astro:65`. Build verde.

### CR-A2 · `apps/links/server/repo/groups.ts:156-165` — `deleteTag` não-atômico (transação)
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `DELETE group_tags` + `UPDATE groups` em 2 operações separadas. Se UPDATE falhar, tag removida mas slugs órfãos nos `groups.tags[]`.
- **Validação:** **VÁLIDO.** Duas operações sem proteção transacional. Wrap em `db.transaction().execute(...)`.
- **Status:** ✅ T21 — `db.transaction().execute(async (trx) => {...})`, `db`→`trx` nas 2 ops.

### CR-A3 · `apps/links/server/server.ts:321` — `busy` com tipo errado em rebuild/status
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `res.json({ busy: jobState() })` retorna `JobState | null` (objeto), não booleano. Existe `jobBusy(): boolean` no mesmo módulo.
- **Validação:** **VÁLIDO.** `jobState()` retorna objeto; `jobBusy()` retorna boolean. Frontend espera `busy: boolean`. Corrigir para usar `jobBusy()` + expor `job: jobState()`.
- **Status:** ✅ T23 — `res.json({ busy: jobBusy(), job: jobState() })`. Consumidor verificado: AdminPanel não consome `/rebuild/status`.

### CR-A4 · `apps/links/src/components/admin/AdminPanel.tsx:102-114` — `error` não limpa após reload bem-sucedido
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `reload()` nunca chama `setError(false)`. Se houve erro anterior, componente fica preso em `<ErrorState>` mesmo após reload OK.
- **Validação:** **VÁLIDO.** `reload` seta dados na linha 110-111 mas sem resetar `error`. Bug de UX real: estado `error=true` persiste para sempre após falha única.
- **Status:** ✅ T24 — `setError(false)` adicionado após `setTags(...)`.

### CR-A5 · `apps/links/src/components/admin/AdminPanel.tsx:375-395` — add/remove tags tratam 4xx/5xx como sucesso
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `add()` e `remove()` em `TagManager` chamam `authFetch` sem checar `res.ok`. Prosseguem com `setLabel("")` e `onChanged()` mesmo em erro HTTP.
- **Validação:** **VÁLIDO.** Ambas funções não validam resposta. Se backend retornar 400/500, frontend age como sucesso.
- **Status:** ✅ T22 — `res.ok` checado em `add()` e `remove()`.

### CR-A6 · `apps/links/src/components/GroupCard.astro:24` — `<button>` aninhado em `<a>` (HTML inválido)
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `<button type="button">Confirmo ter 18+</button>` dentro de `<a href="...">`. HTML proíbe elemento interativo dentro de link.
- **Validação:** **VÁLIDO.** HTML inválido + comportamento de clique inconsistente entre navegadores. **Atenção:** JS em `Base.astro:80` usa seletor `.adult-overlay button` → precisa atualizar também.
- **Status:** ✅ T26 — `<span class="adult-cta" role="button" tabindex="0">` + seletor JS atualizado.

### CR-A7 · `apps/links/src/layouts/Base.astro:65` — `set:html` com JSON-LD sem escaping
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `set:html={JSON.stringify(jsonLd)}` sem escape de `</script>`. Mesma classe de CR-A1, no Astro.
- **Validação:** **VÁLIDO.** `jsonLd` vem de props de página (confiável no build), mas `JSON.stringify` sem escape em contexto `<script>` é brecha teórica. Mesma mitigação de CR-A1.
- **Status:** ✅ T25 — `.replace(/</g, "\\u003c")` em `Base.astro:65`.

---

## Categoria D — Nova leva 22:22 UTC · glossário/mesas (7)

> Review `4538901094`, submetida 2026-06-20T22:22:02Z. 5 inline + 2 outside-diff.
> **Investigados 2026-06-20 (read-only, sem caminho feliz). Os 7 = VÁLIDOS.**
> Destaque: CR-D7 é regressão introduzida pelo refactor de lint da 037 (T8).

### Inline (dentro do diff)

#### CR-D1 · `apps/glossario/frontend/src/components/AddTermModal.tsx:75-86` — Load promise sem catch
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Cadeia de Promise no carregamento de `editions` sem `.catch()`. Falha de rede/API não tratada — sem estado de erro, sem fallback.
- **Validação:** **VÁLIDO.** `load.then(...)` (linha 81) sem `.catch`; o OUTRO effect (linha 68) tem catch, este não. Rejeição → unhandled, sem estado de erro.
- **Status:** ✅ T29 — `.catch(() => { if (active) setEditions([]); })` adicionado.

#### CR-D2 · `apps/glossario/frontend/src/components/GlossarioHeader.tsx:10` — localStorage sem try-catch
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Acesso direto a `localStorage.getItem`/`setItem` (linhas 29-32 e 47) sem wrapper seguro. Em modo privado/quota excedida, quebra header e navegação global.
- **Validação:** **VÁLIDO.** Linha 30 dentro do init lazy `useState(() => ...)` → se `getItem` lançar, crash do header inteiro no render. Linha 47 `setItem` no handler sem guard.
- **Status:** ✅ T30 — `try/catch` em `getItem` (fallback `false`) e `setItem`.

#### CR-D3 · `apps/mesas/frontend/src/features/create-table/components/CreateTableForm.tsx:203-210` — `selectedScenarioName` stale no erro
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Ao buscar dados do cenário, se `res.ok === false` ou fetch lançar erro, `selectedScenarioName` mantém valor anterior (stale). Deveria limpar com `setSelectedScenarioName(null)`.
- **Validação:** **VÁLIDO.** Linha 204 só seta no `res.ok`. Trocar cenário A→B com fetch B falho mantém nome de A. Falta `setSelectedScenarioName(null)` no else do `!res.ok` e no `catch`.
- **Status:** ✅ T31 — `setSelectedScenarioName(null)` no `else` e no `catch`.

#### CR-D4 · `apps/mesas/frontend/src/pages/PainelMestrePage.tsx:364-392` — Estado de edição não limpa ao sair do modo edit
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Quando `editIdFromUrl` vira falsy (parâmetro removido da URL), o `return` precoce no effect impede limpeza de `editingTableId`/`editingTableData`. Navegar de `/painel?edit=id` para `/painel` mantém dados da mesa anterior no estado.
- **Validação:** **VÁLIDO.** Linha 364 `if (!editIdFromUrl || !isAuthenticated) return;`. Effect re-roda (dep `editIdFromUrl`) mas early-return nunca limpa o estado de edição. Precisa de else que zere `editingTableId`/`editingTableData` quando o param sai.
- **Status:** ✅ T28 — `else` com microtask-defer p/ zerar estado (lint barrou setState síncrono).

#### CR-D5 · `apps/mesas/frontend/src/pages/ProfileEditPage.tsx:52-60` — Notificação "salvo" mostra no carregamento inicial
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Effect dispara `setShowSaved` sempre que `saving` vira `false` (inclusive no load inicial). Deveria disparar só na transição `true→false` (usando ref p/ valor anterior).
- **Validação:** **VÁLIDO.** Linha 52 `if (saving || !profile) return;` + `setShowSaved(true)`. Deps `[saving, profile]` → no load inicial (profile chega, saving=false) mostra "salvo" espúrio. Precisa de ref do `saving` anterior, disparar só em `true→false`.
- **Status:** ✅ T33 — `useRef(saving)` + guard `!wasSaving` antes de mostrar.

### Outside-diff (fora do diff, range não coberto)

#### CR-D6 · `apps/glossario/frontend/src/pages/ImportPage.tsx:189-207` — Validar `data.results` e `data.summary`
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** Cast de `data.results` como `BackendPreviewRow[]` sem `Array.isArray`; `data.summary` sem validação de schema. Viola guideline de normalização. Se API responder shape inesperado, preview quebra.
- **Também afeta:** linhas 332-353
- **Validação:** **VÁLIDO.** Linha 332 `(data.results as BackendPreviewRow[]).map(...)` — se `results` for undefined/não-array, `.map` lança TypeError (cai no catch genérico). Linha 350 `setSummary(data.summary)` sem validação. Guardar com `Array.isArray` + narrowing antes do uso.
- **Status:** ✅ T32 — `Array.isArray(data.results)` antes do `.map()` + validação de 5 campos numéricos em `data.summary`.

#### CR-D7 · `apps/mesas/frontend/src/components/ScenarioEditModal.tsx:31-46` — `prevScenario` inicializado com `scenario`
- **Severidade:** 🟠 Major · ⚡ Quick win
- **Problema:** `useState(scenario)` → `prevScenario === scenario` no primeiro render → condição `if (prevScenario !== scenario)` falha → campos não hidratados. Modo edição abre com formulário vazio mesmo com cenário existente.
- **Validação:** **VÁLIDO E CRÍTICO.** Linha 39 confirmada. **Regressão introduzida pela própria 037 (T8)** — o padrão "reset durante render com snapshot" foi inicializado com `scenario` em vez de `null`, anulando a hidratação no 1º render. Corrigir: `useState<Scenario | null>(null)`. Único item da leva que é regressão nossa, não bug pré-existente. Prioridade Alta.
- **Status:** ✅ T27 — `useState<ScenarioEditModalProps['scenario']>(null)`. Regressão corrigida.

---

## Categoria B — Pendentes · Documentação/Processo (1)

### CR-B1 · `sessoes/26-06-20_4_media-shared.md:43` — checklist marca `project-state.md` atualizado mas bot não achou
- **Severidade:** 🟠 Major
- **Problema:** CodeRabbit procurou `project-state.md` na raiz do repo e não achou. Arquivo real está em `.specify/memory/project-state.md`.
- **Validação:** **FALSO POSITIVO.** Bot procurou no path errado. `project-state.md` existe e foi atualizado com `BL-CLOUDINARY-SHARED` (linha 121 de project-state.md). Nenhuma ação necessária no código.
- **Status:** FALSO POSITIVO — documentar

---

## Categoria C — Já corrigidas em commits (6)

### CR-C1 · `apps/links/server/lib/og.ts:48-55` — SSRF via `redirect: "follow"`
- **Status:** ✅ ADDRESSED em `8258e4a`. Defesa em profundidade pós-redirect (`res.url` host check, linhas 62-68) já presente.
- **Ação:** Nenhuma.

### CR-C2 · `apps/links/src/components/admin/AdminPanel.tsx:55-59` — Normalizar respostas API antes de estado
- **Status:** ✅ ADDRESSED em `8258e4a`. `normalizeGroup`/`normalizeTag`/`normalizeApiResponse` já implementados.
- **Ação:** Nenhuma.

### CR-C3 · `apps/links/src/components/CommunityGroups.tsx:41-79` — Normalizar JSON da API
- **Status:** ✅ ADDRESSED em `8258e4a`. Normalização completa com `Array.isArray` e narrowing já presente (linhas 43-76).
- **Ação:** Nenhuma.

### CR-C4 · `apps/links/server/server.ts:194-195` — Validar `category` antes do cast
- **Status:** ✅ ADDRESSED em `3edc627`. Validação com `VALID_CATEGORIES.includes()` já implementada (linhas 195-199).
- **Ação:** Nenhuma.

### CR-C5 · `apps/site/db/migrate.ts:45-46` — `release()` mesmo quando unlock falhar
- **Status:** ✅ ADDRESSED em `3edc627`. Unlock com `.catch(() => {})` + `release()` no `finally` (linhas 44-47).
- **Ação:** Nenhuma.

### CR-C6 · `sessoes/prompt-D-SITE-ADVISORY-LOCK.md` — Sessão incompleta (header/data/checklist)
- **Severidade:** 🟡 Minor
- **Problema:** Arquivo `prompt-D-SITE-ADVISORY-LOCK.md` é spec/prompt, não sessão formal. Faltam header de data/objetivo/gate e checklist de fechamento.
- **Validação:** **COSMÉTICO.** O débito `D-SITE-ADVISORY-LOCK` já está fechado localmente e registrado em `project-state.md:122`. A sessão real do trabalho está em `sessoes/26-06-20_4_site_advisory-lock.md`. Este arquivo `prompt-*` é artefato de entrada, não sessão.
- **Status:** COSMÉTICO — baixíssima prioridade

---

## Plano de correção

| ID | Arquivo | Ação | Prioridade |
|----|---------|------|-----------|
| CR-A1 | `apps/links/server/lib/render.ts:64` | Escapar JSON-LD com `.replace(/</g, "\\u003c")` | Média |
| CR-A2 | `apps/links/server/repo/groups.ts:156-165` | Envolver em `db.transaction().execute(...)` | Alta |
| CR-A3 | `apps/links/server/server.ts:321` | Usar `jobBusy()` + expor `job: jobState()` | Média |
| CR-A4 | `apps/links/src/components/admin/AdminPanel.tsx:102-114` | Adicionar `setError(false)` no sucesso do reload | Média |
| CR-A5 | `apps/links/src/components/admin/AdminPanel.tsx:375-395` | Checar `res.ok` em add/remove | Alta |
| CR-A6 | `apps/links/src/components/GroupCard.astro:24` | Trocar `<button>` por `<span>` + atualizar seletor JS em `Base.astro:80` | Baixa |
| CR-A7 | `apps/links/src/layouts/Base.astro:65` | Escapar JSON-LD no Astro (mesma técnica de CR-A1) | Média |
| CR-D1 | `apps/glossario/frontend/src/components/AddTermModal.tsx:75-86` | Adicionar `.catch()` na promise de load de editions | Média |
| CR-D2 | `apps/glossario/frontend/src/components/GlossarioHeader.tsx:10` | Wrapper seguro p/ localStorage com fallback | Média |
| CR-D3 | `apps/mesas/frontend/src/features/create-table/components/CreateTableForm.tsx:203-210` | Limpar `selectedScenarioName` no erro | Média |
| CR-D4 | `apps/mesas/frontend/src/pages/PainelMestrePage.tsx:364-392` | Limpar estado de edição ao sair do modo edit | Alta |
| CR-D5 | `apps/mesas/frontend/src/pages/ProfileEditPage.tsx:52-60` | Ref p/ valor anterior em notificação de "salvo" | Baixa |
| CR-D6 | `apps/glossario/frontend/src/pages/ImportPage.tsx:189-207` | Validar `data.results`/`data.summary` com schema | Média |
| CR-D7 | `apps/mesas/frontend/src/components/ScenarioEditModal.tsx:31-46` | Inicializar `prevScenario` com null | Alta |
