# Sessao 26-06-16_4 — Debito Mesas Auto-Archive

- **Data:** 2026-06-16
- **Objetivo:** registrar debito acionavel para o workflow `Mesas Auto-Archive`, que falha repetidamente.
- **Escopo:** GitHub Actions schedule/manual, Cloudflare, endpoint prod `https://mesas.artificiorpg.com/api/v1/admin/tables/auto-archive`.
- **Gate:** prod/VM/DNS/WAF sem alteracao nesta sessao; apenas leitura e registro.

## Evidencia
- Run informado pelo mantenedor: https://github.com/FarenRavirar/artificio/actions/runs/27607245699
- Metadados via `gh run view`: workflow `Mesas Auto-Archive`, event `schedule`, branch `main`, sha `a9a4437`, conclusion `failure`, criado em `2026-06-16T09:15:22Z`.
- Log falho: `curl -X POST https://mesas.artificiorpg.com/api/v1/admin/tables/auto-archive` com header `x-cron-secret` retornou HTTP 403.
- Corpo da resposta era pagina Cloudflare challenge `Just a moment...`, antes de chegar na API.

## Registro
- Criado backlog `BL-MESAS-AUTO-ARCHIVE-CF`.
- Hipotese inicial: regra Cloudflare/WAF/bot/challenge bloqueia GitHub Actions no endpoint cron publico, apesar do segredo estar presente.

## Proximo passo
- Diagnosticar Cloudflare/WAF/bypass para endpoint cron ou mover a execucao para caminho interno seguro.
- Validar com `workflow_dispatch` e/ou proxima execucao agendada.
- Nao expor `MESAS_CRON_SECRET`; nao alterar regra Cloudflare/DNS/prod sem aprovacao nominal.
