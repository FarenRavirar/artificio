# Runbook de Deploy G1 (esteira `_deploy-module`)

> Deploy canônico = GitHub Actions (D039/D041). VM manual só bootstrap/diagnóstico/rollback aprovado.
> Blindagens da esteira: spec 009. Cicatrizes: D041 (nunca `down` por prefixo global), flock, snapshot, rollback.

## Bootstrap de **módulo novo** (1ª subida) — dispatch-first

A esteira faz `git reset --hard origin/<branch>` na VM, mas o `.env.<env>` (gitignored) precisa existir **antes** do `up`. Em módulo novo o diretório `apps/<modulo>` só aparece na VM após o pull. Sequência:

1. **Claude/Codex:** push do código em `dev` (módulo + `deploy-<modulo>.yml`).
2. **Mantenedor (VM):** materializar o módulo no clone beta:
   ```bash
   cd /opt/artificio-beta
   git fetch origin dev && git reset --hard origin/dev
   ls -ld apps/<modulo>            # confirma que existe
   ```
3. **Mantenedor (VM):** criar `apps/<modulo>/.env.beta` (gitignored) com os segredos. **`JWT_SECRET` deve ser igual ao de `apps/accounts/.env.beta`** (SSO compartilhado, D042) — o deploy recusa se divergir.
4. **Mantenedor (Cloudflare):** rota Tunnel `<host> → http://<container-app>:<porta>`.
5. **Disparar:** `deploy-<modulo>` → `Run workflow` → `mode=deploy` (1ª subida via dispatch; após OK, habilitar auto-deploy em push `dev`).
6. **Smoke:** conferir rotas críticas + `/healthz` + módulo da raiz/WP intocável.

> **Não** subir containers manualmente p/ "validar" antes do deploy — cria leftover de outro projeto compose. A esteira reconcilia leftovers de nome conhecido (spec 009 R1), mas evite o caso.

## Bootstrap do `glossario` (spec 012)

Estado seguro antes do primeiro deploy:
- **BETA primeiro:** `/opt/artificio-beta` deve estar em `dev` alinhado com `origin/dev`, que contém `apps/glossario`.
- **PROD depois:** `/opt/artificio` permanece em `main`; não fazer deploy prod enquanto `origin/main` não contiver `apps/glossario`.
- Env beta: `/opt/artificio-beta/apps/glossario/.env.beta` com permissão `600`.
- Env prod futuro: `/opt/artificio/apps/glossario/.env`, só quando `main` já tiver o módulo.
- `POSTGRES_PASSWORD` precisa ser exatamente o segredo original do volume legado correspondente; validar por fingerprint/tamanho, nunca por impressão do valor.
- `JWT_SECRET` precisa ser igual ao `apps/accounts` do mesmo clone (`apps/accounts/.env.beta` no beta; `apps/accounts/.env` no prod), pois o workflow recusa divergência.
- Volumes reaproveitados: BETA `glossario-beta_pgdata_beta`; PROD `glossario_pgdata_prod`.

Rotas Cloudflare Tunnel:
- BETA: `glossariobeta.artificiorpg.com` -> `http://glossario-beta-app:80`.
- PROD futuro: `glossario.artificiorpg.com` -> `http://glossario-app:80`.
- Não mexer em `glossariorpg.artificiorpg.com` no bootstrap beta; o redirect `glossariorpg.` -> `glossario.` é etapa posterior.

Ordem:
1. Disparar BETA em `dev`: `gh workflow run deploy-glossario.yml --ref dev -f mode=deploy`.
2. Validar home, `/api/terms`, busca e login.
3. Só preparar PROD depois que `main` receber `apps/glossario`.

Observações:
- Como o `JWT_SECRET` do glossário novo fica igual ao `accounts`, tokens antigos do glossário legado podem expirar. Usuários podem precisar logar de novo; isso é aceitável e transitório.
- Na VM Oracle, o resolver `169.254.169.254` pode demorar a resolver hostname novo. Em 2026-06-11 foi aplicado runtime via `resolvectl` para `1.1.1.1` e `8.8.8.8`. Se precisar sobreviver a reboot, persistir na configuração adequada do sistema/rede sem quebrar resolução interna da Oracle.

## Blindagens ativas (spec 009)
- **R1 reconcile:** antes do 1º `up`, remove container de nome esperado pertencente a outro projeto compose (leftover). Não toca volume nem containers de outro nome.
- **R2 guard exec-bit:** `pr-checks` falha se `ENTRYPOINT/CMD ["./*.sh"]` referenciar `.sh` não-`100755` no git. Corrigir: `git add --chmod=+x <arquivo>`.
- **R3:** erro de `.env` ausente instrui o bootstrap; este runbook.
- **R4:** resumo de smoke/health no `GITHUB_STEP_SUMMARY` do run.

## Estado sujo na VM (diagnóstico/limpeza)
Conferir antes de limpar (read-only):
```bash
docker inspect <container> --format 'name={{.Name}} image={{.Config.Image}} project={{index .Config.Labels "com.docker.compose.project"}}'
docker ps -a --filter "name=<modulo>" --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker volume ls | grep -i <modulo>
```
Remoção cirúrgica (nomes exatos, nunca pipe-delete às cegas; volume só se vazio/incorreto):
```bash
docker rm -f <container-app> <container-db>
docker volume rm <projeto>_<volume>
```

## Migrations
- mesas: `apps/mesas/database/` (aplicadas pelo `apply_required_migrations.sh`, frameworkado).
- site: migra **no entrypoint do container** (`db/migrations/`), não pela esteira → o passo `apply_required_migrations.sh ... database` é no-op gracioso (dir ausente).
- glossário: migrations legadas ficam em `apps/glossario/database/legacy/`; o runner do monorepo deve ser no-op até uma futura baseline explícita (D059).

## Promoção a prod
`promote-prod-fast-forward.yml` (dispatch + confirmação), preserva `main ⊆ dev`. Nunca squash/merge commit em `dev→main`.
