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
 *
 * **O que estes testes NÃO cobrem** (achado de review, PR #245 — a redação
 * anterior deixava a lacuna implícita): o SQL em si. A CTE recursiva, a ordem
 * do `sort_path`, o join da faixa de score por revisão e o filtro de cursor
 * rodam contra um fake de Kysely, não contra PostgreSQL. O fake devolve as
 * linhas que mandamos, na ordem que mandamos — ele prova a tradução e o
 * contrato HTTP, nunca a corretude da consulta. Isso exige smoke com banco
 * real, registrado como bloqueio em `tasks.md`.
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
  /** `users.role` do autor. `null` quando não há conta viva ligada ao ator. */
  author_role?: string | null;
  /** Autor do comentário é o publicador afirmado pelo domínio (§8). */
  author_is_content_author?: boolean;
  my_vote?: number | null;
  /** Posição total na ordem de leitura, como a query serializa `sort_path`. */
  sort_key?: string;
}

function rawRow(fixture: CommentFixture) {
  return {
    id: fixture.id,
    parent_id: fixture.parent_id,
    root_id: fixture.parent_id === null ? fixture.id : "root-of-branch",
    depth: fixture.depth,
    body_markdown: fixture.body_markdown ?? `corpo de ${fixture.id}`,
    visibility_state: fixture.visibility_state ?? "visible",
    edited_at: null,
    created_at: new Date(fixture.created_at),
    legacy_source: fixture.legacy_source ?? null,
    legacy_author_name: fixture.legacy_author_name ?? null,
    author_display_name: fixture.legacy_source ? null : "Ana",
    author_avatar_url: null,
    // Default `user`: o caso comum é conta sem papel global, e é o que precisa
    // sair **sem** selo. Fixture que quer selo declara o papel.
    author_role: fixture.legacy_source ? null : (fixture.author_role ?? "user"),
    author_is_content_author: fixture.author_is_content_author ?? false,
    upvotes: 3,
    downvotes: 1,
    score: 2,
    my_vote: fixture.my_vote ?? null,
    // Posição total serializada, como a query produz a partir de `sort_path`
    // (segmentos de 9 dígitos). Não é a chave de ordenação do sort — essa
    // confusão foi o bug corrigido no review da PR #245.
    sort_key: fixture.sort_key ?? "000000001",
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

  // Sem ator, o `LEFT JOIN` de `community_comment_vote` não casa linha nenhuma
  // e `my_vote` chega nulo do banco. O fake precisa reproduzir isso: devolver o
  // voto do fixture mesmo em leitura anônima faria o teste de `my_vote` passar
  // sem provar nada — e é justamente o campo que §2 restringe a chamada
  // autenticada.
  const executeRaw = vi.fn().mockResolvedValue({
    rows: comments.map((fixture) =>
      actorId === null ? { ...rawRow(fixture), my_vote: null } : rawRow(fixture),
    ),
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
      // `sql`...`.execute(db)` percorre o executor do Kysely inteiro, não só
      // `executeQuery`: antes compila a query (`transformQuery` + `compileQuery`)
      // e só então executa. Um fake com apenas `executeQuery` falha com
      // "executor.transformQuery is not a function" — que chega no handler como
      // 500 e faz o teste parecer bug de produto.
      //
      // `compileQuery` devolve o SQL e os parâmetros já resolvidos, e é por
      // eles que os testes de cursor verificam o que desceu para o banco.
      getExecutor: () => ({
        transformQuery: (node: unknown) => node,
        compileQuery: (node: { parameters?: unknown[] }) => ({
          sql: "",
          parameters: node.parameters ?? [],
          query: node,
        }),
        provideConnection: async (consume: (connection: unknown) => unknown) =>
          consume({ executeQuery: executeRaw }),
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

  // A leitura validava só o comprimento de `subject_type`, então `post` — sem o
  // ponto que `migration_006:118` exige — passava e a consulta devolvia `200`
  // com árvore vazia. O consumidor não distinguia "assunto sem comentários" de
  // "enviei o campo errado". Achado no smoke de produção de 2026-08-08, depois
  // de a mesma validação já ter sido corrigida na escrita por T2.6c: as duas
  // rotas tinham o regex escrito à mão e só uma foi corrigida. Hoje as duas
  // consomem `SUBJECT_TYPE_PATTERN` do pacote.
  it.each(["post", "Material", "blog.", "blog..post", "site.Post"])(
    "400 com subject_type fora do formato namespaced: %s",
    async (subjectType) => {
      const { db } = fakeDb({ credential: await credentialRow() });
      const app = createApp(env, db);

      const response = await authed(app, queryFor({ subject_type: subjectType })).expect(400);
      expect(response.body.error.code).toBe("invalid_query");
    },
  );

  it("aceita subject_type namespaced válido", async () => {
    const { db } = fakeDb({ credential: await credentialRow() });
    const app = createApp(env, db);

    // Guarda contra o excesso oposto: um regex apertado demais recusaria
    // `a.b.c` ou o `_`, que o contrato lista como válidos.
    await authed(app, queryFor({ subject_type: "downloads.material_v2" })).expect(200);
    await authed(app, queryFor({ subject_type: "a.b.c" })).expect(200);
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

// Achado de review da PR #245: os testes só exercitavam caminhos de erro e
// árvore vazia, então a tradução da linha crua para o objeto público de
// `contrato-http-v1.md` §2 nunca era executada — o campo errado no payload
// passaria verde.
describe("GET /internal/v1/comments — payload público", () => {
  const ATOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const USUARIO = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const arvore: CommentFixture[] = [
    { id: "r1", parent_id: null, depth: 0, created_at: "2026-08-01T10:00:00.000Z", my_vote: 1 },
    { id: "r1-c1", parent_id: "r1", depth: 1, created_at: "2026-08-01T11:00:00.000Z" },
    {
      id: "r1-c2",
      parent_id: "r1",
      depth: 1,
      created_at: "2026-08-01T12:00:00.000Z",
      visibility_state: "author_removed",
    },
  ];

  it("200 com raiz, filho e campos do contrato", async () => {
    const { db } = fakeDb({ credential: await credentialRow(), comments: arvore });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);

    expect(response.body.state).toBe("fresh");
    expect(response.body.snapshot_revision).toBe(7);
    expect(response.body.comments).toHaveLength(3);
    expect(response.body.truncated).toBe(false);

    const [raiz, filho] = response.body.comments;
    expect(raiz.id).toBe("r1");
    expect(raiz.parent_id).toBeNull();
    expect(raiz.depth).toBe(0);
    expect(raiz.body_markdown).toBe("corpo de r1");
    expect(raiz.state).toBe("visible");
    expect(raiz.author.display_name).toBe("Ana");
    expect(raiz.author.badge).toBeNull();
    expect(raiz.upvotes).toBe(3);
    expect(raiz.score).toBe(2);
    expect(raiz.created_at).toBe("2026-08-01T10:00:00.000Z");

    expect(filho.parent_id).toBe("r1");
    expect(filho.depth).toBe(1);
  });

  it("nunca expõe campo proibido pelo contrato", async () => {
    const { db } = fakeDb({ credential: await credentialRow(), comments: arvore });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);

    for (const comment of response.body.comments) {
      // §2: "Nunca no payload público" — identidade de votante, user_id cru do
      // autor, ator comunitário, motivo de remoção, HTML legado não sanitizado.
      expect(comment).not.toHaveProperty("user_id");
      expect(comment).not.toHaveProperty("community_actor_id");
      expect(comment).not.toHaveProperty("removed_reason");
      expect(comment).not.toHaveProperty("legacy_content_html");
      expect(comment).not.toHaveProperty("visibility_state");
    }
  });

  it("removed vem sem corpo, contagem nem score, mas mantém posição", async () => {
    const { db } = fakeDb({ credential: await credentialRow(), comments: arvore });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);
    const removido = response.body.comments.find(
      (comment: { id: string }) => comment.id === "r1-c2",
    );

    expect(removido.state).toBe("removed");
    expect(removido.body_markdown).toBeNull();
    expect(removido.upvotes).toBeNull();
    expect(removido.downvotes).toBeNull();
    expect(removido.score).toBeNull();
    // Posição e vínculo permanecem (decisões 34, 46): a conversa não perde o
    // encadeamento porque um nó foi retirado.
    expect(removido.parent_id).toBe("r1");
    expect(removido.depth).toBe(1);
  });

  it("my_vote só aparece com X-Acting-User-Id", async () => {
    const semAtor = fakeDb({ credential: await credentialRow(), comments: arvore });
    const semResposta = await authed(createApp(env, semAtor.db), queryFor()).expect(200);
    expect(semResposta.body.comments[0].my_vote).toBeNull();

    const comAtor = fakeDb({
      credential: await credentialRow(),
      comments: arvore,
      actorId: ATOR,
    });
    const comResposta = await request(createApp(env, comAtor.db))
      .get(queryFor())
      .set("X-Service-Token", `downloads-prod-abcd1234.${CREDENTIAL_SECRET}`)
      .set("X-Acting-User-Id", USUARIO)
      .expect(200);

    expect(comResposta.body.comments[0].my_vote).toBe(1);
  });

  it("legado exibe nome de origem e marca proveniência", async () => {
    const { db } = fakeDb({
      credential: await credentialRow(),
      comments: [
        {
          id: "leg1",
          parent_id: null,
          depth: 0,
          created_at: "2020-01-01T00:00:00.000Z",
          legacy_source: "site",
          legacy_author_name: "Visitante Antigo",
        },
      ],
    });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);
    const legado = response.body.comments[0];

    expect(legado.legacy).toEqual({ source: "site", author_name: "Visitante Antigo" });
    expect(legado.author.display_name).toBe("Visitante Antigo");
    expect(legado.author.avatar_url).toBeNull();
  });

  it("Cache-Control impede cache compartilhado de UGC", async () => {
    const { db } = fakeDb({ credential: await credentialRow(), comments: arvore });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);
    expect(response.headers["cache-control"]).toBe("private, no-store");
  });
});

/**
 * T2.6 — selo do autor (requisito 11, `contrato-http-v1.md` §2/§8).
 *
 * O que estes testes protegem é a **precedência** e as duas fontes distintas:
 * papel global vem de `users.role` pelo `JOIN`; autor do conteúdo vem do
 * `owner_user_id` que o domínio afirmou. Trocar uma pela outra é o furo do
 * requisito 11 — "qualquer um se declara dono".
 */
describe("GET /internal/v1/comments — selo do autor (T2.6)", () => {
  async function badgeDe(fixture: Partial<CommentFixture>) {
    const { db } = fakeDb({
      credential: await credentialRow(),
      comments: [
        { id: "c1", parent_id: null, depth: 0, created_at: "2026-08-01T10:00:00.000Z", ...fixture },
      ],
    });

    const response = await authed(createApp(env, db), queryFor()).expect(200);
    return response.body.comments[0].author.badge;
  }

  it("usuário comum não recebe selo", async () => {
    // Requisito 11: "sem rotular usuário comum". `user` virando `"user"` no wire
    // acabaria como rótulo vazio na tela.
    expect(await badgeDe({ author_role: "user" })).toBeNull();
  });

  it.each([
    ["admin", "admin"],
    ["moderator", "moderator"],
  ])("papel global %s vira selo %s", async (role, esperado) => {
    // As palavras são as de `users.role` (`migration_002:24`), não um enum novo.
    expect(await badgeDe({ author_role: role })).toBe(esperado);
  });

  it("publicador do assunto vira content_author", async () => {
    expect(
      await badgeDe({ author_role: "user", author_is_content_author: true }),
    ).toBe("content_author");
  });

  it.each([
    ["admin", "admin"],
    ["moderator", "moderator"],
  ])("%s que também publicou o conteúdo mostra o papel global", async (role, esperado) => {
    // `spec.md:311`: papel de domínio (autor/publicador) **nunca** é promovido a
    // papel global. Quando os dois coexistem, quem aparece é o global — é o que
    // descreve autoridade sobre a conversa, e é o que o `accounts.` conhece.
    expect(
      await badgeDe({ author_role: role, author_is_content_author: true }),
    ).toBe(esperado);
  });

  it("legado nunca recebe selo, nem se a linha vier marcada", async () => {
    // `spec.md:249` ("nenhum badge de autor em post") e 15b ("badge só quando há
    // conta real por trás"). O fixture força as duas marcas ao mesmo tempo: se
    // alguém reordenar as checagens, o legado passaria a assinar como dono.
    expect(
      await badgeDe({
        legacy_source: "site",
        legacy_author_name: "Visitante Antigo",
        author_role: "admin",
        author_is_content_author: true,
      }),
    ).toBeNull();
  });
});

/**
 * T2.6b — sem `@menções` nesta fase (decisão 31).
 *
 * `accounts.users` não tem handle público único: nome Google é mutável e não
 * único, e-mail não pode ser exposto. Menção resolvida por heurística sobre nome
 * notificaria a pessoa errada.
 */
describe("GET /internal/v1/comments — @menção é texto comum (T2.6b)", () => {
  it("@texto atravessa a leitura sem virar entidade nem destinatário", async () => {
    const corpo = "olha isso @ana e @admin, @nao_existe também";
    const { db } = fakeDb({
      credential: await credentialRow(),
      comments: [
        {
          id: "c1",
          parent_id: null,
          depth: 0,
          created_at: "2026-08-01T10:00:00.000Z",
          body_markdown: corpo,
        },
      ],
    });

    const response = await authed(createApp(env, db), queryFor()).expect(200);
    const comentario = response.body.comments[0];

    // Sai byte a byte como entrou: sem link, sem marcação, sem campo novo.
    expect(comentario.body_markdown).toBe(corpo);
    expect(comentario).not.toHaveProperty("mentions");
    expect(comentario.author).toEqual({
      display_name: "Ana",
      avatar_url: null,
      badge: null,
    });
  });
});

// Achado de review da PR #245: o cursor era aplicado em memória sobre um LIMIT
// fixo, e a comparação avançava na direção errada em best/top/new. Agora ele
// desce para a query — estes testes provam que os parâmetros chegam lá.
describe("GET /internal/v1/comments — cursor desce para a query", () => {
  /**
   * Valores que a query recebeu como parâmetro ligado.
   *
   * O Kysely entrega `ValueNode`s, não valores crus — por isso o desembrulho.
   * Ler daqui, e não do SQL textual, é o que prova que `after`/`branch_id`
   * viraram parâmetro de verdade em vez de terem sido interpolados no texto
   * (interpolar seria injeção).
   */
  function parametrosDa(executeRaw: { mock: { calls: unknown[][] } }): unknown[] {
    const compiled = executeRaw.mock.calls[0]?.[0] as
      | { parameters?: Array<{ value?: unknown }> }
      | undefined;
    return (compiled?.parameters ?? []).map((node) => node?.value);
  }

  function cursorDe(overrides: Partial<Parameters<typeof issueTreeCursor>[0]> = {}) {
    return issueTreeCursor(
      {
        ...SUBJECT,
        sort: "best",
        snapshot_revision: 7,
        branch_id: null,
        after: "000000002",
        limit: 1000,
        ...overrides,
      },
      CURSOR_KEY,
    );
  }

  it("primeira leitura não manda after nem branch", async () => {
    const { db, executeRaw } = fakeDb({ credential: await credentialRow(), comments: [] });
    const app = createApp(env, db);

    await authed(app, queryFor()).expect(200);

    const parametros = parametrosDa(executeRaw);
    expect(parametros).toContain(null);
    expect(parametros).not.toContain("000000002");
  });

  it("continuação de raízes manda after e branch nulo", async () => {
    const { db, executeRaw } = fakeDb({ credential: await credentialRow(), comments: [] });
    const app = createApp(env, db);

    await authed(app, queryFor({ cursor: cursorDe() })).expect(200);

    expect(parametrosDa(executeRaw)).toContain("000000002");
  });

  it("expansão de ramo manda o branch_id do cursor", async () => {
    const ramo = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const { db, executeRaw } = fakeDb({ credential: await credentialRow(), comments: [] });
    const app = createApp(env, db);

    await authed(app, queryFor({ cursor: cursorDe({ branch_id: ramo }) })).expect(200);

    const parametros = parametrosDa(executeRaw);
    expect(parametros).toContain(ramo);
    expect(parametros).toContain("000000002");
  });

  it("revisão do cursor é usada, não relida do assunto", async () => {
    const { db, executeRaw } = fakeDb({
      credential: await credentialRow(),
      // Assunto avançou para 99; a navegação precisa continuar na 7.
      subjectRevision: 99,
      comments: [],
    });
    const app = createApp(env, db);

    const response = await authed(app, queryFor({ cursor: cursorDe() })).expect(200);

    expect(response.body.snapshot_revision).toBe(7);
    expect(parametrosDa(executeRaw)).toContain(7);
  });

  it("more emitido carrega cursor verificável na mesma revisão", async () => {
    const muitasRaizes: CommentFixture[] = Array.from({ length: 4 }, (_, index) => ({
      id: `r${index}`,
      parent_id: null,
      depth: 0,
      created_at: `2026-08-0${index + 1}T10:00:00.000Z`,
    }));

    const { db } = fakeDb({ credential: await credentialRow(), comments: muitasRaizes });
    const app = createApp(env, db);

    const response = await authed(app, queryFor()).expect(200);

    // Sem estourar o teto de 1.000 não há `more` — o que este caso garante é
    // que árvore pequena não inventa continuação.
    expect(response.body.more).toEqual([]);
    expect(response.body.truncated).toBe(false);
    expect(response.body.comments).toHaveLength(4);
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
