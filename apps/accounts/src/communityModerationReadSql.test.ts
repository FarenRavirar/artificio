import {
  CompiledQuery,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type DatabaseConnection,
  type Driver,
  type QueryResult,
} from "kysely";
import { beforeEach, describe, expect, it } from "vitest";
import type { Database } from "./db.js";
import {
  listActiveReportReasons,
  listOwnReports,
} from "./communityCommentReport.js";
import {
  readAppealForModerator,
  readOwnAppeal,
} from "./communityModerationAppeal.js";
import {
  readCaseDetail,
  readNewAccountCommentCandidates,
} from "./communityModerationQueue.js";
import { readCommunityAccountStatus } from "./communityNewAccount.js";

interface Capture {
  sqls: string[];
  params: readonly unknown[][];
  enqueue: (rows: unknown[]) => void;
}

function captureDb(): { db: Kysely<Database>; capture: Capture } {
  const sqls: string[] = [];
  const params: unknown[][] = [];
  const queue: unknown[][] = [];
  const connection: DatabaseConnection = {
    executeQuery: async <R>(compiled: CompiledQuery): Promise<QueryResult<R>> => {
      sqls.push(compiled.sql);
      params.push([...compiled.parameters]);
      if (/^\s*(begin|commit|rollback)/i.test(compiled.sql)) return { rows: [] as R[] };
      return { rows: (queue.shift() ?? []) as R[] };
    },
    streamQuery: async function* () {},
  };
  const driver: Driver = {
    init: async () => {},
    acquireConnection: async () => connection,
    beginTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("begin"));
    },
    commitTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("commit"));
    },
    rollbackTransaction: async (conn) => {
      await conn.executeQuery(CompiledQuery.raw("rollback"));
    },
    releaseConnection: async () => {},
    destroy: async () => {},
  };
  const db = new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => driver,
      createIntrospector: (instance) => new PostgresIntrospector(instance),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
  });
  return { db, capture: { sqls, params, enqueue: (rows) => queue.push(rows) } };
}

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPEAL_ID = "66666666-6666-4666-8666-666666666666";
const CASE_ID = "44444444-4444-4444-8444-444444444444";
const COMMENT_ID = "22222222-2222-4222-8222-222222222222";
const WHEN = new Date("2026-08-09T12:00:00.000Z");

let ctx = captureDb();
beforeEach(() => {
  ctx = captureDb();
});

describe("leituras privadas de denúncia e recurso — SQL compilado", () => {
  it("filtra denúncias pelo ator resolvido e projeta resultado mínimo", async () => {
    ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);
    ctx.capture.enqueue([
      {
        id: "55555555-5555-4555-8555-555555555555",
        realm: "beta",
        source_app: "downloads",
        comment_id: COMMENT_ID,
        reason_code: "spam_or_off_topic",
        state: "upheld",
        created_at: WHEN,
        comment_visibility_state: "moderator_removed",
      },
    ]);

    const reports = await listOwnReports(ctx.db, USER_ID);
    const query = ctx.capture.sqls.find((sql) => sql.includes("community_comment_report"));

    expect(query).toContain('"r"."reporter_actor_id" =');
    expect(query).not.toContain("resolution_reason");
    expect(query).not.toContain("resolved_by_actor_id");
    expect(reports[0]).toEqual(
      expect.objectContaining({ result: "action_taken", can_withdraw: false }),
    );
  });

  it("usuário sem ator recebe coleção vazia sem consultar denúncias", async () => {
    ctx.capture.enqueue([]);
    await expect(listOwnReports(ctx.db, USER_ID)).resolves.toEqual([]);
    expect(ctx.capture.sqls.filter((sql) => sql.includes("select "))).toHaveLength(1);
  });

  it("recurso próprio filtra simultaneamente por id e appellant_actor_id", async () => {
    ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);
    ctx.capture.enqueue([
      {
        id: APPEAL_ID,
        case_id: CASE_ID,
        status: "open",
        submitted_at: WHEN,
        appeal_deadline_at: new Date("2027-02-09T12:00:00.000Z"),
        decided_at: null,
      },
    ]);

    const appeal = await readOwnAppeal(ctx.db, USER_ID, APPEAL_ID);
    const query = ctx.capture.sqls.find((sql) => sql.includes("community_comment_appeal"));

    expect(query).toContain('"id" =');
    expect(query).toContain('"appellant_actor_id" =');
    expect(query).not.toContain("decision_reason");
    expect(appeal?.decision).toBeNull();
  });
});

