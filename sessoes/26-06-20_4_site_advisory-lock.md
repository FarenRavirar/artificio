# Sessão — 2026-06-20 — D-SITE-ADVISORY-LOCK

**Objetivo:** Fix advisory lock não-determinístico em `apps/site/db/migrate.ts` (SDD Lite, app site isolado).

**Vínculos:** `specs/backlog.md` (D-SITE-ADVISORY-LOCK), `sessoes/prompt-D-SITE-ADVISORY-LOCK.md`, spec 013 fix de referência (`apps/links/db/migrate.ts`).

## Plano

1. `connection.ts` — adicionar `DbClient` + `getClient()` à interface `Db`, implementar nas factories pg (`pool.connect()`) e pglite (noop).
2. `migrate.ts` — usar `lockClient = await db.getClient()` para lock+unlock advisory na mesma sessão PG.
3. `tsc --noEmit` + build Astro.
4. Registrar em backlog + project-state.

## Checklist

- [x] `connection.ts`: interface `DbClient` + `getClient()` no `Db`
- [x] `connection.ts`: factory pg — `getClient` via `pool.connect()`
- [x] `connection.ts`: factory pglite — `getClient` noop
- [x] `migrate.ts`: `lockClient = await db.getClient()`
- [x] `migrate.ts`: lock via `lockClient.query("SELECT pg_advisory_lock(...)")`
- [x] `migrate.ts`: unlock via `lockClient.query("SELECT pg_advisory_unlock(...)")` + `lockClient.release()` no finally
- [x] `importer/media.test.ts`: mock `getClient` adicionado
- [x] `tsc --noEmit` passou limpo
- [x] Build Astro passou (46 páginas)
- [x] Nenhum outro padrão frágil de advisory lock no site
- [x] `accounts` nem usa advisory lock — sem débito cross-app
- [x] Backlog atualizado: D-SITE-ADVISORY-LOCK → fechado
- [x] `project-state.md` atualizado

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `apps/site/db/connection.ts` | +interface `DbClient`, +`getClient()` no `Db`, implementado nas factories pg e pglite |
| `apps/site/db/migrate.ts` | `lockClient` via `getClient()`, lock+unlock mesma sessão, `release()` no finally |
| `apps/site/importer/media.test.ts` | `mockDb()` com `getClient` noop |

## Critério de conclusão

Interface `Db` expõe `getClient()` sem quebrar abstração dual pg/pglite. `migrate.ts` garante lock+unlock na mesma conexão PG. `tsc --noEmit` e build Astro passam. Nenhum commit (sem autorização).
