# Débitos — 048 Importador DiscordChatExporter JSON

## DEB-048-01 — JSON inválido/truncado precisa de erro amigável

- **Origem:** `spec047-backup/extracao_json2.json`
- **Severidade:** Média
- **Descrição:** O segundo arquivo real está truncado/inválido por volta da linha 3042. Importador não pode falhar com stack trace genérico nem importar parcialmente sem rastreio.
- **Ação:** Fixture negativa + teste de endpoint/serviço retornando 400 com mensagem clara.
- **Status:** ✅ **FECHADO (2026-06-26, Handoff #7).** Test-only (sem mudança de runtime). 3 fixtures negativas sintéticas em `chatExporterSample.ts` (`truncatedJsonString`, `exportWithoutGuild`, `exportWithNonArrayMessages` — sem dados reais; `extracao_json2.json` NÃO commitado). 6 testes novos cobrindo os 2 modos de falha: (1) string truncada/malformada → `extractJsonPayload` retorna `{status:400, error:"…não é um JSON válido"}` (`chatExporterImportService.test.ts`); (2) schema inválido (sem `guild`, `messages` não-array) → `parseDiscordChatExporterJson` lança `DiscordChatExporterValidationError` (`chatExporterAdapter.test.ts`). Privacidade verificada: mensagem de erro **não** vaza payload cru nem stack trace. Test 261/261 ✅, build ✅, lint 15/15 ✅.

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
- **Status:** **parcial (2026-06-26)** — PR #98 (Fase C, merged em `dev`) implementou: T-C1 (timestamps Discord `<t:UNIX>`), T-C2 (Google Forms `forms.gle`/`docs.google.com/forms`), T-C3 (contato=autor fallback, substituindo `detectImplicitContact`), T-C6 (vagas informais: `3 de 5`, `0/5`, `1 vaga via forms`, `mesa em andamento` como fallback). Regex determinístico puro, sem libs novas. Restam: T-C4 (role mentions), T-C5 (user mentions genérico), T-C7 (preço: sessão zero gratuita, custo de plataforma), T-C9 (attachments/embeds como evidências). T-C8 replanejado → DEB-048-27 (sistema próprio → descartar, não extrair).

### Análise detalhada por T-C (auditoria 2026-06-23; **atualizado 2026-06-26** — código verificado contra `origin/dev` pós-PR #98)

| T-C | Padrão | Status | Arquivo/linha | Detalhes |
|-----|--------|--------|---------------|----------|
| T-C1 | Discord timestamp `<t:UNIX:F/t>` | ✅ Implementado (PR #98) | `parseDiscordAnnouncement.ts:384` (`extractDiscordTimestamp`), usado em `:636` | Regex `/<t:(\d+):[a-zA-Z]+>/` → `new Date(unix*1000)` → dia PT (curto, sem `-feira`) + `HH:MM` com fuso `America/Sao_Paulo`. Preferido sobre `extractDayOfWeek`/`extractStartTime` quando presente. |
| T-C2 | Google Forms (`forms.gle`, `docs.google.com/forms`) | ✅ Implementado (PR #98) | `parseDiscordAnnouncement.ts:640-643` | Regex captura ambos os domínios; prioridade sobre `extractContactUrl` genérica (URL do form vira `contact_url`). |
| T-C3 | Contato implícito por autor | ✅ Substituído por **DEB-048-26** | `parseDiscordAnnouncement.ts:648-656` | Abordagem antiga (`detectImplicitContact` com frase-gatilho "me chama"/"fale comigo") **removida**. Nova abordagem: **contato = autor do Discord** sempre que não há `contactUrl` nem menção explícita. Autor também vira `hostDiscordId` se vazio. |
| T-C4 | Role mentions `<@&id>` como tags/evidências brutas | ❌ Não implementado | — | Amostra: 60 mensagens com role mentions. Perda: tags/evidências de sistema ou tema não preservadas. Fora do PR #98. |
| T-C5 | User mentions `<@id>` / `<@!id>` como possível contato | ⚠️ Parcial | `extractHostDiscordId`, `extractContactDiscord` | Extrai como host ou contato quando combinado com labels. Não há extração genérica de menções como campo de metadados. Fora do PR #98. |
| T-C6 | Vagas (`3 de 5`, `0/5`, `5 vagas`, `1 vaga via forms`, `mesa em andamento`) | ✅ Implementado (PR #98) | `parseDiscordAnnouncement.ts:338-350` (`extractSlots`) | 7 padrões explícitos (`slotsViaForms`, `slotsXdeY`, `slotsTotalOpen`, `slotsAmbiguousSlash`, `slotsLabeled`, `slotsSlashVagas`, `slotsNVagas`) testados **antes** do fallback `null/null`. "Mesa em andamento" sem outro padrão → `null/null` (sem fabricar número). DEB-048-16: reordenado (explícitos primeiro, guard por último). |
| T-C7 | Mesa paga/gratuita (sessão zero gratuita, custo de plataforma) | ⚠️ Parcial | `extractPrice` (`:191`) | Cobre `R$` e `gratuita`/`free`/`sem custo`. Não cobre "sessão zero gratuita" (primeira sessão grátis) ou "gratuita com custo de plataforma". Fora do PR #98. |
| T-C8 | Sistema próprio/autoral → **DESCARTAR** | 🔁 Replanejado → **DEB-048-27** | `parseDiscordAnnouncement.ts:571` (`isHomebrewSystem`), `:601-603` | Decisão mantenedor 2026-06-26: sistema próprio/autoral/homebrew **não vira mesa** (parse → `null` → `ignored`). Regex sobre hint de sistema (não corpo inteiro). "inspirado/baseado em <conhecido>" = ponto de decisão (default: não descartar). Ver DEB-048-27. |
| T-C9 | Attachments/embeds como evidências (link, formulário, YouTube, canonicalUrl, `.txt` complementar) | ⚠️ Parcial | `extractCoverFromAttachments`, `buildAttachmentNotes` | Cobre capa por extensão de `fileName` (DEB-048-13) + notas p/ anexos não-imagem (`.mp4`, `.txt`, etc.). Não extrai links de formulário/site/YouTube de embeds, nem canonicalUrl. Fora do PR #98. |

### Observações

- T-C1/C2/C3/C6 implementados no PR #98 (merged em `dev`, commit `440aa2a`). Código verificado em 2026-06-26.
- T-C4 (role mentions), T-C5 (user mentions genérico), T-C7 (preço avançado), T-C9 (embeds como evidência) permanecem **não implementados** — débitos de qualidade, não bloqueiam MVP.
- T-C3 original (frase-gatilho) foi substituído por abordagem mais abrangente (DEB-048-26): autor sempre vira contato fallback, eliminando falsos negativos.
- Risco de regressão ao implementar os restantes: médio. Adicionar parsing de padrões informais pode introduzir falsos positivos.
- Todas as T-C implementadas têm testes com fixture `chatExporterSample.ts` cobrindo matriz de acertos/erros.

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

  → ✅ **REIMPLEMENTADA COM MIGRATION (DeepSeek, revisada Claude 2026-06-26):** seguiu a **opção (a)**. `migration_130_discord_reference.sql` (`@class: online-safe`, `ADD COLUMN reference JSONB` nullable, idempotente) persiste `reference`. `chatExporterImportService` grava `reference` no INSERT + ON CONFLICT (com `reference IS DISTINCT FROM` no WHERE de reparse). `db/types.ts` ganhou a coluna. Resolução no parse: helpers `buildContentIndex`/`resolveReplyContext` em `utils.ts`, usados em **parse-batch** e **/reparse**; `parseDiscordMessage` lê `reference` da linha do DB e passa `replyContext`. Fiação end-to-end verificada — não é mais código morto. **Limitação conhecida:** `contentIndex` é por lote → reply a mensagem fora do batch atual não resolve (órfão → sem nota); aceitável (alvo+reply costumam vir juntos). Build ✅, test **255/255** ✅, lint ✅. **⚠️ Aplicar a migration_130 em beta/prod exige aprovação nominal no deploy (guard online-safe spec 050).**

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

## DEB-048-22 — Loop de processamento mensagem→draft duplicado entre /reparse e parse-batch (SonarCloud)

- **Origem:** SonarCloud (New Code) — `import.ts` **24.8%** linhas duplicadas (após T-F8 fazer os dois loops crescerem). Distinto do DEB-048-21 (que era só o boilerplate catch/envelope).
- **Severidade:** Baixa (Info)
- **Descrição:** O loop do `/reparse` (`import.ts`) e o do `parse-batch.ts` repetiam ~45 linhas idênticas: `parseDiscordMessage` → reconcilia draft terminal → upsert em `discord_import_table_drafts` → atualiza status da mensagem → `ensureSystemSuggestionForDraft`. Diferiam só nos contadores (`succeeded/failed` vs `reparsed/ignored/errors`) e na política de catch.
- **Status:** ✅ **CORRIGIDO (Claude 2026-06-26).** Extraído `processDiscordMessageToDraft(message, systems, replyContext, userId): 'parsed'|'ignored'|'reconciled'` em `utils.ts`. Ambos os handlers chamam o helper e mapeiam o `DiscordDraftOutcome` para seus próprios contadores; cada um mantém sua própria política de catch (parse-batch: genérico; /reparse: catch interno DEB-048-20). Comportamento idêntico. ~45 linhas duplicadas eliminadas de cada caller. Build ✅, test **255/255** ✅, lint ✅.

## DEB-048-23 — Schema Zod rejeitava reference.guildId null + forwardedMessage sem author (smoke beta)

- **Origem:** smoke beta do mantenedor (2026-06-26) com `extracao_json.json` real. `POST /import-json/preview` → 400.
- **Severidade:** Alta (bloqueava import real no beta).
- **Evidência:** `messages.55.reference.guildId: Invalid input: expected string, received null` + `messages.55.forwardedMessage.author: expected object, received undefined`. ChatExporter emite `null` onde o schema exigia `string`/objeto (mesma classe do DEB-048-10).
- **Status:** ✅ **CORRIGIDO (Claude 2026-06-26, esta PR).** `discordChatExporterTypes.ts`: `reference.channelId/guildId` + `forwardedMessage.content/author` (e `author.name`) → `.nullish()`. `chatExporterAdapter.ts`: coage `null`→`undefined` em channelId/guildId (contrato `ImportRawMessage.reference` não aceita null). Teste de regressão em `chatExporterAdapter.test.ts`. build/test 262/262/lint ✅.
- **Eval de QUALIDADE local (parse+normalize, sem DB), `extracao_json.json` real — 2026-06-26:**
  - 100 mensagens → **99 drafts** (1 null: a única que não é anúncio — reply "boa noite, fiquei interessado!").
  - Preenchimento de campos: **system_hint 95/99 · dia 85 · horário 72 · vagas 84 · contato 20 · preço pago 37**.
  - Confidence: 85 em 0.7–1, 13 em 0.5–0.7, 1 em 0.3–0.5.
  - "Mesa forte" (título + dia|vagas|contato): **96/99**. Ruído óbvio: **1**.
  - ⚠️ **status: 99/99 `needs_review`** (nenhuma `ready`). Causa dominante: **contato faltando em 79/99** (só 20 têm: forms=11, url/discord=9) → `missingFields` sempre inclui `contact_url` → nunca fica `ready`. Ver **DEB-048-26** (fallback contato=autor) — resolve a maioria.
  - ⚠️ Não é medida de **acerto** (sem ground-truth rotulado); é taxa de extração + confiança. O acerto fino (sistema certo, dia certo) precisa de revisão humana amostral.
  - **2ª amostra `exemplo26.06.json` (2026-06-26) confirma o padrão:** 100/100 drafts, system 94 · dia 87 · hora 70 · vagas 72 · **contato 30** · 100/100 `needs_review`. Mesmo gargalo de contato → DEB-048-26 é a alavanca.

## DEB-048-24 — Import por ARQUIVO injeta o JSON inteiro na textarea e trava o PC (perf/UX)

- **Origem:** smoke beta do mantenedor (2026-06-26).
- **Severidade:** Alta (UX/perf — arquivos grandes deixam o navegador/PC super lento).
- **Evidência / causa-raiz (verificada no código):**
  - `useJsonImport.ts:118` `handleFileSelect` → `file.text()` → `setRawJson(content)` → `<FileDropzone value={rawJson}>` → `<textarea>` com 500KB+ de JSON cru → render travado.
- **Decisão do mantenedor (2026-06-26):**
  - Arquivos **< 50KB**: fluxo original (`file.text()` → textarea) — preservado, funciona bem para pequenos.
  - Arquivos **≥ 50KB**: backend puro (FormData → multer em memória → processa → descarta), igual sites que convertem imagem. **Nunca** `file.text()`, **nunca** vira string no estado React, **nunca** vai para textarea.
  - **NENHUM bloqueador novo de tamanho** — o ponto é fazer funcionar sem travar, não proibir arquivos grandes.
  - **NENHUMA duplicação** de código — helpers extraídos e compartilhados.
- **Implementação (DeepSeek 2026-06-26):**
  - **Backend:**
    - `chatExporterImportService.ts`: `+buildPreviewFromExport()` (~12 linhas, extraído para evitar duplicação entre `/preview` e `/preview/file`).
    - `preview.ts`: `+POST /preview/file` (multer `memoryStorage`, buffer → JSON.parse → `buildPreviewFromExport`). `jsonFileUpload` exportado para reuso. Handler existente `/preview` refatorado para usar `buildPreviewFromExport`.
    - `import.ts`: `+POST /file` (importa `jsonFileUpload` de preview.ts, buffer → JSON.parse → `importDiscordChatExporterJson`).
  - **Frontend:**
    - `discordSyncApi.ts`: `+previewFile(file)` / `+importFile(file)` (FormData, `fetch` com `credentials: 'include'`). Schemas Zod extraídos (`parseImportResult`/`parsePreviewResult`) — 1 definição, 2 usos cada.
    - `useJsonImport.ts`: threshold `FILE_TEXTAREA_THRESHOLD = 50 * 1024`. `handleFileSelect`/`handleDrop`: se <50KB → `file.text()` → textarea (original); se ≥50KB → `setSelectedFile(file)` + `previewForFile(file)` (backend). `handleSubmit` condicional: `selectedFile` → `importFile()`, senão → `importJson()`.
    - `DiscordJsonImportPanel.tsx`: quando `selectedFile`, mostra chip (📄 nome · tamanho · contagem) e esconde textarea. Botão "Selecionar arquivo" vira "Trocar arquivo" quando há arquivo selecionado.
  - **Validação:** build (backend + frontend) ✅, lint 15/15 ✅, testes backend 263/263 ✅, testes frontend 163/163 ✅.
- **Critério de aceite:** ✅ importar `extracao_json.json` (500KB) por arquivo **não** trava o navegador (vai como FormData, sem tocar textarea). Preview mostra resumo. Import funciona. Arquivo não fica em disco (multer `memoryStorage`, buffer descartado após resposta).
- **Anchors:** `chatExporterImportService.ts` (`buildPreviewFromExport`), `preview.ts` (`/preview/file`, `jsonFileUpload`), `import.ts` (`/file`), `discordSyncApi.ts` (`previewFile`/`importFile` + `parseImportResult`/`parsePreviewResult`), `useJsonImport.ts` (threshold + `selectedFile` + `previewForFile`), `DiscordJsonImportPanel.tsx` (chip condicional).
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).**

## DEB-048-25 — UX fragmentada: import JSON (uma aba) vs paste manual na Inbox (outra) — repensar fluxo

- **Origem:** smoke beta do mantenedor (2026-06-26).
- **Severidade:** Média (UX / Heurísticas de Nielsen — consistência, reconhecimento, visibilidade).
### Mapeamento COMPLETO do estado atual (investigado 2026-06-26)

`GestaoPage.tsx` (`activeTab`) → 7 abas-topo: `crud` · `systems` · `activity` · `hydration` · **`discord`** · **`inbox`** · `dev`. As duas que importam mesas:

- **Aba "Discord Sync"** (`DiscordSyncPanel.tsx`) → 5 sub-abas:
  1. **Configuração** (`DiscordSettingsPanel`) — token/credencial do bot
  2. **Fontes** (`DiscordSourceList`) — canais Discord p/ fetch via bot
  3. **Mensagens** (`MessagesToolbar`+lista) — mensagens cruas buscadas pelo bot
  4. **Drafts** (`DiscordDraftReviewTable`) — revisão dos drafts de origem Discord
  5. **Importar JSON** (`DiscordJsonImportPanel`) — import do DiscordChatExporter (arquivo/paste) → `/import-json[/preview|/file]`
- **Aba "Inbox"** (`InboxPanel.tsx`) → 2 sub-abas:
  1. **Importar** (`TextPasteArea`) — colar UM anúncio → `routes/inbox/import.ts` `POST /import-text`
  2. **Drafts** (`InboxDraftReviewTable`) — revisão dos drafts de origem manual

**Achado-chave:** os drafts dos dois caminhos vivem na **MESMA tabela** `discord_import_table_drafts` (distintos por `discord_message_id` vs `import_message_id`; correção unificada já existe em `registerDraftCorrection`, utils.ts). A separação é **só de UI** — há **2 telas de import** e **2 tabelas de review** para o mesmo conceito.

### Problemas (Nielsen / ISO 9241-11)
- **Consistência & padrões:** dois "Importar" e dois "Drafts" em lugares diferentes; nomes técnicos ("Discord Sync", "Inbox") em vez de orientados à tarefa.
- **Reconhecimento > recordação:** admin tem de lembrar qual aba para qual origem.
- **Visibilidade do estado:** fila de revisão partida em 2 tabelas → sem visão única do que falta revisar.
- **Eficiência (ISO):** 3 caminhos de ingestão (bot fetch, ChatExporter JSON, paste manual) sem hub comum.

### Proposta de UX unificada (a validar com wireframe ANTES de código)
- **Um hub "Importar Mesas"** (orientado à tarefa) com **seletor de origem**:
  1. **Arquivo DiscordChatExporter** (JSON) — upload efêmero (DEB-048-24)
  2. **Colar texto** (um anúncio manual) — substitui a aba Inbox/Importar
  3. **Discord bot** (Fontes/Mensagens/Configuração) — mantido como modo "avançado/bot"
  4. **[futuro] Job VM** (Fase E)
- **Uma fila única "Revisar Drafts"** — funde `DiscordDraftReviewTable` + `InboxDraftReviewTable` numa tabela só, com **badge/filtro de origem** (`chatexporter-json` · `manual-paste` · `discord-bot`) e as mesmas ações (aprovar/rejeitar/corrigir/sync). Dado já está numa tabela só → baixo risco.
- **Tela de resultado do import** mostra os contadores do DEB-048-27: **N válidos · N descartados (autoria) · N inválidos**.

### Fases de implementação (baixo risco → maior)
1. **Fase 1 — fila de drafts unificada.** Fundir as 2 review tables numa só com badge+filtro de origem. Maior ganho de consistência; dado já compartilhado. (anti-regressão: `manual_paste` 047/T-F10.)
2. **Fase 2 — hub de import com seletor de origem.** Unir "Importar JSON" + "Importar (paste)" numa tela só com seletor; mover config/fontes/mensagens do bot p/ "avançado".
3. **Fase 3 — resultado com contadores** (válidos/descartados/inválidos) integrado ao DEB-048-27.

### Regras
- **NÃO implementar sem wireframe aprovado pelo mantenedor** (entregável intermediário obrigatório).
- Preservar `manual_paste` (anti-regressão 047/T-F10) e o fluxo do bot.
- Avaliar cada fase contra Nielsen + ISO 9241-11 (checklist na sessão).

- **Anchors:** `GestaoPage.tsx` (abas `discord`/`inbox`); `features/discord-sync/components/{DiscordSyncPanel,DiscordJsonImportPanel,DiscordDraftReviewTable}.tsx`; `features/inbox/components/{InboxPanel,TextPasteArea,InboxDraftReviewTable}.tsx`; backend `routes/discord/{import,preview}.ts` + `routes/inbox/import.ts`; tabela `discord_import_table_drafts`.
- **Status:** aberto — **planejamento pronto (2026-06-26)**; próximo passo = **wireframe** antes de qualquer código. NÃO implementado.

## DEB-048-26 — Contato deve cair no AUTOR do Discord quando não há contato explícito (qualidade)

- **Origem:** smoke beta + decisão do mantenedor (2026-06-26): *"quando não tem contato, é o user do discord"*.
- **Severidade:** Média-Alta (qualidade de extração — sem isso, 79/99 drafts ficam sem contato e **100% caem em `needs_review`**).
- **Evidência (código):** `parseDiscordAnnouncement.ts:602-606` — hoje o autor só vira **`hostDiscordId`** e **apenas** quando `detectImplicitContact(body)` casa frases específicas ("me chama" etc.); **nunca** popula `contact_discord`. `:619` empurra `contact_url` para `missingFields` quando não há `contactUrl` nem `contactDiscord`. Resultado no eval real: contato em só 20/99.
- **Regra a implementar:** se **não houver contato explícito** (`!contactUrl && !contactDiscord`) e existir `message.discord_author_id`/`discord_author_name`, então **`contact_discord = autor`** (id e/ou nome). Assim todo anúncio tem ao menos o contato do autor (que é quem publicou a mesa).
  - Ajustar `missingFields` (`:619`): com o fallback, `contact` deixa de ser "missing" quando há autor → muitos drafts passam de `needs_review` → `ready` (quando os demais campos estiverem ok).
  - Manter precedência: contato explícito (forms/url/menção) > autor (fallback).
  - Substitui/engloba a heurística T-C3 atual (`detectImplicitContact` + `hostDiscordId`): autor passa a ser sempre o fallback de contato, não só com frase-gatilho.
- **Anchor:** `apps/mesas/frontend`? NÃO — backend `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:597-639` (montagem de `contactUrl`/`contactDiscord`/`missingFields`/`table`).
- **Teste:** rodar o eval nos 2 arquivos de `temp/` (`extracao_json.json` e `exemplo26.06.json`) — contato deve ir de **20/30** para **~100%**; conferir queda de `needs_review`. Mensagem sem contato explícito + autor → `contact_discord = autor`, `contact` não em `missingFields`; mensagem com forms → mantém forms (autor não sobrescreve).
- **Status:** ✅ **IMPLEMENTADO (Claude 2026-06-26).** `parseDiscordAnnouncement.ts:587-596`: `contactDiscord = explicitContactDiscord ?? (!contactUrl ? (discord_author_name ?? discord_author_id) : null)`. `detectImplicitContact` (frase-gatilho T-C3) removida — autor é o fallback sempre. `missingFields` não inclui `contact_url` quando há autor. **Validado nos 2 arquivos de `temp/`:** contato **20→99/99** e **30→100/100**. Testes: contato=autor + precedência forms>autor. build/test 263/263/lint ✅. **Nota:** no eval offline o status segue `needs_review` porque `systems=[]` (sem DB → `system_id` nunca casa); em produção (systems do DB) drafts completos viram `ready`.

## DEB-048-27 — T-C8 (replanejado): sistema próprio/autoral → DESCARTAR (não importar)

- **Origem:** decisão do mantenedor (2026-06-26): *"sistema próprio autoral é descartado"*. Substitui o plano antigo do T-C8 (que era "tratar como sistema válido"). A plataforma só lista mesas de sistemas conhecidos — anúncio de sistema próprio/autoral/homebrew **não vira mesa**.
- **Severidade:** Média (qualidade — remove ruído do import; ~13% dos drafts).
- **Evidência (eval `temp/`):** hint "Próprio/Sistema Próprio/autoral/homebrew" em **14/99** (`extracao_json.json`) e **12/100** (`exemplo26.06.json`). Hoje viram draft com `unmatched_hint` → `needs_review` (ruído que o admin tem de rejeitar à mão).
- **Regra a implementar:** quando o **sistema** do anúncio é próprio/autoral/homebrew, `parseDiscordAnnouncement` retorna **`null`** → o pipeline marca a mensagem como **`ignored`** (descartada, sem draft).
- **ETAPAS (planejamento; implementar quando autorizado):**
  1. **Detector preciso** (novo helper): regex sobre o **hint de sistema** (não o corpo inteiro, p/ evitar falso descarte): `/\b(sistema\s+)?(pr[óo]prio|autoral|homebrew)\b/i`. Casa "Sistema: Próprio", "Sistema Próprio", "autoral", "homebrew".
  2. **Ponto de descarte:** em `parseDiscordAnnouncement.ts` logo após calcular `systemHint` (~L552), **antes** de montar o draft: `if (isHomebrewSystem(systemHint)) return null;`. Conferir também `explicitSystem` (campo "Sistema:") explicitamente.
  3. **Precisão (anti-falso-descarte):** só descartar quando o sinal está no **campo/hint de sistema** (ex.: `Sistema: Próprio`, hint antes do `:` no thread name). **Não** descartar por menção solta no corpo (ex.: "uso mapas próprios", "material autoral de apoio") — isso é conteúdo, não o sistema.
  4. **Auditoria — NÃO silenciosa (decisão mantenedor).** O resultado do import deve mostrar contadores: **válidos** (viraram draft), **descartados por autoria** (homebrew/próprio/inspirado/baseado), **inválidos** (não-anúncio/sem corpo).
- **DECISÕES DO MANTENEDOR (2026-06-26) — fechadas:**
  - **"inspirado em" e "baseado em" = autoria → DESCARTAR também.** Detector estendido: `/\b(sistema\s+)?(pr[óo]prio|autoral|homebrew)\b|\b(inspirad[oa]|basead[oa])\s+em\b/i`. (Não é mesa de sistema conhecido — é criação autoral.)
  - **Descarte NÃO é silencioso** → contadores visíveis (válidos / descartados-autoria / inválidos).
- **Contadores exigidos:** distinguir os motivos hoje agrupados em `ignored`: (a) **não-anúncio** (parse null por falta de corpo) vs (b) **descartado por autoria** (T-C8). Sugestão: `parseDiscordAnnouncement` retornar discriminador (ex.: `{ discarded: 'homebrew' }`) OU o serviço contar separado; `ImportResult` + `recordImportRun` (Fase G, `discord_import_runs`) ganham `discarded_homebrew` separado de `messages_ignored`; UI do resultado: "**N válidos · N descartados (autoria) · N inválidos**".
- **Impacto esperado:** `extracao_json.json` ~99→ ~85 válidos + ~14 descartados; `exemplo26.06.json` ~100→ ~88 + ~12. Validar com eval antes/depois nos 2 arquivos.
- **Anchor:** `parseDiscordAnnouncement.ts` (~L551-552 `explicitSystem`/`systemHint`; `return null`/discriminador); `chatExporterImportService.ts` (`ImportResult` + loop de contagem); `routes/discord/utils.ts` (`recordImportRun`); UI `DiscordJsonImportPanel`/`useJsonImport`.
- **Status:** ✅ **IMPLEMENTADO (Claude 2026-06-26).** Parser: `isHomebrewSystem(message)` (exportado) + descarte em `parseDiscordAnnouncement` (`return null` quando o sistema é próprio/autoral/homebrew/`inspirado em`/`baseado em`). Detector testa só a **1ª linha** do campo Sistema (evita falso-descarte por menção solta no corpo — `extractLabelValue` agrega continuação). Contadores: `DiscordDraftOutcome` ganhou `'discarded'`; `processDiscordMessageToDraft` distingue descarte (homebrew) de inválido; `parse-batch` e `/reparse` retornam `{succeeded(válidos), discarded, ignored(inválidos), failed}`; toast frontend mostra "X válidos · Y descartados (autoria) · Z inválidos · W erros". **Validado nos 2 arquivos:** `extracao_json.json` = 86 válidos · 13 descartados · 1 inválido; `exemplo26.06.json` = 88 · 12 · 0. Testes (it.each próprio/proprio/autoral/homebrew/inspirado/baseado → null; não-descarta D&D + menção solta; isHomebrewSystem). Frontend+backend build ✅, test 282/282 ✅, lint 15/15 ✅. **Pendência menor:** persistir contagem `discarded` em `discord_import_runs` (Fase G) exige migration → follow-up; hoje os contadores vivem na resposta da API + toast.

---

## Fase G — Implementações

### T-G3 — Correção antes/depois para Discord drafts

- **Origem:** Fase G da spec 048 — human-in-the-loop.
- **Severidade:** Alta (bloqueia T-G4/T-G5/T-G6 — sem correções registradas, não há dados para aprendizado ou métricas).
- **Diagnóstico (2026-06-26):** endpoint `POST /inbox/drafts/:id/correction` rejeitava Discord drafts com 422 (`import_message_id` nulo). Tabela `import_corrections` (migration 129) já aceita `import_message_id` nulo. O guard era só no código.
- **Implementação (DeepSeek 2026-06-26):**
  - **Backend:** `registerDraftCorrection()` extraído em `utils.ts` como helper compartilhado (~70 linhas). Busca `raw_text` de `discord_import_messages.content_raw` quando `import_message_id` é nulo (discord) ou de `import_messages` quando preenchido (inbox). Inbox `corrections.ts` refatorado para usar o helper (~30 linhas removidas). Novo `routes/discord/corrections.ts` (24 linhas) registrado em `adminDiscordSync.ts` sob `/drafts`.
  - **Frontend:** `discordSyncApi.submitCorrection(id, { corrections, reason, before })` adicionado. `DraftApiOperations.submitCorrection?` no tipo. `useDraftForm.handleSaveFields` computa diff (JSON.stringify nos campos alterados) e chama `submitCorrection` (best-effort, catch silencioso). `inbox/draftAdapter.ts` adaptado.
  - **Teste:** "returns 422 for Discord draft" → "accepts Discord draft correction (200)". Backend 263/263, frontend 163/163, lint ✅.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).**

### T-G1 — Confidence tiers

- **Origem:** Fase G — score de confiança com tiers comportamentais.
- **Diagnóstico:** `calcConfidence()` já existia (ratio de campos preenchidos). Faltava classificação em tiers (baixa/média/alta/muito alta) e display colorido no frontend.
- **Implementação (DeepSeek 2026-06-26):**
  - **Backend:** `classifyConfidence(score)` + tipo `ConfidenceTier` em `parseDiscordAnnouncement.ts`. `ImportTableDraft.confidence_tier` adicionado ao tipo e ao retorno do parser. Sem migration — `parsed_payload` é JSONB, tier serializado automaticamente.
  - **Frontend:** `confidenceColor(score)` (verde ≥0.85, lima ≥0.65, amarelo ≥0.40, vermelho <0.40) em `DiscordDraftReviewTable` e `DiscordDraftPreview`.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).**

### T-G2 — Ambiguity signals (preço conflitante, link suspeito)

- **Origem:** Fase G — expor dúvidas/ambiguidades para admin.
- **Diagnóstico:** `missing_fields` já cobria 7 tipos (unmatched_hint, day_of_week, start_time, slots_total, contact_url, description, ambiguous_x_of_y). Faltavam "preço conflitante" e "link suspeito".
- **Implementação (DeepSeek 2026-06-26):**
  - `price_type:ambiguous_value`: quando `priceValue != null && priceType == null` (achou valor mas não classificou pago/gratuito).
  - `contact_url:suspicious`: quando `contactUrl` existe mas não casa com padrões seguros conhecidos (discord.gg, forms.gle, docs.google.com/forms, typeform, wa.me, t.me).
  - Sem migration, sem frontend novo — `missing_fields` já renderizado pelo `DraftEditorTab`/`DiscordDraftPreview`.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).**

