import { randomUUID } from "node:crypto";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import type { Database } from "../db.js";
import { importLegacyComments, legacyExportSchema, orderByParent } from "./importLegacyComments.js";

/**
 * T5.1b/T5.2c (spec 090) — o importador roda duas vezes e o resultado é
 * idêntico.
 *
 * O aceite da task é executável ("o importador roda duas vezes e o resultado é
 * idêntico, sem o `downloads` tocar o banco central"), e idempotência por
 * UNIQUE parcial não se prova com mock: `uq_community_comment_legacy
 * (legacy_source, legacy_id) WHERE legacy_source IS NOT NULL` e o FK
 * DEFERRABLE de `current_version_id` só se comportam como o real contra
 * PostgreSQL de verdade.
 *
 * Mesmo padrão de `notificationOutboxSavepoint.test.ts`: roda com
 * `COMMUNITY_TEST_DATABASE_URL`, pula sem falhar onde não há banco — o monorepo
 * não tem `pg-mem`/`testcontainers`.
 *
 * Para rodar:
 *   COMMUNITY_TEST_DATABASE_URL=postgres://... pnpm --filter @artificio/accounts test
 */

const databaseUrl = process.env.COMMUNITY_TEST_DATABASE_URL;

const db = databaseUrl
  ? new Kysely<Database>({
      dialect: new PostgresDialect({ pool: new Pool({ connectionString: databaseUrl }) }),
    })
  : undefined;

afterAll(async () => {
  await db?.destroy();
});

const REALM = "prod" as const;

async function insertUser(): Promise<string> {
  const row = await db!
    .insertInto("users")
    .values({
      google_sub: `import-test-${randomUUID()}`,
      email: `import-test-${randomUUID()}@example.test`,
      name: "Import Test",
      // `avatar` e `role` são obrigatórios em `UserRow` (sem `Generated`), ao
      // contrário de `avatar_source`/`role_version`/`created_at`.
      avatar: null,
      role: "user",
    })
    .returning(["id"])
    .executeTakeFirstOrThrow();
  return row.id;
}

function exportPayload(userId: string, subjectId: string, overrides: Partial<{
  removed_at: string | null;
  removed_reason: string | null;
}> = {}) {
  const legacyId = randomUUID();
  return {
    source_app: "downloads" as const,
    exported_at: new Date().toISOString(),
    count: 1,
    comments: [
      {
        legacy_source: "downloads",
        legacy_id: legacyId,
        subject_type: "downloads.material",
        subject_id: subjectId,
        canonical_path: "/materiais/teste-import",
        author_user_id: userId,
        content_html: "Comentário legado preservado.",
        sanitizer_policy: "content-editor/sanitizeUserMarkdown",
        sanitizer_version: 1,
        removed_at: null,
        removed_reason: null,
        created_at: "2026-01-02T03:04:05.000Z",
        ...overrides,
      },
    ],
  };
}

describe("contrato do export (sem banco)", () => {
  it("recusa export cuja contagem declarada não bate com o conteúdo", async () => {
    const payload = { ...exportPayload(randomUUID(), "material-x"), count: 5 };

    // Guarda que existe para impedir o pior resultado possível: migração
    // parcial que passa por sucesso porque ninguém conferiu o total.
    await expect(importLegacyComments({} as never, payload, { realm: REALM }))
      .rejects.toThrow(/declarou 5/);
  });

  it("recusa payload fora do contrato antes de qualquer escrita", async () => {
    await expect(importLegacyComments({} as never, { source_app: "downloads" }, { realm: REALM }))
      .rejects.toThrow(/fora do contrato/);
  });

  it("aceita conjunto vazio como resultado legítimo, não como erro", () => {
    const parsed = legacyExportSchema.safeParse({
      source_app: "downloads",
      exported_at: new Date().toISOString(),
      count: 0,
      comments: [],
    });

    // A medição de 2026-08-15 achou 0 linhas em produção: importar nada precisa
    // ser um caminho normal e explícito, nunca uma exceção que alguém trate
    // como falha do processo.
    expect(parsed.success).toBe(true);
  });
});

