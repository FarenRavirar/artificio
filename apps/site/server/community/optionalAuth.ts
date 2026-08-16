import type { RequestHandler } from "express";
import { verifyToken, type AuthenticatedRequest } from "@artificio/auth";

/**
 * T6.4 (spec 090) — sessão **opcional** para a leitura da conversa.
 *
 * ## Por que existe, sendo que `requireAuth` já está no pacote
 *
 * `@artificio/auth` exporta só `requireAuth` (`middleware.ts:16`), que responde
 * `401` quando não há sessão. A leitura da árvore de comentários é **pública**,
 * mas sensível à sessão: `my_vote` e `viewer_is_author` só existem se o
 * `accounts.` souber quem pergunta (`contrato-http-v1.md` §2). Usar
 * `requireAuth` ali exigiria login para *ler* comentário; não usar nada apagaria
 * o voto do próprio usuário da tela. As duas saídas são erradas.
 *
 * ## Por que aqui, e não em `packages/auth`
 *
 * Subir o middleware para o pacote é o desenho mais bonito e o mais caro:
 * `packages/auth` é o pacote sagrado (AGENTS.md §Isolamento de App), e mudança
 * de código nele exige aprovação, SDD completo e smoke de **todos** os
 * consumidores SSO. O `downloads` resolveu igual, com o seu próprio
 * (`backend/src/middleware/auth.ts:113`). Este arquivo é a terceira cópia da
 * mesma ideia; consolidar as três é decisão do mantenedor, não efeito colateral
 * de uma fase de adoção.
 *
 * Nenhuma decisão de autorização depende disto: quem recusa escrita é
 * `requireAuth` nas rotas de mutação, e quem decide autoria é o `accounts.`
 * dentro da transação (§4). Aqui a sessão só **enriquece** a leitura.
 */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  const [scheme, bearerToken] = header?.split(" ") ?? [];
  const cookieToken =
    typeof req.cookies?.artificio_session === "string"
      ? req.cookies.artificio_session
      : null;

  const token = (scheme === "Bearer" && bearerToken ? bearerToken : null) ?? cookieToken;
  // Token ausente, expirado ou forjado seguem o MESMO caminho: seguir sem
  // sessão. Responder erro aqui transformaria cookie velho — que todo navegador
  // acaba tendo — em página de comentários quebrada, quando o comportamento
  // correto é mostrar a conversa deslogada.
  const session = token ? verifyToken(token) : null;

  if (session) (req as AuthenticatedRequest).session = session;
  next();
};
