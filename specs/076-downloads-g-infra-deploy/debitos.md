# Débitos — Spec 076 (Downloads-G)

Achados internos de investigação, lint, build ou auditoria.

## DEB-076-01 — Trilha de auditoria de moderação separada de log genérico (T4.3)

🟢 Fechado (2026-07-12). `services/moderationAuditLog.ts` (novo): `logModerationAudit()` emite linha JSON grepável por prefixo `[moderation-audit]` (mesmo padrão de `[storage-failover]` já usado em `storage/failover.ts`) com ator/ação/timestamp/material/motivo. Integrado em `moderation.ts` (`submit`, `approve`, `reject`, batch approve/reject/archive) e `reports.ts` (decisão de mérito `resolved`/`dismissed`). Complementa (não substitui) o rastro já gravado em `download_material_version`/`download_report`. Teste `moderationAuditLog.test.ts` cobre o formato.

## DEB-076-02 — Cloudflare Tunnel `downloadsbeta.`/`downloads.` (T2.3)

🟢 Fechado (2026-07-12). Rotas criadas pelo mantenedor no painel Zero Trust (token do agente segue sem escopo `cfd_tunnel`, débito histórico `BL-CF-TUNNEL-TOKEN-SCOPE` continua à parte). `docs/agents/infra-map.md` atualizado com as 2 rotas ativas.