/**
 * T6.2 (spec 090) — o mesmo importador atende as DUAS formas de origem.
 *
 * A tabela comparativa do levantamento (`spec.md:22`) já registrava que o
 * `downloads` guarda `user_id` sem nome, enquanto o `site` guarda `author_name`
 * como texto solto sem conta, **com** threads. A Fase 5 implementou só a
 * primeira; estas asserções são o contrato da segunda.
 */
describe("contrato multi-origem (site)", () => {
  const comentarioDoSite = (over: Record<string, unknown> = {}) => ({
    legacy_source: "site",
    legacy_id: "501",
    subject_type: "site.post",
    subject_id: "10",
    canonical_path: "/blog/meu-post/",
    author_name: "Visitante Antigo",
    content_html: "<p>oi</p>",
    sanitizer_policy: "site-comment-html",
    sanitizer_version: 1,
    created_at: new Date("2019-05-04T12:00:00.000Z").toISOString(),
    ...over,
  });

  const exportDoSite = (comments: unknown[]) => ({
    source_app: "site",
    exported_at: new Date().toISOString(),
    count: comments.length,
    comments,
  });

  it("aceita autoria por nome, sem user_id — o site não tem conta por trás", () => {
    // Requisito 9: legado do `site` entra com "`user_id` nulo,
    // `legacy_author_name`, autoria não verificada". Exigir UUID aqui tornaria
    // o requisito impossível de cumprir.
    const parsed = legacyExportSchema.safeParse(exportDoSite([comentarioDoSite()]));

    expect(parsed.success).toBe(true);
  });

  it("recusa comentário sem nenhuma forma de autoria", () => {
    const semAutor = comentarioDoSite();
    delete (semAutor as Record<string, unknown>).author_name;

    // Sem nenhuma das duas vias, `legacy_author_name` sairia nulo e o `CHECK`
    // recusaria a linha lá no `INSERT` — erro de driver, sem dizer qual.
    const parsed = legacyExportSchema.safeParse(exportDoSite([semAutor]));

    expect(parsed.success).toBe(false);
  });

  it("aceita removed_at ausente — o site não tem coluna de remoção", () => {
    // `site.comments` (`001_init.sql:66-73`) não tem `removed_at`. O exportador
    // omite em vez de fabricar `null` para coluna inexistente.
    const parsed = legacyExportSchema.safeParse(exportDoSite([comentarioDoSite()]));

    expect(parsed.success).toBe(true);
  });

  it("continua aceitando o formato do downloads, sem author_name", () => {
    // Retrocompatibilidade: a Fase 5 já rodou em beta e prod, e um schema que
    // quebrasse o formato antigo tornaria a reexecução impossível.
    const parsed = legacyExportSchema.safeParse(
      exportPayload(randomUUID(), "material-x"),
    );

    expect(parsed.success).toBe(true);
  });
});

describe("ordenação de pai antes de filho", () => {
  const no = (id: string, pai: string | null = null) => ({
    legacy_id: id,
    parent_legacy_id: pai,
  });

  it("emite o pai antes do filho, mesmo fora de ordem na entrada", () => {
    const { ordered, unresolved } = orderByParent([no("b", "a"), no("a"), no("c", "b")]);

    expect(ordered.map((n) => n.legacy_id)).toEqual(["a", "b", "c"]);
    expect(unresolved).toHaveLength(0);
  });

  it("separa órfão cujo pai não está no lote", () => {
    // `site.comments.parent_id` não tem FK (`spec.md:151`): a origem pode
    // apontar para id que não existe. A spec manda detectar antes da cópia.
    const { ordered, unresolved } = orderByParent([no("a"), no("b", "inexistente")]);

    expect(ordered.map((n) => n.legacy_id)).toEqual(["a"]);
    expect(unresolved.map((n) => n.legacy_id)).toEqual(["b"]);
  });

  it("separa ciclo em vez de girar para sempre", () => {
    // A→B→A nunca resolve. Sem esta detecção o laço de Kahn não termina, ou
    // pior, o ciclo entraria como raiz e inventaria conversa que não existiu.
    const { ordered, unresolved } = orderByParent([no("a", "b"), no("b", "a"), no("c")]);

    expect(ordered.map((n) => n.legacy_id)).toEqual(["c"]);
    expect(unresolved.map((n) => n.legacy_id).sort()).toEqual(["a", "b"]);
  });

  it("preserva lista plana do downloads sem alteração", () => {
    const plana = [no("1"), no("2"), no("3")];

    expect(orderByParent(plana).ordered.map((n) => n.legacy_id)).toEqual(["1", "2", "3"]);
  });
});