### T-G6 — Métricas por rodada de importação

- **Origem:** Fase G — métricas por rodada de importação.
- **Diagnóstico:** Tabela `discord_import_runs` não existia (T-F1 adiado). Sem métricas de acurácia, revisão ou rejeição por rodada.
- **Implementação (DeepSeek 2026-06-26):**
  - **Migration 131:** `discord_import_runs` (online-safe): colunas para contagens por rodada.
  - **Backend:** `recordImportRun()` best-effort em `utils.ts`. `GET /admin/discord-sync/metrics`: últimas 20 rodadas + totais agregados de correções + distribuição de status + top 10 campos corrigidos. Wireado em `POST /` e `POST /file` de `import.ts`.
  - DB types: `DiscordImportRunsTable` + `NewDiscordImportRun`.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).**

### T-G4 — Aprendizado não-IA

- **Origem:** Fase G — alimentar parser com correções humanas.
- **Diagnóstico:** Infra de coleta pronta (T-G3 registra correções, T-G6 expõe top_corrected_fields). `ensureSystemSuggestionForDraft` já cria aliases. Melhorias de parser (heurísticas, padrões, regras) são **processo humano** contínuo.
- **Status:** ✅ **Infraestrutura concluída.** Melhorias de parser são processo operacional guiado pelos dados — sem código novo por task.

