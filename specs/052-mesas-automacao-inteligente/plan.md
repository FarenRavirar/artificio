# Plano — 052 Automação Inteligente de Importação de Mesas

> Plano de arquitetura de **roadmap**. Não é ordem de implementação imediata. Cada bloco/degrau só vira tasks executáveis quando o pré-requisito (048 fechada + evidência) existir e o mantenedor autorizar nominalmente.

## Arquitetura da solução (visão em degraus)

```
[048 pronto: parser determinístico + drafts revisáveis + Fase G (correções/métricas)]
        │
        ▼
Bloco A — Automação operacional (ingestão sem humano)
  DiscordChatExporter (VM, agendado) → incoming/ → importador pasta monitorada
    → discord_import_messages (idempotente) → drafts (mesmo pipeline 048)
    → discord_import_runs (auditoria por execução)
        │  (admin ainda revisa todos os drafts)
        ▼
Bloco B — Automação inteligente (qualidade + autonomia gradual)
  Degrau 1: IA auxiliar só sugere campos ambíguos (revisável)        [R7,R8]
  Degrau 2: eval offline contra histórico de correções humanas       [R9,R10]
  Degrau 3: shadow mode — IA propõe auto-aprovação, humano decide     [R11]
  Degrau 4: auto-aprovação conservadora gated (faixa altíssima conf.) [R12]
  Degrau 5 (condicional): fine-tuning com privacidade + autorização   [R13]
  Transversal: kill switch volta tudo p/ human-in-the-loop            [R14]
```

Cada degrau do Bloco B só liga após o anterior provar evidência e receber aprovação nominal. A base determinística (048) nunca é removida; IA é camada por cima.

## Arquivos afetados (por módulo/pacote) — candidatos, não definitivos

- **Infra/VM (Bloco A):** script de export pinado (substitui o experimento descartado `discord-export.sh`), unidade de agendamento (cron/systemd timer/Actions dispatch — a decidir), diretórios `incoming/processing/processed/error` fora do git.
- **`apps/mesas/backend` (Bloco A):** importador de pasta monitorada (reusa `importDiscordChatExporterJson()` da 048), migration `discord_import_runs` (se não criada na 048 Fase F), métricas por execução.
- **`apps/mesas/backend` (Bloco B):** módulo IA auxiliar (cliente com schema Zod + timeout/retry), pipeline de eval (offline), serviço de shadow mode (grava decisão proposta vs humana), gate de auto-aprovação, kill switch (flag de config).
- **`apps/mesas/admin` (Bloco B):** UI de divergência shadow mode, painel de métricas/eval, toggle de automação (com kill switch visível).
- **Banco (mesas):** `discord_import_runs` (A); colunas/tabelas para decisão automática proposta, score de auto-aprovação e auditoria (B). Todas isoladas no schema de mesas.

## Contratos/interfaces tocados

- **Auth/accounts/SSO:** nenhum. Não tocar `packages/auth` nem `accounts.`.
- **Subdomínio/DNS:** nenhum.
- **Schema:** migrations isoladas no banco de mesas (A: runs; B: auto-aprovação/shadow). Sempre via guard `online-safe`/`manual-risk` (spec 050) + aprovação nominal + rollback.
- **Externo:** provável chamada a API de IA (provider a decidir). Contrato de privacidade obrigatório (minimização, retenção, sem segredo em log). Credencial Discord para export (Bloco A).

## Impacto em consumidores

- Restrito a `apps/mesas`. Nenhum outro app consome esse pipeline.
- A automação **não** muda o contrato público de mesas (drafts continuam virando `tables.status='draft'` revisáveis); só muda quem/como gera os drafts.

## Rollback

- **Bloco A:** desligar o job agendado; importador de pasta é idempotente, reverter = parar de alimentar `incoming/`. Migration `discord_import_runs` é aditiva (drop seguro se necessário, com dump).
- **Bloco B:** kill switch (R14) desliga IA/auto-aprovação e volta ao human-in-the-loop puro da 048. Auto-aprovação restrita e reversível por design; toda decisão automática fica auditada para desfazer.

## Validação (como provo que funciona)

- **Bloco A:** job em beta, reprocessar mesmo arquivo = 0 duplicatas; arquivo ruim não trava lote; métricas por execução conferidas; nenhum segredo em log.
- **Bloco B:**
  - Degrau 1: sugestões IA aparecem como revisáveis, validadas por schema; falha de IA (timeout/inválido) cai graciosamente no determinístico.
  - Degrau 2: eval reproduzível com número de acurácia por campo contra o histórico de correções.
  - Degrau 3: relatório de divergência shadow (proposta automática × correção humana) por rodada.
  - Degrau 4: auto-aprovação só em faixa de confiança comprovada, com amostra auditada e rollback testado.
- **Privacidade:** revisão explícita do que sai para IA externa; retenção aplicada; sem dado pessoal desnecessário.

## Pré-condições para tornar QUALQUER item executável

1. Spec 048 fechada (MVP + Fases C/F/G) e com **métricas de acurácia reais** acumuladas.
2. Aprovação nominal do mantenedor para o bloco/degrau específico.
3. Para VM: aprovação nominal de cada write (job, diretórios, credencial).
4. Para migration: guard online-safe + dump + rollback.
5. Para IA externa: decisão de provider + contrato de privacidade.
