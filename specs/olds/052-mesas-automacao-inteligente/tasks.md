# Tasks — 052 Automação Inteligente de Importação de Mesas

> **Roadmap, não backlog ativo.** Todas as tasks começam **bloqueadas** até a spec 048 fechar (MVP + Fases C/F/G com métricas reais) e o mantenedor autorizar nominalmente o bloco/degrau. Nada aqui é executável nesta abertura.

## Gate 0 — Pré-condições (destravam o resto)

- [ ] T0.1 — Spec 048 fechada: parser determinístico (Fase C) + robustez (Fase F) + human-in-the-loop (Fase G) em prod/beta, com métricas de acurácia acumuladas · feito quando: 048 marcada encerrada e há relatório de acurácia por campo. **Parcial:** 048 em PROD; `discord_import_runs`, `/metrics`, few-shot/eval e shadow mode existem desde a 048. Falta confirmar relatório real de acurácia por campo antes do Bloco B.
- [ ] T0.2 — Decisão de provider de IA + contrato de privacidade (o que sai, retenção, minimização) · feito quando: documento de privacidade aprovado pelo mantenedor.
- [x] T0.3 — Aprovação nominal do mantenedor para iniciar Bloco A e/ou Bloco B · feito quando: aprovação registrada em sessão. **Aprovado em chat:** “comece a 052”. Escopo executado: Bloco A local, sem VM write/cron/segredo/deploy.

## Bloco A — Automação operacional (ingestão sem humano)

- [x] TA.1 — Desenhar diretórios fora do git: `incoming/processing/processed/error` · feito quando: layout + permissões documentados. **Local:** `operacao-bloco-a.md` define raiz fora do git, layout e permissão alvo.
- [x] TA.2 — Script DiscordChatExporter seguro: versão pinada, token fora de argv (segredo), risco/ToS documentado · feito quando: script revisado, sem credencial em argv/log. **Risco aceito pelo mantenedor (2026-06-30):** token/cookies via CLI/env, sabendo que o DCE usa `-t/--token` em argv. Implementado `discord:export-chat`; logs redigem token/cookies.
- [ ] TA.3 — Job agendado (cron/systemd timer/Actions dispatch — decidir) · feito quando: roda em beta no horário e gera JSON. **Parcial:** timer planejado/documentado; execução beta exige VM write/deploy e aprovação nominal.
- [x] TA.4 — Importador de pasta monitorada idempotente (reusa `importDiscordChatExporterJson()`); move arquivo por resultado; não trava lote por arquivo ruim · feito quando: teste com lote misto (válido+truncado) processa o válido e isola o ruim. **Local:** `processDiscordChatExporterFolder()` + CLI `discord:import-folder`; testes de lote misto/idempotência/metadado sem payload bruto.
- [x] TA.5 — Migration `discord_import_runs` (se não criada na 048 Fase F): file_hash, filename, source_id, dateRange, exportedAt, counts, job/admin id, erro · feito quando: migration online-safe aplicada em beta + rollback testado. **Já criada na 048 Fase G/migration 131; 052 reusa a tabela existente.**
- [x] TA.6 — Métricas por execução (arquivos, importadas, atualizadas, drafts, erros por causa) sem logar conteúdo bruto · feito quando: métricas visíveis e sem segredo/dado pessoal em log. **Local:** CLI registra resumo em `discord_import_runs`; arquivos geram `.meta.json` com hash/contagens/erro, sem payload bruto.
- [x] TA.7 — Retenção de JSONs processados e logs · feito quando: política aplicada (TTL/limpeza). **Local:** `processed=14d`, `error=30d`; teste cobre limpeza sem payload bruto.
- [ ] TA.8 — Smoke beta do job completo · feito quando: reprocessar mesmo arquivo = 0 duplicatas; admin ainda revisa todos os drafts. **Bloqueado por deploy/VM:** local cobre lote misto, idempotência e não-publicação; beta real exige aprovação nominal.

## Bloco B — Automação inteligente (degraus gated)

### Degrau 1 — IA auxiliar (só sugere, revisável)

