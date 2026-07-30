import { requireAuth, type Session, type UserRole } from "@artificio/auth";
import { Router, type NextFunction, type Request, type Response } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import { listGlobalRoleUsers, setGlobalRole } from "./globalRoles.js";

const roleSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]),
});

function sessionFrom(req: Request): Session | undefined {
  return (req as Request & { session?: Session }).session;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (sessionFrom(req)?.user.role !== "admin") {
    res.status(403).json({ error: "Acesso restrito a administradores." });
    return;
  }
  next();
}

export function createAdminRoleRoutes(db: Kysely<Database>): Router {
  const router = Router();

  router.get("/admin/roles/users", requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.q === "string" ? req.query.q : "";
      const users = await listGlobalRoleUsers(db, search);
      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/roles/users/:id", requireAuth, requireAdmin, async (req, res, next) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Papel inválido." });
      return;
    }

    const actorId = sessionFrom(req)?.user.id;
    if (!actorId) {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    try {
      const user = await setGlobalRole(db, actorId, req.params.id, parsed.data.role as UserRole);
      if (!user) {
        res.status(404).json({ error: "Conta não encontrada." });
        return;
      }
      res.json({ user });
    } catch (error) {
      if (error instanceof Error && error.message === "SELF_DEMOTION_FORBIDDEN") {
        res.status(409).json({ error: "Você não pode rebaixar a própria conta." });
        return;
      }
      next(error);
    }
  });

  return router;
}
