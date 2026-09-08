# Plano de Arquitetura — 047 Inbox de Importação de Mesas

> Decisões de arquitetura e encaixe. Complementa `spec.md` §Diagnóstico.

## 1. Arquitetura da solução (Fase 1 — MVP)

```
┌─────────────────────────────────────────────────────────┐
│  UI Admin (/gestao → aba "Inbox")                       │
│  ┌─────────────┐  ┌──────────────────────────────────┐  │
│  │ Colar texto  │  │ Revisar Drafts (reusa            │  │
│  │ (NOVO)       │  │ DiscordDraftPreview com prop api) │  │
│  └──────┬───────┘  └──────────────┬───────────────────┘  │
│         │ POST /api/v1/admin/inbox/import-text          │
└─────────┼────────────────────────────┼──────────────────┘
          │                            │
┌─────────▼────────────────────────────▼──────────────────┐
│  Backend: apps/mesas/backend/src/                       │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ NOVO: routes/adminImportInbox.ts                  │   │
│  │  POST /import-text  → segmenta → cria mensagem   │   │
│  │  GET  /drafts       → lista (filtro por origem)  │   │
│  │  POST /drafts/:id/sync → syncImportDraftToTable  │   │
│  └──────┬───────────────────────────────────────────┘   │
│         │                                                │
│  ┌──────▼───────────────────────────────────────────┐   │
│  │ NOVO: inbox/adapters/textToRawMessage.ts          │   │
│  │  rawText → DiscordRawMessage (adaptador MVP)      │   │
│  │  DEB-047-07: renomear → ImportRawMessage futuro   │   │
│  └──────┬───────────────────────────────────────────┘   │
│         │                                                │
│  ┌──────▼───────────────────────────────────────────┐   │
│  │ NOVO: inbox/syncImportDraftToTable.ts             │   │
│  │  (similar a syncDiscordDraftToTable mas usa       │   │
│  │   import_messages em vez de discord_import_msgs)  │   │
│  └──────┬───────────────────────────────────────────┘   │
│         │                                                │
│  ┌──────▼───────────────────────────────────────────┐   │
│  │ EXISTENTE (sem alterações):                       │   │
│  │  discord/parseDiscordAnnouncement.ts              │   │
│  │  discord/normalizeDiscordTableDraft.ts            │   │
│  │  discord/syncDiscordDraftToTable.ts  (Discord)    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │ DB: import_messages (NOVO — inbox)                │   │
│  │     discord_import_table_drafts (ALTERADO)        │   │
│  │     discord_import_messages (INTACTO — Discord)   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## 2. Decisão de banco — Opções comparadas

### Opção A: Alterar tabelas existentes (ALTER TABLE)

**Vantagens:**
- Reuso máximo do código existente (rotas, queries, FK)
- Zero duplicação de lógica

**Desvantagens:**
- ALTER TABLE em produção (lock, risco)
- `discord_import_messages` tem FK `source_id NOT NULL` → precisa virar nullable
- Índice UNIQUE `(discord_message_id, discord_channel_id)` — como tratar quando não há channel_id?

### Opção B: Tabela paralela `import_messages` + view/adapter

**Vantagens:**
- Zero toque nas tabelas Discord existentes
- Schema limpo para o futuro (nome genérico, campos específicos de cada origem)
- Segregação clara: mensagens Discord vs mensagens de outras fontes

**Desvantagens:**
- Duas tabelas para manter
- `discord_import_table_drafts` referencia `discord_import_messages.id` — precisaria de uma FK para a nova tabela OU tornar a FK nullable e aceitar ambas
- Código de consulta de drafts precisaria de UNION ou adapter

### Opção C (recomendada para MVP): Tabela paralela + FK polimórfica no draft

Nova tabela `import_messages`:
```sql
CREATE TABLE import_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL DEFAULT 'manual_paste',  -- 'manual_paste' | 'discord_bot' | 'json_import' | ...
  raw_text TEXT,                                      -- texto bruto original (para auditoria)
  content_raw TEXT NOT NULL,                          -- texto parseável (normalizado)
  thread_name TEXT,                                   -- titulo/hint (ex: nome da thread Discord)
  metadata JSONB DEFAULT '{}',                        -- campos específicos da origem
  content_hash TEXT NOT NULL,                         -- sha256(content_raw) para deduplicação
  status TEXT NOT NULL DEFAULT 'pending',             -- pending | parsed | needs_review | error
  parse_error TEXT,                                   -- mensagem de erro do parser
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Alterar `discord_import_table_drafts`:
```sql
-- Adicionar coluna opcional para a nova tabela
ALTER TABLE discord_import_table_drafts
  ADD COLUMN import_message_id UUID REFERENCES import_messages(id) ON DELETE CASCADE;

-- Tornar discord_message_id nullable (aceita NULL quando origem for import_messages)
ALTER TABLE discord_import_table_drafts
  ALTER COLUMN discord_message_id DROP NOT NULL;
```

