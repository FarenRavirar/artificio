# Tasks — 048 Importador DiscordChatExporter JSON

> Continuação da Spec 047. Esta spec começa por auditoria/planejamento; implementação só com autorização posterior.

## Reconciliação de estado — 2026-06-26 (verificado contra `origin/dev`)

> Auditoria read-only do código real em `origin/dev` (HEAD `ff24632`). **Código é a verdade**; doc anterior estava dessincronizada.

**JÁ EM `dev` (merged):** PR #91 (`ed3f4e0` MVP) + spec 049 (`a4d2fb5`).
- Fase B backend MVP completa (T-B1..B8): tipos Zod, adapter, serviço, endpoint `POST /api/v1/admin/discord-sync/import-json`, idempotência por `content_hash`, JSON inválido→400, mensagem editada→`pending`.
- Fase D UI completa (T-D1..D6): textarea + **upload de arquivo + dropzone**, preview com debounce, resultado (inserted/updated/ignored/failed), link p/ drafts, estados de erro.
- **DEB-048-09** (dedup `shared.ts`), **DEB-048-10** (embed `.nullish()`), **DEB-048-11** (`DiscordSettingsDecryptError`→200), **DEB-048-12** (upload arquivo) — **TODOS em dev** (a doc antiga dizia "pendente commit/PR"; era falso).
- Testes em dev: `chatExporterAdapter.test.ts`, `chatExporterImportService.test.ts` (+ rejeição de JSON inválido coberta).

**EXPERIMENTOS LIMPOS (NÃO em dev — decisões T-H):** `deepseek.ts` (DEB-048-06), `chrono-node`/`fuzzball` (DEB-048-07), Playwright e2e (DEB-048-08). Parser em dev = **regex puro determinístico**. Esses débitos viram **moot p/ dev** (ver debitos.md).

**ABERTO DE VERDADE (escopo de fechamento — decisão mantenedor 2026-06-26: Fase C + F + G completas, NA MESMA SPEC):**
- **Fase C** parser hardening (T-C1..C9) — parser dev NÃO extrai `<t:UNIX>`, `forms.gle`/`docs.google/forms`, contato implícito, vagas informais (`3 de 5`/`0/5`), role/user mentions como tags, sistema próprio/inspirado, attachments/embeds como evidência.
- **Fase F** robustez (T-F1..F10) — incl. limite upload **server-side** (hoje só cliente 10MB), fixture sanitizada versionável, perf 100 msgs, sanitização de render, reparse controlado.
- **Fase G** human-in-the-loop (T-G1..G8) — confidence gates, registro antes/depois, active learning não-IA, métricas por rodada, shadow mode, trava de publicação.
- **Smoke beta real** (gate MVP ainda aberto): confirmar deploy beta com os fixes + re-smoke com `extracao_json.json`.

**Fase E** (automação VM diária) permanece **futuro documentado** — fora do corte de fechamento desta rodada (precisa aprovação nominal p/ VM write).

## Estado inicial

- [x] T0 — Ler contexto mínimo do projeto.
- [x] T0.1 — Ler contexto recebido no anexo.
- [x] T0.2 — Inspecionar JSONs reais em `spec047-backup/`.
- [x] T0.3 — Confirmar decisão de produto:
  - MVP = upload manual no painel admin.
  - Evolução = DiscordChatExporter na VM rodando todo dia.
  - DiscordChatExporter = permanente.
- [x] T0.4 — Criar Spec 048 como continuação/evolução da Spec 047.
- [x] T0.5 — Atualizar `specs/backlog.md` e `.specify/memory/project-state.md`.
- [x] T0.6 — Revisar aderência contra diff local e VM beta.
  - VM beta: commit `b70367c`, containers mesas beta healthy.
  - DB beta: `discord_import_messages` existe com `source_kind`, attachments/embeds e unique `(discord_channel_id, discord_message_id)`.
  - Diff local: há mudanças não-documentais que não podem ser assumidas como parte entregue da Spec 048.

## Trava operacional antes de implementar

- [x] T0.7 — Rebase/realinhar a branch da Spec 048 sobre `dev` depois que a PR #90 (`chore/047-debitos-finais`) for mergeada.
  - Motivo: a branch `feat/048-discord-chat-exporter-json` foi criada em cima do commit local `f6b181c` da Spec 047 para preservar o diff restante sem perda de trabalho.
  - ✅ PR #90 mergeada em `dev` em 2026-06-23 (`f0e2e56`).
  - ✅ Branch local `feat/048-discord-chat-exporter-json` avançada por fast-forward para `origin/dev`.
  - ✅ Critério conferido: `git log origin/dev..HEAD` vazio.
  - Observação: o diff local da 048 ainda contém documentação e experimentos de código/deps que precisam ser auditados por T-H antes de qualquer commit/PR da 048.

## Fase A — Auditoria técnica fechada

- [x] T-A1 — Mapear schema real do `extracao_json.json`.
  - Evidência: 100 mensagens, 85 anexos, 28 embeds, 11 Google Forms, 4 timestamps Discord, 60 role mentions.
- [x] T-A2 — Verificar `extracao_json2.json`.
  - Evidência: JSON inválido/truncado na linha ~3042; usar como fixture negativa.
- [x] T-A3 — Comparar JSON com `ImportRawMessage`.
  - Resultado: adaptação direta possível.
- [x] T-A4 — Decidir tabela.
  - Resultado: `discord_import_messages`.
- [x] T-A5 — Verificar se `discord_chat_exporter_json` existe.
  - Resultado: existe em `DiscordImportSourceKind`.
- [x] T-A6 — Verificar dedupe.
  - Resultado: unique `(discord_channel_id, discord_message_id)` + `content_hash`.
- [x] T-A7 — Verificar migrations.
  - Resultado: MVP provavelmente sem migration.

## Fase A2 — Arquitetura e plano MVP herdado da Spec 047

- [x] T-A8 — Transferir o plano MVP/evolutivo da Spec 047 para a Spec 048.
  - Normalização melhorada → hardening do parser DiscordChatExporter.
  - Resolução de sistema → aliases/correções humanas alimentando match.
  - Score de qualidade → confidence gates por draft.
  - UI de revisão inteligente → revisão com bruto + metadados Discord + ambiguidades.
  - Heurísticas reaproveitáveis → regras determinísticas antes de IA.
  - Roadmap futuro → VM diária, Bot/API, shadow mode, métricas e IA auxiliar.

- [x] T-A9 — Documentar arquitetura da solução em `plan.md`.
  - Fonte de entrada.
  - Ingestão.
  - Preservação.
  - Extração.
  - Draft/revisão.
  - Correções/métricas.
  - Sync manual para `tables.status='draft'`.
  - Diagrama operacional no estilo da Spec 047, incluindo MVP, futuro VM diário e opcionais de automação/aprendizado.

- [x] T-A10 — Definir corte explícito do MVP.
  - Entra: upload manual, validação, persistência Discord, dedupe, drafts, resumo, testes e privacidade.
  - Não entra: auto-publicação, autoaprovação, download de anexos, job VM, bot/API oficial, fine-tuning ou IA obrigatória.

- [x] T-A11 — Antes de implementar, conferir se o plano no `plan.md` ainda bate com o código real da branch limpa.
  - Motivo: a 048 foi restaurada de stash após a correção da PR #90.
  - ✅ Branch realinhada sobre `origin/dev` pós-PR #90; `git log origin/dev..HEAD` vazio.
  - ✅ Plano continua coerente: DiscordChatExporter JSON deve usar `discord_import_messages`, endpoint `POST /api/v1/admin/discord-sync/import-json`, upload manual MVP, sem auto-publicação.
  - ✅ Auditoria do diff local executada em 2026-06-23:
    - documentação da Spec 048 está OK para servir como fonte de execução;
    - `chrono-node`/`fuzzball` aparecem em código/deps, mas ainda precisam de matriz real antes de commit;
    - `@playwright/test` e scripts E2E aparecem em `package.json`/`vitest.config.ts`, mas `apps/mesas/frontend/e2e/` não existe no working tree atual;
    - `deepseek.ts` não existe no working tree atual e o DeepSeek foi removido da 047 pela PR #90;
    - `apps/mesas/scripts/discord-export.sh` não existe no working tree atual;
    - alteração em `AGENTS.md` deve ser ignorada, conforme pedido do mantenedor.
  - Conclusão: antes de implementar, limpar ou justificar os restos de deps/config que não têm arquivo correspondente.

