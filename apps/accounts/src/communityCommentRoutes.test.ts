import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { issueTreeCursor, CURSOR_TTL_MS } from "@artificio/comments";
import { createApp } from "./app.js";
import type { AccountsEnv } from "./env.js";
import { hashServiceSecret } from "./serviceCredential.js";

/**
 * T2.3 — aceite de `GET /internal/v1/comments` (`contrato-http-v1.md` §2).
 *
 * O aceite escrito na task tem três provas: árvore de 1.500 comentários devolve
 * `more` sem órfão; expansão na mesma revisão não duplica nem perde item; e
 * cursor expirado falha explicitamente em vez de devolver posição errada.
 *
 * As duas primeiras já rodam sem banco em `packages/comments`
 * (`treeAssembly.test.ts`), onde a lógica de corte mora. O que estes testes
 * cobrem é a outra metade — a que só existe aqui: escopo, derivação de
 * `realm`/`source_app` pela credencial, tradução para o payload público e o
 * ciclo de vida do cursor ponta a ponta pela rota.
 */

const CREDENTIAL_SECRET = "segredo-de-credencial-registrada";
const CURSOR_KEY = "cursor-key-cursor-key-cursor-key-32";
const SUBJECT = { subject_type: "downloads.material", subject_id: "material-1" };

const env: AccountsEnv = {
  ACCOUNTS_COMMENT_CURSOR_KEY: CURSOR_KEY,
  COOKIE_DOMAIN: ".artificiorpg.com",
  DATABASE_URL: "postgres://admin:admin@localhost:5432/artificio_auth",
  GOOGLE_CALLBACK_URL: "https://accounts.artificiorpg.com/api/auth/google/callback",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_CLIENT_SECRET: "client-secret",
  JWT_REFRESH_SECRET: "refresh-secret-refresh-secret-refresh",
  JWT_SECRET: "access-secret-access-secret-access",
  PORT: 3000,
  PUBLIC_URL: "https://accounts.artificiorpg.com",
  TRUSTED_PROXY_CIDR: "172.18.0.0/16",
};

async function credentialRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    token_id: "downloads-prod-abcd1234",
    token_hash: await hashServiceSecret(CREDENTIAL_SECRET),
    source_app: "downloads",
    realms: ["prod"],
    scopes: ["comment.read"],
    ...overrides,
  };
}

interface CommentFixture {
  id: string;
  parent_id: string | null;
  depth: number;
  created_at: string;
  body_markdown?: string | null;
  visibility_state?: string;
  legacy_source?: string | null;
  legacy_author_name?: string | null;
  my_vote?: number | null;
}

function rawRow(fixture: CommentFixture) {
  return {
    id: fixture.id,
    parent_id: fixture.parent_id,
    root_id: fixture.parent_id === null ? fixture.id : "root-of-branch",
    depth: fixture.depth,
    body_markdown: fixture.body_markdown ?? `corpo de ${fixture.id}`,
    legacy_content_html: null,
    visibility_state: fixture.visibility_state ?? "visible",
    edited_at: null,
    created_at: new Date(fixture.created_at),
    legacy_source: fixture.legacy_source ?? null,
    legacy_author_name: fixture.legacy_author_name ?? null,
    author_display_name: fixture.legacy_source ? null : "Ana",
    author_avatar_url: null,
    upvotes: 3,
    downvotes: 1,
    score: 2,
    my_vote: fixture.my_vote ?? null,
    sort_key: `${fixture.created_at}|${fixture.id}`,
  };
}

/**
 * Fake do Kysely por tabela.
 *
 * A leitura em árvore usa `sql` cru (CTE recursiva), então o fake precisa
 * responder ao `execute` do template, e não só ao builder encadeado — é a
 * mesma razão pela qual `internalUsers.test.ts` precisou distinguir tabelas
 * quando o guard de credencial entrou: um fake que devolve a mesma coisa para
 * tudo "autentica" qualquer coisa e o teste passa sem provar nada.
 */