**Vantagem principal:** Isola o novo fluxo, preserva o existente. A camada de sync (`syncDiscordDraftToTable`) continuaria funcionando com `discord_import_messages` para o fluxo Discord existente. Para o novo fluxo, uma função similar usaria `import_messages`.

### Decisão final: Opção C

Justificativa:
1. **Segurança**: não toca nas tabelas Discord de produção com ALTER TABLE destrutivo
2. **Clareza**: `import_messages` é semanticamente correto para o conceito de Inbox
3. **Extensibilidade**: fácil adicionar novas origens (`json_import`, `social_media`, `form`) sem poluir tabelas Discord
4. **Rollback trivial**: se der problema, a tabela nova pode ser dropada sem afetar Discord

**Contraponto:** Duplica a lógica de sync (precisa de `syncImportDraftToTable` similar a `syncDiscordDraftToTable`). Mitigação: extrair a lógica comum para um `syncDraftToTable` genérico que aceita parâmetros de ambas as origens.

## 3. Estrutura de arquivos proposta

```
apps/mesas/backend/src/
├── inbox/                              # ✅ CRIADO
│   ├── adapters/
│   │   └── textToRawMessage.ts         # ✅ CRIADO — Adaptador: texto colado → DiscordRawMessage
│   ├── segmentation.ts                 # ✅ CRIADO — Segmentador de múltiplos anúncios (3 estratégias)
│   ├── scoring.ts                      # 🔜 Planejado (Fase 4)
│   ├── syncImportDraftToTable.ts       # ✅ CRIADO — sync draft inbox → tables
│   └── heuristics.ts                   # 🔜 Planejado (Fase 6)
├── routes/
│   ├── adminDiscordSync.ts             # ✅ ALTERADO — 5 guards anti-vazamento (DEB-047-05)
│   └── adminImportInbox.ts            # ✅ CRIADO — POST /import-text + GET /drafts
├── discord/                            # ✅ ALTERADO — 'manual_paste' em types.ts
│   ├── parseDiscordAnnouncement.ts     # ✅ Intacto
│   ├── normalizeDiscordTableDraft.ts   # ✅ Intacto
│   ├── syncDiscordDraftToTable.ts      # ✅ Intacto
│   ├── ingestMessages.ts              # ✅ ALTERADO — type assertion em source_kind (linhas 88, 260)
│   └── types.ts                        # ✅ ALTERADO — + 'manual_paste' em DiscordImportSourceKind
└── db/
    └── types.ts                         # ✅ ALTERADO — ImportMessagesTable + nullables em drafts

apps/mesas/database/
└── migration_128_import_messages.sql    # ✅ CRIADO + APLICADO no banco beta

apps/mesas/frontend/src/
└── features/
    └── inbox/                           # ✅ CRIADO (T1.8-T1.12)
        ├── components/
        │   ├── InboxPanel.tsx           # ✅ CRIADO
        │   ├── TextPasteArea.tsx        # ✅ CRIADO
        │   ├── InboxDraftReviewTable.tsx # ✅ CRIADO
        │   └── adapters/
        │       └── draftAdapter.ts      # ✅ CRIADO
        └── api/
            └── inboxApi.ts             # ✅ CRIADO
```

## 4. Contrato REST (Fase 1)

### `POST /api/v1/admin/inbox/import-text`

**Request:**
```json
{
  "text": "string (obrigatório, min 10 caracteres)",
  "title_hint": "string (opcional, vira thread_name no DiscordRawMessage e import_messages)"
}
```

**Response (200):**
```json
{
  "data": {
    "segments_found": 3,
    "drafts_created": 2,
    "drafts": [
      {
        "id": "uuid (draft ID)",
        "title": "Mesa de D&D 5e",
        "status": "needs_review",
        "confidence": 0.67,
        "missing_fields": ["system_name", "day_of_week", "start_time"]
      }
    ]
  }
}
```
Notas: `drafts_created` pode ser menor que `segments_found` (segmentos sem conteúdo elegível viram `status: 'error'` em `import_messages`, sem draft). `missing_fields` detecta: title, system_name, type, modality, slots_total. `confidence` vem do `normalizeDiscordTableDraft`.

