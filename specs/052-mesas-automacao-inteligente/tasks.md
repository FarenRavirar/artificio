# Tasks — 052 Automação Inteligente de Importação de Mesas

> **Roadmap, não backlog ativo.** Todas as tasks começam **bloqueadas** até a spec 048 fechar (MVP + Fases C/F/G com métricas reais) e o mantenedor autorizar nominalmente o bloco/degrau. Nada aqui é executável nesta abertura.

## Gate 0 — Pré-condições (destravam o resto)

- [ ] T0.1 — Spec 048 fechada: parser determinístico (Fase C) + robustez (Fase F) + human-in-the-loop (Fase G) em prod/beta, com métricas de acurácia acumuladas · feito quando: 048 marcada encerrada e há relatório de acurácia por campo.
- [ ] T0.2 — Decisão de provider de IA + contrato de privacidade (o que sai, retenção, minimização) · feito quando: documento de privacidade aprovado pelo mantenedor.
- [ ] T0.3 — Aprovação nominal do mantenedor para iniciar Bloco A e/ou Bloco B · feito quando: aprovação registrada em sessão.

## Bloco A — Automação operacional (ingestão sem humano)

- [ ] TA.1 — Desenhar diretórios fora do git: `incoming/processing/processed/error` · feito quando: layout + permissões documentados.
- [ ] TA.2 — Script DiscordChatExporter seguro: versão pinada, token fora de argv (segredo), risco/ToS documentado · feito quando: script revisado, sem credencial em argv/log.
- [ ] TA.3 — Job agendado (cron/systemd timer/Actions dispatch — decidir) · feito quando: roda em beta no horário e gera JSON.
- [ ] TA.4 — Importador de pasta monitorada idempotente (reusa `importDiscordChatExporterJson()`); move arquivo por resultado; não trava lote por arquivo ruim · feito quando: teste com lote misto (válido+truncado) processa o válido e isola o ruim.
- [ ] TA.5 — Migration `discord_import_runs` (se não criada na 048 Fase F): file_hash, filename, source_id, dateRange, exportedAt, counts, job/admin id, erro · feito quando: migration online-safe aplicada em beta + rollback testado.
- [ ] TA.6 — Métricas por execução (arquivos, importadas, atualizadas, drafts, erros por causa) sem logar conteúdo bruto · feito quando: métricas visíveis e sem segredo/dado pessoal em log.
- [ ] TA.7 — Retenção de JSONs processados e logs · feito quando: política aplicada (TTL/limpeza).
- [ ] TA.8 — Smoke beta do job completo · feito quando: reprocessar mesmo arquivo = 0 duplicatas; admin ainda revisa todos os drafts.

## Bloco B — Automação inteligente (degraus gated)

### Degrau 1 — IA auxiliar (só sugere, revisável)

- [ ] TB1.1 — Cliente de IA com validação Zod do retorno + timeout/retry + fallback gracioso p/ determinístico · feito quando: retorno inválido/timeout não quebra o fluxo.
- [ ] TB1.2 — Acionar IA só em baixa confiança do parser; sugestão entra como campo revisável (nunca aplicada sozinha) · feito quando: UI mostra "sugestão IA" distinta do extraído determinístico.
- [ ] TB1.3 — Privacidade: minimizar payload enviado, sem segredo/dado pessoal desnecessário, sem logar prompt bruto · feito quando: revisão de privacidade registrada.

### Degrau 2 — Eval offline

- [ ] TB2.1 — Conjunto de avaliação derivado do histórico de correções humanas (Fase G 048) · feito quando: dataset reproduzível gerado.
- [ ] TB2.2 — Pipeline de eval mede acurácia por campo (sistema, vagas, dia/hora, contato) · feito quando: relatório numérico reproduzível.
- [ ] TB2.3 — Comparação modelo/prompt offline, sem afetar produção · feito quando: comparar ≥2 candidatos e registrar diferença.

### Degrau 3 — Shadow mode

- [ ] TB3.1 — Registrar decisão automática proposta (o que auto-aprovaria) sem agir · feito quando: tabela/coluna grava proposta vs decisão humana.
- [ ] TB3.2 — Relatório de divergência por rodada (proposta × correção humana real) · feito quando: relatório gerado e revisável.

### Degrau 4 — Auto-aprovação conservadora (gated)

- [ ] TB4.1 — Definir faixa de altíssima confiança + regras conservadoras a partir da evidência do shadow mode · feito quando: critério escrito e aprovado.
- [ ] TB4.2 — Auto-aprovação restrita, reversível, com trilha de auditoria · feito quando: amostra auto-aprovada auditável e rollback testado.
- [ ] TB4.3 — Aprovação nominal do mantenedor antes de ligar em prod · feito quando: registrada.

### Degrau 5 — Fine-tuning (condicional)

- [ ] TB5.1 — Análise de privacidade dos dados de treino (sem dado pessoal vazado) · feito quando: parecer registrado.
- [ ] TB5.2 — Fine-tuning só se adequado + autorização explícita · feito quando: decisão registrada (pode ser "não fazer").

### Transversal

- [ ] TB.KILL — Kill switch desliga ingestão e/ou auto-aprovação instantaneamente, voltando ao human-in-the-loop da 048 · feito quando: toggle testado em beta.

## Bloco C — Melhorias opcionais de parser (herdadas da 048, "fora do PR-1")

> Transferidas da spec 048 (marcadas "fora do PR-1") por decisão do mantenedor (2026-06-27). Determinísticas, não-IA; melhoram a extração antes/independente da camada inteligente. Cada uma segue o padrão da 048: normalização Zod, payload externo = `unknown` até schema, testes de regressão. Implementar só se priorizado.

- [ ] TC.1 — [048 T-C4] role mentions `<@&id>` como tags/evidências brutas.
- [ ] TC.2 — [048 T-C5] user mentions `<@id>`/`<@!id>` como possível contato.
- [ ] TC.3 — [048 T-C7] mesa paga/gratuita.
- [ ] TC.4 — [048 T-C8] sistema próprio / inspirado em.
- [ ] TC.5 — [048 T-C9] attachments/embeds como evidências.
- [ ] TC.6 — [048 T-B5] parse automático opcional pós-import.

## Travas pétreas (toda task aqui obedece)

- Nenhuma mesa publicada automaticamente antes de Shadow mode (Degrau 3) + Auto-aprovação gated (Degrau 4) satisfeitos.
- Migration/VM write/IA externa: aprovação nominal por ação; guard online-safe; sem cookie/credencial pessoal permanente; sem segredo em log.
- IA é camada auxiliar; o parser determinístico da 048 nunca é removido.
