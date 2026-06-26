# Débitos — 048 Importador DiscordChatExporter JSON

## DEB-048-01 — JSON inválido/truncado precisa de erro amigável

- **Origem:** `spec047-backup/extracao_json2.json`
- **Severidade:** Média
- **Descrição:** O segundo arquivo real está truncado/inválido por volta da linha 3042. Importador não pode falhar com stack trace genérico nem importar parcialmente sem rastreio.
- **Ação:** Fixture negativa + teste de endpoint/serviço retornando 400 com mensagem clara.
- **Status:** aberto

## DEB-048-02 — Automação diária com DiscordChatExporter exige desenho seguro

- **Origem:** decisão de produto 2026-06-23 — DiscordChatExporter será permanente e rodará todo dia na VM.
- **Severidade:** Alta
- **Descrição:** Rodar export diário pode envolver token/cookie/credencial Discord. Não pode virar solução frágil com cookie pessoal esquecido em script.
- **Ação:** Planejar credencial, diretórios, logs, retenção, idempotência e risco/ToS antes de qualquer VM write.
- **Status:** aberto

## DEB-048-03 — Parser ainda não cobre padrões reais do JSON

- **Origem:** auditoria `extracao_json.json`
- **Severidade:** Média
- **Descrição:** Amostra real contém `<t:UNIX:...>`, Google Forms, role mentions, contato implícito por autor e formatos variados de vagas/preço. O MVP importa, persiste, deduplica e gera drafts; as tasks T-C são **Fase C (parser hardening), pós-MVP**. A perda é de qualidade de extração (falsos negativos em contato, sistema, vagas, preço), não de funcionalidade core.
- **Ação:** Implementar tasks T-C1..T-C9. Priorizar T-C1 (timestamps), T-C2 (Google Forms), T-C3 (contato), T-C6 (vagas informais) como mínimo para o JSON real não degradar.
- **Status:** **parcial (2026-06-26)** — PR-1 da Fase C implementado: T-C1 (timestamps Discord `<t:UNIX>`), T-C2 (Google Forms), T-C3 (contato implícito), T-C6 (vagas informais: `3 de 5`, `0/5`, `1 vaga via forms`, `mesa em andamento`). Regex determinístico puro, sem libs novas. Testes 237/237 ✅, lint 15/15 ✅, build ✅. Restam: T-C4 (role mentions), T-C5, T-C7, T-C8, T-C9 (fora do PR-1). Código local, não commitado.

### Análise detalhada por T-C (2026-06-23, verificado 2026-06-23)

| T-C | Padrão | Status | Arquivo/linha | Detalhes |
|-----|--------|--------|---------------|----------|
| T-C1 | Discord timestamp `<t:UNIX:F/t>` | ❌ Não implementado | `parseDiscordAnnouncement.ts` | Nenhuma regex ou parser para `<t:` existe. Amostra: 4 mensagens com esses timestamps. Perda: timestamp de data/hora não extraído. |
| T-C2 | Google Forms (`forms.gle`, `docs.google.com/forms`) | ❌ Não implementado | — | Amostra: 11 mensagens com Google Forms. Perda: link de formulário não identificado como contato/recrutamento. |
| T-C3 | Contato implícito por autor ("me mande mensagem", "me chama", "fale comigo", "este perfil") | ❌ Não implementado | `parseDiscordAnnouncement.ts:291` (`extractContactDiscord`) | Só detecta menção explícita (`<#id>`, `<@!id>`) + label contato/ticket/inscrição. Frases de contato implícito não são detectadas. |
| T-C4 | Role mentions `<@&id>` como tags/evidências brutas | ❌ Não implementado | — | Amostra: 60 mensagens com role mentions. Perda: tags/evidências de sistema ou tema não preservadas. |
| T-C5 | User mentions `<@id>` / `<@!id>` como possível contato | ⚠️ Parcial | `extractHostDiscordId` (linha 319), `extractContactDiscord` (linha 292) | Extrai como host ou contato quando combinado com labels. Não há extração genérica de menções como campo de metadados. |
| T-C6 | Vagas (`3 de 5`, `0/5`, `5 vagas`, `1 vaga via forms`, `mesa em andamento`) | ⚠️ Parcial | `extractSlots` (linha 208) | Cobre padrões estruturados ("vagas totais: N"). Não cobre padrões informais como `3 de 5`, `0/5`, `1 vaga via forms`, `mesa em andamento`. |
| T-C7 | Mesa paga/gratuita (sessão zero gratuita, custo de plataforma) | ⚠️ Parcial | `extractPrice` (linha 191) | Cobre `R$` e `gratuita`/`free`/`sem custo`. Não cobre "sessão zero gratuita" (primeira sessão grátis) ou "gratuita com custo de plataforma". |
| T-C8 | Sistema próprio/inspirado em | ❌ Não implementado | `matchSystem`/`findSystemMatch` | Só faz match por nome exato/canonical. "Sistema próprio" ou "inspirado em D&D" não são vinculados. |
| T-C9 | Attachments/embeds como evidências (link, formulário, YouTube, canonicalUrl, `.txt` complementar) | ⚠️ Parcial | `extractCoverFromAttachments` | Só extrai capa de attachments. Não extrai links de formulário/site/YouTube de embeds, nem `.txt` como material complementar, nem canonicalUrl. |

