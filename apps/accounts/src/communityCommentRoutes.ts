import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import {
  COMMENT_SORTS,
  MAX_BYTES_PER_READ,
  MAX_COMMENTS_PER_READ,
  assembleTree,
  issueTreeCursor,
  verifyTreeCursor,
  type CommentSort,
} from "@artificio/comments";
import type { Database } from "./db.js";
import { readCommentTree, type PublicComment } from "./communityCommentRead.js";
import { createComment } from "./communityCommentWrite.js";
import { requireServiceCredential, type ServiceAuthenticatedRequest } from "./requireServiceCredential.js";

/**
 * T2.3 — `GET /internal/v1/comments` (`contrato-http-v1.md` §2).
 *
 * ## O que esta rota é, e o que não é
 *
 * Superfície **interna**: só o backend do módulo consumidor chama, com
 * credencial de serviço. O navegador nunca chega aqui (`contrato-http-v1.md`
 * §1) — a fachada de cada app é que fala com o usuário. Por isso `realm` e
 * `source_app` **não são query params**: saem da credencial. Aceitá-los do
 * cliente deixaria uma credencial de beta ler produção, que é o furo que a
 * migration 007 fechou.
 *
 * ## Cursor e revisão
 *
 * A primeira leitura fixa `snapshot_revision` e devolve `more` com cursores
 * assinados carregando aquela revisão. Toda expansão navega **dentro** dela.
 * Cursor recusado — adulterado, expirado ou de outra consulta — vira
 * `400`/`invalid_cursor`, nunca uma posição aproximada: aproximar é como se
 * duplica ou se perde comentário sem ninguém notar.
 */

/**
 * Fator de sobrebusca sobre o teto.
 *
 * A query precisa trazer **mais** que o teto para que `assembleTree` saiba que
 * existe resto e emita `more` com contagem. Buscar exatamente 1.000 devolveria
 * uma árvore cheia indistinguível de uma que acabou — e o cliente pararia de
 * paginar achando que viu tudo.
 *
 * O excedente é limitado de propósito: o teto existe porque o `accounts.`
 * sustenta o SSO (decisão 3), e uma sobrebusca generosa reintroduziria pela
 * consulta o consumo de memória que o cap corta na resposta.
 */
const FETCH_OVERSHOOT = 1.2;

const querySchema = z.object({
  subject_type: z.string().min(1).max(64),
  subject_id: z.string().min(1).max(255),
  sort: z.enum(COMMENT_SORTS).default("best"),
  cursor: z.string().min(1).max(4096).optional(),
});

interface ErrorBody {
  error: { code: string; correlation_id: string | null };
}

/**
 * `contrato-http-v1.md` §13 — formato único de erro, sem detalhe de existência
 * nem de autorização. `X-Correlation-Id` é ecoado quando o chamador o envia
 * (§1.1); sem ele o campo vem nulo em vez de um id inventado, que só poluiria o
 * log de quem correlaciona.
 */
function fail(req: Request, res: Response, status: number, code: string): void {
  const header = req.headers["x-correlation-id"];
  const correlationId = typeof header === "string" && header.length <= 128 ? header : null;

  const body: ErrorBody = { error: { code, correlation_id: correlationId } };
  res.status(status).json(body);
}

/**
 * Resolve o ator comunitário do usuário que está lendo.
 *
 * `X-Acting-User-Id` traz o `users.id`; `my_vote` é por **ator**, não por conta
 * (`migration_006`: o vínculo ator↔conta é a única estrutura que os liga, e
 * apagá-lo não apaga voto). Usuário sem ator ainda não participou da comunidade
 * — não é erro, só não tem voto a exibir.
 */
async function resolveActingActorId(
  db: Kysely<Database>,
  actingUserId: string | undefined,
): Promise<string | null> {
  if (!actingUserId) return null;

  const row = await db
    .selectFrom("community_actor_account_link")
    .select("actor_id")
    .where("user_id", "=", actingUserId)
    .executeTakeFirst();

  return row?.actor_id ?? null;
}

function readActingUserId(req: Request): string | undefined {
  const header = req.headers["x-acting-user-id"];
  if (typeof header !== "string") return undefined;

  // UUID malformado não vira 400: o header é opcional e seu único efeito é
  // `my_vote`. Recusar a leitura inteira por causa dele transformaria um
  // problema de enfeite em indisponibilidade da conversa.
  return z.uuid().safeParse(header).success ? header : undefined;
}

