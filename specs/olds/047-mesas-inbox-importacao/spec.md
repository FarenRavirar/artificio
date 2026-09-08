# 047 — Inbox de Importação de Mesas

- **Módulo/Pacote:** `apps/mesas` (backend + frontend)
- **Gate relacionado:** Gate D (mesas em prod), Gate B (SSO) — ambos fechados
- **Status:** backend + frontend UI implementados localmente (2026-06-22). Backend: PR #87 mergeada, deploy beta `d9c3192`, 3 novas rotas (GET/PATCH /drafts/:id, POST /drafts/:id/reparse). Frontend: types + inboxApi + TextPasteArea + InboxPanel + InboxDraftReviewTable + DiscordDraftPreview/ReviewTable generalizados + aba Inbox no GestaoPage. Lint 15/15, build 17/17, backend 21/178 ✅, frontend 4/19 ✅. Sem commit/push/PR/deploy. Próximo: autorizações Git → deploy beta → smoke E2E T1.13-T1.16.
- **Reviews:** `reviews.md`
- **Débitos:** `debitos.md`
- **Arquitetura:** `plan.md`
- **Tasks:** `tasks.md`

## Problema

O módulo `apps/mesas` possui um pipeline completo de importação de anúncios do Discord (`Discord → ingest → parse → normalize → draft → revisão admin → sync → tabela`), mas ele está acoplado exclusivamente ao Discord Bot/API. Não existe um fluxo para importar anúncios a partir de texto colado, JSON/export, redes sociais ou formulários — fontes que não dependem de token de bot nem de scraping de cookie pessoal.

O objetivo é transformar esse pipeline em um **Inbox de Importação** mais amplo, que aceite múltiplas fontes (texto colado como MVP, depois JSON, Discord Bot, redes sociais) e ofereça uma interface de revisão inteligente com score de qualidade e edição assistida.

## Requisitos (R1—R10)

- **R1 — Fase 0: Auditoria de encaixe.** Investigar código existente, identificar pontos de reuso, mapear dependências, riscos e migrations necessárias. **CONCLUÍDA (ver §Diagnóstico).**
- **R2 — Fase 1: MVP texto colado → draft.** Admin cola texto bruto, backend segmenta, cria mensagem compatível com pipeline existente, gera drafts revisáveis. NÃO publicar automaticamente.
- **R3 — Fase 2: Normalização melhorada.** Parser lida com múltiplos dias, quinzenal, one-shot, horários com intervalo, vagas ambíguas, recrutamento, mesa paga. Marcar `needs_review` em ambiguidades.
- **R4 — Fase 3: Resolução de sistema.** Aproveitar base existente de sistemas/aliases. Sistema próprio ≠ sistema canônico. Sugestão automática quando não houver match.
- **R5 — Fase 4: Score de qualidade.** Score multidimensional (completeness, system_match, schedule_confidence, contact_confidence, slots_confidence, publication_readiness). Explicar motivo, não só número.
- **R6 — Fase 5: UI de revisão inteligente.** Tela admin com anúncio bruto, extraídos, normalizados, sistema, ausentes, ambiguidades, score, editar/aprovar/rejeitar/sync.
- **R7 — Fase 6: Heurísticas reaproveitáveis.** Base de regras (pattern→field→value) sem depender de IA para tudo.
- **R8 — Fase 7: Roadmap futuro.** Discord Bot, JSON, redes sociais, auto-aprovação, deduplicação, métricas.
- **R9 — Não publicar automaticamente.** Drafts nunca viram mesas publicadas sem aprovação explícita do admin. Status inicial = `draft`.
- **R10 — Não alterar produção.** Trabalhar em `dev`/beta. Promoção `dev→main` + deploy prod só com aprovação nominal.

## Diagnóstico de encaixe (Fase 0 — auditoria)

### 1. Pipeline atual — arquivos core