### T-G5 — IA auxiliar (preparação de dados)

- **Origem:** Fase G — preparar aprendizado assistido por IA.
- **Diagnóstico:** T-G3 fornece corpus de correções (antes/depois/diff/reason) mas não havia formato de exportação para consumo por IA.
- **Implementação (DeepSeek 2026-06-26):**
  - `GET /drafts/export/few-shot` — exporta correções como exemplos few-shot: `{ instruction, input: { raw_text, parsed_before }, output: { corrections, reason } }`. Paginado, filtrável por `reason`/`corrected_by`.
  - `GET /drafts/export/eval` — exporta correções como dataset de avaliação: `{ id, raw_text, parsed_before, human_corrected, diff, reason, corrected_at }`. Mesmo filtro/paginação.
  - **Sem chamada de IA** — apenas preparação de dados. Execução de modelo (few-shot prompting, comparação de modelos, fine-tuning) exige spec própria com análise de privacidade e autorização nominal.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).** Dados exportáveis. Execução de IA = spec 052.

### T-G7 — Shadow mode

- **Origem:** Fase G — registrar decisões automáticas propostas sem aplicá-las.
- **Diagnóstico:** Sem infraestrutura para comparar "o que o sistema faria" com "o que o admin fez".
- **Implementação (DeepSeek 2026-06-26):**
  - **Migration 132:** `discord_shadow_decisions` (online-safe): `draft_id`, `confidence`, `confidence_tier`, `would_auto_approve`, `auto_approve_reason`, `missing_fields`, `actual_outcome`, `actual_at`.
  - **Lógica:** `recordShadowDecision()` em `utils.ts` — a cada upsert de draft, registra se o sistema teria autoaprovado (tier `muito_alta` + zero `missing_fields`). Best-effort.
  - **Wire:** `processDiscordMessageToDraft` chama `recordShadowDecision` após upsert (update e insert).
  - **Endpoint:** `GET /metrics/shadow` — compara decisão automática vs real: acurácia (would_approve_and_synced/rejected, would_not_approve_and_synced/rejected) + lista de completos + pendentes.
  - Autoaprovação real **nunca ativada** — apenas registro passivo para coleta de dados.
