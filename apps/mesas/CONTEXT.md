# Mesas

Módulo G1 para `mesas.artificiorpg.com`.

## Estado
- Importado do legado local `C:\projetos\mesas_rpg_artificio` em CDX-308A.
- Estrutura legada preservada em `frontend/` + `backend/`.
- Próxima etapa CDX-308B: trocar auth próprio por SSO `accounts.` e integrar `@artificio/ui`.

## Contrato G1
- Subdomínio próprio, root `/`, sem basename.
- Login via `accounts.artificiorpg.com`.
- Cookie compartilhado `artificio_session` em `Domain=.artificiorpg.com`.
- Backend valida JWT via `@artificio/auth` com mesmo `JWT_SECRET` de `accounts`.
- Segredos ficam fora do git e nunca entram neste diretório.