export function createCommunityCommentRoutes(
  db: Kysely<Database>,
  cursorSecret: string,
): Router {
  const router = Router();

  router.get(
    "/internal/v1/comments",
    requireServiceCredential(db, { scope: "comment.read" }),
    (req, res, next) => {
      void handleReadTree(db, cursorSecret, req, res).catch(next);
    },
  );

  // T2.6c — criação e resposta (`contrato-http-v1.md` §3). Duas rotas, um
  // handler: a única diferença é de onde vem o pai (`:id` na URL contra `null`),
  // e o contrato define os mesmos invariantes, corpo e erros para as duas.
  router.post(
    "/internal/v1/comments",
    requireServiceCredential(db, { scope: "comment.write" }),
    (req, res, next) => {
      void handleCreateComment(db, req, res, null).catch(next);
    },
  );

  router.post(
    "/internal/v1/comments/:id/replies",
    requireServiceCredential(db, { scope: "comment.write" }),
    (req, res, next) => {
      void handleCreateComment(db, req, res, req.params.id).catch(next);
    },
  );

  return router;
}

/**
 * Corpo de criação/resposta (`contrato-http-v1.md` §3).
 *
 * `realm` e `source_app` **não estão aqui** de propósito: derivam da credencial,
 * e §3 manda rejeitar com `400` quem tentar declará-los. `root_id` e `depth`
 * também não — são calculados, nunca aceitos.
 */
const createBodySchema = z
  .object({
    subject_type: z
      .string()
      .min(1)
      .max(64)
      // Ponto obrigatório: `migration_006:118` tem
      // `CHECK (subject_type LIKE '%.%')`. Sem esta validação o valor morria
      // como erro de constraint, sem motivo legível (achado de T2.6c).
      .regex(/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/),
    subject_id: z.string().min(1).max(255),
    canonical_path: z.string().min(1).max(1024),
    body_markdown: z.string().min(1),
    subject_owner_user_id: z.uuid().nullish(),
  })
  // `strict` é o que implementa "rejeitar payload que declara realm/source_app"
  // (§3, `spec.md` 6a): campo desconhecido vira `400` em vez de ser ignorado em
  // silêncio — ignorar deixaria o chamador achar que o valor foi aceito.
  .strict();

/**
 * Handler único de `POST /comments` e `POST /comments/:id/replies`.
 *
 * A ordem das checagens segue o contrato: credencial (guard), headers
 * obrigatórios, corpo, e só então a transação. Validar o corpo antes de abrir
 * transação evita pagar `BEGIN` por um pedido que já se sabe inválido.
 */
