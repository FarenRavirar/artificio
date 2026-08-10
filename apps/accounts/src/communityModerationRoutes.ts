import { Router, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import {
  DETAILS_MAX_LENGTH,
  REPORT_REASON_CODES,
  createReport,
  withdrawReport,
} from "./communityCommentReport.js";
import {
  CASE_ACTIONS,
  REPORT_VERDICTS,
  changeCasePriority,
  removeCommentByModerator,
  reopenCaseApproval,
  resolveCase,
  restoreCommentByModerator,
} from "./communityModerationCase.js";
import {
  SANCTION_LEVELS,
  SANCTION_SCOPES,
  applySanction,
  decideAppeal,
  fileAppeal,
  liftSanction,
  listSanctions,
} from "./communityModerationAppeal.js";
import {
  readCaseDetail,
  readCommentVersions,
  readModerationLog,
  readModerationQueue,
} from "./communityModerationQueue.js";
import {
  requireServiceCredential,
  type ServiceAuthenticatedRequest,
} from "./requireServiceCredential.js";
import {
  requireModeratorRole,
  type ModeratorAuthenticatedRequest,
} from "./requireModeratorRole.js";
import {
  communityRateLimit,
  createRateLimitStore,
  type CommunityRateLimitStore,
} from "./communityRateLimit.js";

/**
 * T2.17-T2.26 — superfície HTTP de denúncia, caso, recurso e sanção
 * (`contrato-http-v1.md` §5, §9, §10, §11).
 *
 * ## Roteador próprio, não continuação de `communityCommentRoutes.ts`
 *
 * As rotas de comentário são chamadas pelo backend de todo módulo em todo
 * pageview; as de moderação, pelo painel. Separá-las mantém o arquivo quente
 * pequeno e — mais importante — deixa `requireModeratorRole` aplicado num só
 * lugar, sobre um `Router` inteiro, em vez de repetido rota a rota, onde
 * esquecê-lo numa delas abriria a fila de moderação para qualquer usuário
 * autenticado.
 *
 * ## T2.20(a): rota de leitura usa orçamento de leitura
 *
 * O defeito do `downloads` que a task manda não reproduzir é `GET /mine`,
 * `GET /abuse-check/:userId` e `GET /reports` consumindo o limiter de escrita.
 * Aqui todo `GET` leva bucket `read`, e só as mutações levam `report`, `appeal`
 * ou `write`. Um moderador paginando a fila não pode gastar o orçamento com que
 * ele decide casos.
 */

interface ErrorBody {
  error: { code: string; correlation_id: string | null };
}

function fail(req: Request, res: Response, status: number, code: string): void {
  const header = req.headers["x-correlation-id"];
  const correlationId =
    typeof header === "string" && header.length <= 128 ? header : null;

  const body: ErrorBody = { error: { code, correlation_id: correlationId } };
  res.status(status).json(body);
}

/** `:id` malformado vira `404`, nunca `400` (§13, mesma escolha de §3/§4). */
function readUuidParam(
  req: Request,
  res: Response,
  name: string,
  notFoundCode: string,
): string | null {
  const value = req.params[name];
  if (!z.uuid().safeParse(value).success) {
    fail(req, res, 404, notFoundCode);
    return null;
  }
  return value;
}

function readActingUser(req: Request, res: Response): string | null {
  const actingUserId = req.headers["x-acting-user-id"];
  if (typeof actingUserId !== "string" || !z.uuid().safeParse(actingUserId).success) {
    fail(req, res, 400, "invalid_acting_user");
    return null;
  }
  return actingUserId;
}

function readIdempotencyKey(req: Request, res: Response): string | null {
  const key = req.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[\x20-\x7E]{8,128}$/.test(key)) {
    fail(req, res, 400, "invalid_idempotency_key");
    return null;
  }
  return key;
}

