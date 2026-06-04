# Plano — 004

## Arquitetura Da Solução
1. Corrigir D037 em `apps/accounts/src/app.ts` com allowlist de `returnUrl`.
2. Importar ou criar `apps/mesas` no monorepo a partir do legado `C:\projetos\mesas_rpg_artificio`, preservando stack e dados.
3. Frontend `mesas`: substituir header/login legado por `@artificio/ui` + `@artificio/auth`.
4. Backend `mesas`: substituir/compatibilizar auth legado com validação do cookie `artificio_session`.
5. Deploy controlado na VM, sem tocar banco/dados além de env/compose/código do serviço.

## Arquivos Afetados
- `apps/accounts/src/app.ts`
- `apps/accounts/src/app.test.ts`
- `apps/mesas/**` (a criar/importar)
- `specs/004-mesas-sso-gate-d/**`
- `sessoes/26-06-04_4_mesas_sso-gate-d.md`
- Documentação operacional conforme resultado.

## Contratos Tocados
- OAuth return URL em `accounts`.
- Cookie `artificio_session`.
- `JWT_SECRET` compartilhado entre `accounts` e `mesas`.
- Host público `mesas.artificiorpg.com`.

## Impacto Em Consumidores
- `accounts`: mudança endurece redirect sem afetar hosts válidos `*.artificiorpg.com`.
- `mesas`: fluxo de login muda para SSO central.
- Outros módulos: nenhum direto; contrato `@artificio/auth` não muda.

## Rollback
- `accounts`: reverter commit da allowlist ou redeploy anterior.
- `mesas`: `docker compose` voltar ao código/env anterior em `/opt/artificio/mesas` ou backup do deploy.
- Nunca tocar volumes DB no rollback comum.

## Validação
- Unit tests de allowlist.
- Build/test de `accounts`.
- Build/test de `mesas`.
- Smoke HTTPS.
- Browser E2E real com login Google.
- Teste cross-subdomínio via cookie `artificio_session`.
