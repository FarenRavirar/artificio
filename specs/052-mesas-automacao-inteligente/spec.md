# 052 — Automação Inteligente de Importação de Mesas (futuro opcional)

- **Continuação de:** `specs/048-mesas-discord-chat-exporter-json/` (Fase E + camada IA avançada destacadas)
- **Módulo/Pacote:** `apps/mesas` (backend + admin) + infra (VM Oracle, job diário)
- **Gate relacionado:** Gate D (`mesas` em prod; toda evolução validada em beta antes de prod)
- **Status:** spec criada em 2026-06-26 como **roadmap de longo prazo, opcional**. Nenhuma implementação, migration, deploy ou VM write nesta abertura. Pré-requisito duro: a spec 048 (MVP + Fases C/F/G) precisa estar fechada e com histórico de acurácia/métricas antes de qualquer item daqui virar executável.

## Contexto

A spec 048 entrega o importador human-in-the-loop: upload manual de JSON do DiscordChatExporter, parser determinístico, drafts revisáveis, confidence gates, registro antes/depois e métricas (Fase G). **Nada é publicado automaticamente.**

Esta spec 052 cobre o que a 048 deliberadamente deixou como "futuro do futuro":

1. **Automação operacional** — rodar o DiscordChatExporter sozinho na VM, diariamente, sem o admin colar/subir arquivo.
2. **Automação inteligente** — usar IA (e o histórico de correções humanas da Fase G) para elevar a qualidade da extração e, eventualmente, propor auto-aprovação sob regras conservadoras.

É **opcional e gradual**. Cada degrau exige evidência (acurácia medida na 048), shadow mode e aprovação nominal do mantenedor. A trava pétrea de produto continua: **gratuidade, sem anúncio, sem coleta desnecessária, nenhuma mesa publicada sem confiança comprovada.**

## Problema

Hoje (pós-048) o pipeline depende de duas ações humanas caras e recorrentes:

- alguém exporta o canal Discord manualmente (DiscordChatExporter local);
- alguém sobe o JSON no painel admin e revisa cada draft.

Isso não escala para importação contínua de muitos canais/servidores, nem aproveita o sinal acumulado das correções humanas (Fase G) para reduzir trabalho de revisão ao longo do tempo. Falta: (a) ingestão automática agendada e segura; (b) uma camada de inteligência que aprenda com o histórico e só ganhe autonomia quando provar acurácia.

## Decisões de produto (herdadas e reforçadas da 048)

1. **Sem auto-publicação até prova de acurácia.** Auto-aprovação só existe depois de histórico medido, shadow mode aprovado e decisão explícita do mantenedor.
2. **IA é camada auxiliar, nunca fundação.** O parser determinístico (048 Fase C) continua sendo a base; IA entra para casos ambíguos e como proposta sujeita a revisão.
3. **Nenhuma credencial pessoal/cookie/user token como solução permanente.** Automação diária usa credencial dedicada/segura ou bot/API oficial, com risco/ToS documentado.
4. **Privacidade primeiro.** Não logar conteúdo bruto completo, não enviar dado pessoal desnecessário a serviço externo de IA, retenção definida para JSONs e prompts.
5. **Reversível e auditável.** Todo grau de automação tem rollback, trilha de auditoria e shadow mode antes de agir sozinho.

## Requisitos (numerados, testáveis)

### Bloco A — Automação operacional (ex-048 Fase E)

> **Coordenação (2026-06-27):** a Fase E da 048 também foi colocada **ao final da spec 053** (Frente E). A 053 tem prioridade ("concentrar na 053 antes da 052"). Se a 053 entregar a ingestão, este Bloco A é absorvido/dispensado; se não chegar, fica aqui. **Não duplicar.**

- **R1 — Ingestão agendada na VM.** Job diário roda o DiscordChatExporter e gera JSON sem ação humana.
- **R2 — Credencial segura.** Token/credencial Discord fora de argv, em segredo (Actions/Cloudflare/`.env` gitignored), versão da ferramenta pinada (não `latest`). Risco/ToS documentado.
- **R3 — Pasta monitorada idempotente.** Diretórios `incoming/processing/processed/error` fora do git; importador processa cada arquivo uma vez, move conforme resultado, não trava o lote por um arquivo ruim.
- **R4 — Observabilidade.** Métrica operacional por execução (arquivos, mensagens importadas/atualizadas, drafts criados, erros por causa) sem logar conteúdo bruto completo.
- **R5 — Retenção.** Política de retenção de JSONs processados e logs.
- **R6 — Migration `discord_import_runs`** (se não criada na 048 Fase F): rastrear file_hash, filename, source_id, dateRange, exportedAt, counts, admin/job id, erro.

