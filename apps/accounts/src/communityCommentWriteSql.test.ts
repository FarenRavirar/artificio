import { DummyDriver, Kysely, PostgresAdapter, PostgresIntrospector, PostgresQueryCompiler } from "kysely";
import { describe, expect, it } from "vitest";
import type { Database } from "./db.js";

/**
 * T2.6c — SQL compilado dos `INSERT` da transação de escrita.
 *
 * ## Por que este arquivo existe
 *
 * `communityCommentWrite.ts` montava o ator com `.values({})`. O tipo do Kysely
 * aceita — a tabela só tem colunas com default —, `tsc` passa, e o SQL gerado é
 * `insert into "community_actor" () values ()`, que o PostgreSQL recusa com
 * `syntax error at or near ")"`. Chegou em **produção** e só apareceu no
 * primeiro comentário real (2026-08-08).
 *
 * As três camadas de teste que existiam não podiam pegar:
 * - `communityCommentWriteRoutes.test.ts` **mocka** `createComment`;
 * - `phase-2-write-measurement.sql` escreve o ator em SQL direto
 *   (`INSERT ... DEFAULT VALUES`), então exercita o banco, não o builder;
 * - `tsc` valida o tipo, e o tipo estava correto.
 *
 * O gap é estrutural: **query builder gera SQL que só falha no banco**. Este
 * arquivo fecha o gap sem exigir PostgreSQL — compila a query com o dialeto real
 * (`DummyDriver` não conecta, mas o compilador é o de Postgres) e afirma sobre o
 * texto gerado.
 */

const db = new Kysely<Database>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (i) => new PostgresIntrospector(i),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

describe("SQL compilado da transação de escrita", () => {
  it("ator novo usa DEFAULT VALUES, nunca lista de colunas vazia", () => {
    const { sql } = db
      .insertInto("community_actor")
      .defaultValues()
      .returning("id")
      .compile();

    expect(sql).toContain("default values");
    // O defeito exato que foi a produção: `() values ()`.
    expect(sql).not.toMatch(/\(\s*\)\s*values\s*\(\s*\)/i);
  });

  it("`.values({})` PRODUZ o SQL inválido — é o que torna o teste acima necessário", () => {
    // Documenta o defeito em vez de só proibir: quem ler isto entende por que a
    // forma existe. Se uma versão futura do Kysely passar a emitir
    // `DEFAULT VALUES` para objeto vazio, este teste falha e o guard acima vira
    // redundante — falha útil, não ruído.
    // Sem `@ts-expect-error`: o tipo aceita `{}` **sem reclamar** — medido, o
    // build falhou com "Unused '@ts-expect-error' directive" quando tentei
    // marcar. É exatamente por isso que este arquivo existe: `tsc` não tem como
    // pegar, porque todas as colunas de `community_actor` têm default e o objeto
    // vazio é tipagem válida.
    const { sql } = db
      .insertInto("community_actor")
      .values({})
      .returning("id")
      .compile();

    expect(sql).toMatch(/\(\s*\)\s*values\s*\(\s*\)/i);
  });

  it("vínculo ator↔conta insere as duas colunas", () => {
    const { sql, parameters } = db
      .insertInto("community_actor_account_link")
      .values({ actor_id: "a", user_id: "u" })
      .compile();

    expect(sql).toContain('"actor_id"');
    expect(sql).toContain('"user_id"');
    expect(parameters).toEqual(["a", "u"]);
  });

  it("assunto usa ON CONFLICT DO UPDATE com RETURNING, não DO NOTHING", () => {
    // `DO NOTHING` compila, passa no `tsc` e devolve **zero linhas** no
    // conflito — que é o caso comum (assunto que já tem comentário). O handler
    // leria `ranking_revision` de `undefined` e o comentário nasceria com
    // revisão errada, ou o `executeTakeFirstOrThrow` derrubaria a transação. É o
    // mesmo tipo de defeito do `values({})`: só o SQL revela.
    const { sql } = db
      .insertInto("community_comment_subject")
      .values({
        realm: "beta",
        source_app: "site",
        subject_type: "site.post",
        subject_id: "p1",
        canonical_path: "/blog/p1",
        owner_user_id: null,
      })
      .onConflict((oc) =>
        oc
          .columns(["realm", "source_app", "subject_type", "subject_id"])
          .doUpdateSet({ canonical_path: "/blog/p1", owner_user_id: null }),
      )
      .returning(["ranking_revision", "owner_user_id"])
      .compile();

    expect(sql).toMatch(/on conflict\s*\(.+\)\s*do update set/is);
    expect(sql).not.toContain("do nothing");
    expect(sql).toContain('returning "ranking_revision"');
    // `ranking_revision` pertence ao assunto e é do voto (T2.13): reafirmá-lo
    // aqui zeraria a ordenação a cada comentário novo.
    expect(sql).not.toMatch(/set[^)]*"ranking_revision"\s*=/is);
  });

  it("recibo em lote gera um VALUES por destinatário", () => {
    // `notification_receipt` é inserido com `.values([...])` a partir da lista de
    // destinatários. Lista vazia geraria SQL inválido pelo mesmo motivo do ator —
    // por isso o handler só chama o insert quando há destinatário.
    const { sql, parameters } = db
      .insertInto("notification_receipt")
      .values([
        { realm: "beta", source_app: "site", event_id: "e", recipient_user_id: "u1", read_at: null },
        { realm: "beta", source_app: "site", event_id: "e", recipient_user_id: "u2", read_at: null },
      ])
      .compile();

    expect(sql).toMatch(/values\s*\(.+\),\s*\(/is);
    expect(parameters).toContain("u1");
    expect(parameters).toContain("u2");
  });
});