### Observações

- O Handoff #2 (`tasks.md:411-415`) recomenda implementar apenas T-C1, T-C2, T-C3, T-C6 como "mínimo necessário para o JSON real não degradar".
- T-C4, T-C8 e T-C9 podem ficar para depois do MVP sem impacto funcional.
- Risco de regressão ao implementar: médio. Adicionar parsing de padrões informais pode introduzir falsos positivos (detectar "me mande mensagem" em contexto não-recruitment) ou conflito de regex.
- Todas as T-C exigem testes com fixture real (`extracao_json.json`) antes de commit para validar matriz de acertos/erros.

## DEB-048-04 — Import runs podem precisar de auditoria própria

- **Origem:** robustez/operação permanente
- **Severidade:** Baixa/Média
- **Descrição:** MVP pode funcionar sem migration, mas operação diária permanente pode precisar rastrear arquivo, hash, contagens e erros por execução.
- **Ação:** Avaliar `discord_import_runs` após MVP upload manual.
- **Status:** aberto

## DEB-048-05 — Script DiscordChatExporter local não é desenho seguro de automação permanente

- **Origem:** diff local `apps/mesas/scripts/discord-export.sh`
- **Severidade:** Alta
- **Descrição:** O script usa `tyrrrz/discordchatexporter:latest`, recebe token por argumento CLI e grava por padrão em `/opt/artificio/exports`. Ele também documenta uso manual e “não automatizar”, o que conflita com a decisão de produto da Spec 048: evolução futura com execução diária permanente na VM.
- **Ação:** Antes de qualquer commit/VM write, decidir se o script será removido, mantido como helper manual ou redesenhado para operação diária com versão pinada, segredo fora de argv, diretórios `incoming/processed/error`, retenção e risco/ToS documentado.
- **Status:** aberto

## DEB-048-06 — Fallback DeepSeek está no diff local, mas não pertence diretamente ao importador JSON

- **Origem:** diff local `apps/mesas/backend/src/inbox/deepseek.ts` + alteração em `adminImportInbox.ts`
- **Severidade:** Média/Alta
- **Descrição:** O fallback DeepSeek envia texto bruto de anúncio para API externa quando `manual_paste` tem baixa confiança ou sem `system_id`. Isso pode ser útil para a Inbox, mas não é parte do MVP DiscordChatExporter JSON. O arquivo atual faz cast do JSON retornado sem Zod/schema forte, não tem timeout explícito e a falha é silenciosa.
- **Ação:** Reclassificar em Spec 047 ou spec própria. Se mantido: validar retorno com schema, adicionar testes, timeout, política de privacidade/logs e documentação de env `DEEPSEEK_API_KEY`.
- **Status:** **moot/fechado (2026-06-26)** — `apps/mesas/backend/src/inbox/deepseek.ts` **não existe em `origin/dev`** (experimento local nunca mergeado; decisão T-H1 = não usar IA no MVP). Reabrir como spec própria só se DeepSeek/IA voltar (Fase G T-G5 prevê IA auxiliar futura, com schema/timeout/privacidade).

## DEB-048-07 — `chrono-node`/`fuzzball` já aparecem no diff, mas precisam de matriz real

- **Origem:** diff local `parseDiscordAnnouncement.ts`, `normalizeDiscordTableDraft.ts`, `apps/mesas/backend/package.json`
- **Severidade:** Média
- **Descrição:** O parser passou a usar `chrono-node` e o match de sistemas passou a usar `fuzzball.token_sort_ratio >= 82`. Isso pode melhorar robustez, mas sem matriz de exemplos pode introduzir falso positivo de sistema, dia/hora ambíguos ou retorno declarado `quinzenal` sem implementação real.
- **Ação:** Criar testes com exemplos reais do JSON e comparar antes/depois. Ajustar threshold e regras de frequência antes de declarar ferramenta adotada.
- **Status:** **moot p/ dev (2026-06-26)** — `chrono-node`/`fuzzball` **não estão em `origin/dev`** (`apps/mesas/backend/package.json` sem essas deps; parser dev = regex puro). Experimento local descartado (T-H2 opção 1). Se a Fase C decidir adotar lib de data/fuzzy, **reabrir** com a matriz de testes exigida aqui antes de commit.

