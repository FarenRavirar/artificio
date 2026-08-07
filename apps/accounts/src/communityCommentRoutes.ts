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

  return router;
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
