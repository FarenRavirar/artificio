# Plano — 048 Importador DiscordChatExporter JSON

## 1. Arquitetura da solução

A Spec 048 é a evolução natural da Spec 047: a 047 provou o fluxo de **Inbox → draft revisável → correção humana → sync manual para mesa em `draft`**. A 048 troca a entrada frágil de texto colado por uma fonte Discord real, mas preserva o contrato de produto: **nada publica automaticamente no MVP**.

Arquitetura operacional, no mesmo estilo da Spec 047:

```text
┌──────────────────────────────────────────────────────────────┐
│  UI Admin (/gestao → Discord Sync / Importação JSON)         │
│                                                              │
│  ┌───────────────────────┐  ┌─────────────────────────────┐ │
│  │ Upload JSON manual     │  │ Resultado da importação      │ │
│  │ DiscordChatExporter    │  │ inserted/updated/ignored     │ │
│  │ (MVP)                  │  │ parse_errors/drafts/link     │ │
│  └───────────┬───────────┘  └──────────────┬──────────────┘ │
│              │ POST /api/v1/admin/discord-sync/import-json  │
│              │                                               │
│  ┌───────────▼────────────────────────────────────────────┐  │
│  │ Revisão de Drafts                                      │  │
│  │ reusa fluxo da 047: DiscordDraftPreview/api injetável  │  │
│  │ + score/confidence gates + dúvidas para admin          │  │
│  └───────────┬────────────────────────────────────────────┘  │
└──────────────┼───────────────────────────────────────────────┘
               │
┌──────────────▼───────────────────────────────────────────────┐
│  Backend: apps/mesas/backend/src/                            │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ ALTERAR: routes/adminDiscordSync.ts                    │   │
│  │  POST /import-json → valida JSON → importa mensagens   │   │
│  │  authMiddleware + admin guard                          │   │
│  │  retorna resumo + drafts criados/atualizados           │   │
│  └──────────┬────────────────────────────────────────────┘   │
│             │                                                │
│  ┌──────────▼────────────────────────────────────────────┐   │
│  │ NOVO: discord/chatExporter/types.ts ou equivalente     │   │
│  │  entrada externa = unknown                             │   │
│  │  Zod/normalizador para guild/channel/messages          │   │
│  │  preserva opcionais: mentions, emojis, reactions,      │   │
│  │  reference, stickers, forwardedMessage, attachments    │   │
│  └──────────┬────────────────────────────────────────────┘   │
│             │                                                │
│  ┌──────────▼────────────────────────────────────────────┐   │
│  │ NOVO: discord/chatExporter/adapter.ts                  │   │
│  │  DiscordChatExporterMessage → DiscordApiMessage        │   │
│  │  ou ImportRawMessage interno                           │   │
│  │  cada messages[] = 1 candidato; sem segmentAnnouncements│  │
│  └──────────┬────────────────────────────────────────────┘   │
│             │                                                │
│  ┌──────────▼────────────────────────────────────────────┐   │
│  │ NOVO: discord/importChatExporterJson.ts                │   │
│  │  cria/reusa discord_import_sources                     │   │
│  │  chama persistMessages()/função irmã                   │   │
│  │  source_kind='discord_chat_exporter_json'              │   │
│  │  idempotência por channel_id + message_id              │   │
│  │  mensagem editada → content_hash muda → status pending │   │
│  └──────────┬────────────────────────────────────────────┘   │
│             │                                                │
│  ┌──────────▼────────────────────────────────────────────┐   │
│  │ EXISTENTE + HARDENING 048                              │   │
│  │  discord/parseDiscordAnnouncement.ts                   │   │
│  │   + <t:UNIX:F/t>, Google Forms, contato por autor,     │   │
│  │     role/user mentions, vagas, preço, sistema próprio  │   │
│  │  discord/normalizeDiscordTableDraft.ts                 │   │
│  │  discord/syncDiscordDraftToTable.ts                    │   │
│  └──────────┬────────────────────────────────────────────┘   │
│             │                                                │
│  ┌──────────▼────────────────────────────────────────────┐   │
│  │ DB: Discord real                                      │   │
│  │  discord_import_sources                               │   │
│  │  discord_import_messages                              │   │
│  │   - raw, author, timestamps, url, attachments, embeds  │   │
│  │   - unique(discord_channel_id, discord_message_id)     │   │
│  │  discord_import_table_drafts                           │   │
│  │   - draft revisável, score futuro, status humano       │   │
│  │  import_corrections                                    │   │
│  │   - antes/depois para aprendizado por revisão humana   │   │
│  │  OPCIONAL/FUTURO: discord_import_runs                  │   │
│  │   - arquivo, hash, admin, contagens, erro, auditoria   │   │
│  └───────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Futuro permanente: automação diária na VM                   │
│                                                              │
│  DiscordChatExporter na VM                                   │
│   → incoming/ → processing/ → import-json interno             │
│   → processed/ ou error/                                     │
│   → logs/metrics sem despejar conteúdo bruto completo         │
│                                                              │
│  Regras: idempotente, retenção definida, segredo seguro,      │
│  sem cookie pessoal como solução operacional sem decisão,     │
│  não bloqueia lote por 1 arquivo ruim, sem auto-publicação.   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Futuro opcional: automação inteligente                       │
│                                                              │
│  Correções humanas → aliases/heurísticas/testes/evals         │
│  Score/confidence gates → shadow mode                         │
│  IA auxiliar → few-shot/prompts/eval/fine-tuning só autorizado│
│  Autoaprovação/publicação → somente com evidência + aprovação │
└──────────────────────────────────────────────────────────────┘
```