## DEB-048-08 — Playwright E2E local depende de autenticação admin não resolvida

- **Origem:** diff local `apps/mesas/frontend/e2e/` + `apps/mesas/frontend/vitest.config.ts`
- **Severidade:** Média
- **Descrição:** O smoke E2E aponta para `https://mesasbeta.artificiorpg.com` e pressupõe cookie/sessão admin válido. Sem estratégia de `storageState` segura, ele pode virar teste manual disfarçado, flaky ou dependente do Chrome/cookies reais do mantenedor. O diff também altera `vitest.config.ts` para excluir `e2e/` e `**/*.spec.ts`; hoje os testes unitários são `*.test.*`, mas esse padrão pode esconder futuros unit specs sem perceber.
- **Ação:** Definir autenticação de teste sem Chrome real; decidir se roda em CI, local ou somente smoke manual; limitar o exclude do Vitest ao diretório E2E se possível. Registrar pré-requisitos e comando real antes de fechar.
- **Status:** **moot p/ dev (2026-06-26)** — `apps/mesas/frontend/e2e/` e `@playwright/test` **não estão em `origin/dev`** (T-H3 opção 1 = remover). Smoke continua manual documentado. Reabrir só se houver estratégia de auth admin testável sem cookie pessoal.

## DEB-048-10 — Embed com campos `null` derruba import com 400 (smoke beta real)

- **Origem:** smoke real do mantenedor em `https://mesasbeta.artificiorpg.com/gestao` → Discord Sync → Importar JSON, com `D:\extracao_json.json`.
- **Severidade:** Crítica (P0) — blocker total do MVP; nenhum JSON real importa.
- **Erro exato:**
  `JSON inválido ou incompatível com o formato esperado. messages.1.embeds.0.timestamp: Invalid input: expected string, received null; messages.1.embeds.1.timestamp: ...; messages.3.embeds.0.timestamp: ...; messages.6.embeds.0.timestamp: ...`
- **Causa-raiz:** `discordChatExporterEmbedSchema` declarava campos string com `.optional()`, que em Zod aceita só `undefined`. O DiscordChatExporter emite `null` para campos de embed ausentes (`timestamp`, `image`, `description`, `url`, `color`, `thumbnail`, `footer`, `author`, `fields`). Zod rejeitava → adapter lança `DiscordChatExporterValidationError` → endpoint responde 400. Mesma classe de problema atingia campos opcionais de `author` (`color`/`nickname`/`discriminator`) e `attachment` (`fileName`/`fileSizeBytes`).
- **Interação com REV-004:** REV-004 endureceu os timestamps de **mensagem** para `z.string().datetime({ offset: true })`, correto. Mas o timestamp de **embed** é coisa distinta e o JSON real o traz como `null` — não coberto pela REV-004.
- **Ação aplicada:** campos string opcionais de embed/author/attachment migrados de `.optional()` → `.nullish()` (aceita `undefined` e `null`); `embed.image` aceita string ou `{ url }`. Mantido `.passthrough()` no topo do embed para campos extras.
- **Arquivos:** `apps/mesas/backend/src/discord/discordChatExporterTypes.ts`.
- **Teste de regressão:** `apps/mesas/backend/src/discord/__tests__/chatExporterAdapter.test.ts` (3 testes; embed com `timestamp/image/description=null` agora aceito).
- **Validação:** `pnpm --filter @artificio/mesas-backend build` ✅; test 183/183 ✅; `pnpm run lint` 15/15 ✅.
- **Status:** **fechado — em `origin/dev`** (verificado 2026-06-26: `discordChatExporterTypes.ts` tem 19 ocorrências de `nullish`). Falta só re-smoke beta (gate separado em tasks.md).

## DEB-048-11 — `GET /admin/discord-sync/settings` responde 500 no beta

- **Origem:** smoke real no beta — console: `api/v1/admin/discord-sync/settings:1 Failed to load resource: 500`.
- **Severidade:** Média — independente do importador JSON (rota é da Spec 047), mas degrada a tela Discord Sync.
- **Causa provável:** o handler (`adminDiscordSync.ts:394`) chama `decryptDiscordSetting(setting.value)`. Se a credencial no DB beta foi cifrada com um `JWT_SECRET` diferente do atual do container, o `aes-256-gcm` falha no auth-tag e lança `Error` genérico (não `DiscordSettingsSecretUnavailableError`), caindo no `catch` → 500. Hipótese alternativa: `JWT_SECRET` ausente no container beta (geraria 503, não 500) — menos provável dado o código.
- **Não é bug da 048:** `settingsCrypto.ts`/`/settings` são pré-existentes da Spec 047. Surgiu no smoke da 048.
- **Ação:** inspeção read-only no beta (sem imprimir segredo): confirmar se `discord_settings` tem linha `bot_token` e se `JWT_SECRET` do container bate com o usado na cifragem. Se mismatch de chave, decidir entre re-salvar o token (PUT) sob a chave atual ou tratar falha de decrypt como estado "is_set=false"/aviso em vez de 500. Endurecer o handler para distinguir falha de decifragem (responder 409/aviso) de erro real.
- **Status:** **fechado — em `origin/dev`** (verificado 2026-06-26: `settingsCrypto.ts` tem `DiscordSettingsDecryptError`; handler GET responde 200 com `decrypt_error: true`). **Pendente residual:** investigação read-only no beta p/ confirmar a causa real (mismatch `JWT_SECRET`) — diagnóstico, não código.