| Arquivo | Função | Reutilizável? |
|---|---|---|
| `apps/mesas/backend/src/discord/types.ts:88` | `DiscordRawMessage` — input do parser | Sim, com adaptador mínimo (texto→DiscordRawMessage) |
| `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:396` | `parseDiscordAnnouncement(message, systems)` — parseia texto bruto → `DiscordTableDraft` | **Sim, sem alterações** |
| `apps/mesas/backend/src/discord/normalizeDiscordTableDraft.ts:51` | `normalizeDiscordTableDraft(draft, systems)` — normaliza + resolve sistema | **Sim, sem alterações** |
| `apps/mesas/backend/src/discord/syncDiscordDraftToTable.ts:304` | `syncDiscordDraftToTable(draftId)` — cria/atualiza tabela a partir do draft | **Não** — acoplado a `discord_import_messages`. Inbox usará `syncImportDraftToTable` (nova função) |
| `apps/mesas/backend/src/routes/adminDiscordSync.ts:1147` | Rotas admin REST (CRUD sources, messages, drafts, sync) | Usar como referência; nova rota separada `adminImportInbox.ts` |
| `apps/mesas/backend/src/db/types.ts:609-657` | Tipos Kysely para `discord_import_messages` e `discord_import_table_drafts` | **Não** — inbox usará `import_messages` (tabela nova, tipos novos) |
| `apps/mesas/database/migration_115_discord_import.sql` | DDL das 3 tabelas Discord | **Não alterar** — `discord_import_messages` intacto; nova migration `migration_128_import_messages.sql` |

### 2. Onde ficam as telas admin atuais

- **`/gestao`** (`GestaoPage.tsx`) — hub admin com 6 abas, incluindo "Discord Sync"
- **`features/discord-sync/`** — painel completo (4 sub-abas: Config, Fontes, Mensagens, Drafts)
- **`DiscordDraftPreview.tsx`** — modal de edição/revisão de draft (reutilizável)
- **`DiscordDraftReviewTable.tsx`** — tabela de drafts com filtros (reutilizável)

### 3. Já existe tela para revisar drafts importados?

**Sim.** `DiscordDraftPreview.tsx` faz edição completa (campos, capa, desambiguação, tabs de dados brutos, salvar, reparsar, sincronizar). Pode ser reutilizado com adaptação mínima.

### 4. Modelagem das tabelas

`discord_import_messages` (`migration_115`, linha 29):
- `source_id UUID NOT NULL REFERENCES discord_import_sources(id)` — **trava atual**: obrigatório
- `source_kind TEXT DEFAULT 'discord_bot'` — suporta valores customizados (`DiscordImportSourceKind` = `'discord_bot' | 'discord_chat_exporter_json'`)
- Campos Discord-específicos: `discord_guild_id`, `discord_channel_id`, `discord_thread_id`, `discord_thread_name`, `discord_author_id`, etc.

`discord_import_table_drafts` (`migration_115`, linha 62):
- `discord_message_id UUID NOT NULL REFERENCES discord_import_messages(id)` — link obrigatório com mensagem
- `parsed_payload JSONB`, `normalized_payload JSONB` — armazena `DiscordTableDraft`
- `status TEXT DEFAULT 'draft'` — `draft | ready | needs_review | synced | rejected`

### 5. Existe endpoint que recebe texto bruto manualmente?

**Não.** Os endpoints existentes (`POST /fetch`, `POST /messages/parse-batch`, `POST /messages/:id/parse`) sempre partem de uma mensagem já persistida em `discord_import_messages`, que foi ingerida via Discord API.

### 6. parseDiscordAnnouncement depende de estruturas Discord?

**Não para parsing.** O parser (`parseDiscordAnnouncement.ts:396-499`) usa:
- `content_raw` (string) — corpo do texto → **essencial**
- `discord_thread_name` (string | null) — título do thread → opcional, usado para sistema/título
- `attachments` (unknown[]) — extrai capa → opcional
- `embeds` (unknown[]) — fallback de conteúdo → opcional

Os campos Discord-específicos (`guild_id`, `channel_id`, `message_id`, `author_id`, `author_name`, `message_url`) são armazenados em `source` (metadados) e nos campos da tabela — **não afetam o parsing**.

### 7. Menor adaptador: texto colado → DiscordRawMessage

