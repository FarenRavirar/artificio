import type { NextFunction, Request, Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";

/**
 * T2.17-T2.26 — papel de moderação nas rotas internas (`contrato-http-v1.md`
 * §5, §10, §11).
 *
 * ## Duas autorizações independentes, e por que nenhuma cobre a outra
 *
 * `requireServiceCredential` prova **qual módulo** está chamando e o que aquele
 * módulo pode fazer. Este guard prova **qual pessoa** está por trás da chamada.
 * São dimensões diferentes: a credencial do `downloads` legitimamente carrega
 * `moderation.write` — é o backend dele que expõe o painel —, mas isso não
 * significa que todo usuário do `downloads` seja moderador.
 *
 * Sem este guard, escopo de credencial seria a única barreira, e qualquer
 * usuário autenticado de um módulo com painel de moderação poderia fechar caso
 * alheio só passando o próprio `X-Acting-User-Id`. O contrato é explícito:
 * "escopo `moderation.write` **e** papel `admin`/`moderator` do
 * `X-Acting-User-Id` verificado contra `accounts.users`".
 *
 * ## Papel lido do banco a cada requisição, nunca de header
 *
 * `users.role` é a fonte. Aceitar um papel declarado pelo chamador — mesmo por
 * um módulo autenticado — transformaria o guard em decoração: quem controla o
 * header controla a autorização. Custa uma consulta indexada por chave primária
 * por requisição de moderação, que é volume baixo por natureza.
 *
 * O papel também **não** é cacheado em memória: `users.role_version` existe
 * porque rebaixamento precisa valer imediatamente, e um cache de papel faria um
 * moderador removido seguir moderando pelo TTL do cache.
 */

/** Papéis que o §5 aceita. `content_author` e `user` não moderam. */
const MODERATOR_ROLES = new Set(["admin", "moderator"]);

export interface ModeratorAuthenticatedRequest extends Request {
  /** `users.id` do moderador, já validado contra o banco. */
  moderatorUserId?: string;
  moderatorRole?: string;
}

/**
 * Lê `X-Acting-User-Id` e exige papel de moderação.
 *
 * Header ausente ou malformado vira `403`/`forbidden_role`, não `400`: distinguir
 * "não mandou o header" de "mandou e não é moderador" entregaria um oráculo para
 * descobrir quem é moderador testando ids. O contrato §13 já manda o erro não
 * revelar existência.
 */
export function requireModeratorRole(db: Kysely<Database>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers["x-acting-user-id"];
    const actingUserId =
      typeof header === "string" && header.length > 0 && header.length <= 64
        ? header
        : null;

    if (!actingUserId) {
      forbidden(req, res);
      return;
    }

    void db
      .selectFrom("users")
      .select(["id", "role"])
      .where("id", "=", actingUserId)
      .executeTakeFirst()
      .then((user) => {
        // Conta inexistente e conta sem papel produzem a **mesma** resposta,
        // pelo mesmo motivo do `401` genérico de `requireServiceCredential`:
        // separar as duas permitiria enumerar contas do SSO por tentativa.
        if (!user || !MODERATOR_ROLES.has(user.role)) {
          forbidden(req, res);
          return;
        }

        const moderatorReq = req as ModeratorAuthenticatedRequest;
        moderatorReq.moderatorUserId = user.id;
        moderatorReq.moderatorRole = user.role;
        next();
      })
      .catch(next);
  };
}

function forbidden(req: Request, res: Response): void {
  const header = req.headers["x-correlation-id"];
  const correlationId =
    typeof header === "string" && header.length <= 128 ? header : null;

  res
    .status(403)
    .json({ error: { code: "forbidden_role", correlation_id: correlationId } });
}
