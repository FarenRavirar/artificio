import { Router, type Request } from "express";
import { requireAuth, type Session } from "@artificio/auth";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import {
  listEventTypes,
  listPreferences,
  setPreference,
} from "./notificationPreference.js";

// ============================================================================
// T3.11b — Rotas de preferência de notificação
//
// /api/v1/*, sessão. Ownership sempre extraído da sessão.
// Tipos de moderação são listados mas NÃO modificáveis (20b).
// ============================================================================

const setPreferenceSchema = z.object({
  enabled: z.boolean(),
});

function readUserId(req: Request): string | null {
  const session = (req as { session?: Session }).session;
  return session?.user?.id ?? null;
}

export function createNotificationPreferenceRoutes(
  db: Kysely<Database>,
): Router {
  const router = Router();

  // ------------------------------------------------------------------
  // GET /api/v1/notification-preferences
  // ------------------------------------------------------------------
  router.get(
    "/api/v1/notification-preferences",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) {
          res.status(401).json({ error: { code: "unauthorized" } });
          return;
        }

        const prefs = await listPreferences(db, userId);
        res.set("Cache-Control", "private, no-store");
        res.json({ preferences: prefs });
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // PUT /api/v1/notification-preferences/:event_type
  // ------------------------------------------------------------------
  router.put(
    "/api/v1/notification-preferences/:event_type",
    requireAuth,
    async (req, res, next) => {
      try {
        const userId = readUserId(req);
        if (!userId) {
          res.status(401).json({ error: { code: "unauthorized" } });
          return;
        }

        const eventType = req.params.event_type;
        const body = setPreferenceSchema.safeParse(req.body);
        if (!body.success) {
          res.status(400).json({ error: { code: "invalid_body" } });
          return;
        }

        const result = await setPreference(
          db,
          userId,
          eventType,
          body.data.enabled,
        );

        if (!result.ok) {
          const status = result.code === "unknown_event_type" ? 404 : 422;
          res.status(status).json({ error: { code: result.code } });
          return;
        }

        res.set("Cache-Control", "private, no-store");
        res.json({ event_type: eventType, enabled: body.data.enabled });
      } catch (error) {
        next(error);
      }
    },
  );

  // ------------------------------------------------------------------
  // GET /api/v1/notification-event-types (catálogo público de tipos)
  // ------------------------------------------------------------------
  router.get(
    "/api/v1/notification-event-types",
    requireAuth,
    (_req, res, next) => {
      try {
        const catalog = listEventTypes();
        res.set("Cache-Control", "private, no-store");
        res.json({ event_types: catalog });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
