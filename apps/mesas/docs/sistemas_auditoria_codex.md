# Dossiê Técnico de Auditoria — Sistemas, Edições, Variantes e Cenários

## 0) este arquivo é um suplemento para o `auditoria_sistemas_claude.md`

## 1) Escopo auditado

Este dossiê cobre, com evidência de código e schema:

- Modelagem de **Sistemas** (base, edição, variante, subsistema)
- Modelagem de **Cenários**
- Fluxos de **ingestão** (scripts)
- Fluxos de **inserção manual** (admin)
- Fluxos de **sugestão** (usuário)
- Fluxos de **aprovação/rejeição** (admin)
- Fluxos de **hidratação** para consumo por frontend e por terceiros
- Lacunas críticas para evolução para API pública estável

---

## 2) Estado atual da arquitetura (evidências)

### 2.1 Montagem de rotas no backend

A API registra rotas públicas e administrativas para sistemas e cenários, e também rotas de sugestão:

- `app.use('/api/v1/systems', systemsRoutes)`
- `app.use('/api/v1/scenarios', scenariosRoutes)`
- `app.use('/api/v1/system-suggestions', systemSuggestionsRoutes)`
- `app.use('/api/v1/scenario-suggestions', scenarioSuggestionsRoutes)`
- `app.use('/api/v1/admin', systemSuggestionsAdminRoutes)`

