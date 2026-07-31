import type { Session } from "@artificio/auth";
import type { NextFunction, Request, Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";
import { findAuthUserById } from "./users.js";

export function sessionFrom(req: Request): Session | undefined {
  return (req as Request & { session?: Session }).session;
}

/**
 * Guard de admin que **revalida no banco**, não só na claim do cookie.
 *
 * O access token dura 15 minutos e carrega `role`. Sem reler o banco, um admin
 * rebaixado continuaria autorizado por toda a janela restante do token — tempo
 * suficiente para se repromover pelo painel de papéis ou ler e sobrescrever
 * segredos (achados de review, PR #233).
 *
 * `roleVersion` fecha o caso em que o papel volta a ser `admin` por outro
 * caminho: a versão é incrementada pelo trigger `audit_global_role_change()` a
 * cada mudança, então token emitido antes de qualquer alteração não confere com
 * o banco e é recusado.
 *
 * Vive em módulo próprio porque vale para **toda** rota humana privilegiada do
 * `accounts.` — papéis e segredos —, e duplicar a lógica faria uma delas
 * envelhecer sem a outra.
 */
export function requireCurrentAdmin(db: Kysely<Database>) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const session = sessionFrom(req);
    if (session?.user.role !== "admin" || typeof session.user.roleVersion !== "number") {
      res.status(403).json({ error: "Acesso restrito a administradores." });
      return;
    }

    try {
      const currentUser = await findAuthUserById(db, session.user.id);
      if (
        currentUser?.role !== "admin" ||
        currentUser.roleVersion !== session.user.roleVersion
      ) {
        res.status(403).json({ error: "Acesso restrito a administradores." });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