## DEB-048-12 — UI de import só aceita colar texto; falta upload de arquivo (botão + arrastar)

- **Origem:** pedido do mantenedor no smoke 2026-06-23.
- **Severidade:** Média — UX; JSONs reais são arquivos grandes (`D:\extracao_json.json`, ~100 mensagens), colar é frágil/lento.
- **Descrição:** `DiscordJsonImportPanel.tsx` hoje só tem `<textarea>` (colar JSON). Falta seletor de arquivo (`<input type="file" accept=".json,application/json">`) e/ou área de drag-and-drop que leia o arquivo via `FileReader`/`File.text()` e popule/envie o JSON ao endpoint `POST /import-json`.
- **Ação:** adicionar à aba "Importar JSON": botão "Selecionar arquivo" + dropzone arrastar-soltar; validar extensão/tamanho no cliente (alinha com DEB-048-04/T-F2 limite de upload); manter o textarea como fallback. Reaproveitar resumo pré-import (T-D2) e resultado (T-D3).
- **Status:** **fechado — em `origin/dev`** (verificado 2026-06-26; UI migrada depois p/ `FileDropzone` compartilhado de `@artificio/ui` na spec 051). **Pendente residual:** limite de upload **server-side** (hoje só cliente 10MB) → vira T-F2 na Fase F.

## DEB-048-09 — Duplicação residual de getContentHash e asJsonbArray em ingestMessages.ts

- **Origem:** REV-006 — após refatoração, `getContentHash` (3ª cópia, aceita `DiscordApiMessage`) e `asJsonbArray` ainda existem em `ingestMessages.ts:9-11` e `ingestMessages.ts:169-176`.
- **Severidade:** Baixa
- **Descrição:** `ingestMessages.ts` tem cópias de `getContentHash` e `asJsonbArray` que não foram removidas por estarem fora do escopo dos arquivos novos da spec 048. A remoção exigiria refatorar o tipo do parâmetro de `DiscordApiMessage` para aceitar um tipo unificado, ou criar um shared util.
- **Ação:** Abrir spec/débito próprio quando houver autorização para refatorar `ingestMessages.ts`.
- **Status:** implementado ✅

### Implementação — 2026-06-23

#### O que foi feito

1. **Criado `apps/mesas/backend/src/discord/shared.ts`** com:
   - `HashableMessage` — interface minimalista com `content?: string; embeds?: unknown[] | null; attachments?: unknown[] | null` (só os campos que o hash consome).
   - `getContentHash(msg: HashableMessage): string` — função genérica de hash sha256.
   - `asJsonbArray(value: unknown): JsonbArray` — função de cast JSONB.
   - `JsonbArray` — tipo exportado.

2. **`ingestMessages.ts`:**
   - Removida função local `asJsonbArray` (3 linhas) — importa de `./shared`.
   - Removida função local `getContentHash` (7 linhas + `import crypto`) — importa de `./shared`.
   - Tipo `JsonbParam` agora é alias de `JsonbArray` (do shared).

3. **`chatExporterAdapter.ts`:**
   - Removida função local `getContentHash` (7 linhas + `import crypto`) — importa de `./shared`.

4. **`chatExporterImportService.ts`:**
   - Import de `getContentHash` mudou de `./chatExporterAdapter` para `./shared`.

#### Arquivos alterados

- `apps/mesas/backend/src/discord/shared.ts` — **novo** (3 exportações: `getContentHash`, `asJsonbArray`, `JsonbArray`)
- `apps/mesas/backend/src/discord/ingestMessages.ts` — removidas funções locais, imports de `./shared`
- `apps/mesas/backend/src/discord/chatExporterAdapter.ts` — removida função local `getContentHash`
- `apps/mesas/backend/src/discord/chatExporterImportService.ts` — import de `./shared`

#### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅
- `pnpm run lint` — ✅ 15/15
- `pnpm run build` — ✅ 17/17

### Evidência

#### getContentHash

