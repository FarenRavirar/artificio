# Prompt — BL-ROOTLESS-CONTAINERS

```
T0 lido. Contexto: débito BL-ROOTLESS-CONTAINERS — 4 apps ainda rodam container como root
(links já corrigido em C3, sessão 26-06-20_2).

Origem: spec 013, investigação C3, sessão sessoes/26-06-20_2_links_whatsapp-013-014.md.
Registrado em: specs/backlog.md.

Problema: containers Node.js rodam como root (user 0). Risco: RCE no app → root no container →
escape (kernel bug) → root no host. node:24-slim e node:24-alpine já têm user node (UID 1000).

Fix padrão (igual links, apps/links/Dockerfile):
  RUN chown -R node:node /repo   (ou /app para accounts)
  USER node

Dockerfiles a corrigir (4):
1. apps/site/Dockerfile          WORKDIR=/repo     após RUN chmod +x (linha 25)
2. apps/accounts/Dockerfile      WORKDIR=/app      após RUN pnpm install --prod (linha 21)
3. apps/glossario/backend/Dockerfile  WORKDIR=/repo  após COPY --from=builder (linha 39)
4. apps/mesas/backend/Dockerfile     WORKDIR=/repo  após COPY --from=builder (linha 48)

Dockerfiles a NÃO tocar (2):
- apps/glossario/frontend/Dockerfile — nginx:1.31-alpine, já roda como user nginx (não-root)
- apps/mesas/frontend/Dockerfile — nginx:1.31-alpine, já roda como user nginx (não-root)

ATENÇÃO: accounts usa WORKDIR=/app, não /repo. chown deve mirar /app.

Regras: SDD Completo (cross-cutting, 4 apps). Apenas código local. Validar:
  tsc --noEmit em cada app afetado + build Astro onde aplicável.
  Não commitar.

Se encontrar outros Dockerfiles ou compose files com problemas de segurança
(root, privileged, cap_add), investigar e registrar débito — não corrigir sem
aprovação. Documentar tudo na sessão + backlog.md + project-state.md.

Após aplicar, atualizar tasks.md do C3 para refletir status completo e
fechar o item BL-ROOTLESS-CONTAINERS no backlog.md.
```

---

# Execução — 2026-06-20

## Status: CONCLUÍDO LOCAL (sem commit)

## Evidências

### Dockerfiles corrigidos

| App | Arquivo | WORKDIR | Chown | USER |
|---|---|---|---|---|
| site | `apps/site/Dockerfile` | `/repo` | `chown -R node:node /repo` após `chmod +x` | `node` |
| accounts | `apps/accounts/Dockerfile` | `/app` | `chown -R node:node /app` após `pnpm install --prod` | `node` |
| glossario-backend | `apps/glossario/backend/Dockerfile` | `/repo` | `chown -R node:node /repo` após `COPY --from=builder` do dist | `node` |
| mesas-backend | `apps/mesas/backend/Dockerfile` | `/repo` | `chown -R node:node /repo` após `COPY --from=builder` dos assets | `node` |

### Dockerfiles NÃO alterados (já non-root)
- `apps/glossario/frontend/Dockerfile` — `nginx:1.31-alpine`, roda como user nginx
- `apps/mesas/frontend/Dockerfile` — `nginx:1.31-alpine`, roda como user nginx

### Validação
- `pnpm --filter <app> exec tsc --noEmit` → ✅ 4/4 verdes
- `pnpm --filter ... run build` (accounts, glossario-backend, mesas-backend) → ✅ 3/3 verdes
- Inspeção de segurança: zero `privileged`/`cap_add`/`user: root` nos compose files

### Documentação atualizada
- `specs/backlog.md` — `BL-ROOTLESS-CONTAINERS` → `fechado`
- `specs/013-links-regras-restore/tasks.md` — C3 cross-app marcado concluído
- `.specify/memory/project-state.md` — log entry adicionada
- Esta sessão — evidência de execução

### Pendente
- Commit/push/PR (aprovação nominal)
- Smoke real em container (build Docker + `docker run` local ou deploy beta)