## Fase B — Backend MVP upload manual ✅ (2026-06-23)

- [x] T-B1 — Criar tipos/normalizador Zod para export DiscordChatExporter.
  - `apps/mesas/backend/src/discord/discordChatExporterTypes.ts`
  - Schemas: `discordChatExporterExportSchema`, `discordChatExporterMessageSchema`, `discordChatExporterAuthorSchema`, `discordChatExporterAttachmentSchema`, `discordChatExporterEmbedSchema`, `discordChatExporterMentionSchema`, `discordChatExporterReactionSchema`, `discordChatExporterReferenceSchema`, `discordChatExporterForwardedMessageSchema`, `discordChatExporterInlineEmojiSchema`, `discordChatExporterGuildSchema`, `discordChatExporterChannelSchema`, `discordChatExporterDateRangeSchema`
  - Campos opcionais: `mentions`, `inlineEmojis`, `reactions`, `reference`, `stickers`, `forwardedMessage`
  - Entrada `unknown`, passthrough em embeds para aceitar campos extras.

- [x] T-B2 — Criar adapter `DiscordChatExporterMessage → ImportRawMessage`.
  - `apps/mesas/backend/src/discord/chatExporterAdapter.ts`
  - `adaptMessageToImportRaw()` sem `segmentAnnouncements()`
  - `nickname ?? name` como autor
  - `content_hash` via sha256(content + embeds + attachments)

- [x] T-B3 — Criar serviço `importDiscordChatExporterJson()`.
  - `apps/mesas/backend/src/discord/chatExporterImportService.ts`
  - Valida + persiste em `discord_import_messages` com `source_kind='discord_chat_exporter_json'`
  - Idempotente via content_hash (insert se novo, update se hash diferente, ignore se igual)
  - Retorna `ImportResult { total, inserted, updated, ignored, failed }`

- [x] T-B4 — Criar endpoint admin:
  - `POST /api/v1/admin/discord-sync/import-json` em `adminDiscordSync.ts`
  - `authMiddleware` + `isAdmin` guard
  - Aceita JSON body diretamente (com `messages`) ou aninhado em `{ json: ... }`

- [ ] T-B5 — Parse automático opcional pós-import.
  - **ADIADO para depois do MVP.** O endpoint atual só importa; parse via botão "Reparse" existente.

- [x] T-B6 — Erro robusto para JSON inválido:
  - JSON sem `messages[]` → 400 "JSON inválido: o arquivo não parece ser um export do DiscordChatExporter"
  - JSON truncado → erro Zod → 400 com detalhes
  - `extracao_json2.json` confirmado como fixture negativa válida

- [x] T-B7 — Idempotência:
  - content_hash impede duplicatas. Mesmo JSON importado duas vezes = 0 inserted na segunda.
  - `ignored` conta mensagens existentes com hash igual.

- [x] T-B8 — Mensagem editada:
  - content_hash diferente → update em `discord_import_messages`, status `'pending'`, `parse_error=null`

## Fase C — Parser hardening com padrões reais

> **PR-1 implementado 2026-06-26** (DeepSeek). Escopo mínimo do handoff #3: T-F4 + T-C1/C2/C3/C6. Regex determinístico puro, sem libs novas, sem migration.

- [x] T-C1 — Parse de timestamp Discord `<t:UNIX:F>` e `<t:UNIX:t>`.
  - `extractDiscordTimestamp()`: regex `/<t:(\d+):[a-zA-Z]+>/` → UTC Date → dia PT + HH:MM.
  - Integrado no `parseDiscordAnnouncement` com **preferência** sobre `extractDayOfWeek`/`extractStartTime` (timestamps nativos são mais confiáveis).
  - Testes: 2 casos (com e sem `<t:>`).
- [x] T-C2 — Google Forms como contato/recrutamento:
  - `forms.gle`
  - `docs.google.com/forms`
  - Regex captura ambos; prioridade sobre `extractContactUrl` genérica.
  - Testes: 2 casos.
- [x] T-C3 — Contato implícito pelo autor:
  - "me mande mensagem";
  - "me chama";
  - "fale comigo";
  - "chama no pv/dm/privado";
  - "este perfil";
  - "mande/envie mensagem no/para o meu".
  - `detectImplicitContact()` com 6 padrões regex; só ativa quando `contactDiscord` E `contactUrl` estão vazios (não sobrescreve contato explícito).
  - Testes: 4 casos.
- [ ] T-C4 — Role mentions `<@&id>` como tags/evidências brutas. (fora do PR-1)
- [ ] T-C5 — User mentions `<@id>` / `<@!id>` como possível contato. (fora do PR-1)
- [x] T-C6 — Vagas:
  - `3 de 5` → total=5, open=2 (com guard: X ≤ Y ≤ 20);
  - `0/5` → coberto pelo mesmo padrão;
  - `1 vaga via forms` → total=1, open=1;
  - `mesa em andamento` → `{total: null, open: null}` (sem fabricar número).
  - Preserva padrões antigos (`vagas totais: N`, `N/M vagas`, etc.).
  - Testes: 5 casos (incluindo anti-regressão dos antigos).
- [ ] T-C7 — Mesa paga/gratuita (fora do PR-1)
- [ ] T-C8 — Sistema próprio/inspirado em (fora do PR-1)
- [ ] T-C9 — Attachments/embeds como evidências (fora do PR-1)

## Fase D — UI admin

- [x] T-D1 — Adicionar upload manual no painel admin.
  - Local: aba Discord Sync, seção "Importar JSON" (`DiscordSyncPanel.tsx:279`).
  - Renderiza `<DiscordJsonImportPanel />`. Implementado desde PR #91 + T-D6.

- [x] T-D2 — Resumo de pré-importação.
  - guild, canal, dateRange, exportedAt, messageCount, anexos/embeds.
  - Endpoint `POST /import-json/preview` valida JSON e retorna metadados sem persistir.
  - Lógica de parse extraída para `extractJsonPayload()` — reusada por preview e import.
  - `DiscordJsonImportPanel` faz preview automático com debounce (400ms) ao colar/upload JSON.
  - Botão "Importar" só habilita após preview carregado (`preview_ok`).
  - Preview exibido em grid (servidor, canal, mensagens, anexos, embeds, exportedAt, dateRange).

- [x] T-D3 — Resultado pós-importação.
  - inserted/updated/ignored/failed exibidos em grid (5 colunas).
  - `failed` adicionado ao retorno do endpoint e ao card de resultado.
  - "drafts criados/atualizados" não se aplica (parse é passo separado, T-B5 adiado).

- [x] T-D4 — Link para revisão dos drafts.
  - `DiscordJsonImportPanel` recebe prop opcional `onNavigateToDrafts`.
  - `DiscordSyncPanel` passa `() => setTab('drafts')`.
  - Botão "Ver drafts" aparece no resultado da importação.

- [x] T-D5 — Estados de erro.
  - arquivo inválido: cliente valida extensão `.json` ✅
  - arquivo truncado: Zod rejeita → 400 ✅
  - JSON sem `messages[]`: backend check → 400 ✅
  - arquivo grande demais: cliente valida 10 MB ✅
  - canal ausente: `ensureDiscordImportSource` envolto em try/catch → `DiscordChatExporterValidationError` → 400 ✅

- [x] T-D6 — Upload de arquivo JSON (botão + arrastar-soltar). **DEB-048-12.**
   - `<input type="file" accept=".json,application/json">` + dropzone.
   - Ler via `File.text()`/`FileReader` e enviar ao `POST /import-json`.
   - Validar extensão/tamanho no cliente (alinha T-F2).
   - Manter textarea como fallback de colar.

## Correções pós-smoke beta — 2026-06-23

> Smoke real do mantenedor com `D:\extracao_json.json` em `mesasbeta.../gestao` → Discord Sync → Importar JSON.