- **Arquivo/linha:** `ingestMessages.ts:169-176`
- **Tipo do parâmetro:** `DiscordApiMessage` (schema Zod inline no mesmo arquivo, linha 15-23: `id`, `content`, `timestamp`, `edited_timestamp`, `author`, `attachments`, `embeds` — sem `type`, `timestampEdited`, `callEndedTimestamp`, `isPinned`, `stickers`, `reactions`, `mentions`, `inlineEmojis`, `reference`, `forwardedMessage`)
- **Corpo:** idêntico ao do adapter (`chatExporterAdapter.ts:29-35`) — sha256(content + JSON.stringify(embeds) + JSON.stringify(attachments))
- **Referências:** 1 — `persistMessages` linha 225
- **Já existe versão exportada no adapter?** Sim — `chatExporterAdapter.ts:29` exporta `getContentHash(msg: DiscordChatExporterMessage)` com corpo idêntico.
- **Dá para tipar como tipo unificado?** `DiscordApiMessage` e `DiscordChatExporterMessage` têm overlap nos campos `id`, `content`, `attachments`, `embeds`. O hash só usa esses 3 campos. Um tipo `{ content?: string; embeds?: unknown[]; attachments?: unknown[] }` seria suficiente para ambas. Mas a assinatura atual do adapter exige `DiscordChatExporterMessage`.

#### asJsonbArray

- **Arquivo/linha:** `ingestMessages.ts:9-11`
- **Corpo:** idêntico ao que existia em `chatExporterImportService.ts:8-10` (removido no REV-006)
- **Referências:** 4 — `persistMessages` linhas 255, 256, 268, 269 (2 inserts + 2 updates)
- **Passa por `InsertRow`/`UpdateRow`:** Sim — tipos locais no mesmo arquivo (linhas 70-91)
- **Já existe versão exportada?** Não — `chatExporterImportService.ts` tinha mas foi removida (não usada após upsert raw). Não há shared util.

#### Impacto real

- **Funcional:** Nenhum. O código compila, testa e funciona. A duplicação é estrutural/de manutenção.
- **Manutenção:** Se o algoritmo de hash mudar (ex: incluir `author` no hash), precisa alterar em 3 lugares (`adapter.ts`, `ingestMessages.ts`, `chatExporterImportService.ts` — este último importa do adapter). Se `asJsonbArray` precisar de ajuste, precisa alterar em 2 lugares (`ingestMessages.ts` + qualquer futuro arquivo).

#### Risco de regressão

- **Médio.** Para eliminar a duplicação, o caminho mais simples é:
  1. Criar `apps/mesas/backend/src/discord/shared.ts` com `asJsonbArray` (export).
  2. Criar `getContentHash` genérico que aceite `{ content?: string; embeds?: unknown[]; attachments?: unknown[] }` (interface mínima) ou criar overload que aceite ambos os tipos.
  3. Atualizar imports em `ingestMessages.ts` e `chatExporterAdapter.ts`.
- Risco: mudar import em `ingestMessages.ts` quebra `persistMessages()` — função usada por `ingestMessages` e `ingestForumMessages` (2 callers externos em `adminDiscordSync.ts`). Requer smoke test manual ou confiança nos testes existentes (1 test file: `ingestMessages.test.ts`).

#### Conclusão

**Procede.** A duplicação é real. Impacto funcional zero, mas manutenção futura mais cara. Débito de baixa severidade — não justifica abrir spec SDD própria, mas deve ser resolvido junto com a próxima mexida em `ingestMessages.ts`.

## DEB-048-13 — Estratégia para anexos grandes/vídeos (T-F7)

- **Origem:** Fase F — planejamento de robustez para anexos
- **Severidade:** Baixa/Média
- **Descrição:** O importador preserva metadata de anexos no `discord_import_messages.attachments` (JSONB: `url`, `fileName`, `fileSizeBytes`, `contentType`). Não faz download nem upload para Cloudinary.
- **Decisão documentada (2026-06-26):**
  - **Imagens (capas):** download futuro via Cloudinary signed upload — apenas para extrair capa de mesa.
  - **Vídeos:** manter só URL do Discord (CDN expira). Documentar limitação.
  - **Anexos grandes:** ignorar no MVP; preservar metadata para referência do admin.