async function handleCreateComment(
  db: Kysely<Database>,
  req: Request,
  res: Response,
  parentId: string | null,
): Promise<void> {
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    // Defensivo: o guard já barrou. Sem isto, um erro de montagem de rota
    // silenciosamente escreveria com `realm` indefinido.
    fail(req, res, 401, "unauthorized");
    return;
  }

  // §3: as duas escritas exigem `Idempotency-Key` e `X-Acting-User-Id`. Ausência
  // é `400`, não `422`: o pedido não chega a ser avaliado.
  const idempotencyKey = req.headers["idempotency-key"];
  if (typeof idempotencyKey !== "string" || !/^[\x20-\x7E]{8,128}$/.test(idempotencyKey)) {
    fail(req, res, 400, "invalid_idempotency_key");
    return;
  }

  const actingUserId = req.headers["x-acting-user-id"];
  if (typeof actingUserId !== "string" || !z.uuid().safeParse(actingUserId).success) {
    // Diferente da leitura, onde o header é opcional e só afeta `my_vote`: aqui
    // ele é a autoria do comentário. Sem ele não há o que escrever.
    fail(req, res, 400, "invalid_acting_user");
    return;
  }

  const body = createBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  if (parentId !== null && !z.uuid().safeParse(parentId).success) {
    // `:id` malformado é `404`, não `400`: o contrato não distingue "id inválido"
    // de "id inexistente" (§3), e distinguir diria ao chamador qual formato de id
    // o sistema usa.
    fail(req, res, 404, "parent_not_found");
    return;
  }

  const result = await createComment(db, {
    realm: credential.realm,
    source_app: credential.sourceApp,
    subject_type: body.data.subject_type,
    subject_id: body.data.subject_id,
    canonicalPath: body.data.canonical_path,
    ownerUserId: body.data.subject_owner_user_id ?? null,
    parentId,
    bodyMarkdown: body.data.body_markdown,
    actingUserId,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // Repetição idêntica devolve a resposta original com o mesmo status (§6): o
  // cliente que reenviou por timeout precisa ver `201` e o mesmo corpo, não um
  // `200` que o faria achar que houve dois comentários.
  res.status(201).json(result.comment);
}

/** Posição de onde a leitura retoma. Tudo nulo na primeira página. */
interface NavigationStart {
  snapshotRevision?: number;
  branchId: string | null;
  after: string | null;
}

/**
 * Traduz o cursor recebido na posição de retomada.
 *
 * `null` sinaliza cursor recusado — o chamador responde `400`/`invalid_cursor`.
 * Os quatro motivos de recusa colapsam num só código: distingui-los diria ao
 * chamador se a assinatura bateu, um oráculo para calibrar forjatura.
 */
function resolveNavigationStart(
  cursor: string | undefined,
  cursorSecret: string,
  expected: { subject_type: string; subject_id: string; sort: CommentSort },
): NavigationStart | null {
  if (cursor === undefined) return { branchId: null, after: null };

  const verified = verifyTreeCursor(cursor, cursorSecret, expected);
  if (!verified.ok) return null;

  return {
    snapshotRevision: verified.payload.snapshot_revision,
    branchId: verified.payload.branch_id,
    after: verified.payload.after,
  };
}

/** Resposta de assunto que nunca recebeu comentário. */
function emptyTree(res: Response): void {
  // Árvore vazia e revisão 0, não 404 — "ninguém comentou" não é "não existe".
  res.set("Cache-Control", "private, no-store");
  res.json({
    state: "fresh",
    snapshot_revision: 0,
    comments: [],
    more: [],
    truncated: false,
  });
}

/** Monta os nós `more`, cada um com o cursor assinado da própria continuação. */
function buildMoreNodes(
  assembledMore: readonly { parent_id: string | null; count: number; after: string }[],
  cursorSecret: string,
  query: { subjectType: string; subjectId: string; sort: CommentSort; revision: number },
) {
  return assembledMore.map((node) => ({
    parent_id: node.parent_id,
    count: node.count,
    cursor: issueTreeCursor(
      {
        subject_type: query.subjectType,
        subject_id: query.subjectId,
        sort: query.sort,
        snapshot_revision: query.revision,
        branch_id: node.parent_id,
        after: node.after,
        limit: MAX_COMMENTS_PER_READ,
      },
      cursorSecret,
    ),
  }));
}

async function handleReadTree(
  db: Kysely<Database>,
  cursorSecret: string,
  req: Request,
  res: Response,
): Promise<void> {
  const parsedQuery = querySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    fail(req, res, 400, "invalid_query");
    return;
  }

  const { subject_type: subjectType, subject_id: subjectId, sort, cursor } = parsedQuery.data;

  // Derivado da credencial, nunca do request (`contrato-http-v1.md` §1.1). O
  // guard já garantiu a presença; o non-null seria uma aposta, então falha
  // explícita.
  const credential = (req as ServiceAuthenticatedRequest).serviceCredential;
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const start = resolveNavigationStart(cursor, cursorSecret, {
    subject_type: subjectType,
    subject_id: subjectId,
    sort,
  });

  if (start === null) {
    fail(req, res, 400, "invalid_cursor");
    return;
  }

  const { snapshotRevision, branchId, after } = start;
  const actingActorId = await resolveActingActorId(db, readActingUserId(req));

  const { snapshotRevision: revision, rows } = await readCommentTree(
    db,
    {
      subject: {
        realm: credential.realm,
        sourceApp: credential.sourceApp,
        subjectType,
        subjectId,
      },
      sort,
      snapshotRevision,
      actingActorId,
      after,
      branchId,
    },
    Math.ceil(MAX_COMMENTS_PER_READ * FETCH_OVERSHOOT),
  );

  if (revision === null) {
    emptyTree(res);
    return;
  }

  // Sem recorte em memória: a query já veio posicionada pelo cursor e escopada
  // ao ramo (achado de review, PR #245 — o filtro em memória sobre um `LIMIT`
  // fixo devolvia página vazia em árvore maior que o limite de busca).
  const assembled = assembleTree({
    rows: rows.map((row) => ({
      id: row.id,
      parent_id: row.parent_id,
      depth: row.depth,
      size_bytes: row.size_bytes,
      sort_key: row.sort_key,
    })),
    sort,
    maxComments: MAX_COMMENTS_PER_READ,
    maxBytes: MAX_BYTES_PER_READ,
  });

  const byId = new Map(rows.map((row) => [row.id, row.comment]));
  const comments = assembled.included
    .map((id) => byId.get(id))
    .filter((comment): comment is PublicComment => comment !== undefined);

  const more = buildMoreNodes(assembled.more, cursorSecret, {
    subjectType,
    subjectId,
    sort,
    revision,
  });

  // UGC nunca entra em cache compartilhado: o payload carrega `my_vote`, que é
  // por leitor, e conteúdo que a moderação pode retirar a qualquer momento.
  res.set("Cache-Control", "private, no-store");
  res.json({
    state: "fresh",
    snapshot_revision: revision,
    comments,
    more,
    truncated: assembled.truncated,
  });
}

/*
 * `selectNavigationWindow` foi removida na correção do review da PR #245.
 *
 * Ela recortava a janela do cursor em memória, sobre o resultado de um `LIMIT`
 * fixo. Dois defeitos que só apareciam em árvore grande: a segunda página
 * recortava o mesmo bloco de ~1.200 linhas já servido (devolvendo vazio sem
 * erro), e a comparação `sort_key > after` avançava na direção errada em
 * `best`, `top` e `new`, que ordenam `DESC`.
 *
 * O cursor agora é aplicado no `WHERE` da própria query, sobre a posição total
 * derivada de `sort_path` — ver `communityCommentRead.ts`.
 */