**Implementado em `apps/mesas/backend/src/inbox/adapters/textToRawMessage.ts` (~19 linhas):**

```typescript
import crypto from 'node:crypto';
import type { DiscordRawMessage } from '../../discord/types';

export function textToRawMessage(rawText: string, threadName?: string): DiscordRawMessage {
  return {
    source_kind: 'manual_paste',
    discord_message_id: crypto.randomUUID(),
    discord_channel_id: '',
    discord_guild_id: '',
    discord_author_id: null,
    discord_author_name: null,
    discord_message_url: null,
    content_raw: rawText.trim(),
    attachments: [],
    embeds: [],
    message_created_at: new Date(),
    message_edited_at: null,
    discord_thread_name: threadName ?? '',
  };
}
```

15 campos preenchidos. `threadName` opcional (vem do `title_hint` do request). UUID via `crypto.randomUUID()` (Node 18+).

**Impacto em `DiscordImportSourceKind`**: `'manual_paste'` foi adicionado ao tipo de domínio (`discord/types.ts:1`). **`db/types.ts` NÃO recebeu** — o tipo DB/Kysely permanece `'discord_bot' | 'discord_chat_exporter_json'`. `ingestMessages.ts:88,260` usa type assertion para estreitar no ponto de insert. Motivo: `discord_import_messages.source_kind` nunca receberá `'manual_paste'` (Opção C isola inbox em `import_messages`).

### 8. syncDiscordDraftToTable pode ser reutilizado sem mudanças?

**Não.** A função (`syncDiscordDraftToTable.ts:304`) é acoplada a `discord_import_messages`:
1. Linha 322: `SELECT ... FROM discord_import_messages WHERE id = draft.discord_message_id` — assumindo que o draft tem FK para tabela Discord
2. Linha 345: `WHERE source_id = message.discord_message_id` — usa `discord_message_id` como `source_id` em `tables`
3. Linha 154: `source_url: message.discord_message_url` — usa URL do Discord como `source_url`

Para o inbox, será necessário **`syncImportDraftToTable`** (função separada) que:
1. Busca `import_messages` em vez de `discord_import_messages` (via `draft.import_message_id`)
2. Usa `import_message.id` como `source_id` em `tables`
3. Usa `metadata.source_url` ou `null` como `source_url`
4. Usa `adminUser.displayName` como `actual_gm_name` (admin que fez sync)

Os helpers existentes (`extractContacts`, `extractSchedules`, `validateDraftForSync`, `buildTableData`) podem ser extraídos para módulo compartilhado no futuro (Fase 7). No MVP, `syncImportDraftToTable` será criado como função nova (~130 linhas).

### 9. Migrations necessárias

**Decisão final: Opção C — tabela paralela `import_messages`.** Nenhuma ALTER TABLE em `discord_import_messages`. Apenas `discord_import_table_drafts` recebe FK nova + DROP NOT NULL (ver tabela abaixo).

| # | Migração | Descrição | Risco | Status |
|---|---|---|---|---|---|
| 1 | NOVA: `migration_128_import_messages.sql` | Criar tabela `import_messages` (11 colunas: id, source_type, raw_text, content_raw, thread_name, metadata JSONB, content_hash, status, parse_error, created_at, updated_at) + 3 índices | **BAIXO**: tabela nova, zero rows | ✅ Aplicada no banco beta |
| 2 | ALTER: `discord_import_table_drafts.import_message_id` | Adicionar coluna FK opcional → `import_messages(id) ON DELETE CASCADE` + índice | **BAIXO**: coluna nova, nullable | ✅ Aplicada no banco beta |
| 3 | ALTER: `discord_import_table_drafts.discord_message_id DROP NOT NULL` | Permitir drafts de inbox (sem mensagem Discord) | **MÉDIO**: altera coluna existente; rotas Discord com 5 guards (DEB-047-05 fechado) | ✅ Aplicada no banco beta |

**Racional:** `discord_import_messages` tem 8 colunas Discord-específicas (42%), FK obrigatória para `discord_import_sources`, e UNIQUE constraint `(discord_channel_id, discord_message_id)`. Enfiar texto colado ali seria frágil e poluiria o schema. A tabela paralela `import_messages` é limpa, genérica e extensível — `metadata JSONB` acomoda qualquer origem futura (JSON, redes sociais, formulários).