- **Ação futura:** implementar download seletivo de imagens com guarda de tamanho e retry; nunca baixar vídeos automaticamente.
- **Status:** **fechado (2026-06-26, Handoff #5)** — T-F7 implementada. `extractCoverFromAttachments` corrigida p/ fallback de extensão de `fileName` (ChatExporter não fornece `content_type`/`width`/`size`); `buildAttachmentNotes` gera notas `"Anexo: <fileName> (<tamanho>) — <url>"` para anexos não-imagem (vídeo, .txt, etc.); notas são adicionadas ao `_notes` do draft. Testes: 8 novos (png via fileName, jpg via ext, mp4 gera nota, txt gera nota, bot-fetch compat, svg ignorado, sem fileName, sem url). `fileSizeBytes` usado como fallback de tamanho. Lint ✅, build ✅, test 253/253 ✅.

## DEB-048-14 — Estratégia para replies/threads (T-F8)

- **Origem:** Fase F — o JSON real (`extracao_json.json`) tem mensagens com campo `reference` (reply).
- **Severidade:** Baixa
- **Descrição:** O DiscordChatExporter inclui replies como mensagens separadas com campo `reference.messageId` e `reference.content`.
- **Decisão documentada (2026-06-26):**
  - **Reply com conteúdo próprio:** já aparece como `message` separada no JSON → tratada como anúncio independente (comportamento atual).
  - **Reply sem conteúdo (só referência):** pode ser ignorado ou adicionado como contexto (`_notes`) da mensagem referenciada. Exemplo: `"_notes": ["Em resposta a: ..."]`.
  - **Campo `reference`:** já existe no schema Zod (`discordChatExporterReferenceSchema`) mas não é usado no pipeline atual. O adapter ignora `reference`.
- **Ação futura:** enriquecer o `ImportRawMessage` ou `_notes` com `reference` quando relevante. Não implementar agora — baixo impacto funcional.
- **Status:** 🛑 **REABERTO (revisão Claude 2026-06-26) — reply NÃO FIADO (dead code).** As peças existem (`ImportRawMessage.reference`, adapter popula, `parseDiscordAnnouncement(replyContext)`, `contentIndex` Map no service) **mas não se conectam:** (1) o `contentIndex` é criado (`service:82-85`) e **nunca lido** (`.get` não existe); (2) o `importDiscordChatExporterJson` só faz `INSERT INTO discord_import_messages` — **não** chama o parser; (3) o parse real é `utils.ts:133` `parseDiscordAnnouncement(raw, sys)` — **2 args, sem `replyContext`**. Em produção a nota "Em resposta a:" **nunca** sai. Testes verdes porque chamam o parser direto com o 3º arg (falso-verde). **Causa arquitetural:** o parse ocorre depois, a partir da linha do DB (`discord_import_messages`), onde `reference` **não é coluna** e as outras mensagens do export não estão disponíveis p/ resolver o snippet. **Correção (Handoff #7):** ou (a) resolver o reply no momento do parse-batch consultando `discord_import_messages` por `reference.messageId` (exige persistir `reference` → migration → fora de escopo sem aprovação), ou (b) **escopo realista agora:** remover o `contentIndex` morto e marcar T-F8 como **adiada** (precisa migration p/ persistir `reference`), mantendo só o campo no tipo. Decidir com o mantenedor. → ⏸️ **RESOLVIDO POR ADIAMENTO (Claude 2026-06-26):** opção (b). `contentIndex` morto removido do `chatExporterImportService` (comentário explica o porquê); `reference` em `ImportRawMessage` + adapter + `replyContext` no parser **mantidos** como base future-ready (custo zero). **T-F8 ADIADA** — nota "Em resposta a:" só sai depois de migration que persista `reference` em `discord_import_messages` + resolução no parse-batch. Testes unit do `replyContext` mantidos (param funciona). Build/test 253/253/lint ✅.

## DEB-048-15 — Mapa de campos para metadata (T-F9)

- **Origem:** Fase F — o JSON do DiscordChatExporter contém campos ricos que o draft ignora.
- **Severidade:** Baixa
- **Descrição:** O export contém campos que não são extraídos para o `DiscordTableDraftTable`:
  - `guild.name`, `guild.iconUrl` — nome e ícone do servidor
  - `channel.category`, `channel.topic` — categoria e tópico do canal
  - `mentions` (por mensagem) — menções a usuários, roles, canais
  - `inlineEmojis` — emojis inline no texto
  - `reactions` — reações à mensagem
  - `reference` — reply/referência
- **Decisão documentada (2026-06-26):**
  - **Sem migration agora:** adicionar campos ao schema do DB exigiria migration — fora do escopo da 048.
  - **Opção conservadora (recomendada):** extrair metadados do `exportData` no serviço ANTES do loop e guardar em `_notes` do draft (array de strings) ou criar campo `metadata` JSONB opcional no futuro.
  - **Mapeamento sugerido:**
    1. `guild.name` → `_notes`: `"Servidor: Nome do Servidor"`
    2. `guild.iconUrl` → `_notes`: `"Ícone do servidor: URL"`
    3. `channel.category` → `_notes`: `"Categoria: Nome da Categoria"`
    4. `channel.topic` → `_notes`: `"Tópico do canal: ..."` (se relevante)
    5. Por mensagem: `mentions`, `inlineEmojis` → podem ser preservados no `_notes` ou ignorados.
- **Ação futura:** quando houver migration de metadata, criar campo `metadata` JSONB no `DiscordTableDraftTable`; o parser pode popular com esses campos sem alterar a estrutura principal.
- **Status:** aberto

---

## DEB-048-16 — Guard "mesa em andamento" bloqueia parser de vagas explícitas (REV-007)

- **Origem:** REV-007 (@chatgpt-codex-connector, 2026-06-26)
- **Severidade:** Média (P2)
- **Descrição:** `extractSlots()` em `parseDiscordAnnouncement.ts:251` testa `\bmesa\s+em\s+andamento\b` **antes** de testar `N vaga via forms` (linha 256). Se o texto contém ambas as frases, o guard retorna `{ total: null, open: null }` e o parser de vagas explícitas nunca é alcançado. O draft perde a informação real de vagas.
- **Ação:** Reordenar `extractSlots`: testar todos os padrões explícitos de vaga (`N vaga via forms`, `X de Y`, `N vagas`, etc.) **antes** do guard "mesa em andamento". O guard só deve ser aplicado como fallback quando nenhum padrão explícito casar.
- **Status:** **fechado (2026-06-26, Handoff #6)** — `extractSlots` reordenado: 7 padrões explícitos testados antes do guard "mesa em andamento", que agora fica na posição 8 como fallback. Se há menção explícita de vagas, o guard não bloqueia.

## DEB-048-17 — Filtro de status no /reparse bloqueia mensagens já parseadas (REV-008)

- **Origem:** REV-008 (@chatgpt-codex-connector, 2026-06-26)
- **Severidade:** Média (P2)
- **Descrição:** `POST /import-json/reparse` (`import.ts:47`) filtra `status IN ('pending', 'needs_review')`. Mensagens processadas com sucesso têm `status = 'parsed'` e são excluídas da query, mesmo quando explicitamente solicitadas via `messageIds`. O endpoint retorna zero resultados, impedindo reaplicar hardenings do parser em imports existentes — o caso de uso principal.
- **Ação:** Quando `messageIds` é fornecido explicitamente, remover ou relaxar o filtro de status (ex.: incluir `'parsed'`). Manter o filtro original quando `messageIds` não é fornecido. O guard `message.status === 'synced'` dentro do loop (linha 65) já protege contra reprocessar mensagens synced.
- **Status:** 🛑 **REABERTO (revisão Claude 2026-06-26) — fix INEFICAZ.** A implementação manteve o `.where('status','in',['pending','needs_review'])` da query base (`import.ts:64`) e **adicionou** um 2º `.where('status','in',['pending','needs_review','parsed'])`. Kysely **ANDeia** cláusulas `.where()` → interseção = `pending,needs_review` → **`parsed` continua excluído**. Testes verdes porque não cobriram `status='parsed' + messageIds`. **Correção (Handoff #7):** lista de status condicional numa única cláusula — `const statuses = (messageIds && messageIds.length) ? ['pending','needs_review','parsed'] : ['pending','needs_review']`, sem o segundo `.where` de status. (`ignored` no retorno ✅ mantido.) → ✅ **CORRIGIDO (Claude 2026-06-26):** status agora é ternário inline numa única cláusula `.where('status','in', ...)`; 2º `.where` de status removido. Build/test 253/253/lint ✅.

## DEB-048-18 — extractDiscordTimestamp usa UTC sem ajuste de fuso (REV-009)

- **Origem:** REV-009 (@coderabbitai, 2026-06-26)
- **Severidade:** Baixa (Minor)
- **Descrição:** `extractDiscordTimestamp()` (`parseDiscordAnnouncement.ts:356-358`) usa `getUTCDay()`/`getUTCHours()`/`getUTCMinutes()` para extrair `day_of_week` e `start_time` de timestamps Discord `<t:UNIX>`. Como a maioria dos anúncios está em fuso brasileiro (UTC-3), o horário fica 3h adiantado e o dia da semana pode cruzar a meia-noite. O admin precisa corrigir manualmente.
- **Ação:** Escolher uma das opções: (a) aplicar offset UTC-3 fixo (`date.getTime() - 3*3600*1000` → `new Date(adjusted)`) antes de extrair dia/hora; (b) documentar no `_notes` que o valor é UTC; (c) usar `getDay()`/`getHours()` se o ambiente de execução estiver em fuso BR. Recomendação: opção (a) com constante de offset, que é previsível e não depende do ambiente.
- **Status:** 🛑 **REABERTO (revisão Claude 2026-06-26) — fuso OK, mas introduz inconsistência de formato.** `Intl.DateTimeFormat('pt-BR', { weekday:'long' })` retorna `"segunda-feira"`, `"terça-feira"`, …, mas o canônico do projeto (`extractDayOfWeek`, `:325`) é a forma **curta** `"segunda"`, `"terça"`, … (sem `-feira`). Como `:557` prefere `discordTs?.dayOfWeek`, o `day_of_week` vira `"segunda-feira"` quando há `<t:UNIX>` → diverge da validação/display do resto. Sábado/domingo coincidem por acaso (sem `-feira`); seg–sex quebram. **Correção (Handoff #7):** mapear o weekday do Intl para a forma curta canônica (ex.: `.replace(/-feira$/,'')`) ou reusar a tabela `days` de `extractDayOfWeek`. (Fuso América/São_Paulo ✅ mantido.) → ✅ **CORRIGIDO (Claude 2026-06-26):** `weekday.toLowerCase().replace(/-feira$/,'')` → `"segunda"`/`"terça"`/…; sábado/domingo inalterados. Teste de timestamp ajustado p/ esperar `'sexta'` (codificava o bug). Build/test 253/253/lint ✅.

## DEB-048-19 — Falta Array.isArray em messageIds de payload externo (REV-010)

- **Origem:** REV-010 (@coderabbitai, 2026-06-26)
- **Severidade:** Média (Major) — viola regra pétrea de normalização
- **Descrição:** `POST /import-json/reparse` (`import.ts:41-51`) recebe `messageIds` de `req.body` e acessa `.length` sem `Array.isArray`. Uso de `as any` na cláusula SQL `IN`. Um payload `messageIds: "abc"` (string) passa no check `.length > 0` e gera SQL inválido. Viola regra pétrea: "É proibido usar `.length` sobre payload externo sem `Array.isArray`".
- **Ação:** Adicionar validação: `Array.isArray(messageIds) && messageIds.length > 0 && messageIds.every(id => typeof id === 'string')`. Remover `as any`. Se inválido, retornar 400. Opcional: migrar a rota para usar schema Zod.
- **Status:** **fechado (2026-06-26, Handoff #6)** — validação `Array.isArray(messageIds)` + `every(id => typeof id === 'string')` adicionada em `import.ts`; payload inválido retorna 400. `as any` removido da cláusula SQL `IN`.

## DEB-048-20 — Catch interno do /reparse pode abortar lote se DB falhar (REV-011)

- **Origem:** REV-011 (@coderabbitai, 2026-06-26)
- **Severidade:** Baixa (Minor)
- **Descrição:** O `catch` do loop de reparse (`import.ts:124`) executa `await db.updateTable(...).execute()` para marcar erro. Se essa query falhar (DB indisponível), o erro escapa para o `catch` externo (linha 140) → 500 → lote inteiro abortado. Além disso, `parse_error: 'Erro no reparse em lote'` descarta a causa real.
- **Ação:** Envolver o `db.updateTable` do catch em `try/catch` próprio. Se falhar, logar o erro real e continuar o loop. Preservar a mensagem de erro original em `parse_error` (ex.: `error instanceof Error ? error.message : 'unknown error'`).
- **Status:** **fechado (2026-06-26, Handoff #6)** — `db.updateTable` do catch interno agora tem `try/catch` próprio; falha de DB loga e continua loop sem abortar lote. `parse_error` preserva a causa real (`error instanceof Error ? error.message : 'Erro desconhecido'`).

## DEB-048-21 — Duplicação de boilerplate de handler em import.ts (REV-012)

- **Origem:** REV-012 (@coderabbitai, 2026-06-26)
- **Severidade:** Baixa (Info)
- **Descrição:** SonarCloud/CodeRabbit reportam 32.4% de linhas duplicadas no `/reparse` (`import.ts:38-144`) vs `POST /` (`import.ts:10-36`). A sobreposição é **boilerplate estrutural** de handler Express (try/catch + `console.error` + `res.status(500)` + envelope `{ data: { ... } }`); a lógica de negócio dos dois é distinta. Métrica inflada por o `/reparse` ser curto.
- **Verificação (código é a verdade, 2026-06-26):** confirmado — ambos os handlers repetem o padrão de catch/envelope. O grosso do `/reparse` (loop L62-131, reconcile de drafts) é único.
- **Ação:** Extrair um helper de resposta de erro compartilhado (ex.: `respondImportError(res, error)` que mapeia `DiscordChatExporterValidationError`→400, senão loga `error.message` + 500). Opcional: helper de envelope `{ data }`. **Não** sobre-abstrair a lógica de negócio — só o boilerplate.
- **Ordem:** fazer **por último** no PR-4, **depois** dos fixes REV-008/010/011, que vão remodelar o `/reparse` (evita retrabalho/churn).
- **Status:** **fechado (2026-06-26, Handoff #6)** — helper `respondImportError(res, error)` extraído e aplicado nos dois handlers (`POST /` e `POST /reparse`). Mapeia `DiscordChatExporterValidationError`→400 com mensagem; demais erros logam e retornam 500 com envelope `{ data: { error } }`.
