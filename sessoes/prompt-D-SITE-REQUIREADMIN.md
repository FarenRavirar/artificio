# Prompt — D-SITE-REQUIREADMIN

```
T0 lido. Contexto: débito D-SITE-REQUIREADMIN — apps/site/server/server.ts:39 tem padrão frágil `session?.user.role` (idêntico ao C2 do links, já corrigido).

Origem: spec 013, investigação C2, sessão `sessoes/26-06-20_2_links_whatsapp-013-014.md`.

Problema:
  apps/site/server/server.ts:39
  if (session?.user.role !== "admin") {  // ← frágil

session?.user protege com ?., mas .role é acesso regular. Se session for undefined → undefined.role → TypeError. Express 5 captura (fail-closed 500), mas é defesa em profundidade frágil.

Hoje nunca acontece (admin.use(requireAuth, requireAdmin) — requireAuth sempre seta session antes de next()). Mas se ordem dos middlewares mudar, ou requireAdmin for usado sem requireAuth → crash.

Fix (1 linha, igual links):
  if (!session || session.user.role !== "admin") {

Referência: links já corrigido em apps/links/server/server.ts:30. Mesas (middleware/auth.ts:84) faz if (!req.user) primeiro → seguro.

Regras: SDD Lite (app isolado, sem tocar shared). Apenas investigar, corrigir, validar (tsc + build site), documentar na sessão e no backlog/tasks.md. Não commitar. Se achar outros padrões frágeis no site, registrar débito.

Arquivo a modificar: apps/site/server/server.ts:39
Validação: tsc --noEmit em apps/site + build Astro do site.
```