### 10. Proposta de arquitetura: Opção C (tabela paralela + FK polimórfica no draft)

**Decisão final: Opção C — rota separada `adminImportInbox.ts` + tabela paralela `import_messages`.**

Motivos:
- `adminDiscordSync.ts` tem 1147 linhas — adicionar inbox piora manutenção (DEB-047-01)
- Inbox tem contrato próprio (aceita texto bruto, não precisa de token Discord)
- Separação clara: Discord = Bot API, Inbox = texto colado/JSON/redes sociais
- Reuso do pipeline core (parse → normalize) via adaptador `textToRawMessage`
- Tabela `import_messages` é semanticamente correta e extensível
- Zero ALTER TABLE destrutivo nas tabelas Discord de produção

**Rejeitado:**
- **Opção A** (ALTER TABLE `discord_import_messages`): 5 migrações em produção, 42% das colunas Discord-específicas ficariam vazias/sintéticas, UNIQUE constraint inviabiliza NULL. Risco alto, ganho zero.
- **Opção B** (tabela paralela sem FK polimórfica): não resolve como linkar drafts a mensagens de origens diferentes.
- **Opção C (original — rename `discord_import_messages` → `import_messages`):** rename de tabela em produção com FK cross-table — alto risco, baixo ganho no MVP. Pode ser reconsiderado na Fase 7 (roadmap futuro).

**Contraponto da Opção C adotada:** Duplica a lógica de sync (precisa de `syncImportDraftToTable` similar a `syncDiscordDraftToTable`). Mitigação: extrair helpers comuns para módulo compartilhado na Fase 7.

## Caminho de implementação (7 fases)

| Fase | Nome | Descrição | Depende de |
|---|---|---|---|
| 0 | Auditoria | Investigar código, mapear dependências, registrar diagnóstico | — ✅ |
| 0.5 | Pesquisa de ferramentas | Avaliar bibliotecas candidatas (dateparser, RapidFuzz, DeepSeek, Playwright) com 10 anúncios reais | Fase 0 |
| 1 | MVP: texto colado | Rota nova, adaptador texto→mensagem, reuso pipeline, UI de colar→revisar | Fase 0 |
| 1.5 | Corpus de treino | Toda correção humana vira dado: raw_text, parsed, corrected, diff, reason | Fase 1 |
| 2 | Normalização melhorada | Múltiplos dias, quinzenal, one-shot, vagas ambíguas, recrutamento, mesa paga | Fase 1 |
| 3 | Resolução de sistema | Match exato/alias/normalizado, sistema próprio, sugestão automática | Fase 1 |
| 4 | Score de qualidade | Score multidimensional com reasons, thresholds (0-49/50-79/80-94/95-100) | Fase 1 |
| 5 | UI de revisão inteligente | Tela admin com preview completo, edição assistida, aprovar/rejeitar/sync | Fase 1 |
| 6 | Heurísticas reaproveitáveis | Base de regras pattern→field→value, IA só para desempate | Fase 2 |
| 7 | Roadmap futuro | Discord Bot, JSON, redes sociais, auto-aprovação, deduplicação, métricas | Fase 5 |

## Critérios de aceite (por fase)

### Fase 0
- [x] Arquivos lidos e documentados com evidência (`parseDiscordAnnouncement.ts`, `normalizeDiscordTableDraft.ts`, `syncDiscordDraftToTable.ts`, `adminDiscordSync.ts`, `types.ts`, migrations 115/116/117/118/122, frontend `discord-sync/`, `GestaoPage.tsx`)
- [x] Pontos de encaixe mapeados (parser reutilizável, sync NÃO reutilizável, adaptador mínimo viável)
- [x] Riscos identificados (migrations em tabelas de produção, FK NOT NULL, índice UNIQUE)
- [x] Plano de implementação mínimo definido (Fase 1 — MVP)
- [x] Spec consolidada (contradições resolvidas, Opção C como decisão final)