**Response (400):**
```json
{ "error": "Texto muito curto para segmentação (mínimo 10 caracteres)." }
```

**Response (403):**
```json
{ "error": "Acesso restrito a administradores." }
```

### `GET /api/v1/admin/inbox/drafts`

Query params: `status`, `limit` (default 50, max 100), `offset` (default 0), `origin` (filtra por `source_type`)

**Response (200):**
```json
{
  "data": [
    {
      "id": "uuid (draft ID)",
      "source_type": "manual_paste",
      "raw_text": "Sistema: D&D 5e\nMesa: A Torre...",
      "status": "needs_review",
      "confidence": 0.67,
      "title": "Mesa de D&D 5e",
      "created_at": "2026-06-22T13:00:00.000Z"
    }
  ]
}
```
JOIN `discord_import_table_drafts` ↔ `import_messages` via `import_message_id`. Ordenado por `created_at DESC`.

### Reuso de endpoints existentes

| Endpoint existente | Pode ser usado pelo inbox? |
|---|---|
| `GET /admin/discord-sync/drafts` | **Não** — filtrado por `discord_message_id IS NOT NULL` (guard TASK A) |
| `GET /admin/discord-sync/drafts/:id` | **Sim** — lookup por ID genérico (não acessa `discord_message_id`) |
| `PATCH /admin/discord-sync/drafts/:id` | **Sim** — update genérico (não acessa `discord_message_id`). Inbox ainda não expõe PATCH próprio. |
| `POST /admin/discord-sync/drafts/:id/sync` | **Não** — exige `discord_message_id`; retorna 422 para drafts de inbox (guard TASK A) |
| `POST /admin/discord-sync/drafts/:id/reparse` | **Não** — exige `discord_message_id`; retorna 422 para drafts de inbox (guard TASK A) |

## 5. Fluxo detalhado (Fase 1)

```
1. Admin acessa /gestao → aba "Inbox" (nova)
2. Admin cola texto bruto (1 ou mais anúncios)
3. Frontend: POST /api/v1/admin/inbox/import-text { text: "..." }
4. Backend:
   a. Segmenta texto em blocos de anúncios individuais
   b. Para cada bloco:
      - Cria DiscordRawMessage com content_raw = bloco
      - Chama parseDiscordAnnouncement(message, systems)
      - Se parsed != null: normalizeDiscordTableDraft(parsed, systems)
      - Persiste em import_messages + discord_import_table_drafts
   c. Retorna lista de drafts criados
5. Frontend: mostra tabela de drafts com score, status, missing_fields
6. Admin clica em um draft → abre DiscordDraftPreview (reutilizado)
7. Admin edita campos, corrige ambiguidades
8. Admin clica "Aprovar" → status muda para 'ready'
9. Admin clica "Sync" → cria mesa com status 'draft' (NÃO publicada)
```

## 6. Segmentação de anúncios (R1)

Regex/Heurística inicial para separar múltiplos anúncios no mesmo texto:

```typescript
function segmentAnnouncements(rawText: string): string[] {
  // Estratégia 1: separadores explícitos (---, ===, ***)
  const separatorPattern = /(?:\r?\n\s*[-=*]{3,}\s*\r?\n)/;
  const explicitSegments = rawText.split(separatorPattern).filter(s => s.trim().length >= 10);
  if (explicitSegments.length > 1) return explicitSegments;

  // Estratégia 2: blocos começando com "Sistema:" ou "Mesa:" ou título
  const headerPattern = /(?:\r?\n)(?=(?:Sistema|Mesa|Jogo|T[ií]tulo|Aventura)\s*[:：])/i;
  const headerSegments = rawText.split(headerPattern).filter(s => s.trim().length >= 10);
  if (headerSegments.length > 1) return headerSegments;

  // Fallback: texto único
  return [rawText.trim()];
}
```

## 7. Riscos de implementação