Evidência: [server.ts:L104-L111](file:///c:/projetos/mesas_rpg_artificio/backend/src/server.ts#L104-L111)

**Falha estrutural já visível aqui:** não existe rota admin equivalente para moderação de `scenario_suggestions` montada no servidor.

---

### 2.2 Modelo de dados tipado em runtime (Kysely types)

#### Sistemas

`SystemsTable` contém:
- `parent_id`
- `node_type`
- `depth`
- `path_slug`

Evidência: [types.ts:L143-L154](file:///c:/projetos/mesas_rpg_artificio/backend/src/db/types.ts#L143-L154)

#### Cenários

`ScenariosTable` contém:
- `name`
- `name_pt`
- `slug`
- `subgenres`

Evidência: [types.ts:L179-L186](file:///c:/projetos/mesas_rpg_artificio/backend/src/db/types.ts#L179-L186)

#### Sugestões

`SystemSuggestionsTable` contém no runtime:
- `node_type`
- `rejection_reason`
- `user_notified`
- `updated_at`

Evidência: [types.ts:L332-L348](file:///c:/projetos/mesas_rpg_artificio/backend/src/db/types.ts#L332-L348)

`ScenarioSuggestionsTable` contém:
- `status`
- `reviewed_by`
- `reviewed_at`
- `rejection_reason`
- `user_notified`
- `updated_at`

Evidência: [types.ts:L354-L367](file:///c:/projetos/mesas_rpg_artificio/backend/src/db/types.ts#L354-L367)

---

### 2.3 Schema SQL (migrations)

#### Systems + Taxonomia

- `migration_02` e `migration_11` adicionam/ajustam `node_type`, `parent_id`, `depth`, `path_slug`
- Há CHECK de `node_type` em `systems`

Evidências:
- [migration_02_system_taxonomy_and_ddal.sql:L12-L40](file:///c:/projetos/mesas_rpg_artificio/database/migration_02_system_taxonomy_and_ddal.sql#L12-L40)
- [migration_11_sistemas_json.sql:L24-L70](file:///c:/projetos/mesas_rpg_artificio/database/migration_11_sistemas_json.sql#L24-L70)

#### Scenarios

- `migration_12` cria `scenarios`
- `migration_102` adiciona `name_pt`

Evidências:
- [migration_12_cenarios.sql](file:///c:/projetos/mesas_rpg_artificio/database/migration_12_cenarios.sql)
- [migration_102_add_name_pt.sql:L10-L16](file:///c:/projetos/mesas_rpg_artificio/database/migration_102_add_name_pt.sql#L10-L16)

#### System suggestions

- `migration_06` cria `system_suggestions` com `suggestion_type` e `admin_notes`
- Não define `node_type`, `rejection_reason`, `user_notified`, `updated_at`
- `migration_103` apenas adiciona `name_pt`

Evidências:
- [migration_06_system_suggestions.sql:L4-L16](file:///c:/projetos/mesas_rpg_artificio/database/migration_06_system_suggestions.sql#L4-L16)
- [migration_103_scenario_suggestions.sql:L5-L7](file:///c:/projetos/mesas_rpg_artificio/database/migration_103_scenario_suggestions.sql#L5-L7)

#### Scenario suggestions

- `migration_103` cria `scenario_suggestions` com campos completos de moderação e notificação

Evidência: [migration_103_scenario_suggestions.sql:L8-L21](file:///c:/projetos/mesas_rpg_artificio/database/migration_103_scenario_suggestions.sql#L8-L21)

---

## 3) Como está ingestado hoje

### 3.1 Ingestão de sistemas por JSON

Script: `systems:import-json`
- Lê `sistemas.json`
- Insere sistema base (`node_type='system'`)
- Insere aliases
- Insere edições e variantes

Evidências:
- Script registrado: [backend/package.json:L10-L12](file:///c:/projetos/mesas_rpg_artificio/backend/package.json#L10-L12)
- Implementação: [importSistemas.ts:L35-L183](file:///c:/projetos/mesas_rpg_artificio/backend/src/scripts/importSistemas.ts#L35-L183)

### 3.2 Ingestão de sistemas por árvore Markdown

Script: `systems:import-tree`
- Lê `arvores_de_sistemas.md`
- Converte para nós hierárquicos
- Faz upsert por `path_slug`
- Gera aliases automáticos e aliases conhecidos

Evidências:
- Script registrado: [backend/package.json:L10-L11](file:///c:/projetos/mesas_rpg_artificio/backend/package.json#L10-L11)
- Implementação: [systemsTreeImport.ts:L138-L239](file:///c:/projetos/mesas_rpg_artificio/backend/src/scripts/systemsTreeImport.ts#L138-L239)

### 3.3 Ingestão de cenários

Script: `scenarios:import` (baseado em arquivo JSON)

Evidências:
- Script registrado: [backend/package.json:L12-L13](file:///c:/projetos/mesas_rpg_artificio/backend/package.json#L12-L13)
- Implementação: [importCenarios.ts](file:///c:/projetos/mesas_rpg_artificio/backend/src/scripts/importCenarios.ts)

---

## 4) Como está organizado e inserido hoje

### 4.1 Sistemas (catálogo + admin)

#### Leitura pública

`GET /api/v1/systems`
- Suporta `view=flat` ou `view=tree`
- Suporta busca por `name`, `slug`, `path_slug`, aliases

Evidência: [systems.ts:L84-L149](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L84-L149)

#### Inserção/edição/deleção admin

- `POST /api/v1/systems/admin`
- `PUT /api/v1/systems/admin/:id`
- `DELETE /api/v1/systems/admin/:id`

Evidências:
- Criação: [systems.ts:L167-L254](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L167-L254)
- Edição: [systems.ts:L256-L359](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L256-L359)
- Deleção: [systems.ts:L361-L420](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L361-L420)

### 4.2 Cenários (catálogo + admin)

#### Leitura pública

`GET /api/v1/scenarios`
- Busca textual em memória (puxa tudo e filtra)

Evidência: [scenarios.ts:L28-L60](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L28-L60)

#### Inserção/edição/deleção admin

- `POST /api/v1/scenarios/admin`
- `PUT /api/v1/scenarios/admin/:id`
- `DELETE /api/v1/scenarios/admin/:id`

Evidências:
- Criação: [scenarios.ts:L92-L134](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L92-L134)
- Edição: [scenarios.ts:L136-L192](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L136-L192)
- Deleção: [scenarios.ts:L194-L234](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L194-L234)

### 4.3 Inserção de mesa (onde sistema/cenário são aplicados)

- `POST /api/v1/gm/tables` valida com Zod
- Usa `TableService.prepareTableData`
- Persiste transacionalmente em `TableRepository.createTableWithRelations`

Evidências:
- Rota create: [gmPanel.ts:L403-L463](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/gmPanel.ts#L403-L463)
- Zod (`system_id`, `scenario_id`): [tableValidators.ts:L47-L48](file:///c:/projetos/mesas_rpg_artificio/backend/src/validators/tableValidators.ts#L47-L48)
- Regra adicional (`system_id` obrigatório): [tableValidators.ts:L114-L116](file:///c:/projetos/mesas_rpg_artificio/backend/src/validators/tableValidators.ts#L114-L116)
- Service: [tableService.ts:L124](file:///c:/projetos/mesas_rpg_artificio/backend/src/services/tableService.ts#L124)
- Repository: [tableRepository.ts:L56](file:///c:/projetos/mesas_rpg_artificio/backend/src/repositories/tableRepository.ts#L56)

---

## 5) Como está sugerido e aprovado hoje

### 5.1 Sugestão de sistemas

#### Backend
- `POST /api/v1/system-suggestions`
- `GET /api/v1/system-suggestions/mine`

Evidência: [systemSuggestions.ts:L9-L76](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systemSuggestions.ts#L9-L76)

#### Frontend
- Modal envia para `POST /api/v1/system-suggestions`

Evidência: [SystemSuggestionModal.tsx:L103](file:///c:/projetos/mesas_rpg_artificio/frontend/src/components/SystemSuggestionModal.tsx#L103)

### 5.2 Aprovação/rejeição de sugestões de sistemas

#### Backend admin
- `GET /api/v1/admin/system-suggestions`
- `PATCH /api/v1/admin/system-suggestions/:id/approve`
- `PATCH /api/v1/admin/system-suggestions/:id/reject`

Evidência: [systemSuggestionsAdmin.ts:L9-L94](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systemSuggestionsAdmin.ts#L9-L94)

#### Frontend admin
- `GestaoPage` consome somente `admin/system-suggestions`

Evidência: [GestaoPage.tsx:L64-L65](file:///c:/projetos/mesas_rpg_artificio/frontend/src/pages/GestaoPage.tsx#L64-L65)

### 5.3 Sugestão de cenários

#### Backend
- `POST /api/v1/scenario-suggestions`
- `GET /api/v1/scenario-suggestions/mine`

Evidência: [scenarioSuggestions.ts:L9-L69](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarioSuggestions.ts#L9-L69)

#### Frontend
- Modal envia para `POST /api/v1/scenario-suggestions`

Evidência: [ScenarioSuggestionModal.tsx:L30](file:///c:/projetos/mesas_rpg_artificio/frontend/src/components/ScenarioSuggestionModal.tsx#L30)

### 5.4 Ponto crítico

Não há evidência de endpoint admin para aprovar/rejeitar `scenario_suggestions` nem consumo frontend correspondente.

- Busca backend por `/admin/scenario-suggestions`: sem resultados
- Busca frontend por `/api/v1/admin/scenario-suggestions`: sem resultados

---

## 6) Como está a hidratação hoje

### 6.1 Hidratação de sistemas

- `GET /api/v1/systems?view=tree` retorna árvore com `children`
- `GET /api/v1/systems?view=flat` retorna lista achatada

Evidência: [systems.ts:L125-L145](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L125-L145)

### 6.2 Hidratação de cenários

- `GET /api/v1/scenarios` lista cenários
- `GET /api/v1/scenarios/:id` retorna cenário único

Evidência: [scenarios.ts:L66-L85](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L66-L85)

### 6.3 Hidratação de mesa (consumo público)

#### Lista de mesas

`GET /api/v1/tables`
- Faz join com `systems`
- **Não faz join com `scenarios` na listagem**

Evidência: [tables.ts:L41-L49](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/tables.ts#L41-L49)

#### Detalhe da mesa

`GET /api/v1/tables/:slug`
- Faz join com `systems` e `scenarios`
- Retorna `scenario_name`

Evidência: [tables.ts:L283-L356](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/tables.ts#L283-L356)

**Consequência técnica:** hidratação de cenário existe no detalhe, mas não na listagem. Isso fragmenta consumo para apps externos.

---

## 7) Falhas concretas (auditoria)

## [CRÍTICO] A-CRIT-01 — Drift de schema em `system_suggestions`

**Problema**
- Runtime (`types.ts` + rotas) usa `node_type`, `rejection_reason`, `user_notified`, `updated_at`
- Migration base (`migration_06`) define `suggestion_type`, `admin_notes` e não cria os campos acima

**Evidências**
- Runtime: [types.ts:L332-L348](file:///c:/projetos/mesas_rpg_artificio/backend/src/db/types.ts#L332-L348)
- Rota escreve `node_type`: [systemSuggestions.ts:L47](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systemSuggestions.ts#L47)
- Migration antiga: [migration_06_system_suggestions.sql:L10-L15](file:///c:/projetos/mesas_rpg_artificio/database/migration_06_system_suggestions.sql#L10-L15)

**Impacto**
- Ambiente novo (bootstrap por migrations) pode quebrar em runtime na primeira escrita/leitura de sugestão
- Contrato banco↔aplicação não determinístico

**Correção concreta**
1. Criar migration de convergência (`system_suggestions`):
   - `suggestion_type` -> substituir por `node_type` (enum alinhado)
   - adicionar `rejection_reason`, `user_notified`, `updated_at`
   - remover/arquivar `admin_notes` se fora de uso
2. Atualizar constraints/checks para valores aceitos reais
3. Rodar validação de schema contra `types.ts` no CI

---

## [CRÍTICO] A-CRIT-02 — Aprovação de sugestão de sistema não materializa catálogo

**Problema**
- Endpoint de aprovação de `system_suggestions` altera apenas status da sugestão
- Não cria registro em `systems` e não cria aliases

**Evidência**
- Aprovação: [systemSuggestionsAdmin.ts:L38-L53](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systemSuggestionsAdmin.ts#L38-L53)

**Impacto**
- Usuário recebe sugestão "aprovada", mas catálogo não muda
- Processo administrativo sem efeito funcional

**Correção concreta**
1. Em `approve`, executar transação:
   - ler sugestão pendente
   - validar parent/node_type
   - inserir `systems` (+ `system_aliases` quando aplicável)
   - atualizar sugestão para `approved`
2. Guardar `approved_entity_id` na sugestão para rastreabilidade
3. Notificar usuário com link para entidade materializada

---

## [CRÍTICO] A-CRIT-03 — Fluxo de moderação de `scenario_suggestions` ausente

**Problema**
- Existe coleta de sugestão de cenário
- Não existe moderação admin de cenário (backend + frontend)

**Evidências**
- Coleta existe: [scenarioSuggestions.ts:L9-L69](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarioSuggestions.ts#L9-L69)
- Front envia: [ScenarioSuggestionModal.tsx:L30](file:///c:/projetos/mesas_rpg_artificio/frontend/src/components/ScenarioSuggestionModal.tsx#L30)
- Sem rota admin em `server.ts`: [server.ts:L104-L111](file:///c:/projetos/mesas_rpg_artificio/backend/src/server.ts#L104-L111)

**Impacto**
- Fila de cenário fica sem desfecho operacional
- Perda de confiança de contribuição

**Correção concreta**
1. Criar `scenarioSuggestionsAdmin.ts` com:
   - `GET /api/v1/admin/scenario-suggestions`
   - `PATCH /:id/approve` (materializa em `scenarios`)
   - `PATCH /:id/reject`
2. Montar rota no `server.ts`
3. Adicionar aba de moderação em `GestaoPage.tsx`

---

## [ALTO] A-HIGH-01 — Taxonomia inconsistente (`suggestion_type` x `node_type` x `subsystem`)

**Problema**
- Sugestão aceita `subsystem` no backend
- CRUD admin de systems aceita só `system|edition|variant`
- Constraints históricas divergem entre migrations

**Evidências**
- Sugestão aceita `subsystem`: [systemSuggestions.ts:L23-L25](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systemSuggestions.ts#L23-L25)
- CRUD admin restringe: [systems.ts:L175-L177](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/systems.ts#L175-L177)
- CHECK antigo inclui `subsystem`: [migration_02_system_taxonomy_and_ddal.sql:L39-L40](file:///c:/projetos/mesas_rpg_artificio/database/migration_02_system_taxonomy_and_ddal.sql#L39-L40)
- CHECK posterior exclui `subsystem`: [migration_11_sistemas_json.sql:L62](file:///c:/projetos/mesas_rpg_artificio/database/migration_11_sistemas_json.sql#L62)

**Impacto**
- Comportamento imprevisível por ambiente
- Sugestões válidas no app podem ser inválidas ao materializar

**Correção concreta**
- Definir taxonomia única em ADR (com ou sem `subsystem`)
- Alinhar migrations + tipos + validações + endpoints

---

## [ALTO] A-HIGH-02 — Hidratação de cenário incompleta na listagem pública

**Problema**
- Lista pública de mesas não retorna cenário
- Detalhe retorna cenário

**Evidências**
- Lista sem join cenário: [tables.ts:L41-L49](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/tables.ts#L41-L49)
- Detalhe com cenário: [tables.ts:L283-L356](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/tables.ts#L283-L356)

**Impacto**
- App externo precisa N+1 chamadas para hidratar cartão com cenário
- Aumenta latência e complexidade

**Correção concreta**
- Incluir `leftJoin('scenarios as sc', ...)` na listagem
- Expor `scenario_id`, `scenario_name`, `scenario_slug`

---

## [ALTO] A-HIGH-03 — Ingestão sem trilha operacional/auditoria de jobs

**Problema**
- Scripts de importação executam direto, sem tabela de job, sem versão de fonte, sem idempotency key de execução

**Evidências**
- `importSistemas.ts` executa transação direta: [importSistemas.ts:L55-L184](file:///c:/projetos/mesas_rpg_artificio/backend/src/scripts/importSistemas.ts#L55-L184)
- `systemsTreeImport.ts` idem: [systemsTreeImport.ts:L151-L239](file:///c:/projetos/mesas_rpg_artificio/backend/src/scripts/systemsTreeImport.ts#L151-L239)

**Impacto**
- Difícil auditar "quem/como/quando" alterou catálogo
- Rollback operacional manual

**Correção concreta**
- Introduzir `catalog_ingestion_jobs` + `catalog_ingestion_events`
- Registrar hash da fonte, operador, diff e resultado por execução

---

## [MÉDIO] A-MED-01 — Busca de cenários não escala

**Problema**
- Endpoint busca todos os cenários e filtra em memória para `search`

**Evidência**
- [scenarios.ts:L46-L53](file:///c:/projetos/mesas_rpg_artificio/backend/src/routes/scenarios.ts#L46-L53)

**Impacto**
- Piora de latência conforme crescimento de catálogo

**Correção concreta**
- Mover filtro para SQL com índice (`ILIKE`, trigram/FTS)

---

## [MÉDIO] A-MED-02 — API de catálogo sem contrato público formal

**Problema**
- Não há evidência de OpenAPI pública versionada para consumidores externos de catálogo/hidratação

**Impacto**
- Alto custo de integração para terceiros
- Quebra silenciosa de contrato

**Correção concreta**
- Publicar OpenAPI 3.1 para `/public/v1/catalog/*`
- Adotar versionamento semântico por endpoint

---

## [MÉDIO] A-MED-03 — Frontend cobre moderação apenas de sistemas

**Problema**
- `GestaoPage` possui trilha para `system-suggestions`
- Não há trilha equivalente para `scenario-suggestions`

**Evidência**
- [GestaoPage.tsx:L64-L65](file:///c:/projetos/mesas_rpg_artificio/frontend/src/pages/GestaoPage.tsx#L64-L65)

**Impacto**
- Fluxo backend/frontend quebrado para cenários

**Correção concreta**
- Adicionar tab + handlers + filtros + toasts para cenários

---

## 8) Proposta de arquitetura para API pública (padrão Big Tech)

## 8.1 Domínios (separação obrigatória)

1. **Catalog Domain**
   - `systems`
   - `system_nodes` (ou manter `systems` com `node_type` + `parent_id`)
   - `system_aliases`
   - `scenarios`

2. **Contribution Domain**
   - `system_suggestions`
   - `scenario_suggestions`
   - workflow de moderação

3. **Publication Domain**
   - `tables`
   - relacionamentos de publicação (`system_id`, `scenario_id`)

4. **Identity/Authorization Domain**
   - guard de papéis e auditoria de aprovação

---

## 8.2 Contrato público proposto

### Base
- Prefixo: `/api/public/v1/catalog`
- JSON envelope padrão:

```json
{
  "data": {},
  "meta": {
    "request_id": "...",
    "version": "v1"
  },
  "errors": []
}
```

### Endpoints de leitura

1. `GET /systems`
   - filtros: `q`, `node_type`, `parent_id`, `depth`
   - paginação cursor
   - `include=aliases,parent,children`

2. `GET /systems/{id}`
   - entidade única + relacionamentos opcionais

3. `GET /systems/resolve?path_slug=dungeons-dragons/5e/2024`
   - resolve cadeia base→edição→variante

4. `GET /scenarios`
   - filtros: `q`, `subgenre`
   - paginação cursor

5. `GET /scenarios/{id}`

6. `POST /hydrate`
   - hidratação em lote para clientes externos

Exemplo de request:

```json
{
  "systems": ["sys_1", "sys_2"],
  "scenarios": ["scn_1"],
  "include": ["aliases", "lineage"]
}
```

Exemplo de resposta:

```json
{
  "data": {
    "systems": [
      {
        "id": "sys_1",
        "name": "Dungeons & Dragons",
        "node_type": "system",
        "path_slug": "dungeons-dragons",
        "lineage": []
      },
      {
        "id": "sys_2",
        "name": "D&D 5e 2024",
        "node_type": "variant",
        "path_slug": "dungeons-dragons/5e/2024",
        "lineage": [
          { "id": "...", "node_type": "system" },
          { "id": "...", "node_type": "edition" }
        ]
      }
    ],
    "scenarios": [
      {
        "id": "scn_1",
        "name": "Forgotten Realms",
        "slug": "forgotten-realms",
        "subgenres": ["fantasia"]
      }
    ]
  },
  "meta": {
    "request_id": "req_x",
    "version": "v1"
  }
}
```

---

## 8.3 Contrato de contribuição/moderação proposto

### Submissão
- `POST /api/v1/contributions/system-suggestions`
- `POST /api/v1/contributions/scenario-suggestions`

### Moderação
- `GET /api/v1/admin/contributions?type=system|scenario&status=pending`
- `POST /api/v1/admin/contributions/{id}/approve`
- `POST /api/v1/admin/contributions/{id}/reject`

### Regra obrigatória na aprovação
- Aprovação **sempre** materializa entidade de catálogo em transação única
- Persistir vínculo `suggestion.approved_entity_id`

---

## 8.4 Requisitos não-funcionais para API pública

1. **Compatibilidade contratual**
   - OpenAPI versionado
   - changelog de breaking change

2. **Escalabilidade**
   - paginação cursor
   - filtros indexados
   - cache HTTP (`ETag`, `Cache-Control`)

3. **Confiabilidade**
   - `request_id` em toda resposta
   - logs estruturados
   - métricas de latência p95 por endpoint

4. **Segurança**
   - rate limit por chave/IP
   - OAuth2/JWT para endpoints não públicos

---

## 9) Roadmap de reformulação

## Fase 0 — Convergência de schema (bloqueante)

- Corrigir drift `system_suggestions` (A-CRIT-01)
- Padronizar taxonomia `node_type` (A-HIGH-01)

**Gate de saída:** ambiente novo sobe e passa smoke de sugestão/aprovação sem SQL manual.

## Fase 1 — Fechar fluxo de contribuição

- Implementar moderação de cenários (A-CRIT-03)
- Fazer aprovação materializar entidade (A-CRIT-02)

**Gate de saída:** qualquer sugestão aprovada aparece no catálogo automaticamente.

## Fase 2 — Normalizar hidratação

- Incluir cenário na listagem de mesas (A-HIGH-02)
- Criar endpoint de `hydrate` em lote

**Gate de saída:** cliente externo monta catálogo completo sem N+1.

## Fase 3 — Public API

- Expor `/api/public/v1/catalog/*`
- Publicar OpenAPI + SDK mínimo

**Gate de saída:** desenvolvedor terceiro integra sem consultar código interno.

## Fase 4 — Operação Big Tech

- Auditoria de ingestão com `catalog_ingestion_jobs`
- Observabilidade + SLO

**Gate de saída:** mudanças de catálogo são rastreáveis ponta a ponta.

---

## 10) Checklist para analista externo

### Backend
- [ ] Validar convergência real de schema em ambiente limpo
- [ ] Validar moderação de cenário ponta a ponta
- [ ] Validar materialização de aprovação em transação

### Frontend
- [ ] Validar trilha de moderação de cenário na gestão
- [ ] Validar hidratação unificada de sistema/cenário no catálogo

### Integração
- [ ] Garantir que payload aprovado aparece em leitura pública
- [ ] Garantir ausência de drift entre SQL migrations e runtime types

---

## 11) Decisão arquitetural pendente (bloqueante)

> [!IMPORTANT]
> Definir oficialmente se `subsystem` é tipo suportado no catálogo público.
> 
> Sem essa decisão, o contrato público de taxonomia fica inconsistente entre validação, migration e fluxo de sugestão.
