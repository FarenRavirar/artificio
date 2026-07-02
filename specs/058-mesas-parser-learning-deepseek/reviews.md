# Reviews — 058 Parser Learning + DeepSeek Contextual

## Fase 0 — Revisao 5.5 altissimo

**Data:** 2026-07-01
**Escopo:** revisao arquitetural antes de implementacao.
**Veredito:** a direcao esta correta, mas a spec precisava separar melhor fonte de verdade, projecoes derivadas e fases. O MVP minimo nao deve chamar DeepSeek novo. Primeiro precisa instrumentar casos/feedback e medir baseline real.

## Evidencia verificada no codigo

- `apps/mesas/database/migration_129_import_corrections.sql`: existe `import_corrections`, mas ela e acoplada a `draft_id` com `ON DELETE CASCADE`. Se o admin limpar drafts rejeitados, o corpus de correcao pode sumir junto. Isso nao serve como fonte imutavel de aprendizado.
- `apps/mesas/database/migration_131_discord_import_runs.sql`: existe `discord_import_runs` e `discord_shadow_decisions`, mas shadow e ligado ao draft e mede basicamente autoaprovacao. Nao versiona parse, prompt, modelo, descarte ou duplicata.
- `apps/mesas/database/migration_133_discord_field_learning.sql`: existe `discord_field_learning` com `field + input_token + guild_id + key_type`, bom como cache barato. Mas ainda e estreito: valor de campo, nao caso completo, regra negativa, label alias, duplicata ou descarte.
- `apps/mesas/backend/src/routes/discord/utils.ts`: `registerDraftCorrection()` escreve `import_corrections` e depois alimenta `recordFieldLearning()` best-effort. Bom para nao perder correcao humana, mas aprendizado vira efeito colateral sem evento de dominio completo.
- `apps/mesas/backend/src/discord/llmAssist.ts`: DeepSeek ja existe como sugestao simples; recebe texto minimizado + campos existentes. Ainda nao recebe casos proximos, regras rejeitadas, duplicatas, nem instrucao forte de tratar a mensagem como dado hostil.
- `apps/mesas/database/migration_17_setting_and_styles.sql`: `pg_trgm` ja esta habilitado no banco mesas. Retrieval textual por trigram e viavel sem introduzir extensao nova.

## Gaps encontrados

1. **Sem `parse_case` versionado.** Hoje nao ha snapshot que diga: mensagem X, parser versao Y, resultado Z, decisao final W. Sem isso, nao da para comparar evolucao do parser/prompt.
2. **Feedback nao e imutavel o bastante.** `import_corrections` pode sumir por cascade quando draft e removido. Aprendizado precisa sobreviver a limpeza operacional.
3. **Regras estao misturadas com cache.** `discord_field_learning` e util, mas nao deve virar a fonte unica de verdade. Regra aprendida deve ser derivada de eventos/casos, auditavel e reversivel.
4. **Falso aprendizado e risco real.** Uma correcao errada ou local pode virar regra ativa de novo. Precisa de status `candidate/active/suppressed/retired`, escopo forte e conflito mandando para `needs_review`.
5. **Duplicata ainda e rasa.** O dedupe atual evita reimportar a mesma mensagem do mesmo canal, mas nao detecta repost, cross-channel, mesma mesa com texto refeito, atualizacao de campanha, nem mesa parecida mas distinta.
6. **Shadow atual e estreito.** Ele responde "teria autoaprovado?", nao "teria descartado?", "teria marcado duplicata?", "teria chamado DeepSeek?", "qual regra decidiu?".
7. **DeepSeek ainda opera com pouco contexto.** O prompt atual nao usa retrieval, contraexemplos, regras rejeitadas, candidatos de duplicata ou schema de decisao ampla.
8. **UX de ensino precisa ser de baixo atrito.** Se corrigir cada campo exigir formulario mental separado, o admin para de ensinar. O feedback deve sair do fluxo normal de salvar/rejeitar/marcar duplicata.

## Decisoes da Fase 0

### D-058-01 — Fonte de verdade = casos + eventos