- [x] TB1.1 — Cliente de IA com validação Zod do retorno + timeout/retry + fallback gracioso p/ determinístico · feito quando: retorno inválido/timeout não quebra o fluxo. **Local:** `llmAssist` já valida Zod/timeout/fallback; Bloco B adicionou config/kill switch.
- [x] TB1.2 — Acionar IA só em baixa confiança do parser; sugestão entra como campo revisável (nunca aplicada sozinha) · feito quando: UI mostra "sugestão IA" distinta do extraído determinístico. **Local:** modo `suggest`; `_ai_suggestions` separado no `normalized_payload`; não sobrescreve campos nem remove `missing_fields`.
- [x] TB1.3 — Privacidade: minimizar payload enviado, sem segredo/dado pessoal desnecessário, sem logar prompt bruto · feito quando: revisão de privacidade registrada. **Local:** `minimizeAnnouncementForLlm()` redige IDs Discord e URLs não permitidas antes do prompt; testes cobrem. **Reavaliado D087 (2026-06-30):** escopo público (canal Discord → site público) dispensa a trava de privacidade de IA externa; minimização mantida só por economia de token; segredos (token/cookie do exporter) nunca entram no payload.
- [x] TB1.4 — **Learning-store determinístico ANTES da IA (D087, economia de token)** · feito quando: correção humana repetida resolve campo sem chamar IA. **Local (2026-06-30):** migration_133 `discord_field_learning` — chave `UNIQUE NULLS NOT DISTINCT (field, input_token, guild_id, key_type)`, `output_value` JSONB; **escopo por guild + fallback global** (`guild_id` NULL); guardas `hits`/`rejections`/`applied_count`/`active`/`last_applied_at`; `key_type` ('value' hoje, 'label' futuro DEB-052-02). `discord/fieldLearning.ts` (`normalizeToken`/`lookupFieldLearning`/`recordFieldLearning`): lookup prefere regra do guild → cai pra global, só `active`, marca `applied_count` no hit; record faz upsert (reforça `hits`, conta `rejections` quando o valor aprendido muda). `registerDraftCorrection` popula o store do `diff` (na tx, com `guild_id` do payload); `enrichDraftWithLlm` consulta o store (token-zero) antes do DeepSeek e **pula a IA** quando o store resolve os campos faltantes (store tem precedência). Provider rotulado `learning-store` / `learning-store+deepseek` / `deepseek`. Testes `fieldLearning.test.ts` (7) verdes; **suite backend 319 verdes; tsc limpo**. **Migration não aplicada em VM/prod; sem commit.** Pendente: aprendizado de campo faltante por label (`key_type='label'`, DEB-052-02) + abstrair `AiFieldSuggester` multi-provider.

### Degrau 2 — Eval offline

- [x] TB2.1 — Conjunto de avaliação derivado do histórico de correções humanas (Fase G 048) · feito quando: dataset reproduzível gerado. **Local:** export existente `/drafts/export/eval` + `/automation/eval`.
- [x] TB2.2 — Pipeline de eval mede acurácia por campo (sistema, vagas, dia/hora, contato) · feito quando: relatório numérico reproduzível. **Local:** `aiEval.ts` mede por campo.
- [x] TB2.3 — Comparação modelo/prompt offline, sem afetar produção · feito quando: comparar ≥2 candidatos e registrar diferença. **Local:** script `discord:ai-eval` compara candidatos por JSON.

### Degrau 3 — Shadow mode

- [x] TB3.1 — Registrar decisão automática proposta (o que auto-aprovaria) sem agir · feito quando: tabela/coluna grava proposta vs decisão humana. **Já existia da 048:** `discord_shadow_decisions` + fechamento de outcome em sync/reject; mantido.
- [x] TB3.2 — Relatório de divergência por rodada (proposta × correção humana real) · feito quando: relatório gerado e revisável. **Já existia da 048:** `/metrics/shadow`; Bloco B mantém como shadow, sem agir.

### Degrau 4 — Auto-aprovação conservadora (gated)

- [x] TB4.1 — Definir faixa de altíssima confiança + regras conservadoras a partir da evidência do shadow mode · feito quando: critério escrito e aprovado. **Local:** regra atual segue `muito_alta` + zero pendência, mas só em shadow.
- [ ] TB4.2 — Auto-aprovação restrita, reversível, com trilha de auditoria · feito quando: amostra auto-aprovada auditável e rollback testado. **Bloqueado por gate:** guard implementado, mas auto-aprovação real permanece desligada.
- [ ] TB4.3 — Aprovação nominal do mantenedor antes de ligar em prod · feito quando: registrada. **Não aprovado:** precisa autorização nominal futura.

### Degrau 5 — Fine-tuning (condicional)