Leitura por camadas:

```text
Fonte de entrada
  ├─ MVP: upload manual de JSON DiscordChatExporter no painel admin
  └─ Futuro: DiscordChatExporter diário na VM / Bot API / outras fontes

Camada de ingestão
  ├─ valida JSON externo como unknown
  ├─ identifica guild/canal/mensagens
  ├─ rejeita arquivo inválido/truncado sem import parcial invisível
  └─ cria/reusa source Discord

Camada de preservação
  ├─ discord_import_sources
  └─ discord_import_messages
      ├─ raw content
      ├─ autor/timestamp/url Discord
      ├─ attachments/embeds/mentions
      ├─ content_hash
      └─ dedupe por (discord_channel_id, discord_message_id)

Camada de extração
  ├─ adapter DiscordChatExporterMessage → shape interno
  ├─ parseDiscordAnnouncement()
  ├─ heurísticas adicionais da 048
  └─ normalizeDiscordTableDraft()

Camada de draft/revisão
  ├─ discord_import_table_drafts
  ├─ score/confidence gates
  ├─ UI admin de revisão
  ├─ correções humanas antes/depois
  └─ métricas de aprendizado

Camada de publicação
  └─ sync manual cria/atualiza tables.status='draft'
```

### Componentes principais

- **Admin UI:** entrada operacional do MVP. Exibe upload, validação, resumo da importação, falhas e link para revisar drafts.
- **Endpoint admin:** `POST /api/v1/admin/discord-sync/import-json`, com `authMiddleware` e guard admin.
- **Normalizador de export:** valida o JSON do DiscordChatExporter e converte a entrada externa em tipos internos explícitos.
- **Persistência Discord:** usa `discord_import_sources` e `discord_import_messages` como fonte canônica da mensagem Discord.
- **Parser/normalizador de mesa:** reaproveita o pipeline da Spec 047/Discord (`parseDiscordAnnouncement` + `normalizeDiscordTableDraft`) e adiciona hardenings para os padrões reais do JSON.
- **Drafts revisáveis:** continuam em `discord_import_table_drafts`; o admin decide rejeitar, corrigir, aprovar ou sincronizar.
- **Correções e métricas:** registram diferenças entre extração original e correção humana para melhorar heurísticas, aliases, testes e futuras avaliações de IA.

### Fronteira entre 047 e 048

- `manual_paste` e `import_messages` continuam sendo o fluxo genérico da Spec 047.
- DiscordChatExporter JSON é fonte Discord real e entra no caminho `discord_import_*`.
- A 048 não deve reabrir a decisão da 047 de não publicar automaticamente.
- Melhorias de parser que beneficiam ambos os fluxos podem ser reaproveitadas, mas precisam ser testadas contra regressão do `manual_paste`.
- DeepSeek/IA, se usada, é camada auxiliar futura; não é fundação do importador JSON.

## 2. Plano MVP atualizado, herdado da Spec 047