### Fase 0.5 — Pesquisa de ferramentas ✅ (implementada 2026-06-23)

**Dependências instaladas:**

| Dependência | Tipo | Arquivo afetado | O que substituiu |
|---|---|---|---|
| `chrono-node ^2.9.1` | runtime | `apps/mesas/backend/package.json` | `extractDayOfWeek` + `extractStartTime` + `deriveFrequency` em `parseDiscordAnnouncement.ts` — regex caseiras (~30 linhas) substituídas por `chronoPt.parse()` com fallback regex para labels. Uso: `import { pt as chronoPt } from 'chrono-node'` |
| `fuzzball ^2.2.6` | runtime | `apps/mesas/backend/package.json` | `matchSystemName` em `normalizeDiscordTableDraft.ts` — loop exaustivo com normalização (~20 linhas) substituído por `fuzzball.token_sort_ratio(value, candidate) >= 82` |
| `@playwright/test ^1.61.0` | dev | `apps/mesas/frontend/package.json` | Novo: `e2e/playwright.config.ts` + `e2e/inbox-smoke.spec.ts` + scripts `test:e2e` / `test:e2e:install`. Teste cobre fluxo completo: colar texto → importar → ver draft |

**Novos arquivos:**

| Arquivo | O que faz |
|---|---|
| `apps/mesas/backend/src/inbox/deepseek.ts` | `enhanceWithDeepSeek()` — fallback LLM no pipeline. Chama `deepseek-v4-flash` via API REST com `response_format: json_object`. Só ativado se env `DEEPSEEK_API_KEY` presente. Gatilho: confidence < 0.6 ou sem system_id. Modelo configurável via `DEEPSEEK_MODEL` (default `deepseek-chat`). |
| `apps/mesas/frontend/e2e/playwright.config.ts` | Config Playwright: Chromium headless, baseURL do beta, trace/screenshot em falha |
| `apps/mesas/frontend/e2e/inbox-smoke.spec.ts` | Smoke E2E: login SSO → /gestao → aba Inbox → colar texto → importar → ver draft criado. Requer cookie de sessão admin exportado (storageState). |
| `apps/mesas/scripts/discord-export.sh` | Script operacional Docker para export de canais Discord. Uso: `./discord-export.sh -t TOKEN -c CHANNEL_ID`. NUNCA automatizado (viola TOS do Discord). |

**Integração no fluxo existente:**

- `adminImportInbox.ts:167-179` — pipeline 2 estágios: parser regex → `normalizeDiscordTableDraft` → se confidence < 0.6 ou sem system_id → `enhanceWithDeepSeek()` → re-normalize. DeepSeek só toca API se `DEEPSEEK_API_KEY` definida. Falha silenciosa (parser regex mantido).

**O que a VM agora precisa ter:**

- Chromium (para testes E2E Playwright): `npx playwright install chromium` (aprox 300MB)
- Docker image `tyrrrz/discordchatexporter:latest` (para export operacional): `docker pull tyrrrz/discordchatexporter` (aprox 200MB)
- Env `DEEPSEEK_API_KEY` (opcional, para ativar fallback DeepSeek)
- Env `DEEPSEEK_MODEL` (opcional, default `deepseek-chat`)

**Validação:**

- Backend: 178/178 tests passando, build 17/17, lint 15/15
- Frontend: E2E Playwright requer Chromium instalado + cookie de sessão admin (não executado localmente)

### Fase 1 — backend ✅ frontend ❌

**Concluído (backend mínimo + infra):**
- [x] Migration 128 criada e aplicada no banco beta (`mesas-beta-db`) — FASE A (2026-06-22)
- [x] 5 guards anti-vazamento em `adminDiscordSync.ts` (DEB-047-05 fechado)
- [x] Tipos Kysely (`ImportMessagesTable` + `discord_message_id: string | null` + `import_message_id: string | null`)
- [x] `'manual_paste'` em `discord/types.ts` (domínio); revertido de `db/types.ts` (não pertence ao DB type)
- [x] Adaptador `textToRawMessage.ts` — texto colado → `DiscordRawMessage` (19 linhas)
- [x] Segmentador `segmentation.ts` — 3 estratégias (separadores, headers, fallback)
- [x] Rota `adminImportInbox.ts` — `POST /import-text` + `GET /drafts`
- [x] Registro em `server.ts` (`/api/v1/admin/inbox`)
- [x] Branch `feat/mesas-047-inbox-importacao` criada
- [x] `tsc --noEmit` verde; lint limpo nos arquivos mesas