| Item | Risco | Ação |
|---|---|---|
| `DiscordImportSourceKind` precisa de `'manual_paste'` | BAIXO — type alias, sem breaking change | Adicionar ao union type em `types.ts:1` (T1.1) |
| `syncDiscordDraftToTable` exige `discord_message_id` com metadata Discord | **ALTO** — usa `message.discord_message_id` como `source_id` em `tables` | **NÃO reutilizar.** Criar `syncImportDraftToTable` que usa `import_messages` (T1.6) |
| Frontend `DiscordDraftPreview` chama `discordSyncApi` hardcoded | MÉDIO — endpoints Discord quebram para inbox drafts | Passar `api` como prop (Opção A na investigação T1.12) |
| `discord_message_id` → nullable quebra rotas Discord | **ALTO** — `GET /drafts` vaza inbox, `reparse`/`sync`/`sync-ready` quebram | 5 guards/filtros documentados em DEB-047-05 |
| Múltiplos anúncios no mesmo texto → segmentação falha | MÉDIO | Testar com corpus real de anúncios; fallback: colar 1 por vez |
| `extractBodyFromEmbeds` depende de estrutura `embeds[]` do Discord | BAIXO — não usado para texto colado (content_raw já tem o texto) | Nenhum — `content_raw` é preenchido diretamente |

## 8. Status atual

### ✅ Concluído

- **Auditoria de encaixe** (Fase 0) — 17 arquivos lidos, diagnóstico em `spec.md` §Diagnóstico
- **TASK A — Guards** — 5 filtros em `adminDiscordSync.ts` (DEB-047-05 fechado)
- **TASK B — Migration + tipos** — `migration_128` (11 colunas + 4 índices) + `ImportMessagesTable` + `discord_message_id: null | string` + `import_message_id: string | null`
- **TASK C — Adaptador + segmentador** — `textToRawMessage.ts` (19 linhas) + `segmentation.ts` (3 estratégias)
- **TASK D — Rota** — `adminImportInbox.ts` (`POST /import-text` + `GET /drafts`) + registro em `server.ts`
- **Correção de tipo** — revert `'manual_paste'` do `db/types.ts`; type assertion em `ingestMessages.ts:88,260`
- **Branch** — `feat/mesas-047-inbox-importacao`
- **FASE A — Migration no banco beta** — aplicada em `mesas-beta-db` / `mesas_rpg`, backup em `/tmp/spec047-backup/`, registro em `schema_migrations`
- **Validação** — `tsc --noEmit` verde; lint sem erros nos arquivos mesas

### 🔜 Pendente (fora do escopo da spec ou ciclos futuros)

- **Extrair `loadSystemsForParser`** — duplicada em `adminImportInbox.ts` (~25 linhas), mover para módulo compartilhado (Fase 7)
- **Aprovar Fase 1** antes de avançar para Fase 2
- **Smoke T1.13-T1.16** — testes manuais no beta pós-deploy

### ✅ Concluído (além do planejamento original)

- **`syncImportDraftToTable.ts`** — endpoint `POST /drafts/:id/sync` implementado (T1.6 ✅)
- **Frontend Inbox** (T1.8–T1.12) — `inboxApi.ts`, `InboxPanel.tsx`, `TextPasteArea.tsx`, `InboxDraftReviewTable.tsx`, `draftAdapter.ts`, aba no `GestaoPage` — todos implementados
- **Corpus de treino** (Fase 1.5) — migration 129, endpoint `POST /drafts/:id/correction`, `GET /metrics`
- **Refatoração** — `DiscordDraftPreview.tsx` reduzido de 707→139 linhas; `useDraftForm.ts` + `draftFormUtils.ts` + `DraftEditorTab.tsx` extraídos
- **Primitivos `packages/ui`** — `<Banner>` + `forwardRef` em TextInput/Textarea/Select
- **9 revisões CodeRabbit** (REV-027 a REV-035) — todas investigadas; 5 implementadas, 2 falso positivo, 2 débito separado

## 9. Plano de deploy e validação (FASE A/B/C)

Infraestrutura: código beta em `/opt/artificio-beta` (branch `dev`, clone git), container `mesas-beta-db` (Postgres 16), container `mesas-beta-api` (Express/Node), Cloudflare Tunnel → `https://mesasbeta.artificiorpg.com`.

### FASE A — Migration (banco) ✅

Aplicada em 2026-06-22. Migration `online-safe`, aditiva, dentro de transação `BEGIN/COMMIT`. Backup direcionado (schema + dados `discord_import_table_drafts` + `schema_migrations`). Registro idempotente em `schema_migrations` (`migration_name`, `applied_at`, `applied_by`). Ver detalhes em `reviews.md`.