- **Status:** ✅ **FECHADO (DeepSeek 2026-06-26).** Shadow mode passivo em operação.

### T-G8 — Trava de publicação

- **Origem:** Fase G — MVP nunca publica automaticamente.
- **Diagnóstico:** Já em vigor: drafts entram `draft/needs_review`, nunca `synced` automático. Sincronização manual explícita.
- **Status:** ✅ **Em vigor (comportamento).** Formalização completa depende de T-G7.

## DEB-048-28 — Build QUEBRADO na Fase G (corrections.ts): null vs undefined em userId

- **Origem:** integração Fase G (Codex, 2026-06-26). `tsc` falha → backend não builda.
- **Severidade:** 🛑 Bloqueante (CI/PR #99 e deploy falham; Codex não consegue buildar).
- **Evidência:** `tsc` →
  - `src/routes/discord/corrections.ts(29,7): Type 'string | null' is not assignable to type 'string | undefined'`
  - `src/routes/inbox/corrections.ts(27,7): idem`
  - Causa: `userId: req.user?.userId ?? null` — `registerDraftCorrection`/`CorrectionInput.userId` é `string | undefined`; `?? null` produz `string | null`.
- **Fix (1 linha em cada):** trocar `?? null` por `?? undefined` (ou só `req.user?.userId`) em `discord/corrections.ts:29` e `inbox/corrections.ts:27`.
- **Nota:** o erro reportado pelo LSP em `parseDiscordAnnouncement.ts:648` (confidence_tier) era **stale** — o return principal (L690) já inclui `confidence_tier`. O build real só acusa os 2 acima.
- **Status:** ✅ **CORRIGIDO (Claude 2026-06-26).** `?? null` → `?? undefined` em `discord/corrections.ts:29` e `inbox/corrections.ts:27`. Build ✅, test **273/273** ✅, lint 15/15 ✅. (LSP mostra `registerDraftCorrection` não-exportado como **stale** — `tsc` passa; `utils.ts` exporta a função.)

## DEB-048-29 — Sistema autoral: 3 camadas (descarte claro / revisão ambígua / ensino por sugestão)

- **Origem:** mantenedor 2026-06-26 — refino do DEB-048-27 (que faz hard-discard de TODO autoral). Pedido: descarte silencioso só p/ casos nítidos; ambíguos vão p/ revisão p/ humano decidir; e um caminho p/ "ensinar" o detector quando ele errar.
- **Severidade:** 🟡 Melhoria de qualidade/UX (não bloqueante). Reduz falso-descarte e perda de dado.
- **Decisão de comportamento (escolhas do mantenedor):**
  - **Camada 1 — CLARO → DESCARTA (contado, não silencioso).** Nitidamente próprio/homebrew/autoral/caseiro. Continua virando `parse → null` + contador `discarded`.
  - **Camada 2 — AMBÍGUO → REVISÃO com flag "autoral?".** Vira draft `needs_review` com marca; reviewer decide Manter (sync) ou Descartar (reject). Nada some sozinho nesta camada.
  - **Camada 3 — ENSINO por SUGESTÃO (gated).** Num draft que passou como **válido** mas É próprio, reviewer aciona "marcar como sistema próprio" → grava **sugestão** (termo + contagem + exemplo) numa fila. Painel admin lista candidatos com `[Promover]`/`[Ignorar]`; só o mantenedor **promove** o termo p/ a lista que o detector consulta. Sem aprendizado automático.
- **Detecção (dividir `RE_HOMEBREW_SYSTEM` atual em dois):**
  - `RE_HOMEBREW_STRONG` (→ descarta): `\b(sistema\s+)?(pr[óo]prio|autoral|homebrew|caseiro)\b`
  - `RE_HOMEBREW_WEAK` (→ revisão): `\b(inspirad[oa]|basead[oa]|adaptad[oa])\s+(em|n[oa])\b`
  - **Lista promovida** (DB): termos aprovados manualmente entram como STRONG-equivalentes (descarta) — decidir na impl se promovido descarta ou só flag. **Recomendo: promovido = descarta** (mantenedor já validou).
  - ⚠️ **NÃO** classificar "sistema desconhecido sem match" como ambíguo — inundaria a revisão (maioria dos desconhecidos não é homebrew). WEAK = só as frases acima.
- **Pré-requisito já entregue:** fix CodeRabbit `keepParenthetical` (extractLabelValue) — o gate precisa enxergar o sinal dentro do parêntese ("...(Sistema próprio...)"). Mantido.
- **Schema novo (migration, online-safe):** `discord_homebrew_signals`: `{ id, term, source_draft_id, occurrence_count, status: pending|promoted|ignored, created_at, promoted_at, promoted_by }`.
- **Backend:**
  - `classifyHomebrew(message): 'discard' | 'review' | 'none'` substitui `isHomebrewSystem` (que vira wrapper de `=== 'discard'`).
  - `parseDiscordAnnouncement`: `null` só p/ `'discard'`; `'review'` → cria draft `needs_review` + `table._homebrew_suspect = true` + review note.
  - Endpoint sugestão: `POST /drafts/:id/mark-homebrew` → upsert em `discord_homebrew_signals` (incrementa `occurrence_count`) + reject draft.
  - Endpoints painel: `GET /homebrew-signals` (pending), `POST /homebrew-signals/:id/promote`, `POST /homebrew-signals/:id/ignore`.
  - Detector carrega lista `promoted` junto com a regex.
- **Frontend:**
  - Badge `⚠ autoral?` no card de draft com `_homebrew_suspect`.
  - Ação "marcar como sistema próprio" em draft válido → chama `mark-homebrew`.
  - Painel admin "candidatos a termo homebrew": lista + contagem + `[Promover]`/`[Ignorar]`.
- **Tests:** `T-F1-B-01` (atualizado p/ DEB-048-27) **continua `null`** ("sistema próprio" = STRONG = claro). Novos: WEAK ("baseado em") → draft flagged; STRONG → null; `mark-homebrew` → sugestão; promote → detector passa a descartar o termo.
- **Escopo/modo:** SDD Lite (só `apps/mesas`: parse + routes + frontend + 1 migration). Sem tocar `packages/*`.
- **Status:** 🟡 **PARCIAL (Claude 2026-06-26).**
  - ✅ **Fase 1 (núcleo)** — `RE_HOMEBREW_STRONG`/`RE_HOMEBREW_WEAK` + `classifyHomebrew()`; `parse` descarta só STRONG, WEAK vira draft `_homebrew_suspect`; `normalizeDiscordTableDraft` empurra `system_name:homebrew_suspect` → needs_review; tipo `DiscordTableDraftTable._homebrew_suspect` + zod passthrough. Tests atualizados (DEB-048-27 STRONG=null; DEB-048-29 WEAK=needs_review; `classifyHomebrew`).
  - ✅ **Fase 2 (revisão)** — badge `⚠ autoral?` em `DiscordDraftReviewTable` (lista) e `⚠ Possível sistema autoral` em `DiscordDraftPreview` (detalhe). Decisão usa Sincronizar(manter)/rejeitar(descartar) já existentes.
  - ⏳ **Fase 3 (ensino) — PENDENTE.** Migration `discord_homebrew_signals` + `mark-homebrew` + painel candidatos + promote. Não implementada.
  - **Validação:** backend build ✅, test **284/284** ✅; frontend build ✅, test **163/163** ✅; lint **15/15** ✅.
