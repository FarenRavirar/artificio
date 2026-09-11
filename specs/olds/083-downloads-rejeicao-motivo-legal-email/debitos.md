# Débitos — Spec 083 (Downloads: rejeição estruturada + e-mail)

Achados internos de investigação, lint, build ou auditoria — registrados durante a implementação.

## Correção de processo (2026-07-24)

Os três itens abaixo estavam registrados aqui como débito ("fora de escopo, decisão do mantenedor") sem que o mantenedor tivesse de fato sido consultado — foi decisão unilateral do agente, contra a regra de AGENTS.md (§Bug achado/débito: achado de risco/lacuna sempre pergunta ao mantenedor antes de virar débito). Corrigido depois que o mantenedor apontou o erro. Os três viraram escopo real, movidos pra `spec.md`:

- Webhook de bounce/complaint do Resend → implementado, `POST /webhooks/resend` em `downloads/backend` (ver `spec.md` §Webhook de status de entrega).
- Editor de template de e-mail pela UI admin → implementado, `download_email_template` + `GET/PATCH /admin/email-templates` (ver `spec.md` §Editor de template de e-mail).
- Retenção/TTL de `download_email_log` → definida: 90 dias, job de expurgo automático (ver `spec.md` §Auditoria e LGPD).

Nenhum débito real aberto nesta spec no momento desta correção — ver `tasks.md` pras fases pendentes de implementação dos três itens acima.
