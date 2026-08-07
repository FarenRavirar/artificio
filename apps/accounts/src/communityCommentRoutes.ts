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
} from "@artificio/comments";
import type { Database } from "./db.js";
import { readCommentTree, type PublicComment, type TreeRow } from "./communityCommentRead.js";
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

  let snapshotRevision: number | undefined;
  let branchId: string | null = null;
  let after: string | null = null;

  if (cursor !== undefined) {
    const verified = verifyTreeCursor(cursor, cursorSecret, {
      subject_type: subjectType,
      subject_id: subjectId,
      sort,
    });

    if (!verified.ok) {
      // Os quatro motivos colapsam num só código. Distingui-los diria ao
      // chamador se a assinatura bateu — um oráculo para calibrar forjatura.
      fail(req, res, 400, "invalid_cursor");
      return;
    }

    snapshotRevision = verified.payload.snapshot_revision;
    branchId = verified.payload.branch_id;
    after = verified.payload.after;
  }

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
    },
    Math.ceil(MAX_COMMENTS_PER_READ * FETCH_OVERSHOOT),
  );

  if (revision === null) {
    // Assunto sem registro: nunca comentado. Árvore vazia e revisão 0, não 404
    // — "ninguém comentou" não é "não existe".
    res.set("Cache-Control", "private, no-store");
    res.json({
      state: "fresh",
      snapshot_revision: 0,
      comments: [],
      more: [],
      truncated: false,
    });
    return;
  }

  const scoped = selectNavigationWindow(rows, branchId, after);
  const assembled = assembleTree({
    rows: scoped.map((row) => ({
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

  const byId = new Map(scoped.map((row) => [row.id, row.comment]));
  const comments: PublicComment[] = [];
  for (const id of assembled.included) {
    const comment = byId.get(id);
    if (comment) comments.push(comment);
  }

  const more = assembled.more.map((node) => ({
    parent_id: node.parent_id,
    count: node.count,
    cursor: issueTreeCursor(
      {
        subject_type: subjectType,
        subject_id: subjectId,
        sort,
        snapshot_revision: revision,
        branch_id: node.parent_id,
        after: node.after,
        limit: MAX_COMMENTS_PER_READ,
      },
      cursorSecret,
    ),
  }));

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

/**
 * Recorta a janela que este cursor expande.
 *
 * Sem cursor, a janela é a árvore inteira. Com cursor:
 *
 * - `branch_id === null` é a **continuação das raízes** — mantém só as raízes
 *   depois de `after` (e a descendência delas). É o `more` que aparece quando
 *   ramos inteiros ficaram para trás.
 * - `branch_id` preenchido é a **expansão de um ramo truncado** — mantém apenas
 *   aquele ramo, retomando depois de `after`.
 *
 * A raiz do ramo é preservada na expansão mesmo já tendo sido servida antes:
 * sem ela o cliente receberia filhos sem pai nesta resposta, que é o filho
 * órfão que o aceite proíbe. Ela chega marcada pelo mesmo `id`, então o cliente
 * a reconhece como âncora e não a duplica na árvore que já tem.
 */
function selectNavigationWindow(
  rows: readonly TreeRow[],
  branchId: string | null,
  after: string | null,
): TreeRow[] {
  if (after === null) return [...rows];

  if (branchId === null) {
    const keptRoots = new Set<string>();
    const result: TreeRow[] = [];

    for (const row of rows) {
      if (row.parent_id === null) {
        if (row.sort_key > after) {
          keptRoots.add(row.id);
          result.push(row);
        }
        continue;
      }

      // Descendente entra se o ramo dele entrou. `parent_id` já está em
      // `result` quando isso é verdade, porque a ordem é de leitura.
      if (keptRoots.has(row.parent_id)) {
        keptRoots.add(row.id);
        result.push(row);
      }
    }

    return result;
  }

  const branchMembers = new Set<string>([branchId]);
  const result: TreeRow[] = [];

  for (const row of rows) {
    if (row.id === branchId) {
      // Âncora: a raiz do ramo volta para que os filhos tenham onde pendurar.
      result.push(row);
      continue;
    }

    if (row.parent_id !== null && branchMembers.has(row.parent_id)) {
      branchMembers.add(row.id);
      if (row.sort_key > after) result.push(row);
    }
  }

  return result;
}
