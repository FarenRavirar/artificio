# 048 — Importador DiscordChatExporter JSON para Mesas

- **Continuação de:** `specs/047-mesas-inbox-importacao/`
- **Módulo/Pacote:** `apps/mesas` (backend + frontend admin)
- **Gate relacionado:** Gate D (`mesas` já em prod; evolução validada em beta antes de qualquer prod)
- **Status:** spec criada em 2026-06-23. **MVP (Fase B backend + Fase D UI + DEB-048-09/10/11/12) MERGED em `dev`** (PR #91 `ed3f4e0` + spec 049 `a4d2fb5`; verificado contra `origin/dev` em 2026-06-26). **Escopo de fechamento (decisão mantenedor 2026-06-26): Fases C + F + G completas na MESMA spec**; Fase E (automação VM) permanece futuro documentado. Gate MVP ainda aberto: smoke beta real. Detalhe em `tasks.md` §Reconciliação de estado — 2026-06-26.
- **Revisão código/VM:** 2026-06-23 — conferência read-only contra diff local e beta.
- **Entrada real:** `C:\projetos\artificio\spec047-backup\extracao_json.json` e `C:\projetos\artificio\spec047-backup\extracao_json2.json`
- **Arquitetura:** `plan.md`
- **Tasks:** `tasks.md`
- **Débitos:** `debitos.md`
- **Reviews:** `reviews.md`

## Problema

A Spec 047 criou a Inbox de Importação de Mesas com MVP de `manual_paste`. Agora há uma fonte real melhor: export JSON do Tyrrrz/DiscordChatExporter para canais Discord de anúncios de mesas.

Diferente de texto colado, o JSON já vem segmentado por mensagem e contém metadados nativos de Discord:

- guild;
- canal;
- mensagem;
- autor;
- timestamp;
- anexos;
- embeds;
- mentions;
- emojis/reactions/stickers;
- intervalo exportado.

Isso permite importar anúncios reais com deduplicação forte e rastreabilidade por mensagem Discord, sem depender de cookie pessoal, user token ou scraping de sessão.

## Decisão de produto

1. **MVP:** upload manual de JSON pelo painel admin.
2. **Evolução planejada:** DiscordChatExporter instalado na VM para rodar diariamente e gerar/importar JSONs.
3. **DiscordChatExporter será permanente**, não apenas ponte temporária.
4. **Não usar conta pessoal/cookie/user token como solução diária.** A automação deve ser desenhada com risco operacional explícito e, quando possível, preferir bot/API oficial ou credencial dedicada/segura.
5. **Não publicar mesa automaticamente.** O fluxo continua gerando drafts revisáveis.

## Workflow de Importação Assistida com Aprendizado por Revisão Humana

A solução deve seguir um fluxo **human-in-the-loop**, com **active learning** e **confidence gates**.

O objetivo não é fazer uma IA publicar mesas automaticamente desde o início. O objetivo é construir um pipeline que importe anúncios brutos, gere drafts, apresente dúvidas ao admin, registre correções humanas e use essas correções para melhorar progressivamente o sistema.

### 1. Ingestão

A entrada pode vir de:

- texto colado;
- DiscordChatExporter JSON;
- Discord Bot/API;
- formulário;
- outras fontes futuras.

### 2. Preservação da fonte

O sistema deve salvar o conteúdo bruto original e, quando existirem:

- metadados da origem;
- autor;
- timestamp;
- links;
- anexos;
- embeds.

### 3. Extração inicial

O parser e as heurísticas extraem campos estruturados:

- título;
- sistema;
- vagas;
- dias;
- horário;
- faixa etária;
- plataforma;
- contato;
- preço;
- sinopse;
- links;
- recrutamento.

### 4. Normalização

O sistema normaliza:

- datas;
- horários;
- vagas;
- preço;
- plataformas;
- faixa etária;
- formato de contato.

### 5. Resolução de entidades

O sistema tenta vincular o anúncio a entidades existentes da base:

- sistema de RPG;
- cenário;
- plataforma;
- tags;
- forma de recrutamento.

### 6. Score e confidence gates

Cada draft recebe score de confiança.

Exemplos:

- **baixa confiança:** revisão obrigatória;
- **média confiança:** revisão recomendada;
- **alta confiança:** aprovação rápida;
- **muito alta confiança:** candidato futuro a autoaprovação, mas não no MVP.

### 7. Revisão humana

O admin revisa o draft, corrige campos, marca ambiguidades, rejeita ou aprova.

### 8. Registro do antes/depois

Toda correção humana deve gerar um registro comparando:

- texto bruto;
- extração original;
- normalização original;
- correção humana;
- diferença entre antes e depois;
- motivo da correção, quando aplicável.

### 9. Aprendizado do sistema

As correções humanas alimentam melhorias não baseadas em IA:

- novos aliases de sistemas;
- novas heurísticas;
- novos padrões de recrutamento;
- novas regras de data/horário;
- novas validações;
- novos casos de teste.

### 10. Aprendizado da IA

Quando IA for usada, ela deve entrar como camada auxiliar, não como fundação.

As correções humanas podem alimentar:

- exemplos few-shot;
- conjunto de avaliação;
- comparação entre modelos/prompts;
- melhoria de prompts;
- possível fine-tuning futuro, se for adequado e autorizado.

### 11. Avaliação contínua

Cada rodada de importação deve gerar métricas:

- taxa de campos preenchidos corretamente;
- taxa de sistema vinculado corretamente;
- taxa de contato identificado;
- taxa de revisão obrigatória;
- taxa de rejeição;
- erros recorrentes;
- tempo economizado pelo admin.

### 12. Promoção gradual de automação

O sistema só pode automatizar mais quando houver evidência.

Antes de autoaprovação, deve existir:

- histórico de acurácia;
- score confiável;
- revisão em modo sombra;
- rollback;
- trilha de auditoria.

### 13. Modo sombra

Antes de qualquer autoaprovação, o sistema deve rodar em **shadow mode**: ele sugere o que faria automaticamente, mas o admin ainda aprova manualmente.

Depois, compara-se a decisão automática proposta com a correção humana real.

### 14. Publicação

No MVP, nada é publicado automaticamente.

O resultado inicial sempre deve ser draft revisável.

A publicação automática, se existir no futuro, deve depender de score alto, regras conservadoras e aprovação explícita do mantenedor.

## Requisitos

- **R1 — Importar JSON real do DiscordChatExporter.** Aceitar export no formato observado em `extracao_json.json`.
- **R2 — Tratar cada `messages[]` como anúncio candidato.** Não usar `segmentAnnouncements()` nessa fonte.
- **R3 — Persistir como fonte Discord real.** Usar `discord_import_messages`, não `import_messages`.
- **R4 — Preservar metadados.** Guild/canal/mensagem/autor/timestamps/anexos/embeds/mentions devem ser preservados.
- **R5 — Reusar pipeline existente.** `parseDiscordAnnouncement` + `normalizeDiscordTableDraft` + `discord_import_table_drafts`.
- **R6 — Idempotência.** Reimportar o mesmo JSON não duplica mensagens/drafts.
- **R7 — Mensagem editada.** Se `content_hash` mudou, reabrir mensagem como `pending` e atualizar payload bruto.
- **R8 — Upload manual admin.** Primeiro fluxo visível no painel admin.
- **R9 — Automação diária futura.** Planejar pasta monitorada/job com DiscordChatExporter na VM.
- **R10 — Robustez de arquivo inválido.** JSON inválido/truncado deve retornar erro claro e não importar parcialmente sem rastreio.
- **R11 — Anexos/embeds sem download.** Nesta fase preservar metadata; não baixar anexos nem subir Cloudinary.
- **R12 — Melhorias de parser obrigatórias.** Timestamp Discord, contato por autor, Google Forms, role mentions, formatos de vagas e mesa paga/gratuita viram tasks explícitas.
- **R13 — Human-in-the-loop.** Toda fonte gera draft revisável; correções humanas devem ser registradas como dados de aprendizado.
- **R14 — Confidence gates.** Drafts devem ter score de confiança e UX compatível com baixa/média/alta confiança.
- **R15 — Active learning.** Correções humanas devem alimentar aliases, heurísticas, validações, casos de teste, evals e prompts futuros.
- **R16 — Sem auto-publicação no MVP.** Qualquer automação de aprovação/publicação exige shadow mode, métricas, rollback, trilha de auditoria e aprovação explícita do mantenedor.

## Diagnóstico inicial dos arquivos reais

### `extracao_json.json`

Arquivo válido. Amostra observada:

- `messageCount`: 100
- `messages.length`: 100
- tipos: 99 `Default`, 1 `Reply`
- autores distintos: 82
- bots: 0
- mensagens com conteúdo: 99
- anexos: 85
- embeds: 28
- mentions: 18
- inline emojis: 127
- mensagens editadas: 0
- mensagens com Google Forms: 11
- mensagens com `<t:UNIX:...>`: 4
- mensagens com role mentions `<@&...>`: 60
- anexos por extensão: `png`, `jpg`, `webp`, `txt`, `jpeg`, `mp4`, `gif`

### `extracao_json2.json`

Arquivo inválido/truncado. Falha de parse JSON:

- erro: `JSONDecodeError: Expecting ',' delimiter`
- ponto observado: linha 3042, coluna 14, caractere ~134107
- o arquivo termina no meio de um objeto `author`

Esse arquivo deve entrar como fixture negativa: upload deve falhar com 400 e mensagem clara.

## Veredito técnico

Usar `discord_import_messages`.

Justificativa:

- o JSON é export de Discord real;
- já existe `source_kind='discord_chat_exporter_json'`;
- `discord_import_messages` já possui campos ricos de Discord;
- a constraint unique `(discord_channel_id, discord_message_id)` resolve deduplicação;
- `persistMessages()` já atualiza conteúdo quando `content_hash` muda;
- `discord_import_table_drafts` já é a mesa de drafts revisáveis para origem Discord.

`import_messages` continua reservado para origem genérica (`manual_paste`, formulário próprio, social sem metadados Discord, JSON genérico não Discord).

## Revisão contra código e VM — 2026-06-23

### Confirmado no código/local

- `DiscordImportSourceKind` já aceita `discord_chat_exporter_json`.
- `persistMessages()` já persiste em `discord_import_messages`, calcula `content_hash`, deduplica por `discord_channel_id + discord_message_id` e reabre mensagem alterada como `pending`.
- `discord_import_messages` já guarda `attachments`, `embeds`, autor, URL, timestamps e `source_kind`.
- O parser/normalizador reaproveitável continua sendo `parseDiscordAnnouncement()` + `normalizeDiscordTableDraft()`.

### Confirmado na VM beta read-only

- `/opt/artificio-beta` está no commit `b70367c`.
- Containers `mesas-beta-app`, `mesas-beta-api`, `mesas-beta-db` estão `healthy`.
- Banco beta tem as tabelas:
  - `discord_import_sources`;
  - `discord_import_messages`;
  - `discord_import_table_drafts`;
  - `import_messages`;
  - `import_corrections`.
- `discord_import_messages` tem 22 colunas, incluindo `source_kind`, `attachments`, `embeds`, `discord_parent_channel_id`, `discord_thread_id`, `discord_thread_name`.
- Constraint presente: `discord_import_messages_channel_msg_unique` = `UNIQUE (discord_channel_id, discord_message_id)`.

### Diff local que impacta esta spec, mas NÃO deve ser tratado como entrega da Spec 048

Há mudanças locais fora da documentação desta spec:

- `chrono-node` e `fuzzball` foram adicionados ao backend e usados no parser/normalizador.
- `apps/mesas/backend/src/inbox/deepseek.ts` adiciona fallback DeepSeek para `manual_paste`, não para DiscordChatExporter JSON.
- `apps/mesas/frontend/e2e/` adiciona smoke Playwright, mas depende de sessão admin/cookie e não foi provado como gate automatizado.
- `apps/mesas/scripts/discord-export.sh` adiciona helper Docker para DiscordChatExporter, mas aceita token por CLI, usa imagem `latest` e declara uso manual. Isso conflita com a evolução desejada de automação diária permanente se for tratado como solução final.

Essas mudanças podem ser úteis, mas exigem validação/rastreio próprios. A Spec 048 não deve assumir que elas estão aprovadas, implantadas, testadas ou disponíveis na VM.

## Fora de escopo desta abertura

- Não implementar código ainda.
- Não aplicar migration.
- Não fazer deploy.
- Não mexer na VM.
- Não publicar mesa.
- Não baixar anexos.
- Não subir para Cloudinary.
- Não automatizar com cookie/user token pessoal.
- Não mudar o fluxo B1 atual da Spec 047.
