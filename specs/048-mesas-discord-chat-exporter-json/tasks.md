# Tasks — 048 Importador DiscordChatExporter JSON

> Continuação da Spec 047. Esta spec começa por auditoria/planejamento; implementação só com autorização posterior.

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

- [ ] T-C1 — Parse de timestamp Discord `<t:UNIX:F>` e `<t:UNIX:t>`.
- [ ] T-C2 — Google Forms como contato/recrutamento:
  - `forms.gle`
  - `docs.google.com/forms`
- [ ] T-C3 — Contato implícito pelo autor:
  - “me mande mensagem”;
  - “me chama”;
  - “fale comigo”;
  - “este perfil”.
- [ ] T-C4 — Role mentions `<@&id>` como tags/evidências brutas.
- [ ] T-C5 — User mentions `<@id>` / `<@!id>` como possível contato.
- [ ] T-C6 — Vagas:
  - `3 de 5`;
  - `0/5`;
  - `5 vagas`;
  - `1 vaga via forms`;
  - `mesa em andamento`.
- [ ] T-C7 — Mesa paga/gratuita:
  - preço por sessão;
  - sessão zero gratuita;
  - gratuita com custo de plataforma.
- [ ] T-C8 — Sistema próprio/inspirado em.
- [ ] T-C9 — Attachments/embeds como evidências:
  - imagem candidata a capa;
  - `.txt` como material complementar;
  - links de formulário/site/YouTube;
  - thumbnail/canonicalUrl.

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

- [ ] T-F1 — Avaliar migration `discord_import_runs`.
  - Só implementar se necessário.
  - Campos candidatos: file_hash, filename, source_id, dateRange, exportedAt, counts, admin_id, error.

- [ ] T-F2 — Limite de tamanho de upload.
  - Definir limite inicial.
  - Erro 413/400 amigável.

- [ ] T-F3 — Sanitização/privacidade.
  - Não renderizar conteúdo bruto sem sanitizar.
  - Não despejar JSON inteiro em logs.

- [ ] T-F4 — Fixture reduzida versionável.
  - Criar fixture sanitizada pequena baseada no JSON real.
  - Não commitar export real completo.

- [ ] T-F5 — Teste de performance com 100 mensagens.
  - Garantir endpoint não explode tempo/memória.

- [ ] T-F6 — Reprocessamento controlado.
  - Botão/endpoint para reparsear mensagens importadas por JSON.
  - Não reprocessar `synced` sem confirmação.

- [ ] T-F7 — Estratégia para anexos grandes/vídeos.
  - Preservar metadata no MVP.
  - Planejar download/Cloudinary em fase futura.

- [ ] T-F8 — Estratégia para replies/threads.
  - A amostra tem 1 `Reply`.
  - Decidir se reply vira anúncio, contexto ou ignorado.

- [ ] T-F9 — Mapa de campos para `metadata`.
  - `guild.name`, `guild.iconUrl`, `channel.category`, `topic`, `mentions`, `inlineEmojis`, `roles`, `reference`.

- [ ] T-F10 — Checklist anti-regressão 047.
  - Não quebrar `manual_paste`.
  - Não misturar drafts Inbox em Discord indevidamente.
  - Não publicar automaticamente.

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
- [ ] Smoke beta com upload real/sanitizado

## Fechamento obrigatório

- [x] Atualizar `specs/backlog.md` — `BL-MESAS-DISCORD-EXPORTER-048` atualizado com status MVP.
- [x] Atualizar `.specify/memory/project-state.md` — seção 048 adicionada com implementação e smoke findings.
- [ ] Atualizar sessão ativa — refletir implementação de DEB-048-11 e DEB-048-12 (status pós-smoke).
- [x] Registrar decisão de migration: **nenhuma**. MVP usa `discord_import_messages` existente, sem migration nova.
- [x] Registrar decisão de automação VM: **não implementar agora**. Futuro em Fase E quando aprovado nominalmente.