`discord_parse_cases` e `discord_parse_feedback` serao a base duravel. `import_corrections`, `discord_shadow_decisions` e `discord_field_learning` continuam existindo, mas passam a ser compatibilidade/projecao, nao a arquitetura final.

### D-058-02 — MVP minimo = instrumentacao sem mudar comportamento

O primeiro incremento deve apenas registrar `parse_case`, feedback imutavel e baseline. Nao muda decisao do parser, nao cria auto-descarte novo, nao chama DeepSeek de modo novo e nao altera publicacao.

### D-058-03 — DeepSeek fica fora do MVP

DeepSeek com `ContextPack` so entra depois de haver casos confirmados, negativos, duplicatas e baseline. Chamar IA antes disso so troca regex infinita por palpite caro sem memoria.

### D-058-04 — `discord_field_learning` fica como cache/projecao

A tabela atual e aproveitada para ganhos baratos, mas nao sera ampliada indefinidamente. Fase 3 cria `discord_learning_rules` como regra de dominio, com status, escopo, confianca, rejeicoes e origem.

### D-058-05 — Feedback nao pode depender da existencia do draft

Eventos de aprendizado nao podem ter `ON DELETE CASCADE` a partir de draft operacional. Limpar rejeitados deve limpar fila, nao apagar memoria do sistema.

### D-058-06 — Duplicata entra antes da IA contextual

Retrieval/duplicata vem antes do ContextPack. O modelo deve receber candidatos ja calculados localmente, nao ser usado como primeira ferramenta de dedupe.

## MVP minimo escolhido

**MVP-058-A — Baseline + memoria imutavel, sem mudanca de decisao.**

Inclui:

- `discord_parse_cases` aditiva, com refs para mensagem/draft/import run, hashes, texto normalizado, features, resultado deterministico, status final, `parser_version`, `prompt_version`, `model`, `created_at`, `updated_at`.
- `discord_parse_feedback` aditiva, imutavel, com `parse_case_id`, `draft_id` opcional, tipo de evento, campo, before/after, motivo, admin, timestamp e escopo.
- Escrita best-effort no parse e nas acoes humanas existentes: corrigir campo, rejeitar, sincronizar/publicar, marcar duplicata futuramente.
- Relatorio baseline com fixtures reais, com contagem por `draft`, `discard`, `ignored`, `paid`, `free`, `unknown`, campos faltantes e motivos de descarte.
- Zero mudanca de comportamento do parser e zero nova chamada DeepSeek.

Nao inclui:

- `discord_learning_rules` ativo.
- `ContextPack` DeepSeek.
- auto-descarte novo.
- auto-publicacao.
- UI grande. No maximo campos de auditoria internos/API debug, se necessario.

## Modelo de dados final decidido

### Fase 1

- `discord_parse_cases`
- `discord_parse_feedback`

### Fase 2

- `discord_duplicate_candidates`
- indices de retrieval: hash exato, hash normalizado, links/forms, attachments e trigram em `normalized_text`.

### Fase 3

- `discord_learning_rules`
- backfill/projecao a partir de `discord_field_learning` quando fizer sentido.
- regra nasce `candidate`; so vira `active` por confianca/confirmacao; conflito manda `needs_review`.

### Fase 4

- `discord_llm_decisions`
- `ContextPack` versionado/hashado; resposta validada; prompt injection testado; cache por hash + prompt/model/parser.

## Ajustes de fase

1. A antiga Fase 1 vira o MVP minimo real.
2. A antiga Fase 2 deve fazer retrieval local + duplicata em shadow/debug.
3. A antiga Fase 3 so aplica regra apos eventos suficientes.
4. DeepSeek fica na Fase 4, bloqueado por baseline + retrieval.
5. UX de ensino entra depois que o backend ja tiver eventos; nao antes.

## Criterios para liberar implementacao da Fase 1

- Migration online-safe aditiva, sem alterar tabelas existentes destrutivamente.
- Feedback imutavel sem cascade destrutivo a partir de draft.
- Escrita de `parse_case` nao pode quebrar import se falhar; no maximo log/metric.
- Teste de regressao prova que importar `D:\teste.json` mantem o mesmo resultado funcional.
- Baseline registrado antes/depois com o mesmo corpus.
- `verify:api` so se rota/contrato novo for exposto.