describe.skipIf(!db)("importação contra PostgreSQL real", () => {
  it("importa, e a segunda execução não duplica nem altera nada", async () => {
    const userId = await insertUser();
    const subjectId = randomUUID();
    const payload = exportPayload(userId, subjectId);
    const legacyId = payload.comments[0].legacy_id;

    const primeira = await importLegacyComments(db!, payload, { realm: REALM });
    expect(primeira).toMatchObject({
      declared: 1,
      received: 1,
      inserted: 1,
      skipped: 0,
      divergences: [],
    });

    const depoisDaPrimeira = await db!
      .selectFrom("community_comment")
      .select(["id", "body_markdown", "visibility_state", "current_version_id", "created_at"])
      .where("legacy_source", "=", "downloads")
      .where("legacy_id", "=", legacyId)
      .executeTakeFirstOrThrow();

    const segunda = await importLegacyComments(db!, payload, { realm: REALM });
    expect(segunda).toMatchObject({ inserted: 0, skipped: 1, divergences: [] });

    const linhas = await db!
      .selectFrom("community_comment")
      .select(["id", "body_markdown", "visibility_state", "current_version_id", "created_at"])
      .where("legacy_source", "=", "downloads")
      .where("legacy_id", "=", legacyId)
      .execute();

    // Idêntico, não só "sem duplicata": o id, a versão corrente e o momento
    // original precisam ser os mesmos, senão a reexecução teria reescrito o
    // que já estava lá.
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toEqual(depoisDaPrimeira);
  });

  /**
   * A reexecução não pode custar escrita **nenhuma**, e não só "nenhum
   * comentário duplicado".
   *
   * Este teste cobre o defeito real: o ator que assina a remoção herdada nasce
   * ANTES do `INSERT` do comentário (a FK `removed_by_actor_id` não é
   * DEFERRABLE), então com `onConflict doNothing` a segunda execução pulava o
   * comentário e mesmo assim comitava o ator — um `community_actor` órfão a
   * mais por rodada, para sempre, em produção. O mesmo valia para o
   * `updated_at` do assunto. Contar linhas dos dois lados é o que prova que o
   * rollback do skip funciona.
   */
  it("segunda execução não deixa ator órfão nem toca o assunto", async () => {
    const userId = await insertUser();
    const subjectId = randomUUID();
    // Comentário REMOVIDO: é o único caminho que cria `community_actor`.
    const payload = exportPayload(userId, subjectId, {
      removed_at: "2026-01-01T00:00:00.000Z",
      removed_reason: "Removido pela moderação.",
    });

    await importLegacyComments(db!, payload, { realm: REALM });

    const contaAtores = async () => {
      const row = await db!
        .selectFrom("community_actor")
        .select((eb) => eb.fn.countAll<string>().as("total"))
        .executeTakeFirstOrThrow();
      return Number(row.total);
    };
    const assunto = async () =>
      db!
        .selectFrom("community_comment_subject")
        .select(["updated_at", "ranking_revision"])
        .where("realm", "=", REALM)
        .where("source_app", "=", "downloads")
        .where("subject_id", "=", subjectId)
        .executeTakeFirstOrThrow();

    const atoresAntes = await contaAtores();
    const assuntoAntes = await assunto();

    const segunda = await importLegacyComments(db!, payload, { realm: REALM });
    expect(segunda).toMatchObject({ inserted: 0, skipped: 1, divergences: [] });

    expect(await contaAtores()).toBe(atoresAntes);
    expect(await assunto()).toEqual(assuntoAntes);
  });

  it("preserva o momento original e a versão corrente aponta para o corpo", async () => {
    const userId = await insertUser();
    const payload = exportPayload(userId, randomUUID());

    await importLegacyComments(db!, payload, { realm: REALM });

    const comentario = await db!
      .selectFrom("community_comment")
      .select(["id", "current_version_id", "created_at", "root_id", "depth"])
      .where("legacy_id", "=", payload.comments[0].legacy_id)
      .executeTakeFirstOrThrow();

    expect(comentario.created_at.toISOString()).toBe("2026-01-02T03:04:05.000Z");
    // Legado do `downloads` é lista plana: todo comentário é raiz.
    expect(comentario.root_id).toBe(comentario.id);
    expect(comentario.depth).toBe(0);

    const versao = await db!
      .selectFrom("community_comment_version")
      .select(["id", "comment_id", "body_markdown", "legacy_content_html", "authored_by_actor_id"])
      .where("id", "=", comentario.current_version_id)
      .executeTakeFirstOrThrow();

    expect(versao.comment_id).toBe(comentario.id);
    // Legado guarda o corpo em `legacy_content_html`, com `body_markdown`
    // NULO e sem ator — as duas metades de
    // `community_comment_version_body_check` e `..._body_kind_check`. Não
    // existe híbrido: a primeira versão deste import gravava ator +
    // `body_markdown` no legado e o banco recusou.
    expect(versao.legacy_content_html).toBe("Comentário legado preservado.");
    expect(versao.body_markdown).toBeNull();
    expect(versao.authored_by_actor_id).toBeNull();
  });

  it("importa com autoria NÃO verificada: ator nulo e nome como rótulo", async () => {
    const userId = await insertUser();
    const payload = exportPayload(userId, randomUUID());

    await importLegacyComments(db!, payload, { realm: REALM });

    const comentario = await db!
      .selectFrom("community_comment")
      .select([
        "community_actor_id",
        "legacy_author_name",
        "legacy_source",
        "body_markdown",
        "legacy_content_html",
        "legacy_sanitizer_policy",
        "legacy_sanitizer_version",
      ])
      .where("legacy_id", "=", payload.comments[0].legacy_id)
      .executeTakeFirstOrThrow();

    // Requisito 9: legado entra com `user_id` nulo e autoria não verificada.
    // Vincular a conta daria ao comentário antigo voto, edição e badge que o
    // requisito nega — e o `CHECK` do banco recusa o vínculo.
    expect(comentario.community_actor_id).toBeNull();
    expect(comentario.legacy_author_name).toBe("Import Test");
    expect(comentario.legacy_source).toBe("downloads");
    // Requisito 10: política e versão do sanitizador viajam com o corpo, para
    // permitir reprocessamento seletivo quando a política mudar.
    expect(comentario.legacy_sanitizer_policy).toBe("content-editor/sanitizeUserMarkdown");
    expect(comentario.legacy_sanitizer_version).toBe(1);
  });

  it("usa rótulo neutro quando a conta de origem não existe mais", async () => {
    const payload = exportPayload(randomUUID(), randomUUID());

    const relatorio = await importLegacyComments(db!, payload, { realm: REALM });

    // Conta apagada **não** é divergência: o legado nunca dependeu de vínculo.
    // Inventar um nome seria pior que o rótulo que o payload público já usa.
    expect(relatorio.inserted).toBe(1);
    expect(relatorio.divergences).toEqual([]);

    const comentario = await db!
      .selectFrom("community_comment")
      .select(["legacy_author_name"])
      .where("legacy_id", "=", payload.comments[0].legacy_id)
      .executeTakeFirstOrThrow();

    expect(comentario.legacy_author_name).toBe("Conta excluída");
  });

  it("mantém retirado o que a moderação já tinha retirado", async () => {
    const userId = await insertUser();
    const payload = exportPayload(userId, randomUUID(), {
      removed_at: "2026-02-03T00:00:00.000Z",
      removed_reason: "Removido pela moderação após denúncia.",
    });

    await importLegacyComments(db!, payload, { realm: REALM });

    const comentario = await db!
      .selectFrom("community_comment")
      .select(["visibility_state", "removed_at", "removed_reason"])
      .where("legacy_id", "=", payload.comments[0].legacy_id)
      .executeTakeFirstOrThrow();

    // Republicar fala que a moderação derrubou seria o pior defeito possível
    // de uma migração de conteúdo.
    expect(comentario.visibility_state).toBe("moderator_removed");
    expect(comentario.removed_at).not.toBeNull();
  });

  it("registra divergência por item, sem derrubar o lote", async () => {
    const userId = await insertUser();
    const bom = exportPayload(userId, randomUUID());
    // Falha de verdade: `canonical_path` com esquema é recusado pelo
    // `community_comment_subject` (o CHECK exige caminho relativo, nunca URL —
    // requisito 5b, contra open redirect). Autor inexistente **não** serve como
    // caso ruim: legado não tem vínculo com conta, então é caminho normal.
    const ruim = exportPayload(userId, randomUUID());
    ruim.comments[0].canonical_path = "https://evil.example/roubo";

    const relatorio = await importLegacyComments(
      db!,
      {
        source_app: "downloads" as const,
        exported_at: new Date().toISOString(),
        count: 2,
        comments: [...bom.comments, ...ruim.comments],
      },
      { realm: REALM },
    );

    expect(relatorio.inserted).toBe(1);
    expect(relatorio.divergences).toHaveLength(1);
    expect(relatorio.divergences[0].legacy_id).toBe(ruim.comments[0].legacy_id);
    // T5.2c: cada divergência sai com causa registrada, não um "ok" genérico.
    expect(relatorio.divergences[0].reason).toBeTruthy();
  });
});

