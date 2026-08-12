import { Router, type Request, type Response } from "express";
import { requireAuth, type Session } from "@artificio/auth";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import {
  countUnread,
  findReceiptOwner,
  listNotifications,
  markAllRead,
  markOneRead,
  markReadThrough,
} from "./notificationData.js";

// ============================================================================
// T3.6 — API de notificação (contrato-http-v1.md:553-563)
//
// Rotas de sessão (/api/v1/*), não de credencial de serviço (/internal/v1/*).
// Ownership sempre extraído da sessão, nunca de parâmetro. 404 uniforme para
// recibo inexistente ou de outro usuário. Cache private, no-store.
//
// Ordem de declaração: /unread-count, /read-all, /read-through ANTES de
// /:id/read — senão o Express engole a rota estática como parâmetro.
// ============================================================================

const sourceAppSchema = z.string().max(64).optional();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(4096).optional(),
  source_app: sourceAppSchema,
});

const readThroughSchema = z.object({
  through: z.iso.datetime(),
});

const cursorSchema = z.object({
  t: z.iso.datetime(),
  i: z.uuid(),
});

function readUserId(req: Request): string | null {
  const session = (req as { session?: Session }).session;
  return session?.user?.id ?? null;
}

function decodeCursor(
  raw: string,
): { occurredAt: string; id: string } | null {
  try {
    const obj: unknown = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8"),
    );
    const parsed = cursorSchema.safeParse(obj);
    if (!parsed.success) return null;
    return { occurredAt: parsed.data.t, id: parsed.data.i };
  } catch {
    return null;
  }
}

function unauthorized(res: Response): void {
  res.status(401).json({ error: { code: "unauthorized" } });
}
function notFound(res: Response): void {
  res.status(404).json({ error: { code: "not_found" } });
}
function badRequest(res: Response, code: string): void {
  res.status(400).json({ error: { code } });
}

/**
 * @param realm derivação ambiental do servidor (requisito 17b-i).
 *   `accounts.` é PROD-only (D042), mas a rota aceita o parâmetro para teste.
 */
export function createNotificationRoutes(
  db: Kysely<Database>,
  realm: string = "prod",
): Router {
  const router = Router();

  // ------------------------------------------------------------------
  // GET /api/v1/notifications/unread-count
  // ------------------------------------------------------------------
  router.get(
    "/api/v1/notifications/unread-count",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) return unauthorized(res);

        const parsedSourceApp = sourceAppSchema.safeParse(
          req.query.source_app,
        );
        if (!parsedSourceApp.success) return badRequest(res, "invalid_query");

        const count = await countUnread(
          db,
          realm,
          userId,
          parsedSourceApp.data,
        );
        res.set("Cache-Control", "private, no-store");
        res.json({ count });
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // PATCH /api/v1/notifications/read-all  (ANTES de /:id/read)
  // ------------------------------------------------------------------
  router.patch(
    "/api/v1/notifications/read-all",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) return unauthorized(res);

        const marked = await markAllRead(db, realm, userId);
        res.set("Cache-Control", "private, no-store");
        res.json({ marked });
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // PUT /api/v1/notifications/read-through  (ANTES de /:id/read)
  // ------------------------------------------------------------------
  router.put(
    "/api/v1/notifications/read-through",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) return unauthorized(res);

        const body = readThroughSchema.safeParse(req.body);
        if (!body.success) return badRequest(res, "invalid_body");

        const marked = await markReadThrough(
          db,
          realm,
          userId,
          new Date(body.data.through),
        );
        res.set("Cache-Control", "private, no-store");
        res.json({ marked });
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /api/v1/notifications
  // ------------------------------------------------------------------
  router.get(
    "/api/v1/notifications",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) return unauthorized(res);

        const parsed = listQuerySchema.safeParse(req.query);
        if (!parsed.success) return badRequest(res, "invalid_query");

        const { limit, cursor, source_app } = parsed.data;

        const decodedCursor = cursor ? decodeCursor(cursor) : null;
        if (cursor && !decodedCursor) return badRequest(res, "invalid_cursor");

        const result = await listNotifications(db, {
          realm,
          userId,
          limit,
          sourceApp: source_app,
          cursor: decodedCursor,
        });

        res.set("Cache-Control", "private, no-store");
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // PUT /api/v1/notifications/:id/read  (última rota)
  // ------------------------------------------------------------------
  router.put(
    "/api/v1/notifications/:id/read",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) return unauthorized(res);

        const receiptId = req.params.id;
        const owner = await findReceiptOwner(db, realm, receiptId);

        // 404 uniforme: ID inexistente ou de outro usuário
        if (!owner || owner !== userId) return notFound(res);

        await markOneRead(db, realm, receiptId, userId);
        res.set("Cache-Control", "private, no-store");
        res.json({ id: receiptId, read: true });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