### Bloco B — Automação inteligente (IA auxiliar + aprendizado)

- **R7 — IA auxiliar para extração ambígua.** Quando o parser determinístico tem baixa confiança, uma camada IA propõe campos (sistema, vagas, dia/hora, contato), sempre como sugestão revisável, validada por schema (Zod) com timeout/retry.
- **R8 — Aproveitar histórico da Fase G.** Correções humanas registradas (antes/depois) viram exemplos few-shot, conjunto de avaliação e base de comparação modelo/prompt.
- **R9 — Eval contínuo.** Pipeline de avaliação que mede acurácia da IA contra o conjunto de correções humanas (campos corretos, sistema vinculado, contato, vagas), por modelo/prompt.
- **R10 — Comparação de modelos/prompts.** Suportar comparar candidatos (ex.: modelos diferentes, prompts diferentes) offline, sem afetar produção.
- **R11 — Shadow mode de auto-aprovação.** O sistema registra o que aprovaria automaticamente; admin continua aprovando manualmente; compara decisão automática proposta × correção humana real.
- **R12 — Auto-aprovação conservadora (gated).** Só liga após: histórico de acurácia suficiente, score confiável, shadow mode aprovado, rollback, trilha de auditoria e **aprovação nominal do mantenedor**. Mesmo ligada, restrita a faixa de altíssima confiança e reversível.
- **R13 — Fine-tuning (condicional).** Só se adequado, com análise de privacidade e autorização explícita; dados de treino derivam do histórico interno, sem vazar dado pessoal.
- **R14 — Kill switch.** Desligar qualquer automação (ingestão e/ou auto-aprovação) instantaneamente, voltando ao modo human-in-the-loop da 048.

### Bloco C — Melhorias opcionais de parser (ex-048 "fora do PR-1", FINAL DA SPEC)

> Transferidas da 048 por decisão do mantenedor (2026-06-27): determinísticas, **não-IA**, melhoram a extração antes/independente do Bloco B. Implementar só se priorizado. Cada uma: normalização Zod, payload externo = `unknown` até schema, testes de regressão.

- **R15** — role mentions `<@&id>` como tags/evidências brutas (048 T-C4).
- **R16** — user mentions `<@id>`/`<@!id>` como possível contato (048 T-C5).
- **R17** — mesa paga/gratuita (048 T-C7).
- **R18** — sistema próprio / inspirado em (048 T-C8).
- **R19** — attachments/embeds como evidências (048 T-C9).
- **R20** — parse automático opcional pós-import (048 T-B5).

## Critérios de aceite (de alto nível; cada bloco vira plano/tasks quando ativado)

- Bloco A só é aceito com job rodando em beta, idempotência provada (reprocessar não duplica), credencial fora de argv e métricas por execução visíveis. Sem cookie pessoal.
- Bloco B só avança degrau a degrau: eval reproduzível → shadow mode com relatório de divergência → auto-aprovação restrita gated. Cada degrau exige evidência registrada e aprovação nominal.
- Nenhuma mesa publicada automaticamente sem R11+R12 satisfeitos.
- Privacidade: nenhum segredo/dado pessoal em log; retenção aplicada; envio a IA externa minimiza dado e é documentado.
- Bloco C: cada item entregue com testes de regressão verdes **ou** decisão registrada de não-fazer; não bloqueia A/B.

## Fora de escopo

- Tudo que pertence à 048 (MVP, parser determinístico Fase C, robustez Fase F, human-in-the-loop Fase G). Esta spec **não** reimplementa nada disso; depende dele pronto.
- Qualquer VM write, migration, deploy ou chamada a IA externa **nesta abertura**.
- Substituir a revisão humana antes de R11/R12.
- Login por e-mail/senha, anúncios, coleta de dado pessoal não essencial.

## Riscos e impacto em outros módulos

- **Risco operacional/ToS:** export automático de Discord pode violar ToS/risco de credencial — exige desenho explícito (R2) antes de qualquer execução.
- **Risco de qualidade:** IA pode introduzir extração plausível porém errada — mitigado por eval (R9), shadow mode (R11) e auto-aprovação gated (R12).
- **Risco de privacidade:** enviar conteúdo bruto a IA externa — mitigado por minimização, retenção e análise de privacidade (R4/R5/R13).
- **Impacto cross-módulo:** restrito a `apps/mesas` + infra VM. Não toca `packages/auth`, `accounts.`, SSO nem outros apps. Migrations isoladas no schema de mesas.
- **Dependência dura:** sem o histórico de acurácia/métricas da 048 Fase G, o Bloco B não tem base — não pode começar antes.