/**
 * T6.2 (spec 090) — o caminho do `site` contra PostgreSQL real.
 *
 * As asserções sem banco provam o contrato; estas provam que o **schema**
 * aceita. São coisas diferentes: `community_comment_body_kind_check`,
 * `community_comment_root_shape_check` e o FK DEFERRABLE de `current_version_id`
 * só se comportam como o real contra Postgres de verdade — foi exatamente onde
 * a Fase 5 descobriu que legado não podia ter ator nem `body_markdown`.
 */
describe.skipIf(!db)("importação do site contra PostgreSQL real", () => {
  const comentarioDoSite = (
    subjectId: string,
    legacyId: string,
    parentLegacyId: string | null = null,
  ) => ({
    legacy_source: "site",
    legacy_id: legacyId,
    subject_type: "site.post",
    subject_id: subjectId,
    canonical_path: "/blog/meu-post/",
    // Sem `author_user_id`: o blog não tem conta por trás (requisito 9).
    author_name: "Visitante Antigo",
    parent_legacy_id: parentLegacyId,
    content_html: "<p>fala antiga</p>",
    sanitizer_policy: "site-comment-html",
    sanitizer_version: 1,
    created_at: new Date("2019-05-04T12:00:00.000Z").toISOString(),
    // Sem `removed_at`: `site.comments` não tem coluna de remoção.
  });

  const exportDoSite = (comments: unknown[]) => ({
    source_app: "site",
    exported_at: new Date().toISOString(),
    count: comments.length,
    comments,
  });

  it("importa sem conta vinculada e preserva a árvore aninhada", async () => {
    const subjectId = randomUUID();
    const raiz = `site-raiz-${randomUUID()}`;
    const filho = `site-filho-${randomUUID()}`;

    // Filho ANTES do pai na entrada, de propósito: a ordenação topológica é
    // que precisa resolver, não a sorte da ordem do export.
    const relatorio = await importLegacyComments(
      db!,
      exportDoSite([
        comentarioDoSite(subjectId, filho, raiz),
        comentarioDoSite(subjectId, raiz),
      ]),
      { realm: REALM },
    );

    expect(relatorio).toMatchObject({ inserted: 2, skipped: 0, divergences: [] });

    const linhas = await db!
      .selectFrom("community_comment")
      .select(["legacy_id", "legacy_author_name", "community_actor_id", "body_markdown",
        "legacy_content_html", "legacy_sanitizer_policy", "parent_id", "root_id", "depth"])
      .where("source_app", "=", "site")
      .where("subject_id", "=", subjectId)
      .execute();

    const linhaRaiz = linhas.find((l) => l.legacy_id === raiz)!;
    const linhaFilho = linhas.find((l) => l.legacy_id === filho)!;

    // Metade legada do `community_comment_body_kind_check`: ator NULO,
    // `body_markdown` NULO, corpo em `legacy_content_html`. Foi aqui que a
    // Fase 5 quebrou ao tentar o híbrido.
    expect(linhaRaiz.community_actor_id).toBeNull();
    expect(linhaRaiz.body_markdown).toBeNull();
    expect(linhaRaiz.legacy_content_html).toContain("fala antiga");
    // A política é o que faz `legacyBodyFormat` renderizar como HTML em vez de
    // markdown — o caminho que a Fase 5 deixou pronto e sem consumidor.
    expect(linhaRaiz.legacy_sanitizer_policy).toBe("site-comment-html");
    // Nome literal da origem, sem consultar `users`: não há conta a procurar.
    expect(linhaRaiz.legacy_author_name).toBe("Visitante Antigo");

    // `community_comment_root_shape_check`: raiz aponta para si, filho herda o
    // `root_id` do pai e soma 1 na profundidade. Achatar tudo em raiz
    // transformaria resposta em comentário solto.
    expect(linhaRaiz.root_id).toBe(linhaRaiz.parent_id === null ? linhaRaiz.root_id : null);
    expect(linhaRaiz.depth).toBe(0);
    expect(linhaFilho.parent_id).toBe(linhaRaiz.root_id);
    expect(linhaFilho.root_id).toBe(linhaRaiz.root_id);
    expect(linhaFilho.depth).toBe(1);
  });

  it("reexecução não duplica e o filho continua achando o pai já importado", async () => {
    const subjectId = randomUUID();
    const raiz = `site-raiz-${randomUUID()}`;
    const filho = `site-filho-${randomUUID()}`;
    const payload = exportDoSite([
      comentarioDoSite(subjectId, raiz),
      comentarioDoSite(subjectId, filho, raiz),
    ]);

    await importLegacyComments(db!, payload, { realm: REALM });
    const segunda = await importLegacyComments(db!, payload, { realm: REALM });

    // O pai cai em `SkipComment` e NÃO entra no mapa do lote. Sem a consulta a
    // `community_comment` por `(legacy_source, legacy_id)`, o filho viraria
    // raiz e achataria a árvore — silenciosamente, no caminho que mais roda.
    expect(segunda).toMatchObject({ inserted: 0, skipped: 2, divergences: [] });

    const total = await db!
      .selectFrom("community_comment")
      .select((eb) => eb.fn.countAll<string>().as("n"))
      .where("source_app", "=", "site")
      .where("subject_id", "=", subjectId)
      .executeTakeFirstOrThrow();
    expect(Number(total.n)).toBe(2);
  });

  it("órfão vira divergência em vez de entrar como raiz", async () => {
    const subjectId = randomUUID();
    const orfao = `site-orfao-${randomUUID()}`;

    const relatorio = await importLegacyComments(
      db!,
      exportDoSite([comentarioDoSite(subjectId, orfao, "pai-que-nao-existe")]),
      { realm: REALM },
    );

    // `site.comments.parent_id` não tem FK (`spec.md:151`): a origem pode
    // apontar para id inexistente. Importar como raiz inventaria uma conversa.
    expect(relatorio.inserted).toBe(0);
    expect(relatorio.divergences).toHaveLength(1);
    expect(relatorio.divergences[0].reason).toContain("pai não resolvido");
  });
});