- [x] TB5.1 — Análise de privacidade dos dados de treino (sem dado pessoal vazado) · feito quando: parecer registrado. **Local:** payload minimizado; fine-tuning não iniciado.
- [x] TB5.2 — Fine-tuning só se adequado + autorização explícita · feito quando: decisão registrada (pode ser "não fazer"). **Decisão atual:** não fazer agora; exige autorização explícita futura.

### Transversal

- [x] TB.KILL — Kill switch desliga ingestão e/ou auto-aprovação instantaneamente, voltando ao human-in-the-loop da 048 · feito quando: toggle testado em beta. **Local:** `MESAS_AI_KILL_SWITCH=true` força modo `off`; teste cobre.

## Bloco C — Melhorias opcionais de parser (herdadas da 048, "fora do PR-1")

> Transferidas da spec 048 (marcadas "fora do PR-1") por decisão do mantenedor (2026-06-27). Determinísticas, não-IA; melhoram a extração antes/independente da camada inteligente. Cada uma segue o padrão da 048: normalização Zod, payload externo = `unknown` até schema, testes de regressão. Implementar só se priorizado.

- [x] TC.1 — [048 T-C4] role mentions `<@&id>` como tags/evidências brutas. **Local:** `_raw_evidence.role_mentions` + nota de revisão.
- [x] TC.2 — [048 T-C5] user mentions `<@id>`/`<@!id>` como possível contato. **Local:** menção de usuário em linha de contato vira `contact_discord`; canal Discord legado preservado.
- [x] TC.3 — [048 T-C7] mesa paga/gratuita. **Já existia; coberto por regressão:** `R$`/`reais` → `paga`, `gratuita/free/sem custo` → `gratuita`.
- [x] TC.4 — [048 T-C8] sistema próprio / inspirado em. **Já existia; coberto por regressão:** forte descarta; fraco marca `_homebrew_suspect`.
- [x] TC.5 — [048 T-C9] attachments/embeds como evidências. **Local:** `_raw_evidence.attachments/embeds` + notas de revisão.
- [x] TC.6 — [048 T-B5] parse automático opcional pós-import. **Local:** `autoParse: true` no import JSON/arquivo dispara reparse de pendentes ChatExporter, sem publicar.
- [x] TC.7 — **Corrigir `cleanLabelLine` (DEB-052-01, parser hardening).** **Feito (2026-06-30, local):** `parseDiscordAnnouncement.ts` — (a) remove `**`/`__` ANTES da decoração (conserta ordem que deixava `▬` órfão em `**▬ label`); (b) classe de bullets ampliada (`»«►▶◄●○◆◇■□▪▫☆★✦✧➤➥➔→·|`) + faixa emoji de liderança, aplicada em duas passadas; (c) guard `http`/`https` no `splitLabelLine`; (d) URL não vira continuação de rótulo (`collectLabelContinuation` quebra em linha `https?://`). 4 testes de regressão verdes; 90 testes do parser, 319 backend, tsc limpo. **Medição corpus real (`temp/`, systems=[]):** `slots_total` faltante 34→18; hints de sistema decorados (`» **Sistema:`) agora extraídos (casam em prod com systems populado). Sem migration, sem IA. **Não commitado; mesma branch `feat/052-mesas-automacao-recuperado`.**
- [x] TC.8 — **Fallback label-based de slots + sinônimos (DEB-052-01).** **Feito (2026-06-30, local):** `slotsViaLabel()` ao fim de `extractSlots` usa `extractLabelValue` com sinônimos {vagas, vagas disponíveis, vagas totais, vagas abertas, nº de vagas, número de vagas, lugares, jogadores} e extrai número/`N/M` — rede de segurança p/ rótulos exóticos que as 7 regexes ancoradas perdem (ex.: "Lugares: 6"). Sistema já recuperado via TC.7 (cleanLabelLine alimenta o hint). **Day/time (`start_time` 39, `day_of_week` 19) e mapeamento plataforma/local→modality ficam como resíduo** (format-hard / decisão de schema) — registrar fatia futura se priorizado. Determinístico, não-IA. **Não commitado.**

## Travas pétreas (toda task aqui obedece)

- Nenhuma mesa publicada automaticamente antes de Shadow mode (Degrau 3) + Auto-aprovação gated (Degrau 4) satisfeitos.
- Migration/VM write/IA externa: aprovação nominal por ação; guard online-safe; sem cookie/credencial pessoal permanente; sem segredo em log.
- IA é camada auxiliar; o parser determinístico da 048 nunca é removido.
