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
import { isValidServiceToken } from "./serviceToken.js";

/**
 * T2.2a — guard de credencial de serviço com escopo.
 *
 * Substitui a checagem booleana de `X-Service-Token` por uma que resolve
 * identidade. Quem passa por aqui deixa em `req.serviceCredential` o
 * `source_app`, o `realm` e os escopos da credencial — e é **daí** que os
 * handlers derivam `realm`/`source_app`, nunca do corpo da requisição.
 *
 * ## Fallback de transição
 *
 * `SERVICE_SECRET` continua aceito enquanto os consumidores migram
 * (`downloads` e `mesas`). A transição existe porque remover o segredo global
 * antes dos clientes trocarem derrubaria moderação e leitura de segredos em
 * produção. Duas travas mantêm o fallback honesto:
 *
 * 1. **Ele nunca produz identidade.** `req.serviceCredential` fica `undefined`,
 *    então nenhuma rota que precise derivar `realm`/`source_app` pode ser
 *    servida por ele — só as duas rotas legadas, que não derivam nada.
 * 2. **`allowLegacySecret` é opt-in por rota.** Rota comunitária nova nunca
 *    liga essa opção; o default é recusar.
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
  /**
   * Aceita o `SERVICE_SECRET` global como fallback. Somente para as duas rotas
   * que existiam antes de T2.2a. **Nunca** ligar em rota comunitária: o segredo
   * global não identifica `source_app` nem `realm`.
   */
  allowLegacySecret?: boolean;
  /** Valor do `SERVICE_SECRET`, usado apenas quando `allowLegacySecret`. */
  legacySecret?: string;
  /**
   * Chamado quando o fallback legado autentica. Serve para medir se ainda há
   * consumidor no mecanismo antigo antes de removê-lo. Recebe só o nome da
   * rota — **nunca** o segredo.
   */
  onLegacyUse?: (route: string) => void;
}

export function requireServiceCredential(
  db: Kysely<Database>,
  options: RequireServiceCredentialOptions = {},
) {
  const { scope, allowLegacySecret = false, legacySecret, onLegacyUse } = options;

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

        if (allowLegacySecret && isValidServiceToken(legacySecret, header)) {
          onLegacyUse?.(req.path);
          // Sem `req.serviceCredential`: o segredo global não identifica quem
          // chamou. Rota que precise de `realm`/`source_app` falha adiante por
          // ausência de identidade, que é o comportamento correto.
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