- [x] T-FIX1 — Embed com campos `null` derrubava import com 400. **DEB-048-10.**
  - Causa: `discordChatExporterEmbedSchema` usava `.optional()` (só `undefined`); JSON real traz `timestamp/image/description/...= null`.
  - Fix: campos string opcionais de embed/author/attachment → `.nullish()`; `embed.image` aceita string ou `{ url }`.
  - Arquivo: `discordChatExporterTypes.ts`.
  - Teste: `__tests__/chatExporterAdapter.test.ts` (3 testes).
  - Validação: backend build ✅, test 183/183 ✅, lint 15/15 ✅.
- [x] T-FIX2 — `GET /settings` 500 no beta. **DEB-048-11.** Pré-existente da Spec 047; hardening do handler implementado (`DiscordSettingsDecryptError` + `decrypt_error: true`). Investigação read-only no beta pendente para confirmar causa (mismatch JWT_SECRET).

## Fase E — Automação diária permanente na VM

> Planejar agora; implementar só depois do MVP e com autorização nominal para VM.

- [ ] T-E1 — Desenhar diretórios fora do git:
  - `incoming/`
  - `processing/`
  - `processed/`
  - `error/`

- [ ] T-E2 — Definir comando DiscordChatExporter na VM.
  - Registrar como segredo operacional se exigir token/credencial.
  - Não usar cookie pessoal sem decisão explícita.

- [ ] T-E3 — Criar job diário.
  - Pode ser cron/systemd timer/GitHub Actions dispatch, a decidir.

- [ ] T-E4 — Importador de pasta monitorada.
  - Processa arquivos idempotentemente.
  - Move arquivo conforme resultado.
  - Não para lote inteiro por um arquivo ruim.

- [ ] T-E5 — Logs e retenção.
  - Não logar conteúdo bruto completo.
  - Definir retenção de JSONs processados.

- [ ] T-E6 — Métrica operacional.
  - arquivos processados;
  - mensagens importadas;
  - mensagens atualizadas;
  - drafts criados;
  - erros por causa.

## Fase F — Opcionais robustos que NÃO podem ser esquecidos

> **PR-2 implementado 2026-06-26** (DeepSeek). Handoff #4 completo + T-F6 a F9. Sem migration, sem lib nova.

- [ ] T-F1 — Avaliar migration `discord_import_runs` (**adiado** — exige aprovação nominal + guard online-safe spec 050).
- [x] T-F2 — Guarda server-side de tamanho + contagem.
  - Constantes `MAX_IMPORT_MESSAGES = 2000`, `MAX_IMPORT_JSON_BYTES = 10MB` (≤ global 12MB).
  - Validação em `extractJsonPayload` (bytes antes do parse) e `importDiscordChatExporterJson` (mensagens após parse).
  - Erro 400 com mensagem amigável (`DiscordChatExporterValidationError`).
  - Testes: rejeita acima do limite, aceita no limite, 100 msgs.
- [x] T-F3 — Sanitização/privacidade.
  - `import.ts` e `chatExporterImportService.ts`: logs sanitizados (`error.message`, não `error` cru).
  - Frontend verificado: zero `dangerouslySetInnerHTML` em `DiscordJsonImportPanel`, `JsonPreviewCard`, `ImportResultGrid`. React escapa texto por padrão.
