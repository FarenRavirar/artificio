# Débitos — Spec 083 (Downloads: rejeição estruturada + e-mail)

Achados internos de investigação, lint, build ou auditoria — registrados durante a implementação.

## DEB-083-01 — Webhook de bounce/complaint do Resend não implementado

🟡 Aberto (planejado desde a criação da spec, 2026-07-23). `download_email_log` grava só o resultado do envio (aceito pelo Resend ou erro na chamada), não o status de entrega real (bounce, spam complaint, unsubscribe). Implementar exigiria endpoint público novo validando assinatura HMAC do Resend — escopo maior, fora desta spec por decisão do mantenedor (ver `spec.md` §Fora de escopo).

## DEB-083-02 — Editor de template de e-mail fora da UI admin

🟡 Aberto (planejado desde a criação da spec, 2026-07-23). `email_template_key` referencia template fixo no código; trocar copy do e-mail exige deploy. Editor via UI (WYSIWYG ou markdown) fica como melhoria futura, sem prioridade definida.

## DEB-083-03 — Retenção/TTL de `download_email_log` não definida

🟡 Aberto (planejado desde a criação da spec, 2026-07-23). Tabela contém e-mail (dado pessoal) sem política de expurgo automático. Segue política geral do banco (sem TTL) nesta rodada; se o volume crescer ou LGPD exigir retenção limitada, revisitar.
