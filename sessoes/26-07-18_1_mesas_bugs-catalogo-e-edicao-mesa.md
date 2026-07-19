# Sessão — mesas — bugs reais: 500 resolve system-suggestion + editar mesa cria mesa nova

**Data:** 2026-07-18
**Objetivo:** investigar e corrigir bugs reais reportados pelo mantenedor no admin/painel do mesas.
**App/projeto:** mesas (Prod)
**Gate:** D (fechado) — 2 regressões distintas, mesma sessão de trabalho

---

## Bug 1 — 500 em resolve de system-suggestion (`/gestao/comunidade`)

**Objetivo:** 500 real em `mesas.artificiorpg.com/gestao/comunidade`, ação "Sistema novo (raiz)" no drawer de resolução de sugestão de sistema.

### Evidência do mantenedor

- Screenshot: drawer "Ação: Sistema novo (raiz)", nome "Apes RPG", suggestion id `c3214789-397d-43b7-9e31-cafdf1796fb5`.
- Console: `POST /api/v1/admin/system-suggestions/c3214789-397d-43b7-9e31-cafdf1796fb5/resolve` → 500.
- Suspeita do mantenedor: "achando que não tá vinculado ao compartilhado".

### Investigação estática (1ª passada — hipótese descartada depois)

Cadeia de execução da ação `create_system`:

1. `POST /system-suggestions/:id/resolve` (`apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts:1082`) despacha pra `resolveCreateSystem` (linha 936-1040).
2. `resolveCreateSystem` chama `createSystemNode` → `createCatalogNode` (`apps/mesas/backend/src/services/catalogClient.ts:167-175`), que via `SystemCatalogProvider` (`systemCatalogProvider.ts`) faz HTTP POST cross-service pro catálogo central (`site-prod-app`), consistente com o modelo Central=Site Prod da spec 078.
3. Hipótese inicial (401/token/rede entre mesas-prod e site-prod causando 500 mascarado) — **descartada** após ler log real.

### Causa raiz REAL (confirmada via log real `docker logs mesas-api`, read-only, VM)

```
[POST /admin/system-suggestions/:id/resolve] error: insert or update on table "system_suggestions"
violates foreign key constraint "system_suggestions_created_system_id_fkey"
  at ... Object.resolveCreateSystem [as create_system] ...
```

Catálogo central respondeu com **sucesso** (criou o sistema, UUID válido). O 500 veio da etapa seguinte, local: gravar auditoria em `system_suggestions`.

**Causa raiz:** `migration_123_system_suggestion_resolution.sql` (2026-06-01, spec 018) criou 3 FKs em `system_suggestions` apontando pra tabelas **locais** `systems`/`system_aliases`:
- `resolved_system_id UUID REFERENCES systems(id)`
- `created_system_id UUID REFERENCES systems(id)`
- `created_alias_id UUID REFERENCES system_aliases(id)`

Fazia sentido em 2026-06-01 (systems local = única fonte). **Spec 078 (2026-07-15)** mudou o modelo: Mesas Prod passou a consumir sistemas de RPG do **Central (site-prod)** via HTTP (`SystemCatalogProvider`), com `systems` local virando exclusiva do Mesas Beta (projeção). Migration 123 nunca foi atualizada — as 3 FKs continuam ativas em Prod.

Resultado: toda resolução de sugestão de sistema em Prod que grava UUID/slug do **Central** nessas colunas (`create_system`, `create_child`, `create_alias`, `merge_existing` — confirmado nos 4 handlers em `systemSuggestionsAdmin.ts`) quebra a FK, pois esse UUID nunca existe em `systems` local de Prod. **100% dos fluxos de resolução de sugestão de sistema em Prod estavam quebrados**, não só "Sistema novo".

**Confirmado ao mantenedor (pergunta explícita dele):** toda ação de aprovação nesta tela (`create_system`, `create_child`, `create_chain`, `create_alias`, `merge_existing`) grava no catálogo **compartilhado** (Central/site-prod), nunca em tabela local isolada do mesas. Só "Rejeitar" não toca o catálogo (só marca `status: rejected` local). Isso já era o comportamento correto antes do bug — o bug 1 não muda esse destino, só destrava o 500 que impedia a gravação de completar.

**Bug secundário, mesma causa raiz:** `resolveCreateAlias` (linha 611-707) grava `created_alias_id = aliasSlug` (slug string, não UUID — comentário no próprio código, linha 641-643, já documentava ausência de endpoint de alias-id no catálogo central). Coluna era `UUID`; teria quebrado com `invalid input syntax for type uuid` no mesmo fluxo.

