import { requireAuth, type UserRole } from "@artificio/auth";
import { Router } from "express";
import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db.js";
import { listGlobalRoleUsers, setGlobalRole } from "./globalRoles.js";
import { ADMIN_REQUIRED_CODE, requireCurrentAdmin, sessionFrom } from "./requireCurrentAdmin.js";

const roleSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]),
});

export function createAdminRoleRoutes(db: Kysely<Database>): Router {
  const router = Router();
  const currentAdmin = requireCurrentAdmin(db);

  router.get("/admin/roles/users", requireAuth, currentAdmin, async (req, res, next) => {
    try {
      const search = typeof req.query.q === "string" ? req.query.q : "";
      const users = await listGlobalRoleUsers(db, search);
      res.json({ users });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/admin/roles/users/:id", requireAuth, currentAdmin, async (req, res, next) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Papel inválido." });
      return;
    }

    const actor = sessionFrom(req)?.user;
    if (!actor || typeof actor.roleVersion !== "number") {
      res.status(401).json({ error: "Não autenticado." });
      return;
    }

    try {
      // `roleVersion` vai junto para `setGlobalRole` revalidar o ator DENTRO da
      // transação: o guard acima consultou o banco, mas fora dela.
      const user = await setGlobalRole(
        db,
        actor.id,
        actor.roleVersion,
        req.params.id,
        parsed.data.role as UserRole,
      );
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
      if (error instanceof Error && error.message === "ACTOR_NO_LONGER_ADMIN") {
        // Mesmo código do guard: para o cliente, as duas situações são "o papel
        // do próprio ator mudou", e só elas justificam travar a tela.
        res.status(403).json({
          code: ADMIN_REQUIRED_CODE,
          error: "Sua permissão de administrador mudou. Recarregue e tente de novo.",
        });
        return;
      }
      next(error);
    }
  });

  return router;
}