A parte “Fase 2–7” da Spec 047 continua válida como direção de produto, mas na 048 ela deixa de ser roadmap genérico de inbox e vira plano de evolução do importador Discord real.

```text
MVP 048
  1. Upload manual JSON no admin
  2. Validar e preservar fonte Discord
  3. Importar mensagens idempotentemente
  4. Gerar drafts revisáveis
  5. Exibir resumo/falhas
  6. Reaproveitar revisão humana da 047
  7. Nunca publicar automaticamente

Pós-MVP imediato
  8. Melhorar parser com padrões reais do DiscordChatExporter
  9. Adicionar score/confidence gates
 10. Registrar correções antes/depois
 11. Transformar correções em heurísticas/aliases/testes
 12. Medir qualidade por rodada de importação

Automação futura
 13. Rodar DiscordChatExporter diariamente na VM
 14. Importar pasta monitorada com idempotência
 15. Shadow mode antes de qualquer autoaprovação
 16. Autoaprovação/publicação só com evidência + autorização explícita
```

### Fases transferidas da 047 para a 048

| Fase 047 | Como fica na 048 |
|---|---|
| Normalização melhorada | Endurecer parser para timestamps Discord, Google Forms, contato por autor, vagas ambíguas, preço, sessão zero, sistema próprio/inspirado em. |
| Resolução de sistema | Reusar match canônico/alias/normalizado e ampliar aliases a partir das correções humanas do JSON real. |
| Score de qualidade | Virar confidence gate por draft importado, com baixa/média/alta confiança e razões auditáveis. |
| UI de revisão inteligente | Mostrar fonte Discord, bruto, anexos/embeds, campos extraídos, ambiguidades, score e ações de admin. |
| Heurísticas reaproveitáveis | Correções humanas alimentam novas regras determinísticas, antes de qualquer IA. |
| Roadmap futuro | Discord Bot/API, importador diário na VM, dedupe avançado, métricas, shadow mode e possível IA auxiliar. |

### Corte do MVP

Entra no MVP:

- upload manual no painel admin;
- validação de JSON válido/truncado;
- persistência em `discord_import_messages`;
- dedupe por mensagem Discord;
- criação/reuso de `discord_import_sources`;
- geração de drafts revisáveis;
- resumo de importação;
- testes de idempotência, arquivo inválido e padrões reais mínimos;
- documentação de privacidade e retenção.

Não entra no MVP:

- publicação automática;
- autoaprovação;
- download de anexos para Cloudinary;
- job diário na VM;
- bot/API oficial;
- fine-tuning;
- uso de IA como dependência obrigatória do parser.

## 3. Por que não usar `import_messages`

`import_messages` nasceu na Spec 047 para fontes genéricas e inbox multi-origem sem metadados Discord completos. O export do DiscordChatExporter é uma fonte Discord real:

- tem guild;
- tem channel;
- tem message id;
- tem author;
- tem timestamp;
- tem attachments/embeds no shape Discord-like.

Persistir em `import_messages` obrigaria a duplicar dedupe, source tracking e parse routes que já existem no fluxo Discord.

## 4. Tabela e source

### `discord_import_sources`

Representa o canal exportado. Para upload manual:

- buscar por `channel.id`;
- se existir, reutilizar;
- se não existir, criar source:
  - `guild_id = guild.id`;
  - `channel_id = channel.id`;
  - `channel_name = channel.name`;
  - `channel_type = mapChannelType(channel.type)`;
  - `enabled = true`;
  - `auto_sync_enabled = false`.

Não exigir cadastro manual prévio no MVP. O upload deve ser autossuficiente para admin.

### `discord_import_messages`

Cada `messages[]` vira uma linha.

Campos:

- `source_id`: source do canal;
- `discord_message_id`: `message.id`;
- `discord_channel_id`: `channel.id`;
- `discord_guild_id`: `guild.id`;
- `discord_author_id`: `message.author.id`;
- `discord_author_name`: `author.nickname ?? author.name`;
- `discord_message_url`: `https://discord.com/channels/{guild.id}/{channel.id}/{message.id}`;
- `content_raw`: `message.content ?? ''`;
- `attachments`: JSONB com `message.attachments`;
- `embeds`: JSONB com `message.embeds`;
- `message_created_at`: `message.timestamp`;
- `message_edited_at`: `message.timestampEdited`;
- `content_hash`: hash do conteúdo/anexos/embeds relevantes;
- `source_kind`: `discord_chat_exporter_json`;
- `status`: `pending`.

