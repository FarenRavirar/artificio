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

## Promoção a prod
`promote-prod-fast-forward.yml` (dispatch + confirmação), preserva `main ⊆ dev`. Nunca squash/merge commit em `dev→main`.