function fakeDb(options: {
  credential?: Record<string, unknown>;
  subjectRevision?: number | null;
  comments?: CommentFixture[];
  actorId?: string | null;
}) {
  const { credential, subjectRevision = 7, comments = [], actorId = null } = options;

  const executeRaw = vi.fn().mockResolvedValue({
    rows: comments.map((fixture) => rawRow(fixture)),
  });

  return {
    executeRaw,
    db: {
      selectFrom: (table: string) => {
        const result =
          table === "community_service_credential"
            ? credential
            : table === "community_comment_subject"
              ? subjectRevision === null
                ? undefined
                : { ranking_revision: subjectRevision }
              : table === "community_actor_account_link"
                ? actorId === null
                  ? undefined
                  : { actor_id: actorId }
                : undefined;

        const builder = {
          select: () => builder,
          where: () => builder,
          executeTakeFirst: vi.fn().mockResolvedValue(result),
        };
        return builder;
      },
      updateTable: () => ({
        set: () => ({
          where: () => ({ execute: vi.fn().mockResolvedValue([]) }),
        }),
      }),
      // `sql\`...\`.execute(db)` chama `executeQuery` no driver do Kysely.
      getExecutor: () => ({
        executeQuery: executeRaw,
      }),
    } as never,
  };
}

function authed(app: ReturnType<typeof createApp>, path: string) {
  return request(app)
    .get(path)
    .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`);
}

function queryFor(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ ...SUBJECT, ...extra });
  return `/internal/v1/comments?${params.toString()}`;
}

describe("GET /internal/v1/comments — autenticação e escopo", () => {
  it("401 sem X-Service-Token", async () => {
    const { db } = fakeDb({});
    const app = createApp(env, db);

    const response = await request(app).get(queryFor()).expect(401);
    expect(response.body).toEqual({ error: "unauthorized" });
  });

  it("403 quando a credencial não tem comment.read", async () => {
    const { db } = fakeDb({ credential: await credentialRow({ scopes: ["users.read"] }) });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(403);
    expect(response.body).toEqual({ error: "insufficient_scope" });
  });
});

describe("GET /internal/v1/comments — contrato da query", () => {
  it("400 sem subject_type", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    const response = await authed(app, "/internal/v1/comments?subject_id=material-1").expect(400);
    expect(response.body.error.code).toBe("invalid_query");
  });

  it("400 com sort fora dos quatro aceitos", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    const response = await authed(app, queryFor({ sort: "hot" })).expect(400);
    expect(response.body.error.code).toBe("invalid_query");
  });

  it("ecoa X-Correlation-Id no erro", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    const response = await request(app)
      .get(queryFor({ sort: "hot" }))
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Correlation-Id", "corr-123")
      .expect(400);

    expect(response.body.error.correlation_id).toBe("corr-123");
  });
});

describe("GET /internal/v1/comments — assunto sem comentário", () => {
  it("devolve árvore vazia e revisão 0, não 404", async () => {
    const { db } = fakeDb({ credential: await credentialRow(), subjectRevision: null });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);

    expect(response.body).toEqual({
      state: "fresh",
      snapshot_revision: 0,
      comments: [],
      more: [],
      truncated: false,
    });
  });
});

describe("GET /internal/v1/comments — cursor", () => {
  it("400/invalid_cursor com cursor expirado", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    // Emitido no passado o bastante para o TTL de 30 min já ter vencido.
    const expired = issueTreeCursor(
      {
        ...SUBJECT,
        sort: "best",
        snapshot_revision: 7,
        branch_id: null,
        after: "2026-01-01T00:00:00.000000Z|a",
        limit: 1000,
      },
      CURSOR_KEY,
      Date.now() - CURSOR_TTL_MS - 1000,
    );

    const response = await authed(app, queryFor({ cursor: expired })).expect(400);
    expect(response.body.error.code).toBe("invalid_cursor");
  });

  it("400/invalid_cursor com cursor assinado por outra chave", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    const forged = issueTreeCursor(
      {
        ...SUBJECT,
        sort: "best",
        snapshot_revision: 7,
        branch_id: null,
        after: "2026-01-01T00:00:00.000000Z|a",
        limit: 1000,
      },
      "outra-chave-outra-chave-outra-chave-32",
    );

    const response = await authed(app, queryFor({ cursor: forged })).expect(400);
    expect(response.body.error.code).toBe("invalid_cursor");
  });

  it("400/invalid_cursor com cursor de outro assunto", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    const otherSubject = issueTreeCursor(
      {
        subject_type: "downloads.material",
        subject_id: "material-OUTRO",
        sort: "best",
        snapshot_revision: 7,
        branch_id: null,
        after: "2026-01-01T00:00:00.000000Z|a",
        limit: 1000,
      },
      CURSOR_KEY,
    );

    const response = await authed(app, queryFor({ cursor: otherSubject })).expect(400);
    expect(response.body.error.code).toBe("invalid_cursor");
  });
});
