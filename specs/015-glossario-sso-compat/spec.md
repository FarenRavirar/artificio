# 015 — Glossário: login via accounts (SSO) com compat do login antigo

- **Módulo/Pacote:** apps/glossario + consome `packages/auth` (sem alterar) + migration DB glossário
- **Gate relacionado:** D (fecha Gate D do glossário)
- **Nível SDD:** Completo (auth/SSO + migration + dados pessoais)
- **Depende de:** spec 012 (glossário no monorepo)

## Problema
Glossário legado tem auth próprio: registro email/senha (BCrypt) + JWT custom, tabela `users` local com conteúdo vinculado (`terms.added_by`, `term_votes`, `term_comments`, `user_notifications`). Pétrea do G1: **Google OAuth via `accounts.` é o único login** (cookie `artificio_session`, D018). Precisa trocar o login para o SSO **sem perder vínculo**: quem se cadastrou no antigo deve, logando via Google **com o mesmo email**, reassumir a conta — ver e editar os termos que adicionou, manter votos/comentários/notificações.

## Requisitos (numerados, testáveis)
1. Backend do glossário valida sessão via `@artificio/auth verifyToken` (cookie `artificio_session`, mesmo `JWT_SECRET` do accounts) — padrão mesas (CDX-308B). `packages/auth` **intocado** (auth sagrado).
2. Frontend: botão Entrar → `accounts.artificiorpg.com/login?return=<url>`; menu de conta padrão D043 (`userMenu` + Sair).
3. **Account-linking por email:** no 1º acesso autenticado, se `email` do SSO (normalizado lowercase) bate com `users.email` legado → vincular (coluna nova `sso_user_id`/equivalente) e a sessão passa a operar como esse usuário. Sem match → criar usuário novo no glossário (provisionamento padrão).
4. Vínculos preservados: `terms.added_by`, votos, comentários, notificações continuam apontando pro mesmo `users.id` legado — usuário relinkado **edita o que adicionou** (ownership respeitado pelo middleware).
5. Roles: papel editorial/admin do glossário fica **local ao módulo** (padrão D052); `admin` global do SSO = superusuário. Admins legados mantêm poder via mapeamento local.
6. **Fluxo de reivindicação p/ email legado não-Google** (autorizado explicitamente pelo mantenedor em 2026-06-11 — exceção controlada à pétrea Google-only, restrita a migração):
   - UI de entrada do glossário mostra aviso: "Cadastrou com email/senha no glossário antigo e seu email não é Google? Entre por aqui".
   - Usuário valida identidade legada (email + senha BCrypt antiga, endpoint dedicado de migração — **não** é login de sessão; rate-limited).
   - Em seguida, tela obrigatória "conecte sua conta Google" → OAuth via accounts → vincula `sso_user_id` ao usuário legado, **herdando tudo** (termos, votos, comentários, notificações); email da conta passa a ser o do Google.
   - Se o login Google já tinha auto-provisionado um usuário novo no glossário, fazer merge (repoint de FKs) numa identidade única.
   - Pós-vínculo: só Google. `register` legado e login de sessão por senha **desativados**; endpoint de migração é o único uso restante dos hashes BCrypt (limpeza futura aprovada).
7. Migration online-safe no DB `glossario_v2` (aditiva; dump/snapshot antes — pétrea de banco).
8. Smoke cross-módulo: login SSO no glossário não quebra sessão de mesas/site/accounts (cookie compartilhado).

## Critérios de aceite
- [ ] Usuário legado (cadastrado por email no antigo) loga via Google com o mesmo email e: vê perfil, lista os próprios termos, edita um deles.
- [ ] Usuário novo (sem conta legada) loga e consegue submeter termo.
- [ ] Admin legado mapeado modera termos.
- [ ] Usuário legado com email não-Google: completa o fluxo de reivindicação (senha antiga → vincular Google) e herda termos/votos/comentários na conta Google.
- [ ] `POST /login` (sessão) e `POST /register` legados → 404/410; endpoint de migração responde só ao fluxo de reivindicação.
- [ ] Sessão única: logado no glossário = logado em mesas/site (verificado no browser).
- [ ] Gate D glossário fechado pelo mantenedor.

## Fora de escopo
Mudanças em `packages/auth`/accounts. Limpeza da coluna de senha. Recuperação de senha legada esquecida (sem reset; caso raro → merge manual por admin, ferramenta futura).

## Riscos e impacto em outros módulos
- **Endpoint de migração usa senha legada:** superfície de credential-stuffing → rate-limit + lockout + sem revelar existência de email; nunca cria sessão por senha (só token de migração de vida curta consumido pelo passo Google).
- **Merge de contas** (auto-provisionada × legada): repoint de FKs transacional; testar colisões (votos duplicados no mesmo termo).
- Case/alias de email (gmail dots) — normalizar lowercase; não inventar heurística de alias.
- Migration em DB prod = aprovação + snapshot.
- Auth é sagrado: smoke de TODOS os módulos SSO após deploy.