## 5. Adapter

Criar adapter explícito:

```text
DiscordChatExporterExport
DiscordChatExporterMessage
DiscordChatExporterAuthor
DiscordChatExporterAttachment
DiscordChatExporterEmbed
```

Normalizar para shape compatível com o que `persistMessages()` ou uma função irmã espera.

Não usar `any` como contrato público. Entrada externa é `unknown` até passar por Zod/normalizador.

## 6. Endpoint

Recomendado:

```text
POST /api/v1/admin/discord-sync/import-json
```

Motivo:

- é fonte Discord;
- encaixa em `adminDiscordSync.ts`;
- mantém Inbox genérica separada;
- evita confundir `manual_paste` com export Discord real.

Alternativa futura:

```text
POST /api/v1/admin/discord-sync/sources/:id/import-json
```

Útil se quisermos exigir source pré-cadastrada. Não recomendado no MVP porque aumenta fricção.

## 7. Migrations

MVP não deve precisar de migration.

O schema atual já cobre:

- `discord_import_sources`;
- `discord_import_messages`;
- `discord_import_table_drafts`;
- `source_kind='discord_chat_exporter_json'`;
- attachments/embeds JSONB;
- dedupe por `(discord_channel_id, discord_message_id)`.

Migration só deve ser proposta se a implementação provar necessidade de rastrear import runs com auditoria forte. Se necessário, desenhar tabela futura `discord_import_runs` com:

- arquivo original/nome;
- hash do arquivo;
- source_id;
- dateRange;
- exportedAt;
- contagens inserted/updated/ignored/failed;
- erro do parse;
- admin_id;
- created_at.

Essa tabela é opcional/futura; não bloquear MVP se os logs/retorno HTTP forem suficientes.

## 8. Parser — melhorias obrigatórias

A amostra real mostrou padrões que precisam virar tasks, não lembretes soltos:

- tags de tempo Discord: `<t:1750550400:F>`, `<t:1750550400:t>`;
- Google Forms: `forms.gle` e `docs.google.com/forms`;
- contato implícito: “me mande mensagem”, “me chama”, “fale comigo”, “este perfil”;
- author como contato fallback;
- role mentions `<@&id>` preservadas como tags/evidências;
- user mentions `<@id>` como possível contato;
- vagas: `3 de 5`, `0/5`, `5 vagas`, `1 vaga via forms`, `mesa em andamento`;
- mesa paga/gratuita e sessão zero gratuita;
- sistema próprio/inspirado em;
- anexos/embeds como evidências de capa/link.

## 9. UI admin

MVP:

- botão/área de upload JSON;
- resumo antes/depois:
  - guild/canal;
  - intervalo exportado;
  - total de mensagens;
  - mensagens importadas;
  - atualizadas;
  - ignoradas;
  - falhas;
  - drafts criados/atualizados;
- link para revisar drafts.

Robustez:

- erro amigável para JSON inválido;
- aviso quando arquivo parece truncado;
- limite de tamanho documentado;
- não renderizar conteúdo bruto sem sanitização.

## 10. Automação diária permanente

Decisão do produto: DiscordChatExporter será permanente e rodará na VM.

Plano futuro seguro:

```text
DiscordChatExporter na VM
→ export diário para pasta controlada
→ job importador lê JSONs
→ valida
→ importa
→ move para processed/ ou error/
→ registra log/contagem
```

Regras:

- não usar cookie pessoal como solução operacional sem decisão explícita de risco;
- preferir credencial dedicada/segura;
- documentar ToS/risco do método escolhido;
- pasta deve ficar fora do git;
- arquivos processados devem ter retenção limitada;
- erro não deve travar imports seguintes;
- import deve ser idempotente.

## 11. Segurança e privacidade

- JSON exportado pode conter nomes, IDs, avatares e conteúdo de usuários.
- Tratar como dado operacional sensível.
- Não commitar JSON real.
- `spec047-backup/` deve continuar fora do commit.
- Logs não devem despejar conteúdo bruto completo.
- Retenção futura precisa ser definida.