/**
 * Corpo da denúncia (§9).
 *
 * `details` é `.trim()` antes da validação de comprimento porque a coluna tem
 * `CHECK (details = BTRIM(details))`: espaço nas pontas viraria violação de
 * constraint, que chega como `500` sem motivo legível. Normalizar aqui e validar
 * o resultado devolve o `422` que o contrato manda.
 *
 * String vazia depois do trim vira `null`, e não uma string de zero caractere: o
 * `CHECK` exige `LENGTH(details) BETWEEN 1 AND 4000` quando não-nulo, e a
 * política `required` precisa distinguir "não mandou" de "mandou vazio" — as
 * duas são o mesmo `422`/`details_required`.
 */
const reportBodySchema = z
  .object({
    reason_code: z.enum(REPORT_REASON_CODES),
    details: z
      .string()
      .transform((value) => value.trim())
      .refine((value) => value.length <= DETAILS_MAX_LENGTH, {
        message: "details_too_long",
      })
      .transform((value) => (value.length === 0 ? null : value))
      .nullable()
      .optional(),
  })
  .strict();

const resolutionBodySchema = z
  .object({
    verdicts: z
      .array(
        z
          .object({
            report_id: z.uuid(),
            verdict: z.enum(REPORT_VERDICTS),
          })
          .strict(),
      )
      .max(500),
    action: z.enum(CASE_ACTIONS),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const reasonOnlyBodySchema = z
  .object({ reason: z.string().trim().min(1).max(500) })
  .strict();

const priorityBodySchema = z
  .object({
    // **P0-P2**, não 0-3 (`spec.md` 847, decisão 38). O `CHECK` da migration
    // aceita até 3, mas a semente de `community_report_reason` não usa esse
    // valor em nenhum dos oito motivos: `malicious_link`, `personal_data` e
    // `illegal_content` são 0; `inappropriate_content`, `harassment_or_hate` e
    // `copyright_violation` são 1; `spam_or_off_topic` e `other` são 2.
    //
    // Copiar o intervalo do `CHECK` em vez do da spec deixaria o moderador
    // reclassificar para uma faixa que nenhum motivo produz — a fila ordenaria
    // por um número sem significado, abaixo do menos urgente que existe.
    priority: z.number().int().min(0).max(2),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const appealDecisionBodySchema = z
  .object({
    outcome: z.enum(["upheld", "reversed"]),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

const sanctionBodySchema = z
  .object({
    target_actor_id: z.uuid(),
    scopes: z.array(z.enum(SANCTION_SCOPES)).min(1).max(2),
    level: z.enum(SANCTION_LEVELS),
    expires_at: z.iso.datetime().nullable().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

/** Paginação das rotas de leitura. Padrão 20, teto 100 (§12, mesma escala). */
const queueQuerySchema = z.object({
  source_app: z.string().min(1).max(64).optional(),
  status: z.enum(["open", "closed"]).optional(),
  // P0-P2, mesmo intervalo de `priorityBodySchema` — ver a nota lá.
  max_priority: z.coerce.number().int().min(0).max(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor_opened_at: z.iso.datetime().optional(),
  cursor_id: z.uuid().optional(),
});

const logQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor_occurred_at: z.iso.datetime().optional(),
  cursor_id: z.uuid().optional(),
});

export function createCommunityModerationRoutes(
  db: Kysely<Database>,
  sharedStore?: CommunityRateLimitStore,
): Router {
  const router = Router();

  // Store compartilhado com o roteador de comentários quando fornecido: os
  // buckets são por identidade e por bucket, não por roteador, e dois contadores
  // separados dariam ao mesmo usuário orçamento dobrado de leitura só por trocar
  // de rota. O parâmetro é opcional para o roteador funcionar isolado em teste.
  const rateLimitStore = sharedStore ?? createRateLimitStore();

  // --- Denúncia (§9). Não exige papel de moderador: qualquer conta denuncia. ---

  router.post(
    "/internal/v1/comments/:id/reports",
    requireServiceCredential(db, { scope: "report.write" }),
    communityRateLimit(rateLimitStore, "report"),
    (req, res, next) => {
      void handleCreateReport(db, req, res).catch(next);
    },
  );

  router.delete(
    "/internal/v1/reports/:id",
    requireServiceCredential(db, { scope: "report.write" }),
    communityRateLimit(rateLimitStore, "report"),
    (req, res, next) => {
      void handleWithdrawReport(db, req, res).catch(next);
    },
  );

  // --- Recurso (§10). Também do usuário, não do moderador. ---

  router.post(
    "/internal/v1/moderation/decisions/:id/appeals",
    requireServiceCredential(db, { scope: "report.write" }),
    communityRateLimit(rateLimitStore, "appeal"),
    (req, res, next) => {
      void handleFileAppeal(db, req, res).catch(next);
    },
  );

  // --- Superfície de moderação. `requireModeratorRole` em todas. ---

  router.get(
    "/internal/v1/comments/moderation-queue",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    // Bucket `read` — T2.20(a). Ver a nota de cabeçalho.
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleQueue(db, req, res).catch(next);
    },
  );

  router.get(
    "/internal/v1/comments/moderation-log",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleLog(db, req, res).catch(next);
    },
  );

  router.get(
    "/internal/v1/comments/:id/versions",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleVersions(db, req, res).catch(next);
    },
  );

  router.get(
    "/internal/v1/moderation/cases/:id",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleCaseDetail(db, req, res).catch(next);
    },
  );

  router.get(
    "/internal/v1/moderation/sanctions",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "read"),
    (req, res, next) => {
      void handleListSanctions(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/moderation/cases/:id/resolution",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleResolution(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/moderation/cases/:id/reopen",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleReopen(db, req, res).catch(next);
    },
  );

  router.patch(
    "/internal/v1/moderation/cases/:id/priority",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handlePriority(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/moderation/appeals/:id/resolution",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleAppealDecision(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/moderation/sanctions",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleApplySanction(db, req, res).catch(next);
    },
  );

  router.delete(
    "/internal/v1/moderation/sanctions/:id",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleLiftSanction(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/comments/:id/removal",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleDirectRemoval(db, req, res).catch(next);
    },
  );

  router.post(
    "/internal/v1/comments/:id/restore",
    requireServiceCredential(db, { scope: "moderation.write" }),
    requireModeratorRole(db),
    communityRateLimit(rateLimitStore, "write"),
    (req, res, next) => {
      void handleDirectRestore(db, req, res).catch(next);
    },
  );

  return router;
}

function credentialOf(req: Request): ServiceAuthenticatedRequest["serviceCredential"] {
  return (req as ServiceAuthenticatedRequest).serviceCredential;
}

function moderatorOf(req: Request): string | undefined {
  return (req as ModeratorAuthenticatedRequest).moderatorUserId;
}

async function handleCreateReport(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const actingUserId = readActingUser(req, res);
  if (actingUserId === null) return;

  const idempotencyKey = readIdempotencyKey(req, res);
  if (idempotencyKey === null) return;

  const commentId = readUuidParam(req, res, "id", "comment_not_found");
  if (commentId === null) return;

  const body = reportBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await createReport(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    commentId,
    actingUserId,
    reasonCode: body.data.reason_code,
    details: body.data.details ?? null,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  // `201` também no replay: §6 manda a repetição devolver "mesmo status, mesmo
  // corpo". Trocar para `200` na segunda chamada faria o cliente que perdeu a
  // resposta da primeira concluir que houve duas denúncias.
  res.status(201).json(result.report);
}

async function handleWithdrawReport(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const actingUserId = readActingUser(req, res);
  if (actingUserId === null) return;

  const reportId = readUuidParam(req, res, "id", "report_not_found");
  if (reportId === null) return;

  const result = await withdrawReport(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    reportId,
    actingUserId,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(204).end();
}

async function handleFileAppeal(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const actingUserId = readActingUser(req, res);
  if (actingUserId === null) return;

  const idempotencyKey = readIdempotencyKey(req, res);
  if (idempotencyKey === null) return;

  // O `:id` da rota é o **caso** que produziu a decisão terminal. §10 chama o
  // caminho de `/decisions/:id/appeals` porque, do ponto de vista do autor, o
  // que ele recorre é a decisão — e a decisão é identificada pelo caso que a
  // registrou (`terminal_action` + `decision_version_id` vivem lá).
  const caseId = readUuidParam(req, res, "id", "case_not_found");
  if (caseId === null) return;

  const body = reasonOnlyBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await fileAppeal(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    caseId,
    actingUserId,
    reason: body.data.reason,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(201).json(result.appeal);
}

async function handleQueue(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const query = queueQuerySchema.safeParse(req.query);
  if (!query.success) {
    fail(req, res, 400, "invalid_query");
    return;
  }

  // Cursor pela metade é erro do cliente, não meia-paginação: sem os dois campos
  // a comparação em tupla não fecha, e ignorar o que veio faria a página repetir
  // desde o topo sem o moderador perceber.
  const hasCursor =
    query.data.cursor_opened_at !== undefined || query.data.cursor_id !== undefined;
  if (
    hasCursor &&
    (query.data.cursor_opened_at === undefined || query.data.cursor_id === undefined)
  ) {
    fail(req, res, 400, "invalid_cursor");
    return;
  }

  // `source_app` da query só é aceito se for o **da própria credencial**.
  //
  // O comentário anterior aqui afirmava que o filtro era "conveniência de UI,
  // não fronteira de segurança", porque a credencial veria só o próprio app de
  // qualquer forma. Era falso: `readModerationQueue` filtra pelo valor que
  // recebe, então `?source_app=mesas` com credencial do `downloads` devolvia a
  // fila de moderação do `mesas` — denúncias, comentários e identidades de
  // outro módulo. Achado de review, PR #251.
  //
  // `403` e não filtro silencioso: quem pediu explicitamente o app errado
  // precisa saber que não recebeu, em vez de ver uma fila vazia e concluir que
  // não há casos.
  if (query.data.source_app && query.data.source_app !== credential.sourceApp) {
    fail(req, res, 403, "forbidden_source_app");
    return;
  }

  const items = await readModerationQueue(db, {
    // `realm` e `source_app` saem da credencial (requisito 27a): beta nunca
    // aparece misturado com produção, e um módulo nunca vê a fila de outro.
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    status: query.data.status,
    maxPriority: query.data.max_priority,
    limit: query.data.limit,
    cursor:
      query.data.cursor_opened_at && query.data.cursor_id
        ? {
            openedAt: new Date(query.data.cursor_opened_at),
            id: query.data.cursor_id,
          }
        : undefined,
  });

  res.status(200).json({ items });
}

async function handleLog(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const query = logQuerySchema.safeParse(req.query);
  if (!query.success) {
    fail(req, res, 400, "invalid_query");
    return;
  }

  const hasCursor =
    query.data.cursor_occurred_at !== undefined || query.data.cursor_id !== undefined;
  if (
    hasCursor &&
    (query.data.cursor_occurred_at === undefined || query.data.cursor_id === undefined)
  ) {
    fail(req, res, 400, "invalid_cursor");
    return;
  }

  const entries = await readModerationLog(
    db,
    credential.realm,
    credential.sourceApp,
    query.data.limit,
    query.data.cursor_occurred_at && query.data.cursor_id
      ? {
          occurredAt: new Date(query.data.cursor_occurred_at),
          id: query.data.cursor_id,
        }
      : undefined,
  );

  res.status(200).json({ entries });
}

async function handleVersions(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const commentId = readUuidParam(req, res, "id", "comment_not_found");
  if (commentId === null) return;

  const versions = await readCommentVersions(
    db,
    credential.realm,
    credential.sourceApp,
    commentId,
  );

  // Lista vazia significa comentário inexistente ou de outro realm — os dois
  // colapsam em `404` (§13). Devolver `200` com array vazio diria ao chamador
  // que o comentário existe e não tem versão, o que é impossível.
  if (versions.length === 0) {
    fail(req, res, 404, "comment_not_found");
    return;
  }

  res.status(200).json({ versions });
}

async function handleCaseDetail(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const caseId = readUuidParam(req, res, "id", "case_not_found");
  if (caseId === null) return;

  const detail = await readCaseDetail(
    db,
    credential.realm,
    credential.sourceApp,
    caseId,
  );

  if (!detail) {
    fail(req, res, 404, "case_not_found");
    return;
  }

  res.status(200).json(detail);
}

async function handleListSanctions(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  if (!credential) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const actorId = req.query.actor_id;
  if (typeof actorId !== "string" || !z.uuid().safeParse(actorId).success) {
    fail(req, res, 400, "invalid_query");
    return;
  }

  const sanctions = await listSanctions(db, credential.realm, actorId);
  res.status(200).json({ sanctions });
}

async function handleResolution(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const idempotencyKey = readIdempotencyKey(req, res);
  if (idempotencyKey === null) return;

  const caseId = readUuidParam(req, res, "id", "case_not_found");
  if (caseId === null) return;

  const body = resolutionBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await resolveCase(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    caseId,
    moderatorUserId,
    verdicts: body.data.verdicts,
    action: body.data.action,
    reason: body.data.reason,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(200).json(result.resolution);
}

async function handleReopen(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const caseId = readUuidParam(req, res, "id", "case_not_found");
  if (caseId === null) return;

  const body = reasonOnlyBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await reopenCaseApproval(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    caseId,
    moderatorUserId,
    reason: body.data.reason,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(204).end();
}

async function handlePriority(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const caseId = readUuidParam(req, res, "id", "case_not_found");
  if (caseId === null) return;

  const body = priorityBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await changeCasePriority(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    caseId,
    moderatorUserId,
    priority: body.data.priority,
    reason: body.data.reason,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(204).end();
}

async function handleAppealDecision(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const appealId = readUuidParam(req, res, "id", "appeal_not_found");
  if (appealId === null) return;

  const body = appealDecisionBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await decideAppeal(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    appealId,
    moderatorUserId,
    outcome: body.data.outcome,
    reason: body.data.reason,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(200).json({ outcome: body.data.outcome, restored: result.restored });
}

async function handleApplySanction(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const idempotencyKey = readIdempotencyKey(req, res);
  if (idempotencyKey === null) return;

  const body = sanctionBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  // Escopo duplicado no array viraria duas linhas no mesmo escopo, e a segunda
  // bateria em `uq_community_restriction_active` — `409` para um pedido que o
  // moderador escreveu certo. `Set` normaliza antes de chegar lá.
  const scopes = [...new Set(body.data.scopes)];

  const result = await applySanction(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    targetActorId: body.data.target_actor_id,
    moderatorUserId,
    scopes,
    level: body.data.level,
    expiresAt: body.data.expires_at ? new Date(body.data.expires_at) : null,
    reason: body.data.reason,
    idempotencyKey,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(201).json(result.sanction);
}

async function handleLiftSanction(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const sanctionId = readUuidParam(req, res, "id", "sanction_not_found");
  if (sanctionId === null) return;

  const body = reasonOnlyBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await liftSanction(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    sanctionId,
    moderatorUserId,
    reason: body.data.reason,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(204).end();
}

async function handleDirectRemoval(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  await handleDirectAction(db, req, res, removeCommentByModerator);
}

async function handleDirectRestore(
  db: Kysely<Database>,
  req: Request,
  res: Response,
): Promise<void> {
  await handleDirectAction(db, req, res, restoreCommentByModerator);
}

/** Remoção e restauração diferem só na função chamada; o resto é idêntico. */
async function handleDirectAction(
  db: Kysely<Database>,
  req: Request,
  res: Response,
  action: typeof removeCommentByModerator,
): Promise<void> {
  const credential = credentialOf(req);
  const moderatorUserId = moderatorOf(req);
  if (!credential || !moderatorUserId) {
    fail(req, res, 401, "unauthorized");
    return;
  }

  const commentId = readUuidParam(req, res, "id", "comment_not_found");
  if (commentId === null) return;

  const body = reasonOnlyBodySchema.safeParse(req.body);
  if (!body.success) {
    fail(req, res, 400, "invalid_body");
    return;
  }

  const result = await action(db, {
    realm: credential.realm,
    sourceApp: credential.sourceApp,
    commentId,
    moderatorUserId,
    reason: body.data.reason,
  });

  if (!result.ok) {
    fail(req, res, result.status, result.code);
    return;
  }

  res.status(204).end();
}