**Achado colateral, não corrigido (fora do escopo desta correção):** `resolveErrorResponse` (`systemSuggestionsAdmin.ts:1042-1079`) só mapeia mensagens de erro conhecidas pra 400/404/409; qualquer erro fora da lista (como a violação de FK real) cai em `default: 500` genérico sem detalhe pro front. Não é a causa do bug, é o motivo do sintoma ter mascarado a causa real até o log da VM ser lido.

### Fix aplicado

`apps/mesas/database/migration_155_drop_stale_local_systems_fk.sql` (online-safe, header validado — 5 campos):
1. `DROP CONSTRAINT IF EXISTS` nas 3 FKs obsoletas (`resolved_system_id_fkey`, `created_system_id_fkey`, `created_alias_id_fkey`). Colunas permanecem, guardando UUID/slug do Central como referência solta — integridade passa a ser responsabilidade do `SystemCatalogProvider`, mesmo padrão já adotado pelo resto da spec 078 para o domínio de sistemas.
2. `ALTER COLUMN created_alias_id TYPE TEXT` — corrige mismatch de tipo (era `UUID`, precisa aceitar slug string).

**Validação local:** `tsc --noEmit` e `eslint` em `systemSuggestionsAdmin.ts`/`systemCatalogProvider.ts` verdes (nenhum código TS tocado, só migration SQL nova). Migration **não aplicada** em nenhum ambiente real (dev/beta/prod) — aplicação exige deploy normal (branch+PR+CI ou dispatch manual `deploy.yml`), fora do escopo desta sessão local.

### Débito documental (spec 078)

A spec 078 (`project-state.md`) não cobriu a limpeza de FKs legadas da spec 018/migration_123 ao migrar Mesas Prod pro Central. Vale registrar em `specs/backlog.md`/`specs/078-.../tasks.md` como item fechado por esta correção pontual — decisão de registro formal em backlog ainda não tomada nesta sessão (fix já resolve o bug; registro de backlog é passo administrativo separado, não bloqueia).

---

## Bug 2 — editar mesa cria mesa nova em vez de atualizar

**Objetivo:** investigar bug real reportado via widget "Reportar problema" pelo GM Douglas dos Santos.

### Evidência do usuário (reporte in-app)

- Título: "Problemas na edição de mesa".
- Descrição: "Toda vez que eu vou para editar a minha mesa (seja para trocar o banner, alterar o horário ou ajustar as vagas restantes), cria-se uma 'nova' mesa, ao invés de ajustar a que existe."
- Timestamp: 2026-07-10 07:41:20. Página: `/painel`. Role: `gm`. Reprodução indicada pelo mantenedor: etapa 3 do wizard (Sessões), fluxo "editar mesa".

### Investigação (só leitura, sem edição/commit)

Cadeia de decisão create-vs-update:

1. `useCreateTableForm.submit` (`apps/mesas/frontend/src/features/create-table/hooks/useCreateTableForm.ts:232-233`):
   ```ts
   const tableId = typeof initialData?.id === 'string' ? initialData.id : null;
   const isEditing = tableId !== null;
   ```
   Decide PUT (`isEditing=true`) vs POST (`isEditing=false`) só com base em `initialData.id`. Lógica em si está correta.

2. `CreateTableForm` (`.../components/CreateTableForm.tsx:73-84`) recebe `initialData` via prop e repassa pro hook sem transformação.

3. `PainelMestrePage` (`apps/mesas/frontend/src/pages/PainelMestrePage.tsx:365-408`) monta o `initialData` de edição: ao detectar `?edit=<id>` na URL, faz `GET /api/v1/gm/tables/:id`, converte a resposta com `mapTableApiToInitialData(getPayloadData(data))` (linha 388) e guarda em `setEditingTableData(...)`. Depois (linha 656): `<CreateTableForm initialData={editingTableData || pastePreviewData || undefined} ...>`.

### Causa raiz (confirmada por leitura estática determinística — sem ambiguidade, não depende de runtime/log)

`mapTableApiToInitialData` (`apps/mesas/frontend/src/features/create-table/utils/mapTableApiToInitialData.ts:81-165`), assinatura `(apiData: unknown): Partial<FormState>`, **nunca inclui o campo `id` no objeto que retorna**. Mapeia `title`, `description`, `sessions`, `contacts`, `bannerUrl`, etc — dezenas de campos — mas `id` não aparece em nenhum ponto do objeto literal retornado (linhas 88-164 cobrem 100% do retorno da função).

Consequência direta:
- `editingTableData = mapTableApiToInitialData(...)` fica **sem `id`**.
- `initialData?.id` no hook (`useCreateTableForm.ts:232`) é sempre `undefined`.
- `isEditing` é sempre `false`, **mesmo estando na tela de editar uma mesa existente com todos os dados carregados corretamente na UI** (título, sessões, banner etc mapeiam certo — só o `id` fica de fora).
- Todo submit no fluxo de edição faz `POST /api/v1/gm/tables` (cria mesa nova) em vez de `PUT /api/v1/gm/tables/:id` (atualiza a existente).

