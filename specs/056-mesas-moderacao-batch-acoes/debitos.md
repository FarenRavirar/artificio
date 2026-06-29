# 056 — Débitos

Achados internos (investigação, lint, build, auditoria).

| ID | Sev | Achado | Status | Próximo passo |
|---|---|---|---|---|
| DEB-056-01 | P3 | Sem endpoint de log dedicado — "Logs de integração" reusa `/metrics` (últimas 20 rodadas, sem paginação/filtro). | aceito | Se precisar de histórico longo/filtro, criar `/admin/discord/runs` paginado (spec futura). |
| DEB-056-02 | P3 | Batch limitado a 200 ids/chamada (schema). Fila carrega `limit:100`, então não estoura hoje. | aceito | Se a fila virar paginada >200, paginar a chamada batch no frontend. |
| DEB-056-03 | P3 | `z.string().uuid()` deprecado no zod (mesmo uso pré-existente em `fetch.ts`). | aceito | Migrar p/ `z.uuid()` em varredura futura de zod (repo-wide), não pontual. |
| DEB-056-04 | P2 | OpenAPI dos endpoints batch (`…/messages/batch`, `…/drafts/batch`) tem `additionalProperties:true` genérico — não descreve `{ ids, status }` nem o envelope `{ data: { updated, … } }`. Apontado por CodeRabbit (PR #107). | aceito (gerado) | `mesas.openapi.yaml` é **auto-gerado** pelo `api:bundle` (mesmo padrão genérico p/ todas as rotas). Schema real por rota = melhoria do gerador (escopo spec 055), não fix manual (sobrescrito no próximo gen). |
