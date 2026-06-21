# Sessão 26-06-20_5 — Dockerfile Sonar Smells (Review PR #74)

**Objetivo:** Registrar e corrigir 5 code smells apontados por review em Dockerfiles.

**Origem:** Review PR #74 (`apps/links`), Sonar/CodeRabbit.

---

## Débitos

| # | Arquivo | Linha | O quê |
|---|---------|-------|-------|
| 1 | `apps/links/Dockerfile` | 18 | `RUN test -d packages/media/...` quebrar com `\` |
| 2 | `apps/links/Dockerfile` | 23 | `RUN pnpm -w turbo run build` quebrar com `\` |
| 3 | `apps/mesas/backend/Dockerfile` | 35+39 | Merge `RUN install --prod` + `RUN test` em RUN único |
| 4 | `apps/mesas/backend/Dockerfile` | 39 | `RUN test -d packages/media/...` quebrar com `\` (absorvido por #3) |
| 5 | `apps/site/Dockerfile` | 18 | `RUN test -d packages/media/...` quebrar com `\` |

**Modelo:** `apps/site/Dockerfile:22-26` — já quebrado corretamente com `\`.

---

## Checklist

- [x] `apps/links/Dockerfile:18` — quebrar `RUN test` com `\`
- [x] `apps/links/Dockerfile:23` — quebrar `RUN turbo build` com `\`
- [x] `apps/mesas/backend/Dockerfile:35-39` — merge install+test em RUN único quebrado
- [x] `apps/site/Dockerfile:18` — quebrar `RUN test` com `\`
- [x] `apps/glossario/frontend/Dockerfile:35` — `RUN apk upgrade --no-cache libexpat` (CVE-2026-45186/41080, Snyk)
- [x] `apps/mesas/frontend/Dockerfile:48` — `RUN apk upgrade --no-cache libexpat` (CVE-2026-45186/41080, Snyk)
- [ ] `pnpm lint` ou `pnpm -w turbo run lint` verde
- [ ] Builds afetados verdes (links/mesas/site)
- [ ] Sessão fechada
- [x] `specs/backlog.md` atualizado
- [ ] `project-state.md` atualizado se pertinente

---

## Critério de conclusão

3 Dockerfiles corrigidos, builds verdes, sem regressão.