Bate exatamente com o relato: qualquer alteração salva na tela de editar (banner, horário — etapa 3/Sessões, vagas) sempre cria mesa nova, porque o formulário nunca sabe que está em modo edição no momento do submit — apesar de exibir os dados certos (que vieram do resto do mapper, só o `id` que falta).

**Tipo `FormState`** (`apps/mesas/frontend/src/features/create-table/types/createTable.types.ts`) não tem campo `id` — é por design (`id` sempre veio de fora, via `initialData?: Partial<FormState> & { id?: string }`, um tipo intersecção). O mapper precisa devolver esse `id` adicional explicitamente, o que não faz.

### Escopo do impacto

Afeta **toda edição de mesa existente** via painel do GM (`/painel?edit=<id>`), não só sessões/horário — qualquer campo (banner, vagas, descrição, contatos etc), pois o bug está no nível do submit, não em campo específico. Duplicação de mesas em produção é o efeito colateral provável (mesas fantasmas criadas a cada tentativa de edição salva).

### Fix aplicado

`apps/mesas/frontend/src/features/create-table/utils/mapTableApiToInitialData.ts`:
1. Assinatura mudou de `Partial<FormState>` pra `Partial<FormState> & { id?: string }` (mesmo tipo que `CreateTableFormProps.initialData` já esperava).
2. Objeto retornado ganhou `id: nullableStringValue(data, 'id') ?? undefined` como primeiro campo, com comentário explicando a causa raiz do bug pra não se perder em edição futura.
3. Confirmado que `GET /api/v1/gm/tables/:id` (`apps/mesas/backend/src/routes/gmPanel.ts:498-545`) já inclui `id` no payload via `{...tableData}` (spread de `TableRepository.findById`/`findByIdAndGm`, `TablesTable.id: Generated<string>`) — não precisou tocar backend, só o mapper do frontend que descartava o campo.

**Teste novo:** `mapTableApiToInitialData.test.ts` (3 casos: id presente, id ausente, payload inválido) — cobre exatamente o bug real, evita regressão futura.

### Débito / impacto em produção

**Não verificado nesta sessão:** quantidade de mesas duplicadas já criadas em Prod por esse bug (relato é de 2026-07-10, bug pode estar ativo há mais tempo — não investigada a origem/commit que introduziu `mapTableApiToInitialData` sem `id`). Merece auditoria de dados antes/depois do fix (mesas duplicadas do mesmo GM com título idêntico, criadas em sequência rápida, seriam o sintoma no banco).

---

## Ferramentas usadas (ambos os bugs)

`codebase-memory-mcp` (search_graph/search_code/get_code_snippet) como busca primária; Grep como fallback pontual; `ssh faren` read-only (`docker ps`, `docker logs`) pra achar causa real do bug 1. T0 lido no início da sessão (project-state.md/decisions.md parciais, truncados por tamanho — trechos relevantes à spec 078 e migrations lidos por completo).

## Status — ambos os bugs corrigidos e validados localmente

**Bug 1:** causa raiz confirmada via log real. Fix = `apps/mesas/database/migration_155_drop_stale_local_systems_fk.sql`.

**Bug 2:** causa raiz confirmada por leitura estática. Fix = `apps/mesas/frontend/src/features/create-table/utils/mapTableApiToInitialData.ts` + teste novo `mapTableApiToInitialData.test.ts`.

**Validação executada (2026-07-18):**
- `tsc --noEmit` mesas-frontend: verde.
- `tsc --noEmit` mesas-backend: verde.
- `eslint .` mesas-frontend (completo): verde.
- `eslint .` mesas-backend (completo): verde.
- `vitest run` mesas-frontend: 188/188 verde (inclui os 3 testes novos do fix).
- `vitest run` mesas-backend: 607/607 verde.
- Migration 155: header validado (5 campos), não testável via vitest (é SQL de schema, exige Postgres real — nenhum teste de integração roda a FK removida nos 607 testes existentes, coerente com o padrão do repo de unit-only local).

**Não verificado (fora do alcance sem ambiente local completo):** fluxo real em browser (editar mesa via UI, aprovar sugestão via UI) — mesas exige backend+frontend+Postgres rodando e login SSO Google real; não hà `.claude/launch.json` configurado e subir stack completo pra este fix pontual está fora de escopo. Verificação de UI/deploy real fica para o mantenedor ou pipeline de CI+deploy beta.

**Nenhum commit, push, PR, merge ou write na VM/DB real executado** — regra pétrea de aprovação por ação (AGENTS.md). Ambos os fixes estão prontos no working tree, aguardando autorização nominal para commit/push/PR/deploy.