describe("leituras internas — SQL compilado", () => {
  it("deriva conta nova de users.created_at OU contagem total do ator", async () => {
    ctx.capture.enqueue([
      { created_at: new Date("2026-08-01T12:00:00.000Z"), comment_count: "2" },
    ]);

    const status = await readCommunityAccountStatus(ctx.db, USER_ID, WHEN);

    expect(ctx.capture.sqls[0]).toContain(
      'left join "community_actor_account_link" as "l"',
    );
    expect(ctx.capture.sqls[0]).toContain("count(*)");
    expect(status).toMatchObject({
      isNew: true,
      accountIsYoung: false,
      commentCountIsLow: true,
    });
  });

  it("lista candidatos visíveis sem caso e mantém os dois sinais no payload", async () => {
    ctx.capture.enqueue([
      {
        comment_id: COMMENT_ID,
        source_app: "downloads",
        community_actor_id: ACTOR_ID,
        created_at: WHEN,
        comment_visibility_state: "visible",
        account_created_at: new Date("2026-08-08T12:00:00.000Z"),
        author_comment_count: "1",
      },
    ]);

    const candidates = await readNewAccountCommentCandidates(
      ctx.db,
      { realm: "beta", sourceApp: "downloads", limit: 20 },
      WHEN,
    );

    expect(ctx.capture.sqls[0]).toContain("not exists");
    expect(ctx.capture.sqls[0]).toContain("u.created_at >");
    expect(ctx.capture.sqls[0]).toContain("or (");
    expect(candidates[0]).toEqual(
      expect.objectContaining({
        comment_id: COMMENT_ID,
        author_comment_count: 1,
        new_account_reasons: ["account_age", "comment_count"],
      }),
    );
  });

  it("catálogo lê somente motivos ativos de comentário", async () => {
    ctx.capture.enqueue([
      {
        code: "spam_or_off_topic",
        label: "Spam ou fora do assunto",
        priority: 2,
        details_policy: "optional",
      },
    ]);
    const reasons = await listActiveReportReasons(ctx.db);
    expect(ctx.capture.sqls[0]).toContain('"target_type" =');
    expect(ctx.capture.sqls[0]).toContain('"active" =');
    expect(reasons).toHaveLength(1);
  });

  it("detalhe do recurso deriva o decisor atual e filtra pela credencial", async () => {
    ctx.capture.enqueue([{ actor_id: ACTOR_ID }]);
    ctx.capture.enqueue([
      {
        id: APPEAL_ID,
        case_id: CASE_ID,
        comment_version_id: "33333333-3333-4333-8333-333333333333",
        reason: "decisão incorreta",
        status: "open",
        submitted_at: WHEN,
        appeal_deadline_at: new Date("2027-02-09T12:00:00.000Z"),
        decided_at: null,
        original_decider_actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      },
    ]);

    const detail = await readAppealForModerator(ctx.db, {
      realm: "beta",
      sourceApp: "downloads",
      appealId: APPEAL_ID,
      moderatorUserId: USER_ID,
    });
    const query = ctx.capture.sqls.find((sql) => sql.includes("community_comment_appeal"));

    expect(query).toContain('"a"."realm" =');
    expect(query).toContain('"a"."source_app" =');
    expect(query).not.toContain("decision_reason");
    expect(detail).toEqual(
      expect.objectContaining({
        original_decider_actor_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        current_decider_actor_id: ACTOR_ID,
      }),
    );
  });

  it("detalhe do caso traz o ator do autor pelo comentário do mesmo realm/app", async () => {
    ctx.capture.enqueue([
      {
        id: CASE_ID,
        comment_id: COMMENT_ID,
        status: "open",
        terminal_action: null,
        opened_at: WHEN,
        closed_at: null,
        decision_reason: null,
        reported_author_actor_id: ACTOR_ID,
      },
    ]);
    ctx.capture.enqueue([]);

    const detail = await readCaseDetail(ctx.db, "beta", "downloads", CASE_ID);
    expect(ctx.capture.sqls[0]).toContain('inner join "community_comment" as "c"');
    expect(ctx.capture.sqls[0]).toContain('"mc"."realm" =');
    expect(ctx.capture.sqls[0]).toContain('"mc"."source_app" =');
    expect(detail?.reported_author_actor_id).toBe(ACTOR_ID);
  });
});
