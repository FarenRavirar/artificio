import type { NextFunction, Request, Response } from "express";
import type { Kysely } from "kysely";
import type { Database } from "./db.js";
import {
  hasScope,
  resolveServiceCredential,
  touchServiceCredential,
  type ServiceCredentialIdentity,
  type ServiceScope,
} from "./serviceCredential.js";

/**
 * T2.2a — guard de credencial de serviço com escopo.
 *
 * Substitui a checagem booleana de `X-Service-Token` por uma que resolve
 * identidade. Quem passa por aqui deixa em `req.serviceCredential` o
 * `source_app`, o `realm` e os escopos da credencial — e é **daí** que os
 * handlers derivam `realm`/`source_app`, nunca do corpo da requisição.
 *
 * ## Fallback de transição — removido em 2026-08-07 (T2.2a-op, passo 6)
 *
 * `SERVICE_SECRET` foi aceito como fallback enquanto `downloads` e `mesas`
 * migravam. O corte foi confirmado antes da remoção: as quatro credenciais
 * (dois apps × dois realms) com `last_used_at` preenchido e o log
 * `[serviceCredential] SERVICE_SECRET legado usado` em zero. Agora a única
 * autenticação de serviço é a credencial registrada — sem `allowLegacySecret`,
 * sem segredo global, sem caminho que autentique sem produzir identidade.
 */

/**
 * Segue o padrão de `AuthenticatedRequest` em `packages/auth/src/middleware.ts`:
 * interface que estende `Request`, não augmentation global de
 * `express-serve-static-core`. Augmentation global vazaria o campo para todo
 * handler do monorepo, inclusive os que nunca passam por este guard.
 */
export interface ServiceAuthenticatedRequest extends Request {
  serviceCredential?: ServiceCredentialIdentity;
}

export interface RequireServiceCredentialOptions {
  /** Escopo exigido. Sem ele o guard só autentica, sem autorizar operação. */
  scope?: ServiceScope;
}

export function requireServiceCredential(
  db: Kysely<Database>,
  options: RequireServiceCredentialOptions = {},
) {
  const { scope } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers["x-service-token"];

    void resolveServiceCredential(db, header)
      .then((identity) => {
        if (identity) {
          if (scope && !hasScope(identity, scope)) {
            // 403 e não 401: a credencial é válida, a operação é que não é
            // permitida. Confundir os dois esconde erro de configuração de
            // escopo atrás de "token errado" e custa horas de diagnóstico.
            res.status(403).json({ error: "insufficient_scope" });
            return;
          }

          (req as ServiceAuthenticatedRequest).serviceCredential = identity;
          // Best-effort e deliberadamente não aguardado: registrar uso não pode
          // atrasar nem derrubar uma requisição legítima.
          void touchServiceCredential(db, identity.credentialId);
          next();
          return;
        }

        // 401 genérico. Distinguir "credencial inexistente" de "segredo errado"
        // entregaria um oráculo de enumeração de `source_app`.
        res.status(401).json({ error: "unauthorized" });
      })
      .catch(next);
  };
}