- [x] T-F4 — Fixture reduzida versionável (pré-requisito, feito no Handoff #3).
- [x] T-F5 — Teste de performance 100 msgs.
  - Teste em `chatExporterImportService.test.ts`: 100 mensagens → total 100, sem throw O(n²).
- [x] T-F6 — Reprocessamento controlado.
  - Endpoint `POST /import-json/reparse`: busca mensagens `pending`/`needs_review` com `source_kind='discord_chat_exporter_json'`, chama `parseDiscordMessage` (shared), atualiza drafts. Limite 500 por chamada. `synced` nunca reprocessado sem `messageIds` explícito.
- [x] T-F7 — Estratégia para anexos grandes/vídeos (**implementado** → DEB-048-13 fechado).
  - `extractCoverFromAttachments` corrigido: fallback por extensão `fileName` (.png/.jpg/.webp/.gif) quando `content_type` ausente (ChatExporter real).
  - `buildAttachmentNotes`: anexos não-imagem (.mp4, .txt, etc.) viram nota `"Anexo: <nome> (<tamanho>) — <url>"` em `_notes`.
  - SVG ignorado por extensão. Compat retroativa com bot-fetch (`content_type`).
  - Testes: 8 novos (png por extensão, jpg, mp4 gera nota, txt gera nota, bot-fetch compat, svg ignorado, sem fileName).
- [x] T-F8 — Estratégia para replies/threads (**implementado** → DEB-048-14 fechado).
  - `ImportRawMessage.reference?: { messageId; channelId?; guildId? }` adicionado.
  - `adaptMessageToImportRaw` popula `reference` a partir de `msg.reference`.
  - `parseDiscordAnnouncement(message, systems, replyContext?)` — novo 3º parâmetro opcional; injeta `"Em resposta a: <snippet>"` em `_notes`.
  - `chatExporterImportService` constrói `contentIndex: Map<messageId, snippet>` (~80 chars) no batch.
  - Fixture: msg-007 (alvo) + msg-008 (reply). Testes: 4 (replyContext→nota, truncado 80 chars, undefined→sem nota, referência órfã).
- [x] T-F9 — Mapa de campos para `metadata` (**documentado** → DEB-048-15).
- [x] T-F10 — Checklist anti-regressão 047.
  - `import.ts` e `chatExporterImportService.ts`: zero ocorrências de `import_messages` (só `discord_import_messages`).
  - Status sempre `'pending'` (hardcoded, sem caminho de auto-publicação).
  - Drafts Discord isolados da Inbox (tabelas diferentes, sem JOIN cruzado).

## Fase G — Workflow human-in-the-loop, active learning e confidence gates

> Esta fase transforma a diretriz de produto em contrato técnico. O MVP continua sem auto-publicação; toda automação futura precisa passar por evidência, shadow mode e autorização explícita.

- [ ] T-G1 — Modelar score de confiança por draft.
  - Baixa confiança: revisão obrigatória.
  - Média confiança: revisão recomendada.
  - Alta confiança: aprovação rápida.
  - Muito alta confiança: apenas candidato futuro a autoaprovação, nunca autoaprovado no MVP.

- [ ] T-G2 — Expor dúvidas/ambiguidades para o admin.
  - Sistema não vinculado.
  - Dia/horário incerto.
  - Contato ausente ou ambíguo.
  - Vagas/preço conflitantes.
  - Link/recrutamento suspeito ou incompleto.

- [ ] T-G3 — Registrar antes/depois de toda correção humana.
  - Texto bruto.
  - Extração original.
  - Normalização original.
  - Correção humana.
  - Diff campo a campo.
  - Motivo da correção, quando aplicável.

- [ ] T-G4 — Alimentar aprendizado não-IA.
  - Novos aliases de sistemas.
  - Novas heurísticas.
  - Novos padrões de recrutamento.
  - Novas regras de data/horário.
  - Novas validações.
  - Novos casos de teste.

- [ ] T-G5 — Preparar aprendizado assistido por IA, sem transformar IA em fundação.
  - Correções humanas podem virar exemplos few-shot.
  - Correções humanas podem virar conjunto de avaliação.
  - Correções humanas podem comparar modelos/prompts.
  - Fine-tuning futuro só com autorização explícita e análise de privacidade.

- [ ] T-G6 — Métricas por rodada de importação.
  - Taxa de campos preenchidos corretamente.
  - Taxa de sistema vinculado corretamente.
  - Taxa de contato identificado.
  - Taxa de revisão obrigatória.
  - Taxa de rejeição.
  - Erros recorrentes.
  - Tempo economizado pelo admin.

- [ ] T-G7 — Shadow mode antes de qualquer autoaprovação.
  - Sistema registra o que teria aprovado automaticamente.
  - Admin continua aprovando manualmente.
  - Comparar decisão automática proposta com correção humana real.

- [ ] T-G8 — Trava de publicação.
  - MVP nunca publica automaticamente.
  - Resultado inicial sempre é draft revisável.
  - Autoaprovação/publicação futura exige histórico de acurácia, score confiável, rollback, trilha de auditoria, shadow mode e aprovação explícita do mantenedor.

## Fase H — Auditoria dos diffs locais antes de qualquer implementação/commit

> Esta fase existe porque, em 2026-06-23, o workspace já continha mudanças locais de código/deps além da documentação da Spec 048. Outra IA não deve tomar esses diffs como verdade aceita sem revisar.

- [x] T-H1 — DeepSeek em `manual_paste`.
  - Auditoria 2026-06-23: `apps/mesas/backend/src/inbox/deepseek.ts` não existe no working tree atual.
  - PR #90 removeu a referência acidental a DeepSeek da Spec 047.
  - Decisão para a 048: **não implementar DeepSeek no MVP**.
  - Se DeepSeek voltar no futuro: abrir spec/debito próprio, validar resposta com Zod/schema, adicionar timeout/retry, testes e política de privacidade. Não misturar com importador DiscordChatExporter JSON.

- [ ] T-H2 — `chrono-node` e `fuzzball`.
  - Auditoria 2026-06-23: deps aparecem em `apps/mesas/backend/package.json` e `pnpm-lock.yaml`.
  - Código alterado:
    - `parseDiscordAnnouncement.ts` usa `chrono-node/pt` para dia/hora.
    - `normalizeDiscordTableDraft.ts` troca match normalizado exato por `fuzzball.token_sort_ratio >= 82`.
  - Risco:
    - falso positivo em sistemas parecidos;
    - dia/hora extraído de texto incidental;
    - `deriveFrequency` declara `quinzenal`, mas ainda não implementa detecção real;
    - deps novas aumentam superfície runtime sem matriz de regressão.
  - Executor deve escolher UMA opção antes de commit:
    1. **Remover** deps e mudanças de parser desta primeira PR 048, deixando hardening para fase C; ou
    2. **Manter com testes**, criando matriz real antes/depois para sistemas, dia/hora, quinzenal e falsos positivos.
  - Critério se mantiver:
    - testes unitários cobrindo exemplos reais do JSON;
    - teste com sistemas parecidos para calibrar threshold;
    - `deriveFrequency` ou volta para `'semanal' | null` ou implementa `quinzenal` de verdade.

- [ ] T-H3 — Playwright E2E.
  - Auditoria 2026-06-23: `apps/mesas/frontend/e2e/` não existe no working tree atual.
  - Porém `apps/mesas/frontend/package.json` adiciona `@playwright/test`, `test:e2e`, `test:e2e:install`.
  - `vitest.config.ts` exclui `e2e/` e `**/*.spec.ts`; isso pode esconder futuros testes unitários `*.spec.ts`.
  - Executor deve escolher UMA opção antes de commit:
    1. **Remover** Playwright e mudanças de `vitest.config.ts` desta PR; ou
    2. **Adicionar E2E real**, com estratégia de auth admin segura sem Chrome real/cookie pessoal, e documentar se roda local/CI/smoke manual.
  - Recomendação para MVP: remover Playwright por enquanto; manter smoke manual documentado até haver auth testável.

- [x] T-H4 — `apps/mesas/scripts/discord-export.sh`.
  - Auditoria 2026-06-23: arquivo não existe no working tree atual.
  - Decisão para MVP: não implementar script/VM nesta PR.
  - Automação diária permanece futura em Fase E/DEB-048-02, com aprovação nominal para qualquer VM write.

- [ ] T-H5 — Limpar diff antes de execução da Fase B.
  - Ignorar alteração em `AGENTS.md` por pedido explícito do mantenedor.
  - Manter documentação da Spec 048.
  - Decidir destino de `chrono-node`/`fuzzball`.
  - Decidir destino de Playwright/vitest config.
  - Garantir que o primeiro commit da 048 não carregue experimento órfão.

## Handoff de execução para OpenCode / DeepSeek V4 Pro

> Usar este bloco como prompt operacional. Não precisa reconstruir pelo chat.

### Contexto

- Branch local: `feat/048-discord-chat-exporter-json`, já realinhada com `origin/dev` pós-PR #90.
- Spec canônica: `specs/048-mesas-discord-chat-exporter-json/`.
- JSONs reais fora do commit: `C:\projetos\artificio\spec047-backup\extracao_json.json` e `extracao_json2.json`.
- MVP: upload manual no admin; futuro VM diário só documentado; sem auto-publicação.
- Tabela correta: `discord_import_messages`; não usar `import_messages`.
- Endpoint alvo: `POST /api/v1/admin/discord-sync/import-json`.

### Ordem obrigatória

1. Executar T-H5:
   - revisar diff atual;
   - limpar ou justificar deps/config órfãos;
   - não mexer em `AGENTS.md`;
   - não commitar nada.
2. Implementar Fase B backend MVP:
   - T-B1 normalizador Zod para DiscordChatExporter export;
   - T-B2 adapter por mensagem, sem `segmentAnnouncements()`;
   - T-B3 serviço `importDiscordChatExporterJson()`;
   - T-B4 endpoint admin;
   - T-B6 JSON truncado/erro 400;
   - T-B7 idempotência;
   - T-B8 mensagem editada/content_hash.
3. Implementar somente o mínimo da Fase C necessário para o JSON real não degradar:
   - Google Forms;
   - Discord timestamp `<t:...>`;
   - contato por autor/mentions;
   - vagas mais comuns.
4. Adiar Fase D UI se backend ainda não estiver sólido; se fizer UI, manter upload manual e resumo simples.
5. Atualizar `tasks.md`, `debitos.md`, sessão e backlog conforme fechar ou abrir itens.

### Não fazer

- Não usar DeepSeek/IA no MVP.
- Não publicar mesa automaticamente.
- Não criar migration sem necessidade provada.
- Não implementar VM/cron/script diário agora.
- Não commitar JSON real.
- Não depender de Chrome/cookie pessoal para teste automatizado.
- Não responder bots/reviews no PR.

### Gates mínimos antes de entregar ao Codex/mantenedor

- `pnpm --filter @artificio/mesas-backend test`
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`
- `pnpm run build`
- Se UI mudar:
  - `pnpm --filter @artificio/mesas-frontend test`
  - `pnpm --filter @artificio/mesas-frontend build`

### Resultado esperado do handoff

- Diff limpo da Spec 048.
- Backend MVP importando JSON válido e rejeitando JSON truncado.
- Reimportação idempotente.
- Mensagem editada atualiza hash/status.
- Drafts gerados como revisáveis, nunca publicados.
- Documentação atualizada na própria spec.

## Handoff de execução #2 — pós-smoke beta (para OpenCode / DeepSeek)

> Arquitetura por Claude (Opus). Implementação por DeepSeek. Usar este bloco como prompt operacional.
> Estado herdado: DEB-048-10 já corrigido localmente por Claude (embed `.nullish()` + teste). **Não reverter.**
> Branch: `feat/048-discord-chat-exporter-json`. Não commitar sem autorização nominal do mantenedor.

### Tarefa 1 — T-D6 / DEB-048-12: upload de arquivo JSON na UI

**Arquivo:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx`
(hoje só tem `<textarea>` para colar; ver REV-005 — já tem `id="discord-json-input"` + `aria-label`).

**Contrato de UI (aditivo, manter textarea como fallback):**
1. Botão "Selecionar arquivo" → `<input type="file" accept=".json,application/json">` (input escondido + label/botão estilizado, padrão do projeto).
2. Dropzone arrastar-soltar em volta da área de import: `onDragOver`/`onDragLeave`/`onDrop`, com estado visual de "arraste aqui".
3. Ao escolher/soltar arquivo:
   - Validar extensão (`.json`) e tamanho no cliente **antes** de ler. Limite inicial: **10 MB** (alinha T-F2/DEB-048-04; `extracao_json.json` real ~100 msgs cabe folgado). Acima → mensagem de erro amigável, não envia.
   - Ler com `await file.text()` (não `FileReader` callback — `File.text()` é mais simples e suportado).
   - Popular o `<textarea>` com o conteúdo lido **e** habilitar o botão "Importar" (reusar o fluxo de submit já existente). Não criar segundo caminho de submit.
4. Resultado/erros: reusar o estado de resultado já existente (total/inserted/updated/ignored) e os estados de erro (T-D5).

**Regras de código (AGENTS.md):**
- Conteúdo do arquivo é `unknown` até o backend validar (Zod). No cliente **não** fazer `JSON.parse` para "validar" e depois reserializar — enviar a string crua ao endpoint (o backend já valida e dá 400 amigável). Só checar extensão/tamanho no cliente.
- Sem nova lib (sem react-dropzone). Drag-and-drop nativo.
- Acessibilidade: input file com `aria-label`; dropzone com `role`/instrução textual visível (Nielsen/ISO).

**Endpoint:** inalterado — `POST /api/v1/admin/discord-sync/import-json`, body `{ json: <conteúdo> }` ou o próprio export. Já aceita os dois (ver `adminDiscordSync.ts:1319`).

**Validação obrigatória:**
- `pnpm --filter @artificio/mesas-frontend test`
- `pnpm --filter @artificio/mesas-frontend build`
- `pnpm run lint`

### Tarefa 2 — DEB-048-11: `GET /settings` 500 no beta (diagnóstico + hardening)

**Não é bug da 048** (rota da Spec 047), mas surgiu no smoke. Escopo aqui = **só hardening do handler**; a causa de dados/env do beta é diagnóstico read-only do mantenedor/Claude.

**Arquivo:** `apps/mesas/backend/src/routes/adminDiscordSync.ts` (handler `GET /settings`, ~linha 394) + `apps/mesas/backend/src/discord/settingsCrypto.ts`.

**Mudança de comportamento desejada:**
- Hoje: falha de decifragem (auth-tag GCM inválido por mismatch de `JWT_SECRET`) lança `Error` genérico → `sendSettingsError` → **500**.
- Desejado: distinguir **falha de decifragem** (credencial existe mas não decifra com a chave atual) de erro real de servidor.
  - Criar erro tipado `DiscordSettingsDecryptError` em `settingsCrypto.ts`; `decryptDiscordSetting` envolve as duas tentativas (v2 + legacy) e, se ambas falharem por erro de cripto, lança `DiscordSettingsDecryptError` (preservar `DiscordSettingsSecretUnavailableError` quando falta `JWT_SECRET`).
  - No handler `GET /settings`: ao pegar `DiscordSettingsDecryptError`, responder **200** com `{ data: { bot_token: { is_set: true, preview: null, updated_at, decrypt_error: true } } }` (estado "configurado mas ilegível com a chave atual") em vez de 500. Frontend mostra aviso "credencial ilegível, regrave o token".
  - Demais erros continuam 500.

**Regras:** não imprimir token/segredo em log. Não logar `value` cifrado bruto.

**Validação obrigatória:**
- `pnpm --filter @artificio/mesas-backend test` (adicionar teste: decrypt falho → 200 com `decrypt_error`, não 500)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`

### Não fazer
- Não reverter o fix DEB-048-10 (embed `.nullish()`).
- Não mexer em `AGENTS.md`.
- Não commitar/pushar/abrir PR sem autorização nominal.
- Não tocar VM/cron/script diário (Fase E).
- Não adicionar lib nova.
- Não responder bots/reviews no PR.

## Gates de validação

- [x] `pnpm --filter @artificio/mesas-backend test` — 183/183 ✅ (3 testes novos do embed-null, T-FIX1)
- [x] `pnpm --filter @artificio/mesas-backend build` — ✅
- [x] `pnpm --filter @artificio/mesas-frontend test` — 19/19 ✅
- [x] `pnpm --filter @artificio/mesas-frontend build` — ✅
- [x] `pnpm run lint` — 15/15 ✅
- [x] `pnpm run build` — 17/17 ✅
- [ ] **Smoke beta com upload real/sanitizado** — ÚNICO gate do MVP ainda aberto. Os fixes DEB-048-10/11/12 estão em `dev`; falta confirmar deploy beta + re-smoke com `extracao_json.json` (read-only VM p/ checar commit do beta antes).

## Fechamento obrigatório

- [x] Atualizar `specs/backlog.md` — `BL-MESAS-DISCORD-EXPORTER-048` atualizado com status MVP.
- [x] Atualizar `.specify/memory/project-state.md` — seção 048 adicionada com implementação e smoke findings.
- [ ] Atualizar sessão ativa — refletir implementação de DEB-048-11 e DEB-048-12 (status pós-smoke).
- [x] Registrar decisão de migration: **nenhuma**. MVP usa `discord_import_messages` existente, sem migration nova.
- [x] Registrar decisão de automação VM: **não implementar agora**. Futuro em Fase E quando aprovado nominalmente.

## Handoff #3 — PR-1 Fase C (parser hardening) — para DeepSeek (2026-06-26)

> Arquitetura/diagnóstico por Claude (Opus). Implementação por DeepSeek. Escopo de fechamento da 048 = Fases C + F + G (decisão mantenedor); **este handoff cobre só o PR-1 = Fase C** (parser determinístico, sem migration, sem IA). Branch própria → PR → dev. **Não commitar/pushar/abrir PR sem autorização nominal.**

### Contexto verificado (origin/dev)
- Parser canônico: `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`. Entry: `parseDiscordAnnouncement(message: ImportRawMessage, systems): ImportTableDraft | null`.
- Texto-base no parse: `fullText = threadName + body` (body = `content_raw` ou extraído de `embeds`).
- Extractors atuais (regex puro, SEM chrono-node/fuzzball — experimentos foram descartados, **não readicionar lib sem reabrir DEB-048-07**):
  - `extractPrice` (L191), `extractSlots` (L208), `extractDayOfWeek` (L251), `extractStartTime` (L269), `extractContactUrl` (L287), `extractContactDiscord` (L292), `extractHostDiscordId` (L320), `extractLabelValue`, `calcConfidence` (~L398).
- `ImportRawMessage` (types.ts L92+) tem `discord_author_id`, `discord_author_name`, `content_raw`, `attachments`, `embeds`.
- Testes: `apps/mesas/backend/src/discord/__tests__/parseDiscordAnnouncement.test.ts` (objetos inline; **não há** fixture de arquivo hoje).
- JSON real (fora do git): `C:\projetos\artificio\spec047-backup\extracao_json.json` (100 msgs; 4 com `<t:>`, 11 Google Forms, 60 role mentions).

### Ordem obrigatória

**T-F4 (pré-requisito) — fixture sanitizada versionável.** Criar fixture pequena baseada em padrões reais do `extracao_json.json`, **sanitizada** (sem nomes/IDs reais; usar dados fictícios que reproduzam os padrões `<t:>`, forms, "me chama", `3 de 5`, etc.). Local sugerido: `apps/mesas/backend/src/discord/__tests__/fixtures/chatExporterSample.ts` (objeto TS, não o export real). **Não commitar o export real.** Esta fixture alimenta os testes de matriz das T-C abaixo.

**T-C1 — Discord timestamp `<t:UNIX:F>` / `<t:UNIX:t>`.**
- Adicionar `extractDiscordTimestamp(text): { dayOfWeek: string|null; startTime: string|null } | null` — regex `/<t:(\d+):[a-zA-Z]>/`, converter `unix*1000` → `Date`, derivar dia da semana (pt) + `HH:MM`.
- No `parseDiscordAnnouncement`, **preferir** o timestamp Discord sobre `extractDayOfWeek`/`extractStartTime` quando presente (timestamp nativo é mais confiável que texto incidental).
- Teste: 4 padrões reais da fixture → dia/hora corretos; texto sem `<t:>` cai no comportamento atual.

**T-C2 — Google Forms como contato/recrutamento.**
- Detectar `forms.gle` e `docs.google.com/forms` no texto e classificar como link de recrutamento/contato (campo apropriado do draft; conferir `ImportTableDraft`/`DiscordTableDraftTable`).
- `extractContactUrl` (L287) pega a 1ª URL qualquer — refinar p/ priorizar/identificar form. Não quebrar contato por discord invite existente.
- Teste: msg com `forms.gle/...` → form identificado; msg sem form → inalterado.

**T-C3 — Contato implícito pelo autor.**
- Frases: "me mande mensagem", "me chama", "fale comigo", "chama no pv", "este perfil" (cobrir variações comuns) → marcar contato via **autor da mensagem** (`message.discord_author_id`/`discord_author_name`), já que `extractContactDiscord` (L292) só acha menção explícita em linha com label `contato/ticket/inscrição`.
- Cuidado com falso-positivo: exigir contexto de recrutamento/contato, não disparar em qualquer "me chama". Documentar a heurística inline.
- Teste: frases-alvo → contato=autor; texto neutro → sem contato.

**T-C6 — Vagas informais.**
- Estender `extractSlots` (L208) p/ `3 de 5`, `0/5` (sem label `vagas`), `1 vaga via forms`, `mesa em andamento` (→ sinaliza sem vaga / em curso).
- Preservar os padrões já cobertos (não regredir os matches atuais). Usar `ambiguity` quando o par for ambíguo (já existe o mecanismo `x_slash_y`).
- Teste: cada padrão novo + os antigos (matriz antes/depois).

### Fora do PR-1 (não fazer aqui)
- T-C4 (role mentions como tags), T-C5, T-C7, T-C8 (sistema próprio/inspirado), T-C9 (attachments/embeds como evidência) → PR-1 pode incluí-los se baratos, mas o **mínimo** é C1/C2/C3/C6. Não bloquear o PR por eles.
- Nenhuma migration, nenhuma lib nova, nenhuma IA, nenhuma mudança de UI, nenhum VM/cron. Não tocar `manual_paste` (anti-regressão 047, T-F10).

### Gates de validação (antes de entregar)
- `pnpm --filter @artificio/mesas-backend test` (todos os novos testes de matriz verdes + suíte existente sem regressão)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`
- Atualizar `tasks.md` (marcar T-C1/C2/C3/C6 + T-F4), `debitos.md` (DEB-048-03 → progresso/fechamento parcial), sessão.

### Não fazer
- Não readicionar `chrono-node`/`fuzzball` sem reabrir DEB-048-07 com matriz.
- Não commitar o `extracao_json.json` real.
- Não responder bots/reviews no PR.
- Não commitar/pushar/abrir PR sem autorização nominal do mantenedor.

## Handoff #4 — PR-2 Fase F (robustez) — para DeepSeek (2026-06-26)

> Arquitetura/diagnóstico por Claude (Opus). Implementação por DeepSeek. Pré-req: PR-1 (Fase C) já no working tree. Escopo deste PR-2 = **mínimo de robustez pra fechar 048 honesto**: T-F2, T-F3, T-F5, T-F10. Sem migration, sem lib nova, sem IA, sem tocar UI de produto além do necessário pra sanitizar render. Branch própria → PR → dev. **Não commitar/pushar/abrir PR sem autorização nominal.**

### Contexto verificado (working tree / origin/dev)
- Endpoint: `apps/mesas/backend/src/routes/discord/import.ts` → `POST /` (`requireAdmin`). Chama `extractJsonPayload(req.body)` então `importDiscordChatExporterJson(payload)`.
- **Limite de corpo é só global:** `apps/mesas/backend/src/server.ts:88` → `express.json({ limit: '12mb' })`. **Não há** guarda de tamanho/contagem por rota no import-json. Cliente valida só 5MB de **capa** (`useDraftForm.ts:161`), não do JSON.
- Serviço: `apps/mesas/backend/src/discord/chatExporterImportService.ts`.
  - `importDiscordChatExporterJson(raw)` (L43): `parseDiscordChatExporterJson(raw)` → `const { messages } = exportData` (L45) → loop `for (const msg of messages)` (L68). `messages.length` disponível L47/111.
  - `extractJsonPayload(rawBody)` (L119): aceita `{json: string}` (faz `JSON.parse`) ou `{messages}` direto; erro→`{error,status:400}`.
- Log atual: `import.ts:31` `console.error('[POST /admin/discord-sync/import-json]', error)` — pode arrastar trecho de payload no `error`.

### Ordem obrigatória

**T-F2 — Guarda server-side de tamanho + contagem (segurança/DoS).**
- Definir constantes no backend (ex.: `MAX_IMPORT_MESSAGES = 2000`, `MAX_IMPORT_JSON_BYTES` coerente com o `12mb` global — manter ≤ global). Documentar inline a escolha.
- Validar **após** parse, em `importDiscordChatExporterJson` (ou no `extractJsonPayload`): se `messages.length > MAX_IMPORT_MESSAGES` → erro tipado (reusar/estender `DiscordChatExporterValidationError`) → rota responde **400/413** com mensagem amigável (ex.: `"Importação muito grande: N mensagens (limite X). Divida o export."`).
- Opcional barato: checar tamanho da string JSON em `extractJsonPayload` antes do `JSON.parse` (cota `MAX_IMPORT_JSON_BYTES`) → 413.
- Não confiar só no `express.json limit` (devolve erro genérico feio; queremos mensagem do domínio).
- Teste: payload com `length` acima do limite → 400/413 + mensagem; no limite → passa.

**T-F3 — Sanitização/privacidade (não vazar dado bruto).**
- `import.ts:31`: parar de logar o `error` cru se ele puder conter payload. Logar só `error.message`/`error.name` (ou um resumo), **nunca** o JSON/conteúdo de mensagens. Aplicar o mesmo cuidado em qualquer `console.*` do serviço/adapter que toque `raw`/`messages`.
- Render do preview: garantir que conteúdo bruto de mensagem (`content_raw`) **não** é injetado como HTML. Conferir `DiscordJsonImportPanel.tsx` e o componente de preview/drafts — se já usa texto (React escapa por padrão), só registrar a verificação; se houver `dangerouslySetInnerHTML`/render de HTML, sanitizar (DOMPurify, regra pétrea de HTML hostil) ou forçar texto.
- Teste/evidência: unit do logger sanitizado (se viável) + nota na sessão confirmando ausência de `dangerouslySetInnerHTML` no caminho do preview.

**T-F5 — Teste de performance 100 msgs.**
- Teste que monta payload de ~100 mensagens (reusar/gerar a partir da fixture `chatExporterSample.ts`, multiplicando) e roda `parseDiscordChatExporterJson` + parser. Asserção de sanidade: completa sem throw e em tempo razoável (sem número mágico frágil; um teto generoso só pra pegar regressão O(n²)). Memória: garantir que não acumula estrutura desnecessária.

**T-F10 — Anti-regressão 047.**
- Teste/checklist provando: (a) caminho `manual_paste` (inbox 047) **intocado** — import-json não escreve nem reclassifica drafts de paste manual; (b) **nenhuma** auto-publicação (draft entra como rascunho/pending, nunca published); (c) drafts Discord não se misturam com Inbox indevidamente.
- Pode ser asserção em teste existente + nota explícita na sessão.

### Avaliar e (provavelmente) adiar — registrar decisão, não implementar sem aprovação
- **T-F1** migration `discord_import_runs` (file_hash/counts/admin_id/error/dateRange): **migration = aprovação nominal + guard online-safe (spec 050)**. Recomendação: adiar; registrar em `debitos.md` como DEB próprio se decidir que agrega. Não criar migration neste PR.
- **T-F6** reparse controlado, **T-F7** anexos grandes, **T-F8** replies/threads, **T-F9** mapa `metadata`: documentar a decisão (impl leve só se barata e sem risco; senão adiar com débito). Não bloquear o PR-2 por eles.

### Gates de validação (antes de entregar)
- `pnpm --filter @artificio/mesas-backend test` (novos testes F2/F5/F10 verdes + suíte sem regressão)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`
- Atualizar `tasks.md` (marcar T-F2/F3/F5/F10 + decisão F1/F6/F7/F8/F9), `debitos.md`, sessão.

### Não fazer
- Sem migration (T-F1 adiada), sem lib nova, sem IA, sem VM/cron, sem mexer em `manual_paste`.
- Não readicionar `chrono-node`/`fuzzball`.
- Não responder bots/reviews no PR.
- Não commitar/pushar/abrir PR sem autorização nominal do mantenedor.

## Handoff #5 — PR-3 DEB-048-13 (anexos, T-F7) + DEB-048-14 (replies, T-F8) — para DeepSeek (2026-06-26)

> Arquitetura/diagnóstico por Claude (Opus). Implementação por DeepSeek. Determinístico, sem migration, sem lib nova, sem IA. Branch própria → PR → dev. **Não commitar/pushar/abrir PR sem autorização nominal.**

### Contexto verificado (working tree pós PR #98)
- Adapter: `apps/mesas/backend/src/discord/chatExporterAdapter.ts:37` `adaptMessageToImportRaw(msg, exportData)` monta `ImportRawMessage`. Hoje carrega `attachments`, `embeds` mas **NÃO** carrega `reference`.
- Tipo destino: `ImportRawMessage` (`types.ts:92`) tem `attachments: unknown[]`, `embeds: unknown[]`, `content_raw`, mas **não tem** campo `reference`.
- Schema fonte (`discordChatExporterTypes.ts`):
  - `discordChatExporterAttachmentSchema` (L14): só `id`, `url`, `fileName`, `fileSizeBytes` — **NÃO tem** `content_type`/`width`/`size`.
  - `discordChatExporterReferenceSchema` (L54): só `messageId`, `channelId?`, `guildId?` — **NÃO tem** `content`.
  - `discordChatExporterMessageSchema.reference` (L86) existe e é parseado, mas ignorado no pipeline.
- Parser: `parseDiscordAnnouncement.ts`
  - `extractCoverFromAttachments` (L49): lê `content_type`/`width`/`size` (formato do **bot-fetch**, não do ChatExporter). **BUG latente:** em JSON do ChatExporter esses campos não existem → cover **nunca casa** por esse caminho.
  - Notas do draft = campo **`n: string[]`** (`types.ts`), montado em `parseDiscordAnnouncement` (`n: matchedSystem?.notes ?? []`). O "_notes" da decisão = este `n`.

### DEB-048-13 — anexos grandes/vídeos (T-F7)
Decisão já documentada (debitos.md DEB-048-13): imagens→cover (futuro Cloudinary), vídeos→só URL, grandes→preservar metadata. **Implementar agora (sem download):**
1. **Corrigir `extractCoverFromAttachments` p/ o formato ChatExporter:** detectar imagem por **extensão do `fileName`** (`.png/.jpg/.jpeg/.webp/.gif`; excluir `.svg`) já que não há `content_type`. Manter compat com o formato bot-fetch (checar ambos: `content_type` se existir, senão extensão). Sem `width`/`size` no ChatExporter → `quality: 'low'` por padrão (ou heurística por `fileSizeBytes` se presente).
2. **Preservar referência de anexos não-imagem** (vídeo/arquivo grande) em `n`: ex. `"Anexo: nome.mp4 (12.3 MB) — URL"`. Vídeo nunca baixado. Guardar guarda de tamanho legível via `fileSizeBytes`.
3. **Não** baixar nada, **não** Cloudinary, **não** migration.
- Teste: fixture com attachment imagem `.png` → cover detectado; attachment `.mp4` → nota em `n`, sem cover.

### DEB-048-14 — replies/threads (T-F8)
Decisão (debitos.md DEB-048-14): reply com conteúdo próprio = anúncio independente (atual, manter); reply só-referência = contexto em `n`.
1. **Carregar `reference` no adapter:** adicionar `reference` ao `ImportRawMessage` (campo opcional `reference?: { messageId: string } | null`) e popular em `adaptMessageToImportRaw` a partir de `msg.reference`.
2. **Resolver a msg referenciada dentro do mesmo export:** como `reference` só tem `messageId` (sem `content`), no serviço (`chatExporterImportService.ts`, antes/durante o loop) montar um índice `Map<messageId, contentSnippet>` do próprio `exportData.messages`; quando uma msg tem `reference.messageId` presente no índice, anexar em `n`: `"Em resposta a: <primeiros ~80 chars do conteúdo referenciado>"`.
3. **Reply sem match** (referência fora do export) → ignorar silenciosamente (não quebrar).
4. **Não** alterar `manual_paste`, **não** migration.
- Teste: fixture com 2 msgs, B referencia A → draft de B tem nota "Em resposta a: <A>"; referência órfã → sem nota, sem erro.

### Gates de validação (antes de entregar)
- `pnpm --filter @artificio/mesas-backend test` (novos testes 13/14 + suíte sem regressão)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`
- Atualizar `debitos.md` (DEB-048-13/14 → resolvido), `tasks.md` (T-F7/T-F8), sessão.

### Não fazer
- Sem migration, sem lib nova, sem IA, sem VM/cron, sem download de mídia/Cloudinary (fica futuro).
- Não tocar `manual_paste` nem auto-publicação.
- Não responder bots/reviews no PR.
- Não commitar/pushar/abrir PR sem autorização nominal do mantenedor.

## Handoff #6 — PR-4 fixes de review da PR #98 (REV-007..012 / DEB-048-16..21) — para DeepSeek (2026-06-26)

> Investigação/veredito por Claude (Opus): os 6 reviews foram verificados contra o código real (procedem todos). Implementação por DeepSeek, **tudo na branch `feat/048-fase-cf-hardening`** (mesma da PR #98). Determinístico, sem migration, sem lib nova, sem IA. **Não commitar/pushar sem autorização nominal. Não responder os bots no PR.**

### Ordem obrigatória (por prioridade — segurança/dado primeiro, dedup por último)

**1. DEB-048-19 / REV-010 — `Array.isArray` em `messageIds` (Major, viola regra pétrea).** `import.ts:41-51`.
- `const { messageIds } = req.body ?? {}` é `unknown` até validar. Antes de usar `.length`/`in`: `Array.isArray(messageIds) && messageIds.length > 0 && messageIds.every(id => typeof id === 'string')`.
- Se `messageIds` presente mas inválido (ex.: string) → **400** com mensagem. Se ausente → fluxo sem filtro de ids (comportamento atual).
- **Remover o `as any`** da cláusula `.where('discord_message_id', 'in', messageIds)` (tipo já é `string[]` após o guard).
- Teste: body `{messageIds:"abc"}` → 400; `{messageIds:["x"]}` → ok; sem campo → ok.

**2. DEB-048-16 / REV-007 — reordenar `extractSlots` (P2, perda de dado).** `parseDiscordAnnouncement.ts:247-273`.
- Mover o guard `mesa em andamento` (L251-253) para **depois** de todos os padrões explícitos (`viaFormsMatch` L256, `deMatch` L266, `vagas totais/disponíveis` L275+). Guard vira **fallback final** (só retorna `null,null` se nenhum padrão explícito casou).
- Não regredir os matches atuais.
- Teste: `"Mesa em andamento. 1 vaga via forms"` → `{total:1, open:1}` (não mais `null,null`); `"Mesa em andamento"` sozinho → `null,null`.

**3. DEB-048-17 / REV-008 — filtro de status no `/reparse` (P2, feature quebrada).** `import.ts:43-51`.
- Quando `messageIds` é fornecido (após o guard do item 1), **incluir `'parsed'`** no filtro de status (ou remover o filtro de status e confiar no guard `message.status === 'synced'` do loop, L65). Sem `messageIds` → manter `['pending','needs_review']` (evita reprocessar tudo).
- Bônus achado (corrigir junto): no ramo `if (!result)` (L68-74) o status vira `'ignored'` mas conta como `reparsed++` — separar contagem ou renomear, para o retorno refletir realidade.
- Teste: msg `status='parsed'` + `messageIds=[id]` → reprocessada; `status='synced'` → pulada.

**4. DEB-048-18 / REV-009 — fuso em `extractDiscordTimestamp` (Minor).** `parseDiscordAnnouncement.ts:346-362`.
- Converter o instante UTC para **fuso de São Paulo** antes de extrair dia/hora. **Preferir `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday/hour/minute })`** (robusto a horário de verão histórico) em vez de offset fixo −3h (frágil). Se optar por offset fixo como mínimo, documentar a limitação inline.
- Garantir `dayOfWeek` derivado do mesmo instante convertido (evita cruzar meia-noite errado).
- Teste: `<t:UNIX>` de um sábado 19h BR → `{dayOfWeek:'sábado', startTime:'19:00'}`, não 22:00/domingo.

**5. DEB-048-20 / REV-011 — catch do loop `/reparse` (Minor).** `import.ts:124-130`.
- `} catch {` → `} catch (err) {`. Envolver o `db.updateTable(... status:'error' ...)` em **try/catch próprio**; se a update falhar, logar `err instanceof Error ? err.message : 'unknown'` e **continuar o loop** (não deixar escapar pro catch externo → não abortar o lote).
- Preservar a causa real: `parse_error: err instanceof Error ? err.message : 'Erro no reparse em lote'` (em vez da string genérica).
- Teste: simular throw no update → loop continua, retorno reflete erros sem 500 global.

**6. DEB-048-21 / REV-012 — dedup boilerplate (Info, POR ÚLTIMO).** `import.ts`.
- **Só depois** dos itens 1-5 (que remodelam o `/reparse`). Extrair helper compartilhado de erro: `respondImportError(res, error)` mapeando `DiscordChatExporterValidationError`→400, senão `console.error(..., error.message)` + 500. Opcional: helper de envelope `{ data }`.
- **Não** abstrair lógica de negócio (loop, query, reconcile) — só o boilerplate de catch/envelope.
- Validar que a métrica de duplicação cai sem perder legibilidade.

### Gates de validação (antes de entregar)
- `pnpm --filter @artificio/mesas-backend test` (novos testes 1-5 + suíte sem regressão)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`
- Atualizar `debitos.md` (DEB-048-16..21 → resolvido), `reviews.md` (status implementado), sessão.

### Não fazer
- Sem migration, sem lib nova, sem IA, sem VM/cron.
- Não tocar `manual_paste` nem auto-publicação.
- Não responder/reagir aos bots (CodeRabbit/Codex) no PR.
- Não commitar/pushar sem autorização nominal do mantenedor.

## Handoff #7 — DEB-048-01 (JSON inválido/truncado → erro amigável, quick win pré-deploy) — para DeepSeek (2026-06-26)

> Investigação Claude (Opus): DEB-048-01 está **parcialmente coberto**. Falta fechar o gap do **string truncado**. Determinístico, só testes + fixture; sem migration, sem lib, sem mudança de runtime de produto. Tudo na branch `feat/048-fase-cf-hardening`. **Não commitar/pushar sem autorização nominal.**

### Contexto verificado (working tree)
- **2 caminhos de erro distintos:**
  1. **String JSON malformado/truncado** (caso do `extracao_json2.json` real, truncado ~linha 3042): `extractJsonPayload` (`chatExporterImportService.ts:119`) faz `JSON.parse` do campo `json`; no catch retorna `{ error: 'JSON inválido: …', status: 400 }`. **Sem teste hoje.**
  2. **JSON válido mas schema inválido** (faltando `messages`/`guild`/`channel`, tipos errados): `parseDiscordChatExporterJson` (`chatExporterAdapter.ts:13`) usa `discordChatExporterExportSchema.safeParse` e lança `DiscordChatExporterValidationError` com mensagem amigável (`adapter:17,22`). **Parcialmente coberto:** `chatExporterAdapter.test.ts:55` já testa "rejeita JSON sem campo messages".
- Fixtures: `apps/mesas/backend/src/discord/__tests__/fixtures/chatExporterSample.ts`. **NÃO commitar** `extracao_json2.json` real (139KB, dados reais).

### O que fazer (só o gap)

**1. Fixture negativa sanitizada.** Em `fixtures/chatExporterSample.ts` (ou `chatExporterSampleInvalid.ts`), adicionar exports pequenos e fictícios:
- `truncatedJsonString`: uma string JSON **deliberadamente truncada/malformada** (ex.: `'{"guild":{"id":"g1"},"messages":[{"id":"1","con'`) — reproduz o modo de falha do json2 sem dados reais.
- `schemaInvalidExport`: objeto JSON **válido sintaticamente** mas inválido no schema (ex.: sem `guild`/`channel`, ou `messages` não-array, ou `timestamp` com tipo errado).

**2. Testes do gap.**
- **`extractJsonPayload` com string truncada** (`chatExporterImportService.test.ts`; `extractJsonPayload` é função pura, **não** mockar): `extractJsonPayload({ json: truncatedJsonString })` → retorna `{ status: 400, error: <mensagem amigável> }`, **não** lança stack. Assertar que a mensagem é clara (contém "JSON inválido").
- **`parseDiscordChatExporterJson` schema inválido (real, não-mockado)** em `chatExporterAdapter.test.ts`: estender além do "sem messages" — sem `guild`/`channel` e `messages` não-array → lança `DiscordChatExporterValidationError` com `.message` legível (não stack cru).
- **Privacidade (cross-ref DEB-048-03):** assert que a mensagem de erro **não** despeja o payload inteiro nem stack — só descrição amigável.

**3. Fechar débito.** Marcar DEB-048-01 fechado em `debitos.md` com evidência (testes + fixture), e nota: cobre os 2 modos de falha (string malformado + schema inválido).

### Gates de validação
- `pnpm --filter @artificio/mesas-backend test` (novos testes verdes + suíte sem regressão)
- `pnpm --filter @artificio/mesas-backend build`
- `pnpm run lint`

### Não fazer
- **Não commitar `extracao_json2.json` real** (sanitizar a fixture).
- Sem migration, sem lib nova, sem IA, sem mudança de comportamento de runtime (só testes + fixture).
- Não responder/reagir aos bots no PR.
- Não commitar/pushar sem autorização nominal do mantenedor.

## Pós-smoke beta 2026-06-26 — pendências de UX/perf (para Codex; NÃO implementar agora)

> Descobertas no smoke beta real com `extracao_json.json`. Bug de schema (DEB-048-23) já corrigido na PR `fix/048-chatexporter-nullish-reference`. As tasks abaixo (DEB-048-24/25) ficam REGISTRADAS para continuidade com o Codex — não implementar nesta rodada.

- [x] T-SMOKE.1 — Corrigir schema Zod p/ `reference.guildId` null + `forwardedMessage` sem author (DEB-048-23). Feito: `.nullish()` + coerção no adapter + teste de regressão + validação local contra JSON real (99/100 drafts). PR `fix/048-chatexporter-nullish-reference`.

- [ ] T-UX.1 — **Import por arquivo sem colar no textarea (DEB-048-24).** Hoje `useJsonImport.ts:118 handleFileSelect` → `file.text()` → `setRawJson(content)` → `DiscordJsonImportPanel.tsx:29 <FileDropzone value={rawJson}>` trava com 500KB+. Feito quando: arquivo vai direto ao backend (upload temporário multipart/stream, efêmero, com guarda T-F2), textarea só p/ paste manual, preview de arquivo = resumo (nome/tamanho/contagem) e não o JSON cru. Sem persistir arquivo em disco permanente.
- [ ] T-UX.2 — **Repensar fluxo de ingestão unificado (DEB-048-25).** Import JSON (aba Discord-sync) vs paste manual (Inbox) estão fragmentados. Feito quando: proposta de UX (wireframe/fluxo) unificando origens (arquivo JSON, paste manual, futuro VM/Fase E) avaliada contra Nielsen + ISO 9241-11, aprovada pelo mantenedor, ANTES de código.

### Anchors para o Codex
- Hook de import: `apps/mesas/frontend/src/features/discord-sync/hooks/useJsonImport.ts` (`handleFileSelect` L118, `schedulePreview`/`setRawJson` ~L51-73).
- Painel/textarea: `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx` (`<FileDropzone value={rawJson}>` L29).
- API client: `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts` (`previewJson`/`importJson`).
- Backend import: `apps/mesas/backend/src/routes/discord/import.ts` (`POST /`, `POST /reparse`), `chatExporterImportService.ts` (`extractJsonPayload`, `importDiscordChatExporterJson`, guardas `MAX_IMPORT_*`).
- Inbox manual (paste): `apps/mesas/frontend/src/features/inbox/*` + `apps/mesas/backend/src/routes/inbox/*`.