**Pendente (sync + UI + validação):**
- [ ] `POST /drafts/:id/sync` — `syncImportDraftToTable` (~130 linhas, similar a `syncDiscordDraftToTable`)
- [ ] `loadSystemsForParser` duplicada em `adminImportInbox.ts` (~25 linhas) — extrair para módulo compartilhado (Fase 7)
- [ ] FASE B — deploy do código no beta (push + PR + merge + rebuild container)
- [ ] FASE C — smoke test (POST /import-text com anúncio real, verificar DB, testar guards)
- [ ] Frontend: `inboxApi.ts` → `InboxPanel.tsx` → `TextPasteArea.tsx` → aba no `GestaoPage` (T1.8-T1.12)
- [ ] `DiscordDraftPreview` adaptado via prop `api` para suportar inbox drafts
- [ ] Campos ausentes no UI, ambiguidades sinalizadas, score/confidence visível

### Fase 1.5 — Corpus de treino

> Toda correção humana deve virar dado estruturado para aprendizado futuro.

- [ ] Tabela `import_corrections` (ou coluna JSONB em `import_messages`) registrando:
  - `raw_text` original (texto colado)
  - `parsed_before` (o que o parser extraiu)
  - `human_corrected` (o que o admin corrigiu)
  - `diff` (campos alterados: título, sistema, vagas, horário, etc.)
  - `reason` (ex: "sistema próprio confundido com Ordem Paranormal")
- [ ] Endpoint `POST /api/v1/admin/inbox/drafts/:id/correction` registra a correção ao aprovar/sync
- [ ] Métricas básicas: taxa de acerto por campo, campos mais corrigidos, sistemas mais confundidos

### Fases 2-7
Ver `tasks.md` para detalhamento completo.

## Riscos

| Risco | Severidade | Mitigação |
|---|---|---|
| Alterações em `discord_import_table_drafts` (DROP NOT NULL + nova FK) | **MÉDIO** | Migration aplicada no banco beta (FASE A concluída); 5 guards nas rotas Discord (DEB-047-05 fechado) |
| Parser produzir drafts incorretos para texto não-Discord | **MÉDIO** | Testar com conjunto diverso de anúncios reais; score baixo = revisão obrigatória; adaptador `textToRawMessage` é mínima superfície de risco |
| Regressão no fluxo Discord existente | **BAIXO** | Zero alterações em `parseDiscordAnnouncement`, `normalizeDiscordTableDraft`; rota nova isolada; guards nas rotas existentes |
| UI complexa demais para MVP | **BAIXO** | Fase 1 reutiliza `DiscordDraftPreview` existente via prop `api`; nova tela de "colar" é mínima |
| Auto-aprovação por score publicar mesa indesejada | **BAIXO** | Só habilitar na Fase 7; threshold 95+; feature flag desligada por padrão |
| Inbox drafts quebram rotas Discord pós-DROP NOT NULL | **ALTO** | Corrigido preventivamente: 5 guards/filtros documentados em DEB-047-05 |

## Fora de escopo

- Scraping de Discord com cookie pessoal (só como último recurso, se Bot/API não for viável)
- Publicação automática de mesas (sempre `draft`, nunca `published`)
- Alteração do fluxo Discord existente (não quebrar o que funciona)
- Renomear `discord_import_messages` → `import_messages` (Opção C antiga — risco alto, reavaliar na Fase 7)
- Integração com redes sociais específicas (Facebook, Instagram, etc.) — Fase 7
- Deploy em produção sem aprovação nominal
- Commit/push/PR sem autorização explícita
- IA como primeiro parser do anúncio inteiro (IA entra só como desempate na Fase 6)
