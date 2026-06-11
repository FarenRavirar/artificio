# Tasks — 015

- [ ] T1 — Levantar volume de usuários legados + emails não-Google (read-only no DB) · feito quando: números na sessão (dimensiona o fluxo de reivindicação).
- [ ] T2 — Migration aditiva `sso_user_id` + índice `lower(email)` · feito quando: roda em DB local/scratch; idempotente.
- [ ] T3 — Backend: `verifyToken` + `resolveLocalUser` (link por sso_id → email → cria) + ownership/roles locais · feito quando: testes unit verdes (4 cenários).
- [ ] T4 — Backend: fluxo de reivindicação (`/api/migration/verify` + `/api/migration/claim`, rate-limit, merge transacional de FKs) · feito quando: testes unit verdes (verify ok/falha/lockout; claim vincula; claim com merge de auto-provisionado; duplicata de voto resolvida).
- [ ] T5 — Backend: remover login de sessão/register legados (410; BCrypt só no verify) · feito quando: smoke local 410/401.
- [ ] T6 — Frontend: `useSession`/`authFetch`, Header D043 com userMenu, telas legadas removidas + UI de migração (aviso "email não-Google? entre por aqui" → senha antiga → conectar Google → confirmação) · feito quando: build verde; fluxo completo funciona local (token dummy).
- [ ] T7 — [APROVAÇÃO] snapshot DB + migration + deploy beta · feito quando: beta verde; E2E (a) conta legada email-Google→login direto herda; (b) conta legada não-Google→reivindicação→Google herda e edita termo próprio.
- [ ] T8 — Smoke cross-módulo (glossário/mesas/site/accounts no browser, sessão única) · feito quando: evidência na sessão.
- [ ] T9 — [APROVAÇÃO] promote prod + smoke + fechar Gate D glossário c/ mantenedor · feito quando: aprovação registrada; `project-state.md`/roadmap/decisions atualizados (registrar exceção autorizada do fluxo de migração por senha).
