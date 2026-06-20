# Prompt — D-SITE-ADVISORY-LOCK

```
T0 lido. Contexto: débito D-SITE-ADVISORY-LOCK — apps/site/db/migrate.ts:17,44
advisory lock via db.query() não-determinístico (pool pode usar conexões diferentes
para lock e unlock). Mesmo bug do links C7, já corrigido com pool.connect() dedicado.

Origem: spec 013, investigação C7, sessão sessoes/26-06-20_2_links_whatsapp-013-014.md.
Registrado em: specs/backlog.md.
Fix de referência: apps/links/db/migrate.ts (lockClient via pool.connect()).

PROBLEMA:
  apps/site/db/migrate.ts:17 → db.query("SELECT pg_advisory_lock($1)")
  apps/site/db/migrate.ts:44 → db.query("SELECT pg_advisory_unlock($1)")
  db.query() chama pool.query() (apps/site/db/connection.ts:38, pool max:10).
  Advisory locks são session-level no PG: lock adquirido na conexão A só pode ser
  liberado na conexão A. db.query() não garante mesma conexão → unlock pode
  retornar false (silencioso, sem throw) → lock órfão até pool.end().

  Risco prático: zero (single-process, pool.end() sempre roda no finally).
  Risco teórico: crash entre unlock falho e pool.end() → lock órfão até timeout TCP.

SOLUÇÃO ÚNICA (mais segura, escalável, robusta e eficiente):
  Estender a interface Db com getClient() — conexão dedicada que garante mesma
  sessão PG para lock+unlock, sem quebrar a abstração dual pg|pglite e sem
  expor o pool internamente.

  PASSO 1 — apps/site/db/connection.ts:
    Adicionar à interface Db:
      getClient(): Promise<{ query: ..., release: () => void }>

    Na factory pg (linha 36):
      getClient: async () => {
        const client = await pool.connect();
        return {
          query: (sql, params) => client.query(sql, params) as Promise<QueryResult<never>>,
          release: () => client.release(),
        };
      }

    Na factory pglite (linha 48):
      getClient: async () => ({
        query: db.query.bind(db),   // pglite não tem advisory lock, reusa query normal
        release: () => {},          // noop
      })

  PASSO 2 — apps/site/db/migrate.ts:
    Substituir:
      if (db.isPg) await db.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);
    Por:
      const lockClient = await db.getClient();
      if (db.isPg) await lockClient.query("SELECT pg_advisory_lock($1)", [LOCK_KEY]);

    E no finally (linha 43-45):
      if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
      lockClient.release();
      await db.close();

  Por que esta é a solução correta (sem alternativas):
    - Segura: lock+unlock na mesma conexão PG garantido (session-level).
    - Escalável: independe do pool size; funciona com qualquer max.
    - Robusta: pglite tratado sem condicional extra (getClient noop).
    - Eficiente: 1 conexão extra mantida durante todo o migrate, liberada no finally.
    - Não quebra abstração: Db permanece a interface única; migrate não importa pg raw.
    - Padrão consistente com links (pool.connect → lockClient).

ARQUIVOS A MODIFICAR:
  apps/site/db/connection.ts  — interface Db + factory pg + factory pglite
  apps/site/db/migrate.ts     — usar getClient() para advisory lock/unlock

VALIDAÇÃO:
  tsc --noEmit em apps/site. Se possível, build Astro do site.
  Confirmar que db.query() comum nas migrations (transações) continua funcionando
  (essas não precisam de conexão dedicada — só o advisory lock).

REGRAS:
  SDD Lite (app site isolado, sem tocar shared). Não commitar.
  Se encontrar outros padrões frágeis de lock/conexão no site, investigar e
  registrar débito. Documentar tudo na sessão + backlog.md + project-state.md.
```
